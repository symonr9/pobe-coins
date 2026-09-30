import type { Role } from '@pobe/core';
import type { Db } from './db/types';
import type { Config } from './lib/config';

export interface PushMessage {
  title: string;
  body: string;
  /** App route to open, e.g. "/approvals". */
  url?: string;
  /** Notification category with action buttons (e.g. "approval"). */
  category?: 'approval';
  data?: Record<string, string>;
}

export interface Notifier {
  send(householdId: string, memberIds: string[], message: PushMessage): Promise<void>;
}

export interface Storage {
  presignUpload(key: string, contentType: string, maxBytes: number): Promise<{ url: string; fields: Record<string, string> }>;
  presignGet(key: string, expiresInSeconds?: number): Promise<string>;
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  getObject(key: string): Promise<Uint8Array | undefined>;
  deletePrefix(prefix: string): Promise<void>;
}

export interface IdentityClaims {
  sub: string;
  email?: string;
  name?: string;
}

export interface IdentityVerifier {
  /** Verifies a Cognito ID token. Throws if invalid. */
  verify(token: string): Promise<IdentityClaims>;
}

export interface Deps {
  db: Db;
  config: Config;
  now: () => Date;
  notifier: Notifier;
  storage: Storage;
  identity: IdentityVerifier;
  fetch: typeof fetch;
  /** DNS lookup used by the link-preview SSRF guard. */
  resolveHost: (host: string) => Promise<string[]>;
  startExport: (householdId: string, jobId: string) => Promise<void>;
}

/** Who is calling. */
export type Principal =
  | { kind: 'device'; householdId: string; memberId: string; deviceId: string }
  | { kind: 'user'; sub: string; email?: string; name?: string };

/** A caller acting inside a household. */
export interface Actor {
  householdId: string;
  memberId: string;
  role: Role;
  principal: Principal;
}
