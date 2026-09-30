/**
 * Test harness: the real Hono app over an in-memory database, a controllable clock,
 * and fakes for push, storage, identity and the network.
 */
import type { Deps, Storage } from '../context';
import { createApp } from '../app';
import { MemoryDb } from '../db/memory';
import { RecordingNotifier } from '../adapters/push';
import { clearDeviceCache } from '../services/auth';
import { listByPrefix, listMembers } from '../repo';
import { PREFIX } from '../db/keys';
import type { LedgerEntry } from '@pobe/core';

export class FakeStorage implements Storage {
  readonly objects = new Map<string, Uint8Array>();
  async presignUpload(key: string) {
    return { url: 'https://uploads.example.test/', fields: { key } };
  }
  async presignGet(key: string) {
    return `https://photos.example.test/${key}?sig=1`;
  }
  async putObject(key: string, body: Uint8Array) {
    this.objects.set(key, body);
  }
  async getObject(key: string) {
    return this.objects.get(key);
  }
  async deletePrefix(prefix: string) {
    for (const k of [...this.objects.keys()]) if (k.startsWith(prefix)) this.objects.delete(k);
  }
}

/** A JWT-shaped fake Cognito ID token (signature not checked by the fake verifier). */
export function userToken(sub: string, name = 'Test User') {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'RS256' })}.${b64({ aud: 'cognito-client', sub, name, email: `${sub}@example.test` })}.sig`;
}

export function createHarness(start = '2026-06-01T15:00:00Z') {
  let now = new Date(start);
  const db = new MemoryDb(() => now.getTime());
  const notifier = new RecordingNotifier();
  const storage = new FakeStorage();
  const dns = new Map<string, string[]>([['shop.example.com', ['93.184.216.34']]]);
  const pages = new Map<string, Response | (() => Response)>();
  const exports: [string, string][] = [];
  const deps: Deps = {
    db,
    config: {
      stage: 'test',
      tableName: 'test',
      bucketName: 'test',
      webOrigin: 'https://pobe.example.test',
      cognito: null,
      appleAudiences: [],
      deviceTokenSecret: 'test-secret-test-secret-test-secret',
      vapid: null,
    },
    now: () => new Date(now),
    notifier,
    storage,
    identity: {
      async verify(token) {
        const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
        if (payload.aud !== 'cognito-client') throw new Error('bad token');
        return { sub: payload.sub, name: payload.name, email: payload.email };
      },
    },
    fetch: (async (url: string) => {
      const p = pages.get(url);
      if (!p) return new Response('not found', { status: 404 });
      return typeof p === 'function' ? p() : p.clone();
    }) as typeof fetch,
    resolveHost: async (host) => dns.get(host) ?? [],
    startExport: async (hid, jobId) => {
      exports.push([hid, jobId]);
    },
  };
  clearDeviceCache();
  const app = createApp(deps);

  async function call<T = any>(
    method: string,
    path: string,
    opts: { token?: string; body?: unknown; household?: string; ip?: string } = {},
  ) {
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': opts.ip ?? '203.0.113.9' };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.household) headers['x-household-id'] = opts.household;
    const res = await app.request(path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, body: json as T, headers: res.headers };
  }

  return {
    deps,
    db,
    notifier,
    storage,
    dns,
    pages,
    exports,
    app,
    call,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    setNow(iso: string) {
      now = new Date(iso);
    },
  };
}

export type Harness = ReturnType<typeof createHarness>;

/** Sets up a household with an admin (OAuth) and a member who joined with a device link. */
export async function household(h: Harness, opts: { templates?: string[]; sub?: string } = {}) {
  const adminToken = userToken(opts.sub ?? 'admin-sub', 'Sam');
  const created = await h.call('POST', '/households', {
    token: adminToken,
    body: { name: 'Our Home', memberName: 'Sam', timeZone: 'UTC', templateIds: opts.templates ?? [] },
  });
  if (created.status !== 201) throw new Error(`create failed: ${JSON.stringify(created.body)}`);
  const hid = created.body.household.id as string;
  const adminId = created.body.member.id as string;
  const wife = await h.call('POST', '/members', { token: adminToken, body: { name: 'Alex' } });
  const link = await h.call('POST', '/links', { token: adminToken, body: { memberId: wife.body.id } });
  const redeemed = await h.call('POST', '/links/redeem', { body: { token: link.body.token, deviceLabel: 'Alex phone', platform: 'ios' } });
  if (redeemed.status !== 200) throw new Error(`redeem failed: ${JSON.stringify(redeemed.body)}`);
  return {
    hid,
    adminToken,
    adminId,
    memberToken: redeemed.body.token as string,
    memberId: wife.body.id as string,
    deviceId: redeemed.body.device.id as string,
  };
}

/**
 * The money invariant: replaying every ledger entry must reproduce each member's purse and debt
 * exactly. Returns human-readable mismatches (empty when consistent).
 */
export async function ledgerMismatches(h: Harness, hid: string): Promise<string[]> {
  const members = await listMembers(h.deps, hid, true);
  const entries = await listByPrefix<LedgerEntry>(h.deps, hid, PREFIX.ledger);
  const problems: string[] = [];
  for (const m of members) {
    const coins: Record<string, number> = {};
    let debt = 0;
    for (const e of entries.filter((x) => x.memberId === m.id)) {
      for (const [d, n] of Object.entries(e.coinsIn)) coins[d] = (coins[d] ?? 0) + n;
      for (const [d, n] of Object.entries(e.coinsOut)) coins[d] = (coins[d] ?? 0) - n;
      debt += e.debtDelta;
    }
    const replayed = Object.fromEntries(Object.entries(coins).filter(([, n]) => n !== 0));
    const actual = Object.fromEntries(Object.entries(m.purse).filter(([, n]) => n !== 0));
    if (JSON.stringify(sortKeys(replayed)) !== JSON.stringify(sortKeys(actual)))
      problems.push(`${m.name}: purse ${JSON.stringify(actual)} but ledger replays to ${JSON.stringify(replayed)}`);
    if (debt !== m.debt) problems.push(`${m.name}: debt ${m.debt} but ledger replays to ${debt}`);
  }
  return problems;
}

function sortKeys(o: Record<string, number>) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => Number(a) - Number(b)));
}
