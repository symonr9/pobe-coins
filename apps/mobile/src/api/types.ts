import type {
  Challenge,
  Completion,
  Cosmetic,
  Device,
  DeviceLinkInfo,
  Household,
  LedgerEntry,
  LinkPreview,
  Member,
  Purchase,
  Session,
  ShopItem,
  Task,
  WishlistGoal,
  AuditEntry,
  Comment,
  Reaction,
} from '@pobe/core';

export type { Challenge, Completion, Household, LedgerEntry, LinkPreview, Member, Purchase, Session, ShopItem, Task, WishlistGoal, Device, AuditEntry, Comment, Reaction };

export type MeResponse = Session | { household: null; user: { sub: string; name?: string; email?: string } | null; households: { id: string; name: string }[] };

export const hasHousehold = (me: MeResponse | undefined): me is Session => !!me && me.household !== null;

export interface TaskView extends Task {
  effectiveAssigneeId: string | null;
  period?: string;
  doneThisPeriod: boolean;
  pendingApproval: boolean;
  nextDueAt?: string;
  streak?: { current: number; best: number };
}

export interface TimelineItem {
  entry: LedgerEntry;
  purchase?: Pick<Purchase, 'id' | 'title' | 'url' | 'preview' | 'status' | 'redemption' | 'kind'>;
  thumbUrl?: string;
  reactions: { memberId: string; emoji: string }[];
  comments: number;
}

export interface TimelinePage {
  pending: ({ type: 'completion'; at: string; completion: Completion } | { type: 'purchase'; at: string; purchase: Purchase })[];
  items: TimelineItem[];
  nextCursor: string | null;
}

export interface ShopResponse {
  items: (ShopItem & { remaining: number | null })[];
  cosmetics: (Cosmetic & { owned: boolean })[];
}

export interface StatsResponse {
  series: { week: string; earned: number; spent: number }[];
  topChores: { label: string; count: number; coins: number }[];
  balances: { memberId: string; balance: number; debt: number }[];
  leaderboard: { thisWeek: LeaderRow[]; lastWeek: LeaderRow[] } | null;
}
export interface LeaderRow {
  memberId: string;
  earned: number;
  completions: number;
}

export interface WrappedResponse {
  period: string;
  earned: number;
  spent: number;
  completions: number;
  bonuses: number;
  giftsGiven: number;
  giftsReceived: number;
  topChores: { label: string; count: number; coins: number }[];
  biggestPurchase?: { label: string; amount: number; entryId: string };
  busiestWeekday?: { weekday: number; completions: number };
  bestStreak: number;
}

export interface PurchaseDetail {
  purchase: Purchase;
  photoUrls: string[];
  fundedBy: { label: string; amount: number; count: number; iou: boolean }[];
}

export interface WidgetSnapshot {
  name: string;
  balance: number;
  purse: Record<string, number>;
  debt: number;
  theme: string;
  accessory: string;
  today: number;
  next: { id: string; title: string; emoji?: string; reward: number }[];
  line: string;
  pose: string;
  updatedAt: string;
}

export type { DeviceLinkInfo };
