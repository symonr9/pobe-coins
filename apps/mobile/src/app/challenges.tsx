import { useState } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { actions, useChallenges, useRefreshAll } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useHousehold } from '@/features/useHousehold';
import { AmountPicker } from '@/features/AmountPicker';
import { Button } from '@/ui/Button';
import { Field, Segmented } from '@/ui/Field';
import { EmptyState, Header, Loading, ProgressRing, Sheet } from '@/ui/bits';
import { Card, Row, Screen, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { useFeedback } from '@/ui/Feedback';

export default function Challenges() {
  const { t } = useTranslation();
  const hh = useHousehold();
  const q = useChallenges();
  const refresh = useRefreshAll();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(300);
  const [bonus, setBonus] = useState(25);
  const [days, setDays] = useState<'7' | '14' | '30'>('7');
  const create = useMutation({
    mutationFn: () => {
      const start = new Date();
      return actions.createChallenge({ title: title.trim(), target, bonus, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + Number(days) * 86400_000).toISOString() });
    },
    onSuccess: () => {
      setOpen(false);
      setTitle('');
      toast(t('Challenge started!'), 'success');
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : t('Couldn\'t start it.'), 'error'),
    onSettled: () => refresh(),
  });
  return (
    <Screen>
      <Header title={t('Team challenges')} right={hh.isAdmin ? <Button small icon="plus" title={t('New')} onPress={() => setOpen(true)} /> : undefined} />
      <Text color="soft">{t('Earn coins together before time runs out, and everyone gets a bonus.')}</Text>
      {q.isLoading ? <Loading /> : null}
      {q.data?.length === 0 ? <EmptyState pose="cheer" line={t('No challenges yet. Admins can start one, like "earn 300 together this week".')} /> : null}
      <Stack>
        {q.data?.map((c) => (
          <Card key={c.id} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', opacity: c.status === 'expired' ? 0.6 : 1 }}>
            <ProgressRing progress={c.progress / c.target} size={72} label={c.status === 'won' ? '🎉' : undefined} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title">{c.title}</Text>
              <Text variant="small" color="soft">
                {t('{{p}}/{{target}} coins · bonus {{bonus}} each', { p: Math.min(c.progress, c.target), target: c.target, bonus: c.bonus })}
              </Text>
              <Text variant="smallBold" color={c.status === 'won' ? 'success' : c.status === 'expired' ? 'soft' : 'accent'}>
                {c.status === 'won' ? t('Won!') : c.status === 'expired' ? t('Ended') : t('Ends {{date}}', { date: new Date(c.endsAt).toLocaleDateString() })}
              </Text>
            </View>
            {hh.isAdmin && c.status === 'active' ? <Button small kind="ghost" title="✕" accessibilityLabel={t('Delete challenge')} onPress={() => actions.deleteChallenge({ id: c.id }).then(() => refresh())} /> : null}
          </Card>
        ))}
      </Stack>
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('New team challenge')}>
        <Field label={t('Name')} value={title} onChangeText={setTitle} placeholder={t('Spring-clean week')} />
        <AmountPicker label={t('Earn together')} value={target} onChange={setTarget} coinTypes={hh.settings.coinTypes} />
        <Row gap={10}>
          <View style={{ flex: 1 }}>
            <Field label={t('Bonus each')} value={String(bonus)} keyboardType="number-pad" onChangeText={(s) => setBonus(Number(s.replace(/\D/g, '')) || 0)} />
          </View>
        </Row>
        <Segmented value={days} onChange={setDays} options={[{ value: '7', label: t('1 week') }, { value: '14', label: t('2 weeks') }, { value: '30', label: t('1 month') }]} />
        <Button full title={t('Start challenge')} disabled={!title.trim() || !target} loading={create.isPending} onPress={() => create.mutate()} />
      </Sheet>
    </Screen>
  );
}
