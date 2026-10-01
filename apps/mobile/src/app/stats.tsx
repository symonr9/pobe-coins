import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useStats } from '@/api/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { Chip } from '@/ui/Field';
import { Avatar, Header, Loading, WeekBars } from '@/ui/bits';
import { Card, Row, Screen, Section } from '@/ui/layout';
import { Text } from '@/ui/Text';

export default function Stats() {
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const { width } = useWindowDimensions();
  const [member, setMember] = useState<string | undefined>(hh.me?.id);
  const q = useStats(member, 12);
  const data = q.data;
  const earned = data?.series.reduce((s, w) => s + w.earned, 0) ?? 0;
  const spent = data?.series.reduce((s, w) => s + w.spent, 0) ?? 0;
  return (
    <Screen>
      <Header title={t('Stats')} />
      <Row wrap gap={8}>
        <Chip label={t('Household')} selected={!member} onPress={() => setMember(undefined)} />
        {hh.members.map((m) => (
          <Chip key={m.id} label={m.name} color={m.color} selected={member === m.id} onPress={() => setMember(m.id)} />
        ))}
      </Row>
      {q.isLoading || !data ? (
        <Loading />
      ) : (
        <>
          <Row gap={12}>
            <Card style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="label" color="soft">
                {t('Earned')}
              </Text>
              <Text variant="h1" color="accent">
                {earned}
              </Text>
            </Card>
            <Card style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="label" color="soft">
                {t('Spent')}
              </Text>
              <Text variant="h1">{spent}</Text>
            </Card>
          </Row>
          <Section title={t('Last 12 weeks')}>
            <Card style={{ gap: 8, alignItems: 'center' }}>
              <WeekBars data={data.series} width={Math.min(width, 720) - 64} height={170} />
              <Row gap={16}>
                <Row gap={6}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.c.accent }} />
                  <Text variant="small">{t('Earned')}</Text>
                </Row>
                <Row gap={6}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.c.secondary }} />
                  <Text variant="small">{t('Spent')}</Text>
                </Row>
              </Row>
            </Card>
          </Section>
          <Section title={t('Top chores')}>
            <Card style={{ gap: 8 }}>
              {data.topChores.length === 0 ? <Text color="soft">{t('No chores yet in this window.')}</Text> : null}
              {data.topChores.map((c, i) => (
                <Row key={c.label} style={{ justifyContent: 'space-between' }}>
                  <Text variant="bodyBold">
                    {i + 1}. {c.label}
                  </Text>
                  <Text color="soft">{t('×{{n}} · {{coins}} coins', { n: c.count, coins: c.coins })}</Text>
                </Row>
              ))}
            </Card>
          </Section>
          {data.leaderboard ? (
            <Section title={t('This week (friendly!)')}>
              <Card style={{ gap: 10 }}>
                {data.leaderboard.thisWeek.map((r, i) => (
                  <Row key={r.memberId}>
                    <Text variant="h3" style={{ width: 28 }}>
                      {['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}
                    </Text>
                    <Avatar name={hh.name(r.memberId)} color={hh.color(r.memberId)} size={30} />
                    <Text variant="bodyBold" style={{ flex: 1 }}>
                      {hh.name(r.memberId)}
                    </Text>
                    <Text variant="number">{r.earned}</Text>
                  </Row>
                ))}
                <Text variant="small" color="soft">
                  {t('Everyone who pitched in is a winner. Chubbybara said so.')}
                </Text>
              </Card>
            </Section>
          ) : null}
          <Section title={t('Balances')}>
            <Card style={{ gap: 8 }}>
              {data.balances.map((b) => (
                <Row key={b.memberId} style={{ justifyContent: 'space-between' }}>
                  <Text variant="bodyBold">{hh.name(b.memberId)}</Text>
                  <Text variant="number">
                    {b.balance}
                    {b.debt ? <Text variant="small" color="warning">{`  IOU ${b.debt}`}</Text> : null}
                  </Text>
                </Row>
              ))}
            </Card>
          </Section>
        </>
      )}
    </Screen>
  );
}
