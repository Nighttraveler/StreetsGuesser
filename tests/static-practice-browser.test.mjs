import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { copyFile, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);

test('real static six-asset server: isolated home and practice without rankings modules or API', async () => {
  const temporary = await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'static-practice-'));
  let server, browser;
  try {
    const dockerfile = await readFile(new URL('Dockerfile', root), 'utf8');
    const sources = dockerfile.match(/^COPY (.+) \/srv\/arrecifes\/public\/$/m)[1].split(' ');
    const assets = sources.map(source => basename(source));
    assert.deepEqual([...assets].sort(), ['app.mjs', 'arrecifes_calles.json', 'game.mjs', 'index.html', 'play.html', 'styles.css']);
    for (const source of sources) await copyFile(new URL(source, root), join(temporary, basename(source)));
    assert.deepEqual((await readdir(temporary)).sort(), [...assets].sort());
    // Import the actual production handler; only the bind port and asset directory differ.
    server = spawn('python3', ['-B', '-u', '-c',
      'from pathlib import Path; import sys; from backend.serve_static import StaticServer; server = StaticServer(("127.0.0.1", 0), Path(sys.argv[1])); print(server.server_port, flush=True); server.serve_forever()', temporary],
    { cwd: fileURLToPath(root), stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    server.stderr.on('data', chunk => { logs += chunk; });
    const lines = createInterface({ input: server.stdout });
    const port = await Promise.race([
      once(lines, 'line').then(([line]) => Number(line)),
      once(server, 'exit').then(([code]) => { throw new Error(`Static server exited ${code}: ${logs}`); }),
    ]);
    const origin = `http://127.0.0.1:${port}`;
    for (const path of ['/rankings-ui.mjs', '/ranked-game-client.mjs', '/api/v1/cities', '/package.json', '/serve_static.py', '/.env', '/tests/', '/missing', '/frontend/index.html', '/backend/serve_static.py', '/data/arrecifes/source.json']) {
      assert.equal((await fetch(`${origin}${path}`)).status, 404, path);
    }
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const errors = [], apiRequests = [], external = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      requests.push(new URL(request.url()).pathname);
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
      if (!request.url().startsWith(origin)) external.push(request.url());
    });
    for (const path of ['/', '/index.html']) {
      requests.length = 0;
      await page.goto(`${origin}${path}`);
      assert.equal(await page.locator('#map, #answer-form, script').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(requests.every(path => ['/', '/index.html', '/styles.css'].includes(path)));
    }
    await page.getByRole('link', { name: 'Jugar', exact: true }).press('Enter');
    await page.locator('#answer:enabled').waitFor({ timeout: 5000 });
    assert.equal(new URL(page.url()).pathname, '/play.html');
    await page.goto(`${origin}/play.html?direct=1`);
    await page.locator('#answer:enabled').waitFor({ timeout: 5000 });
    await page.reload();
    await page.locator('#answer:enabled').waitFor({ timeout: 5000 });
    assert.ok(await page.locator('#map path.road').count() > 0);
    await page.locator('#catalog-status').filter({ hasText: 'Clasificado no disponible' }).waitFor();
    assert.equal(await page.locator('#catalog-load').isDisabled(), true);
    assert.match(await page.locator('#cities-status').innerText(), /No se pudieron cargar las ciudades/);
    assert.equal(await page.locator('#cities-list li').count(), 0);
    assert.equal(await page.locator('#cities-list').getAttribute('aria-busy'), 'false');
    assert.equal(await page.locator('#cities-retry').isDisabled(), true);
    const data = JSON.parse(await readFile(new URL('frontend/arrecifes_calles.json', root)));
    const index = Number(await page.locator('g:has(path.active)').getAttribute('data-street-index'));
    await page.locator('#answer').fill(data[index].nombre);
    await page.locator('#submit').click();
    assert.equal(await page.locator('#progress').innerText(), '1/15');
    assert.equal(await page.locator('#score').innerText(), '10');
    assert.match(await page.locator('#feedback').innerText(), /¡Bien!/);
    await page.locator('#next').click();
    assert.equal(await page.locator('#answer').isEnabled(), true);
    await page.getByRole('link', { name: 'Volver a la portada' }).click();
    assert.equal(await page.locator('#map, script').count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(apiRequests, []);
    assert.deepEqual(external, []);
  } finally {
    await browser?.close();
    if (server && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      await exited;
    }
    await rm(temporary, { recursive: true, force: true });
  }
});
