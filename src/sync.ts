import { generateAdvice } from "./advice";
import { fetchEspnFreeAgents, fetchEspnLeague } from "./espn";
import type { AdviceItem, NormalizedLeague } from "./model";
import { fetchTrendingAdds } from "./sleeper";
import { fetchYahooLeague, fetchYahooWaivers } from "./yahoo";

export interface SyncReport {
  ok: boolean;
  results: Array<{ source: string; status: string; detail: string }>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const nearlyEqual = (a: number | null | undefined, b: number | null | undefined): boolean =>
  (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 0.005);

/**
 * Diff-based persistence: D1's free tier meters rows WRITTEN (deletes and
 * index updates included), so the old delete-and-reinsert of ~500 rows per
 * sync burned the daily cap during game windows. This version reads current
 * rows (reads are ~50x cheaper-budgeted) and writes only actual changes —
 * a quiet tick writes ~0 rows; a live-game tick writes only players whose
 * numbers moved. Returns the statement count for observability.
 */
async function persistLeague(env: Env, data: NormalizedLeague, advice: AdviceItem[]): Promise<number> {
  const { league, teams, matchups, rosters } = data;
  const stmts: D1PreparedStatement[] = [];

  const curLeague = await env.DB.prepare(`SELECT * FROM leagues WHERE id = ?1`).bind(league.id).first<Record<string, unknown>>();
  const leagueChanged =
    !curLeague ||
    curLeague.name !== league.name ||
    curLeague.my_team_id !== league.my_team_id ||
    curLeague.current_week !== league.current_week ||
    curLeague.deep_link !== league.deep_link ||
    !nearlyEqual(curLeague.faab_budget as number | null, league.faab_budget) ||
    !nearlyEqual(curLeague.faab_spent as number | null, league.faab_spent);
  if (leagueChanged) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO leagues (id, platform, platform_league_id, name, season, my_team_id, current_week, deep_link, updated_at, faab_budget, faab_spent)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET name = ?4, my_team_id = ?6, current_week = ?7, deep_link = ?8, updated_at = ?9, faab_budget = ?10, faab_spent = ?11`,
      ).bind(
        league.id, league.platform, league.platform_league_id, league.name, league.season,
        league.my_team_id, league.current_week, league.deep_link, league.updated_at,
        league.faab_budget, league.faab_spent,
      ),
    );
  }

  const curTeams = new Map(
    (await env.DB.prepare(`SELECT * FROM teams WHERE league_id = ?1`).bind(league.id).all<Record<string, unknown>>())
      .results.map((t) => [t.team_id as string, t]),
  );
  for (const t of teams) {
    const c = curTeams.get(t.team_id);
    if (c && c.name === t.name && c.wins === t.wins && c.losses === t.losses && c.ties === t.ties &&
        nearlyEqual(c.points_for as number, t.points_for) && c.is_mine === t.is_mine) continue;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO teams (league_id, team_id, name, wins, losses, ties, points_for, is_mine)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(league_id, team_id) DO UPDATE SET name = ?3, wins = ?4, losses = ?5, ties = ?6, points_for = ?7, is_mine = ?8`,
      ).bind(t.league_id, t.team_id, t.name, t.wins, t.losses, t.ties, t.points_for, t.is_mine),
    );
  }

  const curMatchups = new Map(
    (await env.DB.prepare(`SELECT * FROM matchups WHERE league_id = ?1 AND week = ?2`)
      .bind(league.id, league.current_week).all<Record<string, unknown>>())
      .results.map((m) => [m.matchup_id as string, m]),
  );
  const newMatchupIds = new Set(matchups.map((m) => m.matchup_id));
  for (const [mid] of curMatchups) {
    if (!newMatchupIds.has(mid)) {
      stmts.push(env.DB.prepare(`DELETE FROM matchups WHERE league_id = ?1 AND week = ?2 AND matchup_id = ?3`)
        .bind(league.id, league.current_week, mid));
    }
  }
  for (const m of matchups) {
    const c = curMatchups.get(m.matchup_id);
    if (c && c.home_team_id === m.home_team_id && c.away_team_id === m.away_team_id &&
        nearlyEqual(c.home_score as number, m.home_score) && nearlyEqual(c.away_score as number, m.away_score) &&
        nearlyEqual(c.home_proj as number, m.home_proj) && nearlyEqual(c.away_proj as number, m.away_proj) &&
        nearlyEqual(c.home_win_prob as number | null, m.home_win_prob)) continue;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO matchups (league_id, week, matchup_id, home_team_id, away_team_id, home_score, away_score, home_proj, away_proj, home_win_prob)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(league_id, week, matchup_id) DO UPDATE SET home_team_id = ?4, away_team_id = ?5,
           home_score = ?6, away_score = ?7, home_proj = ?8, away_proj = ?9, home_win_prob = ?10`,
      ).bind(m.league_id, m.week, m.matchup_id, m.home_team_id, m.away_team_id, m.home_score, m.away_score, m.home_proj, m.away_proj, m.home_win_prob),
    );
  }

  const curRosters = new Map(
    (await env.DB.prepare(`SELECT * FROM roster_slots WHERE league_id = ?1 AND week = ?2`)
      .bind(league.id, league.current_week).all<Record<string, unknown>>())
      .results.map((r) => [`${r.team_id}|${r.player_id}`, r]),
  );
  const newRosterKeys = new Set(rosters.map((r) => `${r.team_id}|${r.player_id}`));
  for (const [key, c] of curRosters) {
    if (!newRosterKeys.has(key)) {
      stmts.push(env.DB.prepare(`DELETE FROM roster_slots WHERE league_id = ?1 AND week = ?2 AND team_id = ?3 AND player_id = ?4`)
        .bind(league.id, league.current_week, c.team_id, c.player_id));
    }
  }
  for (const r of rosters) {
    const c = curRosters.get(`${r.team_id}|${r.player_id}`);
    if (c && c.player_name === r.player_name && c.position === r.position && c.slot === r.slot &&
        c.is_starter === r.is_starter && c.injury_status === r.injury_status &&
        nearlyEqual(c.proj_points as number, r.proj_points) && nearlyEqual(c.actual_points as number, r.actual_points)) continue;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO roster_slots (league_id, team_id, week, player_id, player_name, position, slot, is_starter, injury_status, proj_points, actual_points)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(league_id, team_id, week, player_id) DO UPDATE SET
           player_name = ?5, position = ?6, slot = ?7, is_starter = ?8, injury_status = ?9, proj_points = ?10, actual_points = ?11`,
      ).bind(r.league_id, r.team_id, r.week, r.player_id, r.player_name, r.position, r.slot, r.is_starter, r.injury_status, r.proj_points, r.actual_points),
    );
  }

  // Rules-lane advice: rewrite only when the generated set actually differs.
  const curAdvice = (
    await env.DB.prepare(
      `SELECT type, severity, message FROM advice WHERE league_id = ?1 AND week = ?2 AND source = 'rules' ORDER BY id`,
    ).bind(league.id, league.current_week).all<{ type: string; severity: string; message: string }>()
  ).results;
  const serialize = (list: Array<{ type: string; severity: string; message: string }>) =>
    JSON.stringify(list.map((a) => [a.type, a.severity, a.message]));
  if (serialize(curAdvice) !== serialize(advice)) {
    stmts.push(
      env.DB.prepare(`DELETE FROM advice WHERE league_id = ?1 AND week = ?2 AND source = 'rules'`)
        .bind(league.id, league.current_week),
    );
    const now = new Date().toISOString();
    for (const a of advice) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO advice (league_id, team_id, week, type, severity, message, deep_link, created_at, source)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'rules')`,
        ).bind(a.league_id, a.team_id, a.week, a.type, a.severity, a.message, a.deep_link, now),
      );
    }
  }

  try {
    for (const group of chunk(stmts, 50)) {
      await env.DB.batch(group);
    }
  } catch (err) {
    noteWriteFailure(err);
    throw err;
  }
  if (stmts.length) writeHealth.blocked = false;
  return stmts.length;
}

/**
 * Isolate-local write-block signal: when D1 rejects writes (e.g. the account's
 * daily cap), surface it to the dashboard WITHOUT needing a DB write. Best
 * effort — isolates vary — but it beats claiming freshness during a block.
 */
export const writeHealth = { blocked: false, detail: "", at: "" };
function noteWriteFailure(err: unknown): void {
  writeHealth.blocked = true;
  writeHealth.detail = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
  writeHealth.at = new Date().toISOString();
}

/** Log only status CHANGES (plus first sighting) — a steady "ok" every 2 minutes is cap burn, not information. Never throws. */
async function logSync(env: Env, source: string, status: string, detail: string): Promise<void> {
  try {
    const prev = await env.DB.prepare(`SELECT status FROM sync_log WHERE source = ?1 ORDER BY id DESC LIMIT 1`)
      .bind(source).first<{ status: string }>();
    if (prev?.status === status) return;
    await env.DB.prepare(`INSERT INTO sync_log (source, status, detail, at) VALUES (?1, ?2, ?3, ?4)`)
      .bind(source, status, detail.slice(0, 500), new Date().toISOString())
      .run();
    writeHealth.blocked = false;
  } catch (err) {
    noteWriteFailure(err);
  }
}

/** Waiver-wire + trending data is heavier and slower-moving: refresh at most every 6h (or when forced). */
export async function waiverDataIsStale(env: Env): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT MAX(fetched_at) AS latest FROM waiver_candidates`).first<{ latest: string | null }>();
  if (!row?.latest) return true;
  return Date.now() - Date.parse(row.latest) > 6 * 3600 * 1000;
}

export async function refreshWaiverData(env: Env): Promise<Array<{ source: string; status: string; detail: string }>> {
  // Canary: a zero-row write costs nothing when healthy, but fails fast when
  // the account's D1 write cap is exhausted — skip the heavy fetches entirely.
  try {
    await env.DB.prepare(`UPDATE trending SET fetched_at = fetched_at WHERE 1 = 0`).run();
  } catch (err) {
    noteWriteFailure(err);
    return [{ source: "waivers", status: "blocked", detail: "D1 daily write cap hit — waiver refresh paused until the reset." }];
  }

  const results: Array<{ source: string; status: string; detail: string }> = [];
  const now = new Date().toISOString();
  const leagueIds = (env.ESPN_LEAGUE_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  for (const lid of leagueIds) {
    const source = `waivers espn:${lid}`;
    try {
      const lg = await env.DB.prepare(`SELECT current_week FROM leagues WHERE id = ?1`).bind(`espn:${lid}`).first<{ current_week: number }>();
      const week = lg?.current_week ?? 1;
      const rows = await fetchEspnFreeAgents({ leagueId: lid, season: env.ESPN_SEASON, s2: env.ESPN_S2 ?? "", swid: env.ESPN_SWID ?? "" }, week);
      const stmts = [env.DB.prepare(`DELETE FROM waiver_candidates WHERE league_id = ?1`).bind(`espn:${lid}`)];
      for (const r of rows) {
        stmts.push(env.DB.prepare(
          `INSERT OR REPLACE INTO waiver_candidates (league_id, week, player_id, name, position, pro_team, proj, pct_owned, note, fetched_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
        ).bind(`espn:${lid}`, week, r.player_id, r.name, r.position, r.pro_team, r.proj, r.pct_owned, r.note, now));
      }
      for (const group of chunk(stmts, 50)) await env.DB.batch(group);
      results.push({ source, status: "ok", detail: `${rows.length} candidates` });
    } catch (err) {
      results.push({ source, status: "error", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const ylid = env.YAHOO_LEAGUE_ID ?? "";
    if (ylid) {
      const lg = await env.DB.prepare(`SELECT current_week FROM leagues WHERE id = ?1`).bind(`yahoo:${ylid}`).first<{ current_week: number }>();
      const week = lg?.current_week ?? 1;
      const rows = await fetchYahooWaivers(env);
      const stmts = [env.DB.prepare(`DELETE FROM waiver_candidates WHERE league_id = ?1`).bind(`yahoo:${ylid}`)];
      for (const r of rows) {
        stmts.push(env.DB.prepare(
          `INSERT OR REPLACE INTO waiver_candidates (league_id, week, player_id, name, position, pro_team, proj, pct_owned, note, fetched_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
        ).bind(`yahoo:${ylid}`, week, r.player_id, r.name, r.position, r.pro_team, null, r.pct_owned, r.note, now));
      }
      for (const group of chunk(stmts, 50)) await env.DB.batch(group);
      results.push({ source: `waivers yahoo:${ylid}`, status: rows.length ? "ok" : "error", detail: `${rows.length} candidates` });
    }
  } catch (err) {
    results.push({ source: "waivers yahoo", status: "error", detail: err instanceof Error ? err.message : String(err) });
  }

  try {
    const trending = await fetchTrendingAdds(25);
    const stmts = [env.DB.prepare(`DELETE FROM trending`)];
    for (const t of trending) {
      stmts.push(env.DB.prepare(
        `INSERT OR REPLACE INTO trending (player_name, position, pro_team, adds, fetched_at) VALUES (?1, ?2, ?3, ?4, ?5)`,
      ).bind(t.player_name, t.position, t.pro_team, t.adds, now));
    }
    for (const group of chunk(stmts, 50)) await env.DB.batch(group);
    results.push({ source: "sleeper trending", status: "ok", detail: `${trending.length} trending adds` });
  } catch (err) {
    results.push({ source: "sleeper trending", status: "error", detail: err instanceof Error ? err.message : String(err) });
  }

  for (const r of results) await logSync(env, r.source, r.status, r.detail);
  return results;
}

export async function runSync(env: Env, opts: { withWaivers?: boolean } = {}): Promise<SyncReport> {
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
      const wrote = await persistLeague(env, data, advice);
      const detail = `"${data.league.name}" week ${data.league.current_week}: ${data.teams.length} teams, ${data.rosters.length} roster slots, ${advice.length} advice, wrote ${wrote}`;
      results.push({ source, status: "ok", detail });
      await logSync(env, source, "ok", detail);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      results.push({ source, status: "error", detail });
      await logSync(env, source, "error", detail);
    }
  }

  const yahoo = await fetchYahooLeague(env);
  if (yahoo.status === "ok" && yahoo.data) {
    try {
      const advice = generateAdvice(yahoo.data.league, yahoo.data.rosters);
      const wrote = await persistLeague(env, yahoo.data, advice);
      yahoo.detail += `, wrote ${wrote}`;
    } catch (err) {
      yahoo.status = "error";
      yahoo.detail = `persist failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  results.push({ source: "yahoo", status: yahoo.status, detail: yahoo.detail });
  if (yahoo.status !== "skipped") {
    await logSync(env, "yahoo", yahoo.status, yahoo.detail);
  }

  if (opts.withWaivers ?? (await waiverDataIsStale(env))) {
    results.push(...(await refreshWaiverData(env)));
  }

  return { ok: results.every((r) => r.status !== "error"), results };
}
