import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'host',
  // Remotes are resolved entirely at runtime via the Discovery Service
  // (see src/discovery.ts) and loaded with loadRemote() (see src/app/app.tsx).
  remotes: [],
};

export default config;
