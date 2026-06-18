/**
 * anpi-dashboard.html — SP/PC フッター・タブバー余白検証
 * node scripts/verify-anpi-dashboard-mobile-footer.mjs [baseUrl]
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = process.argv[2] || "http://127.0.0.1:8765";
const URL = `${BASE}/anpi-dashboard.html`;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  closeAllBrowsers().finally(() => process.exit(1));
}

await withPlaywrightBrowser(async (browser) => {async function sp() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.waitForFunction(
    () => !document.querySelector("[data-anpi-dashboard-shell]")?.hidden,
    { timeout: 15000 }
  );

  const head = await page.evaluate(() => {
    const back = document.querySelector(".tasu-mobile-page-head__back");
    const title = document.querySelector(".tasu-mobile-shell-head .tasu-mobile-page-head__title");
    const summary = document.querySelector("[data-anpi-mobile-home-summary]");
    const statGrid = document.querySelector("[data-anpi-summary-grid]");
    const footer = document.querySelector(".anpi-dashboard-footer");
    const quick = document.querySelector(".anpi-quick-section");
    const recent = document.querySelector(".anpi-recent-section");
    const br = back?.getBoundingClientRect();
    return {
      backW: br?.width,
      backH: br?.height,
      titleText: title?.textContent?.trim(),
      summaryVisible: summary && getComputedStyle(summary).display !== "none",
      statGridVisible: statGrid && getComputedStyle(statGrid).display !== "none",
      footerVisible: footer && getComputedStyle(footer).display !== "none",
      quickBeforeRecent:
        quick && recent ? quick.getBoundingClientRect().top < recent.getBoundingClientRect().top : false,
      summaryValues: summary
        ? [...summary.querySelectorAll(".anpi-mobile-home-summary__value")].map((el) => el.textContent?.trim())
        : [],
    };
  });
  if ((head.backH || 0) < 36) fail(`SP: 戻るボタンが潰れています (h=${head.backH})`);
  if ((head.backW || 0) < 44) fail(`SP: 戻るボタンが狭すぎます (w=${head.backW})`);
  if (!head.titleText?.includes("安否ダッシュボード")) fail("SP: タイトル不一致");
  if (!head.summaryVisible) fail("SP: 上部サマリーカードが表示されていません");
  if (head.statGridVisible) fail("SP: 縦長数字カードが表示されています");
  if (head.footerVisible) fail("SP: フッターが表示されています");
  if (!head.quickBeforeRecent) fail("SP: クイックメニューが最近の通知より下にあります");

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);

  const bottom = await page.evaluate(() => {
    const tab = document.querySelector(".tasu-app-tabbar");
    const ctaTop = tab ? tab.getBoundingClientRect().top : null;
    const layout = document.querySelector(".anpi-dash-layout");
    const visible = layout
      ? [...layout.children].filter((el) => {
          if (el.hidden) return false;
          const st = getComputedStyle(el);
          return st.display !== "none" && st.visibility !== "hidden";
        })
      : [];
    let maxBottom = 0;
    visible.forEach((el) => {
      const b = el.getBoundingClientRect().bottom;
      if (ctaTop != null && b > maxBottom && b <= ctaTop + 2) maxBottom = b;
    });
    const gap = ctaTop != null ? ctaTop - maxBottom : null;
    const scrollSlack =
      document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    const bodyPb = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
    const mainPb = parseFloat(getComputedStyle(document.querySelector(".anpi-dashboard-main")).paddingBottom) || 0;
    const layoutPb =
      parseFloat(getComputedStyle(document.querySelector(".anpi-dash-layout")).paddingBottom) || 0;
    return { ctaTop, maxBottom, gap, scrollSlack, bodyPb, mainPb, layoutPb };
  });

  console.log("SP:", JSON.stringify({ head, bottom }, null, 2));
  if (bottom.bodyPb > 20) fail(`SP: body padding-bottom が残っています (${bottom.bodyPb}px)`);
  if (bottom.mainPb > 20) fail(`SP: main padding-bottom が二重です (${bottom.mainPb}px)`);
  if (bottom.layoutPb < 72 || bottom.layoutPb > 100) {
    fail(`SP: レイアウト下余白が目安外 (${bottom.layoutPb}px, 72-100px)`);
  }
  if (bottom.gap == null || bottom.gap < 8 || bottom.gap > 88) {
    fail(`SP: 最下部コンテンツ〜タブバー間が不適切 (${bottom.gap}px)`);
  }
  if (bottom.scrollSlack > 120) {
    fail(`SP: 最下部に無駄な空白が残っています (${bottom.scrollSlack}px)`);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const foldOk = await page.evaluate(() => {
    const tab = document.querySelector(".tasu-app-tabbar");
    const ctaTop = tab ? tab.getBoundingClientRect().top : 9999;
    const summary = document.querySelector("[data-anpi-mobile-home-summary]");
    const lastQuick = document.querySelector(".anpi-quick-grid .anpi-quick-card:last-child");
    const summaryOk = summary ? summary.getBoundingClientRect().bottom <= ctaTop - 4 : false;
    const quickOk = lastQuick ? lastQuick.getBoundingClientRect().bottom <= ctaTop - 4 : false;
    return { summaryOk, quickOk, ctaTop };
  });
  if (!foldOk.summaryOk) fail("SP: サマリーがタブバーに隠れています");
  if (!foldOk.quickOk) fail("SP: クイック4件が1画面に収まっていません（タブと重なり）");

  await page.close();
}

async function pc() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);
  const pc = await page.evaluate(() => ({
    mobilePage: document.body.classList.contains("tasu-app-mobile-page"),
    tabbar: !!document.querySelector(".tasu-app-tabbar"),
    shellHead: !!document.querySelector(".tasu-mobile-shell-head"),
    layoutPb: getComputedStyle(document.querySelector(".anpi-dash-layout")).paddingBottom,
    footerDisplay: getComputedStyle(document.querySelector(".anpi-dashboard-footer")).display,
    summaryDisplay: getComputedStyle(document.querySelector("[data-anpi-mobile-home-summary]")).display,
    statGridDisplay: getComputedStyle(document.querySelector("[data-anpi-summary-grid]")).display,
  }));
  if (pc.summaryDisplay !== "none") fail("PC: モバイルサマリーが表示されています");
  if (pc.statGridDisplay === "none") fail("PC: 数字カードが非表示です");
  console.log("PC:", JSON.stringify(pc, null, 2));
  if (pc.mobilePage) fail("PC: tasu-app-mobile-page が付与されています");
  if (pc.tabbar && getComputedStyle(document.querySelector(".tasu-app-tabbar")).display !== "none") {
    /* tabbar hidden via display:none in media min - ok if not visible */
  }
  await page.close();
}

await sp();
await pc();
});
console.log("OK: anpi-dashboard mobile footer checks passed");

await closeAllBrowsers();
