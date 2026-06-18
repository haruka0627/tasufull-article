/**
 * Builder 通知・やりとり — 2窓検証ベンチ
 * chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner
 */
(function (global) {
  "use strict";

  const MVP_KEY = "tasful:builder:mvp:v1";
  const NOTIFY_KEY = "tasful:builder:mvp:notifications:v1";
  const OWNER_ID = "demo-owner-001";

  function generalFlowApi() {
    return global.TasuBuilderGeneralFlow;
  }

  const DIAG_KEYS = [
    "notification_created",
    "notification_visible",
    "notification_clickable",
    "notification_opens_correct_thread",
    "threadType_preserved",
    "role_preserved",
    "id_preserved",
    "unread_count_updated",
    "read_after_open",
    "reply_visible_on_peer",
    "no_wrong_thread_type",
    "no_old_url",
    "no_board_mvp_mix",
  ];

  function resolveGeneralBenchFlows() {
    const fromModule = generalFlowApi()?.createBenchFlowConfigs?.();
    if (fromModule && Object.keys(fromModule).length) return fromModule;
    return {};
  }

  const BUILDER_FLOWS = Object.freeze({
    ops_partner: {
      id: "ops_partner",
      label: "運営 ⇔ パートナー",
      kind: "mvp",
      threadType: "ops_partner",
      threadId: "thread-demo-001",
      urlId: "demo-thread-001",
      sideA: {
        key: "A",
        role: "owner",
        label: "運営",
        actor: { id: OWNER_ID, type: "owner", name: "TASFUL運営" },
        notifyRecipient: "partner",
      },
      sideB: {
        key: "B",
        role: "partner",
        label: "パートナー",
        actor: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
        notifyRecipient: "owner",
      },
    },
    ...Object.freeze(resolveGeneralBenchFlows()),
    board_project: {
      id: "board_project",
      label: "案件やりとり（board）",
      kind: "board",
      threadType: "general_project",
      threadId: "thread-demo-003",
      urlId: "demo-thread-003",
      sideA: {
        key: "A",
        role: "user",
        label: "案件投稿者",
        actor: { id: "demo-builder-user", type: "user", name: "山田 太郎" },
        notifyRecipient: "partner",
      },
      sideB: {
        key: "B",
        role: "partner",
        label: "応募者 / 選定者",
        actor: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
        notifyRecipient: "user",
      },
    },
  });

  const state = {
    flowId: "ops_partner",
    viewport: 390,
    diag: {},
    events: [],
    lastNgCopy: "",
    messageSeq: 0,
  };

  const iframeLoadCounts = {};
  const benchNotifyScrollState = {
    "frame-a-notify": { scrollTop: 0, isUserScrolling: false, scrollQuietUntil: 0 },
    "frame-b-notify": { scrollTop: 0, isUserScrolling: false, scrollQuietUntil: 0 },
  };
  let diagTimer = null;
  const DIAG_DEBOUNCE_MS = 250;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeBenchFrameUrl(url) {
    const target = pickStr(url);
    if (!target) return "";
    if (target.startsWith("http")) return target;
    const page = target.split("?")[0].split("/").pop() || "";
    const base = isSiteRootBenchPage(page) ? siteBase() : builderBase();
    return new URL(target, base).href;
  }

  function scheduleRunDiagnostics() {
    if (diagTimer) global.clearTimeout(diagTimer);
    diagTimer = global.setTimeout(() => {
      diagTimer = null;
      runDiagnostics();
    }, DIAG_DEBOUNCE_MS);
  }

  function isNotifyFrameUserScrolling(frameId) {
    const row = benchNotifyScrollState[pickStr(frameId)];
    if (!row) return false;
    if (row.isUserScrolling && Date.now() < row.scrollQuietUntil) return true;
    if (Date.now() >= row.scrollQuietUntil) row.isUserScrolling = false;
    return false;
  }

  function readNotifyListScrollTop(frameId) {
    try {
      const doc = document.getElementById(frameId)?.contentWindow?.document;
      const list = doc?.querySelector("[data-talk-notify-list]");
      return Math.round(list?.scrollTop || 0);
    } catch {
      return benchNotifyScrollState[pickStr(frameId)]?.scrollTop || 0;
    }
  }

  function restoreNotifyListScrollTop(frameId, top) {
    const target = Math.max(0, Math.round(Number(top) || 0));
    try {
      const doc = document.getElementById(frameId)?.contentWindow?.document;
      const list = doc?.querySelector("[data-talk-notify-list]");
      if (!list) return false;
      const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
      list.scrollTop = Math.min(target, maxScroll);
      const row = benchNotifyScrollState[pickStr(frameId)];
      if (row) row.scrollTop = list.scrollTop;
      return true;
    } catch {
      return false;
    }
  }

  function postNotifyFrameHeightToIframe(frameId, options = {}) {
    const fid = pickStr(frameId);
    const el = document.getElementById(fid);
    if (!el?.contentWindow) return false;
    if (!options.force && isNotifyFrameUserScrolling(fid)) return false;
    const wrap = el.closest(".bench-pane__frame-wrap");
    const h = Math.max(
      96,
      Math.round(
        wrap?.getBoundingClientRect?.().height ||
          el.getBoundingClientRect?.().height ||
          320
      )
    );
    const beforeTop = readNotifyListScrollTop(fid);
    try {
      el.contentWindow.postMessage({ type: "tasu-bench-notify-frame-height", height: h }, "*");
      global.setTimeout(() => {
        if (beforeTop > 0 || benchNotifyScrollState[fid]?.scrollTop > 0) {
          restoreNotifyListScrollTop(fid, benchNotifyScrollState[fid]?.scrollTop || beforeTop);
        }
      }, 48);
      return true;
    } catch {
      return false;
    }
  }

  function syncAllNotifyFrameHeights(reason) {
    ["frame-a-notify", "frame-b-notify"].forEach((frameId) => {
      postNotifyFrameHeightToIframe(frameId, { reason: pickStr(reason, "sync") });
    });
  }

  function wireNotifyFrameHeightSync() {
    if (global.__builderBenchNotifyHeightWired) return;
    global.__builderBenchNotifyHeightWired = true;
    ["frame-a-notify", "frame-b-notify"].forEach((frameId) => {
      const el = document.getElementById(frameId);
      if (!el || el.dataset.notifyHeightWired === "1") return;
      el.dataset.notifyHeightWired = "1";
      const sync = () => {
        postNotifyFrameHeightToIframe(frameId, { reason: "iframe_load" });
        global.setTimeout(() => postNotifyFrameHeightToIframe(frameId, { reason: "iframe_load_delay" }), 120);
        global.setTimeout(() => postNotifyFrameHeightToIframe(frameId, { reason: "iframe_load_delay2" }), 480);
      };
      el.addEventListener("load", sync);
    });
    global.addEventListener("resize", () => syncAllNotifyFrameHeights("resize"));
  }

  function wireIframeLoadCounters() {
    document.querySelectorAll("iframe[id^='frame-']").forEach((el) => {
      if (el.dataset.loadWired === "1") return;
      el.dataset.loadWired = "1";
      el.addEventListener("load", () => {
        iframeLoadCounts[el.id] = (iframeLoadCounts[el.id] || 0) + 1;
        const count = iframeLoadCounts[el.id];
        const href = pickStr(el.dataset.currentSrc, el.contentWindow?.location?.href);
        if (count <= 3 || count % 5 === 0) {
          logEvent("iframe_load_count", `${el.id}=${count} href=${href.split("/").pop() || href}`);
        }
        if (el.id === "frame-a-notify" || el.id === "frame-b-notify") {
          postNotifyFrameHeightToIframe(el.id, { reason: "iframe_load_counter" });
        }
        if (flow().id === "ops_partner" && isOpsPartnerBlockedBenchUrl(href)) {
          const sk = el.id.includes("-a-") ? "A" : el.id.includes("-b-") ? "B" : "";
          logEvent("iframe_load_blocked", `source=iframeLoad frame=${el.id} href=${href}`);
          if (el.id.endsWith("-thread") && sk) {
            setDetailPlaceholder(sk);
          } else if (el.id.endsWith("-project") && sk) {
            clearOpsProjectFrame(sk);
          }
          forceOpsPartnerIdleFrames("iframeLoad");
        }
      });
    });
  }

  function flow() {
    return BUILDER_FLOWS[state.flowId] || BUILDER_FLOWS.ops_partner;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function loadMvp() {
    try {
      const raw = localStorage.getItem(MVP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveMvp(data) {
    localStorage.setItem(MVP_KEY, JSON.stringify(data));
    global.dispatchEvent?.(new CustomEvent("builder:mvp-changed"));
  }

  function loadNotifications() {
    try {
      const raw = localStorage.getItem(NOTIFY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveNotifications(rows) {
    localStorage.setItem(NOTIFY_KEY, JSON.stringify(rows));
    global.dispatchEvent?.(new CustomEvent("builder:mvp-notifications-changed"));
  }

  function builderBase() {
    const origin = global.location.origin;
    const path = global.location.pathname.replace(/[^/]+$/, "");
    return `${origin}${path}builder/`;
  }

  function siteBase() {
    const origin = global.location.origin;
    const path = global.location.pathname.replace(/[^/]+$/, "");
    return `${origin}${path}`;
  }

  function isSiteRootBenchPage(page) {
    return /^(public-board-detail|public-board|detail-job|talk-home)\.html$/i.test(String(page || ""));
  }

  function buildPublicPageUrl(page, params, side) {
    const sp = new URLSearchParams(params || {});
    sp.set("benchEmbed", "1");
    sp.set("benchSide", side);
    const f = flow();
    const sideMeta = side === "A" ? f.sideA : f.sideB;
    if (GENERAL_FLOW_IDS.has(f.id) && sideMeta?.actor?.id) {
      if (!pickStr(sp.get("partnerId"), sp.get("partner_id"))) {
        sp.set("partnerId", sideMeta.actor.id);
      }
    }
    const builderFlow = generalFlowApi()?.getBenchBuilderFlowParam?.(f.id);
    if (builderFlow) sp.set("builderFlow", builderFlow);
    return `${siteBase()}${page}?${sp.toString()}`;
  }

  function generalVariantPublicDetailUrl(sideMeta) {
    const f = flow();
    const pd = generalFlowApi()?.resolvePublicDetailParams?.(f.id);
    if (!pd) return "";
    return buildPublicPageUrl(
      pd.page,
      { id: pd.id, type: pd.type, role: sideMeta.role },
      sideMeta.key
    );
  }

  function buildPageUrl(page, params, side) {
    const sp = new URLSearchParams(params || {});
    sp.set("benchEmbed", "1");
    sp.set("benchSide", side);
    const f = flow();
    const sideMeta = side === "A" ? f.sideA : f.sideB;
    if (GENERAL_FLOW_IDS.has(f.id) && sideMeta?.actor?.id) {
      if (!pickStr(sp.get("partnerId"), sp.get("partner_id"))) {
        sp.set("partnerId", sideMeta.actor.id);
      }
    }
    if (flow().id === "ops_partner") {
      sp.set("builderFlow", "ops_partner");
    }
    return `${builderBase()}${page}?${sp.toString()}`;
  }

  function talkNotifyUrl(sideMeta) {
    const origin = global.location.origin;
    const path = global.location.pathname.replace(/[^/]+$/, "");
    const sp = new URLSearchParams();
    sp.set("tab", "notify");
    sp.set("benchEmbed", "1");
    sp.set("benchSide", sideMeta.key);
    sp.set("userId", sideMeta.actor.id);
    const f = flow();
    if (f.id === "ops_partner" || isGeneralFlowBench()) {
      sp.set("builderFlow", f.id);
    }
    return `${origin}${path}talk-home.html?${sp.toString()}`;
  }

  function notifyUrl(sideMeta) {
    const f = flow();
    if (f.id === "ops_partner" || isGeneralFlowBench()) return talkNotifyUrl(sideMeta);
    if (f.kind === "board") {
      return buildPageUrl("mvp-notifications.html", { role: sideMeta.role }, sideMeta.key);
    }
    return buildPageUrl("mvp-notifications.html", { role: sideMeta.role }, sideMeta.key);
  }

  function threadsUrl(sideMeta) {
    const f = flow();
    if (f.kind === "board") {
      return buildPageUrl("board-threads.html", { role: sideMeta.role }, sideMeta.key);
    }
    return buildPageUrl("mvp-threads.html", { role: sideMeta.role }, sideMeta.key);
  }

  function resolveGeneralFlowThreadId() {
    const f = flow();
    const genState = global.TasuBuilderGeneralFlowBench?.genState;
    const fromGen = pickStr(genState?.threadId);
    if (fromGen) return fromGen;
    if (isGeneralFlowBench()) {
      const mvp = loadMvp();
      const pid = pickStr(genState?.projectId);
      const project = pid ? (mvp?.projects || []).find((p) => p.project_id === pid) : null;
      return pickStr(project?.main_thread_id);
    }
    const mvp = loadMvp();
    const pid = pickStr(genState?.projectId);
    const project = pid ? (mvp?.projects || []).find((p) => p.project_id === pid) : null;
    return pickStr(project?.main_thread_id, f.threadId);
  }

  function threadUrl(sideMeta) {
    const f = flow();
    if (f.id === "ops_partner") {
      return resolveOpsPartnerThreadBenchUrl(sideMeta);
    }
    if (f.kind === "board") {
      return buildPageUrl(
        "board-thread.html",
        { role: sideMeta.role, id: f.urlId, thread_id: f.threadId },
        sideMeta.key
      );
    }
    const dynamicThreadId = resolveGeneralFlowThreadId();
    if (isGeneralFlowBench() && !dynamicThreadId) return "";
    if (dynamicThreadId) {
      return buildPageUrl(
        "mvp-thread.html",
        {
          threadType: f.threadType,
          role: sideMeta.role,
          id: dynamicThreadId,
          thread_id: dynamicThreadId,
        },
        sideMeta.key
      );
    }
    return buildPageUrl(
      "mvp-thread.html",
      {
        threadType: f.threadType,
        role: sideMeta.role,
        id: f.urlId,
        thread_id: f.threadId,
      },
      sideMeta.key
    );
  }

  const GENERAL_FLOW_IDS = new Set(
    generalFlowApi()?.getGeneralFlowVariantIds?.() || ["partner_user", "user_user", "vendor_user"]
  );

  const OPS_THREAD_BLANK =
    '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><style>body{margin:0;font-family:system-ui,sans-serif;background:#fafaf9;color:#78716c;display:flex;align-items:center;justify-content:center;min-height:120px;padding:1rem;text-align:center;font-size:0.8125rem;line-height:1.5}</style></head><body><p>受諾前は現場連絡は表示されません。<br>通知から案件を確認し「受ける」を押してください。</p></body></html>';

  const GENERAL_THREAD_BLANK =
    '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><style>body{margin:0;font-family:system-ui,sans-serif;background:#fafaf9;color:#78716c;display:flex;align-items:center;justify-content:center;min-height:120px;padding:1rem;text-align:center;font-size:0.8125rem;line-height:1.5}</style></head><body><p>やりとりはまだ開始されていません。<br>応募 → 掲載者が「やりとりを開始」するとチャットが開通します。</p></body></html>';

  function isGeneralFlowBench() {
    return GENERAL_FLOW_IDS.has(flow().id);
  }

  function generalApplicantSideKey() {
    return generalFlowApi()?.generalApplicantSideKey?.(flow()) || (flow().generalPosterSide === "B" ? "A" : "B");
  }

  function isGeneralFlowPreChat() {
    if (!isGeneralFlowBench()) return false;
    const genState = global.TasuBuilderGeneralFlowBench?.genState;
    return !pickStr(genState?.threadId);
  }

  function stripMvpThreadCompletionNavTriggers(url) {
    try {
      const u = new URL(url, builderBase());
      if (u.pathname.endsWith("mvp-thread.html")) {
        u.hash = "";
      } else if (["#photos", "#photo", "#completion", "#report", "#files"].includes(u.hash.toLowerCase())) {
        u.hash = "";
      }
      u.searchParams.delete("completion");
      u.searchParams.delete("openCompletion");
      u.searchParams.delete("openPhoto");
      u.searchParams.delete("photo");
      u.searchParams.delete("activePanel");
      return u;
    } catch {
      return null;
    }
  }

  function enrichBenchPageUrl(href, sideKey) {
    const f = flow();
    const side = sideKey === "A" ? f.sideA : f.sideB;
    const target = pickStr(href);
    if (!target) return projectUrl(side);
    try {
      const cleaned = stripMvpThreadCompletionNavTriggers(target) || new URL(target, builderBase());
      const u = cleaned;
      const page = u.pathname.split("/").pop() || "partner-assignment.html";
      const params = {};
      u.searchParams.forEach((v, k) => {
        params[k] = v;
      });
      if (!params.role) params.role = side.role;
      if (isGeneralFlowBench() && page === "mvp-thread.html") {
        if (!params.threadType) params.threadType = f.threadType;
        const tid = pickStr(params.thread_id, params.id);
        if (tid && !params.thread_id) params.thread_id = tid;
      }
      if (
        params.view === "applications" &&
        isGeneralFlowBench() &&
        side.key === generalApplicantSideKey()
      ) {
        delete params.view;
      } else if (params.view === "applications" && !params.from) {
        params.from = "notify";
      }
      if (f.id === "ops_partner" && page === "partner-assignment.html" && side.key === "B") {
        if (!params.partnerId) params.partnerId = "demo-partner-001";
      }
      if (isSiteRootBenchPage(page)) {
        return buildPublicPageUrl(page, params, side.key);
      }
      return buildPageUrl(page, params, side.key);
    } catch {
      return projectUrl(side);
    }
  }

  function resolveOpsPartnerThreadBenchUrl(sideMeta) {
    const tid = resolveOpsThreadId();
    if (!tid) return "";
    const urlId = tid.replace("thread-", "demo-");
    return buildPageUrl(
      "mvp-thread.html",
      { threadType: "ops_partner", role: sideMeta.role, id: urlId, thread_id: tid },
      sideMeta.key
    );
  }

  function isOpsPartnerIdle() {
    if (flow().id !== "ops_partner") return false;
    if (opsPartnerAllowsThreadSurface()) return false;
    const ops = global.TasuBuilderOpsPartnerBench?.opsState;
    return pickStr(ops?.currentStep, "idle") === "idle" && !ops?.assignmentRevealed;
  }

  function updateOpsBenchChrome() {
    document.body.classList.toggle("bench--ops-idle", isOpsPartnerIdle());
  }

  function opsPartnerCalendarUrl(sideMeta) {
    if (sideMeta.key === "A") {
      return buildPageUrl("admin-calendar.html", { role: "owner" }, "A");
    }
    return buildPageUrl(
      "mvp-calendar.html",
      { role: "partner", partnerId: "demo-partner-001" },
      "B"
    );
  }

  function opsPartnerProjectUrl(sideMeta, opts = {}) {
    if (sideMeta.key !== "B") return "";
    const ops = global.TasuBuilderOpsPartnerBench?.opsState;
    const pid = pickStr(opts.projectId, ops?.projectId);
    const aid = pickStr(opts.assignmentId, ops?.assignmentId);
    if (!pid || !ops?.assignmentRevealed) return "";
    const params = { role: "partner", partnerId: "demo-partner-001", projectId: pid };
    if (aid) params.calendarEventId = aid;
    return buildPageUrl("partner-assignment.html", params, "B");
  }

  /** @deprecated use opsPartnerCalendarUrl / opsPartnerProjectUrl */
  function opsPartnerWorkUrl(sideMeta, opts = {}) {
    const project = opsPartnerProjectUrl(sideMeta, opts);
    if (project) return project;
    return opsPartnerCalendarUrl(sideMeta);
  }

  function projectUrl(sideMeta, opts = {}) {
    const f = flow();
    if (f.id === "ops_partner") {
      return opsPartnerProjectUrl(sideMeta, opts);
    }
    if (isGeneralFlowBench()) {
      const variant = generalFlowApi()?.getVariantConfig?.(f.id);
      if (variant?.bench?.projectDetailPage === "public") {
        return generalVariantPublicDetailUrl(sideMeta);
      }
      const genState = global.TasuBuilderGeneralFlowBench?.genState;
      const pid = pickStr(opts.projectId, genState?.projectId);
      if (!pid) return "";
      const params = { id: pid, role: sideMeta.role };
      const view = pickStr(opts.view);
      if (view) params.view = view;
      if (
        !view &&
        sideMeta.key === generalApplicantSideKey() &&
        isGeneralFlowPreChat()
      ) {
        params.benchFocus = "apply";
      }
      return buildPageUrl("mvp-project-detail.html", params, sideMeta.key);
    }
    if (f.kind === "board") {
      return buildPageUrl("board-projects.html", { role: sideMeta.role }, sideMeta.key);
    }
    const mvp = loadMvp();
    const thread = mvp?.threads?.[f.threadId];
    const pid = pickStr(thread?.project_id);
    if (pid) {
      return buildPageUrl("mvp-project-detail.html", { id: pid, role: sideMeta.role }, sideMeta.key);
    }
    return buildPageUrl("mvp-project-detail.html", { id: "demo-project-001", role: sideMeta.role }, sideMeta.key);
  }

  function frameIds(sideKey) {
    const sk = sideKey === "A" ? "a" : "b";
    return {
      notify: `frame-${sk}-notify`,
      calendar: `frame-${sk}-calendar`,
      project: `frame-${sk}-project`,
      threads: `frame-${sk}-threads`,
      thread: `frame-${sk}-thread`,
    };
  }

  function sideKeyToSk(sideKey) {
    return sideKey === "A" ? "a" : "b";
  }

  function describeBenchFrame(frameId) {
    const el = document.getElementById(frameId);
    if (!el) return "missing";
    if (el.srcdoc && el.srcdoc.includes("受諾前")) return "placeholder";
    const raw = pickStr(el.dataset.currentSrc, el.getAttribute("src"), el.contentWindow?.location?.href);
    if (!raw || raw === "about:blank") return "about:blank";
    try {
      const u = new URL(raw);
      return `${u.pathname.split("/").pop() || ""}${u.search}`;
    } catch {
      return raw;
    }
  }

  function resolveOpsBenchThreadIdFromUrl() {
    try {
      const params = new URLSearchParams(global.location.search);
      return pickStr(params.get("benchThreadId"), params.get("threadId"));
    } catch {
      return "";
    }
  }

  function resolveOpsThreadId() {
    if (flow().id !== "ops_partner") return "";
    if (!opsPartnerAllowsThreadSurface()) return "";
    const urlTid = resolveOpsBenchThreadIdFromUrl();
    if (urlTid) return urlTid;
    return pickStr(global.TasuBuilderOpsPartnerBench?.opsState?.threadId);
  }

  function hasExplicitOpsBenchThreadParam() {
    return Boolean(resolveOpsBenchThreadIdFromUrl());
  }

  function hydrateOpsStateFromBenchUrl() {
    if (flow().id !== "ops_partner") return;
    if (!hasExplicitOpsBenchThreadParam()) return;
    const tid = resolveOpsBenchThreadIdFromUrl();
    if (!tid) return;
    const ops = global.TasuBuilderOpsPartnerBench?.opsState;
    if (!ops) return;
    ops.threadId = tid;
    ops.partnerDecision = "accepted";
    ops.currentStep = "partner_accepted";
    try {
      const params = new URLSearchParams(global.location.search);
      const pid = pickStr(params.get("benchProjectId"), params.get("projectId"));
      if (pid) ops.projectId = pid;
    } catch {
      /* ignore */
    }
  }

  function opsPartnerAllowsThreadSurface() {
    if (flow().id !== "ops_partner") return true;
    if (hasExplicitOpsBenchThreadParam()) return true;
    const ops = global.TasuBuilderOpsPartnerBench?.opsState;
    if (!ops) return false;
    const step = pickStr(ops.currentStep, "idle");
    if (step === "idle") return false;
    const tid = pickStr(ops.threadId);
    if (!tid) return false;
    return (
      step === "partner_accepted" ||
      step === "partner_entered" ||
      step === "partner_exited" ||
      step === "completion_submitted" ||
      step === "completion_approved"
    );
  }

  function isOpsPartnerBlockedBenchUrl(url) {
    if (flow().id !== "ops_partner") return false;
    if (opsPartnerAllowsThreadSurface()) return false;
    const raw = String(url || "").toLowerCase();
    return raw.includes("mvp-thread.html") || raw.includes("mvp-project-detail.html");
  }

  function logOpsPartnerTabTrace(kind, detail = {}) {
    if (flow().id !== "ops_partner") return;
    const payload = {
      kind,
      source: pickStr(detail.source, "?"),
      sideKey: pickStr(detail.sideKey),
      tabId: pickStr(detail.tabId),
      threadId: resolveOpsThreadId(),
      explicitThread: hasExplicitOpsBenchThreadParam(),
      step: pickStr(global.TasuBuilderOpsPartnerBench?.opsState?.currentStep, "idle"),
    };
    logEvent("ops_partner_tab_trace", JSON.stringify(payload));
    if (kind === "activate_thread") {
      try {
        console.trace("[ops_partner] activate thread", payload);
      } catch {
        /* ignore */
      }
    }
  }

  function restoreOpsPartnerState(source) {
    const src = pickStr(source, "restoreOpsPartnerState");
    logOpsPartnerTabTrace("restoreOpsPartnerState", { source: src });
    if (!hasExplicitOpsBenchThreadParam()) {
      logEvent("restoreOpsPartnerState_skip", `source=${src} reason=no_explicit_thread_param`);
      return false;
    }
    hydrateOpsStateFromBenchUrl();
    return true;
  }

  function forceOpsPartnerIdleFrames(source) {
    if (flow().id !== "ops_partner") return;
    if (opsPartnerAllowsThreadSurface()) return;
    const src = pickStr(source, "forceOpsPartnerIdleFrames");
    const f = flow();
    [f.sideA, f.sideB].forEach((side) => {
      const sk = side.key;
      activateBenchTabInternal(sk, "calendar");
      setBenchFrameUrl(frameIds(sk).calendar, opsPartnerCalendarUrl(side), { source: src, opsForce: true });
      clearOpsProjectFrame(sk);
      setDetailPlaceholder(sk);
    });
    updateOpsBenchChrome();
    logBenchSlotDebug("A", src);
    logBenchSlotDebug("B", src);
  }

  function clearAllOpsPartnerBenchFrameSrc(source) {
    const src = pickStr(source, "clearAllOpsPartnerBenchFrameSrc");
    ["A", "B"].forEach((sk) => {
      clearOpsProjectFrame(sk);
      setDetailPlaceholder(sk);
      const ids = frameIds(sk);
      const cal = document.getElementById(ids.calendar);
      if (cal) {
        delete cal.dataset.currentSrc;
      }
    });
    logEvent("ops_partner_frames_cleared", src);
  }

  function getActiveTabIdFromDom(sideKey) {
    const sk = sideKeyToSk(sideKey);
    const active = document.querySelector(
      `[data-builder-tab][data-builder-side="${sk}"].is-active`
    );
    return pickStr(active?.getAttribute("data-builder-tab"), "");
  }

  function resolveActiveTabId(sideKey) {
    const domTab = getActiveTabIdFromDom(sideKey);
    if (isGeneralFlowBench()) {
      if (isGeneralFlowPreChat()) {
        return sideKey === generalApplicantSideKey() ? "project" : domTab || "thread";
      }
      return domTab || "thread";
    }
    if (flow().id !== "ops_partner") return domTab || "thread";
    const threadId = resolveOpsThreadId();
    const projectSrc = describeBenchFrame(frameIds(sideKey).project);
    if (isOpsPartnerIdle()) return "calendar";
    if (!threadId) {
      if (domTab === "thread") return "project";
      if (projectSrc.includes("partner-assignment")) return "project";
      return domTab || "calendar";
    }
    return domTab || "thread";
  }

  function activateBenchTabInternal(sideKey, tabId) {
    const sk = sideKeyToSk(sideKey);
    const col = document.querySelector(`.bench-col--${sk}`);
    if (!col) return;
    col.querySelectorAll(`[data-builder-tab][data-builder-side="${sk}"]`).forEach((btn) => {
      const active = btn.getAttribute("data-builder-tab") === tabId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    col.querySelectorAll(`.builder-bench-tab-panel[data-builder-side="${sk}"]`).forEach((panel) => {
      const active = panel.getAttribute("data-panel") === tabId;
      panel.classList.toggle("is-active", active);
      if (active) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });
  }

  function reconcileOpsPartnerTab(sideKey, source) {
    if (flow().id !== "ops_partner") return;
    updateOpsBenchChrome();
    const threadId = resolveOpsThreadId();
    const domTab = getActiveTabIdFromDom(sideKey);
    const projectSrc = describeBenchFrame(frameIds(sideKey).project);
    const ops = global.TasuBuilderOpsPartnerBench?.opsState;
    if (isOpsPartnerIdle()) {
      if (domTab !== "calendar") {
        activateBenchTabInternal(sideKey, "calendar");
      }
      return;
    }
    const mustBeProject =
      !threadId &&
      ops?.assignmentRevealed &&
      (domTab === "thread" || projectSrc.includes("partner-assignment"));
    if (mustBeProject && domTab !== "project") {
      activateBenchTabInternal(sideKey, "project");
      logEvent(
        "bench_tab_reconcile",
        `source=${source || "?"} dom=${domTab || "—"}→project threadId=`
      );
    }
  }

  function logBenchSlotDebug(sideKey, source) {
    const src = pickStr(source, "logBenchSlotDebug");
    reconcileOpsPartnerTab(sideKey, src);
    const ids = frameIds(sideKey);
    const threadId = resolveOpsThreadId();
    const calendarFrameSrc = describeBenchFrame(ids.calendar);
    const projectFrameSrc = describeBenchFrame(ids.project);
    let activeTab = resolveActiveTabId(sideKey);
    if (!threadId && projectFrameSrc.includes("partner-assignment") && activeTab === "thread") {
      activeTab = "project";
      activateBenchTabInternal(sideKey, "project");
    }
    const detail = [
      `source=${src}`,
      `activeTab=${activeTab}`,
      `calendarFrameSrc=${calendarFrameSrc}`,
      `projectFrameSrc=${projectFrameSrc}`,
      `detailFrameSrc=${describeBenchFrame(ids.thread)}`,
      `threadId=${threadId}`,
    ].join(" | ");
    logEvent("bench_slot_debug", detail);
    const meta = document.getElementById("builderBenchMeta");
    if (meta && flow().id === "ops_partner") {
      meta.textContent = `${meta.textContent.split(" || ")[0]} || ${detail}`;
    }
    return detail;
  }

  function activateBenchTab(sideKey, tabId, source) {
    const src = pickStr(source, "activateBenchTab");
    let nextTab = tabId;
    if (flow().id === "ops_partner" && nextTab === "thread") {
      if (!opsPartnerAllowsThreadSurface()) {
        logOpsPartnerTabTrace("activate_thread_blocked", {
          source: src,
          sideKey,
          tabId: nextTab,
        });
        logEvent("bench_tab_guard", `source=${src} requested=thread → calendar (ops idle)`);
        nextTab = "calendar";
      } else {
        logOpsPartnerTabTrace("activate_thread", { source: src, sideKey, tabId: nextTab });
      }
    }
    activateBenchTabInternal(sideKey, nextTab);
  }

  function ensureTabFrameLoaded(sideKey, tabId) {
    const f = flow();
    const side = sideKey === "A" ? f.sideA : f.sideB;
    const ids = frameIds(sideKey);
    if (tabId === "calendar") setBenchFrameUrl(ids.calendar, opsPartnerCalendarUrl(side));
    else if (tabId === "project") {
      const url = projectUrl(side);
      if (url) setBenchFrameUrl(ids.project, url);
      else clearOpsProjectFrame(sideKey);
    } else if (tabId === "threads") setBenchFrameUrl(ids.threads, threadsUrl(side));
    else if (tabId === "thread") {
      const url = threadUrl(side);
      if (url) setBenchFrameUrl(ids.thread, url);
      else setDetailPlaceholder(sideKey);
    }
  }

  function switchSideTab(sideKey, tabId, source) {
    const src = pickStr(source, "switchSideTab");
    if (flow().id === "ops_partner" && tabId === "thread" && !resolveOpsThreadId()) {
      activateBenchTab(sideKey, "project", src);
      ensureTabFrameLoaded(sideKey, "project");
      logBenchSlotDebug(sideKey, src);
      return;
    }
    activateBenchTab(sideKey, tabId, src);
    ensureTabFrameLoaded(sideKey, tabId);
  }

  function clearOpsProjectFrame(sideKey) {
    const id = frameIds(sideKey).project;
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset.currentSrc === "about:blank") return;
    el.removeAttribute("srcdoc");
    el.srcdoc = "";
    el.dataset.currentSrc = "about:blank";
    try {
      if (el.contentWindow?.location) el.contentWindow.location.replace("about:blank");
      else el.src = "about:blank";
    } catch {
      el.src = "about:blank";
    }
  }

  function loadCalendarSlot(sideKey, source) {
    const src = pickStr(source, "loadCalendarSlot");
    updateOpsBenchChrome();
    const f = flow();
    const side = sideKey === "A" ? f.sideA : f.sideB;
    const ids = frameIds(sideKey);
    activateBenchTabInternal(sideKey, "calendar");
    setBenchFrameUrl(ids.calendar, opsPartnerCalendarUrl(side));
    clearOpsProjectFrame(sideKey);
    setDetailPlaceholder(sideKey);
    logBenchSlotDebug(sideKey, src);
  }

  function focusBenchWorkPane(sideKey) {
    const sk = sideKey === "A" ? "a" : "b";
    const col = document.querySelector(`.bench-col--${sk}`);
    const workPane = col?.querySelector(".bench-pane--work");
    if (!workPane) return;
    try {
      workPane.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      workPane.scrollIntoView();
    }
    col?.querySelector('[data-builder-tab="project"]')?.focus?.();
  }

  function loadProjectSlot(sideKey, url, source) {
    const src = pickStr(source, "loadProjectSlot");
    logOpsPartnerTabTrace("loadProjectSlot", { source: src, sideKey });
    if (flow().id === "ops_partner" && isOpsPartnerBlockedBenchUrl(url)) {
      logEvent("loadProjectSlot_blocked", `source=${src} side=${sideKey} url=${url}`);
      clearOpsProjectFrame(sideKey);
      return;
    }
    updateOpsBenchChrome();
    document.body.classList.remove("bench--ops-idle");
    activateBenchTab(sideKey, "project", src);
    if (pickStr(url)) {
      setBenchFrameUrl(frameIds(sideKey).project, url, { source: src });
    } else {
      clearOpsProjectFrame(sideKey);
    }
    logBenchSlotDebug(sideKey, src);
  }

  function loadDetailSlot(sideKey, url, source) {
    const src = pickStr(source, "loadDetailSlot");
    logOpsPartnerTabTrace("loadDetailSlot", { source: src, sideKey });
    if (
      flow().id === "ops_partner" &&
      !hasExplicitOpsBenchThreadParam() &&
      !pickStr(global.TasuBuilderOpsPartnerBench?.opsState?.threadId)
    ) {
      logEvent("loadDetailSlot_blocked", `source=${src} side=${sideKey} reason=no_explicit_thread`);
      setDetailPlaceholder(sideKey);
      return;
    }
    if (flow().id === "ops_partner" && !opsPartnerAllowsThreadSurface()) {
      logEvent("loadDetailSlot_blocked", `source=${src} side=${sideKey} reason=ops_idle`);
      setDetailPlaceholder(sideKey);
      return;
    }
    activateBenchTab(sideKey, "thread", src);
    const frameId = frameIds(sideKey).thread;
    if (pickStr(url)) {
      setBenchFrameUrl(frameId, url, { forceReload: String(url).includes("notifyOpen=1") });
    } else {
      setDetailPlaceholder(sideKey);
    }
    logBenchSlotDebug(sideKey, src);
  }

  function setDetailPlaceholder(sideKey) {
    const el = document.getElementById(frameIds(sideKey).thread);
    if (!el) return;
    const blank = isGeneralFlowBench() ? GENERAL_THREAD_BLANK : OPS_THREAD_BLANK;
    if (el.srcdoc === blank) return;
    el.removeAttribute("src");
    delete el.dataset.currentSrc;
    el.srcdoc = blank;
  }

  function bootGeneralFlowFrames(source) {
    const src = pickStr(source, "bootGeneralFlowFrames");
    if (!isGeneralFlowBench()) return;
    const f = flow();
    const applicantKey = generalApplicantSideKey();
    [f.sideA, f.sideB].forEach((side) => {
      const ids = frameIds(side.key);
      setFrameSrc(ids.notify, notifyUrl(side));
      if (side.key === applicantKey) {
        activateBenchTabInternal(side.key, "project");
        const projectTarget = projectUrl(side);
        if (projectTarget) setFrameSrc(ids.project, projectTarget, { source: src });
        else clearOpsProjectFrame(side.key);
        setDetailPlaceholder(side.key);
      } else {
        activateBenchTabInternal(side.key, "thread");
        setDetailPlaceholder(side.key);
        clearOpsProjectFrame(side.key);
      }
      setFrameSrc(ids.threads, threadsUrl(side));
    });
    document.body.classList.toggle("bench--general-prechat", isGeneralFlowPreChat());
    logEvent("general_flow_boot", `applicant=${applicantKey} project=${pickStr(global.TasuBuilderGeneralFlowBench?.genState?.projectId)}`);
  }

  function initEmptyProjectFrames() {
    if (flow().id === "ops_partner") return;
    ["A", "B"].forEach((sideKey) => {
      const el = document.getElementById(frameIds(sideKey).project);
      if (!el) return;
      if (!pickStr(el.getAttribute("src"), el.contentWindow?.location?.href)) {
        el.removeAttribute("srcdoc");
        el.srcdoc = "";
        el.src = "about:blank";
        delete el.dataset.currentSrc;
      }
    });
  }

  function getActiveTabId(sideKey) {
    return resolveActiveTabId(sideKey);
  }

  function setBenchFrameUrl(id, url, options = {}) {
    const el = document.getElementById(id);
    if (!el) return false;
    if (!pickStr(url)) {
      if (options.placeholderDetailOnly) setDetailPlaceholder(options.sideKey || "B");
      return false;
    }
    if (isOpsPartnerBlockedBenchUrl(url)) {
      const src = pickStr(options.source, "setBenchFrameUrl");
      logEvent("setBenchFrameUrl_blocked", `source=${src} frame=${id} url=${url}`);
      const sk = id.includes("-a-") ? "A" : id.includes("-b-") ? "B" : "";
      if (id.endsWith("-thread") && sk) setDetailPlaceholder(sk);
      else if (id.endsWith("-project") && sk) clearOpsProjectFrame(sk);
      return false;
    }
    const full = normalizeBenchFrameUrl(url);
    const forceReload = options.forceReload === true;
    if (!forceReload && el.dataset.currentSrc === full) {
      logEvent("setFrameSrc_skip_same_url", `${id} ${full.split("/").pop() || full}`);
      return true;
    }
    el.removeAttribute("srcdoc");
    el.srcdoc = "";
    el.dataset.currentSrc = full;
    try {
      if (el.contentWindow?.location) el.contentWindow.location.replace(full);
      else el.src = full;
    } catch {
      el.src = full;
    }
    return true;
  }

  function setFrameSrc(id, url, options = {}) {
    if (!pickStr(url)) {
      const sk = id.includes("-a-") ? "A" : id.includes("-b-") ? "B" : "";
      if (id.endsWith("-thread") && sk) {
        setDetailPlaceholder(sk);
        return;
      }
      setBenchFrameUrl(id, "about:blank", options);
      return;
    }
    setBenchFrameUrl(id, url, options);
  }

  function preloadBenchSeedFrames() {
    const f = flow();
    if (f.id === "ops_partner" && isOpsPartnerIdle()) return;
    [f.sideA, f.sideB].forEach((side) => {
      setFrameSrc(frameIds(side.key).threads, threadsUrl(side));
    });
  }

  function refreshAllFrames(source) {
    const src = pickStr(source, "refreshAllFrames");
    const f = flow();
    [f.sideA, f.sideB].forEach((side) => {
      const ids = frameIds(side.key);
      setFrameSrc(ids.notify, notifyUrl(side));
      if (f.id === "ops_partner" && !opsPartnerAllowsThreadSurface()) {
        setDetailPlaceholder(side.key);
        clearOpsProjectFrame(side.key);
        setFrameSrc(ids.calendar, opsPartnerCalendarUrl(side));
        activateBenchTabInternal(side.key, "calendar");
      } else if (f.id === "ops_partner") {
        setFrameSrc(ids.thread, threadUrl(side));
        setFrameSrc(ids.calendar, opsPartnerCalendarUrl(side));
      } else {
        setFrameSrc(ids.thread, threadUrl(side));
      }
      const tabId = getActiveTabId(side.key);
      if (f.id === "ops_partner") {
        if (!opsPartnerAllowsThreadSurface()) {
          /* calendar + blank project/detail already set above */
        } else if (tabId === "project") {
          const projectTarget = projectUrl(side);
          if (projectTarget) setFrameSrc(ids.project, projectTarget);
          else clearOpsProjectFrame(side.key);
        }
        updateOpsBenchChrome();
        if (tabId === "threads") setFrameSrc(ids.threads, threadsUrl(side));
      } else if (isGeneralFlowBench()) {
        if (tabId === "project") {
          const projectTarget = projectUrl(side);
          if (projectTarget) setFrameSrc(ids.project, projectTarget);
          else clearOpsProjectFrame(side.key);
        } else if (tabId === "threads") {
          setFrameSrc(ids.threads, threadsUrl(side));
        } else if (tabId === "thread") {
          const url = threadUrl(side);
          if (url) setFrameSrc(ids.thread, url);
          else setDetailPlaceholder(side.key);
        }
        document.body.classList.toggle("bench--general-prechat", isGeneralFlowPreChat());
      } else if (tabId === "project") {
        setFrameSrc(ids.project, projectUrl(side));
      } else if (tabId === "threads") {
        setFrameSrc(ids.threads, threadsUrl(side));
      } else {
        reconcileOpsPartnerTab(side.key, src);
      }
    });
    preloadBenchSeedFrames();
  }

  function bootOpsPartnerFrames() {
    const src = "bootOpsPartnerFrames";
    logOpsPartnerTabTrace(src, { source: src });
    global.TasuBuilderOpsPartnerBench?.resetOpsPartnerBenchIdle?.();
    clearAllOpsPartnerBenchFrameSrc(src);
    restoreOpsPartnerState(src);
    const f = flow();
    [f.sideA, f.sideB].forEach((side) => {
      setFrameSrc(frameIds(side.key).notify, notifyUrl(side));
    });
    if (opsPartnerAllowsThreadSurface()) {
      [f.sideA, f.sideB].forEach((side) => {
        const url = threadUrl(side);
        if (url) setBenchFrameUrl(frameIds(side.key).thread, url, { source: `${src}:threadRestore` });
      });
      activateBenchTab("A", "thread", `${src}:explicitThread`);
      activateBenchTab("B", "thread", `${src}:explicitThread`);
      logBenchSlotDebug("A", "bootThreadRestore");
      logBenchSlotDebug("B", "bootThreadRestore");
    } else {
      forceOpsPartnerIdleFrames("bootIdle");
      global.setTimeout(() => {
        if (isOpsPartnerIdle()) forceOpsPartnerIdleFrames("bootIdlePostCheck");
      }, 400);
      global.setTimeout(() => {
        if (isOpsPartnerIdle()) forceOpsPartnerIdleFrames("bootIdlePostCheck2");
      }, 1200);
    }
  }

  function clearOpsThreadFrames() {
    ["A", "B"].forEach((sideKey) => setDetailPlaceholder(sideKey));
  }

  function syncGeneralFlowStateFromNotification(notificationId, href) {
    if (!isGeneralFlowBench()) return;
    const gen = global.TasuBuilderGeneralFlowBench?.genState;
    if (!gen) return;
    const row = notificationId
      ? loadNotifications().find((n) => n.id === notificationId)
      : null;
    const pid = pickStr(row?.project_id, row?.projectId);
    const tid = pickStr(row?.thread_id, row?.threadId);
    if (pid) gen.projectId = pid;
    let hrefThreadId = "";
    if (href) {
      try {
        const u = new URL(href, builderBase());
        hrefThreadId = pickStr(u.searchParams.get("thread_id"), u.searchParams.get("id"));
      } catch {
        /* ignore */
      }
    }
    if (hrefThreadId) gen.threadId = hrefThreadId;
    else if (tid) gen.threadId = tid;
    if (gen.threadId) gen.currentStep = "chat_started";
  }

  function syncOpsStateFromNotification(notificationId, href) {
    if (flow().id !== "ops_partner") return;
    const ops = global.TasuBuilderOpsPartnerBench?.opsState;
    if (!ops) return;
    const row = notificationId
      ? loadNotifications().find((n) => n.id === notificationId)
      : null;
    const pid = pickStr(row?.project_id, row?.projectId);
    if (pid) ops.projectId = pid;
    if (pickStr(row?.assignmentId)) ops.assignmentId = row.assignmentId;
    try {
      const u = new URL(href, builderBase());
      if (!ops.projectId) {
        ops.projectId = pickStr(u.searchParams.get("projectId"), u.searchParams.get("project_id"));
      }
      if (!ops.assignmentId) {
        ops.assignmentId = pickStr(
          u.searchParams.get("calendarEventId"),
          u.searchParams.get("assignmentId")
        );
      }
    } catch {
      /* ignore */
    }
    if (row?.type === "calendar_assignment") {
      ops.threadId = "";
      ops.partnerDecision = "";
      ops.assignmentRevealed = true;
    }
  }

  function navigateOpsPartnerThread(sideKey, href, threadId) {
    if (global.__builderOpsBootIdlePhase) {
      logEvent("partner_accepted_blocked", `source=navigateOpsPartnerThread side=${sideKey}`);
      return;
    }
    const ops = global.TasuBuilderOpsPartnerBench?.opsState;
    if (ops) {
      if (threadId) ops.threadId = threadId;
      ops.partnerDecision = "accepted";
      ops.currentStep = "partner_accepted";
    }
    const target = enrichBenchPageUrl(href, sideKey);
    loadDetailSlot(sideKey, target, "partnerAccepted");
    refreshNotifyFrame(sideKey);
    logEvent("partner_accepted", `${sideKey} → ${target}`);
    scheduleRunDiagnostics();
  }

  function refreshNotifyFrame(sideKey) {
    const f = flow();
    const side = sideKey === "A" ? f.sideA : f.sideB;
    const frameId = frameIds(sideKey).notify;
    const url = notifyUrl(side);
    const el = document.getElementById(frameId);
    if (el && (f.id === "ops_partner" || isGeneralFlowBench())) {
      const current = pickStr(el.dataset.currentSrc, el.getAttribute("src"), el.contentWindow?.location?.href);
      if (current.includes("talk-home.html") && current.includes("tab=notify")) {
        try {
          el.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh", immediate: true, force: true }, "*");
          global.setTimeout(() => postNotifyFrameHeightToIframe(frameId, { reason: "notify_refresh" }), 120);
          return;
        } catch {
          /* fall through to reload */
        }
      }
    }
    setFrameSrc(frameId, url);
    global.setTimeout(() => postNotifyFrameHeightToIframe(frameId, { reason: "notify_reload" }), 200);
  }

  function resolveOpsNotifySideKey(recipientRole, recipientUserId) {
    const f = flow();
    const uid = pickStr(recipientUserId);
    const role = pickStr(recipientRole).toLowerCase();
    if (uid && uid === f.sideA.actor.id) return "A";
    if (uid && uid === f.sideB.actor.id) return "B";
    if (isGeneralFlowBench()) {
      if (role && f.sideA.role === role) return "A";
      if (role && f.sideB.role === role) return "B";
    }
    if (role === "owner" || role === "ops") return "A";
    if (role === "partner") return "B";
    return "";
  }

  function refreshOpsNotifyForRecipient(recipientRole, recipientUserId, source) {
    const sideKey = resolveOpsNotifySideKey(recipientRole, recipientUserId);
    if (!sideKey) return;
    refreshNotifyFrame(sideKey);
    const eventType = pickStr(source, "notify_frame_refresh");
    logEvent(eventType, `${sideKey} ← ${recipientRole || recipientUserId}`);
    scheduleRunDiagnostics();
  }

  function refreshThreadFrames(sideKey) {
    const f = flow();
    const side = sideKey === "A" ? f.sideA : f.sideB;
    const ids = frameIds(sideKey);
    setFrameSrc(ids.threads, threadsUrl(side));
    setFrameSrc(ids.thread, threadUrl(side));
  }

  function resetDemoStorage() {
    if (flow().id === "ops_partner") {
      global.TasuBuilderOpsPartnerBench?.clearOpsPartnerBenchStorage?.();
    } else {
      localStorage.removeItem(MVP_KEY);
      localStorage.removeItem(NOTIFY_KEY);
    }
    state.messageSeq = 0;
    state.events = [];
    DIAG_KEYS.forEach((k) => {
      state.diag[k] = null;
    });
  }

  function mvpThreadHref(threadId, role, threadType) {
    const sp = new URLSearchParams();
    sp.set("thread_id", threadId);
    sp.set("id", threadId.replace("thread-demo-", "demo-thread-"));
    sp.set("role", role);
    if (threadType) sp.set("threadType", threadType);
    return `mvp-thread.html?${sp.toString()}`;
  }

  function boardThreadHref(threadId, role) {
    const sp = new URLSearchParams();
    sp.set("thread_id", threadId);
    sp.set("id", threadId.replace("thread-demo-", "demo-thread-"));
    sp.set("role", role);
    return `board-thread.html?${sp.toString()}`;
  }

  function pushNotification(payload) {
    const f = flow();
    const row = {
      id: payload.id || uid("notif-bench"),
      type: payload.type || "message",
      label: payload.label || "メッセージ",
      title: payload.title || "新しいメッセージがあります",
      body: payload.body || "",
      project_id: payload.project_id || null,
      projectId: payload.project_id || payload.projectId || null,
      thread_id: payload.thread_id || f.threadId,
      threadId: payload.thread_id || payload.threadId || f.threadId,
      recipientRole: payload.recipientRole || "",
      read: false,
      createdAt: nowIso(),
      href:
        payload.href ||
        (f.kind === "board"
          ? boardThreadHref(f.threadId, payload.recipientRole === "partner" ? "partner" : "user")
          : mvpThreadHref(
              f.threadId,
              payload.recipientRole === "partner"
                ? "partner"
                : payload.recipientRole === "vendor"
                  ? "vendor"
                  : payload.recipientRole === "owner"
                    ? "partner"
                    : "user",
              f.threadType
            )),
    };
    const list = loadNotifications();
    saveNotifications([row, ...list]);
    logEvent("notification_created", `${row.recipientRole} ← ${row.title}`);
    return row;
  }

  function sendBenchMessage(fromSideKey, text) {
    const f = flow();
    const fromSide = fromSideKey === "A" ? f.sideA : f.sideB;
    const toSide = fromSideKey === "A" ? f.sideB : f.sideA;
    const body = pickStr(text) || `【ベンチ】${fromSide.label}からのテスト ${++state.messageSeq}`;
    const mvp = loadMvp();
    if (!mvp?.threads?.[f.threadId]) {
      logEvent("send_failed", "thread missing — reset demo first");
      return false;
    }
    const thread = mvp.threads[f.threadId];
    const project = (mvp.projects || []).find((p) => p.project_id === thread.project_id);
    const msg = {
      msg_id: uid("msg"),
      from: { ...fromSide.actor },
      ts: nowIso(),
      text: body,
      attachments: [],
      read: true,
    };
    thread.messages = [...(thread.messages || []), msg];
    thread.events = [...(thread.events || []), { type: "message", actor: fromSide.actor, ts: msg.ts, text: body }];
    saveMvp(mvp);

    pushNotification({
      type: "message",
      title: "新しいメッセージがあります",
      body: `${fromSide.label}から: ${body}`,
      project_id: project?.project_id || null,
      recipientRole: toSide.notifyRecipient || toSide.role,
      href:
        f.kind === "board"
          ? boardThreadHref(f.threadId, toSide.role)
          : mvpThreadHref(f.threadId, toSide.role, f.threadType),
    });

    logEvent("message_sent", `${fromSide.label} → ${toSide.label}: ${body.slice(0, 40)}`);
    refreshNotifyFrame(toSide.key);
    refreshThreadFrames("A");
    refreshThreadFrames("B");
    scheduleRunDiagnostics();
    return true;
  }

  function logEvent(type, detail) {
    state.events.unshift({ type, detail, at: new Date().toLocaleTimeString() });
    if (state.events.length > 40) state.events.length = 40;
    renderDiagPanel();
  }

  function parseNotifyHref(href) {
    try {
      const u = new URL(href, builderBase());
      return {
        threadType: pickStr(u.searchParams.get("threadType")),
        role: pickStr(u.searchParams.get("role")),
        id: pickStr(u.searchParams.get("id"), u.searchParams.get("thread_id")),
        path: u.pathname.split("/").pop() || "",
        full: u.href,
      };
    } catch {
      return { threadType: "", role: "", id: "", path: "", full: "" };
    }
  }

  function runDiagnostics() {
    const f = flow();
    const d = {};
    const notifs = loadNotifications();
    const recent = notifs.filter((n) => pickStr(n.thread_id, n.threadId) === f.threadId);
    d.notification_created = recent.length > 0;
    d.unread_count_updated = recent.some((n) => !n.read);

    const latestHref = pickStr(recent[0]?.href);
    if (latestHref) {
      const stored = parseNotifyHref(latestHref);
      d.no_board_mvp_mix =
        f.kind === "board"
          ? stored.path === "board-thread.html"
          : stored.path === "mvp-thread.html" && stored.threadType !== "general_project";
      d.no_old_url = !stored.full.includes("thread.html") && !stored.full.includes("/threads.html");
      d.threadType_preserved = f.kind === "board" || stored.threadType === f.threadType || !stored.threadType;
      d.role_preserved = Boolean(stored.role);
      d.id_preserved = Boolean(stored.id);
    }

    [f.sideA, f.sideB].forEach((side) => {
      const frame = document.getElementById(frameIds(side.key).notify);
      let doc;
      try {
        doc = frame?.contentDocument;
      } catch {
        doc = null;
      }
      if (!doc) return;
      const cards = doc.querySelectorAll("[data-notification-id], .builder-notification-card");
      if (cards.length) d.notification_visible = true;
      const link = doc.querySelector(".builder-notification-card[href]");
      if (link?.getAttribute("href")) {
        d.notification_clickable = true;
        const parsed = parseNotifyHref(link.getAttribute("href"));
        d.notification_opens_correct_thread =
          (f.kind === "board" ? parsed.path === "board-thread.html" : parsed.path === "mvp-thread.html") &&
          parsed.id.includes(f.urlId.replace("demo-", ""));
        d.threadType_preserved = f.kind === "board" || parsed.threadType === f.threadType || !parsed.threadType;
        d.role_preserved = Boolean(parsed.role);
        d.id_preserved = Boolean(parsed.id);
        d.no_old_url = !parsed.full.includes("thread.html") && !parsed.full.includes("/threads.html");
        if (f.kind === "board") {
          if (parsed.path === "board-thread.html") d.no_board_mvp_mix = true;
        } else if (parsed.path === "mvp-thread.html" && parsed.threadType !== "general_project") {
          d.no_board_mvp_mix = true;
        } else if (parsed.path === "board-thread.html" || parsed.path === "mvp-thread.html") {
          d.no_board_mvp_mix = false;
        }
      }
    });

    const mvp = loadMvp();
    const thread = mvp?.threads?.[f.threadId];
    const msgs = thread?.messages || [];
    d.reply_visible_on_peer = msgs.length >= 2;
    d.read_after_open = notifs.some((n) => n.read);
    d.no_wrong_thread_type = f.kind === "board" || f.threadType !== "general_project";

    if (f.id === "ops_partner" && isOpsPartnerIdle()) {
      d.notification_created = false;
      d.notification_visible = false;
    }

    DIAG_KEYS.forEach((k) => {
      state.diag[k] = d[k] === true ? true : d[k] === false ? false : null;
    });
    renderDiagPanel();
    return d;
  }

  function buildNgCopy() {
    const f = flow();
    const lines = [
      "=== Builder 2窓ベンチ NG ===",
      `flow: ${f.id} (${f.label})`,
      `viewport: ${state.viewport}px`,
      `URL: ${global.location.href}`,
      "",
      "【診断】",
    ];
    DIAG_KEYS.forEach((k) => {
      const v = state.diag[k];
      lines.push(`${v === true ? "OK" : v === false ? "NG" : "—"} ${k}`);
    });
    const failed = DIAG_KEYS.filter((k) => state.diag[k] === false);
    if (failed.length) {
      lines.push("", "【NG項目】", ...failed.map((k) => `- ${k}`));
    }
    lines.push("", "【直近イベント】");
    state.events.slice(0, 12).forEach((e) => lines.push(`${e.at} ${e.type}: ${e.detail}`));
    const notifs = loadNotifications().slice(0, 5);
    lines.push("", "【通知サンプル】");
    notifs.forEach((n) => {
      lines.push(`- ${n.id} role=${n.recipientRole} read=${n.read} href=${n.href || "—"}`);
    });
    state.lastNgCopy = lines.join("\n");
    return state.lastNgCopy;
  }

  function copyNg() {
    const text = buildNgCopy();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    const hint = document.getElementById("builderBenchCopyHint");
    if (hint) {
      hint.textContent = "コピーしました";
      setTimeout(() => {
        hint.textContent = "";
      }, 2000);
    }
    return text;
  }

  function renderDiagPanel() {
    const el = document.getElementById("builderBenchDiag");
    if (!el) return;
    const chips = DIAG_KEYS.map((k) => {
      const v = state.diag[k];
      const cls = v === true ? "ok" : v === false ? "ng" : "skip";
      return `<span class="builder-bench-diag builder-bench-diag--${cls}">${k}</span>`;
    }).join("");
    const events = state.events
      .slice(0, 8)
      .map((e) => `<li>${e.at} <strong>${e.type}</strong> ${e.detail}</li>`)
      .join("");
    el.innerHTML =
      `<div class="builder-bench-diag-grid">${chips}</div>` +
      `<ul class="builder-bench-events">${events || "<li>—</li>"}</ul>`;
  }

  function applyViewport() {
    document.querySelectorAll("[data-builder-bench-viewport]").forEach((wrap) => {
      wrap.style.width = state.viewport === 390 ? "390px" : "100%";
      wrap.style.maxWidth = state.viewport === 390 ? "390px" : "none";
      wrap.style.margin = state.viewport === 390 ? "0 auto" : "0";
    });
    document.querySelectorAll('[data-viewport]').forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.getAttribute("data-viewport")) === state.viewport);
    });
  }

  function syncUrl() {
    const u = new URL(global.location.href);
    u.searchParams.set("benchMode", "builder");
    u.searchParams.set("builderFlow", state.flowId);
    u.searchParams.set("benchViewport", String(state.viewport));
    history.replaceState(null, "", u.pathname + u.search);
  }

  function transformLayout() {
    document.body.classList.add("bench--builder");
    document.title = "Builder 2窓 — 通知・やりとり確認";

    const toolbar = document.querySelector(".bench-toolbar");
    if (toolbar) {
      toolbar.innerHTML =
        `<div class="bench-toolbar__row bench-toolbar__row--primary">` +
        `<h1>Builder 2窓 — 通知・やりとり</h1>` +
        `<label class="builder-bench-flow-label">builderFlow` +
        `<select id="builderBenchFlowSelect" class="builder-bench-flow-select">` +
        Object.values(BUILDER_FLOWS)
          .map(
            (row) =>
              `<option value="${row.id}"${row.id === state.flowId ? " selected" : ""}>${row.label}</option>`
          )
          .join("") +
        `</select></label>` +
        `<div class="bench-toolbar__actions">` +
        `<button type="button" class="bench-btn bench-btn--reset" id="builderBenchResetBtn">reset demo</button>` +
        `<button type="button" class="bench-btn" id="builderBenchSendABtn">send A</button>` +
        `<button type="button" class="bench-btn" id="builderBenchSendBBtn">send B</button>` +
        `<button type="button" class="bench-btn" id="builderBenchRefreshBtn">refresh</button>` +
        `<button type="button" class="bench-btn bench-btn--reset-all" id="builderBenchCopyNgBtn">copy NG</button>` +
        `<span class="builder-bench-copy-hint" id="builderBenchCopyHint"></span>` +
        `<div class="bench-tabs" id="builderBenchViewportTabs">` +
        `<button type="button" class="bench-tab" data-viewport="390">390</button>` +
        `<button type="button" class="bench-tab" data-viewport="1280">PC</button>` +
        `</div></div></div>` +
        `<div class="bench-toolbar__row"><p class="bench-meta" id="builderBenchMeta"></p></div>`;
    }

    ["a", "b"].forEach((sk) => {
      const col = document.querySelector(`.bench-col--${sk}`);
      if (!col) return;
      const chatPane = col.querySelector(".bench-pane--chat");
      if (chatPane) chatPane.remove();

      const sideKey = sk === "a" ? "A" : "B";
      const f = flow();
      const side = sk === "a" ? f.sideA : f.sideB;

      const titleEl = col.querySelector(`#title${sideKey}`);
      if (titleEl) titleEl.textContent = `${sideKey}側 — ${side.label}`;

      const notifyBar = col.querySelector(".bench-pane--notify .bench-pane__bar span");
      if (notifyBar) notifyBar.textContent = "通知";

      const isOps = f.id === "ops_partner";
      const isGeneral = isGeneralFlowBench();
      const generalDefaultTab =
        isGeneral && sideKey === generalApplicantSideKey() ? "project" : "thread";
      const workPane = document.createElement("div");
      workPane.className = "bench-pane bench-pane--work";
      const tabNav = isOps
        ? `<button type="button" class="builder-bench-tab is-active" role="tab" data-builder-tab="calendar" data-builder-side="${sk}" aria-selected="true">案件カレンダー</button>` +
          `<button type="button" class="builder-bench-tab" role="tab" data-builder-tab="project" data-builder-side="${sk}">案件確認</button>` +
          `<button type="button" class="builder-bench-tab" role="tab" data-builder-tab="threads" data-builder-side="${sk}">やりとり一覧</button>` +
          `<button type="button" class="builder-bench-tab" role="tab" data-builder-tab="thread" data-builder-side="${sk}">現場連絡</button>`
        : `<button type="button" class="builder-bench-tab${generalDefaultTab === "project" ? " is-active" : ""}" role="tab" data-builder-tab="project" data-builder-side="${sk}"${generalDefaultTab === "project" ? ' aria-selected="true"' : ""}>案件確認</button>` +
          `<button type="button" class="builder-bench-tab" role="tab" data-builder-tab="threads" data-builder-side="${sk}">やりとり一覧</button>` +
          `<button type="button" class="builder-bench-tab${generalDefaultTab === "thread" ? " is-active" : ""}" role="tab" data-builder-tab="thread" data-builder-side="${sk}"${generalDefaultTab === "thread" ? ' aria-selected="true"' : ""}>やりとり詳細</button>`;
      const calendarPanel = isOps
        ? `<div class="builder-bench-tab-panel is-active" data-panel="calendar" data-builder-side="${sk}">` +
          `<div class="bench-pane__frame-wrap" data-builder-bench-viewport="390">` +
          `<iframe id="frame-${sk}-calendar" class="builder-bench-frame" title="${sideKey} 案件カレンダー"></iframe></div></div>`
        : "";
      workPane.innerHTML =
        `<div class="bench-pane__bar builder-bench-work-bar">` +
        `<nav class="builder-bench-tab-nav" role="tablist" aria-label="${sideKey} コンテンツ">` +
        tabNav +
        `</nav>` +
        `<button type="button" class="bench-pane__reload" data-builder-reload-active="${sk}">再読込</button>` +
        `</div>` +
        `<div class="builder-bench-tab-panels">` +
        calendarPanel +
        `<div class="builder-bench-tab-panel${!isOps && generalDefaultTab === "project" ? " is-active" : ""}" data-panel="project" data-builder-side="${sk}"${isOps || generalDefaultTab !== "project" ? " hidden" : ""}>` +
        `<div class="bench-pane__frame-wrap" data-builder-bench-viewport="390">` +
        `<iframe id="frame-${sk}-project" class="builder-bench-frame" title="${sideKey} 案件確認"></iframe></div></div>` +
        `<div class="builder-bench-tab-panel" data-panel="threads" data-builder-side="${sk}" hidden>` +
        `<div class="bench-pane__frame-wrap" data-builder-bench-viewport="390">` +
        `<iframe id="frame-${sk}-threads" class="builder-bench-frame" title="${sideKey} やりとり一覧"></iframe></div></div>` +
        `<div class="builder-bench-tab-panel${!isOps && generalDefaultTab === "thread" ? " is-active" : ""}" data-panel="thread" data-builder-side="${sk}"${isOps || generalDefaultTab !== "thread" ? " hidden" : ""}>` +
        `<div class="bench-pane__frame-wrap" data-builder-bench-viewport="390">` +
        `<iframe id="frame-${sk}-thread" class="builder-bench-frame" title="${sideKey} ${isOps ? "現場連絡" : "やりとり詳細"}"></iframe></div></div>` +
        `</div>`;
      col.appendChild(workPane);
    });

    const footer = document.querySelector(".bench-footer");
    if (footer) {
      const diagFold = document.createElement("details");
      diagFold.className = "bench-fold";
      diagFold.open = true;
      diagFold.innerHTML =
        `<summary>Builder 診断</summary>` +
        `<div class="bench-fold__body" id="builderBenchDiag"></div>`;
      footer.prepend(diagFold);
    }
  }

  function updateMeta() {
    const f = flow();
    const el = document.getElementById("builderBenchMeta");
    if (!el) return;
    el.textContent =
      `${f.label} | thread=${f.threadId} | A=${f.sideA.label}(${f.sideA.role}) B=${f.sideB.label}(${f.sideB.role}) | ${f.kind}`;
  }

  function isThreadHref(href) {
    const target = pickStr(href);
    return (
      target.includes("mvp-thread.html") ||
      target.includes("board-thread.html") ||
      target.includes("/thread.html")
    );
  }

  function isProjectHref(href) {
    const target = pickStr(href);
    return (
      target.includes("partner-assignment") ||
      target.includes("mvp-calendar") ||
      target.includes("admin-calendar") ||
      target.includes("mvp-project-detail") ||
      target.includes("board-projects")
    );
  }

  function isApplicantRejectNotification(row, sideKey) {
    if (!row || String(row.type || "").toLowerCase() !== "rejected") return false;
    const f = flow();
    const side = sideKey === "A" ? f.sideA : f.sideB;
    if (isGeneralFlowBench()) {
      return side.key === generalApplicantSideKey();
    }
    if (f.kind === "board") {
      return side.role === "partner" || String(row.recipientRole || "").toLowerCase() === "partner";
    }
    return String(row.recipientRole || "").toLowerCase() !== "owner";
  }

  function resolveBenchApplicantRejectPublicHref(row, sideKey) {
    const f = flow();
    const side = sideKey === "A" ? f.sideA : f.sideB;
    const explicit = pickStr(row?.href, row?.targetUrl).replace(/^\.\.\//, "");
    if (explicit && /public-board-detail\.html/i.test(explicit)) {
      return enrichBenchPageUrl(explicit, sideKey);
    }
    const rejectPd = generalFlowApi()?.resolvePublicDetailParams?.(f.id);
    if (rejectPd) {
      return buildPublicPageUrl(
        rejectPd.page,
        { id: rejectPd.id, type: rejectPd.type, role: side.role },
        side.key
      );
    }
    const pid = pickStr(row?.project_id, row?.projectId);
    if (pid === "job_demo_full_001") {
      return buildPublicPageUrl(
        "public-board-detail.html",
        { id: "pub-board-job-001", type: "job", role: side.role },
        side.key
      );
    }
    if (pid === "demo-project-001") {
      return buildPublicPageUrl(
        "public-board-detail.html",
        { id: "pub-board-project-001", type: "project", role: side.role },
        side.key
      );
    }
    return buildPublicPageUrl(
      "public-board-detail.html",
      { id: pid || "pub-board-project-001", type: "project", role: side.role },
      side.key
    );
  }

  function resolveProjectHrefForNotification(href, notificationId, sideKey) {
    const target = pickStr(href);
    const notifs = loadNotifications();
    const row = notificationId ? notifs.find((n) => n.id === notificationId) : null;
    const f = flow();
    const side = sideKey === "A" ? f.sideA : f.sideB;

    if (isApplicantRejectNotification(row, sideKey)) {
      return resolveBenchApplicantRejectPublicHref(row, sideKey);
    }

    if (/public-board-detail\.html/i.test(target)) {
      return enrichBenchPageUrl(target.replace(/^\.\.\//, ""), sideKey);
    }

    if (row?.type === "calendar_assignment" || pickStr(row?.projectKind) === "calendar") {
      const pid = pickStr(row?.project_id, row?.projectId);
      const aid = pickStr(row?.assignmentId);
      if (f.id === "ops_partner" && side.key === "B" && pid) {
        return projectUrl(side, { projectId: pid, assignmentId: aid });
      }
    }

    if (isProjectHref(target)) return enrichBenchPageUrl(target, sideKey);

    const pid = pickStr(row?.project_id, row?.projectId);
    if (pid) {
      if (f.id === "ops_partner") {
        if (side.key === "B") {
          return projectUrl(side, {
            projectId: pid,
            assignmentId: pickStr(row?.assignmentId),
          });
        }
        return opsPartnerCalendarUrl(side);
      }
      if (f.kind === "board") {
        return buildPageUrl("board-projects.html", { role: side.role, id: pid }, side.key);
      }
      return buildPageUrl("mvp-project-detail.html", { id: pid, role: side.role }, side.key);
    }

    if (isThreadHref(target)) {
      try {
        const u = new URL(target, builderBase());
        const tid = pickStr(u.searchParams.get("thread_id"), u.searchParams.get("id"));
        const mvp = loadMvp();
        const thread =
          mvp?.threads?.[tid] ||
          Object.values(mvp?.threads || {}).find((t) => tid && String(t.thread_id || "").includes(tid));
        if (thread?.project_id) {
          const f = flow();
          const side = sideKey === "A" ? f.sideA : f.sideB;
          if (f.kind === "board") {
            return buildPageUrl(
              "board-projects.html",
              { role: side.role, id: thread.project_id },
              side.key
            );
          }
          return buildPageUrl(
            "mvp-project-detail.html",
            { id: thread.project_id, role: side.role },
            side.key
          );
        }
      } catch {
        /* ignore */
      }
    }

    return projectUrl(side);
  }

  function isCalendarNotification(href, notificationId, slot) {
    if (pickStr(slot) === "project") return true;
    const row = notificationId
      ? loadNotifications().find((n) => n.id === notificationId)
      : null;
    if (row?.type === "calendar_assignment" || pickStr(row?.projectKind) === "calendar") {
      return true;
    }
    if (row?.type === "application") return false;
    return isProjectHref(href) && !isThreadHref(href);
  }

  function isOpsPartnerDeclineNotifyOnly(payload, notificationId) {
    if (flow().id !== "ops_partner") return false;
    const type = pickStr(payload?.notificationType, payload?.type);
    if (type === "request_declined") return true;
    if (pickStr(payload?.href) === "#") return true;
    const row = notificationId ? loadNotifications().find((n) => n.id === notificationId) : null;
    return row?.type === "request_declined" || row?.notifyOnly === true;
  }

  function handleNotificationNavigate(payload) {
    const href = pickStr(payload?.href);
    const side = pickStr(payload?.side, "B");
    if (!href) return;
    const src = pickStr(payload?.source, "notifyClick");
    if (flow().id === "ops_partner" && isOpsPartnerIdle()) {
      logEvent("notify_nav_blocked", `source=${src} side=${side} reason=ops_idle`);
      return;
    }

    const notifId = pickStr(payload?.notificationId);
    if (isOpsPartnerDeclineNotifyOnly(payload, notifId)) {
      const list = loadNotifications().map((n) =>
        notifId && n.id === notifId ? { ...n, read: true } : n
      );
      if (notifId) saveNotifications(list);
      refreshNotifyFrame(side);
      logEvent("notification_click", `${side} 辞退通知（遷移なし）`);
      scheduleRunDiagnostics();
      return;
    }
    syncOpsStateFromNotification(notifId, href);
    syncGeneralFlowStateFromNotification(notifId, href);

    const projectHref = enrichBenchPageUrl(
      resolveProjectHrefForNotification(href, notifId, side),
      side
    );
    const calendarNotif = isCalendarNotification(href, notifId, payload?.slot);
    const threadHref =
      !calendarNotif && isThreadHref(href) ? enrichBenchPageUrl(href, side) : "";

    loadProjectSlot(side, projectHref, pickStr(payload?.source, "notifyClick"));
    if (
      !isApplicantRejectNotification(
        notifId ? loadNotifications().find((n) => n.id === notifId) : null,
        side
      ) &&
      (/view=applications/i.test(projectHref) || /view=applications/i.test(href))
    ) {
      focusBenchWorkPane(side);
    }
    if (calendarNotif) setDetailPlaceholder(side);

    const list = loadNotifications().map((n) =>
      notifId && n.id === notifId ? { ...n, read: true } : n
    );
    if (notifId) saveNotifications(list);
    state.diag.read_after_open = true;

    const finish = () => {
      logEvent(
        "notification_click",
        threadHref ? `${side} 案件確認 → スレッド` : `${side} 案件確認`
      );
      logBenchSlotDebug(side, "readAfterOpen");
      scheduleRunDiagnostics();
    };

    if (threadHref) {
      let notifyThreadHref = threadHref;
      try {
        const u = new URL(threadHref, builderBase());
        if (u.pathname.endsWith("mvp-thread.html")) {
          u.searchParams.set("notifyOpen", "1");
          notifyThreadHref = u.pathname + (u.search ? u.search : "") + u.hash;
        }
      } catch {
        /* ignore */
      }
      global.setTimeout(() => {
        loadDetailSlot(side, notifyThreadHref, "notificationOpen:thread");
        finish();
      }, 650);
      return;
    }

    finish();
  }

  function wireEvents() {
    document.getElementById("builderBenchFlowSelect")?.addEventListener("change", (ev) => {
      state.flowId = ev.target.value;
      syncUrl();
      resetDemoStorage();
      updateMeta();
      if (isGeneralFlowBench()) {
        global.TasuBuilderGeneralFlowBench?.bootGeneralFlow?.();
      } else {
        refreshAllFrames();
      }
      scheduleRunDiagnostics();
    });

    document.getElementById("builderBenchResetBtn")?.addEventListener("click", () => {
      resetDemoStorage();
      global.__builderOpsBootIdlePhase = true;
      global.TasuBuilderOpsPartnerBench?.resetOpsState?.();
      if (flow().id === "ops_partner") {
        bootOpsPartnerFrames();
        global.setTimeout(() => {
          global.__builderOpsBootIdlePhase = false;
        }, 2500);
      } else if (isGeneralFlowBench()) {
        global.TasuBuilderGeneralFlowBench?.genReset?.();
      } else {
        refreshAllFrames("reset");
      }
      scheduleRunDiagnostics();
    });

    document.getElementById("builderBenchSendABtn")?.addEventListener("click", () => sendBenchMessage("A"));
    document.getElementById("builderBenchSendBBtn")?.addEventListener("click", () => sendBenchMessage("B"));

    document.getElementById("builderBenchRefreshBtn")?.addEventListener("click", () => {
      refreshAllFrames("userRefresh");
      scheduleRunDiagnostics();
    });

    document.getElementById("builderBenchCopyNgBtn")?.addEventListener("click", copyNg);

    document.getElementById("builderBenchViewportTabs")?.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-viewport]");
      if (!btn) return;
      state.viewport = Number(btn.getAttribute("data-viewport")) || 390;
      syncUrl();
      applyViewport();
    });

    document.addEventListener("click", (ev) => {
      const tabBtn = ev.target?.closest?.("[data-builder-tab]");
      if (tabBtn) {
        const sk = pickStr(tabBtn.getAttribute("data-builder-side"));
        const tabId = pickStr(tabBtn.getAttribute("data-builder-tab"));
        if (sk && tabId) switchSideTab(sk === "a" ? "A" : "B", tabId, "userTabClick");
        return;
      }

      const reloadActive = ev.target?.closest?.("[data-builder-reload-active]");
      if (reloadActive) {
        const sk = pickStr(reloadActive.getAttribute("data-builder-reload-active"));
        const sideKey = sk === "a" ? "A" : "B";
        const tabId = getActiveTabId(sideKey);
        const frame = document.getElementById(frameIds(sideKey)[tabId] || frameIds(sideKey).thread);
        if (frame?.src) frame.src = frame.src;
        return;
      }

      const btn = ev.target?.closest?.("[data-builder-reload]");
      if (!btn) return;
      const frameId = btn.getAttribute("data-builder-reload");
      const frame = document.getElementById(frameId);
      if (frame?.src) frame.src = frame.src;
    });

    global.addEventListener("message", (ev) => {
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "tasu-bench-preview-scroll") {
        const frameId = pickStr(data.frameId);
        const row = benchNotifyScrollState[frameId];
        if (row) {
          row.scrollTop = Math.round(Number(data.scrollTop) || 0);
          row.isUserScrolling =
            data.isUserScrolling === true || row.scrollTop > 4;
          if (row.isUserScrolling) row.scrollQuietUntil = Date.now() + 2600;
        }
        return;
      }
      if (data.type === "tasu-builder-bench-notification-navigate") {
        handleNotificationNavigate(data);
      } else if (data.type === "tasu-builder-bench-general-apply") {
        void global.TasuBuilderGeneralFlowBench?.genApply?.();
      } else if (data.type === "tasu-builder-bench-general-poster-action") {
        const action = pickStr(data.action);
        const bench = global.TasuBuilderGeneralFlowBench;
        const side = pickStr(data.side, "A");
        if (action === "decline") {
          void bench?.genDeclineApplicant?.();
        } else if (action === "start_chat") {
          void bench?.genStartChat?.();
        }
        refreshNotifyFrame(side);
        refreshNotifyFrame(side === "A" ? "B" : "A");
        scheduleRunDiagnostics();
      } else if (data.type === "tasu-builder-bench-general-declined") {
        if (!isGeneralFlowBench()) return;
        const gen = global.TasuBuilderGeneralFlowBench;
        const posterKey = flow().generalPosterSide || "A";
        if (gen?.genState) gen.genState.currentStep = "declined";
        refreshNotifyFrame(posterKey);
        refreshNotifyFrame(posterKey === "A" ? "B" : "A");
        gen?.refreshGeneralFrames?.();
        scheduleRunDiagnostics();
        logEvent("general_declined_from_detail", pickStr(data.projectId));
      } else if (data.type === "tasu-builder-bench-partner-accepted") {
        navigateOpsPartnerThread(
          pickStr(data.side, "B"),
          pickStr(data.href),
          pickStr(data.threadId, data.thread_id)
        );
      } else if (data.type === "tasu-builder-bench-partner-declined") {
        const side = pickStr(data.side, "B");
        syncOpsStateFromNotification("", pickStr(data.href));
        const ops = global.TasuBuilderOpsPartnerBench?.opsState;
        if (ops) {
          ops.threadId = "";
          ops.partnerDecision = "declined";
          ops.currentStep = "partner_declined";
        }
        loadProjectSlot(
          side,
          enrichBenchPageUrl(pickStr(data.href) || projectUrl(flow().sideB), side),
          "partnerDeclined"
        );
        setDetailPlaceholder(side);
        refreshNotifyFrame(side);
        logEvent("partner_declined", side);
        logBenchSlotDebug(side, "partnerDeclined");
        scheduleRunDiagnostics();
      } else if (
        data.type === "builder:ops:message-created" ||
        data.type === "builder:ops:notification-created" ||
        data.type === "builder:ops:completion-submitted"
      ) {
        if (global.__builderOpsBootIdlePhase) {
          const sideKey = resolveOpsNotifySideKey(
            pickStr(data.recipientRole),
            pickStr(data.recipientUserId)
          );
          if (sideKey) refreshNotifyFrame(sideKey);
          return;
        }
        refreshOpsNotifyForRecipient(
          pickStr(data.recipientRole),
          pickStr(data.recipientUserId),
          data.type === "builder:ops:message-created"
            ? "message_created"
            : data.type === "builder:ops:notification-created"
              ? "notification_created"
              : "completion_submitted"
        );
      } else if (data.type === "builder:ops:completion-report-open") {
        logEvent("completion_report_open", pickStr(data.threadId));
      } else if (data.type === "tasu-builder-bench-general-applied") {
        if (!isGeneralFlowBench()) return;
        const benchFlow = flow();
        const gen = global.TasuBuilderGeneralFlowBench;
        const posterKey = benchFlow.generalPosterSide || "A";
        const pid = pickStr(data.projectId, gen?.genState?.projectId);
        if (gen?.genState) {
          if (pid) gen.genState.projectId = pid;
          gen.genState.currentStep = "applied";
        }
        refreshNotifyFrame(posterKey);
        refreshNotifyFrame(posterKey === "A" ? "B" : "A");
        const applicantKey = generalApplicantSideKey();
        if (pid) {
          const side = applicantKey === "A" ? benchFlow.sideA : benchFlow.sideB;
          const url = projectUrl(side, { projectId: pid });
          if (url) setBenchFrameUrl(frameIds(applicantKey).project, url, { source: "generalApplied" });
        }
        gen?.refreshGeneralFrames?.();
        scheduleRunDiagnostics();
        logEvent("general_applied_from_detail", pid || "—");
      } else if (data.type === "tasu-builder-bench-general-message-created") {
        if (!isGeneralFlowBench()) return;
        refreshOpsNotifyForRecipient(
          pickStr(data.recipientRole),
          pickStr(data.recipientUserId),
          "general_message_created"
        );
        scheduleRunDiagnostics();
      } else if (data.type === "tasu-builder-bench-general-cancelled") {
        if (!isGeneralFlowBench()) return;
        refreshNotifyFrame("A");
        refreshNotifyFrame("B");
        global.TasuBuilderGeneralFlowBench?.refreshGeneralFrames?.();
        scheduleRunDiagnostics();
      } else if (data.type === "tasu-builder-bench-general-chat-started") {
        if (!isGeneralFlowBench()) return;
        const benchFlow = flow();
        const gen = global.TasuBuilderGeneralFlowBench;
        const tid = pickStr(data.threadId);
        const pid = pickStr(data.projectId, gen?.genState?.projectId);
        if (gen?.genState) {
          if (pid) gen.genState.projectId = pid;
          if (tid) gen.genState.threadId = tid;
          gen.genState.currentStep = "chat_started";
        }
        document.body.classList.remove("bench--general-prechat");
        const tt = benchFlow.threadType;
        ["A", "B"].forEach((sk) => {
          const side = sk === "A" ? benchFlow.sideA : benchFlow.sideB;
          activateBenchTabInternal(sk, "thread");
          if (!tid) {
            setDetailPlaceholder(sk);
            return;
          }
          const sp = new URLSearchParams();
          sp.set("thread_id", tid);
          sp.set("id", tid);
          sp.set("role", side.role);
          sp.set("threadType", tt);
          sp.set("benchEmbed", "1");
          sp.set("benchSide", sk);
          setBenchFrameUrl(frameIds(sk).thread, `${builderBase()}mvp-thread.html?${sp.toString()}`, {
            source: "generalChatStarted",
          });
        });
        refreshNotifyFrame("A");
        refreshNotifyFrame("B");
        gen?.refreshGeneralFrames?.();
        scheduleRunDiagnostics();
        logEvent("general_chat_started_from_detail", tid || "—");
      }
    });

    global.addEventListener("storage", (ev) => {
      if (ev.key === MVP_KEY || ev.key === NOTIFY_KEY) {
        scheduleRunDiagnostics();
      }
    });
  }

  function boot() {
    if (global.__builderOpsBenchBooted) {
      logEvent("boot_skip_already_started", state.flowId || flow().id);
      return;
    }
    global.__builderOpsBenchBooted = true;

    const params = new URLSearchParams(global.location.search);
    const flowParam = pickStr(params.get("builderFlow"));
    if (flowParam && BUILDER_FLOWS[flowParam]) state.flowId = flowParam;
    const vp = Number(params.get("benchViewport"));
    if (vp === 1280 || vp === 390) state.viewport = vp;

    if (state.flowId === "ops_partner") {
      try {
        global.sessionStorage.setItem("tasu:builder:ops-bench", "1");
      } catch {
        /* ignore */
      }
    }

    transformLayout();
    wireIframeLoadCounters();
    wireNotifyFrameHeightSync();
    global.setTimeout(() => syncAllNotifyFrameHeights("boot"), 300);
    initEmptyProjectFrames();
    wireEvents();
    syncUrl();
    updateMeta();
    applyViewport();
    if (flow().id === "ops_partner") {
      bootOpsPartnerFrames();
    } else if (isGeneralFlowBench()) {
      global.TasuBuilderGeneralFlowBench?.bootGeneralFlow?.();
    } else {
      refreshAllFrames("boot");
    }
    renderDiagPanel();
    scheduleRunDiagnostics();
    if (!global.__builderBenchDiagInterval) {
      global.__builderBenchDiagInterval = global.setInterval(scheduleRunDiagnostics, 4000);
    }
  }

  global.TasuBuilderDualWindowBench = {
    boot,
    BUILDER_FLOWS,
    sendBenchMessage,
    runDiagnostics,
    scheduleRunDiagnostics,
    buildNgCopy,
    resetDemoStorage,
    flow,
    logEvent,
    refreshAllFrames,
    bootOpsPartnerFrames,
    bootGeneralFlowFrames,
    isGeneralFlowPreChat,
    isGeneralFlowBench,
    generalApplicantSideKey,
    refreshNotifyFrame,
    syncAllNotifyFrameHeights,
    refreshThreadFrames,
    switchSideTab,
    activateBenchTab,
    loadProjectSlot,
    loadCalendarSlot,
    loadDetailSlot,
    isOpsPartnerIdle,
    updateOpsBenchChrome,
    projectUrl,
    opsPartnerWorkUrl,
    frameIds,
    handleNotificationNavigate,
    navigateOpsPartnerThread,
    clearOpsThreadFrames,
    clearOpsProjectFrame,
    enrichBenchPageUrl,
    opsPartnerCalendarUrl,
    opsPartnerProjectUrl,
    getActiveTabId,
    setFrameSrc,
    setBenchFrameUrl,
    logBenchSlotDebug,
    resolveOpsBenchThreadIdFromUrl,
    hasExplicitOpsBenchThreadParam,
    opsPartnerAllowsThreadSurface,
    restoreOpsPartnerState,
    forceOpsPartnerIdleFrames,
    clearAllOpsPartnerBenchFrameSrc,
    describeBenchFrame,
    getBenchEvents: () => state.events.slice(),
  };
})(typeof window !== "undefined" ? window : globalThis);
