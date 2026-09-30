import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
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

export class CognitoIdentity implements IdentityVerifier {
  private readonly verifier;
  constructor(userPoolId: string, clientId: string) {
    this.verifier = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'id' });
  }
  async verify(token: string) {
    const claims = await this.verifier.verify(token);
    return { sub: claims.sub, email: claims.email as string | undefined, name: (claims.name ?? claims.given_name) as string | undefined };
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
    identity: config.cognito
      ? new CognitoIdentity(config.cognito.userPoolId, config.cognito.clientId)
      : {
          verify: async () => {
            throw new Error('Sign-in is not configured.');
          },
        },
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
