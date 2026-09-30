import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createHarness, household } from '../testing/harness';
import { isPrivateAddress, parseOpenGraph } from '../services/preview';
import { runExport } from '../services/exporter';
import { runHourly } from '../services/jobs';

const html = (title: string) =>
  new Response(
    `<html><head><title>x</title><meta property="og:title" content="${title}"><meta property="og:image" content="/img.jpg"><meta property="og:site_name" content="Example Shop"></head></html>`,
    { headers: { 'content-type': 'text/html' } },
  );

describe('link previews (SSRF guard)', () => {
  it('classifies private addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1',
    ])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::1111']) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it('parses Open Graph tags', () => {
    const p = parseOpenGraph(
      '<meta property="og:title" content="Cozy &amp; Warm Blanket"><meta name="description" content="Soft">',
      'https://shop.example.com/p/1',
    );
    expect(p).toMatchObject({ title: 'Cozy & Warm Blanket', description: 'Soft', siteName: 'shop.example.com' });
  });

  it('previews public pages and caches them', async () => {
    const h = createHarness();
    const { memberToken } = await household(h);
    h.pages.set('https://shop.example.com/item', () => html('Blanket'));
    const r = await h.call('POST', '/link-preview', { token: memberToken, body: { url: 'https://shop.example.com/item' } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ title: 'Blanket', image: 'https://shop.example.com/img.jpg', siteName: 'Example Shop' });
    h.pages.delete('https://shop.example.com/item');
    expect((await h.call('POST', '/link-preview', { token: memberToken, body: { url: 'https://shop.example.com/item' } })).body.title).toBe(
      'Blanket',
    );
  });

  it('refuses private hosts, odd ports and redirects into the network', async () => {
    const h = createHarness();
    const { memberToken } = await household(h);
    h.dns.set('internal.example.com', ['10.0.0.5']);
    for (const url of [
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data',
      'https://internal.example.com/',
      'https://shop.example.com:8443/',
      'http://[::1]/',
    ]) {
      const r = await h.call('POST', '/link-preview', { token: memberToken, body: { url } });
      expect(r.status, url).toBe(400);
    }
    h.pages.set(
      'https://shop.example.com/redirect',
      () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }),
    );
    const r = await h.call('POST', '/link-preview', { token: memberToken, body: { url: 'https://shop.example.com/redirect' } });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/can't be previewed/);
    expect((await h.call('POST', '/link-preview', { token: memberToken, body: { url: 'file:///etc/passwd' } })).status).toBe(400);
  });

  it('purchases keep going when a preview fails', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId, amount: 20, reason: 'x' } });
    const r = await h.call('POST', '/purchases', {
      token: memberToken,
      body: { title: 'Mug', amount: 10, url: 'https://gone.example.com/x' },
    });
    expect(r.status).toBe(201);
    expect(r.body.purchase.preview).toEqual({ url: 'https://gone.example.com/x' });
  });
});

describe('timeline and privacy', () => {
  it('shows history newest first with pending items and reactions', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId, amount: 200, reason: 'x' } });
    const p = await h.call('POST', '/purchases', { token: memberToken, body: { title: 'Lamp', amount: 150, photoKeys: [] } });
    await h.call('POST', '/purchases', { token: memberToken, body: { title: 'Tea', amount: 5 } });
    const t = await h.call('GET', '/timeline', { token: adminToken });
    expect(t.body.items[0].entry.label).toBe('Tea');
    expect(t.body.pending.map((x: any) => x.purchase?.id)).toContain(p.body.purchase.id);
    const itemId = t.body.items[0].entry.id;
    await h.call('PUT', `/items/${itemId}/reaction`, { token: adminToken, body: { emoji: '💖' } });
    await h.call('POST', `/items/${itemId}/comments`, { token: adminToken, body: { text: 'Enjoy!', ownerId: memberId } });
    const t2 = await h.call('GET', '/timeline', { token: memberToken });
    expect(t2.body.items[0].reactions).toEqual([{ memberId: expect.any(String), emoji: '💖' }]);
    expect(t2.body.items[0].comments).toBe(1);
  });

  it("balances-only households hide other members' purchase details", async () => {
    const h = createHarness();
    const { adminToken, memberToken, adminId, memberId } = await household(h);
    await h.call('PATCH', '/household', { token: adminToken, body: { settings: { visibility: 'balances' } } });
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId: adminId, amount: 50, reason: 'x' } });
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId, amount: 50, reason: 'x' } });
    const buy = await h.call('POST', '/purchases', { token: adminToken, body: { title: 'Secret gift', amount: 20 } });
    const t = await h.call('GET', '/timeline', { token: memberToken });
    const spend = t.body.items.find((i: any) => i.entry.kind === 'SPEND');
    expect(spend.entry.label).toBe('Private');
    expect((await h.call('GET', `/purchases/${buy.body.purchase.id}`, { token: memberToken })).status).toBe(403);
    const members = await h.call('GET', '/members', { token: memberToken });
    expect(members.body.find((m: any) => m.id === adminId).purse).toEqual({});
  });

  it('stats, leaderboard and Wrapped', async () => {
    const h = createHarness('2026-06-10T12:00:00Z');
    const { adminToken, memberToken, memberId } = await household(h);
    await h.call('PATCH', '/household', { token: adminToken, body: { settings: { leaderboardEnabled: true } } });
    const id = (await h.call('POST', '/tasks', { token: adminToken, body: { title: 'Vacuum', reward: 15, assigneeId: memberId } })).body.id;
    await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} });
    const s = await h.call('GET', '/stats?weeks=4', { token: memberToken });
    expect(s.body.series).toHaveLength(4);
    expect(s.body.series.at(-1).earned).toBe(15);
    expect(s.body.topChores[0]).toEqual({ label: 'Vacuum', count: 1, coins: 15 });
    expect(s.body.leaderboard.thisWeek[0].memberId).toBe(memberId);
    const w = await h.call('GET', '/wrapped/2026-06', { token: memberToken });
    expect(w.body).toMatchObject({ earned: 15, completions: 1 });
    const widget = await h.call('GET', '/widget', { token: memberToken });
    expect(widget.body).toMatchObject({ name: 'Alex', balance: 15 });
    expect(widget.body.line.length).toBeGreaterThan(5);
  });
});

describe('calendar feed', () => {
  it('serves a private ICS with recurring rules, and can be turned off', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await h.call('POST', '/tasks', {
      token: adminToken,
      body: {
        title: 'Water plants',
        reward: 5,
        assigneeId: memberId,
        recurrence: { freq: 'weekly', byWeekday: [1, 4], anchor: '2026-06-01', dueTime: '18:00' },
      },
    });
    const feed = await h.call('POST', '/calendar', { token: memberToken });
    const path = new URL(feed.body.url).pathname;
    const ics = await h.call('GET', path);
    expect(ics.status).toBe(200);
    expect(ics.body).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TH');
    expect(ics.body).toContain('DTSTART;TZID=UTC:20260601T180000');
    await h.call('DELETE', '/calendar', { token: memberToken });
    expect((await h.call('GET', path)).status).toBe(404);
  });
});

describe('uploads', () => {
  it('scopes keys to the household and enforces the storage quota', async () => {
    const h = createHarness();
    const { memberToken, hid } = await household(h);
    const r = await h.call('POST', '/uploads', {
      token: memberToken,
      body: { contentType: 'image/jpeg', bytes: 200_000, purpose: 'purchase' },
    });
    expect(r.status).toBe(201);
    expect(r.body.key).toMatch(new RegExp(`^h/${hid}/purchase/`));
    expect(
      (await h.call('POST', '/uploads', { token: memberToken, body: { contentType: 'image/gif', bytes: 10, purpose: 'purchase' } })).status,
    ).toBe(400);
    const bad = await h.call('POST', '/purchases', {
      token: memberToken,
      body: { title: 'x', amount: 1, photoKeys: ['h/other/purchase/x.jpg'] },
    });
    expect(bad.status).toBe(400);
  });
});

describe('export', () => {
  it('bundles records, ledger CSV and photos', async () => {
    const h = createHarness();
    const { adminToken, memberId, hid } = await household(h);
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId, amount: 30, reason: 'hello, "friend"' } });
    h.storage.objects.set(`h/${hid}/purchase/a.jpg`, new Uint8Array([1, 2, 3]));
    await h.call('POST', '/purchases', {
      token: adminToken,
      body: { title: 'x', amount: 0 + 1, photoKeys: [`h/${hid}/purchase/a.jpg`], allowIou: true },
    });
    const job = await h.call('POST', '/export', { token: adminToken });
    expect(job.status).toBe(202);
    expect(h.exports).toHaveLength(1);
    await runExport(h.deps, hid, job.body.id);
    const status = await h.call('GET', `/export/${job.body.id}`, { token: adminToken });
    expect(status.body.status).toBe('ready');
    const zip = unzipSync(h.storage.objects.get(status.body.key)!);
    expect(Object.keys(zip)).toEqual(
      expect.arrayContaining(['ledger.csv', 'data/member.json', 'data/ledger.json', 'photos/purchase/a.jpg']),
    );
    expect(strFromU8(zip['ledger.csv']!)).toContain('"Bonus: hello, ""friend"""');
  });
});

describe('hourly job', () => {
  it('sends due-soon reminders once', async () => {
    const h = createHarness('2026-06-01T17:30:00Z');
    const { adminToken, memberId } = await household(h);
    await h.call('POST', '/tasks', {
      token: adminToken,
      body: { title: 'Take meds', reward: 1, assigneeId: memberId, recurrence: { freq: 'daily', anchor: '2026-06-01', dueTime: '18:00' } },
    });
    const before = h.notifier.sent.length;
    await runHourly(h.deps);
    await runHourly(h.deps);
    const sent = h.notifier.sent.slice(before);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ memberIds: [memberId], message: { title: 'Due soon' } });
  });

  it('expires challenges and announces Wrapped on the 1st', async () => {
    const h = createHarness('2026-06-30T12:00:00Z');
    const { adminToken } = await household(h);
    await h.call('POST', '/challenges', {
      token: adminToken,
      body: { title: 'Week', target: 999, bonus: 5, startsAt: '2026-06-24T00:00:00Z', endsAt: '2026-07-01T00:00:00Z' },
    });
    h.setNow('2026-07-01T09:10:00Z');
    await runHourly(h.deps);
    expect((await h.call('GET', '/challenges', { token: adminToken })).body[0].status).toBe('expired');
    expect(h.notifier.sent.some((s) => s.message.title === 'Your June Pobe Wrapped is ready')).toBe(true);
  });
});
