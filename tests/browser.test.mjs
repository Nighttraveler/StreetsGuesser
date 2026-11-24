import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const frontendRoot = new URL('../frontend/', import.meta.url);
const data = JSON.parse(await readFile(new URL('arrecifes_calles.json', frontendRoot)));
const files = new Map([
  ['/play.html', ['play.html', 'text/html']],
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']], ['/app.mjs', ['app.mjs', 'text/javascript']],
  ['/game.mjs', ['game.mjs', 'text/javascript']], ['/arrecifes_calles.json', ['arrecifes_calles.json', 'application/json']],
  ['/rankings-ui.mjs', ['rankings-ui.mjs', 'text/javascript']], ['/ranked-game-client.mjs', ['ranked-game-client.mjs', 'text/javascript']],
]);
let server, browser, origin;
before(async () => {
  server = createServer(async (req, res) => {
    // Explicit empty catalog fixture: practice tests do not exercise the API.
    if (req.url === '/api/v1/catalog') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cities: [] }));
      return;
    }
    const file = files.get(new URL(req.url, 'http://localhost').pathname);
    if (!file) { res.writeHead(404); res.end('Not found'); return; }
    try {
      const content = await readFile(new URL(file[0], frontendRoot));
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
  await page.goto(`${origin}/play.html`);
  await page.locator('#answer:enabled').waitFor();
  // The city catalog precedes the game; coordinates must target the visible map.
  await page.locator('.game').scrollIntoViewIfNeeded();
}
async function activeStreet(page) {
  const index = await page.locator('g:has(path.active)').getAttribute('data-street-index');
  return data[Number(index)];
}

async function camera(page) {
  return (await page.locator('#map').getAttribute('viewBox')).split(' ').map(Number);
}
async function mapPoint(page) {
  // Camera controls can change SVG height and trigger browser scroll anchoring.
  await page.locator('#map').scrollIntoViewIfNeeded();
  const box = await page.locator('#map').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function startDrag(page) {
  const point = await mapPoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 40, point.y + 30);
  return point;
}

test('táctil real emulado: un dedo continuo, scroll exterior y controles', async () => {
  const { context, page, errors } = await openPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    await ready(page);
    const point = await mapPoint(page);
    const cdp = await context.newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map((p, id) => ({ ...p, id })),
    });
    const original = await camera(page);
    const scale = await page.locator('#map').evaluate(map => map.getScreenCTM().a);
    const scroll = await page.evaluate(() => scrollY);
    const street = await activeStreet(page);
    await touch('touchStart', [point]);
    for (const [dx, dy] of [[35, 0], [35, 40], [-30, 40], [-30, -35], [20, -20]]) {
      await touch('touchMove', [{ x: point.x + dx, y: point.y + dy }]);
      await page.waitForTimeout(40);
      const moved = await camera(page);
      assert.ok(Math.abs(moved[0] - (original[0] - dx / scale)) < .01, 'horizontal camera follows finger');
      assert.ok(Math.abs(moved[1] - (original[1] - dy / scale)) < .01, 'vertical camera follows finger');
      assert.deepEqual(moved.slice(2), original.slice(2));
    }
    await touch('touchEnd', []);
    assert.equal(await page.evaluate(() => scrollY), scroll);
    assert.equal(await page.locator('#map.dragging').count(), 0);
    assert.equal((await activeStreet(page)).nombre, street.nombre);
    assert.equal(await page.locator('#score').innerText(), '0');
    const moved = await camera(page);
    await touch('touchStart', [point]);
    await touch('touchMove', [{ x: point.x + 2, y: point.y + 2 }]);
    await touch('touchEnd', []);
    assert.deepEqual(await camera(page), moved, 'sub-threshold touch does not pan');
    await page.locator('#zoom-in').tap();
    assert.ok((await camera(page))[2] < moved[2]);
    await page.locator('#locate').tap();
    assert.deepEqual(await camera(page), original);
    // Start below the map, on ordinary text rather than an input/control.
    await page.locator('.help').scrollIntoViewIfNeeded();
    const box = await page.locator('.help').boundingBox();
    const outside = { x: box.x + 30, y: box.y + 15 };
    const beforeScroll = await page.evaluate(() => scrollY);
    await touch('touchStart', [outside]);
    for (let i = 1; i <= 6; i++) {
      await touch('touchMove', [{ x: outside.x, y: outside.y - i * 15 }]);
      await page.waitForTimeout(30);
    }
    await touch('touchEnd', []);
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(y => scrollY > y, beforeScroll), 'scroll outside SVG remains native');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('táctil: cancelaciones, captura, segundo dedo y recuperación', async () => {
  const { context, page, errors } = await openPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    await ready(page);
    await page.evaluate(() => {
      window.mapClicks = 0;
      const map = document.getElementById('map');
      map.addEventListener('click', () => window.mapClicks++);
      window.inputEvents = [];
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mouseup', 'click']) window.addEventListener(type, event => window.inputEvents.push([type, event.pointerType, event.target.id, event.defaultPrevented]), true);
      map.addEventListener('gotpointercapture', event => { window.capturedPointer = event.pointerId; });
    });
    const cdp = await context.newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map((p, id) => ({ ...p, id })),
    });
    for (const interruption of ['cancel', 'capture', 'blur', 'hidden', 'command', 'second']) {
      const point = await mapPoint(page);
      const before = await camera(page);
      await touch('touchStart', [point]);
      await touch('touchMove', [{ x: point.x + 30, y: point.y }]);
      await page.waitForTimeout(40);
      assert.notDeepEqual(await camera(page), before, interruption);
      if (interruption === 'cancel') await touch('touchCancel', []);
      if (interruption === 'capture') await page.locator('#map').evaluate(map => map.releasePointerCapture(window.capturedPointer));
      if (interruption === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      if (interruption === 'hidden') await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
      });
      if (interruption === 'command') await page.locator('#locate').evaluate(button => button.click());
      if (interruption === 'second') await touch('touchStart', [{ x: point.x + 30, y: point.y }, { x: point.x - 30, y: point.y }]);
      const stopped = await camera(page);
      if (interruption !== 'cancel') {
        await touch('touchMove', [
          { x: point.x + 50, y: point.y + 25 },
          ...(interruption === 'second' ? [{ x: point.x - 10, y: point.y + 25 }] : []),
        ]);
        await page.waitForTimeout(40);
        await touch('touchEnd', []);
      }
      assert.deepEqual(await camera(page), stopped, interruption);
      assert.equal(await page.locator('#map.dragging').count(), 0);
    }
    // A fresh tap remains a click; no completed drag produced a click.
    assert.equal(await page.evaluate(() => window.mapClicks), 0);
    const point = await mapPoint(page);
    await page.touchscreen.tap(point.x, point.y);
    assert.equal(await page.evaluate(() => window.mapClicks), 1, JSON.stringify(await page.evaluate(() => window.inputEvents)));
    const beforeMouse = await camera(page);
    await startDrag(page);
    assert.notDeepEqual(await camera(page), beforeMouse, 'hybrid touch then mouse');
    await page.mouse.up();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('pinch táctil conserva zoom nativo de página sin escalar la cámara SVG', async () => {
  const { context, page, errors } = await openPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    await ready(page);
    const point = await mapPoint(page);
    const cdp = await context.newCDPSession(page);
    const touch = (type, distance) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' ? [] : [
        { x: point.x - distance, y: point.y, id: 0 },
        { x: point.x + distance, y: point.y, id: 1 },
      ],
    });
    const original = await camera(page);
    const scale = await page.evaluate(() => visualViewport.scale);
    await touch('touchStart', 25);
    for (let distance = 30; distance <= 100; distance += 10) {
      await touch('touchMove', distance);
      await page.waitForTimeout(40);
    }
    await touch('touchEnd');
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(before => visualViewport.scale > before, scale));
    assert.deepEqual(await camera(page), original);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('arrastre continuo a escala SVG, umbral, clics y botones secundarios', async () => {
  const { context, page, errors } = await openPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  try {
    await ready(page);
    await page.evaluate(() => {
      window.mapClicks = 0;
      document.getElementById('map').addEventListener('click', () => window.mapClicks++);
      window.inputEvents = [];
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mouseup', 'click']) window.addEventListener(type, event => window.inputEvents.push([type, event.pointerType, event.target.id, event.defaultPrevented]), true);
    });
    const initialStreet = await activeStreet(page);
    const point = await mapPoint(page);
    const before = await camera(page);
    await page.mouse.click(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 2, point.y + 2);
    await page.mouse.up();
    assert.deepEqual(await camera(page), before);
    assert.equal(await page.evaluate(() => window.mapClicks), 2, JSON.stringify(await page.evaluate(() => window.inputEvents)));
    for (const button of ['right', 'middle']) {
      await page.mouse.move(point.x, point.y);
      await page.mouse.down({ button });
      await page.mouse.move(point.x + 40, point.y + 30);
      await page.mouse.up({ button });
      assert.deepEqual(await camera(page), before);
    }
    // Both the round's narrow view and full view can have letterboxing.
    for (const control of ['locate', 'overview', 'zoom-in']) {
      await page.locator(`#${control}`).click();
      const original = await camera(page);
      const scale = await page.locator('#map').evaluate(map => map.getScreenCTM().a);
      const dragPoint = await startDrag(page);
      const first = await camera(page);
      assert.ok(Math.abs(first[0] - (original[0] - 40 / scale)) < .001, JSON.stringify({ control, original, first, scale, dragPoint }));
      assert.ok(Math.abs(first[1] - (original[1] - 30 / scale)) < .001);
      assert.deepEqual(first.slice(2), original.slice(2));
      assert.equal(await page.locator('#map').evaluate(map => getComputedStyle(map).cursor), 'grabbing');
      await page.mouse.move(dragPoint.x + 70, dragPoint.y - 20);
      const second = await camera(page);
      assert.ok(Math.abs(second[0] - (original[0] - 70 / scale)) < .001);
      assert.ok(Math.abs(second[1] - (original[1] + 20 / scale)) < .001, JSON.stringify({ control, original, second, scale, dragPoint }));
      await page.mouse.up();
      assert.equal(await page.evaluate(() => window.mapClicks), 2);
      await page.mouse.move(point.x, point.y);
      assert.deepEqual(await camera(page), second);
    }
    const finalPoint = await mapPoint(page);
    await page.mouse.click(finalPoint.x, finalPoint.y);
    assert.equal(await page.evaluate(() => window.mapClicks), 3);
    assert.equal(await page.locator('#map').evaluate(map => getComputedStyle(map).cursor), 'grab');
    assert.equal((await activeStreet(page)).nombre, initialStreet.nombre);
    assert.equal(await page.locator('#score').innerText(), '0');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('soltar fuera, perder foco, ocultar documento y perder mouseup detienen el gesto', async () => {
  const { context, page, errors } = await openPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  try {
    await ready(page);
    for (const interruption of ['outside', 'blur', 'hidden', 'buttons']) {
      const point = await startDrag(page);
      if (interruption === 'outside') {
        await page.mouse.move(1250, 100);
        await page.mouse.up();
      } else if (interruption === 'blur') {
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      } else if (interruption === 'hidden') {
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event('visibilitychange'));
          delete document.hidden;
        });
      } else {
        await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { buttons: 0 })));
      }
      const stopped = await camera(page);
      await page.mouse.move(point.x - 30, point.y - 20);
      assert.deepEqual(await camera(page), stopped, interruption);
      assert.equal(await page.locator('#map.dragging').count(), 0);
      await page.mouse.up();
      // A fresh press must still work after each interruption.
      await startDrag(page);
      assert.notDeepEqual(await camera(page), stopped);
      await page.mouse.up();
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('controles no inician arrastre y comandos de cámara cancelan el gesto anterior', async () => {
  const { context, page, errors } = await openPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  try {
    await ready(page);
    const before = await camera(page);
    const point = await mapPoint(page);
    for (const id of ['zoom-in', 'zoom-out', 'overview', 'locate', 'answer', 'level', 'hint', 'skip']) {
      const box = await page.locator(`#${id}`).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(point.x, point.y);
      assert.deepEqual(await camera(page), before, id);
      assert.equal(await page.locator('#map.dragging').count(), 0);
      await page.mouse.up();
    }
    for (const id of ['overview', 'locate', 'zoom-in', 'zoom-out']) {
      await startDrag(page);
      // Keyboard/programmatic commands can happen while the mouse is held.
      await page.locator(`#${id}`).evaluate(button => button.click());
      const commanded = await camera(page);
      await page.mouse.move(point.x - 50, point.y - 50);
      assert.deepEqual(await camera(page), commanded);
      await page.mouse.up();
    }
    await startDrag(page);
    await page.locator('#level').selectOption('2');
    const next = await camera(page);
    await page.mouse.move(point.x - 60, point.y);
    assert.deepEqual(await camera(page), next);
    await page.mouse.up();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('arrastre interrumpe el zoom animado sin saltos posteriores', async () => {
  const { context, page, errors } = await openPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  try {
    await ready(page);
    await page.waitForTimeout(750);
    await page.locator('#overview').click();
    await page.waitForTimeout(100);
    await startDrag(page);
    const dragged = await camera(page);
    await page.waitForTimeout(750);
    assert.deepEqual(await camera(page), dragged);
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert.deepEqual(await camera(page), dragged);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('alias cortos de todas las rutas reales por Enter conservan nombre canónico y número exacto', async () => {
  const easy = data.filter(s => s.nivel === 1);
  for (const street of easy.filter(s => /ruta/i.test(s.nombre))) {
    const number = street.nombre.match(/\d+$/)[0];
    for (const answer of [`ruta ${number}`, `ex ruta ${number}`]) {
      const { context, page, errors, external } = await openPage({ reducedMotion: 'reduce' });
      try {
        await page.addInitScript(value => { Math.random = () => value; }, (easy.indexOf(street) + .1) / easy.length);
        await ready(page);
        assert.equal((await activeStreet(page)).nombre, street.nombre);
        for (const wrong of [`ruta ${number}0`, `ex ruta ${number}0`, `ruta ${number === '8' ? '51' : '8'}`]) {
          await page.locator('#answer').fill(wrong);
          await page.locator('#answer').press('Enter');
          assert.equal(await page.locator('#score').innerText(), '0');
          assert.match(await page.locator('#feedback').innerText(), /Todavía no/);
        }
        await page.locator('#answer').fill(answer);
        await page.locator('#answer').press('Enter');
        assert.equal(await page.locator('#score').innerText(), '10');
        assert.equal(await page.locator('#feedback').innerText(), `¡Bien! Es ${street.nombre}. +10 puntos.`);
        assert.equal((await activeStreet(page)).nombre, street.nombre);
        assert.ok(await page.locator('#answer').isDisabled());
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
      } finally { await context.close(); }
    }
  }
});

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

test('15 aciertos únicos, error y salto elegibles, agotamiento y regreso al nivel', async () => {
  const { context, page, errors, external } = await openPage({ reducedMotion: 'reduce' });
  try {
    await page.addInitScript(() => { Math.random = () => 0; });
    await ready(page);
    const first = await activeStreet(page);
    assert.equal(await page.locator('#progress').innerText(), '0/15');
    assert.ok(await page.locator('#advance').isHidden());
    await page.locator('#answer').fill('incorrecta');
    await page.locator('#submit').click();
    assert.equal((await activeStreet(page)).nombre, first.nombre);
    assert.equal(await page.locator('#progress').innerText(), '0/15');
    await page.locator('#hint').click();
    assert.equal(await page.locator('#progress').innerText(), '0/15');
    await page.locator('#skip').click();
    assert.equal(await page.locator('#progress').innerText(), '0/15');
    await page.locator('#next').click();
    await page.locator('#skip').click();
    await page.locator('#next').click();
    assert.equal((await activeStreet(page)).nombre, first.nombre);
    const seen = new Set();
    for (let i = 0; i < 15; i++) {
      const street = await activeStreet(page);
      const id = [...street.osm_way_ids].sort((a, b) => a - b).join(',');
      assert.equal(seen.has(id), false);
      seen.add(id);
      await page.locator('#answer').fill(street.nombre);
      await page.locator('#submit').click();
      await page.locator('#answer-form').dispatchEvent('submit');
      assert.equal(await page.locator('#progress').innerText(), `${i + 1}/15`);
      assert.equal(await page.locator('#advance').isVisible(), i === 14);
      assert.equal(await page.locator('#score').innerText(), String((i === 0 ? 1 : i) * 10));
      if (i === 0) {
        await page.locator('#level').selectOption('2');
        assert.equal(await page.locator('#progress').innerText(), '0/13');
        const medium = await activeStreet(page);
        await page.locator('#answer').fill(medium.nombre);
        await page.locator('#submit').click();
        assert.equal(await page.locator('#progress').innerText(), '1/13');
        await page.locator('#level').selectOption('1');
        assert.equal(await page.locator('#progress').innerText(), '1/15');
      } else if (i < 14) {
        await page.locator('#next').click();
      }
    }
    assert.equal(await page.locator('#level').inputValue(), '1');
    assert.ok(await page.locator('#next').isHidden());
    assert.ok(await page.locator('#answer').isDisabled());
    assert.match(await page.locator('#feedback').innerText(), /Nivel completado/);
    assert.match(await page.locator('#advance').innerText(), /Medio/);
    assert.equal(await page.locator('#advance').evaluate(el => el === document.activeElement), true);
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#level').inputValue(), '1');
    assert.equal(await page.locator('#progress').innerText(), '15/15');
    await page.locator('#advance').press('Enter');
    assert.equal(await page.locator('#level').inputValue(), '2');
    assert.equal(await page.locator('#progress').innerText(), '1/13');
    assert.equal(await page.locator('#score').innerText(), '0');
    assert.equal(await page.locator('#streak').innerText(), '0');
    assert.ok(await page.locator('#advance').isHidden());
    assert.equal(await page.locator('#answer').evaluate(el => el === document.activeElement), true);
    assert.equal((await activeStreet(page)).nivel, 2);
    await page.locator('#level').selectOption('1');
    assert.equal(await page.locator('path.active').count(), 0);
    assert.ok(await page.locator('#answer').isDisabled());
    assert.ok(await page.locator('#next').isHidden());
    assert.match(await page.locator('#feedback').innerText(), /completado/i);
    assert.equal(await page.locator('#progress').innerText(), '15/15');
    assert.ok(await page.locator('#advance').isVisible());
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  } finally { await context.close(); }
});

test('avance Medio a Difícil y máximo completo sin oferta inválida en móvil', async () => {
  const { context, page, errors, external } = await openPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  try {
    await ready(page);
    await page.locator('#level').selectOption('2');
    for (const [level, total] of [[2, 13], [3, 145]]) {
      assert.equal(await page.locator('#progress').innerText(), `0/${total}`);
      for (let i = 0; i < total; i++) {
        const street = await activeStreet(page);
        assert.equal(street.nivel, level);
        await page.locator('#answer').fill(street.nombre);
        await page.locator('#submit').click();
        assert.equal(await page.locator('#progress').innerText(), `${i + 1}/${total}`);
        if (i + 1 < total) await page.locator('#next').click();
      }
      assert.equal(await page.locator('#level').inputValue(), String(level));
      assert.match(await page.locator('#feedback').innerText(), /Nivel completado/);
      assert.ok(await page.locator('#next').isHidden());
      if (level === 2) {
        assert.match(await page.locator('#advance').innerText(), /Difícil/);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: new URL('test-results/completed-mobile.png', root).pathname, fullPage: true });
        await page.locator('#advance').click();
      }
    }
    assert.ok(await page.locator('#advance').isHidden());
    assert.equal(await page.locator('#level').evaluate(el => el === document.activeElement), true);
    await page.locator('#advance').dispatchEvent('click');
    assert.equal(await page.locator('#level').inputValue(), '3');
    assert.equal(await page.locator('#progress').innerText(), '145/145');
    await page.locator('#level').selectOption('1');
    await page.locator('#advance').dispatchEvent('click');
    assert.equal(await page.locator('#level').inputValue(), '1');
    assert.equal(await page.locator('#progress').innerText(), '0/15');
    await page.locator('#level').selectOption('3');
    assert.equal(await page.locator('#progress').innerText(), '145/145');
    assert.ok(await page.locator('#advance').isHidden());
    assert.equal(await page.locator('path.active').count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  } finally { await context.close(); }
});

test('IDs OSM inválidos o entidades duplicadas se rechazan antes de jugar', async () => {
  const { context, page } = await openPage();
  try {
    for (const ids of [undefined, [], [0], [-1], [1.5], ['123'], [Number.MAX_SAFE_INTEGER + 1]]) {
      const invalid = data.map((street, index) => index === 0 ? { ...street, osm_way_ids: ids } : street);
      await page.route('**/arrecifes_calles.json', route => route.fulfill({ json: invalid }));
      await page.goto(`${origin}/play.html`);
      await page.locator('#retry:visible').waitFor();
      assert.match(await page.locator('#feedback').innerText(), /Formato de calles inválido/);
      assert.ok(await page.locator('#answer').isDisabled());
      await page.unroute('**/arrecifes_calles.json');
    }
    await page.route('**/arrecifes_calles.json', route => route.fulfill({ json: [...data, { ...data[0] }] }));
    await page.goto(`${origin}/play.html`);
    await page.locator('#retry:visible').waitFor();
    assert.equal(await page.locator('#map path').count(), 0);
    assert.match(await page.locator('#feedback').innerText(), /Formato de calles inválido/);
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
    await page.goto(`${origin}/play.html`);
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
