#!/usr/bin/env node
/**
 * ops_partner 完了報告 UI — role 分岐検証
 * B: 提出フォームのみ / A: 確認・承認のみ（提出前は空表示）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function threadDoc(page, side) {
  const id = side === "A" ? "frame-a-thread" : "frame-b-thread";
  return page.evaluate((frameId) => {
    const doc = document.getElementById(frameId)?.contentDocument;
    if (!doc) return null;
    const role = new URLSearchParams(doc.defaultView.location.search).get("role");
    const completeBtn = doc.querySelector("[data-builder-mvp-thread-complete-open]");
    const isVisible = (el) => {
      if (!el || el.hidden) return false;
      const style = doc.defaultView.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    };
    const submitForm = doc.querySelector("[data-thread-completion-form]");
    const submitCard = doc.querySelector("[data-thread-completion-card='submit']");
    const reviewCard = doc.querySelector("[data-thread-completion-card='review']");
    const emptyCard = doc.querySelector("[data-thread-completion-card='empty']");
    const sitePhotoAdd = doc.querySelector("[data-site-photo-add]");
    const modal = doc.querySelector("[data-builder-mvp-thread-complete-modal]");
    const sitePhotoModal = doc.querySelector("[data-builder-mvp-site-photo-modal]");
    const modalBody = doc.querySelector("[data-builder-mvp-thread-complete-modal-body]");
    const modalSubmitForm = modalBody?.querySelector("[data-builder-mvp-thread-complete-form]");
    const modalReview = modalBody?.querySelector("[data-thread-completion-card='review']");
    const modalEmpty = modalBody?.querySelector("[data-thread-completion-card='empty']");
    const modalOpen = modal && !modal.hidden && isVisible(modal);
    const sitePhotoModalOpen = sitePhotoModal && !sitePhotoModal.hidden && isVisible(sitePhotoModal);
    const photosPanel = doc.querySelector(".mvp-sitePhotosPanel");
    const photosPanelVisible =
      photosPanel && !photosPanel.hidden && isVisible(photosPanel);
    const completionChatCard = doc.querySelector("[data-ops-partner-completion-chat-card]");
    const chatApproveBtn = completionChatCard?.querySelector("[data-thread-completion-approve]");
    const chatRejectBtn = completionChatCard?.querySelector("[data-thread-completion-reject-open]");
    const chatPhotoThumb = completionChatCard?.querySelector(".mvp-thread-completionChatCard__thumb");
    return {
      role,
      completeBtnHidden: completeBtn?.hidden ?? true,
      completeBtnText: completeBtn?.textContent?.trim() || "",
      submitForm: isVisible(submitForm),
      submitCard: isVisible(submitCard),
      reviewCard: Boolean(reviewCard),
      emptyCard: Boolean(emptyCard),
      sitePhotoAdd: Boolean(sitePhotoAdd),
      modalOpen,
      sitePhotoModalOpen,
      photosPanelVisible,
      completionChatCardTitle: completionChatCard?.querySelector(".mvp-thread-completionChatCard__title")?.textContent?.trim() || "",
      chatApproveBtn: isVisible(chatApproveBtn),
      chatRejectBtn: isVisible(chatRejectBtn),
      chatPhotoThumb: isVisible(chatPhotoThumb),
      modalSubmitForm: Boolean(modalSubmitForm),
      modalReview: Boolean(modalReview),
      modalEmpty: Boolean(modalEmpty),
    };
  }, id);
}

async function openCompletionModal(page, side) {
  const id = side === "A" ? "frame-a-thread" : "frame-b-thread";
  await page.evaluate((frameId) => {
    const doc = document.getElementById(frameId)?.contentDocument;
    const win = doc?.defaultView;
    if (win?.__openMvpThreadCompletion) {
      win.__openMvpThreadCompletion();
      return;
    }
    const btn = doc?.querySelector("[data-builder-mvp-thread-complete-open]");
    btn?.click();
  }, id);
  await page.waitForTimeout(400);
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(90000);

const url = `${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner&benchViewport=390`;
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#opsAddCalendarBtn", { timeout: 60000 });

const cyclePre = await page.evaluate(async () => {
  const ops = window.TasuBuilderOpsPartnerBench;
  const bench = window.TasuBuilderDualWindowBench;
  if (!ops || !bench) return { ok: false, error: "no_bench" };
  const add = await ops.opsAddCalendar();
  if (!add?.ok) return { ok: false, step: "add" };
  const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const calNotif = notifs.find((n) => n.type === "calendar_assignment");
  if (calNotif) {
    bench.handleNotificationNavigate({
      href: calNotif.href,
      notificationId: calNotif.id,
      side: "B",
      slot: "project",
      notificationType: "calendar_assignment",
    });
  }
  await new Promise((r) => setTimeout(r, 500));
  const accept = await ops.opsPartnerAccept();
  if (!accept?.ok) return { ok: false, step: "accept" };
  await ops.opsPartnerEnter();
  await ops.opsPartnerExit();
  return { ok: true, threadId: ops.opsState?.threadId };
});
record("pre-complete setup", cyclePre?.ok === true, cyclePre?.step || cyclePre?.error || "");

await page.waitForTimeout(1500);

const aPre = await threadDoc(page, "A");
const bPre = await threadDoc(page, "B");

record("A role=owner", aPre?.role === "owner", aPre?.role || "");
record("B role=partner", bPre?.role === "partner", bPre?.role || "");
record("A no inline submit form", !aPre?.submitForm && !aPre?.submitCard);
record(
  "B completion panel hidden in bench",
  await page.evaluate(() => {
    const doc = document.getElementById("frame-b-thread")?.contentDocument;
    const panel = doc?.querySelector(".mvp-thread-completionPanel");
    if (!panel) return true;
    return doc.defaultView.getComputedStyle(panel).display === "none";
  })
);
record("A no site photo add", !aPre?.sitePhotoAdd);
record("A complete btn hidden before submit", aPre?.completeBtnHidden === true);
record("B complete btn visible", bPre?.completeBtnHidden === false);
record("B complete btn label", bPre?.completeBtnText === "完了報告", bPre?.completeBtnText || "");
record("A modal closed on thread load", !aPre?.modalOpen);
record("B modal closed on thread load", !bPre?.modalOpen);
record("A site photo modal closed on load", !aPre?.sitePhotoModalOpen);
record("B site photo modal closed on load", !bPre?.sitePhotoModalOpen);
record("A photos panel hidden on load", !aPre?.photosPanelVisible);
record("B photos panel hidden on load", !bPre?.photosPanelVisible);
record("A no visible modal submit on thread load", !aPre?.modalOpen || !aPre?.modalSubmitForm);
record("B no visible modal submit on thread load", !bPre?.modalOpen);

await openCompletionModal(page, "B");
const bModalPre = await threadDoc(page, "B");
record("B modal has submit form", bModalPre?.modalSubmitForm === true);
record("B modal no review card", !bModalPre?.modalReview);
await page.evaluate(() => {
  const doc = document.getElementById("frame-b-thread")?.contentDocument;
  doc?.querySelector("[data-builder-mvp-thread-complete-close]")?.click();
  const modal = doc?.querySelector("[data-builder-mvp-thread-complete-modal]");
  if (modal) modal.hidden = true;
});

await openCompletionModal(page, "A");
const aModalPre = await threadDoc(page, "A");
record("A modal empty before submit", aModalPre?.modalEmpty === true || !aModalPre?.modalSubmitForm);
record("A modal no submit form", !aModalPre?.modalSubmitForm);

const submit = await page.evaluate(async () => {
  const ops = window.TasuBuilderOpsPartnerBench;
  return ops.opsPartnerComplete();
});
record("partner submits report", submit?.ok === true);

await page.waitForTimeout(1200);

const aPost = await threadDoc(page, "A");
const bPost = await threadDoc(page, "B");

record("A complete btn after submit", aPost?.completeBtnText === "完了報告を確認", aPost?.completeBtnText || "");
record("A complete btn visible after submit", aPost?.completeBtnHidden === false);
record("B complete btn hidden after submit", bPost?.completeBtnHidden === true);
record("A chat completion request card", aPost?.completionChatCardTitle === "完了報告申請", aPost?.completionChatCardTitle || "");
record("A chat approve button", aPost?.chatApproveBtn === true);
record("A chat reject button", aPost?.chatRejectBtn === true);
record("A chat photo thumbnail", aPost?.chatPhotoThumb === true);
record("B no chat approve button", !bPost?.chatApproveBtn);
record("B no chat reject button", !bPost?.chatRejectBtn);

await openCompletionModal(page, "A");
const aModalPost = await threadDoc(page, "A");
record("A modal review after submit", aModalPost?.modalReview === true);
record("A modal no submit after submit", !aModalPost?.modalSubmitForm);

const talkOpen = await page.evaluate(async (threadId) => {
  const bench = window.TasuBuilderDualWindowBench;
  if (!bench?.handleNotificationNavigate || !threadId) {
    return { ok: false, reason: "no_bench_or_thread" };
  }
  const talkRaw = localStorage.getItem("tasful:talk:notifications:v1");
  const talkNotifs = talkRaw ? JSON.parse(talkRaw) : [];
  const builderRaw = localStorage.getItem("tasful:builder:mvp:notifications:v1");
  const builderNotifs = builderRaw ? JSON.parse(builderRaw) : [];
  const msgNotif =
    talkNotifs.find(
      (n) =>
        String(n.href || "").includes("mvp-thread.html") &&
        (n.type === "message" || n.type === "builder" || String(n.actionLabel || "").includes("チャット"))
    ) ||
    builderNotifs.find((n) => String(n.href || "").includes("mvp-thread.html")) ||
    null;
  let href =
    msgNotif?.href ||
    `builder/mvp-thread.html?thread_id=${encodeURIComponent(threadId)}&role=owner&threadType=ops_partner&notifyOpen=1`;
  if (href.includes("#completion") || href.includes("completion=1") || href.includes("openCompletion=1")) {
    return { ok: false, reason: "bad_href", href };
  }
  if (!href.includes("notifyOpen=1")) {
    href += href.includes("?") ? "&notifyOpen=1" : "?notifyOpen=1";
  }
  let partnerHref = href.replace(/role=owner/i, "role=partner");
  if (!partnerHref.includes("notifyOpen=1")) {
    partnerHref += partnerHref.includes("?") ? "&notifyOpen=1" : "?notifyOpen=1";
  }
  bench.handleNotificationNavigate({
    href,
    notificationId: msgNotif?.id || "verify-chat-open-a",
    side: "A",
    slot: "thread",
    notificationType: msgNotif?.type || "message",
  });
  await new Promise((r) => setTimeout(r, 700));
  bench.handleNotificationNavigate({
    href: partnerHref,
    notificationId: msgNotif?.id || "verify-chat-open-b",
    side: "B",
    slot: "thread",
    notificationType: msgNotif?.type || "message",
  });
  await new Promise((r) => setTimeout(r, 1200));
  const readSide = (side) => {
    const frameId = side === "A" ? "frame-a-thread" : "frame-b-thread";
    const doc = document.getElementById(frameId)?.contentDocument;
    if (!doc) return null;
    const isVisible = (el) => {
      if (!el || el.hidden) return false;
      const style = doc.defaultView.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    };
    const modal = doc.querySelector("[data-builder-mvp-thread-complete-modal]");
    const sitePhotoModal = doc.querySelector("[data-builder-mvp-site-photo-modal]");
    const submitForm = doc.querySelector("[data-thread-completion-form]");
    const submitCard = doc.querySelector("[data-thread-completion-card='submit']");
    const modalBody = doc.querySelector("[data-builder-mvp-thread-complete-modal-body]");
    const modalSubmitForm = modalBody?.querySelector("[data-builder-mvp-thread-complete-form]");
    return {
      modalOpen: modal && !modal.hidden && isVisible(modal),
      sitePhotoModalOpen: sitePhotoModal && !sitePhotoModal.hidden && isVisible(sitePhotoModal),
      submitForm: isVisible(submitForm),
      submitCard: isVisible(submitCard),
      modalSubmitForm: Boolean(modalSubmitForm) && modal && !modal.hidden && isVisible(modal),
    };
  };
  return { ok: true, href, a: readSide("A"), b: readSide("B") };
}, cyclePre?.threadId);
record("TALK chat-open href clean", talkOpen?.ok === true, talkOpen?.reason || talkOpen?.href || "");
record("A modal closed after TALK open", !talkOpen?.a?.modalOpen);
record("B modal closed after TALK open", !talkOpen?.b?.modalOpen);
record("A site photo modal closed after TALK open", !talkOpen?.a?.sitePhotoModalOpen);
record("B site photo modal closed after TALK open", !talkOpen?.b?.sitePhotoModalOpen);
record(
  "A no submit after TALK open",
  !talkOpen?.a?.submitForm && !talkOpen?.a?.submitCard && !talkOpen?.a?.modalSubmitForm
);
record("B no inline submit after TALK open", !talkOpen?.b?.submitForm && !talkOpen?.b?.submitCard);

});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("Failures:", failed.map((f) => f.name).join(", "));
  await closeAllBrowsers();
  process.exit(1);
}
console.log("All completion role UI checks passed");
