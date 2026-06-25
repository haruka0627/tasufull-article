#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const VIDEO_ID = "4d7e3650-b441-4598-9723-475a956cf68a";
const BASE = `http://127.0.0.1:8788/live/watch-video?id=${VIDEO_ID}`;
const OUT = path.resolve("scripts/tmp-watch-ratio-shots/watch-recovery-1280.png");

const errors = [];

await withPlaywrightSession(
  async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(String(err)));

    const cssResp = await page.goto(
      "http://127.0.0.1:8788/live/live.css?v=watch-css-single-source-v2",
      { waitUntil: "domcontentloaded" }
    );
    const cssOk = cssResp?.status() === 200 && (await cssResp.text()).includes(":root");

    await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector(".tlv-watch-layout", { timeout: 60000 });
    await page.waitForTimeout(2000);

    const metrics = await page.evaluate(() => {
      const layout = document.querySelector(".tlv-watch-layout");
      const cs = layout ? getComputedStyle(layout) : null;
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      return {
        hasLayout: !!layout,
        gridTemplateColumns: cs?.gridTemplateColumns,
        display: cs?.display,
        bodyBg,
        title: document.title,
      };
    });

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    await page.screenshot({ path: OUT, fullPage: false });

    console.log(JSON.stringify({ cssOk, cssStatus: cssResp?.status(), metrics, consoleErrors: errors }, null, 2));
    console.log(`Screenshot: ${OUT}`);
    await page.close();
  },
  { viewport: { width: 1280, height: 900 } }
);
