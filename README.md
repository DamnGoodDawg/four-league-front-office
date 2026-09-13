# Four-League Front Office

A **private, single-user, read-only dashboard** that consolidates my four 2026 fantasy football teams — three ESPN leagues and one Yahoo league I'm a member of — into one place: scores, rosters, matchups, standings, and lineup/waiver suggestions. When the dashboard suggests a change, it deep-links to the relevant league page on the platform itself, where I make the move by hand.

Personal project. Not commercial, no other users, no data redistribution.

**Status:** pre-build. Yahoo Fantasy Sports API access application pending; scaffolding only.

## How it will work

- A small Cloudflare Worker syncs league data on a schedule (a few times a day; low request volume) into one normalized schema, and serves a web dashboard I use from Safari on my phone.
- Daily jobs evaluate my lineups (injured or bye-week starters, projection disagreements between sources) and a Tuesday job summarizes the waiver wire.
- **Read-only by design.** The app makes no changes to any platform — every suggestion links out to the platform's own UI instead. Any future write capability would only use officially supported paths.

Details: [docs/architecture.md](docs/architecture.md). Other working documents (prerequisites checklist, decision log, application notes) are kept locally and aren't published.

## Data sources

- ESPN fantasy data for my three leagues (authenticated as myself).
- Yahoo Fantasy Sports API (read-only) for my one Yahoo league — pending API access approval.
- Open NFL data (nflverse) for projections context.

## Secrets

Copy `.env.example` to `.env` and fill it in locally. `.env` is gitignored and never leaves my machine; cookies and tokens are never committed or logged.
