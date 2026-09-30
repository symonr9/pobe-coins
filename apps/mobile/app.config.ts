import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Pobe Coins app config. Environment (EXPO_PUBLIC_* are embedded in the app):
 *   EXPO_PUBLIC_API_URL             API base URL (sst output `api`), default http://localhost:3001
 *   EXPO_PUBLIC_WEB_URL             where the web app lives (for join links / universal links)
 *   EXPO_PUBLIC_COGNITO_DOMAIN      e.g. https://pobe-coins-prod.auth.us-west-2.amazoncognito.com
 *   EXPO_PUBLIC_COGNITO_CLIENT_ID   sst output `userPoolClientId`
 *   EXPO_PUBLIC_VAPID_PUBLIC_KEY    Web Push public key
 *   EXPO_PUBLIC_DEV_AUTH=1          show "Dev sign-in" (local dev API only)
 *   EXPO_PUBLIC_SENTRY_DSN, EXPO_PUBLIC_POSTHOG_KEY  optional crash reporting / analytics
 *   EAS_PROJECT_ID                  from `eas init` (enables push tokens + OTA updates)
 *   IOS_BUNDLE_ID / ANDROID_PACKAGE default app.pobecoins
 */
const THEMES = {
  Pink: '#F9B9CD',
  Blue: '#AAD3F4',
  Purple: '#CFBCF5',
  Yellow: '#FBE08C',
  Green: '#AEE1BD',
} as const;

export default ({ config }: ConfigContext): ExpoConfig => {
  const bundleId = process.env.IOS_BUNDLE_ID ?? 'app.pobecoins';
  const androidPackage = process.env.ANDROID_PACKAGE ?? 'app.pobecoins';
  const webHost = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://pobecoins.netlify.app').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const projectId = process.env.EAS_PROJECT_ID;
  const appGroup = `group.${bundleId}`;

  return {
    ...config,
    name: 'Pobe Coins',
    slug: 'pobe-coins',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'pobecoins',
    icon: './assets/icons/icon-pink.png',
    userInterfaceStyle: 'automatic',
    runtimeVersion: { policy: 'appVersion' },
    updates: projectId ? { url: `https://u.expo.dev/${projectId}` } : undefined,
    ios: {
      bundleIdentifier: bundleId,
      supportsTablet: true,
      usesAppleSignIn: true,
      associatedDomains: [`applinks:${webHost}`],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      entitlements: { 'com.apple.security.application-groups': [appGroup] },
    },
    android: {
      package: androidPackage,
      adaptiveIcon: { foregroundImage: './assets/icons/adaptive-foreground.png', backgroundColor: THEMES.Pink },
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: webHost, pathPrefix: '/join' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/icons/favicon.png',
      name: 'Pobe Coins',
      shortName: 'Pobe',
      themeColor: THEMES.Pink,
      backgroundColor: '#FFF5F8',
    },
    plugins: [
      'expo-router',
      ['expo-splash-screen', { backgroundColor: '#FFF5F8', image: './assets/icons/splash.png', imageWidth: 180, dark: { backgroundColor: '#1E1418' } }],
      ['expo-notifications', { icon: './assets/icons/notification.png', color: '#B83E6A', sounds: ['./assets/sounds/coin.wav'] }],
      'expo-secure-store',
      'expo-apple-authentication',
      'expo-localization',
      'expo-web-browser',
      ['expo-camera', { cameraPermission: 'Pobe Coins uses the camera to scan join codes and photograph purchases.', recordAudioAndroid: false }],
      ['expo-image-picker', { photosPermission: 'Pobe Coins lets you attach photos of things you bought.', cameraPermission: 'Pobe Coins uses the camera to photograph purchases.' }],
      ['expo-local-authentication', { faceIDPermission: 'Pobe Coins can confirm spending with Face ID.' }],
      ['expo-font', {}],
      'expo-audio',
      [
        'expo-share-intent',
        {
          iosActivationRules: { NSExtensionActivationSupportsWebURLWithMaxCount: 1, NSExtensionActivationSupportsText: true, NSExtensionActivationSupportsImageWithMaxCount: 1 },
          androidIntentFilters: ['text/*', 'image/*'],
          iosAppGroupIdentifier: appGroup,
        },
      ],
      [
        'expo-alternate-app-icons',
        Object.entries(THEMES).map(([name, color]) => ({
          name,
          ios: `./assets/icons/icon-${name.toLowerCase()}.png`,
          android: { foregroundImage: './assets/icons/adaptive-foreground.png', backgroundColor: color },
        })),
      ],
      [
        'expo-widgets',
        {
          groupIdentifier: appGroup,
          widgets: [
            {
              name: 'PurseWidget',
              displayName: 'My purse',
              description: 'Your coins and today\'s chores, with Chubbybara.',
              supportedFamilies: ['systemSmall', 'systemMedium', 'accessoryRectangular'],
              contentMarginsDisabled: false,
            },
          ],
        },
      ],
      [
        'react-native-android-widget',
        {
          widgets: [
            {
              name: 'PurseWidget',
              label: 'My purse',
              description: 'Your coins and today\'s chores',
              minWidth: '180dp',
              minHeight: '110dp',
              targetCellWidth: 3,
              targetCellHeight: 2,
              resizeMode: 'horizontal|vertical',
              updatePeriodMillis: 1_800_000,
              previewImage: './assets/icons/icon-pink.png',
            },
          ],
        },
      ],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: {
      eas: projectId ? { projectId } : undefined,
      router: {},
    },
  };
};
