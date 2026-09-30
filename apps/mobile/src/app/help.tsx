import { HELP, ONBOARDING } from '@pobe/core';
import { useTranslation } from '@/i18n';
import { Chubby } from '@/features/chubby/Chubby';
import { Header } from '@/ui/bits';
import { Card, Row, Screen, Section, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';

const TITLES: Record<string, string> = { home: 'Your purse', tasks: 'Chores', spend: 'Spending', shop: 'POBE Shop', timeline: 'Timeline' };

export default function Help() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Header title={t('Help')} />
      <Row>
        <Chubby pose="thinking" size={90} />
        <Text style={{ flex: 1 }}>{t(ONBOARDING[0]!.body)}</Text>
      </Row>
      {Object.entries(HELP).map(([key, tips]) => (
        <Section key={key} title={t(TITLES[key] ?? key)}>
          <Card>
            <Stack gap={12}>
              {tips.map((tip) => (
                <Stack key={tip.title} gap={2}>
                  <Text variant="title">{t(tip.title)}</Text>
                  <Text color="soft">{t(tip.body)}</Text>
                </Stack>
              ))}
            </Stack>
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
