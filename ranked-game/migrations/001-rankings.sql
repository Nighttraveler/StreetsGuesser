CREATE TABLE players (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL) STRICT;
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX sessions_player ON sessions(player_id);
CREATE TABLE usernames (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE RESTRICT,
  username TEXT NOT NULL UNIQUE COLLATE BINARY CHECK(length(username) BETWEEN 3 AND 20 AND instr(username,char(0))=0 AND username NOT GLOB '*[^a-z0-9_]*'
    AND username NOT IN ('admin','administrator','moderator','support','system','anonymous')),
  claimed_at INTEGER NOT NULL
) STRICT;
CREATE TABLE cities (id TEXT PRIMARY KEY, display_name TEXT NOT NULL) STRICT;
CREATE TABLE datasets (
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT, version TEXT NOT NULL,
  content_hash TEXT NOT NULL, immutable_path TEXT NOT NULL, PRIMARY KEY(city_id, version)
) STRICT;
CREATE TABLE boards (
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  difficulty INTEGER NOT NULL CHECK(difficulty IN (1,2,3)),
  active_dataset_version TEXT NOT NULL, active_rules_version TEXT NOT NULL,
  PRIMARY KEY(city_id, difficulty), FOREIGN KEY(city_id, active_dataset_version) REFERENCES datasets(city_id, version) ON DELETE RESTRICT
) STRICT;
CREATE TABLE games (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  city_id TEXT NOT NULL, difficulty INTEGER NOT NULL, dataset_version TEXT NOT NULL, rules_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','completed','abandoned','expired')),
  score INTEGER NOT NULL CHECK(score>=0), streak INTEGER NOT NULL CHECK(streak>=0),
  total INTEGER NOT NULL CHECK(total>0), solved_count INTEGER NOT NULL CHECK(solved_count BETWEEN 0 AND total),
  started_at INTEGER NOT NULL, completed_at INTEGER, expires_at INTEGER NOT NULL,
  current_round_id TEXT, revision INTEGER NOT NULL CHECK(revision>=0),
  FOREIGN KEY(city_id,difficulty) REFERENCES boards(city_id,difficulty) ON DELETE RESTRICT,
  FOREIGN KEY(city_id,dataset_version) REFERENCES datasets(city_id,version) ON DELETE RESTRICT,
  CHECK(status!='completed' OR (solved_count=total AND completed_at IS NOT NULL AND completed_at<expires_at))
) STRICT;
CREATE INDEX games_player ON games(player_id,started_at);
CREATE UNIQUE INDEX games_one_active ON games(player_id) WHERE status='active';
CREATE TABLE rounds (
  id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL, street_id TEXT NOT NULL,
  hinted INTEGER NOT NULL CHECK(hinted IN (0,1)), resolved INTEGER NOT NULL CHECK(resolved IN (0,1)),
  outcome TEXT CHECK(outcome IN ('correct','skip')), UNIQUE(game_id,ordinal)
) STRICT;
CREATE TABLE solved_streets (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE RESTRICT, street_id TEXT NOT NULL,
  points INTEGER NOT NULL CHECK(points IN (5,10)), PRIMARY KEY(game_id,street_id)
) STRICT;
CREATE TABLE submissions (
  game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE RESTRICT,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT, created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE leaderboard_entries (
  city_id TEXT NOT NULL, difficulty INTEGER NOT NULL, dataset_version TEXT NOT NULL, rules_version TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  game_id TEXT NOT NULL UNIQUE REFERENCES submissions(game_id) ON DELETE RESTRICT,
  score INTEGER NOT NULL CHECK(score>=0), completed_at INTEGER NOT NULL,
  PRIMARY KEY(city_id,difficulty,dataset_version,rules_version,player_id),
  FOREIGN KEY(city_id,difficulty) REFERENCES boards(city_id,difficulty) ON DELETE RESTRICT,
  FOREIGN KEY(city_id,dataset_version) REFERENCES datasets(city_id,version) ON DELETE RESTRICT
) STRICT;
CREATE INDEX leaderboard_order ON leaderboard_entries(city_id,difficulty,dataset_version,rules_version,score DESC,completed_at ASC,game_id ASC);
CREATE TABLE idempotency (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT, key TEXT NOT NULL,
  method TEXT NOT NULL, path TEXT NOT NULL, request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL, response_json TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(player_id,key)
) STRICT;
CREATE TRIGGER completed_game_immutable BEFORE UPDATE ON games WHEN OLD.status='completed'
BEGIN SELECT RAISE(ABORT,'completed game immutable'); END;
CREATE TRIGGER completed_round_immutable BEFORE UPDATE ON rounds
WHEN (SELECT status FROM games WHERE id=OLD.game_id)='completed'
BEGIN SELECT RAISE(ABORT,'completed round immutable'); END;
CREATE TRIGGER submission_immutable BEFORE UPDATE ON submissions
BEGIN SELECT RAISE(ABORT,'submission immutable'); END;
CREATE TRIGGER username_immutable BEFORE UPDATE ON usernames
BEGIN SELECT RAISE(ABORT,'username immutable'); END;
