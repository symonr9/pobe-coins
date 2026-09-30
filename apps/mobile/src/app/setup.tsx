import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CHORE_TEMPLATES, TEMPLATE_CATEGORIES, type ChoreTemplate } from '@pobe/core';
import { actions, useMe } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { useTranslation } from '@/i18n';
import { Chubby, Bubble } from '@/features/chubby/Chubby';
import { useCelebrate } from '@/features/celebrate';
import { Button } from '@/ui/Button';
import { Chip, Field } from '@/ui/Field';
import { Card, Row, Screen, Section, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { Coin } from '@/ui/Coins';

/** First run for a signed-in person with no household: create one. */
export default function Setup() {
  const { t } = useTranslation();
  const session = useSession();
  const me = useMe();
  const qc = useQueryClient();
  const celebrate = useCelebrate();
  const user = me.data && me.data.household === null ? me.data.user : null;
  const [household, setHousehold] = useState('');
  const [name, setName] = useState(user?.name?.split(' ')[0] ?? session.active?.name ?? '');
  const [picked, setPicked] = useState<Set<string>>(new Set(['dishes', 'trash', 'laundry', 'vacuum']));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byCategory = useMemo(() => {
    const m = new Map<string, ChoreTemplate[]>();
    for (const tpl of CHORE_TEMPLATES) m.set(tpl.category, [...(m.get(tpl.category) ?? []), tpl]);
    return m;
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const r = await actions.createHousehold({ name: household.trim(), memberName: name.trim(), timeZone: tz, templateIds: [...picked] });
      await session.updateActive({
        householdId: r.household.id,
        householdName: r.household.name,
        memberId: r.member.id,
        name: r.member.name,
      });
      await qc.invalidateQueries();
      celebrate({
        title: t('{{name}} is open!', { name: r.household.name }),
        line: t("I stocked the shop with a few rewards. Let's earn some coins!"),
        pose: 'cheer',
        big: true,
      });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Couldn't create the household."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          full
          title={t('Create household')}
          icon="sparkle"
          loading={busy}
          disabled={!household.trim() || !name.trim()}
          onPress={create}
        />
      }
    >
      <Row style={{ alignItems: 'flex-end', paddingTop: 12 }}>
        <Chubby pose="shopkeeper" size={110} />
        <View style={{ flex: 1, paddingBottom: 30 }}>
          <Bubble text={t("Let's set up your household. I'll run the shop!")} />
        </View>
      </Row>
      <Card style={{ gap: 14 }}>
        <Field
          label={t('Household name')}
          placeholder={t('The Cozy Burrow')}
          value={household}
          onChangeText={setHousehold}
          maxLength={60}
        />
        <Field label={t('Your name')} value={name} onChangeText={setName} maxLength={40} />
      </Card>
      <Section title={t('Starter chores')}>
        <Text color="soft">{t('Pick a few to begin. You can change prices and add your own any time.')}</Text>
        {[...byCategory.entries()].map(([cat, list]) => (
          <Stack key={cat} gap={8}>
            <Text variant="smallBold">{t(TEMPLATE_CATEGORIES[cat as ChoreTemplate['category']])}</Text>
            <Row wrap gap={8}>
              {list.map((tpl) => (
                <Chip
                  key={tpl.id}
                  label={`${tpl.emoji} ${t(tpl.title)} · ${tpl.reward}`}
                  selected={picked.has(tpl.id)}
                  onPress={() => {
                    const next = new Set(picked);
                    if (next.has(tpl.id)) next.delete(tpl.id);
                    else next.add(tpl.id);
                    setPicked(next);
                  }}
                />
              ))}
            </Row>
          </Stack>
        ))}
      </Section>
      <Row gap={6}>
        <Coin denom={25} size={20} />
        <Text variant="small" color="soft">
          {t('{{n}} chores selected', { n: picked.size })}
        </Text>
      </Row>
      {error ? <Text color="danger">{error}</Text> : null}
      <Button kind="ghost" title={t('Sign out')} onPress={() => session.signOut().then(() => router.replace('/welcome'))} />
    </Screen>
  );
}
