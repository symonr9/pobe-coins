import { describe, expect, it } from 'vitest';
import {
  describeRecurrence,
  dueAt,
  isOccurrence,
  nextOccurrence,
  periodKey,
  previousOccurrence,
  rotationAssignee,
  toLocalDate,
  zonedTimeToUtc,
  type Recurrence,
} from './recurrence';
import { applyCompletion, currentStreak, EMPTY_STREAK, streakAtRisk } from './streaks';

const daily: Recurrence = { freq: 'daily', anchor: '2026-01-01' };
const monWed: Recurrence = { freq: 'weekly', byWeekday: [1, 3], anchor: '2026-01-05' }; // Mon
const monthly31: Recurrence = { freq: 'monthly', byMonthDay: 31, anchor: '2026-01-31' };

describe('occurrences', () => {
  it('daily with interval', () => {
    const every3: Recurrence = { freq: 'daily', interval: 3, anchor: '2026-01-01' };
    expect(isOccurrence(every3, '2026-01-04')).toBe(true);
    expect(isOccurrence(every3, '2026-01-05')).toBe(false);
    expect(nextOccurrence(every3, '2026-01-05')).toBe('2026-01-07');
  });

  it('weekly on specific days', () => {
    expect(nextOccurrence(monWed, '2026-01-06')).toBe('2026-01-07'); // Tue → Wed
    expect(nextOccurrence(monWed, '2026-01-08')).toBe('2026-01-12'); // Thu → Mon
    expect(previousOccurrence(monWed, '2026-01-11')).toBe('2026-01-07');
  });

  it('every 2 weeks', () => {
    const biweekly: Recurrence = { freq: 'weekly', interval: 2, anchor: '2026-01-05' };
    expect(nextOccurrence(biweekly, '2026-01-06')).toBe('2026-01-19');
  });

  it('monthly clamps to short months', () => {
    expect(nextOccurrence(monthly31, '2026-02-01')).toBe('2026-02-28');
    expect(nextOccurrence(monthly31, '2026-04-01')).toBe('2026-04-30');
  });

  it('nothing before the anchor', () => {
    expect(previousOccurrence(daily, '2025-12-31')).toBeNull();
    expect(nextOccurrence(daily, '2025-06-01')).toBe('2026-01-01');
  });

  it('describes rules', () => {
    expect(describeRecurrence(daily)).toBe('Every day');
    expect(describeRecurrence(monWed)).toBe('Every Mon, Wed');
    expect(describeRecurrence(monthly31)).toBe('Monthly on day 31');
  });
});

describe('time zones', () => {
  it('uses the household day, not UTC', () => {
    // 2026-03-10 03:00 UTC is still March 9 in Los Angeles.
    const instant = new Date('2026-03-10T03:00:00Z');
    expect(toLocalDate(instant, 'America/Los_Angeles')).toBe('2026-03-09');
    expect(periodKey(daily, instant, 'America/Los_Angeles')).toBe('2026-03-09');
    expect(periodKey(daily, instant, 'Europe/Berlin')).toBe('2026-03-10');
  });

  it('converts wall time across DST', () => {
    // US DST starts 2026-03-08. 09:00 local is 17:00Z before and 16:00Z after.
    expect(zonedTimeToUtc('2026-03-07', '09:00', 'America/Los_Angeles').toISOString()).toBe(
      '2026-03-07T17:00:00.000Z',
    );
    expect(zonedTimeToUtc('2026-03-09', '09:00', 'America/Los_Angeles').toISOString()).toBe(
      '2026-03-09T16:00:00.000Z',
    );
  });

  it('due at end of period by default, or at dueTime', () => {
    expect(dueAt(daily, '2026-06-01', 'UTC').toISOString()).toBe('2026-06-01T23:59:59.000Z');
    expect(dueAt({ ...daily, dueTime: '20:30' }, '2026-06-01', 'Asia/Tokyo').toISOString()).toBe(
      '2026-06-01T11:30:00.000Z',
    );
  });
});

describe('rotation', () => {
  it('alternates members per occurrence', () => {
    const weekly: Recurrence = { freq: 'weekly', anchor: '2026-01-05' };
    expect(rotationAssignee(weekly, ['a', 'b'], '2026-01-05')).toBe('a');
    expect(rotationAssignee(weekly, ['a', 'b'], '2026-01-12')).toBe('b');
    expect(rotationAssignee(weekly, ['a', 'b'], '2026-01-19')).toBe('a');
    expect(rotationAssignee(weekly, ['a', 'b'], '2026-01-19', 1)).toBe('b');
  });
});

describe('streaks', () => {
  const rule = { every: 3, bonus: 10 };

  it('counts consecutive periods and pays milestone bonuses', () => {
    let s = EMPTY_STREAK;
    const days = ['2026-01-01', '2026-01-02', '2026-01-03'];
    let last;
    for (const d of days) {
      last = applyCompletion(daily, s, d, rule);
      s = last.streak;
    }
    expect(s.current).toBe(3);
    expect(last!.bonus).toBe(10);
    expect(last!.milestone).toBe(true);
  });

  it('ignores a second completion in the same period', () => {
    const first = applyCompletion(daily, EMPTY_STREAK, '2026-01-01', rule);
    const again = applyCompletion(daily, first.streak, '2026-01-01', rule);
    expect(again.duplicate).toBe(true);
    expect(again.streak.current).toBe(1);
  });

  it('resets after a missed period and keeps the best', () => {
    let s = applyCompletion(daily, EMPTY_STREAK, '2026-01-01').streak;
    s = applyCompletion(daily, s, '2026-01-02').streak;
    s = applyCompletion(daily, s, '2026-01-04').streak;
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
  });

  it('weekly streak across skipped non-occurrence days', () => {
    let s = applyCompletion(monWed, EMPTY_STREAK, '2026-01-05').streak;
    s = applyCompletion(monWed, s, '2026-01-07').streak;
    s = applyCompletion(monWed, s, '2026-01-12').streak;
    expect(s.current).toBe(3);
  });

  it('breaks the live streak once a full period passes', () => {
    const s = applyCompletion(daily, EMPTY_STREAK, '2026-01-01').streak;
    const tz = 'UTC';
    expect(currentStreak(daily, s, new Date('2026-01-02T12:00:00Z'), tz).current).toBe(1);
    expect(streakAtRisk(daily, s, new Date('2026-01-02T12:00:00Z'), tz)).toBe(true);
    expect(currentStreak(daily, s, new Date('2026-01-03T00:00:01Z'), tz).current).toBe(0);
  });
});
