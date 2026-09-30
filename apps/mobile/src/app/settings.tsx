import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';
import { useMutation } from '@tanstack/react-query';
import { THEMES, THEME_NAMES, type ThemeName } from '@pobe/core';
import { actions, useRefreshAll } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { providerIdToken } from '@/auth/signin';
import { OAUTH_ENABLED } from '@/config';
import { useTranslation } from '@/i18n';
import { usePrefs } from '@/lib/prefs-context';
import { biometricAvailable } from '@/lib/biometric';
import { setAnalytics } from '@/lib/monitoring';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { enablePush, pushPermission, pushSupport } from '@/push';
import { Button } from '@/ui/Button';
import { Field, ListRow, Segmented, ToggleRow } from '@/ui/Field';
import { Header } from '@/ui/bits';
import { Card, Row, Screen, Section, Stack } from '@/ui/layout';
import { Pressy } from '@/ui/Pressy';
import { Text } from '@/ui/Text';
import { useFeedback } from '@/ui/Feedback';

export default function Settings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const session = useSession();
  const refresh = useRefreshAll();
  const { prefs, update } = usePrefs();
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState(hh.me?.name ?? '');
  const [push, setPush] = useState<string>('…');
  const [bio, setBio] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (hh.me?.name) setName(hh.me.name);
  }, [hh.me?.name]);

  useEffect(() => {
    void pushPermission().then(setPush);
    void biometricAvailable().then(setBio);
  }, []);

  const saveMember = useMutation({
    mutationFn: (v: Record<string, unknown>) => actions.updateMember({ id: hh.me!.id, ...v }),
    onError: (e) => toast(e instanceof ApiError ? e.message : t('Couldn\'t save.'), 'error'),
    onSettled: () => refresh(),
  });

  const pickTheme = async (name: ThemeName) => {
    saveMember.mutate({ theme: name });
    if (Platform.OS !== 'web' && supportsAlternateIcons) {
      await setAlternateAppIcon(name === 'pink' ? null : name[0]!.toUpperCase() + name.slice(1)).catch(() => undefined);
    }
  };

  const link = async (provider: 'google' | 'apple') => {
    try {
      const token = await providerIdToken(provider);
      if (!token) return;
      await actions.linkAccount(token);
      toast(t('Linked! You can now sign in with {{p}} on any device.', { p: provider === 'google' ? 'Google' : 'Apple' }), 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('Linking didn\'t finish.'), 'error');
    }
  };

  return (
    <Screen>
      <Header title={t('Settings')} />
      <Section title={t('You')}>
        <Card style={{ gap: 12 }}>
          <Field
            label={t('Display name')}
            value={name}
            onChangeText={setName}
            maxLength={40}
            right={<Button small kind="soft" title={t('Save')} disabled={!name.trim() || name === hh.me?.name} onPress={() => saveMember.mutate({ name: name.trim() })} />}
          />
        </Card>
      </Section>

      <Section title={t('Theme')}>
        <Card style={{ gap: 14 }}>
          <Row wrap gap={10}>
            {THEME_NAMES.map((n) => {
              const on = theme.name === n;
              return (
                <Pressy
                  key={n}
                  onPress={() => pickTheme(n)}
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={THEMES[n].label}
                  style={{ alignItems: 'center', gap: 6, width: 86 }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 18,
                      backgroundColor: THEMES[n].light.primary,
                      borderWidth: on ? 3 : 1.5,
                      borderColor: on ? theme.c.accent : theme.c.line,
                    }}
                  />
                  <Text variant="small" center numberOfLines={2} color={on ? 'ink' : 'soft'}>
                    {t(THEMES[n].label)}
                  </Text>
                </Pressy>
              );
            })}
          </Row>
          {Platform.OS !== 'web' && supportsAlternateIcons ? <Text variant="small" color="soft">{t('The app icon changes to match.')}</Text> : null}
          <Segmented
            value={prefs.mode}
            onChange={(mode) => update({ mode })}
            options={[
              { value: 'system', label: t('Auto') },
              { value: 'light', label: t('Light') },
              { value: 'dark', label: t('Dark') },
            ]}
          />
          <ToggleRow label={t('Sounds')} hint={t('Cha-ching when coins arrive')} value={prefs.sounds} onChange={(sounds) => update({ sounds })} />
          {Platform.OS !== 'web' ? <ToggleRow label={t('Haptics')} value={prefs.haptics} onChange={(haptics) => update({ haptics })} /> : null}
        </Card>
      </Section>

      <Section title={t('Notifications')}>
        <Card style={{ gap: 10 }}>
          {pushSupport() === 'web-needs-install' ? (
            <Text color="soft">{t('On iPhone, add Pobe to your Home Screen (Share → Add to Home Screen) and open it from there to get notifications.')}</Text>
          ) : pushSupport() === 'unsupported' ? (
            <Text color="soft">{t('This browser doesn\'t support notifications.')}</Text>
          ) : push === 'granted' ? (
            <Stack gap={8}>
              <Text>✅ {t('Notifications are on for this device.')}</Text>
              <Button small kind="ghost" title={t('Re-register this device')} onPress={() => enablePush().then((ok) => toast(ok ? t('Done') : t('Couldn\'t register.')))} />
            </Stack>
          ) : (
            <Stack gap={8}>
              <Text color="soft">{push === 'denied' ? t('Notifications are blocked. Turn them on in your device settings.') : t('Get a nudge for approvals, gifts and due chores.')}</Text>
              {push !== 'denied' ? <Button small icon="bell" title={t('Turn on notifications')} onPress={() => enablePush().then((ok) => (setPush(ok ? 'granted' : 'denied'), toast(ok ? t('Notifications are on.') : t('Notifications are off.'))))} /> : null}
            </Stack>
          )}
        </Card>
      </Section>

      <Section title={t('Security')}>
        <Card>
          {bio ? (
            <ToggleRow label={t('Confirm spending with Face ID / fingerprint')} value={prefs.biometricSpend} onChange={(biometricSpend) => update({ biometricSpend })} />
          ) : (
            <Text color="soft">{t('Face ID / fingerprint confirmation is available in the phone apps.')}</Text>
          )}
        </Card>
      </Section>

      <Section title={t('Calendar')}>
        <Card style={{ gap: 10 }}>
          <Text color="soft">{t('Subscribe to your chores in Google or Apple Calendar with a private link.')}</Text>
          {calendarUrl ? (
            <Stack gap={8}>
              <Text variant="small" selectable>
                {calendarUrl}
              </Text>
              <Row wrap>
                <Button small kind="soft" title={t('Copy link')} onPress={() => Clipboard.setStringAsync(calendarUrl).then(() => toast(t('Copied')))} />
                <Button small kind="ghost" title={t('Turn off')} onPress={() => actions.removeCalendar().then(() => (setCalendarUrl(null), toast(t('Calendar link turned off'))))} />
              </Row>
            </Stack>
          ) : (
            <Button small icon="calendar" title={t('Create calendar link')} onPress={() => actions.calendar().then((r) => setCalendarUrl(r.url))} />
          )}
        </Card>
      </Section>

      {session.active?.kind === 'device' && OAUTH_ENABLED ? (
        <Section title={t('Sign-in')}>
          <Card style={{ gap: 10 }}>
            <Text color="soft">{t('You joined with a link. Link your Apple or Google account to sign in on new devices without a new link.')}</Text>
            <Row wrap>
              <Button small kind="soft" title={t('Link Apple')} onPress={() => link('apple')} />
              <Button small kind="soft" title={t('Link Google')} onPress={() => link('google')} />
            </Row>
          </Card>
        </Section>
      ) : null}

      <Section title={t('Privacy')}>
        <Card style={{ paddingVertical: 6 }}>
          <ToggleRow
            label={t('Share anonymous usage stats')}
            hint={t('Helps improve the app. Never includes names, chores or purchases.')}
            value={prefs.analytics}
            onChange={(analytics) => (update({ analytics }), setAnalytics(analytics))}
          />
          <ListRow icon="shield" title={t('Privacy policy')} onPress={() => router.push('/privacy')} />
          <ListRow icon="help" title={t('Terms')} onPress={() => router.push('/terms')} />
        </Card>
      </Section>

      <Section title={t('Account')}>
        <Card style={{ paddingVertical: 6 }}>
          <ListRow
            icon="trash"
            danger
            title={t('Delete my account')}
            subtitle={t('Removes your profile, devices and sign-in. Household history stays, without your name.')}
            onPress={async () => {
              const ok = await confirm({
                title: t('Delete your account?'),
                message: t('This can\'t be undone. If you\'re the only admin, make someone else admin first.'),
                confirm: t('Delete'),
                danger: true,
              });
              if (!ok) return;
              try {
                await actions.deleteAccount();
                await session.signOut();
                router.replace('/');
              } catch (e) {
                toast(e instanceof ApiError ? e.message : t('Couldn\'t delete the account.'), 'error');
              }
            }}
          />
        </Card>
      </Section>
    </Screen>
  );
}
