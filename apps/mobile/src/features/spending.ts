import { useCallback } from 'react';
import { CoinError, balance, pay, pickLine, type Purse } from '@pobe/core';
import { ApiError } from '@/api/client';
import { useRefreshAll } from '@/api/hooks';
import { useTranslation } from '@/i18n';
import { confirmWithBiometrics } from '@/lib/biometric';
import { usePrefs } from '@/lib/prefs-context';
import { track } from '@/lib/monitoring';
import { useCelebrate } from './celebrate';
import { useFeedback } from '@/ui/Feedback';

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

/**
 * Runs a spend with the app's rules: optional Face ID, IOU confirmation when the purse
 * is short, a shopkeeper celebration, and friendly errors.
 */
export function useSpend() {
  const { t } = useTranslation();
  const { prefs } = usePrefs();
  const { confirm, toast } = useFeedback();
  const celebrate = useCelebrate();
  const refresh = useRefreshAll();
  return useCallback(
    async <R extends { purchase?: { status: string; title: string } }>(label: string, amount: number, run: (allowIou: boolean) => Promise<R>): Promise<R | null> => {
      if (prefs.biometricSpend && !(await confirmWithBiometrics(t('Spend {{n}} coins on {{item}}', { n: amount, item: label })))) return null;
      const attempt = async (allowIou: boolean): Promise<R | null> => {
        try {
          const r = await run(allowIou);
          track('spent', { amount, iou: allowIou });
          void refresh();
          if (r.purchase?.status === 'pending') {
            toast(t('Sent for approval. The coins are set aside until then.'), 'info');
          } else {
            celebrate({ pose: 'shopkeeper', title: label, line: t(pickLine('purchase', { vars: { item: label } }).text), big: amount >= 100 });
          }
          return r;
        } catch (e) {
          if (e instanceof ApiError && e.code === 'INSUFFICIENT' && e.details?.canBorrow > 0 && !allowIou) {
            const ok = await confirm({
              title: t('Borrow {{n}} coins?', { n: e.details.canBorrow }),
              message: t('You have {{have}}. The rest goes on an IOU, and your next chores pay it back first.', { have: e.details.balance }),
              confirm: t('Borrow'),
            });
            return ok ? attempt(true) : null;
          }
          toast(e instanceof ApiError ? e.message : t('That didn\'t go through.'), 'error');
          return null;
        }
      };
      return attempt(false);
    },
    [prefs.biometricSpend, t, confirm, toast, celebrate, refresh],
  );
}
