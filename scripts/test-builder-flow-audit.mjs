/**
 * Builder/TALK 導線追加確認（390px / talkDev=1）
 * 1. TALK通知 — 遷移ボタンのみ（builder-board-* / builder-ops-route-*）
 * 2. 案件確認 — partner-assignment で受諾/辞退
 * 3. カレンダー — admin/ops 管理ビュー
 * 4. deal-detail — 管理系のみ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const MVP_KEY = "tasful:builder:mvp:v1";
const PROJECT_ID = "builder_demo_001";
const PARTNER_ID = "demo-partner-001";

const DEPRECATED_NOTIFY_IDS = [
  "builder-project-new-001",
  "builder-completion-received-001",
  "builder-invoice-received-001",
  "builder-estimate-received-001",
  "builder-thread-reply-001",
  "builder-attendance-enter-001",
];

const ACTIVE_NOTIFY_IDS = [
  "builder-ops-route-001",
  "builder-board-apply-001",
  "builder-board-completion-001",
];

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });
let failed = false;

function fail(msg) {
  console.log("NG", msg);
  failed = true;
}

function ok(msg) {
  console.log("OK", msg);
}

function partnerAssignmentInitScript() {
  localStorage.setItem("tasful:builder:mvp:role", "partner");
  localStorage.setItem("tasful:builder:mvp:partner_id", PARTNER_ID);
  try {
    const raw = localStorage.getItem(MVP_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    const idx = (state.projects || []).findIndex((p) => p.project_id === PROJECT_ID);
    if (idx >= 0) {
      state.projects[idx].assignment_status = "pending";
      state.projects[idx].selected_partner_ids = [PARTNER_ID];
      state.projects[idx].calendar_assigned_partner_id = PARTNER_ID;
      localStorage.setItem(MVP_KEY, JSON.stringify(state));
    }
  } catch {
    /* ignore */
  }
}

async function clearTalkStorage(page) {
  await page.addInitScript(() => {
    [
      "tasful_talk_notifications",
      "tasful_builder_notify_master_v1",
      "tasful_talk_notifications_seeded_v2",
      "tasful_chat_messages",
      "tasful_official_room_last_seen_v1",
    ].forEach((k) => localStorage.removeItem(k));
  });
}

function readNotifyCard(page, id) {
  return page.evaluate((notifyId) => {
    const card = document.querySelector(`article[data-talk-notify-id="${notifyId}"]`);
    const actions = card?.querySelectorAll("[data-talk-notify-action]") || [];
    const labels = [...actions].map((a) => a.textContent?.trim());
    const navigateBtn = card?.querySelector('[data-talk-notify-action="navigate"]');
    const row = window.TasuTalkData?.findNotificationById?.(notifyId);
    const href =
      navigateBtn?.getAttribute("data-talk-notify-href") ||
      window.TasuTalkNotifyActions?.resolveTalkMasterHref?.(row) ||
      row?.href ||
      row?.targetUrl ||
      "";
    return {
      id: notifyId,
      visible: Boolean(card),
      actionCount: actions.length,
      labels,
      href,
      hasForbidden: labels.some((l) => /受ける|受けない|承認|差し戻/.test(l || "")),
    };
  }, id);
}

// 1. TALK通知
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await clearTalkStorage(page);
  await page.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=notify&talkDev=1&benchEmbed=1&userId=u_me"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: 20000 });
  await page.waitForTimeout(800);

  for (const id of DEPRECATED_NOTIFY_IDS) {
    const count = await page.locator(`article[data-talk-notify-id="${id}"]`).count();
    if (count > 0) fail(`TALK DEPRECATED ${id}: 一覧に表示`);
    else ok(`TALK DEPRECATED ${id}: 非表示`);
  }

  for (const id of ACTIVE_NOTIFY_IDS) {
    const card = await readNotifyCard(page, id);
    if (!card.visible) {
      fail(`TALK ${id}: カードなし`);
      continue;
    }
    if (card.hasForbidden) fail(`TALK ${id}: 業務操作ラベル (${card.labels.join(", ")})`);
    else ok(`TALK ${id}: 遷移導線のみ (${card.labels.join(", ") || "card/navigate"})`);
    if (!card.href || card.href === "#") fail(`TALK ${id}: 遷移先なし`);
  }

  const opsHref = (await readNotifyCard(page, "builder-ops-route-001")).href;
  if (!opsHref.includes("partner-assignment.html")) fail(`builder-ops-route-001 href: ${opsHref}`);
  else ok("builder-ops-route-001 → partner-assignment");

  const applyHref = (await readNotifyCard(page, "builder-board-apply-001")).href;
  if (!applyHref.includes("board-project-detail.html") || !applyHref.includes("view=applications")) {
    fail(`builder-board-apply-001 href: ${applyHref}`);
  } else ok("builder-board-apply-001 → 応募管理");

  const official = await page.evaluate(() => {
    const msgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_builder") || [];
    const ops = msgs.find((m) => m.notifyCard?.notificationId === "builder-ops-route-001");
    return {
      opsAction: ops?.notifyCard?.actionLabel,
      opsHref: ops?.notifyCard?.href || ops?.notifyCard?.actionHref,
      deprecatedCard: msgs.find((m) => m.notifyCard?.notificationId === "builder-project-new-001"),
    };
  });
  if (official.deprecatedCard) fail("公式トーク: builder-project-new-001 カードが残っている");
  else ok("公式トーク: builder-project-new-001 なし");
  if (official.opsAction === "確認する") ok("公式トーク: builder-ops-route 確認する");
  else ok(`公式トーク: ops案内 ${official.opsAction || "(なし)"}`);

  await page.close();
}

// 2–3. partner-assignment 受諾/辞退
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(partnerAssignmentInitScript);
  await page.goto(
    buildLocalPageUrl(
      base,
      "builder/partner-assignment.html",
      `?role=partner&partnerId=${PARTNER_ID}&projectId=${PROJECT_ID}&talkDev=1`
    ),
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForSelector("[data-partner-assignment-accept]", { timeout: 30000 });
  await page.waitForTimeout(600);

  const partnerBefore = await page.evaluate(() => ({
    hasAccept: Boolean(document.querySelector("[data-partner-assignment-accept]")),
    hasDecline: Boolean(document.querySelector("[data-partner-assignment-decline]")),
    hasLegacyCalAccept: Boolean(document.querySelector("[data-mvp-cal-accept]")),
  }));
  if (!partnerBefore.hasAccept || !partnerBefore.hasDecline) fail("partner assignment: 受ける/受けないなし");
  else ok("partner assignment: 受ける/受けない表示");
  if (partnerBefore.hasLegacyCalAccept) fail("partner assignment: 旧カレンダー accept が混在");
  else ok("partner assignment: 旧カレンダー accept なし");

  await page.locator("[data-partner-assignment-accept]").click();
  await page.waitForURL(/mvp-thread\.html/, { timeout: 20000 });
  if (!page.url().includes("mvp-thread.html")) fail(`accepted: 遷移先 ${page.url()}`);
  else ok("accepted: スレッドへ遷移");

  await page.close();
}

// admin / ops / owner — カレンダー管理ビュー
for (const role of ["admin", "ops", "owner"]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(
    buildLocalPageUrl(base, "builder/mvp-calendar.html", `?role=${role}&projectId=${PROJECT_ID}`),
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForTimeout(1000);
  const audit = await page.evaluate(() => ({
    hasAccept: Boolean(
      document.querySelector("[data-mvp-cal-accept], [data-partner-assignment-accept]")
    ),
    hasAdmin: Boolean(document.querySelector(".mvp-cal-assignment--admin")),
    hasChat: document.body.textContent.includes("チャット確認"),
    hasDetail: document.body.textContent.includes("詳細確認"),
  }));
  if (audit.hasAccept) fail(`${role}: 受ける/受けないが表示`);
  else ok(`${role}: 受ける/受けない非表示`);
  if (!audit.hasAdmin || !audit.hasChat || !audit.hasDetail) fail(`${role}: 確認用表示不足`);
  else ok(`${role}: チャット確認・詳細確認のみ`);
  await page.close();
}

// 4. deal-detail
{
  const cases = [
    {
      name: "worker no hash → partner-assignment",
      url: `/deal-detail.html?id=${PROJECT_ID}&role=worker`,
      expectRedirect: /partner-assignment\.html/,
    },
    {
      name: "#project → partner-assignment",
      url: `/deal-detail.html?id=${PROJECT_ID}&role=worker#project`,
      expectRedirect: /partner-assignment\.html/,
    },
    {
      name: "client #completion",
      url: `/deal-detail.html?id=${PROJECT_ID}#completion`,
      expect: (a) => a.hasApprove && !a.hasAccept && !a.hasProject,
    },
    {
      name: "client #invoice",
      url: `/deal-detail.html?id=${PROJECT_ID}#invoice`,
      expect: (a) => a.hasInvoice && !a.hasAccept && !a.hasProject,
    },
    {
      name: "client #attendance",
      url: `/deal-detail.html?id=${PROJECT_ID}#attendance`,
      expect: (a) => a.hasAttendance && !a.hasAccept && !a.hasProject,
    },
  ];

  for (const spec of cases) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${base}${spec.url}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1200);
    const url = page.url();
    if (spec.expectRedirect) {
      if (!spec.expectRedirect.test(url)) fail(`${spec.name}: redirect failed (${url})`);
      else ok(`${spec.name}: 案件確認へリダイレクト`);
    } else {
      const audit = await page.evaluate(() => ({
        hasAccept: Boolean(document.querySelector("[data-deal-accept]")),
        hasApprove: Boolean(document.querySelector("[data-deal-approve]")),
        hasProject: Boolean(document.getElementById("project")),
        hasInvoice: Boolean(document.getElementById("invoice")),
        hasAttendance: Boolean(document.getElementById("attendance")),
        hasCompletion: Boolean(document.getElementById("completion")),
      }));
      if (!spec.expect(audit)) fail(`${spec.name}: ${JSON.stringify(audit)}`);
      else ok(`${spec.name}: 管理系カードのみ`);
    }
    await page.close();
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
