import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { chromium } from 'playwright';

const origin = new URL(process.env.COMPOSE_SMOKE_ORIGIN || 'http://127.0.0.1:18090').origin;
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/, 'el smoke solo acepta un puerto HTTP loopback');
const root = new URL('../frontend/', import.meta.url);
const files = new Map([
  ['play.html', 'text/html'],
  ['index.html', 'text/html'], ['styles.css', 'text/css'], ['app.mjs', 'text/javascript'],
  ['game.mjs', 'text/javascript'], ['arrecifes_calles.json', 'application/json'],
  ['rankings-ui.mjs', 'text/javascript'], ['ranked-game-client.mjs', 'text/javascript'],
]);
const datasetHash = 'ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e';
const get = path => fetch(`${origin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(5000) });

for (const [path, file, mime] of [['/', 'index.html', 'text/html'],
  ...Array.from(files, ([file, mime]) => [`/${file}`, file, mime])]) {
  test(`Compose HTTP 200: ${path}, ${mime}, contenido intacto`, async () => {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type')?.split(';')[0], mime);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    const body = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(body, await readFile(new URL(file, root)));
    if (file === 'arrecifes_calles.json') {
      assert.equal(createHash('sha256').update(body).digest('hex'), datasetHash);
    }
  });
}

test('Compose HTTP 404: rutas privadas, directorios, página de ejemplo y rutas inexistentes', async () => {
  for (const path of ['/package.json', '/.env', '/.env.example', '/.git/config', '/node_modules/',
    '/arrecifes_source.json', '/serve_static.py', '/tests/', '/no-existe',
    '/backend/ranked-game/server.mjs', '/backend/ranked-game/migrations/001-rankings.sql',
    '/state/rankings.sqlite', '/state/rankings.sqlite-wal', '/state/rankings.sqlite.datasets/']) {
    const response = await get(path);
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /Index of|<svg/i, path);
  }
});

test('Compose HTTP HEAD: MIME y longitud correctos, sin cuerpo', async () => {
  const response = await fetch(`${origin}/app.mjs`, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type')?.split(';')[0], 'text/javascript');
  assert.equal(Number(response.headers.get('content-length')), (await readFile(new URL('app.mjs', root))).length);
  assert.equal(await response.text(), '');
});

test('Compose Chromium: módulos reales, práctica, partida clasificada y publicación sin peticiones externas', async () => {
  const data = JSON.parse(await readFile(new URL('arrecifes_calles.json', root), 'utf8'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    context.setDefaultTimeout(8000);
    const errors = [], external = [], served = new Set();
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      external.push(url.href);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      errors.push(message.text());
    });
    page.on('response', response => {
      if (response.ok()) served.add(new URL(response.url()).pathname);
    });
    await page.addInitScript(() => { Math.random = () => 0; });
    assert.equal((await page.goto(origin)).status(), 200);
    assert.equal(await page.locator('#map, script').count(), 0);
    await page.getByRole('link', { name: 'Jugar', exact: true }).click();
    await page.locator('#answer:enabled').waitFor();
    await page.goto(`${origin}/play.html`);
    await page.locator('#answer:enabled').waitFor();
    await page.reload();
    await page.locator('#answer:enabled').waitFor();
    assert.equal(await page.locator('#map path').count(), 407);
    assert.match(await page.locator('.map-foot').innerText(), /OpenStreetMap contributors/);
    for (const level of [1, 2, 3]) {
      await page.locator('#level').selectOption(String(level));
      const index = await page.locator('g:has(path.active)').getAttribute('data-street-index');
      assert.notEqual(index, null);
      const street = data[Number(index)];
      assert.equal(street.nivel, level);
      assert.equal(await page.locator('path.active').count(), street.segmentos.length);
      assert.equal(await page.locator('#score').innerText(), '0');
      await page.locator('#answer').fill(street.nombre);
      await page.locator('#answer').press('Enter');
      assert.equal(await page.locator('#score').innerText(), '10');
      assert.ok(await page.locator('#next').isVisible());
    }
    await page.locator('#catalog-load').click();
    await page.locator('#rank-start:enabled').click();
    await page.locator('#ranked-status').filter({ hasText: 'Modo clasificado' }).waitFor();
    assert.equal(await page.locator('#progress').innerText(), '0/15');
    for (let round = 1; round <= 15; round++) {
      await page.locator('#answer:enabled').waitFor();
      const index = Number(await page.locator('g:has(path.active)').getAttribute('data-street-index'));
      await page.locator('#answer').fill(data[index].nombre);
      await page.locator('#submit').click();
      await page.locator('#progress').filter({ hasText: new RegExp(`^${round}/15$`) }).waitFor();
      if (round < 15) await page.locator('#next:enabled').click();
    }
    await page.locator('#publication:visible').waitFor();
    assert.equal(await page.locator('#score').innerText(), '150');
    await page.locator('#username').fill('compose_jugador');
    await page.locator('#publish-consent').check();
    await page.locator('#publish').click();
    await page.locator('#publication-status').filter({ hasText: 'Resultado publicado como compose_jugador' }).waitFor();
    await page.locator('#ranking-list li').filter({ hasText: 'compose_jugador · 150' }).waitFor();
    await page.locator('#rank-difficulty').selectOption('2');
    await page.locator('#ranking-status').filter({ hasText: 'Todavía no hay' }).waitFor();
    const cookie = (await context.cookies()).find(item => item.name === 'arrecifes_session');
    assert.ok(cookie?.httpOnly);
    assert.equal(cookie.sameSite, 'Lax');
    if (process.env.COMPOSE_SMOKE_COOKIE_FILE) {
      await writeFile(process.env.COMPOSE_SMOKE_COOKIE_FILE, `${cookie.name}=${cookie.value}`, { mode: 0o600 });
    }

    for (const file of ['rankings-ui.mjs', 'ranked-game-client.mjs', 'styles.css', 'app.mjs', 'game.mjs', 'arrecifes_calles.json']) {
      assert.ok(served.has(`/${file}`), `el navegador no obtuvo ${file}`);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(`Chromium ${browser.version()}, origen ${origin}`);
  } finally {
    await browser.close();
  }
});

test('Compose API rechaza Host inesperado y mutaciones desde un origen distinto', async () => {
  const status = await new Promise((resolve, reject) => {
    const invalidHost = request(`${origin}/api/v1/catalog`, { headers: { Host: 'otro.local' } }, response => {
      response.resume();
      resolve(response.statusCode);
    });
    invalidHost.setTimeout(5000, () => invalidHost.destroy(new Error('Tiempo de espera agotado')));
    invalidHost.on('error', reject).end();
  });
  assert.equal(status, 403);

  const result = await fetch(`${origin}/api/v1/session`, {
    method: 'POST',
    headers: { Origin: 'http://otro.local', 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(result.status, 403);
  assert.equal((await result.json()).error.code, 'ORIGIN_FORBIDDEN');
  assert.equal(result.headers.get('set-cookie'), null);
});
