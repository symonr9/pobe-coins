import { useMutation } from '@tanstack/react-query';
import { pickLine } from '@pobe/core';
import { actions, useRefreshAll } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useCelebrate } from '@/features/celebrate';
import { useFeedback } from '@/ui/Feedback';
import { useHousehold } from '@/features/useHousehold';
import { haptic } from '@/lib/feedback';
import { track } from '@/lib/monitoring';

/** Completing a chore: celebrate, offer undo, handle approvals and errors kindly. */
export function useCompleteTask() {
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const { toast } = useFeedback();
  const { t } = useTranslation();
  const hh = useHousehold();
  const undo = useMutation({ mutationFn: actions.undoCompletion, onSettled: () => refresh() });
  return useMutation({
    mutationFn: actions.completeTask,
    onSuccess: (r: any) => {
      const c = r.completion;
      track('chore_completed', { reward: c.reward, pending: c.status === 'pending' });
      if (c.status === 'pending') {
        const partner = hh.members.find((m) => m.id !== hh.me?.id)?.name ?? t('someone');
        toast(t(pickLine('taskPending', { vars: { task: c.taskTitle, partner, coins: c.reward } }).text), 'info');
        haptic.success();
        return;
      }
      if (r.milestone) {
        celebrate({
          amount: c.reward + r.milestone.bonus,
          title: t('{{n}} in a row!', { n: r.milestone.streak }),
          line: t(pickLine('streakMilestone', { vars: { streak: r.milestone.streak, coins: r.milestone.bonus, task: c.taskTitle } }).text),
          big: true,
        });
      } else if (c.reward > 0) {
        celebrate({ amount: c.reward, line: t(pickLine('taskDone', { vars: { task: c.taskTitle, coins: c.reward } }).text) });
      } else haptic.success();
      toast(t('Done: {{task}}', { task: c.taskTitle }), 'success', {
        label: t('Undo'),
        onPress: () =>
          undo.mutate(
            { id: c.id },
            {
              onSuccess: () => toast(t('Undone. The coins went back.')),
              onError: (e) => toast(e instanceof ApiError ? e.message : t('Couldn\'t undo.'), 'error'),
            },
          ),
      });
    },
    onError: (e) => {
      haptic.warn();
      toast(e instanceof ApiError ? e.message : t('Couldn\'t complete that chore.'), 'error');
    },
    onSettled: () => refresh(),
  });
}
