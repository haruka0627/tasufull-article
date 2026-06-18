/**
 * Builder 一般案件フロー — partner_user / user_user / vendor_user 2窓ベンチ
 */
(function (global) {
  "use strict";

  const Bench = global.TasuBuilderDualWindowBench;
  if (!Bench) return;

  const MVP_KEY = "tasful:builder:mvp:v1";
  const NOTIFY_KEY = "tasful:builder:mvp:notifications:v1";
  const GENERAL_FLOW_IDS = new Set(
    global.TasuBuilderGeneralFlow?.getGeneralFlowVariantIds?.() || ["partner_user", "user_user", "vendor_user"]
  );

  const GENERAL_DIAG_KEYS = [
    "application_notification_created",
    "chat_started",
    "thread_created",
    "message_notification_created",
    "attachment_visible",
    "completion_submitted_notification_created",
    "completion_approved_notification_created",
    "completion_notification_created",
    "review_notification_created",
    "review_submitted",
    "thread_exists_after_complete",
  ];

  const genState = {
    currentStep: "idle",
    flowId: "",
    projectId: "",
    threadId: "",
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

  let bridgeCallChain = Promise.resolve();

  function waitForBridgeReady() {
    if (genState.bridgeReady) return Promise.resolve();
    const frame = ensureBridgeFrame();
    return new Promise((resolve) => {
      const done = () => {
        genState.bridgeReady = true;
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

  function loadMvp() {
    try {
      return JSON.parse(localStorage.getItem(MVP_KEY) || "null");
    } catch {
      return null;
    }
  }

  function loadNotifs() {
    try {
      return JSON.parse(localStorage.getItem(NOTIFY_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function runGeneralDiagnostics() {
    const d = {};
    const flowId = genState.flowId || Bench.flow()?.id || "";
    const mvp = loadMvp();
    const notifs = loadNotifs();
    const thread = genState.threadId ? mvp?.threads?.[genState.threadId] : null;
    const project = genState.projectId
      ? (mvp?.projects || []).find((p) => p.project_id === genState.projectId)
      : null;

    d.application_notification_created = notifs.some(
      (n) => n.type === "application" && String(n.title || "").includes("応募")
    );
    d.chat_started = notifs.some(
      (n) =>
        (n.type === "selected" || n.type === "hire_confirmed") &&
        (String(n.actionLabel || "").includes("チャット") || String(n.body || "").includes("チャット"))
    );
    d.thread_created = Boolean(genState.threadId) && Boolean(mvp?.threads?.[genState.threadId]);
    d.message_notification_created = notifs.some((n) => n.type === "message");
    const msgs = (thread?.messages || []).flatMap((m) => m.attachments || []);
    d.attachment_visible = msgs.length > 0;
    d.completion_submitted_notification_created = notifs.some((n) => n.type === "completion_submitted");
    d.completion_approved_notification_created = notifs.some((n) => n.type === "completion_approved");
    d.completion_notification_created = notifs.some(
      (n) => n.type === "completed" || n.type === "completion_approved"
    );
    d.review_notification_created = notifs.some((n) => n.type === "review_request");
    d.review_submitted =
      thread?.review_submission?.status === "submitted" ||
      (mvp?.reviews || []).some((r) => r.thread_id === genState.threadId);
    d.thread_exists_after_complete =
      thread?.status === "completed" || thread?.siteData?.completed
        ? Boolean(mvp?.threads?.[genState.threadId])
        : null;

    GENERAL_DIAG_KEYS.forEach((k) => {
      genState.diag[k] = d[k] === true ? true : d[k] === false ? false : null;
    });

    const stepEl = document.getElementById("builderBenchGeneralStep");
    if (stepEl) {
      stepEl.textContent =
        `step: ${genState.currentStep} | flow: ${flowId} | project: ${genState.projectId || "—"} | thread: ${genState.threadId || "—"} | type: ${project?.bench_thread_type || Bench.flow()?.threadType || "—"}`;
    }
    return d;
  }

  function refreshGeneralFrames() {
    ["A", "B"].forEach((sk) => {
      Bench.refreshNotifyFrame?.(sk);
      Bench.refreshThreadFrames?.(sk);
    });
    runGeneralDiagnostics();
  }

  function logStep(step) {
    genState.currentStep = step;
    if (typeof Bench.logEvent === "function") Bench.logEvent(step, genState.threadId || genState.projectId);
  }

  async function genReset() {
    await callBridge("resetDemo");
    genState.currentStep = "idle";
    genState.projectId = "";
    genState.threadId = "";
    genState.flowId = Bench.flow()?.id || "";
    const created = await genCreateProject({ skipBoot: true });
    if (!created?.ok) {
      logStep("project_create_failed");
      refreshGeneralFrames();
      return created;
    }
    Bench.bootGeneralFlowFrames?.("genReset");
    logStep("bench_ready");
    return { ok: true, project_id: genState.projectId };
  }

  async function genCreateProject(options = {}) {
    const flowId = Bench.flow()?.id;
    if (!GENERAL_FLOW_IDS.has(flowId)) return { ok: false, error: "wrong_flow" };
    genState.flowId = flowId;
    const result = await callBridge("createGeneralFlowProject", flowId);
    if (!result?.ok) {
      logStep("project_create_failed");
      return result;
    }
    genState.projectId = result.project_id;
    genState.threadId = "";
    logStep("project_created");
    if (options?.skipBoot !== true) {
      Bench.bootGeneralFlowFrames?.("genCreateProject");
    }
    refreshGeneralFrames();
    return result;
  }

  function resolveFlowSides(f, spec) {
    const posterId = String(spec?.poster?.id || "").trim();
    const applicantId = String(spec?.applicant?.id || "").trim();
    const posterSide =
      posterId && f.sideA.actor?.id === posterId
        ? f.sideA
        : posterId && f.sideB.actor?.id === posterId
          ? f.sideB
          : f.sideA.role === spec?.poster?.role
            ? f.sideA
            : f.sideB;
    const applicantSide =
      applicantId && f.sideA.actor?.id === applicantId
        ? f.sideA
        : applicantId && f.sideB.actor?.id === applicantId
          ? f.sideB
          : f.sideA.role === spec?.applicant?.role
            ? f.sideA
            : f.sideB;
    return { posterSide, applicantSide };
  }

  async function genApply() {
    if (!genState.projectId) return { ok: false, error: "no_project" };
    const f = Bench.flow();
    const spec = await callBridge("getBenchGeneralFlowSpec", f.id);
    const { applicantSide, posterSide } = resolveFlowSides(f, spec);
    await callBridge("setContext", { role: applicantSide.role, applicantId: applicantSide.actor.id });
    const result = await callBridge("applyGeneralFlowProject", genState.projectId);
    if (!result?.ok) {
      logStep("apply_failed");
      return result;
    }
    logStep("applied");
    const posterSk = posterSide.key.toLowerCase();
    const applicantSk = applicantSide.key.toLowerCase();
    document.getElementById(`frame-${posterSk}-notify`)?.contentWindow?.location?.reload?.();
    document.getElementById(`frame-${applicantSk}-notify`)?.contentWindow?.location?.reload?.();
    document.getElementById(`frame-${applicantSk}-project`)?.contentWindow?.location?.reload?.();
    refreshGeneralFrames();
    return result;
  }

  async function genDeclineApplicant() {
    if (!genState.projectId) return { ok: false, error: "no_project" };
    const f = Bench.flow();
    const spec = await callBridge("getBenchGeneralFlowSpec", f.id);
    const { posterSide } = resolveFlowSides(f, spec);
    await callBridge("setContext", { role: posterSide.role, applicantId: posterSide.actor.id });
    const result = await callBridge("rejectGeneralFlowApplicant", genState.projectId);
    if (!result?.ok) {
      logStep("decline_failed");
      return result;
    }
    logStep("declined");
    const posterSk = posterSide.key.toLowerCase();
    document.getElementById(`frame-${posterSk}-notify`)?.contentWindow?.location?.reload?.();
    refreshGeneralFrames();
    return result;
  }

  async function genStartChat() {
    if (!genState.projectId) return { ok: false, error: "no_project" };
    const f = Bench.flow();
    const spec = await callBridge("getBenchGeneralFlowSpec", f.id);
    const { posterSide } = resolveFlowSides(f, spec);
    await callBridge("setContext", { role: posterSide.role, applicantId: posterSide.actor.id });
    const result = await callBridge("startGeneralFlowChat", genState.projectId);
    if (!result?.ok) {
      logStep("chat_start_failed");
      return result;
    }
    genState.threadId = result.threadId;
    logStep("chat_started");
    const tid = result.threadId;
    const tt = result.threadType || f.threadType;
    document.body.classList.remove("bench--general-prechat");
    ["A", "B"].forEach((sk) => {
      const side = sk === "A" ? f.sideA : f.sideB;
      Bench.activateBenchTab?.(sk, "thread", "genStartChat");
      const el = document.getElementById(sk === "A" ? "frame-a-thread" : "frame-b-thread");
      if (el) {
        const sp = new URLSearchParams();
        sp.set("thread_id", tid);
        sp.set("id", tid);
        sp.set("role", side.role);
        sp.set("threadType", tt);
        sp.set("benchEmbed", "1");
        sp.set("benchSide", sk);
        const url = `${builderBase()}mvp-thread.html?${sp.toString()}`;
        el.removeAttribute("srcdoc");
        el.dataset.currentSrc = url;
        el.src = url;
      }
    });
    document.getElementById("frame-a-notify")?.contentWindow?.location?.reload?.();
    document.getElementById("frame-b-notify")?.contentWindow?.location?.reload?.();
    refreshGeneralFrames();
    return result;
  }

  async function genSendMessage(sideKey, withAttachment) {
    if (!genState.threadId) return { ok: false, error: "no_thread" };
    const f = Bench.flow();
    const side = sideKey === "A" ? f.sideA : f.sideB;
    const text = `【ベンチ】${side.label}からのメッセージ`;
    const attachments = withAttachment
      ? [{ name: "見積資料_bench.pdf", type: "pdf", ts: new Date().toISOString() }]
      : [];
    await callBridge("setContext", { role: side.role, applicantId: side.actor.id });
    const ok = await callBridge("sendGeneralFlowMessage", genState.threadId, side.role, text, attachments);
    logStep(withAttachment ? "message_with_attachment" : "message_sent");
    refreshGeneralFrames();
    return { ok: Boolean(ok) };
  }

  async function genSubmitCompletion() {
    if (!genState.threadId) return { ok: false, error: "no_thread" };
    const f = Bench.flow();
    const spec = await callBridge("getBenchGeneralFlowSpec", f.id);
    const { applicantSide } = resolveFlowSides(f, spec);
    await callBridge("setContext", { role: applicantSide.role, partnerId: applicantSide.actor.id });
    const result = await callBridge("submitThreadCompletionReport", genState.threadId, {
      comment: "ベンチ検証 — 作業が完了しました。",
      photos: [{ name: "完了写真_bench.jpg", type: "image" }],
    });
    logStep(result?.ok ? "completion_submitted" : "completion_submit_failed");
    refreshGeneralFrames();
    return result;
  }

  async function genApproveCompletion() {
    if (!genState.threadId) return { ok: false, error: "no_thread" };
    const f = Bench.flow();
    const spec = await callBridge("getBenchGeneralFlowSpec", f.id);
    const { posterSide } = resolveFlowSides(f, spec);
    await callBridge("setContext", { role: posterSide.role, partnerId: posterSide.actor.id });
    const result = await callBridge("approveThreadCompletionReport", genState.threadId);
    logStep(result?.ok ? "completion_approved" : "completion_approve_failed");
    refreshGeneralFrames();
    return result;
  }

  async function genRejectCompletion(reason) {
    if (!genState.threadId) return { ok: false, error: "no_thread" };
    const f = Bench.flow();
    const spec = await callBridge("getBenchGeneralFlowSpec", f.id);
    const { posterSide } = resolveFlowSides(f, spec);
    await callBridge("setContext", { role: posterSide.role, partnerId: posterSide.actor.id });
    const result = await callBridge(
      "rejectThreadCompletionReport",
      genState.threadId,
      reason || "写真を追加してください"
    );
    logStep(result?.ok ? "completion_rejected" : "completion_reject_failed");
    refreshGeneralFrames();
    return result;
  }

  async function genComplete() {
    return genApproveCompletion();
  }

  async function genSubmitReview() {
    if (!genState.threadId) return { ok: false, error: "no_thread" };
    const f = Bench.flow();
    const spec = await callBridge("getBenchGeneralFlowSpec", f.id);
    const { posterSide } = resolveFlowSides(f, spec);
    await callBridge("setContext", { role: posterSide.role, applicantId: posterSide.actor.id });
    const result = await callBridge("submitGeneralFlowReview", genState.threadId, {
      rating: 5,
      comment: "迅速な対応で助かりました。ありがとうございました。",
    });
    logStep("review_submitted");
    refreshGeneralFrames();
    return result;
  }

  async function runFullCycle() {
    const flowId = Bench.flow()?.id;
    if (!GENERAL_FLOW_IDS.has(flowId)) return { ok: false, error: "wrong_flow" };
    const reset = await genReset();
    if (!reset?.ok) return reset;
    await genApply();
    await genStartChat();
    await genSendMessage("A", false);
    await genSendMessage("B", true);
    const submit = await genSubmitCompletion();
    if (!submit?.ok) return { ok: false, error: "completion_submit", submit };
    const approve = await genApproveCompletion();
    if (!approve?.ok) return { ok: false, error: "completion_approve", approve };
    await genSubmitReview();
    const diag = runGeneralDiagnostics();
    return { ok: true, diag, state: { ...genState } };
  }

  function patchNgCopy() {
    if (Bench.__generalNgPatched) return;
    Bench.__generalNgPatched = true;
    const orig = Bench.buildNgCopy;
    Bench.buildNgCopy = function () {
      const base = orig?.call(Bench) || "";
      if (!GENERAL_FLOW_IDS.has(Bench.flow()?.id)) return base;
      const f = Bench.flow();
      const lines = [
        base,
        "",
        "【一般案件フロー】",
        `builderFlow: ${f.id}`,
        `currentStep: ${genState.currentStep}`,
        `projectId: ${genState.projectId || "—"}`,
        `threadId: ${genState.threadId || "—"}`,
        `threadType: ${f.threadType}`,
        `roleA: ${f.sideA.role}`,
        `roleB: ${f.sideB.role}`,
        "",
        "【一般案件 診断】",
      ];
      GENERAL_DIAG_KEYS.forEach((k) => {
        const v = genState.diag[k];
        lines.push(`${v === true ? "OK" : v === false ? "NG" : "—"} ${k}`);
      });
      const notifs = loadNotifs();
      const last = notifs[0];
      lines.push(
        "",
        "【最新通知】",
        `notificationCreated: ${notifs.length > 0}`,
        `notificationClickTarget: ${last?.href || "—"}`
      );
      return lines.join("\n");
    };
  }

  function addGeneralToolbar() {
    if (!GENERAL_FLOW_IDS.has(Bench.flow()?.id)) return;
    if (document.getElementById("builderBenchGeneralRow")) return;
    const toolbar = document.querySelector(".bench-toolbar");
    if (!toolbar) return;
    const row = document.createElement("div");
    row.className = "bench-toolbar__row builder-bench-general-row";
    row.id = "builderBenchGeneralRow";
    row.innerHTML =
      `<div class="builder-bench-ops-actions">` +
      `<button type="button" class="bench-btn bench-btn--reset" id="genResetBtn">reset 一般案件</button>` +
      `<button type="button" class="bench-btn" id="genCreateBtn">案件記事を作成</button>` +
      `<button type="button" class="bench-btn" id="genApplyBtn">応募 / 相談</button>` +
      `<button type="button" class="bench-btn" id="genChatBtn">掲載者: チャットへ進む</button>` +
      `<button type="button" class="bench-btn" id="genMsgABtn">A: メッセージ</button>` +
      `<button type="button" class="bench-btn" id="genMsgBBtn">B: メッセージ+添付</button>` +
      `<button type="button" class="bench-btn" id="genCompleteBtn">完了報告提出</button>` +
      `<button type="button" class="bench-btn" id="genApproveBtn">承認する</button>` +
      `<button type="button" class="bench-btn" id="genRejectBtn">差し戻し</button>` +
      `<button type="button" class="bench-btn bench-btn--primary" id="genReviewBtn">レビュー投稿</button>` +
      `<button type="button" class="bench-btn" id="genFullCycleBtn">一周実行</button>` +
      `</div>` +
      `<p class="bench-meta" id="builderBenchGeneralStep">step: idle</p>`;
    toolbar.appendChild(row);

    document.getElementById("genResetBtn")?.addEventListener("click", () => genReset());
    document.getElementById("genCreateBtn")?.addEventListener("click", () => genCreateProject());
    document.getElementById("genApplyBtn")?.addEventListener("click", () => genApply());
    document.getElementById("genChatBtn")?.addEventListener("click", () => genStartChat());
    document.getElementById("genMsgABtn")?.addEventListener("click", () => genSendMessage("A", false));
    document.getElementById("genMsgBBtn")?.addEventListener("click", () => genSendMessage("B", true));
    document.getElementById("genCompleteBtn")?.addEventListener("click", () => genSubmitCompletion());
    document.getElementById("genApproveBtn")?.addEventListener("click", () => genApproveCompletion());
    document.getElementById("genRejectBtn")?.addEventListener("click", () => genRejectCompletion());
    document.getElementById("genReviewBtn")?.addEventListener("click", () => genSubmitReview());
    document.getElementById("genFullCycleBtn")?.addEventListener("click", () => runFullCycle());
  }

  function bootGeneralFlow() {
    const flowId = Bench.flow()?.id;
    if (!GENERAL_FLOW_IDS.has(flowId)) return Promise.resolve({ ok: false, error: "wrong_flow" });
    genState.flowId = flowId;
    ensureBridgeFrame();
    return waitForBridgeReady().then(() => genReset());
  }

  function initGeneralFlowBench() {
    const flowId = Bench.flow()?.id;
    if (!GENERAL_FLOW_IDS.has(flowId)) return;
    genState.flowId = flowId;
    ensureBridgeFrame();
    addGeneralToolbar();
    patchNgCopy();
    runGeneralDiagnostics();
    global.setInterval(runGeneralDiagnostics, 5000);
  }

  const origBoot = Bench.boot;
  Bench.boot = function () {
    origBoot.call(Bench);
    initGeneralFlowBench();
  };

  global.TasuBuilderGeneralFlowBench = {
    genState,
    callBridge,
    runGeneralDiagnostics,
    runFullCycle,
    bootGeneralFlow,
    refreshGeneralFrames,
    genReset,
    genCreateProject,
    genApply,
    genDeclineApplicant,
    genStartChat,
    genSendMessage,
    genSubmitCompletion,
    genApproveCompletion,
    genRejectCompletion,
    genComplete,
    genSubmitReview,
  };
})(typeof window !== "undefined" ? window : globalThis);
