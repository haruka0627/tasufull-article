/**
 * スキル / 商品 / 店舗 — 相談CTA → chat-list 遷移の検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { BASE_URL, requireDevServer } from "./lib/dev-base-url.mjs";

const OUT_DIR = "screenshots/detail-contact-cta-routing";

const CASES = [
  {
    id: "skill",
    detailUrl: `${BASE_URL}/detail-skill.html?id=demo-skill-001`,
    ctaSelector: ".cta-consult",
    expectThreadType: "skill",
  },
  {
    id: "product",
    detailUrl: `${BASE_URL}/detail-product.html?id=demo-product-001`,
    ctaSelector: "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--secondary",
    expectThreadType: "product",
  },
  {
    id: "shop",
    detailUrl: `${BASE_URL}/detail-shop.html?id=demo-shop-reworks`,
    ctaSelector: "[data-shop-mobile-inquiry-dock] .shop-mobile-inquiry-dock__btn",
    expectThreadType: "shop-store",
  },
  {
    id: "shop-product",
    detailUrl: `${BASE_URL}/detail-shop-product.html?shopId=demo-shop-haru-cafe&productId=demo-restaurant-0`,
    ctaSelector: "[data-shop-product-inquiry]",
    expectThreadType: "shop-store",
  },
];

async function waitForListing(page) {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.querySelector("[data-shop-product-layout]:not([hidden])") ||
      document.querySelector(".skill-cta-panel__primary"),
    { timeout: 45000 }
  );
  await page.waitForTimeout(800);
}

async function runCase(browser, spec) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const result = {
    id: spec.id,
    detailUrl: spec.detailUrl,
    ok: false,
    errors: [],
    chatUrl: "",
    threadId: "",
    threadListingType: "",
  };

  try {
    await page.goto(spec.detailUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForListing(page);

    const preflight = await page.evaluate(() => ({
      hasContactActions: Boolean(window.TasuContactActions),
      hasThreadStore: Boolean(window.TasuChatThreadStore),
      ctaBound: Boolean(
        document.querySelector("[data-tasu-contact-cta], [data-biz-detail-inquiry][data-tasu-contact-bound]")
      ),
    }));
    if (!preflight.hasContactActions) result.errors.push("TasuContactActions missing");
    if (!preflight.hasThreadStore) result.errors.push("TasuChatThreadStore missing");

    const cta = page.locator(spec.ctaSelector).first();
    await cta.waitFor({ state: "visible", timeout: 20000 });
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const detailShot = path.join(OUT_DIR, `${spec.id}-detail-390.png`);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: detailShot, fullPage: false });

    await Promise.all([
      page.waitForURL(/platform-chat-fee-pay\.html|chat-list\.html/, { timeout: 15000 }),
      cta.click(),
    ]);

    result.chatUrl = page.url();
    if (result.chatUrl.includes("platform-chat-fee-pay.html")) {
      page.on("dialog", async (dialog) => {
        await dialog.accept();
      });
      await page.click("[data-platform-fee-pay]");
      await page.waitForSelector("[data-platform-fee-complete]:not([hidden])", { timeout: 15000 });
      await page.click("[data-platform-fee-chat-link]");
      await page.waitForURL(/chat-(detail|list)\.html/, { timeout: 15000 });
      result.chatUrl = page.url();
    }
    const threadParam = new URL(page.url()).searchParams.get("thread");
    result.threadId = threadParam || "";

    const threadMeta = await page.evaluate((threadId) => {
      let listingType = "";
      let listingId = "";
      try {
        const raw = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
        const row = Array.isArray(raw) ? raw.find((t) => String(t.id) === String(threadId)) : null;
        if (row) {
          listingType = row.listingType || "";
          listingId = row.listingId || "";
        }
      } catch {
        /* ignore */
      }
      return { listingType, listingId };
    }, result.threadId);

    result.threadListingType = threadMeta.listingType;

    if (
      !result.chatUrl.includes("talk-home.html") &&
      !result.chatUrl.includes("chat-detail.html")
    ) {
      result.errors.push(`unexpected url: ${result.chatUrl}`);
    }
    if (!result.threadId) {
      result.errors.push("thread query param missing");
    }
    if (spec.expectThreadType && threadMeta.listingType !== spec.expectThreadType) {
      result.errors.push(
        `listingType expected ${spec.expectThreadType}, got ${threadMeta.listingType || "(empty)"}`
      );
    }

    const chatShot = path.join(OUT_DIR, `${spec.id}-chat-list-390.png`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: chatShot, fullPage: false });

    result.ok = result.errors.length === 0;
  } catch (err) {
    result.errors.push(String(err?.message || err));
  } finally {
    await context.close();
  }

  return result;
}

async function verifyRegression(browser) {
  const checks = [];
  const pages = [
    { id: "job", url: `${BASE_URL}/detail-job.html?id=demo-job-001`, mustHave: "TasuJobApplicationsStore" },
    { id: "worker", url: `${BASE_URL}/detail-worker.html?id=demo-worker-001`, mustHave: "TasuWorkerRequestsStore" },
    {
      id: "business",
      url: `${BASE_URL}/detail-business-service.html?id=demo-business-service-001`,
      mustHave: "TasuBusinessServiceFlow",
    },
  ];

  for (const p of pages) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(3000);
      const has = await page.evaluate((key) => Boolean(window[key]), p.mustHave);
      checks.push({ id: p.id, ok: has, mustHave: p.mustHave });
    } catch (err) {
      checks.push({ id: p.id, ok: false, error: String(err?.message || err) });
    } finally {
      await context.close();
    }
  }
  return checks;
}

await requireDevServer();
let results = [];
await withPlaywrightBrowser(async (browser) => {
for (const spec of CASES) {
  const r = await runCase(browser, spec);
  results.push(r);
  const mark = r.ok ? "OK" : "NG";
  console.log(`[${mark}] ${spec.id}`);
  console.log(`  detail: ${r.detailUrl}`);
  console.log(`  chat:   ${r.chatUrl || "(none)"}`);
  if (r.threadId) console.log(`  thread: ${r.threadId} (${r.threadListingType})`);
  if (r.errors.length) r.errors.forEach((e) => console.log(`  - ${e}`));
}

console.log("\n[regression] job / worker / business-service");
const regression = await verifyRegression(browser);
regression.forEach((r) => {
  console.log(`  ${r.ok ? "OK" : "NG"} ${r.id}${r.error ? ` — ${r.error}` : ""}`);
});

});

const allOk =
  results.every((r) => r.ok) && regression.every((r) => r.ok);
console.log(`\n${allOk ? "ALL OK" : "SOME FAILED"} (${results.filter((r) => r.ok).length}/${results.length} CTA routes)`);
await closeAllBrowsers();
process.exit(allOk ? 0 : 1);
