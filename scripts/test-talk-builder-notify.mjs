/**
 * TASFUL TALK — Builder通知（board / admin_ops 分離）Playwright 検証
 */
import { chromium } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

const REMOVED_IDS = [
  "builder-estimate-request-001",
  "builder-estimate-received-001",
  "builder-estimate-approved-001",
  "builder-project-new-001",
  "builder-thread-message-001",
  "builder-completion-received-001",
  "builder-invoice-received-001",
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_platform_notify_master_v1",
    "tasful_builder_notify_master_v1",
    "tasful_anpi_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
    "tasful_chat_messages",
    "tasful_official_room_last_seen_v1",
  ].forEach((k) => localStorage.removeItem(k));
});

await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: 20000 });
await page.waitForTimeout(900);

const audit = await page.evaluate((removedIds) => {
  const master = window.TasuTalkData?.BUILDER_NOTIFICATION_MASTER_V1 || [];
  const all = window.TasuTalkData?.getNotifications?.({ applySettings: false }) || [];
  const builderMsgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_builder") || [];
  const mockFriend = document.querySelector('[data-talk-thread-id="talk-mock-friend-001"]');
  const adminOpsVisible = removedIds
    .concat([
      "builder-ops-verify-new-project-001",
      "builder-ops-verify-accepted-001",
      "builder-ops-verify-completion-submit-001",
    ])
    .some((id) => Boolean(document.querySelector(`[data-talk-notify-id="${id}"]`)));
  return {
    masterCount: master.length,
    boardCount: master.filter((n) => n.audienceScope === "builder_board").length,
    adminOpsCount: master.filter((n) => n.audienceScope === "admin_ops").length,
    hasEstimateInMaster: master.some((n) => String(n.id).includes("estimate")),
    hasEstimateInNotify: all.some((n) => removedIds.includes(String(n.id))),
    removedVisible: removedIds.some((id) => Boolean(document.querySelector(`[data-talk-notify-id="${id}"]`))),
    adminOpsVisible,
    applyOk: Boolean(document.querySelector('[data-talk-notify-id="builder-board-apply-001"]')),
    completionOk: Boolean(document.querySelector('[data-talk-notify-id="builder-board-completion-001"]')),
    paymentOk: Boolean(document.querySelector('[data-talk-notify-id="builder-board-payment-001"]')),
    threadOk: Boolean(document.querySelector('[data-talk-notify-id="builder-board-thread-001"]')),
    applyTitle: document
      .querySelector('[data-talk-notify-id="builder-board-apply-001"] .talk-notify-card__title')
      ?.textContent?.trim(),
    applyHref: document
      .querySelector('[data-talk-notify-id="builder-board-apply-001"] [data-talk-notify-action]')
      ?.getAttribute("href"),
    applyAction: document
      .querySelector('[data-talk-notify-id="builder-board-apply-001"] [data-talk-notify-action]')
      ?.textContent?.trim(),
    threadTitle: document
      .querySelector('[data-talk-notify-id="builder-board-thread-001"] .talk-notify-card__title')
      ?.textContent?.trim(),
    threadHref: document
      .querySelector('[data-talk-notify-id="builder-board-thread-001"] [data-talk-notify-action]')
      ?.getAttribute("href"),
    builderTalkEstimate: builderMsgs.some((m) =>
      String(m.notifyCard?.title || m.text || "").includes("見積")
    ),
    mockFriendOk: Boolean(mockFriend),
    platformCount: document.querySelectorAll('[data-talk-notify-id^="platform-"]').length,
    anpiCount: document.querySelectorAll('[data-talk-notify-id^="anpi-"]').length,
  };
}, REMOVED_IDS);

console.log("Audit:", JSON.stringify(audit, null, 2));

let failed = false;
if (audit.hasEstimateInMaster || audit.hasEstimateInNotify || audit.removedVisible) failed = true;
if (audit.adminOpsVisible) failed = true;
if (audit.builderTalkEstimate) failed = true;
if (!audit.applyOk || !audit.completionOk || !audit.paymentOk || !audit.threadOk) failed = true;
if (audit.applyTitle !== "応募がありました") failed = true;
if (audit.applyAction !== "応募者を見る") failed = true;
if (!audit.applyHref?.includes("board-project-detail.html")) failed = true;
if (!audit.applyHref?.includes("view=applications")) failed = true;
if (audit.threadTitle !== "新しいメッセージが届きました") failed = true;
if (!audit.threadHref?.includes("board-thread.html")) failed = true;
if (audit.masterCount !== 21) failed = true;
if (audit.boardCount !== 12) failed = true;
if (audit.adminOpsCount !== 9) failed = true;
if (!audit.mockFriendOk) failed = true;
if (audit.platformCount < 19) failed = true;
if (audit.anpiCount < 6) failed = true;

await browser.close();
process.exit(failed ? 1 : 0);
