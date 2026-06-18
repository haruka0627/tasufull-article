#!/usr/bin/env node
/**
 * Builder 一般案件フロー — 2窓ベンチ + スレッド 390px / 1280px スクリーンショット
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-general-flow-bench");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = await requireDevServer();
const FLOWS = ["partner_user", "user_user", "vendor_user"];
await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext();
await context.route("**/*", (route) => {
  if (route.request().resourceType() === "font") route.abort();
  else route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(120000);

async function shotToolbar(name, flow, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=${flow}&benchViewport=390`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("#builderBenchGeneralRow", { timeout: 60000 });
  await page.evaluate(() => window.TasuBuilderGeneralFlowBench?.runFullCycle?.());
  await page.waitForTimeout(3000);
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({
    path: file,
    clip: { x: 0, y: 0, width: viewport.width, height: Math.min(420, viewport.height) },
    animations: "disabled",
    timeout: 30000,
  });
  console.log("saved", file);
}

async function shotThread(name, flow, role, threadId, threadType, viewport) {
  await page.setViewportSize(viewport);
  const sp = new URLSearchParams({
    thread_id: threadId,
    id: threadId.replace("thread-", "demo-thread-"),
    role,
    threadType,
  });
  await page.goto(`${BASE}/builder/mvp-thread.html?${sp.toString()}`, { waitUntil: "domcontentloaded" });
  await page.evaluate((r) => {
    localStorage.setItem("tasful:builder:mvp:role", r);
    sessionStorage.setItem("tasful:builder:mvp:session:role", r);
  }, role);
  await page.waitForTimeout(1200);
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: "disabled", timeout: 45000 });
  console.log("saved", file);
}

for (const flow of FLOWS) {
  await shotToolbar(`${flow}-bench-after-cycle-mobile390`, flow, { width: 390, height: 844 });
  await shotToolbar(`${flow}-bench-after-cycle-pc1280`, flow, { width: 1280, height: 900 });

  const info = await page.evaluate(() => {
    const s = window.TasuBuilderGeneralFlowBench?.genState || {};
    const f = window.TasuBuilderDualWindowBench?.flow?.() || {};
    return { threadId: s.threadId, threadType: f.threadType, roleA: f.sideA?.role, roleB: f.sideB?.role };
  });

  if (info.threadId) {
    await shotThread(
      `${flow}-thread-a-mobile390`,
      flow,
      info.roleA,
      info.threadId,
      info.threadType,
      { width: 390, height: 844 }
    );
    await shotThread(
      `${flow}-thread-b-mobile390`,
      flow,
      info.roleB,
      info.threadId,
      info.threadType,
      { width: 390, height: 844 }
    );
  }
}

});
console.log(`Screenshots saved to ${OUT_DIR}`);

await closeAllBrowsers();
