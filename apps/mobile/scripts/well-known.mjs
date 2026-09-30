// Writes universal-link / app-link files into the web build so join links open the app.
//   APPLE_TEAM_ID, IOS_BUNDLE_ID (default app.pobecoins)
//   ANDROID_PACKAGE (default app.pobecoins), ANDROID_SHA256 (release signing cert fingerprint)
import { mkdirSync, writeFileSync } from 'node:fs';

const dir = 'dist/.well-known';
mkdirSync(dir, { recursive: true });
const bundle = process.env.IOS_BUNDLE_ID ?? 'app.pobecoins';
if (process.env.APPLE_TEAM_ID) {
  writeFileSync(
    `${dir}/apple-app-site-association`,
    JSON.stringify(
      { applinks: { details: [{ appIDs: [`${process.env.APPLE_TEAM_ID}.${bundle}`], components: [{ '/': '/join/*' }] }] } },
      null,
      2,
    ),
  );
  console.log('wrote apple-app-site-association');
}
if (process.env.ANDROID_SHA256) {
  writeFileSync(
    `${dir}/assetlinks.json`,
    JSON.stringify(
      [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: process.env.ANDROID_PACKAGE ?? 'app.pobecoins',
            sha256_cert_fingerprints: [process.env.ANDROID_SHA256],
          },
        },
      ],
      null,
      2,
    ),
  );
  console.log('wrote assetlinks.json');
}
