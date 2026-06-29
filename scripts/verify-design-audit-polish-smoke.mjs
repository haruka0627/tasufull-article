#!/usr/bin/env node
/**
 * Design Audit A/D/C polish — light smoke (8788)
 */
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROUTES = [
  { id: "ai-workspace", path: "ai-workspace.html" },
  { id: "tlv-index", path: "live/index.html" },
  { id: "tlv-watch", path: "live/watch.html", query: "broadcast_id=stub&talkDev=1" },
  { id: "tlv-studio", path: "live/studio.html", query: "talkDev=1" },
  { id: "tlv-creator", path: "live/creator-dashboard.html" },
  { id: "builder-top", path: "builder/builder-top.html" },
  { id: "builder-projects", path: "builder/mvp-projects.html" },
  { id: "bd-public", path: "business-directory/public/list.html" },
  { id: "bd-owner", path: "business-directory/index.html" },
  { id: "analytics-redirect", path: "live/analytics.html" },
];

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
];

function isSevere(text) {
  return !/favicon|404|Failed to load resource|\[TlvPlatformLiveBridge\]|\[TasuLiveBroadcasts\]|\[TasuLiveComments\]|Permissions policy/i.test(
    String(text || ""),
  );
}

const results = [];
const failures = [];

function record(id, status, detail = "") {
  results.push({ id, status, detail });
  if (status === "FAIL") failures.push(`${id}${detail ? `: ${detail}` : ""}`);
  console.log(`  ${status.padEnd(5)} ${id}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("\n=== Design Audit Polish Smoke ===\n");
  const base = await findDevServerBaseUrl({ probePath: "live/index.html" });
  record("dev:8788", "PASS", base);

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      for (const route of ROUTES) {
        const tag = `${route.id}:${vp.name}`;
        const page = await browser.newPage();
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const errors = [];
        page.on("console", (m) => {
          if (m.type() === "error" && isSevere(m.text())) errors.push(m.text());
        });
        page.on("pageerror", (e) => errors.push(e.message));
        try {
          const url = buildLocalPageUrl(base, route.path, route.query || "");
          const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          const status = res?.status() ?? 0;
          if (status === 200 || status === 304) record(`http:${tag}`, "PASS", String(status));
          else record(`http:${tag}`, "FAIL", String(status));

          if (route.id === "analytics-redirect") {
            const href = page.url();
            if (href.includes("studio-analytics")) record(`redirect:${vp.name}`, "PASS");
            else record(`redirect:${vp.name}`, "FAIL", href);
          }
          if (route.id === "ai-workspace") {
            const ui = await page.evaluate(() => ({
              title: document.querySelector(".ai-model-bar__workspace-title")?.textContent?.trim(),
              user: document.querySelector("[data-ai-workspace-user-name]")?.textContent?.trim(),
            }));
            if (ui.title === "回答スタイル") record(`ai-style:${vp.name}`, "PASS");
            else record(`ai-style:${vp.name}`, "FAIL", ui.title || "missing");
            if (ui.user && ui.user !== "はるかまん") record(`ai-user:${vp.name}`, "PASS", ui.user);
            else record(`ai-user:${vp.name}`, "FAIL", ui.user || "missing");
          }
          if (route.id === "builder-top") {
            const hasDemoAlert = await page.evaluate(() =>
              Array.from(document.querySelectorAll("a[onclick]")).some((a) =>
                String(a.getAttribute("onclick") || "").includes("alert('demo"),
              ),
            );
            if (!hasDemoAlert) record(`builder-no-demo:${vp.name}`, "PASS");
            else record(`builder-no-demo:${vp.name}`, "FAIL", "demo alert remains");
          }
          if (errors.length) record(`console:${tag}`, "FAIL", errors.slice(0, 1).join(" | "));
          else record(`console:${tag}`, "PASS", "0 severe");
        } catch (err) {
          record(`smoke:${tag}`, "FAIL", err.message || String(err));
        }
        await page.close();
      }
    }
  });
  await closeAllBrowsers();

  const verdict = failures.length === 0 ? "GO" : "NO-GO";
  console.log(`\nPolish Smoke ${verdict} (${results.filter((r) => r.status === "PASS").length}/${results.length} PASS)\n`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
