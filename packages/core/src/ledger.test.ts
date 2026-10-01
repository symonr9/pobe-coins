import { describe, expect, it } from 'vitest';
import { fundedBy, summarizeFunding, type LedgerEntry, type LedgerKind } from './ledger';
import { leaderboard, topChores, weekStart, weeklySeries, wrapped } from './stats';

let n = 0;
function entry(kind: LedgerKind, value: number, label: string, day: string, extra: Partial<LedgerEntry> = {}): LedgerEntry {
  n++;
  return {
    id: `e${String(n).padStart(3, '0')}`,
    householdId: 'h',
    memberId: 'm1',
    kind,
    value,
    coinsIn: {},
    coinsOut: {},
    debtDelta: 0,
    label,
    createdAt: `${day}T12:00:00.000Z`,
    createdBy: 'm1',
    ...extra,
  };
}

describe('fundedBy', () => {
  it('attributes spends to earnings first-in-first-out', () => {
    const a = entry('EARN', 10, 'Dishes', '2026-01-01');
    const b = entry('EARN', 10, 'Dishes', '2026-01-02');
    const c = entry('EARN', 25, 'Deep clean', '2026-01-03');
    const s = entry('SPEND', -30, 'Headphones', '2026-01-04');
    const alloc = fundedBy([s, c, b, a]).get(s.id)!;
    expect(alloc.map((x) => [x.sourceId, x.amount])).toEqual([
      [a.id, 10],
      [b.id, 10],
      [c.id, 10],
    ]);
    expect(summarizeFunding(alloc)).toEqual([
      { label: 'Dishes', amount: 20, count: 2, iou: false },
      { label: 'Deep clean', amount: 10, count: 1, iou: false },
    ]);
  });

  it('funds IOU spends with later earnings', () => {
    const s = entry('SPEND', -20, 'Book', '2026-01-01', { debtDelta: 20 });
    const e1 = entry('EARN', 15, 'Laundry', '2026-01-02');
    const map = fundedBy([s, e1]);
    expect(map.get(s.id)).toEqual([
      { sourceId: e1.id, label: 'Laundry', kind: 'EARN', amount: 15, ref: undefined },
      { label: 'IOU', amount: 5 },
    ]);
  });

  it('ignores reversed entries', () => {
    const e1 = entry('EARN', 10, 'Dishes', '2026-01-01');
    const undo = entry('UNDO', -10, 'Undo Dishes', '2026-01-01', { reverses: e1.id });
    const e2 = entry('EARN', 10, 'Trash', '2026-01-02');
    const s = entry('SPEND', -10, 'Snack', '2026-01-03');
    expect(fundedBy([e1, undo, e2, s]).get(s.id)![0]!.label).toBe('Trash');
  });
});

describe('stats', () => {
  const entries = [
    entry('EARN', 10, 'Dishes', '2026-03-02'),
    entry('EARN', 10, 'Dishes', '2026-03-03'),
    entry('EARN', 25, 'Mow lawn', '2026-03-04', { memberId: 'm2' }),
    entry('BONUS', 5, 'Streak bonus', '2026-03-04'),
    entry('SPEND', -30, 'Movie night', '2026-03-10'),
  ];

  it('week starts on Monday', () => {
    expect(weekStart('2026-03-08')).toBe('2026-03-02'); // Sunday → previous Monday
    expect(weekStart('2026-03-09')).toBe('2026-03-09');
  });

  it('weekly series', () => {
    const s = weeklySeries(entries, 'UTC', new Date('2026-03-12T00:00:00Z'), 2);
    expect(s).toEqual([
      { week: '2026-03-02', earned: 50, spent: 0 },
      { week: '2026-03-09', earned: 0, spent: 30 },
    ]);
  });

  it('top chores and leaderboard', () => {
    expect(topChores(entries)[0]).toEqual({ label: 'Dishes', count: 2, coins: 20 });
    const lb = leaderboard(entries, new Date('2026-03-01'), new Date('2026-04-01'), ['m1', 'm2']);
    expect(lb.map((r) => [r.memberId, r.earned])).toEqual([
      ['m1', 25], // tie on coins; more completions wins
      ['m2', 25],
    ]);
  });

  it('wrapped recap', () => {
    const w = wrapped(entries, 'm1', new Date('2026-03-01'), new Date('2026-04-01'), 'UTC', 4);
    expect(w.earned).toBe(25);
    expect(w.spent).toBe(30);
    expect(w.completions).toBe(2);
    expect(w.biggestPurchase?.label).toBe('Movie night');
    expect(w.bestStreak).toBe(4);
    expect(w.busiestWeekday?.completions).toBe(1);
  });
});
