import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { createApplication } from '../ranked-game/http.mjs';

const root = new URL('../', import.meta.url);
const screenshots = new URL('test-results/', root);
let app, browser, temporary, origin, catalog;
before(async () => {
  temporary = await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'city-home-'));
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  // Explicit fixture registrations, never a runtime city fallback.
  app = createApplication({ development: true, host: '127.0.0.1', origin,
    dbPath: join(temporary, 'test.sqlite'), snapshotDir: join(temporary, 'snapshots'), staticRoot: root,
    registrations: [{ id: 'arrecifes', name: 'Arrecifes' }, { id: 'fixture-city', name: 'Ciudad de prueba Ñ' }, { id: 'san-nicolas', name: 'San Nicolás' }]
      .map(city => ({ ...city, path: new URL('arrecifes_calles.json', root) })),
  });
  await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
  catalog = await (await fetch(`${origin}/api/v1/catalog`)).json();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); await app?.close(); await rm(temporary, { recursive: true, force: true }); });

async function open(viewport = { width: 1280, height: 1000 }) {
  const mobile = viewport.width < 760;
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request));
  return { page, context, errors, requests };
}

test('home is isolated; keyboard navigation, direct game entry, reload and return work', async () => {
  const { page, context, errors, requests } = await open();
  try {
    for (const path of ['/', '/index.html']) {
      requests.length = 0;
      assert.equal((await page.goto(`${origin}${path}`)).status(), 200);
      assert.equal(await page.locator('#map, #answer-form, script').count(), 0);
      assert.ok(requests.every(request => ['/', '/index.html', '/styles.css'].includes(new URL(request.url()).pathname)));
      await page.getByRole('link', { name: 'Jugar', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.locator('#answer:enabled').waitFor();
      assert.equal(new URL(page.url()).pathname, '/play.html');
      await page.reload();
      await page.locator('#answer:enabled').waitFor();
      await page.getByRole('link', { name: 'Volver a la portada' }).click();
      assert.equal(await page.locator('#map, script').count(), 0);
    }
    assert.equal((await page.goto(`${origin}/play.html?direct=1`)).status(), 200);
    await page.locator('#answer:enabled').waitFor();
    const head = await fetch(`${origin}/play.html`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await fetch(`${origin}/not-a-route`)).status, 404);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('game uses real catalog, same selector, read-only visit and responsive layout', async () => {
  for (const viewport of [{ width: 375, height: 812 }, { width: 1280, height: 1000 }]) {
    const { page, context, errors, requests } = await open(viewport);
    try {
      for (const path of ['/play.html', '/play.html?catalog=1']) {
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
      await mkdir(screenshots, { recursive: true });
      const screenshot = new URL(`city-home-${viewport.width}.png`, screenshots).pathname;
      await page.screenshot({ path: screenshot });
      console.log(`Screenshot: ${screenshot}`);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('every city is reachable by keyboard or touch and selects its stable ID without starting a game', async () => {
  for (const width of [375, 1280]) {
    const { page, context, errors, requests } = await open({ width, height: 900 });
    try {
      await page.goto(`${origin}/play.html`);
      const list = page.getByRole('list', { name: 'Ciudades disponibles', exact: true });
      const cards = list.getByRole('button');
      await cards.first().waitFor({ timeout: 5000 });
      assert.equal(await cards.count(), catalog.cities.length);
      if (width === 1280) {
        await page.getByRole('link', { name: 'Volver a la portada' }).focus();
        await page.keyboard.press('Tab');
        for (const card of await cards.all()) {
          assert.ok(await card.evaluate(button => button.matches(':focus-visible') && getComputedStyle(button).outlineStyle !== 'none'));
          await page.keyboard.press('Tab');
        }
      }
      // Start with a non-default city so the first activation must change the selector.
      for (const city of [...catalog.cities].reverse()) {
        const card = list.getByRole('button', { name: city.name, exact: true });
        assert.equal(await card.getAttribute('data-city-id'), city.id);
        assert.ok((await card.boundingBox()).height >= 44);
        const ranking = page.waitForResponse(response => {
          const url = new URL(response.url());
          return url.pathname === '/api/v1/rankings' && url.searchParams.get('city_id') === city.id;
        }, { timeout: 5000 });
        await Promise.all([ranking, width === 375 ? card.tap() : card.press('Enter')]);
        assert.equal(await page.locator('#rank-city').inputValue(), city.id);
        assert.deepEqual(await page.locator('#rank-difficulty option').allTextContents(), city.difficulties.map(item => item.name));
        assert.ok(await page.locator('#rank-difficulty').evaluate(select => select === document.activeElement));
      }
      assert.equal(requests.filter(request => request.url().endsWith('/api/v1/catalog')).length, 1);
      assert.ok(requests.every(request => request.method() === 'GET' && new URL(request.url()).origin === origin));
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('duplicate names select different IDs and a city without difficulties does not leave old rankings', async () => {
  const { page, context, errors } = await open();
  try {
    const cities = catalog.cities.slice(0, 2).map((city, index) => ({ ...city,
      name: 'Mismo nombre', difficulties: index === 0 ? city.difficulties : [],
    }));
    await page.route('**/api/v1/catalog', route => route.fulfill({ json: { cities } }));
    await page.goto(`${origin}/play.html`);
    await page.locator('#ranking-status').filter({ hasText: 'Todavía no hay resultados' }).waitFor();
    const cards = page.getByRole('button', { name: 'Mismo nombre', exact: true });
    assert.equal(await cards.count(), 2);
    await page.locator('#rank-difficulty').selectOption('2');
    await cards.first().click();
    assert.equal(await page.locator('#rank-difficulty').inputValue(), '2');
    await cards.last().click();
    assert.equal(await page.locator('#rank-city').inputValue(), cities[1].id);
    assert.ok(await page.locator('#rank-city').evaluate(select => select === document.activeElement));
    assert.ok(await page.locator('#rank-start').isDisabled());
    assert.match(await page.locator('#ranking-status').innerText(), /no tiene dificultades disponibles/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
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
    await page.goto(`${origin}/play.html`);
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
    const names = ['<img src=x onerror="window.cityXss=true">', 'Ciudad' + 'larguísima'.repeat(30), 'San Nicolás'];
    try {
      await page.route('**/api/v1/catalog', route => route.fulfill({ json: {
        cities: catalog.cities.map((city, index) => ({ ...city, name: names[index] })),
      } }));
      await page.goto(`${origin}/play.html`);
      await page.locator('#cities-list:visible').waitFor();
      assert.deepEqual(await page.locator('#cities-list li').allTextContents(), names);
      assert.equal(await page.locator('#cities-list img').count(), 0);
      assert.equal(await page.evaluate(() => window.cityXss), undefined);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await page.locator('#cities-list button').evaluateAll(cards => cards.every(card => card.scrollWidth <= card.clientWidth)));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});
