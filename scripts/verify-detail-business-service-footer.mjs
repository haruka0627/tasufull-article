/**
 * 業務サービス詳細 — PC/SP フッター検証
 * node scripts/verify-detail-business-service-footer.mjs [baseUrl]
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = process.argv[2] || "http://127.0.0.1:8765";
const URL = `${BASE}/detail-business-service.html?id=demo-business-service-001`;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const browser = await chromium.launch();
const errors = [];

async function runViewport(width, label) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${label} console: ${m.text()}`);
  });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(3000);

  if (width <= 960) {
    await page.waitForFunction(
      () =>
        document.body.classList.contains("tasu-mdetail-ready") &&
        !!document.querySelector(".tasu-mdetail-site-footer .bsd-footer__copy"),
      { timeout: 15000 }
    );
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);

    const sp = await page.evaluate(() => {
      const cta = document.querySelector("[data-tasu-mdetail-cta-dock]");
      const ctaTop = cta ? cta.getBoundingClientRect().top : null;
      const brand = document.querySelector(".tasu-mdetail-site-footer .bsd-footer__brand");
      const tagline = document.querySelector(".tasu-mdetail-site-footer .bsd-footer__tagline");
      const copy = document.querySelector(".tasu-mdetail-site-footer .bsd-footer__copy");
      const footerSlot = document.querySelector("[data-tasu-mdetail-site-footer]");
      const bodyPb = getComputedStyle(document.body).paddingBottom;
      const slotPb = footerSlot ? getComputedStyle(footerSlot).paddingBottom : "";
      const lines = [brand, tagline, copy].map((el) => {
        if (!el) return { ok: false, reason: "missing" };
        const r = el.getBoundingClientRect();
        return {
          ok: ctaTop != null && r.bottom <= ctaTop - 4 && r.height > 0,
          bottom: r.bottom,
          height: r.height,
          text: el.textContent?.trim().slice(0, 40),
        };
      });
      return {
        ctaTop,
        bodyPb,
        slotPb,
        usesMobileHtml: !!document.querySelector(".tasu-mdetail-mobile-footer"),
        lines,
        allOk: lines.every((l) => l.ok),
      };
    });

    console.log(`${label} (${width}px):`, JSON.stringify(sp, null, 2));
    if (!sp.usesMobileHtml) fail(`${label}: スマホ専用フッターHTMLがありません`);
    if (!sp.allOk) fail(`${label}: ロゴ/サブコピー/copyright が CTA より上に完全表示されていません`);
    if (parseFloat(sp.bodyPb) > 20) fail(`${label}: body padding-bottom が大きすぎます (${sp.bodyPb})`);
  } else {
    const pc = await page.evaluate(() => {
      const footer = document.querySelector(
        ".bsd-page .bsd-footer.fs-site-footer, [data-fs-site-footer].bsd-footer"
      );
      if (!footer) return { ok: false, reason: "no pc footer" };
      const logo = footer.querySelector(".bsd-footer__logo");
      const tagline = footer.querySelector(".bsd-footer__tagline");
      const copy = footer.querySelector(".bsd-footer__copy");
      const pageEl = document.querySelector(".bsd-page.business-service-page");
      const footerRect = footer.getBoundingClientRect();
      const docH = document.documentElement.scrollHeight;
      const gapBelowFooter = docH - (footer.offsetTop + footer.offsetHeight);
      const pagePb = pageEl ? getComputedStyle(pageEl).paddingBottom : "";
      return {
        logoPx: logo ? getComputedStyle(logo).fontSize : null,
        taglinePx: tagline ? getComputedStyle(tagline).fontSize : null,
        copyPx: copy ? getComputedStyle(copy).fontSize : null,
        gapBelowFooter,
        pagePb,
        footerBottom: footerRect.bottom,
        mdetailReady: document.body.classList.contains("tasu-mdetail-ready"),
        bodyPb: getComputedStyle(document.body).paddingBottom,
      };
    });

    console.log(`${label} (${width}px):`, JSON.stringify(pc, null, 2));
    if (pc.mdetailReady) fail(`${label}: PCで tasu-mdetail-ready が付いています`);
    if (pc.gapBelowFooter > 80) fail(`${label}: フッター下余白が80px超 (${pc.gapBelowFooter}px)`);
    const logoN = parseFloat(pc.logoPx);
    const tagN = parseFloat(pc.taglinePx);
    const copyN = parseFloat(pc.copyPx);
    if (logoN < 14 || logoN > 16) fail(`${label}: ロゴフォント ${pc.logoPx} (14-16px)`);
    if (tagN < 12 || tagN > 13) fail(`${label}: サブコピー ${pc.taglinePx} (12-13px)`);
    if (copyN < 11 || copyN > 12) fail(`${label}: copyright ${pc.copyPx} (11-12px)`);
  }

  await page.close();
}

await runViewport(390, "SP");
await runViewport(1280, "PC");
await browser.close();

const globalErr = errors.filter((e) => e.includes("global is not defined"));
if (globalErr.length) fail(globalErr.join("; "));
if (errors.length) {
  console.warn("console errors:", errors.slice(0, 5));
}

console.log("OK: detail-business-service footer checks passed");
