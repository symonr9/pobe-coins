/**
 * Request schemas shared by the API (validation) and the app (forms).
 */
import { z } from 'zod';
import { CHUBBY_ACCESSORIES } from './art';
import { THEME_NAMES } from './theme';

const coins = z.number().int().min(0).max(1_000_000);
const title = z.string().trim().min(1, 'Give it a name.').max(120);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm.');
const id = z.string().min(1).max(64);
const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url('Enter a full link starting with https://')
  .refine((u) => /^https?:\/\//i.test(u), 'Only http and https links work.');

export const idSchema = id;

export const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly']),
  interval: z.number().int().min(1).max(52).optional(),
  byWeekday: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  byMonthDay: z.number().int().min(1).max(31).optional(),
  anchor: localDate,
  dueTime: time.optional(),
});

export const streakRuleSchema = z.object({
  every: z.number().int().min(2).max(365),
  bonus: coins.max(10_000),
});

export const coinTypesSchema = z
  .array(z.number().int().min(1).max(100_000))
  .min(1)
  .max(12)
  .refine((a) => a.includes(1), 'Coin types must include 1.')
  .refine((a) => new Set(a).size === a.length, 'Each coin type can only be listed once.');

export const householdSettingsSchema = z.object({
  coinTypes: coinTypesSchema,
  purchaseApprovalThreshold: coins.nullable(),
  debtLimit: coins.max(100_000),
  visibility: z.enum(['full', 'balances']),
  timeZone: z.string().min(1).max(64),
  leaderboardEnabled: z.boolean(),
  undoWindowMinutes: z.number().int().min(0).max(60),
  locale: z.string().min(2).max(10),
});

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(1).max(60),
  memberName: z.string().trim().min(1).max(40),
  timeZone: z.string().min(1).max(64),
  templateIds: z.array(z.string()).max(50).optional(),
});

export const updateHouseholdSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  settings: householdSettingsSchema.partial().optional(),
});

export const memberSchema = z.object({
  name: z.string().trim().min(1).max(40),
  role: z.enum(['admin', 'member']).default('member'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const updateMemberSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  role: z.enum(['admin', 'member']).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  theme: z.enum(THEME_NAMES as [string, ...string[]]).optional(),
});

export const createDeviceLinkSchema = z.object({
  memberId: id,
  expiresInHours: z.number().int().min(1).max(168).default(24),
});

export const redeemDeviceLinkSchema = z.object({
  token: z.string().min(20).max(200),
  deviceLabel: z.string().trim().min(1).max(60).default('My device'),
  platform: z.enum(['ios', 'android', 'web']).default('web'),
});

const checklistItemInput = z.object({ id: id.optional(), label: z.string().trim().min(1).max(120) });

export const taskSchema = z.object({
  title,
  notes: optionalText(1000),
  emoji: z.string().max(16).optional(),
  reward: coins.max(100_000),
  assigneeId: id.nullable().default(null),
  requiresApproval: z.boolean().default(false),
  recurrence: recurrenceSchema.optional(),
  rotation: z.array(id).max(20).optional(),
  streakRule: streakRuleSchema.optional(),
  checklist: z.array(checklistItemInput).max(30).optional(),
  partialCredit: z.boolean().optional(),
  dueAt: z.string().datetime().optional(),
  templateId: z.string().max(64).optional(),
});

export const updateTaskSchema = taskSchema.partial().extend({ status: z.enum(['open', 'archived']).optional() });

export const completeTaskSchema = z.object({
  note: optionalText(500),
  photoKey: z.string().max(300).optional(),
  checklistItemId: id.optional(),
});

export const decisionSchema = z.object({
  approve: z.boolean(),
  note: optionalText(300),
});

export const purchaseSchema = z.object({
  title,
  description: optionalText(2000),
  amount: coins.min(1).max(1_000_000),
  url: httpUrl.optional(),
  photoKeys: z.array(z.string().max(300)).max(6).default([]),
  goalId: id.optional(),
  /** Confirms the member agreed to borrow (IOU) when the purse is short. */
  allowIou: z.boolean().default(false),
});

export const shopItemSchema = z.object({
  title,
  description: optionalText(500),
  emoji: z.string().max(16).optional(),
  price: coins.min(1).max(1_000_000),
  stock: z.number().int().min(0).max(100_000).nullable().default(null),
  cooldownHours: z
    .number()
    .int()
    .min(0)
    .max(24 * 365)
    .optional(),
  requiresApproval: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const buyShopItemSchema = z.object({ allowIou: z.boolean().default(false) });

export const buyCosmeticSchema = z.object({ cosmeticId: z.string().min(1).max(64) });
export const equipSchema = z.object({
  accessory: z.enum(CHUBBY_ACCESSORIES).optional(),
  icon: z.string().max(64).optional(),
  background: z.string().max(64).optional(),
});

export const goalSchema = z.object({
  title,
  target: coins.min(1).max(1_000_000),
  shared: z.boolean().default(false),
  url: httpUrl.optional(),
  photoKey: z.string().max(300).optional(),
});

export const contributeSchema = z.object({ amount: coins.min(1) });

export const giftSchema = z.object({
  toMemberId: id,
  amount: coins.min(1).max(1_000_000),
  message: optionalText(200),
});

export const bonusSchema = z.object({
  memberId: id,
  amount: coins.min(1).max(100_000),
  reason: z.string().trim().min(1, 'Say why.').max(200),
});

export const correctionSchema = z.object({
  memberId: id,
  /** Signed: positive adds coins, negative removes. */
  delta: z
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((n) => n !== 0, 'Enter a non-zero amount.'),
  reason: z.string().trim().min(3, 'Explain the correction.').max(300),
});

export const challengeSchema = z.object({
  title,
  target: coins.min(1).max(1_000_000),
  bonus: coins.max(100_000),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export const reactionSchema = z.object({ emoji: z.string().min(1).max(16) });
export const commentSchema = z.object({ text: z.string().trim().min(1).max(500) });

export const uploadSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  bytes: z
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024),
  purpose: z.enum(['purchase', 'completion', 'goal', 'avatar']),
});

export const linkPreviewSchema = z.object({ url: httpUrl });

export const pushRegisterSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('expo'), token: z.string().min(10).max(300) }),
  z.object({
    kind: z.literal('webpush'),
    subscription: z.object({
      endpoint: httpUrl,
      keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
    }),
  }),
]);

export const linkAccountSchema = z.object({ idToken: z.string().min(20).max(8192) });
export const rotateSchema = z.object({ by: z.number().int().min(-20).max(20).default(1) });
export const pushUnregisterSchema = z.object({ token: z.string().min(10).max(2048) });

export type RecurrenceInput = z.infer<typeof recurrenceSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type ShopItemInput = z.infer<typeof shopItemSchema>;
export type PushRegisterInput = z.infer<typeof pushRegisterSchema>;
