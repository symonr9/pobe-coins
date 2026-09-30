# Pobe Coins — v1 Implementation Plan

## Context
`symonr9/pobe-coins` is currently empty (just a README and LICENSE). The goal is an app where a household (starting with the user and their wife, but open to anyone who signs up) earns "pobe coins" by finishing tasks and chores and spends them on purchases. Every earn and spend is kept as a history, so you can trace what work paid for what item. There's one **Expo (React Native) dev-build** codebase that ships to **web/PWA, iOS and Android**. The backend is serverless AWS, kept as close to $0 as possible, and doubles as a way for the user to learn AWS.

## Decisions
| Area | Decision |
|---|---|
| Client | Expo SDK (latest) **dev build** (`expo-dev-client`, not Expo Go), Expo Router, React Native Web, TypeScript, NativeWind. Web: `expo export -p web` → Netlify, hand-written PWA manifest + service worker. Native: EAS Build/Submit/Update. User already has Apple + Google developer accounts |
| Backend | **SST v3** on AWS: API Gateway HTTP API + one Lambda (Hono), DynamoDB on-demand single table, S3 + CloudFront (photos), EventBridge cron, SSM secrets. **No VPC/NAT, no RDS, no Secrets Manager** (cost traps) |
| Auth | **Cognito** (Essentials, free ≤10k MAU) Hosted UI via `expo-auth-session`: Google + Apple (native `expo-apple-authentication` on iOS). One-time, expiring **QR codes / links** set up member devices. Members can link OAuth later |
| Tenancy | **Open signup**, multi-household, `householdId` always from the token |
| Sync | Refresh on app open / focus + push. Read-only offline (TanStack Query cache persisted to MMKV/localStorage) |
| Coins | Physical-style **purse** (configurable coin types, default 1/5/10/25/50/100), **auto make change**, **IOUs allowed** up to a household debt limit. Coins are never bought with real money |
| Tasks | One-off, recurring, shared pool, assigned; per-task approval setting; **milestone streak bonuses** (e.g. 7 in a row → +10) |
| Purchases | Amount, title, description, URL + preview, photos; approval above a household threshold; **share-extension** entry |
| Extras (v1) | **Wishlist/savings goals, streaks & bonuses, gift/transfer coins, stats & charts** |
| Visibility | **Per-household setting**: `full` (everyone sees everything) or `balances` (totals only; details for self + admins) |
| Native v1 | Notification action buttons + icon badge, share extension, Face ID/biometric confirm for spends/admin, home-screen widget (iOS + Android) |
| Visual design | **Cozy, modern, snappy, animation-rich, pastel.** Selectable themes: **Pink (required default), Blue, Purple, Yellow, Green**, each with light + dark variants; the user chooses the in-app theme **and a matching app icon** (`expo-alternate-app-icons`: iOS alternate icons / Android activity-alias; web manifest icon follows the theme) |
| Release | **All features in one v1** (no staged milestones) |
| Stages | SST `dev` (personal, `sst dev`) + `prod`; separate Cognito pools / tables per stage |
| Wishlist | Personal goals + **shared household goals** that several members contribute coins to (contributions held in the goal until it's bought or cancelled → refunded) |
| Protection | Baseline: route throttling, per-IP limits on endpoints that don't need sign-in, SSRF-safe previews, upload caps, open-signup quotas, AWS Budgets alarm, 14-day log retention |

## Cost estimate (per month)
Your household: **≈ $0–1** · 100 households: **≈ $1–2** · ~10k active users: **≈ $15–60** (API Gateway, logs, DynamoDB, maybe the EAS/Netlify paid tiers). Always-free: Lambda 1M requests, DynamoDB 25 GB, CloudFront 1 TB, Cognito 10k MAU, EventBridge; new accounts also get $100–200 in credits. Optional domain ≈ $12/yr (Netlify DNS, not Route 53).

## Repository layout (npm workspaces)
```
sst.config.ts
packages/core/        # pure TS: coins.ts, recurrence.ts, streaks.ts, funding.ts, stats.ts, schemas.ts (zod)
packages/functions/   # Lambda: Hono app, routes/, auth/, db/ (repo layer), jobs/, notify/ (expo + webpush)
apps/mobile/          # Expo app
  app/                #   Expo Router: (auth)/, (tabs)/home|tasks|spend|timeline|more, join/[token], admin/, wishlist/, stats/
  src/api src/auth src/push src/offline src/components src/biometrics
  targets/widget/     #   iOS SwiftUI widget via @bacons/apple-targets (reads an App Group shared snapshot)
  android-widget/     #   react-native-android-widget
  public/manifest.json public/sw.js
  app.config.ts eas.json
netlify.toml          # web export, SPA redirect, /.well-known/apple-app-site-association + assetlinks.json
```

## Data model (DynamoDB single table `pobe`, PK/SK + GSI1)
| Entity | PK / SK | Key fields |
|---|---|---|
| Household | `H#id` / `META` | name, coinTypes, purchaseApprovalThreshold, debtLimit, visibility, timezone, quotas |
| Member | `H#id` / `M#id` | name, color, role, cognitoSub?, **purse `{denom:count}`**, **debt**, version |
| UserLink | `U#sub` / `H#id` | OAuth user → households; householdsCreated |
| DeviceLink | `LINK#hash` / `LINK` | memberId, expiresAt (TTL), usedAt |
| Device | `H#id` / `D#id` | memberId, label, lastSeen, revoked |
| Task | `H#id` / `T#id` | title, reward, recurrence, assigneeId?/claimedBy?, requiresApproval, streakRule `{every, bonus}`, status, nextDueAt |
| Streak | `H#id` / `S#taskId#memberId` | current, best, lastPeriodKey |
| Completion | `H#id` / `C#ts#id` | taskId, memberId, periodKey, status, note, photo? |
| Purchase | `H#id` / `P#ts#id` | memberId, amount, title, description, url + preview, photoKeys, status, wishlistId? |
| ShopItem | `H#id` / `SHOP#id` | title, price, icon/photo, stock?, cooldown?, requiresApproval, active |
| Unlock | `H#id` / `UNL#memberId#cosmeticId` | purchasedAt, equipped |
| WishlistItem | `H#id` / `W#id` | memberId (or shared), title, targetAmount, url/preview, photo, status |
| Transfer | via LedgerEntry pair | from/to member, amount, message |
| LedgerEntry | `H#id` / `L#ts#id` | memberId, kind EARN/BONUS/SPEND/REFUND/GIFT_IN/GIFT_OUT/ADJUST/DEBT, amount, coinsIn, coinsOut, debtDelta, ref — **immutable** |
| PushTarget | `H#id` / `PT#memberId#hash` | kind expo/webpush, token |
| LinkPreview / RateLimit | `PREV#hash`, `RL#ip#route#window` | cache and counters with TTL |

Every change to a purse is a **`TransactWriteItems`** (purse/debt update guarded by `version` + ledger entry + status change). This makes double taps, simultaneous approvals and simultaneous spends safe. Gifts update both members' purses in one transaction.

## Coin logic (`packages/core`)
- `payout(amount)`: greedy breakdown. `pay(purse, amount)`: exact combination using the fewest coins (bounded DP), otherwise the smallest overpayment + change.
- **IOUs:** if balance < amount and `debt + shortfall ≤ debtLimit`, pay with the whole purse and add the shortfall to `debt`. Incoming coins pay off debt first (converted via `payout`), and the rest goes into the purse.
- Held coins for purchases waiting on approval; a rejection refunds exactly the coins that were held.
- **Streaks:** per recurring task and member, the period key comes from the household time zone. Consecutive periods increment the streak and a missed period resets it. `current % every === 0` → a BONUS entry.
- `fundedBy` (FIFO over earnings) for the cause-and-effect trail; `stats` (earned vs. spent by week, top chores, per-member totals).
- Changing coin types converts existing purses with one ADJUST entry each.

## API (Hono)
`auth` (link create/redeem, me, link-account, devices, delete account) · `households` (create/settings/members/delete) · `tasks` (CRUD, claim, complete) · `approvals` (approve/reject; can't approve your own) · `purchases` (create, upload URL, link preview) · `wishlist` (CRUD, buy → purchase) · `transfers` (gift) · `bonuses` (admin grant) · `timeline` (paginated, filtered by visibility) · `stats` · `push` (register expo/webpush) · `widget` (compact snapshot). The hourly cron handles recurring reopen, streak resets, due reminders and push-token cleanup.

## App features (Expo)
- **Screens:** Home (purse coin stacks, debt badge, wishlist progress) · Tasks (Mine / Pool / Recurring, streak flames) · Spend (preview of change or IOU; Face ID confirm) · Timeline · Approvals · Wishlist · Stats (charts via `victory-native` / web-compatible SVG) · Admin (members, QR code, devices, coin types, thresholds, visibility, debt limit, streak rules) · Settings.
- **Expo modules:** expo-router, expo-dev-client, expo-auth-session/web-browser, expo-apple-authentication, expo-secure-store, expo-camera, expo-image-picker/manipulator, expo-image, expo-notifications (categories with Approve/Reject actions, badge count, local reminders), expo-local-authentication, expo-haptics, expo-audio, react-native-reanimated, expo-localization, expo-updates, expo-share-intent, @bacons/apple-targets, react-native-android-widget, TanStack Query + MMKV persistence.
- **Web fallbacks:** Web Push, file picker, no widget/share extension/biometrics.

## Chubbybara & the POBE Shop
**Mascot:** Chubbybara the Capybara, a round, cute, lovable friend (based on the user's plushie). He runs the POBE Shop, gives affirmations and helps out.
- **Art:** the user will commission the final art. For now I draw **placeholder SVGs** (`react-native-svg`) with poses and expressions: `idle`, `happy`, `cheer`, `shopkeeper`, `sleepy`, `thinking`, `wave`. `src/mascot/Chubbybara.tsx` takes `pose`, `size` and an optional `accessory`. A single **asset registry** (`src/mascot/assets.ts`) maps each pose to its source, so commissioned SVG/PNG/Lottie files drop in without code changes. The same asset spec (sizes, safe areas) goes in `docs/design/mascot-spec.md` for the illustrator.
- **Idle animation:** a gentle Reanimated "breathing" bob plus blinks; a bounce for reactions. Static under reduce-motion.
- **Affirmations/help:** a **handwritten line library** in `packages/core/src/chubbybara/lines.ts` (a few hundred lines): greetings by time of day, task done, streak milestone, goal reached, spent/shop, IOU nudges (gentle), idle/comeback, onboarding and help tips. Lines can include placeholders (`{name}`, `{coins}`, `{task}`). The picker is seeded per day and avoids recent repeats. $0 and works offline.
- **Where he appears:** Home greeting (daily affirmation + what's due), celebrations (earn / streak / goal overlays with confetti + haptics), onboarding walkthrough & contextual help (empty states, a "?" help sheet), notifications (copy in his voice; his face on the app icon variants) and the widget.

**POBE Shop** (one tab with three sections):
1. **Rewards:** a household-defined catalog of rewards with set prices (e.g. "Breakfast in bed: 50", "Pick the movie: 10"), with optional stock and cooldown. Buying one creates a Purchase (`shopItemId`) with a **redemption state** (`redeemed → fulfilled`), so a partner can mark "delivered." Approval rules apply.
2. **Wishlist:** personal + shared goals (as above); "Buy" converts a goal into a Purchase.
3. **Cosmetics:** a code-defined global catalog of **Chubbybara accessories** (hats, scarves, seasonal outfits), shop backgrounds and bonus app-icon variants, bought with coins and unlocked per member (`Unlock` records, SPEND ledger kind `COSMETIC`). The five base pastel themes and icons stay free. Coins are earn-only, so there are no store in-app-purchase issues.

## Additional v1 features
**Tasks+**
- **Undo & corrections:** undo your own completion or purchase within 5 minutes (a reversing ledger entry, never a delete). Admin CORRECTION entries require a reason and are recorded in the audit log.
- **Due dates & reminders:** optional due date/time on tasks; local notifications scheduled on the device plus a server "due soon" push; overdue styling; Chubbybara nudges.
- **Subtasks/checklists:** an ordered checklist on a task; optional partial credit (the reward is split evenly and paid when each item is checked).
- **Chore templates:** a starter library in `packages/core/src/templates.ts` (kitchen, laundry, pets, errands… with suggested rewards); offered during household onboarding and in "+ task."

**Social**
- **Reactions & comments** on timeline items (Reaction `H#id / RX#itemId#memberId`, Comment `H#id / CM#itemId#ts`); notifies the item's owner.
- **Co-op challenges:** a household goal ("earn 500 together this week") with a shared progress ring; on success everyone gets a bonus + a Chubbybara party celebration.
- **Pobe Wrapped:** monthly and yearly recap stories (swipeable animated cards: top chores, streaks, biggest purchase, coins earned and spent), computed from the ledger by `core/stats`; the monthly cron sends a push when a new recap is ready.
- **Friendly leaderboard:** weekly earnings ranking, **off by default** (household setting), celebratory rather than shaming.

**Household**
- **Chore rotation:** recurring task with `rotation: memberId[]`; the cron assigns the next member each period; skipping or swapping is allowed.
- **Calendar feed:** per-member secret ICS URL (`/cal/<token>.ics`, revocable) listing due chores.
- **Export & backup:** async export job → ZIP (JSON + CSV + photos) in S3 → presigned download link that expires in 24h. Also satisfies privacy requirements.

**Launch & operations**
- **Privacy policy & terms:** drafted pages (web routes `/privacy`, `/terms`) for the user to review; the app-store privacy labels and data-safety answers are drafted in `docs/store/`.
- **Crash + analytics:** Sentry (Expo plugin + Lambda) and PostHog (free tier) with privacy-friendly settings: no session replay, no personal data in events, opt-out toggle in Settings.
- **Admin audit log:** `H#id / AUD#ts` entries for settings, members, devices, coin types, corrections and cosmetics grants; viewable in Admin.
- **Multi-language ready:** `i18next` + `expo-localization`; all strings (including Chubbybara lines) in `locales/en/*.json`; English at launch.

**Roadmap (not v1):** kid member profiles, Siri Shortcuts / App Intents, Live Activities, real-time sync.

## UX/UI research & design system (phase 0)
- Research pass (web search + teardown notes) of cozy, gamified habit/finance apps: Finch, Habitica, Duolingo (reward animations, streaks), Monzo/Qapital pots (savings goals), Sweepy/Tody (chores), Apple Fitness (rings/celebrations). Plus guidance on pastel accessibility (contrast on light pinks and yellows), motion (150–300ms micro-interactions, spring physics, respecting reduced-motion) and thumb-reach layout.
- Deliverable: `docs/design/` research summary + a **design-system artifact page** (palettes with WCAG-checked text colors per theme, type scale with a rounded font such as Nunito/Quicksand, spacing/radius tokens, coin illustrations for each denomination, motion specs) for the user to review **before** screens are built.
- Implementation: theme tokens in `src/theme/` (NativeWind CSS variables per theme and mode), `ThemeProvider` saved per device, Reanimated + `moti` for motion (coin drop/bounce on earn, purse jingle, confetti on goal reached, spring list and card transitions, animated progress rings for goals and streaks), `expo-haptics` paired with key animations, and `AccessibilityInfo.isReduceMotionEnabled` fallbacks.

## Build order (each a commit; web-testable first, native last)
0. UX research + design system artifact (themes, coins, placeholder Chubbybara poses, motion) → user review.
1. Scaffold: workspaces, SST config, Expo app (router, NativeWind, dev client), lint/format/tests, netlify.toml.
2. `core` logic + thorough unit tests (coins, IOUs, streaks, funding, stats, recurrence).
3. Backend foundation: repo layer, auth (Cognito + device JWT), device links, quotas/rate limits.
4. Households/members/tasks/completions/approvals/streaks/bonuses/transfers.
5. Purchases, uploads, SSRF-safe preview, wishlist, timeline, stats, visibility filtering.
6. App screens (tested on web).
7. Notifications (Expo + Web Push, actions, badge), cron, PWA service worker, offline cache.
8. Native: config (scheme, universal/app links), Face ID, share extension, widgets (themed to match), alternate app icons ×5, `eas.json`.
9. README: AWS setup + cost guardrails, deploy, OAuth clients, Netlify, EAS build/submit/update, store checklist.

## User-provided prerequisites
AWS account + credentials profile · Google Cloud OAuth client · Apple Services ID/key for Sign in with Apple + App Group/bundle IDs · Netlify site · Expo account (EAS).

## Verification
- vitest: `core` (make-change, IOU edge cases, debt payoff, streak periods across time zones/DST, FIFO funding) and `functions` with `aws-sdk-client-mock` (single-use link race, revoked device, approve once, no self-approval, refund exactness, gift atomicity, visibility filtering, isolation between households, quotas, SSRF blocklist).
- jest-expo component tests (purse, spend flow). `typecheck` + `lint` across workspaces.
- `expo export -p web` + Playwright smoke test with a mocked API.
- With AWS: `npx sst dev` + manual end-to-end; EAS development build on the user's devices for native features (push actions, share extension, widget, Face ID).
- Commits pushed to `claude/vigilant-ptolemy-fdv0ka` (no PR unless asked).

## Build status (v1)

Everything above is implemented. Where the build differs from the plan, and why:

| Plan | Built | Why |
|---|---|---|
| NativeWind styling | Typed theme hook + `StyleSheet` (`apps/mobile/src/theme`) | No extra build tooling on SDK 57; same tokens drive web, iOS and Android |
| CloudFront signed URLs for photos | S3 presigned GET URLs (1h) | Simpler (no key pair to manage); S3 includes 100 GB of free egress |
| Cognito tokens used directly | Provider token exchanged once for an app session token (`POST /auth/exchange`) | The native Sign in with Apple token expires in 10 minutes and can't be refreshed; one refreshable session works for Google, Apple and dev sign-in |
| `@bacons/apple-targets` + `react-native-android-widget` | First-party `expo-widgets` (iOS) + `react-native-android-widget` | `expo-widgets` shipped in SDK 57; its Android side is still a stub |
| i18n JSON per namespace | Natural-language keys (`t('Save')`), `npm run i18n:extract` → `locales/en.json` | English stays readable in code, and translations are just a JSON file |

**Needs the owner:** an AWS account and credentials, a Google OAuth client, Apple Services ID/key, a Netlify site, an EAS project, and the commissioned Chubbybara art. See the README for each step.

**Tested here:** 117 unit/API tests, typecheck in every workspace, web production build + PWA checks, a Playwright end-to-end smoke test, and `expo prebuild` for iOS/Android (widgets, share extension, alternate icons, notifications) plus iOS/Android JS bundles. **Not tested here** (needs devices or accounts): native builds on a phone, real push delivery, the Cognito/Google/Apple sign-in round trip, and an AWS deploy.
