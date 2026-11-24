import { fields, fail, iso } from '../ranked-game/errors.mjs';
import { normalizeUsername, rankingQuery } from './validation.mjs';

export class Rankings {
  constructor(store, catalog, verifiedGames, clock) {
    this.store = store; this.catalog = catalog; this.games = verifiedGames; this.clock = clock;
  }
  best(game) {
    return this.store.get(`SELECT game_id,score,completed_at FROM leaderboard_entries WHERE
      city_id=? AND difficulty=? AND dataset_version=? AND rules_version=? AND player_id=?`,
    game.city_id, game.difficulty, game.dataset_version, game.rules_version, game.player_id);
  }
  submit(playerId, body) {
    fields(body, ['game_id', 'username']);
    const username = normalizeUsername(body.username);
    // Ownership always precedes claiming a name. No browser-supplied score or board.
    let game = this.games.owned(body.game_id, playerId);
    const submitted = this.store.get('SELECT * FROM submissions WHERE game_id=? AND player_id=?', game.id, playerId);
    if (!submitted) game = this.games.getCompletedOwned(game.id, playerId);
    const own = this.store.get('SELECT username FROM usernames WHERE player_id=?', playerId);
    if (own && own.username !== username) fail('USERNAME_LOCKED', 'username');
    const owner = this.store.get('SELECT player_id FROM usernames WHERE username=?', username);
    if (owner && owner.player_id !== playerId) fail('USERNAME_TAKEN', 'username');
    if (!own) {
      try { this.store.run('INSERT INTO usernames VALUES (?,?,?)', playerId, username, this.clock()); }
      catch (error) {
        if (error.errcode === 2067 || error.errcode === 1555) fail('USERNAME_TAKEN', 'username');
        throw error;
      }
    }
    let best = this.best(game);
    const improved = !submitted && (!best || game.score > best.score);
    if (!submitted) {
      this.store.run('INSERT INTO submissions VALUES (?,?,?)', game.id, playerId, this.clock());
      if (improved) {
        this.store.run(`INSERT INTO leaderboard_entries VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(city_id,difficulty,dataset_version,rules_version,player_id) DO UPDATE SET
          game_id=excluded.game_id,score=excluded.score,completed_at=excluded.completed_at
          WHERE excluded.score>leaderboard_entries.score`,
        game.city_id, game.difficulty, game.dataset_version, game.rules_version, playerId, game.id, game.score, game.completed_at);
        best = this.best(game);
      }
    }
    return { status: submitted ? 200 : 201, body: {
      submission: { game_id: game.id, username, city_id: game.city_id, difficulty: game.difficulty, score: game.score, completed_at: iso(game.completed_at) },
      best: { game_id: best.game_id, score: best.score, completed_at: iso(best.completed_at) },
      improved, already_submitted: Boolean(submitted),
    } };
  }
  list(params) {
    const { city, difficulty, limit, offset } = rankingQuery(params);
    return this.store.transaction(() => {
      const board = this.catalog.board(city, difficulty);
      const args = [city, difficulty, board.active_dataset_version, board.active_rules_version];
      const where = 'e.city_id=? AND e.difficulty=? AND e.dataset_version=? AND e.rules_version=?';
      const total = this.store.get(`SELECT COUNT(*) AS n FROM leaderboard_entries e WHERE ${where}`, ...args).n;
      const rows = this.store.all(`SELECT u.username,e.score,e.completed_at FROM leaderboard_entries e
        JOIN usernames u ON u.player_id=e.player_id WHERE ${where}
        ORDER BY e.score DESC,e.completed_at ASC,e.game_id ASC LIMIT ? OFFSET ?`, ...args, limit, offset);
      return { city_id: city, difficulty, dataset_version: board.active_dataset_version, rules_version: board.active_rules_version,
        items: rows.map((row, index) => ({ position: offset + index + 1, username: row.username, score: row.score, completed_at: iso(row.completed_at) })),
        pagination: { limit, offset, total, has_more: offset + rows.length < total } };
    }, false);
  }
}
