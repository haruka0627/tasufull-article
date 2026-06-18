/**
 * Builder ops_partner 2窓フロー — カレンダー追加〜受諾/辞退〜スレッド完了
 */
(function (global) {
  "use strict";

  const Bench = global.TasuBuilderDualWindowBench;
  if (!Bench) return;

  const MVP_KEY = "tasful:builder:mvp:v1";
  const NOTIFY_KEY = "tasful:builder:mvp:notifications:v1";
  const ASSIGN_KEY = "tasful:builder:admin:calendarAssignments:v1";
  const PARTNER_ID = "demo-partner-001";
  const OWNER_ID = "demo-owner-001";
  const OPS_BENCH_FLAG_KEY = "tasu:builder:ops-bench";
  const MVP_THREADS_KEY = "tasful:builder:mvp:threads:v1";
  const OPS_BENCH_CLEAR_KEYS = Object.freeze([
    MVP_KEY,
    MVP_THREADS_KEY,
    NOTIFY_KEY,
    ASSIGN_KEY,
    "tasful_talk_notifications",
    "tasful_talk_notifications_seeded_v2",
    "tasful_builder_notify_master_v1",
    "tasful_platform_notify_master_v2",
    "tasful_anpi_notify_master_v1",
    "tasful:builder:admin:notifications:v1",
  ]);

  const OPS_BENCH_DEMO_EVENT = Object.freeze({
    project_id: "demo-thread-list-002",
    assignment_id: "cal-demo-thread-list-002",
    title: "ベンチ検証 — 新宿区 外装足場工事",
    start: "2026-06-18",
    end: "2026-06-18",
    startTime: "09:00",
    endTime: "17:00",
    location: "東京都新宿区西新宿1-1-1",
    partnerId: PARTNER_ID,
    partnerName: "株式会社オレンジ建装",
    memo: "外装足場工事の現場予定です。前日までに資材確認してください。",
    instructions: "外装足場工事の現場予定です。前日までに資材確認してください。",
    category: "scaffold",
  });

  const OPS_DIAG_KEYS = [
    "calendarEventVisibleForPartner",
    "threadCreatedAfterAccept",
    "noThreadCreatedAfterDecline",
    "entryMessageCreated",
    "exitMessageCreated",
    "entry_at_saved",
    "exit_at_saved",
    "entry_notification_created",
    "exit_notification_created",
    "completionReportCreated",
    "completionPhotoVisible",
    "adminApprovalCompleted",
    "thread_exists_after_complete",
    "threadStillVisibleAfterComplete",
    "review_notification_created",
    "message_notification_created",
    "talk_message_notification_created",
    "idle_a_notify_zero",
    "idle_b_notify_zero",
    "idle_no_notification_created_event",
  ];

  const opsState = {
    currentStep: "idle",
    projectId: "",
    assignmentId: "",
    threadId: "",
    partnerDecision: "",
    assignmentRevealed: false,
    bridgeReady: false,
    diag: {},
  };

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function builderBase() {
    const origin = global.location.origin;
    const path = global.location.pathname.replace(/[^/]+$/, "");
    return `${origin}${path}builder/`;
  }

  function ensureBridgeFrame() {
    let frame = document.getElementById("builder-bench-bridge");
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "builder-bench-bridge";
      frame.title = "Builder API Bridge";
      frame.hidden = true;
      frame.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0";
      frame.src = `${builderBase()}bench-bridge.html`;
      document.body.appendChild(frame);
    }
    return frame;
  }

  function waitForBridgeReady() {
    if (opsState.bridgeReady) return Promise.resolve();
    const frame = ensureBridgeFrame();
    return new Promise((resolve) => {
      const done = () => {
        opsState.bridgeReady = true;
        resolve();
      };
      if (frame.contentWindow?.TasuBuilderBenchBridge) {
        done();
        return;
      }
      const onReady = (ev) => {
        if (ev.data?.type === "tasu-builder-bench-bridge-ready") {
          global.removeEventListener("message", onReady);
          done();
        }
      };
      global.addEventListener("message", onReady);
      frame.addEventListener(
        "load",
        () => {
          global.setTimeout(() => {
            if (frame.contentWindow?.TasuBuilderBenchBridge) done();
          }, 800);
        },
        { once: true }
      );
      global.setTimeout(resolve, 25000);
    });
  }

  let bridgeCallChain = Promise.resolve();

  async function callBridge(method, ...args) {
    const run = async () => {
      await waitForBridgeReady();
      const frame = ensureBridgeFrame();
      return new Promise((resolve) => {
        const id = uid("api");
        const onMsg = (ev) => {
          if (ev.data?.type !== "tasu-builder-bench-api-result" || ev.data.id !== id) return;
          global.removeEventListener("message", onMsg);
          resolve(ev.data.result);
        };
        global.addEventListener("message", onMsg);
        frame.contentWindow?.postMessage?.({ type: "tasu-builder-bench-api", id, method, args }, "*");
        global.setTimeout(() => {
          global.removeEventListener("message", onMsg);
          resolve({ ok: false, error: "bridge_timeout", method });
        }, 15000);
      });
    };
    const result = bridgeCallChain.then(run, run);
    bridgeCallChain = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  function buildPageUrl(page, params, side) {
    const sp = new URLSearchParams(params || {});
    sp.set("benchEmbed", "1");
    sp.set("benchSide", side);
    return `${builderBase()}${page}?${sp.toString()}`;
  }

  function partnerCalendarUrl(sideKey) {
    const f = Bench.flow();
    const side = sideKey === "A" ? f.sideA : f.sideB;
    if (typeof Bench.opsPartnerCalendarUrl === "function") {
      return Bench.opsPartnerCalendarUrl(side);
    }
    if (sideKey === "A") {
      return buildPageUrl("admin-calendar.html", { role: "owner" }, "A");
    }
    return buildPageUrl("mvp-calendar.html", { role: "partner", partnerId: PARTNER_ID }, "B");
  }

  function partnerAssignmentUrl(sideKey) {
    if (sideKey !== "B" || !opsState.projectId || !opsState.assignmentRevealed) return "";
    const f = Bench.flow();
    const side = f.sideB;
    if (typeof Bench.opsPartnerProjectUrl === "function") {
      return Bench.opsPartnerProjectUrl(side, {
        projectId: opsState.projectId,
        assignmentId: opsState.assignmentId,
      });
    }
    const params = { role: "partner", partnerId: PARTNER_ID, projectId: opsState.projectId };
    if (opsState.assignmentId) params.calendarEventId = opsState.assignmentId;
    return buildPageUrl("partner-assignment.html", params, "B");
  }

  function setProjectFrameSrc(sideKey, activateTab) {
    const url = partnerAssignmentUrl(sideKey);
    if (!url) return;
    if (activateTab && typeof Bench.loadProjectSlot === "function") {
      Bench.loadProjectSlot(sideKey, url, "setProjectFrameSrc");
      return;
    }
    Bench.setBenchFrameUrl?.(Bench.frameIds(sideKey).project, url);
  }

  function setProjectFrame(sideKey) {
    setProjectFrameSrc(sideKey, true);
  }

  function threadUrlForOps(sideKey) {
    const role = sideKey === "A" ? "owner" : "partner";
    const tid = pickStr(
      opsState.threadId,
      typeof Bench.resolveOpsBenchThreadIdFromUrl === "function"
        ? Bench.resolveOpsBenchThreadIdFromUrl()
        : ""
    );
    if (!tid) return "";
    const urlId = tid.replace("thread-", "demo-");
    return buildPageUrl(
      "mvp-thread.html",
      { threadType: "ops_partner", role, id: urlId, thread_id: tid },
      sideKey
    );
  }

  let opsDiagTimer = null;
  const OPS_DIAG_DEBOUNCE_MS = 250;

  function scheduleRunOpsDiagnostics() {
    if (opsDiagTimer) global.clearTimeout(opsDiagTimer);
    opsDiagTimer = global.setTimeout(() => {
      opsDiagTimer = null;
      runOpsDiagnostics();
    }, OPS_DIAG_DEBOUNCE_MS);
  }

  function refreshOpsFrames(source) {
    const src = pickStr(source, "refreshOpsFrames");
    if (typeof Bench.logEvent === "function") {
      Bench.logEvent("refreshOpsFrames_source", src);
    }
    Bench.setBenchFrameUrl?.(Bench.frameIds("A").calendar, partnerCalendarUrl("A"), { source: src });
    if (opsState.projectId && opsState.assignmentRevealed) {
      setProjectFrameSrc("B", false);
    } else {
      Bench.setBenchFrameUrl?.(Bench.frameIds("B").calendar, partnerCalendarUrl("B"), { source: src });
      Bench.clearOpsProjectFrame?.("B");
    }
    Bench.updateOpsBenchChrome?.();
    if (opsState.threadId && Bench.opsPartnerAllowsThreadSurface?.()) {
      ["A", "B"].forEach((sk) => {
        const url = threadUrlForOps(sk);
        if (url) Bench.setBenchFrameUrl?.(Bench.frameIds(sk).thread, url, { source: src });
      });
    } else {
      Bench.clearOpsThreadFrames?.();
    }
    Bench.scheduleRunDiagnostics?.() || Bench.runDiagnostics?.();
    scheduleRunOpsDiagnostics();
  }

  function logOps(type, detail) {
    if (typeof Bench.logEvent === "function") Bench.logEvent(type, detail);
    opsState.currentStep = type;
  }

  function waitForCalendarFrameReady(sideKey, timeoutMs = 10000) {
    const frameId = Bench.frameIds(sideKey).calendar;
    const el = document.getElementById(frameId);
    if (!el) return Promise.resolve(false);
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const isReady = () => {
        try {
          const doc = el.contentDocument;
          const root = doc?.querySelector("[data-builder-root]");
          return root?.dataset?.builderBound === "1";
        } catch {
          return false;
        }
      };
      const poll = () => {
        if (isReady()) return resolve(true);
        if (Date.now() >= deadline) return resolve(false);
        global.setTimeout(poll, 80);
      };
      const onLoad = () => global.setTimeout(poll, 40);
      el.addEventListener("load", onLoad, { once: true });
      poll();
    });
  }

  async function reloadBenchCalendarFrames() {
    const reloads = ["A", "B"].map(
      (sk) =>
        new Promise((resolve) => {
          const el = document.getElementById(Bench.frameIds(sk).calendar);
          if (!el) return resolve();
          const done = () => resolve();
          el.addEventListener("load", done, { once: true });
          global.setTimeout(done, 12000);
          try {
            el.contentWindow?.location?.reload?.();
          } catch {
            if (el.dataset?.currentSrc) el.src = el.dataset.currentSrc;
            else done();
          }
        })
    );
    await Promise.all(reloads);
    await Promise.all(["A", "B"].map((sk) => waitForCalendarFrameReady(sk)));
  }

  function reloadBenchNotifyFrames() {
    document.getElementById("frame-b-notify")?.contentWindow?.location?.reload?.();
    document.getElementById("frame-a-notify")?.contentWindow?.location?.reload?.();
  }

  function invalidateTalkNotificationsBootstrap() {
    try {
      global.__tasuTalkNotificationsBootstrapped = false;
    } catch {
      /* ignore */
    }
  }

  function countTalkNotificationsForUser(userId) {
    try {
      const uid = pickStr(userId);
      if (!uid) return 0;
      const rows = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      return rows.filter((n) => {
        const recipient = pickStr(n?.recipientUserId, n?.recipient_user_id);
        if (recipient) return recipient === uid;
        const role = pickStr(n?.recipientRole).toLowerCase();
        if (role === "owner" || role === "ops") return uid === OWNER_ID;
        if (role === "partner") return uid === PARTNER_ID;
        return false;
      }).length;
    } catch {
      return 0;
    }
  }

  function clearOpsPartnerBenchStorage() {
    try {
      global.sessionStorage.setItem(OPS_BENCH_FLAG_KEY, "1");
      global.sessionStorage.removeItem("tasu:builder:ops-bench-focus-date");
      OPS_BENCH_CLEAR_KEYS.forEach((key) => localStorage.removeItem(key));
      invalidateTalkNotificationsBootstrap();
    } catch {
      /* ignore */
    }
  }

  function resetOpsPartnerBenchIdle() {
    opsState.currentStep = "idle";
    opsState.projectId = "";
    opsState.assignmentId = "";
    opsState.threadId = "";
    opsState.partnerDecision = "";
    opsState.assignmentRevealed = false;
  }

  function prepareOpsBenchIdleStorage() {
    clearOpsPartnerBenchStorage();
    resetOpsPartnerBenchIdle();
  }

  async function opsAddCalendar(source) {
    const src = pickStr(source, "opsAddCalendar");
    console.log("[ops-bench] opsAddCalendar called", src);
    await waitForBridgeReady();
    await callBridge("setContext", { role: "owner" });
    const result = await callBridge("createAdminCalendarProject", { ...OPS_BENCH_DEMO_EVENT });
    if (!result?.ok) {
      logOps("calendar_add_failed", result?.error || "unknown");
      return result;
    }
    opsState.projectId = result.project_id || OPS_BENCH_DEMO_EVENT.project_id;
    opsState.assignmentId = result.assignment_id || OPS_BENCH_DEMO_EVENT.assignment_id;
    opsState.threadId = "";
    opsState.partnerDecision = "";
    opsState.assignmentRevealed = false;
    opsState.currentStep = "calendar_added";
    logOps("calendar_added", `${opsState.projectId} (${src})`);
    try {
      global.sessionStorage.setItem("tasu:builder:ops-bench-focus-date", OPS_BENCH_DEMO_EVENT.start);
    } catch {
      /* ignore */
    }
    Bench.clearOpsThreadFrames?.();
    refreshOpsFrames("opsAddCalendar");
    await reloadBenchCalendarFrames();
    reloadBenchNotifyFrames();
    return result;
  }

  async function opsPartnerAccept() {
    if (!opsState.projectId) return { ok: false, error: "no_project" };
    await callBridge("setContext", { role: "partner", partnerId: PARTNER_ID });
    const result = await callBridge("acceptCalendarAssignment", opsState.projectId);
    if (!result?.ok) {
      logOps("accept_failed", result?.error || "unknown");
      return result;
    }
    opsState.threadId = result.threadId || result.thread_id || "";
    opsState.partnerDecision = "accepted";
    opsState.currentStep = "partner_accepted";
    logOps("partner_accepted", opsState.threadId);
    refreshOpsFrames("opsPartnerAccept");
    ["A", "B"].forEach((sk) =>
      Bench.loadDetailSlot?.(sk, threadUrlForOps(sk), "opsPartnerAccept")
    );
    return result;
  }

  async function opsPartnerDecline() {
    if (!opsState.projectId) return { ok: false, error: "no_project" };
    await callBridge("setContext", { role: "partner", partnerId: PARTNER_ID });
    const result = await callBridge("declineCalendarAssignment", opsState.projectId);
    if (!result?.ok) {
      logOps("decline_failed", result?.error || "unknown");
      return result;
    }
    opsState.partnerDecision = "declined";
    opsState.threadId = "";
    opsState.currentStep = "partner_declined";
    logOps("partner_declined", opsState.projectId);
    Bench.clearOpsThreadFrames?.();
    setProjectFrame("B");
    refreshOpsFrames("opsPartnerDecline");
    document.getElementById("frame-b-notify")?.contentWindow?.location?.reload?.();
    return result;
  }

  async function opsPartnerEnter() {
    if (!opsState.threadId) return { ok: false, error: "no_thread" };
    await callBridge("setContext", { role: "partner", partnerId: PARTNER_ID });
    const result = await callBridge("markMvpThreadEnterLeave", "", "enter", opsState.threadId);
    opsState.currentStep = "partner_entered";
    refreshOpsFrames("opsPartnerEnter");
    return { ok: result };
  }

  async function opsPartnerExit() {
    if (!opsState.threadId) return { ok: false, error: "no_thread" };
    await callBridge("setContext", { role: "partner", partnerId: PARTNER_ID });
    const result = await callBridge("markMvpThreadEnterLeave", "", "leave", opsState.threadId);
    opsState.currentStep = "partner_exited";
    refreshOpsFrames("opsPartnerExit");
    return { ok: result };
  }

  async function opsPartnerComplete() {
    if (!opsState.threadId) return { ok: false, error: "no_thread" };
    await callBridge("setContext", { role: "partner", partnerId: PARTNER_ID });
    const result = await callBridge("submitThreadCompletionReport", opsState.threadId, {
      comment: "作業完了しました。現場写真を添付します。",
      photos: [{ name: "完了写真_bench.jpg", type: "image" }],
      attachments: [{ name: "作業報告書_bench.pdf", type: "pdf" }],
    });
    opsState.currentStep = "completion_submitted";
    refreshOpsFrames("opsPartnerComplete");
    return result;
  }

  async function opsAdminApprove() {
    if (!opsState.threadId) return { ok: false, error: "no_thread" };
    await callBridge("setContext", { role: "owner" });
    const result = await callBridge("approveThreadCompletionReport", opsState.threadId);
    opsState.currentStep = "completion_approved";
    refreshOpsFrames("opsAdminApprove");
    return result;
  }

  function loadMvp() {
    try {
      return JSON.parse(localStorage.getItem(MVP_KEY) || "null");
    } catch {
      return null;
    }
  }

  function runOpsDiagnostics() {
    const d = {};
    const mvp = loadMvp();
    const project = (mvp?.projects || []).find((p) => p.project_id === opsState.projectId);
    const thread = opsState.threadId ? mvp?.threads?.[opsState.threadId] : null;

    d.calendarEventVisibleForPartner =
      Boolean(opsState.projectId) &&
      opsState.partnerDecision !== "declined" &&
      String(project?.assignment_status || "") !== "declined";

    d.threadCreatedAfterAccept =
      opsState.partnerDecision === "accepted" && Boolean(opsState.threadId) && Boolean(mvp?.threads?.[opsState.threadId]);

    d.noThreadCreatedAfterDecline =
      opsState.partnerDecision === "declined"
        ? !opsState.threadId && !project?.main_thread_id
        : null;

    const msgs = (thread?.messages || []).map((m) => String(m.text || ""));
    const events = (thread?.events || []).map((e) => String(e.text || ""));
    d.entryMessageCreated = msgs.concat(events).some((t) => t.includes("現場に入場") || t.includes("入場"));
    d.exitMessageCreated = msgs.concat(events).some((t) => t.includes("現場を退場") || t.includes("退場"));

    const site = thread?.siteData || {};
    d.entry_at_saved = Boolean(site.entry_at && site.entry_user_id);
    d.exit_at_saved = Boolean(site.exit_at && site.exit_user_id);

    const notifs = JSON.parse(localStorage.getItem(NOTIFY_KEY) || "[]");
    d.entry_notification_created = notifs.some(
      (n) => n.type === "attendance_enter" && String(n.title || "").includes("現場に入場")
    );
    d.exit_notification_created = notifs.some(
      (n) => n.type === "attendance_leave" && String(n.title || "").includes("現場を退場")
    );
    d.review_notification_created = notifs.some((n) => n.type === "review_request") || null;
    d.message_notification_created = notifs.some(
      (n) => (n.type === "message" || n.type === "attachment") && String(n.recipientRole || "") !== ""
    );
    try {
      const talkNotifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      d.talk_message_notification_created = talkNotifs.some(
        (n) =>
          String(n?.source || "") === "builder-mvp" &&
          (String(n?.title || "").includes("メッセージ") || String(n?.type || "") === "builder")
      );
    } catch {
      d.talk_message_notification_created = null;
    }

    const sub = thread?.completion_submission;
    d.completionReportCreated = sub?.status === "submitted" || sub?.status === "approved";
    d.completionPhotoVisible = (sub?.photos || []).length > 0;
    d.adminApprovalCompleted =
      sub?.status === "approved" || thread?.siteData?.completed === true || thread?.status === "completed";
    d.thread_exists_after_complete = d.adminApprovalCompleted ? Boolean(mvp?.threads?.[opsState.threadId]) : null;
    d.threadStillVisibleAfterComplete = d.thread_exists_after_complete;

    if (opsState.currentStep === "idle") {
      d.idle_a_notify_zero = countTalkNotificationsForUser(OWNER_ID) === 0;
      d.idle_b_notify_zero = countTalkNotificationsForUser(PARTNER_ID) === 0;
      d.idle_no_notification_created_event = !((Bench.getBenchEvents?.() || []).some(
        (e) => String(e?.type || "") === "notification_created"
      ));
    } else {
      d.idle_a_notify_zero = null;
      d.idle_b_notify_zero = null;
      d.idle_no_notification_created_event = null;
    }

    OPS_DIAG_KEYS.forEach((k) => {
      opsState.diag[k] = d[k] === true ? true : d[k] === false ? false : null;
    });

    const stepEl = document.getElementById("builderBenchOpsStep");
    if (stepEl) {
      stepEl.textContent = `step: ${opsState.currentStep} | project: ${opsState.projectId || "—"} | thread: ${opsState.threadId || "—"}`;
    }
    return d;
  }

  function patchNgCopy() {
    const orig = Bench.buildNgCopy;
    if (Bench.__opsNgPatched) return;
    Bench.__opsNgPatched = true;
    Bench.buildNgCopy = function () {
      const base = orig?.call(Bench) || "";
      if (Bench.flow()?.id !== "ops_partner") return base;
      const lines = [
        base,
        "",
        "【ops_partner フロー】",
        `builderFlow: ops_partner`,
        `currentStep: ${opsState.currentStep}`,
        `calendarEventId: ${opsState.assignmentId || opsState.projectId || "—"}`,
        `threadId: ${opsState.threadId || "—"}`,
        `threadType: ops_partner`,
        `roleA: owner`,
        `roleB: partner`,
        `partnerDecision: ${opsState.partnerDecision || "—"}`,
        "",
        "【ops 診断】",
      ];
      OPS_DIAG_KEYS.forEach((k) => {
        const v = opsState.diag[k];
        lines.push(`${v === true ? "OK" : v === false ? "NG" : "—"} ${k}`);
      });
      const notifs = JSON.parse(localStorage.getItem(NOTIFY_KEY) || "[]");
      const last = notifs[0];
      const notifyVisible = Bench.runDiagnostics?.()?.notification_visible === true;
      lines.push(
        "",
        "【最新通知】",
        `notificationCreated: ${notifs.length > 0}`,
        `notificationVisible: ${notifyVisible}`,
        `notificationClickTarget: ${last?.href || "—"}`
      );
      return lines.join("\n");
    };
  }

  function addOpsToolbar() {
    const toolbar = document.querySelector(".bench-toolbar");
    if (!toolbar || document.getElementById("builderBenchOpsRow")) return;
    const row = document.createElement("div");
    row.className = "bench-toolbar__row builder-bench-ops-row";
    row.id = "builderBenchOpsRow";
    row.innerHTML =
      `<div class="builder-bench-ops-actions">` +
      `<button type="button" class="bench-btn bench-btn--reset" id="opsAddCalendarBtn">現場予定を追加</button>` +
      `<button type="button" class="bench-btn" id="opsAcceptBtn">パートナー: 受ける</button>` +
      `<button type="button" class="bench-btn" id="opsDeclineBtn">パートナー: 受けない</button>` +
      `<button type="button" class="bench-btn" id="opsEnterBtn">パートナー: 現場に入場しました</button>` +
      `<button type="button" class="bench-btn" id="opsExitBtn">パートナー: 現場を退場しました</button>` +
      `<button type="button" class="bench-btn" id="opsCompleteBtn">パートナー: 完了報告を送る</button>` +
      `<button type="button" class="bench-btn bench-btn--primary" id="opsApproveBtn">運営: 完了報告を承認</button>` +
      `</div>` +
      `<p class="bench-meta" id="builderBenchOpsStep">step: idle</p>`;
    toolbar.appendChild(row);

    document.getElementById("opsAddCalendarBtn")?.addEventListener("click", () => opsAddCalendar("toolbar"));
    document.getElementById("opsAcceptBtn")?.addEventListener("click", () => opsPartnerAccept());
    document.getElementById("opsDeclineBtn")?.addEventListener("click", () => opsPartnerDecline());
    document.getElementById("opsEnterBtn")?.addEventListener("click", () => opsPartnerEnter());
    document.getElementById("opsExitBtn")?.addEventListener("click", () => opsPartnerExit());
    document.getElementById("opsCompleteBtn")?.addEventListener("click", () => opsPartnerComplete());
    document.getElementById("opsApproveBtn")?.addEventListener("click", () => opsAdminApprove());
  }

  function openCalendarAssignment(sideKey, opts = {}) {
    const sk = pickStr(sideKey, "B");
    const href = pickStr(opts.href);
    const notifType = pickStr(opts.notificationType);
    try {
      if (href) {
        const u = new URL(href, builderBase());
        const pid = u.searchParams.get("projectId") || u.searchParams.get("project_id");
        if (pid) opsState.projectId = pid;
        const aid = u.searchParams.get("calendarEventId") || u.searchParams.get("assignmentId");
        if (aid) opsState.assignmentId = aid;
      }
    } catch {
      /* ignore */
    }
    const projectId = pickStr(opts.projectId, opsState.projectId);
    const assignmentId = pickStr(opts.calendarEventId, opts.assignmentId, opsState.assignmentId);
    if (projectId) opsState.projectId = projectId;
    if (assignmentId) opsState.assignmentId = assignmentId;
    if (
      notifType !== "calendar_assignment" &&
      href &&
      !href.includes("partner-assignment") &&
      !href.includes("mvp-calendar")
    ) {
      return false;
    }
    opsState.threadId = "";
    opsState.partnerDecision = "";
    opsState.assignmentRevealed = true;
    opsState.currentStep = "notification_calendar_open";
    Bench.loadProjectSlot?.(sk, partnerAssignmentUrl(sk), pickStr(opts.source, "openCalendarAssignment"));
    scheduleRunOpsDiagnostics();
    return true;
  }

  function patchNotificationNavigate() {
    if (Bench.__opsNavPatched) return;
    Bench.__opsNavPatched = true;
    global.addEventListener("message", (ev) => {
      const data = ev.data;
      if (data?.type !== "tasu-builder-bench-notification-navigate") return;
      if (pickStr(opsState.currentStep, "idle") === "idle") {
        Bench.logEvent?.(
          "notify_nav_blocked",
          `source=opsPatchNotificationNavigate reason=ops_idle bootPhase=${global.__builderOpsBootIdlePhase ? "1" : "0"}`
        );
        return;
      }
      const href = pickStr(data.href);
      const notifType = pickStr(data.notificationType);
      const side = pickStr(data.side, "B");
      if (
        notifType === "calendar_assignment" ||
        href.includes("partner-assignment") ||
        href.includes("mvp-calendar")
      ) {
        openCalendarAssignment(side, {
          href,
          notificationType: notifType,
          projectId: data.projectId,
          calendarEventId: data.calendarEventId,
          source: "opsPatchNotificationNavigate",
        });
      }
    });
  }

  function initOpsPartnerBench() {
    if (Bench.flow()?.id !== "ops_partner") return;
    if (global.__builderOpsPartnerInitDone) return;
    global.__builderOpsPartnerInitDone = true;
    ensureBridgeFrame();
    waitForBridgeReady();
    addOpsToolbar();
    patchNgCopy();
    patchNotificationNavigate();
    Bench.updateOpsBenchChrome?.();
    scheduleRunOpsDiagnostics();
    if (!global.__builderOpsDiagInterval) {
      global.__builderOpsDiagInterval = true;
      global.setInterval(scheduleRunOpsDiagnostics, 5000);
    }
  }

  const origBoot = Bench.boot;
  Bench.boot = function () {
    if (global.__builderOpsBenchBooted) {
      Bench.logEvent?.("boot_skip_already_started", "ops_wrapper");
      return;
    }
    if (Bench.flow()?.id === "ops_partner") {
      prepareOpsBenchIdleStorage();
      global.__builderOpsBootIdlePhase = true;
    }
    origBoot.call(Bench);
    initOpsPartnerBench();
    if (Bench.flow()?.id === "ops_partner") {
      global.setTimeout(() => {
        global.__builderOpsBootIdlePhase = false;
      }, 2500);
    }
  };

  function resetOpsState() {
    prepareOpsBenchIdleStorage();
    Bench.clearAllOpsPartnerBenchFrameSrc?.("resetDemo");
    Bench.bootOpsPartnerFrames?.();
    reloadBenchNotifyFrames();
    Bench.updateOpsBenchChrome?.();
    scheduleRunOpsDiagnostics();
  }

  global.addEventListener("message", (ev) => {
    const type = ev.data?.type;
    if (type === "tasu-builder-bench-ops-add-calendar" || type === "builder:ops:add-calendar-demo") {
      console.log("[ops-bench] message received", ev.data);
      opsAddCalendar("admin-calendar-btn");
      return;
    }
    if (
      type === "builder:ops:message-created" ||
      type === "builder:ops:notification-created" ||
      type === "builder:ops:completion-submitted" ||
      type === "builder:ops:completion-report-open"
    ) {
      scheduleRunOpsDiagnostics();
    }
  });

  global.TasuBuilderOpsPartnerBench = {
    opsState,
    OPS_BENCH_DEMO_EVENT,
    clearOpsPartnerBenchStorage,
    resetOpsPartnerBenchIdle,
    resetOpsState,
    callBridge,
    runOpsDiagnostics,
    opsAddCalendar,
    opsPartnerAccept,
    opsPartnerDecline,
    opsPartnerEnter,
    opsPartnerExit,
    opsPartnerComplete,
    opsAdminApprove,
    openCalendarAssignment,
  };
})(typeof window !== "undefined" ? window : globalThis);
