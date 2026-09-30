/**
 * Uploads, rate limits, reactions/comments, audit log and push registration.
 */
import { QUOTAS, type AuditEntry, type Comment, type PushRegisterInput, type Reaction } from '@pobe/core';
import type { Actor, Deps } from '../context';
import { keys, PREFIX } from '../db/keys';
import { ConditionFailed } from '../db/types';
import { ApiError } from '../lib/errors';
import { sha256, ulid } from '../lib/ids';
import { listByPrefix } from '../repo';
import { requireAdmin } from './auth';

// ---------- rate limiting ----------

/** Fixed-window counter in DynamoDB. Throws RATE_LIMITED when `limit` is exceeded in the window. */
export async function rateLimit(deps: Deps, bucket: string, limit: number, windowSeconds: number) {
  const now = Math.floor(deps.now().getTime() / 1000);
  const window = Math.floor(now / windowSeconds);
  try {
    await deps.db.increment(keys.rateLimit(bucket, window), 'count', 1, limit, { ttl: (window + 2) * windowSeconds });
  } catch (err) {
    if (err instanceof ConditionFailed) throw new ApiError('RATE_LIMITED', 'Too many tries. Please wait a minute and try again.');
    throw err;
  }
}

// ---------- uploads ----------

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

export async function createUpload(deps: Deps, actor: Actor, input: { contentType: string; bytes: number; purpose: string }) {
  try {
    await deps.db.increment(keys.usage(actor.householdId), 'photoBytes', input.bytes, QUOTAS.photoBytesPerHousehold);
  } catch (err) {
    if (err instanceof ConditionFailed) throw new ApiError('QUOTA', 'This household has used its photo storage. Delete old purchases with photos to make room.');
    throw err;
  }
  const key = `h/${actor.householdId}/${input.purpose}/${ulid(deps.now().getTime())}.${EXT[input.contentType] ?? 'jpg'}`;
  const post = await deps.storage.presignUpload(key, input.contentType, Math.min(input.bytes + 1024, QUOTAS.maxPhotoBytes));
  return { key, ...post };
}

// ---------- reactions & comments ----------

export async function react(deps: Deps, actor: Actor, itemId: string, emoji: string | null) {
  const key = keys.reaction(actor.householdId, itemId, actor.memberId);
  if (!emoji) {
    await deps.db.delete(key);
    return null;
  }
  const r: Reaction = { itemId, memberId: actor.memberId, emoji, createdAt: deps.now().toISOString() };
  await deps.db.put({ ...key, type: 'reaction', ...r });
  return r;
}

export async function listSocial(deps: Deps, actor: Actor, itemId: string) {
  const [reactions, comments] = await Promise.all([
    listByPrefix<Reaction>(deps, actor.householdId, `${PREFIX.reaction}${itemId}#`),
    listByPrefix<Comment>(deps, actor.householdId, `${PREFIX.comment}${itemId}#`),
  ]);
  return { reactions, comments };
}

export async function addComment(deps: Deps, actor: Actor, itemId: string, text: string, ownerId?: string) {
  const c: Comment = { id: ulid(deps.now().getTime()), itemId, memberId: actor.memberId, text, createdAt: deps.now().toISOString() };
  await deps.db.put({ ...keys.comment(actor.householdId, itemId, c.id), type: 'comment', ...c });
  if (ownerId && ownerId !== actor.memberId) {
    await deps.notifier.send(actor.householdId, [ownerId], { title: 'New comment', body: text.slice(0, 120), url: '/timeline' });
  }
  return c;
}

export async function deleteComment(deps: Deps, actor: Actor, itemId: string, commentId: string) {
  const all = await listByPrefix<Comment>(deps, actor.householdId, `${PREFIX.comment}${itemId}#`);
  const c = all.find((x) => x.id === commentId);
  if (!c) throw new ApiError('NOT_FOUND', 'That comment wasn\'t found.');
  if (c.memberId !== actor.memberId && actor.role !== 'admin') throw new ApiError('FORBIDDEN', 'You can only delete your own comments.');
  await deps.db.delete(keys.comment(actor.householdId, itemId, commentId));
}

// ---------- audit ----------

export async function listAudit(deps: Deps, actor: Actor, limit = 200) {
  requireAdmin(actor);
  return listByPrefix<AuditEntry>(deps, actor.householdId, PREFIX.audit, true, limit);
}

// ---------- push targets ----------

export async function registerPush(deps: Deps, actor: Actor, input: PushRegisterInput) {
  const token = input.kind === 'expo' ? input.token : input.subscription.endpoint;
  const key = keys.pushTarget(actor.householdId, actor.memberId, sha256(token));
  await deps.db.put({ ...key, type: 'push', memberId: actor.memberId, kind: input.kind, token: input.kind === 'expo' ? input.token : undefined, subscription: input.kind === 'webpush' ? input.subscription : undefined, createdAt: deps.now().toISOString() });
}

export async function unregisterPush(deps: Deps, actor: Actor, token: string) {
  await deps.db.delete(keys.pushTarget(actor.householdId, actor.memberId, sha256(token)));
}
