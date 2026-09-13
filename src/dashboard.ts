/** The dashboard shell: server-rendered chrome, client-fetched data (/api/data). */
export function renderShell(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FAFAF7">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#121714">
<title>Four-League Front Office</title>
<style>
  :root {
    --paper:#FAFAF7; --card:#FFFFFF; --ink:#1C2420; --muted:#5A655E; --faint:#8A948D;
    --line:#DCE1DB; --accent:#16603F;
    --ok:#177245; --warn:#9A6A00; --crit:#B3392E;
    --ok-bg:#E3F0E7; --warn-bg:#F6EDD8; --crit-bg:#F7E3E0;
    --espn:#A8241C; --espn-bg:#F6E6E4; --yahoo:#4E22A3; --yahoo-bg:#ECE5F8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper:#121714; --card:#1A211C; --ink:#E7ECE7; --muted:#A3AEA6; --faint:#778179;
      --line:#2A332C; --accent:#57C08B;
      --ok:#8FD9AC; --warn:#E4C169; --crit:#EC9C8F;
      --ok-bg:#17301F; --warn-bg:#33290F; --crit-bg:#371B17;
      --espn:#F09188; --espn-bg:#3A1D1A; --yahoo:#C0A5F2; --yahoo-bg:#271B3E;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin:0; background:var(--paper); color:var(--ink);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: env(safe-area-inset-top) 14px 40px;
  }
  .wrap { max-width: 1080px; margin: 0 auto; }
  a { color: var(--accent); }
  header { display:flex; align-items:baseline; justify-content:space-between; gap:10px; flex-wrap:wrap; padding:18px 2px 12px; }
  h1 { font-size:19px; margin:0; letter-spacing:.01em; }
  h1 .ball { margin-right:6px; }
  .meta { color:var(--muted); font-size:12.5px; display:flex; gap:10px; align-items:center; }
  button.sync {
    background:var(--accent); color:var(--paper); border:0; border-radius:7px;
    font:600 13px system-ui; padding:6px 12px; cursor:pointer;
  }
  button.sync[disabled] { opacity:.6; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(290px,1fr)); gap:12px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .chip { display:inline-block; font:700 10.5px system-ui; letter-spacing:.06em; padding:2px 7px; border-radius:5px; text-transform:uppercase; vertical-align:1px; }
  .chip.espn { color:var(--espn); background:var(--espn-bg); }
  .chip.yahoo { color:var(--yahoo); background:var(--yahoo-bg); }
  .lg-name { font-size:12.5px; color:var(--muted); margin-left:7px; }
  .row { display:flex; justify-content:space-between; align-items:baseline; gap:10px; margin-top:9px; }
  .row .team { min-width:0; }
  .row .team .name { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .row.opp .team .name { font-weight:400; color:var(--muted); }
  .row .rec { color:var(--faint); font-size:12px; margin-left:6px; font-weight:400; }
  .score { font-size:26px; font-weight:700; font-variant-numeric:tabular-nums; line-height:1.05; }
  .row.opp .score { font-weight:400; color:var(--muted); }
  .proj { color:var(--faint); font-size:12px; font-variant-numeric:tabular-nums; text-align:right; }
  .status-line { margin-top:10px; display:flex; justify-content:space-between; align-items:center; font-size:12.5px; }
  .lead-ok { color:var(--ok); font-weight:600; }
  .lead-bad { color:var(--crit); font-weight:600; }
  .open { font-size:12.5px; white-space:nowrap; }
  section { margin-top:26px; }
  h2 { font-size:14px; text-transform:uppercase; letter-spacing:.1em; color:var(--accent); margin:0 0 10px; }
  .alert { display:flex; gap:10px; align-items:flex-start; padding:9px 2px; border-top:1px solid var(--line); }
  .alert:first-of-type { border-top:0; }
  .tag { flex:0 0 auto; font:700 10.5px system-ui; letter-spacing:.05em; padding:2px 7px; border-radius:999px; margin-top:2px; }
  .tag.critical { color:var(--crit); background:var(--crit-bg); }
  .tag.warning { color:var(--warn); background:var(--warn-bg); }
  .tag.suggestion { color:var(--ok); background:var(--ok-bg); }
  .alert .msg { flex:1; min-width:0; }
  .alert .src { color:var(--faint); font-size:12px; display:block; }
  details { border:1px solid var(--line); border-radius:10px; background:var(--card); margin-top:8px; overflow:hidden; }
  summary { padding:10px 14px; font-weight:600; cursor:pointer; font-size:13.5px; }
  .tblwrap { overflow-x:auto; }
  table { border-collapse:collapse; width:100%; font-size:13px; font-variant-numeric:tabular-nums; }
  th { text-align:left; color:var(--faint); font-size:11px; text-transform:uppercase; letter-spacing:.07em; padding:6px 14px 4px; border-top:1px solid var(--line); }
  td { padding:5px 14px; border-top:1px solid var(--line); white-space:nowrap; }
  td.num, th.num { text-align:right; }
  tr.bench td { color:var(--muted); }
  .st { font-size:11px; font-weight:700; }
  .st.OUT,.st.INJURY_RESERVE,.st.SUSPENSION { color:var(--crit); }
  .st.DOUBTFUL { color:var(--warn); }
  .st.QUESTIONABLE { color:var(--warn); opacity:.75; }
  .pending { border-style:dashed; color:var(--muted); }
  .footer { margin-top:28px; color:var(--faint); font-size:11.5px; }
  .footer .log { margin-top:6px; }
  .empty { color:var(--faint); padding:8px 2px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1><span class="ball">🏈</span>Four-League Front Office</h1>
    <div class="meta"><span id="weekLabel"></span><span id="syncTime">loading…</span>
      <button class="sync" id="syncBtn" type="button">Sync now</button></div>
  </header>
  <div class="grid" id="cards"></div>
  <section><h2>Needs attention</h2><div id="alerts"></div></section>
  <section><h2>My rosters</h2><div id="rosters"></div></section>
  <div class="footer"><span>Read-only by design — every action links out to the platform.</span><div class="log" id="log"></div></div>
</div>
<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);

function leagueCard(lg) {
  const m = lg.matchup, me = lg.my_team;
  const rec = me ? \`\${me.wins}-\${me.losses}\${me.ties ? "-" + me.ties : ""}\` : "";
  let body = '<div class="empty">No matchup found this week.</div>';
  let status = "";
  if (m) {
    const diff = m.my_score - m.opp_score;
    const lead = diff >= 0 ? \`<span class="lead-ok">up \${f1(diff)}</span>\` : \`<span class="lead-bad">down \${f1(-diff)}</span>\`;
    status = \`<div class="status-line">\${lead}<a class="open" href="\${esc(lg.deep_link)}" target="_blank" rel="noopener">Open in \${lg.platform === "espn" ? "ESPN" : "Yahoo"} →</a></div>\`;
    body = \`
      <div class="row"><div class="team"><div class="name">\${esc(me?.name ?? "Me")}<span class="rec">\${rec}</span></div></div>
        <div><div class="score">\${f1(m.my_score)}</div><div class="proj">proj \${f1(m.my_proj)}</div></div></div>
      <div class="row opp"><div class="team"><div class="name">\${esc(m.opp_name)}<span class="rec">\${esc(m.opp_record)}</span></div></div>
        <div><div class="score">\${f1(m.opp_score)}</div><div class="proj">proj \${f1(m.opp_proj)}</div></div></div>\`;
  }
  return \`<div class="card"><span class="chip \${lg.platform}">\${lg.platform}</span><span class="lg-name">\${esc(lg.name)}</span>\${body}\${status}</div>\`;
}

function yahooCard(y) {
  return \`<div class="card pending"><span class="chip yahoo">yahoo</span><span class="lg-name">Yahoo league</span>
    <div style="margin-top:10px">\${esc(y.note)}</div>
    <div class="status-line"><span></span><a class="open" href="\${esc(y.link)}" target="_blank" rel="noopener">Open in Yahoo →</a></div></div>\`;
}

const SLOT_ORDER = ["QB","TQB","RB","RB/WR","WR","WR/TE","TE","FLEX","OP","D/ST","K","P","HC","Bench","IR"];
const slotRank = (s) => { const i = SLOT_ORDER.indexOf(s); return i < 0 ? 99 : i; };

function rosterBlock(lg) {
  const rows = [...lg.roster].sort((a, b) =>
    b.is_starter - a.is_starter || slotRank(a.slot) - slotRank(b.slot) || b.proj - a.proj);
  if (!rows.length) {
    return \`<details><summary>\${esc(lg.my_team?.name ?? lg.name)} <span class="lg-name">\${esc(lg.name)}</span></summary>
      <div class="empty" style="padding:10px 14px">Player-level roster for this league arrives with the Yahoo API (application under review).</div></details>\`;
  }
  const tr = rows.map((r) => \`<tr class="\${r.is_starter ? "" : "bench"}">
    <td>\${esc(r.slot)}</td><td>\${esc(r.player)} <span class="st \${esc(r.status)}">\${r.status && r.status !== "ACTIVE" && r.status !== "NORMAL" ? esc(r.status[0] + r.status.slice(1).toLowerCase().replace("_", " ")) : ""}</span></td>
    <td class="num">\${f1(r.proj)}</td><td class="num">\${f1(r.actual)}</td></tr>\`).join("");
  return \`<details><summary>\${esc(lg.my_team?.name ?? lg.name)} <span class="lg-name">\${esc(lg.name)}</span></summary>
    <div class="tblwrap"><table><thead><tr><th>Slot</th><th>Player</th><th class="num">Proj</th><th class="num">Pts</th></tr></thead>
    <tbody>\${tr}</tbody></table></div></details>\`;
}

function render(d) {
  const weeks = [...new Set(d.leagues.map((l) => l.week))];
  $("weekLabel").textContent = weeks.length ? \`Week \${weeks.join("/")}\` : "";
  $("syncTime").textContent = "updated " + new Date(d.generated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const hasYahoo = d.leagues.some((l) => l.platform === "yahoo");
  $("cards").innerHTML = d.leagues.map(leagueCard).join("") + (hasYahoo ? "" : yahooCard(d.yahoo));
  const alerts = d.leagues.flatMap((lg) => lg.alerts.map((a) => ({ ...a, lg })));
  $("alerts").innerHTML = alerts.length
    ? alerts.map((a) => \`<div class="alert"><span class="tag \${a.severity}">\${a.severity === "critical" ? "ACT" : a.severity === "warning" ? "CHECK" : "TIP"}</span>
        <div class="msg">\${esc(a.message)}<span class="src">\${esc(a.lg.name)} — <a href="\${esc(a.deep_link)}" target="_blank" rel="noopener">fix it there</a></span></div></div>\`).join("")
    : '<div class="empty">Nothing needs attention. Lineups look clean.</div>';
  $("rosters").innerHTML = d.leagues.map(rosterBlock).join("");
  $("log").textContent = d.sync_log.slice(0, 3).map((s) => \`\${s.source}: \${s.status}\`).join(" · ");
}

async function load() {
  try {
    const res = await fetch("/api/data", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    render(await res.json());
  } catch (e) {
    $("syncTime").textContent = "load failed — pull to refresh";
  }
}

$("syncBtn").addEventListener("click", async () => {
  const b = $("syncBtn"); b.disabled = true; b.textContent = "Syncing…";
  try { await fetch("/api/sync", { method: "POST" }); await load(); } finally { b.disabled = false; b.textContent = "Sync now"; }
});

let tick = 0;
async function heartbeat() {
  tick++;
  // While you're actually looking at it, pull fresh platform data every 3rd tick.
  if (document.visibilityState === "visible" && tick % 3 === 0) {
    try { await fetch("/api/sync", { method: "POST" }); } catch {}
  }
  await load();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); });
load();
setInterval(heartbeat, 60000);
</script>
</body>
</html>`;
}
