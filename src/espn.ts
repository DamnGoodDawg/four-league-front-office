import type { LeagueRow, MatchupRow, NormalizedLeague, RosterSlotRow, TeamRow } from "./model";

const READS_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

const POSITION_BY_ID: Record<number, string> = {
  1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST",
};

const SLOT_BY_ID: Record<number, string> = {
  0: "QB", 1: "TQB", 2: "RB", 3: "RB/WR", 4: "WR", 5: "WR/TE", 6: "TE",
  7: "OP", 16: "D/ST", 17: "K", 18: "P", 19: "HC", 20: "Bench", 21: "IR", 23: "FLEX",
};

const NON_STARTING_SLOTS = new Set(["Bench", "IR"]);

interface EspnStat {
  scoringPeriodId?: number;
  statSourceId?: number; // 0 = actual, 1 = projected
  statSplitTypeId?: number; // 1 = weekly
  appliedTotal?: number;
}

interface EspnPlayer {
  id?: number;
  fullName?: string;
  defaultPositionId?: number;
  injuryStatus?: string;
  stats?: EspnStat[];
}

interface EspnRosterEntry {
  playerId?: number;
  lineupSlotId?: number;
  playerPoolEntry?: { player?: EspnPlayer };
}

interface EspnTeam {
  id: number;
  name?: string;
  location?: string;
  nickname?: string;
  record?: { overall?: { wins?: number; losses?: number; ties?: number; pointsFor?: number } };
  roster?: { entries?: EspnRosterEntry[] };
}

interface EspnMatchupSide {
  teamId?: number;
  totalPoints?: number;
  totalPointsLive?: number;
}

interface EspnScheduleItem {
  id?: number;
  matchupPeriodId?: number;
  home?: EspnMatchupSide;
  away?: EspnMatchupSide;
}

interface EspnLeagueResponse {
  scoringPeriodId?: number;
  status?: { currentMatchupPeriod?: number };
  settings?: { name?: string };
  teams?: EspnTeam[];
  schedule?: EspnScheduleItem[];
}

export interface EspnLeagueArgs {
  leagueId: string;
  myTeamId: string;
  season: string;
  s2: string;
  swid: string;
}

export function espnTeamLink(season: string, leagueId: string, teamId: string): string {
  return `https://fantasy.espn.com/football/team?leagueId=${leagueId}&teamId=${teamId}&seasonId=${season}`;
}

function weeklyStat(stats: EspnStat[] | undefined, week: number, sourceId: number): number {
  const s = (stats ?? []).find(
    (x) => x.scoringPeriodId === week && x.statSourceId === sourceId && (x.statSplitTypeId ?? 1) === 1,
  );
  return typeof s?.appliedTotal === "number" ? s.appliedTotal : 0;
}

export async function fetchEspnLeague(args: EspnLeagueArgs): Promise<NormalizedLeague> {
  const url =
    `${READS_BASE}/seasons/${args.season}/segments/0/leagues/${args.leagueId}` +
    `?view=mSettings&view=mTeam&view=mRoster&view=mMatchupScore&view=mScoreboard`;

  const res = await fetch(url, {
    headers: {
      Cookie: `espn_s2=${args.s2}; SWID=${args.swid}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`ESPN league ${args.leagueId}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as EspnLeagueResponse;

  const week = data.scoringPeriodId ?? 1;
  const matchupPeriod = data.status?.currentMatchupPeriod ?? week;
  const leagueId = `espn:${args.leagueId}`;
  const now = new Date().toISOString();

  const league: LeagueRow = {
    id: leagueId,
    platform: "espn",
    platform_league_id: args.leagueId,
    name: data.settings?.name ?? `ESPN league ${args.leagueId}`,
    season: Number(args.season),
    my_team_id: args.myTeamId,
    current_week: week,
    deep_link: espnTeamLink(args.season, args.leagueId, args.myTeamId),
    updated_at: now,
  };

  const teams: TeamRow[] = [];
  const rosters: RosterSlotRow[] = [];
  const projByTeam = new Map<string, number>();

  for (const t of data.teams ?? []) {
    const teamId = String(t.id);
    const name = (t.name ?? `${t.location ?? ""} ${t.nickname ?? ""}`).trim() || `Team ${teamId}`;
    const rec = t.record?.overall ?? {};
    teams.push({
      league_id: leagueId,
      team_id: teamId,
      name,
      wins: rec.wins ?? 0,
      losses: rec.losses ?? 0,
      ties: rec.ties ?? 0,
      points_for: rec.pointsFor ?? 0,
      is_mine: teamId === args.myTeamId ? 1 : 0,
    });

    let teamProj = 0;
    for (const entry of t.roster?.entries ?? []) {
      const player = entry.playerPoolEntry?.player;
      if (!player) continue;
      const slot = SLOT_BY_ID[entry.lineupSlotId ?? -1] ?? `SLOT_${entry.lineupSlotId}`;
      const isStarter = NON_STARTING_SLOTS.has(slot) ? 0 : 1;
      const proj = weeklyStat(player.stats, week, 1);
      const actual = weeklyStat(player.stats, week, 0);
      if (isStarter) teamProj += proj;
      rosters.push({
        league_id: leagueId,
        team_id: teamId,
        week,
        player_id: String(entry.playerId ?? player.id ?? player.fullName ?? "unknown"),
        player_name: player.fullName ?? "Unknown player",
        position: POSITION_BY_ID[player.defaultPositionId ?? -1] ?? "?",
        slot,
        is_starter: isStarter,
        injury_status: player.injuryStatus ?? "",
        proj_points: proj,
        actual_points: actual,
      });
    }
    projByTeam.set(teamId, teamProj);
  }

  const matchups: MatchupRow[] = (data.schedule ?? [])
    .filter((m) => m.matchupPeriodId === matchupPeriod)
    .map((m) => {
      const homeId = m.home?.teamId != null ? String(m.home.teamId) : null;
      const awayId = m.away?.teamId != null ? String(m.away.teamId) : null;
      return {
        league_id: leagueId,
        week: matchupPeriod,
        matchup_id: String(m.id ?? `${homeId}-${awayId}`),
        home_team_id: homeId,
        away_team_id: awayId,
        home_score: m.home?.totalPointsLive ?? m.home?.totalPoints ?? 0,
        away_score: m.away?.totalPointsLive ?? m.away?.totalPoints ?? 0,
        home_proj: homeId ? (projByTeam.get(homeId) ?? 0) : 0,
        away_proj: awayId ? (projByTeam.get(awayId) ?? 0) : 0,
      };
    });

  return { league, teams, matchups, rosters };
}
