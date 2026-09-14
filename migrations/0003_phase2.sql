-- Phase 2: waiver-wire data, trending signals, LLM advice lane, FAAB tracking.

-- Advice now has a source lane: 'rules' (regenerated every sync) vs 'llm' (written
-- via POST /api/advice, cleared only by the next LLM write for that league+week).
ALTER TABLE advice ADD COLUMN source TEXT NOT NULL DEFAULT 'rules';

-- FAAB context for my team, where the league uses a budget (nullable otherwise).
ALTER TABLE leagues ADD COLUMN faab_budget REAL;
ALTER TABLE leagues ADD COLUMN faab_spent REAL;

CREATE TABLE waiver_candidates (
  league_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  pro_team TEXT NOT NULL DEFAULT '',
  proj REAL,                 -- weekly projection (ESPN); NULL where unknown (Yahoo v1)
  pct_owned REAL,            -- % rostered across the platform
  note TEXT NOT NULL DEFAULT '',  -- e.g. 'FA' or 'Waivers — clears Sep 16'
  fetched_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (league_id, week, player_id)
);

CREATE TABLE trending (
  player_name TEXT PRIMARY KEY,
  position TEXT NOT NULL DEFAULT '',
  pro_team TEXT NOT NULL DEFAULT '',
  adds INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT ''
);
