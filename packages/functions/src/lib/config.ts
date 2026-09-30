/**
 * Runtime configuration. In AWS, SST passes these as environment variables (see sst.config.ts).
 */
export interface Config {
  stage: string;
  tableName: string;
  bucketName: string;
  webOrigin: string;
  cognito: { userPoolId: string; clientId: string } | null;
  /** Bundle id / Services id accepted for native Sign in with Apple tokens. */
  appleAudiences: string[];
  deviceTokenSecret: string;
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  expoAccessToken?: string;
  exportFunctionName?: string;
}

const env = (name: string) => process.env[name] ?? '';

export function loadConfig(): Config {
  const secret = env('DEVICE_TOKEN_SECRET');
  if (!secret && env('STAGE') !== 'test') throw new Error('DEVICE_TOKEN_SECRET is not set.');
  return {
    stage: env('STAGE') || 'dev',
    tableName: env('TABLE_NAME'),
    bucketName: env('BUCKET_NAME'),
    webOrigin: env('WEB_ORIGIN') || 'http://localhost:8081',
    cognito:
      env('COGNITO_USER_POOL_ID') && env('COGNITO_CLIENT_ID')
        ? { userPoolId: env('COGNITO_USER_POOL_ID'), clientId: env('COGNITO_CLIENT_ID') }
        : null,
    appleAudiences: env('APPLE_AUDIENCES').split(',').map((s) => s.trim()).filter(Boolean),
    deviceTokenSecret: secret,
    vapid:
      env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY')
        ? { publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY'), subject: env('VAPID_SUBJECT') || 'mailto:admin@example.com' }
        : null,
    expoAccessToken: env('EXPO_ACCESS_TOKEN') || undefined,
    exportFunctionName: env('EXPORT_FUNCTION_NAME') || undefined,
  };
}
