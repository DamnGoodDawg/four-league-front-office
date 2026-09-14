# Build plan — from working pipes to finished product

Approved scope per Taylor (2026-09-13): **1) UI → 2) Plumbing → 3) LLM analysis.**
Waivers are the analysis priority; **trades are parked** (nice-to-have, revisit later — roster data for all teams exists, so it's feasible when wanted). Read-only throughout; every recommendation deep-links out.

## Phase 1 — UI: aesthetic + dashboard v2

**Needs Taylor first: pick the aesthetic direction** (recommendation: evolve the current dark "Front Office" scoreboard look with the condensed athletic type identity from the research report — Barlow Condensed headers, tabular numerals, field-green accent, ESPN/Yahoo platform chips).

- Apply the chosen design system across the app: type scale, spacing, light + dark done properly.
- **Matchup cards v2:** players-yet-to-play count per side, live-game indicator, top scorer, projected-outcome bar; tap through to a matchup detail view (my starters vs opponent starters, side by side).
- **Roster view v2:** position badges, status colors, proj-vs-actual delta highlighting, bench sorted by relevance.
- **Alerts center:** grouped by league, severity-ordered, each with its deep link; clean empty state.
- **Standings tab:** record, points-for, rank per league (data already synced for ESPN; Yahoo standings scrape is small — piggybacks the existing parser).
- **Proper PWA:** manifest, app icon, standalone display, apple-touch-icon — a real home-screen app.
- **Trust surfaces:** "last synced Xm ago" staleness banner, per-source health chip, cookie-expired banner with the re-grab runbook inline.

Deliverable: the same URL, feeling like a product. No new data dependencies.

## Phase 2 — Plumbing: freshness + the analysis rails

- **Game-window-aware cadence:** cron stays ≤3 schedules; the handler decides depth — every ~2 min effective during NFL game windows (Thu/Sun/Mon), 15 min otherwise, hourly overnight; Tuesday morning stat-correction re-pull.
- **Waiver-wire data (the analysis fuel):**
  - ESPN free agents via `kona_player_info` + `X-Fantasy-Filter` (top available by projection, per position, per league) + FAAB balances where the league uses FAAB.
  - Yahoo available players via the classic players page (same parser approach + same self-validation ethos).
  - Stored per league: top-N adds w/ projections + my drop candidates.
- **Yahoo opponent roster** fetch (one extra page) so matchup detail is complete on Yahoo too.
- **Analysis rails:** `GET /api/analysis-bundle` (everything an LLM needs in one payload: rosters, matchups, waiver candidates, schedule context) and `POST /api/advice` (token-authed; LLM writes ranked advice back; dashboard renders it with provenance).
- **Ops:** consecutive-failure alert → DD text ("ESPN cookie expired, 2-min fix"), so silent rot is impossible.

**Needs Taylor: pick the LLM runtime** (recommendation below in "Two decisions").

## Phase 3 — LLM analysis: judgment on a schedule

All jobs deliver via DD text + dashboard, always citing sources (D6), always deep-linking. Quiet when nothing's actionable.

- **Daily lineup eval (8:00am ET):** injuries overnight, projection swings, bye-week traps across all four teams; texts only when something needs action.
- **Sunday pre-lock check (11:30am ET):** final starters audit — inactives, late news (LLM session can search news), "you have X locked players, Y decisions left."
- **Tuesday waiver digest (7:00am ET) — the priority:** per league: ranked add targets with the projection case, FAAB bid suggestion where applicable, who to drop, and the direct claim link. Cross-league view ("Player X is available in 2 of your leagues").
- **Trades: parked.** Backlog note: all-team rosters are already synced, so a trade-fit analyzer is buildable later without new plumbing.

## Two decisions gating the start

1. **Aesthetic direction** (Phase 1): a) evolve current dark scoreboard + athletic condensed type (recommended); b) clean light "paper almanac" look; c) broadcast-graphics maximal. 
2. **LLM runtime** (Phase 2/3): a) **scheduled Claude Code tasks on the Mac (recommended)** — uses the existing subscription (no per-call API cost), can search the web for news, and owns DD texting natively; writes advice to the Worker via `/api/advice`; b) Anthropic API key called from the Worker on cron — fully serverless, works with the Mac asleep, but adds API billing and needs a key.
   - Note the honest tradeoff: (a) requires the Mac to be on at job times; (b) costs money per run. A hybrid is possible later (Worker does rule-based always; Mac does LLM when awake).

## Additions from the fantasy-app UI scan (2026-09-13)
Stolen into Phase 1: ESPN's pinned always-visible scores (our all-fronts ticker); dense mono rows; staleness always visible (their 2025 redesign died on slowness + silent zeros — our anti-goals confirmed).
Queued for Phase 2 plumbing: **Sleeper trending add/drop API** (free, public — `players/nfl/trending`) as waiver signal + ▲▼ chips on players; **cross-league transaction feed** (ESPN `mPendingTransactions` view + Yahoo transactions page); day-aware action stack ("Tue: waivers close in A + C") lands with Phase 3 scheduling.
