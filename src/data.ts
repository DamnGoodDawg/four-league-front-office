import type { AdviceItem, LeagueRow, MatchupRow, RosterSlotRow, TeamRow } from "./model";
import { yahooLeagueLink } from "./yahoo";

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
  } | null;
  alerts: Array<Pick<AdviceItem, "type" | "severity" | "message" | "deep_link">>;
  roster: Array<{
    slot: string; player: string; position: string; status: string;
    proj: number; actual: number; is_starter: number;
  }>;
}

export interface DataPayload {
  generated_at: string;
  leagues: LeagueView[];
  yahoo: {
    configured: boolean;
    link: string;
    note: string;
  };
  sync_log: Array<{ source: string; status: string; detail: string; at: string }>;
}

const SEVERITY_ORDER = `CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`;

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
    });
  }

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
    yahoo: {
      configured: yahooConfigured,
      link: yahooLeagueLink(env.YAHOO_LEAGUE_ID ?? ""),
      note: lastYahoo?.detail ?? "API application under Yahoo review (1–2 weeks quoted). Interim: sign in to Yahoo and add YAHOO_COOKIE + YAHOO_LEAGUE_ID.",
    },
    sync_log: syncLog,
  };
}
