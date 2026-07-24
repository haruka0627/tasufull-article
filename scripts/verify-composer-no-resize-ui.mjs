#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL =
  "http://127.0.0.1:8788/ai-workspace/?uiReview=code&mode=cross-matching";
const OUT = path.join(__dirname, "..", "screenshots", "composer-resize-investigate");

fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const res = await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const ta = page.locator("#ai-main-textarea");
  await page.locator(".ai-ref-composer__pill").screenshot({
    path: path.join(OUT, "after-pill-empty.png"),
  });

  const empty = await page.evaluate(() => {
    const ta = document.querySelector("#ai-main-textarea");
    const cs = getComputedStyle(ta);
    return {
      resize: cs.resize,
      overflowY: cs.overflowY,
      scrollbarWidth: cs.scrollbarWidth,
      scrollHeight: ta.scrollHeight,
      clientHeight: ta.clientHeight,
      hasVerticalScroll: ta.scrollHeight > ta.clientHeight,
    };
  });

  await ta.fill("1行目\n2行目\n3行目\n4行目\n5行目\n6行目");
  await page.waitForTimeout(400);
  await page.locator(".ai-ref-composer__pill").screenshot({
    path: path.join(OUT, "after-pill-multiline.png"),
  });

  const multi = await page.evaluate(() => {
    const ta = document.querySelector("#ai-main-textarea");
    const cs = getComputedStyle(ta);
    return {
      resize: cs.resize,
      overflowY: cs.overflowY,
      scrollbarWidth: cs.scrollbarWidth,
      scrollHeight: ta.scrollHeight,
      clientHeight: ta.clientHeight,
    };
  });

  const ok =
    res?.status() === 200 &&
    empty.resize === "none" &&
    empty.overflowY === "hidden" &&
    multi.overflowY === "hidden";

  console.log(JSON.stringify({ ok, status: res?.status(), empty, multi }, null, 2));
  process.exit(ok ? 0 : 1);
});
