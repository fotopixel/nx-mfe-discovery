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

const mfeListRaw = execSync(
  `curl -sf "${API}/projects/${PROJECT_ID}/microFrontends" -H "Authorization: Bearer ${TOKEN}"`,
  { encoding: 'utf-8' }
);
const mfeList = JSON.parse(mfeListRaw);
const mfe = (mfeList.microFrontends || []).find((m) => {
  const shortName = m.name.includes('/') ? m.name.split('/').pop() : m.name;
  return shortName === APP;
});

if (!mfe) {
  const available = (mfeList.microFrontends || []).map((m) => m.name).join(', ');
  console.error(`MFE "${APP}" not found in project ${PROJECT_ID}. Available: ${available}`);
  process.exit(1);
}

const body = JSON.stringify({
  targetVersion: COMMIT_SHA,
  deploymentStrategy: DEPLOYMENT_STRATEGY,
});

console.log(`Promoting ${APP} to production (project: ${PROJECT_ID})`);
console.log(`  MFE ID:   ${mfe.id}`);
console.log(`  Version:  ${COMMIT_SHA}`);
console.log(`  Strategy: ${DEPLOYMENT_STRATEGY}`);

execSync(
  `curl -sf -X POST "${API}/projects/${PROJECT_ID}/microFrontends/${mfe.id}/deployment" \
   -H "Authorization: Bearer ${TOKEN}" \
   -H "Content-Type: application/json" \
   -d '${body}'`,
  { stdio: 'inherit' }
);

console.log(`${APP} deployment started in production`);
