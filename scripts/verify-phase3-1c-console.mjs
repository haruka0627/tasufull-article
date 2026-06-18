#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const url = process.argv[2] || "http://127.0.0.1:5174/index-top.html";
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
});
if (errors.length) {
  console.error(errors.join("\n"));
  await closeAllBrowsers();
  process.exit(1);
}
console.log("Console: 0 red errors");
await closeAllBrowsers();
process.exit(0);
