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

  const body = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Locked</title>
<body style="font-family:system-ui;background:#121714;color:#e7ece7;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="text-align:center"><div style="font-size:40px">🏈</div><h1 style="font-size:20px">Four-League Front Office</h1>
<p style="color:#a3aea6">This dashboard is private. Open it with your tokened link.</p></div></body>`;
  return {
    kind: "denied",
    response: new Response(body, {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
    }),
  };
}
