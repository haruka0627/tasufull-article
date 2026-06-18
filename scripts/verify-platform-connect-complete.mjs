#!/usr/bin/env node
/**
 * Connectあり 取引完了通知 — 5カテゴリ × 通知タブ/TALK 検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "platform-verify-connect-complete");

/** @type {Array<{ id: string, slug: string, category: string, dealId: string, threadId: string }>} */
const CASES = [
  {
    id: "platform-verify-product-connect-complete-001",
    slug: "product",
    category: "商品",
    dealId: "product_deal_demo_001",
    threadId: "chat-demo-product-deal-001",
  },
  {
    id: "platform-verify-worker-connect-complete-001",
    slug: "worker",
    category: "ワーカー",
    dealId: "worker_deal_demo_001",
    threadId: "chat-demo-worker-deal-001",
  },
  {
    id: "platform-verify-business-connect-complete-001",
    slug: "business",
    category: "業務サービス",
    dealId: "business_deal_demo_001",
    threadId: "chat-demo-business-deal-001",
  },
  {
    id: "platform-verify-shop-connect-complete-001",
    slug: "shop",
    category: "店舗販売",
    dealId: "shop_deal_demo_001",
    threadId: "chat-demo-shop-deal-001",
  },
];

const MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_platform_verify_connect_complete_v1",
  "tasful_platform_verify_fee_threads_v1",
];

const FORBIDDEN = /deal-detail\.html|チャットで確認|完了報告を確認/i;

fs.mkdirSync(OUT_DIR, { recursive: true });

function shotName(index, slug, suffix) {
  return `${String(index + 1).padStart(2, "0")}-${slug}-${suffix}-390.png`;
}

async function resetCase(page, notifyId) {
  return page.evaluate(
    (id) => window.TasuPlatformChatConnectDemoSeed?.resetConnectCompleteDemo?.(id),
    notifyId
  );
}

async function auditNotifyCard(page, notifyId) {
  return page.evaluate((id) => {
    const row = (window.TasuTalkNotifications?.getAll?.() || []).find((n) => n.id === id);
    if (!row) return { ok: false, reason: "notify_missing" };
    const card = document.querySelector(`article[data-talk-notify-id="${id}"]`);
    const action = card?.querySelector("[data-talk-notify-action]");
    const bodyText = card?.textContent || "";
    return {
      ok: true,
      title: row.title,
      actionLabel: row.actionLabel,
      href: row.href || row.targetUrl,
      bodyLen: (row.body || "").length,
      cardBodyLen: bodyText.replace(/\s+/g, " ").trim().length,
      actionHref: action?.getAttribute("href") || "",
      hasDealDetail: /deal-detail\.html/i.test(String(row.href || row.targetUrl || "")),
    };
  }, notifyId);
}

async function runEntry(page, c, entry, index) {
  const errors = [];
  const shotBase = `${String(index + 1).padStart(2, "0")}-${c.slug}`;

  await page.goto(`${BASE}/talk-home.html?tab=notify`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1200);
  await resetCase(page, c.id);

  if (entry === "notify") {
    await page.waitForTimeout(400);
    const audit = await auditNotifyCard(page, c.id);
    if (!audit.ok) errors.push(`${c.slug} notify missing`);
    if (audit.title !== "取引が完了しました") errors.push(`${c.slug} title: ${audit.title}`);
    if (audit.actionLabel !== "確認する") errors.push(`${c.slug} actionLabel: ${audit.actionLabel}`);
    if (audit.hasDealDetail || /deal-detail\.html/i.test(audit.actionHref)) {
      errors.push(`${c.slug} must not route to deal-detail`);
    }
    if (!audit.href?.includes("chat-detail.html")) {
      errors.push(`${c.slug} href should be chat-detail: ${audit.href}`);
    }
    await page.screenshot({ path: path.join(OUT_DIR, shotName(index, c.slug, "notify")) });
    const card = page.locator(`article[data-talk-notify-id="${c.id}"]`);
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await page.waitForURL(/chat-detail\.html/i, { timeout: 15000 });
  } else {
    await page.goto(`${BASE}/talk-home.html?tab=chat&room=official_tasful`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(1200);
    const navigated = await page.evaluate((notifyId) => {
      const msgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful") || [];
      const msg = msgs.find((m) => String(m.notifyCard?.notificationId || "") === String(notifyId));
      const href = msg?.notifyCard?.href || msg?.href || msg?.actionHref;
      if (!href) return { ok: false };
      if (/deal-detail\.html/i.test(href)) return { ok: false, reason: "deal-detail", href };
      window.location.href = href;
      return { ok: true, href };
    }, c.id);
    if (!navigated.ok) errors.push(`${c.slug} TALK card missing or bad href`);
    await page.waitForURL(/chat-detail\.html/i, { timeout: 15000 });
    await page.screenshot({ path: path.join(OUT_DIR, shotName(index, c.slug, "talk")) });
  }

  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT_DIR, shotName(index, c.slug, "chat")) });

  const chatUi = await page.evaluate(() => ({
    url: window.location.href,
    hasCompletionCard: Boolean(document.querySelector("[data-platform-completion-card]")),
    cardTitle: document.querySelector(".chat-completion-card__title")?.textContent?.trim() || "",
    hasApprove: Boolean(document.querySelector("[data-platform-completion-approve]")),
    hasReject: Boolean(document.querySelector("[data-platform-completion-reject]")),
    forbiddenBtn: Boolean(
      [...document.querySelectorAll("a,button")].some((el) => /チャットで確認/.test(el.textContent || ""))
    ),
    forbiddenHref: [...document.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href") || "")
      .filter((href) => /deal-detail\.html/i.test(href)),
  }));

  if (!chatUi.hasCompletionCard) errors.push(`${c.slug} completion card missing`);
  if (chatUi.cardTitle !== "完了報告") errors.push(`${c.slug} card title: ${chatUi.cardTitle}`);
  if (!chatUi.hasApprove || !chatUi.hasReject) errors.push(`${c.slug} approve/reject missing`);
  if (chatUi.forbiddenBtn) errors.push(`${c.slug} チャットで確認 must not appear`);
  if (chatUi.forbiddenHref.length) errors.push(`${c.slug} deal-detail links in chat`);

  await page.click("[data-platform-completion-approve]");
  await page.waitForTimeout(600);

  const afterApprove = await page.evaluate(() => ({
    hasFeeBlock: Boolean(document.querySelector("[data-platform-completion-fee]")),
    feeLabel: document.querySelector(".chat-completion-card__fee-label")?.textContent?.trim() || "",
    feeAmount: document.querySelector(".chat-completion-card__fee-amount")?.textContent?.trim() || "",
    feePayHref: document.querySelector("[data-platform-completion-fee-pay]")?.getAttribute("href") || "",
    approved: document.querySelector(".chat-completion-card__status--approved")?.textContent?.trim() || "",
  }));

  if (!afterApprove.hasFeeBlock) errors.push(`${c.slug} completion fee block missing after approve`);
  if (!afterApprove.feeLabel.includes("5%") || !afterApprove.feeLabel.includes("550")) {
    errors.push(`${c.slug} fee label: ${afterApprove.feeLabel}`);
  }
  if (!afterApprove.feePayHref.includes("platform-chat-fee-pay.html")) {
    errors.push(`${c.slug} fee pay href: ${afterApprove.feePayHref}`);
  }
  if (!afterApprove.feePayHref.includes("phase=complete")) {
    errors.push(`${c.slug} fee pay should include phase=complete`);
  }

  await page.screenshot({
    path: path.join(OUT_DIR, shotName(index, c.slug, entry === "notify" ? "fee-cta-notify" : "fee-cta-talk")),
  });

  if (afterApprove.feePayHref) {
    await page.goto(`${BASE}/${afterApprove.feePayHref.replace(/^\//, "")}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(700);
    const feePayUi = await page.evaluate(() => ({
      amount: document.querySelector("[data-platform-fee-amount]")?.textContent?.trim() || "",
      rate: document.querySelector("[data-platform-fee-rate]")?.textContent?.trim() || "",
      title: document.querySelector("[data-platform-fee-pay-title]")?.textContent?.trim() || "",
    }));
    if (!feePayUi.rate.includes("5%") || !feePayUi.rate.includes("550")) {
      errors.push(`${c.slug} completion pay rate: ${feePayUi.rate}`);
    }
    if (!feePayUi.title.includes("取引完了")) {
      errors.push(`${c.slug} completion pay title: ${feePayUi.title}`);
    }
    await page.screenshot({
      path: path.join(OUT_DIR, shotName(index, c.slug, "completion-fee-pay")),
    });
  }

  return {
    id: c.id,
    slug: c.slug,
    entry,
    errors,
    ok: errors.length === 0,
    chatUi,
    afterApprove,
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.addInitScript(({ markers }) => {
    markers.forEach((k) => localStorage.removeItem(k));
  }, { markers: MARKERS });

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  const results = [];
  let caseIndex = 0;
  for (const c of CASES) {
    for (const entry of ["notify", "talk"]) {
      results.push(await runEntry(page, c, entry, caseIndex));
      caseIndex += 1;
    }
  }

  const jobExcluded = await page.evaluate(() => {
    const list = window.TasuTalkNotifications?.getAll?.() || [];
    return list.some(
      (n) =>
        n.category === "求人" &&
        n.title === "取引が完了しました" &&
        String(n.id || "").includes("connect-complete")
    );
  });

  const errors = results.flatMap((r) => r.errors);
  if (jobExcluded) errors.push("job connect-complete notify must not exist");

  const report = {
    generatedAt: new Date().toISOString(),
    markers: MARKERS,
    cases: CASES,
    results,
    jobConnectCompleteExcluded: !jobExcluded,
    ok: errors.length === 0,
    errors,
    screenshots: fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")),
  };

  fs.writeFileSync(path.join(OUT_DIR, "connect-complete-report.json"), JSON.stringify(report, null, 2));
  await browser.close();

  console.log(JSON.stringify(report, null, 2));
  if (errors.length) {
    errors.forEach((e) => console.error(`NG: ${e}`));
    process.exit(1);
  }
  console.log("ALL OK — connect complete notifications verified");
}

await run();
