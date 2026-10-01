# @pobe/core

Pure TypeScript with no I/O, no React and no AWS. It's imported by both the API and the app, so anything here must run in Node, Hermes and browsers.

- `coins.ts`: the purse engine.
  - `pay` finds the fewest-coins exact combination (bounded DP); if none exists, it takes the smallest overpayment and gives change via `payout`.
  - `payWithDebt` handles IOUs up to the debt limit; `receive` pays debt first.
  - Also `refund` and `convertPurse` (for when coin types change).
  - Purses are `{ [denomination]: count }`.
- `ledger.ts`: ledger kinds, plus `fundedBy`/`summarizeFunding` (FIFO: which chores paid for a purchase).
- `recurrence.ts`: time-zone/DST-safe schedules and `rotationAssignee`. `streaks.ts`: milestone bonuses.
- `stats.ts`: weekly series, leaderboard, Pobe Wrapped. `templates.ts`: starter chores. `cosmetics.ts`: the shop's dress-up catalog.
- `schemas.ts`: zod v4 request schemas, shared with the app. `domain.ts`: entity types.
- `theme.ts`: `THEMES` (5 pastel themes × light/dark), `TYPE`, `SPACE`, `RADIUS`, `MOTION`. Tests enforce WCAG AA.
- `art.ts`: placeholder Chubbybara SVG (`chubbybaraSvg`, poses and accessories) and `coinSvg`. `chubbybara/lines.ts` and `pick.ts`: his line library and the seeded, repeat-avoiding picker.

Rules:

- Change money logic test-first (`src/*.test.ts`). Coin amounts are integers, and a purse's total must always match what the ledger says.
- Anything exported here is a contract for both the API and the app. After changing it, run `npm run typecheck` at the root, not just here.
