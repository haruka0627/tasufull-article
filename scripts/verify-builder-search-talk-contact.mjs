#!/usr/bin/env node
/**
 * Builder ワーカー/業者検索 → TASFUL Talk  contact スレッド
 *
 *   node scripts/verify-builder-search-talk-contact.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { BUILDER_QA_VIEWPORTS } from "./lib/playwright-viewport.mjs";

const MVP_KEY = "tasful:builder:mvp:v1";
const CHAT_THREADS_KEY = "tasful_chat_threads";

const base = await findDevServerBaseUrl({ probePath: "builder/find-workers.html" });
const workersUrl = buildLocalPageUrl(base, "builder/find-workers.html");
const partnersUrl = buildLocalPageUrl(base, "builder/partners.html");
const partnerDetailUrl = buildLocalPageUrl(
  base,
  "builder/partner.html?partner_id=demo-partner-001"
);

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

async function resetContactThreads(page) {
  await page.evaluate(
    ({ mvpKey, chatKey }) => {
      const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const threads = { ...(mvp.threads || {}) };
      Object.keys(threads).forEach((id) => {
        const t = threads[id];
        const kind = String(t?.thread_kind || t?.thread_type || "");
        if (kind === "worker_contact" || kind === "vendor_contact") delete threads[id];
      });
      mvp.threads = threads;
      localStorage.setItem(mvpKey, JSON.stringify(mvp));
      const chat = JSON.parse(localStorage.getItem(chatKey) || "[]");
      const filtered = (Array.isArray(chat) ? chat : []).filter((row) => {
        const k = String(row?.threadKind || row?.builderThreadType || "");
        return k !== "worker_contact" && k !== "vendor_contact";
      });
      localStorage.setItem(chatKey, JSON.stringify(filtered));
    },
    { mvpKey: MVP_KEY, chatKey: CHAT_THREADS_KEY }
  );
}

for (const vp of BUILDER_QA_VIEWPORTS.slice(0, 1)) {
  console.log(`\n=== viewport ${vp.width}x${vp.height} ===`);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // ── ワーカー検索: 相談する → Talk ──
    await page.goto(workersUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await resetContactThreads(page);
    await page.locator("[data-builder-fw-search-form]").dispatchEvent("submit");
    await page.locator("[data-builder-fw-results]").waitFor({ state: "visible", timeout: 10000 });

    const workerConsult = page.locator('[data-contact-kind="worker_contact"]').first();
    if ((await workerConsult.count()) >= 1) pass("worker 相談する button visible");
    else fail("worker contact button missing");

    const chatForm = page.locator("[data-builder-mvp-thread-form]");
    if ((await chatForm.count()) === 0) pass("no Builder chat UI on find-workers");
    else fail("Builder chat UI should not appear on find-workers");

    await workerConsult.click();
    await page.waitForURL(/chat-detail/i, { timeout: 15000 });
    if (/chat-detail/i.test(page.url())) pass(`worker navigated to Talk: ${page.url()}`);
    else fail(`worker expected chat-detail, got ${page.url()}`);

    const workerThreadMeta = await page.evaluate(
      ({ mvpKey, chatKey }) => {
        const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
        const contact = Object.values(mvp.threads || {}).find(
          (t) => String(t.thread_kind) === "worker_contact"
        );
        const chat = JSON.parse(localStorage.getItem(chatKey) || "[]");
        const inTalk = contact
          ? chat.some((row) => String(row.id) === String(contact.thread_id))
          : false;
        return { threadId: contact?.thread_id || null, inTalk };
      },
      { mvpKey: MVP_KEY, chatKey: CHAT_THREADS_KEY }
    );
    if (workerThreadMeta.threadId) pass(`worker_contact threadId: ${workerThreadMeta.threadId}`);
    else fail("worker_contact thread not saved");
    if (workerThreadMeta.inTalk) pass("worker thread synced to Talk store");
    else fail("worker thread missing from Talk store");

    // ── 業者検索: 再利用 ──
    await page.goto(partnersUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.locator("[data-builder-partner-search-form]").dispatchEvent("submit");
    await page.waitForTimeout(500);

    const vendorTalk = page.locator('[data-contact-kind="vendor_contact"]').first();
    if ((await vendorTalk.count()) >= 1) pass("vendor Talkで相談 button visible");
    else fail("vendor contact button missing");

    await vendorTalk.click();
    await page.waitForURL(/chat-detail/i, { timeout: 15000 });
    if (/chat-detail/i.test(page.url())) pass(`vendor navigated to Talk: ${page.url()}`);
    else fail(`vendor expected chat-detail, got ${page.url()}`);

    // ── プロフィール詳細 ──
    await page.goto(partnerDetailUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    const detailTalk = page.locator('[data-builder-talk-contact][data-contact-kind="vendor_contact"]').first();
    if ((await detailTalk.count()) >= 1) pass("partner detail Talk button visible");
    else fail("partner detail Talk button missing");

    await detailTalk.click();
    await page.waitForURL(/chat-detail/i, { timeout: 15000 });

    const reuseMeta = await page.evaluate(
      ({ mvpKey }) => {
        const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
        const vendorThreads = Object.values(mvp.threads || {}).filter(
          (t) => String(t.thread_kind) === "vendor_contact" && String(t.contact_target_id) === "demo-partner-001"
        );
        return { count: vendorThreads.length, threadId: vendorThreads[0]?.thread_id || null };
      },
      { mvpKey: MVP_KEY }
    );
    if (reuseMeta.count === 1) pass("vendor_contact thread reused (single thread for same target)");
    else fail(`expected 1 vendor_contact thread, got ${reuseMeta.count}`);

    if (consoleErrors.length === 0) pass("console errors: 0");
    else fail(`console errors: ${consoleErrors.join(" | ")}`);
  });
}

await closeAllBrowsers();

console.log("\n--- Summary ---");
if (errors.length) {
  console.error(`FAIL (${errors.length})`);
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}
console.log("PASS — Builder search → Talk contact threads");
