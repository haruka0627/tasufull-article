#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * スマホ詳細ページ — 文字化け・下部タブ・戻る（390px）
 *   node scripts/test-mobile-detail-pages.mjs
 */

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

const PAGES = [
  { path: "anpi-dashboard.html", mustInclude: "安否ダッシュボード", mustNot: "ダチE" },
  { path: "detail-job.html?id=demo-job-001", mustInclude: "カフェスタッフ", mustNot: "掲載が見つかりません" },
  { path: "detail-product.html?id=demo-product-001", mustInclude: "ハンドメイド", mustNot: "掲載が見つかりません" },
  { path: "detail-business-service.html?id=demo-business-service-001", mustInclude: "外壁塗装", mustNot: "掲載が見つかりません" },
  { path: "detail-business-service.html", mustInclude: "外壁塗装", mustNot: "URL に掲載 ID" },
  { path: "detail-business.html", mustInclude: "外壁塗装", mustNot: "URL に掲載 ID" },
  { path: "detail-business.html?id=demo-business-001", mustInclude: "外壁塗装", mustNot: "掲載が見つかりません" },
  { path: "detail-shop.html?id=demo-shop-001", mustInclude: "花屋", mustNot: "掲載が見つかりません" },
  { path: "detail-general.html?id=demo-general-001", mustInclude: "地域交流", mustNot: "掲載が見つかりません" },
  { path: "demo-progress.html", mustInclude: "進行中", mustNot: "ダチE" },
  { path: "deal-detail.html?id=builder_demo_001", mustInclude: "店舗内装", mustNot: "案件が見つかりません" },
  { path: "deal-detail.html?id=builder_demo_001#completion", mustInclude: "完了報告", mustNot: "案件が見つかりません" },
];

const TEMPLATE_PAGES = [
  "detail-business-service.html?id=demo-business-service-001",
  "detail-job.html?id=demo-job-001",
  "detail-product.html?id=demo-product-001",
  "detail-shop.html?id=demo-shop-001",
  "detail-general.html?id=demo-general-001",
  "demo-progress.html",
];

const PAGES_EXTRA = [{ path: "checkout.html", mustInclude: "ご注文", mustNot: "ご注斁E" }];

const NOTIFY_OPEN_CASES = [
  { cardClass: "talk-notify-card--job", action: "view-job", urlRe: /detail-job\.html/, mustInclude: "カフェスタッフ" },
  { cardClass: "talk-notify-card--product", action: "view-product", urlRe: /detail-product\.html/, mustInclude: "ハンドメイド" },
  { cardClass: "talk-notify-card--business", action: "view-business", urlRe: /detail-business-service\.html/, mustInclude: "外壁塗装" },
  { cardClass: "talk-notify-card--shop", action: "view-shop", urlRe: /detail-shop\.html/, mustInclude: "花屋" },
  { cardClass: "talk-notify-card--anpi", action: "view-anpi", urlRe: /anpi-dashboard\.html/, mustInclude: "安否" },
  { cardClass: "talk-notify-card--system", action: "open", urlRe: /talk-ops-room\.html/, mustInclude: "" },
];

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    for (const spec of [...PAGES, ...PAGES_EXTRA]) {
      await page.goto(`${BASE}/${spec.path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      if (spec.path.startsWith("detail-business.html")) {
        await page.waitForURL(/detail-business-service\.html/, { timeout: 12000 });
      }
      await page.waitForFunction(() => typeof window.TasufulAppMobile?.isMobileViewport === "function");
      await page.waitForTimeout(400);

      const bodyText = await page.evaluate(() => document.body.innerText);
      if (!bodyText.includes(spec.mustInclude)) fail(`${spec.path}: missing "${spec.mustInclude}"`);
      else pass(`${spec.path}: text OK (${spec.mustInclude})`);

      if (spec.mustNot && bodyText.includes(spec.mustNot)) fail(`${spec.path}: unwanted "${spec.mustNot}"`);
      else pass(`${spec.path}: no error marker`);

      if (/detail-/.test(spec.path)) {
        const resolverOk = await page.evaluate(() => {
          try {
            if (typeof global !== "undefined" && typeof window === "undefined") {
              return { ok: false, reason: "bare global without window" };
            }
            return { ok: Boolean(window.TasuListingRouteResolver?.buildDetailUrl) };
          } catch (e) {
            return { ok: false, reason: String(e.message || e) };
          }
        });
        if (!resolverOk.ok) fail(`${spec.path}: resolver — ${resolverOk.reason || "missing"}`);
        else pass(`${spec.path}: TasuListingRouteResolver OK`);
      }

      const ui = await page.evaluate(() => ({
        tab: Boolean(document.querySelector("[data-tasu-app-tabbar]")),
        back: Boolean(document.querySelector("[data-tasu-mobile-back]")),
        pad: parseFloat(getComputedStyle(document.body).paddingBottom),
      }));
      if (!ui.tab) fail(`${spec.path}: tab bar`);
      else pass(`${spec.path}: tab bar`);
      if (!ui.back) fail(`${spec.path}: back button`);
      else pass(`${spec.path}: back button`);
      if (ui.pad < 80) fail(`${spec.path}: padding-bottom ${ui.pad}`);
      else pass(`${spec.path}: padding-bottom`);
    }

    await page.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-talk-notify-list] .talk-notify-card", { timeout: 10000 });
    const anpiOpen = page
      .locator(
        '[data-talk-notify-list] .talk-notify-card--anpi [data-talk-notify-action="open"], [data-talk-notify-list] .talk-notify-card--anpi [data-talk-notify-action="view-anpi"]'
      )
      .first();
    if ((await anpiOpen.count()) > 0) {
      await anpiOpen.click({ force: true });
      await page.waitForURL(/anpi-dashboard\.html/, { timeout: 8000 });
      const title = await page.evaluate(() => {
        const h = document.querySelector(".anpi-dash-header__title, .tasu-mobile-shell-head__title");
        return h?.textContent || document.title;
      });
      if (!String(title).includes("安否ダッシュボード")) fail("anpi-dashboard title garbled");
      else pass("anpi notify open → anpi-dashboard");
      const tab = await page.locator("[data-tasu-app-tabbar]").isVisible();
      if (!tab) fail("tab bar after notify nav");
      else pass("tab bar after notify nav");
    } else pass("anpi open action N/A in seed");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tasu-mobile-home__section", { timeout: 10000 }).catch(() => null);
    const serviceLink = page.locator('.tasu-mobile-home__section:has-text("おすすめサービス") a.tasu-mobile-home__row').first();
    if ((await serviceLink.count()) > 0) {
      const href = await serviceLink.getAttribute("href");
      if (!href || href === "#" || !/detail-business-service\.html\?id=/.test(href)) {
        fail(`dashboard recommend href invalid: ${href || "(empty)"}`);
      } else {
        pass(`dashboard recommend href: ${href}`);
        await serviceLink.click({ force: true });
        await page.waitForURL(/detail-business-service\.html\?id=/, { timeout: 12000 });
      }
      const dashBody = await page.evaluate(() => document.body.innerText);
      const loaded = await page.evaluate(() => document.body.dataset.listingLoaded === "true");
      if (dashBody.includes("URL に掲載 ID")) fail("dashboard recommend → missing id error");
      else if (!loaded && dashBody.includes("掲載が見つかりません")) {
        fail("dashboard recommend → not found");
      } else pass("dashboard recommend → business detail");
      await page.goto(`${BASE}/dashboard.html`, { waitUntil: "domcontentloaded" });
    } else pass("dashboard recommend section N/A");

    await page.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-talk-notify-list] .talk-notify-card", { timeout: 10000 });

    const bizOpen = page
      .locator('[data-talk-notify-id="talk-n-003"] [data-talk-notify-action="open"]')
      .first();
    if ((await bizOpen.count()) > 0) {
      await bizOpen.click({ force: true });
      await page.waitForURL(/detail-business-service\.html\?id=/, { timeout: 12000 });
      await page.waitForFunction(
        () =>
          document.body.dataset.listingLoaded === "true" ||
          document.querySelector("[data-biz-detail-title]")?.textContent?.trim(),
        { timeout: 15000 }
      );
      const bizText = await page.evaluate(() => document.body.innerText);
      const loaded = await page.evaluate(() => document.body.dataset.listingLoaded === "true");
      if (bizText.includes("URL に掲載 ID")) fail("notify business open → missing id");
      else if (!loaded && bizText.includes("掲載が見つかりません")) fail("notify business open → not found");
      else pass("notify business open → detail OK");
      await page.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-talk-notify-list] .talk-notify-card", { timeout: 10000 });
    } else pass("notify business open N/A");

    await page.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-talk-notify-list] .talk-notify-card", { timeout: 10000 });

    const builderCompletion = page
      .locator('[data-talk-notify-id="talk-n-008"] [data-talk-notify-action="view-completion"], [data-talk-notify-id="talk-n-008"] [data-talk-notify-action="view-project"]')
      .first();
    if ((await builderCompletion.count()) > 0) {
      await builderCompletion.click({ force: true });
      await page.waitForURL(/deal-detail\.html\?id=builder_demo_001/, { timeout: 12000 });
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (!bodyText.includes("完了報告") && !bodyText.includes("店舗内装")) {
        fail("builder completion notify → deal-detail content");
      } else pass("builder completion notify → deal-detail");
      const tab = await page.locator("[data-tasu-app-tabbar]").isVisible();
      if (!tab) fail("tab bar after builder completion nav");
      else pass("tab bar after builder completion nav");
      await page.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-talk-notify-list] .talk-notify-card", { timeout: 10000 });
    } else pass("builder completion action N/A");

    for (const spec of NOTIFY_OPEN_CASES) {
      const btn = page
        .locator(
          `[data-talk-notify-list] .${spec.cardClass} [data-talk-notify-action="${spec.action}"]`
        )
        .first();
      if ((await btn.count()) === 0) {
        pass(`notify ${spec.cardClass}: action N/A`);
        continue;
      }
      await btn.click({ force: true });
      await page.waitForURL(spec.urlRe, { timeout: 12000 });
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes("掲載が見つかりません")) {
        fail(`notify → ${spec.cardClass}: not found shown`);
      } else if (spec.mustInclude && !bodyText.includes(spec.mustInclude)) {
        fail(`notify → ${spec.cardClass}: missing "${spec.mustInclude}"`);
      } else {
        pass(`notify → ${spec.cardClass}: content OK`);
      }
      const ui = await page.evaluate(() => ({
        tab: Boolean(document.querySelector("[data-tasu-app-tabbar]")),
        back: Boolean(document.querySelector("[data-tasu-mobile-back]")),
      }));
      if (!ui.tab) fail(`notify nav ${spec.cardClass}: tab bar`);
      if (!ui.back) fail(`notify nav ${spec.cardClass}: back bar`);
      await page.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-talk-notify-list] .talk-notify-card", { timeout: 10000 });
    }

    for (const path of TEMPLATE_PAGES) {
      await page.goto(`${BASE}/${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(() => typeof window.TasuMobileDetailTemplate !== "undefined");
      await page.waitForTimeout(600);
      if (path.includes("detail-") && !path.includes("listingLoaded")) {
        await page
          .waitForFunction(
            () =>
              document.body.dataset.listingLoaded === "true" ||
              document.querySelector("[data-tasu-mdetail-hero]")?.textContent?.length > 20,
            { timeout: 15000 }
          )
          .catch(() => null);
      }
      const ui = await page.evaluate(() => {
        const hero = document.querySelector("[data-tasu-mdetail-hero]");
        const cta = document.querySelector("[data-tasu-mdetail-cta-dock]");
        const nav = document.querySelector(".section-nav");
        const pad = parseFloat(getComputedStyle(document.body).paddingBottom);
        const navHidden = nav ? getComputedStyle(nav).display === "none" : true;
        const upperCtas = [
          ...document.querySelectorAll(
            ".bsd-cta-card, .skill-hero-premium__cta, .product-cta-panel, .job-cta-panel"
          ),
        ];
        const sidebarHidden = upperCtas.every((el) => {
          const st = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return st.display === "none" || st.visibility === "hidden" || r.height < 8;
        });
        return {
          hero: Boolean(hero && hero.offsetHeight > 40),
          heroTitle: hero?.querySelector(".tasu-mdetail-hero__title")?.textContent?.trim() || "",
          cta: Boolean(cta && cta.offsetHeight > 30),
          menu: Boolean(document.querySelector("[data-tasu-mdetail-menu]")),
          back: Boolean(document.querySelector("[data-tasu-mobile-back]")),
          tab: Boolean(document.querySelector("[data-tasu-app-tabbar]")),
          pad,
          navHidden,
          sidebarHidden,
        };
      });
      if (!ui.hero) fail(`${path}: mobile hero card`);
      else pass(`${path}: mobile hero (${ui.heroTitle.slice(0, 20) || "ok"})`);
      const skipCtaDock = path === "demo-progress.html" || path.startsWith("detail-job.html");
      if (skipCtaDock) {
        if (ui.cta) fail(`${path}: fixed CTA dock should be absent`);
        else pass(`${path}: no fixed CTA dock`);
      } else if (!ui.cta) fail(`${path}: fixed CTA dock`);
      else pass(`${path}: fixed CTA dock`);
      const tabVisible = await page.evaluate(() => {
        const tab = document.querySelector("[data-tasu-app-tabbar]");
        if (!tab) return false;
        const st = getComputedStyle(tab);
        return st.display !== "none" && tab.offsetHeight > 20;
      });
      if (!tabVisible) fail(`${path}: app tab bar hidden`);
      else pass(`${path}: app tab bar visible`);
      if (!ui.back) fail(`${path}: back bar`);
      if (!ui.menu) fail(`${path}: menu button`);
      if (!ui.tab) fail(`${path}: tab bar`);
      const minPad = path === "demo-progress.html" ? 72 : 140;
      if (ui.pad < minPad) fail(`${path}: padding-bottom ${ui.pad}`);
      else pass(`${path}: padding-bottom OK`);
      if (!ui.navHidden) fail(`${path}: section-nav still visible`);
      else pass(`${path}: section-nav hidden`);
      if (!ui.sidebarHidden) fail(`${path}: upper CTA still visible`);
      else pass(`${path}: upper CTA hidden`);
    }

    await page.goto(
      `${BASE}/detail-business-service.html?id=demo-business-service-001`,
      { waitUntil: "domcontentloaded", timeout: 20000 }
    );
    await page.waitForFunction(() => typeof window.TasuMobileDetailTemplate !== "undefined");
    await page
      .waitForFunction(
        () =>
          document.body.classList.contains("tasu-mdetail-ready") &&
          document.querySelector("[data-tasu-mdetail-hero]")?.offsetHeight > 40,
        { timeout: 15000 }
      )
      .catch(() => null);
    await page.waitForTimeout(400);
    const bizSvc = await page.evaluate(() => {
      const shell = document.querySelector("[data-tasu-mobile-detail-shell]");
      const hero = shell?.querySelector("[data-tasu-mdetail-hero]") || document.querySelector("[data-tasu-mdetail-hero]");
      const sectionsHost =
        shell?.querySelector("[data-tasu-mdetail-sections]") || document.querySelector("[data-tasu-mdetail-sections]");
      const firstSection = sectionsHost?.querySelector(".tasu-mdetail-section");
      const heroRect = hero?.getBoundingClientRect();
      const firstRect = firstSection?.getBoundingClientRect();
      const gap =
        heroRect && firstRect && firstRect.top >= heroRect.bottom
          ? firstRect.top - heroRect.bottom
          : 999;
      const emptySections = [...(sectionsHost?.querySelectorAll(".tasu-mdetail-section") || [])].filter(
        (el) => {
          const body = el.querySelector(".tasu-mdetail-section__body");
          const text = String(body?.textContent || "").replace(/\s+/g, "").trim();
          const h = el.getBoundingClientRect().height;
          return h > 80 && text.length < 8;
        }
      );
      const labels = [...(sectionsHost?.querySelectorAll(".tasu-mdetail-section__label") || [])].map((el) =>
        el.textContent?.trim()
      );
      const midCtaVisible = [...document.querySelectorAll(".bsd-cta-card, .hero-cta-card")].some((el) => {
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return st.display !== "none" && st.visibility !== "hidden" && r.height > 20 && r.width > 40;
      });
      const stackHidden = (() => {
        const stack = document.querySelector(".bsd-sections-stack");
        if (!stack) return true;
        const st = getComputedStyle(stack);
        return st.display === "none" || stack.offsetHeight < 8;
      })();
      const ctaDock = document.querySelector("[data-tasu-mdetail-cta-dock]");
      const tab = document.querySelector("[data-tasu-app-tabbar]");
      const ctaRect = ctaDock?.getBoundingClientRect();
      const tabRect = tab?.getBoundingClientRect();
      const ctaAboveTab = ctaRect && tabRect ? ctaRect.bottom <= tabRect.top + 2 : true;
      const pcRoot = document.getElementById("business-service-detail-root");
      const pcRootHidden = (() => {
        if (!pcRoot) return true;
        const st = getComputedStyle(pcRoot);
        return st.display === "none" || pcRoot.offsetHeight < 8 || pcRoot.getAttribute("aria-hidden") === "true";
      })();
      const footerVisible = [...document.querySelectorAll(".bsd-footer, [data-fs-site-footer]")].some((el) => {
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return st.display !== "none" && st.visibility !== "hidden" && r.height > 12;
      });
      const aiBandVisible = [...document.querySelectorAll(".bsd-ai-band, [data-fs-ai-band]")].some((el) => {
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return st.display !== "none" && r.height > 12;
      });
      const visibleText = document.body.innerText;
      return {
        gap,
        emptyCount: emptySections.length,
        labels,
        midCtaVisible,
        stackHidden,
        ctaAboveTab,
        pcRootHidden,
        footerVisible,
        aiBandVisible,
        shellHasHero: Boolean(shell && shell.contains(hero)),
        hasOverview: labels.includes("業務概要"),
        hasFaq: labels.includes("FAQ"),
        bodyText: visibleText.slice(0, 1200),
        hasPcCtaPhrase: /ご相談・お見積りはこち/.test(visibleText),
        hasSiteFooterCopy: /©\s*2026\s*TASFUL|地域密着型便利プラットフォーム/.test(visibleText),
        hasAiBandPhrase: /業務内容.*見積もりについて.*ご相談|業務内容め積もりについて/.test(visibleText),
      };
    });
    if (bizSvc.gap > 72) fail(`business-service: hero→section gap ${bizSvc.gap.toFixed(0)}px (blank card?)`);
    else pass(`business-service: hero→section gap OK (${bizSvc.gap.toFixed(0)}px)`);
    if (bizSvc.emptyCount > 0) fail(`business-service: ${bizSvc.emptyCount} empty section card(s)`);
    else pass("business-service: no empty section cards");
    if (!bizSvc.stackHidden) fail("business-service: PC sections stack still visible");
    else pass("business-service: PC sections stack hidden");
    if (bizSvc.midCtaVisible) fail("business-service: mid-page CTA card visible");
    else pass("business-service: mid-page CTA hidden");
    if (!bizSvc.ctaAboveTab) fail("business-service: fixed CTA overlaps tab bar");
    else pass("business-service: fixed CTA above tab bar");
    const expectedOrder = ["業務概要", "会社・事業者情報", "対応エリア", "口コミ・評価", "FAQ", "注意事項"];
    const orderOk = expectedOrder.every((label, i) => {
      const idx = bizSvc.labels.indexOf(label);
      return idx === -1 || bizSvc.labels.slice(0, i + 1).includes(label);
    });
    const monotonic = bizSvc.labels.every((label, i) => {
      const want = expectedOrder.indexOf(label);
      if (want === -1) return true;
      const prev = bizSvc.labels.slice(0, i).map((l) => expectedOrder.indexOf(l)).filter((n) => n >= 0);
      return prev.length === 0 || want >= Math.max(...prev);
    });
    if (!bizSvc.shellHasHero) fail("business-service: hero not in mobile detail shell");
    else pass("business-service: hero inside mobile detail shell");
    if (!bizSvc.pcRootHidden) fail("business-service: PC detail root still visible");
    else pass("business-service: PC detail root hidden");
    if (bizSvc.footerVisible) fail("business-service: TASFUL footer still visible");
    else pass("business-service: site footer hidden");
    if (bizSvc.aiBandVisible) fail("business-service: AI consult band still visible");
    else pass("business-service: AI consult band hidden");
    if (bizSvc.hasPcCtaPhrase) fail("business-service: mid-page CTA copy visible");
    else pass("business-service: no mid-page CTA copy");
    if (bizSvc.hasSiteFooterCopy) fail("business-service: footer copyright copy visible");
    else pass("business-service: no footer copyright copy");
    if (bizSvc.hasAiBandPhrase) fail("business-service: AI band copy visible");
    else pass("business-service: no AI band copy");
    if (!bizSvc.hasOverview || !bizSvc.hasFaq) fail("business-service: missing key sections");
    else if (!monotonic) fail(`business-service: section order ${bizSvc.labels.join(" > ")}`);
    else pass(`business-service: section order OK (${bizSvc.labels.join(", ")})`);
    if (!orderOk) fail("business-service: expected labels missing");
    if (!bizSvc.bodyText.includes("戸建") && !bizSvc.bodyText.includes("外壁")) {
      fail("business-service: overview content missing");
    } else {
      pass("business-service: overview/fallback content present");
    }

    const BIZ_PATH = "/detail-business-service.html?id=demo-business-service-001";
    const evalBizViewport = () =>
      page.evaluate(() => {
        const pcRoot = document.getElementById("business-service-detail-root");
        const bsdPage = document.querySelector(".bsd-page");
        const shell = document.querySelector("[data-tasu-mobile-detail-shell]");
        const mobileHero = document.querySelector("[data-tasu-mdetail-hero]");
        const ctaDock = document.querySelector("[data-tasu-mdetail-cta-dock]");
        const isVisible = (el) => {
          if (!el) return false;
          const st = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return st.display !== "none" && st.visibility !== "hidden" && r.height > 20;
        };
        return {
          mdetailReady: document.body.classList.contains("tasu-mdetail-ready"),
          mdetailPage: document.body.classList.contains("tasu-mdetail-page"),
          pcHiddenCount: document.querySelectorAll("[data-tasu-mdetail-pc-hidden]").length,
          pcRootVisible: isVisible(pcRoot),
          bsdPageVisible: isVisible(bsdPage),
          shellVisible: isVisible(shell) && !shell?.hidden,
          mobileHeroVisible: isVisible(mobileHero),
          ctaDockVisible: isVisible(ctaDock),
          pcRootAria: pcRoot?.getAttribute("aria-hidden") || "",
        };
      });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(500);
    let vp = await evalBizViewport();
    if (vp.pcHiddenCount > 0) fail(`resize→1280: data-tasu-mdetail-pc-hidden remains (${vp.pcHiddenCount})`);
    else pass("resize→1280: pc-hidden attributes cleared");
    if (vp.mdetailReady || vp.mdetailPage) fail("resize→1280: mobile mdetail body class remains");
    else pass("resize→1280: mobile mdetail body class cleared");
    if (vp.mobileHeroVisible || vp.ctaDockVisible) fail("resize→1280: mobile template UI still visible");
    else pass("resize→1280: mobile template UI hidden");
    if (!vp.pcRootVisible || !vp.bsdPageVisible) fail("resize→1280: PC detail DOM not visible");
    else pass("resize→1280: PC detail DOM visible");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    vp = await evalBizViewport();
    if (!vp.mdetailReady) fail("resize→390: tasu-mdetail-ready missing");
    else pass("resize→390: mobile template re-enabled");
    if (!vp.shellVisible || !vp.mobileHeroVisible) fail("resize→390: mobile shell/hero not visible");
    else pass("resize→390: mobile shell/hero visible");
    if (vp.pcRootVisible || vp.bsdPageVisible) fail("resize→390: PC DOM leaked visible");
    else pass("resize→390: PC DOM hidden again");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}${BIZ_PATH}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(
      () =>
        document.body.dataset.listingLoaded === "true" &&
        document.querySelector(".bsd-page")?.offsetHeight > 100,
      { timeout: 15000 }
    ).catch(() => null);
    await page.waitForTimeout(400);
    vp = await evalBizViewport();
    if (vp.pcHiddenCount > 0) fail(`1280 direct: pc-hidden attr count ${vp.pcHiddenCount}`);
    else pass("1280 direct: no pc-hidden attributes");
    if (vp.mdetailReady) fail("1280 direct: tasu-mdetail-ready should be off");
    else pass("1280 direct: mobile template off");
    if (!vp.pcRootVisible || !vp.bsdPageVisible) fail("1280 direct: PC layout not shown");
    else pass("1280 direct: PC layout shown");
    if (vp.shellVisible && vp.mobileHeroVisible) fail("1280 direct: mobile shell visible");
    else pass("1280 direct: mobile shell hidden");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}${BIZ_PATH}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => document.body.classList.contains("tasu-mdetail-ready"), { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(300);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(500);
    vp = await evalBizViewport();
    if (vp.pcHiddenCount > 0) fail(`390→1280 cycle: pc-hidden should clear (${vp.pcHiddenCount})`);
    else pass("390→1280 cycle: pc-hidden cleared");
    if (!vp.pcRootVisible) fail("390→1280 cycle: PC root not visible at 1280");
    else pass("390→1280 cycle: PC root visible at 1280");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    vp = await evalBizViewport();
    if (!vp.mdetailReady || !vp.mobileHeroVisible) fail("1280→390 cycle: mobile template broken");
    else pass("1280→390 cycle: mobile template OK");
    if (vp.pcRootVisible) fail("1280→390 cycle: PC root visible on mobile");
    else pass("1280→390 cycle: PC root hidden on mobile");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(400);
    vp = await evalBizViewport();
    if (vp.pcHiddenCount > 0) fail(`1280→390→1280: pc-hidden remains (${vp.pcHiddenCount})`);
    else pass("1280→390→1280: pc-hidden cleared again");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/anpi-dashboard.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);
    const pcTabHidden = await page.evaluate(() => {
      const tab = document.querySelector("[data-tasu-app-tabbar]");
      return !tab || getComputedStyle(tab).display === "none";
    });
    if (!pcTabHidden) fail("PC: tab bar should be hidden");
    else pass("PC: tab bar hidden");

    await page.goto(`${BASE}/detail-job.html?id=demo-job-001`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const pcTemplateOff = await page.evaluate(() => {
      const hero = document.querySelector("[data-tasu-mdetail-hero]");
      const cta = document.querySelector("[data-tasu-mdetail-cta-dock]");
      return {
        noHero: !hero || getComputedStyle(hero).display === "none" || hero.offsetParent === null,
        noCta: !cta || getComputedStyle(cta).display === "none",
        navVisible: Boolean(document.querySelector(".section-nav")?.offsetParent),
      };
    });
    if (!pcTemplateOff.noHero && !pcTemplateOff.noCta) fail("PC: mobile template should be off");
    else pass("PC: mobile template off at 1280px");

    console.log("\n---");
    if (errors.length) {
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exitCode = 1;
    } else {
      console.log("All mobile detail page checks passed.");
    }
  } catch (err) {
    fail(String(err?.message || err));
  }
});
  
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
