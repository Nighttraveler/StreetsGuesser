import { randomUUID, randomInt } from 'node:crypto';
import { matchesAnswer, updateState, streetId, selectStreet, hintFor } from '../../frontend/game.mjs';
import { fail, fields, uuid, iso } from './errors.mjs';

export const DAY = 86400000;
export class Games {
  constructor(store, catalog, clock) { this.store = store; this.catalog = catalog; this.clock = clock; }
  owned(id, playerId) {
    if (!uuid(id)) fail('GAME_NOT_FOUND', 'game_id');
    const game = this.store.get('SELECT * FROM games WHERE id=? AND player_id=?', id, playerId);
    if (!game) fail('GAME_NOT_FOUND', 'game_id');
    return game;
  }
  currentVersion(game) {
    const board = this.catalog.board(game.city_id, game.difficulty);
    return board.active_dataset_version === game.dataset_version && board.active_rules_version === game.rules_version;
  }
  eligible(game) {
    return game.status === 'completed' && game.completed_at < game.expires_at && game.solved_count === game.total
      && this.clock() < game.completed_at + 7 * DAY && this.currentVersion(game);
  }
  // Internal VerifiedGameReader. Called only inside Store.mutate's transaction.
  getCompletedOwned(id, playerId) {
    const game = this.owned(id, playerId);
    const sum = this.store.get('SELECT COUNT(*) AS n,COALESCE(SUM(points),0) AS score FROM solved_streets WHERE game_id=?', id);
    if (game.status !== 'completed' || game.solved_count !== game.total || sum.n !== game.total || sum.score !== game.score
      || game.completed_at >= game.expires_at || this.clock() >= game.completed_at + 7 * DAY) fail('GAME_NOT_ELIGIBLE', 'game_id');
    if (!this.currentVersion(game)) fail('BOARD_VERSION_CHANGED', 'game_id');
    return game;
  }
  view(game) {
    const round = this.store.get('SELECT * FROM rounds WHERE id=? AND game_id=?', game.current_round_id, game.id);
    const street = round ? this.catalog.dataset(game.city_id, game.dataset_version).find(item => streetId(item) === round.street_id) : null;
    return {
      id: game.id, city_id: game.city_id, difficulty: game.difficulty, dataset_version: game.dataset_version,
      rules_version: game.rules_version,
      status: game.status === 'active' && this.clock() >= game.expires_at ? 'expired' : game.status,
      score: game.score, streak: game.streak, progress: { correct: game.solved_count, total: game.total }, revision: game.revision,
      completed_at: iso(game.completed_at), eligible_for_ranking: this.eligible(game),
      round: round ? { id: round.id, street_id: round.street_id, hinted: Boolean(round.hinted), resolved: Boolean(round.resolved),
        hint_text: round.hinted ? hintFor(street) : null, revealed_name: round.resolved ? street.nombre : null } : null,
    };
  }
  active(playerId) {
    const game = this.store.get("SELECT * FROM games WHERE player_id=? AND status='active' AND expires_at>?", playerId, this.clock());
    return { game: game ? this.view(game) : null };
  }
  newRound(game, previous = null) {
    const solved = this.store.all('SELECT street_id FROM solved_streets WHERE game_id=?', game.id).map(row => row.street_id);
    const streets = this.catalog.dataset(game.city_id, game.dataset_version);
    const street = selectStreet(streets, game.difficulty, previous, () => randomInt(0x100000000) / 0x100000000, solved);
    if (!street) throw new Error('No remaining street in active game');
    const id = randomUUID();
    const ordinal = this.store.get('SELECT COALESCE(MAX(ordinal),0)+1 AS n FROM rounds WHERE game_id=?', game.id).n;
    this.store.run('INSERT INTO rounds VALUES (?,?,?,?,0,0,NULL)', id, game.id, ordinal, streetId(street));
    this.store.run('UPDATE games SET current_round_id=? WHERE id=?', id, game.id);
  }
  start(playerId, body) {
    fields(body, ['city_id', 'difficulty']);
    if (typeof body.city_id !== 'string' || body.city_id.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.city_id)) fail('INVALID_FIELD', 'city_id');
    if (!Number.isInteger(body.difficulty) || ![1, 2, 3].includes(body.difficulty)) fail('INVALID_FIELD', 'difficulty');
    const board = this.catalog.board(body.city_id, body.difficulty);
    const now = this.clock();
    this.store.run("UPDATE games SET status='expired',revision=revision+1 WHERE player_id=? AND status='active' AND expires_at<=?", playerId, now);
    if (this.store.get("SELECT id FROM games WHERE player_id=? AND status='active'", playerId)) fail('ACTIVE_GAME_EXISTS');
    const total = this.catalog.dataset(body.city_id, board.active_dataset_version).filter(street => street.nivel === body.difficulty).length;
    const id = randomUUID();
    this.store.run(`INSERT INTO games VALUES (?,?,?,?,?,?,'active',0,0,?,0,?,NULL,?,NULL,0)`,
      id, playerId, body.city_id, body.difficulty, board.active_dataset_version, board.active_rules_version, total, now, now + DAY);
    this.newRound(this.owned(id, playerId));
    return { status: 201, body: this.view(this.owned(id, playerId)) };
  }
  action(playerId, id, body) {
    fields(body, ['round_id', 'type', 'answer'], ['round_id', 'type']);
    if (!uuid(body.round_id)) fail('INVALID_FIELD', 'round_id');
    if (!['answer', 'hint', 'skip', 'next'].includes(body.type)) fail('INVALID_FIELD', 'type');
    if (body.type === 'answer') {
      if (typeof body.answer !== 'string' || !body.answer.trim() || [...body.answer].length > 200) fail('INVALID_FIELD', 'answer');
    } else if (Object.hasOwn(body, 'answer')) fail('UNKNOWN_FIELD', 'answer');
    let game = this.owned(id, playerId);
    if (game.current_round_id !== body.round_id) fail('STALE_ROUND', 'round_id');
    const now = this.clock();
    if (game.status !== 'active' || now >= game.expires_at) fail('GAME_NOT_ACTIVE');
    const round = this.store.get('SELECT * FROM rounds WHERE id=? AND game_id=?', body.round_id, id);
    const street = this.catalog.dataset(game.city_id, game.dataset_version).find(item => streetId(item) === round.street_id);
    if ((body.type === 'next') !== Boolean(round.resolved)) fail('GAME_NOT_ACTIVE');
    let outcome = body.type;
    if (body.type === 'next') {
      this.newRound(game, street);
      this.store.run('UPDATE games SET revision=revision+1 WHERE id=?', id);
    } else {
      if (body.type === 'answer') outcome = matchesAnswer(body.answer, street) ? 'correct' : 'wrong';
      const solvedIds = this.store.all('SELECT street_id FROM solved_streets WHERE game_id=?', id).map(row => row.street_id);
      const state = updateState({ score: game.score, streak: game.streak, hinted: Boolean(round.hinted), resolved: false,
        solvedByLevel: { [game.difficulty]: solvedIds } }, outcome, street);
      const changed = state.score !== game.score || state.streak !== game.streak || state.hinted !== Boolean(round.hinted) || state.resolved !== Boolean(round.resolved);
      if (outcome === 'correct') this.store.run('INSERT INTO solved_streets VALUES (?,?,?)', id, round.street_id, state.score - game.score);
      this.store.run('UPDATE rounds SET hinted=?,resolved=?,outcome=? WHERE id=?', Number(state.hinted), Number(state.resolved), state.resolved ? outcome : null, round.id);
      const sum = this.store.get('SELECT COUNT(*) AS n, COALESCE(SUM(points),0) AS score FROM solved_streets WHERE game_id=?', id);
      const completed = sum.n === game.total;
      this.store.run('UPDATE games SET score=?,streak=?,solved_count=?,status=?,completed_at=?,revision=revision+? WHERE id=?',
        sum.score, state.streak, sum.n, completed ? 'completed' : 'active', completed ? now : null, Number(changed), id);
    }
    game = this.owned(id, playerId);
    return { status: 200, body: { outcome, game: this.view(game) } };
  }
  abandon(playerId, id, body) {
    fields(body, []);
    const game = this.owned(id, playerId);
    if (game.status !== 'abandoned') {
      if (game.status !== 'active' || this.clock() >= game.expires_at) fail('GAME_NOT_ACTIVE');
      this.store.run("UPDATE games SET status='abandoned',revision=revision+1 WHERE id=?", id);
    }
    return { status: 200, body: this.view(this.owned(id, playerId)) };
  }
}
