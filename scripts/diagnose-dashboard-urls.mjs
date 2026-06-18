/**
 * ローカル各ポートの dashboard.js 差分診断
 * Playwright と実ブラウザで別ポートを見ていないか確認する
 */
const PORTS = [5173, 5174, 5176, 5188, 5199, 5200, 5500, 5502, 8080, 3000];
const MARKER = "2026-06-15-svc-drawer-v3";
const FN_MARKER = "renderDashboardMainContent";

async function probe(port) {
  const base = `http://127.0.0.1:${port}`;
  try {
    const htmlRes = await fetch(`${base}/dashboard.html`, { method: "GET" });
    if (!htmlRes.ok) return { port, online: false, status: htmlRes.status };
    const html = await htmlRes.text();
    const jsRes = await fetch(`${base}/dashboard.js`, { method: "GET" });
    const jsVRes = await fetch(`${base}/dashboard.js?v=${MARKER}`, { method: "GET" });
    const js = jsRes.ok ? await jsRes.text() : "";
    const jsV = jsVRes.ok ? await jsVRes.text() : "";
    return {
      port,
      online: true,
      dashboardHtmlStatus: htmlRes.status,
      dashboardJsStatus: jsRes.status,
      dashboardJsVersionedStatus: jsVRes.status,
      htmlReferencesVersionedJs: html.includes(`dashboard.js?v=${MARKER}`),
      jsHasBuildMarker: js.includes(MARKER),
      jsVersionedHasBuildMarker: jsV.includes(MARKER),
      jsHasMainContentFn: js.includes(FN_MARKER),
      jsBytes: js.length,
      jsVersionedBytes: jsV.length,
      url: `${base}/dashboard.html`,
    };
  } catch (err) {
    return { port, online: false, error: String(err?.message || err) };
  }
}

const results = [];
for (const port of PORTS) {
  results.push(await probe(port));
}

const online = results.filter((r) => r.online);
const playwrightLike = online.find((r) => r.jsHasBuildMarker && r.jsHasMainContentFn);

console.log(JSON.stringify({ marker: MARKER, results, playwrightLikePort: playwrightLike?.port || null }, null, 2));

if (!online.length) {
  console.error("No local dev server found. Start Live Server (5500) or vite (5173) in repo root.");
  process.exit(1);
}

const stale = online.filter((r) => !r.jsHasBuildMarker || !r.jsHasMainContentFn);
if (stale.length) {
  console.warn("Stale dashboard.js detected on ports:", stale.map((r) => r.port).join(", "));
}
