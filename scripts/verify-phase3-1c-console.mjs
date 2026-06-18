#!/usr/bin/env node
import { chromium } from "./lib/playwright-browser.mjs";

const url = process.argv[2] || "http://127.0.0.1:5174/index-top.html";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Console: 0 red errors");
process.exit(0);
