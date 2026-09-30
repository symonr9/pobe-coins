import {
  balance,
  greetingContext,
  leaderboard,
  pickLine,
  toLocalDate,
  topChores,
  weekStart,
  weeklySeries,
  wrapped,
  zonedTimeToUtc,
  addDays,
  type Completion,
  type LedgerEntry,
  type Member,
  type Purchase,
  type StreakRecord,
} from '@pobe/core';
import type { Actor, Deps } from '../context';
import { keys, memberLedgerIndex, partition, PREFIX } from '../db/keys';
import { strip, type Item } from '../db/types';
import { ApiError, forbidden } from '../lib/errors';
import { getHousehold, listByPrefix, listMembers, ulidFloor } from '../repo';
import { listTaskViews } from './tasks';

async function ledgerSince(deps: Deps, hid: string, from: Date, memberId?: string): Promise<LedgerEntry[]> {
  const rows = memberId
    ? await deps.db.query<Item & LedgerEntry>(memberLedgerIndex(hid, memberId), {
        index: 'gsi1',
        after: `L#${ulidFloor(from)}`,
        before: 'L#￿',
      })
    : await deps.db.query<Item & LedgerEntry>(partition(hid), { after: `L#${ulidFloor(from)}`, before: 'L#￿' });
  return rows.map((r) => strip(r) as LedgerEntry);
}

function redact(entry: LedgerEntry, actor: Actor, visibility: 'full' | 'balances'): LedgerEntry {
  if (visibility === 'full' || actor.role === 'admin' || entry.memberId === actor.memberId) return entry;
  if (entry.kind === 'EARN' || entry.kind === 'BONUS' || entry.kind === 'GIFT_IN' || entry.kind === 'GIFT_OUT') return entry;
  return { ...entry, label: 'Private', ref: undefined, reason: undefined, coinsIn: {}, coinsOut: {} };
}

export async function timeline(deps: Deps, actor: Actor, opts: { memberId?: string; cursor?: string; limit?: number }) {
  const household = await getHousehold(deps, actor.householdId);
  const limit = Math.min(opts.limit ?? 30, 100);
  const before = opts.cursor ? `L#${opts.cursor}` : 'L#￿';
  const rows = opts.memberId
    ? await deps.db.query<Item & LedgerEntry>(memberLedgerIndex(actor.householdId, opts.memberId), {
        index: 'gsi1',
        after: 'L#',
        before,
        newestFirst: true,
        limit,
      })
    : await deps.db.query<Item & LedgerEntry>(partition(actor.householdId), { after: 'L#', before, newestFirst: true, limit });
  const entries = rows.map((r) => redact(strip(r) as LedgerEntry, actor, household.settings.visibility));

  // Purchase photos and details for spend entries.
  const purchaseIds = [...new Set(entries.filter((e) => e.ref?.type === 'purchase').map((e) => e.ref!.id))];
  const purchases = (await deps.db.getMany<Item & Purchase>(purchaseIds.map((id) => keys.purchase(actor.householdId, id)))).map(
    (p) => strip(p) as Purchase,
  );
  const purchaseById = new Map(purchases.map((p) => [p.id, p]));
  const thumbs = new Map<string, string>();
  for (const p of purchases) if (p.photoKeys[0]) thumbs.set(p.id, await deps.storage.presignGet(p.photoKeys[0]));

  // Reactions for the page (item ids are ledger ULIDs, so a range query covers them).
  const ids = entries.map((e) => e.id).sort();
  const reactions = ids.length
    ? await deps.db.query<Item & { itemId: string; memberId: string; emoji: string }>(partition(actor.householdId), {
        after: `${PREFIX.reaction}${ids[0]!}`.slice(0, -1),
        before: `${PREFIX.reaction}${ids[ids.length - 1]!}#￿`,
      })
    : [];
  const commentCounts = new Map<string, number>();
  if (ids.length) {
    const comments = await deps.db.query<Item & { itemId: string }>(partition(actor.householdId), {
      after: `${PREFIX.comment}${ids[0]!}`.slice(0, -1),
      before: `${PREFIX.comment}${ids[ids.length - 1]!}#￿`,
    });
    for (const c of comments) commentCounts.set(c.itemId, (commentCounts.get(c.itemId) ?? 0) + 1);
  }

  const pending = opts.cursor
    ? []
    : [
        ...(await listByPrefix<Completion>(deps, actor.householdId, PREFIX.completion, true, 100))
          .filter((c) => c.status === 'pending')
          .map((c) => ({ type: 'completion' as const, at: c.createdAt, completion: c })),
        ...(await listByPrefix<Purchase>(deps, actor.householdId, PREFIX.purchase, true, 100))
          .filter((p) => p.status === 'pending')
          .filter((p) => household.settings.visibility === 'full' || actor.role === 'admin' || p.memberId === actor.memberId)
          .map((p) => ({ type: 'purchase' as const, at: p.createdAt, purchase: p })),
      ].filter((x) => !opts.memberId || ('completion' in x ? x.completion.memberId : x.purchase.memberId) === opts.memberId);

  return {
    pending,
    items: entries.map((e) => {
      const p = e.ref?.type === 'purchase' ? purchaseById.get(e.ref.id) : undefined;
      const visible = !p || household.settings.visibility === 'full' || actor.role === 'admin' || p.memberId === actor.memberId;
      return {
        entry: e,
        purchase:
          p && visible
            ? { id: p.id, title: p.title, url: p.url, preview: p.preview, status: p.status, redemption: p.redemption, kind: p.kind }
            : undefined,
        thumbUrl: p && visible ? thumbs.get(p.id) : undefined,
        reactions: reactions.filter((r) => r.itemId === e.id).map((r) => ({ memberId: r.memberId, emoji: r.emoji })),
        comments: commentCounts.get(e.id) ?? 0,
      };
    }),
    nextCursor: entries.length === limit ? entries[entries.length - 1]!.id : null,
  };
}

export async function stats(deps: Deps, actor: Actor, opts: { memberId?: string; weeks?: number }) {
  const household = await getHousehold(deps, actor.householdId);
  if (opts.memberId && opts.memberId !== actor.memberId && household.settings.visibility === 'balances' && actor.role !== 'admin') {
    throw forbidden("Other members' details are private in this household.");
  }
  const tz = household.settings.timeZone;
  const now = deps.now();
  const weeks = Math.min(Math.max(opts.weeks ?? 12, 1), 52);
  const firstWeek = addDays(weekStart(toLocalDate(now, tz)), -7 * (weeks - 1));
  const from = zonedTimeToUtc(firstWeek, '00:00', tz);
  const entries = await ledgerSince(deps, actor.householdId, from, opts.memberId);
  const members = await listMembers(deps, actor.householdId);
  const thisWeek = zonedTimeToUtc(weekStart(toLocalDate(now, tz)), '00:00', tz);
  const lastWeek = new Date(thisWeek.getTime() - 7 * 86400_000);
  return {
    series: weeklySeries(entries, tz, now, weeks, opts.memberId),
    topChores: topChores(entries, 5),
    balances:
      household.settings.visibility === 'full' || actor.role === 'admin'
        ? members.map((m) => ({ memberId: m.id, balance: balance(m.purse), debt: m.debt }))
        : members.filter((m) => m.id === actor.memberId).map((m) => ({ memberId: m.id, balance: balance(m.purse), debt: m.debt })),
    leaderboard: household.settings.leaderboardEnabled
      ? {
          thisWeek: leaderboard(
            entries,
            thisWeek,
            new Date(now.getTime() + 1),
            members.map((m) => m.id),
          ),
          lastWeek: leaderboard(
            entries,
            lastWeek,
            thisWeek,
            members.map((m) => m.id),
          ),
        }
      : null,
  };
}

/** Pobe Wrapped for a month ("2026-09") or a year ("2026"). */
export async function wrappedRecap(deps: Deps, actor: Actor, period: string, memberId?: string) {
  const household = await getHousehold(deps, actor.householdId);
  const target = memberId ?? actor.memberId;
  if (target !== actor.memberId && household.settings.visibility === 'balances' && actor.role !== 'admin')
    throw forbidden('That recap is private.');
  const tz = household.settings.timeZone;
  let fromDate: string;
  let toDate: string;
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-').map(Number);
    fromDate = `${period}-01`;
    toDate = m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`;
  } else if (/^\d{4}$/.test(period)) {
    fromDate = `${period}-01-01`;
    toDate = `${Number(period) + 1}-01-01`;
  } else throw new ApiError('BAD_REQUEST', 'Use a month like 2026-09 or a year like 2026.');
  const from = zonedTimeToUtc(fromDate, '00:00', tz);
  const to = zonedTimeToUtc(toDate, '00:00', tz);
  const entries = (await ledgerSince(deps, actor.householdId, from, target)).filter((e) => Date.parse(e.createdAt) < to.getTime());
  const streaks = (await listByPrefix<StreakRecord>(deps, actor.householdId, PREFIX.streak)).filter((s) => s.memberId === target);
  const best = streaks.reduce((b, s) => Math.max(b, s.best), 0);
  return { period, ...wrapped(entries, target, from, to, tz, best) };
}

/** Compact snapshot for home-screen widgets. */
export async function widget(deps: Deps, actor: Actor) {
  const [household, tasks, members] = await Promise.all([
    getHousehold(deps, actor.householdId),
    listTaskViews(deps, actor),
    listMembers(deps, actor.householdId),
  ]);
  const me = members.find((m) => m.id === actor.memberId) as Member;
  const mine = tasks.filter(
    (t) =>
      !t.doneThisPeriod &&
      (t.effectiveAssigneeId === actor.memberId || (t.effectiveAssigneeId === null && (!t.claimedBy || t.claimedBy === actor.memberId))),
  );
  const now = deps.now();
  const today = toLocalDate(now, household.settings.timeZone);
  const dueToday = mine.filter((t) => !t.nextDueAt || toLocalDate(new Date(t.nextDueAt), household.settings.timeZone) <= today);
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: household.settings.timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
  const line = pickLine(greetingContext(hour), { seed: `${today}:${me.id}`, vars: { name: me.name, coins: balance(me.purse) } });
  return {
    name: me.name,
    balance: balance(me.purse),
    purse: me.purse,
    debt: me.debt,
    theme: me.theme,
    accessory: me.equipped.accessory,
    today: dueToday.length,
    next: dueToday.slice(0, 3).map((t) => ({ id: t.id, title: t.title, emoji: t.emoji, reward: t.reward })),
    line: line.text,
    pose: line.pose,
    updatedAt: now.toISOString(),
  };
}
