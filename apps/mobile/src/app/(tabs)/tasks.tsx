import { useState } from 'react';
import { router } from 'expo-router';
import { useRefreshAll, useTasks } from '@/api/hooks';
import type { TaskView } from '@/api/types';
import { useTranslation } from '@/i18n';
import { useHousehold } from '@/features/useHousehold';
import { TaskRow } from '@/features/tasks/TaskRow';
import { Button } from '@/ui/Button';
import { Segmented } from '@/ui/Field';
import { EmptyState, ErrorState, Loading } from '@/ui/bits';
import { Card, Row, Screen, Section } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { say } from '@/features/chubby/say';

type Filter = 'mine' | 'pool' | 'recurring' | 'everyone';

export default function Tasks() {
  const { t } = useTranslation();
  const hh = useHousehold();
  const tasks = useTasks();
  const refresh = useRefreshAll();
  const [filter, setFilter] = useState<Filter>('mine');
  const me = hh.me?.id;

  const all = tasks.data ?? [];
  const mineOrPool = (x: TaskView) => x.effectiveAssigneeId === me || (x.effectiveAssigneeId === null && (!x.claimedBy || x.claimedBy === me));
  const lists: Record<Filter, TaskView[]> = {
    mine: all.filter((x) => x.effectiveAssigneeId === me || (x.effectiveAssigneeId === null && x.claimedBy === me)),
    pool: all.filter((x) => x.effectiveAssigneeId === null),
    recurring: all.filter((x) => !!x.recurrence),
    everyone: all,
  };
  const list = lists[filter];
  const open = list.filter((x) => !x.doneThisPeriod).sort((a, b) => (a.nextDueAt ?? '9') .localeCompare(b.nextDueAt ?? '9'));
  const done = list.filter((x) => x.doneThisPeriod);

  return (
    <Screen refreshing={tasks.isRefetching} onRefresh={() => void refresh()}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="h1" accessibilityRole="header">
          {t('Chores')}
        </Text>
        <Button small icon="plus" title={t('New')} onPress={() => router.push('/task/edit')} />
      </Row>
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'mine', label: t('Mine') },
          { value: 'pool', label: t('Pool') },
          { value: 'recurring', label: t('Repeats') },
          { value: 'everyone', label: t('All') },
        ]}
      />
      {tasks.isLoading ? (
        <Loading />
      ) : tasks.error && !tasks.data ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          line={say(filter === 'pool' ? 'emptyTasks' : 'emptyTasks', { seed: filter }).text}
          action={{ title: t('Add a chore'), onPress: () => router.push('/task/edit') }}
        />
      ) : (
        <>
          <Card style={{ paddingVertical: 6 }}>
            {open.length ? (
              open.map((task) => <TaskRow key={task.id} task={task} />)
            ) : (
              <Text color="soft" style={{ paddingVertical: 12 }}>
                {t('Nothing left here. Nice work!')}
              </Text>
            )}
          </Card>
          {filter === 'mine' && lists.pool.some((x) => !x.doneThisPeriod && !x.claimedBy) ? (
            <Text variant="small" color="soft">
              {t('There are {{n}} chores in the pool anyone can grab.', { n: lists.pool.filter((x) => !x.doneThisPeriod && !x.claimedBy).length })}
            </Text>
          ) : null}
          {done.length ? (
            <Section title={t('Done for now')}>
              <Card style={{ paddingVertical: 6 }}>
                {done.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      )}
      {!all.some(mineOrPool) && all.length > 0 && filter === 'mine' ? (
        <Text color="soft">{t('Nothing assigned to you right now.')}</Text>
      ) : null}
    </Screen>
  );
}
