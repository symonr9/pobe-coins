# @pobe/functions

Hono API on one Lambda (`handlers/api.ts`), plus `handlers/cron.ts` (hourly jobs) and `handlers/exporter.ts`.

- `app.ts`: every route. Public routes are `/health`, `/links/redeem`, `/auth/exchange` and `/cal/:token`; everything else sits behind `authed` (device JWT or user session). Get the actor with `actorOf(c)` and parse bodies with `body(c, S.someSchema)`.
- `services/*`: business logic. Signature: `(deps: Deps, actor: Actor, ...)`. Throw `ApiError('NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | ...)`.
- `services/money.ts`: `commitMoney(deps, build)` is the only way to change a purse. `build()` re-reads fresh state each attempt and returns `{ members, entries, ops, result }`. Retries happen on version conflicts.
- `db/`:
  - `types.ts` defines the `Db` interface with structured conditions (`notExists`, `version`, `equals`, ...).
  - `dynamo.ts` is production; `memory.ts` has the same semantics for tests and the dev server.
  - `keys.ts` holds the single-table keys: `H#<hid>` partition, ULID sort keys, GSI1 for the per-member ledger and the household index.
- `adapters/`: AWS (S3, Cognito/Apple identity) and push (Expo + Web Push).
- `dev/server.ts`: local API on :3001 (`SEED=1` for the demo household; `/dev-token` for dev sign-in).
- `testing/harness.ts`: `createHarness()` gives the real app over MemoryDb with a fake clock, storage, push and identity. `household(h)` creates admin Sam and member Alex.
- Tests live in `src/tests/*.test.ts` and call `h.call('POST', '/path', { token, body })`.

Every new route needs:

1. A zod schema in core.
2. A service function.
3. The route in `app.ts`.
4. Tests for the happy path, validation (400), auth (401/403) and **cross-household isolation**.
5. The app hook in `apps/mobile/src/api/hooks.ts`.

See skill `api-endpoint`.
