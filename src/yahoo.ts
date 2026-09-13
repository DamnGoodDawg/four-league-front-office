import type { LeagueRow, MatchupRow, NormalizedLeague, TeamRow } from "./model";

/**
 * Interim Yahoo source: reads the logged-in classic web pages with the user's
 * session cookie (YAHOO_COOKIE) while the official OAuth API application is under
 * review. Swappable — a `yahoo-api` implementation replaces this behind the same
 * NormalizedLeague return type once approved. Scope for now: league + my matchup
 * headline (scores, projections, opponent). Per-player rosters land with the API.
 */

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
      detail: `"${leagueName}" week ${week}: ${myName} ${myScore} vs ${oppName} ${oppScore} (roster detail pending API)`,
      data: { league, teams, matchups, rosters: [] },
    };
  } catch (err) {
    return { status: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}
