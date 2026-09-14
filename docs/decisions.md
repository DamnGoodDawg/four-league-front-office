# Decision log

## D1 — Phase 1 is read-only (2026-09-13)
No write-back to ESPN or Yahoo in this phase. Every recommendation instead carries a **deep link to the exact platform page** (specific league, specific team) where Taylor makes the change by hand in ~two taps. Rationale: Yahoo write access is closed to individuals; ESPN write access works but is ToS-gray with a one-week public track record. Revisit after the read-only hub has run reliably for a while.

## D2 — No FantasyPros subscription; documented as a fallback (2026-09-13)
Taylor is not paying for FantasyPros (~$6–9/mo). Rationale: cost, and it wouldn't deliver the actual vision (a custom cross-league view with his own rules) anyway — building it ourselves is the point.

**What FantasyPros would offer if circumstances change** (kept here so it's not relitigated from scratch):
- *Auto-Pilot* (MVP tier, $5.99/mo annual, 10 leagues): the only **supported** path that pushes lineup changes server-side into both ESPN and Yahoo, with confirm-by-email and one-click revert.
- *HOF tier* ($8.99/mo annual): adds a personal FantasyPros API key — the cleanest licensed feed of expert-consensus rankings (ECR) for custom tooling.

**Reopen triggers:** (a) we later want sanctioned write-push, especially into Yahoo, where no individual API path exists; (b) ESPN hardens its API and our read path degrades; (c) the free projection sources prove too weak and we want licensed expert consensus.

## D3 — Build our own, hosted on Cloudflare Workers (2026-09-13)
Centralized app + daily jobs need an always-on host; Taylor is a heavy Cloudflare user and wrangler is already authenticated on this Mac. The reference multi-platform MCP (flaim) runs on Workers, validating the pattern. Sync/analysis logic stays cleanly separated so it could run locally if we ever change hosts.

## D4 — ESPN via direct TypeScript client, not the Python library (2026-09-13)
The mature `espn-api` library is Python; the Worker is TypeScript. The ESPN v3 API is plain JSON-over-HTTPS with a cookie header, so we write a thin TS client for exactly the views we need (`mTeam`, `mRoster`, `mMatchup`, `mBoxscore`, `mSettings`, `kona_player_info`), using the Python library's source as the reference for shapes and quirks. Fewer moving parts, one runtime.

## D5 — Apply for Yahoo's own API access now; bridge only as a stopgap (2026-09-13)
The flaim hosted MCP can answer Yahoo questions in Claude conversations during the wait, but the app's scheduled sync will not take a dependency on a third-party hobby gateway. Dashboard v1 ships with 3 ESPN leagues live + a "Yahoo pending approval" tile; the Yahoo module slots in when credentials arrive. Application answers: [yahoo-application.md](yahoo-application.md).

## D6 — Advice grounded in data, free sources first (2026-09-13)
v1 advice inputs: each platform's **native projections** (both APIs expose them), cross-source disagreement between them, injury/status flags, bye-week detection, and waiver-wire deltas (available player projected > current starter). Open data via nflverse/`nflreadpy` as needed. Research showed crowd/vibes-based advice measurably underperforms expert consensus — so recommendations always show *which source says what*, and licensed ECR (see D2) is the paid upgrade path if free sources disappoint.

## D7 — Alerts via DD iMessage (2026-09-13)
Daily lineup evaluation and the Tuesday waiver digest notify Taylor by text through the existing DD bot on this Mac. Every alert includes the deep link from D1.

## D8 — Yahoo: plan as if the API never arrives (2026-09-13, Taylor)
Application submitted and acknowledged (Yahoo quotes 1–2 weeks review). Direction from Taylor: don't block on it — treat API approval as a bonus phase. Interim Yahoo connectivity via his logged-in session cookie behind a swappable source interface (`src/yahoo.ts`); the API implementation replaces it if/when approved.

## D9 — Connectivity before app experience (2026-09-13, Taylor)
Build order: all four data pipes proven in production before investing in the dashboard experience. Status at time of writing: ESPN ×3 live on Cloudflare (15-min cron, D1, token-gated API), thin UI shell frozen, Yahoo pipe awaiting session cookie + league id.

## D10 — Yahoo read = permanent cookie-scrape, not an API stopgap (2026-09-13, Taylor's steer, SUPERSEDES the framing in D8)
Taylor's correction: assume the official API never arrives for an individual ("Yahoo offers it to apps, not randoms"). Punting player-level Yahoo data to that API broke the core goal (manage my team from one app). So the cookie-read of Yahoo's classic web pages is the **permanent read architecture**, and it now has full parity with ESPN: league, matchup, and the complete roster (starters + bench) with per-player projected/actual points and injury status, feeding the same advice engine.

Robustness (this is what makes scraping acceptable as permanent, not fragile):
- Parsed with a real HTML parser (`node-html-parser`), not regex — handles Yahoo's nested tables. Slot anchored on `span[data-pos]`; leading columns (slot, player, bye[3], Fan Pts/actual[4], Proj Pts[5]) are stable across all position tables.
- **Self-validating**: each sync sums starters' actual points and compares to Yahoo's own week-score value; the sync detail shows both so drift is visible. Matched to the decimal (181.7 vs 181.73) at build time.
- **Graceful degradation**: if Yahoo reshapes the markup, roster parse returns 0, the sync detail flags "⚠ roster parse returned 0", and the matchup headline still works — never silent stale data.
- Cookie expiry surfaces as status "session-expired" with a re-grab prompt.

If the API is ever approved, it swaps in behind `fetchYahooLeague`'s NormalizedLeague return with no other changes — a bonus, not a dependency. Yahoo write-back (future phase) will be browser-automation regardless, since the Yahoo API never offered writes to anyone.

## D11 — Identity: "FF Control Room" (2026-09-13, Taylor)
UI branded FF Control Room: situation-room/geopolitical ops aesthetic, deliberately over-serious, dark-only (a control room has no light mode), mixed with proven fantasy-app conventions (live matchup cards, player status colors, waiver flows). Worker/infra name and URL unchanged; only the product face renames.

## D12 — Digests are in-app briefings; DD texts stay short (2026-09-13, Taylor)
Any digest/analysis reads like a sports article INSIDE the app (Briefings section). DD texts are one short line + a link to the app — never long, never frequent. Applies to the Tuesday waiver digest and all Phase 3 output.

## D13 — LLM runtime: Claude CLI scheduled on the Mac (2026-09-13, Taylor)
Use the house pattern — other projects on this Mac already schedule Claude CLI runs successfully (see their launchd/scheduling scaffolding, e.g. the Tempest setup, before building new). Jobs read the Worker's analysis bundle, write briefings/advice back via authenticated endpoint, ping via DD per D12.
