const { execSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match?.[1]?.trim() || '';
}

const REGION = getEnvVar('COGNITO_REGION') || 'eu-central-1';
const USER_POOL_ID = getEnvVar('COGNITO_USER_POOL_ID');
const CLIENT_ID = getEnvVar('COGNITO_CLIENT_ID');
const USERNAME = getEnvVar('COGNITO_USERNAME');
const PASSWORD = getEnvVar('COGNITO_PASSWORD');

if (!USER_POOL_ID || !CLIENT_ID || !USERNAME || !PASSWORD) {
  console.error('Missing values in .env.local. Required:');
  if (!USER_POOL_ID) console.error('  COGNITO_USER_POOL_ID');
  if (!CLIENT_ID) console.error('  COGNITO_CLIENT_ID');
  if (!USERNAME) console.error('  COGNITO_USERNAME');
  if (!PASSWORD) console.error('  COGNITO_PASSWORD');
  process.exit(1);
}

console.log(`Fetching token for ${USERNAME}...`);

const result = execSync(
  `aws cognito-idp admin-initiate-auth \
   --region ${REGION} \
   --user-pool-id ${USER_POOL_ID} \
   --client-id ${CLIENT_ID} \
   --auth-flow ADMIN_USER_PASSWORD_AUTH \
   --auth-parameters USERNAME=${USERNAME},PASSWORD='${PASSWORD}' \
   --query AuthenticationResult.IdToken \
   --output text`,
  { encoding: 'utf-8' }
).trim();

if (!result || result === 'None') {
  console.error('Failed to retrieve IdToken');
  process.exit(1);
}

const updated = envContent.replace(
  /^DISCOVERY_TOKEN=.*$/m,
  `DISCOVERY_TOKEN=${result}`
);
writeFileSync(envPath, updated);

console.log('Token written to .env.local (DISCOVERY_TOKEN)');
console.log(`Expires in ~1 hour`);
