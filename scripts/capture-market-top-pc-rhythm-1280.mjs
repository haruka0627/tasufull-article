/**
 * 市場TOP PC 最終確認 — 1280px（人気商品 / Connect / 閲覧履歴）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "market-top-pc-rhythm";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const TOP_PATH = "shop-store.html";

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: TOP_PATH });
const topUrl = buildLocalPageUrl(base, TOP_PATH);
await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(topUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(page);
await page.waitForSelector("[data-tasful-market-pc-top]:not([hidden])", { timeout: 20000 });
await page.waitForSelector(".tasful-market-pc-hero-full", { timeout: 20000 });
await page.waitForSelector(".tasful-market-pc-hero-shelf", { timeout: 20000 });
await page.waitForSelector(".tasful-market-pc-spotlight", { timeout: 20000 });
await page.waitForSelector(".tasful-market-pc-ranking-grid", { timeout: 20000 });
await page.waitForSelector(".tasful-market-pc-connect-trust", { timeout: 20000 });
await page.waitForSelector(".tasful-market-pc-shelf--connect", { timeout: 20000 });
await page.waitForSelector(".tasful-market-pc-shelf--recent", { timeout: 20000 });
await page.waitForTimeout(800);

await page.locator("#tasful-market-pc-hero").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT_DIR, "market-top-timesale-1280.png"), fullPage: false });

const audit = await page.evaluate(() => {
  const header = document.querySelector("[data-tasful-market-header]");
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;

  function overlapPair(a, b, margin = 2) {
    if (!a || !b) return false;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return !(
      ra.right <= rb.left + margin ||
      ra.left >= rb.right - margin ||
      ra.bottom <= rb.top + margin ||
      ra.top >= rb.bottom - margin
    );
  }

  function sectionVisible(id) {
    const el = document.getElementById(id);
    if (!el) return { ok: false };
    const r = el.getBoundingClientRect();
    const head = el.querySelector(".tasful-market-pc-shelf__head, .tasful-market-pc-hero-full__head");
    const headTop = head ? head.getBoundingClientRect().top : r.top;
    return {
      ok: headTop >= headerBottom - 4 && r.bottom <= window.innerHeight + 2,
      headTop,
      headerBottom,
      sectionBottom: r.bottom,
      viewport: window.innerHeight,
    };
  }

  const rankingCards = [...document.querySelectorAll(".tasful-market-pc-ranking-card")];
  const first = document.querySelector(".tasful-market-pc-ranking-card--rank-1, .ranking-card--rank-1");
  const second = rankingCards[1];
  const grid = document.querySelector(".tasful-market-pc-ranking-grid");

  let rankingTextOverlap = false;
  for (const card of rankingCards) {
    const badge = card.querySelector(".tasful-market-pc-ranking-card__rank");
    const title = card.querySelector(".tasful-market-pc-ranking-card__title");
    const price = card.querySelector(".tasful-market-pc-ranking-card__price");
    const rating = card.querySelector(".tasful-market-pc-ranking-card__rating");
    if (overlapPair(badge, title) || overlapPair(badge, price)) rankingTextOverlap = true;
    if (title && price && overlapPair(title, price)) rankingTextOverlap = true;
    if (price && rating && overlapPair(price, rating)) rankingTextOverlap = true;
  }

  const firstImg = first?.querySelector(".tasful-market-pc-ranking-card__img");
  const secondImg = second?.querySelector(".tasful-market-pc-ranking-card__img");
  const firstH = firstImg ? parseFloat(getComputedStyle(firstImg).height) : 0;
  const secondH = secondImg ? parseFloat(getComputedStyle(secondImg).height) : 0;
  const firstW = first ? first.getBoundingClientRect().width : 0;
  const secondW = second ? second.getBoundingClientRect().width : 0;

  const trustCards = [...document.querySelectorAll(".tasful-market-pc-connect-trust-card")];
  let trustOverlap = false;
  for (let i = 0; i < trustCards.length; i++) {
    for (let j = i + 1; j < trustCards.length; j++) {
      if (overlapPair(trustCards[i], trustCards[j])) trustOverlap = true;
    }
    const t = trustCards[i].querySelector(".tasful-market-pc-connect-trust-card__title");
    const x = trustCards[i].querySelector(".tasful-market-pc-connect-trust-card__text");
    if (overlapPair(t, x)) trustOverlap = true;
  }

  const connectCards = [...document.querySelectorAll(".tasful-market-pc-shelf-scroll--connect .tasful-market-pc-shelf-card")];
  let connectCardOverlap = false;
  for (const card of connectCards) {
    const badge = card.querySelector(".tasful-market-pc-shelf-card__connect-badge");
    const title = card.querySelector(".tasful-market-pc-shelf-card__title");
    const price = card.querySelector(".tasful-market-pc-shelf-card__price");
    const rating = card.querySelector(".tasful-market-pc-shelf-card__rating");
    if (overlapPair(badge, title) || overlapPair(badge, price)) connectCardOverlap = true;
    if (title && price && overlapPair(title, price)) connectCardOverlap = true;
    if (price && rating && overlapPair(price, rating)) connectCardOverlap = true;
  }

  const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean) : [];
  const row = first ? getComputedStyle(first).gridRow : "";

  return {
    timesale: Boolean(document.querySelector("#tasful-market-pc-hero")),
    forYou: document.querySelectorAll(".tasful-market-pc-hero-shelf-card").length,
    spotlight: document.querySelectorAll(".tasful-market-pc-spotlight-card").length,
    ranking: rankingCards.length,
    rankingFirst: Boolean(first),
    trustCards: trustCards.length,
    connect: connectCards.length,
    recent: document.querySelectorAll(".tasful-market-pc-mini-thumb").length,
    rankBadges: document.querySelectorAll(".tasful-market-pc-ranking-card__rank").length,
    connectBadges: document.querySelectorAll(".tasful-market-pc-shelf-card__connect-badge").length,
    mobileHidden: getComputedStyle(document.querySelector(".tasful-market-mobile-top")).display === "none",
    rankingLayoutOk: Boolean(
      grid &&
        first &&
        cols.length === 5 &&
        !row.includes("span") &&
        firstH > 0 &&
        secondH > 0 &&
        firstH > secondH &&
        firstH <= secondH * 1.18 &&
        Math.abs(firstW - secondW) <= 8
    ),
    rankingTextOverlap,
    trustCardsOk: trustCards.length === 3 && !trustOverlap,
    connectCardOverlap,
    connectBgOk: (() => {
      const sec = document.querySelector(".tasful-market-pc-shelf--connect");
      return sec ? getComputedStyle(sec).backgroundColor !== "rgba(0, 0, 0, 0)" : false;
    })(),
    connectHeaderOk: (() => {
      const head = document.querySelector(".tasful-market-pc-shelf--connect .tasful-market-pc-shelf__head");
      const title = head?.querySelector(".tasful-market-pc-shelf__title");
      const link = head?.querySelector(".tasful-market-pc-shelf__link");
      const lead = head?.querySelector(".tasful-market-pc-shelf__lead");
      const intro = head?.querySelector(".tasful-market-pc-shelf__intro");
      if (!head || !title || !link || !lead || !intro) return false;
      const tr = title.getBoundingClientRect();
      const lr = link.getBoundingClientRect();
      const le = lead.getBoundingClientRect();
      const ir = intro.getBoundingClientRect();
      const headStyle = getComputedStyle(head);
      const noFixedClip = headStyle.maxHeight === "none" || parseFloat(headStyle.maxHeight) > 80;
      const leadBelowTitle = le.top >= tr.bottom - 2;
      const introBelowLead = ir.top >= le.bottom - 2;
      const linkNotOverlapLead = lr.bottom <= le.top + 2 || lr.left > le.right - 20;
      return noFixedClip && leadBelowTitle && introBelowLead && linkNotOverlapLead;
    })(),
    openSectionLayoutOk: (() => {
      const openIds = [
        "tasful-market-pc-for-you-strip",
        "tasful-market-pc-also-strip",
        "tasful-market-pc-popular-strip",
        "tasful-market-pc-recent-mini",
      ];
      return openIds.every((id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const s = getComputedStyle(el);
        const bg = s.backgroundColor;
        const noFill = bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
        const noBorder = parseFloat(s.borderTopWidth) === 0 && parseFloat(s.borderBottomWidth) === 0;
        return noFill && noBorder;
      });
    })(),
    connectTrustBlockOk: (() => {
      const sec = document.querySelector(".tasful-market-pc-shelf--connect");
      if (!sec) return false;
      const s = getComputedStyle(sec);
      return parseFloat(s.borderRadius) >= 15 && parseFloat(s.paddingTop) >= 23;
    })(),
    parentContainerOpenOk: (() => {
      const pcTop = document.querySelector("[data-tasful-market-pc-top]");
      const shell = document.querySelector(".tasful-market-shell");
      const main = document.querySelector(".tasful-market-main");
      if (!pcTop || !shell || !main) return false;
      const isOpen = (el) => {
        const s = getComputedStyle(el);
        const bg = s.backgroundColor;
        const noFill = bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
        const noBorder = parseFloat(s.borderTopWidth) === 0;
        return noFill && noBorder;
      };
      const shellS = getComputedStyle(shell);
      const shellMax = shellS.maxWidth;
      const shellWide = shellMax === "none" || Number.isNaN(parseFloat(shellMax)) || parseFloat(shellMax) > 2000;
      const shellBg = shellS.backgroundColor;
      const shellOpen =
        (shellBg === "rgba(0, 0, 0, 0)" || shellBg === "transparent") && shellWide;
      return isOpen(pcTop) && isOpen(main) && shellOpen;
    })(),
    contentWidthOk: (() => {
      const hero = document.querySelector(".tasful-market-pc-hero-full");
      const forYou = document.getElementById("tasful-market-pc-for-you-strip");
      const ranking = document.getElementById("tasful-market-pc-popular-strip");
      const connect = document.getElementById("tasful-market-pc-connect-strip");
      if (!hero || !forYou || !ranking || !connect) return false;
      const w = (el) => el.getBoundingClientRect().width;
      const hw = w(hero);
      const fw = w(forYou);
      const rw = w(ranking);
      const cw = w(connect);
      const aligned = Math.abs(hw - fw) <= 2 && Math.abs(fw - rw) <= 2 && Math.abs(rw - cw) <= 2;
      const target = Math.min(1340, window.innerWidth);
      const wide = hw >= target - 4 && hw > 1240;
      return aligned && wide;
    })(),
    connectCarouselOk: (() => {
      const stage = document.querySelector("[data-tasful-connect-scroll-stage]");
      const prev = document.querySelector(".tasful-market-pc-connect-scroll-btn--prev");
      const next = document.querySelector(".tasful-market-pc-connect-scroll-btn--next");
      const scroll = document.querySelector(".tasful-market-pc-shelf-scroll--connect");
      const fade = document.querySelector(".tasful-market-pc-connect-scroll-fade");
      const more = document.querySelector(".tasful-market-pc-connect-scroll-more");
      if (!stage || !prev || !next || !scroll) return false;
      const canScroll = scroll.scrollWidth > scroll.clientWidth + 4;
      const prevHidden = prev.hidden;
      const nextVisible = !next.hidden;
      const noLegacyUi = !fade && !more;
      return canScroll && prevHidden && nextVisible && noLegacyUi;
    })(),
    quadMetaOk: (() => {
      const metas = [...document.querySelectorAll(".tasful-market-pc-quad__thumb-meta")];
      return metas.length >= 8 && metas.every((el) => /送料無料/.test(el.textContent) && /★|☆|\(/.test(el.textContent));
    })(),
    heroScrimStrongOk: (() => {
      const scrim = document.querySelector(".hero-feature__text-scrim");
      if (!scrim) return false;
      const bg = getComputedStyle(scrim).backgroundColor;
      return bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
    })(),
    heroScrimOk: Boolean(document.querySelector(".hero-feature__text-scrim")),
    spotlightHoverOk: (() => {
      const card = document.querySelector(".tasful-market-pc-spotlight-card");
      if (!card) return false;
      const s = getComputedStyle(card);
      return s.transitionProperty.includes("transform") && parseFloat(s.transitionDuration) >= 0.2;
    })(),
    rankingVisible: sectionVisible("tasful-market-pc-popular-strip"),
    connectVisible: sectionVisible("tasful-market-pc-connect-strip"),
    recentVisible: sectionVisible("tasful-market-pc-recent-mini"),
    firstImgH: firstH,
    secondImgH: secondH,
    firstCardW: firstW,
    secondCardW: secondW,
  };
});

await page.locator("#tasful-market-pc-popular-strip").scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
const rankingVisibleAudit = await page.evaluate(() => {
  const header = document.querySelector("[data-tasful-market-header]");
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const section = document.getElementById("tasful-market-pc-popular-strip");
  if (!section) return { ok: false };
  const r = section.getBoundingClientRect();
  const head = section.querySelector(".tasful-market-pc-shelf__head");
  const grid = section.querySelector(".tasful-market-pc-ranking-grid");
  const headTop = head ? head.getBoundingClientRect().top : r.top;
  const gridBottom = grid ? grid.getBoundingClientRect().bottom : r.bottom;
  return {
    ok: headTop >= headerBottom - 4 && gridBottom <= window.innerHeight + 4,
    headTop,
    headerBottom,
    gridBottom,
    viewport: window.innerHeight,
  };
});
await page.screenshot({ path: path.join(OUT_DIR, "market-top-ranking-1280.png"), fullPage: false });

await page.locator("#tasful-market-pc-connect-strip").scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
const connectVisibleAudit = await page.evaluate(() => {
  const header = document.querySelector("[data-tasful-market-header]");
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const section = document.getElementById("tasful-market-pc-connect-strip");
  if (!section) return { ok: false };
  const r = section.getBoundingClientRect();
  const head = section.querySelector(".tasful-market-pc-shelf__head");
  const shelf = section.querySelector(".tasful-market-pc-shelf-scroll--connect");
  const headTop = head ? head.getBoundingClientRect().top : r.top;
  const shelfBottom = shelf ? shelf.getBoundingClientRect().bottom : r.bottom;
  return {
    ok: headTop >= headerBottom - 4 && shelfBottom <= window.innerHeight + 4,
    headTop,
    headerBottom,
    shelfBottom,
    viewport: window.innerHeight,
  };
});
await page.screenshot({ path: path.join(OUT_DIR, "market-top-connect-full-1280.png"), fullPage: false });

await page.locator("#tasful-market-pc-recent-mini").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);

const shotPath = path.join(OUT_DIR, "market-top-pc-rhythm-1280.png");
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: shotPath, fullPage: true });

await page.screenshot({ path: path.join(OUT_DIR, "market-top-connect-header-1280.png"), fullPage: false });

const spPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await spPage.goto(topUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertPlaywrightLocalhostPage(spPage);
await spPage.waitForSelector(".tasful-market-mobile-top", { timeout: 20000 });
await spPage.waitForTimeout(600);
const spAudit = await spPage.evaluate(() => {
  const pcTop = document.querySelector("[data-tasful-market-pc-top]");
  const mobile = document.querySelector(".tasful-market-mobile-top");
  const pcDisplay = pcTop ? getComputedStyle(pcTop).display : "none";
  const mobileDisplay = mobile ? getComputedStyle(mobile).display : "none";
  return {
    ok: pcDisplay === "none" && mobileDisplay !== "none",
    pcDisplay,
    mobileDisplay,
  };
});
await spPage.screenshot({ path: path.join(OUT_DIR, "market-top-mobile-390.png"), fullPage: false });
await spPage.close();

});

const pass =
  audit.timesale &&
  audit.forYou >= 4 &&
  audit.spotlight === 3 &&
  audit.ranking >= 5 &&
  audit.rankingFirst &&
  audit.trustCards === 3 &&
  audit.recent >= 6 &&
  audit.rankBadges >= 5 &&
  audit.connect >= 4 &&
  audit.connectBadges >= 3 &&
  audit.mobileHidden &&
  audit.rankingLayoutOk &&
  !audit.rankingTextOverlap &&
  audit.trustCardsOk &&
  !audit.connectCardOverlap &&
  audit.connectBgOk &&
  audit.connectHeaderOk &&
  audit.openSectionLayoutOk &&
  audit.connectTrustBlockOk &&
  audit.parentContainerOpenOk &&
  audit.contentWidthOk &&
  audit.connectCarouselOk &&
  audit.quadMetaOk &&
  audit.heroScrimStrongOk &&
  audit.heroScrimOk &&
  audit.spotlightHoverOk &&
  rankingVisibleAudit.ok &&
  connectVisibleAudit.ok &&
  spAudit.ok;

const report = {
  generatedAt: new Date().toISOString(),
  topUrl,
  pass,
  audit,
  rankingVisibleAudit,
  connectVisibleAudit,
  spAudit,
};
fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "市場TOP PC Gemini採用3項目",
  report,
  targetPage: TOP_PATH,
  viewports: ["1280", "390"],
  overall: pass ? "PASS" : "FAIL",
  screenshotCatalog: [
    { file: "market-top-pc-rhythm-1280.png", label: "市場TOP PC 1280px 全セクション", url: TOP_PATH, viewport: "1280" },
    { file: "market-top-timesale-1280.png", label: "タイムセール 1280px", url: TOP_PATH, viewport: "1280" },
    { file: "market-top-ranking-1280.png", label: "人気商品セクション全体 1280px", url: TOP_PATH, viewport: "1280" },
    { file: "market-top-connect-full-1280.png", label: "Connectセクション全体 1280px", url: TOP_PATH, viewport: "1280" },
    { file: "market-top-connect-header-1280.png", label: "Connectヘッダー 1280px", url: TOP_PATH, viewport: "1280" },
    { file: "market-top-mobile-390.png", label: "市場TOP SP 390px 影響確認", url: TOP_PATH, viewport: "390" },
  ],
});

await closeAllBrowsers();
process.exit(pass ? 0 : 1);
