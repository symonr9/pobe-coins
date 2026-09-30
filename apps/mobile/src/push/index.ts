import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '@/api/client';
import { VAPID_PUBLIC_KEY } from '@/config';

export type PushSupport = 'native' | 'web' | 'web-needs-install' | 'unsupported';

export function pushSupport(): PushSupport {
  if (Platform.OS !== 'web') return 'native';
  const w = globalThis as any;
  if (!('serviceWorker' in (w.navigator ?? {})) || !('PushManager' in w) || !VAPID_PUBLIC_KEY) {
    // iOS Safari only exposes Web Push to installed (home-screen) web apps.
    const ios = /iPhone|iPad|iPod/.test(w.navigator?.userAgent ?? '');
    return ios && !isStandalone() ? 'web-needs-install' : 'unsupported';
  }
  return 'web';
}

export function isStandalone() {
  const w = globalThis as any;
  return !!(w.navigator?.standalone || w.matchMedia?.('(display-mode: standalone)').matches);
}

export async function pushPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') {
    const n = (globalThis as any).Notification;
    if (!n) return 'denied';
    return n.permission === 'default' ? 'undetermined' : n.permission;
  }
  const s = await Notifications.getPermissionsAsync();
  return s.granted ? 'granted' : s.canAskAgain ? 'undetermined' : 'denied';
}

export async function configureNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
  await Notifications.setNotificationCategoryAsync('approval', [
    { identifier: 'approve', buttonTitle: 'Approve', options: { opensAppToForeground: false } },
    { identifier: 'reject', buttonTitle: 'Not yet', options: { opensAppToForeground: false, isDestructive: true } },
  ]).catch(() => undefined);
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Pobe Coins',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'coin.wav',
      lightColor: '#F9B9CD',
    }).catch(() => undefined);
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Asks permission (if needed) and registers this device for push. Returns true when on. */
export async function enablePush(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (pushSupport() !== 'web') return false;
    const nav = (globalThis as any).navigator;
    const perm = await (globalThis as any).Notification.requestPermission();
    if (perm !== 'granted') return false;
    const reg = await nav.serviceWorker.register('/sw.js');
    await nav.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
    const json = sub.toJSON();
    await api('POST', '/push', { kind: 'webpush', subscription: { endpoint: json.endpoint, keys: json.keys } });
    return true;
  }
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return false;
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('Push needs an EAS project id (set EAS_PROJECT_ID).');
    return false;
  }
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api('POST', '/push', { kind: 'expo', token: data });
  return true;
}

/** Schedules on-device reminders for chores due today (native only). */
export async function scheduleReminders(tasks: { id: string; title: string; emoji?: string; nextDueAt?: string; doneThisPeriod: boolean; mine: boolean; recurrenceDueTime?: string }[]) {
  if (Platform.OS === 'web') return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((n) => n.content.data?.kind === 'reminder').map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const now = Date.now();
  for (const t of tasks) {
    if (!t.mine || t.doneThisPeriod || !t.nextDueAt || !t.recurrenceDueTime) continue;
    const at = new Date(t.nextDueAt).getTime();
    if (at <= now || at - now > 36 * 3600_000) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: `${t.emoji ? `${t.emoji} ` : ''}${t.title}`, body: 'Chubbybara says it\'s time!', data: { kind: 'reminder', url: '/tasks' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    });
  }
}
