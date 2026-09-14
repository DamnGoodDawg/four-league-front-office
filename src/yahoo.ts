import { parse } from "node-html-parser";
import type { LeagueRow, MatchupRow, NormalizedLeague, RosterSlotRow, TeamRow } from "./model";

/**
 * Yahoo source (no official API). Reads the logged-in classic web pages with the
 * user's session cookie (YAHOO_COOKIE) — Yahoo does not grant the read/write API
 * to individuals, so this cookie-read IS the permanent read path, not a stopgap.
 * Returns the same NormalizedLeague shape as ESPN: league, teams, matchup, and
 * the full roster (starters + bench) with per-player projected/actual points and
 * injury status — so the dashboard and advice engine treat Yahoo identically.
 *
 * The roster is parsed with a real HTML parser (node-html-parser), not regex, so
 * Yahoo's nested tables are handled correctly. If Yahoo ever reshapes the classic
 * markup, `parseRoster` degrades to an empty roster (matchup headline still works)
 * and the sync detail flags the drop — it never silently shows stale data.
 */

/** Yahoo injury abbreviations -> the vocabulary generateAdvice() expects. */
const STATUS_MAP: Record<string, string> = {
  O: "OUT", OUT: "OUT", D: "DOUBTFUL", Q: "QUESTIONABLE", GTD: "QUESTIONABLE",
  DTD: "QUESTIONABLE", IR: "INJURY_RESERVE", "IR-R": "INJURY_RESERVE",
  SUS: "SUSPENSION", SUSP: "SUSPENSION", PUP: "OUT", NFI: "OUT", NA: "OUT",
};
const INJURY_TOKENS = new Set(Object.keys(STATUS_MAP));

/** Yahoo roster slot labels -> our slot vocabulary. */
const SLOT_MAP: Record<string, string> = {
  QB: "QB", RB: "RB", WR: "WR", TE: "TE", "W/R/T": "FLEX", "W/R": "RB/WR",
  "Q/W/R/T": "OP", K: "K", DEF: "D/ST", "D/ST": "D/ST", BN: "Bench", IR: "IR",
};
const NON_STARTING = new Set(["Bench", "IR"]);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

export type YahooStatus = "ok" | "skipped" | "session-expired" | "error";

export interface YahooResult {
  status: YahooStatus;
  detail: string;
  data?: NormalizedLeague;
}

export function yahooLeagueLink(leagueId: string, teamNum?: string): string {
  if (!leagueId) return "https://football.fantasysports.yahoo.com/";
  const base = `https://football.fantasysports.yahoo.com/f1/${leagueId}`;
  return teamNum ? `${base}/${teamNum}` : base;
}

function unescapeText(s: string): string {
  return s
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|’/g, "’")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function prString(html: string, name: string): string | null {
  const m = html.match(new RegExp(`"varPR${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? unescapeText(m[1]) : null;
}

function prNumber(html: string, name: string): number {
  const m = html.match(new RegExp(`"varPR${name}"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)`));
  return m ? Number(m[1]) : 0;
}

async function get(url: string, cookie: string): Promise<{ status: number; location: string; html: string }> {
  const res = await fetch(url, { headers: { Cookie: cookie, "User-Agent": UA }, redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  if (res.status >= 300 && res.status < 400) {
    await res.body?.cancel();
    return { status: res.status, location, html: "" };
  }
  return { status: res.status, location, html: await res.text() };
}

function looksLikeLogin(status: number, location: string, html: string): boolean {
  if (status >= 300 && status < 400) return /login\.yahoo|account/i.test(location);
  return /login\.yahoo\.com|Sign in to Yahoo/i.test(html) && !/Sign Out|logout/i.test(html);
}

/** Find my team number: env override, else the "My Team" link on the league home. */
function discoverMyTeam(homeHtml: string, leagueId: string, override?: string): string | null {
  if (override) return override;
  const re = new RegExp(`href="/f1/${leagueId}/(\\d+)"[^>]*>\\s*My Team`, "i");
  const m = homeHtml.match(re);
  if (m) return m[1];
  const alt = homeHtml.match(new RegExp(`/f1/${leagueId}/(\\d+)/team`, "i"));
  return alt ? alt[1] : null;
}

function cellText(el: { text?: string } | null | undefined): string {
  return (el?.text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Parse the full roster from a team page. Anchors on each row's slot cell
 * (the one carrying data-pos), which every roster row has exactly one of, then
 * reads the stable leading columns: [0] slot, player-name anchor, [3] bye,
 * [4] Fan Pts (actual), [5] Proj Pts. Columns after those differ per position
 * group, but these six are consistent across all stat tables.
 */
function parseRoster(html: string, leagueId: string, teamId: string, week: number): RosterSlotRow[] {
  const root = parse(html);
  const out: RosterSlotRow[] = [];
  const seen = new Set<string>();

  for (const slotEl of root.querySelectorAll("span[data-pos]")) {
    const rawSlot = slotEl.getAttribute("data-pos") ?? "";
    const row = slotEl.closest("tr");
    if (!row) continue;
    const anchor = row.querySelector("a[data-ys-playerid]");
    const cells = row.querySelectorAll("td");
    if (cells.length < 6) continue; // header / spacer rows

    const slot = SLOT_MAP[rawSlot] ?? rawSlot;
    const isStarter = NON_STARTING.has(slot) ? 0 : 1;

    let playerId = anchor?.getAttribute("data-ys-playerid") ?? "";
    let name = cellText(anchor) || "Empty slot";
    if (!playerId) { name = "Empty slot"; playerId = `empty-${rawSlot}-${out.length}`; }
    if (seen.has(playerId)) continue;
    seen.add(playerId);

    const nameCellText = cellText(cells[2]);
    const posMatch = nameCellText.match(/\s-\s([A-Z/]{1,4})\b/); // "Chi - QB"
    const position = posMatch ? posMatch[1] : (slot === "D/ST" ? "D/ST" : rawSlot);

    // Injury token sits in the name cell after the player link.
    let status = "";
    for (const tag of cells[2]?.querySelectorAll("span, abbr, em") ?? []) {
      const tok = cellText(tag).toUpperCase();
      if (INJURY_TOKENS.has(tok)) { status = STATUS_MAP[tok]; break; }
    }

    const num = (s: string): number => { const m = s.match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : 0; };
    out.push({
      league_id: `yahoo:${leagueId}`,
      team_id: teamId,
      week,
      player_id: playerId,
      player_name: name,
      position,
      slot,
      is_starter: isStarter,
      injury_status: status,
      proj_points: num(cellText(cells[5])),
      actual_points: num(cellText(cells[4])),
    });
  }
  return out;
}

export async function fetchYahooLeague(env: Env): Promise<YahooResult> {
  const cookie = env.YAHOO_COOKIE ?? "";
  const leagueId = env.YAHOO_LEAGUE_ID ?? "";
  if (!cookie || !leagueId) {
    return { status: "skipped", detail: "Awaiting Yahoo session cookie + league id (or API approval)." };
  }

  try {
    const home = await get(yahooLeagueLink(leagueId), cookie);
    if (looksLikeLogin(home.status, home.location, home.html)) {
      return { status: "session-expired", detail: "Yahoo session expired — re-grab the cookie from a logged-in browser." };
    }
    if (home.status !== 200) {
      return { status: "error", detail: `Yahoo league home returned HTTP ${home.status}.` };
    }

    const myTeam = discoverMyTeam(home.html, leagueId, env.YAHOO_TEAM_ID);
    if (!myTeam) {
      return { status: "error", detail: "Could not locate my Yahoo team number on the league page." };
    }

    const team = await get(yahooLeagueLink(leagueId, myTeam), cookie);
    if (looksLikeLogin(team.status, team.location, team.html)) {
      return { status: "session-expired", detail: "Yahoo session expired mid-read — re-grab the cookie." };
    }
    if (team.status !== 200) {
      return { status: "error", detail: `Yahoo team page returned HTTP ${team.status}.` };
    }
    const html = team.html;

    const leagueName = prString(html, "League") ?? `Yahoo league ${leagueId}`;
    const myName = prString(html, "CurrTeamName") ?? "My team";
    const oppName = prString(html, "OppTeamName") ?? "Opponent";
    const myScore = prNumber(html, "CurrTeamWeekScore");
    const oppScore = prNumber(html, "OppTeamWeekScore");
    const myProj = prNumber(html, "CurrTeamWeekProjectedPts");
    const oppProj = prNumber(html, "OppTeamWeekProjectedPts");

    // Matchup card: "Week N vs <a href=".../f1/<league>/<oppNum>">Opp</a>"
    const card = html.match(new RegExp(`Week\\s+(\\d+)\\s+vs\\s+<a[^>]*/f1/${leagueId}/(\\d+)`, "i"));
    const week = card ? Number(card[1]) : 1;
    const oppTeam = card ? card[2] : "opp";

    const myRecord = html.match(/Fw-b Fz-xxl">\s*(\d+)-(\d+)-(\d+)\s*</);
    const [, w = "0", l = "0", t = "0"] = myRecord ?? [];

    const rosters = parseRoster(html, leagueId, myTeam, week);
    const starterSum = rosters.filter((r) => r.is_starter).reduce((s, r) => s + r.actual_points, 0);
    const rosterNote =
      rosters.length === 0
        ? " — ⚠ roster parse returned 0 players (Yahoo markup may have changed)"
        : ` — ${rosters.length} players parsed (starters sum ${starterSum.toFixed(1)} vs card ${myScore})`;

    const id = `yahoo:${leagueId}`;
    const now = new Date().toISOString();

    const league: LeagueRow = {
      id, platform: "yahoo", platform_league_id: leagueId, name: leagueName,
      season: Number(env.ESPN_SEASON), my_team_id: myTeam, current_week: week,
      deep_link: yahooLeagueLink(leagueId, myTeam), updated_at: now,
    };
    const teams: TeamRow[] = [
      { league_id: id, team_id: myTeam, name: myName, wins: +w, losses: +l, ties: +t, points_for: myScore, is_mine: 1 },
      { league_id: id, team_id: oppTeam, name: oppName, wins: 0, losses: 0, ties: 0, points_for: oppScore, is_mine: 0 },
    ];
    const matchups: MatchupRow[] = [
      {
        league_id: id, week, matchup_id: `${myTeam}-${oppTeam}`,
        home_team_id: myTeam, away_team_id: oppTeam,
        home_score: myScore, away_score: oppScore, home_proj: myProj, away_proj: oppProj,
      },
    ];

    return {
      status: "ok",
      detail: `"${leagueName}" week ${week}: ${myName} ${myScore} vs ${oppName} ${oppScore}${rosterNote}`,
      data: { league, teams, matchups, rosters },
    };
  } catch (err) {
    return { status: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}
