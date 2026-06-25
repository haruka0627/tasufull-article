#!/usr/bin/env node
/** Trace winning computed styles for watch layout at 1280px */
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const VIDEO_ID = "4d7e3650-b441-4598-9723-475a956cf68a";
const BASE = `http://127.0.0.1:8788/live/watch-video?id=${VIDEO_ID}`;

function sheetRules() {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule.type !== CSSRule.STYLE_RULE) continue;
      const sel = rule.selectorText || "";
      if (
        !sel.includes("tlv-watch-layout") &&
        !sel.includes("tlv-watch-sidebar") &&
        !sel.includes("tlv-related-list__thumb")
      ) {
        continue;
      }
      const body = rule.style.cssText;
      if (
        !body.includes("grid-template-columns") &&
        !body.includes("--tlv-watch") &&
        !/width|height|min-width|max-width/.test(body)
      ) {
        continue;
      }
      out.push({ selector: sel, cssText: body, href: sheet.href || "inline" });
    }
  }
  return out;
}

await withPlaywrightSession(
  async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector(".tlv-watch-layout", { timeout: 60000 });
    await page.waitForTimeout(2000);

    const report = await page.evaluate(() => {
      const pick = (sel) => document.querySelector(sel);
      const layout = pick(".tlv-watch-layout");
      const sidebar = pick(".tlv-watch-sidebar");
      const thumb = pick(".tlv-related-list--yt .tlv-related-list__thumb");
      const body = document.body;

      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      };
      const cs = (el, props) => {
        if (!el) return null;
        const s = getComputedStyle(el);
        return Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
      };

      return {
        inline: {
          layout: layout?.getAttribute("style"),
          sidebar: sidebar?.getAttribute("style"),
          thumb: thumb?.getAttribute("style"),
          body: body?.getAttribute("style"),
        },
        bodyVars: cs(body, [
          "--tlv-watch-sidebar-w",
          "--tlv-watch-thumb-w",
          "--tlv-watch-thumb-h",
          "--tlv-watch-layout-gap",
        ]),
        computed: {
          layout: cs(layout, ["display", "grid-template-columns", "gap", "width"]),
          sidebar: cs(sidebar, ["width", "min-width", "max-width"]),
          thumb: cs(thumb, ["width", "height", "min-width", "max-width"]),
        },
        rects: {
          layout: rect(layout),
          playerWrap: rect(pick(".live-watch__player-wrap")),
          sidebar: rect(sidebar),
          thumb: rect(thumb),
          item: rect(pick(".tlv-related-list--yt .tlv-related-list__item")),
        },
      };
    });

    console.log(JSON.stringify(report, null, 2));

    const rules = await page.evaluate(sheetRules);
    console.log("\n=== matching stylesheet rules (live.css candidates) ===\n");
    for (const r of rules) {
      if (!r.href.includes("live.css") && r.href !== "inline") continue;
      console.log(r.selector);
      console.log(`  ${r.cssText.slice(0, 200)}`);
      console.log(`  (${r.href})\n`);
    }

    await page.close();
  },
  { viewport: { width: 1280, height: 900 } }
);
