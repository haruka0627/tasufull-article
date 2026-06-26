#!/usr/bin/env node
/**
 * Capture Builder AI UI Phase 7 screenshot (1280)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const outPath = path.join(root, "reports/builder-ai-ui-phase7-1280.png");

async function main() {
  const { chromium } = require("playwright");
  const distHtml = path.join(root, "deploy/cloudflare/dist/builder/builder-ai.html");
  const fileUrl = "file:///" + distHtml.replace(/\\/g, "/");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("[data-builder-ai-ui-capability]", { timeout: 10000 });
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
