#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "reports", "ai-workspace-ui-review-cases");
const url = "http://127.0.0.1:8788/ai-workspace?uiReview=code&mode=cross-matching";

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage();
  const failedReqs = [];
  page.on("requestfailed", (r) => failedReqs.push(r.url()));

  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector(".ai-generate-panel--code, .ai-code-block", { timeout: 20000 });

  const audit = await page.evaluate(() => {
    const sheets = [];
    for (const s of document.styleSheets) {
      try {
        sheets.push(s.href || "inline");
      } catch {
        sheets.push("blocked");
      }
    }

    const panel = document.querySelector(".ai-generate-panel--code");
    const ps = panel ? getComputedStyle(panel) : null;
    const title = panel?.querySelector(".ai-generate-panel__title");
    const ts = title ? getComputedStyle(title) : null;

    const talkEls = [...document.querySelectorAll("a, button")].filter((el) =>
      /TALK|TALKへ送る/.test(el.textContent || "")
    );

    const matchingBgRules = [];
    if (panel) {
      for (const sheet of document.styleSheets) {
        let href = "";
        try {
          href = sheet.href || "inline";
        } catch {
          continue;
        }
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of rules) {
          if (!rule.selectorText || !rule.style) continue;
          const selectors = rule.selectorText.split(",");
          for (const sel of selectors) {
            try {
              if (panel.matches(sel.trim()) && (rule.style.background || rule.style.backgroundColor)) {
                matchingBgRules.push({
                  href,
                  selector: rule.selectorText.slice(0, 120),
                  bg: rule.style.background || rule.style.backgroundColor,
                  important: rule.style.getPropertyPriority("background") === "important",
                });
              }
            } catch {
              /* invalid selector */
            }
          }
        }
      }
    }

    return {
      bodyClass: document.body.className,
      finalUrl: location.href,
      sheets,
      hasGenerateTheme: sheets.some((h) => String(h).includes("generate-theme")),
      generateThemeStatus: sheets.find((h) => String(h).includes("generate-theme")),
      panelClasses: panel?.className,
      panelBg: ps?.backgroundColor,
      panelColor: ps?.color,
      titleColor: ts?.color,
      panelBorder: ps?.borderColor,
      panelHtmlStart: panel?.outerHTML?.slice(0, 600),
      contentHtmlStart: document.querySelector(".ai-message__content")?.innerHTML?.slice(0, 1000),
      goldCount: document.querySelectorAll(".ai-cross-cta--gold").length,
      talkButtons: talkEls.map((el) => ({
        tag: el.tagName,
        class: el.className,
        text: (el.textContent || "").trim().slice(0, 50),
        bg: getComputedStyle(el).backgroundColor,
      })),
      actionsPresent: !!document.querySelector(".ai-message__actions"),
      metaPresent: !!document.querySelector(".ai-message__meta"),
      actionsClasses: document.querySelector(".ai-message__actions")?.className,
      matchingBgRules: matchingBgRules.slice(-20),
    };
  });

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "code-url-audit.json"), JSON.stringify({ url, failedReqs, audit }, null, 2));
  await page.screenshot({
    path: join(out, "07-code-cross-matching-extless-pc1280-BEFORE-fix.png"),
  });
  console.log(JSON.stringify(audit, null, 2));
  if (failedReqs.length) console.log("FAILED REQUESTS:", failedReqs);
});

await closeAllBrowsers();
