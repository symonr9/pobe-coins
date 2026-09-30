import { EARNING_KINDS, SPENDING_KINDS, type LedgerEntry } from './ledger';
import { addDays, toLocalDate, weekday, type LocalDate } from './recurrence';

/** Monday of the week containing a local date. */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, -((weekday(date) + 6) % 7));
}

const isEarning = (e: LedgerEntry) => EARNING_KINDS.has(e.kind);
const isSpending = (e: LedgerEntry) => SPENDING_KINDS.has(e.kind);

function liveEntries(entries: LedgerEntry[]) {
  const reversed = new Set(entries.filter((e) => e.reverses).map((e) => e.reverses!));
  return entries.filter((e) => !e.reverses && !reversed.has(e.id));
}

export interface WeekPoint {
  week: LocalDate;
  earned: number;
  spent: number;
}

/** Earned vs spent per week for the last `weeks` weeks (oldest first). */
export function weeklySeries(
  entries: LedgerEntry[],
  timeZone: string,
  now: Date,
  weeks = 12,
  memberId?: string,
): WeekPoint[] {
  const thisWeek = weekStart(toLocalDate(now, timeZone));
  const points = new Map<LocalDate, WeekPoint>();
  for (let i = weeks - 1; i >= 0; i--) {
    const w = addDays(thisWeek, -7 * i);
    points.set(w, { week: w, earned: 0, spent: 0 });
  }
  for (const e of liveEntries(entries)) {
    if (memberId && e.memberId !== memberId) continue;
    const p = points.get(weekStart(toLocalDate(new Date(e.createdAt), timeZone)));
    if (!p) continue;
    if (isEarning(e)) p.earned += e.value;
    else if (isSpending(e)) p.spent += -e.value;
  }
  return [...points.values()];
}

export interface ChoreStat {
  label: string;
  count: number;
  coins: number;
}

/** Most-completed chores in a range. */
export function topChores(entries: LedgerEntry[], limit = 5): ChoreStat[] {
  const map = new Map<string, ChoreStat>();
  for (const e of liveEntries(entries)) {
    if (e.kind !== 'EARN') continue;
    const s = map.get(e.label) ?? { label: e.label, count: 0, coins: 0 };
    s.count += 1;
    s.coins += e.value;
    map.set(e.label, s);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.coins - a.coins).slice(0, limit);
}

export interface LeaderRow {
  memberId: string;
  earned: number;
  completions: number;
}

/** Friendly leaderboard: earnings (tasks + bonuses) in [from, to). */
export function leaderboard(entries: LedgerEntry[], from: Date, to: Date, memberIds: string[]): LeaderRow[] {
  const rows = new Map<string, LeaderRow>(memberIds.map((id) => [id, { memberId: id, earned: 0, completions: 0 }]));
  for (const e of liveEntries(entries)) {
    const t = new Date(e.createdAt);
    if (t < from || t >= to || !isEarning(e)) continue;
    const r = rows.get(e.memberId);
    if (!r) continue;
    r.earned += e.value;
    if (e.kind === 'EARN') r.completions += 1;
  }
  return [...rows.values()].sort((a, b) => b.earned - a.earned || b.completions - a.completions);
}

export interface Wrapped {
  from: string;
  to: string;
  memberId: string;
  earned: number;
  spent: number;
  completions: number;
  bonuses: number;
  giftsGiven: number;
  giftsReceived: number;
  topChores: ChoreStat[];
  biggestPurchase?: { label: string; amount: number; entryId: string };
  busiestWeekday?: { weekday: number; completions: number };
  bestStreak: number;
}

/** Pobe Wrapped recap for a member over [from, to). `bestStreak` comes from streak records. */
export function wrapped(
  entries: LedgerEntry[],
  memberId: string,
  from: Date,
  to: Date,
  timeZone: string,
  bestStreak = 0,
): Wrapped {
  const mine = liveEntries(entries).filter((e) => {
    const t = new Date(e.createdAt);
    return e.memberId === memberId && t >= from && t < to;
  });
  const byWeekday = new Array<number>(7).fill(0);
  let biggest: Wrapped['biggestPurchase'];
  const w: Wrapped = {
    from: from.toISOString(),
    to: to.toISOString(),
    memberId,
    earned: 0,
    spent: 0,
    completions: 0,
    bonuses: 0,
    giftsGiven: 0,
    giftsReceived: 0,
    topChores: topChores(mine, 3),
    bestStreak,
  };
  for (const e of mine) {
    if (isEarning(e)) w.earned += e.value;
    if (isSpending(e)) w.spent += -e.value;
    if (e.kind === 'EARN') {
      w.completions += 1;
      byWeekday[weekday(toLocalDate(new Date(e.createdAt), timeZone))]! += 1;
    }
    if (e.kind === 'BONUS') w.bonuses += e.value;
    if (e.kind === 'GIFT_OUT') w.giftsGiven += -e.value;
    if (e.kind === 'GIFT_IN') w.giftsReceived += e.value;
    if (e.kind === 'SPEND' && (!biggest || -e.value > biggest.amount)) {
      biggest = { label: e.label, amount: -e.value, entryId: e.id };
    }
  }
  w.biggestPurchase = biggest;
  const max = Math.max(...byWeekday);
  if (max > 0) w.busiestWeekday = { weekday: byWeekday.indexOf(max), completions: max };
  return w;
}

/** Month range [start, end) in the household's time zone, as UTC instants. */
export function monthRange(year: number, month1: number, toUtc: (d: LocalDate) => Date) {
  const start = `${year}-${String(month1).padStart(2, '0')}-01`;
  const ny = month1 === 12 ? year + 1 : year;
  const nm = month1 === 12 ? 1 : month1 + 1;
  const end = `${ny}-${String(nm).padStart(2, '0')}-01`;
  return { from: toUtc(start), to: toUtc(end) };
}
