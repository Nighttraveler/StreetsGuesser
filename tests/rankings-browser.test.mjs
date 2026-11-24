import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { streetId } from '../frontend/game.mjs';

// Explicit synthetic API fixtures for UI testing, not a scoring server or production fallback.
const root = new URL('../frontend/', import.meta.url);
const data = JSON.parse(await readFile(new URL('arrecifes_calles.json', root)));
const gameId = '00000000-0000-4000-8000-000000000010';
const roundId = '00000000-0000-4000-8000-000000000011';
const version = 'a'.repeat(64);
const catalog = { cities: ['arrecifes', 'fixture-city'].map(id => ({ id, name: id, difficulties: [1, 2, 3].map(id => ({ id, name: `Nivel ${id}` })) })) };
const player = { id: '00000000-0000-4000-8000-000000000001', username: null };
function fixtureGame(status = 'active', difficulty = 1) {
  return { id: gameId, city_id: 'arrecifes', difficulty, dataset_version: version, rules_version: '1', status, score: status === 'completed' ? 10 : 0, streak: 0, progress: { correct: status === 'completed' ? 1 : 0, total: 1 }, revision: status === 'completed' ? 1 : 0, completed_at: status === 'completed' ? '2026-11-23T16:00:00.000Z' : null, eligible_for_ranking: status === 'completed', round: { id: roundId, street_id: streetId(data.find(s => s.nivel === difficulty)), hinted: false, resolved: status === 'completed', hint_text: null, revealed_name: status === 'completed' ? 'Fixture correcta' : null } };
}
function board(city = 'arrecifes', difficulty = 1, items = []) {
  return { city_id: city, difficulty, dataset_version: version, rules_version: '1', items, pagination: { limit: 20, offset: 0, total: items.length, has_more: false } };
}
const failure = (code, message = code) => ({ error: { code, message, field: null, retryable: false } });
let browser, server, origin;
before(async () => {
  const allowed = new Set(['index.html', 'play.html', 'app.mjs', 'game.mjs', 'styles.css', 'rankings-ui.mjs', 'ranked-game-client.mjs', 'arrecifes_calles.json']);
  server = createServer(async (req, res) => {
    const name = req.url === '/' ? 'index.html' : req.url.slice(1);
    if (!allowed.has(name)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', name.endsWith('.mjs') ? 'text/javascript' : name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'application/json');
    res.end(await readFile(new URL(name, root)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); });
async function setup(handler = () => undefined, options = {}) {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (await handler(route, path)) return;
    const defaults = { '/catalog': catalog, '/session': { player }, '/games': fixtureGame(), '/games/active': { game: fixtureGame() }, [`/games/${gameId}`]: fixtureGame('completed'), [`/cities/arrecifes/datasets/${version}`]: data, [`/games/${gameId}/actions`]: { outcome: 'correct', game: fixtureGame('completed') } };
    await route.fulfill({ json: path === '/rankings' ? board() : defaults[path] || failure('NOT_FOUND'), status: path === '/games' ? 201 : 200 });
  });
  await page.goto(`${origin}/play.html`);
  await page.locator('#answer:enabled').waitFor();
  return { page, context, errors };
}
async function start(page) { await page.locator('#catalog-load').click(); await page.locator('#rank-start:enabled').click(); await page.locator('#ranked-status').filter({ hasText: 'Modo clasificado' }).waitFor(); }
async function complete(page) { await start(page); await page.locator('#answer').fill('fixture answer'); await page.locator('#submit').click(); await page.locator('#publication:visible').waitFor(); }

test('classified form: occupied name, consent, duplicate lock, timeout stable key and confirmed canonical success', async () => {
  const requests = [];
  let release;
  const { page, context, errors } = await setup(async (route, path) => {
    if (path !== '/rankings/submissions') return false;
    requests.push({ body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'] });
    if (requests.length === 1) { await route.fulfill({ status: 409, json: failure('USERNAME_TAKEN') }); return true; }
    if (requests.length === 2) { await route.abort('connectionfailed'); return true; }
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ status: 201, json: { submission: { game_id: gameId, username: 'ana_7', city_id: 'arrecifes', difficulty: 1, score: 10, completed_at: '2026-11-23T16:00:00.000Z' }, best: { game_id: gameId, score: 10, completed_at: '2026-11-23T16:00:00.000Z' }, improved: true, already_submitted: false } });
    return true;
  }, { viewport: { width: 375, height: 812 } });
  try {
    assert.ok(await page.locator('#publication').isHidden());
    await complete(page);
    assert.equal(await page.locator('#score').innerText(), '10');
    await page.locator('#username').fill('taken');
    await page.locator('#publish-consent').check();
    await page.locator('#publish').click();
    await page.locator('#publication-status').filter({ hasText: 'ocupado' }).waitFor();
    await page.locator('#username').fill(' Ana_7 ');
    await page.locator('#publish').click();
    await page.locator('#publication-status').filter({ hasText: 'No se pudo conectar' }).waitFor();
    await page.locator('#publish').click();
    await page.locator('#publication-status').filter({ hasText: 'Enviando' }).waitFor();
    await page.locator('#publication-form').dispatchEvent('submit');
    assert.equal(requests.length, 3);
    assert.ok(await page.locator('#publish').isDisabled());
    assert.equal(requests[1].key, requests[2].key);
    assert.notEqual(requests[0].key, requests[1].key);
    assert.deepEqual(requests[2].body, { game_id: gameId, username: ' Ana_7 ' });
    release();
    await page.locator('#publication-status').filter({ hasText: 'Resultado publicado como ana_7' }).waitFor();
    assert.ok(await page.locator('#username').getAttribute('readonly') !== null);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
  } finally { release?.(); await context.close(); }
});

test('public boards: loading/empty/error, late city response ignored and textContent escapes names', async () => {
  let late, failed = false;
  const { page, context, errors } = await setup(async (route, path) => {
    if (path !== '/rankings') return false;
    const url = new URL(route.request().url());
    if (url.searchParams.get('city_id') === 'arrecifes') {
      await new Promise(resolve => { late = resolve; });
      await route.fulfill({ json: board('arrecifes', 1, [{ position: 1, username: 'old', score: 10, completed_at: '2026-11-23T16:00:00.000Z' }]) });
    } else if (url.searchParams.get('difficulty') === '2' && !failed) {
      failed = true; await route.fulfill({ status: 503, json: { error: { code: 'RETRY_LATER', message: 'Reintentá.', field: null, retryable: true } } });
    } else {
      await route.fulfill({ json: board('fixture-city', 1, url.searchParams.get('difficulty') === '3' ? [{ position: 1, username: '<img src=x onerror=alert(1)>', score: 5, completed_at: '2026-11-23T16:00:00.000Z' }] : []) });
    }
    return true;
  });
  try {
    await page.locator('#catalog-load').click();
    await page.locator('#ranking-status').filter({ hasText: 'Cargando' }).waitFor();
    await page.locator('#rank-city').selectOption('fixture-city');
    await page.locator('#ranking-status').filter({ hasText: 'Todavía no hay' }).waitFor();
    late();
    await page.locator('#rank-difficulty').selectOption('2');
    await page.locator('#ranking-status').filter({ hasText: 'No se pudo cargar' }).waitFor();
    await page.locator('#rank-refresh').click();
    await page.locator('#ranking-status').filter({ hasText: 'Todavía no hay' }).waitFor();
    await page.locator('#rank-difficulty').selectOption('3');
    await page.locator('#ranking-list li').waitFor();
    assert.match(await page.locator('#ranking-list').innerText(), /<img/);
    assert.equal(await page.locator('#ranking-list img').count(), 0);
    assert.doesNotMatch(await page.locator('#ranking-list').innerText(), /old/);
    assert.deepEqual(errors, []);
  } finally { late?.(); await context.close(); }
});

test('lost session blocks submission without creating a replacement identity', async () => {
  let sessions = 0;
  const { page, context } = await setup(async (route, path) => {
    if (path === '/session') sessions++;
    if (path !== '/rankings/submissions') return false;
    await route.fulfill({ status: 401, json: failure('SESSION_REQUIRED') }); return true;
  });
  try {
    await complete(page);
    await page.locator('#username').fill('ana');
    await page.locator('#publish-consent').check();
    await page.locator('#publish').click();
    await page.locator('#publication-status').filter({ hasText: 'La sesión venció' }).waitFor();
    assert.ok(await page.locator('#publish').isDisabled());
    assert.equal(sessions, 1);
  } finally { await context.close(); }
});

test('reload recovery uses cookie and server snapshot; practice never publishes', async () => {
  const { page, context } = await setup();
  try {
    await complete(page);
    await page.reload();
    await page.locator('#catalog-load').click();
    await page.locator('#rank-start:enabled').click();
    await page.locator('#ranked-status').filter({ hasText: 'Modo clasificado' }).waitFor();
    assert.equal(await page.locator('#progress').innerText(), '0/1');
    await page.locator('#practice').click();
    assert.equal(await page.locator('#score').innerText(), '0');
    assert.equal(await page.locator('#progress').innerText(), '0/15');
    assert.ok(await page.locator('#publication').isHidden());
  } finally { await context.close(); }
});

test('action retry preserves key; difficulty change confirms abandon and starts zero', async () => {
  const actions = [], starts = [], abandon = [];
  const { page, context } = await setup(async (route, path) => {
    if (path === '/games') {
      starts.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: fixtureGame('active', starts.at(-1).difficulty) }); return true;
    }
    if (path.endsWith('/actions')) {
      actions.push(route.request().headers()['idempotency-key']);
      if (actions.length === 1) await route.abort('connectionfailed');
      else await route.fulfill({ json: { outcome: 'correct', game: fixtureGame('completed') } });
      return true;
    }
    if (path.endsWith('/abandon')) {
      abandon.push(route.request().postDataJSON());
      await route.fulfill({ json: fixtureGame('abandoned') }); return true;
    }
    return false;
  });
  try {
    await start(page);
    await page.locator('#answer').fill('fixture');
    await page.locator('#submit').click();
    await page.locator('#ranked-retry:visible').waitFor();
    assert.equal(await page.locator('#score').innerText(), '0');
    await page.locator('#ranked-retry').click();
    await page.locator('#publication:visible').waitFor();
    assert.equal(actions[0], actions[1]);
    await page.locator('#rank-difficulty').selectOption('2');
    await page.locator('#rank-start').click();
    await page.locator('#ranked-status').filter({ hasText: 'dificultad 2' }).waitFor();
    assert.equal(await page.locator('#score').innerText(), '0');
    assert.match(await page.locator('#publication-result').innerText(), /dificultad 1/);
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#level').selectOption('3');
    assert.equal(abandon.length, 0);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#level').selectOption('3');
    await page.locator('#ranked-status').filter({ hasText: 'dificultad 3' }).waitFor();
    assert.deepEqual(abandon, [{}]);
    assert.deepEqual(starts.map(value => value.difficulty), [1, 2, 3]);
    assert.equal(await page.locator('#score').innerText(), '0');
  } finally { await context.close(); }
});

test('locked name reloads session; retired board stops repeated publication', async () => {
  let sessions = 0, submissions = 0;
  const { page, context } = await setup(async (route, path) => {
    if (path === '/session') {
      sessions++;
      await route.fulfill({ json: { player: { ...player, username: sessions === 1 ? null : 'owned_name' } } }); return true;
    }
    if (path === '/rankings/submissions') {
      submissions++;
      await route.fulfill({ status: 409, json: failure(submissions === 1 ? 'USERNAME_LOCKED' : 'BOARD_VERSION_CHANGED') }); return true;
    }
    return false;
  });
  try {
    await complete(page);
    await page.locator('#username').fill('new_name');
    await page.locator('#publish-consent').check();
    await page.locator('#publish').click();
    await page.locator('#username[readonly]').waitFor();
    assert.equal(await page.locator('#username').inputValue(), 'owned_name');
    await page.locator('#publish').click();
    await page.locator('#publication-status').filter({ hasText: 'cambió de versión' }).waitFor();
    assert.ok(await page.locator('#publish').isDisabled());
  } finally { await context.close(); }
});

test('API failure is honest and practice remains playable without publication', async () => {
  const { page, context } = await setup(async route => {
    await route.fulfill({ status: 503, json: { error: { code: 'RETRY_LATER', message: 'Servicio no disponible.', field: null, retryable: true } } }); return true;
  });
  try {
    await page.locator('#catalog-load').click();
    await page.locator('#catalog-status').filter({ hasText: 'Clasificado no disponible' }).waitFor();
    await page.locator('#answer').fill('wrong');
    await page.locator('#submit').click();
    assert.match(await page.locator('#feedback').innerText(), /Todavía no/);
    assert.ok(await page.locator('#publication').isHidden());
    assert.ok(await page.locator('#rank-start').isDisabled());
  } finally { await context.close(); }
});
