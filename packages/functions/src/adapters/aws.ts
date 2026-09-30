import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CognitoJwtVerifier, JwtRsaVerifier } from 'aws-jwt-verify';
import { lookup } from 'node:dns/promises';
import type { Deps, IdentityVerifier, Storage } from '../context';
import { DynamoDb } from '../db/dynamo';
import { loadConfig } from '../lib/config';
import { PushNotifier } from './push';

export class S3Storage implements Storage {
  constructor(
    private readonly bucket: string,
    private readonly s3 = new S3Client({}),
  ) {}

  async presignUpload(key: string, contentType: string, maxBytes: number) {
    return createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: 600,
    });
  }

  async presignGet(key: string, expiresInSeconds = 3600) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
  }

  async putObject(key: string, body: Uint8Array, contentType: string) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async getObject(key: string) {
    try {
      const r = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return r.Body ? new Uint8Array(await r.Body.transformToByteArray()) : undefined;
    } catch {
      return undefined;
    }
  }

  async deletePrefix(prefix: string) {
    let token: string | undefined;
    do {
      const list = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      const objects = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (objects.length) await this.s3.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects } }));
      token = list.NextContinuationToken;
    } while (token);
  }
}

/**
 * Verifies sign-in tokens and gives each person one stable id regardless of how they signed in:
 * - Cognito ID tokens (Hosted UI: Google, or Apple on the web) → `google:<id>` / `apple:<id>`
 * - Apple identity tokens from the native iOS "Sign in with Apple" sheet → `apple:<id>`
 */
export class FederatedIdentity implements IdentityVerifier {
  private readonly cognito;
  private readonly apple;
  constructor(cognito: { userPoolId: string; clientId: string } | null, appleAudiences: string[]) {
    this.cognito = cognito ? CognitoJwtVerifier.create({ userPoolId: cognito.userPoolId, clientId: cognito.clientId, tokenUse: 'id' }) : null;
    this.apple = appleAudiences.length
      ? JwtRsaVerifier.create({ issuer: 'https://appleid.apple.com', audience: appleAudiences, jwksUri: 'https://appleid.apple.com/auth/keys' })
      : null;
  }
  async verify(token: string) {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as { iss?: string };
    if (payload.iss === 'https://appleid.apple.com') {
      if (!this.apple) throw new Error('Apple sign-in is not configured.');
      const claims = await this.apple.verify(token);
      return { sub: `apple:${claims.sub}`, email: claims.email as string | undefined };
    }
    if (!this.cognito) throw new Error('Sign-in is not configured.');
    const claims = await this.cognito.verify(token);
    return {
      sub: normalizeCognitoSub(claims.sub, claims.identities as unknown),
      email: claims.email as string | undefined,
      name: (claims.name ?? claims.given_name) as string | undefined,
    };
  }
}

/** Uses the upstream provider's user id when the Cognito user is federated. */
export function normalizeCognitoSub(sub: string, identities: unknown): string {
  const list = Array.isArray(identities) ? identities : typeof identities === 'string' ? safeJson(identities) : [];
  const first = (list as { providerName?: string; providerType?: string; userId?: string }[])[0];
  if (!first?.userId) return sub;
  const provider = (first.providerType ?? first.providerName ?? '').toLowerCase();
  if (provider.includes('apple')) return `apple:${first.userId}`;
  if (provider.includes('google')) return `google:${first.userId}`;
  return `${provider || 'idp'}:${first.userId}`;
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

let cached: Deps | undefined;

/** Production dependencies, created once per Lambda instance. */
export function awsDeps(): Deps {
  if (cached) return cached;
  const config = loadConfig();
  const db = new DynamoDb(config.tableName);
  const lambda = new LambdaClient({});
  cached = {
    db,
    config,
    now: () => new Date(),
    notifier: new PushNotifier(db, config),
    storage: new S3Storage(config.bucketName),
    identity: new FederatedIdentity(config.cognito, config.appleAudiences),
    fetch,
    resolveHost: async (host) => (await lookup(host, { all: true })).map((a) => a.address),
    startExport: async (householdId, jobId) => {
      if (!config.exportFunctionName) throw new Error('Export function is not configured.');
      await lambda.send(
        new InvokeCommand({
          FunctionName: config.exportFunctionName,
          InvocationType: 'Event',
          Payload: new TextEncoder().encode(JSON.stringify({ householdId, jobId })),
        }),
      );
    },
  };
  return cached;
}
