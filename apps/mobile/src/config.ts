/** Build-time configuration (see app.config.ts for the variables). */
const env = process.env;

export const API_URL = (env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
export const WEB_URL = (env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:8081').replace(/\/$/, '');
export const COGNITO_DOMAIN = (env.EXPO_PUBLIC_COGNITO_DOMAIN ?? '').replace(/\/$/, '');
export const COGNITO_CLIENT_ID = env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? '';
export const VAPID_PUBLIC_KEY = env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';
export const SENTRY_DSN = env.EXPO_PUBLIC_SENTRY_DSN ?? '';
export const POSTHOG_KEY = env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
/** Local development: sign in without Google/Apple against the dev API. */
export const DEV_AUTH = env.EXPO_PUBLIC_DEV_AUTH === '1' || (!COGNITO_DOMAIN && __DEV__);
export const OAUTH_ENABLED = !!COGNITO_DOMAIN && !!COGNITO_CLIENT_ID;
