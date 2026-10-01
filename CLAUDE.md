# Pobe Coins

A household app: members earn **pobe coins** by doing chores and spend them in **Chubbybara's POBE Shop**. There's one Expo codebase for web/PWA, iOS and Android, and a serverless AWS backend (SST). See `README.md` for the product and `docs/PLAN.md` for decisions and build status.

## Map

| Path                 | What                                                                                                                                       | Guide                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `packages/core`      | Pure TS domain logic shared by app + API: coin purse math, recurrence, streaks, ledger, stats, zod schemas, themes, Chubbybara art + lines | `packages/core/CLAUDE.md`      |
| `packages/functions` | Hono API on Lambda, DynamoDB single table, services, jobs, local dev server, test harness                                                  | `packages/functions/CLAUDE.md` |
| `apps/mobile`        | Expo SDK 57 app (Expo Router, RN Web), UI kit, features, widgets, PWA                                                                      | `apps/mobile/CLAUDE.md`        |
| `sst.config.ts`      | All AWS infrastructure                                                                                                                     | skill `deploy`                 |
| `docs/`              | Plan, design research, style book (generated), mascot brief, store checklist                                                               |                                |
| `scripts/claude/`    | Hook scripts used by `.claude/settings.json`                                                                                               |                                |

## Commands (repo root)

```bash
npx -y npm@11.20.0 ci         # install. NEVER plain `npm install/ci` with npm 10: it crashes ("edgesOut")
npm test                      # core + API + app unit tests (vitest)
npm run typecheck             # all workspaces
npm run lint                  # prettier --check (npm run format to fix)
npm run check:secrets         # the repo is PUBLIC: fails on anything credential-shaped (CI + stop hook run it too)
SEED=1 npm run dev:api        # in-memory API on :3001 with demo household "The Cozy Burrow" (sam = admin, alex)
npm run dev:web               # Expo web on :8081 → Dev sign-in as sam/alex
npm run screens               # screenshot tour (phone + desktop) → .claude/.cache/screens/
npm run e2e                   # Playwright smoke test (needs both servers)
```

## Rules that matter

- **Money:** every coin movement goes through `commitMoney` (services/money.ts): a single DynamoDB transaction with a member version check plus immutable ledger entries. Never write a purse directly, and never delete or edit a ledger entry; reverse it instead. Skill: `money-changes`.
- **Tenancy:** `householdId` always comes from the authenticated actor, never from the request body. Every new route needs a test showing another household can't reach it.
- **Validation:** request bodies are validated with zod schemas exported from `@pobe/core` (`schemas.ts`), shared with the app.
- **UI:** use theme tokens (`useTheme()`), the `src/ui` kit and `Text` variants. Never hard-code colors or fonts. All copy goes through `t()`, and Chubbybara's lines through `say()` (never `t(say(...))`). Check phone and desktop widths. Skill: `ui-screen`.
- **Look:** clean card-based UI on neutral backgrounds (soft white by day, true black by night), with the chosen pastel palette (pink default, blue, purple, yellow, green) as the accent. Elevation comes from `Card level` / `elevation()`. The font is Plus Jakarta Sans (500/600/700/800). Core tests enforce WCAG AA contrast for every palette × mode.
- **Native dirs** `apps/mobile/ios|android` are generated (CNG). Never commit them; configure through `app.config.ts` and plugins. Keep `.gitignore` patterns anchored (`/apps/mobile/android/`).
- **The repo is public.** Never commit keys, tokens, `.env` files or deploy secrets. Secrets live in SST (AWS SSM) via `npm run deploy:secrets`, and AWS keys stay in `~/.aws` on the user's computer. Only non-secret `EXPO_PUBLIC_*` values go to Netlify, since they're baked into the public bundle.
- Keep AWS costs near $0: no VPC/NAT, no RDS, no Secrets Manager, on-demand DynamoDB, 14-day logs.

## Environment gotchas

- The cloud sandbox can't reach docs.expo.dev or Expo's version API, so `npx expo install` fails there. Pin versions from `node_modules/expo/bundledNativeModules.json` instead and set `EXPO_OFFLINE=1`.
- In app code, read env **only** as literal `process.env.EXPO_PUBLIC_X`. Expo inlines just that form, so aliasing `process.env` makes production builds silently lose every value (`src/config.test.ts` guards this). Metro also caches the inlined values, so `build:web` runs `expo export --clear` and then `scripts/check-env.mjs` fails the build if any set value is missing from the bundle.
- `CI=1` turns off Metro's file watching. Don't set it for the dev server.
- Typed routes (`.expo/types/router.d.ts`) regenerate only when `expo start` restarts.
- Stop background servers with `fuser -k 3001/tcp`. `pkill -f` can kill your own shell.

## Working here (agents)

- Skills in `.claude/skills/` are the playbooks: `dev-setup`, `verify`, `api-endpoint`, `money-changes`, `ui-screen`, `chubbybara`, `deploy`, `release-mobile`, `expo-upgrade`. Load the matching one before starting.
- Hooks (`.claude/settings.json`):
  - Session start installs dependencies and reports server status.
  - Prompts are matched to skills.
  - Edited files are Prettier-formatted, with a one-time reminder of that area's rules.
  - Before you finish, the stop hook typechecks and tests the touched workspaces and blocks on failures. Set `POBE_SKIP_STOP_CHECKS=1` to skip.
- Work in small, verified steps. Commit with clear messages, and don't commit `.claude/.cache/`, `dist/` or native dirs.
- Deploys (`sst deploy`, `eas submit/update`) always need the user's explicit go-ahead.
