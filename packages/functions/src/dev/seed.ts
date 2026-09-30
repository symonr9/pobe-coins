/**
 * Demo household for local development and screenshots: Sam (admin) and Alex, a few
 * weeks of chores, purchases, a shared goal and a running challenge.
 */
import type { Actor, Deps } from '../context';
import { keys } from '../db/keys';
import { getMember, listTasks, toItem } from '../repo';
import { createHousehold, addMember } from '../services/households';
import { completeTask, createChallenge, createTask } from '../services/tasks';
import { contributeToGoal, createGoal, createPurchase } from '../services/purchases';
import { gift } from '../services/money';

export async function seedDemo(deps: Deps) {
  const realNow = deps.now;
  const start = Date.now() - 20 * 86400_000;
  let offset = 0;
  deps.now = () => new Date(start + offset);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const { household, member: sam } = await createHousehold(
    deps,
    { sub: 'sam', name: 'Sam' },
    {
      name: 'The Cozy Burrow',
      memberName: 'Sam',
      timeZone: tz,
      templateIds: ['dishes', 'trash', 'vacuum', 'bathroom', 'water-plants', 'laundry', 'groceries'],
    },
  );
  const samActor: Actor = { householdId: household.id, memberId: sam.id, role: 'admin', principal: { kind: 'user', sub: 'sam' } };
  const alex = await addMember(deps, samActor, { name: 'Alex', role: 'admin' });
  const alexMember = await getMember(deps, household.id, alex.id);
  await deps.db.transact([
    { put: toItem.member({ ...alexMember, userSub: 'alex', version: alexMember.version + 1 }), if: { version: alexMember.version } },
    { put: { ...keys.userHousehold('alex', household.id), householdId: household.id, householdName: household.name, memberId: alex.id } },
  ]);
  const alexActor: Actor = { householdId: household.id, memberId: alex.id, role: 'admin', principal: { kind: 'user', sub: 'alex' } };

  await createTask(deps, samActor, { title: 'Deep clean the kitchen', emoji: '🧼', reward: 50, assigneeId: null, requiresApproval: true });
  await createTask(deps, samActor, { title: 'Plan date night', emoji: '💞', reward: 25, assigneeId: alex.id, requiresApproval: false });

  const tasks = await listTasks(deps, household.id);
  const dishes = tasks.find((t) => t.templateId === 'dishes')!;
  const plants = tasks.find((t) => t.templateId === 'water-plants')!;
  const laundry = tasks.find((t) => t.templateId === 'laundry')!;
  const groceries = tasks.find((t) => t.templateId === 'groceries')!;

  // Three weeks of dishes alternating, plus odds and ends.
  for (let day = 0; day < 20; day++) {
    offset = day * 86400_000 + 19 * 3600_000;
    const who = day % 3 === 0 ? samActor : alexActor;
    await completeTask(deps, who, dishes.id, {}).catch(() => undefined);
    if (day % 4 === 1) await completeTask(deps, alexActor, plants.id, {}).catch(() => undefined);
    if (day % 7 === 2) await completeTask(deps, samActor, groceries.id, {}).catch(() => undefined);
    if (day === 5) {
      await createPurchase(deps, alexActor, { title: 'Iced matcha latte', amount: 20, photoKeys: [], allowIou: false });
    }
    if (day === 9) await gift(deps, samActor, alex.id, 15, 'for making dinner');
    if (day === 12) {
      await createPurchase(deps, samActor, {
        title: 'Cozy socks',
        description: 'The fuzzy yellow ones',
        amount: 35,
        photoKeys: [],
        allowIou: false,
      });
    }
  }
  offset = 19 * 86400_000 + 20 * 3600_000;
  await completeTask(deps, samActor, laundry.id, {}).catch(() => undefined);
  const goal = await createGoal(deps, samActor, { title: 'Picnic basket for two', target: 300, shared: true });
  await contributeToGoal(deps, samActor, goal.id, 40).catch(() => undefined);
  await contributeToGoal(deps, alexActor, goal.id, 60).catch(() => undefined);
  await createGoal(deps, alexActor, { title: 'New sketchbook', target: 120, shared: false });
  const now = new Date(start + offset);
  await createChallenge(deps, samActor, {
    title: 'Spring-clean week: earn 300 together',
    target: 300,
    bonus: 25,
    startsAt: new Date(now.getTime() - 3 * 86400_000).toISOString(),
    endsAt: new Date(now.getTime() + 4 * 86400_000).toISOString(),
  });
  deps.now = realNow;
  return { householdId: household.id };
}
