import { useState } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING } from '@pobe/core';
import { DEV_AUTH, OAUTH_ENABLED } from '@/config';
import { useSignIn } from '@/auth/signin';
import { useTranslation } from '@/i18n';
import { usePrefs } from '@/lib/prefs-context';
import { useTheme } from '@/theme';
import { Chubby, Bubble } from '@/features/chubby/Chubby';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Card, Row, Screen, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';

export default function Welcome() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { prefs, update } = usePrefs();
  const [step, setStep] = useState(prefs.seenOnboarding ? ONBOARDING.length : 0);
  const [joinCode, setJoinCode] = useState('');
  const [devName, setDevName] = useState('Sam');
  const signIn = useSignIn();

  const done = async (p: Promise<unknown>) => {
    const profile = await p;
    if (profile) router.replace('/');
  };

  if (step < ONBOARDING.length) {
    const s = ONBOARDING[step]!;
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 20, paddingTop: 40 }}>
          <Animated.View key={step} entering={FadeInUp.springify().damping(14)}>
            <Chubby pose={s.pose} size={180} bounceKey={step} />
          </Animated.View>
          <Animated.View key={`t${step}`} entering={FadeIn.duration(250)} style={{ gap: 8, alignItems: 'center', maxWidth: 420 }}>
            <Text variant="h1" center>
              {t(s.title)}
            </Text>
            <Text center color="soft" style={{ fontSize: 17 }}>
              {t(s.body)}
            </Text>
          </Animated.View>
          <Row gap={6} accessibilityLabel={t('Step {{n}} of {{total}}', { n: step + 1, total: ONBOARDING.length })}>
            {ONBOARDING.map((_, i) => (
              <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? theme.c.accent : theme.c.line }} />
            ))}
          </Row>
          <Row>
            <Button kind="ghost" title={t('Skip')} onPress={() => (update({ seenOnboarding: true }), setStep(ONBOARDING.length))} />
            <Button
              title={step === ONBOARDING.length - 1 ? t("Let's go") : t('Next')}
              onPress={() => {
                if (step === ONBOARDING.length - 1) update({ seenOnboarding: true });
                setStep(step + 1);
              }}
            />
          </Row>
        </View>
      </Screen>
    );
  }

  const openJoin = () => {
    const token = joinCode.trim().split('/join/').pop()?.split(/[?#]/)[0];
    if (token) router.push({ pathname: '/join/[token]', params: { token } });
  };

  return (
    <Screen>
      <Stack gap={18} style={{ paddingTop: 24 }}>
        <Row style={{ alignItems: 'flex-end' }}>
          <Chubby pose="wave" size={120} />
          <View style={{ flex: 1, paddingBottom: 40 }}>
            <Bubble text={t('Welcome to Pobe Coins! How would you like to come in?')} />
          </View>
        </Row>
        <Card style={{ gap: 12 }}>
          <Text variant="h3">{t('Sign in')}</Text>
          <Text color="soft">{t('Start or manage a household with your Apple or Google account.')}</Text>
          {OAUTH_ENABLED ? (
            <>
              {Platform.OS === 'ios' ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={theme.dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={25}
                  style={{ height: 50 }}
                  onPress={() => done(signIn.apple())}
                />
              ) : (
                <Button kind="soft" title={t('Continue with Apple')} loading={signIn.busy === 'apple'} onPress={() => done(signIn.apple())} />
              )}
              <Button kind="soft" title={t('Continue with Google')} loading={signIn.busy === 'google'} onPress={() => done(signIn.google())} />
            </>
          ) : null}
          {DEV_AUTH ? (
            <Stack gap={8}>
              <Field label={t('Dev sign-in name')} value={devName} onChangeText={setDevName} hint={t('Local development only. Try "sam" or "alex" with the demo API.')} />
              <Button title={t('Dev sign-in')} loading={signIn.busy === 'dev'} onPress={() => done(signIn.dev(devName))} />
            </Stack>
          ) : null}
          {signIn.error ? <Text color="danger">{signIn.error}</Text> : null}
        </Card>
        <Card style={{ gap: 12 }}>
          <Text variant="h3">{t('Joining a household?')}</Text>
          <Text color="soft">{t('Ask your household admin for a join link or QR code. Scan it with your camera, or paste it here.')}</Text>
          <Field label={t('Join link')} value={joinCode} onChangeText={setJoinCode} placeholder="https://…/join/…" autoCapitalize="none" autoCorrect={false} />
          <Row wrap>
            <Button kind="secondary" title={t('Join')} onPress={openJoin} disabled={!joinCode.trim()} />
            {Platform.OS !== 'web' ? <Button kind="ghost" icon="qr" title={t('Scan QR code')} onPress={() => router.push('/scan')} /> : null}
          </Row>
        </Card>
        <Row style={{ justifyContent: 'center' }} gap={16}>
          <Button kind="ghost" small title={t('Privacy')} onPress={() => router.push('/privacy')} />
          <Button kind="ghost" small title={t('Terms')} onPress={() => router.push('/terms')} />
        </Row>
      </Stack>
    </Screen>
  );
}
