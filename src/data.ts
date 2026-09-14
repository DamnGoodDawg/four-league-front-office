import type { AdviceItem, LeagueRow, MatchupRow, RosterSlotRow, TeamRow } from "./model";
import { noteWriteFailure, writeHealth } from "./sync";
import { yahooLeagueLink } from "./yahoo";

export interface StandingRow {
  team_id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  is_mine: number;
}

export interface LeagueView {
  id: string;
  platform: string;
  name: string;
  week: number;
  deep_link: string;
  my_team: { id: string; name: string; wins: number; losses: number; ties: number } | null;
  matchup: {
    my_score: number;
    opp_score: number;
    my_proj: number;
    opp_proj: number;
    opp_name: string;
    opp_record: string;
    /** My side's live win probability, 0..100 (ESPN native; Yahoo computed). */
    win_pct: number | null;
    /** Starters with 0.0 actual so far (heuristic for "yet to fire"). */
    my_zero: number;
    /** null when we don't sync that opponent's roster (Yahoo, until Phase 2). */
    opp_zero: number | null;
  } | null;
  alerts: Array<Pick<AdviceItem, "type" | "severity" | "message" | "deep_link"> & { source: string }>;
  roster: Array<{
    slot: string; player: string; position: string; status: string;
    proj: number; actual: number; is_starter: number;
  }>;
  opp_roster: Array<{
    slot: string; player: string; position: string; status: string;
    proj: number; actual: number; is_starter: number;
  }>;
  standings: StandingRow[];
  faab: { budget: number; spent: number } | null;
  waivers: Array<{
    name: string; position: string; pro_team: string;
    proj: number | null; pct_owned: number | null; note: string; trending: number | null;
  }>;
  players_link: string;
}

export interface BriefingRow {
  id: number;
  kind: string;
  week: number;
  title: string;
  body: string;
  created_at: string;
}

export interface DataPayload {
  generated_at: string;
  leagues: LeagueView[];
  briefings: BriefingRow[];
  trending: Array<{ player_name: string; position: string; pro_team: string; adds: number }>;
  health: Array<{ source: string; status: string; detail: string; at: string }>;
  yahoo: { configured: boolean; link: string; note: string };
  sync_log: Array<{ source: string; status: string; detail: string; at: string }>;
}

const SEVERITY_ORDER = `CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`;
let lastCanaryAt = 0;

async function zeroStarterCount(env: Env, leagueId: string, teamId: string, week: number): Promise<number | null> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS zeros, SUM(1) AS total FROM roster_slots
     WHERE league_id = ?1 AND team_id = ?2 AND week = ?3 AND is_starter = 1 AND actual_points = 0`,
  ).bind(leagueId, teamId, week).first<{ zeros: number }>();
  const any = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM roster_slots WHERE league_id = ?1 AND team_id = ?2 AND week = ?3`,
  ).bind(leagueId, teamId, week).first<{ n: number }>();
  if (!any || any.n === 0) return null; // we don't have that roster
  return row?.zeros ?? 0;
}

export async function buildData(env: Env): Promise<DataPayload> {
  // Writability canary IN the request path so the "updates paused" banner
  // reaches every page load during a write block. It must write a REAL row —
  // Cloudflare meters rows written, so zero-row statements succeed even while
  // blocked. One heartbeat row, filtered from every view, throttled to one
  // write per 2 min per isolate; while blocked it retries every fetch (those
  // attempts write nothing) so recovery is noticed promptly.
  if (writeHealth.blocked || Date.now() - lastCanaryAt > 120_000) {
    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO trending (player_name, position, pro_team, adds, fetched_at) VALUES ('__canary__', '', '', 0, ?1)`,
      ).bind(new Date().toISOString()).run();
      writeHealth.blocked = false;
      lastCanaryAt = Date.now();
    } catch (err) {
      noteWriteFailure(err);
    }
  }

  const leagues = (await env.DB.prepare(`SELECT * FROM leagues ORDER BY name`).all<LeagueRow>()).results;
  const views: LeagueView[] = [];

  for (const lg of leagues) {
    const teams = (
      await env.DB.prepare(`SELECT * FROM teams WHERE league_id = ?1`).bind(lg.id).all<TeamRow>()
    ).results;
    const byId = new Map(teams.map((t) => [t.team_id, t]));
    const me = byId.get(lg.my_team_id) ?? null;

    const matchup = await env.DB.prepare(
      `SELECT * FROM matchups WHERE league_id = ?1 AND week = ?2 AND (home_team_id = ?3 OR away_team_id = ?3) LIMIT 1`,
    ).bind(lg.id, lg.current_week, lg.my_team_id).first<MatchupRow>();

    let matchupView: LeagueView["matchup"] = null;
    if (matchup) {
      const iAmHome = matchup.home_team_id === lg.my_team_id;
      const oppId = iAmHome ? matchup.away_team_id : matchup.home_team_id;
      const opp = oppId ? byId.get(oppId) : undefined;
      matchupView = {
        my_score: iAmHome ? matchup.home_score : matchup.away_score,
        opp_score: iAmHome ? matchup.away_score : matchup.home_score,
        my_proj: iAmHome ? matchup.home_proj : matchup.away_proj,
        opp_proj: iAmHome ? matchup.away_proj : matchup.home_proj,
        opp_name: opp?.name ?? "Bye",
        opp_record: opp ? `${opp.wins}-${opp.losses}${opp.ties ? `-${opp.ties}` : ""}` : "",
        win_pct: matchup.home_win_prob == null
          ? null
          : Math.round((iAmHome ? matchup.home_win_prob : 1 - matchup.home_win_prob) * 100),
        my_zero: (await zeroStarterCount(env, lg.id, lg.my_team_id, lg.current_week)) ?? 0,
        opp_zero: oppId ? await zeroStarterCount(env, lg.id, oppId, lg.current_week) : null,
      };
    }

    const alerts = (
      await env.DB.prepare(
        `SELECT type, severity, message, deep_link, source FROM advice
         WHERE league_id = ?1 AND week = ?2 ORDER BY ${SEVERITY_ORDER}, id`,
      ).bind(lg.id, lg.current_week).all<AdviceItem & { source: string }>()
    ).results;

    const rosterQuery = (teamId: string) =>
      env.DB.prepare(
        `SELECT slot, player_name AS player, position, injury_status AS status,
                proj_points AS proj, actual_points AS actual, is_starter
         FROM roster_slots WHERE league_id = ?1 AND team_id = ?2 AND week = ?3`,
      ).bind(lg.id, teamId, lg.current_week).all<LeagueView["roster"][number]>();

    const roster = (await rosterQuery(lg.my_team_id)).results;
    const oppId = matchup
      ? (matchup.home_team_id === lg.my_team_id ? matchup.away_team_id : matchup.home_team_id)
      : null;
    const oppRoster = oppId ? (await rosterQuery(oppId)).results : [];

    const waivers = (
      await env.DB.prepare(
        `SELECT w.name, w.position, w.pro_team, w.proj, w.pct_owned, w.note, t.adds AS trending
         FROM waiver_candidates w LEFT JOIN trending t ON t.player_name = w.name
         WHERE w.league_id = ?1
         ORDER BY CASE WHEN w.proj IS NULL THEN 1 ELSE 0 END, w.proj DESC, w.pct_owned DESC`,
      ).bind(lg.id).all<LeagueView["waivers"][number]>()
    ).results;

    const playersLink = lg.platform === "espn"
      ? `https://fantasy.espn.com/football/players/add?leagueId=${lg.platform_league_id}`
      : `https://football.fantasysports.yahoo.com/f1/${lg.platform_league_id}/players?status=A`;

    const standings: StandingRow[] = teams
      .map((t) => ({
        team_id: t.team_id, name: t.name, wins: t.wins, losses: t.losses,
        ties: t.ties, points_for: t.points_for, is_mine: t.is_mine,
      }))
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.points_for - a.points_for);

    views.push({
      id: lg.id,
      platform: lg.platform,
      name: lg.name,
      week: lg.current_week,
      deep_link: lg.deep_link,
      my_team: me ? { id: me.team_id, name: me.name, wins: me.wins, losses: me.losses, ties: me.ties } : null,
      matchup: matchupView,
      alerts: alerts.map((a) => ({ type: a.type, severity: a.severity, message: a.message, deep_link: a.deep_link, source: a.source })),
      roster,
      opp_roster: oppRoster,
      standings,
      // Taylor: all four leagues run standard waivers — no FAAB/auction anywhere,
      // whatever ESPN's default settings claim. Never surface budgets or suggest bids.
      faab: null,
      waivers,
      players_link: playersLink,
    });
  }

  const trending = (
    await env.DB.prepare(
      `SELECT player_name, position, pro_team, adds FROM trending WHERE player_name != '__canary__' ORDER BY adds DESC`,
    ).all<DataPayload["trending"][number]>()
  ).results;

  const health = (
    await env.DB.prepare(
      `SELECT source, status, detail, at FROM sync_log
       WHERE id IN (SELECT MAX(id) FROM sync_log GROUP BY source) ORDER BY source`,
    ).all<DataPayload["health"][number]>()
  ).results;
  if (writeHealth.blocked) {
    health.unshift({
      source: "d1-writes",
      status: "blocked",
      detail: "Cloudflare's daily database write cap is hit — score updates are paused until the reset (8:00 PM ET). Showing the last synced data.",
      at: writeHealth.at,
    });
  }

  const briefings = (
    await env.DB.prepare(
      `SELECT id, kind, week, title, body, created_at FROM briefings ORDER BY id DESC LIMIT 12`,
    ).all<BriefingRow>()
  ).results;

  const syncLog = (
    await env.DB.prepare(`SELECT source, status, detail, at FROM sync_log ORDER BY id DESC LIMIT 8`).all<
      DataPayload["sync_log"][number]
    >()
  ).results;

  const yahooConfigured = Boolean((env.YAHOO_COOKIE ?? "") && (env.YAHOO_LEAGUE_ID ?? ""));
  const lastYahoo = syncLog.find((s) => s.source === "yahoo");
  return {
    generated_at: new Date().toISOString(),
    leagues: views,
    briefings,
    trending,
    health,
    yahoo: {
      configured: yahooConfigured,
      link: yahooLeagueLink(env.YAHOO_LEAGUE_ID ?? "", env.YAHOO_TEAM_ID),
      note: lastYahoo?.detail ?? "Yahoo uplink not configured.",
    },
    sync_log: syncLog,
  };
}
