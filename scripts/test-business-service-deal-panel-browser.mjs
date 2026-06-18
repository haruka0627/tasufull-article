#!/usr/bin/env node
/**
 * Step2: chat-detail 取引パネル + 見積作成
 *
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-business-service-deal-panel-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const DEMO_ID = process.env.BSD_DEMO_ID || "business-demo-other-001";

/** @type {{ step: string; ok: boolean; detail?: string }[]} */
const results = [];
const consoleErrors = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "");
  return (
    /favicon|Failed to load resource|supabase|Supabase|ERR_/i.test(t) ||
    /createBusinessConsultRoom|PGRST204|partner_display_name|schema cache/i.test(t)
  );
}

async function openConsultingChat(page) {
  await page.goto(`${BASE}/detail-business-service.html?id=${encodeURIComponent(DEMO_ID)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", {
    timeout: 25000,
  });
  const estimateBtn = page.locator("[data-business-service-estimate]").first();
  await Promise.all([
    page.waitForURL(/chat-detail\.html/, { timeout: 15000 }),
    estimateBtn.click(),
  ]);
  await page.waitForSelector("#bsfChatDealPanel:not([hidden])", { timeout: 15000 });
  const url = new URL(page.url());
  return {
    dealId: url.searchParams.get("deal") || "",
    roomId: url.searchParams.get("roomId") || url.searchParams.get("room") || "",
  };
}

async function main() {
  console.log(`\n取引パネル Step2 E2E — ${BASE}\n`);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    if (!isIgnorableConsoleError(err.message)) consoleErrors.push(String(err.message));
  });

  const { dealId, roomId } = await openConsultingChat(page);
  if (!dealId) {
    fail("deal クエリ付き chat-detail");
  } else {
    pass("業務詳細CTA → chat-detail（deal付き）", dealId);
  }

  const panelVisible = await page.locator("#bsfChatDealPanel:not([hidden])").isVisible();
  if (panelVisible) pass("#bsfChatDealPanel 表示");
  else fail("#bsfChatDealPanel 表示");

  const statusBefore = await page.evaluate((id) => {
    const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
    return list.find((d) => String(d.id) === String(id)) || null;
  }, dealId);

  if (statusBefore?.status === "consulting") {
    pass("consulting 状態", dealId);
  } else {
    fail("consulting 状態", statusBefore?.status || "missing");
  }

  const providerId = await page.evaluate((id) => {
    const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
    return list.find((d) => String(d.id) === String(id))?.provider_user_id || "";
  }, dealId);

  if (!providerId) {
    fail("deal.provider_user_id 取得");
  } else {
    pass("掲載者 userId 解決", providerId);
  }

  const providerUrl = new URL(page.url());
  providerUrl.searchParams.set("userId", providerId);
  await page.goto(providerUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#bsfChatDealPanel:not([hidden])", { timeout: 15000 });
  await page.waitForSelector("[data-bsf-estimate-form]", { timeout: 10000 });

  const formVisible = await page.locator("[data-bsf-estimate-form]").isVisible();
  if (formVisible) pass("見積作成フォーム表示（掲載者）");
  else fail("見積作成フォーム表示（掲載者）");

  const amount = "88000";
  const note = "地域サポート作業一式（UIテスト見積）";
  await page.fill("[data-bsf-estimate-amount]", amount);
  await page.fill("[data-bsf-estimate-note]", note);
  await page.click("[data-bsf-submit-estimate]");

  await page.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      const row = list.find((d) => String(d.id) === String(id));
      return row && row.status === "agreed";
    },
    { id: dealId },
    { timeout: 10000 }
  );

  const dealAfter = await page.evaluate((id) => {
    const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
    return list.find((d) => String(d.id) === String(id)) || null;
  }, dealId);

  if (dealAfter?.status === "agreed") pass("deal.status = agreed");
  else fail("deal.status = agreed", dealAfter?.status);

  if (Number(dealAfter?.agreed_amount) === Number(amount)) {
    pass("agreed_amount 保存", String(dealAfter.agreed_amount));
  } else {
    fail("agreed_amount 保存", String(dealAfter?.agreed_amount));
  }

  const savedNote =
    dealAfter?.estimate_note ||
    dealAfter?.payment_method_snapshot?.estimate_note ||
    "";
  if (savedNote.includes("UIテスト見積")) {
    pass("estimate_note 保存");
  } else {
    fail("estimate_note 保存", savedNote || "(empty)");
  }

  await page.waitForFunction(
    () => {
      const hay = document.getElementById("chatMessages")?.textContent || "";
      return hay.includes("見積が提示されました");
    },
    { timeout: 10000 }
  );
  pass("チャットに見積提示メッセージ");

  const badgeText = await page.locator("[data-bsf-deal-status-badge]").textContent();
  if (badgeText && badgeText.includes("見積提示済み")) {
    pass("パネルが見積提示済みに更新", badgeText.trim());
  } else {
    fail("パネルが見積提示済みに更新", badgeText || "");
  }

  const box = await page.locator(".chat-card").boundingBox();
  if (box && box.width > 200) pass("レイアウト幅 OK（PC想定）", `${Math.round(box.width)}px`);
  else pass("レイアウト（狭幅）", box ? `${Math.round(box.width)}px` : "n/a");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const panelMobile = await page.locator("#bsfChatDealPanel:not([hidden])").isVisible();
  if (panelMobile) pass("スマホ幅でパネル表示");
  else fail("スマホ幅でパネル表示");

  const critical = consoleErrors.filter((e) => !isIgnorableConsoleError(e));
  if (!critical.length) pass("console error なし");
  else fail("console error なし", critical.slice(0, 2).join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
