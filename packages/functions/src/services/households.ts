import {
  DEFAULT_SETTINGS,
  QUOTAS,
  STARTER_SHOP_ITEMS,
  THEMES,
  balance,
  convertPurse,
  findTemplate,
  validateCoinTypes,
  type CreateHouseholdInput,
  type Household,
  type HouseholdSettings,
  type Member,
  type Role,
  type ShopItem,
  type Task,
} from '@pobe/core';
import type { Actor, Deps } from '../context';
import { keys, partition } from '../db/keys';
import { ConditionFailed, type Item, type WriteOp } from '../db/types';
import { ApiError, forbidden } from '../lib/errors';
import { ulid } from '../lib/ids';
import { auditOp, getHousehold, getMember, listMembers, toItem } from '../repo';
import { requireAdmin } from './auth';
import { commitMoney, newEntry } from './money';

const MEMBER_COLORS = ['#F4A0B6', '#8EC5EE', '#B9A2EE', '#F2CF63', '#8FD3A6', '#F6B48A', '#9AD9D2', '#E8A0E0'];

export function newMember(deps: Deps, householdId: string, name: string, role: Role, index: number, color?: string): Member {
  return {
    id: ulid(deps.now().getTime()),
    householdId,
    name,
    role,
    color: color ?? MEMBER_COLORS[index % MEMBER_COLORS.length]!,
    theme: 'pink',
    purse: {},
    debt: 0,
    equipped: { accessory: 'none' },
    version: 0,
    createdAt: deps.now().toISOString(),
  };
}

/** Creates a household with the caller (an OAuth user) as its first admin. */
export async function createHousehold(deps: Deps, user: { sub: string; name?: string }, input: CreateHouseholdInput) {
  const now = deps.now();
  const hid = ulid(now.getTime());
  const settings: HouseholdSettings = { ...DEFAULT_SETTINGS, timeZone: input.timeZone };
  const household: Household = { id: hid, name: input.name, settings, createdAt: now.toISOString(), createdBy: user.sub };
  const admin = newMember(deps, hid, input.memberName, 'admin', 0);
  admin.userSub = user.sub;
  const today = now.toISOString().slice(0, 10);
  const tasks: Task[] = (input.templateIds ?? []).flatMap((tid) => {
    const t = findTemplate(tid);
    if (!t) return [];
    return [
      {
        id: ulid(now.getTime()),
        householdId: hid,
        title: t.title,
        emoji: t.emoji,
        reward: t.reward,
        assigneeId: null,
        requiresApproval: false,
        recurrence: t.recurrence ? { ...t.recurrence, anchor: today } : undefined,
        checklist: t.checklist?.map((label) => ({ id: ulid(now.getTime()), label })),
        status: 'open',
        templateId: t.id,
        createdAt: now.toISOString(),
        createdBy: admin.id,
        updatedAt: now.toISOString(),
      } satisfies Task,
    ];
  });
  const shop: ShopItem[] = STARTER_SHOP_ITEMS.map((s) => ({
    id: ulid(now.getTime()),
    householdId: hid,
    title: s.title,
    emoji: s.emoji,
    price: s.price,
    stock: null,
    requiresApproval: false,
    active: true,
    createdAt: now.toISOString(),
  }));
  try {
    // Quota: households created per user (atomic counter).
    await deps.db.increment(keys.userProfile(user.sub), 'householdsCreated', 1, QUOTAS.householdsPerUser);
  } catch (err) {
    if (err instanceof ConditionFailed) {
      throw new ApiError('QUOTA', `You can create up to ${QUOTAS.householdsPerUser} households.`);
    }
    throw err;
  }
  const ops: WriteOp[] = [
    { put: toItem.household(household), if: { notExists: true } },
    { put: toItem.member(admin), if: { notExists: true } },
    { put: { ...keys.userHousehold(user.sub, hid), householdId: hid, householdName: household.name, memberId: admin.id } },
    ...tasks.map((t) => ({ put: toItem.task(t) })),
    ...shop.map((s) => ({ put: toItem.shopItem(s) })),
  ];
  for (let i = 0; i < ops.length; i += 90) await deps.db.transact(ops.slice(i, i + 90));
  return { household, member: admin };
}

export async function updateHousehold(deps: Deps, actor: Actor, input: { name?: string; settings?: Partial<HouseholdSettings> }) {
  requireAdmin(actor);
  const h = await getHousehold(deps, actor.householdId);
  const settings = { ...h.settings, ...input.settings };
  if (input.settings?.timeZone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: input.settings.timeZone });
    } catch {
      throw new ApiError('BAD_REQUEST', `"${input.settings.timeZone}" isn't a time zone I know. Try something like America/New_York.`);
    }
  }
  const updated: Household = { ...h, name: input.name ?? h.name, settings };
  const coinTypesChanged = input.settings?.coinTypes && input.settings.coinTypes.join(',') !== h.settings.coinTypes.join(',');
  if (!coinTypesChanged) {
    await deps.db.transact([{ put: toItem.household(updated) }, auditOp(deps, actor, 'household.update', undefined, { ...input })]);
    return updated;
  }
  validateCoinTypes(settings.coinTypes);
  // Re-mint every purse into the new coin types, keeping each balance.
  await commitMoney(deps, async () => {
    const members = await listMembers(deps, actor.householdId);
    const changed = members.map((m) => ({ ...m, purse: convertPurse(m.purse, settings.coinTypes) }));
    const entries = members.map((m, i) =>
      newEntry(deps, actor, m, 'CONVERT', {
        value: 0,
        label: 'Coins re-minted to new coin types',
        coinsOut: m.purse,
        coinsIn: changed[i]!.purse,
      }),
    );
    return {
      members: changed,
      entries,
      ops: [{ put: toItem.household(updated) }, auditOp(deps, actor, 'household.coinTypes', undefined, { coinTypes: settings.coinTypes })],
      result: null,
    };
  });
  return updated;
}

export async function deleteHousehold(deps: Deps, actor: Actor) {
  requireAdmin(actor);
  const members = await listMembers(deps, actor.householdId, true);
  for (const m of members) {
    if (m.userSub) await deps.db.delete(keys.userHousehold(m.userSub, actor.householdId)).catch(() => undefined);
  }
  await deps.storage.deletePrefix(`h/${actor.householdId}/`);
  await deps.db.deletePartition(partition(actor.householdId));
}

export async function addMember(deps: Deps, actor: Actor, input: { name: string; role: Role; color?: string }) {
  requireAdmin(actor);
  const members = await listMembers(deps, actor.householdId);
  if (members.length >= QUOTAS.membersPerHousehold) {
    throw new ApiError('QUOTA', `A household can have up to ${QUOTAS.membersPerHousehold} members.`);
  }
  const m = newMember(deps, actor.householdId, input.name, input.role, members.length, input.color);
  await deps.db.transact([{ put: toItem.member(m), if: { notExists: true } }, auditOp(deps, actor, 'member.add', m.id, { name: m.name })]);
  return m;
}

export async function updateMember(
  deps: Deps,
  actor: Actor,
  memberId: string,
  input: { name?: string; role?: Role; color?: string; theme?: string },
) {
  const self = memberId === actor.memberId;
  if (!self && actor.role !== 'admin') throw forbidden('You can only edit your own profile.');
  if (input.role && actor.role !== 'admin') throw forbidden('Only admins can change roles.');
  const m = await getMember(deps, actor.householdId, memberId);
  if (input.role === 'member' && m.role === 'admin') {
    const admins = (await listMembers(deps, actor.householdId)).filter((x) => x.role === 'admin');
    if (admins.length <= 1) throw new ApiError('CONFLICT', 'Every household needs at least one admin. Make someone else an admin first.');
  }
  if (input.theme && !(input.theme in THEMES)) throw new ApiError('BAD_REQUEST', 'Unknown theme.');
  const updated: Member = {
    ...m,
    name: input.name ?? m.name,
    role: input.role ?? m.role,
    color: input.color ?? m.color,
    theme: (input.theme as Member['theme']) ?? m.theme,
    version: m.version + 1,
  };
  const ops: WriteOp[] = [{ put: toItem.member(updated), if: { version: m.version } }];
  if (input.role && input.role !== m.role) ops.push(auditOp(deps, actor, 'member.role', m.id, { role: input.role }));
  await deps.db.transact(ops);
  return updated;
}

/**
 * Removes a member. Their history stays (so balances and "funded by" still add up), but
 * their name, devices, push targets and account links are removed.
 */
export async function removeMember(deps: Deps, actor: Actor, memberId: string) {
  const self = memberId === actor.memberId;
  if (!self) requireAdmin(actor);
  const members = await listMembers(deps, actor.householdId);
  const m = members.find((x) => x.id === memberId);
  if (!m) throw new ApiError('NOT_FOUND', "That member wasn't found.");
  const admins = members.filter((x) => x.role === 'admin');
  if (m.role === 'admin' && admins.length === 1 && members.length > 1) {
    throw new ApiError('CONFLICT', "You're the only admin. Make someone else an admin first, or delete the household.");
  }
  if (members.length === 1) {
    await deleteHousehold(deps, { ...actor, role: 'admin' });
    return { householdDeleted: true };
  }
  const rows = await deps.db.query<Item & { memberId?: string; hash?: string }>(partition(actor.householdId));
  const personal = rows.filter(
    (r) => (r.sk.startsWith('D#') && r.memberId === memberId) || r.sk.startsWith(`PT#${memberId}#`) || r.sk === `CALREF#${memberId}`,
  );
  const tombstone: Member = {
    ...m,
    name: 'Former member',
    userSub: undefined,
    deletedAt: deps.now().toISOString(),
    version: m.version + 1,
  };
  await deps.db.transact([{ put: toItem.member(tombstone), if: { version: m.version } }, auditOp(deps, actor, 'member.remove', memberId)]);
  for (const r of personal) {
    await deps.db.delete({ pk: r.pk, sk: r.sk });
    if (r.sk.startsWith('CALREF#') && r.hash) await deps.db.delete(keys.calendar(r.hash)).catch(() => undefined);
  }
  if (m.userSub) await deps.db.delete(keys.userHousehold(m.userSub, actor.householdId)).catch(() => undefined);
  return { householdDeleted: false, balanceForfeited: balance(m.purse) };
}

/** Deletes an OAuth user's account everywhere (App Store requirement). */
export async function deleteAccount(deps: Deps, actor: Actor | null, sub?: string) {
  if (actor) {
    const result = await removeMember(deps, actor, actor.memberId);
    if (!sub) return result;
  }
  if (sub) {
    const links = await deps.db.query<Item & { householdId: string; memberId: string }>(`U#${sub}`, { beginsWith: 'H#' });
    for (const link of links) {
      if (actor && link.householdId === actor.householdId) continue;
      const m = await getMember(deps, link.householdId, link.memberId).catch(() => null);
      if (m)
        await removeMember(deps, { householdId: link.householdId, memberId: m.id, role: m.role, principal: { kind: 'user', sub } }, m.id);
    }
    await deps.db.deletePartition(`U#${sub}`);
  }
  return { deleted: true };
}
