/**
 * Interim Yahoo path while the official API application is under review
 * (submitted Sept 13, 2026; Yahoo quotes 1–2 weeks).
 *
 * Design: a swappable source. `probeYahoo` activates only when the user has
 * provided a logged-in session Cookie header (YAHOO_COOKIE secret) plus
 * YAHOO_LEAGUE_ID. Today it verifies the session can reach the league page;
 * the HTML parser lands once we have a real logged-in page to parse against.
 * When the API is approved, a `yahoo-api` implementation replaces this one
 * behind the same interface — nothing else changes.
 */

export interface YahooProbe {
  status: "skipped" | "session-ok" | "session-expired" | "error";
  detail: string;
}

export function yahooLeagueLink(leagueId: string): string {
  return leagueId
    ? `https://football.fantasysports.yahoo.com/f1/${leagueId}`
    : "https://football.fantasysports.yahoo.com/";
}

export async function probeYahoo(env: Env): Promise<YahooProbe> {
  const cookie = env.YAHOO_COOKIE ?? "";
  const leagueId = env.YAHOO_LEAGUE_ID ?? "";
  if (!cookie || !leagueId) {
    return { status: "skipped", detail: "Awaiting Yahoo session cookie + league id (or API approval)." };
  }
  try {
    const res = await fetch(yahooLeagueLink(leagueId), {
      headers: { Cookie: cookie, "User-Agent": "Mozilla/5.0 (personal single-league dashboard)" },
      redirect: "manual",
    });
    if (res.status === 200) {
      // Drain the body without buffering it all (we only need reachability today).
      await res.body?.cancel();
      return { status: "session-ok", detail: "Yahoo session reaches the league page; parser pending." };
    }
    await res.body?.cancel();
    if (res.status >= 300 && res.status < 400) {
      return { status: "session-expired", detail: `Redirected to login (HTTP ${res.status}) — re-grab the Yahoo cookie.` };
    }
    return { status: "error", detail: `Yahoo league page returned HTTP ${res.status}.` };
  } catch (err) {
    return { status: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}
