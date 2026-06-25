#!/usr/bin/env node
/**
 * Gate-D — Save Playwright storage-state after manual Cloudflare Access OTP.
 * Equivalent to: playwright codegen --save-storage=reports/gate-d-auth-storage.json
 *
 *   node scripts/save-gate-d-auth-storage.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { isCloudflareAccessLoginPage } from "./lib/smoke-access-detect.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "reports", "gate-d-auth-storage.json");
const START_URL = "https://tasufull-article.pages.dev/talk-home.html";
const POLL_MS = 2000;
const MAX_WAIT_MS = 15 * 60 * 1000;

async function isAuthed(page) {
  const url = page.url();
  if (!/tasufull-article\.pages\.dev/i.test(url)) return false;
  const body = await page.content();
  const title = await page.title();
  if (isCloudflareAccessLoginPage({ url, body, title })) return false;
  return body.length > 500;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  console.log("[save-gate-d-auth] Opening headed browser — complete OTP, then wait for auto-save.");
  console.log(`[save-gate-d-auth] start=${START_URL}`);
  console.log(`[save-gate-d-auth] out=${OUT}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(START_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    if (await isAuthed(page)) {
      await page.waitForTimeout(1500);
      await context.storageState({ path: OUT });
      console.log(`[save-gate-d-auth] Saved storage-state (${OUT})`);
      await browser.close();
      return;
    }
    await page.waitForTimeout(POLL_MS);
  }

  await browser.close();
  throw new Error("Timeout — OTP login not detected within 15 minutes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
