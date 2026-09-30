---
name: verify
description: Verify a change in Pobe Coins before committing: unit/API tests, typecheck, formatting, web build, Playwright smoke test and a screenshot tour at phone and desktop widths. Use after any code change, before commits, or when CI fails.
---

# Verify a change

Run the cheapest checks first, and only run the heavy ones when the change touches that area.

| Changed                         | Run                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| anything                        | `npm test` · `npm run typecheck` · `npm run lint` · `npm run check:secrets` (the repo is public)                                                                                   |
| `packages/core`                 | all of the above (core is imported by the API and the app)                                                                                                                         |
| UI (`apps/mobile/src`)          | `npm run screens` and **look at the PNGs** in `.claude/.cache/screens/` (phone + desktop; use `ONLY=home,shop` to limit)                                                           |
| routes/auth/flows               | `npm run e2e` (needs the dev API + web servers; see `dev-setup`)                                                                                                                   |
| PWA, `public/`, `app.config.ts` | `npm run build:web -w @pobe/mobile` (static export + service worker)                                                                                                               |
| native config, plugins, widgets | `cd apps/mobile && npx expo export -p ios -p android` (bundles), plus a throwaway `npx expo prebuild --clean --no-install` to check the targets. Then delete `ios/` and `android/` |
| copy (`t('…')`)                 | `npm run i18n:extract -w @pobe/mobile` and commit `locales/en.json`                                                                                                                |

## Reproducing CI

`.github/workflows/ci.yml` runs:

- **check** job: npm 11 `ci`, tests, format, typecheck, web build.
- **e2e** job: dev API + `serve dist` + `apps/mobile/e2e/smoke.mjs`.

To reproduce a CI failure, run the same command locally first, then fix it. A red check is never "flaky" without evidence.

## Before calling it done

- Re-read your own diff (`git diff`) for stray debug code, hard-coded colors or strings, and edits to generated files.
- Screenshots: check dark mode too if you touched colors. Toggle it in Settings, or use Playwright `colorScheme: 'dark'`.
- The Stop hook re-runs typecheck and tests for touched workspaces automatically. If it blocks, fix the cause; don't bypass it.
