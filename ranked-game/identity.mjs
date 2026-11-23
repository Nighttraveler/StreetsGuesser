import { randomBytes, randomUUID } from 'node:crypto';
import { digest } from './database.mjs';
import { fail, fields } from './errors.mjs';

export const SESSION_SECONDS = 15552000;
export class Identity {
  constructor(store, clock) { this.store = store; this.clock = clock; }
  find(token) {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    return this.store.get(`SELECT p.id,u.username FROM sessions s JOIN players p ON p.id=s.player_id
      LEFT JOIN usernames u ON u.player_id=p.id WHERE s.token_hash=? AND s.expires_at>?`, digest(token), this.clock()) ?? null;
  }
  require(token) {
    const player = this.find(token);
    if (!player) fail('SESSION_REQUIRED');
    return player;
  }
  create(token, body) {
    fields(body, []);
    const current = this.find(token);
    if (current) return { status: 200, body: { player: current } };
    const id = randomUUID();
    const secret = randomBytes(32).toString('hex');
    const now = this.clock();
    this.store.transaction(db => {
      db.run('INSERT INTO players VALUES (?,?)', id, now);
      db.run('INSERT INTO sessions VALUES (?,?,?,?)', digest(secret), id, now, now + SESSION_SECONDS * 1000);
    });
    return { status: 201, body: { player: { id, username: null } }, token: secret };
  }
}
