#!/usr/bin/env node
/** ops_partner 2窓ベンチ — ツールバースクリーンショット */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "builder-ops-partner-bench-toolbar");
fs.mkdirSync(OUT, { recursive: true });

const BASE = await requireDevServer();
const PATH = "/chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.route("**/*", (route) => {
  const type = route.request().resourceType();
  if (type === "font" || type === "media") route.abort();
  else route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(120000);

async function shotToolbar(name, vp) {
  await page.setViewportSize(vp);
  await page.goto(`${BASE}${PATH}&benchViewport=${vp.width === 390 ? 390 : 1280}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("#builderBenchOpsRow", { timeout: 60000 });
  await page.waitForSelector("#opsAddCalendarBtn", { timeout: 60000 });
  await page.evaluate(() => {
    document.querySelectorAll("iframe").forEach((f) => {
      f.style.visibility = "hidden";
    });
    document.querySelectorAll(".bench-main, .bench-cols, .bench-col").forEach((el) => {
      el.style.display = "none";
    });
  });
  await page.waitForTimeout(400);
  const clipH = Math.min(520, vp.height);
  const cdp = await context.newCDPSession(page);
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width: vp.width, height: clipH, scale: 1 },
    captureBeyondViewport: false,
  });
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  console.log("saved", file);
}

await shotToolbar("toolbar-pc1280", { width: 1280, height: 900 });
await shotToolbar("toolbar-mobile390", { width: 390, height: 844 });

await browser.close();
console.log(`\nFormal URL: ${BASE}${PATH}`);
