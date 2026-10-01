/**
 * Hourly housekeeping per household: due-soon reminders, streak-at-risk nudges (7pm local),
 * challenge expiry, and "your Wrapped is ready" on the 1st of the month (9am local).
 */
import {
  currentStreak,
  dueAt,
  followingOccurrence,
  periodKey,
  pickLine,
  streakAtRisk,
  toLocalDate,
  type Challenge,
  type Household,
  type StreakRecord,
} from '@pobe/core';
import type { Deps } from '../context';
import { HOUSEHOLDS_INDEX, keys, PREFIX } from '../db/keys';
import { ConditionFailed, strip, type Item } from '../db/types';
import { listByPrefix, listMembers, listTasks, toItem } from '../repo';

function localHour(now: Date, tz: string) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
}

/** Records that a notification was sent, so retries and overlapping runs don't repeat it. */
async function once(deps: Deps, hid: string, key: string, days = 3): Promise<boolean> {
  try {
    await deps.db.put(
      { pk: `H#${hid}`, sk: `SENT#${key}`, ttl: Math.floor(deps.now().getTime() / 1000) + days * 86400 },
      { notExists: true },
    );
    return true;
  } catch (err) {
    if (err instanceof ConditionFailed) return false;
    throw err;
  }
}

export async function runHourly(deps: Deps) {
  let households = 0;
  for await (const item of deps.db.scanIndex<Item & Household>(HOUSEHOLDS_INDEX)) {
    households++;
    try {
      await runForHousehold(deps, strip(item) as Household);
    } catch (err) {
      console.error('hourly job failed for household', item.id, err);
    }
  }
  return { households };
}

export async function runForHousehold(deps: Deps, household: Household) {
  const now = deps.now();
  const tz = household.settings.timeZone;
  const hour = localHour(now, tz);
  const today = toLocalDate(now, tz);
  const [tasks, members] = await Promise.all([listTasks(deps, household.id), listMembers(deps, household.id)]);
  const memberIds = members.map((m) => m.id);
  const live = tasks.filter((t) => t.status !== 'archived' && t.status !== 'done' && t.status !== 'pending');

  // Due-soon reminders (within the next hour).
  for (const t of live) {
    let due: Date | undefined;
    let period = 'once';
    if (t.recurrence) {
      const p = periodKey(t.recurrence, now, tz);
      if (!p) continue;
      if (await deps.db.get(keys.period(household.id, t.id, p))) continue;
      due = dueAt(t.recurrence, p, tz);
      period = p;
    } else if (t.dueAt) due = new Date(t.dueAt);
    if (!due) continue;
    const ms = due.getTime() - now.getTime();
    if (ms <= 0 || ms > 3600_000) continue;
    if (!(await once(deps, household.id, `due#${t.id}#${period}`))) continue;
    const who = t.rotation?.length || t.assigneeId ? [t.assigneeId ?? t.rotation![0]!] : t.claimedBy ? [t.claimedBy] : memberIds;
    await deps.notifier.send(household.id, who.filter(Boolean), {
      title: 'Due soon',
      body: `${t.emoji ? `${t.emoji} ` : ''}${t.title} is due within the hour (+${t.reward}).`,
      url: '/tasks',
    });
  }

  // Streak-at-risk nudges at 7pm local.
  if (hour === 19) {
    const streaks = await listByPrefix<StreakRecord>(deps, household.id, PREFIX.streak);
    for (const s of streaks) {
      const task = tasks.find((t) => t.id === s.taskId);
      if (!task?.recurrence || task.status === 'archived') continue;
      const live = currentStreak(task.recurrence, s, now, tz);
      if (live.current < 3 || !streakAtRisk(task.recurrence, s, now, tz)) continue;
      const nextPeriod = followingOccurrence(task.recurrence, s.lastPeriodKey!);
      if (await deps.db.get(keys.period(household.id, task.id, nextPeriod))) continue;
      if (!(await once(deps, household.id, `risk#${task.id}#${s.memberId}#${today}`))) continue;
      const member = members.find((m) => m.id === s.memberId);
      const line = pickLine('streakAtRisk', { vars: { name: member?.name, streak: live.current, task: task.title } });
      await deps.notifier.send(household.id, [s.memberId], { title: `${live.current}-streak at risk`, body: line.text, url: '/tasks' });
    }
  }

  // Challenges that ran out of time.
  const challenges = await listByPrefix<Challenge>(deps, household.id, PREFIX.challenge);
  for (const c of challenges) {
    if (c.status === 'active' && Date.parse(c.endsAt) <= now.getTime()) {
      await deps.db.put(toItem.challenge({ ...c, status: 'expired' }), { equals: { status: 'active' } }).catch(() => undefined);
    }
  }

  // Monthly Wrapped.
  if (today.endsWith('-01') && hour === 9 && (await once(deps, household.id, `wrapped#${today}`, 40))) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    const month = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    await deps.notifier.send(household.id, memberIds, {
      title: `Your ${month} Pobe Wrapped is ready`,
      body: 'Chubbybara made you a little recap of the month.',
      url: `/wrapped/${d.toISOString().slice(0, 7)}`,
    });
  }
}
