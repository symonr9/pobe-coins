---
name: api-endpoint
description: Add or change a Pobe Coins API endpoint end to end: zod schema in @pobe/core, service in packages/functions, route in app.ts, harness tests including cross-household isolation, and the app hook. Use for any backend feature, DynamoDB entity or route change.
---

# Add an API endpoint

Order: **schema → service → route → tests → app hook.** Look at a similar existing feature first, such as gifts: `giftSchema`, `money.gift`, `POST /gifts`, `actions.gift`.

1. **Schema** in `packages/core/src/schemas.ts` (zod v4). Export it and its inferred type. Bound every string and number, e.g. `.max(200)` or `.int().positive()`.
2. **Service** in `packages/functions/src/services/<area>.ts`:
   - Signature: `export async function doThing(deps: Deps, actor: Actor, input: Input)`.
   - Read and write through `repo.ts` / `deps.db` using keys from `db/keys.ts`. New entity: add a key builder and a `toItem`/`strip` mapping, under the household partition `H#<hid>`, with a ULID sort key when it needs time ordering.
   - Authorize inside the service with `actor.role === 'admin'` and ownership checks. Use `ApiError` from `lib/errors.ts` for errors.
   - Coins change? Use `commitMoney` (see skill `money-changes`).
   - Record admin actions in the audit log, and use `deps.notifier.send(...)` for notifications.
3. **Route** in `packages/functions/src/app.ts` on `authed`:
   ```ts
   authed.post('/things', async (c) => {
     const input = await body(c, S.thingSchema);
     return c.json(await things.doThing(deps, actorOf(c), input), 201);
   });
   ```
   **Never** read `householdId` from the body or query; it comes from `actorOf(c)`.
4. **Tests** in `packages/functions/src/tests/*.test.ts`:
   ```ts
   const h = createHarness();
   const { adminToken, memberToken } = await household(h);
   const r = await h.call('POST', '/things', { token: memberToken, body: { ... } });
   expect(r.status).toBe(201);
   ```
   Cover the happy path, a 400 on bad input, 401/403 for the wrong caller, and **isolation**: a second `household(h, { sub: 'other' })` gets 404/403 on the first household's ids. Use `h.advance(...)` or the harness clock for time-based logic, not real time.
5. **App:** add the type in `apps/mobile/src/api/types.ts`, a query hook or `actions.x` in `src/api/hooks.ts`, and invalidate the affected query keys on success.
6. **Infra:** only if the change needs new AWS resources or env, via `sst.config.ts` (skill `deploy`).
7. Verify with `npm test -w @pobe/functions`, then run `npm run typecheck` at the root.

Cost and abuse: endpoints that don't need sign-in must be rate-limited: `await misc.rateLimit(deps, `name:${clientIp(c)}`, limit, windowSeconds)` like `/links/redeem`. Keep responses small, and paginate lists with a ULID cursor.
