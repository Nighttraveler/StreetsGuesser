import { resolve } from 'node:path';
import { createApplication } from './http.mjs';

// Development composition only. Production API requires HTTPS origin and a trusted terminator.
const development = process.env.RANKINGS_DEVELOPMENT === '1';
const host = process.env.RANKINGS_HOST ?? '127.0.0.1';
const port = Number(process.env.RANKINGS_PORT ?? '8081');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
if (!process.env.RANKINGS_DB) throw new Error('Set RANKINGS_DB to a private persistent path outside the static directory');
const dbPath = resolve(process.env.RANKINGS_DB);
const app = createApplication({
  development, production: process.env.NODE_ENV === 'production', host,
  origin: process.env.RANKINGS_ORIGIN ?? `http://${host}:${port}`,
  dbPath, snapshotDir: `${dbPath}.datasets`, trustedProxy: process.env.RANKINGS_TRUSTED_PROXY,
  staticRoot: development ? new URL('../', import.meta.url) : null,
  registrations: [{ id: 'arrecifes', name: 'Arrecifes', path: new URL('../arrecifes_calles.json', import.meta.url) }],
});
app.server.listen(port, host, () => console.log(`Rankings API listening on ${host}:${port}`));
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
  if (stopping) return;
  stopping = true;
  await app.close();
});
