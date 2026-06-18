#!/usr/bin/env node
/**
 * 一般カテゴリ詳細（skill / worker / product）デモ表示 E2E
 *
 *   BASE_URL=http://127.0.0.1:5173 node scripts/test-detail-premium-demo-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");

const CASES = [
  {
    label: "skill",
    url: "detail-skill.html?userId=u_sachi&id=demo_skill_001",
    titleFragment: "動画編集",
  },
  {
    label: "worker",
    url: "detail-worker.html?userId=u_worker&id=demo_worker_001",
    titleFragment: "動画編集者",
  },
  {
    label: "product",
    url: "detail-product.html?userId=u_product&id=demo_product_001",
    titleFragment: "プレミアム家電",
  },
];

/** @type {{ step: string; ok: boolean; detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

async function inspect(page, spec, vp) {
  const prefix = `${vp}/${spec.label}`;
  const data = await page.evaluate(() => ({
    loaded: document.body.dataset.listingLoaded,
    status: document.querySelector("[data-listing-detail-status]")?.textContent?.trim() || "",
    title:
      document.querySelector("[data-listing-title]")?.textContent?.trim() ||
      document.querySelector("[data-listing-service-name]")?.textContent?.trim() ||
      document.querySelector(".skill-hero-premium__title")?.textContent?.trim() ||
      "",
    price:
      document.querySelector("[data-listing-price]")?.textContent?.trim() ||
      document.querySelector(".skill-hero-premium__price")?.textContent?.trim() ||
      document.querySelector(".skill-hero-premium__price-value")?.textContent?.trim() ||
      document.body.textContent.match(/¥[\d,]+/)?.[0] ||
      "",
    lead:
      document.querySelector("[data-listing-lead]")?.textContent?.trim() ||
      document.querySelector("[data-listing-description]")?.textContent?.trim() ||
      "",
    hasImg: Boolean(
      document.querySelector(
        ".skill-hero-premium img, [data-listing-hero-image] img, .detail-product-hero img, .skill-hero-section img"
      )?.getAttribute("src")
    ),
    seller:
      document.querySelector("[data-listing-seller]")?.textContent?.trim() ||
      document.querySelector("[data-seller-display-name]")?.textContent?.trim() ||
      "",
    tabs: Array.from(
      document.querySelectorAll(
        ".skill-sticky-nav__tab, [data-skill-sticky-nav], [data-detail-sticky-nav] a, .shop-sticky-action-nav__tab"
      )
    ).map((el) => el.textContent?.trim()).filter(Boolean),
    cta: Array.from(
      document.querySelectorAll(
        ".skill-hero-premium__cta a, .skill-hero-premium__cta button, [data-listing-cta-primary], .biz-detail-btn"
      )
    ).map((el) => el.textContent?.trim()).filter(Boolean),
    reviews: Boolean(
      (document.getElementById("section-reviews") &&
        !document.getElementById("section-reviews").hidden &&
        document.getElementById("section-reviews").getBoundingClientRect().height > 8) ||
        document.querySelector("[data-listing-reviews], .skill-review, #reviews-root")?.textContent?.trim()
    ),
    notFound: /見つかりません/.test(
      document.querySelector("[data-listing-detail-status]")?.textContent || ""
    ),
  }));

  if (data.loaded === "true" && !data.notFound) pass(`${prefix}: 詳細表示`);
  else fail(`${prefix}: 詳細表示`, `loaded=${data.loaded} status=${data.status.slice(0, 40)}`);

  if (data.title.includes(spec.titleFragment)) pass(`${prefix}: タイトル`, data.title);
  else fail(`${prefix}: タイトル`, data.title);

  if (data.hasImg) pass(`${prefix}: 画像`);
  else fail(`${prefix}: 画像`);

  if (data.price && data.price !== "—") pass(`${prefix}: 価格`, data.price);
  else fail(`${prefix}: 価格`, data.price || "(empty)");

  if (data.lead.length > 8) pass(`${prefix}: 説明`);
  else fail(`${prefix}: 説明`, data.lead.slice(0, 40));

  if (data.seller.length > 1 || data.tabs.length > 0) pass(`${prefix}: 出品者/タブ`);
  else fail(`${prefix}: 出品者/タブ`, `seller=${data.seller} tabs=${data.tabs.join(",")}`);

  if (data.cta.length > 0) pass(`${prefix}: CTA`, data.cta.slice(0, 2).join(" / "));
  else fail(`${prefix}: CTA`);

  if (data.reviews) pass(`${prefix}: 口コミ`);
  else fail(`${prefix}: 口コミ`);
}

async function main() {
  console.log(`\n一般カテゴリ詳細デモ E2E — ${BASE}\n`);
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  for (const width of [1280, 390]) {
    const vp = width >= 1000 ? "pc" : "sp";
    await page.setViewportSize({ width, height: 900 });
    for (const spec of CASES) {
      console.log(`\n--- ${spec.label} [${vp}] ---\n`);
      await page.goto(`${BASE}/${spec.url}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () =>
          document.body.dataset.listingLoaded === "true" ||
          /見つかりません/.test(
            document.querySelector("[data-listing-detail-status]")?.textContent || ""
          ),
        { timeout: 20000 }
      );
      await page.waitForTimeout(400);
      await inspect(page, spec, vp);
    }
  }

    });
  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n--- 結果: ${ok}/${total} OK ---\n`);
  await closeAllBrowsers();
  process.exit(ok === total ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
