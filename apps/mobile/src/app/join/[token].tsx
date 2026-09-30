import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Device from 'expo-device';
import { api, ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { useTranslation } from '@/i18n';
import { Chubby, Bubble } from '@/features/chubby/Chubby';
import { Button } from '@/ui/Button';
import { Screen, Stack } from '@/ui/layout';
import { Loading } from '@/ui/bits';

/** Redeems a one-time join link (opened from a QR code, link or deep link). */
export default function Join() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const session = useSession();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !session.ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const label = Platform.OS === 'web' ? 'Web browser' : (Device.deviceName ?? Device.modelName ?? 'Phone');
        const r = await api<any>('POST', '/links/redeem', { token, deviceLabel: label, platform: Platform.OS === 'web' ? 'web' : Platform.OS }, { token: null });
        if (cancelled) return;
        await session.addProfile(
          { kind: 'device', name: r.session.member.name, householdId: r.session.household.id, householdName: r.session.household.name, memberId: r.session.member.id },
          r.token,
        );
        setWelcome(t('Welcome to {{household}}, {{name}}!', { household: r.session.household.name, name: r.session.member.name }));
        setTimeout(() => router.replace('/'), 1400);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t('That link didn\'t work.'));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, session.ready]);

  return (
    <Screen>
      <Stack gap={16} style={{ alignItems: 'center', paddingTop: 60 }}>
        <Chubby pose={error ? 'thinking' : welcome ? 'cheer' : 'wave'} size={160} bounceKey={welcome} />
        {error ? (
          <>
            <Bubble text={error} tail="bottom" />
            <Button title={t('Back')} kind="soft" onPress={() => router.replace('/welcome')} />
          </>
        ) : welcome ? (
          <Bubble text={welcome} tail="bottom" />
        ) : (
          <Loading label={t('Joining your household…')} />
        )}
      </Stack>
    </Screen>
  );
}
