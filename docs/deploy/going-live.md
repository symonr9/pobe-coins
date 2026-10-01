# Going live: AWS + Netlify, step by step

This puts Pobe Coins on real infrastructure: the API and data on **AWS** (region **us-west-2**, deployed with SST from your computer) and the web app / PWA on **Netlify**. Allow about an hour the first time. Every command runs on **your computer**, in the repo folder.

The steps go in this order for a reason. SST needs to know the web app's URL, for CORS and the sign-in redirect, and Netlify needs SST's outputs (the API URL and the Cognito ids). So the order is: reserve the Netlify name → deploy AWS → give Netlify the outputs → rebuild.

We deploy stage **`dev`** first as a rehearsal, which is easy to delete. Then we deploy **`prod`** for real household data, which is protected from accidental deletion.

**Values used below.** Swap in your own:

| Placeholder | Example          | What it is                                                        |
| ----------- | ---------------- | ----------------------------------------------------------------- |
| `<site>`    | `pobe-coins-sam` | Your Netlify site name → `https://<site>.netlify.app`             |
| `<you>`     | `sam`            | Short and unique: used in the sign-in domain `pobe-<you>-<stage>` |
| `<email>`   | you@example.com  | Where AWS spending alerts go                                      |

---

> **Interactive version:** a checklist that fills in your values and remembers your ticks: https://claude.ai/artifact/9bADFyu2SuCE7M3XtGc9Ze (private to your Claude account).

## Keeping secrets safe (the repo is public)

| Safe to share / paste into chat                                | Never share or commit                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `sst deploy` outputs (`api`, `authDomain`, `userPoolClientId`) | AWS access keys (they stay in `~/.aws` on your computer)          |
| Your Netlify URL, the VAPID **public** key                     | The Google **client secret** (it goes only into `deploy:secrets`) |
| Error messages and screenshots of the app                      | `.env` files and anything from `sst secret list`                  |

- `npm run deploy:secrets` stores secrets in AWS (SSM, encrypted) and never writes them to disk or the repo.
- CI and `npm run check:secrets` fail if anything credential-shaped is committed.
- Also turn on GitHub's own protection: repo **Settings → Code security → Secret scanning** and **Push protection**. It's free for public repos and blocks a push that contains a known key format.

## 0. On your computer (once)

- **Node 22+** (`node -v`) and **git**.
- **AWS CLI v2**: https://aws.amazon.com/cli/ (`aws --version`).
- Clone the repo and install:
  ```bash
  git clone https://github.com/symonr9/pobe-coins.git && cd pobe-coins
  npx -y npm@11.20.0 ci
  ```

## 1. AWS account (browser, ~10 min)

1. Sign in to the AWS console as the root user, then open **Security credentials** and turn on **MFA**.
2. Go to **IAM** → **Users** → **Create user**, and name it `pobe-deployer`. Choose **Attach policies directly** → `AdministratorAccess`, then create the user. SST needs broad rights to create resources; you can tighten this later.
3. Open the user → **Security credentials** → **Create access key**, and choose **Command Line Interface (CLI)**. Keep the tab open.
4. In your terminal, run the following and paste the two keys when asked:
   ```bash
   aws configure --profile pobe
   # AWS Access Key ID / Secret Access Key: from step 3
   # Default region name: us-west-2
   # Default output format: json
   ```
   Close the browser tab. The keys now live only in `~/.aws/credentials` on your computer. **Never share them, even with Claude.**

## 2. Netlify site (browser, ~5 min)

1. Go to https://app.netlify.com → **Add new site** → **Import an existing project** → GitHub → `symonr9/pobe-coins`.
2. Set the branch to **`main`**. The build settings come from `netlify.toml`, so leave them as they are. Click **Deploy**. The first build either fails or builds an app pointing at localhost; that's expected.
3. Go to **Site configuration** → **Change site name** → `<site>`. Your URL is `https://<site>.netlify.app`.

## 3. Google sign-in (browser, ~10 min)

1. Go to https://console.cloud.google.com and create a project called **Pobe Coins**.
2. Open **APIs & Services** → **OAuth consent screen** and set it up:
   - User type: **External**.
   - App name: Pobe Coins. Add your email.
   - Leave it in **Testing** and add **both of your Google emails** under _Test users_. Testing mode needs no Google review.
3. Go to **Credentials** → **Create credentials** → **OAuth client ID** → **Web application**. Add these under **Authorized redirect URIs**:
   ```
   https://pobe-<you>-dev.auth.us-west-2.amazoncognito.com/oauth2/idpresponse
   https://pobe-<you>-prod.auth.us-west-2.amazoncognito.com/oauth2/idpresponse
   ```
4. Keep the **Client ID** and **Client secret** handy for step 4.

## 4. Deploy the backend: stage `dev` (terminal, ~15 min)

```bash
git pull
export AWS_PROFILE=pobe AWS_REGION=us-west-2
export WEB_ORIGIN=https://<site>.netlify.app AUTH_PREFIX=pobe-<you>-dev BUDGET_EMAIL=<email>

npm run deploy:check                          # every line should be ✓ (or a harmless !)
npm run deploy:secrets -- --stage dev         # paste the Google client ID + secret (hidden)
npx sst deploy --stage dev
```

**Windows (PowerShell):** set the variables like this instead of `export`, then run the same three npm/npx commands. They only last for that PowerShell window, so keep it open.

```powershell
git pull
$env:AWS_PROFILE = "pobe"; $env:AWS_REGION = "us-west-2"
$env:WEB_ORIGIN = "https://<site>.netlify.app"; $env:AUTH_PREFIX = "pobe-<you>-dev"; $env:BUDGET_EMAIL = "<email>"
```

- `deploy:secrets` prints `EXPO_PUBLIC_VAPID_PUBLIC_KEY=…`. Copy it for step 5. It's not secret.
- The first deploy downloads SST's engine and takes a while. At the end it prints outputs like:
  ```
  api:              https://abc123.execute-api.us-west-2.amazonaws.com
  authDomain:       https://pobe-<you>-dev.auth.us-west-2.amazoncognito.com
  userPoolClientId: 1a2b3c…
  ```
  These aren't secret. Paste them to Claude so it can check the API from its side.
- Budget alert: AWS emails `<email>` to confirm the subscription. Click the link.

## 5. Point Netlify at the backend (browser, ~5 min)

1. Go to **Site configuration** → **Environment variables** and add:

   | Key                             | Value                        |
   | ------------------------------- | ---------------------------- |
   | `EXPO_PUBLIC_API_URL`           | `api` output                 |
   | `EXPO_PUBLIC_WEB_URL`           | `https://<site>.netlify.app` |
   | `EXPO_PUBLIC_COGNITO_DOMAIN`    | `authDomain` output          |
   | `EXPO_PUBLIC_COGNITO_CLIENT_ID` | `userPoolClientId` output    |
   | `EXPO_PUBLIC_VAPID_PUBLIC_KEY`  | from `deploy:secrets`        |

2. Go to **Deploys** → **Trigger deploy** → **Deploy site**. It takes about 3 minutes.

## 6. Try it (phones + laptop)

1. Open `https://<site>.netlify.app`, choose **Sign in with Google**, and create your household.
2. Go to **Admin** → add your partner → **Join QR/link**, then open it on their phone.
3. On each phone, add the app to the home screen:
   - **iPhone:** Safari → Share → **Add to Home Screen**. Open Pobe from the home screen, then turn on notifications. iOS only allows web push for home-screen apps.
   - **Android:** Chrome menu → **Install app**.
4. Complete a chore → coins arrive → buy something from the shop → check the timeline. When a chore needs approval, the other person should get a notification.

If something goes wrong, tell Claude what you did and what you saw (a screenshot helps). To read the API logs:

```bash
# find the API function's log group (its name ends in a random suffix)
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/pobe-coins-dev --query 'logGroups[].logGroupName' --profile pobe --region us-west-2
# then follow it
aws logs tail <log-group-name> --since 15m --follow --profile pobe --region us-west-2
```

## 7. Go to `prod`, then delete `dev`

Once dev works end to end:

```bash
export AUTH_PREFIX=pobe-<you>-prod
npm run deploy:check
npm run deploy:secrets -- --stage prod        # new keys + the same Google client
npx sst deploy --stage prod
```

On Windows: `$env:AUTH_PREFIX = "pobe-<you>-prod"` instead of the `export` line.

1. In Netlify, replace the five variables with the **prod** outputs and the new VAPID public key, then trigger a deploy.
2. Sign in again and create your real household. Dev data doesn't carry over.
3. When you're happy, run `npx sst remove --stage dev` to delete the rehearsal stage.

`prod` is protected: `sst remove --stage prod` refuses, and the table and bucket are retained even if the stack is deleted.

## What it costs

For one household, expect about **$0–1/month**. Everything is pay-per-use and within the free tier. You'll get an email from the Budget alarm at $5 and $20. Check **Billing → Bills** after the first week.

## Later

- **Phone apps:** EAS builds and TestFlight (see skill `release-mobile` / README "Phone apps").
- **Sign in with Apple:** needs an Apple Services ID and key; then redeploy with `ENABLE_APPLE=true` and add `EXPO_PUBLIC_APPLE_ENABLED=1` in Netlify to show the Apple button on the web. (The iPhone app always offers Apple, using the native sheet.)
- **Custom domain:** add it in Netlify, then redeploy SST with the new `WEB_ORIGIN`. Add the new Cognito redirect URI in Google if `AUTH_PREFIX` changes.
