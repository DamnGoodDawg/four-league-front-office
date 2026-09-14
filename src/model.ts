export type Severity = "critical" | "warning" | "suggestion";

export interface LeagueRow {
  id: string; // "<platform>:<platform_league_id>"
  platform: "espn" | "yahoo";
  platform_league_id: string;
  name: string;
  season: number;
  my_team_id: string;
  current_week: number;
  deep_link: string;
  updated_at: string;
  faab_budget: number | null;
  faab_spent: number | null;
}

export interface TeamRow {
  league_id: string;
  team_id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  is_mine: number;
}

export interface MatchupRow {
  league_id: string;
  week: number;
  matchup_id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number;
  away_score: number;
  home_proj: number;
  away_proj: number;
}

export interface RosterSlotRow {
  league_id: string;
  team_id: string;
  week: number;
  player_id: string;
  player_name: string;
  position: string;
  slot: string;
  is_starter: number;
  injury_status: string;
  proj_points: number;
  actual_points: number;
}

export interface AdviceItem {
  league_id: string;
  team_id: string;
  week: number;
  type: "injury" | "zero-projection" | "start-sit";
  severity: Severity;
  message: string;
  deep_link: string;
}

export interface NormalizedLeague {
  league: LeagueRow;
  teams: TeamRow[];
  matchups: MatchupRow[];
  rosters: RosterSlotRow[];
}
