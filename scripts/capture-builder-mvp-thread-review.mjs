#!/usr/bin/env node
/**
 * Builder MVP スレッド / 通知 — PC 1280 + 390 スクリーンショット
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-mvp-thread-review");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = await requireDevServer();
await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext();
const page = await context.newPage();

const MVP_KEYS = ["tasful:builder:mvp:v1", "tasful:builder:mvp:notifications:v1"];

async function prep() {
  await page.goto(`${BASE}/builder/mvp-threads.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), MVP_KEYS);
}

async function setRole(role) {
  await page.evaluate((r) => {
    sessionStorage.setItem("tasful:builder:mvp:session:role", r);
    localStorage.setItem("tasful:builder:mvp:role", r);
  }, role);
}

async function shot(name, url, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
}

const lists = [
  ["ops-partner-list", "/builder/mvp-threads.html?threadType=ops_partner&role=partner", "partner"],
  ["user-ops-list", "/builder/mvp-threads.html?threadType=user_ops&role=user", "user"],
  ["general-project-list", "/builder/mvp-threads.html?threadType=general_project&role=user", "user"],
  ["worker-project-list", "/builder/mvp-threads.html?threadType=worker_project&role=partner", "partner"],
  ["partner-all-list", "/builder/mvp-threads.html?role=partner", "partner"],
];

const details = [
  ["ops-partner-detail", "/builder/mvp-thread.html?threadType=ops_partner&role=partner&id=demo-thread-001", "partner"],
  ["user-ops-detail", "/builder/mvp-thread.html?threadType=user_ops&role=user&id=demo-thread-002", "user"],
  ["general-project-detail", "/builder/mvp-thread.html?threadType=general_project&role=user&id=demo-thread-003", "user"],
  ["worker-project-detail", "/builder/mvp-thread.html?threadType=worker_project&role=partner&id=demo-thread-004", "partner"],
];

await prep();

for (const [name, url, role] of lists) {
  await setRole(role);
  await shot(`${name}-pc1280`, url, { width: 1280, height: 900 });
  await shot(`${name}-mobile390`, url, { width: 390, height: 844 });
}

for (const [name, url, role] of details) {
  await setRole(role);
  await shot(`${name}-pc1280`, url, { width: 1280, height: 900 });
  await shot(`${name}-mobile390`, url, { width: 390, height: 844 });
}

await setRole("partner");
await shot("mvp-notifications-partner-pc1280", "/builder/mvp-notifications.html?role=partner", {
  width: 1280,
  height: 900,
});
await shot("mvp-notifications-partner-mobile390", "/builder/mvp-notifications.html?role=partner", {
  width: 390,
  height: 844,
});

await setRole("user");
await shot("mvp-notifications-user-pc1280", "/builder/mvp-notifications.html?role=user", {
  width: 1280,
  height: 900,
});

await setRole("partner");
await shot("partner-dashboard-pc1280", "/builder/index.html", { width: 1280, height: 900 });
await shot("partner-dashboard-mobile390", "/builder/index.html", { width: 390, height: 844 });

await setRole("user");
await shot("user-dashboard-pc1280", "/builder/user-dashboard.html", { width: 1280, height: 900 });

});
console.log("Done:", OUT_DIR);

await closeAllBrowsers();
