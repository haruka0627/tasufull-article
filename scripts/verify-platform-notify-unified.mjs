/**
 * プラット通知統一検証 — 全ルート A–H + 390px スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { BASE_URL, requireDevServer } from "./lib/dev-base-url.mjs";

const OUT_DIR = "screenshots/platform-notify-unified";
const JOB_ID = "job_demo_full_001";
const POSTER_ID = "u_job_demo_full";
const APPLICANT_ID = "u_hiro";

const STORAGE = {
  notifications: "tasful_talk_notifications",
  applications: "tasful_job_applications_v1",
  threads: "tasful_chat_threads",
  fees: "tasful_platform_chat_fees_v1",
  messages: "tasful_chat_messages",
};

const MARKERS = [
  "tasful_platform_notify_master_v1",
  "tasful_platform_notify_master_v2",
  "tasful_platform_fee_notify_master_v1",
  "tasful_platform_fee_notify_master_v2",
];

function assertNoForbiddenHref(href, errors, label) {
  if (!href || href === "#") {
    errors.push(`${label}: href missing`);
    return;
  }
  if (/deal-detail\.html/i.test(href)) errors.push(`${label}: deal-detail forbidden (${href})`);
  if (/order-complete\.html/i.test(href)) errors.push(`${label}: order-complete forbidden (${href})`);
}

async function run() {
  await requireDevServer();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const report = {};

  page.on("dialog", async (d) => d.accept());

  await page.addInitScript(({ markers }) => {
    markers.forEach((k) => localStorage.removeItem(k));
  }, { markers: MARKERS });

  async function resetJobFlowState() {
    await page.evaluate((keys) => {
      localStorage.removeItem(keys.applications);
      localStorage.removeItem(keys.threads);
      localStorage.removeItem(keys.fees);
    }, STORAGE);
  }

  async function seedHireResultDemo() {
    await page.evaluate((keys) => {
      const apps = [
        {
          application_id: "job-app-demo-001",
          job_id: "job_demo_full_001",
          applicant_id: "u_hiro",
          applicant_name: "ひろ",
          status: "selected",
          memo: "Premiere Pro 実務3年。ショート動画制作の実績多数。",
          created_at: "2026-05-28T02:30:00.000Z",
          thread_id: "chat-demo-job-hire-001",
        },
      ];
      localStorage.setItem(keys.applications, JSON.stringify(apps));
      localStorage.setItem(
        keys.threads,
        JSON.stringify([
          {
            id: "chat-demo-job-hire-001",
            threadKind: "job_hire",
            listingId: "job_demo_full_001",
            listingType: "job",
            listingTitle: "YouTubeショート動画編集スタッフ募集",
            applicationId: "job-app-demo-001",
            status: "open",
            buyerId: "u_hiro",
            sellerId: "u_job_demo_full",
          },
        ])
      );
      localStorage.setItem(
        keys.fees,
        JSON.stringify([
          {
            threadId: "chat-demo-job-hire-001",
            listingId: "job_demo_full_001",
            category: "job",
            feeAmount: 550,
            status: "paid",
          },
        ])
      );
    }, STORAGE);
  }

  // --- 通知タブ / TALK ---
  await page.goto(`${BASE_URL}/talk-home.html?tab=notify&userId=${POSTER_ID}&talkDev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(4500);

  const seedAudit = await page.evaluate(() => {
    const list = window.TasuTalkNotifications?.getAll?.() || [];
    const platform = list.filter(
      (n) =>
        window.TasuTalkPlatformNotifyMaster?.isPlatformMasterNotification?.(n) ||
        window.TasuTalkPlatformFeeNotifyMaster?.isPlatformFeeMasterNotification?.(n)
    );
    const legacy = platform.filter(
      (n) =>
        /deal-detail\.html|order-complete\.html|案件詳細|完了報告を確認|チャットで確認/.test(
          `${n.href || ""}${n.targetUrl || ""}${n.title || ""}${n.body || ""}`
        )
    );
    const badBody = platform.filter((n) => String(n.body || "").trim());
    const allowedLabels = new Set(
      window.TasuPlatformNotifyActionLabels?.SEMANTIC_NAVIGATE_LABELS || ["確認する"]
    );
    const badLabel = platform.filter((n) => !allowedLabels.has(String(n.actionLabel || "").trim()));
    const talkCards =
      window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful")?.filter(
        (m) => m.kind === "notify_card"
      ) || [];
    return {
      platformCount: platform.length,
      legacyCount: legacy.length,
      badBodyCount: badBody.length,
      badLabelCount: badLabel.length,
      talkCardCount: talkCards.length,
      ids: platform.map((n) => n.id),
    };
  });
  report.seedAudit = seedAudit;

  if (seedAudit.legacyCount > 0) errors.push(`legacy notify rows: ${seedAudit.legacyCount}`);
  if (seedAudit.badBodyCount > 0) errors.push(`platform body not empty: ${seedAudit.badBodyCount}`);
  if (seedAudit.badLabelCount > 0) errors.push(`invalid actionLabel: ${seedAudit.badLabelCount}`);
  if (seedAudit.talkCardCount < 6) errors.push(`TALK cards ${seedAudit.talkCardCount} < 6`);

  await page.screenshot({ path: path.join(OUT_DIR, "01-notify-tab-390.png") });

  await page.goto(`${BASE_URL}/talk-home.html?tab=chat&room=official_tasful`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, "02-talk-official-390.png") });

  // --- A. 求人応募 ---
  await page.evaluate((keys) => {
    localStorage.setItem(
      keys.applications,
      JSON.stringify([
        {
          application_id: "job-app-demo-full-001",
          job_id: "job_demo_full_001",
          applicant_id: "u_hiro",
          applicant_name: "ひろ",
          status: "applied",
          memo: "Premiere Pro 実務3年。",
          created_at: "2026-05-28T04:45:00.000Z",
        },
      ])
    );
  }, STORAGE);
  await page.goto(`${BASE_URL}/talk-home.html?tab=notify&userId=${POSTER_ID}&talkDev=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  const applyAction = await page.evaluate(() => {
    const row = window.TasuTalkNotifications?.getAll?.()?.find(
      (n) => n.id === "platform-verify-job-full-apply-001"
    );
    return window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
  });
  assertNoForbiddenHref(applyAction?.href, errors, "A apply notify");
  if (applyAction?.label !== "応募を見る") {
    errors.push(`A apply label: ${applyAction?.label}`);
  }
  if (applyAction?.href) {
    await page.goto(new URL(applyAction.href, `${BASE_URL}/`).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
    await page.waitForFunction(
      () =>
        document.querySelector("[data-job-applications-section]:not([hidden])") &&
        document.querySelector("[data-job-app-proceed]"),
      { timeout: 45000 }
    );
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(OUT_DIR, "03-job-applications-390.png") });

    await Promise.all([
      page.waitForURL(/platform-chat-fee-pay\.html/, { timeout: 15000 }),
      page.evaluate(() => document.querySelector("[data-job-app-proceed]")?.click()),
    ]);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, "04-job-fee-pay-550-390.png") });

    await page.click("[data-platform-fee-pay]");
    await page.waitForSelector("[data-platform-fee-complete]:not([hidden])", { timeout: 15000 });
    await page.click("[data-platform-fee-chat-link]");
    await page.waitForURL(/chat-(detail|list)\.html/, { timeout: 15000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, "05-job-chat-after-pay-390.png") });
  }

  // --- B. 求人採用（チャット開始通知） ---
  await page.goto(
    `${BASE_URL}/talk-home.html?tab=notify&userId=${APPLICANT_ID}&talkDev=1&review=chat-demo&demoProfile=job`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForTimeout(3500);
  const hireAction = await page.evaluate(() => {
    const row = window.TasuTalkNotifications?.getAll?.()?.find(
      (n) => n.id === "platform-verify-job-full-applicant-start-001"
    );
    return window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
  });
  assertNoForbiddenHref(hireAction?.href, errors, "B chat-start notify");
  if (hireAction?.label !== "チャットを開く") {
    errors.push(`B chat-start label: ${hireAction?.label}`);
  }
  if (hireAction?.href) {
    await page.goto(new URL(hireAction.href, `${BASE_URL}/`).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", { timeout: 45000 });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(OUT_DIR, "06-job-chat-start-390.png") });
    const onChat = await page.evaluate(() => /chat-detail\.html/.test(location.pathname));
    if (!onChat) errors.push("B: expected chat-detail landing");
  }

  // --- C. スキル Connectなし ---
  await page.goto(`${BASE_URL}/detail-skill.html?id=demo-skill-001&talkDev=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await page.waitForTimeout(600);
  await Promise.all([
    page.waitForURL(/platform-chat-fee-pay\.html/, { timeout: 15000 }),
    page.locator(".cta-consult").first().click(),
  ]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT_DIR, "07-skill-fee-pay-390.png") });
  await page.click("[data-platform-fee-pay]");
  await page.waitForSelector("[data-platform-fee-complete]:not([hidden])", { timeout: 15000 });
  await page.click("[data-platform-fee-chat-link]");
  await page.waitForURL(/chat-(detail|list)\.html/, { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT_DIR, "08-skill-chat-after-pay-390.png") });

  // --- H. Connectあり完了 ---
  await page.goto(`${BASE_URL}/talk-home.html?tab=notify&talkDev=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const completeRow = await page.evaluate(() => {
    const row = window.TasuTalkNotifications?.getAll?.()?.find((n) => n.id === "platform-fee-skill-connect-complete-001");
    const action = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
    return { href: action?.href, title: row?.title, actionLabel: row?.actionLabel, body: row?.body };
  });
  report.completeRow = completeRow;
  if (completeRow.title !== "取引が完了しました") errors.push(`complete title: ${completeRow.title}`);
  if (completeRow.actionLabel !== "確認する") errors.push(`complete actionLabel: ${completeRow.actionLabel}`);
  if (completeRow.body) errors.push("complete body should be empty");
  assertNoForbiddenHref(completeRow.href, errors, "H complete notify");
  await page.screenshot({ path: path.join(OUT_DIR, "09-connect-complete-notify-390.png") });

  if (completeRow.href) {
    await page.goto(new URL(completeRow.href, `${BASE_URL}/`).href, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.TasuPlatformChatCompletion?.ensureDemoSkillDealThread?.());
    await page.waitForTimeout(1200);
    const chatCard = await page.evaluate(() => ({
      hasCompletionCard: Boolean(document.querySelector(".chat-completion-card")),
      hasApprove: Boolean(
        document.querySelector("[data-chat-completion-approve], .chat-completion-card__approve")
      ),
      hasReject: Boolean(
        document.querySelector("[data-chat-completion-reject], .chat-completion-card__reject")
      ),
      hasChatConfirm: /チャットで確認/.test(document.body.textContent || ""),
      hasDealDetailLink: Boolean(document.querySelector('a[href*="deal-detail.html"]')),
    }));
    report.chatCard = chatCard;
    if (!chatCard.hasCompletionCard) errors.push("completion card missing in chat");
    if (chatCard.hasChatConfirm) errors.push("チャットで確認 should not appear");
    if (chatCard.hasDealDetailLink) errors.push("deal-detail link in chat");
    await page.screenshot({ path: path.join(OUT_DIR, "10-connect-complete-chat-card-390.png") });
  }

  // --- D–G: prepay master href audit ---
  await page.goto(`${BASE_URL}/talk-home.html?tab=notify&talkDev=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const prepayAudit = await page.evaluate(() => {
    const ids = [
      "platform-fee-product-prepay-001",
      "platform-fee-worker-prepay-001",
      "platform-fee-business-prepay-001",
      "platform-fee-shop-prepay-001",
    ];
    return ids.map((id) => {
      const row = window.TasuTalkNotifications?.getAll?.()?.find((n) => n.id === id);
      const action = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
      return { id, href: action?.href, title: row?.title, body: row?.body };
    });
  });
  report.prepayAudit = prepayAudit;
  prepayAudit.forEach((row) => {
    assertNoForbiddenHref(row.href, errors, row.id);
    if (!row.href?.includes("platform-chat-fee-pay")) errors.push(`${row.id} pay href`);
    if (row.body) errors.push(`${row.id} body not empty`);
  });

  await browser.close();

  console.log(JSON.stringify(report, null, 2));
  if (errors.length) {
    errors.forEach((e) => console.error(`NG: ${e}`));
    process.exit(1);
  }
  console.log("ALL OK — platform notify unified verified");
}

await run();
