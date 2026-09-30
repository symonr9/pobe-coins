import '@/i18n';
import { useEffect, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/auth/session';
import { PrefsProvider, usePrefs } from '@/lib/prefs-context';
import { setFeedbackPrefs } from '@/lib/feedback';
import { ThemeProvider, useTheme } from '@/theme';
import { useMe } from '@/api/hooks';
import { hasHousehold } from '@/api/types';
import { FeedbackProvider } from '@/ui/Feedback';
import { CelebrationProvider } from '@/features/celebrate';
import { PushBridge } from '@/push/PushBridge';
import { ShareIntentBridge } from '@/features/share/ShareIntentBridge';
import { WidgetSync } from '@/widgets/WidgetSync';
import { initMonitoring } from '@/lib/monitoring';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
initMonitoring();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 24 * 3600_000,
      retry: (count, err) => count < 2 && (err as { status?: number }).status !== 401 && (err as { status?: number }).status !== 403,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'online' },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'pobe.cache', throttleTime: 2000 });

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);
  if (!fontsLoaded && Platform.OS !== 'web') return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 7 * 24 * 3600_000, buster: 'v1' }}>
          <PrefsProvider>
            <SessionProvider onSwitch={() => queryClient.clear()}>
              <Themed>
                <FeedbackProvider>
                  <CelebrationProvider>
                    <PushBridge />
                    <ShareIntentBridge />
                    <WidgetSync />
                    <AppStack />
                  </CelebrationProvider>
                </FeedbackProvider>
              </Themed>
            </SessionProvider>
          </PrefsProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Themed({ children }: { children: ReactNode }) {
  const me = useMe();
  const { prefs } = usePrefs();
  useEffect(() => setFeedbackPrefs(prefs), [prefs]);
  const theme = hasHousehold(me.data) ? me.data.member.theme : undefined;
  return <ThemeProvider name={theme}>{children}</ThemeProvider>;
}

function AppStack() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="spend" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="task/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="goal/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="gift" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="wrapped/[period]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
    </View>
  );
}
