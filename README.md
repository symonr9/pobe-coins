# Pobe Coins

My wife and I wanted a shared app where we keep track of "coins" we can spend on purchases. We earn pobe coins by doing the tasks on our to-do lists and household chores, and Chubbybara the capybara runs the POBE Shop where we spend them.

One codebase runs as a **web app / installable PWA**, an **iOS app** and an **Android app**. The backend is serverless on **AWS**, so it costs about $0 for a household.

```
apps/mobile          Expo (SDK 57) app: iOS, Android, web/PWA (Expo Router, React Native Web)
packages/core        Shared logic: coin purse math, recurrence & streaks, stats, themes, art, Chubbybara's lines
packages/functions   API on AWS Lambda (Hono) + DynamoDB/S3/Cognito adapters, jobs, local dev server
sst.config.ts        All AWS infrastructure as code (SST v4)
docs/                Plan, design research, style book, store checklists, mascot spec
```

## Highlights

- **A real coin purse.** Coins are 1s, 5s, 10s, 25s, 50s and 100s (configurable). Paying works like a cash register: exact coins when possible, otherwise the smallest overpayment with change back. You can go into IOU debt up to a household limit, and new earnings pay the IOU off first.
- **Chores.** One-off or recurring (daily/weekly/monthly, with a due time). They can sit in a shared pool, be assigned to someone, or rotate between people. Other options: steps with pay-as-you-go, streak bonuses, approval by someone else, and undo.
- **POBE Shop.** Household rewards (stock, cooldowns, delivered/not yet), wishlist goals (personal, or shared jars everyone chips into) and dress-up cosmetics for Chubbybara.
- **History with cause and effect.** Every purchase shows what paid for it ("Dishes ×3, Deep clean"). The timeline has reactions and comments, plus stats, a friendly leaderboard and monthly/yearly **Pobe Wrapped**.
- **Sign-in.** Admins use Google or Apple (Cognito). Everyone else joins with a **one-time, expiring QR code or link** and can link Google/Apple later.
- **Phone features.** Push with Approve / Not yet buttons, an app badge, reminders, home-screen widgets, a share extension ("share from Amazon → log purchase"), Face ID for spending, and five pastel themes with matching app icons.
- **Safe for open signup.** Quotas, rate limits, SSRF-safe link previews, isolation tests between households, and an AWS Budgets alarm.

## Run it locally (no AWS needed)

Requires Node 22. Use **npm 11** (npm 10 has an install bug with this workspace): `npx -y npm@11 ci`.

```bash
npx -y npm@11 ci
SEED=1 npm run dev:api          # API on http://localhost:3001 with a demo household
npm run web -w @pobe/mobile      # app on http://localhost:8081
```

On the welcome screen, use **Dev sign-in** as `sam` (admin) or `alex`. The dev API keeps everything in memory and prints push notifications to the console.

Checks:

```bash
npm test            # core + API + app unit tests
npm run typecheck
npm run e2e         # Playwright smoke test (needs the two servers above)
```

Phone apps in development: they use native modules (widgets, share extension, Face ID), so run a **development build**, not Expo Go:

```bash
cd apps/mobile
npx eas-cli@latest build --profile development --platform ios      # or android
npx expo start --dev-client
```

## Deploy

### 1. AWS backend (SST)

1. Create an AWS account and configure credentials (`aws configure sso` or an IAM user profile). New accounts get free-tier credits.
2. Set the secrets for a stage (`dev` or `prod`):

   ```bash
   npx sst secret set DeviceTokenSecret "$(openssl rand -base64 48)" --stage prod
   npx web-push generate-vapid-keys            # prints a public and private key
   npx sst secret set VapidPublicKey  <public>  --stage prod
   npx sst secret set VapidPrivateKey <private> --stage prod
   npx sst secret set GoogleClientId     <id>     --stage prod
   npx sst secret set GoogleClientSecret <secret> --stage prod
   # optional: npx sst secret set ExpoAccessToken <token> --stage prod
   ```

   **Google OAuth client:** Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Add the authorized redirect URI `https://<AUTH_PREFIX>.auth.<region>.amazoncognito.com/oauth2/idpresponse`.
3. Deploy:

   ```bash
   WEB_ORIGIN=https://<your-site>.netlify.app BUDGET_EMAIL=you@example.com \
     npx sst deploy --stage prod
   ```

   The outputs are `api`, `authDomain`, `userPoolClientId` and a few others. Deploy-time options are documented at the top of `sst.config.ts` (`AUTH_PREFIX`, `ENABLE_APPLE`, `APPLE_AUDIENCES`, `AWS_REGION`).
4. **Sign in with Apple** (once you have the Apple Developer account):
   1. Create a Services ID and a Sign in with Apple key.
   2. Set `AppleServicesId`, `AppleTeamId`, `AppleKeyId` and `ApplePrivateKey` with `sst secret set`.
   3. Redeploy with `ENABLE_APPLE=true`.

   The native iOS Apple sheet works through `APPLE_AUDIENCES` (your bundle id).

### 2. Web app (Netlify)

Connect the repo in Netlify. `netlify.toml` already contains the build command, publish directory, rewrites and headers. Set these environment variables:

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | sst output `api` |
| `EXPO_PUBLIC_WEB_URL` | your Netlify URL |
| `EXPO_PUBLIC_COGNITO_DOMAIN` | sst output `authDomain` |
| `EXPO_PUBLIC_COGNITO_CLIENT_ID` | sst output `userPoolClientId` |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | the VAPID public key |
| `APPLE_TEAM_ID`, `ANDROID_SHA256` | optional: make join links open the installed app |

### 3. Phone apps (EAS)

```bash
cd apps/mobile
npx eas-cli@latest init                   # creates the EAS project; set EAS_PROJECT_ID to its id
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios   # and android
npx eas-cli@latest update --channel production                   # ship JS fixes without review
```

Set the same `EXPO_PUBLIC_*` values as EAS environment variables. Before submitting, work through `docs/store/checklist.md` (privacy labels, Play data safety, review notes, screenshots).

## What it costs

| | Your household | ~100 households | ~10k active users |
|---|---|---|---|
| AWS (Lambda, DynamoDB, API Gateway, S3, Cognito, logs) | ≈ $0–1/mo | ≈ $1–2/mo | ≈ $15–60/mo |
| Netlify, Expo EAS | free tiers | free tiers | free to ~$19/mo each |
| Apple Developer / Google Play | $99/yr / $25 once | | |

The infrastructure avoids the usual AWS surprise bills: no VPC/NAT gateway, no always-on database, no Secrets Manager (SST keeps secrets in SSM), and logs are kept for 2 weeks. `BUDGET_EMAIL` sends alerts at $5 and $20.

## Architecture notes

- **Every coin movement is one DynamoDB transaction.** The member's purse is updated with a version check, the immutable ledger entry is written, and so is the related record (completion, purchase, goal). If two people act at once, one of them retries from fresh data, so coins are never double-counted.
- **Single-table design:** a household's data lives in one partition (`H#<id>`), which makes export and deletion simple. ULID ids keep "newest first" cheap.
- `packages/functions/src/db/memory.ts` implements the same `Db` interface in memory with the same conditional-write rules. The API tests (51) run the real router against it, and so does the local dev server.
- Chubbybara's art comes from `apps/mobile/src/features/chubby/assets.ts`. When the commissioned art arrives, add files there (see `docs/design/mascot-spec.md`).

## Docs

- `docs/PLAN.md`: the product and technical plan
- `docs/design/research.md` and `docs/design/stylebook.html`: UX research and the design system
- `docs/design/mascot-spec.md`: the brief for the Chubbybara illustrator
- `docs/store/checklist.md`: App Store / Play Store submission checklist and privacy answers
