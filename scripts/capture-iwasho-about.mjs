#!/usr/bin/env node
/**
 * IWASHO 事業内容ページ 検証
 *   node scripts/capture-iwasho-about.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-about-page");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
  { id: "1440", width: 1440, height: 900 },
  { id: "1500", width: 1500, height: 900 },
];

const FORBIDDEN_TEXT = [
  "ワンストップ",
  "完工後",
  "相談から完工",
  "顧客管理",
  "施工フロー",
];

const REQUIRED_SECTIONS = [
  ".iw-about-hero",
  ".iw-about-intro",
  ".iw-about-stats",
  ".iw-about-services",
  ".iw-about-reasons",
  ".iw-about-cta",
  ".footer-wrapper",
];

const base = await findDevServerBaseUrl({ probePath: "iwasho/about.html" });
fs.mkdirSync(OUT, { recursive: true });

const results = [];

await withPlaywrightBrowser(async (browser) => {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    try {
      await page.goto(`${base}/iwasho/about.html`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(500);

      const shotTop = path.join(OUT, `about-${vp.id}-top.png`);
      await page.screenshot({ path: shotTop, fullPage: false });

      await page.evaluate(() => {
        const hero = document.querySelector(".iw-about-hero__visual");
        if (hero) hero.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(300);

      const shotHero = path.join(OUT, `about-${vp.id}-hero.png`);
      const heroEl = page.locator(".iw-about-hero__visual");
      if (await heroEl.count()) {
        await heroEl.screenshot({ path: shotHero });
      }

      await page.evaluate(() => {
        const reasons = document.querySelector(".iw-about-reasons__grid");
        if (reasons) reasons.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(300);

      const shotReasons = path.join(OUT, `about-${vp.id}-reasons.png`);
      const reasonsEl = page.locator(".iw-about-reasons__grid");
      if (await reasonsEl.count()) {
        await reasonsEl.screenshot({ path: shotReasons });
      }

      await page.evaluate(() => {
        const services = document.querySelector(".iw-about-services__grid");
        if (services) services.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(300);

      const shotServices = path.join(OUT, `about-${vp.id}-services.png`);
      const servicesEl = page.locator(".iw-about-services__grid");
      if (await servicesEl.count()) {
        await servicesEl.screenshot({ path: shotServices });
      }

      await page.evaluate(() => {
        const intro = document.querySelector(".business-grid");
        if (intro) intro.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(300);

      const shotIntro = path.join(OUT, `about-${vp.id}-intro.png`);
      const introEl = page.locator(".business-grid");
      if (await introEl.count()) {
        await introEl.screenshot({ path: shotIntro });
      }

      await page.evaluate(() => {
        const cta = document.querySelector(".iw-about-cta__card");
        if (cta) cta.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(300);

      const shotCta = path.join(OUT, `about-${vp.id}-cta.png`);
      const ctaEl = page.locator(".iw-about-cta");
      if (await ctaEl.count()) {
        await ctaEl.screenshot({ path: shotCta });
      }

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);

      const shotFull = path.join(OUT, `about-${vp.id}-full.png`);
      await page.screenshot({ path: shotFull, fullPage: true });

      const audit = await page.evaluate(({ forbidden, required }) => {
        const doc = document.documentElement;
        const bodyText = document.body.innerText;
        const forbiddenFound = forbidden.filter((t) => bodyText.includes(t));
        const sections = Object.fromEntries(
          required.map((sel) => [sel, !!document.querySelector(sel)])
        );
        const statCards = document.querySelectorAll(".iw-about-stat-card").length;
        const serviceCards = document.querySelectorAll(".iw-about-service-card").length;
        const reasonCards = document.querySelectorAll(".iw-about-reason-card").length;
        const heroPhotos = document.querySelectorAll(".iw-about-hero__photo").length;
        const heroSrcs = [...document.querySelectorAll(".iw-about-hero__photo img")].map((img) => img.getAttribute("src"));
        const WIX_IWASHO_IMG = "https://static.wixstatic.com/media/a911fb_b8690672fdee41498f46e179d7a6ae3d~mv2.png";
        const WIX_TASFUL_IMG = "https://static.wixstatic.com/media/a911fb_7c6461a94587487c84e4aefae8c5e3b1~mv2.png";
        const bgUrl = (el) => {
          if (!el) return null;
          const bg = getComputedStyle(el).backgroundImage;
          const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
          return m ? m[1] : null;
        };
        const bizImgSrcs = {
          iwasho: bgUrl(document.querySelector(".iwasho-img")),
          tasful: bgUrl(document.querySelector(".tasful-img")),
        };
        const bizCards = {
          iwasho: !!document.querySelector(".card-iwasho"),
          tasful: !!document.querySelector(".card-tasful"),
        };
        const serviceImgSrcs = [...document.querySelectorAll(".iw-about-service-card__image img")].map((img) => img.getAttribute("src"));
        const activeNav = document.querySelector('.iw-site-header__nav a.is-active')?.textContent?.trim();
        const ctaTitle = document.querySelector(".iw-about-cta__title")?.textContent?.trim();
        const ctaLead = document.querySelector(".iw-about-cta__lead")?.textContent?.trim();
        const ctaBtnText = document.querySelector(".iw-about-cta__btn span")?.textContent?.trim();
        const ctaImgSrc = document.querySelector(".iw-about-cta__visual img")?.getAttribute("src") ?? null;
        const ctaCard = document.querySelector(".iw-about-cta__card");
        const ctaSectionBg = document.querySelector(".iw-about-cta");

        const reasonImgSrcs = [...document.querySelectorAll(".iw-about-reason-card__thumb img")].map((img) => img.getAttribute("src"));
        const servicesGridStyle = document.querySelector(".iw-about-services__grid");
        const reasonCardGrid = document.querySelector(".iw-about-reason-card");
        const reasonCardStyle = reasonCardGrid;
        const reasonCardRect = reasonCardStyle?.getBoundingClientRect();
        const reasonThumbStyle = document.querySelector(".iw-about-reason-card__thumb");
        const reasonTitleStyle = document.querySelector(".iw-about-reason-card__title");
        const reasonDescStyle = document.querySelector(".iw-about-reason-card__desc");
        const reasonsContainerStyle = document.querySelector(".iw-about-reasons .iw-about-container");
        const pageContainer = document.querySelector(".iw-about-hero .iw-about-container");

        return {
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
          forbiddenFound,
          sections,
          statCards,
          serviceCards,
          reasonCards,
          heroPhotos,
          heroSrcs,
          bizImgSrcs,
          bizCards,
          reasonImgSrcs,
          serviceImgSrcs,
          servicesGridColumns: servicesGridStyle ? getComputedStyle(servicesGridStyle).gridTemplateColumns : null,
          reasonCardColumns: reasonCardGrid ? getComputedStyle(reasonCardGrid).gridTemplateColumns : null,
          containerWidth: pageContainer ? Math.round(pageContainer.getBoundingClientRect().width) : 0,
          containerMaxWidth: pageContainer ? getComputedStyle(pageContainer).maxWidth : null,
          activeNav,
          ctaTitle,
          ctaLead,
          ctaBtnText,
          ctaImgSrc,
          ctaMetrics: ctaCard ? {
            hasCard: true,
            gridColumns: getComputedStyle(ctaCard).gridTemplateColumns,
            sectionBg: ctaSectionBg ? getComputedStyle(ctaSectionBg).backgroundColor : null,
            borderRadius: getComputedStyle(ctaCard).borderRadius,
            cardWidth: Math.round(ctaCard.getBoundingClientRect().width),
            cardHeight: Math.round(ctaCard.getBoundingClientRect().height),
          } : null,
          hasFooter: !!document.querySelector(".footer-wrapper .footer-inner"),
          reasonMetrics: reasonCardStyle ? {
            cardHeight: Math.round(reasonCardRect?.height ?? 0),
            cardWidth: Math.round(reasonCardRect?.width ?? 0),
            flexDirection: getComputedStyle(reasonCardStyle).flexDirection,
            gridColumns: getComputedStyle(document.querySelector(".iw-about-reasons__grid")).gridTemplateColumns,
            reasonCardsInRow: [...document.querySelectorAll(".iw-about-reason-card")].filter((card) => {
              const r = card.getBoundingClientRect();
              const first = document.querySelector(".iw-about-reason-card")?.getBoundingClientRect();
              return first ? Math.abs(r.top - first.top) < 8 : false;
            }).length,
            thumbWidth: reasonThumbStyle ? Math.round(reasonThumbStyle.getBoundingClientRect().width) : 0,
            thumbRatio: reasonThumbStyle && reasonCardRect?.width
              ? Math.round((reasonThumbStyle.getBoundingClientRect().width / reasonCardRect.width) * 100)
              : 0,
            padding: getComputedStyle(reasonCardStyle).padding,
            gap: getComputedStyle(document.querySelector(".iw-about-reasons__grid")).gap,
            borderRadius: getComputedStyle(reasonCardStyle).borderRadius,
            thumbSize: reasonThumbStyle ? getComputedStyle(reasonThumbStyle).width : null,
            titleSize: reasonTitleStyle ? getComputedStyle(reasonTitleStyle).fontSize : null,
            titleWeight: reasonTitleStyle ? getComputedStyle(reasonTitleStyle).fontWeight : null,
            descSize: reasonDescStyle ? getComputedStyle(reasonDescStyle).fontSize : null,
            descLineHeight: reasonDescStyle ? getComputedStyle(reasonDescStyle).lineHeight : null,
            containerMaxWidth: reasonsContainerStyle ? getComputedStyle(reasonsContainerStyle).maxWidth : null,
          } : null,
        };
      }, { forbidden: FORBIDDEN_TEXT, required: REQUIRED_SECTIONS });

      results.push({
        viewport: vp.id,
        consoleErrors,
        audit,
        screenshots: {
          top: path.relative(ROOT, shotTop).replace(/\\/g, "/"),
          hero: path.relative(ROOT, shotHero).replace(/\\/g, "/"),
          services: path.relative(ROOT, shotServices).replace(/\\/g, "/"),
          reasons: path.relative(ROOT, shotReasons).replace(/\\/g, "/"),
          intro: path.relative(ROOT, shotIntro).replace(/\\/g, "/"),
          cta: path.relative(ROOT, shotCta).replace(/\\/g, "/"),
          full: path.relative(ROOT, shotFull).replace(/\\/g, "/"),
        },
      });
    } finally {
      await page.close().catch(() => null);
      await ctx.close().catch(() => null);
    }
  }
});

await closeAllBrowsers();

const report = { base, results, pass: true, issues: [] };
for (const r of results) {
  if (r.audit.overflowX) {
    report.pass = false;
    report.issues.push(`${r.viewport}: horizontal overflow`);
  }
  if (r.consoleErrors.length) {
    report.pass = false;
    report.issues.push(`${r.viewport}: console errors — ${r.consoleErrors.join("; ")}`);
  }
  if (r.audit.forbiddenFound.length) {
    report.pass = false;
    report.issues.push(`${r.viewport}: forbidden text — ${r.audit.forbiddenFound.join(", ")}`);
  }
  for (const [sel, ok] of Object.entries(r.audit.sections)) {
    if (!ok) {
      report.pass = false;
      report.issues.push(`${r.viewport}: missing ${sel}`);
    }
  }
  if (r.audit.statCards !== 3) {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 3 stat cards, got ${r.audit.statCards}`);
  }
  if (r.audit.serviceCards !== 6) {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 6 service cards, got ${r.audit.serviceCards}`);
  }
  if (r.audit.reasonCards !== 3) {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 3 reason cards, got ${r.audit.reasonCards}`);
  }
  if (r.audit.heroPhotos !== 3) {
    report.pass = false;
    report.issues.push(`${r.viewport}: expected 3 hero photos, got ${r.audit.heroPhotos}`);
  }
  if (!r.audit.bizCards?.iwasho || !r.audit.bizCards?.tasful) {
    report.pass = false;
    report.issues.push(`${r.viewport}: missing Wix business cards`);
  }
  const WIX_IWASHO_IMG = "https://static.wixstatic.com/media/a911fb_b8690672fdee41498f46e179d7a6ae3d~mv2.png";
  const WIX_TASFUL_IMG = "https://static.wixstatic.com/media/a911fb_7c6461a94587487c84e4aefae8c5e3b1~mv2.png";
  if (r.audit.bizImgSrcs?.iwasho !== WIX_IWASHO_IMG) {
    report.pass = false;
    report.issues.push(`${r.viewport}: IWASHO card background image mismatch`);
  }
  if (r.audit.bizImgSrcs?.tasful !== WIX_TASFUL_IMG) {
    report.pass = false;
    report.issues.push(`${r.viewport}: TASFUL card background image mismatch`);
  }
  const expectedServiceSrcs = [
    "/iwasho/images/about/service-arch.png",
    "/iwasho/images/about/service-equip.png",
    "/iwasho/images/about/service-electric.png",
    "/iwasho/images/about/service-maint.png",
    "/iwasho/images/categories/thumb-exterior.png",
  ];
  if (JSON.stringify(r.audit.serviceImgSrcs) !== JSON.stringify(expectedServiceSrcs)) {
    report.pass = false;
    report.issues.push(`${r.viewport}: service image src mismatch — ${JSON.stringify(r.audit.serviceImgSrcs)}`);
  }
  const expectedReasonSrcs = [
    "/iwasho/images/about/reason-01.png",
    "/iwasho/images/about/reason-02.png",
    "/iwasho/images/about/reason-03.png",
  ];
  if (JSON.stringify(r.audit.reasonImgSrcs) !== JSON.stringify(expectedReasonSrcs)) {
    report.pass = false;
    report.issues.push(`${r.viewport}: reason image src mismatch — ${JSON.stringify(r.audit.reasonImgSrcs)}`);
  }
  if (r.viewport === "1280" || r.viewport === "1440" || r.viewport === "1500") {
    const svcCols = r.audit.servicesGridColumns || "";
    if (!svcCols.includes("px") || svcCols.split(" ").length !== 3) {
      report.pass = false;
      report.issues.push(`${r.viewport}: services should be 3-column grid`);
    }
    if (r.audit.reasonMetrics?.thumbRatio < 44 || r.audit.reasonMetrics?.thumbRatio > 52) {
      report.pass = false;
      report.issues.push(`${r.viewport}: reason thumb ratio should be ~48%, got ${r.audit.reasonMetrics?.thumbRatio}%`);
    }
  }
  if ((r.viewport === "1280" || r.viewport === "1440" || r.viewport === "1500") && r.audit.reasonMetrics) {
    if (r.audit.reasonMetrics.flexDirection !== "row") {
      report.pass = false;
      report.issues.push(`${r.viewport}: reason cards should be row layout`);
    }
    if (r.audit.reasonMetrics.reasonCardsInRow !== 3) {
      report.pass = false;
      report.issues.push(`${r.viewport}: expected 3 reason cards in one row, got ${r.audit.reasonMetrics.reasonCardsInRow}`);
    }
    if (r.audit.reasonMetrics.cardHeight > 240) {
      report.pass = false;
      report.issues.push(`${r.viewport}: reason card too tall (${r.audit.reasonMetrics.cardHeight}px)`);
    }
  }
  if (r.viewport === "1500") {
    if (r.audit.containerMaxWidth !== "1500px") {
      report.pass = false;
      report.issues.push(`${r.viewport}: container max-width should be 1500px, got ${r.audit.containerMaxWidth}`);
    }
    if (r.audit.containerWidth < 1480) {
      report.pass = false;
      report.issues.push(`${r.viewport}: container too narrow (${r.audit.containerWidth}px)`);
    }
    if (r.audit.ctaMetrics?.cardWidth < 1420) {
      report.pass = false;
      report.issues.push(`${r.viewport}: CTA card should span wide container (${r.audit.ctaMetrics?.cardWidth}px)`);
    }
  }
  if (r.viewport === "1440") {
    if (r.audit.containerMaxWidth !== "1500px") {
      report.pass = false;
      report.issues.push(`${r.viewport}: container max-width should be 1500px, got ${r.audit.containerMaxWidth}`);
    }
  }
  const expectedSrcs = [
    "/iwasho/images/about/hero-shinchiku.png",
    "/iwasho/images/about/hero-chuko.png",
    "/iwasho/images/about/hero-reform.png",
  ];
  if (JSON.stringify(r.audit.heroSrcs) !== JSON.stringify(expectedSrcs)) {
    report.pass = false;
    report.issues.push(`${r.viewport}: hero image src mismatch — ${JSON.stringify(r.audit.heroSrcs)}`);
  }
  if (r.audit.activeNav !== "事業内容") {
    report.pass = false;
    report.issues.push(`${r.viewport}: nav active should be 事業内容, got ${r.audit.activeNav}`);
  }
  if (r.audit.ctaTitle !== "現場の課題解決を全力でサポートします") {
    report.pass = false;
    report.issues.push(`${r.viewport}: CTA title mismatch`);
  }
  if (r.audit.ctaLead !== "案件のご相談やパートナー登録について、まずはお気軽にお問い合わせください。") {
    report.pass = false;
    report.issues.push(`${r.viewport}: CTA lead mismatch`);
  }
  if (r.audit.ctaBtnText !== "お問い合わせはこちら") {
    report.pass = false;
    report.issues.push(`${r.viewport}: CTA button text mismatch`);
  }
  if (r.audit.ctaImgSrc !== "/iwasho/images/about/cta-interior.png") {
    report.pass = false;
    report.issues.push(`${r.viewport}: CTA image src mismatch`);
  }
  if (!r.audit.ctaMetrics?.hasCard) {
    report.pass = false;
    report.issues.push(`${r.viewport}: CTA card missing`);
  }
  if ((r.viewport === "1280" || r.viewport === "1440" || r.viewport === "1500") && r.audit.ctaMetrics) {
    const cols = r.audit.ctaMetrics.gridColumns || "";
    if (!cols.includes("px") || cols.split(" ").length < 3) {
      report.pass = false;
      report.issues.push(`${r.viewport}: CTA should be 3-column horizontal card`);
    }
    if (r.audit.ctaMetrics.sectionBg !== "rgb(255, 255, 255)") {
      report.pass = false;
      report.issues.push(`${r.viewport}: CTA section should have white background`);
    }
  }
}

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
