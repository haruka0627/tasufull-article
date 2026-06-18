#!/usr/bin/env node
/**
 * TASFUL TALK 安否通知 → 対応ページ遷移 → 操作可否の確認（読み取り専用）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");

const CASES = [
  {
    id: "anpi-check-request-001",
    type: "安否確認通知",
    expectPath: "anpi-dashboard.html",
    expectHash: "check",
    actions: ["check-safe", "check-help", "check-later"],
    testAction: "check-safe",
    testSelector: "[data-anpi-notify-answered]",
  },
  {
    id: "anpi-no-response-001",
    type: "未応答通知",
    expectPath: "anpi-dashboard.html",
    expectHash: "no-response",
    actions: ["nr-remind", "nr-call", "nr-handled"],
  },
  {
    id: "anpi-family-response-001",
    type: "家族からの回答通知",
    expectPath: "anpi-dashboard.html",
    expectHash: "family",
    actions: ["family-detail", "family-read"],
  },
  {
    id: "anpi-disaster-info-001",
    type: "災害情報通知",
    expectPath: "anpi-dashboard.html",
    expectHash: "disaster",
    actions: ["disaster-answer", "disaster-detail"],
  },
  {
    id: "anpi-drill-001",
    type: "訓練通知",
    expectPath: "anpi-dashboard.html",
    expectHash: "drill",
    actions: ["drill-join", "drill-complete"],
  },
  {
    id: "anpi-setting-updated-001",
    type: "通知設定更新",
    expectPath: "anpi-register.html",
    expectHash: "",
    register: true,
  },
];

let results = [];
await withPlaywrightBrowser(async (browser) => {
const seedPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await seedPage.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
await seedPage.waitForSelector('[data-talk-notify-id="anpi-check-request-001"]', { timeout: 25000 });

for (const c of CASES) {
  const row = {
    type: c.type,
    talkVisible: false,
    talkTitle: "",
    talkActionLabel: "",
    talkHref: "",
    navUrl: "",
    pageExists: false,
    actionsFound: [],
    actionable: false,
    issues: [],
  };

  const card = seedPage.locator(`[data-talk-notify-id="${c.id}"]`);
  row.talkVisible = (await card.count()) > 0;
  if (!row.talkVisible) {
    row.issues.push("TALK通知カード未表示");
    results.push(row);
    continue;
  }

  row.talkTitle = (await card.locator(".talk-notify-card__title").textContent())?.trim() || "";
  const action = card.locator("[data-talk-notify-action]").first();
  row.talkActionLabel = (await action.textContent())?.trim() || "";
  row.talkHref = (await action.getAttribute("href")) || "";

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`[data-talk-notify-id="${c.id}"]`);
  await page.locator(`[data-talk-notify-id="${c.id}"] [data-talk-notify-action]`).first().click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(900);

  row.navUrl = page.url();
  const u = new URL(row.navUrl);
  row.pageExists = row.navUrl.includes(c.expectPath);

  if (!row.pageExists) row.issues.push(`遷移先不一致: ${row.navUrl}`);
  if (c.expectHash && u.hash.replace("#", "") !== c.expectHash) {
    row.issues.push(`hash不一致: ${u.hash || "(なし)"}`);
  }

  if (c.expectPath.includes("anpi-dashboard")) {
    await page.waitForSelector(`#${c.expectHash}`, { timeout: 8000 }).catch(() => {});
    const focus = await page.evaluate(() => document.body.getAttribute("data-anpi-notify-target"));
    if (c.expectHash && focus !== c.expectHash) {
      row.issues.push(`notify-focus未適用: ${focus}`);
    }
    for (const a of c.actions || []) {
      const n = await page.locator(`#${c.expectHash} [data-anpi-notify-action="${a}"]`).count();
      if (n > 0) row.actionsFound.push(a);
    }
    if (c.testAction) {
      await page.locator(`[data-anpi-notify-action="${c.testAction}"]`).first().click();
      await page.waitForTimeout(400);
      row.actionable = (await page.locator(c.testSelector).count()) > 0;
      if (!row.actionable) row.issues.push("代表操作が反映されない");
    } else {
      row.actionable = row.actionsFound.length >= Math.min(2, (c.actions || []).length);
    }
  } else if (c.register) {
    const form = await page.locator("[data-anpi-register-form]").count();
    const talkLegend = await page.getByText("TASFUL TALK通知設定").count();
    const relink = await page.locator("[data-anpi-line-connect], [data-anpi-line-demo-link]").count();
    if (form > 0) row.actionsFound.push("登録フォーム");
    if (talkLegend > 0) row.actionsFound.push("TASFUL TALK設定");
    if (relink > 0) row.actionsFound.push("連携ボタン");
    row.actionable = form > 0 && talkLegend > 0;
    if (!row.actionable) row.issues.push("設定編集UI不足");
  }

  await page.close();
  results.push(row);
}

// 動的ログ・連携解除
const aux = await browser.newPage();
await aux.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
await aux.waitForFunction(() => Boolean(window.TasuTalkPlatformNotify?.notifyAnpiRequest));
const auxData = await aux.evaluate(() => {
  const urgent = {
    event_type: "urgent_keyword_detected",
    title: "【TASFUL安否通知】緊急キーワード",
    message: "テスト",
  };
  const ai = { event_type: "ai_search", title: "【TASFUL安否通知】AI検索", message: "相談" };
  const urgentN = window.TasuTalkPlatformNotify.notifyAnpiRequest(urgent);
  const aiN = window.TasuTalkPlatformNotify.notifyAnpiRequest(ai);
  const urgentHref = urgentN
    ? window.TasuTalkNotifyActions.resolveNotificationOpenHref(urgentN)
    : "";
  const aiHref = aiN ? window.TasuTalkNotifyActions.resolveNotificationOpenHref(aiN) : "";
  const unlinkInTalk = window.TasuTalkPlatformNotify.shouldNotifyAnpiLog({
    event_type: "line_oauth_unlinked",
  });
  return {
    urgentId: urgentN?.id || "",
    urgentTarget: urgentN?.targetUrl || "",
    urgentHref,
    aiTarget: aiN?.targetUrl || "",
    aiHref,
    unlinkInTalk,
  };
});

// 緊急動的ログ: 同一セッションで再描画後にタップ → #check 直遷移
if (auxData.urgentId) {
  await aux.waitForTimeout(700);
  await aux.waitForSelector(`[data-talk-notify-id="${auxData.urgentId}"]`, { timeout: 15000 });
  const urgentAction = aux.locator(
    `[data-talk-notify-id="${auxData.urgentId}"] [data-talk-notify-action]`
  );
  if ((await urgentAction.count()) > 0) {
    await urgentAction.first().click();
  } else {
    await aux.locator(`[data-talk-notify-id="${auxData.urgentId}"]`).first().click();
  }
  await aux.waitForLoadState("domcontentloaded");
  await aux.waitForTimeout(900);
  const urgentNavUrl = aux.url();
  const urgentIssues = [];
  if (auxData.urgentTarget !== "anpi-dashboard.html#check") {
    urgentIssues.push(`targetUrl不一致: ${auxData.urgentTarget}`);
  }
  if (!auxData.urgentHref.includes("anpi-dashboard.html")) {
    urgentIssues.push(`href不一致: ${auxData.urgentHref}`);
  }
  if (!auxData.urgentHref.includes("#check")) urgentIssues.push("href に #check なし");
  if (!urgentNavUrl.includes("anpi-dashboard.html")) urgentIssues.push(`遷移先不一致: ${urgentNavUrl}`);
  if (!urgentNavUrl.includes("#check")) urgentIssues.push("hash #check なし");
  const focus = await aux.evaluate(() => document.body.getAttribute("data-anpi-notify-target"));
  if (focus !== "check") urgentIssues.push(`notify-focus: ${focus}`);
  const hasCheckActions = (await aux.locator('[data-anpi-notify-action="check-safe"]').count()) > 0;
  results.push({
    type: "動的安否ログ（緊急キーワード）",
    talkVisible: true,
    talkTitle: "安否確認通知があります",
    talkActionLabel: "詳細を見る",
    talkHref: auxData.urgentHref,
    navUrl: urgentNavUrl,
    pageExists: urgentNavUrl.includes("anpi-dashboard.html"),
    actionsFound: hasCheckActions ? ["check-safe", "check-help", "check-later"] : [],
    actionable: hasCheckActions,
    issues: urgentIssues,
  });
}

results.push({
  type: "動的安否ログ（AI検索等・非緊急）",
  talkVisible: Boolean(auxData.aiHref),
  talkTitle: "安否確認通知があります",
  talkActionLabel: "（汎用）",
  talkHref: auxData.aiHref,
  navUrl: auxData.aiHref,
  pageExists: auxData.aiHref.includes("anpi-notifications.html"),
  actionsFound: [],
  actionable: auxData.aiTarget === "anpi-notifications.html",
  issues: auxData.aiHref.includes("anpi-notifications.html") ? [] : ["非緊急はセンター遷移のまま"],
});

await aux.close();
});

results.push({
  type: "TASFUL TALK連携解除",
  talkVisible: false,
  talkTitle: "（TALK非表示）",
  talkActionLabel: "-",
  talkHref: "-",
  navUrl: "anpi-notifications.html（センターのみ）",
  pageExists: true,
  actionsFound: ["TASFUL TALKを再連携する（センター内）"],
  actionable: false,
  issues: [
    "shouldNotifyAnpiLogでTALK連携対象外",
    "TALKタップ→register の1段遷移は不可",
  ],
});

console.log(JSON.stringify(results, null, 2));

await closeAllBrowsers();
