import { describe, expect, it } from 'vitest';
import { createHarness, household, userToken } from '../testing/harness';

describe('households and sign-in', () => {
  it('creates a household with templates and a starter shop', async () => {
    const h = createHarness();
    const { adminToken } = await household(h, { templates: ['dishes', 'trash', 'bathroom'] });
    const me = await h.call('GET', '/me', { token: adminToken });
    expect(me.status).toBe(200);
    expect(me.body.household.name).toBe('Our Home');
    expect(me.body.member.role).toBe('admin');
    expect(me.body.members).toHaveLength(2);
    const tasks = await h.call('GET', '/tasks', { token: adminToken });
    expect(tasks.body.map((t: any) => t.title).sort()).toEqual(['Clean the bathroom', 'Do the dishes', 'Take out the trash']);
    expect(tasks.body.find((t: any) => t.title === 'Clean the bathroom').checklist).toHaveLength(4);
    const shop = await h.call('GET', '/shop', { token: adminToken });
    expect(shop.body.items.length).toBeGreaterThan(3);
    expect(shop.body.cosmetics.length).toBeGreaterThan(5);
  });

  it('a signed-in user without a household gets an empty session', async () => {
    const h = createHarness();
    const me = await h.call('GET', '/me', { token: userToken('new-user') });
    expect(me.status).toBe(200);
    expect(me.body.household).toBeNull();
    expect(me.body.households).toEqual([]);
  });

  it('rejects missing and garbage tokens', async () => {
    const h = createHarness();
    expect((await h.call('GET', '/me')).status).toBe(401);
    expect((await h.call('GET', '/me', { token: 'not-a-jwt' })).status).toBe(401);
  });

  it('limits households per user', async () => {
    const h = createHarness();
    const t = userToken('busy');
    for (let i = 0; i < 3; i++) {
      const r = await h.call('POST', '/households', { token: t, body: { name: `H${i}`, memberName: 'Me', timeZone: 'UTC' } });
      expect(r.status).toBe(201);
    }
    const r = await h.call('POST', '/households', { token: t, body: { name: 'H4', memberName: 'Me', timeZone: 'UTC' } });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('QUOTA');
  });

  it('device tokens cannot create households', async () => {
    const h = createHarness();
    const { memberToken } = await household(h);
    const r = await h.call('POST', '/households', { token: memberToken, body: { name: 'X', memberName: 'Y', timeZone: 'UTC' } });
    expect(r.status).toBe(403);
  });
});

describe('one-time device links', () => {
  it('works once', async () => {
    const h = createHarness();
    const { adminToken, memberId } = await household(h);
    const link = await h.call('POST', '/links', { token: adminToken, body: { memberId } });
    expect(link.body.url).toMatch(/^https:\/\/pobe\.example\.test\/join\//);
    const first = await h.call('POST', '/links/redeem', { body: { token: link.body.token } });
    expect(first.status).toBe(200);
    expect(first.body.session.member.id).toBe(memberId);
    const second = await h.call('POST', '/links/redeem', { body: { token: link.body.token } });
    expect(second.status).toBe(410);
    expect(second.body.error.message).toMatch(/already used/);
  });

  it('only one of two simultaneous redemptions wins', async () => {
    const h = createHarness();
    const { adminToken, memberId } = await household(h);
    const link = await h.call('POST', '/links', { token: adminToken, body: { memberId } });
    const results = await Promise.all([
      h.call('POST', '/links/redeem', { body: { token: link.body.token } }),
      h.call('POST', '/links/redeem', { body: { token: link.body.token } }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 410]);
  });

  it('expires', async () => {
    const h = createHarness();
    const { adminToken, memberId } = await household(h);
    const link = await h.call('POST', '/links', { token: adminToken, body: { memberId, expiresInHours: 1 } });
    h.advance(2 * 3600_000);
    const r = await h.call('POST', '/links/redeem', { body: { token: link.body.token } });
    expect(r.status).toBe(410);
    expect(r.body.error.message).toMatch(/expired/);
  });

  it('only admins create links', async () => {
    const h = createHarness();
    const { memberToken, memberId } = await household(h);
    const r = await h.call('POST', '/links', { token: memberToken, body: { memberId } });
    expect(r.status).toBe(403);
  });

  it('rate-limits redemption attempts per IP', async () => {
    const h = createHarness();
    let last;
    for (let i = 0; i < 11; i++) last = await h.call('POST', '/links/redeem', { body: { token: 'x'.repeat(40) }, ip: '198.51.100.7' });
    expect(last!.status).toBe(429);
  });

  it('revoked devices are signed out', async () => {
    const h = createHarness();
    const { adminToken, memberToken, deviceId } = await household(h);
    expect((await h.call('GET', '/me', { token: memberToken })).status).toBe(200);
    expect((await h.call('DELETE', `/devices/${deviceId}`, { token: adminToken })).status).toBe(200);
    const r = await h.call('GET', '/me', { token: memberToken });
    expect(r.status).toBe(401);
    expect(r.body.error.message).toMatch(/signed out/);
  });

  it('links a Google/Apple account to a device profile', async () => {
    const h = createHarness();
    const { memberToken, hid, memberId } = await household(h);
    const idToken = userToken('alex-google', 'Alex');
    const r = await h.call('POST', '/me/link-account', { token: memberToken, body: { idToken } });
    expect(r.status).toBe(200);
    const me = await h.call('GET', '/me', { token: idToken });
    expect(me.body.household.id).toBe(hid);
    expect(me.body.member.id).toBe(memberId);
  });
});

describe('household isolation', () => {
  it('keeps households apart', async () => {
    const h = createHarness();
    const a = await household(h, { sub: 'a-admin', templates: ['dishes'] });
    const b = await household(h, { sub: 'b-admin' });
    const aTasks = await h.call('GET', '/tasks', { token: a.adminToken });
    const taskId = aTasks.body[0].id;
    // B can't see or complete A's task.
    expect((await h.call('POST', `/tasks/${taskId}/complete`, { token: b.adminToken, body: {} })).status).toBe(404);
    expect((await h.call('POST', `/tasks/${taskId}/complete`, { token: b.memberToken, body: {} })).status).toBe(404);
    // B can't pick A's household with the header.
    expect((await h.call('GET', '/tasks', { token: b.adminToken, household: a.hid })).status).toBe(403);
    // B's member list doesn't include A's members.
    const bMembers = await h.call('GET', '/members', { token: b.adminToken });
    expect(bMembers.body.map((m: any) => m.id)).not.toContain(a.adminId);
    // Gifts can't target another household's member.
    expect((await h.call('POST', '/gifts', { token: b.adminToken, body: { toMemberId: a.memberId, amount: 1 } })).status).toBe(404);
  });
});

describe('account deletion', () => {
  it('the only admin must hand over first', async () => {
    const h = createHarness();
    const { adminToken } = await household(h);
    const r = await h.call('DELETE', '/me', { token: adminToken });
    expect(r.status).toBe(409);
  });

  it('a member can delete their profile; history stays', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId, amount: 10, reason: 'welcome' } });
    const r = await h.call('DELETE', '/me', { token: memberToken });
    expect(r.status).toBe(200);
    expect((await h.call('GET', '/me', { token: memberToken })).status).toBe(401);
    const timeline = await h.call('GET', '/timeline', { token: adminToken });
    expect(timeline.body.items.some((i: any) => i.entry.memberId === memberId)).toBe(true);
  });

  it('the last member deleting their account deletes the household', async () => {
    const h = createHarness();
    const t = userToken('solo');
    await h.call('POST', '/households', { token: t, body: { name: 'Solo', memberName: 'Me', timeZone: 'UTC' } });
    const r = await h.call('DELETE', '/me', { token: t });
    expect(r.status).toBe(200);
    const me = await h.call('GET', '/me', { token: t });
    expect(me.body.household).toBeNull();
  });
});

describe('federated identity ids', () => {
  it('maps Cognito federated users to provider ids', async () => {
    const { normalizeCognitoSub } = await import('../adapters/aws');
    expect(normalizeCognitoSub('c-1', [{ providerName: 'Google', providerType: 'Google', userId: '123' }])).toBe('google:123');
    expect(
      normalizeCognitoSub('c-1', JSON.stringify([{ providerName: 'SignInWithApple', providerType: 'SignInWithApple', userId: '001.abc' }])),
    ).toBe('apple:001.abc');
    expect(normalizeCognitoSub('c-1', undefined)).toBe('c-1');
  });
});

describe('session exchange', () => {
  it('exchanges a provider token for an app session that refreshes', async () => {
    const h = createHarness();
    const ex = await h.call('POST', '/auth/exchange', { body: { idToken: userToken('ex-user', 'Robin') } });
    expect(ex.status).toBe(200);
    expect(ex.body.user.sub).toBe('ex-user');
    const created = await h.call('POST', '/households', {
      token: ex.body.token,
      body: { name: 'H', memberName: 'Robin', timeZone: 'UTC' },
    });
    expect(created.status).toBe(201);
    h.advance(8 * 86400_000);
    const me = await h.call('GET', '/me', { token: ex.body.token });
    expect(me.status).toBe(200);
    expect(me.headers.get('x-refreshed-token')).toBeTruthy();
    h.advance(70 * 86400_000);
    expect((await h.call('GET', '/me', { token: ex.body.token })).status).toBe(401);
    expect((await h.call('POST', '/auth/exchange', { body: { idToken: 'garbage.token.here.and.more.garbage' } })).status).toBe(401);
  });
});
