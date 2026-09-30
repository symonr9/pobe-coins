/**
 * POBE Shop cosmetics: a global catalog bought with coins and unlocked per member.
 * The five base themes and their icons are always free.
 */
import type { ChubbyAccessory } from './art';

export type CosmeticKind = 'accessory' | 'icon' | 'background';

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  description: string;
  price: number;
  /** For accessories: which accessory it unlocks. */
  accessory?: ChubbyAccessory;
  /** Seasonal items are only for sale between these month-days (MM-DD). */
  season?: { from: string; to: string };
}

export const COSMETICS: Cosmetic[] = [
  { id: 'acc-flower', kind: 'accessory', accessory: 'flower', name: 'Daisy clip', description: 'A little flower for a little friend.', price: 25 },
  { id: 'acc-bow', kind: 'accessory', accessory: 'bow', name: 'Ribbon bow', description: 'Very dapper. Very soft.', price: 30 },
  { id: 'acc-glasses', kind: 'accessory', accessory: 'glasses', name: 'Reading glasses', description: 'For studying the ledger.', price: 45 },
  { id: 'acc-beanie', kind: 'accessory', accessory: 'beanie', name: 'Cozy beanie', description: 'Knitted in your theme color.', price: 40 },
  { id: 'acc-scarf', kind: 'accessory', accessory: 'scarf', name: 'Winter scarf', description: 'Warm neck, warm heart.', price: 50 },
  { id: 'acc-party-hat', kind: 'accessory', accessory: 'party-hat', name: 'Party hat', description: 'Every finished chore is a party.', price: 60 },
  { id: 'acc-crown', kind: 'accessory', accessory: 'crown', name: 'Yuzu crown', description: 'For royalty of the chore chart.', price: 250 },
  { id: 'bg-meadow', kind: 'background', name: 'Spring meadow', description: 'Clover and sunshine behind Chubbybara.', price: 80 },
  { id: 'bg-onsen', kind: 'background', name: 'Hot spring', description: 'Steam, yuzu and total relaxation.', price: 120 },
  { id: 'bg-stars', kind: 'background', name: 'Starry night', description: 'For evening chore sessions.', price: 100 },
  { id: 'icon-yuzu', kind: 'icon', name: 'Yuzu icon', description: 'A sunny yellow app icon.', price: 150 },
  { id: 'icon-sleepy', kind: 'icon', name: 'Sleepy icon', description: 'Chubbybara napping on your home screen.', price: 150 },
  {
    id: 'acc-santa',
    kind: 'accessory',
    accessory: 'beanie',
    name: 'Holiday beanie',
    description: 'Seasonal: December only.',
    price: 75,
    season: { from: '12-01', to: '12-31' },
  },
];

export function findCosmetic(id: string) {
  return COSMETICS.find((c) => c.id === id);
}

/** Whether a cosmetic is on sale on a local date (YYYY-MM-DD). */
export function isAvailable(c: Cosmetic, localDate: string): boolean {
  if (!c.season) return true;
  const md = localDate.slice(5);
  return c.season.from <= c.season.to ? md >= c.season.from && md <= c.season.to : md >= c.season.from || md <= c.season.to;
}
