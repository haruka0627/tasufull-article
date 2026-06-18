/**
 * 安否ダッシュボード — 通知アンカー対応UI（390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const DEMO_KEY = "tasful_anpi_notify_demo_v1";

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/talk-home.html?tab=notify`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const pass = (msg) => console.log("OK", msg);

async function freshPage() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
    [
      "tasful_talk_notifications",
      "tasful_platform_notify_master_v1",
      "tasful_builder_notify_master_v1",
      "tasful_anpi_notify_master_v1",
      "tasful_talk_notifications_seeded_v2",
    ].forEach((k) => localStorage.removeItem(k));
  }, DEMO_KEY);
  return page;
}

async function openDashboard(page, hash, fromTalk = false) {
  const qs = fromTalk ? "?from=talk" : "";
  await page.goto(`${base}/anpi-dashboard.html${qs}#${hash}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
  await page.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 20000 });
  await page.waitForSelector(`[data-anpi-notify-card="${hash}"] .anpi-notify-anchor__chip`, {
    timeout: 10000,
  });
  await page.waitForTimeout(1200);
}

// #check — 安否回答
{
  const page = await freshPage();
  await openDashboard(page, "check", true);

  const before = await page.locator("[data-anpi-notify-check-actions]").count();
  if (before < 1) fail("#check: 回答ボタンなし");
  else pass("#check: 回答ボタン表示");

  await page.locator('[data-anpi-notify-action="check-safe"]').click();
  await page.waitForSelector("[data-anpi-notify-answered]", { timeout: 5000 });

  const answered = await page.evaluate(() => {
    const state = window.TasuAnpiNotifyCards?.loadState?.();
    return {
      response: state?.check?.response,
      hasAnsweredUi: Boolean(document.querySelector("[data-anpi-notify-answered]")),
      tabBar: Boolean(document.querySelector("[data-tasu-app-tabbar]")),
      backBar: Boolean(document.querySelector("[data-tasu-talk-back]:not([hidden])")),
    };
  });

  if (answered.response !== "safe") fail("#check: localStorage 未保存");
  else pass("#check: 安否回答保存");

  if (!answered.hasAnsweredUi) fail("#check: 回答済みUIなし");
  else pass("#check: 回答済み表示");

  if (!answered.tabBar) fail("#check: タブバーなし");
  else pass("#check: タブバー表示");

  if (!answered.backBar) fail("#check: TALKに戻るなし");
  else pass("#check: TALKに戻る表示");

  await page.close();
}

// #family — 家族応答
{
  const page = await freshPage();
  await openDashboard(page, "family", true);

  const history = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-anpi-notify-family-item]")];
    const moreBtn = document.querySelector('[data-anpi-notify-action="family-show-more"]');
    const summary = document.querySelector("[data-anpi-family-check-summary]");
    const summaryText = summary?.textContent?.replace(/\s+/g, " ").trim() || "";
    return {
      initialCount: cards.length,
      moreLabel: moreBtn?.textContent?.trim() || "",
      orderedIds: cards.map((el) => el.getAttribute("data-anpi-notify-family-item")),
      hasSummary: Boolean(summary),
      summaryHasAnswered: summaryText.includes("回答済み") && summaryText.includes("3名"),
      summaryHasUnanswered: summaryText.includes("未回答") && summaryText.includes("1名"),
      title: document.querySelector("#family .anpi-notify-family-history .anpi-notify-anchor__title")?.textContent?.trim() || "",
    };
  });

  if (history.hasSummary && history.summaryHasAnswered && history.summaryHasUnanswered) {
    pass("#family: 安否確認サマリー");
  } else {
    fail("#family: 安否確認サマリー", history.hasSummary ? "集計不一致" : "なし");
  }

  const layoutGap = await page.evaluate(() => {
    const summary = document.querySelector("[data-anpi-family-check-summary]");
    const historyCard = document.querySelector("#family .anpi-notify-family-history");
    if (!summary || !historyCard) return null;
    return Math.round(historyCard.getBoundingClientRect().top - summary.getBoundingClientRect().bottom);
  });
  if (layoutGap !== null && layoutGap >= 12 && layoutGap <= 16) pass("#family: サマリー→履歴余白");
  else fail("#family: サマリー→履歴余白", String(layoutGap));

  if (history.title === "家族からの応答履歴") pass("#family: 履歴タイトル");
  else fail("#family: 履歴タイトル", history.title || "なし");

  if (history.initialCount === 3) pass("#family: 初期表示3件");
  else fail("#family: 初期表示3件", String(history.initialCount));

  if (history.orderedIds[0] === "family-001") pass("#family: 最新応答が先頭");
  else fail("#family: 最新応答が先頭", history.orderedIds.join(","));

  if (history.moreLabel === "すべての履歴を見る") pass("#family: 履歴展開ボタン");
  else fail("#family: 履歴展開ボタン", history.moreLabel || "なし");

  await page.locator('[data-anpi-notify-action="family-show-more"]').click();
  await page.waitForTimeout(300);

  const expanded = await page.evaluate(() => ({
    count: document.querySelectorAll("[data-anpi-notify-family-item]").length,
    moreGone: !document.querySelector('[data-anpi-notify-action="family-show-more"]'),
  }));

  if (expanded.count === 4 && expanded.moreGone) pass("#family: 履歴すべて表示");
  else fail("#family: 履歴すべて表示", `${expanded.count}件 / more=${expanded.moreGone}`);

  await page.locator('[data-anpi-notify-action="family-detail"][data-anpi-notify-id="family-001"]').click();
  await page.waitForSelector('[data-anpi-notify-family-detail="family-001"]', { timeout: 5000 });
  pass("#family: 応答内容を見る");

  await page.locator('[data-anpi-notify-action="family-read"][data-anpi-notify-id="family-001"]').click();
  await page.waitForTimeout(400);

  const family = await page.evaluate(() => {
    const state = window.TasuAnpiNotifyCards.loadState();
    const item = state.family.items.find((i) => i.id === "family-001");
    return { read: item?.read === true };
  });

  if (!family.read) fail("#family: 既読未保存");
  else pass("#family: 既読にする");

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);

  const bottomGap = await page.evaluate(() => {
    const tab = document.querySelector("[data-tasu-app-tabbar]");
    const last =
      document.querySelector("#family .anpi-notify-list-more button") ||
      document.querySelector("#family .anpi-notify-list-item:last-child");
    if (!tab || !last) return null;
    return Math.round(tab.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
  });
  if (bottomGap !== null && bottomGap >= 32 && bottomGap <= 48) pass("#family: 下端余白");
  else fail("#family: 下端余白", String(bottomGap));

  await page.close();
}

// #no-response — 未応答対応
{
  const page = await freshPage();
  await openDashboard(page, "no-response", true);

  await page.locator('[data-anpi-notify-action="nr-remind"]').click();
  await page.waitForTimeout(400);

  const reminded = await page.evaluate(() => window.TasuAnpiNotifyCards.loadState().noResponse.items[0].remindHistory.length);
  if (reminded < 1) fail("#no-response: 再通知履歴なし");
  else pass("#no-response: 再通知する");

  await page.locator('[data-anpi-notify-action="nr-handled"]').click();
  await page.waitForTimeout(500);

  const handled = await page.evaluate(() => {
    const state = window.TasuAnpiNotifyCards.loadState();
    return {
      handled: state.noResponse.items[0]?.handled,
      doneUi: Boolean(document.querySelector(".anpi-notify-status--done")),
    };
  });

  if (!handled.handled) fail("#no-response: 対応済み未保存");
  else pass("#no-response: 対応済みにする");

  if (!handled.doneUi) fail("#no-response: 完了UIなし");
  else pass("#no-response: 対応完了表示");

  await page.close();
}

// #disaster — 災害情報
{
  const page = await freshPage();
  await openDashboard(page, "disaster", true);

  const hasAnswer = (await page.locator('[data-anpi-notify-action="disaster-answer"]').count()) > 0;
  if (!hasAnswer) fail("#disaster: 安否を回答するなし");
  else pass("#disaster: 安否を回答する");

  await page.locator('[data-anpi-notify-action="disaster-detail"]').click();
  await page.waitForSelector("[data-anpi-notify-disaster-detail]", { timeout: 5000 });
  pass("#disaster: 詳細を見る");

  await page.close();
}

// #drill — 訓練
{
  const page = await freshPage();
  await openDashboard(page, "drill", true);

  await page.locator('[data-anpi-notify-action="drill-join"]').click();
  await page.waitForTimeout(400);

  const joined = await page.evaluate(() => window.TasuAnpiNotifyCards.loadState().drill.status);
  if (joined !== "joined") fail("#drill: 参加状態未保存");
  else pass("#drill: 訓練に参加する");

  await page.locator('[data-anpi-notify-action="drill-complete"]').click();
  await page.waitForTimeout(400);

  const completed = await page.evaluate(() => window.TasuAnpiNotifyCards.loadState().drill.status);
  if (completed !== "completed") fail("#drill: 完了状態未保存");
  else pass("#drill: 完了にする");

  await page.close();
}

// #settings — 設定編集リンク
{
  const page = await freshPage();
  await openDashboard(page, "settings", true);

  const href = await page.locator('[data-anpi-notify-action="settings-edit"]').getAttribute("href");
  if (!href?.includes("anpi-register.html") || !href.includes("from=talk")) {
    fail(`#settings: リンク不正 → ${href}`);
  } else {
    pass("#settings: 設定を編集する → anpi-register.html?from=talk");
  }

  await page.close();
}

// TALK通知タブから各カードへ遷移
{
  const page = await freshPage();
  await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
  await page.waitForSelector('[data-talk-notify-id="anpi-check-request-001"]', { timeout: 20000 });

  const specs = [
    { id: "anpi-check-request-001", hash: "check", chip: "安否確認" },
    { id: "anpi-family-response-001", hash: "family", chip: "家族応答" },
    { id: "anpi-no-response-001", hash: "no-response", chip: "未応答" },
    { id: "anpi-disaster-info-001", hash: "disaster", chip: "災害情報" },
    { id: "anpi-drill-001", hash: "drill", chip: "安否訓練" },
    { id: "anpi-setting-updated-001", hash: "settings", chip: "通知設定" },
  ];

  for (const spec of specs) {
    await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
    await page.waitForSelector(`[data-talk-notify-id="${spec.id}"]`, { timeout: 15000 });

    const card = page.locator(`article[data-talk-notify-id="${spec.id}"]`);
    const href = await card.locator('[data-talk-notify-action="navigate"]').getAttribute("href");
    if (!href?.includes(`anpi-dashboard.html`) || !href.includes(`#${spec.hash}`) || !href.includes("from=talk")) {
      fail(`通知 ${spec.id}: href不正 → ${href}`);
      continue;
    }

    await Promise.all([
      page.waitForURL((url) => url.href.includes("anpi-dashboard.html"), { timeout: 20000 }),
      card.click(),
    ]);
    await page.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 20000 });
    await page.waitForTimeout(1200);

    const landed = await page.evaluate(
      ({ hash, chip }) => {
        const target = document.getElementById(hash);
        const chipSelector =
          hash === "family"
            ? `[data-anpi-notify-card="${hash}"] .anpi-notify-family-history .anpi-notify-anchor__chip`
            : `[data-anpi-notify-card="${hash}"] .anpi-notify-anchor__chip`;
        const cardChip = document.querySelector(chipSelector)?.textContent?.trim();
        return {
          focus: document.body.classList.contains("anpi-dashboard-page--notify-focus"),
          active: target?.classList.contains("anpi-notify-anchor--active"),
          chipOk: cardChip === chip,
          hasAction: Boolean(
            document.querySelector(`#${hash} [data-anpi-notify-action], #${hash} .anpi-notify-status--done`)
          ),
          tabBar: Boolean(document.querySelector("[data-tasu-app-tabbar]")),
        };
      },
      { hash: spec.hash, chip: spec.chip }
    );

    const ok =
      landed.focus && landed.active && landed.chipOk && landed.hasAction && landed.tabBar;
    if (!ok) fail(`通知遷移 ${spec.id}: ${JSON.stringify(landed)}`);
    else pass(`通知遷移 ${spec.id} → #${spec.hash}`);
  }

  await page.close();
}

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
