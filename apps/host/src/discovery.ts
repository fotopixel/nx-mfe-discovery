import { registerRemotes } from '@module-federation/enhanced/runtime';

interface DiscoveryManifest {
  microFrontends: Record<string, Array<{ url: string }>>;
}

interface DiscoveryConfig {
  discoveryEndpoint: string;
}

async function getDiscoveryEndpoint(): Promise<string | undefined> {
  try {
    const res = await fetch('/assets/discovery-config.json');
    if (!res.ok) return undefined;
    const config: DiscoveryConfig = await res.json();
    return config.discoveryEndpoint || undefined;
  } catch {
    return undefined;
  }
}

export async function initDiscovery(): Promise<void> {
  const endpoint = await getDiscoveryEndpoint();
  if (!endpoint) {
    return;
  }

  try {
    const res = await fetch(endpoint);
    const manifest: DiscoveryManifest = await res.json();

    const remotes = Object.entries(manifest.microFrontends)
      .filter(([, versions]) => versions.length > 0 && versions[0].url)
      .map(([name, versions]) => ({
        name: name.includes('/') ? name.split('/').pop()! : name,
        entry: versions[0].url,
      }));

    if (remotes.length > 0) {
      registerRemotes(remotes, { force: true });
    }
  } catch (err) {
    console.warn(
      'Discovery Service unavailable, falling back to static config:',
      err
    );
  }
}
