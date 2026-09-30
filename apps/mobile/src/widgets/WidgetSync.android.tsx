import { useEffect } from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { useWidgetSnapshot } from '@/api/hooks';
import { useSession } from '@/auth/session';
import { PurseWidget } from './android/PurseWidget';
import { saveSnapshot } from './snapshot';

export function WidgetSync() {
  const { active } = useSession();
  const snap = useWidgetSnapshot(!!active);
  useEffect(() => {
    const s = snap.data;
    if (!s) return;
    void saveSnapshot(s).then(() =>
      requestWidgetUpdate({ widgetName: 'PurseWidget', renderWidget: () => <PurseWidget snapshot={s} /> }).catch(() => undefined),
    );
  }, [snap.data]);
  return null;
}
