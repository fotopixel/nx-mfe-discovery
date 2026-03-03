const { execSync } = require('node:child_process');

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

// MFE IDs as registered in the Discovery Service.
// Update these to match your actual MFE IDs.
const MFES = {
  shop: 'YOUR_SHOP_MFE_ID',
  cart: 'YOUR_CART_MFE_ID',
  about: 'YOUR_ABOUT_MFE_ID',
};

const appsToRegister = AFFECTED_APPS
  ? AFFECTED_APPS.split(',').map((a) => a.trim()).filter((a) => a in MFES)
  : Object.keys(MFES);

if (appsToRegister.length === 0) {
  console.log('No affected MFE apps to register');
  process.exit(0);
}

async function register(appName) {
  const mfeId = MFES[appName];
  const url = `${CDN_BASE}/${appName}/${COMMIT_SHA}/remoteEntry.js`;

  const payload = {
    version: {
      url,
      metadata: {
        version: COMMIT_SHA,
        integrity: '',
      },
    },
  };

  if (DEPLOYMENT_STRATEGY) {
    payload.deploymentStrategy = DEPLOYMENT_STRATEGY;
  }

  const body = JSON.stringify(payload);

  console.log(`Registering ${appName} -> ${url}`);
  if (DEPLOYMENT_STRATEGY) {
    console.log(`  Strategy: ${DEPLOYMENT_STRATEGY}`);
  }

  execSync(
    `curl -sf -X POST "${API}/projects/${PROJECT_ID}/microFrontends/${mfeId}/versions" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" \
     -d '${body}'`,
    { stdio: 'inherit' }
  );
}

for (const appName of appsToRegister) {
  await register(appName);
}
console.log(`Registered ${appsToRegister.length} MFE(s): ${appsToRegister.join(', ')}`);
