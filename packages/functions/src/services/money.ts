/**
 * Every coin movement goes through `commitMoney`: members are re-read, the change is
 * computed with @pobe/core, then member purses (guarded by `version`), ledger entries and
 * any related writes are committed in one DynamoDB transaction. A concurrent change makes
 * the transaction fail, and it's retried from a fresh read.
 */
import {
  CoinError,
  balance,
  containsCoins,
  pay,
  payWithDebt,
  receive,
  refund,
  removeCoins,
  type LedgerEntry,
  type LedgerKind,
  type LedgerRef,
  type Member,
  type Purse,
} from '@pobe/core';
import type { Actor, Deps } from '../context';
import { ConditionFailed, type WriteOp } from '../db/types';
import { ApiError, conflict } from '../lib/errors';
import { ulid } from '../lib/ids';
import { getHousehold, getMember, toItem } from '../repo';

export interface MoneyPlan<R> {
  /** Members as read (with their original version) but with updated purse/debt. */
  members: Member[];
  entries: LedgerEntry[];
  ops?: WriteOp[];
  result: R;
}

const MAX_ATTEMPTS = 4;

export async function commitMoney<R>(deps: Deps, build: () => Promise<MoneyPlan<R>>): Promise<R> {
  for (let attempt = 1; ; attempt++) {
    const plan = await build();
    const ops: WriteOp[] = [
      ...plan.members.map((m) => ({ put: toItem.member({ ...m, version: m.version + 1 }), if: { version: m.version } }) as WriteOp),
      ...plan.entries.map((e) => ({ put: toItem.ledger(e), if: { notExists: true } }) as WriteOp),
      ...(plan.ops ?? []),
    ];
    try {
      await deps.db.transact(ops);
      return plan.result;
    } catch (err) {
      if (!(err instanceof ConditionFailed)) throw err;
      // Retry only when a member changed underneath us; other failed conditions mean the
      // thing we were acting on changed state (e.g. already approved), which build() re-checks.
      if (attempt >= MAX_ATTEMPTS) throw conflict('Someone else changed this at the same moment. Please try again.');
    }
  }
}

export function newEntry(
  deps: Deps,
  actor: Pick<Actor, 'householdId' | 'memberId'>,
  member: Member,
  kind: LedgerKind,
  fields: {
    value: number;
    label: string;
    coinsIn?: Purse;
    coinsOut?: Purse;
    debtDelta?: number;
    ref?: LedgerRef;
    counterpartId?: string;
    reverses?: string;
    reason?: string;
  },
): LedgerEntry {
  const now = deps.now();
  return {
    id: ulid(now.getTime()),
    householdId: actor.householdId,
    memberId: member.id,
    kind,
    value: fields.value,
    coinsIn: fields.coinsIn ?? {},
    coinsOut: fields.coinsOut ?? {},
    debtDelta: fields.debtDelta ?? 0,
    label: fields.label,
    ref: fields.ref,
    counterpartId: fields.counterpartId,
    reverses: fields.reverses,
    reason: fields.reason,
    createdAt: now.toISOString(),
    createdBy: actor.memberId,
  };
}

/** Adds value to a member (debt is paid first). Returns the updated member and entry fields. */
export function credit(member: Member, amount: number, coinTypes: number[]) {
  const r = receive(member.purse, member.debt, amount, coinTypes);
  return {
    member: { ...member, purse: r.newPurse, debt: r.newDebt },
    coinsIn: r.coinsIn,
    debtDelta: -r.debtPaid,
  };
}

/**
 * Takes value from a member like a cash register. `debtLimit` > current debt allows IOUs.
 * Throws INSUFFICIENT with a helpful message when the member can't cover it.
 */
export function debit(member: Member, amount: number, coinTypes: number[], debtLimit: number) {
  const r =
    debtLimit > 0
      ? payWithDebt(member.purse, member.debt, amount, debtLimit, coinTypes)
      : { ...pay(member.purse, amount, coinTypes), newDebt: member.debt };
  return {
    member: { ...member, purse: r.newPurse, debt: r.newDebt },
    coinsIn: r.coinsIn,
    coinsOut: r.coinsOut,
    debtDelta: r.debtAdded,
  };
}

/** Removes value previously credited by `entry` (undo of an earning). Never fails: goes into debt if needed. */
export function reverseCredit(member: Member, entry: LedgerEntry, coinTypes: number[]) {
  const debtRestored = -Math.min(0, entry.debtDelta); // debt that the credit paid off
  if (containsCoins(member.purse, entry.coinsIn)) {
    return {
      member: { ...member, purse: removeCoins(member.purse, entry.coinsIn)!, debt: member.debt + debtRestored },
      coinsIn: {},
      coinsOut: entry.coinsIn,
      debtDelta: debtRestored,
    };
  }
  const r = debit({ ...member, debt: member.debt + debtRestored }, entry.value - debtRestored, coinTypes, Number.MAX_SAFE_INTEGER);
  return { ...r, debtDelta: r.debtDelta + debtRestored };
}

/** Gives back value taken by `entry` (refund of a spend). */
export function reverseDebit(member: Member, entry: LedgerEntry, coinTypes: number[]) {
  const r = refund(member.purse, member.debt, { coinsOut: entry.coinsOut, coinsIn: entry.coinsIn, debtAdded: entry.debtDelta }, coinTypes);
  return {
    member: { ...member, purse: r.newPurse, debt: r.newDebt },
    coinsIn: r.coinsIn,
    coinsOut: {},
    debtDelta: r.newDebt - member.debt,
  };
}

export function insufficient(member: Member, amount: number, debtLimit: number, allowIou: boolean): ApiError {
  const have = balance(member.purse);
  const room = Math.max(0, debtLimit - member.debt);
  if (!allowIou && have + room >= amount && debtLimit > 0) {
    return new ApiError('INSUFFICIENT', `You have ${have} coins. You can borrow the other ${amount - have} as an IOU.`, {
      canBorrow: amount - have,
      balance: have,
    });
  }
  return new ApiError(
    'INSUFFICIENT',
    room > 0
      ? `You have ${have} coins and can borrow up to ${room} more, which isn't enough for ${amount}.`
      : `You have ${have} coins, which isn't enough for ${amount}.`,
    { balance: have, canBorrow: 0 },
  );
}

/** Debits with the household's IOU rules and turns coin errors into friendly API errors. */
export function spendFrom(member: Member, amount: number, coinTypes: number[], debtLimit: number, allowIou: boolean) {
  const have = balance(member.purse);
  if (have < amount && !allowIou) throw insufficient(member, amount, debtLimit, false);
  try {
    return debit(member, amount, coinTypes, allowIou ? debtLimit : 0);
  } catch (err) {
    if (err instanceof CoinError && err.code === 'INSUFFICIENT') throw insufficient(member, amount, debtLimit, allowIou);
    throw err;
  }
}

// ---------- simple transfers ----------

export async function gift(deps: Deps, actor: Actor, toMemberId: string, amount: number, message?: string) {
  if (toMemberId === actor.memberId) throw new ApiError('BAD_REQUEST', 'You can\'t send coins to yourself.');
  const household = await getHousehold(deps, actor.householdId);
  const { coinTypes } = household.settings;
  return commitMoney(deps, async () => {
    const from = await getMember(deps, actor.householdId, actor.memberId);
    const to = await getMember(deps, actor.householdId, toMemberId);
    if (balance(from.purse) < amount) throw insufficient(from, amount, 0, false);
    const out = debit(from, amount, coinTypes, 0);
    const inn = credit(to, amount, coinTypes);
    const label = message ? `Gift: ${message}` : `Gift to ${to.name}`;
    const outEntry = newEntry(deps, actor, from, 'GIFT_OUT', { value: -amount, label, coinsIn: out.coinsIn, coinsOut: out.coinsOut, counterpartId: to.id, ref: { type: 'member', id: to.id } });
    const inEntry = newEntry(deps, actor, to, 'GIFT_IN', {
      value: amount,
      label: message ? `Gift: ${message}` : `Gift from ${from.name}`,
      coinsIn: inn.coinsIn,
      debtDelta: inn.debtDelta,
      counterpartId: from.id,
      ref: { type: 'member', id: from.id },
    });
    return { members: [out.member, inn.member], entries: [outEntry, inEntry], result: { from: out.member, to: inn.member, entries: [outEntry, inEntry] } };
  });
}

export async function grantBonus(deps: Deps, actor: Actor, memberId: string, amount: number, reason: string, kind: 'BONUS' | 'CORRECTION' = 'BONUS') {
  const household = await getHousehold(deps, actor.householdId);
  return commitMoney(deps, async () => {
    const m = await getMember(deps, actor.householdId, memberId);
    const c = credit(m, amount, household.settings.coinTypes);
    const e = newEntry(deps, actor, m, kind, { value: amount, label: kind === 'BONUS' ? `Bonus: ${reason}` : `Correction: ${reason}`, coinsIn: c.coinsIn, debtDelta: c.debtDelta, reason });
    return { members: [c.member], entries: [e], result: { member: c.member, entry: e } };
  });
}

/** Admin correction. Negative corrections can push a member into debt (beyond the IOU limit). */
export async function correct(deps: Deps, actor: Actor, memberId: string, delta: number, reason: string) {
  if (delta > 0) return grantBonus(deps, actor, memberId, delta, reason, 'CORRECTION');
  const household = await getHousehold(deps, actor.householdId);
  return commitMoney(deps, async () => {
    const m = await getMember(deps, actor.householdId, memberId);
    const d = debit(m, -delta, household.settings.coinTypes, Number.MAX_SAFE_INTEGER);
    const e = newEntry(deps, actor, m, 'CORRECTION', { value: delta, label: `Correction: ${reason}`, coinsIn: d.coinsIn, coinsOut: d.coinsOut, debtDelta: d.debtDelta, reason });
    return { members: [d.member], entries: [e], result: { member: d.member, entry: e } };
  });
}
