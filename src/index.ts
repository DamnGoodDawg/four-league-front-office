import { checkAuth } from "./auth";
import { buildData } from "./data";
import { renderShell } from "./dashboard";
import { runSync } from "./sync";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
}

const SEVERITIES = new Set(["critical", "warning", "suggestion"]);
const KINDS = new Set(["waiver", "lineup", "recap", "system"]);

interface AdvicePost {
  league_id?: string;
  week?: number;
  items?: Array<{ team_id?: string; type?: string; severity?: string; message?: string; deep_link?: string }>;
}

interface BriefingPost { kind?: string; week?: number; title?: string; body?: string }

/** Eastern-time game windows drive sync depth: ~2min during games, 10min otherwise. */
function cadence(now: Date): { run: boolean; withWaivers: boolean } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday");
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const inGameWindow =
    (day === "Sun" && hour >= 12) || ((day === "Thu" || day === "Mon") && hour >= 19);
  const run = inGameWindow || minute % 10 === 0;
  const withWaivers = minute % 10 === 0 && (hour === 6 || hour === 18);
  return { run, withWaivers };
}

export default {
  async fetch(req, env, _ctx): Promise<Response> {
    try {
      const auth = await checkAuth(req, env);
      if (auth.kind === "set-cookie") return auth.response;
      if (auth.kind === "denied") return auth.response;

      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname === "/") {
        return new Response(renderShell(), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex",
          },
        });
      }
      if (req.method === "GET" && (url.pathname === "/api/data" || url.pathname === "/api/analysis-bundle")) {
        return json(await buildData(env));
      }
      if (req.method === "POST" && url.pathname === "/api/sync") {
        return json(await runSync(env));
      }
      if (req.method === "POST" && url.pathname === "/api/advice") {
        const body = (await req.json()) as AdvicePost;
        const items = (body.items ?? []).filter(
          (i) => i.message && SEVERITIES.has(i.severity ?? "") && i.type,
        );
        if (!body.league_id || !body.week || !items.length) {
          return json({ error: "expected { league_id, week, items:[{type,severity,message,...}] }" }, 400);
        }
        const now = new Date().toISOString();
        const stmts = [
          env.DB.prepare(`DELETE FROM advice WHERE league_id = ?1 AND week = ?2 AND source = 'llm'`)
            .bind(body.league_id, body.week),
          ...items.map((i) =>
            env.DB.prepare(
              `INSERT INTO advice (league_id, team_id, week, type, severity, message, deep_link, created_at, source)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'llm')`,
            ).bind(body.league_id, i.team_id ?? "", body.week, i.type, i.severity, i.message, i.deep_link ?? "", now),
          ),
        ];
        await env.DB.batch(stmts);
        return json({ ok: true, written: items.length });
      }
      if (req.method === "POST" && url.pathname === "/api/briefings") {
        const b = (await req.json()) as BriefingPost;
        if (!b.title || !b.body || !KINDS.has(b.kind ?? "")) {
          return json({ error: "expected { kind: waiver|lineup|recap|system, week, title, body }" }, 400);
        }
        const res = await env.DB.prepare(
          `INSERT INTO briefings (kind, week, title, body, created_at) VALUES (?1, ?2, ?3, ?4, ?5)`,
        ).bind(b.kind, b.week ?? 0, b.title, b.body, new Date().toISOString()).run();
        return json({ ok: true, id: res.meta.last_row_id });
      }
      return json({ error: "not found" }, 404);
    } catch (err) {
      console.log(JSON.stringify({ level: "error", message: err instanceof Error ? err.message : String(err) }));
      return json({ error: "internal error" }, 500);
    }
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    const { run, withWaivers } = cadence(new Date());
    if (!run) return;
    ctx.waitUntil(
      runSync(env, withWaivers ? { withWaivers: true } : {}).then((report) => {
        console.log(JSON.stringify({ level: "info", event: "cron-sync", ok: report.ok, results: report.results }));
      }),
    );
  },
} satisfies ExportedHandler<Env>;
