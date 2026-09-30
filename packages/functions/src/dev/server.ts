/**
 * Local API for developing the app without AWS: in-memory database, fake uploads,
 * push notifications printed to the console, and "dev sign-in" tokens.
 *
 *   npm run dev:api            (from the repo root)   → http://localhost:3001
 *   SEED=1 npm run dev:api     with a demo household (sign in as "sam" or "alex")
 *
 * Dev tokens are JWT-shaped strings with aud "dev"; the app creates them on the
 * "Dev sign-in" button when EXPO_PUBLIC_DEV_AUTH=1. Never deploy this file.
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Deps, Storage } from '../context';
import { createApp } from '../app';
import { MemoryDb } from '../db/memory';
import { seedDemo } from './seed';

const PORT = Number(process.env.PORT ?? 3001);
const origin = `http://localhost:${PORT}`;

class DevStorage implements Storage {
  readonly files = new Map<string, { body: Uint8Array; type: string }>();
  async presignUpload(key: string) {
    return { url: `${origin}/dev-upload`, fields: { key } };
  }
  async presignGet(key: string) {
    return `${origin}/dev-files/${key}`;
  }
  async putObject(key: string, body: Uint8Array, type: string) {
    this.files.set(key, { body, type });
  }
  async getObject(key: string) {
    return this.files.get(key)?.body;
  }
  async deletePrefix(prefix: string) {
    for (const k of [...this.files.keys()]) if (k.startsWith(prefix)) this.files.delete(k);
  }
}

export function devToken(sub: string, name: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64({ aud: 'dev', sub, name, email: `${sub}@dev.local` })}.dev`;
}

const storage = new DevStorage();
const deps: Deps = {
  db: new MemoryDb(),
  config: {
    stage: 'local',
    tableName: 'local',
    bucketName: 'local',
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:8081',
    cognito: null,
    deviceTokenSecret: 'local-dev-secret-local-dev-secret',
    vapid: null,
  },
  now: () => new Date(),
  notifier: {
    async send(hid, memberIds, message) {
      console.log(`🔔 push to ${memberIds.length} member(s): ${message.title} — ${message.body}`);
    },
  },
  storage,
  identity: {
    async verify(token) {
      const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
      if (payload.aud !== 'dev') throw new Error('not a dev token');
      return { sub: payload.sub, name: payload.name, email: payload.email };
    },
  },
  fetch,
  resolveHost: async (host) => {
    const { lookup } = await import('node:dns/promises');
    return (await lookup(host, { all: true })).map((a) => a.address);
  },
  startExport: async (hid, jobId) => {
    const { runExport } = await import('../services/exporter');
    setTimeout(() => runExport(deps, hid, jobId).catch(console.error), 500);
  },
};

const root = new Hono();
root.post('/dev-upload', async (c) => {
  const form = await c.req.formData();
  const file = form.get('file');
  const key = String(form.get('key'));
  if (!(file instanceof Blob)) return c.text('missing file', 400);
  storage.files.set(key, { body: new Uint8Array(await file.arrayBuffer()), type: file.type || 'image/jpeg' });
  return c.body(null, 204);
});
root.get('/dev-files/*', (c) => {
  const key = c.req.path.replace('/dev-files/', '');
  const f = storage.files.get(key);
  return f ? c.body(f.body as unknown as ArrayBuffer, 200, { 'content-type': f.type }) : c.text('not found', 404);
});
root.post('/dev-token', async (c) => {
  const { sub, name } = await c.req.json<{ sub: string; name: string }>();
  return c.json({ token: devToken(sub, name) });
});
root.route('/', createApp(deps));

if (process.env.SEED) await seedDemo(deps);

serve({ fetch: root.fetch, port: PORT }, () => {
  console.log(`Pobe Coins dev API on ${origin}`);
  if (process.env.SEED) console.log('Demo household ready. Dev sign-in as "sam" (admin) or "alex".');
});
