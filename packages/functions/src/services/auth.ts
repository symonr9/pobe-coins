import { SignJWT, jwtVerify } from 'jose';
import type { Device, DeviceLinkInfo, Member, Role, Session } from '@pobe/core';
import { QUOTAS } from '@pobe/core';
import type { Actor, Deps, Principal } from '../context';
import { keys, partition, PREFIX } from '../db/keys';
import { ConditionFailed, strip, type Item } from '../db/types';
import { ApiError, forbidden, notFound } from '../lib/errors';
import { secretToken, sha256, ulid } from '../lib/ids';
import { auditOp, getHousehold, getMember, listMembers, toItem } from '../repo';

const DEVICE_TOKEN_DAYS = 180;
const REFRESH_AFTER_DAYS = 7;

/** Signing key for device and session tokens. Never fall back to a built-in key: it would be public. */
function secretKey(deps: Deps) {
  const secret = deps.config.deviceTokenSecret;
  if (!secret || secret.length < 32) throw new Error('DEVICE_TOKEN_SECRET is missing or too short (need 32+ characters).');
  return new TextEncoder().encode(secret);
}

export async function issueDeviceToken(deps: Deps, device: Pick<Device, 'id' | 'householdId' | 'memberId'>) {
  const now = Math.floor(deps.now().getTime() / 1000);
  return new SignJWT({ hid: device.householdId, mid: device.memberId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(device.id)
    .setIssuedAt(now)
    .setExpirationTime(now + DEVICE_TOKEN_DAYS * 86400)
    .setIssuer('pobe-coins')
    .setAudience('pobe-device')
    .sign(secretKey(deps));
}

const USER_TOKEN_DAYS = 60;

/** App session for a signed-in person (after Google/Apple sign-in was verified once). */
export async function issueUserToken(deps: Deps, claims: { sub: string; name?: string; email?: string }) {
  const now = Math.floor(deps.now().getTime() / 1000);
  return new SignJWT({ name: claims.name, email: claims.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + USER_TOKEN_DAYS * 86400)
    .setIssuer('pobe-coins')
    .setAudience('pobe-user')
    .sign(secretKey(deps));
}

/** Exchanges a provider ID token (Cognito, native Apple, dev) for an app session token. */
export async function exchangeIdentity(deps: Deps, idToken: string) {
  const claims = await deps.identity.verify(idToken).catch(() => {
    throw new ApiError('UNAUTHORIZED', "That sign-in didn't work. Please try again.");
  });
  return { token: await issueUserToken(deps, claims), user: claims };
}

// Revocation checks are cached briefly per Lambda instance.
const deviceCache = new Map<string, { ok: boolean; at: number }>();

/** Resolves a bearer token to a principal. Device tokens are checked for revocation. */
export async function authenticate(deps: Deps, bearer: string): Promise<{ principal: Principal; refreshToken?: string }> {
  const [, payloadPart] = bearer.split('.');
  let aud: unknown;
  try {
    aud = JSON.parse(Buffer.from(payloadPart ?? '', 'base64url').toString()).aud;
  } catch {
    throw new ApiError('UNAUTHORIZED', 'Your sign-in token is not valid. Please sign in again.');
  }
  if (aud === 'pobe-device') {
    let payload;
    try {
      ({ payload } = await jwtVerify(bearer, secretKey(deps), {
        issuer: 'pobe-coins',
        audience: 'pobe-device',
        currentDate: deps.now(),
      }));
    } catch {
      throw new ApiError(
        'UNAUTHORIZED',
        "This device's sign-in expired. Ask an admin for a new join link, or sign in with Google or Apple.",
      );
    }
    const hid = String(payload.hid);
    const mid = String(payload.mid);
    const did = String(payload.sub);
    const cacheKey = `${hid}/${did}`;
    const cached = deviceCache.get(cacheKey);
    if (!cached || deps.now().getTime() - cached.at > 60_000) {
      const d = await deps.db.get<Item & Device>(keys.device(hid, did));
      deviceCache.set(cacheKey, { ok: !!d && !d.revokedAt, at: deps.now().getTime() });
    }
    if (!deviceCache.get(cacheKey)!.ok) {
      throw new ApiError('UNAUTHORIZED', 'This device was signed out by an admin. Ask for a new join link to sign back in.');
    }
    const ageDays = (deps.now().getTime() / 1000 - Number(payload.iat)) / 86400;
    const refreshToken =
      ageDays > REFRESH_AFTER_DAYS ? await issueDeviceToken(deps, { id: did, householdId: hid, memberId: mid }) : undefined;
    return { principal: { kind: 'device', householdId: hid, memberId: mid, deviceId: did }, refreshToken };
  }
  if (aud === 'pobe-user') {
    let payload;
    try {
      ({ payload } = await jwtVerify(bearer, secretKey(deps), { issuer: 'pobe-coins', audience: 'pobe-user', currentDate: deps.now() }));
    } catch {
      throw new ApiError('UNAUTHORIZED', 'Your sign-in expired. Please sign in again.');
    }
    const claims = { sub: String(payload.sub), name: payload.name as string | undefined, email: payload.email as string | undefined };
    const ageDays = (deps.now().getTime() / 1000 - Number(payload.iat)) / 86400;
    const refreshToken = ageDays > REFRESH_AFTER_DAYS ? await issueUserToken(deps, claims) : undefined;
    return { principal: { kind: 'user', ...claims }, refreshToken };
  }
  try {
    const claims = await deps.identity.verify(bearer);
    return { principal: { kind: 'user', ...claims } };
  } catch {
    throw new ApiError('UNAUTHORIZED', 'Your sign-in expired. Please sign in again.');
  }
}

export function clearDeviceCache() {
  deviceCache.clear();
}

/** Picks the household a principal is acting in. Users choose with the X-Household-Id header. */
export async function resolveActor(deps: Deps, principal: Principal, requestedHousehold?: string): Promise<Actor | null> {
  if (principal.kind === 'device') {
    const m = await getMember(deps, principal.householdId, principal.memberId).catch(() => null);
    if (!m) throw new ApiError('UNAUTHORIZED', 'This profile no longer exists in the household.');
    return { householdId: principal.householdId, memberId: m.id, role: m.role, principal };
  }
  const links = await deps.db.query<Item & { householdId: string; memberId: string }>(`U#${principal.sub}`, { beginsWith: 'H#' });
  const link = requestedHousehold ? links.find((l) => l.householdId === requestedHousehold) : links[0];
  if (!link) {
    if (requestedHousehold) throw forbidden('You are not a member of that household.');
    return null;
  }
  const m = await getMember(deps, link.householdId, link.memberId).catch(() => null);
  if (!m) return null;
  return { householdId: link.householdId, memberId: m.id, role: m.role, principal };
}

export async function userHouseholds(deps: Deps, sub: string) {
  const links = await deps.db.query<Item & { householdId: string; householdName: string }>(`U#${sub}`, { beginsWith: 'H#' });
  return links.map((l) => ({ id: l.householdId, name: l.householdName }));
}

export async function sessionFor(deps: Deps, actor: Actor): Promise<Session> {
  const [household, members] = await Promise.all([getHousehold(deps, actor.householdId), listMembers(deps, actor.householdId)]);
  const member = members.find((m) => m.id === actor.memberId)!;
  const session: Session = {
    household,
    member,
    members: members.map((m) => ({ id: m.id, name: m.name, role: m.role, color: m.color, equipped: m.equipped })),
  };
  if (actor.principal.kind === 'user') session.households = await userHouseholds(deps, actor.principal.sub);
  return session;
}

export function requireAdmin(actor: Actor) {
  if (actor.role !== 'admin') throw forbidden();
}

// ---------- one-time device links ----------

export async function createDeviceLink(deps: Deps, actor: Actor, memberId: string, expiresInHours: number) {
  requireAdmin(actor);
  const member = await getMember(deps, actor.householdId, memberId);
  const now = deps.now();
  const active = (await deps.db.query<Item & DeviceLinkInfo>(partition(actor.householdId), { beginsWith: PREFIX.deviceLinkRef })).filter(
    (l) => !l.usedAt && new Date(l.expiresAt) > now,
  );
  if (active.length >= QUOTAS.activeDeviceLinks) {
    throw new ApiError('QUOTA', `You already have ${active.length} unused join links. Delete one or wait for them to expire.`);
  }
  const token = secretToken(32);
  const hash = sha256(token);
  const id = ulid(now.getTime());
  const expiresAt = new Date(now.getTime() + expiresInHours * 3600_000);
  const ttl = Math.floor(expiresAt.getTime() / 1000) + 86400;
  const info: DeviceLinkInfo = { id, memberId: member.id, expiresAt: expiresAt.toISOString(), createdBy: actor.memberId };
  await deps.db.transact([
    { put: { ...keys.deviceLink(hash), ttl, householdId: actor.householdId, ...info }, if: { notExists: true } },
    { put: { ...keys.deviceLinkRef(actor.householdId, id), ttl, hash, ...info } },
    auditOp(deps, actor, 'deviceLink.create', member.id),
  ]);
  return { ...info, token, url: `${deps.config.webOrigin.replace(/\/$/, '')}/join/${token}` };
}

export async function listDeviceLinks(deps: Deps, actor: Actor) {
  requireAdmin(actor);
  const now = deps.now();
  const rows = await deps.db.query<Item & DeviceLinkInfo>(partition(actor.householdId), { beginsWith: PREFIX.deviceLinkRef });
  return rows
    .filter((r) => !r.usedAt && new Date(r.expiresAt) > now)
    .map((r) => {
      const { hash: _h, ...rest } = strip(r) as DeviceLinkInfo & { hash?: string };
      return rest;
    });
}

export async function deleteDeviceLink(deps: Deps, actor: Actor, id: string) {
  requireAdmin(actor);
  const ref = await deps.db.get<Item & { hash: string }>(keys.deviceLinkRef(actor.householdId, id));
  if (!ref) throw notFound('That join link');
  await deps.db.transact([{ delete: keys.deviceLink(ref.hash) }, { delete: keys.deviceLinkRef(actor.householdId, id) }]);
}

export async function redeemDeviceLink(deps: Deps, token: string, label: string, platform: Device['platform']) {
  const hash = sha256(token);
  const link = await deps.db.get<Item & DeviceLinkInfo & { householdId: string }>(keys.deviceLink(hash));
  const now = deps.now();
  if (!link) throw new ApiError('GONE', "This join link isn't valid. Ask your household admin for a new one.");
  if (link.usedAt) throw new ApiError('GONE', 'This join link was already used. Each link works once. Ask for a new one.');
  if (new Date(link.expiresAt) <= now) throw new ApiError('GONE', 'This join link expired. Ask your household admin for a new one.');
  const member = await getMember(deps, link.householdId, link.memberId);
  const device: Device = {
    id: ulid(now.getTime()),
    householdId: link.householdId,
    memberId: member.id,
    label,
    platform,
    lastSeenAt: now.toISOString(),
    createdAt: now.toISOString(),
  };
  try {
    await deps.db.transact([
      { put: { ...link, usedAt: now.toISOString() }, if: { fieldMissing: 'usedAt' } },
      { delete: keys.deviceLinkRef(link.householdId, link.id) },
      { put: { ...keys.device(device.householdId, device.id), type: 'device', ...device } },
    ]);
  } catch (err) {
    if (err instanceof ConditionFailed)
      throw new ApiError('GONE', 'This join link was already used. Each link works once. Ask for a new one.');
    throw err;
  }
  const deviceToken = await issueDeviceToken(deps, device);
  const actor: Actor = {
    householdId: device.householdId,
    memberId: member.id,
    role: member.role,
    principal: { kind: 'device', householdId: device.householdId, memberId: member.id, deviceId: device.id },
  };
  return { token: deviceToken, device, session: await sessionFor(deps, actor) };
}

export async function listDevices(deps: Deps, actor: Actor) {
  const rows = await deps.db.query<Item & Device>(partition(actor.householdId), { beginsWith: PREFIX.device });
  const devices = rows.map((r) => strip(r) as Device).filter((d) => !d.revokedAt);
  return actor.role === 'admin' ? devices : devices.filter((d) => d.memberId === actor.memberId);
}

export async function revokeDevice(deps: Deps, actor: Actor, deviceId: string) {
  const d = await deps.db.get<Item & Device>(keys.device(actor.householdId, deviceId));
  if (!d || d.revokedAt) throw notFound('That device');
  if (actor.role !== 'admin' && d.memberId !== actor.memberId) throw forbidden('You can only sign out your own devices.');
  await deps.db.transact([{ put: { ...d, revokedAt: deps.now().toISOString() } }, auditOp(deps, actor, 'device.revoke', deviceId)]);
  deviceCache.delete(`${actor.householdId}/${deviceId}`);
}

/** Links a Google/Apple identity to the member this device is signed in as. */
export async function linkAccount(deps: Deps, actor: Actor, idToken: string) {
  const claims = await deps.identity.verify(idToken).catch(() => {
    throw new ApiError('UNAUTHORIZED', "That sign-in didn't work. Please try again.");
  });
  const household = await getHousehold(deps, actor.householdId);
  const member = await getMember(deps, actor.householdId, actor.memberId);
  const existing = await deps.db.get<Item & { memberId: string }>(keys.userHousehold(claims.sub, actor.householdId));
  if (existing && existing.memberId !== member.id) {
    throw new ApiError('CONFLICT', 'That account is already linked to another profile in this household.');
  }
  if (member.userSub && member.userSub !== claims.sub) {
    throw new ApiError('CONFLICT', 'This profile is already linked to a different account.');
  }
  const updated: Member = { ...member, userSub: claims.sub, version: member.version + 1 };
  await deps.db.transact([
    { put: toItem.member(updated), if: { version: member.version } },
    {
      put: {
        ...keys.userHousehold(claims.sub, actor.householdId),
        householdId: actor.householdId,
        householdName: household.name,
        memberId: member.id,
      },
    },
  ]);
  return updated;
}

export function roleOf(member: Member): Role {
  return member.role;
}
