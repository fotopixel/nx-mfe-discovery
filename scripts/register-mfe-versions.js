const { execSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join } = require('node:path');

const API = process.env.DISCOVERY_ADMIN_API;
const TOKEN = process.env.DISCOVERY_TOKEN;
const PROJECT_ID = process.env.DISCOVERY_PROJECT_ID;
const CDN_BASE = process.env.CDN_BASE;
const COMMIT_SHA = process.env.COMMIT_SHA;
const DEPLOYMENT_STRATEGY = process.env.DEPLOYMENT_STRATEGY;
const AFFECTED_APPS = process.env.AFFECTED_APPS;

if (!API || !TOKEN || !PROJECT_ID || !CDN_BASE || !COMMIT_SHA) {
  console.error(
    'Missing required env vars: DISCOVERY_ADMIN_API, DISCOVERY_TOKEN, DISCOVERY_PROJECT_ID, CDN_BASE, COMMIT_SHA'
  );
  process.exit(1);
}

const REMOTE_APPS = new Set(['shop', 'cart', 'about']);

const appsToRegister = AFFECTED_APPS
  ? AFFECTED_APPS.split(',').map((a) => a.trim()).filter((a) => REMOTE_APPS.has(a))
  : [...REMOTE_APPS];

if (appsToRegister.length === 0) {
  console.log('No affected MFE apps to register');
  process.exit(0);
}

const mfeListRaw = execSync(
  `curl -sf "${API}/projects/${PROJECT_ID}/microFrontends" -H "Authorization: Bearer ${TOKEN}"`,
  { encoding: 'utf-8' }
);
const mfeList = JSON.parse(mfeListRaw);
const mfesByShortName = {};
for (const mfe of mfeList.microFrontends || []) {
  const shortName = mfe.name.includes('/') ? mfe.name.split('/').pop() : mfe.name;
  mfesByShortName[shortName] = { id: mfe.id, hasVersions: (mfe.activeVersions || []).length > 0 };
}

for (const appName of appsToRegister) {
  const mfe = mfesByShortName[appName];
  if (!mfe) {
    console.error(`MFE "${appName}" not found in project ${PROJECT_ID}. Available: ${Object.keys(mfesByShortName).join(', ')}`);
    process.exit(1);
  }

  const url = `${CDN_BASE}/${appName}/${COMMIT_SHA}/remoteEntry.js`;

  let integrity = '';
  const localFile = join(__dirname, '..', 'apps', appName, 'dist', 'remoteEntry.js');
  if (existsSync(localFile)) {
    const hash = createHash('sha384').update(readFileSync(localFile)).digest('base64');
    integrity = `sha384-${hash}`;
  }

  const payload = {
    version: {
      url,
      metadata: {
        version: COMMIT_SHA,
        integrity,
      },
    },
  };

  if (DEPLOYMENT_STRATEGY && mfe.hasVersions) {
    payload.deploymentStrategy = DEPLOYMENT_STRATEGY;
  }

  const body = JSON.stringify(payload);

  console.log(`Registering ${appName} (${mfe.id}) -> ${url}`);
  if (integrity) {
    console.log(`  Integrity: ${integrity}`);
  }
  if (payload.deploymentStrategy) {
    console.log(`  Strategy: ${DEPLOYMENT_STRATEGY}`);
  } else if (DEPLOYMENT_STRATEGY && !mfe.hasVersions) {
    console.log(`  First version — skipping deployment strategy`);
  }

  execSync(
    `curl -sf -X POST "${API}/projects/${PROJECT_ID}/microFrontends/${mfe.id}/versions" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" \
     -d '${body}'`,
    { stdio: 'inherit' }
  );
}

console.log(`Registered ${appsToRegister.length} MFE(s): ${appsToRegister.join(', ')}`);
