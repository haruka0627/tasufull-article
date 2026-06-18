/**
 * TASFUL TALK — 通知戻り導線 全サービス統一（390px）
 * 通知URLに from=talk / 戻る → 通知タブ / TALKに戻る / 下部タブバー
 */
import { chromium } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

const RETURN_SAMPLES = [
  { id: "builder-board-apply-001", group: "Builder", expect: /board-project-detail\.html.*from=talk/ },
  { id: "anpi-check-request-001", group: "安否", expect: /anpi-dashboard\.html.*from=talk/ },
  { id: "platform-job-apply-001", group: "求人", expect: /detail-job\.html.*from=talk/ },
  { id: "platform-worker-request-001", group: "ワーカー", expect: /detail-worker\.html.*from=talk/ },
  { id: "platform-business-estimate-001", group: "業務サービス", expect: /deal-detail\.html.*from=talk/ },
  { id: "platform-shop-order-001", group: "店舗", expect: /order-complete\.html.*from=talk/ },
  { id: "platform-system-outage-001", group: "運営", expect: /talk-ops-room\.html.*from=talk/ },
  { id: "platform-job-consult-001", group: "チャット", expect: /chat-detail\.html.*from=talk/ },
  { id: "platform-system-maintenance-001", group: "運営(お知らせ)", expect: /dashboard\.html.*from=talk/ },
  { id: "platform-review-rating-001", group: "レビュー", expect: /profile-settings\.html.*from=talk/ },
];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/talk-home.html`, { method: "HEAD" });
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
const ok = (msg) => console.log("OK", msg);

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_platform_notify_master_v1",
    "tasful_builder_notify_master_v1",
    "tasful_anpi_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
  ].forEach((k) => localStorage.removeItem(k));
  sessionStorage.removeItem("tasu_talk_return_url");
});

// 全マスター通知リンクに from=talk
await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: 25000 });
await page.waitForTimeout(800);

const hrefAudit = await page.evaluate(() =>
  [...document.querySelectorAll("article[data-talk-notify-id]")]
    .filter((c) => /^(builder|platform|anpi|talk-n)-/.test(c.getAttribute("data-talk-notify-id") || ""))
    .map((c) => ({
      id: c.getAttribute("data-talk-notify-id"),
      href: c.querySelector('a[data-talk-notify-action="navigate"]')?.getAttribute("href") || "",
    }))
);

for (const row of hrefAudit) {
  if (!row.href.includes("from=talk")) fail(`通知 ${row.id}: from=talk なし (${row.href})`);
}
ok(`全通知リンク from=talk: ${hrefAudit.length}件`);

async function assertReturnFlow(sample) {
  await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());

  const card = page.locator(`article[data-talk-notify-id="${sample.id}"]`);
  const link = card.locator('a[data-talk-notify-action="navigate"]');
  if (!(await link.count())) {
    fail(`${sample.group} ${sample.id}: 遷移リンクなし`);
    return;
  }

  const href = await link.getAttribute("href");
  if (!href?.includes("from=talk")) fail(`${sample.group} ${sample.id}: href=${href}`);
  else ok(`${sample.group}: from=talk 付与 (${sample.id})`);

  await card.click();
  await page.waitForURL(sample.expect, { timeout: 25000 });
  await page.waitForTimeout(1000);

  const state = await page.evaluate(() => ({
    url: window.location.href,
    hasTalkBack: Boolean(
      document.querySelector("[data-tasu-talk-back]:not([hidden])") ||
        document.querySelector(".talk-ops-back:not([hidden])")
    ),
    talkBackLabel:
      document.querySelector("[data-tasu-talk-back]")?.textContent?.trim() ||
      document.querySelector(".talk-ops-back:not([hidden])")?.textContent?.trim() ||
      "",
    tabCount: document.querySelectorAll("[data-tasu-app-tabbar] [data-tasu-app-tab]").length,
  }));

  if (!sample.expect.test(state.url)) fail(`${sample.group}: URL=${state.url}`);
  if (!state.hasTalkBack) fail(`${sample.group}: TALKに戻るなし`);
  else if (!/TALKに戻る/.test(state.talkBackLabel)) fail(`${sample.group}: 戻るラベル=${state.talkBackLabel}`);
  else ok(`${sample.group}: TALKに戻る表示`);

  if (state.tabCount !== 5) fail(`${sample.group}: タブバー ${state.tabCount}項目`);
  else ok(`${sample.group}: 下部タブバー 5項目`);

  await page.evaluate(() => {
    document.querySelector("vite-error-overlay")?.remove();
    document.querySelector("[data-tasu-talk-back]")?.click();
  });
  await page.waitForURL(/talk-home\.html/, { timeout: 20000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const afterBack = await page.evaluate(() => ({
    url: window.location.href,
    notifyActive: document.querySelector('[data-talk-mobile-tab="notify"]')?.classList.contains("is-active"),
    stored: sessionStorage.getItem("tasu_talk_return_url"),
  }));

  if (!/talk-home\.html/i.test(afterBack.url)) fail(`${sample.group}: 戻り先=${afterBack.url}`);
  else ok(`${sample.group}: TALKへ戻れた`);

  if (!afterBack.url.includes("tab=notify") && !afterBack.notifyActive) {
    fail(`${sample.group}: 通知タブへ戻れていない url=${afterBack.url}`);
  } else ok(`${sample.group}: 通知タブへ戻る`);
}

for (const sample of RETURN_SAMPLES) {
  await assertReturnFlow(sample);
}

// 通常遷移（from=talk なし）は従来動作
await page.goto(`${base}/detail-job.html?id=job_demo_full_001`, { waitUntil: "domcontentloaded", timeout: 20000 });
await page.waitForTimeout(900);
const normal = await page.evaluate(() => ({
  hasTalkBack: Boolean(document.querySelector("[data-tasu-talk-back]:not([hidden])")),
  tabCount: document.querySelectorAll("[data-tasu-app-tabbar] [data-tasu-app-tab]").length,
}));
if (normal.hasTalkBack) fail("通常遷移: TALKに戻るが表示");
else ok("通常遷移: TALKに戻る非表示");
if (normal.tabCount !== 5) fail(`通常遷移: タブバー ${normal.tabCount}`);
else ok("通常遷移: 下部タブバー維持");

await browser.close();
process.exit(failed ? 1 : 0);
