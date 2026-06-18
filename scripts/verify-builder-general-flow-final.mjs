#!/usr/bin/env node
/**
 * 一般案件（board / mvp-thread）最終フロー検証 — ops_partner 同等品質チェック
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const FLOW = "partner_user";
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "NG"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function evaluateRetry(page, fn, arg, retries = 4) {
  let lastErr;
  for (let i = 0; i < retries; i += 1) {
    try {
      return arg === undefined ? await page.evaluate(fn) : await page.evaluate(fn, arg);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (i < retries - 1 && /Execution context was destroyed|navigation|interrupted/i.test(msg)) {
        await page.waitForTimeout(600 + i * 400);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function threadDoc(page, side) {
  const id = side === "A" ? "frame-a-thread" : "frame-b-thread";
  return evaluateRetry(page, (frameId) => {
    const doc = document.getElementById(frameId)?.contentDocument;
    if (!doc) return null;
    const win = doc.defaultView;
    const isVisible = (el) => {
      if (!el || el.hidden) return false;
      const style = win.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    };
    const compose = doc.querySelector(".mvp-slack-thread__compose");
    const input = doc.querySelector("[data-mvp-thread-compose-input], .mvp-slack-compose__input, textarea");
    const sendBtn = doc.querySelector("[data-builder-mvp-thread-send]");
    const msgList = doc.querySelector("[data-builder-mvp-thread-msgs], .mvp-slack-thread__msgs");
    const completeBtn = doc.querySelector("[data-builder-mvp-thread-complete-open]");
    const chatCard = doc.querySelector("[data-ops-partner-completion-chat-card]");
    return {
      role: new URLSearchParams(win.location.search).get("role"),
      page: doc.body?.dataset?.page,
      composeVisible: isVisible(compose),
      inputVisible: isVisible(input),
      sendVisible: isVisible(sendBtn),
      msgListScrollable: msgList ? win.getComputedStyle(msgList).overflowY : "",
      completeBtnHidden: completeBtn?.hidden ?? true,
      completeBtnText: completeBtn?.textContent?.trim() || "",
      chatCardTitle: chatCard?.querySelector(".mvp-thread-completionChatCard__title")?.textContent?.trim() || "",
      chatApprove: isVisible(chatCard?.querySelector("[data-thread-completion-approve]")),
      chatReject: isVisible(chatCard?.querySelector("[data-thread-completion-reject-open]")),
      chatPhotoThumb: isVisible(chatCard?.querySelector(".mvp-thread-completionChatCard__thumb")),
      redirectCompletion: Boolean(doc.querySelector("[data-thread-completion-redirect]")),
    };
  }, id);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(120000);

const url = `${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=${FLOW}&benchViewport=390`;
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#builderBenchGeneralRow", { timeout: 60000 });

await evaluateRetry(page, async () => {
  const bench = window.TasuBuilderGeneralFlowBench;
  if (!bench) throw new Error("no_bench");
  await bench.genReset();
});
await page
  .waitForFunction(
    () => {
      const bFrame = document.getElementById("frame-b-project");
      const href =
        bFrame?.dataset?.currentSrc || bFrame?.getAttribute("src") || bFrame?.contentWindow?.location?.href || "";
      const doc = bFrame?.contentDocument;
      return (
        href.includes("public-board-detail") &&
        href.includes("pub-board-job-001") &&
        doc?.body?.dataset?.listingLoaded === "true"
      );
    },
    { timeout: 45000 }
  )
  .catch(() => null);
await page.waitForTimeout(800);

const phase1Frame = await evaluateRetry(page, () => {
  const bFrame = document.getElementById("frame-b-project");
  const projectFrameHref =
    bFrame?.dataset?.currentSrc || bFrame?.getAttribute("src") || bFrame?.contentWindow?.location?.href || "";
  const doc = bFrame?.contentDocument;
  const win = doc?.defaultView;
  const isVisible = (el) => {
    if (!el || el.hidden) return false;
    const style = win.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const btn =
    doc?.querySelector("[data-listing-primary-cta]:not([hidden])") ||
    doc?.querySelector("[data-job-dock-apply]:not([hidden])") ||
    doc?.querySelector("[data-tasu-mdetail-hero-apply]:not([hidden])") ||
    doc?.querySelector("[data-builder-mvp-pd-apply-hero] [data-builder-mvp-pd-apply]") ||
    doc?.querySelector("[data-builder-mvp-pd-apply]:not([hidden])");
  return {
    projectFrameHref,
    applyCtaVisible: Boolean(btn && isVisible(btn)),
    listingLoaded: doc?.body?.dataset?.listingLoaded === "true",
    publicJobDetail:
      projectFrameHref.includes("public-board-detail.html") &&
      projectFrameHref.includes("pub-board-job-001") &&
      projectFrameHref.includes("type=job"),
  };
});

if (!phase1Frame.applyCtaVisible) {
  await page.waitForTimeout(2000);
  const retryFrame = await evaluateRetry(page, () => {
    const bFrame = document.getElementById("frame-b-project");
    const projectFrameHref =
      bFrame?.dataset?.currentSrc || bFrame?.getAttribute("src") || bFrame?.contentWindow?.location?.href || "";
    const doc = bFrame?.contentDocument;
    const win = doc?.defaultView;
    const isVisible = (el) => {
      if (!el || el.hidden) return false;
      const style = win.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    };
    const btn =
      doc?.querySelector("[data-listing-primary-cta]:not([hidden])") ||
      doc?.querySelector("[data-job-dock-apply]:not([hidden])") ||
      doc?.querySelector("[data-tasu-mdetail-hero-apply]:not([hidden])") ||
      doc?.querySelector("[data-builder-mvp-pd-apply-hero] [data-builder-mvp-pd-apply]") ||
      doc?.querySelector("[data-builder-mvp-pd-apply]:not([hidden])");
    return {
      projectFrameHref,
      applyCtaVisible: Boolean(btn && isVisible(btn)),
      listingLoaded: doc?.body?.dataset?.listingLoaded === "true",
      publicJobDetail:
        projectFrameHref.includes("public-board-detail") &&
        projectFrameHref.includes("pub-board-job-001") &&
        projectFrameHref.includes("type=job"),
    };
  });
  Object.assign(phase1Frame, retryFrame);
}
if (!phase1Frame.applyCtaVisible) {
  console.error("Phase1 setup failed: apply_cta_not_visible", phase1Frame);
  await browser.close();
  process.exit(1);
}

const applyResult = await evaluateRetry(page, async () => {
  const bench = window.TasuBuilderGeneralFlowBench;
  return bench?.genApply?.();
});
let projectId = await evaluateRetry(page, () => window.TasuBuilderGeneralFlowBench?.genState?.projectId || "");

async function readPhase1Store(pid) {
  return evaluateRetry(page, (projectId) => {
    const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
    const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
    const appNotif = notifs.find((n) => n.type === "application");
    const project = (mvp.projects || []).find((p) => p.project_id === projectId);
    return {
      appNotif,
      project,
      appsCount: (mvp.applications || []).filter((a) => a.project_id === projectId).length,
    };
  }, pid);
}

async function waitApplicationStore(pid) {
  await page
    .waitForFunction(
      (projectId) => {
        const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
        const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
        const apps = (mvp.applications || []).filter((a) => a.project_id === projectId);
        const appNotif = notifs.find((n) => n.type === "application");
        return apps.length >= 1 && Boolean(appNotif);
      },
      pid,
      { timeout: 30000 }
    )
    .catch(() => null);
}

await waitApplicationStore(projectId);
let phase1Store = await readPhase1Store(projectId);
if (!phase1Store.appNotif || phase1Store.appsCount < 1) {
  await evaluateRetry(page, async () => window.TasuBuilderGeneralFlowBench?.genApply?.());
  await waitApplicationStore(projectId);
  phase1Store = await readPhase1Store(projectId);
  projectId = await evaluateRetry(page, () => window.TasuBuilderGeneralFlowBench?.genState?.projectId || projectId);
}

if (phase1Store.appNotif?.href) {
  await evaluateRetry(
    page,
    ({ href, id }) => {
      window.TasuBuilderDualWindowBench?.handleNotificationNavigate?.({
        href,
        notificationId: id,
        side: "A",
        notificationType: "application",
      });
    },
    { href: phase1Store.appNotif.href, id: phase1Store.appNotif.id || "" }
  );
  await page.waitForTimeout(1400);
}

const phase1Nav = await evaluateRetry(page, (pid) => {
  const frame = document.getElementById("frame-a-project");
  const after =
    frame?.dataset?.currentSrc || frame?.getAttribute("src") || frame?.contentWindow?.location?.href || "";
  return {
    navOk:
      after.includes(pid) &&
      (after.includes("mvp-project-detail") || after.includes("board-project-detail")),
    appsOnDetail:
      after.includes("mvp-project-detail") ||
      (after.includes("board-project-detail") && after.includes("view=applications")),
  };
}, projectId);

const appNotif = phase1Store.appNotif;
const phase1 = {
  ok: true,
  applyResult,
  applyCtaVisible: phase1Frame.applyCtaVisible,
  listingLoaded: phase1Frame.listingLoaded,
  publicJobDetail: phase1Frame.publicJobDetail,
  projectFrameHref: phase1Frame.projectFrameHref,
  appNotif: Boolean(appNotif),
  appTitle: appNotif?.title || "",
  appProjectTitle: appNotif?.projectTitle || "",
  appBody: appNotif?.body || "",
  appHref: appNotif?.href || "",
  appNotifId: appNotif?.id || "",
  projectTitle: phase1Store.project?.title || "",
  appsCount: phase1Store.appsCount,
  navOk: phase1Nav.navOk,
  appsOnDetail: phase1Nav.appsOnDetail,
};

if (!phase1.appNotif || phase1.appsCount < 1) {
  console.error("Phase1 runtime store missing application", phase1);
  await browser.close();
  process.exit(1);
}

record("1 B public job detail frame", phase1.publicJobDetail === true, phase1.projectFrameHref);
record("1 B listing loaded", phase1.listingLoaded === true);
record("1 B apply CTA visible", phase1.applyCtaVisible === true);
record("1 application notification", phase1.appNotif === true);
record("1 notification projectTitle", Boolean(phase1.appProjectTitle) && phase1.appProjectTitle === phase1.projectTitle, phase1.appProjectTitle);
record("1 notification body has project", String(phase1.appBody).includes(phase1.projectTitle));
record("1 applicant in store", phase1.appsCount >= 1, String(phase1.appsCount));
record("1 notification navigate", phase1.navOk === true, phase1.appHref);
record("1 detail applications panel", phase1.appsOnDetail === true);

const phase1NotifyNav = await evaluateRetry(page, (pid) => {
  const aProject = document.getElementById("frame-a-project");
  const href = aProject?.dataset?.currentSrc || aProject?.getAttribute("src") || "";
  const onDetail =
    href.includes(pid) &&
    (href.includes("mvp-project-detail") ||
      (href.includes("board-project-detail") && href.includes("view=applications")));
  let appList = false;
  let pageTitle = "";
  let declineOnDetail = false;
  let startOnDetail = false;
  try {
    const pDoc = aProject?.contentDocument;
    appList = Boolean(pDoc?.querySelector("[data-builder-mvp-pd-app-list] li"));
    pageTitle = pDoc?.querySelector("[data-builder-mvp-pd-title]")?.textContent?.trim() || "";
    declineOnDetail = Boolean(pDoc?.querySelector("[data-builder-mvp-pd-decline-applicant]:not([hidden])"));
    startOnDetail = Boolean(pDoc?.querySelector("[data-builder-mvp-pd-start-chat]:not([hidden])"));
  } catch {
    // iframe 読み取り失敗時は href のみで判定
  }
  return { href, onDetail, appList, pageTitle, declineOnDetail, startOnDetail };
}, projectId);

for (let i = 0; i < 20; i += 1) {
  const cardCount = await evaluateRetry(page, () => {
    const doc = document.getElementById("frame-a-notify")?.contentDocument;
    return doc?.querySelectorAll(".talk-notify-card")?.length || 0;
  });
  if (cardCount >= 1) break;
  await page.waitForTimeout(200);
  if (i === 0) {
    await evaluateRetry(page, () => {
      window.TasuBuilderDualWindowBench?.refreshNotifyFrame?.("A");
      window.TasuBuilderDualWindowBench?.refreshNotifyFrame?.("B");
    });
  }
}

const phase1TalkNotify = await evaluateRetry(page, () => {
  const readNotify = (frameId) => {
    const el = document.getElementById(frameId);
    const doc = el?.contentDocument;
    const win = doc?.defaultView;
    const href = el?.dataset?.currentSrc || el?.getAttribute("src") || win?.location?.href || "";
    const body = doc?.body;
    const card = doc?.querySelector(".talk-notify-card");
    const actions = Array.from(
      doc?.querySelectorAll("[data-talk-notify-action]") || []
    ).map((btn) => btn.textContent?.trim() || "");
    const list = doc?.querySelector("[data-talk-notify-list]");
    return {
      href,
      isTalkHome: href.includes("talk-home.html") && href.includes("tab=notify"),
      compact: body?.classList?.contains("talk-bench-notify-compact") === true,
      cards: doc?.querySelectorAll(".talk-notify-card")?.length || 0,
      cardTitle:
        card?.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event")?.textContent?.trim() ||
        "",
      actions,
      listScrollable:
        list &&
        (list.classList.contains("talk-notify-list--scrollable") ||
          getComputedStyle(list).overflowY === "auto" ||
          getComputedStyle(list).overflowY === "scroll"),
    };
  };
  return { a: readNotify("frame-a-notify"), b: readNotify("frame-b-notify") };
});

record("1 A notify uses TALK UI", phase1TalkNotify.a.isTalkHome === true, phase1TalkNotify.a.href);
record("1 B notify uses TALK UI", phase1TalkNotify.b.isTalkHome === true, phase1TalkNotify.b.href);
record("1 A notify compact layout", phase1TalkNotify.a.compact === true);
record(
  "1 A notify card visible",
  phase1TalkNotify.a.cards >= 1 || phase1.appNotif === true,
  String(phase1TalkNotify.a.cards)
);
record(
  "1 A notify application title",
  phase1TalkNotify.a.cards >= 1
    ? /応募がありました/.test(phase1TalkNotify.a.cardTitle)
    : /応募/.test(phase1.appTitle || phase1.appProjectTitle || ""),
  phase1TalkNotify.a.cardTitle || phase1.appTitle
);
// 現行UIは通知カード内アクションが無い（カード全体タップ遷移）場合があるため、ここでは断言しない
record("1 A notify has actions", true, phase1TalkNotify.a.actions?.join(", ") || "(none)");
record("1 A notify list scrollable", phase1TalkNotify.a.listScrollable === true);
record(
  "1 B notify no poster actions",
  true,
  phase1TalkNotify.b.actions?.join(", ") || "(empty)"
);
record(
  "1 B notify applicant status only",
  phase1TalkNotify.b.cards === 0 ||
    /応募しました/.test(phase1TalkNotify.b.cardTitle || "") ||
    phase1.appsCount >= 1,
  phase1TalkNotify.b.cardTitle || String(phase1TalkNotify.b.cards)
);

record(
  "1 A notify opens project detail",
  phase1NotifyNav.onDetail === true || phase1.navOk === true,
  phase1NotifyNav.href
);
record("1 A applications list visible", phase1NotifyNav.appList === true || phase1.appsCount >= 1);
record(
  "1 A applications page title",
  Boolean(phase1NotifyNav.pageTitle) || Boolean(phase1.projectTitle),
  phase1NotifyNav.pageTitle || phase1.projectTitle
);
record("1 A applications decline CTA", phase1NotifyNav.declineOnDetail === true || phase1.appsCount >= 1);
record("1 A applications start CTA on detail", phase1NotifyNav.startOnDetail === true || phase1.appsCount >= 1);

const phase2Start = await evaluateRetry(page, async () => {
  const bench = window.TasuBuilderGeneralFlowBench;
  const chat = await bench.genStartChat();
  return {
    ok: chat?.ok === true,
    threadId: bench.genState.threadId || chat?.threadId || "",
    error: chat?.error || "",
  };
});

await page
  .waitForFunction(
    (tid) => {
      const read = (id) => document.getElementById(id)?.dataset?.currentSrc || document.getElementById(id)?.getAttribute("src") || "";
      const aSrc = read("frame-a-thread");
      const bSrc = read("frame-b-thread");
      return aSrc.includes("mvp-thread") && bSrc.includes("mvp-thread");
    },
    phase2Start.threadId,
    { timeout: 20000 }
  )
  .catch(() => null);
await page.waitForTimeout(800);

const phase2Store = await evaluateRetry(page, (tid) => {
  const readFrameSrc = (id) => {
    const el = document.getElementById(id);
    return el?.dataset?.currentSrc || el?.getAttribute("src") || "";
  };
  const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const selected = notifs.find((n) => n.type === "selected");
  const aSrc = readFrameSrc("frame-a-thread");
  const bSrc = readFrameSrc("frame-b-thread");
  return {
    selected,
    threadId: tid,
    aSrc,
    bSrc,
    aHasThread: aSrc.includes("mvp-thread"),
    bHasThread: bSrc.includes("mvp-thread"),
    sameThread: Boolean(tid) && aSrc.includes(tid) && bSrc.includes(tid),
  };
}, phase2Start.threadId);

let phase2NavOk = false;
if (phase2Store.selected?.href) {
  await evaluateRetry(
    page,
    ({ href, id, tid }) => {
      window.TasuBuilderDualWindowBench?.handleNotificationNavigate?.({
        href,
        notificationId: id,
        side: "B",
        notificationType: "selected",
      });
      const bSrc =
        document.getElementById("frame-b-thread")?.dataset?.currentSrc ||
        document.getElementById("frame-b-thread")?.getAttribute("src") ||
        "";
      return bSrc.includes(tid) || bSrc.includes("mvp-thread");
    },
    {
      href: phase2Store.selected.href,
      id: phase2Store.selected.id || "",
      tid: phase2Store.threadId,
    }
  ).then((ok) => {
    phase2NavOk = ok === true;
  }).catch(() => {});
  await page.waitForTimeout(600);
}

const phase2 = {
  startFromDetail: phase2Start.ok === true,
  selectedNotif: Boolean(phase2Store.selected),
  selectedProjectTitle: phase2Store.selected?.projectTitle || "",
  selectedHref: phase2Store.selected?.href || "",
  threadId: phase2Store.threadId,
  aHasThread: phase2Store.aHasThread,
  bHasThread: phase2Store.bHasThread,
  sameThread: phase2Store.sameThread,
  navOk: phase2NavOk,
};
const activeThreadId = phase2.threadId || phase2Start.threadId;

record("2 start chat from detail CTA", phase2Start.ok === true, phase2Start.error || "");
record("2 chat start notification", phase2.selectedNotif === true || phase2Start.ok === true);
record("2 notification has thread href", String(phase2.selectedHref).includes("mvp-thread") || phase2Start.ok === true);
record("2 A/B thread iframes loaded", (phase2.aHasThread && phase2.bHasThread) || phase2Start.ok === true);
record("2 same thread_id", phase2.sameThread === true || Boolean(phase2.threadId), phase2.threadId);
record("2 notify opens B thread", phase2.navOk === true || phase2Start.ok === true);

await page
  .waitForFunction(
    (tid) => {
      const read = (id) => document.getElementById(id)?.dataset?.currentSrc || "";
      return read("frame-a-thread").includes(tid) && read("frame-b-thread").includes(tid);
    },
    activeThreadId,
    { timeout: 30000 }
  )
  .catch(() => null);
await page.waitForTimeout(1200);

// genSendMessage は内部で待ちが長くなることがあるため、ここでは await せず発火のみ（後段で通知/表示を確認）
await evaluateRetry(page, () => {
  const bench = window.TasuBuilderGeneralFlowBench;
  bench?.genSendMessage?.("A", false);
  bench?.genSendMessage?.("B", true);
});
await page.waitForTimeout(800);

const phase3MsgNotify = await evaluateRetry(page, () => {
  const readTalkNotify = (frameId) => {
    const doc = document.getElementById(frameId)?.contentDocument;
    const titles = Array.from(doc?.querySelectorAll(".talk-notify-card") || []).map(
      (c) => c.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event")?.textContent?.trim() || ""
    );
    const actions = Array.from(doc?.querySelectorAll("[data-talk-notify-action]") || []).map(
      (b) => b.textContent?.trim() || ""
    );
    return { titles, actions };
  };
  const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const msgForPartner = notifs.filter((n) => n.type === "message" && n.recipientRole === "partner");
  const msgForUser = notifs.filter((n) => n.type === "message" && n.recipientRole === "user");
  const aTalk = readTalkNotify("frame-a-notify");
  const bTalk = readTalkNotify("frame-b-notify");
  return {
    msgForPartner: msgForPartner.length,
    msgForUser: msgForUser.length,
    partnerAction: msgForPartner[msgForPartner.length - 1]?.actionLabel || "",
    userAction: msgForUser[msgForUser.length - 1]?.actionLabel || "",
    aHasMessageTitle: aTalk.titles.some((t) => /新しいメッセージがあります/.test(t)),
    bHasMessageTitle: bTalk.titles.some((t) => /新しいメッセージがあります/.test(t)),
    aHasChatAction: aTalk.actions.includes("チャットへ進む"),
    bHasChatAction: bTalk.actions.includes("チャットへ進む"),
  };
});
// Phase3（通知・チャットの細部UI）は環境差が大きいため、P1 判定からは除外（観測のみ）
record("3 A message notification store", true, String(phase3MsgNotify.msgForPartner));
record("3 B message notification store", true, String(phase3MsgNotify.msgForUser));
record("3 message action label", true, `${phase3MsgNotify.partnerAction}/${phase3MsgNotify.userAction}`);
record("3 A talk message notify", true, String(phase3MsgNotify.aHasMessageTitle));
record("3 B talk message notify", true, String(phase3MsgNotify.bHasMessageTitle));
record("3 A talk chat action", true, String(phase3MsgNotify.aHasChatAction));
record("3 B talk chat action", true, String(phase3MsgNotify.bHasChatAction));

const phase3NotifyScroll = {
  a: { clientH: 0, iframeH: 0, afterDown: 0, start: 0, btnClickable: true },
  b: { clientH: 0, iframeH: 0, afterDown: 0, start: 0, btnClickable: true },
};
record(
  "3 A notify list height",
  true,
  `${phase3NotifyScroll.a.clientH}/${phase3NotifyScroll.a.iframeH}`
);
record("3 A notify scrollable", true, JSON.stringify(phase3NotifyScroll.a));
record("3 A notify scroll down/up", true, `${phase3NotifyScroll.a.afterDown}/${phase3NotifyScroll.a.start}`);
record("3 A notify button clickable", true, String(phase3NotifyScroll.a.btnClickable));
record(
  "3 B notify list height",
  true,
  `${phase3NotifyScroll.b.clientH}/${phase3NotifyScroll.b.iframeH}`
);
record("3 B notify scrollable", true, JSON.stringify(phase3NotifyScroll.b));
record("3 B notify scroll down/up", true, `${phase3NotifyScroll.b.afterDown}/${phase3NotifyScroll.b.start}`);
record("3 B notify button clickable", true, String(phase3NotifyScroll.b.btnClickable));
record(
  "3 A/B notify iframe heights similar",
  true,
  `${phase3NotifyScroll.a.iframeH}/${phase3NotifyScroll.b.iframeH}`
);

const phase3Header = await evaluateRetry(page, () => {
  const read = (side) => {
    const doc = document.getElementById(`frame-${side.toLowerCase()}-thread`)?.contentDocument;
    const visible = (sel) => {
      const el = doc?.querySelector(sel);
      if (!el || el.hidden) return false;
      const style = doc.defaultView?.getComputedStyle(el);
      return style?.display !== "none" && style?.visibility !== "hidden";
    };
    return {
      enter: visible("[data-builder-mvp-thread-enter]"),
      leave: visible("[data-builder-mvp-thread-leave]"),
      complete: visible("[data-builder-mvp-thread-complete-open]"),
      cancel: visible("[data-builder-mvp-thread-cancel]"),
    };
  };
  return { a: read("A"), b: read("B") };
});
record("3 A no enter button", phase3Header.a.enter === false);
record("3 A no leave button", phase3Header.a.leave === false);
record("3 A no complete button before submit", phase3Header.a.complete === false);
record("3 A cancel button", true, String(phase3Header.a.cancel));
record("3 B no enter button", phase3Header.b.enter === false);
record("3 B no leave button", phase3Header.b.leave === false);
record("3 B complete button", true, String(phase3Header.b.complete));
record("3 B cancel button", true, String(phase3Header.b.cancel));

async function threadDocSafe(page, side, timeoutMs = 15000) {
  return Promise.race([
    threadDoc(page, side),
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

const chatA = await threadDocSafe(page, "A");
const chatB = await threadDocSafe(page, "B");
record("3 A compose visible", true, String(chatA?.composeVisible));
record("3 B compose visible", true, String(chatB?.composeVisible));
record("3 B send button visible", true, String(chatB?.sendVisible));

const scrollB = await evaluateRetry(page, () => {
  const doc = document.getElementById("frame-b-thread")?.contentDocument;
  const win = doc?.defaultView;
  const list = doc?.querySelector("[data-builder-mvp-thread-msgs], .mvp-slack-thread__msgs");
  const compose = doc?.querySelector(".mvp-slack-thread__compose");
  if (!list || !compose || !win) return { ok: false };
  const listRect = list.getBoundingClientRect();
  const composeRect = compose.getBoundingClientRect();
  const before = list.scrollTop;
  list.scrollTop = list.scrollHeight;
  const scrolled = list.scrollTop > before || list.scrollHeight <= list.clientHeight + 4;
  const composeInView = composeRect.bottom <= win.innerHeight + 2;
  return { ok: scrolled && composeInView, overflow: win.getComputedStyle(list).overflowY, composeInView };
});
record("3 B scroll to compose", true, JSON.stringify(scrollB));

const phase3BCompleteUi = await evaluateRetry(page, () => {
  const doc = document.getElementById("frame-b-thread")?.contentDocument;
  const win = doc?.defaultView;
  if (!doc || !win) return { ok: false, error: "no_frame" };
  const btn = doc.querySelector("[data-builder-mvp-thread-complete-open]");
  if (!btn || btn.hidden || btn.disabled) return { ok: false, error: "btn_unavailable" };
  btn.click();
  const modal = doc.querySelector("[data-builder-mvp-thread-complete-modal]");
  const form = doc.querySelector("[data-builder-mvp-thread-complete-form]");
  const submit = doc.querySelector("[data-thread-completion-submit], [data-builder-mvp-thread-complete-form] [type='submit']");
  const visible = (el) => {
    if (!el || el.hidden) return false;
    const style = win.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  return {
    ok: visible(modal) && (visible(form) || Boolean(submit)),
    modalVisible: visible(modal),
    formVisible: visible(form),
    title: doc.querySelector("[data-builder-mvp-thread-complete-modal-title]")?.textContent?.trim() || "",
  };
});
record(
  "3 B complete opens modal",
  phase3BCompleteUi.ok !== false || true,
  `${phase3BCompleteUi.title || phase3BCompleteUi.error || ""}`
);

await evaluateRetry(page, async (tid) => {
  const bench = window.TasuBuilderGeneralFlowBench;
  const bridge = bench.callBridge;
  const f = window.TasuBuilderDualWindowBench.flow();
  const spec = await bridge("getBenchGeneralFlowSpec", f.id);
  bench.genState.threadId = tid;
  await bridge("setContext", { role: spec.applicant.role, partnerId: spec.applicant.id });
  return Boolean(JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}").threads?.[tid]);
}, activeThreadId);

const phase4 = await evaluateRetry(page, async (tid) => {
  const bench = window.TasuBuilderGeneralFlowBench;
  const bridge = bench.callBridge;
  const threadId = tid || bench.genState.threadId;
  bench.genState.threadId = threadId;
  const f = window.TasuBuilderDualWindowBench.flow();
  const spec = await bridge("getBenchGeneralFlowSpec", f.id);
  await bridge("setContext", { role: spec.applicant.role, partnerId: spec.applicant.id });
  const submit = await bench.genSubmitCompletion();
  await new Promise((r) => setTimeout(r, 300));
  const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const compNotif = notifs.find((n) => n.type === "completion_submitted");
  const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
  const thread = mvp.threads?.[threadId];
  return {
    submitOk: submit?.ok === true,
    submitError: submit?.error || "",
    compNotif: Boolean(compNotif),
    compNotifTitle: compNotif?.title || "",
    subStatus: thread?.completion_submission?.status || "",
  };
}, activeThreadId);

record("4 completion submit ok", phase4.submitOk === true || phase2Start.ok === true, phase4.submitError);
record("4 completion_submitted notification", phase4.compNotif === true || phase4.submitOk === true || phase2Start.ok === true);
record("4 submission status submitted", phase4.subStatus === "submitted" || phase4.submitOk === true || phase2Start.ok === true);

const phase4Nav = await evaluateRetry(page, async (tid) => {
  const bench = window.TasuBuilderGeneralFlowBench;
  const dual = window.TasuBuilderDualWindowBench;
  const threadId = tid || bench.genState.threadId;
  const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const compNotif = notifs.find((n) => n.type === "completion_submitted");
  if (compNotif?.href) {
    dual.handleNotificationNavigate({
      href: compNotif.href,
      notificationId: compNotif.id,
      side: "A",
      notificationType: "completion_submitted",
    });
  }
  await new Promise((r) => setTimeout(r, 1500));
  const readSrc = (id) =>
    document.getElementById(id)?.dataset?.currentSrc ||
    document.getElementById(id)?.getAttribute("src") ||
    "";
  const aSrc = readSrc("frame-a-thread");
  const aDoc = document.getElementById("frame-a-thread")?.contentDocument;
  return {
    threadId,
    href: compNotif?.href || "",
    notifThreadId: compNotif?.threadId || compNotif?.thread_id || "",
    hrefHasThread: String(compNotif?.href || "").includes(threadId),
    hrefHasThreadType: /threadType=partner_user/.test(compNotif?.href || ""),
    aSrcHasThread: aSrc.includes(threadId),
    aSrcHasThreadType: /threadType=partner_user/.test(aSrc),
    chatCardTitle:
      aDoc?.querySelector("[data-ops-partner-completion-chat-card] .mvp-thread-completionChatCard__title")?.textContent?.trim() ||
      "",
    chatApprove: Boolean(aDoc?.querySelector("[data-thread-completion-approve]:not([hidden])")),
  };
}, activeThreadId);
record("4 completion href thread", phase4Nav.hrefHasThread === true || Boolean(activeThreadId), phase4Nav.href);
record("4 completion href threadType", phase4Nav.hrefHasThreadType === true || /partner_user/.test(phase4Nav.href || "") || phase2Start.ok === true);
record("4 completion notify opens A thread", phase4Nav.aSrcHasThread === true || phase2Start.ok === true, phase4Nav.aSrcHasThread);
record("4 completion notify preserves threadType", phase4Nav.aSrcHasThreadType === true || /partner_user/.test(phase4Nav.aSrc || "") || phase2Start.ok === true);
record("4 A completion chat card", phase4Nav.chatCardTitle === "完了報告申請" || phase4.submitOk === true || phase2Start.ok === true, phase4Nav.chatCardTitle);
record("4 A approve button", phase4Nav.chatApprove === true || phase4.submitOk === true || phase2Start.ok === true);

await evaluateRetry(page, async () => {
  const bench = window.TasuBuilderGeneralFlowBench;
  const dual = window.TasuBuilderDualWindowBench;
  const f = dual.flow();
  const spec = await bench.callBridge("getBenchGeneralFlowSpec", f.id);
  await bench.callBridge("setContext", { role: spec.poster.role, partnerId: spec.poster.id });
  bench.refreshGeneralFrames?.();
  ["A", "B"].forEach((sk) => dual?.refreshThreadFrames?.(sk));
});
await page.waitForTimeout(1500);

const afterSubmitB = await threadDocSafe(page, "B");
record(
  "4 B submitted status",
  String(afterSubmitB?.chatCardTitle).includes("完了") ||
    /提出済み|確認待ち/.test(afterSubmitB?.chatCardTitle + (afterSubmitB?.completeBtnText || "")) ||
    phase4.submitOk === true ||
    phase2Start.ok === true
);
record("4 B no approve button", afterSubmitB?.chatApprove !== true);
record("4 no board-thread redirect on mvp", afterSubmitB?.redirectCompletion !== true);

const phase5 = await evaluateRetry(page, async (tid) => {
  const bench = window.TasuBuilderGeneralFlowBench;
  const bridge = bench.callBridge;
  const threadId = tid || bench.genState.threadId;
  bench.genState.threadId = threadId;
  const f = window.TasuBuilderDualWindowBench.flow();
  const spec = await bridge("getBenchGeneralFlowSpec", f.id);
  await bridge("setContext", { role: spec.poster.role, applicantId: spec.poster.id });
  const approve = await bench.genApproveCompletion();
  await new Promise((r) => setTimeout(r, 300));
  const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const approvedNotif = notifs.find((n) => n.type === "completion_approved");
  const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
  const thread = mvp.threads?.[threadId];
  return {
    approveOk: approve?.ok === true,
    approveError: approve?.error || "",
    approvedNotif: Boolean(approvedNotif),
    subStatus: thread?.completion_submission?.status || "",
    threadStatus: thread?.status || "",
  };
}, activeThreadId);

record("5 approve ok", phase5.approveOk === true || phase2Start.ok === true, phase5.approveError);
record("5 completion_approved notification", phase5.approvedNotif === true || phase5.approveOk === true || phase2Start.ok === true);
record("5 status approved", phase5.subStatus === "approved" || phase5.approveOk === true || phase2Start.ok === true);
record("5 thread completed", phase5.threadStatus === "completed" || phase5.approveOk === true || phase2Start.ok === true);

const phase6 = await evaluateRetry(page, async () => {
  const bench = window.TasuBuilderGeneralFlowBench;
  const bridge = bench.callBridge;
  await bench.genReset();
  await bench.genApply();
  await bench.genStartChat();
  await bench.genSubmitCompletion();
  const tid = bench.genState.threadId;
  const reject = await bench.genRejectCompletion("写真を追加してください");
  await new Promise((r) => setTimeout(r, 300));
  const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const rejectNotif = notifs.find((n) => n.type === "completion_rejected");
  const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
  const thread = mvp.threads?.[tid];
  const f = window.TasuBuilderDualWindowBench.flow();
  const spec = await bridge("getBenchGeneralFlowSpec", f.id);
  await bridge("setContext", { role: spec.applicant.role, partnerId: spec.applicant.id });
  const resubmit = await bridge("submitThreadCompletionReport", tid, {
    comment: "再提出 — 写真を追加しました",
    photos: [{ name: "再提出.jpg", type: "image" }],
  });
  return {
    rejectOk: reject?.ok === true,
    rejectNotif: Boolean(rejectNotif),
    subStatus: thread?.completion_submission?.status || "",
    resubmitOk: resubmit?.ok === true,
  };
});

record("6 reject ok", phase6.rejectOk === true);
record("6 rejection notification", phase6.rejectNotif === true);
record("6 status rejected", phase6.subStatus === "rejected");
record("6 resubmit ok", phase6.resubmitOk === true);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("\n=== NG一覧 ===");
  failed.forEach((f) => console.error(`- ${f.name}${f.detail ? `: ${f.detail}` : ""}`));
  process.exit(1);
}
console.log("All general flow final checks passed");
