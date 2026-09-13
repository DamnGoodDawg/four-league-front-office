# Phase 1 architecture sketch

*A sketch, not a spec — refined when the build starts. Decisions it rests on: [decisions.md](decisions.md).*

```
                 ┌────────────────────────── Cloudflare ──────────────────────────┐
  ESPN v3 API ──▶│  Worker (TypeScript)                                           │
  (cookie auth)  │   • cron sync → normalize into one schema → D1                 │
                 │   • analysis pass → advice + alerts tables                     │
  Yahoo API ────▶│   • serves PWA dashboard + small JSON API                      │
  (OAuth, when   │   • secrets: ESPN cookies, Yahoo tokens (never in code/git)    │
   approved)     └───────────────┬───────────────────────────┬────────────────────┘
                                 │                           │
                       Safari / iPhone PWA          Mac: scheduled task reads
                       (add to home screen)         /alerts → DD iMessage text
```

## The unified model (one schema, four leagues)

`League` (platform, ids, scoring settings) → `Team` (record, standing, is_mine) → `RosterSlot` (player, position, starter/bench, locked) → `Player` (status, bye, projections **per source**) → `Matchup` (week, live + projected scores). Plus `Advice` (type, severity, evidence, deep_link) and `AlertLog` (what was sent, when — so texts never repeat).

## Jobs (Worker cron)

| When | Job |
|---|---|
| Frequent during game windows, hourly otherwise | Sync all leagues; refresh live scores |
| Daily, morning | **Lineup evaluation** per team: injured/out/doubtful starters, bye-week starters, bench player whose projection beats a starter's ("Source X projects A 4.1 pts over B — consider the swap"), empty or locked-slot warnings |
| Tuesday, morning (post-waiver-run) | **Waiver digest**: top available players per league vs. weakest rostered, FAAB context, drop candidates |
| On findings | Write `Advice` rows; queue alerts |

## Alerts & deep links

Every advice row carries a link to the *exact* place to act:

- ESPN team page: `https://fantasy.espn.com/football/team?leagueId=<L>&teamId=<T>` (roster/lineup screen)
- Yahoo team page: `https://football.fantasysports.yahoo.com/f1/<league>/<team>`

Delivery: dashboard always; texts via DD for anything urgent (starter ruled out, lineup lock approaching with a flagged starter) and the Tuesday digest. A tiny scheduled task on the Mac polls the Worker's `/alerts` endpoint and hands messages to DD — keeps iMessage local, keeps the Worker simple.

## Sync sources

- **ESPN (3 leagues):** direct TS client against `lm-api-reads.fantasy.espn.com` v3 with `espn_s2`/`SWID` cookie header; views `mTeam`, `mRoster`, `mMatchup`, `mBoxscore`, `mSettings`, `kona_player_info` (projections). Modest request volume, pinned behavior, loud failures (a sync error must never silently show stale scores as live).
- **Yahoo (1 league):** official v2 REST once approved — OAuth refresh handled in the Worker, XML-flavored JSON normalized at the edge of the client and never allowed past it. Until approval: dashboard shows a "pending" tile.

## Not in Phase 1

Write-back of any kind; trades analysis; historical seasons; multi-user anything.
