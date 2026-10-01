import {
  EMPTY_STREAK,
  QUOTAS,
  applyCompletion,
  currentStreak,
  dueAt,
  periodKey,
  rotationAssignee,
  type Challenge,
  type Completion,
  type Household,
  type LedgerEntry,
  type Member,
  type StreakRecord,
  type Task,
  type TaskInput,
} from '@pobe/core';
import type { Actor, Deps } from '../context';
import { keys, partition, PREFIX } from '../db/keys';
import { ConditionFailed, strip, type Item, type WriteOp } from '../db/types';
import { ApiError, forbidden, notFound } from '../lib/errors';
import { ulid } from '../lib/ids';
import {
  auditOp,
  getCompletion,
  getHousehold,
  getLedgerEntries,
  getMember,
  getTask,
  listByPrefix,
  listMembers,
  listTasks,
  toItem,
} from '../repo';
import { requireAdmin } from './auth';
import { commitMoney, credit, grantBonus, newEntry, reverseCredit } from './money';

const GUARD_TTL_DAYS = 400;

export interface TaskView extends Task {
  /** Who is up for this task right now (rotation-aware). null = pool. */
  effectiveAssigneeId: string | null;
  period?: string;
  /** Done (or awaiting approval) for the current period / one-off. */
  doneThisPeriod: boolean;
  pendingApproval: boolean;
  nextDueAt?: string;
  streak?: { current: number; best: number };
}

function effectiveAssignee(task: Task, period: string | undefined): string | null {
  if (task.recurrence && task.rotation?.length && period) {
    return rotationAssignee(task.recurrence, task.rotation, period, task.rotationOffset ?? 0) ?? null;
  }
  return task.assigneeId;
}

function currentPeriodOf(task: Task, household: Household, now: Date) {
  if (!task.recurrence) return undefined;
  return periodKey(task.recurrence, now, household.settings.timeZone) ?? undefined;
}

export async function listTaskViews(deps: Deps, actor: Actor): Promise<TaskView[]> {
  const [household, tasks] = await Promise.all([getHousehold(deps, actor.householdId), listTasks(deps, actor.householdId)]);
  const now = deps.now();
  const live = tasks.filter((t) => t.status !== 'archived');
  const periods = live.map((t) => currentPeriodOf(t, household, now));
  const guards = await deps.db.getMany<Item & { status: string; completionId: string }>(
    live.flatMap((t, i) => (periods[i] ? [keys.period(actor.householdId, t.id, periods[i]!)] : [])),
  );
  const guardBySk = new Map(guards.map((g) => [g.sk, g]));
  const streaks = await deps.db.getMany<Item & StreakRecord>(
    live.filter((t) => t.recurrence).map((t) => keys.streak(actor.householdId, t.id, actor.memberId)),
  );
  const streakByTask = new Map(streaks.map((s) => [s.taskId, s]));
  return live.map((t, i) => {
    const period = periods[i];
    const guard = period ? guardBySk.get(keys.period(actor.householdId, t.id, period).sk) : undefined;
    const s = streakByTask.get(t.id);
    const live = s && t.recurrence ? currentStreak(t.recurrence, s, now, household.settings.timeZone) : undefined;
    return {
      ...t,
      effectiveAssigneeId: effectiveAssignee(t, period),
      period,
      doneThisPeriod: t.recurrence ? !!guard : t.status === 'done' || t.status === 'pending',
      pendingApproval: t.recurrence ? guard?.status === 'pending' : t.status === 'pending',
      nextDueAt: t.recurrence && period ? dueAt(t.recurrence, period, household.settings.timeZone).toISOString() : t.dueAt,
      streak: live ? { current: live.current, best: live.best } : undefined,
    };
  });
}

export async function createTask(deps: Deps, actor: Actor, input: TaskInput) {
  const open = (await listTasks(deps, actor.householdId)).filter((t) => t.status !== 'archived' && t.status !== 'done');
  if (open.length >= QUOTAS.openTasksPerHousehold)
    throw new ApiError('QUOTA', 'This household has too many open tasks. Archive some first.');
  await validateAssignees(deps, actor, input.assigneeId, input.rotation);
  const now = deps.now().toISOString();
  const task: Task = {
    id: ulid(deps.now().getTime()),
    householdId: actor.householdId,
    title: input.title,
    notes: input.notes,
    emoji: input.emoji,
    reward: input.reward,
    assigneeId: input.assigneeId ?? null,
    requiresApproval: input.requiresApproval ?? false,
    recurrence: input.recurrence,
    rotation: input.rotation?.length ? input.rotation : undefined,
    streakRule: input.recurrence ? input.streakRule : undefined,
    checklist: input.checklist?.map((c) => ({ id: c.id ?? ulid(deps.now().getTime()), label: c.label })),
    partialCredit: input.partialCredit,
    dueAt: input.dueAt,
    status: 'open',
    templateId: input.templateId,
    createdAt: now,
    createdBy: actor.memberId,
    updatedAt: now,
  };
  await deps.db.put(toItem.task(task), { notExists: true });
  return task;
}

async function validateAssignees(deps: Deps, actor: Actor, assigneeId?: string | null, rotation?: string[]) {
  const ids = [...(assigneeId ? [assigneeId] : []), ...(rotation ?? [])];
  if (!ids.length) return;
  const members = new Set((await listMembers(deps, actor.householdId)).map((m) => m.id));
  for (const id of ids) if (!members.has(id)) throw new ApiError('BAD_REQUEST', "One of the chosen members isn't in this household.");
}

export async function updateTask(deps: Deps, actor: Actor, taskId: string, input: Partial<TaskInput> & { status?: 'open' | 'archived' }) {
  const task = await getTask(deps, actor.householdId, taskId);
  if (actor.role !== 'admin' && task.createdBy !== actor.memberId)
    throw forbidden('Only admins or the person who created a task can edit it.');
  await validateAssignees(deps, actor, input.assigneeId, input.rotation);
  const updated: Task = {
    ...task,
    ...input,
    checklist: input.checklist
      ? input.checklist.map((c) => {
          const prev = task.checklist?.find((p) => p.id === c.id);
          return { ...prev, id: c.id ?? ulid(deps.now().getTime()), label: c.label };
        })
      : task.checklist,
    assigneeId: input.assigneeId === undefined ? task.assigneeId : input.assigneeId,
    status: input.status ?? task.status,
    updatedAt: deps.now().toISOString(),
  } as Task;
  await deps.db.put(toItem.task(updated));
  return updated;
}

export async function archiveTask(deps: Deps, actor: Actor, taskId: string) {
  return updateTask(deps, actor, taskId, { status: 'archived' });
}

export async function claimTask(deps: Deps, actor: Actor, taskId: string, claim: boolean) {
  const task = await getTask(deps, actor.householdId, taskId);
  if (task.assigneeId || task.rotation?.length) throw new ApiError('BAD_REQUEST', 'Only pool tasks can be claimed.');
  if (claim && task.claimedBy && task.claimedBy !== actor.memberId) {
    const who = await getMember(deps, actor.householdId, task.claimedBy).catch(() => null);
    throw new ApiError('CONFLICT', `${who?.name ?? 'Someone'} already claimed this task.`);
  }
  if (!claim && task.claimedBy !== actor.memberId && actor.role !== 'admin')
    throw forbidden('Only the person who claimed it can release it.');
  const updated: Task = {
    ...task,
    claimedBy: claim ? actor.memberId : undefined,
    status: claim ? 'claimed' : 'open',
    updatedAt: deps.now().toISOString(),
  };
  const cond = claim ? { equals: { status: 'open' } } : undefined;
  try {
    await deps.db.put(toItem.task(updated), task.status === 'open' ? cond : undefined);
  } catch (err) {
    if (err instanceof ConditionFailed) throw new ApiError('CONFLICT', 'Someone just claimed this task.');
    throw err;
  }
  return updated;
}

/** Rotation: skip ahead / swap turns. */
export async function shiftRotation(deps: Deps, actor: Actor, taskId: string, by: number) {
  const task = await getTask(deps, actor.householdId, taskId);
  if (!task.rotation?.length) throw new ApiError('BAD_REQUEST', "This task doesn't rotate.");
  const updated: Task = { ...task, rotationOffset: (task.rotationOffset ?? 0) + by, updatedAt: deps.now().toISOString() };
  await deps.db.put(toItem.task(updated));
  return updated;
}

interface Payout {
  member: Member;
  entries: LedgerEntry[];
  streakOp?: WriteOp;
  streakBefore?: StreakRecord;
  milestone?: { streak: number; bonus: number };
}

async function payCompletion(
  deps: Deps,
  actor: Actor,
  household: Household,
  task: Task,
  completion: Completion,
  member: Member,
): Promise<Payout> {
  const { coinTypes } = household.settings;
  const earn = credit(member, completion.reward, coinTypes);
  let m = earn.member;
  const entries = [
    newEntry(deps, actor, member, 'EARN', {
      value: completion.reward,
      label: completion.taskTitle,
      coinsIn: earn.coinsIn,
      debtDelta: earn.debtDelta,
      ref: { type: 'task', id: task.id },
    }),
  ];
  let streakOp: WriteOp | undefined;
  let streakBefore: StreakRecord | undefined;
  let milestone: Payout['milestone'];
  if (task.recurrence && completion.period && !completion.checklistItemId) {
    const existing = await deps.db.get<Item & StreakRecord>(keys.streak(household.id, task.id, member.id));
    streakBefore = existing ? (strip(existing) as StreakRecord) : { ...EMPTY_STREAK, taskId: task.id, memberId: member.id };
    const u = applyCompletion(task.recurrence, streakBefore, completion.period, task.streakRule);
    if (!u.duplicate) {
      streakOp = { put: toItem.streak(household.id, { ...u.streak, taskId: task.id, memberId: member.id }) };
      if (u.bonus > 0) {
        const b = credit(m, u.bonus, coinTypes);
        entries.push(
          newEntry(deps, actor, m, 'BONUS', {
            value: u.bonus,
            label: `${u.streak.current}-streak bonus: ${task.title}`,
            coinsIn: b.coinsIn,
            debtDelta: b.debtDelta,
            ref: { type: 'task', id: task.id },
          }),
        );
        m = b.member;
        milestone = { streak: u.streak.current, bonus: u.bonus };
      }
    }
  }
  return { member: m, entries, streakOp, streakBefore, milestone };
}

function guardOp(hid: string, task: Task, completion: Completion, now: Date): WriteOp | undefined {
  if (!completion.period) return undefined;
  const period = completion.checklistItemId ? `${completion.period}#${completion.checklistItemId}` : completion.period;
  return {
    put: {
      ...keys.period(hid, task.id, period),
      ttl: Math.floor(now.getTime() / 1000) + GUARD_TTL_DAYS * 86400,
      completionId: completion.id,
      memberId: completion.memberId,
      status: completion.status,
    },
    if: { notExists: true },
  };
}

export async function completeTask(
  deps: Deps,
  actor: Actor,
  taskId: string,
  input: { note?: string; photoKey?: string; checklistItemId?: string },
) {
  const household = await getHousehold(deps, actor.householdId);
  const now = deps.now();
  if (input.photoKey && !input.photoKey.startsWith(`h/${actor.householdId}/`))
    throw new ApiError('BAD_REQUEST', "That photo doesn't belong to this household.");
  const members = await listMembers(deps, actor.householdId);
  const result = await commitMoney(deps, async () => {
    const task = await getTask(deps, actor.householdId, taskId);
    if (task.status === 'archived') throw new ApiError('BAD_REQUEST', 'This task is archived.');
    const period = currentPeriodOf(task, household, now);
    if (task.recurrence && !period) throw new ApiError('BAD_REQUEST', "This chore hasn't started yet.");
    if (!task.recurrence && (task.status === 'done' || task.status === 'pending')) {
      throw new ApiError('CONFLICT', task.status === 'done' ? 'This task is already done.' : 'This task is already waiting for approval.');
    }
    const assignee = effectiveAssignee(task, period);
    if (assignee && assignee !== actor.memberId) {
      const who = members.find((m) => m.id === assignee);
      throw forbidden(`This one is ${who?.name ?? 'someone else'}'s turn.`);
    }
    if (!assignee && task.claimedBy && task.claimedBy !== actor.memberId) {
      throw forbidden('Someone else claimed this task.');
    }
    if (period) {
      const guardKey = keys.period(actor.householdId, task.id, input.checklistItemId ? `${period}#${input.checklistItemId}` : period);
      if (await deps.db.get(guardKey))
        throw new ApiError('CONFLICT', 'This one is already done for now. It comes back next time it repeats.');
    }
    let reward = task.reward;
    let item;
    if (input.checklistItemId) {
      item = task.checklist?.find((c) => c.id === input.checklistItemId);
      if (!item) throw notFound('That checklist item');
      if (task.partialCredit && task.checklist?.length) {
        const n = task.checklist.length;
        const index = task.checklist.indexOf(item);
        reward = Math.floor(task.reward / n) + (index === n - 1 ? task.reward % n : 0);
      } else reward = 0;
    }
    const needsApproval = task.requiresApproval && members.length > 1;
    const completion: Completion = {
      id: ulid(now.getTime()),
      householdId: actor.householdId,
      taskId: task.id,
      taskTitle: item ? `${task.title}: ${item.label}` : task.title,
      memberId: actor.memberId,
      reward,
      period: period ?? (input.checklistItemId ? 'once' : undefined),
      checklistItemId: input.checklistItemId,
      status: needsApproval ? 'pending' : 'approved',
      note: input.note,
      photoKey: input.photoKey,
      ledgerEntryIds: [],
      createdAt: now.toISOString(),
    };
    const member = await getMember(deps, actor.householdId, actor.memberId);
    const ops: WriteOp[] = [];
    let payout: Payout | undefined;
    if (!needsApproval && reward > 0) {
      payout = await payCompletion(deps, actor, household, task, completion, member);
      completion.ledgerEntryIds = payout.entries.map((e) => e.id);
      if (payout.streakOp) ops.push(payout.streakOp);
      if (payout.streakBefore) (completion as Completion & { streakBefore?: StreakRecord }).streakBefore = payout.streakBefore;
    } else if (!needsApproval && task.recurrence && !input.checklistItemId) {
      // Zero-reward recurring chores still build streaks.
      payout = await payCompletion(deps, actor, household, task, { ...completion, reward: 0 }, member);
      payout.entries = payout.entries.filter((e) => e.value !== 0);
      completion.ledgerEntryIds = payout.entries.map((e) => e.id);
      if (payout.streakOp) ops.push(payout.streakOp);
    }
    const guard = guardOp(actor.householdId, task, completion, now);
    if (guard) ops.push(guard);
    // Task state
    let nextTask: Task = task;
    if (item) {
      const checklist = task.checklist!.map((c) => (c.id === item!.id ? { ...c, doneBy: actor.memberId, doneAt: now.toISOString() } : c));
      const allDone = checklist.every((c) => c.doneAt && (!task.recurrence || c.doneAt >= (period ?? '')));
      nextTask = { ...task, checklist, status: !task.recurrence && allDone ? (needsApproval ? 'pending' : 'done') : task.status };
    } else if (!task.recurrence) {
      nextTask = { ...task, status: needsApproval ? 'pending' : 'done' };
    }
    if (nextTask !== task)
      ops.push({ put: toItem.task({ ...nextTask, updatedAt: now.toISOString() }), if: { equals: { updatedAt: task.updatedAt } } });
    ops.push({ put: toItem.completion(completion), if: { notExists: true } });
    return {
      members: payout ? [payout.member] : [],
      entries: payout?.entries ?? [],
      ops,
      result: { completion, task: nextTask, milestone: payout?.milestone, member: payout?.member ?? member },
    };
  }).catch((err) => {
    if (err instanceof ApiError && err.code === 'CONFLICT' && err.message.startsWith('Someone else changed')) {
      throw new ApiError('CONFLICT', 'This chore was just completed.');
    }
    throw err;
  });

  const others = members.filter((m) => m.id !== actor.memberId).map((m) => m.id);
  const me = members.find((m) => m.id === actor.memberId)!;
  if (result.completion.status === 'pending') {
    await deps.notifier.send(actor.householdId, others, {
      title: 'Approve a chore?',
      body: `${me.name} finished "${result.completion.taskTitle}" (+${result.completion.reward}).`,
      url: '/approvals',
      category: 'approval',
      data: { type: 'completion', id: result.completion.id },
    });
  } else if (result.completion.reward > 0) {
    await afterEarn(deps, actor, result.completion.reward);
  }
  return result;
}

export async function decideCompletion(deps: Deps, actor: Actor, completionId: string, approve: boolean, note?: string) {
  const household = await getHousehold(deps, actor.householdId);
  const members = await listMembers(deps, actor.householdId);
  const result = await commitMoney(deps, async () => {
    const completion = await getCompletion(deps, actor.householdId, completionId);
    if (completion.status !== 'pending') throw new ApiError('CONFLICT', `This was already ${completion.status}.`);
    if (completion.memberId === actor.memberId && members.length > 1) throw forbidden('Someone else needs to approve your own chores.');
    const task = await getTask(deps, actor.householdId, completion.taskId);
    const now = deps.now().toISOString();
    const decided: Completion = {
      ...completion,
      status: approve ? 'approved' : 'rejected',
      decidedBy: actor.memberId,
      decidedAt: now,
      note: note ?? completion.note,
    };
    const ops: WriteOp[] = [{ put: toItem.completion(decided), if: { equals: { status: 'pending' } } }];
    const guardPeriod = completion.checklistItemId ? `${completion.period}#${completion.checklistItemId}` : completion.period;
    if (!approve) {
      if (guardPeriod) ops.push({ delete: keys.period(actor.householdId, task.id, guardPeriod) });
      if (!task.recurrence && task.status === 'pending')
        ops.push({ put: toItem.task({ ...task, status: task.claimedBy ? 'claimed' : 'open', updatedAt: now }) });
      return { members: [], entries: [], ops, result: { completion: decided, milestone: undefined } };
    }
    const member = await getMember(deps, actor.householdId, completion.memberId);
    const payout = await payCompletion(deps, actor, household, task, completion, member);
    decided.ledgerEntryIds = payout.entries.map((e) => e.id);
    if (payout.streakBefore) (decided as Completion & { streakBefore?: StreakRecord }).streakBefore = payout.streakBefore;
    ops[0] = { put: toItem.completion(decided), if: { equals: { status: 'pending' } } };
    if (payout.streakOp) ops.push(payout.streakOp);
    if (guardPeriod)
      ops.push({
        put: {
          ...keys.period(actor.householdId, task.id, guardPeriod),
          completionId: completion.id,
          memberId: completion.memberId,
          status: 'approved',
          ttl: Math.floor(Date.parse(now) / 1000) + GUARD_TTL_DAYS * 86400,
        },
      });
    if (!task.recurrence && task.status === 'pending') ops.push({ put: toItem.task({ ...task, status: 'done', updatedAt: now }) });
    return { members: [payout.member], entries: payout.entries, ops, result: { completion: decided, milestone: payout.milestone } };
  });
  const approver = members.find((m) => m.id === actor.memberId);
  await deps.notifier.send(actor.householdId, [result.completion.memberId], {
    title: approve ? 'Chore approved!' : 'Chore sent back',
    body: approve
      ? `${approver?.name ?? 'Someone'} approved "${result.completion.taskTitle}". +${result.completion.reward} coins!`
      : `${approver?.name ?? 'Someone'} didn't approve "${result.completion.taskTitle}" this time.`,
    url: '/timeline',
  });
  if (approve && result.completion.reward > 0)
    await afterEarn(deps, { ...actor, memberId: result.completion.memberId }, result.completion.reward);
  return result;
}

export async function undoCompletion(deps: Deps, actor: Actor, completionId: string) {
  const household = await getHousehold(deps, actor.householdId);
  const now = deps.now();
  return commitMoney(deps, async () => {
    const completion = (await getCompletion(deps, actor.householdId, completionId)) as Completion & { streakBefore?: StreakRecord };
    if (completion.memberId !== actor.memberId) throw forbidden('You can only undo your own chores.');
    if (completion.status !== 'approved' && completion.status !== 'pending')
      throw new ApiError('CONFLICT', `This was already ${completion.status}.`);
    const ageMinutes = (now.getTime() - Date.parse(completion.createdAt)) / 60_000;
    if (ageMinutes > household.settings.undoWindowMinutes) {
      throw new ApiError(
        'CONFLICT',
        `Undo is only available for ${household.settings.undoWindowMinutes} minutes. Ask an admin to correct it.`,
      );
    }
    const task = await getTask(deps, actor.householdId, completion.taskId);
    const ops: WriteOp[] = [{ put: toItem.completion({ ...completion, status: 'undone' }), if: { equals: { status: completion.status } } }];
    const guardPeriod = completion.checklistItemId ? `${completion.period}#${completion.checklistItemId}` : completion.period;
    if (guardPeriod) ops.push({ delete: keys.period(actor.householdId, task.id, guardPeriod) });
    let nextTask = task;
    if (completion.checklistItemId) {
      nextTask = {
        ...task,
        checklist: task.checklist?.map((c) => (c.id === completion.checklistItemId ? { id: c.id, label: c.label } : c)),
        status: task.recurrence ? task.status : task.claimedBy ? 'claimed' : 'open',
      };
    } else if (!task.recurrence) nextTask = { ...task, status: task.claimedBy ? 'claimed' : 'open' };
    if (nextTask !== task) ops.push({ put: toItem.task({ ...nextTask, updatedAt: now.toISOString() }) });
    if (completion.streakBefore) ops.push({ put: toItem.streak(actor.householdId, completion.streakBefore) });
    let member = await getMember(deps, actor.householdId, actor.memberId);
    const entries: LedgerEntry[] = [];
    const originals = await getLedgerEntries(deps, actor.householdId, completion.ledgerEntryIds);
    for (const e of originals.reverse()) {
      const r = reverseCredit(member, e, household.settings.coinTypes);
      entries.push(
        newEntry(deps, actor, member, 'UNDO', {
          value: -e.value,
          label: `Undo: ${e.label}`,
          coinsIn: r.coinsIn,
          coinsOut: r.coinsOut,
          debtDelta: r.debtDelta,
          reverses: e.id,
          ref: e.ref,
        }),
      );
      member = r.member;
    }
    return {
      members: entries.length ? [member] : [],
      entries,
      ops,
      result: { completion: { ...completion, status: 'undone' as const }, member },
    };
  });
}

export async function listPendingApprovals(deps: Deps, actor: Actor) {
  const completions = (await listByPrefix<Completion>(deps, actor.householdId, PREFIX.completion, true, 300)).filter(
    (c) => c.status === 'pending' && c.memberId !== actor.memberId,
  );
  return completions;
}

// ---------- co-op challenges ----------

export async function createChallenge(deps: Deps, actor: Actor, input: Omit<Challenge, 'id' | 'householdId' | 'progress' | 'status'>) {
  requireAdmin(actor);
  if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) throw new ApiError('BAD_REQUEST', 'The end has to be after the start.');
  const c: Challenge = { ...input, id: ulid(deps.now().getTime()), householdId: actor.householdId, progress: 0, status: 'active' };
  await deps.db.transact([{ put: toItem.challenge(c) }, auditOp(deps, actor, 'challenge.create', c.id, { title: c.title })]);
  return c;
}

export async function listChallenges(deps: Deps, actor: Actor) {
  return listByPrefix<Challenge>(deps, actor.householdId, PREFIX.challenge, true, 50);
}

/** After coins are earned: advance co-op challenges and pay out wins. */
export async function afterEarn(deps: Deps, actor: Actor, amount: number) {
  const now = deps.now();
  const active = (await listChallenges(deps, actor)).filter(
    (c) => c.status === 'active' && Date.parse(c.startsAt) <= now.getTime() && Date.parse(c.endsAt) > now.getTime(),
  );
  for (const c of active) {
    const progress = await deps.db.increment(keys.challenge(actor.householdId, c.id), 'progress', amount);
    if (progress < c.target) continue;
    try {
      await deps.db.put(toItem.challenge({ ...c, progress, status: 'won' }), { equals: { status: 'active' } });
    } catch (err) {
      if (err instanceof ConditionFailed) continue; // someone else already paid it out
      throw err;
    }
    const members = await listMembers(deps, actor.householdId);
    if (c.bonus > 0) {
      for (const m of members) await grantBonus(deps, { ...actor, memberId: m.id }, m.id, c.bonus, `Challenge won: ${c.title}`);
    }
    await deps.notifier.send(
      actor.householdId,
      members.map((m) => m.id),
      {
        title: 'Challenge complete!',
        body: `You did "${c.title}" together.${c.bonus ? ` Everyone gets ${c.bonus} coins!` : ''}`,
        url: '/',
      },
    );
  }
}

export async function deleteChallenge(deps: Deps, actor: Actor, id: string) {
  requireAdmin(actor);
  await deps.db.delete(keys.challenge(actor.householdId, id));
}

export { partition };
