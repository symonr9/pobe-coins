/**
 * Private per-member calendar feed (ICS) of chores, subscribable from Google/Apple Calendar.
 */
import { weekday, type Recurrence } from '@pobe/core';
import type { Actor, Deps } from '../context';
import { keys } from '../db/keys';
import type { Item } from '../db/types';
import { ApiError } from '../lib/errors';
import { secretToken, sha256 } from '../lib/ids';
import { getHousehold, listMembers, listTasks } from '../repo';

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export async function createCalendarFeed(deps: Deps, actor: Actor, apiBase: string) {
  const existing = await deps.db.get<Item & { hash: string }>(keys.calendarRef(actor.householdId, actor.memberId));
  if (existing) await deps.db.delete(keys.calendar(existing.hash)).catch(() => undefined);
  const token = secretToken(24);
  const hash = sha256(token);
  await deps.db.transact([
    { put: { ...keys.calendar(hash), householdId: actor.householdId, memberId: actor.memberId } },
    { put: { ...keys.calendarRef(actor.householdId, actor.memberId), hash, memberId: actor.memberId } },
  ]);
  return { url: `${apiBase.replace(/\/$/, '')}/cal/${token}.ics` };
}

export async function revokeCalendarFeed(deps: Deps, actor: Actor) {
  const existing = await deps.db.get<Item & { hash: string }>(keys.calendarRef(actor.householdId, actor.memberId));
  if (!existing) return;
  await deps.db.transact([{ delete: keys.calendar(existing.hash) }, { delete: keys.calendarRef(actor.householdId, actor.memberId) }]);
}

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function rrule(r: Recurrence): string {
  const parts = [`FREQ=${r.freq.toUpperCase()}`];
  if (r.interval && r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.freq === 'weekly') parts.push(`BYDAY=${(r.byWeekday?.length ? r.byWeekday : [weekday(r.anchor)]).map((d) => DAYS[d]).join(',')}`);
  if (r.freq === 'monthly' && r.byMonthDay) parts.push(`BYMONTHDAY=${r.byMonthDay}`);
  return parts.join(';');
}

/** Folds lines at 75 octets as RFC 5545 requires. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

export async function renderCalendar(deps: Deps, token: string): Promise<string> {
  const ref = await deps.db.get<Item & { householdId: string; memberId: string }>(keys.calendar(sha256(token.replace(/\.ics$/, ''))));
  if (!ref) throw new ApiError('NOT_FOUND', 'This calendar link was turned off.');
  const [household, tasks, members] = await Promise.all([
    getHousehold(deps, ref.householdId),
    listTasks(deps, ref.householdId),
    listMembers(deps, ref.householdId),
  ]);
  const me = members.find((m) => m.id === ref.memberId);
  if (!me) throw new ApiError('NOT_FOUND', 'This calendar link was turned off.');
  const stamp = deps
    .now()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const mine = tasks.filter(
    (t) =>
      t.status !== 'archived' && t.status !== 'done' && (t.assigneeId === null || t.assigneeId === me.id || t.rotation?.includes(me.id)),
  );
  const tz = household.settings.timeZone;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pobe Coins//Chores//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(`${household.name} chores`)}`,
    `X-WR-TIMEZONE:${tz}`,
  ];
  for (const t of mine) {
    const summary = `${t.emoji ? `${t.emoji} ` : ''}${t.title} (+${t.reward})`;
    const desc = [t.notes, t.rotation?.length ? 'Rotating chore: check the app for whose turn it is.' : undefined]
      .filter(Boolean)
      .join('\n');
    lines.push('BEGIN:VEVENT', `UID:${t.id}@pobe-coins`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(summary)}`);
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    if (t.recurrence) {
      const d = t.recurrence.anchor.replace(/-/g, '');
      if (t.recurrence.dueTime) lines.push(`DTSTART;TZID=${tz}:${d}T${t.recurrence.dueTime.replace(':', '')}00`, 'DURATION:PT30M');
      else lines.push(`DTSTART;VALUE=DATE:${d}`);
      lines.push(`RRULE:${rrule(t.recurrence)}`);
    } else if (t.dueAt) {
      const d = t.dueAt.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      lines.push(`DTSTART:${d}`, 'DURATION:PT30M');
    } else {
      // One-off tasks without a due date show as all-day events today.
      lines.push(`DTSTART;VALUE=DATE:${stamp.slice(0, 8)}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
