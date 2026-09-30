# App Store & Play Store checklist

These are drafts for the owner to review. Legal text (`apps/mobile/src/features/Legal.tsx`) needs the operator's name and contact email before submission.

## Both stores
- [ ] Privacy policy URL: `https://<site>/privacy` (the web app serves it)
- [ ] Support URL / email
- [ ] Screenshots: Home (purse), Chores, POBE Shop, Timeline, Wrapped, widget
- [ ] Review notes: "Sign in with Apple or Google, or use this demo join link: <create one in Admin → Members → Create join code, valid 7 days>"
- [ ] Confirm coins can't be bought: there are no in-app purchases and coins have no cash value (see Terms)
- [ ] In-app account deletion: Settings → Delete my account ✅

## Apple App Store
- [ ] Apple Developer Program membership; bundle id `app.pobecoins` (or your own via `IOS_BUNDLE_ID`)
- [ ] Capabilities: Sign in with Apple, Push Notifications, App Groups (`group.<bundle id>`), Associated Domains (`applinks:<site>`)
- [ ] Sign in with Apple is offered next to Google ✅ (guideline 4.8)
- [ ] Native features beyond a website ✅ (guideline 4.2): widgets, share extension, push actions, Face ID
- [ ] **App Privacy ("nutrition label")** answers:
  - Contact info (email, name): collected, linked to the user, used for app functionality only
  - User content (photos, other content such as chores, purchases and comments): collected, linked, app functionality
  - Identifiers (user id): collected, linked, app functionality
  - Diagnostics (crash data): collected, not linked, app functionality (only if Sentry is enabled)
  - Usage data (product interaction): collected, not linked, analytics (only if PostHog is enabled; users can opt out)
  - Tracking: **No**
- [ ] Age rating: 4+ (no objectionable content). User-generated content is limited to private households.

## Google Play
- [ ] Google Play Console account ($25); package `app.pobecoins`
- [ ] New personal accounts: **closed test with 12+ testers for 14 days** before production
- [ ] **Data safety** form:
  - Data collected: name, email, user ids, photos, app activity (in-app actions), crash logs (if enabled)
  - Data shared with third parties: **No**
  - Encrypted in transit: **Yes**
  - Users can request deletion: **Yes** (in-app, plus contact email)
- [ ] App access: provide a join link for reviewers (as above)
- [ ] Target audience: 13+ (not designed for children)
- [ ] App links: set `ANDROID_SHA256` on Netlify to the Play app signing SHA-256 so `/join/…` links open the app

## After launch
- [ ] Create an EAS Update channel per build profile; ship JS fixes with `eas update`
- [ ] Keep an eye on the AWS Budgets alarm email
