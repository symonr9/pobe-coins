/// <reference path="./.sst/platform/config.d.ts" />

/**
 * Pobe Coins infrastructure. Everything here runs on free-tier-friendly, pay-per-use AWS
 * services: no VPC/NAT, no always-on servers, no Secrets Manager.
 *
 *   npx sst secret set <Name> <value> --stage <stage>     (see README for the list)
 *   npx sst deploy --stage dev | prod
 *
 * Deploy-time settings (environment variables):
 *   WEB_ORIGIN      where the web app is hosted, e.g. https://pobecoins.netlify.app
 *   AUTH_PREFIX     Cognito hosted-UI prefix (must be globally unique), default pobe-coins-<stage>
 *   ENABLE_GOOGLE   "false" to skip Google sign-in (default on)
 *   ENABLE_APPLE    "true" once the Apple Services ID / key secrets are set
 *   APPLE_AUDIENCES iOS bundle id(s) for native Sign in with Apple, default app.pobecoins
 *   BUDGET_EMAIL    email for the AWS Budgets alarm (optional)
 */
export default $config({
  app(input) {
    return {
      name: 'pobe-coins',
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
      protect: input?.stage === 'prod',
      home: 'aws',
      providers: { aws: { region: process.env.AWS_REGION ?? 'us-west-2' } },
    };
  },
  async run() {
    const isProd = $app.stage === 'prod';
    // A deployed stage must know where the web app lives: it feeds CORS and the Cognito sign-in
    // callbacks. Falling back to localhost would deploy fine but break sign-in, so fail loudly.
    // (`sst dev` or ALLOW_LOCAL_ORIGIN=1 keeps the localhost default for local experiments.)
    const webOrigin = process.env.WEB_ORIGIN?.replace(/\/$/, '') ?? 'http://localhost:8081';
    if (!$dev && process.env.ALLOW_LOCAL_ORIGIN !== '1' && !webOrigin.startsWith('https://')) {
      throw new Error(
        `WEB_ORIGIN must be the https URL of the web app (e.g. https://pobe-coins.netlify.app), got "${webOrigin}". ` +
          'See docs/deploy/going-live.md.',
      );
    }
    const appScheme = 'pobecoins';

    // ---------- secrets (stored encrypted in SSM by SST, never in the repo) ----------
    const deviceTokenSecret = new sst.Secret('DeviceTokenSecret');
    const vapidPublicKey = new sst.Secret('VapidPublicKey', 'unset');
    const vapidPrivateKey = new sst.Secret('VapidPrivateKey', 'unset');
    const expoAccessToken = new sst.Secret('ExpoAccessToken', 'unset');

    // ---------- data ----------
    const table = new sst.aws.Dynamo('Table', {
      fields: { pk: 'string', sk: 'string', gsi1pk: 'string', gsi1sk: 'string' },
      primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
      globalIndexes: { gsi1: { hashKey: 'gsi1pk', rangeKey: 'gsi1sk' } },
      ttl: 'ttl',
      deletionProtection: isProd,
      transform: {
        table: (args) => {
          args.billingMode = 'PAY_PER_REQUEST';
          if (isProd) args.pointInTimeRecovery = { enabled: true };
        },
      },
    });

    const bucket = new sst.aws.Bucket('Photos', {
      cors: {
        allowOrigins: [webOrigin, 'http://localhost:8081'],
        allowMethods: ['GET', 'POST', 'PUT'],
        allowHeaders: ['*'],
      },
      lifecycle: [{ id: 'expire-exports', prefix: 'exports/', expiresIn: '2 days' }],
    });

    // ---------- sign-in: Cognito with Google / Apple ----------
    const userPool = new sst.aws.CognitoUserPool('Users', {
      usernames: ['email'],
      domain: { prefix: process.env.AUTH_PREFIX ?? `pobe-coins-${$app.stage}` },
    });
    const providers: $util.Input<string>[] = [];
    if (process.env.ENABLE_GOOGLE !== 'false') {
      const googleId = new sst.Secret('GoogleClientId');
      const googleSecret = new sst.Secret('GoogleClientSecret');
      const google = userPool.addIdentityProvider('Google', {
        type: 'google',
        details: { authorize_scopes: 'email profile openid', client_id: googleId.value, client_secret: googleSecret.value },
        attributes: { email: 'email', name: 'name', username: 'sub' },
      });
      providers.push(google.providerName);
    }
    if (process.env.ENABLE_APPLE === 'true') {
      const appleServicesId = new sst.Secret('AppleServicesId');
      const appleTeamId = new sst.Secret('AppleTeamId');
      const appleKeyId = new sst.Secret('AppleKeyId');
      const applePrivateKey = new sst.Secret('ApplePrivateKey');
      const apple = userPool.addIdentityProvider('Apple', {
        type: 'apple',
        details: {
          authorize_scopes: 'email name',
          client_id: appleServicesId.value,
          team_id: appleTeamId.value,
          key_id: appleKeyId.value,
          private_key: applePrivateKey.value,
        },
        attributes: { email: 'email', name: 'name', username: 'sub' },
      });
      providers.push(apple.providerName);
    }
    const userPoolClient = userPool.addClient('WebClient', {
      providers,
      callbackUrls: [`${webOrigin}/auth/callback`, `${appScheme}://auth/callback`, 'http://localhost:8081/auth/callback'],
      transform: {
        client: (args) => {
          args.allowedOauthFlows = ['code'];
          args.allowedOauthScopes = ['openid', 'email', 'profile'];
          args.logoutUrls = [`${webOrigin}/`, `${appScheme}://`, 'http://localhost:8081/'];
          args.generateSecret = false;
          args.preventUserExistenceErrors = 'ENABLED';
          args.idTokenValidity = 60;
          args.accessTokenValidity = 60;
          args.refreshTokenValidity = 180;
          args.tokenValidityUnits = { idToken: 'minutes', accessToken: 'minutes', refreshToken: 'days' };
        },
      },
    });

    // ---------- functions ----------
    const logging = { retention: '2 weeks' as const };
    const environment = {
      STAGE: $app.stage,
      TABLE_NAME: table.name,
      BUCKET_NAME: bucket.name,
      WEB_ORIGIN: webOrigin,
      COGNITO_USER_POOL_ID: userPool.id,
      COGNITO_CLIENT_ID: userPoolClient.id,
      APPLE_AUDIENCES: process.env.APPLE_AUDIENCES ?? 'app.pobecoins',
      DEVICE_TOKEN_SECRET: deviceTokenSecret.value,
      VAPID_PUBLIC_KEY: vapidPublicKey.value.apply((v) => (v === 'unset' ? '' : v)),
      VAPID_PRIVATE_KEY: vapidPrivateKey.value.apply((v) => (v === 'unset' ? '' : v)),
      VAPID_SUBJECT: `mailto:${process.env.BUDGET_EMAIL ?? 'admin@pobecoins.app'}`,
      EXPO_ACCESS_TOKEN: expoAccessToken.value.apply((v) => (v === 'unset' ? '' : v)),
    };

    const exporter = new sst.aws.Function('Exporter', {
      handler: 'packages/functions/src/handlers/exporter.handler',
      timeout: '5 minutes',
      memory: '1024 MB',
      architecture: 'arm64',
      link: [table, bucket],
      environment,
      logging,
    });

    const api = new sst.aws.ApiGatewayV2('Api', {
      cors: false, // handled in the app so errors carry CORS headers too
      transform: {
        stage: (args) => {
          // Baseline abuse/cost protection. Per-IP limits for public routes live in the app.
          args.defaultRouteSettings = { throttlingBurstLimit: 100, throttlingRateLimit: 50 };
        },
      },
    });
    api.route('$default', {
      handler: 'packages/functions/src/handlers/api.handler',
      timeout: '20 seconds',
      memory: '512 MB',
      architecture: 'arm64',
      link: [table, bucket, exporter],
      environment: { ...environment, EXPORT_FUNCTION_NAME: exporter.name },
      logging,
    });

    new sst.aws.CronV2('Hourly', {
      schedule: 'rate(1 hour)',
      function: {
        handler: 'packages/functions/src/handlers/cron.handler',
        timeout: '5 minutes',
        memory: '512 MB',
        architecture: 'arm64',
        link: [table],
        environment,
        logging,
      },
    });

    // ---------- cost guardrail ----------
    if (process.env.BUDGET_EMAIL) {
      new aws.budgets.Budget('MonthlyBudget', {
        budgetType: 'COST',
        limitAmount: '20',
        limitUnit: 'USD',
        timeUnit: 'MONTHLY',
        notifications: [5, 20].map((usd) => ({
          comparisonOperator: 'GREATER_THAN',
          notificationType: 'ACTUAL',
          threshold: (usd / 20) * 100,
          thresholdType: 'PERCENTAGE',
          subscriberEmailAddresses: [process.env.BUDGET_EMAIL!],
        })),
      });
    }

    return {
      api: api.url,
      authDomain: userPool.domainUrl,
      userPoolId: userPool.id,
      userPoolClientId: userPoolClient.id,
      bucket: bucket.name,
      table: table.name,
    };
  },
});
