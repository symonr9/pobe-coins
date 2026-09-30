import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { describeRecurrence, MOTION } from '@pobe/core';
import type { TaskView } from '@/api/types';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { useHousehold } from '@/features/useHousehold';
import { Icon } from '@/ui/Icon';
import { Pressy } from '@/ui/Pressy';
import { Row } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { Coin } from '@/ui/Coins';
import { Avatar } from '@/ui/bits';
import { useCompleteTask } from './useComplete';

export function TaskRow({ task }: { task: TaskView }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const hh = useHousehold();
  const complete = useCompleteTask();
  const done = task.doneThisPeriod;
  const mine = task.effectiveAssigneeId === hh.me?.id || (task.effectiveAssigneeId === null && (!task.claimedBy || task.claimedBy === hh.me?.id));
  const overdue = !done && task.nextDueAt && new Date(task.nextDueAt).getTime() < Date.now();
  const fill = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(done || complete.isPending ? 1 : 0, MOTION.bouncy) }] }));
  const hasChecklist = !!task.checklist?.length;

  const meta: string[] = [];
  if (task.recurrence) meta.push(tr(describeRecurrence(task.recurrence)));
  if (task.effectiveAssigneeId && task.effectiveAssigneeId !== hh.me?.id) meta.push(tr("{{name}}'s turn", { name: hh.name(task.effectiveAssigneeId) }));
  else if (!task.effectiveAssigneeId) meta.push(task.claimedBy ? tr('Claimed by {{name}}', { name: hh.name(task.claimedBy) }) : tr('Pool: anyone'));
  if (hasChecklist) meta.push(tr('{{done}}/{{total}} steps', { done: task.checklist!.filter((c) => c.doneAt).length, total: task.checklist!.length }));

  return (
    <Pressy
      scaleTo={0.98}
      onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      accessibilityLabel={`${task.title}, ${task.reward} coins${done ? ', done' : ''}`}
      style={{ paddingVertical: 10 }}
    >
      <Row>
        <Pressy
          accessibilityLabel={done ? tr('Done') : tr('Mark {{task}} done', { task: task.title })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done, disabled: done || !mine }}
          disabled={done || !mine || complete.isPending}
          noHaptic
          onPress={() => (hasChecklist ? router.push({ pathname: '/task/[id]', params: { id: task.id } }) : complete.mutate({ id: task.id }))}
          style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: done ? t.c.accent : t.c.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', opacity: mine || done ? 1 : 0.4 }}
        >
          <Animated.View style={[{ position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: t.c.primary }, fill]} />
          {done ? <Icon name="check" size={20} color={t.c.onPrimary} strokeWidth={3} /> : task.emoji ? <Text style={{ fontSize: 17 }}>{task.emoji}</Text> : null}
        </Pressy>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" color={done ? 'soft' : 'ink'} style={done ? { textDecorationLine: 'line-through' } : undefined} numberOfLines={2}>
            {task.title}
          </Text>
          <Row gap={8} wrap>
            {task.pendingApproval ? (
              <Text variant="smallBold" color="warning">
                ⏳ {tr('Waiting for approval')}
              </Text>
            ) : null}
            {overdue ? (
              <Text variant="smallBold" color="danger">
                ⚠ {tr('Overdue')}
              </Text>
            ) : null}
            {task.streak && task.streak.current > 1 ? (
              <Text variant="smallBold" color="accent">
                🔥 {task.streak.current}
              </Text>
            ) : null}
            <Text variant="small" color="soft" numberOfLines={1}>
              {meta.join(' · ')}
            </Text>
          </Row>
        </View>
        {task.effectiveAssigneeId && task.effectiveAssigneeId !== hh.me?.id ? <Avatar name={hh.name(task.effectiveAssigneeId)} color={hh.color(task.effectiveAssigneeId)} size={26} /> : null}
        <Row gap={4} style={{ backgroundColor: t.c.surfaceAlt, borderRadius: 999, paddingLeft: 4, paddingRight: 10, paddingVertical: 3 }}>
          <Coin denom={task.reward >= 100 ? 100 : task.reward >= 50 ? 50 : task.reward >= 25 ? 25 : task.reward >= 10 ? 10 : task.reward >= 5 ? 5 : 1} size={22} />
          <Text variant="number">{task.reward}</Text>
        </Row>
      </Row>
    </Pressy>
  );
}
