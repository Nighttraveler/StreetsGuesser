import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
test('home document has a native game link and no game runtime or controls', async () => {
  const home = await readFile(new URL('index.html', root), 'utf8');
  assert.match(home, /<a\b[^>]*href="\.\/play\.html"[^>]*>Jugar<\/a>/);
  assert.doesNotMatch(home, /<script\b|<svg\b|id="answer-form"|app\.mjs|game\.mjs|rankings-ui\.mjs|arrecifes_calles\.json/i);
});
test('dashboard landing has semantic guidance and no fabricated performance counters', async () => {
  const home = await readFile(new URL('index.html', root), 'utf8');
  assert.match(home, /class="dashboard"/);
  assert.equal(home.match(/<h1\b/g)?.length, 1);
  for (const id of ['contenido', 'como-jugar', 'modos', 'datos']) assert.match(home, new RegExp(`id="${id}"`));
  assert.match(home, /<ol\b/);
  assert.match(home, /Esquema ilustrativo/);
  assert.match(home, /cuando el servidor/);
  assert.doesNotMatch(home, /\b\d[\d.,]*\s*(?:%|jugadores|partidas|calles)\b/i);
});
test('dedicated game keeps relative assets, complete controls and home navigation', async () => {
  const game = await readFile(new URL('play.html', root), 'utf8');
  assert.match(game, /<script type="module" src="\.\/app\.mjs"><\/script>/);
  assert.match(game, /href="\.\/index\.html">Volver a la portada/);
  for (const id of ['map', 'answer-form', 'level', 'rank-city', 'publication-form', 'cities-list']) {
    assert.equal(game.match(new RegExp(`id="${id}"`, 'g'))?.length, 1, id);
  }
});
