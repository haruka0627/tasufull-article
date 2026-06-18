#!/usr/bin/env node
/**
 * Builder 最終フロー — ops_partner 通し + 一般スレッド 390px スクリーンショット
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-final-flow-bench");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.route("**/*", (route) => {
  const type = route.request().resourceType();
  if (type === "font" || route.request().url().includes("fonts.googleapis")) route.abort();
  else route.continue();
});
const page = await context.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(120000);

async function prepFonts() {
  try {
    await page.addStyleTag({
      content: "*{font-family:system-ui,-apple-system,sans-serif!important}",
    });
    await page.evaluate(() => document.fonts?.ready);
  } catch {
    /* navigation / iframe reload */
  }
}

async function settle(ms = 1500) {
  await page.waitForTimeout(ms);
  await prepFonts();
}

async function shotPage(name, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
  await prepFonts();
  await page.waitForTimeout(800);
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: "disabled", timeout: 20000 });
  console.log("saved", file);
}

async function shotBenchStep(name) {
  await prepFonts();
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({
    path: file,
    clip: { x: 0, y: 0, width: 390, height: 320 },
    animations: "disabled",
    timeout: 20000,
  });
  console.log("saved", file);
}

await page.goto(`${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner&benchViewport=390`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(4000);
await shotBenchStep("ops_partner-bench-idle-mobile390");

await page.click("#opsAddCalendarBtn");
await page.waitForFunction(
  () => window.TasuBuilderOpsPartnerBench?.opsState?.currentStep === "calendar_added",
  { timeout: 90000 }
);
await shotBenchStep("ops_partner-calendar-added-mobile390");

await page.click("#opsAcceptBtn");
await page.waitForFunction(
  () => window.TasuBuilderOpsPartnerBench?.opsState?.partnerDecision === "accepted",
  { timeout: 90000 }
);
await settle();
await shotBenchStep("ops_partner-accepted-mobile390");

await page.click("#opsEnterBtn");
await settle(800);
await page.click("#opsExitBtn");
await settle(800);
await shotBenchStep("ops_partner-site-attendance-mobile390");

await page.click("#opsCompleteBtn");
await page.waitForFunction(
  () => window.TasuBuilderOpsPartnerBench?.runOpsDiagnostics?.()?.completionReportCreated === true,
  { timeout: 90000 }
);
await shotBenchStep("ops_partner-completion-mobile390");

await page.click("#opsApproveBtn");
await page.waitForFunction(
  () => window.TasuBuilderOpsPartnerBench?.runOpsDiagnostics?.()?.adminApprovalCompleted === true,
  { timeout: 90000 }
);
await shotBenchStep("ops_partner-approved-mobile390");

const mvpShots = [
  ["mvp-thread-ops-partner-mobile390", "/builder/mvp-thread.html?threadType=ops_partner&role=partner&id=demo-thread-001", "partner"],
  ["mvp-notifications-partner-mobile390", "/builder/mvp-notifications.html?role=partner", "partner"],
  ["mvp-thread-partner-user-mobile390", "/builder/mvp-thread.html?threadType=partner_user&role=user&id=demo-thread-002", "user"],
  ["mvp-thread-user-user-mobile390", "/builder/mvp-thread.html?threadType=user_user&role=user&id=demo-thread-007", "user"],
  ["mvp-thread-vendor-user-mobile390", "/builder/mvp-thread.html?threadType=vendor_user&role=vendor&id=demo-thread-008", "vendor"],
];

for (const [name, url, role] of mvpShots) {
  await page.goto(`${BASE}/builder/mvp-threads.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate((r) => {
    localStorage.setItem("tasful:builder:mvp:role", r);
    sessionStorage.setItem("tasful:builder:mvp:session:role", r);
  }, role);
  await shotPage(name, url);
}

for (const flow of ["partner_user", "user_user", "vendor_user"]) {
  await page.goto(`${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=${flow}&benchViewport=390`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1500);
  await shotBenchStep(`${flow}-bench-mobile390`);
}

await browser.close();
console.log(`Screenshots saved to ${OUT_DIR}`);
