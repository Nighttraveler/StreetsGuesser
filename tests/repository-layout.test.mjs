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

test('image context permits exactly the six practice sources and Python launcher', async () => {
  const practice = assets.filter(name => !['ranked-game-client.mjs', 'rankings-ui.mjs'].includes(name));
  const dockerfile = (await read('Dockerfile')).toString();
  const copies = [...dockerfile.matchAll(/^COPY (.+) (\S+)$/gm)];
  assert.equal(copies.length, 2);
  assert.equal(copies[0][2], '/srv/arrecifes/public/');
  assert.deepEqual(copies[0][1].split(' ').sort(), practice.map(name => `frontend/${name}`));
  assert.equal(copies[1][1], 'backend/serve_static.py');
  assert.equal(copies[1][2], '/srv/arrecifes/serve_static.py');
  const ignore = (await read('.dockerignore')).toString().split('\n').filter(line => line && !line.startsWith('#'));
  assert.deepEqual(ignore, ['**', '!Dockerfile', '!frontend/', ...practice.map(name => `!frontend/${name}`), '!backend/', '!backend/serve_static.py']);
});
