import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { createApplication } from '../ranked-game/http.mjs';

const root = new URL('../', import.meta.url);
let app, browser, temporary, origin, catalog;
before(async () => {
  temporary = await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'city-home-'));
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  // Explicit second-city fixture registration, never a runtime city fallback.
  app = createApplication({ development: true, host: '127.0.0.1', origin,
    dbPath: join(temporary, 'test.sqlite'), snapshotDir: join(temporary, 'snapshots'), staticRoot: root,
    registrations: [{ id: 'arrecifes', name: 'Arrecifes' }, { id: 'fixture-city', name: 'Ciudad de prueba Ñ' }]
      .map(city => ({ ...city, path: new URL('arrecifes_calles.json', root) })),
  });
  await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
  catalog = await (await fetch(`${origin}/api/v1/catalog`)).json();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); await app?.close(); await rm(temporary, { recursive: true, force: true }); });

async function open(viewport = { width: 1280, height: 1000 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request));
  return { page, context, errors, requests };
}

test('home and index use real catalog, same selector, read-only visit and responsive layout', async () => {
  for (const viewport of [{ width: 375, height: 812 }, { width: 1280, height: 1000 }]) {
    const { page, context, errors, requests } = await open(viewport);
    try {
      for (const path of ['/', '/index.html']) {
        requests.length = 0;
        await page.goto(`${origin}${path}`);
        await page.locator('#cities-list:visible').waitFor();
        assert.deepEqual(await page.locator('#cities-list li').allTextContents(), catalog.cities.map(city => city.name));
        assert.deepEqual(await page.locator('#rank-city option').allTextContents(), catalog.cities.map(city => city.name));
        assert.equal(requests.filter(request => request.url().endsWith('/api/v1/catalog')).length, 1);
        assert.equal(requests.filter(request => request.method() !== 'GET').length, 0);
        assert.deepEqual(await context.cookies(), []);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const home = await page.locator('.city-home').boundingBox(), game = await page.locator('.game').boundingBox();
        assert.ok(home.y + home.height <= game.y);
      }
      const screenshot = join(process.env.TMPDIR || tmpdir(), `city-home-${viewport.width}.png`);
      await page.screenshot({ path: screenshot });
      console.log(`Screenshot: ${screenshot}`);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('loading, empty, HTTP/network/malformed errors, no stale list and retry shared with rankings', async () => {
  const { page, context, errors, requests } = await open();
  let release, mode = 'pending';
  try {
    await page.route('**/api/v1/catalog', async route => {
      if (mode === 'pending') await new Promise(resolve => { release = resolve; });
      if (mode === 'http') return route.fulfill({ status: 503, json: { error: { message: 'Fixture failure' } } });
      if (mode === 'network') return route.abort('connectionfailed');
      return route.fulfill({ json: mode === 'empty' ? { cities: [] } : mode === 'malformed' ? { cities: null } : catalog });
    });
    await page.goto(origin);
    await page.locator('#answer:enabled').waitFor();
    assert.match(await page.locator('#cities-status').innerText(), /Cargando ciudades/);
    assert.equal(await page.locator('#cities-list').getAttribute('aria-busy'), 'true');
    assert.ok(await page.locator('#cities-retry').isDisabled());
    assert.ok(await page.locator('#catalog-load').isDisabled());
    await page.locator('#cities-retry').dispatchEvent('click');
    assert.equal(requests.filter(request => request.url().endsWith('/catalog')).length, 1);
    mode = 'empty'; release();
    await page.locator('#cities-status').filter({ hasText: 'No hay ciudades disponibles' }).waitFor();
    assert.equal(await page.locator('#cities-list li').count(), 0);
    for (const failure of ['http', 'network', 'malformed']) {
      mode = 'success';
      await page.locator('#cities-retry').click();
      await page.locator('#cities-list:visible').waitFor();
      mode = failure;
      await page.locator('#catalog-load').click();
      await page.locator('#cities-status').filter({ hasText: 'No se pudieron cargar' }).waitFor();
      assert.doesNotMatch(await page.locator('#cities-status').innerText(), /No hay ciudades/);
      assert.equal(await page.locator('#cities-list li').count(), 0);
      assert.ok(await page.locator('#rank-start').isDisabled());
      assert.ok(await page.locator('#rank-city').isDisabled());
      assert.equal(await page.locator('#rank-city option').count(), 0);
    }
    mode = 'success';
    await page.locator('#cities-retry').focus();
    await page.keyboard.press('Enter');
    await page.locator('#cities-list:visible').waitFor();
    assert.deepEqual(await page.locator('#cities-list li').allTextContents(), catalog.cities.map(city => city.name));
    assert.equal(await page.locator('#cities-list').getAttribute('aria-busy'), 'false');
    assert.deepEqual(errors, []);
  } finally { release?.(); await context.close(); }
});

test('long names and HTML are complete inert text on mobile and desktop', async () => {
  for (const width of [375, 1280]) {
    const { page, context, errors } = await open({ width, height: 900 });
    const names = ['<img src=x onerror="window.cityXss=true">', 'Ciudad' + 'larguísima'.repeat(30)];
    try {
      await page.route('**/api/v1/catalog', route => route.fulfill({ json: {
        cities: catalog.cities.map((city, index) => ({ ...city, name: names[index] })),
      } }));
      await page.goto(origin);
      await page.locator('#cities-list:visible').waitFor();
      assert.deepEqual(await page.locator('#cities-list li').allTextContents(), names);
      assert.equal(await page.locator('#cities-list img').count(), 0);
      assert.equal(await page.evaluate(() => window.cityXss), undefined);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await page.locator('#cities-list li').evaluateAll(rows => rows.every(row => row.scrollWidth <= row.clientWidth)));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});
