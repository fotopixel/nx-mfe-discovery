const { execSync } = require('node:child_process');

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const USERNAME = process.env.COGNITO_USERNAME;
const PASSWORD = process.env.COGNITO_PASSWORD;
const REGION = process.env.AWS_REGION || 'eu-west-1';

if (!USER_POOL_ID || !CLIENT_ID || !USERNAME || !PASSWORD) {
  console.error(
    'Missing required env vars: COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_USERNAME, COGNITO_PASSWORD'
  );
  process.exit(1);
}

const result = execSync(
  `aws cognito-idp admin-initiate-auth \
   --region ${REGION} \
   --user-pool-id ${USER_POOL_ID} \
   --client-id ${CLIENT_ID} \
   --auth-flow ADMIN_USER_PASSWORD_AUTH \
   --auth-parameters USERNAME=${USERNAME},PASSWORD=${PASSWORD}`,
  { encoding: 'utf-8' }
);

const response = JSON.parse(result);
const idToken = response.AuthenticationResult?.IdToken;

if (!idToken) {
  console.error('Failed to retrieve IdToken from Cognito response');
  console.error(JSON.stringify(response, null, 2));
  process.exit(1);
}

// Output for GitHub Actions: sets DISCOVERY_TOKEN for subsequent steps
process.stdout.write(idToken);
