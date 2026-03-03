import { registerRemotes } from '@module-federation/enhanced/runtime';

interface DiscoveryManifest {
  microFrontends: Record<string, Array<{ url: string }>>;
}

function getDiscoveryEndpoint(): string | undefined {
  // Build-time override (local dev with proxy)
  const buildTime = process.env['NX_DISCOVERY_ENDPOINT'];
  if (buildTime) return buildTime;

  // Runtime: read from a <meta> tag injected at deploy time, e.g.
  // <meta name="discovery-endpoint" content="https://...">
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="discovery-endpoint"]'
  );
  return meta?.content || undefined;
}

export async function initDiscovery(): Promise<void> {
  const endpoint = getDiscoveryEndpoint();
  if (!endpoint) {
    return;
  }

  try {
    const res = await fetch(endpoint);
    const manifest: DiscoveryManifest = await res.json();

    const remotes = Object.entries(manifest.microFrontends)
      .filter(([, versions]) => versions.length > 0 && versions[0].url)
      .map(([name, versions]) => ({
        name,
        entry: versions[0].url,
      }));

    if (remotes.length > 0) {
      registerRemotes(remotes, { force: true });
    }
  } catch (err) {
    console.warn('Discovery Service unavailable, falling back to static config:', err);
  }
}
