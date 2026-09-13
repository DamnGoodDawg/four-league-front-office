-- Four-League Front Office — initial schema.
-- One row per league; leagues.id is "<platform>:<platform_league_id>".

CREATE TABLE leagues (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_league_id TEXT NOT NULL,
  name TEXT NOT NULL,
  season INTEGER NOT NULL,
  my_team_id TEXT NOT NULL,
  current_week INTEGER NOT NULL DEFAULT 1,
  deep_link TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE teams (
  league_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  ties INTEGER NOT NULL DEFAULT 0,
  points_for REAL NOT NULL DEFAULT 0,
  is_mine INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (league_id, team_id)
);

CREATE TABLE matchups (
  league_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  matchup_id TEXT NOT NULL,
  home_team_id TEXT,
  away_team_id TEXT,
  home_score REAL NOT NULL DEFAULT 0,
  away_score REAL NOT NULL DEFAULT 0,
  home_proj REAL NOT NULL DEFAULT 0,
  away_proj REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (league_id, week, matchup_id)
);

CREATE TABLE roster_slots (
  league_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT NOT NULL,
  slot TEXT NOT NULL,
  is_starter INTEGER NOT NULL DEFAULT 0,
  injury_status TEXT NOT NULL DEFAULT '',
  proj_points REAL NOT NULL DEFAULT 0,
  actual_points REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (league_id, team_id, week, player_id)
);

CREATE TABLE advice (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  deep_link TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_advice_league_week ON advice (league_id, week);

CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);
