const { execSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || 'eu-west-1';
const COMMIT_SHA = process.env.COMMIT_SHA;
const AFFECTED_APPS = process.env.AFFECTED_APPS;

if (!BUCKET || !COMMIT_SHA) {
  console.error('Missing required env vars: S3_BUCKET, COMMIT_SHA');
  process.exit(1);
}

const ALL_APPS = ['shop', 'cart', 'about'];
const apps = AFFECTED_APPS
  ? AFFECTED_APPS.split(',').map((a) => a.trim()).filter(Boolean)
  : ALL_APPS;

let uploaded = 0;

for (const app of apps) {
  const distDir = join(__dirname, '..', 'dist', 'apps', app);

  if (!existsSync(distDir)) {
    console.log(`Skipping ${app} (not built)`);
    continue;
  }

  const s3Path = `s3://${BUCKET}/${app}/${COMMIT_SHA}/`;
  console.log(`Uploading ${app} -> ${s3Path}`);

  execSync(
    `aws s3 sync "${distDir}" "${s3Path}" --region ${REGION} --delete`,
    { stdio: 'inherit' }
  );
  uploaded++;
}

console.log(`Upload complete (${uploaded} app(s))`);
