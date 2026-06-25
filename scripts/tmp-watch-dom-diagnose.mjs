#!/usr/bin/env node
/**
 * watch-video DOM/CSS diagnostic — Playwright
 * node scripts/tmp-watch-dom-diagnose.mjs [url]
 */
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const URL =
  process.argv[2] ||
  "http://127.0.0.1:8788/live/watch-video.html?id=4d7e3650-b441-4598-9723-475a956cf68a";

const SELECTORS = [
  ".tlv-desktop-main--watch",
  ".tlv-watch-layout",
  ".tlv-watch-main",
  ".tlv-watch-sidebar",
  ".live-watch__player-wrap",
  ".live-watch__player",
  "video.live-watch__player",
];

await withPlaywrightSession(
  async ({ page }) => {
    const responses = [];
    page.on("response", (res) => {
      const u = res.url();
      if (u.includes(".css") || u.includes("watch-video")) {
        responses.push({ url: u, status: res.status() });
      }
    });

    console.log("NAV:", URL);
    const nav = await page.goto(URL, { waitUntil: "networkidle", timeout: 90000 });
    console.log("Final URL:", page.url());
    console.log("Nav status:", nav?.status());

    await page.waitForTimeout(3000);
    await page.waitForSelector("[data-live-watch-root], [data-live-watch-article]", {
      timeout: 45000,
    }).catch(() => null);

    const report = await page.evaluate((sels) => {
      const pick = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return { exists: false };
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          exists: true,
          tag: el.tagName.toLowerCase(),
          classes: el.className,
          id: el.id || null,
          inlineStyle: el.getAttribute("style"),
          rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
          computed: {
            display: cs.display,
            width: cs.width,
            maxWidth: cs.maxWidth,
            gridTemplateColumns: cs.gridTemplateColumns,
            gap: cs.gap,
            padding: cs.padding,
            objectFit: cs.objectFit,
            aspectRatio: cs.aspectRatio,
            outline: cs.outline,
            outlineColor: cs.outlineColor,
            backgroundColor: cs.backgroundColor,
          },
        };
      };

      const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => ({
        href: l.href,
        media: l.media,
      }));

      const playerArea = document.querySelector("[data-live-watch-player]") || document.querySelector(".live-watch__player-wrap");
      let matchedRules = [];
      if (playerArea) {
        for (const sheet of document.styleSheets) {
          let rules;
          try {
            rules = sheet.cssRules;
          } catch {
            continue;
          }
          for (const rule of rules) {
            if (!rule.selectorText || !rule.style) continue;
            try {
              if (playerArea.matches(rule.selectorText)) {
                matchedRules.push({
                  selector: rule.selectorText,
                  cssText: rule.style.cssText.slice(0, 200),
                  sheet: sheet.href || "inline",
                });
              }
            } catch {
              /* invalid for this element */
            }
          }
        }
      }

      const selectorExists = Object.fromEntries(sels.map((s) => [s, !!document.querySelector(s)]));

      const article = document.querySelector("[data-live-watch-article]");
      const tree = [];
      let n = article || document.querySelector("[data-live-watch-root]");
      if (n) {
        let depth = 0;
        while (n && depth < 8) {
          tree.push({
            depth,
            tag: n.tagName.toLowerCase(),
            classes: n.className,
            data: [...n.attributes]
              .filter((a) => a.name.startsWith("data-"))
              .map((a) => `${a.name}=${a.value}`)
              .join(" "),
          });
          n = n.parentElement;
          depth += 1;
        }
      }

      return {
        bodyDataPage: document.body.getAttribute("data-page"),
        bodyClasses: document.body.className,
        selectorExists,
        stylesheets,
        domTreeFromArticle: tree,
        elements: Object.fromEntries(sels.map((s) => [s, pick(s)])),
        playerMatchedRuleCount: matchedRules.length,
        playerMatchedRulesSample: matchedRules.slice(-15),
        visibleShell: {
          desktop: (() => {
            const el = document.querySelector(".tlv-desktop-shell--watch");
            if (!el) return null;
            const cs = getComputedStyle(el);
            return { display: cs.display, classes: el.className };
          })(),
          mobile: (() => {
            const el = document.querySelector(".tlv-mobile-shell--watch");
            if (!el) return null;
            const cs = getComputedStyle(el);
            return { display: cs.display, classes: el.className };
          })(),
        },
      };
    }, SELECTORS);

    console.log("\n=== CSS RESPONSES ===");
    for (const r of responses) console.log(r.status, r.url);

    console.log("\n=== REPORT ===");
    console.log(JSON.stringify(report, null, 2));
  },
  { viewport: { width: 1280, height: 900 } }
);
