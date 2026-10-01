/**
 * Optional crash reporting (Sentry) and privacy-friendly analytics (PostHog).
 * Both are off unless their keys are configured, and analytics respects the in-app opt-out.
 * No personal data is sent: events carry only a name and a few counts.
 */
import * as Sentry from '@sentry/react-native';
import { POSTHOG_KEY, SENTRY_DSN } from '@/config';
import { loadPrefs } from './prefs';

let posthog: { capture: (e: string, p?: Record<string, unknown>) => void; optOut?: () => void } | null = null;
let analyticsOn = true;

export function initMonitoring() {
  if (SENTRY_DSN) {
    Sentry.init({ dsn: SENTRY_DSN, sendDefaultPii: false, tracesSampleRate: 0.1, enableAutoSessionTracking: true });
  }
  void loadPrefs().then(async (p) => {
    analyticsOn = p.analytics;
    if (!POSTHOG_KEY || !analyticsOn) return;
    const { default: PostHog } = await import('posthog-react-native');
    const client = new PostHog(POSTHOG_KEY, { host: 'https://us.i.posthog.com', disableGeoip: true, captureAppLifecycleEvents: true });
    posthog = { capture: (e, props) => client.capture(e, props as never) };
  });
}

export function track(event: string, props?: Record<string, number | string | boolean>) {
  if (analyticsOn) posthog?.capture(event, props);
}

export function setAnalytics(on: boolean) {
  analyticsOn = on;
}

export function reportError(err: unknown) {
  if (SENTRY_DSN) Sentry.captureException(err);
}
