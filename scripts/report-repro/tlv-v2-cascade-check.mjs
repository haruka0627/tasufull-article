import { chromium } from "playwright";

const BASES = [
  { id: "6407eaf4", label: "v2-deploy", url: "https://6407eaf4.tasufull-article.pages.dev" },
  { id: "48d49d9c", label: "v1-deploy", url: "https://48d49d9c.tasufull-article.pages.dev" },
];

async function probe(base, width) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height: 1080 } });
  await page.goto(`${base.url}/live/videos?talkDev=1`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  const cssUrl = await page.evaluate(
    () => document.querySelector('link[href*="live.css"]')?.href || "",
  );
  const cssRes = await page.request.get(cssUrl);
  const cssText = await cssRes.text();

  const snapshot = async (label, mutate) => {
    if (mutate) await page.evaluate(mutate);
    return page.evaluate(() => {
      const feed = document.querySelector("[data-live-videos-feed]");
      const cs = feed ? getComputedStyle(feed) : null;
      const cols = cs ? cs.gridTemplateColumns.split(" ").filter(Boolean) : [];
      const sidebar = document.querySelector(".tlv-desktop-sidebar");
      return {
        dataPage: document.body.getAttribute("data-page"),
        colCount: cols.length,
        gridTemplateColumns: cs?.gridTemplateColumns || "",
        sidebarW: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
        hasYtCard: Boolean(document.querySelector(".live-video-card--yt")),
        cssHref: document.querySelector('link[href*="live.css"]')?.getAttribute("href") || "",
      };
    });
  };

  const normal = await snapshot("normal");
  const noDataPage = await snapshot("no-data-page", () => {
    document.body.removeAttribute("data-page");
  });
  await page.evaluate(() => document.body.setAttribute("data-page", "live-videos"));

  const rules = await page.evaluate(() => {
    const feed = document.querySelector("[data-live-videos-feed]");
    const out = [];
    for (const sheet of document.styleSheets) {
      let cssRules;
      try {
        cssRules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of cssRules) {
        if (rule.type !== CSSRule.MEDIA_RULE) continue;
        const mq = rule.conditionText || rule.media?.mediaText || "";
        if (!window.matchMedia(mq).matches) continue;
        for (const inner of rule.cssRules) {
          if (!inner.selectorText || !inner.style.gridTemplateColumns) continue;
          try {
            if (feed.matches(inner.selectorText)) {
              out.push({
                mq,
                selector: inner.selectorText,
                columns: inner.style.gridTemplateColumns,
                sheet: (sheet.href || "inline").split("/").pop(),
              });
            }
          } catch {
            /* invalid selector for matches() */
          }
        }
      }
    }
    return out;
  });

  await browser.close();

  return {
    base: base.label,
    deployId: base.id,
    width,
    cssUrl,
    cssBytes: cssText.length,
    cssV2: {
      has72px: cssText.includes('--tlv-sidebar-w: 72px'),
      has1920: /min-width:\s*1920px[\s\S]{0,200}repeat\(4/.test(cssText),
      hasV1Override1600: /min-width:\s*1600px[\s\S]{0,120}repeat\(5/.test(cssText),
    },
    normal,
    noDataPage,
    matchingGridRules: rules,
  };
}

const results = [];
for (const base of BASES) {
  for (const w of [1280, 1920]) {
    results.push(await probe(base, w));
  }
}

console.log(JSON.stringify(results, null, 2));
