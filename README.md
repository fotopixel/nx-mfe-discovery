# Nx Module Federation + Discovery Service POC

Proof of concept for **runtime micro-frontend discovery** using [Nx](https://nx.dev), [Module Federation](https://module-federation.io) (Rspack), and the [AWS Frontend Discovery Service](https://github.com/awslabs/frontend-discovery-service).

The key idea: **build once, deploy everywhere**. Each remote MFE is built to a single artifact, stored in S3, and served through CloudFront. The Discovery Service manages which version is active per environment — no per-environment rebuilds needed.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│                                                                     │
│  ┌──────────┐   1. fetch config    ┌──────────────────────────────┐ │
│  │ Host App ├─────────────────────►│ /assets/discovery-config.json│ │
│  │ :4200    │                      └──────────────────────────────┘ │
│  │          │   2. fetch manifest                                   │
│  │          ├──────────────────────►  Discovery Service / Proxy     │
│  │          │                         (Consumer API)                │
│  │          │   3. loadRemote()                                     │
│  │          ├──────────────────────►  remoteEntry.js                │
│  └──────────┘                         (S3 + CloudFront / localhost) │
└─────────────────────────────────────────────────────────────────────┘
```

**At startup**, the host app:

1. Fetches `/assets/discovery-config.json` to get the Discovery Service endpoint
2. Calls the Consumer API to get the manifest of all registered MFEs
3. Uses `registerRemotes()` to wire them into the Module Federation runtime
4. Loads each remote on demand via `loadRemote()` when the user navigates

## Workspace Structure

```
apps/
  host/                  Shell app (React, port 4200)
  shop/                  Remote MFE (port 4201)
  cart/                  Remote MFE (port 4202)
  about/                 Remote MFE (port 4203)
  discovery-proxy/       Local dev proxy (Express, port 4300)
libs/
  shared/ui/             Shared React component library
scripts/
  get-cognito-token.js   Fetch Cognito token (CI)
  get-local-token.js     Fetch token and write to .env.local
  upload-to-s3.js        Upload build artifacts to S3
  register-mfe-versions.js  Register MFE versions in Discovery Service
  promote-to-production.js  Trigger production deployment
http/
  admin-api.http         REST Client requests for Admin API
  consumer-api.http      REST Client requests for Consumer API
```

## Prerequisites

- **Node.js** 22+
- **pnpm** 10+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- **AWS CLI** configured with credentials that have Cognito `AdminInitiateAuth` permission (for `pnpm get-token`)
- **AWS Frontend Discovery Service** deployed ([installation guide](https://github.com/awslabs/frontend-discovery-service/blob/main/docs/USER_GUIDE.md))

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment template and fill in your values
cp .env.example .env.local
ln -sf .env.local .env   # symlink for REST Client extension

# Fetch a Cognito token (writes to .env.local automatically)
pnpm get-token
```

## Local Development

The discovery proxy merges the staging manifest with any locally running remotes. If a remote is running on its expected port, the proxy overrides its URL to `localhost`; otherwise, the staging (CDN) version is used.

```bash
# Host only — all remotes from staging/CDN
pnpm dev:host

# Host + one remote locally, rest from staging
pnpm dev:shop
pnpm dev:cart
pnpm dev:about

# Everything local
pnpm dev:all
```

| App             | Port |
| --------------- | ---- |
| Host            | 4200 |
| Shop            | 4201 |
| Cart            | 4202 |
| About           | 4203 |
| Discovery Proxy | 4300 |

### How the Discovery Proxy Works

1. Fetches the staging manifest from the Consumer API (`STAGING_DISCOVERY_ENDPOINT`)
2. Probes each remote's local port (4201, 4202, 4203)
3. If a port is open, replaces that MFE's URL with `http://localhost:{port}/remoteEntry.js`
4. Returns the modified manifest to the host

This means you can edit one remote locally while consuming the rest from staging — no need to run all MFEs.

## CI/CD Pipeline

### PR Checks (`pr.yml`)

Runs on every pull request to `main`:

- `nx affected --target=lint`
- `nx affected --target=test`
- `nx affected --target=build`

Distributed via Nx Cloud across 3 agents.

### Staging Deploy (`staging.yml`)

Runs automatically on push to `main`:

1. Determines affected apps with `nx affected`
2. Builds affected apps
3. Uploads build artifacts to S3 (`{app}/{commitSha}/`)
4. Registers versions in the **staging** Discovery Service project (AllAtOnce deploy)
5. Pre-registers the same versions in the **production** project (available for promotion, not yet active)

Only remote apps (shop, cart, about) are deployed — the host runs locally for this POC.

### Production Promotion (`production.yml`)

Manual `workflow_dispatch` trigger with inputs:

| Input                 | Description                              |
| --------------------- | ---------------------------------------- |
| `app`                 | Remote to promote (shop, cart, about)    |
| `version`             | Commit SHA of the staging-tested build   |
| `deployment_strategy` | Rollout strategy (AllAtOnce, Canary, Linear) |

Available strategies: `AllAtOnce`, `Canary10Percent5Minutes`, `Canary10Percent10Minutes`, `Canary10Percent15Minutes`, `Linear10PercentEvery1Minute`, `Linear10PercentEvery2Minutes`, `Linear10PercentEvery3Minutes`.

### Build Artifact Layout (S3)

```
s3://your-bucket/
  shop/
    abc123/          ← commit SHA
      remoteEntry.js
      ...chunks
    def456/
      remoteEntry.js
      ...chunks
  cart/
    abc123/
      ...
```

Each version is immutable. The Discovery Service points to the active version's `remoteEntry.js` URL on CloudFront.

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable                       | Purpose                                         |
| ------------------------------ | ----------------------------------------------- |
| `STAGING_DISCOVERY_ENDPOINT`   | Consumer API URL for staging project             |
| `PRODUCTION_DISCOVERY_ENDPOINT`| Consumer API URL for production project          |
| `DISCOVERY_ADMIN_API`          | Admin API base URL                               |
| `COGNITO_USER_POOL_ID`         | Cognito User Pool ID (for token retrieval)       |
| `COGNITO_CLIENT_ID`            | Cognito App Client ID                            |
| `COGNITO_USERNAME`             | Cognito username                                 |
| `COGNITO_PASSWORD`             | Cognito password                                 |
| `DISCOVERY_TOKEN`              | JWT token (auto-populated by `pnpm get-token`)   |

### GitHub Secrets (CI)

| Secret                   | Where to find it                              |
| ------------------------ | --------------------------------------------- |
| `NX_CLOUD_ACCESS_TOKEN`  | [Nx Cloud](https://cloud.nx.app) workspace settings |
| `AWS_ACCESS_KEY_ID`      | IAM user access key                           |
| `AWS_SECRET_ACCESS_KEY`  | IAM user secret key                           |
| `S3_BUCKET`              | S3 bucket name for artifacts                  |
| `CDN_BASE`               | CloudFront distribution URL                   |
| `DISCOVERY_ADMIN_API`    | Admin API Gateway URL                         |
| `STAGING_PROJECT_ID`     | Discovery Service staging project ID          |
| `PRODUCTION_PROJECT_ID`  | Discovery Service production project ID       |
| `COGNITO_USER_POOL_ID`   | Cognito User Pool ID                          |
| `COGNITO_CLIENT_ID`      | Cognito App Client ID                         |
| `COGNITO_USERNAME`       | Cognito user for CI                           |
| `COGNITO_PASSWORD`       | Cognito password for CI                       |

## REST Client (.http files)

The `http/` folder contains request files for the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) VS Code extension. Variables are read from `.env.local` via `{{$dotenv VAR_NAME}}`.

```bash
# Refresh your token before using Admin API requests
pnpm get-token
```

Then open `http/admin-api.http` or `http/consumer-api.http` and click "Send Request" on any endpoint.

## Next Steps: Host App Deployment

Currently the host app runs locally and is **not deployed** to S3/CloudFront. Only the remote MFEs (shop, cart, about) are built and deployed via CI. The following describes the planned approach to close this gap.

### S3 Layout

Host builds are versioned identically to remotes in the same bucket:

```
s3://bucket/
  host/
    abc123/                        <- commit SHA
      index.html
      main.abc123.js
      assets/
        discovery-config.json      <- injected at deploy time
    def456/
      ...
  shop/abc123/remoteEntry.js
  cart/abc123/remoteEntry.js
  about/abc123/remoteEntry.js
```

### CloudFront: KeyValueStore + Function

Since the host is versioned at `host/{sha}/`, CloudFront needs to know which version is active. A **CloudFront Function** (JS runtime 2.0, viewer-request) reads the active SHA from a **[KeyValueStore](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/kvs-with-functions.html)** and rewrites incoming requests:

- Requests for remote MFE paths (`shop/`, `cart/`, `about/`) pass through unchanged
- Requests for files with extensions (`.js`, `.css`, etc.) rewrite to `host/{sha}/{path}`
- All other requests (SPA routes like `/shop`, `/cart`, `/`) rewrite to `host/{sha}/index.html`

**Switching versions** = update the KVS key `activeHostVersion`. Propagates to the edge in seconds, no CloudFront redeploy needed.

### discovery-config.json Injection

The build artifact includes the local-dev `discovery-config.json`. At deploy time, the upload script overwrites it with the environment-specific Consumer API endpoint:

```json
{
  "discoveryEndpoint": "https://consumer-api.../projects/{projectId}/microFrontends"
}
```

### Implementation Checklist

- [ ] Create CloudFront KeyValueStore (one-time, via Console/CLI)
- [ ] Create CloudFront Function (viewer-request rewrite logic) and associate with distribution
- [ ] Modify `scripts/upload-to-s3.js` to handle host uploads and inject `discovery-config.json` from a `DISCOVERY_ENDPOINT` env var
- [ ] Create `scripts/update-host-version.js` to update the KVS `activeHostVersion` key (uses `@aws-sdk/client-cloudfront-keyvaluestore`)
- [ ] Update `staging.yml` to build/upload host and activate it via KVS
- [ ] Extend `production.yml` with a `workflow_dispatch` option for host promotion
- [ ] Update IAM policy for `nx-mfe-ci` to allow `cloudfront-keyvaluestore:UpdateKeys` and `cloudfront-keyvaluestore:DescribeKeyValueStore`
- [ ] Add GitHub secrets: `CLOUDFRONT_KVS_ARN`, `CLOUDFRONT_DISTRIBUTION_ID`, `STAGING_DISCOVERY_ENDPOINT`

## Tech Stack

| Layer             | Technology                                          |
| ----------------- | --------------------------------------------------- |
| Monorepo          | [Nx](https://nx.dev) 22                             |
| Package Manager   | [pnpm](https://pnpm.io) 10                          |
| Bundler           | [Rspack](https://rspack.dev) 1.6                    |
| Module Federation | [@module-federation/enhanced](https://module-federation.io) 0.21 |
| Framework         | [React](https://react.dev) 19                       |
| Discovery         | [AWS Frontend Discovery Service](https://github.com/awslabs/frontend-discovery-service) |
| Storage           | AWS S3 + CloudFront                                 |
| Auth              | AWS Cognito                                         |
| CI/CD             | GitHub Actions + Nx Cloud                           |
