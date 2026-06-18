/**
 * 安否ダッシュボード — 追加確認（390px）
 * 1. 通知タブ・公式トーク → 6ハッシュ遷移
 * 2. 操作後の localStorage 永続化（リロード後も維持）
 * 3. from=talk 戻り（操作後も通知タブへ）
 * 4. settings → anpi-register?from=talk → TALKに戻る
 */
import { chromium } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const DEMO_KEY = "tasful_anpi_notify_demo_v1";

const NOTIFY_SPECS = [
  { id: "anpi-check-request-001", hash: "check", chip: "安否確認", title: "安否確認をお願いします" },
  { id: "anpi-family-response-001", hash: "family", chip: "家族応答", title: "家族からの応答履歴" },
  { id: "anpi-no-response-001", hash: "no-response", chip: "未応答", title: "未応答の家族がいます" },
  { id: "anpi-disaster-info-001", hash: "disaster", chip: "災害情報", title: "災害情報が発表されました" },
  { id: "anpi-drill-001", hash: "drill", chip: "安否訓練", title: "安否訓練のお知らせ" },
  { id: "anpi-setting-updated-001", hash: "settings", chip: "通知設定", title: "通知設定が更新されました" },
];

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

const browser = await chromium.launch({ headless: true });
let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const pass = (msg) => console.log("OK", msg);

function clearStorageScript(key) {
  return () => {
    localStorage.removeItem(key);
    [
      "tasful_talk_notifications",
      "tasful_platform_notify_master_v1",
      "tasful_builder_notify_master_v1",
      "tasful_anpi_notify_master_v1",
      "tasful_talk_notifications_seeded_v2",
    ].forEach((k) => localStorage.removeItem(k));
  };
}

async function freshPage() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(clearStorageScript(DEMO_KEY));
  return page;
}

async function stripViteOverlay(page) {
  await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
}

async function waitDashboardReady(page, hash) {
  await page.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 20000 });
  await page.waitForSelector(`[data-anpi-notify-card="${hash}"] .anpi-notify-anchor__chip`, {
    timeout: 10000,
  });
  await page.waitForTimeout(1000);
}

async function assertLanded(page, spec, source) {
  const landed = await page.evaluate(
    ({ hash, chip }) => {
      const target = document.getElementById(hash);
      const chipSelector =
        hash === "family"
          ? `[data-anpi-notify-card="${hash}"] .anpi-notify-family-history .anpi-notify-anchor__chip`
          : `[data-anpi-notify-card="${hash}"] .anpi-notify-anchor__chip`;
      const cardChip = document.querySelector(chipSelector)?.textContent?.trim();
      return {
        urlHash: location.hash.replace("#", ""),
        fromTalk: /[?&]from=talk(?:&|$)/.test(location.search),
        focus: document.body.classList.contains("anpi-dashboard-page--notify-focus"),
        active: target?.classList.contains("anpi-notify-anchor--active") === true,
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
    landed.urlHash === spec.hash &&
    landed.fromTalk &&
    landed.focus &&
    landed.active &&
    landed.chipOk &&
    landed.hasAction &&
    landed.tabBar;

  if (!ok) fail(`${source} → #${spec.hash}: ${JSON.stringify(landed)}`);
  else pass(`${source} → #${spec.hash}`);
  return ok;
}

// ── 1a. 通知タブから 6ハッシュ ──
console.log("\n=== 1a. 通知タブ ===");
{
  const page = await freshPage();
  for (const spec of NOTIFY_SPECS) {
    await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await stripViteOverlay(page);
    await page.waitForSelector(`[data-talk-notify-id="${spec.id}"]`, { timeout: 15000 });

    const card = page.locator(`article[data-talk-notify-id="${spec.id}"]`);
    const href = await card.locator('[data-talk-notify-action="navigate"]').getAttribute("href");
    if (!href?.includes(`#${spec.hash}`) || !href.includes("from=talk")) {
      fail(`通知タブ ${spec.id}: href不正 → ${href}`);
      continue;
    }

    await Promise.all([
      page.waitForURL((url) => url.href.includes("anpi-dashboard.html"), { timeout: 20000 }),
      card.click(),
    ]);
    await waitDashboardReady(page, spec.hash);
    await assertLanded(page, spec, "通知タブ");
  }
  await page.close();
}

// ── 1b. 公式トーク（official_anpi）から 6ハッシュ ──
console.log("\n=== 1b. 公式トーク ===");
{
  const page = await freshPage();
  await page.goto(`${base}/talk-home.html?tab=chat`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await stripViteOverlay(page);
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    window.TasuTalkLineRoom?.openThreadById?.("official_anpi");
  });
  await page.waitForSelector(".chat-notify-card__action", { timeout: 15000 });

  for (const spec of NOTIFY_SPECS) {
    await page.goto(`${base}/talk-home.html?tab=chat`, { waitUntil: "domcontentloaded" });
    await stripViteOverlay(page);
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.TasuTalkLineRoom?.openThreadById?.("official_anpi"));
    await page.waitForSelector(".chat-notify-card__action", { timeout: 15000 });

    const link = page.locator(".chat-notify-card__action").filter({ hasText: /.+/ });
    const count = await link.count();
    let clicked = false;
    for (let i = 0; i < count; i += 1) {
      const href = await link.nth(i).getAttribute("href");
      if (!href?.includes(`#${spec.hash}`)) continue;
      if (!href.includes("from=talk")) {
        fail(`公式トーク #${spec.hash}: from=talk なし → ${href}`);
        clicked = true;
        break;
      }
      await Promise.all([
        page.waitForURL((url) => url.href.includes("anpi-dashboard.html"), { timeout: 20000 }),
        link.nth(i).click(),
      ]);
      await waitDashboardReady(page, spec.hash);
      await assertLanded(page, spec, "公式トーク");
      clicked = true;
      break;
    }
    if (!clicked) fail(`公式トーク: #${spec.hash} へのリンクなし`);
  }
  await page.close();
}

// ── 2. 操作後の状態永続化（リロード後も維持） ──
console.log("\n=== 2. 状態永続化 ===");
{
  const page = await freshPage();

  // 回答済み
  await page.goto(`${base}/anpi-dashboard.html?from=talk#check`, { waitUntil: "domcontentloaded" });
  await stripViteOverlay(page);
  await waitDashboardReady(page, "check");
  await page.locator('[data-anpi-notify-action="check-safe"]').click();
  await page.waitForSelector("[data-anpi-notify-answered]", { timeout: 5000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitDashboardReady(page, "check");
  const checkPersist = await page.evaluate(
    () => window.TasuAnpiNotifyCards.loadState().check.response === "safe" && Boolean(document.querySelector("[data-anpi-notify-answered]"))
  );
  if (!checkPersist) fail("永続化: 回答済みがリロード後に消えた");
  else pass("永続化: 回答済み");

  // 既読
  await page.goto(`${base}/anpi-dashboard.html?from=talk#family`, { waitUntil: "domcontentloaded" });
  await waitDashboardReady(page, "family");
  await page.locator('[data-anpi-notify-action="family-read"]').click();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitDashboardReady(page, "family");
  const readPersist = await page.evaluate(() => window.TasuAnpiNotifyCards.loadState().family.items[0]?.read === true);
  if (!readPersist) fail("永続化: 既読がリロード後に消えた");
  else pass("永続化: 既読");

  // 再通知済み
  await page.goto(`${base}/anpi-dashboard.html?from=talk#no-response`, { waitUntil: "domcontentloaded" });
  await waitDashboardReady(page, "no-response");
  await page.locator('[data-anpi-notify-action="nr-remind"]').click();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitDashboardReady(page, "no-response");
  const remindPersist = await page.evaluate(
    () => window.TasuAnpiNotifyCards.loadState().noResponse.items[0]?.remindHistory?.length >= 1
  );
  if (!remindPersist) fail("永続化: 再通知履歴がリロード後に消えた");
  else pass("永続化: 再通知済み");

  // 対応済み
  await page.locator('[data-anpi-notify-action="nr-handled"]').click();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitDashboardReady(page, "no-response");
  const handledPersist = await page.evaluate(
    () =>
      window.TasuAnpiNotifyCards.loadState().noResponse.items[0]?.handled === true &&
      Boolean(document.querySelector(".anpi-notify-status--done"))
  );
  if (!handledPersist) fail("永続化: 対応済みがリロード後に消えた");
  else pass("永続化: 対応済み");

  // 訓練完了
  await page.goto(`${base}/anpi-dashboard.html?from=talk#drill`, { waitUntil: "domcontentloaded" });
  await waitDashboardReady(page, "drill");
  await page.locator('[data-anpi-notify-action="drill-join"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-anpi-notify-action="drill-complete"]').click();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitDashboardReady(page, "drill");
  const drillPersist = await page.evaluate(
    () => window.TasuAnpiNotifyCards.loadState().drill.status === "completed"
  );
  if (!drillPersist) fail("永続化: 訓練完了がリロード後に消えた");
  else pass("永続化: 訓練完了");

  await page.close();
}

// ── 3. from=talk 戻り（操作後も通知タブへ） ──
console.log("\n=== 3. from=talk 戻り ===");
{
  const page = await freshPage();
  await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
  await stripViteOverlay(page);
  await page.waitForSelector('[data-talk-notify-id="anpi-check-request-001"]', { timeout: 15000 });

  const card = page.locator('article[data-talk-notify-id="anpi-check-request-001"]');
  await Promise.all([
    page.waitForURL((url) => url.href.includes("anpi-dashboard.html"), { timeout: 20000 }),
    card.click(),
  ]);
  await waitDashboardReady(page, "check");

  await page.locator('[data-anpi-notify-action="check-help"]').click();
  await page.waitForSelector("[data-anpi-notify-answered]", { timeout: 5000 });

  const hasBack = await page.locator("[data-tasu-talk-back]").count();
  if (!hasBack) fail("戻り: TALKに戻るボタンなし");
  else pass("戻り: 操作後もTALKに戻る表示");

  await page.evaluate(() => document.querySelector("[data-tasu-talk-back]")?.click());
  await page.waitForURL(/talk-home\.html/, { timeout: 15000 });
  await page.waitForTimeout(800);

  const returned = await page.evaluate(() => {
    const params = new URLSearchParams(location.search);
    const notifyPanel = document.querySelector('[data-talk-panel="notify"]');
    const notifyVisible = notifyPanel ? !notifyPanel.hidden : false;
    return {
      tab: params.get("tab"),
      notifyVisible,
      onTalkHome: /talk-home\.html/.test(location.pathname),
    };
  });

  if (!returned.onTalkHome || returned.tab !== "notify") {
    fail(`戻り: 通知タブに戻れない → ${JSON.stringify(returned)}`);
  } else {
    pass("戻り: 操作後「TALKに戻る」→ 通知タブ");
  }

  await page.close();
}

// ── 4. settings → anpi-register?from=talk → TALKに戻る ──
console.log("\n=== 4. settings → register → TALK ===");
{
  const page = await freshPage();
  await page.goto(`${base}/anpi-dashboard.html?from=talk#settings`, { waitUntil: "domcontentloaded" });
  await stripViteOverlay(page);
  await waitDashboardReady(page, "settings");

  await Promise.all([
    page.waitForURL((url) => url.href.includes("anpi-register.html"), { timeout: 20000 }),
    page.locator('[data-anpi-notify-action="settings-edit"]').click(),
  ]);
  await page.waitForTimeout(1000);

  const register = await page.evaluate(() => ({
    fromTalk: /[?&]from=talk(?:&|$)/.test(location.search),
    hasTalkBack: Boolean(document.querySelector("[data-tasu-talk-back]:not([hidden])")),
    tabBar: Boolean(document.querySelector("[data-tasu-app-tabbar]")),
    form: Boolean(document.querySelector("[data-anpi-register-form]")),
  }));

  if (!register.fromTalk) fail("register: from=talk なし");
  else pass("register: anpi-register.html?from=talk へ遷移");

  if (!register.form) fail("register: 登録フォームなし");
  else pass("register: 登録フォーム表示");

  if (!register.hasTalkBack) fail("register: TALKに戻るなし");
  else pass("register: TALKに戻る表示");

  if (!register.tabBar) fail("register: タブバーなし");
  else pass("register: タブバー表示");

  await page.evaluate(() => document.querySelector("[data-tasu-talk-back]")?.click());
  await page.waitForURL(/talk-home\.html/, { timeout: 15000 });
  await page.waitForTimeout(800);

  const backOk = await page.evaluate(() => {
    const params = new URLSearchParams(location.search);
    return /talk-home\.html/.test(location.pathname) && params.get("tab") === "notify";
  });

  if (!backOk) fail("register: TALKに戻るで通知タブへ戻れない");
  else pass("register: TALKに戻る → 通知タブ");

  await page.close();
}

await browser.close();
console.log(failed ? "\nFAILED" : "\nALL PASSED");
process.exit(failed ? 1 : 0);
