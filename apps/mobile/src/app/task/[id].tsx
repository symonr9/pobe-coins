import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useMutation } from '@tanstack/react-query';
import { describeRecurrence } from '@pobe/core';
import { actions, useRefreshAll, useTasks } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { useCompleteTask } from '@/features/tasks/useComplete';
import { pickPhoto, uploadPhoto } from '@/features/photos';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Avatar, ErrorState, Header, Loading } from '@/ui/bits';
import { Card, Row, Screen, Section, Stack } from '@/ui/layout';
import { Icon } from '@/ui/Icon';
import { Pressy } from '@/ui/Pressy';
import { Text } from '@/ui/Text';
import { CoinAmount } from '@/ui/Coins';
import { useFeedback } from '@/ui/Feedback';

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const hh = useHousehold();
  const tasks = useTasks();
  const complete = useCompleteTask();
  const refresh = useRefreshAll();
  const { toast, confirm } = useFeedback();
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; key?: string; uploading: boolean } | null>(null);
  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onError: (e) => toast(e instanceof ApiError ? e.message : t("That didn't work."), 'error'),
    onSettled: () => refresh(),
  });

  const task = tasks.data?.find((x) => x.id === id);
  if (tasks.isLoading) return <Loading />;
  if (!task)
    return <ErrorState error={new Error(t("This chore wasn't found. It may have been archived."))} onRetry={() => router.back()} />;
  const me = hh.me?.id;
  const mine = task.effectiveAssigneeId === me || (task.effectiveAssigneeId === null && (!task.claimedBy || task.claimedBy === me));
  const canEdit = hh.isAdmin || task.createdBy === me;

  const attach = async (source: 'camera' | 'library') => {
    const uri = await pickPhoto(source);
    if (!uri) return;
    setPhoto({ uri, uploading: true });
    try {
      const key = await uploadPhoto(uri, 'completion');
      setPhoto({ uri, key, uploading: false });
    } catch (e) {
      setPhoto(null);
      toast(e instanceof Error ? e.message : t("The photo didn't upload."), 'error');
    }
  };

  const doComplete = (checklistItemId?: string) =>
    complete.mutate(
      { id: task.id, note: note.trim() || undefined, photoKey: photo?.key, checklistItemId },
      {
        onSuccess: () => {
          if (!checklistItemId) router.back();
        },
      },
    );

  return (
    <Screen
      footer={
        !task.doneThisPeriod && mine && !task.checklist?.length ? (
          <Button
            full
            icon="check"
            title={t('Mark done · +{{n}}', { n: task.reward })}
            loading={complete.isPending}
            disabled={photo?.uploading}
            onPress={() => doComplete()}
          />
        ) : undefined
      }
    >
      <Header
        title={`${task.emoji ? `${task.emoji} ` : ''}${task.title}`}
        right={
          canEdit ? (
            <Button
              small
              kind="soft"
              icon="edit"
              title={t('Edit')}
              onPress={() => router.push({ pathname: '/task/edit', params: { id: task.id } })}
            />
          ) : undefined
        }
      />
      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <CoinAmount amount={task.reward} size={28} variant="h2" />
          {task.doneThisPeriod ? (
            <Text variant="smallBold" color={task.pendingApproval ? 'warning' : 'success'}>
              {task.pendingApproval ? `⏳ ${t('Waiting for approval')}` : `✓ ${t('Done for now')}`}
            </Text>
          ) : null}
        </Row>
        {task.recurrence ? (
          <Text color="soft">
            🔁 {t(describeRecurrence(task.recurrence))}
            {task.recurrence.dueTime ? ` · ${t('due {{time}}', { time: task.recurrence.dueTime })}` : ''}
          </Text>
        ) : null}
        {task.dueAt ? <Text color="soft">📅 {t('Due {{date}}', { date: new Date(task.dueAt).toLocaleString() })}</Text> : null}
        {task.streak ? (
          <Text color="accent" variant="bodyBold">
            🔥 {t('Streak {{n}} · best {{best}}', { n: task.streak.current, best: task.streak.best })}
            {task.streakRule
              ? ` · ${t('+{{bonus}} every {{every}} in a row', { bonus: task.streakRule.bonus, every: task.streakRule.every })}`
              : ''}
          </Text>
        ) : task.streakRule ? (
          <Text color="accent">
            {t('Streak bonus: +{{bonus}} every {{every}} in a row', { bonus: task.streakRule.bonus, every: task.streakRule.every })}
          </Text>
        ) : null}
        {task.requiresApproval ? <Text color="soft">✋ {t('Someone else approves this one before coins are paid.')}</Text> : null}
        {task.notes ? <Text>{task.notes}</Text> : null}
        <Row>
          {task.effectiveAssigneeId ? (
            <>
              <Avatar name={hh.name(task.effectiveAssigneeId)} color={hh.color(task.effectiveAssigneeId)} size={28} />
              <Text variant="bodyBold">
                {task.rotation?.length
                  ? t("{{name}}'s turn", { name: hh.name(task.effectiveAssigneeId) })
                  : hh.name(task.effectiveAssigneeId)}
              </Text>
            </>
          ) : (
            <Text variant="bodyBold">
              {task.claimedBy ? t('Claimed by {{name}}', { name: hh.name(task.claimedBy) }) : t('In the pool: anyone can do it')}
            </Text>
          )}
        </Row>
        {task.rotation?.length ? (
          <Text variant="small" color="soft">
            {t('Rotates between {{names}}', { names: task.rotation.map((m) => hh.name(m)).join(', ') })}
          </Text>
        ) : null}
      </Card>

      {task.checklist?.length ? (
        <Section title={task.partialCredit ? t('Steps (paid as you go)') : t('Steps')}>
          <Card style={{ gap: 4 }}>
            {task.checklist.map((item) => {
              const done = !!item.doneAt && (!task.recurrence || item.doneAt.slice(0, 10) >= (task.period ?? ''));
              return (
                <Pressy
                  key={item.id}
                  disabled={done || !mine}
                  onPress={() => doComplete(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  style={{ paddingVertical: 8 }}
                >
                  <Row>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        borderWidth: 2.5,
                        borderColor: theme.c.primary,
                        backgroundColor: done ? theme.c.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {done ? <Icon name="check" size={16} color={theme.c.onPrimary} strokeWidth={3} /> : null}
                    </View>
                    <Text style={{ flex: 1, textDecorationLine: done ? 'line-through' : 'none' }} color={done ? 'soft' : 'ink'}>
                      {item.label}
                    </Text>
                    {done && item.doneBy ? <Avatar name={hh.name(item.doneBy)} color={hh.color(item.doneBy)} size={22} /> : null}
                  </Row>
                </Pressy>
              );
            })}
          </Card>
        </Section>
      ) : null}

      {!task.doneThisPeriod && mine ? (
        <Section title={t('Add a note or photo (optional)')}>
          <Card style={{ gap: 12 }}>
            <Field label={t('Note')} value={note} onChangeText={setNote} placeholder={t('Anything to mention?')} maxLength={500} />
            {photo ? (
              <Row>
                <Image source={{ uri: photo.uri }} style={{ width: 72, height: 72, borderRadius: 14 }} />
                <Text color="soft">{photo.uploading ? t('Uploading…') : t('Photo attached')}</Text>
                <Button small kind="ghost" title={t('Remove')} onPress={() => setPhoto(null)} />
              </Row>
            ) : (
              <Row wrap>
                <Button small kind="soft" icon="camera" title={t('Take photo')} onPress={() => attach('camera')} />
                <Button small kind="soft" title={t('Choose photo')} onPress={() => attach('library')} />
              </Row>
            )}
          </Card>
        </Section>
      ) : null}

      <Stack gap={8}>
        {task.effectiveAssigneeId === null && !task.doneThisPeriod ? (
          task.claimedBy === me ? (
            <Button
              kind="ghost"
              title={t('Release it back to the pool')}
              onPress={() => act.mutate(() => actions.claimTask({ id: task.id, claim: false }))}
            />
          ) : !task.claimedBy ? (
            <Button
              kind="secondary"
              title={t("Claim it: I'll do this")}
              onPress={() => act.mutate(() => actions.claimTask({ id: task.id, claim: true }))}
            />
          ) : null
        ) : null}
        {task.rotation?.length && (task.effectiveAssigneeId === me || hh.isAdmin) ? (
          <Button
            kind="ghost"
            icon="swap"
            title={t('Skip to the next person')}
            onPress={() => act.mutate(() => actions.rotateTask({ id: task.id, by: 1 }))}
          />
        ) : null}
        {canEdit ? (
          <Button
            kind="danger"
            icon="trash"
            title={t('Archive chore')}
            onPress={async () => {
              if (
                await confirm({
                  title: t('Archive "{{task}}"?', { task: task.title }),
                  message: t('It disappears from the list. History and coins stay.'),
                  confirm: t('Archive'),
                  danger: true,
                })
              ) {
                act.mutate(() => actions.archiveTask({ id: task.id }), { onSuccess: () => router.back() });
              }
            }}
          />
        ) : null}
      </Stack>
    </Screen>
  );
}
