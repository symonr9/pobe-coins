import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { pickLine } from '@pobe/core';
import { actions, useApprovals, useRefreshAll } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useHousehold } from '@/features/useHousehold';
import { Button } from '@/ui/Button';
import { Avatar, EmptyState, Header, Loading } from '@/ui/bits';
import { Card, Row, Screen, Section } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { CoinAmount } from '@/ui/Coins';
import { useFeedback } from '@/ui/Feedback';
import { haptic } from '@/lib/feedback';

export default function Approvals() {
  const { t } = useTranslation();
  const hh = useHousehold();
  const q = useApprovals();
  const refresh = useRefreshAll();
  const { toast } = useFeedback();
  const decide = useMutation({
    mutationFn: (v: { kind: 'completion' | 'purchase'; id: string; approve: boolean }) =>
      v.kind === 'completion' ? actions.decideCompletion(v) : actions.decidePurchase(v),
    onSuccess: (_, v) => {
      haptic.success();
      toast(v.approve ? t('Approved!') : t('Sent back'), 'success');
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : t('That didn\'t work.'), 'error'),
    onSettled: () => refresh(),
  });
  // Web Push action buttons land here as ?approve=completion:<id> or ?reject=purchase:<id>.
  const params = useLocalSearchParams<{ approve?: string; reject?: string }>();
  const handled = useRef(false);
  useEffect(() => {
    const raw = params.approve ?? params.reject;
    if (!raw || handled.current || !hh.me) return;
    handled.current = true;
    const [kind, id] = raw.split(':');
    if ((kind === 'completion' || kind === 'purchase') && id) decide.mutate({ kind, id, approve: !!params.approve });
    router.setParams({ approve: undefined, reject: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.approve, params.reject, hh.me]);
  const completions = q.data?.completions ?? [];
  const purchases = q.data?.purchases ?? [];
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void refresh()}>
      <Header title={t('Approvals')} />
      {q.isLoading ? <Loading /> : null}
      {!q.isLoading && completions.length + purchases.length === 0 ? (
        <EmptyState pose="happy" line={t('All caught up! Nothing needs your OK right now.')} />
      ) : null}
      {completions.length ? (
        <Section title={t('Chores')}>
          {completions.map((c) => (
            <Card key={c.id} style={{ gap: 10 }}>
              <Row>
                <Avatar name={hh.name(c.memberId)} color={hh.color(c.memberId)} />
                <View style={{ flex: 1 }}>
                  <Text variant="title">{c.taskTitle}</Text>
                  <Text variant="small" color="soft">
                    {t('{{name}} · {{time}}', { name: hh.name(c.memberId), time: new Date(c.createdAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) })}
                  </Text>
                </View>
                <CoinAmount amount={c.reward} sign />
              </Row>
              {c.note ? <Text color="soft">“{c.note}”</Text> : null}
              <Row>
                <Button small title={t('Approve')} icon="check" loading={decide.isPending && decide.variables?.id === c.id} onPress={() => decide.mutate({ kind: 'completion', id: c.id, approve: true })} />
                <Button small kind="ghost" title={t('Not yet')} onPress={() => decide.mutate({ kind: 'completion', id: c.id, approve: false })} />
              </Row>
            </Card>
          ))}
        </Section>
      ) : null}
      {purchases.length ? (
        <Section title={t('Purchases')}>
          {purchases.map((p) => (
            <Card key={p.id} style={{ gap: 10 }}>
              <Row>
                <Avatar name={hh.name(p.memberId)} color={hh.color(p.memberId)} />
                <View style={{ flex: 1 }}>
                  <Text variant="title">{p.title}</Text>
                  <Text variant="small" color="soft">
                    {hh.name(p.memberId)}
                    {p.kind === 'reward' ? ` · ${t('Shop reward')}` : ''}
                  </Text>
                </View>
                <CoinAmount amount={-p.amount} sign />
              </Row>
              <Row wrap>
                <Button small title={t('Approve')} icon="check" onPress={() => decide.mutate({ kind: 'purchase', id: p.id, approve: true })} />
                <Button small kind="ghost" title={t('Decline')} onPress={() => decide.mutate({ kind: 'purchase', id: p.id, approve: false })} />
                <Button small kind="ghost" title={t('Details')} onPress={() => router.push({ pathname: '/purchase/[id]', params: { id: p.id } })} />
              </Row>
            </Card>
          ))}
        </Section>
      ) : null}
      <Text variant="small" color="soft" center>
        {t(pickLine('affirmation', { seed: new Date().toDateString() }).text)}
      </Text>
    </Screen>
  );
}
