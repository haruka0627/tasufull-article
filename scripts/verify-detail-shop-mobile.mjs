/**
 * detail-shop.html スマホUI検証（390px / 1280px）
 * Usage: node scripts/verify-detail-shop-mobile.mjs [baseUrl]
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const base = (process.argv[2] || "http://127.0.0.1:5173").replace(/\/$/, "");
const url = `${base}/detail-shop.html?id=demo-shop-reworks`;

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}
function pass(msg) {
  console.log("PASS:", msg);
}

async function check390(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => {
    const body = document.body;
    const nav = document.querySelector("[data-shop-sticky-action-nav]");
    const grid = document.querySelector(".shop-mobile-prod-grid, .retail-prod-grid");
    const cards = grid ? [...grid.querySelectorAll("article.retail-prod-card")] : [];
    const buybackMain = document.querySelector("#shop-sp-buyback-main");
    const accessItem = document.querySelector("#section-shop-info .shop-mobile-access-item");
    const productsSection = document.querySelector("#section-products");
    const accessVal = document.querySelector(".shop-mobile-access-value");
    const heroAside = document.querySelector(".biz-detail-fv__aside");
    const sidebar = document.querySelector(".shop-restaurant-sidebar");
    const sections = [...document.querySelectorAll("#shop-sections-root > section")];
    const navRect = nav?.getBoundingClientRect();
    const navStyle = nav ? getComputedStyle(nav) : null;
    const prodStyle = grid ? getComputedStyle(grid) : null;
    const card0 = cards[0]?.getBoundingClientRect();
    const card1 = cards[1]?.getBoundingClientRect();
    const accessRect = accessVal?.getBoundingClientRect();
    const accessStyle = accessVal ? getComputedStyle(accessVal) : null;
    const bodyPb = getComputedStyle(body).paddingBottom;
    const container = document.querySelector(".shop-detail-container");
    const fv = document.querySelector(".biz-detail-fv");
    const containerTop = container?.getBoundingClientRect().top ?? 0;
    const fvTop = fv?.getBoundingClientRect().top ?? 0;
    const topGapInContainer = fv && container ? fvTop - containerTop : fvTop;

    let overlap = false;
    if (nav && sections.length) {
      const nr = nav.getBoundingClientRect();
      for (const sec of sections.slice(0, 4)) {
        const sr = sec.getBoundingClientRect();
        if (nr.bottom > sr.top + 4 && nr.top < sr.bottom - 4 && nav.classList.contains("is-stuck")) {
          overlap = true;
        }
      }
    }

    return {
      nativeMobile: body.classList.contains("shop-detail-page--native-mobile"),
      topGapInContainer,
      fvTop,
      heroAsideDisplay: heroAside ? getComputedStyle(heroAside).display : "none",
      sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : "none",
      prodDisplay: prodStyle?.display,
      prodOverflowX: prodStyle?.overflowX,
      cardCount: cards.length,
      card0w: card0?.width,
      card1Visible: card1 ? card1.left < 390 && card1.right > (card0?.right || 0) : false,
      accessW: accessRect?.width,
      accessWriting: accessStyle?.writingMode,
      accessWhiteSpace: accessStyle?.whiteSpace,
      accessCharsPerLine: accessVal
        ? Math.min(...String(accessVal.innerText).split("\n").map((l) => l.trim().length).filter(Boolean))
        : 0,
      navH: navRect?.height,
      navBottom: navStyle?.bottom,
      navPosition: navStyle?.position,
      isStuck: nav?.classList.contains("is-stuck"),
      overlapWhenStuck: overlap,
      bodyPb,
      dockBg: (() => {
        const d = document.querySelector(".shop-mobile-inquiry-dock");
        return d ? getComputedStyle(d).backgroundColor : "";
      })(),
      dockOpaque: (() => {
        const d = document.querySelector(".shop-mobile-inquiry-dock");
        if (!d) return false;
        const bg = getComputedStyle(d).backgroundColor;
        return bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
      })(),
      tabbarOpaque: (() => {
        const t = document.querySelector(".tasu-app-tabbar");
        if (!t) return false;
        const bg = getComputedStyle(t).backgroundColor;
        return bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
      })(),
      copyToDockGap: (() => {
        const copy = document.querySelector(".shop-store-site-footer__copy");
        const dock = document.querySelector(".shop-mobile-inquiry-dock");
        if (!copy || !dock) return null;
        return dock.getBoundingClientRect().top - copy.getBoundingClientRect().bottom;
      })(),
      lastElClear: (() => {
        const dock = document.querySelector(".shop-mobile-inquiry-dock");
        const dockTop = dock?.getBoundingClientRect().top ?? window.innerHeight;
        const targets = [
          document.querySelector("#shop-sp-buyback-appraisal .shop-mobile-feature__cta"),
          document.querySelector("#section-shop-info .shop-mobile-access-item:last-child"),
          document.querySelector(".shop-mobile-products-all-btn"),
        ].filter(Boolean);
        return targets.map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.id || el.className, bottom: r.bottom, dockTop, clear: r.bottom <= dockTop - 4 };
        });
      })(),
      buybackCards: document.querySelectorAll(".shop-mobile-feature--block, #shop-sp-buyback-main").length,
      buybackW: buybackMain?.getBoundingClientRect()?.width,
      accessItemW: accessItem?.getBoundingClientRect()?.width,
      stickyNavW: navRect?.width,
      prodScrollW: grid?.scrollWidth,
      prodClientW: grid?.clientWidth,
      prodGridW: grid?.getBoundingClientRect()?.width,
      sectionProductsW: productsSection?.getBoundingClientRect()?.width,
      buybackDescText: document.querySelector("#shop-sp-buyback-main .shop-mobile-feature__desc")?.textContent?.trim() || "",
      buybackHasYes: /(^|\s)yes(\s|$)/i.test(
        document.querySelector("#shop-sp-buyback-main")?.textContent || ""
      ),
      reviewsVisible: (() => {
        const el = document.getElementById("section-reviews");
        if (!el) return false;
        const st = getComputedStyle(el);
        return !el.hidden && st.display !== "none" && st.visibility !== "hidden" && el.innerHTML.length > 100;
      })(),
      reviewsInNav: [...document.querySelectorAll("[data-shop-sticky-action-tabs] a")].some((a) =>
        /口コミ/.test(a.textContent || "")
      ),
    };
  });

  if (!state.nativeMobile) fail("body lacks shop-detail-page--native-mobile");
  else pass("native mobile class");

  if (state.topGapInContainer > 48) fail(`hero gap inside container too large (${state.topGapInContainer}px)`);
  else pass(`hero in-container gap OK (${Math.round(state.topGapInContainer)}px)`);

  if (state.heroAsideDisplay !== "none") fail("hero aside visible on SP");
  else pass("hero aside hidden");

  if (state.sidebarDisplay !== "none") fail("sidebar visible on SP");
  else pass("sidebar hidden");

  if (state.prodDisplay !== "flex") fail(`product grid not flex (${state.prodDisplay})`);
  else pass("product rail flex");

  if (state.prodOverflowX !== "auto") fail(`product overflow-x not auto (${state.prodOverflowX})`);
  else pass("product horizontal scroll");

  if ((state.cardCount || 0) < 2) fail("need 2+ product cards");
  else pass(`${state.cardCount} product cards`);

  if (!state.card0w || state.card0w < 168 || state.card0w > 182) fail(`card width unexpected (${state.card0w})`);
  else pass(`card width ~${Math.round(state.card0w)}px`);

  if (!state.card1Visible) fail("2nd product card not in scroll lane");
  else pass("2nd card in horizontal lane");

  const sectionW = state.sectionProductsW || 0;
  const outerGutter = sectionW ? (390 - sectionW) / 2 : 99;
  if (outerGutter > 15 || outerGutter < 10) fail(`section outer gutter ~${Math.round(outerGutter)}px/side (want 12±3)`);
  else pass(`section outer gutter ~${Math.round(outerGutter)}px/side`);

  if ((state.buybackW || 0) < 310) fail(`buyback card too narrow (${state.buybackW}px)`);
  else pass(`buyback inner width ~${Math.round(state.buybackW)}px`);

  if ((state.accessItemW || 0) < 310) fail(`access item too narrow (${state.accessItemW}px)`);
  else pass(`access item width ~${Math.round(state.accessItemW)}px`);

  if ((state.stickyNavW || 0) < 350) fail(`sticky nav too narrow (${state.stickyNavW}px)`);
  else pass(`sticky nav width ~${Math.round(state.stickyNavW)}px`);

  if ((state.prodGridW || 0) < 310) fail(`product rail too narrow (${state.prodGridW}px)`);
  else pass(`product rail width ~${Math.round(state.prodGridW)}px`);

  if (!state.accessW || state.accessW < 120) fail(`access value too narrow (${state.accessW})`);
  else pass(`access value width ${Math.round(state.accessW)}px`);

  if (state.accessCharsPerLine <= 2 && state.accessCharsPerLine > 0) {
    fail("access text breaking one char per line");
  } else pass("access text not vertical-char broken");

  if (state.navH > 72) fail(`sticky nav too tall (${state.navH}px)`);
  else pass(`sticky nav height ${Math.round(state.navH || 0)}px`);

  if (state.navPosition !== "static") fail(`nav should be static on mobile (${state.navPosition})`);
  else pass("nav position static");

  if (state.navBottom !== "auto") fail(`nav bottom=${state.navBottom}`);
  else pass("nav bottom auto");

  if (state.isStuck) fail("nav should not use is-stuck on mobile");
  else pass("nav not is-stuck on mobile");

  if (state.buybackHasYes) fail("buyback block still shows internal yes");
  else pass("buyback has no raw yes");

  if (!state.buybackDescText || /^yes$/i.test(state.buybackDescText)) {
    fail(`buyback desc invalid: "${state.buybackDescText}"`);
  } else pass(`buyback desc: ${state.buybackDescText.slice(0, 24)}…`);

  const pb = parseFloat(state.bodyPb) || 0;
  if (pb < 112 || pb > 130) fail(`body padding-bottom ${state.bodyPb} (want ~121px)`);
  else pass(`body padding-bottom ${state.bodyPb}`);

  if (state.copyToDockGap == null || state.copyToDockGap < 8 || state.copyToDockGap > 20) {
    fail(`copyright-to-dock gap ${state.copyToDockGap}px (want ~10-15px)`);
  } else pass(`copyright above dock gap ~${Math.round(state.copyToDockGap)}px`);

  if (!state.dockOpaque || !state.tabbarOpaque) {
    fail(`footer opaque: dock=${state.dockOpaque} tabbar=${state.tabbarOpaque}`);
  } else pass("fixed footer backgrounds opaque");

  const blocked = (state.lastElClear || []).filter((x) => !x.clear);
  if (blocked.length) fail(`content hidden under dock: ${JSON.stringify(blocked)}`);
  else pass("bottom CTAs/cards clear of inquiry dock");

  if (state.buybackCards < 3) fail(`buyback cards few (${state.buybackCards})`);
  else pass(`${state.buybackCards} buyback blocks`);

  if (!state.reviewsVisible) fail("reviews section not visible on SP");
  else pass("reviews section visible on SP");

  if (!state.reviewsInNav) fail("reviews tab missing on SP nav");
  else pass("reviews tab on SP nav");
}

async function check1280(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);

  const state = await page.evaluate(() => {
    const aside = document.querySelector(".biz-detail-fv__aside");
    const actions = document.querySelector("[data-shop-sticky-action-actions]");
    const grid = document.querySelector(".retail-prod-grid");
    const fv = document.querySelector(".biz-detail-fv.retail-top-fv");
    const reviews = document.getElementById("section-reviews");
    const points = document.querySelector(".retail-points");
    return {
      asideDisplay: aside ? getComputedStyle(aside).display : "",
      actionsDisplay: actions ? getComputedStyle(actions).display : "",
      gridDisplay: grid ? getComputedStyle(grid).display : "",
      fvDisplay: fv ? getComputedStyle(fv).display : "",
      nativeMobile: document.body.classList.contains("shop-detail-page--native-mobile"),
      reviewsVisible:
        reviews &&
        !reviews.hidden &&
        getComputedStyle(reviews).display !== "none" &&
        reviews.innerHTML.length > 100,
      reviewsInNav: [...document.querySelectorAll("[data-shop-sticky-action-tabs] a")].some((a) =>
        /口コミ/.test(a.textContent || "")
      ),
      pointsVisible: points && getComputedStyle(points).display !== "none",
      titleHidden: document.querySelector("[data-biz-detail-title]")?.hidden,
    };
  });

  if (state.nativeMobile) fail("native-mobile class should be off at 1280");
  else pass("1280: not native-mobile");

  if (state.asideDisplay === "none") fail("1280: hero aside should show on PC");
  else pass("1280: hero aside visible");

  if (state.gridDisplay !== "grid") fail(`1280: product grid should be grid (${state.gridDisplay})`);
  else pass("1280: product grid layout preserved");

  if (state.fvDisplay !== "flex") fail(`1280: hero should be flex (${state.fvDisplay})`);
  else pass("1280: hero flex layout");

  if (!state.reviewsVisible) fail("1280: reviews section not visible");
  else pass("1280: reviews section visible");

  if (!state.reviewsInNav) fail("1280: reviews tab missing in PC nav");
  else pass("1280: reviews tab in PC nav");

  if (!state.pointsVisible) fail("1280: retail-points (こだわり) not visible");
  else pass("1280: commitment card visible");

  if (state.titleHidden) fail("1280: shop title should be visible on PC");
  else pass("1280: shop title visible");
}

await withPlaywrightBrowser(async (browser) => {
  await check390(page);
  await check1280(page);
  if (process.exitCode) console.error("\nSome checks failed.");
  else console.log("\nAll checks passed.");
});

await closeAllBrowsers();
