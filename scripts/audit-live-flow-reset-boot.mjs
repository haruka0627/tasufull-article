#!/usr/bin/env node
/**
 * 固定親URLブート診断 — 内部reset / 無限reload / iframe未表示
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedWorkerBenchUrl, isCanonicalBenchParentUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedWorkerBenchUrl(BASE);
const OUT = path.join("screenshots", "live-flow-reset-audit");
fs.mkdirSync(OUT, { recursive: true });

async function auditPage(label, url) {
  await withPlaywrightBrowser(async (browser) => {const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();

  const metrics = {
    label,
    url,
    replaceStateCount: 0,
    reloadCount: 0,
    bootBenchFromUrlRan: false,
    bootDemoRan: false,
    storageErrors: [],
    framesAt3s: {},
    parentUrlAt3s: "",
    ok: false,
  };

  await page.addInitScript(() => {
    window.__audit = {
      replaceStateCount: 0,
      reloadCount: 0,
      bootDemoCalls: 0,
    };
    const origReplace = history.replaceState.bind(history);
    history.replaceState = (...args) => {
      window.__audit.replaceStateCount += 1;
      return origReplace(...args);
    };
    const origReload = location.reload.bind(location);
    location.reload = (...args) => {
      window.__audit.reloadCount += 1;
      return origReload(...args);
    };
  });

  page.on("pageerror", (err) => {
    metrics.storageErrors.push(String(err.message || err).slice(0, 200));
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const snap = await page.evaluate(() => {
    const frames = ["frame-a-notify", "frame-a-chat", "frame-b-notify", "frame-b-chat"];
    const frameInfo = {};
    frames.forEach((id) => {
      const el = document.getElementById(id);
      const src = el?.src || "";
      const rect = el?.getBoundingClientRect?.() || { width: 0, height: 0 };
      frameInfo[id] = {
        hasSrc: Boolean(src && !src.endsWith("about:blank")),
        src: src.slice(0, 120),
        width: rect.width,
        height: rect.height,
      };
    });
    const params = new URLSearchParams(location.search);
    return {
      parentUrl: location.href,
      forbiddenParams: ["liveFlowReset", "benchReconcile"].filter((k) => params.has(k)),
      replaceStateCount: window.__audit?.replaceStateCount || 0,
      reloadCount: window.__audit?.reloadCount || 0,
      parentRenderCount: window.__tasuBenchAudit ? undefined : undefined,
      benchDebug: window.__tasuBenchAudit?.() || null,
      frameInfo,
      iframeReloadCount: window.__tasuBenchAudit ? null : null,
    };
  });

  const audit = await page.evaluate(() => {
    const dbg = document.getElementById("benchDebugPanel")?.textContent || "";
    return { debugText: dbg.slice(0, 500) };
  });

  metrics.replaceStateCount = snap.replaceStateCount;
  metrics.reloadCount = snap.reloadCount;
  metrics.parentUrlAt3s = snap.parentUrl;
  metrics.framesAt3s = snap.frameInfo;
  metrics.canonicalParentUrl = isCanonicalBenchParentUrl(snap.parentUrl);
  metrics.noForbiddenParams = !(snap.forbiddenParams || []).length;
  metrics.debugText = audit.debugText;

  const allFramesVisible = Object.values(snap.frameInfo).every(
    (f) => f.hasSrc && f.width > 50 && f.height > 50
  );
  metrics.ok =
    metrics.reloadCount < 2 &&
    metrics.replaceStateCount < 10 &&
    allFramesVisible &&
    metrics.canonicalParentUrl &&
    metrics.noForbiddenParams;

  await page.screenshot({ path: path.join(OUT, `${label}-full.png`) });
    });
  return metrics;
}

const boot = await auditPage("fixed-parent", URL);

const report = { at: new Date().toISOString(), url: URL, boot };
fs.writeFileSync(path.join(OUT, "audit-report.json"), JSON.stringify(report, null, 2));

console.log("\n=== fixed parent URL BOOT AUDIT ===");
console.log(boot.ok ? "OK" : "NG", boot);
await closeAllBrowsers();
process.exit(boot.ok ? 0 : 1);
