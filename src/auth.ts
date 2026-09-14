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
<body style="font-family:ui-monospace,Menlo,monospace;background:#0B1014;color:#C8D2CC;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="text-align:center;max-width:340px;padding:24px">
<div style="font-size:11px;letter-spacing:.35em;color:#3FD08B;border:1px solid #1E2B26;padding:6px 10px;display:inline-block">RESTRICTED AREA</div>
<h1 style="font:800 26px/1.2 -apple-system,system-ui;letter-spacing:.04em;margin:18px 0 6px;color:#E9EFEA">FF CONTROL ROOM</h1>
<p style="color:#7B8B83;font-size:12.5px;line-height:1.6">Authorization required. Open your tokened link, or enter the access token once.</p>
<form action="/" method="get" style="display:flex;gap:8px;margin-top:14px">
<input name="t" placeholder="access token" autocomplete="off" style="flex:1;background:#10171C;border:1px solid #23302A;border-radius:6px;color:#C8D2CC;font:13px ui-monospace,Menlo,monospace;padding:10px 12px">
<button style="background:#3FD08B;border:0;border-radius:6px;color:#0B1014;font:700 12px -apple-system,system-ui;letter-spacing:.08em;padding:0 16px;cursor:pointer">ENTER</button>
</form></div></body>`;
  return {
    kind: "denied",
    response: new Response(body, {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
    }),
  };
}
