import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useMutation } from '@tanstack/react-query';
import { actions, useDevices, useLinks, useRefreshAll } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { Button } from '@/ui/Button';
import { ListRow, Segmented } from '@/ui/Field';
import { Header } from '@/ui/bits';
import { Card, Row, Screen, Section, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { useFeedback } from '@/ui/Feedback';

export default function MemberAdmin() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const links = useLinks();
  const devices = useDevices();
  const refresh = useRefreshAll();
  const { toast, confirm } = useFeedback();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const member = hh.members.find((m) => m.id === id);
  const create = useMutation({
    mutationFn: () => actions.createLink({ memberId: id, expiresInHours: 24 }),
    onSuccess: (r) => setLink(r),
    onError: (e) => toast(e instanceof ApiError ? e.message : t('Couldn\'t create a link.'), 'error'),
    onSettled: () => refresh(),
  });
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onError: (e) => toast(e instanceof ApiError ? e.message : t('That didn\'t work.'), 'error'),
    onSettled: () => refresh(),
  });
  if (!member) return null;
  const memberLinks = (links.data ?? []).filter((l) => l.memberId === id);
  const memberDevices = (devices.data ?? []).filter((d) => d.memberId === id);

  return (
    <Screen>
      <Header title={member.name} />
      <Section title={t('Set up a device')}>
        <Card style={{ gap: 12, alignItems: 'center' }}>
          {fresh && !link ? <Text center>{t('{{name}} was added! Make a join code for their phone.', { name: member.name })}</Text> : null}
          {link ? (
            <Stack gap={12} style={{ alignItems: 'center' }}>
              <View style={{ padding: 14, backgroundColor: '#FFFFFF', borderRadius: 20 }}>
                <QRCode value={link.url} size={200} color="#2A1C22" backgroundColor="#FFFFFF" />
              </View>
              <Text center color="soft">
                {t('{{name}} scans this with their phone camera. It works once and expires {{when}}.', {
                  name: member.name,
                  when: new Date(link.expiresAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
                })}
              </Text>
              <Text variant="small" selectable center style={{ maxWidth: 320 }}>
                {link.url}
              </Text>
              <Row wrap style={{ justifyContent: 'center' }}>
                <Button small kind="soft" title={t('Copy link')} onPress={() => Clipboard.setStringAsync(link.url).then(() => toast(t('Copied')))} />
                {Platform.OS !== 'web' ? <Button small kind="soft" title={t('Share')} onPress={() => Share.share({ message: t('Join our Pobe Coins household: {{url}}', { url: link.url }) })} /> : null}
              </Row>
            </Stack>
          ) : (
            <Button icon="qr" title={t('Create join code')} loading={create.isPending} onPress={() => create.mutate()} />
          )}
        </Card>
      </Section>

      {memberLinks.length ? (
        <Section title={t('Unused join links')}>
          <Card style={{ paddingVertical: 6 }}>
            {memberLinks.map((l) => (
              <ListRow
                key={l.id}
                icon="link"
                title={t('Expires {{when}}', { when: new Date(l.expiresAt).toLocaleString() })}
                right={<Button small kind="ghost" title={t('Delete')} onPress={() => act.mutate(() => actions.deleteLink({ id: l.id }))} />}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title={t('Signed-in devices')}>
        <Card style={{ paddingVertical: 6 }}>
          {memberDevices.length === 0 ? <Text color="soft" style={{ paddingVertical: 8 }}>{t('No devices yet.')}</Text> : null}
          {memberDevices.map((d) => (
            <ListRow
              key={d.id}
              icon="lock"
              title={d.label}
              subtitle={t('{{platform}} · added {{date}}', { platform: d.platform, date: new Date(d.createdAt).toLocaleDateString() })}
              right={
                <Button
                  small
                  kind="danger"
                  title={t('Sign out')}
                  onPress={async () => {
                    if (await confirm({ title: t('Sign out {{device}}?', { device: d.label }), confirm: t('Sign out'), danger: true })) act.mutate(() => actions.revokeDevice({ id: d.id }));
                  }}
                />
              }
            />
          ))}
        </Card>
      </Section>

      <Section title={t('Role')}>
        <Card style={{ gap: 12 }}>
          <Segmented
            value={member.role}
            onChange={(role) => act.mutate(() => actions.updateMember({ id: member.id, role }))}
            options={[
              { value: 'member', label: t('Member') },
              { value: 'admin', label: t('Admin') },
            ]}
          />
          <Text variant="small" color="soft">
            {t('Admins manage members, rules, rewards and corrections.')}
          </Text>
        </Card>
      </Section>
      {member.id !== hh.me?.id ? (
        <Button
          kind="danger"
          icon="trash"
          title={t('Remove {{name}}', { name: member.name })}
          onPress={async () => {
            if (await confirm({ title: t('Remove {{name}}?', { name: member.name }), message: t('Their devices are signed out. Their history stays in the timeline.'), confirm: t('Remove'), danger: true })) {
              act.mutate(() => actions.removeMember({ id: member.id }), { onSuccess: () => router.back() });
            }
          }}
        />
      ) : null}
      <View style={{ height: 1, backgroundColor: theme.c.line }} />
    </Screen>
  );
}
