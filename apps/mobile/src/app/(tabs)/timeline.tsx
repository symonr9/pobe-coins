import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useRefreshAll, useTimeline } from '@/api/hooks';
import type { TimelineItem } from '@/api/types';
import { useTranslation } from '@/i18n';
import { useHousehold } from '@/features/useHousehold';
import { EntryRow } from '@/features/timeline/EntryRow';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Field';
import { EmptyState, ErrorState, Loading } from '@/ui/bits';
import { Card, Row, Screen, Section } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { Pressy } from '@/ui/Pressy';
import { say } from '@/features/chubby/say';

function dayLabel(iso: string, t: (s: string) => string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400_000);
  if (d.toDateString() === today.toDateString()) return t('Today');
  if (d.toDateString() === yesterday.toDateString()) return t('Yesterday');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function Timeline() {
  const params = useLocalSearchParams<{ member?: string }>();
  const { t } = useTranslation();
  const hh = useHousehold();
  const [member, setMember] = useState<string | undefined>(params.member);
  const q = useTimeline(member);
  const refresh = useRefreshAll();
  const pages = q.data?.pages ?? [];
  const pending = pages[0]?.pending ?? [];
  const groups = useMemo(() => {
    const out: { day: string; items: TimelineItem[] }[] = [];
    for (const item of pages.flatMap((p) => p.items)) {
      const day = dayLabel(item.entry.createdAt, t);
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(item);
      else out.push({ day, items: [item] });
    }
    return out;
  }, [pages, t]);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void refresh()}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="h1" accessibilityRole="header">
          {t('Timeline')}
        </Text>
        <Button small kind="soft" icon="chart" title={t('Stats')} onPress={() => router.push('/stats')} />
      </Row>
      <Row gap={8} wrap>
        <Chip label={t('Everyone')} selected={!member} onPress={() => setMember(undefined)} />
        {hh.members.map((m) => (
          <Chip key={m.id} label={m.name} color={m.color} selected={member === m.id} onPress={() => setMember(m.id)} />
        ))}
      </Row>
      {pending.length ? (
        <Section title={t('Waiting for approval')}>
          <Card style={{ gap: 8 }}>
            {pending.map((p) => (
              <Pressy key={p.type === 'completion' ? p.completion.id : p.purchase.id} onPress={() => router.push('/approvals')}>
                <Row>
                  <Text style={{ fontSize: 20 }}>⏳</Text>
                  <Text style={{ flex: 1 }} variant="bodyBold">
                    {p.type === 'completion'
                      ? t('{{name}} did "{{task}}" (+{{n}})', {
                          name: hh.name(p.completion.memberId),
                          task: p.completion.taskTitle,
                          n: p.completion.reward,
                        })
                      : t('{{name}} wants "{{item}}" (−{{n}})', {
                          name: hh.name(p.purchase.memberId),
                          item: p.purchase.title,
                          n: p.purchase.amount,
                        })}
                  </Text>
                </Row>
              </Pressy>
            ))}
          </Card>
        </Section>
      ) : null}
      {q.isLoading ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState pose="idle" line={say('emptyTimeline', { seed: 'x' }).text} />
      ) : (
        groups.map((g) => (
          <Section key={g.day} title={g.day}>
            <Card style={{ paddingVertical: 4 }}>
              {g.items.map((item) => (
                <EntryRow key={item.entry.id} item={item} />
              ))}
            </Card>
          </Section>
        ))
      )}
      {q.hasNextPage ? (
        <Button kind="ghost" title={t('Load more')} loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} />
      ) : null}
    </Screen>
  );
}
