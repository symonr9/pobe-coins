/**
 * Build-time configuration (see app.config.ts for the variables).
 * Always write `process.env.EXPO_PUBLIC_X` literally: Expo inlines only that exact form at build
 * time, so aliasing `process.env` leaves every value undefined in production bundles.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:8081').replace(/\/$/, '');
export const COGNITO_DOMAIN = (process.env.EXPO_PUBLIC_COGNITO_DOMAIN ?? '').replace(/\/$/, '');
export const COGNITO_CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? '';
export const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
/** Local development: sign in without Google/Apple against the dev API. */
export const DEV_AUTH = process.env.EXPO_PUBLIC_DEV_AUTH === '1' || (!COGNITO_DOMAIN && __DEV__);
export const OAUTH_ENABLED = !!COGNITO_DOMAIN && !!COGNITO_CLIENT_ID;
/**
 * Apple through the Cognito hosted UI (web, Android). Set to 1 only after deploying with
 * ENABLE_APPLE=true. iOS always offers Apple: it uses the native sheet, verified by the API directly.
 */
export const APPLE_WEB_ENABLED = process.env.EXPO_PUBLIC_APPLE_ENABLED === '1';
