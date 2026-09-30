import { describe, expect, it } from 'vitest';
import { balance } from '@pobe/core';
import { createHarness, household, ledgerMismatches, type Harness } from '../testing/harness';

async function purse(h: Harness, token: string) {
  const me = await h.call('GET', '/me', { token });
  return {
    purse: me.body.member.purse as Record<string, number>,
    debt: me.body.member.debt as number,
    balance: balance(me.body.member.purse),
  };
}

async function newTask(h: Harness, token: string, body: Record<string, unknown>) {
  const r = await h.call('POST', '/tasks', { token, body: { title: 'Dishes', reward: 30, ...body } });
  expect(r.status).toBe(201);
  return r.body.id as string;
}

describe('chores', () => {
  it('pays out coins when a chore is done', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    const id = await newTask(h, adminToken, { assigneeId: memberId });
    const r = await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} });
    expect(r.status).toBe(200);
    expect(r.body.completion.status).toBe('approved');
    const p = await purse(h, memberToken);
    expect(p.purse).toEqual({ 25: 1, 5: 1 });
    // One-off: can't be done twice.
    expect((await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} })).status).toBe(409);
  });

  it('respects assignment', async () => {
    const h = createHarness();
    const { adminToken, memberToken, adminId } = await household(h);
    const id = await newTask(h, adminToken, { assigneeId: adminId });
    const r = await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} });
    expect(r.status).toBe(403);
    expect(r.body.error.message).toMatch(/Sam's turn/);
  });

  it('pool tasks can be claimed by one person', async () => {
    const h = createHarness();
    const { adminToken, memberToken } = await household(h);
    const id = await newTask(h, adminToken, {});
    expect((await h.call('POST', `/tasks/${id}/claim`, { token: memberToken })).status).toBe(200);
    const r = await h.call('POST', `/tasks/${id}/claim`, { token: adminToken });
    expect(r.status).toBe(409);
    expect(r.body.error.message).toMatch(/Alex already claimed/);
    expect((await h.call('POST', `/tasks/${id}/complete`, { token: adminToken, body: {} })).status).toBe(403);
    expect((await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} })).status).toBe(200);
  });

  it('approval flow pays exactly once, even with simultaneous approvals', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    // A third member so two people can approve at once.
    const third = await h.call('POST', '/members', { token: adminToken, body: { name: 'Kid', role: 'admin' } });
    const link = await h.call('POST', '/links', { token: adminToken, body: { memberId: third.body.id } });
    const kidToken = (await h.call('POST', '/links/redeem', { body: { token: link.body.token } })).body.token;
    const id = await newTask(h, adminToken, { assigneeId: memberId, requiresApproval: true });
    const done = await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} });
    expect(done.body.completion.status).toBe('pending');
    expect((await purse(h, memberToken)).balance).toBe(0);
    expect(h.notifier.sent.at(-1)!.message.category).toBe('approval');
    const cid = done.body.completion.id;
    expect((await h.call('POST', `/completions/${cid}/decide`, { token: memberToken, body: { approve: true } })).status).toBe(403);
    const both = await Promise.all([
      h.call('POST', `/completions/${cid}/decide`, { token: adminToken, body: { approve: true } }),
      h.call('POST', `/completions/${cid}/decide`, { token: kidToken, body: { approve: true } }),
    ]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await purse(h, memberToken)).balance).toBe(30);
  });

  it('rejection pays nothing and reopens the task', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    const id = await newTask(h, adminToken, { assigneeId: memberId, requiresApproval: true });
    const done = await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} });
    await h.call('POST', `/completions/${done.body.completion.id}/decide`, { token: adminToken, body: { approve: false } });
    expect((await purse(h, memberToken)).balance).toBe(0);
    const again = await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} });
    expect(again.status).toBe(200);
  });

  it('undo returns the coins within the window only', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    const a = await newTask(h, adminToken, { assigneeId: memberId });
    const b = await newTask(h, adminToken, { assigneeId: memberId, title: 'Trash' });
    const da = await h.call('POST', `/tasks/${a}/complete`, { token: memberToken, body: {} });
    const undo = await h.call('POST', `/completions/${da.body.completion.id}/undo`, { token: memberToken });
    expect(undo.status).toBe(200);
    expect((await purse(h, memberToken)).balance).toBe(0);
    expect((await h.call('POST', `/tasks/${a}/complete`, { token: memberToken, body: {} })).status).toBe(200);
    const db = await h.call('POST', `/tasks/${b}/complete`, { token: memberToken, body: {} });
    h.advance(10 * 60_000);
    const late = await h.call('POST', `/completions/${db.body.completion.id}/undo`, { token: memberToken });
    expect(late.status).toBe(409);
    expect(late.body.error.message).toMatch(/5 minutes/);
  });

  it('recurring chores: once per period, streaks and milestone bonuses', async () => {
    const h = createHarness('2026-06-01T15:00:00Z');
    const { adminToken, memberToken, memberId } = await household(h);
    const id = await newTask(h, adminToken, {
      title: 'Walk the dog',
      reward: 10,
      assigneeId: memberId,
      recurrence: { freq: 'daily', anchor: '2026-06-01' },
      streakRule: { every: 3, bonus: 5 },
    });
    expect((await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} })).status).toBe(200);
    const dup = await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} });
    expect(dup.status).toBe(409);
    h.advance(86400_000);
    await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} });
    h.advance(86400_000);
    const third = await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} });
    expect(third.body.milestone).toEqual({ streak: 3, bonus: 5 });
    expect((await purse(h, memberToken)).balance).toBe(35);
    const tasks = await h.call('GET', '/tasks', { token: memberToken });
    const t = tasks.body.find((x: any) => x.id === id);
    expect(t.doneThisPeriod).toBe(true);
    expect(t.streak).toEqual({ current: 3, best: 3 });
  });

  it('rotation alternates whose turn it is', async () => {
    const h = createHarness('2026-06-01T15:00:00Z');
    const { adminToken, memberToken, adminId, memberId } = await household(h);
    const id = await newTask(h, adminToken, {
      title: 'Trash',
      recurrence: { freq: 'daily', anchor: '2026-06-01' },
      rotation: [adminId, memberId],
    });
    expect((await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} })).status).toBe(403);
    expect((await h.call('POST', `/tasks/${id}/complete`, { token: adminToken, body: {} })).status).toBe(200);
    h.advance(86400_000);
    expect((await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: {} })).status).toBe(200);
  });

  it('checklist items can pay partial credit', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    const id = await newTask(h, adminToken, {
      title: 'Bathroom',
      reward: 25,
      assigneeId: memberId,
      partialCredit: true,
      checklist: [{ label: 'Toilet' }, { label: 'Sink' }, { label: 'Floor' }],
    });
    const task = (await h.call('GET', '/tasks', { token: memberToken })).body.find((t: any) => t.id === id);
    for (const item of task.checklist) {
      const r = await h.call('POST', `/tasks/${id}/complete`, { token: memberToken, body: { checklistItemId: item.id } });
      expect(r.status).toBe(200);
    }
    expect((await purse(h, memberToken)).balance).toBe(25);
    const after = (await h.call('GET', '/tasks', { token: memberToken })).body.find((t: any) => t.id === id);
    expect(after.status).toBe('done');
  });
});

describe('spending', () => {
  async function fund(h: Harness, adminToken: string, memberId: string, amount: number) {
    const r = await h.call('POST', '/bonuses', { token: adminToken, body: { memberId, amount, reason: 'test' } });
    expect(r.status).toBe(201);
  }

  it('makes change like a cash register', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await fund(h, adminToken, memberId, 25);
    const r = await h.call('POST', '/purchases', { token: memberToken, body: { title: 'Snack', amount: 20 } });
    expect(r.status).toBe(201);
    expect(r.body.entry.coinsOut).toEqual({ 25: 1 });
    expect(r.body.entry.coinsIn).toEqual({ 5: 1 });
    expect((await purse(h, memberToken)).purse).toEqual({ 5: 1 });
  });

  it('big purchases wait for approval with coins held; rejection refunds the same coins', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await fund(h, adminToken, memberId, 150);
    const r = await h.call('POST', '/purchases', { token: memberToken, body: { title: 'Headphones', amount: 120 } });
    expect(r.body.purchase.status).toBe('pending');
    expect((await purse(h, memberToken)).balance).toBe(30);
    const approvals = await h.call('GET', '/approvals', { token: adminToken });
    expect(approvals.body.purchases).toHaveLength(1);
    await h.call('POST', `/purchases/${r.body.purchase.id}/decide`, { token: adminToken, body: { approve: false } });
    expect((await purse(h, memberToken)).purse).toEqual({ 100: 1, 50: 1 });
  });

  it('IOUs: offers to borrow, records debt, earnings pay it back first', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await fund(h, adminToken, memberId, 10);
    const r = await h.call('POST', '/purchases', { token: memberToken, body: { title: 'Book', amount: 40 } });
    expect(r.status).toBe(422);
    expect(r.body.error.details).toEqual({ canBorrow: 30, balance: 10 });
    const ok = await h.call('POST', '/purchases', { token: memberToken, body: { title: 'Book', amount: 40, allowIou: true } });
    expect(ok.status).toBe(201);
    expect(await purse(h, memberToken)).toMatchObject({ balance: 0, debt: 30 });
    // Over the limit (default 50): 30 + 25 > 50
    expect((await h.call('POST', '/purchases', { token: memberToken, body: { title: 'More', amount: 25, allowIou: true } })).status).toBe(
      422,
    );
    await fund(h, adminToken, memberId, 35);
    expect(await purse(h, memberToken)).toMatchObject({ balance: 5, debt: 0 });
    const detail = await h.call('GET', `/purchases/${ok.body.purchase.id}`, { token: memberToken });
    expect(detail.body.fundedBy).toEqual([{ label: 'Bonus: test', amount: 40, count: 2, iou: false }]);
  });

  it('gifts move coins atomically', async () => {
    const h = createHarness();
    const { adminToken, memberToken, adminId, memberId } = await household(h);
    await fund(h, adminToken, adminId, 50);
    const g = await h.call('POST', '/gifts', { token: adminToken, body: { toMemberId: memberId, amount: 20, message: 'thanks!' } });
    expect(g.status).toBe(201);
    expect((await purse(h, adminToken)).balance).toBe(30);
    expect((await purse(h, memberToken)).balance).toBe(20);
    expect((await h.call('POST', '/gifts', { token: memberToken, body: { toMemberId: adminId, amount: 21 } })).status).toBe(422);
    expect((await h.call('POST', '/gifts', { token: memberToken, body: { toMemberId: memberId, amount: 1 } })).status).toBe(400);
  });

  it('admin corrections can go negative and are audited', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await fund(h, adminToken, memberId, 10);
    const r = await h.call('POST', '/corrections', { token: adminToken, body: { memberId, delta: -25, reason: 'double counted' } });
    expect(r.status).toBe(201);
    expect(await purse(h, memberToken)).toMatchObject({ balance: 0, debt: 15 });
    const audit = await h.call('GET', '/audit', { token: adminToken });
    expect(audit.body.map((a: any) => a.action)).toContain('correction');
    expect((await h.call('GET', '/audit', { token: memberToken })).status).toBe(403);
  });

  it('changing coin types re-mints purses without changing balances', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await fund(h, adminToken, memberId, 80);
    const r = await h.call('PATCH', '/household', { token: adminToken, body: { settings: { coinTypes: [1, 20] } } });
    expect(r.status).toBe(200);
    expect((await purse(h, memberToken)).purse).toEqual({ 20: 4 });
    expect((await h.call('PATCH', '/household', { token: adminToken, body: { settings: { coinTypes: [5, 20] } } })).status).toBe(400);
  });
});

describe('POBE Shop', () => {
  it('rewards: stock, cooldown, delivery', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId, amount: 200, reason: 'x' } });
    const item = await h.call('POST', '/shop/items', { token: adminToken, body: { title: 'Breakfast in bed', price: 50, stock: 1 } });
    const buy = await h.call('POST', `/shop/items/${item.body.id}/buy`, { token: memberToken, body: {} });
    expect(buy.status).toBe(201);
    expect(buy.body.purchase.redemption).toBe('redeemed');
    const again = await h.call('POST', `/shop/items/${item.body.id}/buy`, { token: memberToken, body: {} });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/Sold out/);
    const done = await h.call('POST', `/purchases/${buy.body.purchase.id}/fulfill`, { token: adminToken });
    expect(done.body.redemption).toBe('fulfilled');

    const movie = await h.call('POST', '/shop/items', {
      token: adminToken,
      body: { title: 'Pick the movie', price: 10, cooldownHours: 24 },
    });
    expect((await h.call('POST', `/shop/items/${movie.body.id}/buy`, { token: memberToken, body: {} })).status).toBe(201);
    const cd = await h.call('POST', `/shop/items/${movie.body.id}/buy`, { token: memberToken, body: {} });
    expect(cd.body.error.message).toMatch(/again in 24 hours/);
  });

  it('cosmetics: buy once, equip only what you own', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    expect((await h.call('POST', '/me/equip', { token: memberToken, body: { accessory: 'beanie' } })).status).toBe(403);
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId, amount: 100, reason: 'x' } });
    expect((await h.call('POST', '/shop/cosmetics/buy', { token: memberToken, body: { cosmeticId: 'acc-beanie' } })).status).toBe(201);
    expect((await h.call('POST', '/shop/cosmetics/buy', { token: memberToken, body: { cosmeticId: 'acc-beanie' } })).status).toBe(409);
    const eq = await h.call('POST', '/me/equip', { token: memberToken, body: { accessory: 'beanie' } });
    expect(eq.body.equipped.accessory).toBe('beanie');
    expect((await purse(h, memberToken)).balance).toBe(60);
  });
});

describe('wishlist goals', () => {
  it('shared goals collect contributions; cancelling refunds them', async () => {
    const h = createHarness();
    const { adminToken, memberToken, adminId, memberId } = await household(h);
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId: adminId, amount: 100, reason: 'x' } });
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId, amount: 100, reason: 'x' } });
    const goal = await h.call('POST', '/goals', { token: adminToken, body: { title: 'Picnic basket', target: 150, shared: true } });
    await h.call('POST', `/goals/${goal.body.id}/contribute`, { token: adminToken, body: { amount: 60 } });
    const c2 = await h.call('POST', `/goals/${goal.body.id}/contribute`, { token: memberToken, body: { amount: 100 } });
    expect(c2.body.contributed).toBe(90); // capped at what's left
    expect(c2.body.reached).toBe(true);
    const cancel = await h.call('POST', `/goals/${goal.body.id}/cancel`, { token: adminToken });
    expect(cancel.status).toBe(200);
    expect((await purse(h, adminToken)).balance).toBe(100);
    expect((await purse(h, memberToken)).balance).toBe(100);
  });

  it('personal goals buy from the purse', async () => {
    const h = createHarness();
    const { adminToken, memberToken, memberId } = await household(h);
    await h.call('POST', '/bonuses', { token: adminToken, body: { memberId, amount: 60, reason: 'x' } });
    const goal = await h.call('POST', '/goals', { token: memberToken, body: { title: 'Sketchbook', target: 40 } });
    const buy = await h.call('POST', `/goals/${goal.body.id}/buy`, { token: memberToken, body: {} });
    expect(buy.status).toBe(200);
    expect((await purse(h, memberToken)).balance).toBe(20);
    expect((await h.call('GET', '/goals', { token: memberToken })).body).toHaveLength(0);
  });
});

describe('co-op challenges', () => {
  it('pays everyone when the household hits the target', async () => {
    const h = createHarness('2026-06-01T15:00:00Z');
    const { adminToken, memberToken, memberId } = await household(h);
    await h.call('POST', '/challenges', {
      token: adminToken,
      body: { title: 'Spring clean', target: 50, bonus: 10, startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-06-08T00:00:00Z' },
    });
    const a = await newTask(h, adminToken, { assigneeId: memberId, reward: 30 });
    const b = await newTask(h, adminToken, { assigneeId: memberId, reward: 25, title: 'Laundry' });
    await h.call('POST', `/tasks/${a}/complete`, { token: memberToken, body: {} });
    await h.call('POST', `/tasks/${b}/complete`, { token: memberToken, body: {} });
    const ch = await h.call('GET', '/challenges', { token: adminToken });
    expect(ch.body[0].status).toBe('won');
    expect((await purse(h, memberToken)).balance).toBe(65);
    expect((await purse(h, adminToken)).balance).toBe(10);
  });
});

describe('ledger invariant', () => {
  it('replaying the ledger reproduces every purse and debt after a mixed day', async () => {
    const h = createHarness();
    const { hid, adminToken, adminId, memberToken, memberId } = await household(h);
    const bonus = (id: string, amount: number) =>
      h.call('POST', '/bonuses', { token: adminToken, body: { memberId: id, amount, reason: 'test' } });
    await bonus(memberId, 37);
    await bonus(adminId, 120);
    // Earn, then undo one.
    const t1 = await newTask(h, adminToken, { assigneeId: memberId, reward: 30 });
    const done = await h.call('POST', `/tasks/${t1}/complete`, { token: memberToken, body: {} });
    expect((await h.call('POST', `/completions/${done.body.completion.id}/undo`, { token: memberToken })).status).toBe(200);
    const t2 = await newTask(h, adminToken, { assigneeId: memberId, reward: 26 });
    await h.call('POST', `/tasks/${t2}/complete`, { token: memberToken, body: {} });
    // Spend with change, borrow on an IOU, get paid back.
    await h.call('POST', '/purchases', { token: memberToken, body: { title: 'Snack', amount: 18 } });
    expect((await h.call('POST', '/purchases', { token: memberToken, body: { title: 'Book', amount: 70, allowIou: true } })).status).toBe(
      201,
    );
    expect((await purse(h, memberToken)).debt).toBeGreaterThan(0);
    await bonus(memberId, 40);
    // A held purchase that gets rejected, and a gift both ways.
    const held = await h.call('POST', '/purchases', { token: adminToken, body: { title: 'Headphones', amount: 110 } });
    expect(held.body.purchase.status).toBe('pending');
    expect(
      (await h.call('POST', `/purchases/${held.body.purchase.id}/decide`, { token: memberToken, body: { approve: false } })).status,
    ).toBe(200);
    await h.call('POST', '/gifts', { token: adminToken, body: { toMemberId: memberId, amount: 15 } });
    await h.call('POST', '/gifts', { token: memberToken, body: { toMemberId: adminId, amount: 3 } });
    expect(await ledgerMismatches(h, hid)).toEqual([]);
  });
});
