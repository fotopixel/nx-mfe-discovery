import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'host',
  // Remote names listed here for Nx build graph and local dev server orchestration.
  // In production, remote URLs are resolved at runtime via the Discovery Service
  // (see src/discovery.ts). In local dev, the discovery-proxy overrides URLs
  // for any remote that is running locally.
  remotes: ['shop', 'cart', 'about'],
};

export default config;
