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
