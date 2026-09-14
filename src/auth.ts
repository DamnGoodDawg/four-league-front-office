const COOKIE_NAME = "ffo";

async function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

async function tokenMatches(candidate: string, expected: string): Promise<boolean> {
  if (!candidate || !expected) return false;
  const [a, b] = await Promise.all([sha256(candidate), sha256(expected)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function cookieValue(req: Request): string {
  const header = req.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) return rest.join("=");
  }
  return "";
}

export type AuthResult =
  | { kind: "ok" }
  | { kind: "set-cookie"; response: Response }
  | { kind: "denied"; response: Response };

/**
 * Token gate: a valid ?t=... sets a long-lived cookie and redirects to a clean
 * URL; afterwards the cookie alone authorizes. Comparison is hash-then-
 * timing-safe. DASHBOARD_TOKEN must be configured or everything is denied.
 */
export async function checkAuth(req: Request, env: Env): Promise<AuthResult> {
  const expected = env.DASHBOARD_TOKEN ?? "";
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("t") ?? "";

  if (queryToken && (await tokenMatches(queryToken, expected))) {
    url.searchParams.delete("t");
    const headers = new Headers({
      Location: url.pathname + (url.search || ""),
      "Set-Cookie": `${COOKIE_NAME}=${queryToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`,
    });
    return { kind: "set-cookie", response: new Response(null, { status: 302, headers }) };
  }

  if (await tokenMatches(cookieValue(req), expected)) {
    return { kind: "ok" };
  }

  // Standalone (home-screen) web apps get their own cookie jar on iOS, so the
  // first launch may land here even for the owner — the form re-keys the room.
  const body = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FF Control Room</title>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#141A1E;color:#E9EDEA;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="text-align:center;max-width:340px;padding:24px;font-family:-apple-system,system-ui">
<h1 style="font:700 24px/1.2 -apple-system,system-ui;margin:0 0 8px;color:#E9EDEA">FF Control Room</h1>
<p style="color:#9CA9A1;font-size:13.5px;line-height:1.6">This dashboard is private. Open the link from your text message, or enter your access code once — it's the part after <span style="font-family:ui-monospace,Menlo">t=</span> in that link.</p>
<form action="/" method="get" style="display:flex;gap:8px;margin-top:14px">
<input name="t" placeholder="Access code" autocomplete="off" style="flex:1;background:#1A2226;border:1px solid #313D37;border-radius:8px;color:#E9EDEA;font:13px ui-monospace,Menlo,monospace;padding:10px 12px">
<button style="background:#4CBE8D;border:0;border-radius:8px;color:#141A1E;font:600 13px -apple-system,system-ui;padding:0 18px;cursor:pointer">Unlock</button>
</form></div></body>`;
  return {
    kind: "denied",
    response: new Response(body, {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
    }),
  };
}
