import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { backup } from 'node:sqlite';
import { fork, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { request as httpRequest } from 'node:http';
import { createApplication, validateConfig } from '../backend/ranked-game/http.mjs';
import { Store, digest } from '../backend/ranked-game/database.mjs';
import { normalizeUsername } from '../backend/rankings/validation.mjs';
import { streetId } from '../frontend/game.mjs';
import { DAY } from '../backend/ranked-game/service.mjs';

// Deliberately synthetic, never installed in the production catalog.
const streets = [
  { nombre: 'Calle Uno', nivel: 1, osm_way_ids: [101] },
  { nombre: 'Calle Dos', nivel: 1, osm_way_ids: [102] },
  { nombre: 'Calle Tres', nivel: 2, osm_way_ids: [103] },
  { nombre: 'Calle Cuatro', nivel: 3, osm_way_ids: [104] },
];
async function harness(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'rankings-test-'));
  const fixture = join(dir, 'synthetic.json');
  await writeFile(fixture, JSON.stringify(streets));
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  let now = 1700000000000;
  const config = { development: true, host: '127.0.0.1', origin: `http://127.0.0.1:${port}`,
    dbPath: join(dir, 'state.db'), snapshotDir: join(dir, 'snapshots'), clock: () => now,
    staticRoot: new URL('../frontend/', import.meta.url),
    registrations: [{ id: 'arrecifes', name: 'Arrecifes', path: fixture }, { id: 'synthetic-city', name: 'Synthetic fixture', path: fixture }], ...overrides };
  let app;
  async function start() {
    app = createApplication(config);
    await new Promise(resolve => app.server.listen(port, config.host, resolve));
  }
  await start();
  t.after(async () => { await app.close(); await rm(dir, { recursive: true }); });
  const h = {
    get app() { return app; }, config, dir,
    advance(ms) { now += ms; },
    async restart() { await app.close(); await start(); },
    async request(path, { cookie, method = 'GET', body, key = randomUUID(), headers = {}, raw } = {}) {
      const response = await fetch(`${config.origin}/api/v1${path}`, { method, headers: {
        ...(method === 'POST' ? { Origin: config.origin, 'Content-Type': 'application/json', 'Idempotency-Key': key } : {}),
        Connection: 'close', ...(cookie ? { Cookie: cookie } : {}), ...headers,
      }, ...(method === 'POST' ? { body: raw ?? JSON.stringify(body ?? {}) } : {}) });
      return { status: response.status, body: await response.json(), headers: response.headers };
    },
    async player() {
      const response = await h.request('/session', { method: 'POST' });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      return { id: response.body.player.id, cookie: response.headers.get('set-cookie').split(';')[0] };
    },
    async game(player, difficulty = 1, city_id = 'arrecifes') {
      const response = await h.request('/games', { method: 'POST', cookie: player.cookie, body: { city_id, difficulty } });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      return response.body;
    },
    async action(player, game, type, answer, key = randomUUID()) {
      const body = { round_id: game.round.id, type, ...(answer === undefined ? {} : { answer }) };
      return h.request(`/games/${game.id}/actions`, { method: 'POST', cookie: player.cookie, body, key });
    },
    async finish(player, { difficulty = 1, city = 'arrecifes', hints = false } = {}) {
      let game = await h.game(player, difficulty, city);
      while (game.status === 'active') {
        if (game.round.resolved) {
          const next = await h.action(player, game, 'next');
          assert.equal(next.status, 200, JSON.stringify(next.body)); game = next.body.game;
        }
        if (hints) {
          const hint = await h.action(player, game, 'hint');
          assert.equal(hint.status, 200, JSON.stringify(hint.body)); game = hint.body.game;
        }
        const street = streets.find(street => streetId(street) === game.round.street_id);
        const answer = await h.action(player, game, 'answer', street.nombre);
        assert.equal(answer.status, 200, JSON.stringify(answer.body)); game = answer.body.game;
      }
      assert.equal(game.status, 'completed');
      return game;
    },
    submit(player, game, username, key = randomUUID(), extra = {}) {
      return h.request('/rankings/submissions', { method: 'POST', cookie: player.cookie, key, body: { game_id: game.id, username, ...extra } });
    },
    list(query = 'city_id=arrecifes&difficulty=1') { return h.request(`/rankings?${query}`); },
  };
  return h;
}
function error(response, status, code) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  assert.equal(response.body.error.code, code);
  assert.equal(typeof response.body.error.retryable, 'boolean');
  assert.ok(Object.hasOwn(response.body.error, 'field'));
}

function proxyRequest(app, forwarded = true) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: '127.0.0.1', port: app.server.address().port, path: '/api/v1/session', method: 'POST',
      headers: { Host: 'game.example', Origin: 'https://game.example', ...(forwarded ? { 'X-Forwarded-Proto': 'https' } : {}), 'Content-Type': 'application/json' } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks)), headers: response.headers }));
    });
    req.on('error', reject); req.end('{}');
  });
}

test('nombre ASCII exacto: espacios, longitudes, reservados y Unicode', () => {
  assert.equal(normalizeUsername(' Ana_7 '), 'ana_7');
  assert.equal(normalizeUsername('ANA_7'), 'ana_7');
  for (const name of ['ánita', 'ana-7', 'ana 7', 'ab', '\tana', 'ana\n', 'ａｎａ', 'a'.repeat(21), ' '.repeat(62) + 'ana', null, 42, {}]) {
    assert.throws(() => normalizeUsername(name), e => e.code === 'INVALID_USERNAME');
  }
  for (const name of ['ADMIN', 'administrator', 'moderator', 'support', 'system', 'anonymous']) {
    assert.throws(() => normalizeUsername(name), e => e.code === 'USERNAME_RESERVED');
  }
});

test('identidad, catálogo, cookie privada, origen y allowlist del harness', async t => {
  const h = await harness(t);
  error(await h.request('/session'), 401, 'SESSION_REQUIRED');
  const first = await h.request('/session', { method: 'POST' });
  const cookie = first.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Lax; Path=\/; Max-Age=15552000/);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  const reuse = await h.request('/session', { method: 'POST', cookie });
  assert.equal(reuse.status, 200); assert.deepEqual(reuse.body, first.body); assert.equal(reuse.headers.get('set-cookie'), null);
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM players').n, 1);
  const stored = h.app.store.get('SELECT token_hash FROM sessions').token_hash;
  assert.equal(stored, digest(cookie.split(';')[0].split('=')[1]));
  const catalog = await h.request('/catalog');
  assert.deepEqual(catalog.body.cities[0].difficulties.map(row => row.id), [1, 2, 3]);
  error(await h.request('/session', { method: 'POST', headers: { Origin: 'https://evil.test' } }), 403, 'ORIGIN_FORBIDDEN');
  for (const path of ['/.git/config', '/ranked-game/http.mjs', '/RANKINGS_SPEC.md', '/state.db', '/package.json']) {
    assert.equal((await fetch(h.config.origin + path)).status, 404);
  }
  assert.equal((await fetch(h.config.origin + '/')).status, 200);
  h.advance(180 * DAY);
  error(await h.request('/session', { cookie }), 401, 'SESSION_REQUIRED');
});

test('juego autoritativo: error, salto, pista, replay, progreso único y última ronda', async t => {
  const h = await harness(t); const player = await h.player();
  let game = await h.game(player);
  assert.equal(game.round.revealed_name, null); assert.equal(game.round.hint_text, null);
  error(await h.request('/games', { method: 'POST', cookie: player.cookie, body: { city_id: 'arrecifes', difficulty: 2 } }), 409, 'ACTIVE_GAME_EXISTS');
  error(await h.action(player, game, 'next'), 409, 'GAME_NOT_ACTIVE');
  const wrong = await h.action(player, game, 'answer', 'wrong');
  assert.equal(wrong.body.game.score, 0); assert.equal(wrong.body.game.progress.correct, 0);
  const skip = await h.action(player, game, 'skip');
  assert.equal(skip.body.game.score, 0); assert.equal(skip.body.game.round.resolved, true);
  assert.ok(skip.body.game.round.revealed_name);
  error(await h.action(player, game, 'hint'), 409, 'GAME_NOT_ACTIVE');
  const next = await h.action(player, skip.body.game, 'next');
  assert.notEqual(next.body.game.round.street_id, game.round.street_id);
  error(await h.action(player, game, 'skip'), 409, 'STALE_ROUND');
  game = next.body.game;
  const hint = await h.action(player, game, 'hint'); game = hint.body.game;
  assert.ok(game.round.hint_text);
  const repeatedHint = await h.action(player, game, 'hint');
  assert.equal(repeatedHint.body.game.revision, game.revision);
  const key = randomUUID(); const answer = streets.find(s => streetId(s) === game.round.street_id).nombre;
  const correct = await h.action(player, game, 'answer', answer, key);
  const replay = await h.action(player, game, 'answer', answer, key);
  assert.deepEqual(replay.body, correct.body); assert.equal(correct.body.game.score, 5);
  error(await h.action(player, game, 'answer', 'different', key), 409, 'IDEMPOTENCY_CONFLICT');
  error(await h.action(player, game, 'answer', answer), 409, 'GAME_NOT_ACTIVE');
  game = (await h.action(player, correct.body.game, 'next')).body.game;
  assert.notEqual(game.round.street_id, correct.body.game.round.street_id);
  const final = await h.action(player, game, 'answer', streets.find(s => streetId(s) === game.round.street_id).nombre);
  assert.equal(final.body.game.score, 15); assert.equal(final.body.game.status, 'completed');
  assert.equal(final.body.game.progress.correct, 2); assert.equal(final.body.game.eligible_for_ranking, true);
  assert.equal((await h.request('/games/active', { cookie: player.cookie })).body.game, null);
  const level2 = await h.game(player, 2); assert.equal(level2.score, 0); assert.equal(level2.progress.correct, 0);
  assert.throws(() => h.app.store.run('UPDATE games SET score=999 WHERE id=?', game.id), /immutable/);
});

test('publicación: ownership, formulario manipulado, UNIQUE global e inmutabilidad', async t => {
  const h = await harness(t); const a = await h.player(); const b = await h.player();
  const active = await h.game(b);
  error(await h.submit(b, active, 'waiting'), 409, 'GAME_NOT_ELIGIBLE');
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM usernames').n, 0);
  const game = await h.finish(a);
  error(await h.submit(b, game, 'thief'), 404, 'GAME_NOT_FOUND');
  for (const field of ['score', 'city_id', 'difficulty', 'player_id']) {
    const response = await h.submit(a, game, 'ana_7', randomUUID(), { [field]: 999 });
    error(response, 422, 'UNKNOWN_FIELD'); assert.equal(response.body.error.field, field);
  }
  const key = randomUUID();
  const publication = await h.submit(a, game, ' Ana_7 ', key);
  assert.equal(publication.status, 201, JSON.stringify(publication.body));
  assert.equal(publication.body.submission.username, 'ana_7'); assert.equal(publication.body.submission.score, 20);
  assert.deepEqual((await h.submit(a, game, ' Ana_7 ', key)).body, publication.body);
  error(await h.submit(a, game, 'ANA_7', key), 409, 'IDEMPOTENCY_CONFLICT');
  const again = await h.submit(a, game, 'ANA_7');
  assert.equal(again.status, 200); assert.equal(again.body.already_submitted, true); assert.equal(again.body.improved, false);
  error(await h.submit(a, game, 'another'), 409, 'USERNAME_LOCKED');
  assert.equal((await h.request('/session', { cookie: a.cookie })).body.player.username, 'ana_7');
  await h.request(`/games/${active.id}/abandon`, { method: 'POST', cookie: b.cookie });
  const bGame = await h.finish(b, { difficulty: 2 });
  error(await h.submit(b, bGame, 'ANA_7'), 409, 'USERNAME_TAKEN');
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM submissions').n, 1);
  assert.equal((await h.submit(b, bGame, 'bea_9')).status, 201);
  assert.throws(() => h.app.store.run('INSERT INTO usernames VALUES (?,?,?)', randomUUID(), 'bad-name', 0));
  const unclaimed = await h.player();
  assert.throws(() => h.app.store.run('INSERT INTO usernames VALUES (?,?,?)', unclaimed.id, 'ana_7', 0), /UNIQUE/);
  assert.throws(() => h.app.store.run('INSERT INTO usernames VALUES (?,?,?)', unclaimed.id, 'Ana_7', 0), /CHECK/);
  assert.throws(() => h.app.store.run('INSERT INTO usernames VALUES (?,?,?)', unclaimed.id, 'ana\0other', 0), /CHECK/);
});

test('mejor marca conserva igualdad y mejora solo con score mayor', async t => {
  const h = await harness(t); const p = await h.player();
  const low = await h.finish(p, { hints: true });
  assert.equal((await h.submit(p, low, 'player_1')).body.improved, true);
  const high = await h.finish(p); const improved = await h.submit(p, high, 'player_1');
  assert.equal(improved.body.improved, true); assert.equal(improved.body.best.game_id, high.id);
  const equal = await h.finish(p);
  const equalResult = await h.submit(p, equal, 'player_1');
  assert.equal(equalResult.body.improved, false); assert.equal(equalResult.body.best.game_id, high.id);
  const worse = await h.finish(p, { hints: true });
  const result = await h.submit(p, worse, 'player_1');
  assert.equal(result.body.best.game_id, high.id); assert.equal(result.body.improved, false);
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM submissions').n, 4);
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM leaderboard_entries').n, 1);
  const lowPlayer = await h.player(); const lowGame = await h.finish(lowPlayer, { hints: true });
  await h.submit(lowPlayer, lowGame, 'low_player');
  assert.deepEqual((await h.list()).body.items.map(item => item.score), [20, 10]);
});

test('tableros aislados, empates tiempo/UUID, paginación y query estricta', async t => {
  const h = await harness(t);
  const a = await h.player(); const b = await h.player(); const c = await h.player();
  const ga = await h.finish(a); const gb = await h.finish(b); // Same clock: UUID breaks tie.
  h.advance(1); const gc = await h.finish(c);
  await h.submit(c, gc, 'player_c'); await h.submit(b, gb, 'player_b'); await h.submit(a, ga, 'player_a');
  const ordered = [ga, gb].sort((x, y) => x.id < y.id ? -1 : 1).map(g => g.id === ga.id ? 'player_a' : 'player_b').concat('player_c');
  const list = await h.list();
  assert.deepEqual(list.body.items.map(item => item.username), ordered);
  assert.deepEqual(list.body.items.map(item => item.position), [1, 2, 3]);
  assert.deepEqual(Object.keys(list.body.items[0]).sort(), ['completed_at', 'position', 'score', 'username']);
  const page = await h.list('city_id=arrecifes&difficulty=1&limit=1&offset=1');
  assert.equal(page.body.items[0].username, ordered[1]); assert.equal(page.body.items[0].position, 2);
  assert.equal(page.body.pagination.has_more, true); assert.equal(page.body.pagination.total, 3);
  assert.equal((await h.list('city_id=arrecifes&difficulty=1&offset=99')).body.items.length, 0);
  assert.equal((await h.list('city_id=arrecifes&difficulty=2')).body.pagination.total, 0);
  assert.equal((await h.list('city_id=synthetic-city&difficulty=1')).body.pagination.total, 0);
  const other = await h.finish(a, { city: 'synthetic-city', difficulty: 2 });
  await h.submit(a, other, 'player_a');
  assert.equal((await h.list('city_id=synthetic-city&difficulty=2')).body.pagination.total, 1);
  assert.equal((await h.list()).body.pagination.total, 3);
  for (const query of ['', 'city_id=arrecifes', 'city_id=arrecifes&difficulty=01', 'city_id=arrecifes&difficulty=1&limit=0',
    'city_id=arrecifes&difficulty=1&offset=-1', 'city_id=arrecifes&difficulty=1&player_id=x',
    'city_id=arrecifes&difficulty=1&difficulty=2', 'city_id=arrecifes&difficulty=1&offset=10001']) {
    error(await h.list(query), 400, 'INVALID_QUERY');
  }
  error(await h.list('city_id=unknown&difficulty=1'), 404, 'CITY_NOT_FOUND');
  h.app.store.run('DELETE FROM boards WHERE city_id=? AND difficulty=?', 'synthetic-city', 3);
  error(await h.list('city_id=synthetic-city&difficulty=3'), 404, 'BOARD_NOT_FOUND');
});

test('plazos exclusivos, abandono, versiones retiradas y replay tras vencimiento', async t => {
  const h = await harness(t); const p = await h.player();
  let game = await h.game(p);
  const abandon = await h.request(`/games/${game.id}/abandon`, { method: 'POST', cookie: p.cookie });
  assert.equal(abandon.body.status, 'abandoned');
  assert.equal((await h.request(`/games/${game.id}/abandon`, { method: 'POST', cookie: p.cookie })).status, 200);
  error(await h.submit(p, game, 'player_1'), 409, 'GAME_NOT_ELIGIBLE');
  game = await h.game(p); h.advance(DAY);
  const expired = await h.request(`/games/${game.id}`, { cookie: p.cookie }); assert.equal(expired.body.status, 'expired');
  assert.equal(h.app.store.get('SELECT status FROM games WHERE id=?', game.id).status, 'active'); // GET never mutates.
  error(await h.action(p, game, 'skip'), 409, 'GAME_NOT_ACTIVE');
  error(await h.submit(p, game, 'player_1'), 409, 'GAME_NOT_ELIGIBLE');
  game = await h.finish(p); h.advance(7 * DAY);
  error(await h.submit(p, game, 'player_1'), 409, 'GAME_NOT_ELIGIBLE');
  const retired = await h.finish(p);
  h.app.store.run("UPDATE boards SET active_rules_version='2' WHERE city_id='arrecifes' AND difficulty=1");
  error(await h.submit(p, retired, 'player_1'), 409, 'BOARD_VERSION_CHANGED');
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM usernames').n, 0);
  h.app.store.run("UPDATE boards SET active_rules_version='1' WHERE city_id='arrecifes' AND difficulty=1");
  assert.equal((await h.submit(p, retired, 'player_1')).status, 201);
  h.app.store.run("UPDATE boards SET active_rules_version='2' WHERE city_id='arrecifes' AND difficulty=1");
  assert.equal((await h.list()).body.pagination.total, 0);
  h.advance(8 * DAY);
  assert.equal((await h.submit(p, retired, 'player_1')).status, 200);
});

test('persistencia, migración repetida, transacción rollback y backup/restauración', async t => {
  const h = await harness(t); const p = await h.player();
  const game = await h.finish(p); const key = randomUUID(); const result = await h.submit(p, game, 'persist_1', key);
  assert.equal(result.status, 201);
  assert.throws(() => h.app.store.transaction(db => { db.run('INSERT INTO players VALUES (?,?)', 'rollback', 1); throw new Error('forced rollback'); }));
  assert.equal(h.app.store.get("SELECT * FROM players WHERE id='rollback'"), undefined);
  assert.equal(h.app.store.get('PRAGMA foreign_keys').foreign_keys, 1);
  assert.equal(h.app.store.get('PRAGMA journal_mode').journal_mode, 'wal');
  assert.equal(h.app.store.get('PRAGMA busy_timeout').timeout, 5000);
  const backupFile = join(h.dir, 'backup.db'); await backup(h.app.store.db, backupFile);
  const restored = new Store(backupFile);
  assert.equal(restored.get('SELECT COUNT(*) AS n FROM leaderboard_entries').n, 1);
  assert.equal(restored.get('PRAGMA integrity_check').integrity_check, 'ok');
  assert.deepEqual(restored.all('PRAGMA foreign_key_check'), []); restored.close();
  await promisify(execFile)(process.execPath, ['--experimental-sqlite', new URL('../backend/ranked-game/backup.mjs', import.meta.url).pathname, h.config.dbPath, join(h.dir, 'cli-backup.db')]);
  const cliBackup = new Store(join(h.dir, 'cli-backup.db'));
  assert.equal(cliBackup.get('SELECT COUNT(*) AS n FROM submissions').n, 1); cliBackup.close();
  await h.restart();
  assert.equal((await h.request('/session', { cookie: p.cookie })).body.player.username, 'persist_1');
  assert.deepEqual((await h.submit(p, game, 'persist_1', key)).body, result.body);
  assert.equal((await h.list()).body.pagination.total, 1);
  const active = await h.game(p, 2); await h.restart();
  assert.equal((await h.request('/games/active', { cookie: p.cookie })).body.game.id, active.id);
  assert.equal((await h.request(`/cities/arrecifes/datasets/${game.dataset_version}`)).body.length, streets.length);
});

test('errores de protocolo, límites y validación de producción', async t => {
  const h = await harness(t); const p = await h.player();
  error(await h.request('/session', { method: 'POST', raw: '{' }), 400, 'INVALID_JSON');
  error(await h.request('/session', { method: 'POST', headers: { 'Content-Type': 'text/plain' } }), 415, 'UNSUPPORTED_MEDIA_TYPE');
  error(await h.request('/session', { method: 'POST', raw: ' '.repeat(4097) }), 413, 'BODY_TOO_LARGE');
  error(await h.request('/games', { method: 'POST', cookie: p.cookie, key: 'invalid', body: { city_id: 'arrecifes', difficulty: 1 } }), 422, 'IDEMPOTENCY_KEY_REQUIRED');
  error(await h.request('/games', { method: 'POST', cookie: p.cookie, body: { city_id: 'arrecifes', difficulty: '1' } }), 422, 'INVALID_FIELD');
  error(await h.request('/games/bad-uuid', { cookie: p.cookie }), 404, 'GAME_NOT_FOUND');
  const game = await h.game(p);
  error(await h.action(p, game, 'answer', 'a'.repeat(201)), 422, 'INVALID_FIELD');
  error(await h.action(p, game, 'hint', 'unexpected'), 422, 'UNKNOWN_FIELD');
  for (let i = 0; i < 120; i++) {
    const response = await h.action(p, game, 'answer', 'wrong');
    if (response.status === 429) { assert.match(response.headers.get('retry-after'), /^\d+$/); break; }
    assert.equal(response.status, 200);
  }
  error(await h.action(p, game, 'hint'), 429, 'RATE_LIMITED');
  h.advance(60000); assert.equal((await h.action(p, game, 'hint')).status, 200);
  assert.throws(() => validateConfig({ ...h.config, host: '0.0.0.0' }), /loopback/);
  assert.throws(() => validateConfig({ ...h.config, production: true }), /loopback/);
  assert.throws(() => validateConfig({ ...h.config, development: false }), /HTTPS/);
  const secure = createApplication({ ...h.config, development: false, origin: 'https://game.example', registrations: [] });
  t.after(() => secure.close());
  await new Promise(resolve => secure.server.listen(0, '127.0.0.1', resolve));
  error(await proxyRequest(secure), 403, 'ORIGIN_FORBIDDEN'); // Untrusted forwarded header cannot downgrade TLS.
});

test('dos publicaciones HTTP simultáneas reservan exactamente un nombre y rollback del perdedor', async t => {
  const h = await harness(t); const a = await h.player(); const b = await h.player();
  const ga = await h.finish(a); const gb = await h.finish(b);
  const results = await Promise.all([h.submit(a, ga, ' Race_1 '), h.submit(b, gb, 'RACE_1')]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  error(results.find(r => r.status === 409), 409, 'USERNAME_TAKEN');
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM usernames').n, 1);
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM submissions').n, 1);
  assert.equal((await h.list()).body.pagination.total, 1);
});

async function writer(t, h) {
  const child = fork(new URL('./rankings-writer.mjs', import.meta.url), [h.config.dbPath, h.config.snapshotDir, '1700000000000'],
    { execArgv: ['--experimental-sqlite'], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  t.after(() => { if (child.connected) child.kill(); });
  await new Promise((resolve, reject) => { child.once('message', resolve); child.once('error', reject); child.once('exit', code => { if (code) reject(new Error(`Writer exited ${code}`)); }); });
  return payload => new Promise((resolve, reject) => {
    child.once('message', resolve); child.once('error', reject); child.once('exit', code => { if (code) reject(new Error(`Writer exited ${code}`)); });
    child.send({ key: randomUUID(), ...payload });
  });
}

test('escritores SQLite independientes: carrera global y mejor marca concurrente', async t => {
  const h = await harness(t); const a = await h.player(); const b = await h.player();
  const ga = await h.finish(a); const gb = await h.finish(b);
  const [w1, w2] = await Promise.all([writer(t, h), writer(t, h)]);
  const results = await Promise.all([
    w1({ playerId: a.id, body: { game_id: ga.id, username: ' Race_2 ' } }),
    w2({ playerId: b.id, body: { game_id: gb.id, username: 'RACE_2' } }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  assert.equal(results.find(r => r.status === 409).code, 'USERNAME_TAKEN');
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM submissions').n, 1);
  const p = await h.player();
  const low = await h.finish(p, { hints: true }); const high = await h.finish(p);
  const [w3, w4] = await Promise.all([writer(t, h), writer(t, h)]);
  const personal = await Promise.all([
    w3({ playerId: p.id, body: { game_id: low.id, username: 'personal_1' } }),
    w4({ playerId: p.id, body: { game_id: high.id, username: 'personal_1' } }),
  ]);
  assert.ok(personal.every(r => r.status === 201));
  assert.equal(h.app.store.get('SELECT game_id FROM leaderboard_entries WHERE player_id=?', p.id).game_id, high.id);
});

test('fallo luego de reservar nombre revierte todo; SQLITE_BUSY devuelve 503 reintentable', async t => {
  const h = await harness(t); const p = await h.player(); const game = await h.finish(p); const key = randomUUID();
  h.app.store.db.exec("CREATE TRIGGER force_failure BEFORE INSERT ON submissions BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  error(await h.submit(p, game, 'rollback_1', key), 500, 'INTERNAL_ERROR');
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM usernames').n, 0);
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM submissions').n, 0);
  assert.equal(h.app.store.get('SELECT COUNT(*) AS n FROM idempotency WHERE key=?', key).n, 0);
  h.app.store.db.exec('DROP TRIGGER force_failure');
  const other = new Store(h.config.dbPath);
  try {
    other.db.exec('BEGIN IMMEDIATE');
    const busy = await h.submit(p, game, 'rollback_1', key);
    error(busy, 503, 'RETRY_LATER'); assert.equal(busy.headers.get('retry-after'), '1');
    other.db.exec('ROLLBACK');
  } finally { other.close(); }
  assert.equal((await h.submit(p, game, 'rollback_1', key)).status, 201);
});

test('límite de creación por IP y cookie de producción solo tras proxy TLS confiable', async t => {
  const h = await harness(t);
  for (let i = 0; i < 20; i++) assert.equal((await h.request('/session', { method: 'POST' })).status, 201);
  const limited = await h.request('/session', { method: 'POST', headers: { 'X-Forwarded-For': '198.51.100.1' } });
  error(limited, 429, 'RATE_LIMITED'); assert.equal(limited.headers.get('retry-after'), '60');
  h.advance(60000); assert.equal((await h.request('/session', { method: 'POST' })).status, 201);
  const secure = createApplication({ ...h.config, development: false, trustedProxy: '127.0.0.1', origin: 'https://game.example', registrations: [] });
  t.after(() => secure.close());
  await new Promise(resolve => secure.server.listen(0, '127.0.0.1', resolve));
  error(await proxyRequest(secure, false), 403, 'ORIGIN_FORBIDDEN');
  const response = await proxyRequest(secure);
  assert.equal(response.status, 201);
  assert.match(response.headers['set-cookie'][0], /^__Host-arrecifes_session=[0-9a-f]{64}; HttpOnly; SameSite=Lax; Path=\/; Max-Age=15552000; Secure$/);
});

test('dataset real: versión hash, IDs únicos, completar fácil 15/15 por API', async t => {
  const realPath = new URL('../frontend/arrecifes_calles.json', import.meta.url);
  const bytes = await readFile(realPath); const real = JSON.parse(bytes);
  const h = await harness(t, { registrations: [{ id: 'arrecifes', name: 'Arrecifes', path: realPath }] });
  const p = await h.player(); let game = await h.game(p); const solved = new Set();
  assert.equal(game.dataset_version, digest(bytes)); assert.equal(game.progress.total, 15);
  while (game.status === 'active') {
    if (game.round.resolved) game = (await h.action(p, game, 'next')).body.game;
    assert.equal(solved.has(game.round.street_id), false); solved.add(game.round.street_id);
    const street = real.find(item => streetId(item) === game.round.street_id);
    const answer = await h.action(p, game, 'answer', street.nombre);
    assert.equal(answer.status, 200, JSON.stringify(answer.body)); game = answer.body.game;
  }
  assert.equal(solved.size, 15); assert.equal(game.score, 150);
  const publication = await h.submit(p, game, 'real_test'); assert.equal(publication.status, 201);
  assert.equal((await h.list()).body.items[0].score, 150);
});

test('registro administrativo rechaza IDs duplicados y snapshots modificados', async t => {
  const h = await harness(t);
  await writeFile(h.config.registrations[0].path, JSON.stringify([...streets, streets[0]]));
  assert.throws(() => createApplication(h.config), /Duplicate street ID/);
  const snapshot = h.app.store.get('SELECT immutable_path FROM datasets LIMIT 1').immutable_path;
  await writeFile(snapshot, '[]');
  assert.throws(() => createApplication({ ...h.config, registrations: [] }), /checksum mismatch/);
});

test('ejecutable: persistencia tras SIGTERM y frontend de producción explícito', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'rankings-process-'));
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  let child;
  async function start(overrides = {}) {
    child = fork(new URL('../backend/ranked-game/server.mjs', import.meta.url), [], { silent: true, execArgv: ['--experimental-sqlite'],
      env: {
        ...process.env, NODE_ENV: 'test', RANKINGS_DEVELOPMENT: '1', RANKINGS_SERVE_FRONTEND: '0',
        RANKINGS_HOST: '127.0.0.1', RANKINGS_PORT: String(port), RANKINGS_ORIGIN: origin,
        RANKINGS_DB: join(dir, 'state.db'), ...overrides,
      } });
    await new Promise((resolve, reject) => {
      let output = '';
      child.stdout.on('data', chunk => { output += chunk; if (output.includes('listening on')) resolve(); });
      child.once('error', reject); child.once('exit', code => reject(new Error(`API exited before ready: ${code}`)));
    });
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM'); assert.equal(await exited, 0);
  }
  t.after(async () => { await stop(); await rm(dir, { recursive: true }); });
  await start();
  let cookie;
  async function request(path, body, key = randomUUID()) {
    const response = await fetch(origin + '/api/v1' + path, { method: body ? 'POST' : 'GET', headers: {
      Connection: 'close', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: origin, 'Content-Type': 'application/json', 'Idempotency-Key': key } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, body: await response.json() };
  }
  const player = await request('/session', {}); assert.equal(player.status, 201);
  let game = (await request('/games', { city_id: 'arrecifes', difficulty: 1 })).body;
  await stop(); await start();
  assert.equal((await request('/session')).body.player.id, player.body.player.id);
  assert.equal((await request('/games/active')).body.game.id, game.id);
  const real = JSON.parse(await readFile(new URL('../frontend/arrecifes_calles.json', import.meta.url)));
  while (game.status === 'active') {
    if (game.round.resolved) game = (await request(`/games/${game.id}/actions`, { round_id: game.round.id, type: 'next' })).body.game;
    const answer = real.find(item => streetId(item) === game.round.street_id).nombre;
    const response = await request(`/games/${game.id}/actions`, { round_id: game.round.id, type: 'answer', answer });
    assert.equal(response.status, 200, JSON.stringify(response.body)); game = response.body.game;
  }
  const body = { game_id: game.id, username: 'process_1' }; const key = randomUUID();
  const publication = await request('/rankings/submissions', body, key); assert.equal(publication.status, 201);
  await stop(); await start();
  assert.deepEqual(await request('/rankings/submissions', body, key), publication);
  assert.equal((await request('/rankings?city_id=arrecifes&difficulty=1')).body.items[0].score, 150);
  const production = { NODE_ENV: 'production', RANKINGS_DEVELOPMENT: '0', RANKINGS_ORIGIN: 'https://game.example' };
  await stop(); await start(production);
  assert.equal((await fetch(origin + '/play.html')).status, 404);
  await stop(); await start({ ...production, RANKINGS_SERVE_FRONTEND: '1' });
  assert.equal((await fetch(origin + '/play.html')).status, 200);
  error(await request('/catalog'), 403, 'ORIGIN_FORBIDDEN');
});
