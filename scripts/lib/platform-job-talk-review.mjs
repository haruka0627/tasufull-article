/**
 * Platform 求人 → TASFUL Talk 連携 — Review 共通ヘルパー
 */
import { buildLocalPageUrl } from "./dev-server-url.mjs";

export const PLATFORM_JOB_TALK_CFG = Object.freeze({
  listingId: "job_demo_full_001",
  applicationId: "job-app-demo-001",
  posterUserId: "u_job_demo_full",
  applicantUserId: "u_hiro",
  applyNotifyId: "platform-verify-job-full-apply-001",
  hiredNotifyId: "platform-verify-job-full-applicant-start-001",
});

export const PLATFORM_JOB_TALK_STORAGE = Object.freeze({
  threads: "tasful_chat_threads",
  messages: "tasful_chat_messages",
  fees: "tasful_platform_chat_fees_v1",
  applications: "tasful_job_applications_v1",
  notifications: "tasful_talk_notifications",
  notifySeed: "tasful_talk_notifications_seeded_v2",
});

/**
 * @param {import('playwright').Page} page
 * @param {string} base
 */
export async function resetPlatformJobTalkState(page, base) {
  await page.goto(buildLocalPageUrl(base, "index-top.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => {
    Object.values(keys).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("tasful_platform_notify_master_v2");
  }, PLATFORM_JOB_TALK_STORAGE);
}

/**
 * @param {import('playwright').Page} page
 */
export async function waitJobApplicationsReady(page) {
  await page.waitForFunction(
    () => {
      window.TasuJobDetailApplications?.refresh?.(
        window.__tasuDetailContactListing || window.__tasuDetailFavoriteListing
      );
      const section = document.querySelector("[data-job-applications-section]");
      return section && !section.hidden;
    },
    { timeout: 45000 }
  );
  await page.locator("[data-job-applications-list] .job-app-card, [data-job-app-card]").first().waitFor({
    state: "visible",
    timeout: 20000,
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} [applicationId]
 */
export async function clickJobProceedForApplication(page, applicationId = PLATFORM_JOB_TALK_CFG.applicationId) {
  const appId = String(applicationId || "").trim();
  const card = page.locator(`[data-application-id="${appId}"]`).first();
  if ((await card.count()) > 0) {
    await card.locator("[data-job-app-proceed]").first().click();
    return;
  }
  const fallback = page.locator("[data-job-app-proceed]").first();
  if ((await fallback.count()) < 1) throw new Error("やりとりに進む button missing");
  await fallback.click();
}

/** @param {import('playwright').Page} page @param {string} base */
export async function ensureTalkDevOnFeePay(page, base) {
  if (!/platform-chat-fee-pay/i.test(page.url())) return;
  const u = new URL(page.url());
  if (u.searchParams.get("talkDev") === "1") return;
  u.searchParams.set("talkDev", "1");
  await page.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("[data-platform-fee-pay]").first().waitFor({ state: "visible", timeout: 15000 });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} base
 * @param {string} posterUserId
 */
export async function completeFeePayAndOpenChat(page, base, posterUserId) {
  await ensureTalkDevOnFeePay(page, base);
  const completeVisible = await page
    .locator("[data-platform-fee-complete]")
    .isVisible()
    .catch(() => false);
  if (!completeVisible) {
    page.on("dialog", (d) => d.accept());
    await page.locator("[data-platform-fee-pay]").first().click();
    await page.waitForFunction(
      () => !document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
      { timeout: 20000 }
    );
  }
  const chatHref = await page.evaluate(() => {
    const href = document.querySelector("[data-platform-fee-chat-link]")?.getAttribute("href") || "";
    return href && href !== "#" ? href : "";
  });
  if (!chatHref) throw new Error("chat link missing after fee pay");
  const chatUrl = chatHref.startsWith("http") ? chatHref : buildLocalPageUrl(base, chatHref.replace(/^\//, ""));
  const u = new URL(chatUrl);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", posterUserId);
  await page.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!/chat-detail/i.test(page.url())) throw new Error(`expected chat-detail, got ${page.url()}`);
  const threadId = new URL(page.url()).searchParams.get("thread") || "";
  return { threadId, chatUrl: page.url() };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} base
 * @returns {Promise<{ threadId: string, chatUrl: string, applicationId: string }>}
 */
export async function navigatePlatformJobToTalk(page, base) {
  const cfg = PLATFORM_JOB_TALK_CFG;
  const appsUrl = buildLocalPageUrl(
    base,
    `detail-job.html?id=${cfg.listingId}&userId=${cfg.posterUserId}&talkDev=1#applications`
  );
  await page.goto(appsUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await waitJobApplicationsReady(page);

  await Promise.all([
    page.waitForURL(/platform-chat-fee-pay/i, { timeout: 20000 }),
    clickJobProceedForApplication(page, cfg.applicationId),
  ]);
  await ensureTalkDevOnFeePay(page, base);
  await page.waitForTimeout(400);

  const applicationId = new URL(page.url()).searchParams.get("applicationId") || cfg.applicationId;

  page.on("dialog", (d) => d.accept());
  await page.locator("[data-platform-fee-pay]").first().click();
  await page.waitForFunction(
    () => !document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
    { timeout: 20000 }
  );
  await page.waitForTimeout(400);

  const chatHref = await page.evaluate(() => {
    const link = document.querySelector("[data-platform-fee-chat-link]");
    const href = link?.getAttribute("href") || "";
    return href && href !== "#" ? href : "";
  });
  if (!chatHref) throw new Error("chat link missing after fee pay");

  const chatUrl = chatHref.startsWith("http") ? chatHref : buildLocalPageUrl(base, chatHref.replace(/^\//, ""));
  const threadId = new URL(chatUrl, base).searchParams.get("thread") || "";
  if (!threadId) throw new Error("threadId missing after fee pay");

  const chatWithDev = (() => {
    const u = new URL(chatUrl);
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("userId", cfg.posterUserId);
    return u.toString();
  })();

  await page.goto(chatWithDev, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", { timeout: 25000 }).catch(() => null);
  await page.locator("#chatMessages, #chatInput").first().waitFor({ state: "visible", timeout: 15000 });

  return { threadId, chatUrl: page.url(), applicationId };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} threadId
 */
export async function readPlatformJobTalkDiagnostics(page, threadId) {
  const cfg = PLATFORM_JOB_TALK_CFG;
  return page.evaluate(
    ({ tid, keys, cfg: c }) => {
      const threads = JSON.parse(localStorage.getItem(keys.threads) || "[]");
      const msgs = JSON.parse(localStorage.getItem(keys.messages) || "{}");
      const apps = JSON.parse(localStorage.getItem(keys.applications) || "[]");
      const list = Array.isArray(threads) ? threads : [];
      const row =
        list.find((t) => String(t.id) === String(tid)) ||
        list.find((t) => String(t.threadKind) === "job_hire" && String(t.listingId) === c.listingId);
      const id = tid || row?.id || "";
      const messages = msgs[id] || [];
      const jobCard = messages.find((m) => m.kind === "job_application_card" || m.kind === "job_hired_card");
      const app =
        apps.find((a) => String(a.thread_id) === String(id)) ||
        apps.find((a) => String(a.application_id) === c.applicationId);
      const onChat = /chat-detail/i.test(globalThis.location?.pathname || "");
      const hasDomJobCard = onChat
        ? Boolean(
            document.querySelector("[data-platform-job-application-card], .chat-job-card, .chat-job-card__title")
          )
        : false;
      return {
        threadId: id || null,
        roomId: id || null,
        threadKind: row?.threadKind || null,
        threadStatus: row?.status || null,
        listingId: row?.listingId || app?.job_id || null,
        applicationId: row?.applicationId || app?.application_id || null,
        listingTitle: row?.listingTitle || jobCard?.jobApplicationCard?.jobTitle || null,
        posterUserId: row?.sellerId || row?.posterUserId || c.posterUserId,
        applicantUserId: row?.buyerId || row?.applicantUserId || app?.applicant_id || c.applicantUserId,
        partnerUserId: row?.partnerUserId || row?.buyerId || null,
        applicationStatus: app?.status || null,
        messageCount: messages.length,
        hasJobApplicationCard: Boolean(jobCard) || hasDomJobCard,
        hasDomJobCard,
        jobCardTitle: jobCard?.jobApplicationCard?.jobTitle || null,
        hasBuilderWorkflowState: Boolean(localStorage.getItem("tasful:talk:builder-workflow-state:v1")),
      };
    },
    { tid: threadId, keys: PLATFORM_JOB_TALK_STORAGE, cfg: PLATFORM_JOB_TALK_CFG }
  );
}

/** @param {import('playwright').Page} page */
export async function probeBuilderWorkflowMisdisplay(page) {
  const panelVisible = await page
    .locator("#talkBuilderWorkflowPanel:not([hidden])")
    .isVisible()
    .catch(() => false);
  const workflowButtons = await page.locator("[data-talk-builder-next]:visible").count();
  const enterExit = await page
    .locator(
      '[data-talk-builder-next][data-next-status="started"], [data-talk-builder-next][data-next-status="working"], [data-talk-builder-next][data-next-status="left"]'
    )
    .count();
  const panelText = ((await page.locator("#talkBuilderWorkflowPanel").textContent().catch(() => "")) || "").trim();
  return {
    builderPanelVisible: panelVisible,
    visibleWorkflowButtons: workflowButtons,
    enterExitButtons: enterExit,
    platformJobCompleteButtons: await page.locator("#chatCompleteBtn, #chatApproveCompleteBtn").count(),
    hasCommissionPctText: /5\s*[〜~\-]\s*10\s*%/.test(panelText) || /案件手数料/.test(panelText),
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} base
 * @param {string} userId
 * @param {string} notifyId
 */
export async function probePlatformNotifyCard(page, base, userId, notifyId) {
  const url = buildLocalPageUrl(base, `talk-home.html?tab=notify&userId=${userId}&talkDev=1`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => (window.TasuTalkNotifications?.getAll?.() || []).length >= 1,
    { timeout: 45000 }
  );
  await page.waitForTimeout(600);
  return page.evaluate((id) => {
    const rows = window.TasuTalkNotifications?.getAll?.() || [];
    const row = rows.find((n) => String(n.id) === id);
    const card = document.querySelector(`article[data-talk-notify-id="${id}"]`);
    return {
      notifyFound: Boolean(row),
      notifyTitle: row?.title || null,
      cardVisible: Boolean(card),
      cardUnread: Boolean(card?.querySelector(".talk-notify-card.is-unread, [data-talk-notify-unread]")),
    };
  }, notifyId);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} text
 */
export async function sendPlatformChatMessage(page, text) {
  await page
    .waitForFunction(
      () => {
        const input = document.getElementById("chatInput");
        if (!input || input.hidden) return false;
        const style = globalThis.getComputedStyle(input);
        return style.display !== "none" && style.visibility !== "hidden";
      },
      { timeout: 25000 }
    )
    .catch(async () => {
      const snippet = await page.evaluate(
        () => document.querySelector(".chat-room-unavailable__title")?.textContent || document.body.innerText.slice(0, 200)
      );
      throw new Error(`chat composer unavailable: ${snippet}`);
    });
  const input = page.locator("#chatInput");
  if (await input.isDisabled()) throw new Error("chat composer disabled");
  await input.fill(text);
  await page.locator("#chatSend").click();
  await page.waitForTimeout(700);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} base
 * @param {string} threadId
 * @param {string} userId
 */
export async function openPlatformChatAsUser(page, base, threadId, userId) {
  const url = buildLocalPageUrl(
    base,
    `chat-detail.html?thread=${encodeURIComponent(threadId)}&userId=${encodeURIComponent(userId)}&talkDev=1`
  );
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .waitForFunction(() => document.body.dataset.chatDetailReady === "true", { timeout: 30000 })
    .catch(() => null);
  await page.locator("#chatMessages").waitFor({ state: "visible", timeout: 20000 });
  await page
    .waitForFunction(
      () => {
        const input = document.getElementById("chatInput");
        return Boolean(input && !input.hidden);
      },
      { timeout: 20000 }
    )
    .catch(() => null);
  return url;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} expectedSnippet
 */
export async function chatMessagesContain(page, expectedSnippet) {
  const text = (await page.locator("#chatMessages").textContent()) || "";
  return text.includes(expectedSnippet);
}
