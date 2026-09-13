# Prerequisites — the parts that need Taylor's hands

Ordered by lead time: item 1 has an unknown approval queue, so it goes first. Items 2–3 take ~10 minutes total. Everything else Claude handles.

## 1. ✅ DONE — Yahoo API application submitted Sept 13, 2026 (confirmation shown on-site; watch tkb5047@gmail.com for the reply)

- **Where:** https://sports.yahoo.com/developer/access/ (portal home: https://sports.yahoo.com/developer)
- Sign in to the Yahoo account that owns your fantasy league first.
- Use the pre-drafted answers in [yahoo-application.md](yahoo-application.md). Request **Read** access only — write access isn't granted to individuals anyway, and asking for it requires extra justification that can slow approval.
- Expect no published timeline. Approvals were being granted as of Aug 2026, sometimes with a lag before credentials actually work. When the approval email arrives, say so — the next step (creating the app to get a Client ID/Secret) comes after approval, and Claude will walk through it.
- **Why bother if a bridge exists:** the free hosted bridge (flaim) is fine for asking Claude questions in the meantime, but the dashboard's scheduled sync shouldn't depend on a third-party hobby gateway carrying your league data. Own credentials are direct, private, and durable. The application is free and short; submitting today is what keeps it off the critical path.

## 2. Grab your ESPN cookies → put them in `.env` (~5 min)

One extraction covers all three ESPN leagues (cookies are account-scoped).

**Safari:**
1. Safari → Settings → Advanced → check **"Show features for web developers"** (if not already on).
2. Go to https://fantasy.espn.com and make sure you're logged in.
3. Menu bar: **Develop → Show Web Inspector** → **Storage** tab → **Cookies** → the espn.com entry.
4. Find `espn_s2` (a very long value, ~250+ characters — copy **all** of it) and `SWID` (short, includes the curly braces `{...}`).

**Chrome (alternative):** DevTools (⌥⌘I) → Application tab → Cookies → https://fantasy.espn.com → same two values.

**Then:** in this project folder, `cp .env.example .env` and paste the two values into `.env`.

> Do **not** paste these values into chat, messages, or anywhere else — they are the keys to your ESPN account session. They live only in `.env`, which is gitignored. If ESPN calls ever start failing months from now, the fix is just repeating this step (espn_s2 eventually expires; SWID effectively doesn't).

## 3. Collect your four league URLs (~2 min, not secret)

These identify the leagues; they're fine to paste in chat or drop in `.env`.

- Open each of the 3 ESPN leagues and copy the browser URL (it contains `leagueId=`).
- Open the Yahoo league and copy its URL (looks like `https://football.fantasysports.yahoo.com/f1/<number>`).

## Already handled — nothing needed

- **Cloudflare:** wrangler is installed on this Mac and already logged in to your Cloudflare account. Deploys need nothing from you.
- **Text alerts:** the DD iMessage bot is set up on this Mac and will carry the Tuesday digest / lineup alerts.
- **Node/git toolchain:** Node 26, npm 11, git 2.39 — all present.

## When 2 and 3 are done

Say "cookies are in" (and paste the league URLs) — the build starts from there: ESPN sync against your three leagues first, dashboard skeleton, then jobs. Yahoo slots in the moment the approval lands.
