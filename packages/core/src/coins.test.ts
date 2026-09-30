import { describe, expect, it } from 'vitest';
import {
  CoinError,
  addCoins,
  balance,
  convertPurse,
  pay,
  payWithDebt,
  payout,
  receive,
  refund,
  validateCoinTypes,
  type Purse,
} from './coins';

describe('payout', () => {
  it('uses the fewest coins for the default set', () => {
    expect(payout(30)).toEqual({ 25: 1, 5: 1 });
    expect(payout(188)).toEqual({ 100: 1, 50: 1, 25: 1, 10: 1, 1: 3 });
    expect(payout(0)).toEqual({});
  });

  it('stays optimal for non-canonical coin sets', () => {
    // Greedy would give 4+1+1 (3 coins); optimal is 3+3.
    expect(payout(6, [1, 3, 4])).toEqual({ 3: 2 });
  });

  it('rejects fractional or negative amounts', () => {
    expect(() => payout(1.5)).toThrow(CoinError);
    expect(() => payout(-1)).toThrow(CoinError);
  });
});

describe('pay', () => {
  it('pays exactly when possible and gives no change', () => {
    const r = pay({ 25: 1, 10: 2, 5: 1 }, 20);
    expect(r.coinsOut).toEqual({ 10: 2 });
    expect(r.coinsIn).toEqual({});
    expect(r.newPurse).toEqual({ 25: 1, 5: 1 });
  });

  it('prefers the fewest coins among exact combinations', () => {
    const r = pay({ 1: 50, 50: 1 }, 50);
    expect(r.coinsOut).toEqual({ 50: 1 });
  });

  it('makes change when there is no exact combination', () => {
    const r = pay({ 25: 1 }, 20);
    expect(r.coinsOut).toEqual({ 25: 1 });
    expect(r.coinsIn).toEqual({ 5: 1 });
    expect(r.newPurse).toEqual({ 5: 1 });
  });

  it('picks the smallest overpayment', () => {
    // 60 = 100 (40 change) or 50+25 (15 change). Should use 50+25.
    const r = pay({ 100: 1, 50: 1, 25: 1 }, 60);
    expect(balance(r.coinsOut)).toBe(75);
    expect(r.coinsIn).toEqual({ 10: 1, 5: 1 });
  });

  it('conserves value', () => {
    const purse: Purse = { 100: 2, 50: 1, 25: 3, 10: 4, 5: 1, 1: 7 };
    for (const amount of [1, 7, 33, 99, 150, 287, 377]) {
      const r = pay(purse, amount);
      expect(balance(r.newPurse)).toBe(balance(purse) - amount);
      expect(balance(r.coinsOut) - balance(r.coinsIn)).toBe(amount);
    }
  });

  it('handles large purses quickly', () => {
    const start = Date.now();
    const r = pay({ 1: 5000, 5: 2000, 100: 300 }, 12_345);
    expect(balance(r.coinsOut) - balance(r.coinsIn)).toBe(12_345);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('throws INSUFFICIENT when the balance is too low', () => {
    expect(() => pay({ 5: 1 }, 6)).toThrow(/Need 6 coins/);
  });
});

describe('payWithDebt (IOUs)', () => {
  it('pays normally when the purse covers it', () => {
    const r = payWithDebt({ 25: 1 }, 0, 20, 100);
    expect(r.debtAdded).toBe(0);
    expect(r.newDebt).toBe(0);
  });

  it('empties the purse and borrows the shortfall', () => {
    const r = payWithDebt({ 10: 1, 5: 1 }, 0, 40, 50);
    expect(r.coinsOut).toEqual({ 10: 1, 5: 1 });
    expect(r.newPurse).toEqual({});
    expect(r.debtAdded).toBe(25);
    expect(r.newDebt).toBe(25);
  });

  it('refuses to exceed the IOU limit', () => {
    expect(() => payWithDebt({ 5: 1 }, 40, 20, 50)).toThrow(/borrow 10 more/);
    expect(() => payWithDebt({}, 50, 1, 50)).toThrow(/used up/);
  });
});

describe('receive', () => {
  it('pays off debt before adding coins', () => {
    const r = receive({ 5: 1 }, 20, 30);
    expect(r.debtPaid).toBe(20);
    expect(r.newDebt).toBe(0);
    expect(r.coinsIn).toEqual({ 10: 1 });
    expect(r.newPurse).toEqual({ 10: 1, 5: 1 });
  });

  it('keeps partial debt when earnings are smaller', () => {
    const r = receive({}, 20, 5);
    expect(r.newDebt).toBe(15);
    expect(r.coinsIn).toEqual({});
  });
});

describe('refund', () => {
  it('returns the exact coins and takes back the change', () => {
    const p = pay({ 25: 1 }, 20);
    const r = refund(p.newPurse, 0, p);
    expect(r.exact).toBe(true);
    expect(r.newPurse).toEqual({ 25: 1 });
  });

  it('falls back to equal value when the change was spent', () => {
    const p = pay({ 25: 1 }, 20); // purse now {5:1}
    const spent = pay(p.newPurse, 5).newPurse; // purse now {}
    const r = refund(spent, 0, p);
    expect(r.exact).toBe(false);
    expect(balance(r.newPurse)).toBe(20);
  });

  it('cancels IOU debt', () => {
    const p = payWithDebt({ 10: 1 }, 0, 30, 100);
    const r = refund(p.newPurse, p.newDebt, p);
    expect(r.newDebt).toBe(0);
    expect(r.newPurse).toEqual({ 10: 1 });
  });

  it('returns already-repaid debt as coins', () => {
    const p = payWithDebt({ 10: 1 }, 0, 30, 100); // debt 20
    const earned = receive(p.newPurse, p.newDebt, 15); // debt 5, purse {}
    const r = refund(earned.newPurse, earned.newDebt, p);
    expect(r.newDebt).toBe(0);
    expect(balance(r.newPurse)).toBe(10 + 15);
  });
});

describe('coin types', () => {
  it('requires a 1-coin and unique whole numbers', () => {
    expect(() => validateCoinTypes([5, 10])).toThrow(/1-coin/);
    expect(() => validateCoinTypes([1, 5, 5])).toThrow(/twice/);
    expect(() => validateCoinTypes([1, 2.5])).toThrow(/whole number/);
    expect(() => validateCoinTypes([1, 2, 3])).not.toThrow();
  });

  it('converts a purse to new coin types keeping its value', () => {
    const purse = addCoins({ 25: 3 }, { 5: 1 });
    const converted = convertPurse(purse, [1, 20]);
    expect(balance(converted)).toBe(80);
    expect(converted).toEqual({ 20: 4 });
  });
});

describe('pay (property check against brute force)', () => {
  const types = [1, 5, 10, 25, 50, 100];
  function bruteForce(purse: Purse, amount: number) {
    // Enumerate every sub-purse; best = smallest total ≥ amount, then fewest coins.
    const denoms = Object.keys(purse).map(Number);
    let best: { total: number; coins: number } | null = null;
    const walk = (i: number, total: number, coins: number) => {
      if (i === denoms.length) {
        if (total >= amount && (!best || total < best.total || (total === best.total && coins < best.coins))) {
          best = { total, coins };
        }
        return;
      }
      const d = denoms[i]!;
      for (let n = 0; n <= purse[d]!; n++) walk(i + 1, total + n * d, coins + n);
    };
    walk(0, 0, 0);
    return best as { total: number; coins: number } | null;
  }
  let seed = 42;
  const rand = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed % n;
  };
  it('matches brute force on 300 random purses', () => {
    for (let i = 0; i < 300; i++) {
      const purse: Purse = {};
      for (const t of types) if (rand(2)) purse[t] = rand(4) + 1;
      const total = balance(purse);
      if (total === 0) continue;
      const amount = rand(total) + 1;
      const expected = bruteForce(purse, amount)!;
      const r = pay(purse, amount);
      expect(balance(r.coinsOut)).toBe(expected.total);
      expect(Object.values(r.coinsOut).reduce((a, b) => a + b, 0)).toBe(expected.coins);
    }
  });
});
