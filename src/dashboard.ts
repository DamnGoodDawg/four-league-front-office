/**
 * FF Control Room — app shell. Server renders chrome; client fetches /api/data
 * and renders all tabs. Dark, warm, data-dense, plain-spoken. Home is the
 * landing page: alerts + guidance first, details behind tabs.
 */
export function renderShell(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Control Room">
<meta name="theme-color" content="#191310">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<title>FF Control Room</title>
<style>
  :root {
    --bg:#191310; --panel:#211A15; --panel2:#251D17; --well:#1D1712;
    --line:#33281F; --line2:#443627;
    --ink:#EFE7DC; --dim:#B3A493; --faint:#8A7A67;
    --accent:#D98E4A; --accent-deep:#4A351D; --accent-soft:rgba(217,142,74,.13);
    --up:#8FBB72; --up-deep:#33401F;
    --down:#E06A55; --down-deep:#4A241C;
    --warn:#DDAE55; --warn-deep:#453317;
    --espn:#F09387; --espn-bg:#3D231F; --yahoo:#C2A4E6; --yahoo-bg:#2E2438;
    --disp:"Barlow Condensed","Arial Narrow",sans-serif;
    --mono:"IBM Plex Mono","SF Mono",Menlo,monospace;
    --sys:-apple-system,system-ui,"Segoe UI",sans-serif;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 var(--sys);
    padding-bottom:44px; padding-top:env(safe-area-inset-top); -webkit-text-size-adjust:100%; }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:4px; }
  button { font-family:inherit; cursor:pointer; }

  .wrap { max-width:1120px; margin:0 auto; padding:0 16px; }

  header.top { display:flex; align-items:center; justify-content:space-between; gap:14px;
    flex-wrap:wrap; padding:18px 0 10px; }
  h1 { font:700 26px/1 var(--disp); letter-spacing:.02em; margin:0; }
  h1 small { display:block; font:400 11.5px var(--sys); color:var(--dim); margin-top:4px; }
  .statuscluster { display:flex; align-items:center; gap:12px; font:400 11.5px var(--sys); color:var(--dim); }
  .dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--up); margin-right:6px; }
  .dot.stale { background:var(--warn); } .dot.dead { background:var(--down); }
  button.sync { background:var(--accent-soft); border:1px solid var(--accent-deep); color:var(--accent);
    border-radius:8px; font:600 12.5px var(--sys); padding:8px 14px; }
  button.sync:hover { background:var(--accent-deep); }
  button.sync[disabled] { opacity:.5; }

  .stickyhead { position:sticky; top:0; z-index:10; background:var(--bg); margin:0 -16px; padding:0 16px;
    box-shadow:0 1px 0 var(--line); }
  .ticker { display:flex; gap:18px; overflow-x:auto; scrollbar-width:none; padding:7px 0 6px;
    border-bottom:1px solid var(--line); font:500 11px var(--mono); white-space:nowrap; }
  .ticker::-webkit-scrollbar { display:none; }
  .ticker .ti b { color:var(--dim); font-weight:600; margin-right:5px; }
  .ticker .up { color:var(--up); } .ticker .down { color:var(--down); }
  nav.rail { display:flex; gap:4px; overflow-x:auto; scrollbar-width:none; }
  nav.rail::-webkit-scrollbar { display:none; }
  .tab { background:none; border:none; border-bottom:2px solid transparent; color:var(--dim);
    font:600 13.5px var(--sys); padding:11px 12px 9px; white-space:nowrap; }
  .tab[aria-selected="true"] { color:var(--ink); border-bottom-color:var(--accent); }
  .tab .n { display:inline-block; min-width:17px; text-align:center; background:var(--down-deep); color:var(--down);
    border-radius:9px; font:600 10.5px var(--mono); padding:1px 5px; margin-left:5px; }
  .tab .n.zero { background:var(--line); color:var(--faint); }

  section.board { padding:16px 0 8px; }
  section.board[hidden] { display:none; }
  .shead { font:600 12px var(--sys); letter-spacing:.04em; text-transform:uppercase; color:var(--faint);
    margin:22px 0 10px; }
  .shead:first-child { margin-top:2px; }

  /* Home */
  .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .stat { background:linear-gradient(160deg,var(--panel2),var(--panel)); border:1px solid var(--line);
    border-radius:12px; padding:12px 14px 10px; }
  .stat .v { font:600 30px/1 var(--mono); letter-spacing:-.02em; }
  .stat .v small { font-size:16px; color:var(--faint); font-weight:500; }
  .stat .k { font:400 11px var(--sys); color:var(--dim); margin-top:5px; }
  .stat.good .v { color:var(--up); } .stat.bad .v { color:var(--down); } .stat.plain .v { color:var(--ink); }

  .acard { display:flex; gap:12px; align-items:center; background:var(--panel); border:1px solid var(--line);
    border-left:3px solid var(--line2); border-radius:10px; padding:12px 14px; margin-bottom:8px; }
  .acard.critical { border-left-color:var(--down); }
  .acard.warning { border-left-color:var(--warn); }
  .acard.suggestion { border-left-color:var(--accent); }
  .acard .msg { flex:1; min-width:0; font-size:13.5px; line-height:1.5; }
  .acard .src { display:block; font:400 11px var(--sys); color:var(--faint); margin-top:2px; }
  .acard .sevc { font:600 10px var(--sys); letter-spacing:.04em; text-transform:uppercase; padding:3px 8px;
    border-radius:5px; white-space:nowrap; }
  .sevc.critical { color:var(--down); background:var(--down-deep); }
  .sevc.warning { color:var(--warn); background:var(--warn-deep); }
  .sevc.suggestion { color:var(--accent); background:var(--accent-deep); }
  .acard .go { font:600 12px var(--sys); white-space:nowrap; }
  .allclear { display:flex; align-items:center; gap:12px; border:1px solid var(--line); border-radius:12px;
    padding:16px; background:var(--panel); }
  .allclear .ok { width:34px; height:34px; border-radius:50%; background:var(--up-deep); color:var(--up);
    display:grid; place-items:center; font-size:16px; }
  .allclear b { display:block; font-size:14px; }
  .allclear span { color:var(--faint); font-size:12.5px; }

  .mini { display:flex; align-items:baseline; gap:10px; padding:9px 2px; border-bottom:1px solid var(--line);
    font-size:13.5px; }
  .mini:last-child { border-bottom:none; }
  .mini .lgc { flex:0 0 44px; font:600 10.5px var(--mono); color:var(--faint); }
  .mini .who { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mini .who b { font-weight:600; }
  .mini .who span { color:var(--dim); }
  .mini .sc { font:600 13.5px var(--mono); white-space:nowrap; }
  .mini .sc small { color:var(--faint); font-weight:400; }
  .mini .st { flex:0 0 76px; text-align:right; font:600 11.5px var(--sys); }
  .miniwrap, .bteaser { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:6px 14px; }
  .bteaser { display:flex; align-items:center; gap:12px; padding:13px 15px; margin-top:0; }
  .bteaser .t { flex:1; min-width:0; }
  .bteaser .t b { font:600 17px var(--disp); letter-spacing:.02em; display:block; }
  .bteaser .t span { color:var(--faint); font-size:11.5px; }

  /* Matchups */
  .fronts { display:grid; grid-template-columns:repeat(auto-fit,minmax(310px,1fr)); gap:12px; }
  .front { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:13px 15px 11px; }
  .fhead { display:flex; align-items:center; gap:8px; font:400 11px var(--sys); color:var(--dim); margin-bottom:10px; }
  .chip { font:600 10px var(--mono); letter-spacing:.04em; padding:2px 7px; border-radius:5px; }
  .chip.espn { color:var(--espn); background:var(--espn-bg); }
  .chip.yahoo { color:var(--yahoo); background:var(--yahoo-bg); }
  .frow { display:flex; justify-content:space-between; align-items:baseline; gap:10px; margin:3px 0; }
  .frow .t { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:600 15.5px var(--sys); }
  .frow.opp .t { font-weight:400; color:var(--dim); }
  .frow .rec { font:400 11px var(--mono); color:var(--faint); margin-left:6px; }
  .score { font:600 26px var(--mono); letter-spacing:-.02em; }
  .frow.opp .score { font-weight:400; color:var(--dim); font-size:22px; }
  .proj { font:400 10.5px var(--mono); color:var(--faint); text-align:right; }
  .cbar { height:5px; border-radius:3px; background:var(--line); margin:10px 0 8px; position:relative; overflow:hidden; }
  .cbar .fill { position:absolute; inset:0 auto 0 0; background:linear-gradient(90deg,var(--accent),#E8A96A);
    border-radius:3px; transition:width .6s ease; }
  .fstat { display:flex; justify-content:space-between; align-items:center; font:400 11.5px var(--sys); color:var(--dim); }
  .lead-up { color:var(--up); font-weight:600; } .lead-down { color:var(--down); font-weight:600; }
  .ffoot { display:flex; justify-content:flex-end; margin-top:9px; padding-top:9px;
    border-top:1px solid var(--line); font:600 12px var(--sys); }

  /* Rosters */
  .selchips { display:flex; gap:8px; overflow-x:auto; padding-bottom:12px; scrollbar-width:none; }
  .selchips::-webkit-scrollbar { display:none; }
  .selchip { background:var(--panel); border:1px solid var(--line2); color:var(--dim); border-radius:999px;
    font:600 12px var(--sys); padding:7px 13px; white-space:nowrap; }
  .selchip[aria-selected="true"] { color:var(--bg); background:var(--accent); border-color:var(--accent); }
  .tblwrap { overflow-x:auto; border:1px solid var(--line); border-radius:12px; background:var(--panel); }
  table { border-collapse:collapse; width:100%; }
  th { font:600 10.5px var(--sys); letter-spacing:.05em; text-transform:uppercase; color:var(--faint);
    text-align:left; padding:9px 12px 7px; border-bottom:1px solid var(--line2); white-space:nowrap; }
  td { padding:8px 12px; border-bottom:1px solid var(--line); white-space:nowrap; font:500 12.5px var(--mono); }
  tr:last-child td { border-bottom:none; }
  td.p { font:500 13.5px var(--sys); }
  td.num, th.num { text-align:right; }
  .posb { display:inline-block; min-width:36px; text-align:center; font:600 10.5px var(--mono);
    padding:3px 5px; border-radius:5px; background:var(--line); color:var(--dim); }
  .posb.QB{color:#DA9ECF;background:#3B2333}.posb.RB{color:#9CC680;background:#28371E}
  .posb.WR{color:#96C2DC;background:#20313C}.posb.TE{color:#DDB183;background:#3E2D1B}
  .posb.K{color:#CBC6BE;background:#332E29}.posb.DST,.posb.D{color:#B9B4DF;background:#2E2A45}
  .st { font:600 10px var(--mono); margin-left:7px; }
  .st.bad { color:var(--down); } .st.warn { color:var(--warn); }
  tr.bench td { opacity:.55; }
  tr.divider td { background:var(--well); color:var(--faint); font:600 10.5px var(--sys);
    letter-spacing:.06em; text-transform:uppercase; text-align:center; padding:5px; opacity:1; }
  .delta-up { color:var(--up); } .delta-down { color:var(--down); } .delta-flat { color:var(--faint); }

  /* Standings */
  .intel { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:12px; }
  .ipanel { border:1px solid var(--line); border-radius:12px; background:var(--panel); overflow:hidden; }
  .ipanel h3 { display:flex; align-items:center; gap:8px; margin:0; padding:10px 12px;
    font:500 12px var(--sys); color:var(--dim); border-bottom:1px solid var(--line); }
  tr.mine td { color:var(--accent); font-weight:600; }
  tr.mine td:first-child { border-left:2px solid var(--accent); }
  .inote { padding:9px 12px; font:400 11.5px var(--sys); color:var(--faint); }

  /* Briefings */
  .brief { border:1px solid var(--line); border-radius:12px; background:var(--panel); margin-bottom:10px; overflow:hidden; }
  .brief > button { display:flex; width:100%; text-align:left; background:none; border:none; color:inherit;
    align-items:center; gap:12px; padding:13px 15px; }
  .bkind { font:600 10.5px var(--sys); letter-spacing:.03em; padding:3px 8px; border-radius:5px; white-space:nowrap; }
  .bkind.waiver { color:var(--up); background:var(--up-deep); }
  .bkind.lineup { color:var(--warn); background:var(--warn-deep); }
  .bkind.system, .bkind.recap { color:var(--accent); background:var(--accent-deep); }
  .btitle { flex:1; font:600 18px var(--disp); letter-spacing:.02em; }
  .bdate { font:400 10.5px var(--mono); color:var(--faint); white-space:nowrap; }
  .bbody { display:none; padding:2px 16px 18px; border-top:1px solid var(--line); }
  .brief.open .bbody { display:block; }
  .article { max-width:64ch; font:15px/1.75 var(--sys); color:#E2D9CC; }
  .article h3 { font:700 19px var(--disp); letter-spacing:.02em; color:var(--ink); margin:20px 0 6px; }
  .article p { margin:10px 0; }
  .article ul { margin:8px 0; padding-left:20px; }
  .article li { margin:4px 0; }
  .article em { color:var(--dim); }

  .hbanner { border:1px solid rgba(224,106,85,.45); background:var(--down-deep); color:#F2B3A6;
    border-radius:10px; padding:10px 14px; margin-bottom:12px; font-size:12.5px; line-height:1.55; }
  .hbanner b { color:#FFD9D0; }
  .trend { color:var(--up); font:600 10.5px var(--mono); margin-left:7px; white-space:nowrap; }
  .wpanel { border:1px solid var(--line); border-radius:12px; background:var(--panel); overflow:hidden; margin-bottom:12px; }
  .wpanel h3 { display:flex; align-items:center; gap:8px; margin:0; padding:10px 12px;
    font:500 12px var(--sys); color:var(--dim); border-bottom:1px solid var(--line); }
  .wpanel h3 .faab { margin-left:auto; font:500 11px var(--mono); color:var(--warn); }
  .wpanel .plink { padding:9px 12px; font:600 12px var(--sys); border-top:1px solid var(--line); text-align:right; }
  footer { margin-top:26px; border-top:1px solid var(--line); padding:12px 0 8px;
    font:400 11px var(--sys); color:var(--faint); }
  footer .log { font-family:var(--mono); font-size:10px; margin-top:6px; }
  footer .log div { margin-top:3px; }
  .empty { color:var(--faint); font:400 13px var(--sys); padding:14px 4px; }
  @media (max-width:560px) { .stats { grid-template-columns:repeat(3,1fr); gap:8px; }
    .stat .v { font-size:24px; } .mini .st { flex-basis:64px; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>FF Control Room<small id="weekLabel">Loading…</small></h1>
    <div class="statuscluster">
      <span id="uplink"><span class="dot" id="updot"></span><span id="uptext">Connecting…</span></span>
      <button class="sync" id="syncBtn" type="button">Sync now</button>
    </div>
  </header>

  <div class="stickyhead">
  <div class="ticker" id="ticker"></div>
  <nav class="rail" role="tablist">
    <button class="tab" role="tab" data-board="home" aria-selected="true">Home<span class="n zero" id="threatN">0</span></button>
    <button class="tab" role="tab" data-board="matchups">Matchups</button>
    <button class="tab" role="tab" data-board="waivers">Waivers</button>
    <button class="tab" role="tab" data-board="rosters">Rosters</button>
    <button class="tab" role="tab" data-board="standings">Standings</button>
    <button class="tab" role="tab" data-board="briefings">Briefings</button>
  </nav>
  </div>

  <section class="board" id="board-home">
    <div id="homeHealth"></div>
    <div class="stats" id="homeStats"></div>
    <div class="shead" id="homeAlertsHead">Needs your attention</div>
    <div id="homeAlerts"></div>
    <div class="shead">Waiver watch</div>
    <div class="miniwrap" id="homeWaivers"></div>
    <div class="shead">Your matchups</div>
    <div class="miniwrap" id="homeMini"></div>
    <div class="shead">Latest briefing</div>
    <div id="homeBrief"></div>
  </section>
  <section class="board" id="board-matchups" hidden><div class="fronts" id="fronts"></div></section>
  <section class="board" id="board-waivers" hidden><div id="waiverPanels"></div></section>
  <section class="board" id="board-rosters" hidden><div class="selchips" id="forceChips"></div><div id="forceTable"></div></section>
  <section class="board" id="board-standings" hidden><div class="intel" id="intel"></div></section>
  <section class="board" id="board-briefings" hidden><div id="briefs"></div></section>

  <footer>
    <div>Read-only — every change happens on ESPN or Yahoo, one tap away.</div>
    <div class="log" id="log"></div>
  </footer>
</div>
<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
let DATA = null, activeForce = null, lastFetch = 0;

function showBoard(name) {
  document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x.dataset.board === name ? "true" : "false"));
  document.querySelectorAll(".board").forEach((b) => { b.hidden = b.id !== "board-" + name; });
  window.scrollTo({ top: 0 });
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showBoard(t.dataset.board)));

function platformLabel(p) { return p === "espn" ? "ESPN" : "Yahoo"; }
const SEV = { critical: "Needs action", warning: "Worth checking", suggestion: "Suggestion" };
const SEV_ORDER = { critical: 0, warning: 1, suggestion: 2 };

function alertCard(a) {
  return \`<div class="acard \${a.severity}"><span class="sevc \${a.severity}">\${SEV[a.severity]}</span>
    <div class="msg">\${esc(a.message)}<span class="src">\${esc(a.lg.name)}</span></div>
    <a class="go" href="\${esc(a.deep_link)}" target="_blank" rel="noopener">Open in \${platformLabel(a.lg.platform)} →</a></div>\`;
}

const OK_STATUSES = new Set(["ok", "session-ok", "skipped"]);
function renderHealth(d) {
  const bad = d.health.filter((h) => !OK_STATUSES.has(h.status));
  if (!bad.length) { $("homeHealth").innerHTML = ""; return; }
  const lines = bad.map((h) => {
    const hint = h.status === "session-expired"
      ? " — sign in on that platform, copy the cookie again, and update the secret."
      : "";
    return \`<div><b>\${esc(h.source)}</b>: \${esc(h.detail || h.status)}\${hint}</div>\`;
  }).join("");
  $("homeHealth").innerHTML = \`<div class="hbanner"><b>Data feed needs attention.</b>\${lines}</div>\`;
}

function renderHomeWaivers(d) {
  // One headline candidate per league (best projection, or most-added where
  // projections are unknown), so the watch spans all four leagues.
  const seen = new Set();
  const cand = d.leagues
    .map((lg) => {
      const w = [...lg.waivers].sort((a, b) =>
        (b.proj ?? -1) - (a.proj ?? -1) || (b.trending ?? 0) - (a.trending ?? 0) || (b.pct_owned ?? 0) - (a.pct_owned ?? 0))[0];
      return w ? { ...w, lg } : null;
    })
    .filter(Boolean)
    .filter((w) => (seen.has(w.name + w.lg.id) ? false : seen.add(w.name + w.lg.id)));
  if (!cand.length) {
    $("homeWaivers").innerHTML = '<div class="empty">Waiver data refreshes twice a day — nothing loaded yet.</div>';
    return;
  }
  $("homeWaivers").innerHTML = cand.map((w) => \`<div class="mini">
    <span class="lgc">\${esc(tickerCode(w.lg.name))}</span>
    <span class="who"><b>\${esc(w.name)}</b> <span>\${esc(w.position)}\${w.pro_team ? " · " + esc(w.pro_team) : ""}</span>\${w.trending ? \`<span class="trend">▲ \${w.trending.toLocaleString()} adds</span>\` : ""}</span>
    <span class="sc">\${w.proj != null ? "proj " + f1(w.proj) : ""}</span>
    <span class="st"><a href="\${esc(w.lg.players_link)}" target="_blank" rel="noopener">View →</a></span></div>\`).join("");
}

function renderWaivers(d) {
  $("waiverPanels").innerHTML = d.leagues.map((lg) => {
    const faab = lg.faab
      ? \`<span class="faab">FAAB $\${Math.round(lg.faab.budget - lg.faab.spent)} of $\${Math.round(lg.faab.budget)} left</span>\`
      : "";
    const rows = lg.waivers.slice(0, 16).map((w) => \`<tr>
      <td class="p">\${esc(w.name)}\${w.trending ? \`<span class="trend">▲ \${w.trending.toLocaleString()}</span>\` : ""}</td>
      <td><span class="posb \${esc(w.position.replace("/", ""))}">\${esc(w.position)}</span></td>
      <td>\${esc(w.pro_team || "—")}</td>
      <td class="num">\${w.proj != null ? f1(w.proj) : "—"}</td>
      <td class="num">\${w.pct_owned != null ? w.pct_owned + "%" : "—"}</td>
      <td>\${esc(w.note)}</td></tr>\`).join("");
    const body = rows || \`<tr><td colspan="6" class="empty" style="white-space:normal">No candidates loaded yet — refreshes twice a day.</td></tr>\`;
    return \`<div class="wpanel"><h3><span class="chip \${lg.platform}">\${platformLabel(lg.platform).toUpperCase()}</span>\${esc(lg.name)}\${faab}</h3>
      <div class="tblwrap" style="border:none;border-radius:0"><table><thead><tr><th>Player</th><th>Pos</th><th>Team</th><th class="num">Proj</th><th class="num">%Ros</th><th>Status</th></tr></thead><tbody>\${body}</tbody></table></div>
      <div class="plink"><a href="\${esc(lg.players_link)}" target="_blank" rel="noopener">Open player pool on \${platformLabel(lg.platform)} →</a></div></div>\`;
  }).join("");
}

function renderHome(d) {
  const ms = d.leagues.filter((l) => l.matchup);
  const leading = ms.filter((l) => l.matchup.my_score >= l.matchup.opp_score).length;
  const alerts = d.leagues.flatMap((lg) => lg.alerts.map((a) => ({ ...a, lg })))
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  const yet = ms.reduce((s, l) => s + l.matchup.my_zero, 0);

  $("threatN").textContent = alerts.length;
  $("threatN").className = "n" + (alerts.length ? "" : " zero");

  $("homeStats").innerHTML =
    \`<div class="stat \${leading >= ms.length - leading ? "good" : "bad"}"><div class="v">\${leading}<small> of \${ms.length}</small></div><div class="k">matchups leading</div></div>\` +
    \`<div class="stat \${alerts.length ? "bad" : "good"}"><div class="v">\${alerts.length}</div><div class="k">alert\${alerts.length === 1 ? "" : "s"} open</div></div>\` +
    \`<div class="stat plain"><div class="v">\${yet}</div><div class="k">of your starters yet to play</div></div>\`;

  $("homeAlerts").innerHTML = alerts.length
    ? alerts.map(alertCard).join("")
    : '<div class="allclear"><div class="ok">✓</div><div><b>All clear</b><span>No lineup action needed right now.</span></div></div>';

  $("homeMini").innerHTML = ms.map((lg) => {
    const m = lg.matchup;
    const up = m.my_score >= m.opp_score;
    const diff = Math.abs(m.my_score - m.opp_score);
    const st = m.win_pct != null
      ? \`<span class="st \${m.win_pct >= 50 ? "lead-up" : "lead-down"}">\${m.win_pct}% win</span>\`
      : \`<span class="st \${up ? "lead-up" : "lead-down"}">\${up ? "Up" : "Down"} \${f1(diff)}</span>\`;
    return \`<div class="mini"><span class="lgc">\${esc(tickerCode(lg.name))}</span>
      <span class="who"><b>\${esc(lg.my_team?.name ?? "Me")}</b> <span>vs \${esc(m.opp_name)}</span></span>
      <span class="sc">\${f1(m.my_score)} <small>— \${f1(m.opp_score)}</small></span>
      \${st}</div>\`;
  }).join("") || '<div class="empty">No live matchups.</div>';

  const b = d.briefings[0];
  $("homeBrief").innerHTML = b
    ? \`<div class="bteaser"><span class="bkind \${esc(b.kind)}">\${esc(KIND[b.kind] ?? b.kind)}</span>
        <div class="t"><b>\${esc(b.title)}</b><span>Week \${b.week}</span></div>
        <a class="go" href="#" onclick="showBoard('briefings');return false" style="font:600 12px var(--sys)">Read →</a></div>\`
    : '<div class="empty">No briefings yet.</div>';
}

function frontCard(lg) {
  const m = lg.matchup, me = lg.my_team;
  const rec = me ? \`\${me.wins}-\${me.losses}\${me.ties ? "-" + me.ties : ""}\` : "";
  if (!m) return \`<div class="front"><div class="fhead"><span class="chip \${lg.platform}">\${platformLabel(lg.platform).toUpperCase()}</span>\${esc(lg.name)}</div><div class="empty">No matchup this week.</div></div>\`;
  const total = m.my_score + m.opp_score;
  const share = m.win_pct != null ? m.win_pct
    : total > 0 ? (m.my_score / total) * 100
    : (m.my_proj + m.opp_proj > 0 ? (m.my_proj / (m.my_proj + m.opp_proj)) * 100 : 50);
  const diff = m.my_score - m.opp_score;
  const odds = m.win_pct != null
    ? \` <span class="\${m.win_pct >= 50 ? "lead-up" : "lead-down"}">· \${m.win_pct}% to win</span>\` : "";
  const lead = (diff >= 0 ? \`<span class="lead-up">Up \${f1(diff)}</span>\` : \`<span class="lead-down">Down \${f1(-diff)}</span>\`) + odds;
  const left = \`Yet to play: \${m.my_zero} vs \${m.opp_zero == null ? "—" : m.opp_zero}\`;
  return \`<div class="front">
    <div class="fhead"><span class="chip \${lg.platform}">\${platformLabel(lg.platform).toUpperCase()}</span><span style="overflow:hidden;text-overflow:ellipsis">\${esc(lg.name)}</span><span style="margin-left:auto">Week \${lg.week}</span></div>
    <div class="frow"><div class="t">\${esc(me?.name ?? "Me")}<span class="rec">\${rec}</span></div>
      <div><div class="score">\${f1(m.my_score)}</div><div class="proj">proj \${f1(m.my_proj)}</div></div></div>
    <div class="frow opp"><div class="t">\${esc(m.opp_name)}<span class="rec">\${esc(m.opp_record)}</span></div>
      <div><div class="score">\${f1(m.opp_score)}</div><div class="proj">proj \${f1(m.opp_proj)}</div></div></div>
    <div class="cbar"><div class="fill" style="width:\${share.toFixed(1)}%"></div></div>
    <div class="fstat">\${lead}<span>\${left}</span></div>
    <div class="ffoot"><a href="\${esc(lg.deep_link)}" target="_blank" rel="noopener">Open in \${platformLabel(lg.platform)} →</a></div>
  </div>\`;
}

const SLOT_ORDER = ["QB","TQB","RB","RB/WR","WR","WR/TE","TE","FLEX","OP","D/ST","D","DL","LB","DB","K","P","HC","Bench","IR"];
const slotRank = (s) => { const i = SLOT_ORDER.indexOf(s); return i < 0 ? 90 : i; };
function statusTag(st) {
  if (!st || st === "ACTIVE" || st === "NORMAL") return "";
  const bad = st === "OUT" || st === "INJURY_RESERVE" || st === "SUSPENSION";
  const label = st === "INJURY_RESERVE" ? "IR" : st === "QUESTIONABLE" ? "Q" : st === "DOUBTFUL" ? "D" : st === "SUSPENSION" ? "SUS" : st;
  return \`<span class="st \${bad ? "bad" : "warn"}">\${esc(label)}</span>\`;
}
function renderForces(d) {
  $("forceChips").innerHTML = d.leagues.map((lg) =>
    \`<button class="selchip" data-lg="\${esc(lg.id)}" aria-selected="\${lg.id === activeForce}">\${esc(lg.my_team?.name ?? lg.name)} · \${platformLabel(lg.platform)}</button>\`).join("");
  document.querySelectorAll(".selchip").forEach((c) => c.addEventListener("click", () => { activeForce = c.dataset.lg; renderForces(DATA); }));
  const lg = d.leagues.find((l) => l.id === activeForce) ?? d.leagues[0];
  if (!lg) { $("forceTable").innerHTML = '<div class="empty">No rosters yet.</div>'; return; }
  const rows = [...lg.roster].sort((a, b) => b.is_starter - a.is_starter || slotRank(a.slot) - slotRank(b.slot) || b.proj - a.proj);
  let benchShown = false, body = "";
  for (const r of rows) {
    if (!r.is_starter && !benchShown) { body += '<tr class="divider"><td colspan="5">Bench</td></tr>'; benchShown = true; }
    const delta = r.actual - r.proj;
    const dcls = Math.abs(delta) < 0.05 ? "delta-flat" : delta > 0 ? "delta-up" : "delta-down";
    const pos = r.position.replace("/", "");
    body += \`<tr class="\${r.is_starter ? "" : "bench"}"><td><span class="posb \${esc(pos)}">\${esc(r.slot)}</span></td>
      <td class="p">\${esc(r.player)}\${statusTag(r.status)}</td>
      <td class="num">\${f1(r.proj)}</td><td class="num">\${f1(r.actual)}</td>
      <td class="num \${dcls}">\${delta >= 0 ? "+" : ""}\${f1(delta)}</td></tr>\`;
  }
  $("forceTable").innerHTML = \`<div class="tblwrap"><table><thead><tr><th>Slot</th><th>Player</th><th class="num">Proj</th><th class="num">Pts</th><th class="num">+/-</th></tr></thead><tbody>\${body}</tbody></table></div>\`;
}

function renderIntel(d) {
  $("intel").innerHTML = d.leagues.map((lg) => {
    const rows = lg.standings.map((s, i) => \`<tr class="\${s.is_mine ? "mine" : ""}"><td>\${i + 1}</td><td class="p">\${esc(s.name)}</td><td class="num">\${s.wins}-\${s.losses}\${s.ties ? "-" + s.ties : ""}</td><td class="num">\${f1(s.points_for)}</td></tr>\`).join("");
    const partial = lg.platform === "yahoo" && lg.standings.length < 4
      ? '<div class="inote">Only your matchup is synced from Yahoo so far — full standings are coming.</div>' : "";
    return \`<div class="ipanel"><h3><span class="chip \${lg.platform}">\${platformLabel(lg.platform).toUpperCase()}</span>\${esc(lg.name)}</h3>
      <div class="tblwrap" style="border:none;border-radius:0"><table><thead><tr><th>#</th><th>Team</th><th class="num">W-L</th><th class="num">PF</th></tr></thead><tbody>\${rows}</tbody></table></div>\${partial}</div>\`;
  }).join("");
}

function md(src) {
  const lines = esc(src).split(/\\r?\\n/);
  let html = "", para = [], list = [];
  const flushP = () => { if (para.length) { html += "<p>" + para.join(" ") + "</p>"; para = []; } };
  const flushL = () => { if (list.length) { html += "<ul>" + list.map((x) => "<li>" + x + "</li>").join("") + "</ul>"; list = []; } };
  const inline = (s) => s
    .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
    .replace(/\\*([^*]+)\\*/g, "<em>$1</em>")
    .replace(/\\[([^\\]]+)\\]\\((https?:[^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushP(); flushL(); continue; }
    if (line.startsWith("## ")) { flushP(); flushL(); html += "<h3>" + inline(line.slice(3)) + "</h3>"; }
    else if (line.startsWith("- ")) { flushP(); list.push(inline(line.slice(2))); }
    else para.push(inline(line));
  }
  flushP(); flushL();
  return html;
}
const KIND = { waiver: "Waivers", lineup: "Lineup", system: "System", recap: "Recap" };
function renderBriefs(d) {
  if (!d.briefings.length) { $("briefs").innerHTML = '<div class="empty">No briefings yet — the first analysis posts here on schedule.</div>'; return; }
  $("briefs").innerHTML = d.briefings.map((b) => {
    const date = new Date(b.created_at + (b.created_at.endsWith("Z") ? "" : "Z")).toLocaleDateString([], { month: "short", day: "numeric" });
    return \`<div class="brief" id="brief-\${b.id}"><button type="button" onclick="this.parentElement.classList.toggle('open')">
      <span class="bkind \${esc(b.kind)}">\${esc(KIND[b.kind] ?? b.kind)}</span><span class="btitle">\${esc(b.title)}</span><span class="bdate">Wk \${b.week} · \${date}</span></button>
      <div class="bbody"><div class="article">\${md(b.body)}</div></div></div>\`;
  }).join("");
  document.querySelector(".brief")?.classList.add("open");
}

function tickerCode(name) {
  return name.replace(/^The\\s+/i, "").split(/\\s+/)[0].slice(0, 4).toUpperCase();
}
function render(d) {
  DATA = d;
  const weeks = [...new Set(d.leagues.map((l) => l.week))];
  $("weekLabel").textContent = weeks.length ? \`Week \${weeks.join("/")} · \${d.leagues.length} leagues\` : "Waiting for first sync";
  $("ticker").innerHTML = d.leagues.map((lg) => {
    const m = lg.matchup;
    if (!m) return \`<span class="ti"><b>\${esc(tickerCode(lg.name))}</b>—</span>\`;
    const up = m.my_score >= m.opp_score;
    return \`<span class="ti"><b>\${esc(tickerCode(lg.name))}</b><span class="\${up ? "up" : "down"}">\${f1(m.my_score)}\${up ? " ▲" : " ▼"}</span><span style="color:var(--faint)"> \${f1(m.opp_score)}</span></span>\`;
  }).join("");
  renderHealth(d); renderHome(d); renderHomeWaivers(d);
  $("fronts").innerHTML = d.leagues.map(frontCard).join("");
  renderWaivers(d); renderForces(d); renderIntel(d); renderBriefs(d);
  const errs = d.sync_log.filter((s) => s.status !== "ok" && s.status !== "session-ok").length;
  $("log").innerHTML = d.sync_log.slice(0, 4).map((s) => \`<div>\${esc(s.at.slice(11, 19))}Z · \${esc(s.source)} · \${esc(s.status)}</div>\`).join("");
  lastFetch = Date.now();
  tickUplink(errs > 0);
}
function tickUplink(hasErr) {
  const age = Math.round((Date.now() - lastFetch) / 1000);
  $("updot").className = "dot" + (hasErr ? " dead" : age > 360 ? " stale" : "");
  $("uptext").textContent = lastFetch ? (age < 8 ? "Updated just now" : \`Updated \${age}s ago\`) : "Connecting…";
}
setInterval(() => tickUplink(false), 5000);

async function load() {
  try {
    const res = await fetch("/api/data", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    render(await res.json());
  } catch { $("uptext").textContent = "Connection lost — retrying"; $("updot").className = "dot dead"; }
}
$("syncBtn").addEventListener("click", async () => {
  const b = $("syncBtn"); b.disabled = true; b.textContent = "Syncing…";
  try { await fetch("/api/sync", { method: "POST" }); await load(); }
  finally { b.disabled = false; b.textContent = "Sync now"; }
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); });
let tick = 0;
setInterval(async () => {
  tick++;
  if (document.visibilityState === "visible" && tick % 3 === 0) {
    try { await fetch("/api/sync", { method: "POST" }); } catch {}
  }
  if (document.visibilityState === "visible") await load();
}, 60000);
load();
</script>
</body>
</html>`;
}
