import { useEffect } from 'react';
import { useWidgetSnapshot } from '@/api/hooks';
import { useSession } from '@/auth/session';
import { purseWidget } from './PurseWidget.ios';
import { saveSnapshot, widgetColors } from './snapshot';

/** Keeps the iOS widget in sync with the purse whenever the app refreshes data. */
export function WidgetSync() {
  const { active } = useSession();
  const snap = useWidgetSnapshot(!!active);
  useEffect(() => {
    const s = snap.data;
    if (!s) return;
    void saveSnapshot(s);
    const c = widgetColors(s.theme);
    try {
      purseWidget.updateSnapshot({
        name: s.name,
        balance: s.balance,
        debt: s.debt,
        today: s.today,
        next: s.next.map((n) => `${n.emoji ?? ''} ${n.title}`.trim()),
        line: s.line,
        bg: c.bg,
        ink: c.ink,
        soft: c.soft,
      });
    } catch (err) {
      console.warn('widget update failed', err);
    }
  }, [snap.data]);
  return null;
}
