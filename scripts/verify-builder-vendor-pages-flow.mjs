#!/usr/bin/env node
/**
 * Builder 業者ページ管理 → 検索 → 詳細 → Talk → 550円開示
 *
 *   node scripts/verify-builder-vendor-pages-flow.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { BUILDER_QA_VIEWPORTS } from "./lib/playwright-viewport.mjs";

const VENDOR_PAGES_KEY = "tasful:builder:vendor-pages:v1";
const VENDOR_DRAFTS_KEY = "tasful:builder:vendor-page-drafts:v1";
const VENDOR_SUBS_KEY = "tasful:builder:vendor-subscriptions:v1";
const CONTACT_REVEAL_KEY = "tasful:builder:contact-reveals:v1";
const MVP_KEY = "tasful:builder:mvp:v1";
const CHAT_THREADS_KEY = "tasful_chat_threads";

const TEST_COMPANY = "E2Eテスト建設株式会社";

const base = await findDevServerBaseUrl({ probePath: "builder/vendor-pages.html" });
const vendorPagesUrl = buildLocalPageUrl(base, "builder/vendor-pages.html");
const partnersUrl = buildLocalPageUrl(base, "builder/partners.html");

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

async function resetVendorStorage(page) {
  await page.evaluate(
    ({ pagesKey, draftsKey, subsKey, revealKey, mvpKey, chatKey }) => {
      localStorage.removeItem(pagesKey);
      localStorage.removeItem(draftsKey);
      localStorage.removeItem(subsKey);
      localStorage.removeItem(revealKey);
      const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const threads = { ...(mvp.threads || {}) };
      Object.keys(threads).forEach((id) => {
        const t = threads[id];
        if (String(t?.thread_kind || "") === "vendor_contact") delete threads[id];
      });
      mvp.threads = threads;
      localStorage.setItem(mvpKey, JSON.stringify(mvp));
      const chat = JSON.parse(localStorage.getItem(chatKey) || "[]");
      localStorage.setItem(
        chatKey,
        (Array.isArray(chat) ? chat : []).filter(
          (r) => String(r?.threadKind || "") !== "vendor_contact"
        )
      );
    },
    {
      pagesKey: VENDOR_PAGES_KEY,
      draftsKey: VENDOR_DRAFTS_KEY,
      subsKey: VENDOR_SUBS_KEY,
      revealKey: CONTACT_REVEAL_KEY,
      mvpKey: MVP_KEY,
      chatKey: CHAT_THREADS_KEY,
    }
  );
}

for (const vp of BUILDER_QA_VIEWPORTS) {
  console.log(`\n=== viewport ${vp.width}x${vp.height} ===`);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(vendorPagesUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await resetVendorStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.locator("[data-vendor-page-create]").click();
    await page.locator("[data-vendor-pages-editor-section]").waitFor({ state: "visible", timeout: 10000 });
    pass("vendor-pages 新規作成フォーム");

    await page.locator('input[name="companyName"]').fill(TEST_COMPANY);
    await page.locator('input[name="representativeName"]').fill("テスト 太郎");
    await page.locator('input[name="areasText"]').fill("tokyo, kanagawa");
    await page.locator('input[name="tradesText"]').fill("interior, carpenter");
    await page.locator('input[name="phone"]').fill("03-9999-0001");
    await page.locator('input[name="email"]').fill("e2e-vendor@example.jp");
    await page.locator('input[name="businessDirectoryEnabled"]').check();

    await page.locator("[data-vendor-page-ai-generate]").click();
    await page.waitForTimeout(500);
    const intro = await page.locator('textarea[name="intro"]').inputValue();
    if (intro.length > 10) pass("AI mock 紹介文生成");
    else fail("AI mock 紹介文生成");

    await page.locator("[data-vendor-page-save-draft]").click();
    page.once("dialog", (d) => d.accept());
    await page.waitForTimeout(400);
    const draftSaved = await page.evaluate(
      (key) => {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        return (Array.isArray(list) ? list : []).some((p) => p.publishStatus === "draft");
      },
      VENDOR_PAGES_KEY
    );
    if (draftSaved) pass("下書き保存");
    else fail("下書き保存");

    await page.locator("[data-vendor-page-publish]").click();
    page.once("dialog", (d) => d.accept());
    await page.waitForTimeout(600);

    const published = await page.evaluate(
      ({ key, company }) => {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        return (Array.isArray(list) ? list : []).find(
          (p) => p.companyName === company && p.publishStatus === "published"
        );
      },
      { key: VENDOR_PAGES_KEY, company: TEST_COMPANY }
    );
    if (published?.pageId) pass("公開 + localStorage 保存");
    else fail("公開 + localStorage 保存");

    const pageId = published.pageId;

    await page.goto(partnersUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const partnersText = await page.locator("[data-builder-partner-results]").textContent();
    if (partnersText?.includes(TEST_COMPANY)) pass("partners.html に表示");
    else fail("partners.html に表示");

    if (/Business Directory掲載予定/.test(partnersText || "")) pass("BD掲載予定バッジ");
    else fail("BD掲載予定バッジ");

    await page.goto(
      buildLocalPageUrl(base, `builder/partner.html?partner_id=${encodeURIComponent(pageId)}`),
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForTimeout(800);
    const detailName = await page.locator("[data-builder-partner-name]").textContent();
    if ((detailName || "").includes(TEST_COMPANY)) pass("partner.html 詳細表示");
    else fail("partner.html 詳細表示");

    const vendorBody = await page.locator("[data-builder-vendor-page-body]").textContent();
    if (vendorBody && vendorBody.length > 5) pass("業者ページ本文表示");
    else fail("業者ページ本文表示");

    const talkBtn = page.locator('[data-builder-talk-contact][data-contact-kind="vendor_contact"]').first();
    if ((await talkBtn.count()) >= 1) {
      await talkBtn.click();
      await page.waitForURL(/chat-detail/i, { timeout: 20000 });
      await page.waitForTimeout(1000);
      await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
      pass("Talk vendor_contact 遷移");
    } else fail("Talk vendor_contact ボタン");

    const kind = (await page.locator("#talkBuilderWorkflowKind").textContent().catch(() => "")) || "";
    if (/業者相談/.test(kind)) pass("Talk 業者相談ヘッダー");
    else fail(`Talk 業者相談ヘッダー (${kind})`);

    await page.goto(
      buildLocalPageUrl(base, `builder/partner.html?partner_id=${encodeURIComponent(pageId)}`),
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForTimeout(600);

    const revealText = await page.locator("[data-builder-partner-contact-reveal]").textContent();
    if (/550|連絡先開示/.test(revealText || "") && /チャット料金ではありません/.test(revealText || "")) {
      pass("550円 連絡先開示カード");
    } else fail("550円 連絡先開示カード");

    const revealOk = await page.evaluate(
      (pid) => {
        const R = window.TasuBuilderContactReveal;
        if (!R?.purchaseReveal) return false;
        const res = R.purchaseReveal("partner", pid, { skipConfirm: true });
        const host = document.querySelector("[data-builder-partner-contact-reveal]");
        if (host && res?.ok) {
          host.innerHTML = R.renderContactBlock("partner", pid, { escapeHtml: R.escapeHtml });
        }
        return Boolean(res?.ok);
      },
      pageId
    );
    if (revealOk) pass("demo 開示後 連絡先表示");
    else fail("demo 開示後 連絡先表示");

    const bdFlag = await page.evaluate(
      ({ key, id }) => {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        const row = (Array.isArray(list) ? list : []).find((p) => p.pageId === id);
        return row?.businessDirectoryEnabled === true;
      },
      { key: VENDOR_PAGES_KEY, id: pageId }
    );
    if (bdFlag) pass("BD掲載ON保存");
    else fail("BD掲載ON保存");

    if (consoleErrors.length === 0) pass("console errors: 0");
    else fail(`console errors: ${consoleErrors.join(" | ")}`);
  });
}

await closeAllBrowsers();

console.log("\n=== summary ===");
if (errors.length) {
  console.error(`FAIL (${errors.length}):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log("PASS verify-builder-vendor-pages-flow");
