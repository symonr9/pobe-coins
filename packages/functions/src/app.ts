import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { ZodError, type ZodType } from 'zod';
import * as S from '@pobe/core';
import type { Actor, Deps, Principal } from './context';
import { ApiError, toApiError } from './lib/errors';
import * as auth from './services/auth';
import * as households from './services/households';
import * as money from './services/money';
import * as tasks from './services/tasks';
import * as purchases from './services/purchases';
import * as misc from './services/misc';
import * as insights from './services/insights';
import * as calendar from './services/calendar';
import * as exporter from './services/exporter';
import { fetchPreview } from './services/preview';
import { auditOp, getHousehold, listByPrefix, listMembers } from './repo';

type Env = { Variables: { principal: Principal; actor: Actor | null } };

async function body<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let json: unknown = {};
  try {
    const text = await c.req.text();
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError('BAD_REQUEST', "The request body isn't valid JSON.");
  }
  return schema.parse(json);
}

function clientIp(c: Context) {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
}

export function createApp(deps: Deps) {
  const app = new Hono<Env>();

  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return origin;
        const allowed = [deps.config.webOrigin, 'http://localhost:8081', 'http://localhost:19006'];
        return allowed.includes(origin) ? origin : null;
      },
      allowHeaders: ['authorization', 'content-type', 'x-household-id'],
      exposeHeaders: ['x-refreshed-token'],
      maxAge: 86400,
    }),
  );

  app.onError((err, c) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const field = first?.path.join('.');
      return c.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: first ? `${field ? `${field}: ` : ''}${first.message}` : 'Invalid request.',
            details: err.issues,
          },
        },
        400,
      );
    }
    const api = toApiError(err);
    if (api) return c.json({ error: { code: api.code, message: api.message, details: api.details } }, api.status as 400);
    console.error(err);
    return c.json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } }, 500);
  });

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: "That endpoint doesn't exist." } }, 404));

  // ---------- public ----------

  app.get('/health', (c) => c.json({ ok: true, stage: deps.config.stage }));

  app.post('/links/redeem', async (c) => {
    await misc.rateLimit(deps, `redeem:${clientIp(c)}`, 10, 60);
    const input = await body(c, S.redeemDeviceLinkSchema);
    return c.json(await auth.redeemDeviceLink(deps, input.token, input.deviceLabel, input.platform));
  });

  app.post('/auth/exchange', async (c) => {
    await misc.rateLimit(deps, `exchange:${clientIp(c)}`, 20, 60);
    const { idToken } = await body(c, S.linkAccountSchema);
    return c.json(await auth.exchangeIdentity(deps, idToken));
  });

  app.get('/cal/:token', async (c) => {
    await misc.rateLimit(deps, `cal:${clientIp(c)}`, 60, 60);
    const ics = await calendar.renderCalendar(deps, c.req.param('token'));
    return c.body(ics, 200, { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'private, max-age=900' });
  });

  // ---------- authenticated ----------

  const authed = new Hono<Env>();
  authed.use('*', async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new ApiError('UNAUTHORIZED', 'Please sign in first.');
    const { principal, refreshToken } = await auth.authenticate(deps, token);
    c.set('principal', principal);
    c.set('actor', await auth.resolveActor(deps, principal, c.req.header('x-household-id') || undefined));
    await next();
    if (refreshToken) c.header('x-refreshed-token', refreshToken);
  });

  const actorOf = (c: Context<Env>): Actor => {
    const a = c.get('actor');
    if (!a) throw new ApiError('FORBIDDEN', 'Create or join a household first.');
    return a;
  };

  authed.get('/me', async (c) => {
    const actor = c.get('actor');
    const principal = c.get('principal');
    if (!actor) {
      return c.json({
        household: null,
        user: principal.kind === 'user' ? { sub: principal.sub, email: principal.email, name: principal.name } : null,
        households: principal.kind === 'user' ? await auth.userHouseholds(deps, principal.sub) : [],
      });
    }
    return c.json(await auth.sessionFor(deps, actor));
  });

  authed.delete('/me', async (c) => {
    const principal = c.get('principal');
    return c.json(await households.deleteAccount(deps, c.get('actor'), principal.kind === 'user' ? principal.sub : undefined));
  });

  authed.post('/me/link-account', async (c) => {
    const { idToken } = await body(c, S.linkAccountSchema);
    return c.json(await auth.linkAccount(deps, actorOf(c), idToken));
  });

  authed.post('/me/equip', async (c) => c.json(await purchases.equip(deps, actorOf(c), await body(c, S.equipSchema))));

  // Households
  authed.post('/households', async (c) => {
    const principal = c.get('principal');
    if (principal.kind !== 'user') throw new ApiError('FORBIDDEN', 'Sign in with Google or Apple to create a household.');
    const input = await body(c, S.createHouseholdSchema);
    return c.json(await households.createHousehold(deps, { sub: principal.sub, name: principal.name }, input), 201);
  });
  authed.patch('/household', async (c) =>
    c.json(await households.updateHousehold(deps, actorOf(c), await body(c, S.updateHouseholdSchema))),
  );
  authed.delete('/household', async (c) => {
    await households.deleteHousehold(deps, actorOf(c));
    return c.json({ deleted: true });
  });

  // Members
  authed.get('/members', async (c) => {
    const actor = actorOf(c);
    const [household, members] = await Promise.all([getHousehold(deps, actor.householdId), listMembers(deps, actor.householdId)]);
    const open = household.settings.visibility === 'full' || actor.role === 'admin';
    return c.json(members.map((m) => (open || m.id === actor.memberId ? m : { ...m, purse: {}, debt: 0 })));
  });
  authed.post('/members', async (c) => c.json(await households.addMember(deps, actorOf(c), await body(c, S.memberSchema)), 201));
  authed.patch('/members/:id', async (c) =>
    c.json(await households.updateMember(deps, actorOf(c), c.req.param('id'), await body(c, S.updateMemberSchema))),
  );
  authed.delete('/members/:id', async (c) => c.json(await households.removeMember(deps, actorOf(c), c.req.param('id'))));

  // Join links & devices
  authed.post('/links', async (c) => {
    const input = await body(c, S.createDeviceLinkSchema);
    return c.json(await auth.createDeviceLink(deps, actorOf(c), input.memberId, input.expiresInHours), 201);
  });
  authed.get('/links', async (c) => c.json(await auth.listDeviceLinks(deps, actorOf(c))));
  authed.delete('/links/:id', async (c) => {
    await auth.deleteDeviceLink(deps, actorOf(c), c.req.param('id'));
    return c.json({ deleted: true });
  });
  authed.get('/devices', async (c) => c.json(await auth.listDevices(deps, actorOf(c))));
  authed.delete('/devices/:id', async (c) => {
    await auth.revokeDevice(deps, actorOf(c), c.req.param('id'));
    return c.json({ revoked: true });
  });

  // Tasks
  authed.get('/tasks', async (c) => c.json(await tasks.listTaskViews(deps, actorOf(c))));
  authed.post('/tasks', async (c) => c.json(await tasks.createTask(deps, actorOf(c), await body(c, S.taskSchema)), 201));
  authed.patch('/tasks/:id', async (c) =>
    c.json(await tasks.updateTask(deps, actorOf(c), c.req.param('id'), await body(c, S.updateTaskSchema))),
  );
  authed.delete('/tasks/:id', async (c) => c.json(await tasks.archiveTask(deps, actorOf(c), c.req.param('id'))));
  authed.post('/tasks/:id/claim', async (c) => c.json(await tasks.claimTask(deps, actorOf(c), c.req.param('id'), true)));
  authed.post('/tasks/:id/release', async (c) => c.json(await tasks.claimTask(deps, actorOf(c), c.req.param('id'), false)));
  authed.post('/tasks/:id/rotate', async (c) => {
    const { by } = await body(c, S.rotateSchema);
    return c.json(await tasks.shiftRotation(deps, actorOf(c), c.req.param('id'), by));
  });
  authed.post('/tasks/:id/complete', async (c) =>
    c.json(await tasks.completeTask(deps, actorOf(c), c.req.param('id'), await body(c, S.completeTaskSchema))),
  );

  // Approvals
  authed.get('/approvals', async (c) => {
    const actor = actorOf(c);
    const [completions, purchaseList] = await Promise.all([
      tasks.listPendingApprovals(deps, actor),
      listByPrefix<S.Purchase>(deps, actor.householdId, 'P#', true, 200),
    ]);
    return c.json({ completions, purchases: purchaseList.filter((p) => p.status === 'pending' && p.memberId !== actor.memberId) });
  });
  authed.post('/completions/:id/decide', async (c) => {
    const d = await body(c, S.decisionSchema);
    return c.json(await tasks.decideCompletion(deps, actorOf(c), c.req.param('id'), d.approve, d.note));
  });
  authed.post('/completions/:id/undo', async (c) => c.json(await tasks.undoCompletion(deps, actorOf(c), c.req.param('id'))));

  // Purchases
  authed.post('/purchases', async (c) => c.json(await purchases.createPurchase(deps, actorOf(c), await body(c, S.purchaseSchema)), 201));
  authed.get('/purchases/:id', async (c) => c.json(await purchases.purchaseDetail(deps, actorOf(c), c.req.param('id'))));
  authed.post('/purchases/:id/decide', async (c) => {
    const d = await body(c, S.decisionSchema);
    return c.json(await purchases.decidePurchase(deps, actorOf(c), c.req.param('id'), d.approve));
  });
  authed.post('/purchases/:id/undo', async (c) => c.json(await purchases.undoPurchase(deps, actorOf(c), c.req.param('id'))));
  authed.post('/purchases/:id/fulfill', async (c) => c.json(await purchases.fulfillReward(deps, actorOf(c), c.req.param('id'))));

  // POBE Shop
  authed.get('/shop', async (c) => c.json(await purchases.listShop(deps, actorOf(c))));
  authed.post('/shop/items', async (c) => c.json(await purchases.createShopItem(deps, actorOf(c), await body(c, S.shopItemSchema)), 201));
  authed.patch('/shop/items/:id', async (c) =>
    c.json(await purchases.updateShopItem(deps, actorOf(c), c.req.param('id'), await body(c, S.shopItemSchema.partial()))),
  );
  authed.delete('/shop/items/:id', async (c) => {
    await purchases.deleteShopItem(deps, actorOf(c), c.req.param('id'));
    return c.json({ deleted: true });
  });
  authed.post('/shop/items/:id/buy', async (c) => {
    const { allowIou } = await body(c, S.buyShopItemSchema);
    return c.json(await purchases.buyShopItem(deps, actorOf(c), c.req.param('id'), allowIou), 201);
  });
  authed.post('/shop/cosmetics/buy', async (c) => {
    const { cosmeticId } = await body(c, S.buyCosmeticSchema);
    return c.json(await purchases.buyCosmetic(deps, actorOf(c), cosmeticId), 201);
  });

  // Wishlist goals
  authed.get('/goals', async (c) => c.json(await purchases.listGoals(deps, actorOf(c))));
  authed.post('/goals', async (c) => c.json(await purchases.createGoal(deps, actorOf(c), await body(c, S.goalSchema)), 201));
  authed.post('/goals/:id/contribute', async (c) => {
    const { amount } = await body(c, S.contributeSchema);
    return c.json(await purchases.contributeToGoal(deps, actorOf(c), c.req.param('id'), amount));
  });
  authed.post('/goals/:id/buy', async (c) => {
    const { allowIou } = await body(c, S.buyShopItemSchema);
    return c.json(await purchases.buyGoal(deps, actorOf(c), c.req.param('id'), allowIou));
  });
  authed.post('/goals/:id/cancel', async (c) => c.json(await purchases.cancelGoal(deps, actorOf(c), c.req.param('id'))));

  // Gifts, bonuses, corrections
  authed.post('/gifts', async (c) => {
    const g = await body(c, S.giftSchema);
    const actor = actorOf(c);
    const r = await money.gift(deps, actor, g.toMemberId, g.amount, g.message);
    await deps.notifier.send(actor.householdId, [g.toMemberId], {
      title: 'You got a gift!',
      body: `${r.from.name} sent you ${g.amount} coins${g.message ? `: "${g.message}"` : '.'}`,
      url: '/timeline',
    });
    return c.json(r, 201);
  });
  authed.post('/bonuses', async (c) => {
    const actor = actorOf(c);
    auth.requireAdmin(actor);
    const b = await body(c, S.bonusSchema);
    const r = await money.grantBonus(deps, actor, b.memberId, b.amount, b.reason);
    await deps.db.transact([auditOp(deps, actor, 'bonus', b.memberId, { amount: b.amount, reason: b.reason })]);
    await deps.notifier.send(actor.householdId, [b.memberId], {
      title: 'Bonus coins!',
      body: `+${b.amount}: ${b.reason}`,
      url: '/timeline',
    });
    await tasks.afterEarn(deps, { ...actor, memberId: b.memberId }, b.amount);
    return c.json(r, 201);
  });
  authed.post('/corrections', async (c) => {
    const actor = actorOf(c);
    auth.requireAdmin(actor);
    const b = await body(c, S.correctionSchema);
    const r = await money.correct(deps, actor, b.memberId, b.delta, b.reason);
    await deps.db.transact([auditOp(deps, actor, 'correction', b.memberId, { delta: b.delta, reason: b.reason })]);
    return c.json(r, 201);
  });

  // Challenges
  authed.get('/challenges', async (c) => c.json(await tasks.listChallenges(deps, actorOf(c))));
  authed.post('/challenges', async (c) => c.json(await tasks.createChallenge(deps, actorOf(c), await body(c, S.challengeSchema)), 201));
  authed.delete('/challenges/:id', async (c) => {
    await tasks.deleteChallenge(deps, actorOf(c), c.req.param('id'));
    return c.json({ deleted: true });
  });

  // Social
  authed.get('/items/:id/social', async (c) => c.json(await misc.listSocial(deps, actorOf(c), c.req.param('id'))));
  authed.put('/items/:id/reaction', async (c) => {
    const { emoji } = await body(c, S.reactionSchema);
    return c.json(await misc.react(deps, actorOf(c), c.req.param('id'), emoji));
  });
  authed.delete('/items/:id/reaction', async (c) => c.json(await misc.react(deps, actorOf(c), c.req.param('id'), null)));
  authed.post('/items/:id/comments', async (c) => {
    const { text, ownerId } = await body(c, S.commentSchema.extend({ ownerId: S.idSchema.optional() }));
    return c.json(await misc.addComment(deps, actorOf(c), c.req.param('id'), text, ownerId), 201);
  });
  authed.delete('/items/:id/comments/:cid', async (c) => {
    await misc.deleteComment(deps, actorOf(c), c.req.param('id'), c.req.param('cid'));
    return c.json({ deleted: true });
  });

  // Insights
  authed.get('/timeline', async (c) =>
    c.json(
      await insights.timeline(deps, actorOf(c), {
        memberId: c.req.query('memberId') || undefined,
        cursor: c.req.query('cursor') || undefined,
        limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      }),
    ),
  );
  authed.get('/stats', async (c) =>
    c.json(
      await insights.stats(deps, actorOf(c), {
        memberId: c.req.query('memberId') || undefined,
        weeks: c.req.query('weeks') ? Number(c.req.query('weeks')) : undefined,
      }),
    ),
  );
  authed.get('/wrapped/:period', async (c) =>
    c.json(await insights.wrappedRecap(deps, actorOf(c), c.req.param('period'), c.req.query('memberId') || undefined)),
  );
  authed.get('/widget', async (c) => c.json(await insights.widget(deps, actorOf(c))));
  authed.get('/audit', async (c) => c.json(await misc.listAudit(deps, actorOf(c))));

  // Uploads & link previews
  authed.post('/uploads', async (c) => c.json(await misc.createUpload(deps, actorOf(c), await body(c, S.uploadSchema)), 201));
  authed.post('/link-preview', async (c) => {
    const actor = actorOf(c);
    await misc.rateLimit(deps, `preview:${actor.memberId}`, 30, 60);
    const { url } = await body(c, S.linkPreviewSchema);
    return c.json(await fetchPreview(deps, url));
  });

  // Push
  authed.post('/push', async (c) => {
    await misc.registerPush(deps, actorOf(c), await body(c, S.pushRegisterSchema));
    return c.json({ registered: true }, 201);
  });
  authed.delete('/push', async (c) => {
    const { token } = await body(c, S.pushUnregisterSchema);
    await misc.unregisterPush(deps, actorOf(c), token);
    return c.json({ removed: true });
  });

  // Calendar feed & export
  authed.post('/calendar', async (c) => c.json(await calendar.createCalendarFeed(deps, actorOf(c), new URL(c.req.url).origin), 201));
  authed.delete('/calendar', async (c) => {
    await calendar.revokeCalendarFeed(deps, actorOf(c));
    return c.json({ removed: true });
  });
  authed.post('/export', async (c) => {
    const actor = actorOf(c);
    auth.requireAdmin(actor);
    return c.json(await exporter.requestExport(deps, actor), 202);
  });
  authed.get('/export/:id', async (c) => c.json(await exporter.exportStatus(deps, actorOf(c), c.req.param('id'))));

  app.route('/', authed);
  return app;
}
