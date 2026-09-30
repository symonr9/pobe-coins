import { useEffect } from 'react';
import { router } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { useSession } from '@/auth/session';

/**
 * "Share to Pobe Coins" from Amazon, Safari, Photos…: opens the Spend screen with the
 * link (and title) or the shared photo filled in.
 */
export function ShareIntentBridge() {
  const { active } = useSession();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: true });
  useEffect(() => {
    if (!hasShareIntent || !active) return;
    const url = shareIntent.webUrl ?? shareIntent.text?.match(/https?:\/\/\S+/)?.[0] ?? undefined;
    const title = shareIntent.meta?.title ?? (url ? undefined : shareIntent.text ?? undefined);
    const image = shareIntent.files?.find((f) => f.mimeType?.startsWith('image/'))?.path;
    router.push({ pathname: '/spend', params: { ...(url ? { url } : {}), ...(title ? { title } : {}), ...(image ? { image } : {}) } });
    resetShareIntent();
  }, [hasShareIntent, shareIntent, active, resetShareIntent]);
  return null;
}
