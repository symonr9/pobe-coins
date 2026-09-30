import {
  COSMETICS,
  QUOTAS,
  balance,
  findCosmetic,
  fundedBy,
  isAvailable,
  summarizeFunding,
  toLocalDate,
  type Household,
  type LedgerEntry,
  type LinkPreview,
  type Member,
  type Purchase,
  type PurchaseInput,
  type ShopItem,
  type ShopItemInput,
  type WishlistGoal,
  type GoalInput,
} from '@pobe/core';
import type { Actor, Deps } from '../context';
import { keys, memberLedgerIndex, PREFIX } from '../db/keys';
import { ConditionFailed, strip, type Item, type WriteOp } from '../db/types';
import { ApiError, forbidden } from '../lib/errors';
import { ulid } from '../lib/ids';
import {
  auditOp,
  getGoal,
  getHousehold,
  getLedgerEntries,
  getMember,
  getPurchase,
  getShopItem,
  listByPrefix,
  listMembers,
  toItem,
} from '../repo';
import { requireAdmin } from './auth';
import { commitMoney, credit, debit, insufficient, newEntry, reverseDebit, spendFrom } from './money';
import { fetchPreview } from './preview';

function needsApproval(household: Household, amount: number, members: number, forced = false) {
  if (members < 2) return false;
  if (forced) return true;
  const t = household.settings.purchaseApprovalThreshold;
  return t !== null && amount > t;
}

function checkPhotoKeys(actor: Actor, photoKeys: string[]) {
  for (const k of photoKeys)
    if (!k.startsWith(`h/${actor.householdId}/`)) throw new ApiError('BAD_REQUEST', "A photo doesn't belong to this household.");
}

interface SpendArgs {
  kind: Purchase['kind'];
  title: string;
  description?: string;
  amount: number;
  url?: string;
  preview?: LinkPreview;
  photoKeys: string[];
  shopItemId?: string;
  goalId?: string;
  allowIou: boolean;
  approval: boolean;
  extraOps?: (purchase: Purchase) => WriteOp[];
}

/** Creates a purchase and takes the coins right away (held while it waits for approval). */
async function spend(deps: Deps, actor: Actor, household: Household, args: SpendArgs) {
  const now = deps.now();
  return commitMoney(deps, async () => {
    const member = await getMember(deps, actor.householdId, actor.memberId);
    const d = spendFrom(member, args.amount, household.settings.coinTypes, household.settings.debtLimit, args.allowIou);
    const purchase: Purchase = {
      id: ulid(now.getTime()),
      householdId: actor.householdId,
      memberId: actor.memberId,
      kind: args.kind,
      title: args.title,
      description: args.description,
      amount: args.amount,
      url: args.url,
      preview: args.preview,
      photoKeys: args.photoKeys,
      shopItemId: args.shopItemId,
      goalId: args.goalId,
      status: args.approval ? 'pending' : 'approved',
      redemption: args.kind === 'reward' ? 'redeemed' : undefined,
      ledgerEntryIds: [],
      createdAt: now.toISOString(),
    };
    const entry = newEntry(deps, actor, member, 'SPEND', {
      value: -args.amount,
      label: args.title,
      coinsIn: d.coinsIn,
      coinsOut: d.coinsOut,
      debtDelta: d.debtDelta,
      ref: { type: args.kind === 'reward' ? 'shopItem' : 'purchase', id: args.kind === 'reward' ? args.shopItemId! : purchase.id },
    });
    purchase.ledgerEntryIds = [entry.id];
    return {
      members: [d.member],
      entries: [entry],
      ops: [{ put: toItem.purchase(purchase), if: { notExists: true } }, ...(args.extraOps?.(purchase) ?? [])],
      result: { purchase, member: d.member, entry },
    };
  });
}

async function notifyPurchase(deps: Deps, actor: Actor, purchase: Purchase) {
  const members = await listMembers(deps, actor.householdId);
  const me = members.find((m) => m.id === actor.memberId);
  const others = members.filter((m) => m.id !== actor.memberId).map((m) => m.id);
  if (purchase.status === 'pending') {
    await deps.notifier.send(actor.householdId, others, {
      title: 'Approve a purchase?',
      body: `${me?.name ?? 'Someone'} wants to spend ${purchase.amount} coins on "${purchase.title}".`,
      url: '/approvals',
      category: 'approval',
      data: { type: 'purchase', id: purchase.id },
    });
  } else {
    const household = await getHousehold(deps, actor.householdId);
    if (household.settings.visibility === 'full' || purchase.kind === 'reward') {
      await deps.notifier.send(actor.householdId, others, {
        title: purchase.kind === 'reward' ? 'Reward redeemed' : 'New purchase',
        body:
          purchase.kind === 'reward'
            ? `${me?.name ?? 'Someone'} redeemed "${purchase.title}". Time to deliver!`
            : `${me?.name ?? 'Someone'} spent ${purchase.amount} coins on "${purchase.title}".`,
        url: `/purchase/${purchase.id}`,
      });
    }
  }
}

export async function createPurchase(deps: Deps, actor: Actor, input: PurchaseInput) {
  const household = await getHousehold(deps, actor.householdId);
  const members = await listMembers(deps, actor.householdId);
  checkPhotoKeys(actor, input.photoKeys);
  const preview = input.url ? await fetchPreview(deps, input.url).catch(() => ({ url: input.url! })) : undefined;
  const r = await spend(deps, actor, household, {
    kind: 'purchase',
    title: input.title,
    description: input.description,
    amount: input.amount,
    url: input.url,
    preview,
    photoKeys: input.photoKeys,
    allowIou: input.allowIou,
    approval: needsApproval(household, input.amount, members.length),
  });
  await notifyPurchase(deps, actor, r.purchase);
  return r;
}

export async function decidePurchase(deps: Deps, actor: Actor, purchaseId: string, approve: boolean) {
  const household = await getHousehold(deps, actor.householdId);
  const r = await commitMoney(deps, async () => {
    const p = await getPurchase(deps, actor.householdId, purchaseId);
    if (p.status !== 'pending') throw new ApiError('CONFLICT', `This purchase was already ${p.status}.`);
    if (p.memberId === actor.memberId) throw forbidden('Someone else needs to approve your purchase.');
    const decided: Purchase = {
      ...p,
      status: approve ? 'approved' : 'rejected',
      decidedBy: actor.memberId,
      decidedAt: deps.now().toISOString(),
    };
    const ops: WriteOp[] = [{ put: toItem.purchase(decided), if: { equals: { status: 'pending' } } }];
    if (approve) return { members: [], entries: [], ops, result: decided };
    return {
      ...(await refundPurchase(deps, actor, household, p, 'REFUND')),
      ops: [...ops, ...(await restockOps(deps, p))],
      result: decided,
    };
  });
  await deps.notifier.send(actor.householdId, [r.memberId], {
    title: approve ? 'Purchase approved' : 'Purchase declined',
    body: approve ? `"${r.title}" was approved. Enjoy!` : `"${r.title}" wasn't approved. Your ${r.amount} coins are back.`,
    url: `/purchase/${r.id}`,
  });
  return r;
}

async function refundPurchase(deps: Deps, actor: Actor, household: Household, p: Purchase, kind: 'REFUND' | 'UNDO') {
  let member = await getMember(deps, actor.householdId, p.memberId);
  const originals = await getLedgerEntries(deps, actor.householdId, p.ledgerEntryIds);
  const entries: LedgerEntry[] = [];
  for (const e of originals) {
    const r = reverseDebit(member, e, household.settings.coinTypes);
    entries.push(
      newEntry(deps, actor, member, kind, {
        value: -e.value,
        label: `${kind === 'UNDO' ? 'Undo' : 'Refund'}: ${e.label}`,
        coinsIn: r.coinsIn,
        debtDelta: r.debtDelta,
        reverses: e.id,
        ref: e.ref,
      }),
    );
    member = r.member;
  }
  return { members: [member], entries };
}

async function restockOps(deps: Deps, p: Purchase): Promise<WriteOp[]> {
  if (!p.shopItemId) return [];
  const item = await deps.db.get<Item & ShopItem & { sold?: number }>(keys.shopItem(p.householdId, p.shopItemId));
  if (!item || item.stock === null) return [];
  return [{ increment: keys.shopItem(p.householdId, p.shopItemId), field: 'sold', by: -1 }];
}

export async function undoPurchase(deps: Deps, actor: Actor, purchaseId: string) {
  const household = await getHousehold(deps, actor.householdId);
  return commitMoney(deps, async () => {
    const p = await getPurchase(deps, actor.householdId, purchaseId);
    if (p.memberId !== actor.memberId) throw forbidden('You can only undo your own purchases.');
    if (p.status !== 'approved' && p.status !== 'pending') throw new ApiError('CONFLICT', `This purchase was already ${p.status}.`);
    if (p.kind === 'goal') throw new ApiError('BAD_REQUEST', "Goal purchases can't be undone. Ask an admin to correct it.");
    const age = (deps.now().getTime() - Date.parse(p.createdAt)) / 60_000;
    if (age > household.settings.undoWindowMinutes) {
      throw new ApiError(
        'CONFLICT',
        `Undo is only available for ${household.settings.undoWindowMinutes} minutes. Ask an admin to correct it.`,
      );
    }
    const refund = await refundPurchase(deps, actor, household, p, 'UNDO');
    return {
      ...refund,
      ops: [{ put: toItem.purchase({ ...p, status: 'undone' }), if: { equals: { status: p.status } } }, ...(await restockOps(deps, p))],
      result: { ...p, status: 'undone' as const },
    };
  });
}

export async function fulfillReward(deps: Deps, actor: Actor, purchaseId: string) {
  const p = await getPurchase(deps, actor.householdId, purchaseId);
  if (p.kind !== 'reward') throw new ApiError('BAD_REQUEST', 'Only shop rewards can be marked delivered.');
  if (p.redemption === 'fulfilled') return p;
  const updated: Purchase = { ...p, redemption: 'fulfilled', fulfilledBy: actor.memberId };
  await deps.db.put(toItem.purchase(updated));
  if (p.memberId !== actor.memberId) {
    await deps.notifier.send(actor.householdId, [p.memberId], {
      title: 'Reward delivered',
      body: `"${p.title}" was marked as delivered. Enjoy!`,
      url: `/purchase/${p.id}`,
    });
  }
  return updated;
}

/** Purchase detail with "paid for by". */
export async function purchaseDetail(deps: Deps, actor: Actor, purchaseId: string) {
  const [p, household] = await Promise.all([getPurchase(deps, actor.householdId, purchaseId), getHousehold(deps, actor.householdId)]);
  if (household.settings.visibility === 'balances' && p.memberId !== actor.memberId && actor.role !== 'admin') {
    throw forbidden('Purchase details are private in this household.');
  }
  const ledger = await deps.db.query<Item & LedgerEntry>(memberLedgerIndex(actor.householdId, p.memberId), {
    index: 'gsi1',
    beginsWith: 'L#',
  });
  const funding = fundedBy(ledger.map((e) => strip(e) as LedgerEntry));
  const allocations = p.ledgerEntryIds.flatMap((id) => funding.get(id) ?? []);
  const photoUrls = await Promise.all(p.photoKeys.map((k) => deps.storage.presignGet(k)));
  return { purchase: p, photoUrls, fundedBy: summarizeFunding(allocations), allocations };
}

// ---------- POBE Shop: household rewards ----------

export async function listShop(deps: Deps, actor: Actor) {
  const [items, unlocks, household] = await Promise.all([
    listByPrefix<ShopItem & { sold?: number }>(deps, actor.householdId, PREFIX.shopItem),
    listByPrefix<{ cosmeticId: string; memberId: string }>(deps, actor.householdId, `${PREFIX.unlock}${actor.memberId}#`),
    getHousehold(deps, actor.householdId),
  ]);
  const today = toLocalDate(deps.now(), household.settings.timeZone);
  return {
    items: items
      .filter((i) => i.active || actor.role === 'admin')
      .map((i) => ({ ...i, remaining: i.stock === null ? null : Math.max(0, i.stock - (i.sold ?? 0)) })),
    cosmetics: COSMETICS.filter((c) => isAvailable(c, today)).map((c) => ({ ...c, owned: unlocks.some((u) => u.cosmeticId === c.id) })),
  };
}

export async function createShopItem(deps: Deps, actor: Actor, input: ShopItemInput) {
  requireAdmin(actor);
  const existing = await listByPrefix<ShopItem>(deps, actor.householdId, PREFIX.shopItem);
  if (existing.length >= QUOTAS.shopItemsPerHousehold) throw new ApiError('QUOTA', 'The shop is full. Remove a reward first.');
  const item: ShopItem = { ...input, id: ulid(deps.now().getTime()), householdId: actor.householdId, createdAt: deps.now().toISOString() };
  await deps.db.transact([
    { put: toItem.shopItem(item) },
    auditOp(deps, actor, 'shop.create', item.id, { title: item.title, price: item.price }),
  ]);
  return item;
}

export async function updateShopItem(deps: Deps, actor: Actor, id: string, input: Partial<ShopItemInput>) {
  requireAdmin(actor);
  const item = await getShopItem(deps, actor.householdId, id);
  const updated = { ...item, ...input };
  await deps.db.put(toItem.shopItem(updated));
  return updated;
}

export async function deleteShopItem(deps: Deps, actor: Actor, id: string) {
  requireAdmin(actor);
  await deps.db.transact([{ delete: keys.shopItem(actor.householdId, id) }, auditOp(deps, actor, 'shop.delete', id)]);
}

export async function buyShopItem(deps: Deps, actor: Actor, itemId: string, allowIou: boolean) {
  const [household, item, members] = await Promise.all([
    getHousehold(deps, actor.householdId),
    getShopItem(deps, actor.householdId, itemId),
    listMembers(deps, actor.householdId),
  ]);
  if (!item.active) throw new ApiError('BAD_REQUEST', "This reward isn't for sale right now.");
  if (item.stock !== null && (item.sold ?? 0) >= item.stock) throw new ApiError('CONFLICT', 'Sold out! Ask an admin to restock it.');
  const now = deps.now();
  if (item.cooldownHours) {
    const cd = await deps.db.get<Item & { until: string }>(keys.shopCooldown(actor.householdId, itemId, actor.memberId));
    if (cd && Date.parse(cd.until) > now.getTime()) {
      const hours = Math.ceil((Date.parse(cd.until) - now.getTime()) / 3600_000);
      throw new ApiError('CONFLICT', `You can buy this again in ${hours} hour${hours === 1 ? '' : 's'}.`);
    }
  }
  try {
    const r = await spend(deps, actor, household, {
      kind: 'reward',
      title: item.title,
      description: item.description,
      amount: item.price,
      photoKeys: [],
      shopItemId: item.id,
      allowIou,
      approval: needsApproval(household, item.price, members.length, item.requiresApproval),
      extraOps: () => {
        const ops: WriteOp[] = [];
        if (item.stock !== null) ops.push({ increment: keys.shopItem(actor.householdId, item.id), field: 'sold', by: 1, max: item.stock });
        if (item.cooldownHours) {
          const until = new Date(now.getTime() + item.cooldownHours * 3600_000);
          ops.push({
            put: {
              ...keys.shopCooldown(actor.householdId, item.id, actor.memberId),
              until: until.toISOString(),
              ttl: Math.floor(until.getTime() / 1000) + 3600,
            },
          });
        }
        return ops;
      },
    });
    await notifyPurchase(deps, actor, r.purchase);
    return r;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'CONFLICT' && item.stock !== null)
      throw new ApiError('CONFLICT', 'Sold out! Ask an admin to restock it.');
    throw err;
  }
}

// ---------- POBE Shop: cosmetics ----------

export async function buyCosmetic(deps: Deps, actor: Actor, cosmeticId: string) {
  const cosmetic = findCosmetic(cosmeticId);
  const household = await getHousehold(deps, actor.householdId);
  if (!cosmetic || !isAvailable(cosmetic, toLocalDate(deps.now(), household.settings.timeZone))) {
    throw new ApiError('NOT_FOUND', "That item isn't in the shop right now.");
  }
  try {
    return await commitMoney(deps, async () => {
      const member = await getMember(deps, actor.householdId, actor.memberId);
      if (balance(member.purse) < cosmetic.price) throw insufficient(member, cosmetic.price, 0, false);
      const d = debit(member, cosmetic.price, household.settings.coinTypes, 0);
      const e = newEntry(deps, actor, member, 'COSMETIC', {
        value: -cosmetic.price,
        label: cosmetic.name,
        coinsIn: d.coinsIn,
        coinsOut: d.coinsOut,
        ref: { type: 'cosmetic', id: cosmetic.id },
      });
      const unlock = {
        ...keys.unlock(actor.householdId, actor.memberId, cosmetic.id),
        cosmeticId: cosmetic.id,
        memberId: actor.memberId,
        purchasedAt: deps.now().toISOString(),
      };
      return { members: [d.member], entries: [e], ops: [{ put: unlock, if: { notExists: true } }], result: { member: d.member, cosmetic } };
    });
  } catch (err) {
    if (await deps.db.get(keys.unlock(actor.householdId, actor.memberId, cosmetic.id)))
      throw new ApiError('CONFLICT', 'You already own this.');
    throw err;
  }
}

export async function equip(
  deps: Deps,
  actor: Actor,
  input: { accessory?: Member['equipped']['accessory']; icon?: string; background?: string },
) {
  const owned = new Set(
    (await listByPrefix<{ cosmeticId: string }>(deps, actor.householdId, `${PREFIX.unlock}${actor.memberId}#`)).map((u) => u.cosmeticId),
  );
  const ownsAccessory = (a: string) => a === 'none' || COSMETICS.some((c) => c.accessory === a && owned.has(c.id));
  if (input.accessory && !ownsAccessory(input.accessory)) throw forbidden('Buy that accessory in the POBE Shop first.');
  for (const id of [input.icon, input.background]) if (id && !owned.has(id)) throw forbidden('Buy that item in the POBE Shop first.');
  const m = await getMember(deps, actor.householdId, actor.memberId);
  const updated: Member = { ...m, equipped: { ...m.equipped, ...input }, version: m.version + 1 };
  await deps.db.put(toItem.member(updated), { version: m.version });
  return updated;
}

// ---------- wishlist goals ----------

export async function listGoals(deps: Deps, actor: Actor) {
  const goals = await listByPrefix<WishlistGoal>(deps, actor.householdId, PREFIX.goal, true);
  return goals.filter((g) => g.status === 'saving' && (g.ownerId === null || g.ownerId === actor.memberId || actor.role === 'admin'));
}

export async function createGoal(deps: Deps, actor: Actor, input: GoalInput) {
  const existing = await listByPrefix<WishlistGoal>(deps, actor.householdId, PREFIX.goal);
  if (existing.length >= QUOTAS.goalsPerHousehold) throw new ApiError('QUOTA', 'Too many goals. Finish or remove some first.');
  if (input.photoKey) checkPhotoKeys(actor, [input.photoKey]);
  const preview = input.url ? await fetchPreview(deps, input.url).catch(() => ({ url: input.url! })) : undefined;
  const goal: WishlistGoal = {
    id: ulid(deps.now().getTime()),
    householdId: actor.householdId,
    ownerId: input.shared ? null : actor.memberId,
    title: input.title,
    target: input.target,
    url: input.url,
    preview,
    photoKey: input.photoKey,
    contributions: {},
    status: 'saving',
    createdAt: deps.now().toISOString(),
  };
  await deps.db.put(toItem.goal(goal));
  return goal;
}

export async function contributeToGoal(deps: Deps, actor: Actor, goalId: string, amount: number) {
  const household = await getHousehold(deps, actor.householdId);
  const r = await commitMoney(deps, async () => {
    const goal = await getGoal(deps, actor.householdId, goalId);
    if (goal.ownerId !== null) throw new ApiError('BAD_REQUEST', 'Only shared goals take contributions. Personal goals track your purse.');
    if (goal.status !== 'saving') throw new ApiError('CONFLICT', 'This goal is closed.');
    const saved = Object.values(goal.contributions).reduce((a, b) => a + b, 0);
    const room = goal.target - saved;
    if (room <= 0) throw new ApiError('CONFLICT', 'This goal is already fully funded.');
    const give = Math.min(amount, room);
    const member = await getMember(deps, actor.householdId, actor.memberId);
    if (balance(member.purse) < give) throw insufficient(member, give, 0, false);
    const d = debit(member, give, household.settings.coinTypes, 0);
    const e = newEntry(deps, actor, member, 'GOAL_CONTRIBUTE', {
      value: -give,
      label: `Saved toward ${goal.title}`,
      coinsIn: d.coinsIn,
      coinsOut: d.coinsOut,
      ref: { type: 'goal', id: goal.id },
    });
    const updated: WishlistGoal = {
      ...goal,
      contributions: { ...goal.contributions, [actor.memberId]: (goal.contributions[actor.memberId] ?? 0) + give },
    };
    return {
      members: [d.member],
      entries: [e],
      ops: [{ put: toItem.goal(updated), if: { equals: { status: 'saving' } } }],
      result: { goal: updated, contributed: give, reached: saved + give >= goal.target },
    };
  });
  if (r.reached) {
    const members = await listMembers(deps, actor.householdId);
    await deps.notifier.send(
      actor.householdId,
      members.map((m) => m.id),
      { title: 'Goal reached!', body: `"${r.goal.title}" is fully saved up!`, url: '/goals' },
    );
  }
  return r;
}

export async function buyGoal(deps: Deps, actor: Actor, goalId: string, allowIou: boolean) {
  const [household, goal, members] = await Promise.all([
    getHousehold(deps, actor.householdId),
    getGoal(deps, actor.householdId, goalId),
    listMembers(deps, actor.householdId),
  ]);
  if (goal.status !== 'saving') throw new ApiError('CONFLICT', 'This goal is closed.');
  if (goal.ownerId !== null) {
    if (goal.ownerId !== actor.memberId) throw forbidden("This isn't your goal.");
    const r = await spend(deps, actor, household, {
      kind: 'goal',
      title: goal.title,
      amount: goal.target,
      url: goal.url,
      preview: goal.preview,
      photoKeys: goal.photoKey ? [goal.photoKey] : [],
      goalId: goal.id,
      allowIou,
      approval: needsApproval(household, goal.target, members.length),
      extraOps: () => [{ put: toItem.goal({ ...goal, status: 'bought' }), if: { equals: { status: 'saving' } } }],
    });
    await notifyPurchase(deps, actor, r.purchase);
    return r;
  }
  const saved = Object.values(goal.contributions).reduce((a, b) => a + b, 0);
  if (saved < goal.target) throw new ApiError('INSUFFICIENT', `This shared goal has ${saved} of ${goal.target} coins saved.`);
  const purchase: Purchase = {
    id: ulid(deps.now().getTime()),
    householdId: actor.householdId,
    memberId: actor.memberId,
    kind: 'goal',
    title: goal.title,
    amount: goal.target,
    url: goal.url,
    preview: goal.preview,
    photoKeys: goal.photoKey ? [goal.photoKey] : [],
    goalId: goal.id,
    status: 'approved',
    ledgerEntryIds: [],
    createdAt: deps.now().toISOString(),
  };
  await deps.db.transact([
    { put: toItem.goal({ ...goal, status: 'bought' }), if: { equals: { status: 'saving' } } },
    { put: toItem.purchase(purchase), if: { notExists: true } },
  ]);
  await deps.notifier.send(
    actor.householdId,
    members.map((m) => m.id),
    { title: 'Shared goal bought!', body: `"${goal.title}" is yours, together.`, url: `/purchase/${purchase.id}` },
  );
  return { purchase };
}

export async function cancelGoal(deps: Deps, actor: Actor, goalId: string) {
  const household = await getHousehold(deps, actor.householdId);
  return commitMoney(deps, async () => {
    const goal = await getGoal(deps, actor.householdId, goalId);
    if (goal.status !== 'saving') throw new ApiError('CONFLICT', 'This goal is already closed.');
    if (goal.ownerId !== null && goal.ownerId !== actor.memberId && actor.role !== 'admin') throw forbidden("This isn't your goal.");
    if (goal.ownerId === null && actor.role !== 'admin') throw forbidden('Only admins can cancel shared goals.');
    const members: Member[] = [];
    const entries: LedgerEntry[] = [];
    for (const [mid, amount] of Object.entries(goal.contributions)) {
      if (amount <= 0) continue;
      const m = await getMember(deps, actor.householdId, mid).catch(() => null);
      if (!m) continue;
      const c = credit(m, amount, household.settings.coinTypes);
      members.push(c.member);
      entries.push(
        newEntry(deps, actor, m, 'GOAL_REFUND', {
          value: amount,
          label: `Returned from ${goal.title}`,
          coinsIn: c.coinsIn,
          debtDelta: c.debtDelta,
          ref: { type: 'goal', id: goal.id },
        }),
      );
    }
    return {
      members,
      entries,
      ops: [{ put: toItem.goal({ ...goal, status: 'cancelled' }), if: { equals: { status: 'saving' } } }],
      result: { cancelled: true },
    };
  });
}

export { ConditionFailed };
