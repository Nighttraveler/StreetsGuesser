// Test-only independent SQLite writer. Never exposed by the HTTP allowlist.
import { Store } from '../backend/ranked-game/database.mjs';
import { Catalog } from '../backend/ranked-game/catalog.mjs';
import { Games } from '../backend/ranked-game/service.mjs';
import { Rankings } from '../backend/rankings/service.mjs';
const [dbPath, snapshotDir, time] = process.argv.slice(2);
const store = new Store(dbPath);
const clock = () => Number(time);
const catalog = new Catalog(store, snapshotDir, []);
const games = new Games(store, catalog, clock);
const rankings = new Rankings(store, catalog, games, clock);
process.once('message', ({ playerId, body, key }) => {
  let response;
  try { response = store.mutate(playerId, key, '/api/v1/rankings/submissions', body, clock(), () => rankings.submit(playerId, body)); }
  catch (error) { response = { status: error.status ?? 500, code: error.code ?? 'INTERNAL_ERROR' }; }
  store.close();
  process.send(response, () => process.disconnect());
});
process.send({ ready: true });
