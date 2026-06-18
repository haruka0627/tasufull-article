/**
 * detail-shop.html?id=demo-shop-reworks — 実DOM・computed style 調査（390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";

const base = (process.argv[2] || "http://127.0.0.1:5173").replace(/\/$/, "");
const url = `${base}/detail-shop.html?id=demo-shop-reworks`;

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);

const report = await page.evaluate(() => {
  const pick = (el, extra = {}) => {
    if (!el) return { found: false };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      found: true,
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: [...el.classList],
      dataAttrs: [...el.attributes]
        .filter((a) => a.name.startsWith("data-"))
        .map((a) => `${a.name}=${JSON.stringify(a.value).slice(0, 80)}`),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      offsetW: el.offsetWidth,
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      display: cs.display,
      position: cs.position,
      width: cs.width,
      maxWidth: cs.maxWidth,
      minWidth: cs.minWidth,
      flex: cs.flex,
      flexBasis: cs.flexBasis,
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      gridTemplateColumns: cs.gridTemplateColumns,
      padding: cs.padding,
      margin: cs.margin,
      writingMode: cs.writingMode,
      whiteSpace: cs.whiteSpace,
      bottom: cs.bottom,
      top: cs.top,
      zIndex: cs.zIndex,
      ...extra,
    };
  };

  const body = document.body;
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
  const mobileCssLoaded = links.some((h) => /detail-shop-mobile\.css/i.test(h));

  // 商品一覧
  const productsSection = document.querySelector("#section-products");
  const prodGrid =
    productsSection?.querySelector(".retail-prod-grid") ||
    productsSection?.querySelector("[class*='prod']");
  const prodCards = prodGrid ? [...prodGrid.querySelectorAll("article.retail-prod-card")] : [];
  const card0 = prodCards[0];
  const card1 = prodCards[1];

  // 買取
  const buybackMain = document.querySelector("#shop-sp-buyback-main, #section-shop-cases .shop-mobile-feature, #section-shop-cases article");
  const buybackVisit = document.querySelector("#shop-sp-buyback-visit");
  const buybackStack = document.querySelector(".shop-mobile-buyback-list, .shop-mobile-feature-stack");
  const casesSection = document.querySelector("#section-shop-cases");
  const highlightsSection = document.querySelector("#section-shop-highlights");

  // アクセス
  const accessSection = document.querySelector("#section-shop-info");
  const accessList = document.querySelector(".shop-mobile-access-list");
  const accessItem = document.querySelector(".shop-mobile-access-item");
  const accessVal = document.querySelector(".shop-mobile-access-value");
  const beautyTable = document.querySelector(".beauty-info-table");

  // 追従タブ
  const stickyNav = document.querySelector("[data-shop-sticky-action-nav], .shop-sticky-action-nav");
  const stickySpacer = document.querySelector("[data-shop-sticky-action-spacer], .shop-sticky-action-nav-spacer");

  // 下部 CTA / タブバー
  const bottomCta =
    document.querySelector(".biz-detail-sticky-bar, [data-biz-detail-sticky], .tasu-mdetail-cta-dock, [data-tasu-mdetail-cta-dock]");
  const tabbar = document.querySelector(".tasu-app-tabbar, .talk-mobile-tabbar");

  // elementFromPoint — 商品2枚目付近
  const c1r = card1?.getBoundingClientRect();
  const midX = c1r ? Math.min(c1r.left + 20, 360) : 300;
  const midY = c1r ? c1r.top + 60 : 400;
  const hitAtCard2 = document.elementFromPoint(midX, midY);

  // タブ付近で何が上にあるか
  const navR = stickyNav?.getBoundingClientRect();
  const hitAtNav = navR
    ? document.elementFromPoint(navR.left + navR.width / 2, navR.bottom + 8)
    : null;

  const nativeMobile = body.classList.contains("shop-detail-page--native-mobile");
  const sheetRules = [];
  try {
    for (const sheet of document.styleSheets) {
      let href = "";
      try {
        href = sheet.href || "";
      } catch (_) {}
      if (!/detail-shop-mobile/i.test(href)) continue;
      try {
        const rules = sheet.cssRules || [];
        for (let i = 0; i < Math.min(rules.length, 3); i++) sheetRules.push(rules[i]?.cssText?.slice(0, 120));
      } catch (e) {
        sheetRules.push(`blocked: ${e.message}`);
      }
    }
  } catch (_) {}

  // 親チェーン（商品グリッド）
  const prodChain = [];
  let p = prodGrid;
  for (let i = 0; i < 6 && p; i++) {
    const cs = getComputedStyle(p);
    prodChain.push({
      tag: p.tagName.toLowerCase(),
      id: p.id || null,
      classes: [...p.classList],
      overflowX: cs.overflowX,
      width: cs.width,
      maxWidth: cs.maxWidth,
      display: cs.display,
      offsetW: p.offsetWidth,
      scrollW: p.scrollWidth,
    });
    p = p.parentElement;
  }

  return {
    url: location.href,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    bodyClasses: [...body.classList],
    bodyDataAttrs: {
      page: body.getAttribute("data-page"),
      shopCategory: body.getAttribute("data-shop-category-key"),
      profile: body.getAttribute("data-shop-category-profile"),
      mvis: body.getAttribute("data-shop-mvis-products"),
    },
    nativeMobile,
    mobileCssLoaded,
    mobileCssLink: links.filter((h) => /detail-shop-mobile/i.test(h)),
    allStylesheets: links.map((h) => h.split("/").pop()).slice(-8),
    sheetRulesSample: sheetRules,
    productsSection: pick(productsSection),
    prodGrid: pick(prodGrid),
    prodChain,
    prodCard0: pick(card0),
    prodCard1: pick(card1),
    card1Clipped: card1 ? card1.getBoundingClientRect().right > window.innerWidth + 2 : null,
    hitAtCard2: hitAtCard2
      ? { tag: hitAtCard2.tagName, classes: [...hitAtCard2.classList], id: hitAtCard2.id }
      : null,
    buybackMain: pick(buybackMain),
    buybackVisit: pick(buybackVisit),
    buybackStack: pick(buybackStack),
    casesSection: pick(casesSection),
    highlightsSection: pick(highlightsSection),
    accessSection: pick(accessSection),
    accessList: pick(accessList),
    accessItem: pick(accessItem),
    accessVal: pick(accessVal, {
      text: accessVal?.innerText?.slice(0, 80),
      charsPerLine: accessVal
        ? Math.min(...String(accessVal.innerText).split("\n").map((l) => l.trim().length).filter(Boolean))
        : 0,
    }),
    beautyTableVisible: beautyTable ? getComputedStyle(beautyTable).display !== "none" : false,
    beautyTable: pick(beautyTable),
    stickyNav: pick(stickyNav),
    stickySpacer: pick(stickySpacer),
    hitBelowNav: hitAtNav ? { tag: hitAtNav.tagName, classes: [...hitAtNav.classList], id: hitAtNav.id } : null,
    bottomCta: pick(bottomCta),
    tabbar: pick(tabbar),
    bodyPb: getComputedStyle(body).paddingBottom,
    hasShopMobileProdGrid: !!document.querySelector(".shop-mobile-prod-grid"),
    hasShopMobileAccessList: !!document.querySelector(".shop-mobile-access-list"),
    sectionIds: [...document.querySelectorAll("#shop-sections-root > *")].map((el) => ({
      id: el.id,
      classes: [...el.classList].slice(0, 8),
    })),
  };
});

const outPath = "scripts/inspect-detail-shop-mobile-report.json";
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
console.log("\nWrote", outPath);

await page.screenshot({ path: "screenshots/detail-shop-reworks-390-inspect.png", fullPage: true }).catch(() => {});
});

await closeAllBrowsers();
