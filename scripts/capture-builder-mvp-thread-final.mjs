#!/usr/bin/env node
/**
 * Builder MVP やりとり / 通知 / 案件 — 最終スクリーンショット（PC 1280 + 390）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-mvp-thread-final");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const MVP_KEYS = ["tasful:builder:mvp:v1", "tasful:builder:mvp:notifications:v1"];

async function prep() {
  await page.goto(`${BASE}/builder/mvp-threads.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), MVP_KEYS);
}

async function setRole(role) {
  await page.goto(`${BASE}/builder/mvp-threads.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate((r) => {
    sessionStorage.setItem("tasful:builder:mvp:session:role", r);
    localStorage.setItem("tasful:builder:mvp:role", r);
  }, role);
}

async function shot(name, url, viewport, role) {
  await page.setViewportSize(viewport);
  if (role) await setRole(role);
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
}

const lists = [
  ["partner-list", "/builder/mvp-threads.html?role=partner", "partner"],
  ["user-list", "/builder/mvp-threads.html?role=user", "user"],
  ["vendor-list", "/builder/mvp-threads.html?role=vendor", "vendor"],
];

const details = [
  ["ops-partner-detail", "/builder/mvp-thread.html?threadType=ops_partner&role=partner&id=demo-thread-001", "partner"],
  ["partner-user-detail", "/builder/mvp-thread.html?threadType=partner_user&role=user&id=demo-thread-002", "user"],
  ["user-user-detail", "/builder/mvp-thread.html?threadType=user_user&role=user&id=demo-thread-007", "user"],
  ["vendor-user-detail", "/builder/mvp-thread.html?threadType=vendor_user&role=vendor&id=demo-thread-008", "vendor"],
];

const board = [
  ["board-threads", "/builder/board-threads.html?role=user", "user"],
  ["board-thread", "/builder/board-thread.html?role=user&id=demo-thread-003", "user"],
];

await prep();

for (const [name, url, role] of lists) {
  await shot(`${name}-pc1280`, url, { width: 1280, height: 900 }, role);
  await shot(`${name}-mobile390`, url, { width: 390, height: 844 }, role);
}

for (const [name, url, role] of details) {
  await shot(`${name}-pc1280`, url, { width: 1280, height: 900 }, role);
  await shot(`${name}-mobile390`, url, { width: 390, height: 844 }, role);
}

await shot("mvp-notifications-pc1280", "/builder/mvp-notifications.html?role=user", { width: 1280, height: 900 }, "user");
await shot("mvp-notifications-mobile390", "/builder/mvp-notifications.html?role=user", { width: 390, height: 844 }, "user");
await shot("mvp-notifications-partner-pc1280", "/builder/mvp-notifications.html?role=partner", { width: 1280, height: 900 }, "partner");
await shot("mvp-notifications-partner-mobile390", "/builder/mvp-notifications.html?role=partner", { width: 390, height: 844 }, "partner");

for (const [name, url, role] of board) {
  await shot(`${name}-pc1280`, url, { width: 1280, height: 900 }, role);
  await shot(`${name}-mobile390`, url, { width: 390, height: 844 }, role);
}

await browser.close();
console.log("Done:", OUT_DIR);
