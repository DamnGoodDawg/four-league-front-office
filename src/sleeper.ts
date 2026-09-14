/**
 * Sleeper public API (free, no key): platform-wide trending adds — an early
 * waiver-wire signal. The name map requires the full players dump (~5MB), so
 * trending refreshes only on the twice-daily waiver pass, never the fast loop.
 */

export interface TrendingRow {
  player_name: string;
  position: string;
  pro_team: string;
  adds: number;
}

interface SleeperPlayer {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string | null;
}

export async function fetchTrendingAdds(limit = 25): Promise<TrendingRow[]> {
  const trendRes = await fetch(`https://api.sleeper.app/v1/players/nfl/trending/add?limit=${limit}`, {
    headers: { Accept: "application/json" },
  });
  if (!trendRes.ok) throw new Error(`Sleeper trending: HTTP ${trendRes.status}`);
  const trending = (await trendRes.json()) as Array<{ player_id: string; count: number }>;
  if (!trending.length) return [];

  const mapRes = await fetch("https://api.sleeper.app/v1/players/nfl", {
    headers: { Accept: "application/json" },
  });
  if (!mapRes.ok) throw new Error(`Sleeper players map: HTTP ${mapRes.status}`);
  const players = (await mapRes.json()) as Record<string, SleeperPlayer>;

  return trending.map((t) => {
    const p = players[t.player_id];
    const name = p?.full_name ?? [p?.first_name, p?.last_name].filter(Boolean).join(" ") ?? t.player_id;
    return {
      player_name: name || t.player_id,
      position: p?.position ?? "",
      pro_team: p?.team ?? "",
      adds: t.count,
    };
  });
}
