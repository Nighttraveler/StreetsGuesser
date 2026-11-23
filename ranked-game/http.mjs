import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { Store } from './database.mjs';
import { Catalog } from './catalog.mjs';
import { Games } from './service.mjs';
import { Identity, SESSION_SECONDS } from './identity.mjs';
import { Rankings } from '../rankings/service.mjs';
import { ApiError, fail } from './errors.mjs';

const loopback = host => ['127.0.0.1', '::1', '[::1]', 'localhost'].includes(host);
export function validateConfig(config) {
  const origin = new URL(config.origin);
  if (origin.origin !== config.origin || origin.username || origin.password) throw new Error('Exact origin required');
  if (config.development) {
    if (config.production || origin.protocol !== 'http:' || !loopback(origin.hostname) || !loopback(config.host)) throw new Error('Development requires explicit loopback HTTP');
  } else if (origin.protocol !== 'https:') throw new Error('Production requires HTTPS');
  if (!config.dbPath || !config.snapshotDir) throw new Error('Private database and snapshots required');
  return origin;
}
class Limiter {
  constructor(clock) { this.clock = clock; this.windows = new Map(); }
  consume(key, limit) {
    const now = this.clock();
    for (const [id, window] of this.windows) if (now >= window.until) this.windows.delete(id);
    const window = this.windows.get(key) ?? { n: 0, until: now + 60000 };
    if (window.n >= limit) throw new ApiError('RATE_LIMITED', null, Math.max(1, Math.ceil((window.until - now) / 1000)));
    window.n++;
    this.windows.set(key, window);
  }
}
function bodyJSON(req) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) fail('UNSUPPORTED_MEDIA_TYPE');
  if (Number(req.headers['content-length']) > 4096) { req.resume(); fail('BODY_TOO_LARGE'); }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on('data', chunk => {
      length += chunk.length;
      if (length <= 4096) chunks.push(chunk);
      else reject(new ApiError('BODY_TOO_LARGE'));
    });
    req.on('end', () => {
      if (length > 4096) return;
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        resolve(JSON.parse(text));
      } catch { reject(new ApiError('INVALID_JSON')); }
    });
    req.on('error', () => reject(new ApiError('INVALID_JSON')));
  });
}
function tokenFrom(req, name) {
  const values = (req.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : null;
}
const publicFiles = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']], ['/app.mjs', ['app.mjs', 'text/javascript']],
  ['/game.mjs', ['game.mjs', 'text/javascript']], ['/arrecifes_calles.json', ['arrecifes_calles.json', 'application/json']],
  ['/rankings-ui.mjs', ['rankings-ui.mjs', 'text/javascript']], ['/ranked-game-client.mjs', ['ranked-game-client.mjs', 'text/javascript']],
]);
export function createApplication(config) {
  const origin = validateConfig(config);
  const clock = config.clock ?? Date.now;
  const store = new Store(config.dbPath);
  let catalog;
  try { catalog = new Catalog(store, config.snapshotDir, config.registrations ?? []); }
  catch (error) { store.close(); throw error; }
  const identity = new Identity(store, clock);
  const games = new Games(store, catalog, clock);
  const rankings = new Rankings(store, catalog, games, clock);
  const limiter = new Limiter(clock);
  const cookieName = config.development ? 'arrecifes_session' : '__Host-arrecifes_session';
  const json = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(JSON.stringify(body));
  };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const api = url.pathname.startsWith('/api/');
      if (!api) {
        const asset = publicFiles.get(url.pathname);
        if (!config.staticRoot || !asset || !['GET', 'HEAD'].includes(req.method)) fail('NOT_FOUND');
        let bytes;
        try { bytes = await readFile(new URL(asset[0], config.staticRoot)); }
        catch { fail('NOT_FOUND'); }
        res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
        res.end(req.method === 'HEAD' ? undefined : bytes);
        return;
      }
      // A trusted TLS terminator must preserve Host and explicitly forward HTTPS.
      if (!config.development && !req.socket.encrypted && !(config.trustedProxy === req.socket.remoteAddress && req.headers['x-forwarded-proto'] === 'https')) fail('ORIGIN_FORBIDDEN');
      if (req.headers.host !== origin.host) fail('ORIGIN_FORBIDDEN');
      const path = url.pathname.slice('/api/v1'.length);
      if (!url.pathname.startsWith('/api/v1/')) fail('NOT_FOUND');
      if (path !== '/rankings' && url.search) fail('INVALID_QUERY');
      const token = tokenFrom(req, cookieName);
      if (req.method === 'GET') {
        let result;
        if (path === '/catalog') result = catalog.view();
        else if (path === '/rankings') result = rankings.list(url.searchParams);
        else if (/^\/cities\/[^/]+\/datasets\/[^/]+$/.test(path)) {
          const [, , city, , version] = path.split('/');
          result = catalog.dataset(city, version);
        } else {
          const player = identity.require(token);
          if (path === '/session') result = { player };
          else if (path === '/games/active') result = games.active(player.id);
          else if (/^\/games\/[^/]+$/.test(path)) result = games.view(games.owned(path.split('/')[2], player.id));
          else fail('NOT_FOUND');
        }
        json(res, 200, result);
        return;
      }
      if (req.method !== 'POST') fail('NOT_FOUND');
      if (req.headers.origin !== config.origin) fail('ORIGIN_FORBIDDEN');
      const player = path === '/session' ? identity.find(token) : identity.require(token);
      // Only an explicitly trusted proxy may supply one validated client IP.
      const forwarded = req.headers['x-forwarded-for'];
      const ip = config.trustedProxy === req.socket.remoteAddress && typeof forwarded === 'string' && isIP(forwarded)
        ? forwarded : req.socket.remoteAddress;
      limiter.consume(player ? `player:${player.id}` : `new:${ip}`, player ? 120 : 20);
      const body = await bodyJSON(req);
      let response;
      if (path === '/session') response = identity.create(token, body);
      else response = store.mutate(player.id, req.headers['idempotency-key'], url.pathname, body, clock(), () => {
        if (path === '/games') return games.start(player.id, body);
        if (path === '/rankings/submissions') return rankings.submit(player.id, body);
        const match = path.match(/^\/games\/([^/]+)\/(actions|abandon)$/);
        if (match) return match[2] === 'actions' ? games.action(player.id, match[1], body) : games.abandon(player.id, match[1], body);
        fail('NOT_FOUND');
      });
      const headers = response.token ? { 'Set-Cookie': `${cookieName}=${response.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${config.development ? '' : '; Secure'}` } : {};
      json(res, response.status, response.body, headers);
    } catch (error) {
      const safe = error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR');
      json(res, safe.status, safe.toJSON(), safe.retryAfter ? { 'Retry-After': String(safe.retryAfter) } : {});
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return { server, store, catalog, games, rankings, identity,
    async close() { if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); store.close(); } };
}
