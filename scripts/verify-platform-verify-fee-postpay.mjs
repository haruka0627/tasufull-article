#!/usr/bin/env node
/**
 * プラット通知 v3 — Connectなし8件 後段フロー検証
 * 通知タブ / TASFUL TALK 両方
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "platform-verify-fee-postpay");
const MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_platform_verify_fee_threads_v1",
];

/** @type {Array<{ id: string, slug: string, title: string, category: string, sectionLabel: string, threadId: string }>} */
const CASES = [
  {
    id: "platform-verify-worker-request-001",
    slug: "worker-request",
    title: "依頼が届きました",
    category: "worker",
    sectionLabel: "依頼内容",
    threadId: "chat-demo-worker-fee-001",
  },
  {
    id: "platform-verify-worker-accept-001",
    slug: "worker-accept",
    title: "依頼を受諾しました",
    category: "worker",
    sectionLabel: "依頼内容",
    threadId: "chat-demo-worker-fee-001",
  },
  {
    id: "platform-verify-skill-consult-001",
    slug: "skill-consult",
    title: "相談が届きました",
    category: "skill",
    sectionLabel: "相談内容",
    threadId: "chat-demo-skill-fee-001",
  },
  {
    id: "platform-verify-skill-purchase-001",
    slug: "skill-purchase",
    title: "スキルが購入されました",
    category: "skill",
    sectionLabel: "購入内容",
    threadId: "chat-demo-skill-fee-001",
  },
  {
    id: "platform-verify-product-inquiry-001",
    slug: "product-inquiry",
    title: "商品について問い合わせがありました",
    category: "product",
    sectionLabel: "問い合わせ内容",
    threadId: "chat-demo-product-fee-001",
  },
  {
    id: "platform-verify-product-purchase-001",
    slug: "product-purchase",
    title: "商品が購入されました",
    category: "product",
    sectionLabel: "購入内容",
    threadId: "chat-demo-product-fee-001",
  },
  {
    id: "platform-verify-business-consult-001",
    slug: "business-consult",
    title: "相談が届きました（業務）",
    category: "business_service",
    sectionLabel: "相談内容",
    threadId: "chat-demo-business-fee-001",
  },
  {
    id: "platform-verify-shop-inquiry-001",
    slug: "shop-inquiry",
    title: "問い合わせが届きました",
    category: "shop_store",
    sectionLabel: "問い合わせ内容",
    threadId: "chat-demo-shop-fee-001",
  },
  {
    id: "platform-verify-shop-purchase-001",
    slug: "shop-purchase",
    title: "商品が購入されました（店舗）",
    category: "shop_store",
    sectionLabel: "購入内容",
    threadId: "chat-demo-shop-fee-001",
  },
];

const FORBIDDEN = /deal-detail\.html|案件詳細|チャットで確認|完了報告を確認/i;

fs.mkdirSync(OUT_DIR, { recursive: true });

function fileSlug(index, caseSlug, entry) {
  return `${String(index + 1).padStart(2, "0")}-${caseSlug}-${entry}`;
}

async function resetCase(page, notifyId) {
  return page.evaluate((id) => window.TasuPlatformChatDemoSeed?.resetVerifyFeeThread?.(id), notifyId);
}

async function readThreadState(page, threadId) {
  return page.evaluate((tid) => {
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const fees = JSON.parse(localStorage.getItem("tasful_platform_chat_fees_v1") || "[]");
    const msgs = JSON.parse(localStorage.getItem("tasful_chat_messages") || "{}");
    const thread = threads.find((t) => String(t.id) === tid);
    const fee = fees.find((f) => String(f.threadId) === tid);
    const messages = msgs[tid] || [];
    const contentCard = messages.find((m) => m.kind === "content_card");
    return {
      threadStatus: thread?.status || "",
      feeStatus: fee?.status || "",
      feeAmount: fee?.feeAmount || null,
      msgCount: messages.length,
      contentCard: contentCard?.contentCard || null,
    };
  }, threadId);
}

async function runFlow(page, c, entry, index) {
  const prefix = fileSlug(index, c.slug, entry);
  const errors = [];

  await page.goto(`${BASE}/talk-home.html?tab=notify`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(900);
  await resetCase(page, c.id);

  if (entry === "notify") {
    await page.waitForTimeout(300);
    const card = page.locator(`article[data-talk-notify-id="${c.id}"]`);
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await page.waitForURL(/platform-chat-fee-pay\.html/i, { timeout: 15000 });
  } else {
    await page.goto(`${BASE}/talk-home.html?tab=chat&room=official_tasful`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(1500);
    const navigated = await page.evaluate((notifyId) => {
      const msgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful") || [];
      const msg = msgs.find((m) => String(m.notifyCard?.notificationId || "") === String(notifyId));
      const href = msg?.notifyCard?.href;
      if (!href) return false;
      window.location.href = href;
      return true;
    }, c.id);
    if (!navigated) errors.push("TALK notify card not found");
    await page.waitForURL(/platform-chat-fee-pay\.html/i, { timeout: 15000 });
  }

  if (errors.length) {
    return {
      id: c.id,
      entry,
      slug: c.slug,
      errors,
      ok: false,
    };
  }
  await page.waitForTimeout(700);

  const payUi = await page.evaluate(() => ({
    amount: document.querySelector("[data-platform-fee-amount]")?.textContent?.trim() || "",
    rate: document.querySelector("[data-platform-fee-rate]")?.textContent?.trim() || "",
    category: document.querySelector("[data-platform-fee-category]")?.textContent?.trim() || "",
    forbidden: [...document.body.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href") || "")
      .filter((href) => /deal-detail\.html/i.test(href)),
  }));

  await page.screenshot({
    path: path.join(OUT_DIR, `${prefix}-fee-pay-390.png`),
    fullPage: false,
  });

  if (!payUi.rate.includes("5%") || !payUi.rate.includes("550")) {
    errors.push(`rate label: ${payUi.rate}`);
  }
  if (!payUi.amount.includes("¥") || payUi.amount === "¥0") {
    errors.push(`amount: ${payUi.amount}`);
  }
  if (payUi.forbidden.length) errors.push(`forbidden href on pay: ${payUi.forbidden.join(",")}`);

  const beforePay = await readThreadState(page, c.threadId);
  if (beforePay.threadStatus !== "fee_pending") {
    errors.push(`before pay thread status: ${beforePay.threadStatus}`);
  }

  await page.click("[data-platform-fee-pay]");
  await page.waitForFunction(
    () => !document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
    { timeout: 10000 }
  );
  await page.waitForTimeout(500);

  const afterPay = await readThreadState(page, c.threadId);
  if (afterPay.threadStatus !== "open") errors.push(`after pay thread: ${afterPay.threadStatus}`);
  if (afterPay.feeStatus !== "paid") errors.push(`fee status: ${afterPay.feeStatus}`);

  await page.screenshot({
    path: path.join(OUT_DIR, `${prefix}-fee-complete-390.png`),
    fullPage: false,
  });

  const completeUrl = page.url().replace(/^https?:\/\/[^/]+/, "");
  const chatHref = await page.evaluate(() => {
    const link = document.querySelector("[data-platform-fee-chat-link]");
    return link?.getAttribute("href") || "";
  });
  if (!/chat-detail\.html/i.test(chatHref)) {
    errors.push(`chat link: ${chatHref}`);
  }

  await page.goto(`${BASE}/${chatHref.replace(/^\//, "")}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1200);

  const chatAudit = await page.evaluate(({ forbiddenPattern, sectionLabel }) => {
    const card = document.querySelector("[data-platform-content-card]");
    const dt = card?.querySelector("dt")?.textContent?.trim() || "";
    const dd = card?.querySelector("dd")?.textContent?.trim() || "";
    const bodyText = document.body.innerText || "";
    const forbidden = [];
    if (new RegExp(forbiddenPattern, "i").test(bodyText)) forbidden.push("forbidden_text");
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (/deal-detail\.html/i.test(href)) forbidden.push(href);
    });
    return {
      hasCard: Boolean(card),
      sectionLabel: dt,
      bodyPreview: dd.slice(0, 80),
      forbidden,
      url: location.pathname + location.search,
    };
  }, { forbiddenPattern: FORBIDDEN.source, sectionLabel: c.sectionLabel });

  await page.screenshot({
    path: path.join(OUT_DIR, `${prefix}-chat-390.png`),
    fullPage: false,
  });

  const cardEl = page.locator("[data-platform-content-card]");
  if (await cardEl.count()) {
    await cardEl.first().screenshot({
      path: path.join(OUT_DIR, `${prefix}-content-card-390.png`),
    });
  }

  if (!/chat-detail\.html/i.test(chatAudit.url)) errors.push(`chat url: ${chatAudit.url}`);
  if (!chatAudit.hasCard) errors.push("content card missing");
  if (chatAudit.sectionLabel !== c.sectionLabel) {
    errors.push(`section label: expected ${c.sectionLabel}, got ${chatAudit.sectionLabel}`);
  }
  if (chatAudit.forbidden.length) errors.push(`forbidden in chat: ${chatAudit.forbidden.join(",")}`);

  return {
    id: c.id,
    entry,
    slug: c.slug,
    payUi,
    beforePay,
    afterPay,
    chatHref,
    completeUrl,
    chatAudit,
    errors,
    ok: errors.length === 0,
  };
}

await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

page.on("dialog", async (dialog) => {
  await dialog.accept();
});

await page.addInitScript(({ markers }) => {
  markers.forEach((k) => localStorage.removeItem(k));
}, { markers: MARKERS });

await page.goto(`${BASE}/talk-home.html?tab=notify`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(1500);

const results = [];

for (let i = 0; i < CASES.length; i += 1) {
  const c = CASES[i];
  for (const entry of ["notify", "talk"]) {
    const row = await runFlow(page, c, entry, i);
    results.push(row);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  pass: results.filter((r) => r.ok).length,
  fail: results.filter((r) => !r.ok).length,
  total: results.length,
  results,
};

fs.writeFileSync(path.join(OUT_DIR, "postpay-report.json"), JSON.stringify(report, null, 2));

console.log("\n=== Connectなし 8件 後段フロー ===\n");
for (const r of results) {
  const mark = r.ok ? "OK" : "NG";
  console.log(`${mark}\t[${r.entry}]\t${r.id}`);
  if (!r.ok) r.errors.forEach((e) => console.log(`    - ${e}`));
  else {
    console.log(`    手数料: ${r.payUi.amount} / ${r.payUi.rate}`);
    console.log(`    ${r.beforePay.threadStatus} → ${r.afterPay.threadStatus}`);
    console.log(`    カード: ${r.chatAudit.sectionLabel}`);
    console.log(`    chat: ${r.chatAudit.url}`);
  }
  console.log("");
}

});

if (report.fail > 0) {
  console.error(`FAIL: ${report.fail}/${report.total}`);
  await closeAllBrowsers();
  process.exit(1);
}
console.log(`PASS: ${report.pass}/${report.total}`);
console.log(`Report: ${OUT_DIR}/postpay-report.json`);
