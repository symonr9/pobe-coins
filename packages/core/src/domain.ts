/**
 * Domain entities shared by the API (stored in DynamoDB) and the app (received as JSON).
 * Timestamps are ISO strings. Ids are opaque strings (ULIDs on the server).
 */
import type { Purse } from './coins';
import type { LedgerEntry } from './ledger';
import type { LocalDate, Recurrence } from './recurrence';
import type { Streak, StreakRule } from './streaks';
import type { ChubbyAccessory } from './art';
import type { ThemeName } from './theme';

export type Role = 'admin' | 'member';
export type Visibility = 'full' | 'balances';

export interface HouseholdSettings {
  coinTypes: number[];
  /** Purchases above this amount need another member's approval. null = never. */
  purchaseApprovalThreshold: number | null;
  /** Maximum IOU debt per member. 0 disables IOUs. */
  debtLimit: number;
  visibility: Visibility;
  timeZone: string;
  leaderboardEnabled: boolean;
  /** Minutes during which a member can undo their own completion/purchase. */
  undoWindowMinutes: number;
  locale: string;
}

export interface Household {
  id: string;
  name: string;
  settings: HouseholdSettings;
  createdAt: string;
  createdBy: string;
}

export interface Member {
  id: string;
  householdId: string;
  name: string;
  role: Role;
  /** Theme color for avatars and charts. */
  color: string;
  theme: ThemeName;
  purse: Purse;
  debt: number;
  /** Linked OAuth identity (Cognito sub). */
  userSub?: string;
  equipped: { accessory: ChubbyAccessory; icon?: string; background?: string };
  version: number;
  createdAt: string;
  deletedAt?: string;
}

export type TaskStatus = 'open' | 'claimed' | 'pending' | 'done' | 'archived';

export interface ChecklistItem {
  id: string;
  label: string;
  doneBy?: string;
  doneAt?: string;
}

export interface Task {
  id: string;
  householdId: string;
  title: string;
  notes?: string;
  emoji?: string;
  reward: number;
  /** null = shared pool (anyone can claim). */
  assigneeId: string | null;
  claimedBy?: string;
  requiresApproval: boolean;
  recurrence?: Recurrence;
  /** Members rotating through a recurring chore. */
  rotation?: string[];
  rotationOffset?: number;
  streakRule?: StreakRule;
  checklist?: ChecklistItem[];
  /** Pay the reward split across checklist items as each is checked. */
  partialCredit?: boolean;
  /** One-off due time (ISO). Recurring tasks compute theirs. */
  dueAt?: string;
  /** Current period for recurring chores. */
  currentPeriod?: LocalDate;
  status: TaskStatus;
  templateId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'undone';

export interface Completion {
  id: string;
  householdId: string;
  taskId: string;
  taskTitle: string;
  memberId: string;
  reward: number;
  period?: LocalDate;
  checklistItemId?: string;
  status: ApprovalStatus;
  note?: string;
  photoKey?: string;
  ledgerEntryIds: string[];
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export type PurchaseKind = 'purchase' | 'reward' | 'goal';

export interface Purchase {
  id: string;
  householdId: string;
  memberId: string;
  kind: PurchaseKind;
  title: string;
  description?: string;
  amount: number;
  url?: string;
  preview?: LinkPreview;
  photoKeys: string[];
  shopItemId?: string;
  goalId?: string;
  status: ApprovalStatus;
  /** Shop rewards: has the reward been delivered? */
  redemption?: 'redeemed' | 'fulfilled';
  fulfilledBy?: string;
  ledgerEntryIds: string[];
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface ShopItem {
  id: string;
  householdId: string;
  title: string;
  description?: string;
  emoji?: string;
  price: number;
  /** null = unlimited. */
  stock: number | null;
  /** Hours between purchases per member. */
  cooldownHours?: number;
  requiresApproval: boolean;
  active: boolean;
  createdAt: string;
}

export interface WishlistGoal {
  id: string;
  householdId: string;
  /** null = shared household goal. */
  ownerId: string | null;
  title: string;
  target: number;
  url?: string;
  preview?: LinkPreview;
  photoKey?: string;
  /** Shared goals: coins contributed per member. */
  contributions: Record<string, number>;
  status: 'saving' | 'bought' | 'cancelled';
  createdAt: string;
}

export interface Challenge {
  id: string;
  householdId: string;
  title: string;
  target: number;
  /** Bonus paid to every member on success. */
  bonus: number;
  startsAt: string;
  endsAt: string;
  progress: number;
  status: 'active' | 'won' | 'expired';
}

export interface Reaction {
  itemId: string;
  memberId: string;
  emoji: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  itemId: string;
  memberId: string;
  text: string;
  createdAt: string;
}

export interface StreakRecord extends Streak {
  taskId: string;
  memberId: string;
}

export interface Device {
  id: string;
  householdId: string;
  memberId: string;
  label: string;
  platform: 'ios' | 'android' | 'web';
  lastSeenAt: string;
  createdAt: string;
  revokedAt?: string;
}

export interface DeviceLinkInfo {
  id: string;
  memberId: string;
  expiresAt: string;
  usedAt?: string;
  createdBy: string;
}

export interface AuditEntry {
  id: string;
  householdId: string;
  actorId: string;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export type TimelineItem =
  | { type: 'ledger'; at: string; entry: LedgerEntry }
  | { type: 'completion'; at: string; completion: Completion }
  | { type: 'purchase'; at: string; purchase: Purchase };

/** What GET /me returns. */
export interface Session {
  household: Household;
  member: Member;
  members: Pick<Member, 'id' | 'name' | 'role' | 'color' | 'equipped'>[];
  /** Available on OAuth sessions: other households the user belongs to. */
  households?: { id: string; name: string }[];
}

export const DEFAULT_SETTINGS: HouseholdSettings = {
  coinTypes: [1, 5, 10, 25, 50, 100],
  purchaseApprovalThreshold: 100,
  debtLimit: 50,
  visibility: 'full',
  timeZone: 'America/Los_Angeles',
  leaderboardEnabled: false,
  undoWindowMinutes: 5,
  locale: 'en',
};

/** Open-signup quotas. */
export const QUOTAS = {
  householdsPerUser: 3,
  membersPerHousehold: 20,
  openTasksPerHousehold: 5000,
  activeDeviceLinks: 10,
  photoBytesPerHousehold: 1024 * 1024 * 1024,
  maxPhotoBytes: 5 * 1024 * 1024,
  shopItemsPerHousehold: 200,
  goalsPerHousehold: 200,
} as const;
