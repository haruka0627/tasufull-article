#!/usr/bin/env node
/**
 * QA AI icon — 8788 表示・404・Console 検証
 */
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const BASE = "http://127.0.0.1:8788";
const viewports = [
  { tag: "1280", w: 1280, h: 900 },
  { tag: "768", w: 768, h: 900 },
  { tag: "390", w: 390, h: 844 },
];

await withPlaywrightBrowser(async (browser) => {
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const errors = [];
    const notFound = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !/favicon/i.test(m.text())) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    page.on("response", (res) => {
      if (res.status() === 404 && /127\.0\.0\.1:8788/.test(res.url())) {
        notFound.push(res.url());
      }
    });

    await page.goto(buildLocalPageUrl(BASE, "help/"), { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector(".platform-qa-ai-icon", { timeout: 15000 });

    const hub = await page.evaluate(() => ({
      ctaIcon: Boolean(document.querySelector(".platform-qa-hub-ai-cta__icon .platform-qa-ai-icon")),
      aiCategory: Boolean(
        document.querySelector('[data-help-categories] [data-help-category="ai"] .platform-qa-ai-icon'),
      ),
      src: document.querySelector(".platform-qa-ai-icon")?.getAttribute("src") || "",
      scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    }));

    await page.click('[data-help-category="ai"]');
    await page.waitForTimeout(300);
    const listIcon = await page.evaluate(() =>
      Boolean(document.querySelector("[data-help-list] .platform-qa-ai-icon")),
    );

    await page.goto(buildLocalPageUrl(BASE, "help/signup/"), { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector("[data-help-article-root] .platform-qa-ai-icon", { timeout: 15000 });
    const detail = await page.evaluate(() => {
      const brandImg = document.querySelector(".ai-site-qa-layout__brand-icon .platform-qa-ai-icon");
      const brandBox = brandImg?.getBoundingClientRect();
      const header = document.querySelector(".ai-site-qa-layout__header");
      const headerBox = header?.getBoundingClientRect();
      return {
        brandIcon: Boolean(brandImg),
        brandW: brandBox?.width || 0,
        headerPad: header ? getComputedStyle(header).padding : "",
        emoji: document.body.innerHTML.includes("🤖"),
      };
    });

    await page.goto(buildLocalPageUrl(BASE, "ai-workspace.html"), { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForFunction(() => window.PlatformQaArticle?.buildResultHtml, null, { timeout: 30000 });
    const ws = await page.evaluate(() => {
      const html = window.PlatformQaArticle.buildResultHtml(
        window.PlatformQaData.getBySlug("signup"),
        { includeHeader: true },
      );
      const wrap = document.createElement("div");
      wrap.innerHTML = html;
      return {
        hasIcon: Boolean(wrap.querySelector(".platform-qa-ai-icon")),
        emoji: html.includes("🤖"),
      };
    });

    const iconResp = await page.goto(buildLocalPageUrl(BASE, "images/help/tasful-ai-icon.png"), {
      waitUntil: "domcontentloaded",
    });

    console.log(
      `[${vp.tag}] HTTP help OK · CTA=${hub.ctaIcon} · list=${listIcon} · detail brand=${detail.brandIcon}(${Math.round(detail.brandW)}px) · ws=${ws.hasIcon} · icon404=${iconResp?.status()} · errors=${errors.length} · 404s=${notFound.length} · scroll=${hub.scroll}`,
    );
    if (detail.emoji || ws.emoji) console.log(`  WARN: robot emoji still present`);
    if (notFound.length) notFound.slice(0, 3).forEach((u) => console.log(`  404: ${u}`));
    if (errors.length) errors.slice(0, 3).forEach((e) => console.log(`  err: ${e.slice(0, 100)}`));

    await page.close();
  }
});
