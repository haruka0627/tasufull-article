/**
 * TALK → Builder案件確認 — 戻り導線・下部タブバー（390px）
 * builder-project-new-001 は DEPRECATED。board通知 + partner-assignment 直接URL で検証。
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const DEPRECATED_NOTIFY_ID = "builder-project-new-001";
const BOARD_APPLY_ID = "builder-board-apply-001";
const CAL_PROJECT_ID = "builder_demo_001";
const PARTNER_ID = "demo-partner-001";
const MVP_KEY = "tasful:builder:mvp:v1";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

function partnerAssignmentInitScript() {
  const key = "tasful:builder:mvp:v1";
  const projectId = "builder_demo_001";
  const partnerId = "demo-partner-001";
  localStorage.setItem("tasful:builder:mvp:role", "partner");
  localStorage.setItem("tasful:builder:mvp:partner_id", partnerId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const state = JSON.parse(raw);
    const idx = (state.projects || []).findIndex((p) => p.project_id === projectId);
    if (idx >= 0) {
      state.projects[idx].assignment_status = "pending";
      state.projects[idx].selected_partner_ids = [partnerId];
      state.projects[idx].calendar_assigned_partner_id = partnerId;
      localStorage.setItem(key, JSON.stringify(state));
    }
  } catch {
    /* ignore */
  }
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_builder_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
  ].forEach((k) => localStorage.removeItem(k));
});
await page.addInitScript(partnerAssignmentInitScript);

const notifyUrl = buildLocalPageUrl(base, "talk-home.html", "?tab=notify&talkDev=1");

// 1) DEPRECATED — notify 一覧に旧IDが出ない
await page.goto(notifyUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("[data-talk-notify-list]", { timeout: 25000 });
await page.waitForTimeout(800);

const deprecatedCount = await page.locator(`article[data-talk-notify-id="${DEPRECATED_NOTIFY_ID}"]`).count();
if (deprecatedCount > 0) fail(`${DEPRECATED_NOTIFY_ID} が notify 一覧に表示されている`);
else ok(`${DEPRECATED_NOTIFY_ID} は notify 一覧から除外（DEPRECATED）`);

// 2) 現行 board 通知 → 応募管理画面
await page.waitForSelector(`article[data-talk-notify-id="${BOARD_APPLY_ID}"]`, { timeout: 25000 });
const boardHref = await page.evaluate((id) => {
  const btn = document.querySelector(
    `article[data-talk-notify-id="${id}"] [data-talk-notify-action="navigate"]`
  );
  const row = window.TasuTalkNotifications?.findById?.(id);
  return (
    btn?.getAttribute("data-talk-notify-href") ||
    window.TasuTalkNotifyActions?.resolveTalkMasterHref?.(row) ||
    row?.href ||
    ""
  );
}, BOARD_APPLY_ID);

if (!boardHref?.includes("board-project-detail.html")) {
  fail(`board 応募通知 href: ${boardHref}`);
} else ok(`board 応募通知: ${boardHref}`);

const boardNav = page.locator(
  `article[data-talk-notify-id="${BOARD_APPLY_ID}"] [data-talk-notify-action="navigate"]`
);
if (await boardNav.count()) {
  await boardNav.first().click();
} else {
  await page.locator(`article[data-talk-notify-id="${BOARD_APPLY_ID}"]`).click();
}
await page.waitForURL(/board-project-detail\.html/, { timeout: 20000 });
if (!page.url().includes("view=applications")) fail(`board 遷移先: ${page.url()}`);
else ok(`board 応募通知 → 遷移 OK`);

// 3) 直接URL — partner-assignment（from=talk）+ 戻り導線
const assignmentUrl = buildLocalPageUrl(
  base,
  "builder/partner-assignment.html",
  `?role=partner&partnerId=${PARTNER_ID}&projectId=${CAL_PROJECT_ID}&from=talk&talkDev=1`
);

await page.evaluate(partnerAssignmentInitScript);
await page.goto(assignmentUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
await page.waitForSelector("[data-partner-assignment-accept]", { timeout: 30000 });
await page.waitForTimeout(600);

const tabbar = page.locator("[data-tasu-app-tabbar]");
const tabCount = await tabbar.locator("[data-tasu-app-tab]").count();
if (tabCount !== 4) fail(`下部タブバー: ${tabCount}項目`);
else ok("下部タブバー: 4項目表示（home/TALK/AI/mypage）");

const tabLabels = await tabbar.locator(".tasu-app-tabbar__label").allTextContents();
const expectedTabs = ["ホーム", "TALK", "AI", "マイページ"];
if (!expectedTabs.every((l, i) => tabLabels[i] === l)) fail(`タブラベル: ${tabLabels.join(", ")}`);
else ok("下部タブバー: ラベル OK");

const beforeAccept = await page.evaluate(() => ({
  hasAccept: Boolean(document.querySelector("[data-partner-assignment-accept]")),
  hasDecline: Boolean(document.querySelector("[data-partner-assignment-decline]")),
  hasTabbar: Boolean(document.querySelector("[data-tasu-app-tabbar]")),
  hasTalkBack: [...document.querySelectorAll("[data-tasu-talk-back]")].some((el) => !el.hidden),
}));

if (!beforeAccept.hasAccept || !beforeAccept.hasDecline) fail("案件確認: 受ける/受けないが表示されていない");
else ok("案件確認: 受ける/受けない表示");
if (!beforeAccept.hasTabbar) fail("案件確認: タブバーなし");
else ok("案件確認: 下部タブバー残存");
if (!beforeAccept.hasTalkBack) fail("案件確認: TALKに戻るなし");
else ok("案件確認: TALKに戻る表示");

const talkBack = page.locator("[data-tasu-talk-back]").first();
const label = (await talkBack.textContent())?.trim();
if (!/TALKに戻る/.test(label || "")) fail(`戻るラベル: ${label}`);
else ok(`戻るボタン: ${label}`);

await page.evaluate(() => {
  document.querySelector("vite-error-overlay")?.remove();
});
await page.evaluate(() => {
  document.querySelector("[data-tasu-talk-back]")?.click();
});
await page.waitForURL(/talk-home\.html/, { timeout: 20000 });
if (!page.url().includes("talk-home.html")) fail(`戻り先: ${page.url()}`);
else ok(`TALKへ戻れた: ${page.url()}`);

// 受諾クリック → スレッドへ遷移（現行仕様）
await page.evaluate(partnerAssignmentInitScript);
await page.goto(assignmentUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
await page.waitForSelector("[data-partner-assignment-accept]", { timeout: 30000 });
await page.locator("[data-partner-assignment-accept]").click();
await page.waitForURL(/mvp-thread\.html/, { timeout: 20000 });
if (!/mvp-thread\.html/.test(page.url())) fail(`受諾後遷移: ${page.url()}`);
else ok(`受諾後: スレッドへ遷移 (${page.url().replace(base, "")})`);

await page.goto(notifyUrl, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
const notifyTabCount = await page.locator('[data-talk-mobile-tab="notify"]').count();
if (notifyTabCount > 0) fail("通知タブがモバイル下部に残っている");
else ok("通知は TALK 内パネル導線（下部 notify タブなし）");

// 4) 通常Builder（from=talk なし）— タブバー・TALK戻るは非表示が正
await page.evaluate(partnerAssignmentInitScript);
await page.goto(
  buildLocalPageUrl(
    base,
    "builder/partner-assignment.html",
    `?role=partner&partnerId=${PARTNER_ID}&projectId=${CAL_PROJECT_ID}`
  ),
  { waitUntil: "domcontentloaded", timeout: 20000 }
);
await page.waitForSelector("[data-partner-assignment-accept]", { timeout: 30000 });
await page.waitForTimeout(600);

const tabbarNormal = await page.locator("[data-tasu-app-tabbar]").count();
if (tabbarNormal > 0) fail("通常Builder: 下部タブバーが表示されている");
else ok("通常Builder: 下部タブバー非表示（from=talk なし）");

const talkBackVisible = await page.evaluate(() =>
  [...document.querySelectorAll("[data-tasu-talk-back]")].some((el) => !el.hidden)
);
if (talkBackVisible) fail("通常Builder: TALKに戻るが表示されている");
else ok("通常Builder: TALKに戻る非表示");

const acceptBtn = await page.locator("[data-partner-assignment-accept]").count();
if (!acceptBtn) fail("通常Builder: 受けるボタンなし");
else ok("通常Builder: 案件確認UIあり");

const padBottom = await page.evaluate(() => getComputedStyle(document.body).paddingBottom);
if (padBottom && padBottom !== "0px") fail(`通常Builder: padding-bottom あり (${padBottom})`);
else ok("通常Builder: padding-bottom なし（シェル未起動）");

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
