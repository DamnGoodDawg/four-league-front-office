import type { AdviceItem, LeagueRow, MatchupRow, RosterSlotRow, TeamRow } from "./model";
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
    /** Starters with 0.0 actual so far (heuristic for "yet to fire"). */
    my_zero: number;
    /** null when we don't sync that opponent's roster (Yahoo, until Phase 2). */
    opp_zero: number | null;
  } | null;
  alerts: Array<Pick<AdviceItem, "type" | "severity" | "message" | "deep_link">>;
  roster: Array<{
    slot: string; player: string; position: string; status: string;
    proj: number; actual: number; is_starter: number;
  }>;
  standings: StandingRow[];
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
  yahoo: { configured: boolean; link: string; note: string };
  sync_log: Array<{ source: string; status: string; detail: string; at: string }>;
}

const SEVERITY_ORDER = `CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`;

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
        my_zero: (await zeroStarterCount(env, lg.id, lg.my_team_id, lg.current_week)) ?? 0,
        opp_zero: oppId ? await zeroStarterCount(env, lg.id, oppId, lg.current_week) : null,
      };
    }

    const alerts = (
      await env.DB.prepare(
        `SELECT type, severity, message, deep_link FROM advice
         WHERE league_id = ?1 AND week = ?2 ORDER BY ${SEVERITY_ORDER}, id`,
      ).bind(lg.id, lg.current_week).all<AdviceItem>()
    ).results;

    const roster = (
      await env.DB.prepare(
        `SELECT slot, player_name AS player, position, injury_status AS status,
                proj_points AS proj, actual_points AS actual, is_starter
         FROM roster_slots WHERE league_id = ?1 AND team_id = ?2 AND week = ?3`,
      ).bind(lg.id, lg.my_team_id, lg.current_week).all<LeagueView["roster"][number]>()
    ).results;

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
      alerts: alerts.map((a) => ({ type: a.type, severity: a.severity, message: a.message, deep_link: a.deep_link })),
      roster,
      standings,
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
    yahoo: {
      configured: yahooConfigured,
      link: yahooLeagueLink(env.YAHOO_LEAGUE_ID ?? "", env.YAHOO_TEAM_ID),
      note: lastYahoo?.detail ?? "Yahoo uplink not configured.",
    },
    sync_log: syncLog,
  };
}
