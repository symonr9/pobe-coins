/**
 * Typed load/save helpers for household entities.
 */
import type {
  AuditEntry,
  Challenge,
  Completion,
  Household,
  LedgerEntry,
  Member,
  Purchase,
  ShopItem,
  StreakRecord,
  Task,
  WishlistGoal,
} from '@pobe/core';
import type { Actor, Deps } from './context';
import { HOUSEHOLDS_INDEX, keys, memberLedgerIndex, partition, PREFIX } from './db/keys';
import { strip, type Item, type Key, type WriteOp } from './db/types';
import { notFound } from './lib/errors';
import { encodeTime, ulid } from './lib/ids';

type Stored<T> = T & Item;

function load<T>(item: Item | undefined): T | undefined {
  return item ? (strip(item) as T) : undefined;
}

export const toItem = {
  household: (h: Household): Item => ({ ...keys.household(h.id), gsi1pk: HOUSEHOLDS_INDEX, gsi1sk: h.id, type: 'household', ...h }),
  member: (m: Member): Item => ({ ...keys.member(m.householdId, m.id), type: 'member', ...m }),
  task: (t: Task): Item => ({ ...keys.task(t.householdId, t.id), type: 'task', ...t }),
  completion: (c: Completion): Item => ({ ...keys.completion(c.householdId, c.id), type: 'completion', ...c }),
  purchase: (p: Purchase): Item => ({ ...keys.purchase(p.householdId, p.id), type: 'purchase', ...p }),
  ledger: (e: LedgerEntry): Item => ({
    ...keys.ledger(e.householdId, e.id),
    gsi1pk: memberLedgerIndex(e.householdId, e.memberId),
    gsi1sk: `L#${e.id}`,
    type: 'ledger',
    ...e,
  }),
  goal: (g: WishlistGoal): Item => ({ ...keys.goal(g.householdId, g.id), type: 'goal', ...g }),
  shopItem: (s: ShopItem & { sold?: number }): Item => ({ ...keys.shopItem(s.householdId, s.id), type: 'shopItem', ...s }),
  challenge: (c: Challenge): Item => ({ ...keys.challenge(c.householdId, c.id), type: 'challenge', ...c }),
  streak: (hid: string, s: StreakRecord): Item => ({ ...keys.streak(hid, s.taskId, s.memberId), type: 'streak', ...s }),
  audit: (a: AuditEntry): Item => ({ ...keys.audit(a.householdId, a.id), type: 'audit', ...a }),
};

export async function getHousehold(deps: Deps, hid: string): Promise<Household> {
  const h = load<Household>(await deps.db.get(keys.household(hid)));
  if (!h) throw notFound('That household');
  return h;
}

export async function getMember(deps: Deps, hid: string, mid: string): Promise<Member> {
  const m = load<Member>(await deps.db.get(keys.member(hid, mid)));
  if (!m || m.deletedAt) throw notFound('That member');
  return m;
}

export async function listMembers(deps: Deps, hid: string, includeDeleted = false): Promise<Member[]> {
  const rows = await deps.db.query<Stored<Member>>(partition(hid), { beginsWith: PREFIX.member });
  return rows.map((r) => strip(r) as Member).filter((m) => includeDeleted || !m.deletedAt);
}

export async function getTask(deps: Deps, hid: string, tid: string): Promise<Task> {
  const t = load<Task>(await deps.db.get(keys.task(hid, tid)));
  if (!t) throw notFound('That task');
  return t;
}

export async function listTasks(deps: Deps, hid: string): Promise<Task[]> {
  const rows = await deps.db.query(partition(hid), { beginsWith: PREFIX.task });
  return rows.map((r) => strip(r) as unknown as Task);
}

export async function getCompletion(deps: Deps, hid: string, cid: string): Promise<Completion> {
  const c = load<Completion>(await deps.db.get(keys.completion(hid, cid)));
  if (!c) throw notFound('That completion');
  return c;
}

export async function getPurchase(deps: Deps, hid: string, pid: string): Promise<Purchase> {
  const p = load<Purchase>(await deps.db.get(keys.purchase(hid, pid)));
  if (!p) throw notFound('That purchase');
  return p;
}

export async function getGoal(deps: Deps, hid: string, gid: string): Promise<WishlistGoal> {
  const g = load<WishlistGoal>(await deps.db.get(keys.goal(hid, gid)));
  if (!g) throw notFound('That goal');
  return g;
}

export async function getShopItem(deps: Deps, hid: string, id: string): Promise<ShopItem & { sold?: number }> {
  const s = load<ShopItem & { sold?: number }>(await deps.db.get(keys.shopItem(hid, id)));
  if (!s) throw notFound('That reward');
  return s;
}

export async function listByPrefix<T>(deps: Deps, hid: string, prefix: string, newestFirst = false, limit?: number): Promise<T[]> {
  const rows = await deps.db.query(partition(hid), { beginsWith: prefix, newestFirst, limit });
  return rows.map((r) => strip(r) as unknown as T);
}

export async function getLedgerEntries(deps: Deps, hid: string, ids: string[]): Promise<LedgerEntry[]> {
  const rows = await deps.db.getMany(ids.map((id) => keys.ledger(hid, id)));
  return rows.map((r) => strip(r) as unknown as LedgerEntry);
}

/** Lower-bound ULID for a timestamp, for range queries on ULID sort keys. */
export function ulidFloor(date: Date): string {
  return encodeTime(date.getTime()) + '0'.repeat(16);
}

export function auditOp(deps: Deps, actor: Actor, action: string, target?: string, details?: Record<string, unknown>): WriteOp {
  const entry: AuditEntry = {
    id: ulid(deps.now().getTime()),
    householdId: actor.householdId,
    actorId: actor.memberId,
    action,
    target,
    details,
    createdAt: deps.now().toISOString(),
  };
  return { put: toItem.audit(entry) };
}

export type { Key };
