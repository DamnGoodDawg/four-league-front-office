# Yahoo API access application — drafted answers

Form: https://sports.yahoo.com/developer/access/ (sign in to the Yahoo account that owns the league first).

The form warns that incomplete submissions "will be closed without further correspondence," so answer every field. Personal/single-league use is an explicitly recognized category on this form — lean into it. Request **Read** only.

| Form field | Suggested answer |
|---|---|
| Organization / who you are | Individual — personal project, not a company. |
| Product description | A private, personal-use dashboard that consolidates my own fantasy football teams (three ESPN leagues and one Yahoo league I am a member of) into a single read-only view of scores, rosters, matchups, and standings, so I can manage my own teams in one place. Not public, not commercial, no other users. |
| Data required | For the one Yahoo league I belong to: league settings and standings, my team's roster, weekly matchups/scoreboard, player data and projections, and league transactions (waivers/adds/drops), read-only. |
| Intended user base | Personal / single-league use. One user (myself). |
| Expected users, first 3–6 months | 1 |
| Access level | Read |
| Existing Client ID | Leave blank (none). |
| Additional notes | Read-only personal use for a league I'm a member of; no data redistribution, no commercial use, low request volume (a few syncs per day). |

## After submitting

- No published SLA. Approvals were being granted in Aug 2026; there are reports of a lag between the approval email and credentials actually working (backend sync), so don't be alarmed if the first calls 403 for a bit.
- When approval arrives, the next step is creating the app to receive a **Client ID and Client Secret**, then a one-time OAuth consent in the browser. Claude will walk through both; budget 15 minutes.
- Until then, the dashboard runs with the three ESPN leagues live and a "Yahoo — pending API approval" tile.
