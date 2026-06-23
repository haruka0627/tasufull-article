import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const url = "http://127.0.0.1:8788/match/match-top.html?v=balance3";
const outDir = "reports/screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "networkidle" });

const metrics = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, missing: true };
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      sel,
      marginTop: s.marginTop,
      marginBottom: s.marginBottom,
      paddingTop: s.paddingTop,
      paddingBottom: s.paddingBottom,
      fontSize: s.fontSize,
      gap: s.gap,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      height: Math.round(r.height),
    };
  };

  const login = document.querySelector(".match-top-login");
  const title = document.querySelector(".match-top-values__title");
  const items = [...document.querySelectorAll(".match-top-values__item")];
  const badges = document.querySelector(".match-top-trust-badges");
  const footer = document.querySelector(".match-footer--top");
  const shell = document.querySelector(".match-top-shell");

  const itemGap =
    items.length >= 2
      ? Math.round(items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().bottom)
      : null;

  return {
    cssHref: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href),
    shell: pick(".match-top-shell"),
    loginToTitle:
      login && title ? Math.round(title.getBoundingClientRect().top - login.getBoundingClientRect().bottom) : null,
    bottom: pick(".match-top-bottom"),
    title: pick(".match-top-values__title"),
    firstItem: pick(".match-top-values__item"),
    itemRowGap: itemGap,
    badges: pick(".match-top-trust-badges"),
    footer: pick(".match-footer--top"),
    badgeToFooterGap:
      badges && footer
        ? Math.round(footer.getBoundingClientRect().top - badges.getBoundingClientRect().bottom)
        : null,
    shellOverflow: shell ? getComputedStyle(shell).overflow : null,
    shellHeight: shell ? getComputedStyle(shell).height : null,
  };
});

writeFileSync("reports/match-top-computed-after.json", JSON.stringify(metrics, null, 2));

await page.screenshot({ path: `${outDir}/match-top-after-balance.png`, fullPage: true });

const bottom = await page.$(".match-top-bottom");
if (bottom) {
  const box = await bottom.boundingBox();
  if (box) {
    await page.screenshot({
      path: `${outDir}/match-top-bottom-crop-after.png`,
      clip: {
        x: 0,
        y: Math.max(0, box.y - 40),
        width: 390,
        height: Math.min(844, box.height + 120),
      },
    });
  }
}

await browser.close();
console.log(JSON.stringify(metrics, null, 2));
