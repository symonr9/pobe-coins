/**
 * Push delivery: Expo Push Service (APNs/FCM) for the native apps and Web Push (VAPID)
 * for the PWA. Dead targets are removed when a provider says they're gone.
 */
import webpush from 'web-push';
import type { Deps, Notifier, PushMessage } from '../context';
import { keys } from '../db/keys';
import type { Db, Item } from '../db/types';
import type { Config } from '../lib/config';
import { sha256 } from '../lib/ids';

interface PushTarget extends Item {
  memberId: string;
  kind: 'expo' | 'webpush';
  token?: string;
  subscription?: webpush.PushSubscription;
}

export class PushNotifier implements Notifier {
  constructor(
    private readonly db: Db,
    private readonly config: Config,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (config.vapid) webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
  }

  async send(householdId: string, memberIds: string[], message: PushMessage) {
    if (!memberIds.length) return;
    const targets = (
      await Promise.all(memberIds.map((mid) => this.db.query<PushTarget>(`H#${householdId}`, { beginsWith: `PT#${mid}#` })))
    ).flat();
    const expo = targets.filter((t) => t.kind === 'expo' && t.token);
    const web = targets.filter((t) => t.kind === 'webpush' && t.subscription);
    await Promise.all([this.sendExpo(householdId, expo, message), this.sendWeb(householdId, web, message)]);
  }

  private async remove(householdId: string, t: PushTarget) {
    const token = t.kind === 'expo' ? t.token! : t.subscription!.endpoint;
    await this.db.delete(keys.pushTarget(householdId, t.memberId, sha256(token))).catch(() => undefined);
  }

  private async sendExpo(householdId: string, targets: PushTarget[], m: PushMessage) {
    for (let i = 0; i < targets.length; i += 100) {
      const batch = targets.slice(i, i + 100);
      const body = batch.map((t) => ({
        to: t.token,
        title: m.title,
        body: m.body,
        sound: 'default',
        categoryId: m.category,
        data: { url: m.url, ...m.data },
      }));
      try {
        const res = await this.fetchImpl('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            ...(this.config.expoAccessToken ? { authorization: `Bearer ${this.config.expoAccessToken}` } : {}),
          },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };
        await Promise.all(
          (json.data ?? []).map((ticket, j) =>
            ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? this.remove(householdId, batch[j]!) : undefined,
          ),
        );
      } catch (err) {
        console.warn('expo push failed', err);
      }
    }
  }

  private async sendWeb(householdId: string, targets: PushTarget[], m: PushMessage) {
    if (!this.config.vapid) return;
    const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url, category: m.category, data: m.data });
    await Promise.all(
      targets.map(async (t) => {
        try {
          await webpush.sendNotification(t.subscription!, payload, { TTL: 24 * 3600 });
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await this.remove(householdId, t);
          else console.warn('web push failed', status);
        }
      }),
    );
  }
}

/** Records messages instead of sending (tests, local dev). */
export class RecordingNotifier implements Notifier {
  readonly sent: { householdId: string; memberIds: string[]; message: PushMessage }[] = [];
  async send(householdId: string, memberIds: string[], message: PushMessage) {
    this.sent.push({ householdId, memberIds, message });
  }
}

export type { Deps };
