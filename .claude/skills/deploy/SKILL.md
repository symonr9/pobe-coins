---
name: deploy
description: Deploy or change Pobe Coins infrastructure — SST v4 on AWS (DynamoDB, Lambda API, Cognito Google/Apple, S3, cron, budgets), secrets, stages, and the Netlify web/PWA site. Use for sst.config.ts, netlify.toml, secrets, environment variables or production releases of the backend/web.
---

# Deploy

**Always get the user's explicit OK before running a deploy or remove.** The settings file makes these commands ask first.

- The user deploys from **their own computer**; AWS credentials never go in the sandbox or the chat. Walk them through `docs/deploy/going-live.md`.
  - `npm run deploy:check` checks Node, AWS identity, `WEB_ORIGIN`, `AUTH_PREFIX` and the branch.
  - `npm run deploy:secrets -- --stage <s>` generates and stores DeviceTokenSecret and VAPID keys, and takes the Google client via a hidden prompt, piping values to `sst secret set` over stdin.
- `sst.config.ts` refuses to deploy without an https `WEB_ORIGIN`. `ALLOW_LOCAL_ORIGIN=1` overrides this for experiments.
- The deploy outputs (`api`, `authDomain`, `userPoolClientId`) aren't secret. When the user shares them, verify from the sandbox:
  - `curl <api>/health`
  - a CORS preflight: `curl -si -X OPTIONS <api>/me -H 'Origin: <WEB_ORIGIN>' -H 'Access-Control-Request-Method: GET'`

## Backend (SST, `sst.config.ts`)

- Stages: `dev` (personal) and `prod`. Each has its own table, user pool and bucket. `prod` is protected and retained on remove.
- Resources:
  - DynamoDB single table (pk/sk/gsi1, TTL `ttl`), S3 bucket (photos, exports with a lifecycle rule), Cognito (Google IdP; Apple when `ENABLE_APPLE=true`)
  - API Gateway v2 → one Lambda (`handlers/api.ts`, throttled), hourly cron (`handlers/cron.ts`), exporter function
  - AWS Budget alarm (`BUDGET_EMAIL`)
- Secrets via `npx sst secret set <Name> <value> --stage <stage>`: DeviceTokenSecret, VapidPublicKey/PrivateKey, GoogleClientId/Secret, optional ExpoAccessToken, and the Apple* keys. Never print or commit secret values.
- Deploy:
  ```bash
  WEB_ORIGIN=https://<site>.netlify.app BUDGET_EMAIL=<email> npx sst deploy --stage dev
  ```
  The outputs (`api`, `authDomain`, `userPoolClientId`) feed the app's `EXPO_PUBLIC_*` env.
- **Cost guardrails (keep them):** no VPC/NAT gateway, no RDS/Aurora, no Secrets Manager (SST secrets use SSM), on-demand DynamoDB, 14-day log retention, API throttling. Check any new resource against the free tier, and state its monthly cost in the PR or commit.
- After infra changes, update the README deploy section and `sst.config.ts` header docs if inputs changed.

## Web (Netlify, `netlify.toml`)

- Build: `npm run build:web -w @pobe/mobile` (Expo static export + `.well-known` + PWA service worker) → `apps/mobile/dist`.
- Env: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL`, `EXPO_PUBLIC_COGNITO_DOMAIN`, `EXPO_PUBLIC_COGNITO_CLIENT_ID`, `EXPO_PUBLIC_VAPID_PUBLIC_KEY`, and optionally `APPLE_TEAM_ID`/`ANDROID_SHA256` for app links.
- Dynamic routes need rewrites in `netlify.toml`. Add one when you add a `[param]` route.

## Checklist before prod

1. CI is green on the commit.
2. `npx sst diff --stage prod` has been reviewed with the user.
3. The Cognito callback URLs include the web origin and the app scheme.
4. Budget alarm email is set.
