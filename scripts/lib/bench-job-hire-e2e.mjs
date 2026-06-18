/**
 * job-0 ベンチ — 550円→承諾通知→B CTA フルフロー E2E ヘルパー
 */
import fs from "fs";
import path from "path";

export const BUYER_ID = "u_hiro";
export const POSTER_ID = "u_job_demo_full";
export const HIRED_TITLE = "応募が承諾されました";
export const APPLY_TITLE_RE = /応募.*(ありました|届きました)/;
export const HIRED_TITLE_RE = /応募が承諾されました/;

export function readFrameHref(page, frameId) {
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return { src: "", live: "", ok: false };
    let live = "";
    try {
      live = el.contentWindow?.location?.href || "";
    } catch {
      live = "";
    }
    return { src: el.src || "", live: live || el.src || "", ok: true };
  }, frameId);
}

export async function collectFlowSnapshot(page) {
  return page.evaluate(({ buyer, hired }) => {
    const frameHref = (id) => {
      const el = document.getElementById(id);
      let live = "";
      try {
        live = el?.contentWindow?.location?.href || "";
      } catch {
        /* ignore */
      }
      return { src: el?.src || "", live: live || el?.src || "" };
    };
    const feeDiag = window.__tasuJobHireFlowDiag || null;
    const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const hiredRows = notifs.filter(
      (n) => String(n.recipientUserId) === buyer && String(n.title || "").includes(hired.slice(0, 6))
    );
    let bDoc = null;
    try {
      const doc = document.getElementById("frame-b-notify")?.contentWindow?.document;
      if (doc) {
        bDoc = {
          cardCount: doc.querySelectorAll(".talk-notify-card").length,
          title: doc.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
          empty: doc.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || "",
          cta: doc.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.textContent?.trim() || "",
          diag: document.getElementById("frame-b-notify")?.contentWindow?.__tasuBenchNotifyRenderDiag || null,
        };
      }
    } catch {
      bDoc = null;
    }
    return {
      frames: {
        aNotify: frameHref("frame-a-notify"),
        aChat: frameHref("frame-a-chat"),
        bNotify: frameHref("frame-b-notify"),
        bChat: frameHref("frame-b-chat"),
      },
      feeDiag,
      storageHiredCount: hiredRows.length,
      hiredRow: hiredRows[0] || null,
      bNotify: bDoc,
      verdict: document.getElementById("benchRootCausePanel")?.textContent?.slice(0, 600) || "",
    };
  }, { buyer: BUYER_ID, hired: HIRED_TITLE });
}

export function failStep(step, message, snapshot, extra) {
  return {
    ok: false,
    failedStep: step,
    message,
    snapshot,
    ...extra,
  };
}

export async function waitFrameUrl(page, frameId, pattern, timeoutMs, step) {
  const pat = pattern instanceof RegExp ? pattern.source : String(pattern);
  const flags = pattern instanceof RegExp ? pattern.flags : "i";
  try {
    await page.waitForFunction(
      ({ id, source, flags: f }) => {
        const el = document.getElementById(id);
        if (!el) return false;
        let href = "";
        try {
          href = el.contentWindow?.location?.href || "";
        } catch {
          href = el.src || "";
        }
        if (!href) href = el.src || "";
        return new RegExp(source, f).test(href);
      },
      { id: frameId, source: pat, flags },
      { timeout: timeoutMs }
    );
    return { ok: true, step, href: await readFrameHref(page, frameId) };
  } catch (err) {
    const snapshot = await collectFlowSnapshot(page);
    return failStep(step, `waitFrameUrl timeout (${frameId} ~ /${pat}/): ${err?.message || err}`, snapshot, {
      frameId,
      pattern: pat,
    });
  }
}

function readAChatFeePayDoc(page) {
  return page.evaluate(() => {
    const win = document.getElementById("frame-a-chat")?.contentWindow;
    const doc = win?.document;
    if (!doc) return { href: "", hasPayBtn: false, completeVisible: false };
    let href = "";
    try {
      href = win.location?.href || "";
    } catch {
      href = document.getElementById("frame-a-chat")?.src || "";
    }
    const complete = doc.querySelector("[data-platform-fee-complete]");
    return {
      href,
      hasPayBtn: Boolean(doc.querySelector("[data-platform-fee-pay]")),
      completeVisible: Boolean(complete && !complete.hasAttribute("hidden")),
      amount: doc.querySelector("[data-platform-fee-amount]")?.textContent?.trim() || "",
      benchEmbed: new URLSearchParams(win.location?.search || "").get("benchEmbed"),
    };
  });
}

export async function waitFeePayReady(page, timeoutMs, step) {
  const urlWait = await waitFrameUrl(page, "frame-a-chat", /platform-chat-fee-pay/i, timeoutMs, `${step}:url`);
  if (!urlWait.ok) return urlWait;

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const docState = await readAChatFeePayDoc(page);
      if (docState.hasPayBtn) {
        return { ok: true, step, url: docState.href || urlWait.href?.live || urlWait.href?.src || "" };
      }
    } catch {
      /* frame reload */
    }
    await page.waitForTimeout(250);
  }
  const snapshot = await collectFlowSnapshot(page);
  return failStep(step, "fee-pay pay button not ready", snapshot);
}

export function findPlaywrightFrame(page, pattern) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(String(pattern), "i");
  return page.frames().find((f) => re.test(f.url())) || null;
}

export async function clickFeePayButton(page) {
  const frame = findPlaywrightFrame(page, /platform-chat-fee-pay/i);
  if (!frame) {
    return { ok: false, reason: "no-fee-pay-frame" };
  }
  return frame.evaluate(() => {
    window.confirm = () => true;
    const btn = document.querySelector("[data-platform-fee-pay]");
    if (!btn) return { ok: false, reason: "no-pay-button" };
    const stripe = Boolean(window.TasuStripeServiceFeeConfig?.isConfigured?.());
    const benchEmbed = new URLSearchParams(location.search).get("benchEmbed") === "1";
    btn.click();
    return {
      ok: true,
      href: location.href,
      stripe,
      benchEmbed,
      btnDisabled: btn.disabled,
    };
  });
}

export async function waitFeePayComplete(page, timeoutMs, step) {
  const ok = await pollUntil(page, timeoutMs, ({ buyer, hired }) => {
    const win = document.getElementById("frame-a-chat")?.contentWindow;
    const el = win?.document?.querySelector("[data-platform-fee-complete]");
    if (el && !el.hasAttribute("hidden")) return true;
    const diagSteps = (window.__tasuJobHireFlowDiag?.events || []).map((e) => String(e.step || ""));
    if (diagSteps.some((s) => s.includes("completePayment:done"))) return true;
    if (diagSteps.some((s) => s.includes("activateDeferredAfterPayment:ok"))) return true;
    const all = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    return all.some(
      (n) => String(n.recipientUserId) === buyer && String(n.title || "").includes(hired.slice(0, 6))
    );
  }, { buyer: BUYER_ID, hired: HIRED_TITLE });
  if (ok) return { ok: true, step };
  const snapshot = await collectFlowSnapshot(page);
  const feeStatus = await (async () => {
    const frame = findPlaywrightFrame(page, /platform-chat-fee-pay/i);
    if (!frame) return null;
    return frame
      .evaluate(() => ({
        status: document.querySelector("[data-platform-fee-status]")?.textContent?.trim() || "",
        btnDisabled: Boolean(document.querySelector("[data-platform-fee-pay]")?.disabled),
        completeHidden: document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
        diag: window.__tasuJobHireFlowDiag?.events?.map((e) => e.step) || [],
      }))
      .catch(() => null);
  })();
  return failStep(step, "fee payment settle timeout", snapshot, { feeStatus });
}

async function pollUntil(page, timeoutMs, evaluateFn, args) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await page.evaluate(evaluateFn, args)) return true;
    } catch {
      /* navigation / frame reload */
    }
    await page.waitForTimeout(250);
  }
  return false;
}

export async function waitStorageHired(page, timeoutMs, step) {
  const ok = await pollUntil(
    page,
    timeoutMs,
    ({ buyer, hired }) => {
      const all = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      return all.some(
        (n) => String(n.recipientUserId) === buyer && String(n.title || "").includes(hired.slice(0, 6))
      );
    },
    { buyer: BUYER_ID, hired: HIRED_TITLE }
  );
  if (ok) return { ok: true, step };
  const snapshot = await collectFlowSnapshot(page);
  return failStep(step, "storage hired notify timeout", snapshot);
}

export async function waitFeeFlowDiag(page, requiredSteps, timeoutMs, step) {
  const ok = await pollUntil(page, timeoutMs, (steps) => {
    const names = (window.__tasuJobHireFlowDiag?.events || []).map((e) => e.step);
    return steps.every((s) => names.some((n) => String(n).includes(s)));
  }, requiredSteps);
  if (ok) return { ok: true, step };
  const snapshot = await collectFlowSnapshot(page);
  return failStep(step, "fee flow diag timeout", snapshot, {
    requiredSteps,
    feeDiag: snapshot.feeDiag,
  });
}

export async function waitBNotifyCard(page, timeoutMs, step) {
  const ok = await pollUntil(page, timeoutMs, () => {
    const doc = document.getElementById("frame-b-notify")?.contentWindow?.document;
    if (!doc) return false;
    const titles = [...doc.querySelectorAll(".talk-notify-card__title")].map((el) =>
      String(el.textContent || "").trim()
    );
    return titles.some((t) => t.includes("承諾"));
  });
  if (ok) return { ok: true, step };
  const snapshot = await collectFlowSnapshot(page);
  return failStep(step, "B notify card timeout", snapshot);
}

export async function resetBenchCategory(page) {
  await page.evaluate(() => {
    window.TasuPlatformChatLiveFlow?.resetDemoCategory?.({ profile: "job", connect: false });
    const key = "tasful_talk_notifications";
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const next = list.filter(
            (n) =>
              !(
                String(n.recipientUserId) === "u_hiro" &&
                (String(n.title || "").includes("承諾") || String(n.title || "").includes("やり取り"))
              )
          );
          localStorage.setItem(key, JSON.stringify(next));
        }
      } catch {
        /* ignore */
      }
    }
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const kept = (Array.isArray(threads) ? threads : []).filter((t) => String(t.threadKind) !== "job_hire");
    localStorage.setItem("tasful_chat_threads", JSON.stringify(kept));
    try {
      const apps = JSON.parse(localStorage.getItem("tasful_job_applications_v1") || "[]");
      if (Array.isArray(apps)) {
        apps.forEach((a) => {
          if (String(a.job_id) === "job_demo_full_001") {
            a.status = "applied";
            a.thread_id = null;
          }
        });
        localStorage.setItem("tasful_job_applications_v1", JSON.stringify(apps));
      }
    } catch {
      /* ignore */
    }
    window.__tasuJobHireFlowDiag = { startedAt: new Date().toISOString(), events: [] };
  });
  await page.waitForTimeout(800);
}

export async function runBenchJobHireFullFlow(page, options) {
  const opts = options || {};
  const steps = [];
  const log = (name, data) => {
    steps.push({ step: name, at: new Date().toISOString(), ...data });
  };

  const snap = () => collectFlowSnapshot(page);

  // 1. B 応募（buyer-wait 初期表示でも storage/API で確保）
  log("b_apply:start", { bChat: await readFrameHref(page, "frame-b-chat") });
  const applyResult = await page.evaluate(() => {
    const POSTER = "u_job_demo_full";
    const listing = window.TasuJobApplicationsStore?.resolveListing?.("job_demo_full_001");
    const app =
      window.TasuJobApplicationsStore?.findApplication?.("job_demo_full_001", "job-app-demo-full-001") ||
      window.TasuJobApplicationsStore?.listByJob?.("job_demo_full_001")?.[0] ||
      null;
    const notifs = window.TasuTalkNotifications?.getAll?.() || [];
    const hasApplyNotify = notifs.some(
      (n) => String(n.recipientUserId) === POSTER && /応募/.test(String(n.title || ""))
    );
    if (app && hasApplyNotify) {
      return { mode: "ready", appStatus: app.status, hasApplyNotify: true };
    }
    if (app && listing && !hasApplyNotify) {
      const row = window.TasuTalkPlatformNotify?.notifyJobApplicationReceived?.({
        listing,
        application: app,
      });
      return { mode: "notify_backfill", appStatus: app.status, notifyId: row?.id || null };
    }
    if (!listing) return { mode: "no_listing" };
    const submitted = window.TasuJobApplicationsStore?.submitApplication?.(listing);
    return {
      mode: submitted?.ok ? "submitted" : submitted?.reason || "submit_failed",
      hasApplyNotify: Boolean(submitted?.notify),
    };
  });
  if (applyResult.mode === "no_listing") {
    const snapshot = await snap();
    return failStep("b_apply", "job listing missing for apply", snapshot, { steps, applyResult });
  }
  await page.evaluate(() => {
    document.getElementById("frame-a-notify")?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
    window.__tasuBenchReconcile?.({ skipRender: true });
  });
  await page.waitForTimeout(1200);
  log("b_apply:done", { applyResult, bChat: await readFrameHref(page, "frame-b-chat") });

  // 2. A 応募通知
  log("a_apply_notify:wait", {});
  try {
    await page.waitForFunction(
      () => {
        const doc = document.getElementById("frame-a-notify")?.contentWindow?.document;
        if (!doc) return false;
        return [...doc.querySelectorAll(".talk-notify-card__title")].some((el) =>
          /応募/.test(String(el.textContent || ""))
        );
      },
      null,
      { timeout: 25000 }
    );
  } catch (err) {
    const snapshot = await snap();
    return failStep("a_apply_notify", `A apply notify missing: ${err?.message || err}`, snapshot, { steps });
  }
  log("a_apply_notify:ok", { snapshot: await snap() });

  // 3. A 通知 CTA → 応募者一覧
  log("a_apply_cta:click", {});
  const aNotifyFrame = page.frames().find(
    (f) => /talk-home.*tab=notify/i.test(f.url()) && /u_job_demo_full/i.test(f.url())
  );
  if (!aNotifyFrame) {
    const snapshot = await snap();
    return failStep("a_apply_cta", "A notify frame missing", snapshot, { steps });
  }
  await aNotifyFrame.evaluate(() => {
    document.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.click();
  });

  const appsWait = await waitFrameUrl(
    page,
    "frame-a-chat",
    /detail-job.*(view=applications|benchManagement=1|#applications)/i,
    25000,
    "a_applications:navigate"
  );
  if (!appsWait.ok) return { ...appsWait, steps };
  log("a_applications:ok", appsWait);

  // 4. 応募者一覧 → fee-pay
  let mgmt = page.frames().find(
    (f) => /detail-job/i.test(f.url()) && /(view=applications|benchManagement=1|#applications)/i.test(f.url())
  );
  if (!mgmt) {
    await page.evaluate(() => {
      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.("job", false);
      const href = window.TasuPlatformChatLiveFlow?.managementPageUrl?.(profile, profile?.partnerAId);
      const el = document.getElementById("frame-a-chat");
      if (el && href) {
        const u = new URL(href, location.href);
        u.searchParams.set("benchEmbed", "1");
        u.searchParams.set("benchViewport", "390");
        u.searchParams.set("userId", profile.partnerAId);
        u.searchParams.set("benchRole", "poster");
        el.src = u.href;
      }
    });
    await page.waitForTimeout(2500);
    mgmt = page.frames().find((f) => /detail-job/i.test(f.url()));
  }
  if (!mgmt) {
    const snapshot = await snap();
    return failStep("a_proceed", "applications frame missing", snapshot, { steps });
  }

  await mgmt
    .waitForFunction(() => document.querySelector("[data-job-app-proceed], [data-job-app-pay]"), {
      timeout: 20000,
    })
    .catch(() => null);

  log("a_proceed:click", {});
  await mgmt.evaluate(() => {
    document.querySelector("[data-job-app-proceed]")?.click() ||
      document.querySelector("[data-job-app-pay]")?.click();
  });
  await page.waitForTimeout(600);

  const feeWait = await waitFeePayReady(page, 35000, "fee_pay:frame");
  if (!feeWait.ok) return { ...feeWait, steps };
  log("fee_pay:frame", { url: feeWait.url });

  const cardReady = await pollUntil(page, 20000, () => {
    const doc = document.getElementById("frame-a-chat")?.contentWindow?.document;
    const card = doc?.querySelector("[data-platform-fee-card]");
    return Boolean(card && !card.hasAttribute("hidden") && doc.querySelector("[data-platform-fee-pay]"));
  });
  if (!cardReady) {
    const snapshot = await snap();
    return failStep("fee_pay:card_ready", "fee-pay card not ready", snapshot, { steps });
  }

  const prePay = await readAChatFeePayDoc(page);
  log("fee_pay:pre", prePay);

  // 5. 550円支払い（benchEmbed=1 で confirm スキップ）— Playwright frame 内 click 必須
  let payClick = await clickFeePayButton(page);
  if (!payClick.ok) {
    const snapshot = await snap();
    return failStep("fee_pay:click", `pay button click failed: ${payClick.reason}`, snapshot, { steps, payClick });
  }
  if (!payClick.btnDisabled) {
    await page.waitForTimeout(400);
    const feeFrame = findPlaywrightFrame(page, /platform-chat-fee-pay/i);
    const retry = feeFrame
      ? await feeFrame.evaluate(() => {
          const btn = document.querySelector("[data-platform-fee-pay]");
          if (!btn || btn.disabled) return { retried: false, btnDisabled: Boolean(btn?.disabled) };
          btn.click();
          return { retried: true, btnDisabled: btn.disabled };
        })
      : { retried: false, reason: "no-frame" };
    payClick = { ...payClick, retry };
    log("fee_pay:click_retry", retry);
  }
  log("fee_pay:click", payClick);

  const completeWait = await waitFeePayComplete(page, 25000, "fee_pay:complete_view");
  if (!completeWait.ok) return { ...completeWait, steps };
  log("fee_pay:complete_view", {});

  const storageWait = await waitStorageHired(page, 15000, "storage:hired");
  if (!storageWait.ok) return { ...storageWait, steps };
  log("storage:hired", { snapshot: await snap() });

  const diagWait = await waitFeeFlowDiag(
    page,
    ["activateDeferredAfterPayment:ok", "notifyJobHiredToApplicant"],
    10000,
    "fee_pay:diag"
  );
  if (!diagWait.ok) return { ...diagWait, steps };
  log("fee_pay:diag", { feeDiag: (await snap()).feeDiag });

  // 6. B iframe refresh + カード
  await page.evaluate(() => {
    window.__tasuBenchReconcile?.({ forceRender: true });
    const b = document.getElementById("frame-b-notify");
    b?.contentWindow?.postMessage?.(
      { type: "tasu-bench-embed-user", userId: "u_hiro", benchRole: "applicant" },
      "*"
    );
    b?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
  });
  await page.waitForTimeout(1200);

  const bCardWait = await waitBNotifyCard(page, 25000, "b_notify:card");
  if (!bCardWait.ok) return { ...bCardWait, steps };
  log("b_notify:card", { snapshot: await snap() });

  // 7. B CTA → chat-detail（ベンチ自動遷移済みならスキップ）
  let ctaMeta = { text: "", href: "", skipped: false };
  const bChatNow = await readFrameHref(page, "frame-b-chat");
  if (!/chat-detail\.html/i.test(bChatNow.live || bChatNow.src)) {
    const bNotify = page.frames().find(
      (f) => /talk-home.*tab=notify/i.test(f.url()) && /u_hiro/i.test(f.url())
    );
    if (!bNotify) {
      const snapshot = await snap();
      return failStep("b_cta", "B notify frame missing", snapshot, { steps });
    }
    ctaMeta = await bNotify.evaluate(() => {
      const btn = document.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action");
      return { text: btn?.textContent?.trim() || "", href: btn?.getAttribute("href") || "" };
    });
    log("b_cta:click", ctaMeta);
    await bNotify.evaluate(() => {
      document.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.click();
    });
  } else {
    ctaMeta = { text: "(bench auto-nav)", href: bChatNow.live || bChatNow.src, skipped: true };
    log("b_cta:skip", ctaMeta);
  }

  const chatNav = await waitFrameUrl(page, "frame-b-chat", /chat-detail\.html/i, 25000, "b_chat:navigate");
  if (!chatNav.ok) return { ...chatNav, steps };
  log("b_chat:navigate", chatNav);

  const bChatOpen = await page.evaluate(() => {
    const doc = document.getElementById("frame-b-chat")?.contentWindow?.document;
    if (!doc) return { ok: false, reason: "no_document" };
    const errTitle = doc.querySelector(".chat-room-unavailable__title")?.textContent?.trim() || "";
    const composer = doc.getElementById("chatInput") || doc.querySelector("[data-chat-input], textarea");
    const messages = doc.querySelectorAll("#chatMessages .chat-message, #chatMessages [data-message-id]");
    return {
      ok: !/チャットを開けませんでした|やりとりを開始できませんでした/.test(errTitle),
      errTitle,
      composerEnabled: composer ? !composer.disabled : false,
      messageCount: messages.length,
    };
  });
  if (!bChatOpen.ok) {
    const snapshot = await snap();
    return failStep("b_chat:open", `B chat open failed: ${bChatOpen.errTitle || "unknown"}`, snapshot, {
      steps,
      bChatOpen,
    });
  }
  log("b_chat:open", bChatOpen);

  const threadConsistency = await page.evaluate(() => {
    const hired = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").find(
      (n) => String(n.recipientUserId) === "u_hiro" && String(n.title || "").includes("承諾")
    );
    const href = String(hired?.href || hired?.targetUrl || "");
    let notifyThread = "";
    try {
      notifyThread = new URL(href, location.href).searchParams.get("thread") || "";
    } catch {
      notifyThread = "";
    }
    let bThread = "";
    try {
      const live = document.getElementById("frame-b-chat")?.contentWindow?.location?.href || "";
      bThread = new URL(live, location.href).searchParams.get("thread") || "";
    } catch {
      bThread = "";
    }
    const roomExists = notifyThread
      ? Boolean(window.TasuChatThreadStore?.loadRoom?.(notifyThread)?.thread)
      : false;
    return { notifyThread, bThread, roomExists, match: notifyThread && bThread && notifyThread === bThread };
  });
  if (!threadConsistency.roomExists || !threadConsistency.match) {
    const snapshot = await snap();
    return failStep(
      "b_chat:thread",
      `CTA thread mismatch roomExists=${threadConsistency.roomExists} match=${threadConsistency.match}`,
      snapshot,
      { steps, threadConsistency }
    );
  }
  log("b_chat:thread", threadConsistency);

  const aChatHref = await readFrameHref(page, "frame-a-chat");
  if (!/chat-detail\.html/i.test(aChatHref.live || aChatHref.src)) {
    await page.evaluate((threadId) => {
      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.("job", false);
      const href =
        window.TasuPlatformChatLiveFlow?.chatUrl?.(profile, profile?.partnerAId) ||
        `chat-detail.html?thread=${encodeURIComponent(threadId)}&userId=${encodeURIComponent(profile?.partnerAId || "u_job_demo_full")}&talkDev=1&review=chat-demo&liveFlow=1`;
      const el = document.getElementById("frame-a-chat");
      if (el && href) el.src = new URL(href, location.href).href;
    }, threadConsistency.notifyThread);
    const aNav = await waitFrameUrl(page, "frame-a-chat", /chat-detail\.html/i, 20000, "a_chat:navigate");
    if (!aNav.ok) return { ...aNav, steps };
    log("a_chat:navigate", aNav);
  }

  async function sendFrameChatMessage(frameId, text, senderUserId) {
    return page.evaluate(
      async ({ id, message, senderId }) => {
        const win = document.getElementById(id)?.contentWindow;
        if (!win) return { ok: false, reason: "no_frame" };
        let threadId = "";
        try {
          threadId = new URL(win.location.href, location.href).searchParams.get("thread") || "";
        } catch {
          threadId = "";
        }
        if (!threadId) return { ok: false, reason: "no_thread" };
        const meId =
          senderId ||
          win.TasuChatUserIdentity?.getEffectiveUserId?.() ||
          new URL(win.location.href, location.href).searchParams.get("userId") ||
          "";
        const saved = await win.TasuChatService?.saveMessage?.(threadId, {
          text: message,
          senderId: meId,
          senderName: meId,
        });
        if (saved?.ok !== true) {
          const doc = win.document;
          const input = doc?.getElementById("chatInput");
          const btn = doc?.getElementById("chatSend");
          if (!input || !btn) return { ok: false, reason: saved?.reason || "save_failed" };
          if (input.disabled || btn.disabled) return { ok: false, reason: "composer_disabled" };
          input.value = message;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          btn.click();
        }
        if (typeof win.__tasuChatDetailReload === "function") {
          await win.__tasuChatDetailReload({ threadId });
        }
        win.parent?.postMessage?.(
          { type: "tasu-bench-chat-message-sent", threadId, recipientUserId: meId },
          "*"
        );
        return { ok: true, message, threadId, via: saved?.ok ? "saveMessage" : "ui_click" };
      },
      { id: frameId, message: text, senderId: senderUserId }
    );
  }

  const msgA = await sendFrameChatMessage(
    "frame-a-chat",
    `E2E A→B ${Date.now()}`,
    POSTER_ID
  );
  if (!msgA.ok) {
    const snapshot = await snap();
    return failStep("msg_a_send", `A send failed: ${msgA.reason}`, snapshot, { steps, msgA });
  }
  await page.waitForTimeout(1200);

  const msgB = await sendFrameChatMessage(
    "frame-b-chat",
    `E2E B→A ${Date.now()}`,
    BUYER_ID
  );
  if (!msgB.ok) {
    const snapshot = await snap();
    return failStep("msg_b_send", `B send failed: ${msgB.reason}`, snapshot, { steps, msgB });
  }
  await page.waitForTimeout(1200);

  await page.evaluate((threadId) => {
    ["frame-a-chat", "frame-b-chat"].forEach((frameId) => {
      const win = document.getElementById(frameId)?.contentWindow;
      win?.postMessage?.({ type: "tasu-chat-reload-room", threadId }, "*");
      if (typeof win?.__tasuChatDetailReload === "function") {
        win.__tasuChatDetailReload({ threadId });
      }
    });
  }, threadConsistency.notifyThread);
  await page.waitForTimeout(1500);

  const msgVerify = await page.evaluate(() => {
    const readTexts = (frameId) => {
      const doc = document.getElementById(frameId)?.contentWindow?.document;
      const root = doc?.getElementById("chatMessages");
      if (!root) return [];
      return [...root.querySelectorAll(".chat-message, [data-message-id], .chat-bubble, p")]
        .map((el) => String(el.textContent || "").trim())
        .filter((t) => t && !/読み込み中/.test(t));
    };
    const aTexts = readTexts("frame-a-chat");
    const bTexts = readTexts("frame-b-chat");
    const aHasB = aTexts.some((t) => /E2E B→A/.test(t));
    const bHasA = bTexts.some((t) => /E2E A→B/.test(t));
    const threadId = (() => {
      try {
        const live = document.getElementById("frame-a-chat")?.contentWindow?.location?.href || "";
        return new URL(live, location.href).searchParams.get("thread") || "";
      } catch {
        return "";
      }
    })();
    const msgCount = threadId
      ? (window.TasuChatThreadStore?.getMessages?.(threadId) || []).length
      : 0;
    const milestones = window.TasuPlatformChatLiveFlow?.detectBenchMilestoneDoneThrough?.(
      window.TasuPlatformChatDualWindowDemo?.getProfile?.("job", false),
      window.TasuPlatformChatLiveFlow?.getBenchMilestoneSteps?.(
        window.TasuPlatformChatDualWindowDemo?.getProfile?.("job", false)
      ) || []
    );
    return { aHasB, bHasA, aTexts: aTexts.slice(-4), bTexts: bTexts.slice(-4), msgCount, milestones };
  });
  if (!msgVerify.aHasB || !msgVerify.bHasA) {
    const snapshot = await snap();
    return failStep(
      "msg_exchange",
      `bidirectional messages missing aHasB=${msgVerify.aHasB} bHasA=${msgVerify.bHasA}`,
      snapshot,
      { steps, msgVerify }
    );
  }
  log("msg_exchange", msgVerify);

  const final = await snap();
  const threadId = (() => {
    try {
      return new URL(final.frames.bChat.live || final.frames.bChat.src, "http://localhost").searchParams.get("thread");
    } catch {
      return "";
    }
  })();

  return {
    ok: true,
    steps,
    threadId,
    snapshot: final,
    ctaMeta,
  };
}

export async function saveFlowScreenshot(page, outDir, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await page.evaluate(() => {
    document.getElementById("benchVerdictFold")?.setAttribute("open", "open");
  });
  await page.screenshot({ path: file, fullPage: false, timeout: 60000, animations: "disabled" });
  return file;
}
