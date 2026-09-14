-- Briefings: article-style analysis that lives in the app (decision D12).
-- LLM jobs write these in Phase 3; DD texts only a short ping + link.

CREATE TABLE briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,            -- 'waiver' | 'lineup' | 'recap' | 'system'
  week INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  body TEXT NOT NULL,            -- markdown-lite (##, **, -, [text](url))
  created_at TEXT NOT NULL
);
CREATE INDEX idx_briefings_created ON briefings (id DESC);

INSERT INTO briefings (kind, week, title, body, created_at) VALUES (
  'system',
  1,
  'Control Room operational',
  '## Situation established

All four fronts are under continuous watch: **The League**, **SF Draftforce Fantasy FY27**, **ATL GRB Fantasy Football** (ESPN), and **Wildflower Meadows FF League** (Yahoo). Uplinks refresh every five minutes — faster during live game windows.

## Standing orders

- **Situation board** — live scores, projections, and scoreless-starter counts across all fronts.
- **Threat board** — injuries, zero-projection starters, and bench players outperforming starters. Every threat carries an EXECUTE link to the exact platform page where you act. This room observes; it does not touch your rosters.
- **Forces** — full rosters, projected vs. actual, down to the bench.
- **Intel** — league standings as they develop.

## Incoming traffic

Scheduled analysis begins shortly: a daily lineup evaluation each morning, a final pre-lock check Sunday, and the **Tuesday Waiver Wire Briefing** — the flagship dispatch, filed to this board with ranked targets, bid guidance, and drop candidates for each front. Notifications arrive by text: one line, with a link back to this room.

*Read-only by doctrine. All executions occur on the platforms themselves.*',
  datetime('now')
);
