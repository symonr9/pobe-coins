---
name: dev-setup
description: Run Pobe Coins locally: install dependencies, start the in-memory API with the demo household, start the Expo web app, and sign in. Use when starting work, when servers are down, or when installs or Metro misbehave.
---

# Run Pobe Coins locally

No AWS account is needed. The dev API keeps everything in memory.

1. **Install** with npm 11. npm 10 crashes on this workspace with "Cannot read properties of null (reading 'edgesOut')".
   ```bash
   npx -y npm@11.20.0 ci
   ```
2. **API** (background it, and keep the log):
   ```bash
   SEED=1 npm run dev:api          # http://localhost:3001, demo household "The Cozy Burrow"
   curl -s localhost:3001/health   # {"ok":true,...}
   ```
   The demo members are **sam** (admin) and **alex**. `POST /dev-token {name}` issues a token, and push notifications are printed to the console.
3. **Web app:**
   ```bash
   EXPO_NO_TELEMETRY=1 npm run dev:web     # http://localhost:8081
   ```
   Don't set `CI=1`, because it turns off file watching. In a sandbox without Expo network access, add `EXPO_OFFLINE=1`. Start it with stdin from `/dev/null` when backgrounding.
4. **Sign in:** on the Welcome screen, tap "Skip" and then "Dev sign-in" with the name `sam` or `alex`.
5. **Phone:** native features (widgets, share extension, Face ID) need a development build, not Expo Go. See the `release-mobile` skill.

## Troubleshooting

- A port is busy: `fuser -k 3001/tcp` / `fuser -k 8081/tcp`. Don't use `pkill -f node`, which can kill your own shell.
- Typed-route errors for a new screen: restart `expo start` so `.expo/types/router.d.ts` regenerates.
- The API state is lost on restart (it's in memory). Restart with `SEED=1` to get the demo data back.
- Env for the app comes from `EXPO_PUBLIC_*` (see `apps/mobile/src/config.ts`). Locally it defaults to the dev API on :3001.
