import { CoinError, balance, pay, type Purse } from '@pobe/core';

export interface ChangePreview {
  kind: 'exact' | 'change' | 'iou' | 'short';
  out?: Purse;
  back?: Purse;
  borrow?: number;
}

/** What paying `amount` would do to the purse (same algorithm as the server). */
export function previewPayment(purse: Purse, debt: number, amount: number, coinTypes: number[], debtLimit: number): ChangePreview | null {
  if (!amount) return null;
  const have = balance(purse);
  if (have >= amount) {
    try {
      const p = pay(purse, amount, coinTypes);
      return { kind: Object.keys(p.coinsIn).length ? 'change' : 'exact', out: p.coinsOut, back: p.coinsIn };
    } catch (e) {
      if (e instanceof CoinError) return null;
      throw e;
    }
  }
  const borrow = amount - have;
  return debt + borrow <= debtLimit ? { kind: 'iou', out: purse, borrow } : { kind: 'short', borrow };
}

export function describeCoins(p?: Purse) {
  if (!p) return '';
  return Object.entries(p)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([d, n]) => `${n}×${d}`)
    .join(' + ');
}
