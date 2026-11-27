import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, lstat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assets = ['app.mjs', 'arrecifes_calles.json', 'game.mjs', 'index.html', 'play.html', 'ranked-game-client.mjs', 'rankings-ui.mjs', 'styles.css'];

test('layout separates browser assets, services and canonical data without duplicate sources', async () => {
  assert.deepEqual((await readdir(new URL('frontend/', root))).sort(), assets);
  for (const name of [...assets, 'serve_static.py', 'ranked-game', 'rankings']) {
    await assert.rejects(lstat(new URL(name, root)), { code: 'ENOENT' });
  }
  assert.equal((await lstat(new URL('frontend/arrecifes_calles.json', root))).isSymbolicLink(), false);
  const publicData = await read('frontend/arrecifes_calles.json');
  assert.deepEqual(publicData, await read('data/arrecifes/calles.json'));
  assert.equal(hash(publicData), 'ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e');
  assert.equal(hash(await read('backend/ranked-game/migrations/001-rankings.sql')), '2c68d64918ddd216258ffae54a1f5c905da34b603e1e3ed27b7f21d5ce43d8b6');
  for (const path of ['backend/ranked-game/catalog.mjs', 'backend/ranked-game/service.mjs']) {
    assert.match((await read(path)).toString(), /from '\.\.\/\.\.\/frontend\/game\.mjs'/);
  }
  assert.equal(JSON.parse(await read('package.json')).scripts['start:rankings'], 'node --experimental-sqlite backend/ranked-game/server.mjs');
});

test('image context and copies allow only frontend assets and backend runtime files', async () => {
  const runtime = {
    'frontend/': assets,
    'backend/ranked-game/': ['backup.mjs', 'catalog.mjs', 'database.mjs', 'errors.mjs', 'http.mjs', 'identity.mjs', 'server.mjs', 'service.mjs'],
    'backend/ranked-game/migrations/': ['001-rankings.sql'],
    'backend/rankings/': ['service.mjs', 'validation.mjs'],
  };
  const dockerfile = (await read('Dockerfile')).toString();
  const copies = [...dockerfile.matchAll(/^COPY (.+) (\S+)$/gm)];
  assert.deepEqual(
    Object.fromEntries(copies.map(([, sources, target]) => [target, sources.split(' ').sort()])),
    Object.fromEntries(Object.entries(runtime).map(([target, files]) => [target, files.map(file => target + file)])),
  );
  const [deny, ...allow] = (await read('.dockerignore')).toString().split('\n').filter(line => line && !line.startsWith('#'));
  assert.equal(deny, '**');
  assert.equal(new Set(allow).size, allow.length);
  assert.deepEqual(allow.sort(), [
    '!Dockerfile', '!backend/',
    ...Object.entries(runtime).flatMap(([target, files]) => [
      `!${target}`, ...files.map(file => `!${target}${file}`),
    ]),
  ].sort());
});
