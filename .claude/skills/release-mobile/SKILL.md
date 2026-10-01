---
name: release-mobile
description: Build, test and ship the Pobe Coins iOS/Android apps with EAS — development builds, preview/TestFlight, store submission, over-the-air updates, and native features (widgets, share extension, alternate icons, notification actions, Face ID). Use for native config, store releases or native-only bugs.
---

# Mobile builds and releases (EAS)

Profiles are in `apps/mobile/eas.json`: `development` (dev client + dev sign-in), `preview` (internal) and `production` (auto-increment, store). Run commands from `apps/mobile/` as `npx eas-cli@latest ...`.

- First time: `npx eas-cli@latest init`, then set `EAS_PROJECT_ID` (it enables push tokens and OTA updates). Set the `EXPO_PUBLIC_*` values as EAS environment variables.
- Dev build: `npx eas-cli@latest build --profile development --platform ios|android`, then `npx expo start --dev-client`. Expo Go won't work, because the app uses native modules.
- Store build and submit: `build --profile production --platform all`, then `submit --profile production --platform ios|android`. **Ask the user before submitting.** Work through `docs/store/checklist.md` (privacy labels, data safety, review notes with a demo join link, screenshots).
- OTA: `npx eas-cli@latest update --channel production --message "..."`. JS and asset changes only; any native change (new module, plugin, permission, app.config native fields) needs a new build. Bump `version` when native code changes.

## Native features and where they live

- Config plugins in `app.config.ts`:
  - splash, notifications (action categories: Approve / Not yet), secure-store, apple-authentication, camera and image picker (permission strings), local-authentication (Face ID string)
  - `expo-share-intent` (share extension)
  - `expo-alternate-app-icons` (5 theme icons from `assets/icons/`)
  - `expo-widgets` (iOS `PurseWidget`), `react-native-android-widget`
- iOS widget: `src/widgets/PurseWidget.ios.tsx`. The layout **must** be a `function` declaration with the `'widget'` directive (the Babel plugin stringifies it); arrow functions break it. Data comes from `WidgetSync` → `snapshot.ts`.
- Android widget: `src/widgets/android/`. The task handler is registered in `index.js`.
- Verify native changes without a device:
  ```bash
  cd apps/mobile
  npx expo export -p ios -p android                  # Hermes bundles compile
  npx expo prebuild --clean --no-install             # targets, entitlements, icons generated; inspect, then:
  rm -rf ios android                                 # never commit native dirs
  ```
- Push: Expo push tokens need `EAS_PROJECT_ID` and, on the server, optionally `ExpoAccessToken`. The iOS simulator can't receive remote push.
