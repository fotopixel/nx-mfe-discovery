const { execSync } = require('node:child_process');

const API = process.env.DISCOVERY_ADMIN_API;
const TOKEN = process.env.DISCOVERY_TOKEN;
const PROJECT_ID = process.env.DISCOVERY_PROJECT_ID;
const APP = process.env.APP;
const COMMIT_SHA = process.env.COMMIT_SHA;
const DEPLOYMENT_STRATEGY = process.env.DEPLOYMENT_STRATEGY;

if (!API || !TOKEN || !PROJECT_ID || !APP || !COMMIT_SHA || !DEPLOYMENT_STRATEGY) {
  console.error(
    'Missing required env vars: DISCOVERY_ADMIN_API, DISCOVERY_TOKEN, DISCOVERY_PROJECT_ID, APP, COMMIT_SHA, DEPLOYMENT_STRATEGY'
  );
  process.exit(1);
}

// MFE IDs as registered in the Discovery Service.
// Update these to match your actual MFE IDs.
const MFE_MAP = {
  shop: 'YOUR_SHOP_MFE_ID',
  cart: 'YOUR_CART_MFE_ID',
  about: 'YOUR_ABOUT_MFE_ID',
};

const mfeId = MFE_MAP[APP];
if (!mfeId) {
  console.error(`Unknown app: ${APP}`);
  process.exit(1);
}

// The version was already pre-registered in the production project during
// the staging deploy. We just need to create a deployment to activate it.
const body = JSON.stringify({
  targetVersion: COMMIT_SHA,
  deploymentStrategy: DEPLOYMENT_STRATEGY,
});

console.log(`Promoting ${APP} to production (project: ${PROJECT_ID})`);
console.log(`  Version:  ${COMMIT_SHA}`);
console.log(`  Strategy: ${DEPLOYMENT_STRATEGY}`);

execSync(
  `curl -sf -X POST "${API}/projects/${PROJECT_ID}/microFrontends/${mfeId}/deployment" \
   -H "Authorization: Bearer ${TOKEN}" \
   -H "Content-Type: application/json" \
   -d '${body}'`,
  { stdio: 'inherit' }
);

console.log(`${APP} deployment started in production`);
