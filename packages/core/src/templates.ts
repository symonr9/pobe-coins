/**
 * Starter chore templates offered when a household is created and in "+ task".
 * Rewards assume the default coin set; admins can adjust anything.
 */
import type { Recurrence } from './recurrence';

export interface ChoreTemplate {
  id: string;
  category: 'kitchen' | 'cleaning' | 'laundry' | 'outdoor' | 'pets' | 'errands' | 'self-care' | 'admin';
  title: string;
  emoji: string;
  reward: number;
  /** Suggested recurrence (anchor filled in at creation). */
  recurrence?: Omit<Recurrence, 'anchor'>;
  checklist?: string[];
}

export const TEMPLATE_CATEGORIES: Record<ChoreTemplate['category'], string> = {
  kitchen: 'Kitchen',
  cleaning: 'Cleaning',
  laundry: 'Laundry',
  outdoor: 'Outdoor',
  pets: 'Pets & plants',
  errands: 'Errands',
  'self-care': 'Self-care',
  admin: 'House admin',
};

export const CHORE_TEMPLATES: ChoreTemplate[] = [
  { id: 'dishes', category: 'kitchen', title: 'Do the dishes', emoji: '🍽️', reward: 10, recurrence: { freq: 'daily' } },
  { id: 'dishwasher', category: 'kitchen', title: 'Unload the dishwasher', emoji: '🫧', reward: 5, recurrence: { freq: 'daily' } },
  { id: 'cook', category: 'kitchen', title: 'Cook dinner', emoji: '🍲', reward: 25 },
  { id: 'wipe-counters', category: 'kitchen', title: 'Wipe the counters', emoji: '🧽', reward: 5, recurrence: { freq: 'daily' } },
  { id: 'fridge', category: 'kitchen', title: 'Clean out the fridge', emoji: '🧊', reward: 25, recurrence: { freq: 'monthly' } },
  { id: 'meal-plan', category: 'kitchen', title: 'Plan meals for the week', emoji: '📝', reward: 15, recurrence: { freq: 'weekly' } },
  { id: 'trash', category: 'cleaning', title: 'Take out the trash', emoji: '🗑️', reward: 5, recurrence: { freq: 'weekly' } },
  { id: 'recycling', category: 'cleaning', title: 'Take out the recycling', emoji: '♻️', reward: 5, recurrence: { freq: 'weekly' } },
  { id: 'vacuum', category: 'cleaning', title: 'Vacuum the living room', emoji: '🧹', reward: 15, recurrence: { freq: 'weekly' } },
  { id: 'mop', category: 'cleaning', title: 'Mop the floors', emoji: '🪣', reward: 20, recurrence: { freq: 'weekly', interval: 2 } },
  {
    id: 'bathroom',
    category: 'cleaning',
    title: 'Clean the bathroom',
    emoji: '🛁',
    reward: 25,
    recurrence: { freq: 'weekly' },
    checklist: ['Toilet', 'Sink & mirror', 'Shower / tub', 'Floor'],
  },
  { id: 'dust', category: 'cleaning', title: 'Dust shelves and surfaces', emoji: '🪶', reward: 10, recurrence: { freq: 'weekly', interval: 2 } },
  { id: 'tidy', category: 'cleaning', title: '10-minute tidy-up', emoji: '✨', reward: 5, recurrence: { freq: 'daily' } },
  {
    id: 'deep-clean',
    category: 'cleaning',
    title: 'Deep clean the kitchen',
    emoji: '🧼',
    reward: 50,
    recurrence: { freq: 'monthly' },
    checklist: ['Oven & stovetop', 'Microwave', 'Cabinet fronts', 'Floor'],
  },
  { id: 'laundry', category: 'laundry', title: 'Do a load of laundry', emoji: '🧺', reward: 10 },
  { id: 'fold', category: 'laundry', title: 'Fold and put away laundry', emoji: '👕', reward: 10 },
  { id: 'sheets', category: 'laundry', title: 'Change the bed sheets', emoji: '🛏️', reward: 15, recurrence: { freq: 'weekly', interval: 2 } },
  { id: 'make-bed', category: 'laundry', title: 'Make the bed', emoji: '🛌', reward: 1, recurrence: { freq: 'daily' } },
  { id: 'mow', category: 'outdoor', title: 'Mow the lawn', emoji: '🌱', reward: 25, recurrence: { freq: 'weekly' } },
  { id: 'weeds', category: 'outdoor', title: 'Pull weeds', emoji: '🌿', reward: 15 },
  { id: 'car-wash', category: 'outdoor', title: 'Wash the car', emoji: '🚗', reward: 25, recurrence: { freq: 'monthly' } },
  { id: 'water-plants', category: 'pets', title: 'Water the plants', emoji: '🪴', reward: 5, recurrence: { freq: 'weekly', byWeekday: [1, 4] } },
  { id: 'feed-pet', category: 'pets', title: 'Feed the pet', emoji: '🐾', reward: 1, recurrence: { freq: 'daily' } },
  { id: 'walk-dog', category: 'pets', title: 'Walk the dog', emoji: '🐕', reward: 10, recurrence: { freq: 'daily' } },
  { id: 'litter', category: 'pets', title: 'Clean the litter box', emoji: '🐈', reward: 5, recurrence: { freq: 'daily' } },
  { id: 'groceries', category: 'errands', title: 'Grocery run', emoji: '🛒', reward: 15, recurrence: { freq: 'weekly' } },
  { id: 'pharmacy', category: 'errands', title: 'Pick up prescriptions', emoji: '💊', reward: 10 },
  { id: 'returns', category: 'errands', title: 'Drop off returns', emoji: '📦', reward: 10 },
  { id: 'workout', category: 'self-care', title: 'Work out', emoji: '💪', reward: 10, recurrence: { freq: 'weekly', byWeekday: [1, 3, 5] } },
  { id: 'read', category: 'self-care', title: 'Read for 20 minutes', emoji: '📚', reward: 5, recurrence: { freq: 'daily' } },
  { id: 'water', category: 'self-care', title: 'Drink 8 glasses of water', emoji: '💧', reward: 5, recurrence: { freq: 'daily' } },
  { id: 'bills', category: 'admin', title: 'Pay the bills', emoji: '🧾', reward: 15, recurrence: { freq: 'monthly' } },
  { id: 'budget', category: 'admin', title: 'Review the budget together', emoji: '📊', reward: 25, recurrence: { freq: 'monthly' } },
  { id: 'call-family', category: 'admin', title: 'Call family', emoji: '📞', reward: 10, recurrence: { freq: 'weekly' } },
];

export const STARTER_SHOP_ITEMS = [
  { title: 'Breakfast in bed', emoji: '🥞', price: 50 },
  { title: 'Pick the movie', emoji: '🎬', price: 10 },
  { title: 'Skip one chore', emoji: '🙅', price: 25 },
  { title: 'Back massage (15 min)', emoji: '💆', price: 40 },
  { title: 'Sleep in on Saturday', emoji: '😴', price: 30 },
  { title: 'Choose date night', emoji: '💞', price: 75 },
  { title: 'Fancy coffee run', emoji: '☕', price: 20 },
];

export function findTemplate(id: string) {
  return CHORE_TEMPLATES.find((t) => t.id === id);
}
