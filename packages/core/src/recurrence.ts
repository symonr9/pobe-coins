/**
 * Recurring chores. Everything is expressed in the household's time zone using
 * local calendar dates ("YYYY-MM-DD"), so "daily" means the household's day even
 * across DST changes. Each occurrence date is a *period*: completing the chore any
 * time before the next occurrence counts for that period.
 */

export type LocalDate = string; // YYYY-MM-DD

export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly';
  /** Every N days/weeks/months. Default 1. */
  interval?: number;
  /** For weekly: days of week, 0 = Sunday … 6 = Saturday. Default: the anchor's weekday. */
  byWeekday?: number[];
  /** For monthly: day of month 1–31 (clamped to the month's last day). Default: the anchor's day. */
  byMonthDay?: number;
  /** First occurrence (local date). */
  anchor: LocalDate;
  /** Optional local due time "HH:mm" on each occurrence; default end of day. */
  dueTime?: string;
}

const DAY_MS = 86_400_000;

// ---------- local date helpers (pure calendar math on UTC midnight) ----------

export function parseLocalDate(d: LocalDate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!));
}

export function formatLocalDate(d: Date): LocalDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return formatLocalDate(new Date(parseLocalDate(d).getTime() + n * DAY_MS));
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / DAY_MS);
}

export function weekday(d: LocalDate): number {
  return parseLocalDate(d).getUTCDay();
}

function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

// ---------- time zone conversion ----------

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(timeZone: string) {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(dtf(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** The household-local calendar date of an instant. */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** UTC offset (minutes) of a time zone at an instant. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** Converts a household-local wall time to a UTC instant (DST-safe). */
export function zonedTimeToUtc(date: LocalDate, time: string, timeZone: string): Date {
  const [h, m] = time.split(':').map(Number);
  const base = parseLocalDate(date).getTime() + (h! * 60 + m!) * 60_000;
  // Two passes handle the offset change around DST transitions.
  let guess = base - offsetMinutes(new Date(base), timeZone) * 60_000;
  guess = base - offsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess);
}

// ---------- occurrences ----------

function interval(rule: Recurrence) {
  return Math.max(1, Math.floor(rule.interval ?? 1));
}

/** Whether a local date is an occurrence of the rule. */
export function isOccurrence(rule: Recurrence, date: LocalDate): boolean {
  if (date < rule.anchor) return false;
  const n = interval(rule);
  switch (rule.freq) {
    case 'daily':
      return daysBetween(rule.anchor, date) % n === 0;
    case 'weekly': {
      const days = rule.byWeekday?.length ? rule.byWeekday : [weekday(rule.anchor)];
      if (!days.includes(weekday(date))) return false;
      // Week index counted from the Sunday on/before the anchor.
      const anchorWeekStart = addDays(rule.anchor, -weekday(rule.anchor));
      const weekIndex = Math.floor(daysBetween(anchorWeekStart, date) / 7);
      return weekIndex % n === 0;
    }
    case 'monthly': {
      const a = parseLocalDate(rule.anchor);
      const d = parseLocalDate(date);
      const months = (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + d.getUTCMonth() - a.getUTCMonth();
      if (months % n !== 0) return false;
      const wanted = rule.byMonthDay ?? a.getUTCDate();
      const dim = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
      return d.getUTCDate() === Math.min(wanted, dim);
    }
  }
}

const SEARCH_LIMIT_DAYS = 400 * 3;

/** First occurrence on or after `date`. */
export function nextOccurrence(rule: Recurrence, date: LocalDate): LocalDate {
  let d = date < rule.anchor ? rule.anchor : date;
  for (let i = 0; i < SEARCH_LIMIT_DAYS; i++, d = addDays(d, 1)) {
    if (isOccurrence(rule, d)) return d;
  }
  throw new Error('Recurrence has no upcoming occurrence.');
}

/** Last occurrence on or before `date`, or null if the rule hasn't started. */
export function previousOccurrence(rule: Recurrence, date: LocalDate): LocalDate | null {
  if (date < rule.anchor) return null;
  let d = date;
  for (let i = 0; i < SEARCH_LIMIT_DAYS && d >= rule.anchor; i++, d = addDays(d, -1)) {
    if (isOccurrence(rule, d)) return d;
  }
  return null;
}

/** The occurrence right after a given occurrence. */
export function followingOccurrence(rule: Recurrence, occurrence: LocalDate): LocalDate {
  return nextOccurrence(rule, addDays(occurrence, 1));
}

/** The period an instant belongs to: the most recent occurrence on or before it. */
export function periodKey(rule: Recurrence, instant: Date, timeZone: string): LocalDate | null {
  return previousOccurrence(rule, toLocalDate(instant, timeZone));
}

/** When the current period's chore is due (UTC). */
export function dueAt(rule: Recurrence, occurrence: LocalDate, timeZone: string): Date {
  if (rule.dueTime) return zonedTimeToUtc(occurrence, rule.dueTime, timeZone);
  // End of the period: just before the next occurrence starts.
  const next = followingOccurrence(rule, occurrence);
  return new Date(zonedTimeToUtc(next, '00:00', timeZone).getTime() - 1000);
}

/** Human summary, e.g. "Every Mon, Wed" or "Every 2 weeks". */
export function describeRecurrence(rule: Recurrence): string {
  const n = interval(rule);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  switch (rule.freq) {
    case 'daily':
      return n === 1 ? 'Every day' : `Every ${n} days`;
    case 'weekly': {
      const days = (rule.byWeekday?.length ? rule.byWeekday : [weekday(rule.anchor)])
        .slice()
        .sort()
        .map((d) => names[d])
        .join(', ');
      return n === 1 ? `Every ${days}` : `Every ${n} weeks on ${days}`;
    }
    case 'monthly': {
      const day = rule.byMonthDay ?? parseLocalDate(rule.anchor).getUTCDate();
      return n === 1 ? `Monthly on day ${day}` : `Every ${n} months on day ${day}`;
    }
  }
}

/** Rotation: which member is up for a given occurrence. */
export function rotationAssignee(
  rule: Recurrence,
  rotation: readonly string[],
  occurrence: LocalDate,
  /** Manual shifts (skips/swaps) applied so far. */
  offset = 0,
): string | undefined {
  if (rotation.length === 0) return undefined;
  let index = 0;
  for (let d = nextOccurrence(rule, rule.anchor); d < occurrence; d = followingOccurrence(rule, d)) {
    index++;
    if (index > 5000) break;
  }
  return rotation[(((index + offset) % rotation.length) + rotation.length) % rotation.length];
}
