import { useEffect } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Screen } from '@/ui/layout';
import { Loading } from '@/ui/bits';

WebBrowser.maybeCompleteAuthSession();

/** OAuth redirect target. On web the sign-in popup lands here and hands the code back. */
export default function AuthCallback() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace('/'), 2500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Screen>
      <Loading label="Signing you in…" />
    </Screen>
  );
}
