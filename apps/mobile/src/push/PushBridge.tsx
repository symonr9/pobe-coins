import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useApprovals, useTasks } from '@/api/hooks';
import { useSession } from '@/auth/session';
import { useHousehold } from '@/features/useHousehold';
import { configureNotifications, scheduleReminders } from './index';

/** Wires notification taps and action buttons, the app badge and local reminders. */
export function PushBridge() {
  const { active } = useSession();
  const qc = useQueryClient();
  const hh = useHousehold();
  const approvals = useApprovals();
  const tasks = useTasks();

  useEffect(() => {
    void configureNotifications();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // The service worker posts notification clicks to the page.
      const nav = (globalThis as any).navigator;
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'open' && typeof e.data.url === 'string') router.push(e.data.url);
      };
      nav?.serviceWorker?.addEventListener?.('message', onMessage);
      return () => nav?.serviceWorker?.removeEventListener?.('message', onMessage);
    }
    const handle = async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as { type?: string; id?: string; url?: string };
      const action = response.actionIdentifier;
      if ((action === 'approve' || action === 'reject') && data.type && data.id) {
        const path = data.type === 'purchase' ? `/purchases/${data.id}/decide` : `/completions/${data.id}/decide`;
        await api('POST', path, { approve: action === 'approve' }).catch(() => undefined);
        void qc.invalidateQueries();
        return;
      }
      if (data.url) router.push(data.url as never);
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => void handle(r));
    const last = Notifications.getLastNotificationResponse();
    if (last) void handle(last);
    return () => sub.remove();
  }, [qc]);

  // Badge = things waiting for my approval.
  const pending = (approvals.data?.completions.length ?? 0) + (approvals.data?.purchases.length ?? 0);
  useEffect(() => {
    if (!active) return;
    if (Platform.OS === 'web') {
      const nav = (globalThis as any).navigator;
      if (pending) nav?.setAppBadge?.(pending)?.catch?.(() => undefined);
      else nav?.clearAppBadge?.()?.catch?.(() => undefined);
      return;
    }
    void Notifications.setBadgeCountAsync(pending).catch(() => undefined);
  }, [pending, active]);

  // Refresh when the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && active) void qc.invalidateQueries();
    });
    return () => sub.remove();
  }, [qc, active]);

  // On-device reminders for my chores with a due time.
  useEffect(() => {
    if (!tasks.data || !hh.me) return;
    void scheduleReminders(
      tasks.data.map((t) => ({
        id: t.id,
        title: t.title,
        emoji: t.emoji,
        nextDueAt: t.nextDueAt,
        doneThisPeriod: t.doneThisPeriod,
        mine: t.effectiveAssigneeId === hh.me!.id || (t.effectiveAssigneeId === null && t.claimedBy === hh.me!.id),
        recurrenceDueTime: t.recurrence?.dueTime,
      })),
    ).catch(() => undefined);
  }, [tasks.data, hh.me]);

  return null;
}
