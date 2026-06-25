#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const URL =
  "http://127.0.0.1:8788/live/watch-video?id=4d7e3650-b441-4598-9723-475a956cf68a";
const OUT = path.resolve("scripts/tmp-watch-ratio-shots");

const UI_SELECTORS = [
  ".live-watch__primary",
  ".live-watch__title",
  ".live-watch__toolbar",
  ".live-watch__channel-block",
  ".live-watch__channel",
  ".live-watch__subscribe",
  ".live-watch__actions",
  ".live-watch-chip",
  ".live-watch-chip--like",
  ".live-watch__desc-card",
  ".live-watch-comments",
];

const label = process.argv.includes("--label")
  ? process.argv[process.argv.indexOf("--label") + 1]
  : "before";
const shotPrefix = label === "after" ? "watch-ui-after" : "watch-ui-before";
const jsonPrefix = label === "after" ? "watch-ui-after" : "watch-ui-diagnose";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const vp of [
  { w: 1280, h: 900, tag: "1280" },
  { w: 390, h: 844, tag: "390" },
  { w: 768, h: 1024, tag: "768" },
]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  const waitSel =
    vp.w < 1024
      ? ".tlv-mobile-shell--watch .live-watch__toolbar"
      : ".tlv-desktop-shell--watch .live-watch__toolbar";
  await page.waitForSelector(waitSel, { state: "visible", timeout: 120000 });
  await page.waitForTimeout(2000);

  const report = await page.evaluate((sels) => {
    const pickCs = (el, props) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, s[p]]));
    };

    const mobileShell = document.querySelector(".tlv-mobile-shell--watch");
    const desktopShell = document.querySelector(".tlv-desktop-shell--watch");
    const mobileVisible = mobileShell && getComputedStyle(mobileShell).display !== "none";
    const scope = mobileVisible ? mobileShell : desktopShell || document;

    const elements = {};
    for (const sel of sels) {
      const el = scope.querySelector(sel);
      elements[sel] = {
        exists: !!el,
        rect: el
          ? {
              w: Math.round(el.getBoundingClientRect().width),
              h: Math.round(el.getBoundingClientRect().height),
            }
          : null,
        computed: el
          ? pickCs(el, [
              "display",
              "flexDirection",
              "alignItems",
              "justifyContent",
              "gap",
              "backgroundColor",
              "borderRadius",
              "appearance",
              "padding",
              "fontSize",
              "fontWeight",
            ])
          : null,
      };
    }

    const layout = scope.querySelector(".tlv-watch-layout");
    const playerWrap = scope.querySelector(".live-watch__player-wrap");
    const sidebar = scope.querySelector(".tlv-watch-sidebar");
    const thumb = scope.querySelector(".tlv-related-list--yt .tlv-related-list__thumb");

    const matchedRules = {};
    const subscribe = scope.querySelector(".live-watch__subscribe");
    const chip = scope.querySelector(".live-watch-chip");
    for (const [name, el] of [
      ["subscribe", subscribe],
      ["chip", chip],
    ]) {
      if (!el) continue;
      const rules = [];
      for (const sheet of document.styleSheets) {
        let cssRules;
        try {
          cssRules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of cssRules) {
          if (!rule.selectorText) continue;
          try {
            if (el.matches(rule.selectorText) && (rule.style.background || rule.style.borderRadius || rule.style.appearance)) {
              rules.push({
                selector: rule.selectorText,
                bg: rule.style.background || rule.style.backgroundColor,
                radius: rule.style.borderRadius,
                appearance: rule.style.appearance,
                sheet: sheet.href || "inline",
              });
            }
          } catch {
            /* skip */
          }
        }
      }
      matchedRules[name] = rules.slice(-6);
    }

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      layout: layout && pickCs(layout, ["gridTemplateColumns", "gap"]),
      playerWrap: playerWrap && {
        rect: { w: Math.round(playerWrap.getBoundingClientRect().width) },
      },
      sidebar: sidebar && {
        rect: { w: Math.round(sidebar.getBoundingClientRect().width) },
      },
      thumb: thumb && {
        rect: {
          w: Math.round(thumb.getBoundingClientRect().width),
          h: Math.round(thumb.getBoundingClientRect().height),
        },
      },
      elements,
      matchedRules,
    };
  }, UI_SELECTORS);

  await page.screenshot({ path: path.join(OUT, `${shotPrefix}-${vp.tag}.png`) });
  fs.writeFileSync(path.join(OUT, `${jsonPrefix}-${vp.tag}.json`), JSON.stringify(report, null, 2));
  console.log(`[${vp.tag}] toolbar exists:`, report.elements[".live-watch__toolbar"]?.exists);
  console.log(`[${vp.tag}] subscribe bg:`, report.elements[".live-watch__subscribe"]?.computed?.backgroundColor);
  console.log(`[${vp.tag}] chip radius:`, report.elements[".live-watch-chip"]?.computed?.borderRadius);
  console.log(`[${vp.tag}] player:`, report.playerWrap?.rect?.w, "sidebar:", report.sidebar?.rect?.w, "gap:", report.layout?.gap);
}

await browser.close();
