import type { AdviceItem, LeagueRow, RosterSlotRow } from "./model";

const ELIGIBLE_SLOTS: Record<string, string[]> = {
  QB: ["QB", "TQB", "OP"],
  RB: ["RB", "RB/WR", "FLEX", "OP"],
  WR: ["WR", "RB/WR", "WR/TE", "FLEX", "OP"],
  TE: ["TE", "WR/TE", "FLEX", "OP"],
  K: ["K"],
  "D/ST": ["D/ST"],
};

const CRITICAL_STATUSES = new Set(["OUT", "INJURY_RESERVE", "SUSPENSION"]);
const WARNING_STATUSES = new Set(["DOUBTFUL"]);
const START_SIT_MIN_DELTA = 2;

function fmt(n: number): string {
  return n.toFixed(1);
}

/** Rules run only against my team in the league's current week. */
export function generateAdvice(league: LeagueRow, rosters: RosterSlotRow[]): AdviceItem[] {
  const out: AdviceItem[] = [];
  const mine = rosters.filter(
    (r) => r.team_id === league.my_team_id && r.week === league.current_week,
  );
  const starters = mine.filter((r) => r.is_starter === 1);
  const bench = mine.filter((r) => r.is_starter === 0 && r.slot !== "IR");

  const push = (
    type: AdviceItem["type"],
    severity: AdviceItem["severity"],
    message: string,
  ): void => {
    out.push({
      league_id: league.id,
      team_id: league.my_team_id,
      week: league.current_week,
      type,
      severity,
      message,
      deep_link: league.deep_link,
    });
  };

  for (const s of starters) {
    if (CRITICAL_STATUSES.has(s.injury_status)) {
      push("injury", "critical", `${s.player_name} (${s.slot}) is ${s.injury_status.replace("_", " ")} — swap before lock.`);
    } else if (WARNING_STATUSES.has(s.injury_status)) {
      push("injury", "warning", `${s.player_name} (${s.slot}) is DOUBTFUL — have a backup ready.`);
    } else if (s.proj_points === 0 && s.actual_points === 0) {
      push("zero-projection", "warning", `${s.player_name} (${s.slot}) projects 0.0 — bye week or not playing?`);
    }
  }

  for (const b of bench) {
    if (b.proj_points <= 0 || CRITICAL_STATUSES.has(b.injury_status) || WARNING_STATUSES.has(b.injury_status)) {
      continue;
    }
    const eligible = ELIGIBLE_SLOTS[b.position] ?? [];
    const replaceable = starters
      .filter((s) => eligible.includes(s.slot))
      .sort((a, z) => a.proj_points - z.proj_points);
    const weakest = replaceable[0];
    if (!weakest) continue;
    const delta = b.proj_points - weakest.proj_points;
    if (delta >= START_SIT_MIN_DELTA) {
      push(
        "start-sit",
        "suggestion",
        `Start ${b.player_name} over ${weakest.player_name} (${weakest.slot})? ESPN projects +${fmt(delta)} (${fmt(b.proj_points)} vs ${fmt(weakest.proj_points)}).`,
      );
    }
  }

  return out;
}
