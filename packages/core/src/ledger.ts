import type { Purse } from './coins';

/**
 * The ledger is the immutable history of every coin movement. Each entry belongs to one
 * member. `value` is the signed effect on the member's net worth (purse balance − IOU debt).
 */
export type LedgerKind =
  | 'EARN' // task completion paid out
  | 'BONUS' // streak milestone, challenge reward or admin bonus
  | 'GIFT_IN'
  | 'GIFT_OUT'
  | 'SPEND' // purchase or shop reward
  | 'COSMETIC' // Chubbybara accessory, icon, background
  | 'GOAL_CONTRIBUTE' // coins put into a shared wishlist goal
  | 'GOAL_REFUND' // shared goal cancelled
  | 'REFUND' // rejected purchase
  | 'UNDO' // member undid their own completion/purchase within the undo window
  | 'CORRECTION' // admin correction with a reason (signed)
  | 'CONVERT'; // coin types changed; value 0

export type RefType = 'task' | 'completion' | 'purchase' | 'shopItem' | 'cosmetic' | 'goal' | 'challenge' | 'member';

export interface LedgerRef {
  type: RefType;
  id: string;
}

export interface LedgerEntry {
  id: string;
  householdId: string;
  memberId: string;
  kind: LedgerKind;
  value: number;
  coinsIn: Purse;
  coinsOut: Purse;
  /** Positive when debt increased, negative when debt was paid off. */
  debtDelta: number;
  label: string;
  ref?: LedgerRef;
  /** Other member involved (gift counterpart). */
  counterpartId?: string;
  /** For REFUND / UNDO / GOAL_REFUND: the entry being reversed. */
  reverses?: string;
  reason?: string;
  createdAt: string; // ISO
  createdBy: string; // memberId of the actor
}

export const EARNING_KINDS: ReadonlySet<LedgerKind> = new Set(['EARN', 'BONUS']);
export const SPENDING_KINDS: ReadonlySet<LedgerKind> = new Set(['SPEND', 'COSMETIC', 'GOAL_CONTRIBUTE']);

export function sortChronologically<T extends Pick<LedgerEntry, 'createdAt' | 'id'>>(entries: T[]): T[] {
  return [...entries].sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt < b.createdAt ? -1 : 1));
}

export interface Allocation {
  /** Earning entry that paid for (part of) the spend. Undefined = still owed (IOU). */
  sourceId?: string;
  label: string;
  kind?: LedgerKind;
  amount: number;
  ref?: LedgerRef;
}

/**
 * "Funded by": attributes each spend to earlier earnings, first-in-first-out.
 * Spends made on an IOU are funded by the earnings that later paid the debt off.
 * Entries that were reversed (and their reversals) are ignored.
 */
export function fundedBy(entries: LedgerEntry[]): Map<string, Allocation[]> {
  const reversed = new Set(entries.filter((e) => e.reverses).map((e) => e.reverses!));
  const live = sortChronologically(entries).filter((e) => !e.reverses && !reversed.has(e.id) && e.value !== 0);
  const result = new Map<string, Allocation[]>();
  const available: { entry: LedgerEntry; left: number }[] = [];
  const unfunded: { spendId: string; left: number }[] = [];

  const allocate = (spendId: string, source: LedgerEntry, amount: number) => {
    const list = result.get(spendId) ?? [];
    const existing = list.find((a) => a.sourceId === source.id);
    if (existing) existing.amount += amount;
    else list.push({ sourceId: source.id, label: source.label, kind: source.kind, amount, ref: source.ref });
    result.set(spendId, list);
  };

  for (const e of live) {
    if (e.value > 0) {
      let left = e.value;
      while (left > 0 && unfunded.length > 0) {
        const owed = unfunded[0]!;
        const take = Math.min(owed.left, left);
        allocate(owed.spendId, e, take);
        owed.left -= take;
        left -= take;
        if (owed.left === 0) unfunded.shift();
      }
      if (left > 0) available.push({ entry: e, left });
    } else {
      let need = -e.value;
      result.set(e.id, result.get(e.id) ?? []);
      while (need > 0 && available.length > 0) {
        const src = available[0]!;
        const take = Math.min(src.left, need);
        allocate(e.id, src.entry, take);
        src.left -= take;
        need -= take;
        if (src.left === 0) available.shift();
      }
      if (need > 0) unfunded.push({ spendId: e.id, left: need });
    }
  }
  for (const owed of unfunded) {
    result.get(owed.spendId)!.push({ label: 'IOU', amount: owed.left });
  }
  return result;
}

/** Groups allocations by task/label for a friendly "paid for by: Dishes ×3" summary. */
export function summarizeFunding(allocations: Allocation[]) {
  const groups = new Map<string, { label: string; amount: number; count: number; iou: boolean }>();
  for (const a of allocations) {
    const key = a.sourceId ? `${a.kind}:${a.label}` : 'IOU';
    const g = groups.get(key) ?? { label: a.label, amount: 0, count: 0, iou: !a.sourceId };
    g.amount += a.amount;
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((x, y) => y.amount - x.amount);
}
