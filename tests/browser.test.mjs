import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('arrecifes_calles.json', root)));
const files = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']], ['/app.mjs', ['app.mjs', 'text/javascript']],
  ['/game.mjs', ['game.mjs', 'text/javascript']], ['/arrecifes_calles.json', ['arrecifes_calles.json', 'application/json']],
]);
let server, browser, origin;
before(async () => {
  server = createServer(async (req, res) => {
    const file = files.get(new URL(req.url, 'http://localhost').pathname);
    if (!file) { res.writeHead(404); res.end('Not found'); return; }
    try {
      const content = await readFile(new URL(file[0], root));
      res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` });
      res.end(content);
    } catch { res.writeHead(500); res.end('Read error'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  await mkdir(new URL('test-results/', root), { recursive: true });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
async function openPage(options = {}) {
  const context = await browser.newContext(options);
  const errors = [];
  const external = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('request', req => { if (!req.url().startsWith(origin)) external.push(req.url()); });
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  return { context, page, errors, external };
}
async function ready(page) {
  await page.goto(origin);
  await page.locator('#answer:enabled').waitFor();
}
async function activeStreet(page) {
  const index = await page.locator('g:has(path.active)').getAttribute('data-street-index');
  return data[Number(index)];
}

test('HTTP real: mapa, controles, Enter, alias, puntos, error, pista y salto persistente', async () => {
  const { context, page, errors, external } = await openPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  try {
    const easy = data.filter(s => s.nivel === 1);
    const merlassino = easy.findIndex(s => s.nombre === 'Avenida Carlos Merlassino');
    await page.addInitScript(value => { Math.random = () => value; }, (merlassino + .1) / easy.length);
    await ready(page);
    assert.equal(await page.locator('#map path').count(), data.reduce((sum, s) => sum + s.segmentos.length, 0));
    assert.equal(await page.locator('#map text, #map title').count(), 0);
    let street = await activeStreet(page);
    assert.equal(street.nombre, 'Avenida Carlos Merlassino');
    assert.equal(await page.locator('path.active').count(), street.segmentos.length);
    assert.match(await page.locator('.map-foot').innerText(), /OpenStreetMap contributors/);
    const target = await page.locator('#map').getAttribute('viewBox');
    await page.locator('#overview').click();
    const overview = await page.locator('#map').getAttribute('viewBox');
    assert.notEqual(target, overview);
    await page.locator('#locate').click();
    assert.equal(await page.locator('#map').getAttribute('viewBox'), target);
    await page.locator('#zoom-in').click();
    assert.notEqual(await page.locator('#map').getAttribute('viewBox'), target);
    await page.locator('#zoom-out').click();
    const zoomed = (await page.locator('#map').getAttribute('viewBox')).split(' ').map(Number);
    assert.ok(Math.abs(zoomed[2] - Number(target.split(' ')[2])) < .001);
    await page.locator('#answer').fill('av merlassino');
    await page.locator('#answer').press('Enter');
    assert.equal(await page.locator('#score').innerText(), '10');
    assert.equal(await page.locator('#streak').innerText(), '1');
    assert.match(await page.locator('#feedback').innerText(), /¡Bien! Es Avenida Carlos Merlassino/);
    assert.ok(await page.locator('#answer').isDisabled());
    await page.locator('#next').click();
    await page.locator('#answer').fill('respuesta incorrecta');
    await page.locator('#answer').press('Enter');
    assert.equal(await page.locator('#score').innerText(), '10');
    assert.equal(await page.locator('#streak').innerText(), '0');
    assert.match(await page.locator('#feedback').innerText(), /Todavía no/);
    await page.locator('#hint').click();
    assert.match(await page.locator('#hint-text').innerText(), /Empieza con «.+» · \d+ palabras?/);
    street = await activeStreet(page);
    await page.locator('#answer').fill(`CALLE ${street.nombre.toUpperCase()}`);
    await page.locator('#submit').click();
    assert.equal(await page.locator('#score').innerText(), '15');
    assert.equal(await page.locator('#streak').innerText(), '1');
    await page.locator('#next').click();
    street = await activeStreet(page);
    await page.locator('#skip').click();
    const revealed = await page.locator('#feedback').innerText();
    assert.ok(revealed.includes(street.nombre));
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('#feedback').innerText(), revealed);
    assert.equal((await activeStreet(page)).nombre, street.nombre);
    assert.equal(await page.locator('#score').innerText(), '15');
    assert.equal(await page.locator('#streak').innerText(), '0');
    assert.ok(await page.locator('#next').isVisible());
    await page.locator('#next').click();
    assert.notEqual((await activeStreet(page)).nombre, street.nombre);
    await page.screenshot({ path: new URL('test-results/desktop.png', root).pathname, fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  } finally { await context.close(); }
});

test('niveles exactos, respuesta con tildes normalizadas y diseño móvil sin desborde', async () => {
  const { context, page, errors, external } = await openPage({ viewport: { width: 375, height: 812 }, isMobile: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  try {
    const hard = data.filter(s => s.nivel === 3);
    const ricardo = hard.findIndex(s => s.nombre === 'Ricardo Gutiérrez');
    await page.addInitScript(value => { Math.random = () => value; }, (ricardo + .1) / hard.length);
    await ready(page);
    for (const level of [2, 3]) {
      await page.locator('#level').selectOption(String(level));
      const street = await activeStreet(page);
      assert.equal(street.nivel, level);
      assert.equal(await page.locator('path.active').count(), street.segmentos.length);
      assert.match(await page.locator('#level-note').innerText(), new RegExp(`^${level === 2 ? 13 : 145} calles`));
      assert.equal(await page.locator('#score').innerText(), '0');
    }
    assert.equal((await activeStreet(page)).nombre, 'Ricardo Gutiérrez');
    await page.locator('#answer').fill('Dr. RICARDO GUTIERREZ');
    await page.locator('#answer').press('Enter');
    assert.equal(await page.locator('#score').innerText(), '10');
    await page.locator('#level').selectOption('1');
    assert.equal(await page.locator('#score').innerText(), '0');
    assert.equal(await page.locator('#streak').innerText(), '0');
    assert.equal((await activeStreet(page)).nivel, 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const id of ['hint', 'skip', 'submit', 'zoom-in', 'zoom-out']) {
      const box = await page.locator(`#${id}`).boundingBox();
      assert.ok(box.height >= 44);
    }
    await page.screenshot({ path: new URL('test-results/mobile.png', root).pathname, fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  } finally { await context.close(); }
});

test('zoom suave normal y movimiento reducido inmediato', async () => {
  const { context, page } = await openPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  try {
    await ready(page);
    await page.waitForTimeout(750);
    const target = await page.locator('#map').getAttribute('viewBox');
    await page.locator('#overview').click();
    await page.waitForTimeout(150);
    const intermediate = await page.locator('#map').getAttribute('viewBox');
    await page.waitForTimeout(750);
    const end = await page.locator('#map').getAttribute('viewBox');
    assert.notEqual(target, end);
    assert.notEqual(intermediate, end);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#overview').click();
    const immediate = await page.locator('#map').getAttribute('viewBox');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#map').getAttribute('viewBox'), immediate);
    assert.equal(immediate, end);
  } finally { await context.close(); }
});

test('error de carga visible y reintento recuperable sin inventar calles', async () => {
  const { context, page } = await openPage();
  try {
    await page.route('**/arrecifes_calles.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.goto(origin);
    await page.locator('#retry:visible').waitFor();
    assert.match(await page.locator('#feedback').innerText(), /HTTP 503/);
    assert.equal(await page.locator('#map path').count(), 0);
    assert.ok(await page.locator('#answer').isDisabled());
    await page.unroute('**/arrecifes_calles.json');
    await page.locator('#retry').click();
    await page.locator('#answer:enabled').waitFor();
    assert.equal(await page.locator('#map path').count(), 407);
    assert.ok(await page.locator('#retry').isHidden());
  } finally { await context.close(); }
});
