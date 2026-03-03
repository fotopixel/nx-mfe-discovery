import express from 'express';
import cors from 'cors';
import { createConnection } from 'node:net';
import { MFE_PORTS } from './mfe-ports';

const app = express();
app.use(cors({ origin: true, credentials: true }));

const STAGING_ENDPOINT = process.env['STAGING_DISCOVERY_ENDPOINT'];
const PORT = 4300;

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const conn = createConnection(port, 'localhost');
    conn.on('connect', () => {
      conn.destroy();
      resolve(true);
    });
    conn.on('error', () => resolve(false));
  });
}

app.get('/microFrontends', async (_req, res) => {
  if (!STAGING_ENDPOINT) {
    res.status(500).json({
      error:
        'STAGING_DISCOVERY_ENDPOINT is not set. Add it to .env.local and restart.',
    });
    return;
  }

  try {
    const stagingRes = await fetch(STAGING_ENDPOINT);
    const manifest = (await stagingRes.json()) as {
      microFrontends: Record<string, Array<{ url: string }>>;
    };

    for (const [mfeId, port] of Object.entries(MFE_PORTS)) {
      if (await isPortOpen(port)) {
        if (manifest.microFrontends[mfeId]?.[0]) {
          manifest.microFrontends[mfeId][0].url = `http://localhost:${port}/remoteEntry.js`;
        }
        console.log(`  Local:   ${mfeId} -> localhost:${port}`);
      } else {
        console.log(`  Staging: ${mfeId}`);
      }
    }

    res.json(manifest);
  } catch (err) {
    console.error('Failed to fetch staging manifest:', err);
    res.status(502).json({ error: 'Failed to fetch staging manifest' });
  }
});

app.listen(PORT, () => {
  console.log(`Discovery Proxy running on http://localhost:${PORT}`);
  console.log(`Staging endpoint: ${STAGING_ENDPOINT ?? '(not set)'}`);
  const remoteList = Object.entries(MFE_PORTS)
    .map(([k, v]) => k + '=:' + v)
    .join(', ');
  console.log(`Monitored remotes: ${remoteList}`);
});
