---
name: expo-upgrade
description: Add, upgrade or fix dependencies in the Pobe Coins monorepo — Expo SDK upgrades, Expo/React Native packages, and npm workspace installs (npm 11 only), including when the sandbox can't reach Expo's servers. Use for package.json changes, version mismatches, or install errors.
---

# Dependencies and Expo upgrades

- **Always npm 11:** `npx -y npm@11.20.0 install <pkg>@<ver> -w <workspace>`. npm 10 crashes on this tree. Workspaces are `@pobe/core`, `@pobe/functions` and `@pobe/mobile`, plus root devDeps.
- **Expo and React Native packages must match the SDK.** Prefer `cd apps/mobile && npx expo install <pkg>`. If Expo's API is unreachable (cloud sandbox), read the exact version from `node_modules/expo/bundledNativeModules.json` and install that version with npm 11.
- `packages/core` must stay dependency-light and platform-neutral (it runs in Lambda, Hermes and browsers). Its only runtime dependency is zod.
- Never commit `ios/` or `android/`. Native changes come from config plugins in `app.config.ts`.

## Expo SDK upgrade

1. Read the SDK changelog/upgrade guide for the target version, if reachable. Don't trust memory: APIs move every SDK.
2. `npx -y npm@11.20.0 install expo@^<N>.0.0 -w @pobe/mobile`, then align every Expo, RN and react package to the new `bundledNativeModules.json`. `npx expo install --fix` does this when online.
3. Check the known sensitive spots:
   - `expo-router/js-tabs` import paths
   - `expo-widgets` / `@expo/ui` APIs
   - `react-native-reanimated` / worklets Babel config
   - `expo-share-intent` and `expo-alternate-app-icons` plugin compatibility
   - the `react-native-svg` `SvgXml` behavior
4. Run the full `verify` skill: tests, typecheck, web build, `expo export -p ios -p android`, a throwaway prebuild, and a screenshot tour.
5. Update `docs/PLAN.md` build status and `README.md` (the SDK number appears in both).

After any install, commit `package-lock.json` with the change. Don't hand-edit it; regenerate it with npm 11.
