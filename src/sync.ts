import { generateAdvice } from "./advice";
import { fetchEspnLeague } from "./espn";
import type { AdviceItem, NormalizedLeague } from "./model";
import { probeYahoo } from "./yahoo";

export interface SyncReport {
  ok: boolean;
  results: Array<{ source: string; status: string; detail: string }>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function persistLeague(env: Env, data: NormalizedLeague, advice: AdviceItem[]): Promise<void> {
  const { league, teams, matchups, rosters } = data;
  const stmts: D1PreparedStatement[] = [];

  stmts.push(
    env.DB.prepare(
      `INSERT INTO leagues (id, platform, platform_league_id, name, season, my_team_id, current_week, deep_link, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(id) DO UPDATE SET name = ?4, my_team_id = ?6, current_week = ?7, deep_link = ?8, updated_at = ?9`,
    ).bind(
      league.id, league.platform, league.platform_league_id, league.name, league.season,
      league.my_team_id, league.current_week, league.deep_link, league.updated_at,
    ),
  );

  for (const t of teams) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO teams (league_id, team_id, name, wins, losses, ties, points_for, is_mine)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(league_id, team_id) DO UPDATE SET name = ?3, wins = ?4, losses = ?5, ties = ?6, points_for = ?7, is_mine = ?8`,
      ).bind(t.league_id, t.team_id, t.name, t.wins, t.losses, t.ties, t.points_for, t.is_mine),
    );
  }

  stmts.push(env.DB.prepare(`DELETE FROM matchups WHERE league_id = ?1 AND week = ?2`).bind(league.id, league.current_week));
  for (const m of matchups) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO matchups (league_id, week, matchup_id, home_team_id, away_team_id, home_score, away_score, home_proj, away_proj)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      ).bind(m.league_id, m.week, m.matchup_id, m.home_team_id, m.away_team_id, m.home_score, m.away_score, m.home_proj, m.away_proj),
    );
  }

  stmts.push(env.DB.prepare(`DELETE FROM roster_slots WHERE league_id = ?1 AND week = ?2`).bind(league.id, league.current_week));
  for (const r of rosters) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO roster_slots (league_id, team_id, week, player_id, player_name, position, slot, is_starter, injury_status, proj_points, actual_points)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(league_id, team_id, week, player_id) DO UPDATE SET
           player_name = ?5, position = ?6, slot = ?7, is_starter = ?8, injury_status = ?9, proj_points = ?10, actual_points = ?11`,
      ).bind(r.league_id, r.team_id, r.week, r.player_id, r.player_name, r.position, r.slot, r.is_starter, r.injury_status, r.proj_points, r.actual_points),
    );
  }

  stmts.push(env.DB.prepare(`DELETE FROM advice WHERE league_id = ?1 AND week = ?2`).bind(league.id, league.current_week));
  const now = new Date().toISOString();
  for (const a of advice) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO advice (league_id, team_id, week, type, severity, message, deep_link, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).bind(a.league_id, a.team_id, a.week, a.type, a.severity, a.message, a.deep_link, now),
    );
  }

  for (const group of chunk(stmts, 50)) {
    await env.DB.batch(group);
  }
}

async function logSync(env: Env, source: string, status: string, detail: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO sync_log (source, status, detail, at) VALUES (?1, ?2, ?3, ?4)`)
    .bind(source, status, detail.slice(0, 500), new Date().toISOString())
    .run();
}

export async function runSync(env: Env): Promise<SyncReport> {
  const results: SyncReport["results"] = [];
  const leagueIds = (env.ESPN_LEAGUE_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const teamIds = (env.ESPN_TEAM_IDS ?? "").split(",").map((s) => s.trim());

  for (let i = 0; i < leagueIds.length; i++) {
    const source = `espn:${leagueIds[i]}`;
    try {
      const data = await fetchEspnLeague({
        leagueId: leagueIds[i],
        myTeamId: teamIds[i] ?? "",
        season: env.ESPN_SEASON,
        s2: env.ESPN_S2 ?? "",
        swid: env.ESPN_SWID ?? "",
      });
      const advice = generateAdvice(data.league, data.rosters);
      await persistLeague(env, data, advice);
      const detail = `"${data.league.name}" week ${data.league.current_week}: ${data.teams.length} teams, ${data.rosters.length} roster slots, ${advice.length} advice`;
      results.push({ source, status: "ok", detail });
      await logSync(env, source, "ok", detail);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      results.push({ source, status: "error", detail });
      await logSync(env, source, "error", detail);
    }
  }

  const yahoo = await probeYahoo(env);
  results.push({ source: "yahoo", status: yahoo.status, detail: yahoo.detail });
  if (yahoo.status !== "skipped") {
    await logSync(env, "yahoo", yahoo.status, yahoo.detail);
  }

  return { ok: results.every((r) => r.status !== "error"), results };
}
