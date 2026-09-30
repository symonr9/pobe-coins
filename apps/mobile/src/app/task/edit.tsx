import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { CHORE_TEMPLATES, toLocalDate, type Recurrence } from '@pobe/core';
import { actions, useRefreshAll, useTasks } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useHousehold } from '@/features/useHousehold';
import { AmountPicker } from '@/features/AmountPicker';
import { Button } from '@/ui/Button';
import { Chip, Field, Segmented, ToggleRow } from '@/ui/Field';
import { Avatar, Header } from '@/ui/bits';
import { Card, Row, Screen, Section, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { useFeedback } from '@/ui/Feedback';
import { Pressy } from '@/ui/Pressy';

type Who = 'pool' | 'member' | 'rotation';
type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function TaskEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const hh = useHousehold();
  const tasks = useTasks();
  const refresh = useRefreshAll();
  const { toast } = useFeedback();
  const existing = id ? tasks.data?.find((x) => x.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [reward, setReward] = useState(10);
  const [who, setWho] = useState<Who>('pool');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [rotation, setRotation] = useState<string[]>([]);
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [interval, setInterval_] = useState(1);
  const [days, setDays] = useState<number[]>([new Date().getDay()]);
  const [dueTime, setDueTime] = useState('');
  const [approval, setApproval] = useState(false);
  const [streakOn, setStreakOn] = useState(false);
  const [streakEvery, setStreakEvery] = useState(7);
  const [streakBonus, setStreakBonus] = useState(10);
  const [steps, setSteps] = useState<{ id?: string; label: string }[]>([]);
  const [partial, setPartial] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setEmoji(existing.emoji ?? '');
    setReward(existing.reward);
    setWho(existing.rotation?.length ? 'rotation' : existing.assigneeId ? 'member' : 'pool');
    setAssignee(existing.assigneeId);
    setRotation(existing.rotation ?? []);
    setRepeat(existing.recurrence?.freq ?? 'none');
    setInterval_(existing.recurrence?.interval ?? 1);
    setDays(existing.recurrence?.byWeekday ?? [new Date().getDay()]);
    setDueTime(existing.recurrence?.dueTime ?? '');
    setApproval(existing.requiresApproval);
    setStreakOn(!!existing.streakRule);
    if (existing.streakRule) {
      setStreakEvery(existing.streakRule.every);
      setStreakBonus(existing.streakRule.bonus);
    }
    setSteps(existing.checklist?.map((c) => ({ id: c.id, label: c.label })) ?? []);
    setPartial(!!existing.partialCredit);
    setNotes(existing.notes ?? '');
  }, [existing]);

  const save = useMutation({
    mutationFn: () => {
      const recurrence: Recurrence | undefined =
        repeat === 'none'
          ? undefined
          : {
              freq: repeat,
              interval: interval > 1 ? interval : undefined,
              byWeekday: repeat === 'weekly' ? days : undefined,
              anchor: existing?.recurrence?.anchor ?? toLocalDate(new Date(), hh.settings.timeZone),
              dueTime: /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : undefined,
            };
      const body = {
        title: title.trim(),
        emoji: emoji.trim() || undefined,
        reward,
        notes: notes.trim() || undefined,
        assigneeId: who === 'member' ? assignee : null,
        rotation: who === 'rotation' ? rotation : undefined,
        requiresApproval: approval,
        recurrence,
        streakRule: recurrence && streakOn ? { every: streakEvery, bonus: streakBonus } : undefined,
        checklist: steps.filter((s) => s.label.trim()).map((s) => ({ id: s.id, label: s.label.trim() })),
        partialCredit: partial,
      };
      return existing ? actions.updateTask({ id: existing.id, ...body }) : actions.createTask(body);
    },
    onSuccess: () => {
      void refresh();
      toast(existing ? t('Saved') : t('Chore added'), 'success');
      router.back();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("Couldn't save.")),
  });

  const valid = title.trim().length > 0 && (who !== 'member' || !!assignee) && (who !== 'rotation' || rotation.length >= 2);

  return (
    <Screen
      footer={
        <Button
          full
          title={existing ? t('Save changes') : t('Add chore')}
          icon="check"
          disabled={!valid}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
      }
    >
      <Header title={existing ? t('Edit chore') : t('New chore')} />
      {!existing ? (
        <Section title={t('Quick picks')}>
          <Row wrap gap={8}>
            {CHORE_TEMPLATES.slice(0, 10).map((tpl) => (
              <Chip
                key={tpl.id}
                label={`${tpl.emoji} ${t(tpl.title)}`}
                onPress={() => {
                  setTitle(t(tpl.title));
                  setEmoji(tpl.emoji);
                  setReward(tpl.reward);
                  setRepeat(tpl.recurrence?.freq ?? 'none');
                  setInterval_(tpl.recurrence?.interval ?? 1);
                  if (tpl.recurrence?.byWeekday) setDays(tpl.recurrence.byWeekday);
                  setSteps(tpl.checklist?.map((label) => ({ label })) ?? []);
                }}
              />
            ))}
          </Row>
        </Section>
      ) : null}
      <Card style={{ gap: 14 }}>
        <Row gap={10} style={{ alignItems: 'flex-end' }}>
          <View style={{ width: 80 }}>
            <Field
              label={t('Emoji')}
              value={emoji}
              onChangeText={(s) => setEmoji([...s].slice(-2).join(''))}
              placeholder="🧹"
              style={{ textAlign: 'center', fontSize: 22 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('Chore')} value={title} onChangeText={setTitle} placeholder={t('Take out the trash')} maxLength={120} />
          </View>
        </Row>
        <AmountPicker label={t('Worth')} value={reward} onChange={setReward} coinTypes={hh.settings.coinTypes} />
      </Card>

      <Section title={t('Who does it?')}>
        <Card style={{ gap: 12 }}>
          <Segmented<Who>
            value={who}
            onChange={setWho}
            options={[
              { value: 'pool', label: t('Anyone') },
              { value: 'member', label: t('One person') },
              { value: 'rotation', label: t('Take turns') },
            ]}
          />
          {who === 'pool' ? <Text color="soft">{t('It goes in the pool. Whoever claims or does it first gets the coins.')}</Text> : null}
          {who !== 'pool' ? (
            <Row wrap gap={8}>
              {hh.members.map((m) => {
                const on = who === 'member' ? assignee === m.id : rotation.includes(m.id);
                return (
                  <Chip
                    key={m.id}
                    label={who === 'rotation' && on ? `${rotation.indexOf(m.id) + 1}. ${m.name}` : m.name}
                    color={m.color}
                    selected={on}
                    onPress={() =>
                      who === 'member' ? setAssignee(m.id) : setRotation(on ? rotation.filter((x) => x !== m.id) : [...rotation, m.id])
                    }
                  />
                );
              })}
            </Row>
          ) : null}
          {who === 'rotation' ? (
            <Text variant="small" color="soft">
              {t('Pick at least two people, in turn order. It needs to repeat.')}
            </Text>
          ) : null}
        </Card>
      </Section>

      <Section title={t('Repeats')}>
        <Card style={{ gap: 12 }}>
          <Segmented<Repeat>
            value={repeat}
            onChange={setRepeat}
            options={[
              { value: 'none', label: t('Once') },
              { value: 'daily', label: t('Daily') },
              { value: 'weekly', label: t('Weekly') },
              { value: 'monthly', label: t('Monthly') },
            ]}
          />
          {repeat === 'weekly' ? (
            <Row gap={6} style={{ justifyContent: 'space-between' }}>
              {DAYS.map((d, i) => {
                const on = days.includes(i);
                return (
                  <Pressy
                    key={i}
                    accessibilityLabel={new Date(2026, 0, 4 + i).toLocaleDateString(undefined, { weekday: 'long' })}
                    accessibilityState={{ selected: on }}
                    onPress={() => setDays(on ? days.filter((x) => x !== i) : [...days, i].sort())}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? hh.color(hh.me?.id) : 'transparent',
                      borderWidth: 2,
                      borderColor: on ? 'transparent' : '#00000014',
                    }}
                  >
                    <Text variant="bodyBold">{d}</Text>
                  </Pressy>
                );
              })}
            </Row>
          ) : null}
          {repeat !== 'none' ? (
            <Row gap={10}>
              <View style={{ flex: 1 }}>
                <Field
                  label={
                    repeat === 'daily'
                      ? t('Every how many days')
                      : repeat === 'weekly'
                        ? t('Every how many weeks')
                        : t('Every how many months')
                  }
                  value={String(interval)}
                  keyboardType="number-pad"
                  onChangeText={(s) => setInterval_(Math.max(1, Math.min(52, Number(s.replace(/\D/g, '')) || 1)))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('Due time (optional)')}
                  value={dueTime}
                  onChangeText={setDueTime}
                  placeholder="18:00"
                  maxLength={5}
                  hint={t('24-hour, like 18:30')}
                />
              </View>
            </Row>
          ) : null}
          {repeat !== 'none' ? (
            <>
              <ToggleRow
                label={t('Streak bonus')}
                hint={t('Extra coins for doing it every time')}
                value={streakOn}
                onChange={setStreakOn}
              />
              {streakOn ? (
                <Row gap={10}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label={t('Every … in a row')}
                      value={String(streakEvery)}
                      keyboardType="number-pad"
                      onChangeText={(s) => setStreakEvery(Math.max(2, Number(s.replace(/\D/g, '')) || 2))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label={t('Bonus coins')}
                      value={String(streakBonus)}
                      keyboardType="number-pad"
                      onChangeText={(s) => setStreakBonus(Math.max(0, Number(s.replace(/\D/g, '')) || 0))}
                    />
                  </View>
                </Row>
              ) : null}
            </>
          ) : null}
        </Card>
      </Section>

      <Section title={t('Steps (optional)')}>
        <Card style={{ gap: 10 }}>
          {steps.map((s, i) => (
            <Row key={i} gap={8}>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('Step {{n}}', { n: i + 1 })}
                  value={s.label}
                  onChangeText={(v) => setSteps(steps.map((x, j) => (j === i ? { ...x, label: v } : x)))}
                />
              </View>
              <Button
                small
                kind="ghost"
                title="✕"
                accessibilityLabel={t('Remove step')}
                onPress={() => setSteps(steps.filter((_, j) => j !== i))}
                style={{ marginTop: 22 }}
              />
            </Row>
          ))}
          <Button
            small
            kind="soft"
            icon="plus"
            title={t('Add step')}
            onPress={() => setSteps([...steps, { label: '' }])}
            disabled={steps.length >= 30}
          />
          {steps.length > 1 ? (
            <ToggleRow label={t('Pay as you go')} hint={t('Split the reward across the steps')} value={partial} onChange={setPartial} />
          ) : null}
        </Card>
      </Section>

      <Card style={{ gap: 12 }}>
        <ToggleRow
          label={t('Needs approval')}
          hint={t('Someone else confirms before the coins are paid')}
          value={approval}
          onChange={setApproval}
        />
        <Field label={t('Notes (optional)')} value={notes} onChangeText={setNotes} multiline maxLength={1000} />
      </Card>
      {error ? <Text color="danger">{error}</Text> : null}
      <Stack>
        {who === 'member' && assignee ? (
          <Row>
            <Avatar name={hh.name(assignee)} color={hh.color(assignee)} size={24} />
            <Text color="soft">{t('Assigned to {{name}}', { name: hh.name(assignee) })}</Text>
          </Row>
        ) : null}
      </Stack>
    </Screen>
  );
}
