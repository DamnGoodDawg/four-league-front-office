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
      if (req.method === "GET" && url.pathname === "/api/data") {
        return json(await buildData(env));
      }
      if (req.method === "POST" && url.pathname === "/api/sync") {
        return json(await runSync(env));
      }
      return json({ error: "not found" }, 404);
    } catch (err) {
      console.log(JSON.stringify({ level: "error", message: err instanceof Error ? err.message : String(err) }));
      return json({ error: "internal error" }, 500);
    }
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(
      runSync(env).then((report) => {
        console.log(JSON.stringify({ level: "info", event: "cron-sync", ok: report.ok, results: report.results }));
      }),
    );
  },
} satisfies ExportedHandler<Env>;
