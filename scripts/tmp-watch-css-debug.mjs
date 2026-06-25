#!/usr/bin/env node
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const URL =
  "http://127.0.0.1:8788/live/watch-video?id=4d7e3650-b441-4598-9723-475a956cf68a";

await withPlaywrightSession(
  async ({ page }) => {
    const cssResponses = [];
    page.on("response", (r) => {
      if (r.url().includes("live.css")) cssResponses.push({ url: r.url(), status: r.status() });
    });
    await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(3000);

    const report = await page.evaluate(() => {
      const sels = [
        ".tlv-watch-layout",
        ".tlv-watch-main",
        ".tlv-watch-sidebar",
        ".live-watch__player-wrap",
        ".tlv-related-list--yt",
        "video.live-watch__player",
      ];
      const exists = Object.fromEntries(sels.map((s) => [s, !!document.querySelector(s)]));

      const layout = document.querySelector(".tlv-watch-layout");
      const cs = layout ? getComputedStyle(layout) : null;

      const matched = [];
      if (layout) {
        for (const sheet of document.styleSheets) {
          let href = sheet.href || "inline";
          let rules;
          try {
            rules = sheet.cssRules;
          } catch {
            continue;
          }
          for (const rule of rules) {
            if (!rule.selectorText || !rule.style) continue;
            try {
              if (
                layout.matches(rule.selectorText) &&
                (rule.style.gridTemplateColumns || rule.style.outline)
              ) {
                matched.push({
                  sheet: href,
                  selector: rule.selectorText,
                  grid: rule.style.gridTemplateColumns,
                  outline: rule.style.outline,
                });
              }
            } catch {
              /* skip */
            }
          }
        }
      }

      const layoutInline = layout?.getAttribute("style");
      const jsStyleTag = !!document.getElementById("tlv-watch-youtube-layout-styles");

      let cssTextSample = "";
      const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) =>
        l.href.includes("live.css")
      );
      if (link) {
        try {
          const sheet = [...document.styleSheets].find((s) => s.href === link.href);
          if (sheet?.cssRules?.length) {
            const last = sheet.cssRules[sheet.cssRules.length - 1];
            cssTextSample = last.cssText?.slice(0, 200) || "";
          }
        } catch (e) {
          cssTextSample = String(e);
        }
      }

      return {
        viewport: window.innerWidth,
        media1024: window.matchMedia("(min-width: 1024px)").matches,
        cssLink: link?.href,
        exists,
        computed: layout
          ? {
              display: cs.display,
              gridTemplateColumns: cs.gridTemplateColumns,
              gap: cs.gap,
              outline: cs.outline,
              outlineColor: cs.outlineColor,
            }
          : null,
        inlineStyleOnLayout: layoutInline,
        jsInjectedStyleTag: jsStyleTag,
        winningRulesSample: matched.slice(-8),
        lastRuleSample: cssTextSample,
        bodyDataPage: document.body.getAttribute("data-page"),
      };
    });

    console.log(JSON.stringify({ cssResponses, report }, null, 2));
  },
  { viewport: { width: 1280, height: 900 } }
);
