# Four-League Front Office — project brief for Claude

Personal, single-user, **read-only** dashboard consolidating Taylor's four 2026 fantasy football leagues (3 ESPN + 1 Yahoo) on Cloudflare Workers. Every suggestion deep-links to the platform page where Taylor makes the change by hand. Write-back is a future, decision-gated phase.

## Ground truth documents (read before changing direction)
- `docs/decisions.md` — the decision log (D1–D10). Append new decisions; never silently relitigate one. Key: **D10** — Yahoo read is the *permanent* cookie-scrape path; do NOT plan around the Yahoo API (individuals don't get it). **D2** — no paid subscriptions (FantasyPros rejected). **D6** — advice must cite its data source. **D9** — connectivity before app experience.
- `docs/build-plan.md` — the approved phased plan (UI → Plumbing → LLM analysis; **waivers matter, trades are parked**).
- `docs/architecture.md`, `docs/prereqs.md` — sketch + setup history.

## Stack & commands
- Cloudflare Worker (TypeScript, no framework) + D1 (`four-league-db`) + cron. Deployed at `four-league-front-office.damngooddawg.workers.dev`.
- `npm run check` (tsc) → `npx wrangler dev --port 8787` (local, uses `.dev.vars`) → `npm run deploy`. Run `npx wrangler types` after config changes.
- Local test pattern: `curl -c jar "localhost:8787/api/data?t=$TOKEN"` then `curl -b jar -X POST localhost:8787/api/sync`.
- Migrations in `migrations/`; apply with `wrangler d1 migrations apply four-league-db --local|--remote`.

## Secrets — non-negotiable rules
- All secrets live in `.env` (Taylor's hands) → mirrored to `.dev.vars` (local) and `wrangler secret put` (prod), always **piped from `.env`, never typed or echoed**. Never print secret values into chat, logs, commits, or tool output. `.env`/`.dev.vars` are gitignored; verify with `git ls-files` before pushing if in doubt.
- Secrets: `ESPN_S2`, `ESPN_SWID` (one pair covers all 3 ESPN leagues), `ESPN_LEAGUE_IDS`, `ESPN_TEAM_IDS`, `YAHOO_COOKIE`, `YAHOO_LEAGUE_ID` (110723), `YAHOO_TEAM_ID` (6), `DASHBOARD_TOKEN` (the `?t=` in Taylor's private link).
- Cookies expire eventually: surface as a visible "re-grab" state, never silent failure. ESPN: DevTools → Application → Cookies. Yahoo: Network → Doc → top request → Cookie header (must contain `A1=`, `A3=`, `T=`).

## Source conventions
- `src/espn.ts` — ESPN v3 (`lm-api-reads.fantasy.espn.com`), views `mSettings/mTeam/mRoster/mMatchupScore/mScoreboard`; weekly stats: `statSourceId` 0=actual 1=projected at current `scoringPeriodId`.
- `src/yahoo.ts` — parses Yahoo's classic logged-in pages with **node-html-parser (never regex — tables nest)**. Invariants: roster rows anchor on `span[data-pos]`; leading cells are stable (`[3]` bye, `[4]` Fan Pts=actual, `[5]` Proj Pts); **self-validation**: starters' actual sum must match Yahoo's own week score (`varPR*` block) — the sync detail prints both; roster-parse failure returns 0 players with a ⚠ flag while the matchup headline survives. Yahoo statuses/slots normalize through `STATUS_MAP`/`SLOT_MAP` so the shared advice engine works unchanged.
- Both sources return `NormalizedLeague` (`src/model.ts`); `src/sync.ts` persists idempotently (upserts; delete-then-insert per week for rosters/matchups/advice).
- Advice engine `src/advice.ts` is deterministic rules; LLM analysis is a separate layer (see build plan) and must always show which number/source backs a recommendation.

## Working with Taylor
- Build-over-buy, no subscriptions; read-only-first risk posture; surface anything needing his hands *first* so he can parallelize; he steers phases explicitly — deliver the current phase, don't gold-plate ahead.
- Notifications go through the DD iMessage bot (`dd-notify` skill on this Mac): one text per event, never progress-spam, tokened links via DD not chat.
- Auto-memory (`project-four-league-hub` et al.) tracks live state; update it at meaningful milestones.
