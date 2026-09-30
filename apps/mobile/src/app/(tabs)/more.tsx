import { View } from 'react-native';
import { router } from 'expo-router';
import { useApprovals } from '@/api/hooks';
import { useSession } from '@/auth/session';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { Chubby } from '@/features/chubby/Chubby';
import { ListRow } from '@/ui/Field';
import { Avatar } from '@/ui/bits';
import { Card, Row, Screen, Section } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { Pressy } from '@/ui/Pressy';
import { useFeedback } from '@/ui/Feedback';

export default function More() {
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const session = useSession();
  const approvals = useApprovals();
  const { confirm } = useFeedback();
  const pending = (approvals.data?.completions.length ?? 0) + (approvals.data?.purchases.length ?? 0);
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 7);

  return (
    <Screen>
      <Text variant="h1" accessibilityRole="header">
        {t('More')}
      </Text>
      {hh.me ? (
        <Pressy onPress={() => router.push('/settings')} scaleTo={0.98}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Chubby pose="happy" accessory={hh.me.equipped.accessory} size={70} animate={false} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">{hh.me.name}</Text>
              <Text variant="small" color="soft">
                {hh.household?.name} · {hh.isAdmin ? t('Admin') : t('Member')}
              </Text>
            </View>
            <Avatar name={hh.me.name} color={hh.me.color} size={36} />
          </Card>
        </Pressy>
      ) : null}

      <Card style={{ paddingVertical: 6 }}>
        <ListRow
          icon="bell"
          title={t('Approvals')}
          subtitle={pending ? t('{{n}} waiting for you', { n: pending }) : t('Nothing waiting')}
          onPress={() => router.push('/approvals')}
          right={
            pending ? (
              <View style={{ backgroundColor: theme.c.accent, borderRadius: 12, minWidth: 24, paddingHorizontal: 6, alignItems: 'center' }}>
                <Text variant="smallBold" color={theme.c.bg}>
                  {pending}
                </Text>
              </View>
            ) : undefined
          }
        />
        <ListRow icon="gift" title={t('Send a gift')} subtitle={t('Give some of your coins to someone')} onPress={() => router.push('/gift')} />
        <ListRow icon="target" title={t('Team challenges')} subtitle={t('Earn together for a shared bonus')} onPress={() => router.push('/challenges')} />
        <ListRow icon="chart" title={t('Stats')} subtitle={t('Earned vs spent, top chores')} onPress={() => router.push('/stats')} />
      </Card>

      <Section title={t('Pobe Wrapped')}>
        <Card style={{ paddingVertical: 6 }}>
          <ListRow icon="sparkle" title={t('This month so far')} onPress={() => router.push({ pathname: '/wrapped/[period]', params: { period: thisMonth } })} />
          <ListRow icon="sparkle" title={t('Last month')} onPress={() => router.push({ pathname: '/wrapped/[period]', params: { period: last } })} />
          <ListRow icon="sparkle" title={t('This year')} onPress={() => router.push({ pathname: '/wrapped/[period]', params: { period: String(now.getFullYear()) } })} />
        </Card>
      </Section>

      <Section title={t('Household')}>
        <Card style={{ paddingVertical: 6 }}>
          {hh.isAdmin ? <ListRow icon="shield" title={t('Admin')} subtitle={t('Members, join codes, rules, rewards')} onPress={() => router.push('/admin')} /> : null}
          <ListRow icon="gear" title={t('Settings')} subtitle={t('Theme, notifications, calendar, account')} onPress={() => router.push('/settings')} />
          <ListRow icon="help" title={t('Help')} subtitle={t('How coins, IOUs and approvals work')} onPress={() => router.push('/help')} />
        </Card>
      </Section>

      <Section title={t('Profiles on this device')}>
        <Card style={{ paddingVertical: 6 }}>
          {session.profiles.map((p) => (
            <ListRow
              key={p.id}
              icon={p.id === session.active?.id ? 'check' : 'users'}
              title={p.name}
              subtitle={`${p.householdName ?? t('No household yet')} · ${p.kind === 'user' ? t('Google/Apple') : t('Join link')}`}
              onPress={p.id === session.active?.id ? undefined : () => session.switchTo(p.id).then(() => router.replace('/'))}
            />
          ))}
          <ListRow icon="plus" title={t('Add another profile')} subtitle={t('For a shared tablet or a second household')} onPress={() => router.push('/welcome')} />
          <ListRow
            icon="swap"
            danger
            title={t('Sign out of this profile')}
            onPress={async () => {
              if (await confirm({ title: t('Sign out?'), message: t('You can come back with Google/Apple or a new join link.'), confirm: t('Sign out'), danger: true })) {
                await session.signOut();
                router.replace('/');
              }
            }}
          />
        </Card>
      </Section>
      <Row style={{ justifyContent: 'center' }} gap={16}>
        <Text variant="small" color="accent" onPress={() => router.push('/privacy')}>
          {t('Privacy')}
        </Text>
        <Text variant="small" color="accent" onPress={() => router.push('/terms')}>
          {t('Terms')}
        </Text>
      </Row>
    </Screen>
  );
}
