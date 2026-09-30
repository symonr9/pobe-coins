import { followingOccurrence, toLocalDate, type LocalDate, type Recurrence } from './recurrence';

export interface Streak {
  current: number;
  best: number;
  /** Period (occurrence date) of the last counted completion. */
  lastPeriodKey?: LocalDate;
}

/** Milestone bonus: every `every` periods in a row pays `bonus` coins. */
export interface StreakRule {
  every: number;
  bonus: number;
}

export const EMPTY_STREAK: Streak = { current: 0, best: 0 };

export interface StreakUpdate {
  streak: Streak;
  /** Bonus coins earned by this completion (0 if no milestone hit). */
  bonus: number;
  milestone: boolean;
  /** True when this period was already counted (a second completion in the same period). */
  duplicate: boolean;
}

/** Applies a completion in `period` to a streak. */
export function applyCompletion(
  rule: Recurrence,
  streak: Streak,
  period: LocalDate,
  streakRule?: StreakRule,
): StreakUpdate {
  if (streak.lastPeriodKey === period || (streak.lastPeriodKey && period < streak.lastPeriodKey)) {
    return { streak, bonus: 0, milestone: false, duplicate: true };
  }
  const continues =
    streak.lastPeriodKey !== undefined && followingOccurrence(rule, streak.lastPeriodKey) === period;
  const current = continues ? streak.current + 1 : 1;
  const next: Streak = { current, best: Math.max(streak.best, current), lastPeriodKey: period };
  const milestone = !!streakRule && streakRule.every > 0 && current % streakRule.every === 0;
  return { streak: next, bonus: milestone ? streakRule!.bonus : 0, milestone, duplicate: false };
}

/**
 * The streak as it stands at `now`: it's broken once a whole period has passed
 * without completion (i.e. the period after the last counted one is over).
 */
export function currentStreak(rule: Recurrence, streak: Streak, now: Date, timeZone: string): Streak {
  if (!streak.lastPeriodKey || streak.current === 0) return { ...streak, current: 0 };
  const nextPeriod = followingOccurrence(rule, streak.lastPeriodKey);
  const periodAfterNext = followingOccurrence(rule, nextPeriod);
  const today = toLocalDate(now, timeZone);
  return today >= periodAfterNext ? { ...streak, current: 0 } : streak;
}

/** Whether the streak is at risk: the current period is open and not yet done. */
export function streakAtRisk(rule: Recurrence, streak: Streak, now: Date, timeZone: string): boolean {
  const live = currentStreak(rule, streak, now, timeZone);
  if (live.current === 0 || !live.lastPeriodKey) return false;
  const nextPeriod = followingOccurrence(rule, live.lastPeriodKey);
  return toLocalDate(now, timeZone) >= nextPeriod;
}
