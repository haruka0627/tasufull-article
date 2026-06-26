/**
 * TASFUL Builder — ダッシュボード雛形（デモ表示のみ）
 * DB / Supabase ロジックは扱わない。
 */
(function () {
  "use strict";

  const global = typeof window !== "undefined" ? window : globalThis;

  function b3Provider() {
    return global.TasuBuilderDataProvider;
  }

  function b3MvpStore() {
    return b3Provider()?.getMvpStore?.() || global.TasuBuilderMvpStoreLocal || null;
  }

  function generalFlowApi() {
    return global.TasuBuilderGeneralFlow;
  }

  function gfIsPoster(actor, spec) {
    return generalFlowApi()?.isGeneralFlowPoster?.(actor, spec) || false;
  }

  function gfIsApplicant(actor, spec) {
    return generalFlowApi()?.isGeneralFlowApplicant?.(actor, spec) || false;
  }

  function gfCounterparty(actor, spec) {
    return generalFlowApi()?.resolveGeneralFlowCounterparty?.(actor, spec) || null;
  }

  function gfPartyForRecipient(spec, ref) {
    return generalFlowApi()?.resolveGeneralFlowPartyForRecipient?.(spec, ref) || null;
  }

  function gfRecipientUserId(spec, ref) {
    return generalFlowApi()?.resolveGeneralFlowRecipientUserId?.(spec, ref) || "";
  }

  function gfPartyUrlRole(party) {
    return generalFlowApi()?.partyUrlRole?.(party) || String(party?.role || "user");
  }

  function gfNotifyHrefRole(project, n, flowSpec) {
    const party = gfPartyForRecipient(flowSpec, n);
    if (party) return gfPartyUrlRole(party);
    return normalizeMvpRole(n?.recipientRole || getRole());
  }

  const OWNER_ID = "demo-owner-001";
  const MVP_STORAGE_KEY = "tasful:builder:mvp:v1";
  const MVP_THREADS_STORAGE_KEY = "tasful:builder:mvp:threads:v1";
  const MVP_ROLE_KEY = "tasful:builder:mvp:role";
  const MVP_SESSION_ROLE_KEY = "tasful:builder:mvp:session:role";
  const MVP_PARTNER_ID_KEY = "tasful:builder:mvp:partner_id";
  const MVP_NOTIFICATIONS_KEY = "tasful:builder:mvp:notifications:v1";
  const MVP_PROJECT_TEMPLATES_KEY = "tasful:builder:mvp:projectTemplates:v1";
  const MVP_RE_REQUESTS_KEY = "tasful:builder:mvp:reRequests:v1";
  const ADMIN_PARTNERS_KEY = "tasful:builder:admin:partners:v1";
  const ADMIN_CALENDAR_ASSIGNMENTS_KEY = "tasful:builder:admin:calendarAssignments:v1";
  const OPS_PARTNER_BENCH_FLAG_KEY = "tasu:builder:ops-bench";
  const ADMIN_DISPATCH_CANDIDATES_KEY = "tasful:builder:admin:dispatchCandidates:v1";

  function isOpsBenchSession() {
    try {
      return globalThis.sessionStorage?.getItem(OPS_PARTNER_BENCH_FLAG_KEY) === "1";
    } catch {
      return false;
    }
  }

  function ensureOpsBenchSessionFromUrl() {
    try {
      const sp = new URLSearchParams(globalThis.location.search);
      if (sp.get("benchEmbed") === "1" && sp.get("builderFlow") === "ops_partner") {
        globalThis.sessionStorage.setItem(OPS_PARTNER_BENCH_FLAG_KEY, "1");
      }
    } catch {
      /* ignore */
    }
  }

  function isAdminCalOpsBenchEmbed() {
    try {
      ensureOpsBenchSessionFromUrl();
      if (getPage() !== "builder-admin-calendar") return false;
      const sp = new URLSearchParams(globalThis.location.search);
      if (sp.get("benchEmbed") !== "1") return false;
      if (sp.get("benchSide") !== "A") return false;
      if (sp.get("builderFlow") === "ops_partner") return true;
      return isOpsBenchSession();
    } catch {
      return false;
    }
  }

  /** A側 bench embed でも standalone と同じカレンダー表示データを使う */
  function shouldSeedAdminCalendarDisplayData() {
    if (isAdminCalOpsBenchEmbed()) return true;
    return !isOpsBenchSession();
  }

  function normStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  /** ops_partner ベンチ — A側「現場予定を追加」から親 opsAddCalendar へ委譲 */
  function requestOpsBenchAddCalendarDemo(source) {
    if (!isAdminCalOpsBenchEmbed()) return false;
    try {
      if (!global.parent || global.parent === global) return false;
      global.parent.postMessage(
        {
          type: "builder:ops:add-calendar-demo",
          source: normStr(source, "admin-calendar-btn"),
          projectId: "demo-thread-list-002",
          calendarEventId: "cal-demo-thread-list-002",
        },
        "*"
      );
      return true;
    } catch {
      return false;
    }
  }

  function opsStateProjectIdForBench() {
    try {
      const pid = globalThis.parent?.TasuBuilderOpsPartnerBench?.opsState?.projectId;
      if (normStr(pid)) return String(pid).trim();
    } catch {
      /* ignore */
    }
    return "demo-thread-list-002";
  }

  /** B側パートナー iframe（mvp-calendar）専用 */
  function isOpsPartnerBenchEmbed() {
    try {
      if (new URLSearchParams(globalThis.location.search).get("benchEmbed") !== "1") return false;
      if (!isOpsBenchSession()) return false;
      return new URLSearchParams(globalThis.location.search).get("benchSide") === "B";
    } catch {
      return false;
    }
  }
  const ADMIN_NOTIFICATIONS_KEY = "tasful:builder:admin:notifications:v1";

  const MVP_NOTIFICATION_TYPE_UI = {
    application: { label: "新規応募" },
    message: { label: "メッセージ受信" },
    selected: { label: "選定完了" },
    rejected: { label: "却下" },
    attachment: { label: "添付追加" },
    completed: { label: "作業完了" },
    re_request: { label: "再依頼" },
    template: { label: "テンプレ保存" },
    review: { label: "審査" },
    review_request: { label: "レビュー依頼" },
    review_received: { label: "レビュー確認" },
    dispatch: { label: "案件手配" },
    calendar_assignment: { label: "現場予定追加" },
    site_photo: { label: "現場写真" },
    work_report: { label: "作業報告書" },
    completion_report: { label: "完了報告書" },
    completion_submitted: { label: "完了報告" },
    completion_rejected: { label: "完了報告差し戻し" },
    attendance_enter: { label: "入場" },
    attendance_leave: { label: "退場" },
    hire_confirmed: { label: "選定確定" },
    request_accepted: { label: "依頼受理" },
    request_declined: { label: "依頼辞退" },
    admin: { label: "運営通知" },
  };

  const PDF_KIND_LABELS = {
    invoice: "請求書PDF",
    work_report: "作業報告書",
    completion_report: "完了報告書",
  };

  const SITE_PHOTO_STAGES = {
    before: { label: "着工前", mod: "before" },
    progress: { label: "施工中", mod: "progress" },
    after: { label: "完了後", mod: "after" },
  };

  const STATUS_UI = {
    draft: { label: "下書き" },
    open: { label: "募集中" },
    applied: { label: "応募あり" },
    selected: { label: "選定済み" },
    rejected: { label: "却下" },
    contracted: { label: "契約/開始" },
    in_progress: { label: "作業中" },
    exited: { label: "退場" },
    completed: { label: "完了" },
    invoiced: { label: "請求/帳票" },
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  const PHOTO_PREVIEW_CACHE = (() => {
    try {
      if (!window.__TASU_BUILDER_PHOTO_PREVIEW__) window.__TASU_BUILDER_PHOTO_PREVIEW__ = new Map();
      return window.__TASU_BUILDER_PHOTO_PREVIEW__;
    } catch {
      return new Map();
    }
  })();

  function setPhotoPreviewUrl(photo_id, url) {
    if (!photo_id || !url) return;
    PHOTO_PREVIEW_CACHE.set(photo_id, url);
  }

  function getPhotoPreviewUrl(photo_id) {
    return PHOTO_PREVIEW_CACHE.get(photo_id) || "";
  }

  function fmtDurationMs(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const minutes = Math.floor(n / 60000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h <= 0) return `${m}分`;
    return `${h}時間${m}分`;
  }

  function buildMvpPdfDataUrl({ title, kind, lines = [], projectTitle } = {}) {
    const text = [
      "TASFUL Builder PDF (demo)",
      `title: ${title || ""}`,
      `kind: ${kind || ""}`,
      ...(projectTitle ? [`project: ${projectTitle}`] : []),
      ...lines,
      `generated_at: ${new Date().toISOString()}`,
      "",
      "This is a demo payload. Real PDF generation is not implemented.",
    ].join("\n");
    const base64 = btoa(unescape(encodeURIComponent(text)));
    return `data:application/pdf;base64,${base64}`;
  }

  function dummyPdfDataUrl(opts = {}) {
    return buildMvpPdfDataUrl(opts);
  }

  function sanitizePdfFileName(name) {
    return String(name || "document")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "_")
      .slice(0, 48);
  }

  function normalizeThreadPdfKind(raw) {
    const k = String(raw?.kind || raw?.type || "").trim();
    if (k === "invoice") return "invoice";
    if (k === "work_report") return "work_report";
    if (k === "completion_report") return "completion_report";
    return k || "completion_report";
  }

  function normalizeThreadPdfOutput(x, defaults = {}) {
    const state = defaults.state || mvp().reload();
    const kind = normalizeThreadPdfKind(x);
    const dataUrl =
      typeof x?.dataUrl === "string" ? x.dataUrl : typeof x?.url === "string" ? x.url : "";
    const generatedAt = String(x?.generatedAt || x?.generated_at || nowIso());
    const siteTitle = defaults.siteTitle || defaults.projectTitle || "document";
    const defaultFileName =
      kind === "invoice"
        ? `請求書_${sanitizePdfFileName(siteTitle)}.pdf`
        : kind === "work_report"
          ? `作業報告書_${sanitizePdfFileName(siteTitle)}.pdf`
          : `完了報告書_${sanitizePdfFileName(siteTitle)}.pdf`;
    return {
      id: String(x?.id || uid("pdf")),
      project_id: String(x?.project_id || defaults.project_id || ""),
      thread_id: String(x?.thread_id || defaults.thread_id || ""),
      kind,
      type: kind,
      label: String(x?.label || PDF_KIND_LABELS[kind] || kind),
      fileName: String(x?.fileName || x?.file_name || defaultFileName),
      actor: normalizeMvpActor(x?.actor || x?.generated_by || x?.by, state),
      generated_at: generatedAt,
      generatedAt,
      url: dataUrl,
      dataUrl,
      storagePath: x?.storagePath !== undefined ? x.storagePath : null,
      meta: x?.meta && typeof x.meta === "object" ? x.meta : {},
    };
  }

  function loadMvpState() {
    const store = b3MvpStore();
    if (store?.load) {
      try {
        return store.load();
      } catch {
        /* fallback below */
      }
    }
    try {
      const raw = localStorage.getItem(MVP_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const normalized = normalizeMvpState(parsed);
      // best-effort: persist normalized shape so old data won't linger
      try {
        saveMvpState(normalized);
      } catch {
        // ignore
      }
      return normalized;
    } catch {
      return null;
    }
  }

  function saveMvpState(state) {
    const store = b3MvpStore();
    if (store?.save) {
      try {
        store.save(state);
        return;
      } catch {
        /* fallback below */
      }
    }
    try {
      localStorage.setItem(MVP_STORAGE_KEY, JSON.stringify(state));
      const threads = state && typeof state === "object" && state.threads ? state.threads : {};
      localStorage.setItem(MVP_THREADS_STORAGE_KEY, JSON.stringify(threads));
    } catch {
      // ignore
    }
  }

  function mvpPartnerName(state, partner_id) {
    const p =
      (state?.partners || []).find((x) => x?.partner_id === partner_id) ||
      DEMO_PARTNERS.find((x) => x?.partner_id === partner_id);
    return p?.display_name || "パートナー";
  }

  function normalizeMvpActor(a, state) {
    const ownerActor = () => ({ id: state?.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" });
    if (a && typeof a === "object" && a.id && a.type) {
      const t =
        a.type === "owner" ? "owner" : a.type === "user" ? "user" : a.type === "builder" ? "builder" : "partner";
      const defaultName =
        t === "owner" ? "TASFUL運営" : t === "user" ? "山田 太郎" : t === "builder" ? "Builder" : "パートナー";
      return { id: String(a.id), type: t, name: String(a.name || "") || defaultName };
    }
    if (a === "owner") return ownerActor();
    if (a === "partner") return { id: "partner-unknown", type: "partner", name: "パートナー" };
    if (a === "builder") return { id: "demo-builder-user", type: "builder", name: "山田 太郎" };
    if (a === "user") return { id: "demo-builder-user", type: "user", name: "山田 太郎" };
    if (typeof a === "string" && a.startsWith("demo-partner-")) {
      return { id: a, type: "partner", name: mvpPartnerName(state, a) };
    }
    return { id: "actor-unknown", type: "partner", name: "不明" };
  }

  function resolveMvpMessageFrom(m, state) {
    if (m?.from && (m.from.id || m.from.type)) return normalizeMvpActor(m.from, state);
    const role = String(m?.role || (typeof m?.sender === "string" && !m?.senderName ? m.sender : "") || "")
      .trim()
      .toLowerCase();
    const name = String(m?.senderName || "").trim();
    const ownerActor = () => ({ id: state?.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" });
    if (role === "owner" || role === "運営") return { ...ownerActor(), name: name || ownerActor().name };
    if (role === "builder") return { id: "demo-builder-user", type: "builder", name: name || "山田 太郎" };
    if (role === "partner" || role === "協力会社") {
      const pid = String(m?.partner_id || m?.from?.id || "partner-unknown");
      return { id: pid, type: "partner", name: name || mvpPartnerName(state, pid) };
    }
    return normalizeMvpActor(m?.from, state);
  }

  function normalizeMvpState(state) {
    const next = typeof state === "object" && state ? { ...state } : { version: 1 };
    next.version = next.version === 1 ? 1 : 1;
    next.owner_id = next.owner_id || OWNER_ID;
    next.partners = Array.isArray(next.partners) ? next.partners : [];
    next.projects = Array.isArray(next.projects) ? next.projects : [];
    next.specs = typeof next.specs === "object" && next.specs ? next.specs : {};
    next.threads = typeof next.threads === "object" && next.threads ? next.threads : {};
    next.applications = Array.isArray(next.applications) ? next.applications : [];
    next.notifications = Array.isArray(next.notifications) ? next.notifications : [];

    const partnerName = (partner_id) => mvpPartnerName(next, partner_id);

    const normalizeActor = (a) => normalizeMvpActor(a, next);
    const normalizeMessageFrom = (m) => resolveMvpMessageFrom(m, next);

    // projects: hiring rule fields
    next.projects = next.projects.map((p) => {
      const required = Number(p?.required_partners || 1);
      const selected = Array.isArray(p?.selected_partner_ids) ? p.selected_partner_ids.filter(Boolean) : [];
      const assignedPartners = Array.isArray(p?.assignedPartners)
        ? p.assignedPartners
            .filter((a) => a?.partnerId)
            .map((a) => ({
              partnerId: String(a.partnerId),
              assignedAt: String(a.assignedAt || nowIso()),
            }))
        : [];
      return {
        ...p,
        required_partners: Number.isFinite(required) && required >= 1 ? required : 1,
        selected_partner_ids: selected,
        assignedPartners,
        calendar_assigned_partner_id: p.calendar_assigned_partner_id ? String(p.calendar_assigned_partner_id) : null,
      };
    });

    // applications: default status
    next.applications = next.applications.map((a) => {
      const status = a?.status || "applied";
      return { ...a, status };
    });

    // threads: events/messages actor structure
    for (const [tid, t] of Object.entries(next.threads)) {
      if (!t || typeof t !== "object") continue;
      const tt = { ...t };
      tt.events = Array.isArray(tt.events) ? tt.events : [];
      tt.messages = Array.isArray(tt.messages) ? tt.messages : [];
      tt.photos = Array.isArray(tt.photos) ? tt.photos : [];
      tt.pdf_outputs = Array.isArray(tt.pdf_outputs) ? tt.pdf_outputs : [];
      tt.completion_report = tt.completion_report && typeof tt.completion_report === "object" ? tt.completion_report : null;
      tt.invoice_meta = tt.invoice_meta && typeof tt.invoice_meta === "object" ? tt.invoice_meta : null;
      tt.events = tt.events.map((e) => {
        const actor = normalizeActor(e?.actor || e?.by);
        const { by, ...rest } = e || {};
        return { ...rest, actor };
      });
      tt.messages = tt.messages.map((m) => {
        const from = normalizeMessageFrom(m);
        const { role, sender, senderName, ...rest } = m || {};
        return { ...rest, from };
      });
      // back-compat: old completion -> completion_report
      if (!tt.completion_report && tt.completion && typeof tt.completion === "object") {
        tt.completion_report = {
          actor: normalizeActor(tt.completion.actor || tt.completion.by || "partner"),
          ts: tt.completion.ts || nowIso(),
          updated_at: tt.completion.ts || nowIso(),
          work_content: String(tt.completion.text || ""),
          note: "",
          extra_charge: false,
          extra_charge_note: "",
        };
      }
      if (tt.completion_report && typeof tt.completion_report === "object") {
        if (!tt.completion_report.updated_at) tt.completion_report.updated_at = tt.completion_report.ts || nowIso();
      }
      // invoice_meta init/backfill
      if (!tt.invoice_meta) {
        tt.invoice_meta = {
          updated_at: tt.completion_report?.updated_at || nowIso(),
          amount: null,
          note: "",
          status: "draft",
          finalized_at: null,
          finalized_by: null,
        };
      } else {
        if (!tt.invoice_meta.updated_at) tt.invoice_meta.updated_at = tt.completion_report?.updated_at || nowIso();
        if (typeof tt.invoice_meta.amount !== "number") tt.invoice_meta.amount = null;
        if (typeof tt.invoice_meta.note !== "string") tt.invoice_meta.note = "";
        if (!tt.invoice_meta.status) tt.invoice_meta.status = "draft";
        if (!tt.invoice_meta.finalized_at) tt.invoice_meta.finalized_at = null;
        if (!tt.invoice_meta.finalized_by) tt.invoice_meta.finalized_by = null;
        tt.invoice_meta.finalized_by = tt.invoice_meta.finalized_by ? normalizeActor(tt.invoice_meta.finalized_by) : null;
      }
      tt.siteData =
        tt.siteData && typeof tt.siteData === "object"
          ? {
              ...tt.siteData,
              photos: Array.isArray(tt.siteData.photos) ? tt.siteData.photos : [],
              completed: Boolean(tt.siteData.completed),
              completionConsent: Boolean(tt.siteData.completionConsent),
              entry_at: tt.siteData.entry_at ? String(tt.siteData.entry_at) : null,
              exit_at: tt.siteData.exit_at ? String(tt.siteData.exit_at) : null,
              entry_user_id: tt.siteData.entry_user_id ? String(tt.siteData.entry_user_id) : null,
              exit_user_id: tt.siteData.exit_user_id ? String(tt.siteData.exit_user_id) : null,
            }
          : {
              photos: [],
              completed: false,
              completionConsent: false,
              entry_at: null,
              exit_at: null,
              entry_user_id: null,
              exit_user_id: null,
            };
      tt.participants = Array.isArray(tt.participants)
        ? tt.participants.map((p) => {
            if (typeof p === "string") return { label: p, name: p };
            return {
              id: String(p?.id || ""),
              type: String(p?.type || ""),
              label: String(p?.label || p?.name || ""),
              name: String(p?.name || p?.label || ""),
              joinedAt: p?.joinedAt ? String(p.joinedAt) : null,
            };
          })
        : [];
      if (!tt.status) {
        const ev = tt.events || [];
        if (ev.some((e) => e?.type === "completed")) tt.status = "completed";
        else if (ev.some((e) => e?.type === "check_out")) tt.status = "exited";
        else if (ev.some((e) => e?.type === "check_in")) tt.status = "in_progress";
        else tt.status = "open";
      }
      tt.photos = tt.photos
        .map((p) => {
          const uploaded_by = normalizeActor(p?.uploaded_by || p?.actor || p?.by);
          return {
            id: String(p?.id || uid("photo")),
            project_id: String(p?.project_id || tt.project_id || ""),
            thread_id: String(p?.thread_id || tid),
            file_name: String(p?.file_name || p?.name || ""),
            uploaded_by,
            uploaded_at: String(p?.uploaded_at || p?.ts || nowIso()),
            caption: String(p?.caption || ""),
            url: typeof p?.url === "string" ? p.url : "",
          };
        })
        .filter((p) => p.project_id && p.thread_id);
      tt.pdf_outputs = tt.pdf_outputs.map((x) => {
        if (x && typeof x === "object" && (x.kind || x.type) && (x.generated_at || x.generatedAt)) {
          return normalizeThreadPdfOutput(x, {
            project_id: tt.project_id,
            thread_id: tid,
            state: next,
          });
        }
        return x;
      });
      const expanded = [];
      for (const raw of tt.pdf_outputs || []) {
        if (raw && typeof raw === "object" && Array.isArray(raw.items)) {
          const baseActor = normalizeActor(raw.actor || raw.generated_by || raw.by || "owner");
          const g = String(raw.generated_at || raw.generatedAt || raw.ts || nowIso());
          for (const it of raw.items) {
            const k = normalizeThreadPdfKind(it);
            expanded.push(
              normalizeThreadPdfOutput(
                {
                  id: uid("pdf"),
                  project_id: tt.project_id,
                  thread_id: tid,
                  kind: k,
                  label: PDF_KIND_LABELS[k] || k,
                  actor: baseActor,
                  generated_at: g,
                  url: typeof it?.url === "string" ? it.url : "",
                },
                { project_id: tt.project_id, thread_id: tid, state: next }
              )
            );
          }
        } else if (raw && typeof raw === "object" && (raw.kind || raw.type)) {
          expanded.push(
            normalizeThreadPdfOutput(raw, { project_id: tt.project_id, thread_id: tid, state: next })
          );
        }
      }
      tt.pdf_outputs = expanded.filter((p) => p && p.project_id && p.thread_id && p.kind);
      next.threads[tid] = tt;
    }

    // selected ids backfill
    next.projects = next.projects.map((p) => {
      const selected = Array.isArray(p.selected_partner_ids) ? [...p.selected_partner_ids] : [];
      if (selected.length) return p;
      const apps = (next.applications || []).filter((a) => a.project_id === p.project_id && a.status === "selected");
      if (!apps.length) return p;
      return { ...p, selected_partner_ids: apps.map((a) => a.partner_id).filter(Boolean) };
    });

    return next;
  }

  function normalizeMvpRole(raw) {
    const r = String(raw || "").trim().toLowerCase();
    if (r === "partner") return "partner";
    if (r === "vendor") return "vendor";
    if (r === "user" || r === "builder") return "user";
    return "owner";
  }

  function applyMvpRoleFromUrl() {
    const urlRole = getParam("role");
    if (!urlRole) return;
    const role = normalizeMvpRole(urlRole);
    try {
      sessionStorage.setItem(MVP_SESSION_ROLE_KEY, role);
    } catch {
      // ignore
    }
  }

  function syncPartnerIdFromUrl() {
    const urlPid = String(getParam("partnerId") || getParam("partner_id") || "").trim();
    if (urlPid) setPartnerId(urlPid);
  }

  /** 正式スレッドUI: mvp-threads.html / mvp-thread.html（threads.html はリダイレクト） */
  const BUILDER_THREAD_ID_ALIASES = {
    "demo-thread-001": "thread-demo-001",
    "demo-thread-002": "thread-demo-002",
    "demo-thread-003": "thread-demo-003",
    "demo-thread-004": "thread-demo-004",
    "demo-thread-005": "thread-demo-005",
    "demo-thread-006": "thread-demo-006",
    "demo-thread-007": "thread-demo-007",
    "demo-thread-008": "thread-demo-008",
  };

  const BUILDER_ACTIVE_THREAD_TYPES = new Set([
    "ops_partner",
    "partner_user",
    "user_user",
    "vendor_user",
  ]);

  const BUILDER_THREAD_TYPE_BY_ID = {
    "thread-demo-001": "ops_partner",
    "thread-demo-002": "partner_user",
    "thread-demo-003": "general_project",
    "thread-demo-004": "partner_user",
    "thread-demo-005": "partner_user",
    "thread-demo-006": "general_project",
    "thread-demo-007": "user_user",
    "thread-demo-008": "vendor_user",
  };

  const BUILDER_PARTNER_THREAD_TYPES = new Set(["ops_partner", "partner_user"]);
  const BUILDER_USER_THREAD_TYPES = new Set(["partner_user", "user_user", "vendor_user"]);
  const BUILDER_VENDOR_THREAD_TYPES = new Set(["vendor_user"]);
  const BUILDER_MVP_THREADS_EXCLUDED_TYPES = new Set(["general_project"]);
  const BUILDER_PARTNER_EXCLUDED_THREAD_IDS = new Set([
    "thread-demo-003",
    "thread-demo-006",
    "thread-demo-007",
    "thread-demo-008",
  ]);
  const BUILDER_USER_EXCLUDED_THREAD_IDS = new Set(["thread-demo-001", "thread-demo-003", "thread-demo-004", "thread-demo-006"]);
  const BUILDER_VENDOR_EXCLUDED_THREAD_IDS = new Set([
    "thread-demo-001",
    "thread-demo-002",
    "thread-demo-003",
    "thread-demo-004",
    "thread-demo-005",
    "thread-demo-006",
    "thread-demo-007",
  ]);

  const BUILDER_PARTNER_THREAD_FILTER_TABS = [
    { id: "", label: "すべて" },
    { id: "ops_partner", label: "運営" },
    { id: "partner_user", label: "一般ユーザー" },
  ];

  const BUILDER_USER_THREAD_FILTER_TABS = [
    { id: "", label: "すべて" },
    { id: "partner_user", label: "パートナー" },
    { id: "user_user", label: "一般ユーザー" },
    { id: "vendor_user", label: "業者" },
  ];

  const BUILDER_VENDOR_THREAD_FILTER_TABS = [
    { id: "", label: "すべて" },
    { id: "vendor_user", label: "一般ユーザー" },
  ];

  const BUILDER_THREAD_TYPE_ALIASES = {
    user_partner: "partner_user",
    user_ops: "partner_user",
    worker_project: "partner_user",
  };

  const BUILDER_THREAD_TYPES_BASE = {
    ops_partner: {
      id: "ops_partner",
      typeLabel: "運営",
      listTitle: "運営とのやりとり",
      listSub: "現場指示・作業報告・完了報告",
      detailSub: "運営とのやりとり",
      defaultRole: "partner",
      features: { sitePhotos: true, reports: true, completion: true, siteEntry: true, calendarLink: true },
      workflow: ["現場指示", "指示書", "駐車場案内", "現場写真", "作業報告", "完了報告", "案件カレンダー連携"],
    },
    user_ops: {
      id: "user_ops",
      reserved: true,
      aliasOf: "partner_user",
      excludeFromMvpThreads: true,
      typeLabel: "パートナー",
      listTitle: "パートナーとのやりとり",
      listSub: "（旧 user_ops）",
      detailSub: "パートナーとのやりとり",
      defaultRole: "user",
      features: { sitePhotos: false, reports: false, completion: false, siteEntry: false, calendarLink: false },
      workflow: [],
    },
    worker_project: {
      id: "worker_project",
      reserved: true,
      aliasOf: "partner_user",
      excludeFromMvpThreads: true,
      typeLabel: "パートナー",
      listTitle: "パートナーとのやりとり",
      listSub: "（旧 worker_project）",
      detailSub: "パートナーとのやりとり",
      defaultRole: "partner",
      features: { sitePhotos: false, reports: false, completion: false, siteEntry: false, calendarLink: false },
      workflow: [],
    },
    user_partner: {
      id: "user_partner",
      reserved: true,
      aliasOf: "partner_user",
      typeLabel: "パートナー",
      listTitle: "パートナーとのやりとり",
      listSub: "（旧 user_partner）",
      detailSub: "パートナーとのやりとり",
      defaultRole: "partner",
      features: { sitePhotos: false, reports: false, completion: false, siteEntry: false, calendarLink: false },
      workflow: [],
    },
    general_project: {
      id: "general_project",
      reserved: true,
      excludeFromMvpThreads: true,
      typeLabel: "案件",
      listTitle: "案件のやりとり",
      listSub: "board-thread で確認",
      detailSub: "案件のやりとり",
      defaultRole: "user",
      features: { sitePhotos: false, reports: true, completion: true, siteEntry: false, calendarLink: false },
      workflow: ["応募", "選定", "やり取り", "作業完了", "承認", "レビュー"],
    },
  };

  const BUILDER_THREAD_TYPES = Object.assign(
    {},
    BUILDER_THREAD_TYPES_BASE,
    generalFlowApi()?.buildAllThreadTypeConfigs?.() || {}
  );

  function resolveBuilderThreadId(raw) {
    const id = String(raw || "").trim();
    return BUILDER_THREAD_ID_ALIASES[id] || id;
  }

  function demoThreadIdForUrl(resolvedId) {
    const id = String(resolvedId || "").trim();
    const alias = Object.entries(BUILDER_THREAD_ID_ALIASES).find(([, v]) => v === id);
    return alias ? alias[0] : id;
  }

  function normalizeBuilderThreadType(raw) {
    const t = String(raw || "").trim();
    if (!t) return "";
    if (BUILDER_THREAD_TYPE_ALIASES[t]) return normalizeBuilderThreadType(BUILDER_THREAD_TYPE_ALIASES[t]);
    const cfg = BUILDER_THREAD_TYPES[t];
    if (cfg?.reserved && cfg.aliasOf) return normalizeBuilderThreadType(cfg.aliasOf);
    if (BUILDER_ACTIVE_THREAD_TYPES.has(t)) return t;
    if (cfg?.excludeFromMvpThreads) return "";
    return cfg ? t : "";
  }

  function resolveBuilderThreadTypeCanonical(raw) {
    const t = String(raw || "").trim();
    if (!t) return "";
    if (BUILDER_THREAD_TYPE_ALIASES[t]) return resolveBuilderThreadTypeCanonical(BUILDER_THREAD_TYPE_ALIASES[t]);
    const cfg = BUILDER_THREAD_TYPES[t];
    if (cfg?.reserved && cfg.aliasOf) return resolveBuilderThreadTypeCanonical(cfg.aliasOf);
    return t;
  }

  function isReservedBuilderThreadType(threadType) {
    const t = String(threadType || "").trim();
    return Boolean(BUILDER_THREAD_TYPES[t]?.reserved);
  }

  function isExcludedFromMvpThreads(threadType) {
    const canonical = resolveBuilderThreadTypeCanonical(threadType);
    if (!canonical) return true;
    return BUILDER_MVP_THREADS_EXCLUDED_TYPES.has(canonical) || Boolean(BUILDER_THREAD_TYPES[canonical]?.excludeFromMvpThreads);
  }

  function getBuilderThreadTypeLabel(threadType, role) {
    const cfg = getBuilderThreadTypeConfig(threadType);
    const r = normalizeMvpRole(role || getRole());
    if (r === "partner" && cfg.typeLabelPartner) return cfg.typeLabelPartner;
    if (r === "vendor" && cfg.typeLabelVendor) return cfg.typeLabelVendor;
    return cfg.typeLabel || cfg.listTitle || "—";
  }

  function getBuilderThreadListTitle(threadType, role) {
    const cfg = getBuilderThreadTypeConfig(threadType);
    const r = normalizeMvpRole(role || getRole());
    if (r === "partner" && cfg.listTitlePartner) return cfg.listTitlePartner;
    if (r === "vendor" && cfg.listTitleVendor) return cfg.listTitleVendor;
    return cfg.listTitle || "やりとり";
  }

  function getBuilderThreadDetailSub(threadType, role) {
    const cfg = getBuilderThreadTypeConfig(threadType);
    const r = normalizeMvpRole(role || getRole());
    if (r === "partner" && cfg.detailSubPartner) return cfg.detailSubPartner;
    if (r === "vendor" && cfg.detailSubVendor) return cfg.detailSubVendor;
    return cfg.detailSub || cfg.listSub || "—";
  }

  function getBuilderThreadTypeParam() {
    const raw = getParam("threadType") || getParam("thread_type");
    return normalizeBuilderThreadType(raw) || resolveBuilderThreadTypeCanonical(raw);
  }

  function getBuilderThreadTypeConfig(threadType) {
    const t = normalizeBuilderThreadType(threadType);
    return BUILDER_THREAD_TYPES[t] || BUILDER_THREAD_TYPES.ops_partner;
  }

  /** やりとり詳細ヘッダーの入場/退場は ops_partner（運営カレンダー系）専用 */
  function shouldShowMvpThreadSiteEntryActions(threadType, project) {
    const tt = normalizeBuilderThreadType(threadType) || "";
    if (tt === "ops_partner") return true;
    if (generalFlowApi()?.isGeneralFlowVariant?.(tt) || tt === "general_project") {
      return false;
    }
    if (resolveGeneralFlowBenchContext(project)) return false;
    const benchType = normalizeBuilderThreadType(project?.bench_thread_type) || "";
    if (benchType && benchType !== "ops_partner") return false;
    if (!tt && project && usesMvpPartnerThread(project)) return true;
    return false;
  }

  function applyMvpThreadSiteEntryVisibility(enterBtn, leaveBtn, siteStatusEl, show, threadType) {
    const hide = !show;
    if (document.body) document.body.dataset.builderThreadSiteEntry = show ? "1" : "0";
    const tt = normalizeBuilderThreadType(threadType) || "";
    [enterBtn, leaveBtn].forEach((btn) => {
      if (!btn) return;
      btn.hidden = hide;
      if (hide) {
        btn.setAttribute("hidden", "");
        btn.setAttribute("aria-hidden", "true");
        btn.tabIndex = -1;
      } else {
        btn.removeAttribute("hidden");
        btn.removeAttribute("aria-hidden");
        btn.tabIndex = 0;
      }
    });
    if (enterBtn && show) {
      enterBtn.textContent = tt === "ops_partner" ? "現場に入場しました" : "入場";
    }
    if (leaveBtn && show) {
      leaveBtn.textContent = tt === "ops_partner" ? "現場を退場しました" : "退場";
    }
    if (siteStatusEl) siteStatusEl.hidden = hide;
  }

  function getBuilderThreadTypeForId(threadId) {
    const id = resolveBuilderThreadId(threadId);
    const fromMap = BUILDER_THREAD_TYPE_BY_ID[id];
    if (fromMap) return resolveBuilderThreadTypeCanonical(fromMap);
    try {
      const thread = mvp().reload().threads?.[id];
      return (
        resolveBuilderThreadTypeCanonical(thread?.thread_type || thread?.threadType) || "ops_partner"
      );
    } catch {
      return "ops_partner";
    }
  }

  /** mvp-thread.html リンク（thread_id + role + threadType） */
  function mvpThreadHref(threadId, role, threadType) {
    const tid = resolveBuilderThreadId(String(threadId || "").trim());
    if (!tid) return "mvp-thread.html";
    const sp = new URLSearchParams();
    sp.set("thread_id", tid);
    sp.set("id", demoThreadIdForUrl(tid));
    sp.set("role", normalizeMvpRole(role || getRole()));
    const tt = normalizeBuilderThreadType(threadType) || getBuilderThreadTypeForId(tid);
    if (tt) sp.set("threadType", tt);
    return `mvp-thread.html?${sp.toString()}`;
  }

  function mvpThreadReviewNotifyHref(threadId, role, threadType) {
    const base = mvpThreadHref(threadId, role, threadType);
    const join = base.includes("?") ? "&" : "?";
    return `${base}${join}openReview=1&notifyOpen=1`;
  }

  function boardThreadReviewNotifyHref(threadId, role) {
    const base = boardThreadHref(threadId, role);
    const join = base.includes("?") ? "&" : "?";
    return `${base}${join}openReview=1&notifyOpen=1`;
  }

  function resolveThreadReviewNotifyHref(threadId, role, threadType, project) {
    const tid = String(threadId || "").trim();
    if (!tid) return "board-thread.html?openReview=1&notifyOpen=1";
    const r = normalizeMvpRole(role || getRole());
    const tt = normalizeBuilderThreadType(threadType) || "";
    if (project && isGeneralBoardMvpProject(project)) {
      return boardThreadReviewNotifyHref(tid, r);
    }
    if (project && isBoardFeedItem(project) && !usesMvpPartnerThread(project)) {
      return boardThreadReviewNotifyHref(tid, r);
    }
    if (usesMvpPartnerThread(project) || resolveGeneralFlowBenchContext(project)) {
      return mvpThreadReviewNotifyHref(tid, r, tt);
    }
    return boardThreadReviewNotifyHref(tid, r);
  }

  function mvpThreadReviewConfirmNotifyHref(threadId, role, threadType) {
    const base = mvpThreadHref(threadId, role, threadType);
    const join = base.includes("?") ? "&" : "?";
    return `${base}${join}notifyOpen=1#review`;
  }

  const PUBLIC_BOARD_JOB_ID = generalFlowApi()?.PUBLIC_BOARD_JOB_ID || "pub-board-job-001";
  const PUBLIC_BOARD_PROJECT_ID = generalFlowApi()?.PUBLIC_BOARD_PROJECT_ID || "pub-board-project-001";

  function resolvePublicBoardDetailHref(project) {
    const generalHref = generalFlowApi()?.resolvePublicDetailHref?.(project, { relative: true });
    if (generalHref) return generalHref;
    const pid = String(project?.public_board_id || project?.project_id || "").trim();
    const boardType = resolveBoardItemType(project);
    if (/^pub-board-job-/i.test(pid)) {
      return `../public-board-detail.html?id=${encodeURIComponent(pid)}&type=job`;
    }
    if (/^pub-board-project-/i.test(pid) || /^pub-board-proj-/i.test(pid)) {
      return `../public-board-detail.html?id=${encodeURIComponent(pid)}&type=project`;
    }
    if (pid === "job_demo_full_001") {
      return `../public-board-detail.html?id=${PUBLIC_BOARD_JOB_ID}&type=job`;
    }
    if (pid === "demo-project-001") {
      return `../public-board-detail.html?id=${PUBLIC_BOARD_PROJECT_ID}&type=project`;
    }
    const type = boardType === "worker" ? "worker" : boardType === "job" ? "job" : "project";
    if (!pid) return "../public-board.html";
    return `../public-board-detail.html?id=${encodeURIComponent(pid)}&type=${encodeURIComponent(type)}`;
  }

  function canManageProjectApplications(project, state) {
    if (!project) return false;
    const me = getActor(state);
    const flowSpec = project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
    if (flowSpec) {
      return me.id === String(flowSpec.poster?.id || "").trim();
    }
    const ownerId = String(project?.owner_id || state?.owner_id || OWNER_ID).trim();
    if (me.id === ownerId) return true;
    return getRole() === "owner";
  }

  function guardPosterOnlyApplicationsView(project, state) {
    if (!isBoardApplicationsView()) return false;
    if (isNotifyApplicationsEntry()) {
      setRole("owner");
      return false;
    }
    if (!project || canManageProjectApplications(project, state)) return false;
    const publicHref = resolvePublicBoardDetailHref(project);
    try {
      const sp = new URLSearchParams(global.location.search);
      const id = sp.get("id") || project.project_id;
      const role = sp.get("role") || getRole();
      const page = getPage();
      const fallback =
        page === "builder-board-project-detail"
          ? boardDetailHref(id, resolveBoardItemType(project))
          : `mvp-project-detail.html?id=${encodeURIComponent(id)}&role=${encodeURIComponent(role)}`;
      const target =
        resolveGeneralFlowBenchContext(project) || isBoardFeedItem(project) ? publicHref : fallback;
      global.location.replace(target);
    } catch {
      global.location.replace(publicHref);
    }
    return true;
  }

  function mvpThreadsHref(threadType, role) {
    const sp = new URLSearchParams();
    const tt = normalizeBuilderThreadType(threadType);
    const r = normalizeMvpRole(role || getRole());
    if (tt) sp.set("threadType", tt);
    sp.set("role", r);
    const q = sp.toString();
    return q ? `mvp-threads.html?${q}` : "mvp-threads.html";
  }

  function getThreadRowType(thread) {
    const raw =
      thread?.thread_type ||
      thread?.threadType ||
      BUILDER_THREAD_TYPE_BY_ID[resolveBuilderThreadId(thread?.thread_id)] ||
      "";
    return normalizeBuilderThreadType(raw);
  }

  function filterThreadsForViewerRole(rows, role) {
    const r = normalizeMvpRole(role || getRole());
    return rows.filter((t) => {
      const tid = String(t?.thread_id || "");
      const rowType = getThreadRowType(t);
      if (isExcludedFromMvpThreads(rowType)) return false;
      if (r === "partner") {
        if (BUILDER_PARTNER_EXCLUDED_THREAD_IDS.has(tid)) return false;
        return BUILDER_PARTNER_THREAD_TYPES.has(rowType);
      }
      if (r === "user") {
        if (BUILDER_USER_EXCLUDED_THREAD_IDS.has(tid)) return false;
        return BUILDER_USER_THREAD_TYPES.has(rowType);
      }
      if (r === "vendor") {
        if (BUILDER_VENDOR_EXCLUDED_THREAD_IDS.has(tid)) return false;
        return BUILDER_VENDOR_THREAD_TYPES.has(rowType);
      }
      return BUILDER_ACTIVE_THREAD_TYPES.has(rowType);
    });
  }

  function getMvpThreadsPageTitle(role, threadType) {
    const r = normalizeMvpRole(role || getRole());
    const tt = normalizeBuilderThreadType(threadType);
    if (tt) return getBuilderThreadListTitle(tt, r);
    if (r === "partner" || r === "user" || r === "vendor") return "やりとり";
    return "やりとり一覧";
  }

  function getMvpThreadsPageSub(role, threadType) {
    const r = normalizeMvpRole(role || getRole());
    const tt = normalizeBuilderThreadType(threadType);
    if (tt) return getBuilderThreadTypeConfig(tt).listSub;
    if (r === "partner" || r === "user" || r === "vendor") return "メッセージ一覧";
    return "メッセージ一覧";
  }

  function renderMvpThreadsTypeFilter(role) {
    const host = document.querySelector("[data-builder-mvp-threads-filter]");
    const list = document.querySelector("[data-builder-mvp-threads-filter-list]");
    if (!host || !list) return;
    const r = normalizeMvpRole(role);
    const tabs =
      r === "partner"
        ? BUILDER_PARTNER_THREAD_FILTER_TABS
        : r === "user"
          ? BUILDER_USER_THREAD_FILTER_TABS
          : r === "vendor"
            ? BUILDER_VENDOR_THREAD_FILTER_TABS
            : null;
    if (!tabs) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    const activeType = getBuilderThreadTypeParam();
    list.innerHTML = tabs
      .map((tab) => {
        const sp = new URLSearchParams();
        sp.set("role", r);
        if (tab.id) sp.set("threadType", tab.id);
        const href = `mvp-threads.html?${sp.toString()}`;
        const active = (tab.id || "") === (activeType || "");
        return (
          `<li>` +
          `<a class="mvp-threads-filter__tab${active ? " is-active" : ""}" href="${esc(href)}"${
            active ? ' aria-current="page"' : ""
          }>${esc(tab.label)}</a>` +
          `</li>`
        );
      })
      .join("");
  }

  function getThreadListCardTitle(thread, project) {
    return (
      thread?.list_title ||
      thread?.listTitle ||
      project?.title ||
      thread?.project_id ||
      "—"
    );
  }

  function renderBuilderThreadTypeBadge(threadType) {
    const tt = normalizeBuilderThreadType(threadType) || resolveBuilderThreadTypeCanonical(threadType);
    const mod = String(tt || "ops_partner").replace(/_/g, "-");
    return `<span class="mvp-thread-card__type mvp-thread-card__type--${esc(mod)}">${esc(
      getBuilderThreadTypeLabel(tt, getRole())
    )}</span>`;
  }

  function renderBuilderThreadContextCard(thread, project, threadType) {
    const cfg = getBuilderThreadTypeConfig(threadType);
    const tt = normalizeBuilderThreadType(threadType) || resolveBuilderThreadTypeCanonical(threadType);
    const counterpart =
      thread?.counterpart_name ||
      thread?.counterpartName ||
      (tt === "ops_partner"
        ? "TASFUL運営"
        : tt === "partner_user"
          ? normalizeMvpRole(getRole()) === "partner"
            ? "一般ユーザー"
            : "パートナー"
          : tt === "user_user"
            ? "一般ユーザー"
            : tt === "vendor_user"
              ? normalizeMvpRole(getRole()) === "vendor"
                ? "一般ユーザー"
                : "業者"
              : "やりとり相手");
    const projectHref = project?.project_id
      ? `mvp-project-detail.html?id=${encodeURIComponent(project.project_id)}`
      : "";
    const calHref = cfg.features.calendarLink ? "index.html?view=calendar" : "";
    const workflowHtml = (cfg.workflow || [])
      .map((w) => `<span class="mvp-thread-context__chip">${esc(w)}</span>`)
      .join("");
    return (
      `<div class="mvp-thread-context">` +
      `<div class="mvp-thread-context__grid">` +
      `<div class="mvp-thread-context__main">` +
      `<p class="mvp-thread-context__label">相手</p>` +
      `<p class="mvp-thread-context__counterpart"><strong>${esc(counterpart)}</strong></p>` +
      (project?.title ? `<p class="mvp-thread-context__project">${esc(project.title)}</p>` : "") +
      `</div>` +
      `<div class="mvp-thread-context__links">` +
      (projectHref
        ? `<a class="builder-btn builder-btn--ghost builder-btn--sm" href="${esc(projectHref)}">案件詳細</a>`
        : "") +
      (calHref
        ? `<a class="builder-btn builder-btn--ghost builder-btn--sm" href="${esc(calHref)}">案件カレンダー</a>`
        : "") +
      `</div>` +
      `</div>` +
      (workflowHtml ? `<div class="mvp-thread-context__workflow" aria-label="やり取りの種類">${workflowHtml}</div>` : "") +
      `</div>`
    );
  }

  /**
   * file:// でも query を失わないよう相対 URL で replaceState する。
   * 既存の thread_id / role は維持。role 引数がある場合のみ上書き。
   */
  function replaceMvpThreadUrl({ threadId, role } = {}) {
    if (getPage() !== "builder-mvp-thread") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const tid = String(threadId || sp.get("thread_id") || getMvpThreadIdParam() || "").trim();
      if (!tid) return;
      sp.set("thread_id", tid);
      if (role) {
        sp.set("role", normalizeMvpRole(role));
      } else if (sp.get("role")) {
        sp.set("role", normalizeMvpRole(sp.get("role")));
      }
      const tt = getBuilderThreadTypeParam() || getBuilderThreadTypeForId(tid);
      if (tt) sp.set("threadType", tt);
      sp.set("id", demoThreadIdForUrl(tid));
      const file = window.location.pathname.split("/").pop() || "mvp-thread.html";
      const next = `${file}?${sp.toString()}${window.location.hash || ""}`;
      const current = `${file}${window.location.search}${window.location.hash || ""}`;
      if (next !== current) {
        window.history.replaceState({}, "", next);
      }
    } catch {
      // ignore
    }
  }

  /** URL に role がある場合、再描画後も消えないよう相対 URL で復元する */
  function ensureMvpThreadUrlParams() {
    if (getPage() !== "builder-mvp-thread") return;
    const urlRole = getParam("role");
    const threadId = getMvpThreadIdParam();
    if (!threadId || !urlRole) return;
    replaceMvpThreadUrl({ threadId, role: urlRole });
  }

  function syncMvpRoleToUrl(role) {
    replaceMvpThreadUrl({ role: normalizeMvpRole(role) });
  }

  function builderIdentity() {
    return global.TasuBuilderActorIdentity || {};
  }

  function isBuilderProdHost() {
    const id = builderIdentity();
    if (typeof id.isProductionHost === "function") return id.isProductionHost();
    return global.TasuAuthCurrentUser?.isProductionHost?.() === true;
  }

  function resolveBuilderActorContext(state, project) {
    const st = state || mvp().reload();
    let proj = project || null;
    if (!proj && st) {
      const threadId = String(getParam("id") || getParam("threadId") || getParam("projectId") || "").trim();
      if (threadId) {
        proj =
          (st.projects || []).find(
            (p) => p.project_id === threadId || p.thread_id === threadId
          ) || null;
      }
    }
    let flowSpec = null;
    if (proj?.bench_flow_id && typeof getBenchGeneralFlowSpec === "function") {
      flowSpec = getBenchGeneralFlowSpec(proj.bench_flow_id, proj);
    }
    return { state: st, project: proj, flowSpec };
  }

  function getDemoRoleFromStorage() {
    const urlRole = getParam("role");
    if (urlRole) return normalizeMvpRole(urlRole);
    try {
      const session = sessionStorage.getItem(MVP_SESSION_ROLE_KEY);
      if (session) return normalizeMvpRole(session);
    } catch {
      // ignore
    }
    const r = localStorage.getItem(MVP_ROLE_KEY);
    if (r === "partner") return "partner";
    if (r === "user") return "user";
    if (r === "vendor") return "vendor";
    return "owner";
  }

  function getRole(context) {
    if (isBuilderProdHost()) {
      const ctx = context && typeof context === "object" ? context : resolveBuilderActorContext();
      const role = builderIdentity().getViewRole?.(ctx) || "";
      return normalizeMvpRole(role || "");
    }
    return getDemoRoleFromStorage();
  }

  function getPartnerId(context) {
    if (isBuilderProdHost()) {
      const ctx = context && typeof context === "object" ? context : resolveBuilderActorContext();
      const actor = builderIdentity().getBuilderActor?.(ctx);
      return String(actor?.actorId || actor?.userId || "").trim();
    }
    const id = localStorage.getItem(MVP_PARTNER_ID_KEY);
    return id || "demo-partner-001";
  }

  function setPartnerId(id) {
    localStorage.setItem(MVP_PARTNER_ID_KEY, id || "demo-partner-001");
    document.dispatchEvent(new CustomEvent("builder:mvp-partner-changed"));
  }

  function setRole(next) {
    const role = normalizeMvpRole(next);
    localStorage.setItem(MVP_ROLE_KEY, role);
    try {
      sessionStorage.setItem(MVP_SESSION_ROLE_KEY, role);
    } catch {
      // ignore
    }
    if (getPage() === "builder-mvp-thread") syncMvpRoleToUrl(role);
    document.dispatchEvent(new CustomEvent("builder:mvp-role-changed"));
  }

  function dispatchMvpNotificationsChanged() {
    document.dispatchEvent(new CustomEvent("builder:mvp-notifications-changed"));
  }

  function resolveOpsThreadNotifyPartnerId(project, thread, state) {
    const fromCalendar = String(project?.calendar_assigned_partner_id || "").trim();
    if (fromCalendar) return fromCalendar;
    const selected = (project?.selected_partner_ids || []).map((id) => String(id || "").trim()).find(Boolean);
    if (selected) return selected;
    const msgs = thread?.messages || [];
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const from = msgs[i]?.from;
      if (from?.type === "partner" && String(from.id || "").trim()) return String(from.id).trim();
    }
    const events = thread?.events || [];
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const actor = events[i]?.actor;
      if (actor?.type === "partner" && String(actor.id || "").trim()) return String(actor.id).trim();
    }
    const ctxPartner = String(state?.context?.partnerId || "").trim();
    if (ctxPartner) return ctxPartner;
    return getPartnerId() || "demo-partner-001";
  }

  function resolveBuilderOpsNotifyRecipientUserId(recipientRole, partnerId) {
    const role = String(recipientRole || "").toLowerCase();
    if (role === "owner" || role === "ops") return OWNER_ID;
    if (role === "partner") {
      const pid = String(partnerId || "").trim();
      if (pid && pid !== OWNER_ID) return pid;
      return getPartnerId() || "demo-partner-001";
    }
    return "";
  }

  function resolveBuilderOpsNotifySender(actor) {
    const from = actor && typeof actor === "object" ? actor : {};
    const type = String(from.type || "").toLowerCase();
    const senderRole = type === "owner" || type === "ops" ? "owner" : type === "partner" ? "partner" : type || "";
    const senderUserId = String(from.id || "").trim() || (senderRole === "owner" ? OWNER_ID : getPartnerId());
    return { senderUserId, senderRole };
  }

  function emitBuilderOpsBenchEvent(type, detail = {}) {
    try {
      const payload = { type, ...(detail || {}) };
      const BenchEmbed = global.TasuBuilderBenchEmbed;
      if (BenchEmbed?.isBuilderBenchParent?.()) {
        global.parent?.postMessage?.(payload, "*");
        return;
      }
      if (global.parent && global.parent !== global) {
        global.parent.postMessage(payload, "*");
      }
    } catch {
      /* ignore */
    }
  }

  function isMvpThreadCompletionPanelVisible(target) {
    if (!target) return false;
    if (target.hidden) return false;
    try {
      const style = global.getComputedStyle?.(target);
      if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    } catch {
      /* ignore */
    }
    return true;
  }

  function syncBuilderMvpTalkNotification(detail = {}) {
    try {
      const talk = window.TasuTalkPlatformNotify || global.TasuTalkPlatformNotify;
      if (!talk?.notifyBuilderGuide) return null;
      return talk.notifyBuilderGuide(detail);
    } catch (err) {
      console.warn("[Builder] TALK notify skipped:", err);
      return null;
    }
  }

  function inferMvpNotificationType({ type, title } = {}) {
    const explicit = String(type || "").trim();
    if (explicit && MVP_NOTIFICATION_TYPE_UI[explicit]) return explicit;
    if (explicit) return explicit;
    const t = String(title || "");
    if (t === "選定" || t === "採用") return "selected";
    if (t === "却下") return "rejected";
    if (t === "案件応募") return "application";
    if (t === "スレッド" || t === "Talk") return "message";
    if (t === "再依頼") return "re_request";
    if (t === "添付" || t === "添付追加") return "attachment";
    return "admin";
  }

  function resolveMvpNotificationHref(n, state) {
    const type = n?.type || "admin";
    const pid = n?.projectId || n?.project_id || null;
    const project = pid ? (state?.projects || []).find((p) => p.project_id === pid) : null;
    let href = n?.href ? String(n.href) : "";
    if (href) return href;
    const tid = n?.threadId || n?.thread_id || null;
    const threadId = tid || project?.main_thread_id || null;
    if ((type === "message" || type === "attachment") && threadId) {
      const projectKind = resolveBoardItemType(project);
      const flowSpec = project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
      if (flowSpec) {
        const role = gfNotifyHrefRole(project, n, flowSpec);
        return mvpThreadHref(threadId, role, flowSpec.threadType || project?.bench_thread_type || "");
      }
      const role =
        n.recipientRole === "owner"
          ? "owner"
          : n.recipientRole === "partner"
            ? "partner"
            : normalizeMvpRole(n.recipientRole || getRole());
      if (usesMvpPartnerThread(projectKind)) {
        const tt = projectKind === "calendar" || projectKind === "admin_ops" ? "ops_partner" : "";
        return mvpThreadHref(threadId, role, tt);
      }
      return mvpThreadHref(threadId, role);
    }
    if (type === "site_photo" && threadId) {
      return mvpThreadHref(threadId);
    }
    if ((type === "attendance_enter" || type === "attendance_leave") && threadId) {
      const projectKind = resolveBoardItemType(project);
      const role = n.recipientRole === "partner" ? "partner" : "partner";
      const tt = projectKind === "calendar" ? "ops_partner" : "";
      if (usesMvpPartnerThread(projectKind)) {
        return mvpThreadHref(threadId, role, tt);
      }
      return boardThreadHref(threadId, role);
    }
    if (type === "re_request" && pid) {
      return `re-request.html?project_id=${encodeURIComponent(pid)}`;
    }
    if (type === "review") {
      return "admin-reviews.html";
    }
    if (type === "review_request" && threadId) {
      const projectKind = resolveBoardItemType(project);
      const flowSpec = project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
      if (flowSpec) {
        const role = gfNotifyHrefRole(project, n, flowSpec);
        return resolveThreadReviewNotifyHref(
          threadId,
          role,
          flowSpec.threadType || project?.bench_thread_type || "",
          project
        );
      }
      const role =
        n.recipientRole === "owner"
          ? "owner"
          : n.recipientRole === "partner"
            ? "partner"
            : normalizeMvpRole(n.recipientRole || getRole());
      if (usesMvpPartnerThread(projectKind) || usesMvpPartnerThread(project)) {
        const tt = projectKind === "calendar" || projectKind === "admin_ops" ? "ops_partner" : "";
        return mvpThreadReviewNotifyHref(threadId, role, tt);
      }
      return resolveThreadReviewNotifyHref(threadId, role, "", project);
    }
    if ((type === "review_received" || type === "review_submitted") && threadId) {
      const projectKind = resolveBoardItemType(project);
      const flowSpec = project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
      if (flowSpec) {
        const role = gfNotifyHrefRole(project, n, flowSpec);
        return mvpThreadReviewConfirmNotifyHref(
          threadId,
          role,
          flowSpec.threadType || project?.bench_thread_type || ""
        );
      }
      const role =
        n.recipientRole === "owner"
          ? "owner"
          : n.recipientRole === "partner"
            ? "partner"
            : normalizeMvpRole(n.recipientRole || getRole());
      if (usesMvpPartnerThread(projectKind) || usesMvpPartnerThread(project)) {
        const tt = projectKind === "calendar" || projectKind === "admin_ops" ? "ops_partner" : "";
        return mvpThreadReviewConfirmNotifyHref(threadId, role, tt);
      }
      return mvpThreadReviewConfirmNotifyHref(threadId, role, "");
    }
    if (
      (type === "completion_submitted" || type === "completion_rejected" || type === "completed") &&
      threadId
    ) {
      const projectKind = resolveBoardItemType(project);
      const flowSpec = project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
      if (isGeneralBoardMvpProject(project) && flowSpec) {
        const party =
          gfPartyForRecipient(flowSpec, n) ||
          (type === "completion_submitted" ? flowSpec.poster : flowSpec.applicant);
        const role = gfPartyUrlRole(party);
        return mvpThreadHref(threadId, role, flowSpec.threadType || project?.bench_thread_type || "");
      }
      const role =
        type === "completion_submitted"
          ? resolveBoardItemType(project) === "worker"
            ? "partner"
            : "owner"
          : resolveBoardItemType(project) === "worker"
            ? "owner"
            : "partner";
      if (usesMvpPartnerThread(projectKind)) {
        const tt = resolveBoardItemType(project) === "calendar" ? "ops_partner" : "";
        return mvpThreadHref(threadId, role, tt);
      }
      return resolveBoardOrMvpThreadNotifyHref(threadId, role, project, "", {
        completionAnchor: type === "completion_submitted" || type === "completion_rejected",
      });
    }
    if (type === "completed" && pid) {
      return `mvp-project-detail.html?id=${encodeURIComponent(pid)}`;
    }
    if ((type === "dispatch" || type === "admin") && pid) {
      return `mvp-project-detail.html?id=${encodeURIComponent(pid)}`;
    }
    if (type === "calendar_assignment" && pid) {
      const ppid = n.recipientPartnerId || n.to || n.partnerId || null;
      return partnerAssignmentPageHref(pid, { partnerId: ppid || undefined });
    }
    if (type === "request_declined") {
      const projectKind = resolveBoardItemType(project) || n.projectKind || n.board_type || "";
      if ((projectKind === "calendar" || n.projectKind === "calendar") && !threadId) {
        return "#";
      }
    }
    if (
      (type === "selected" ||
        type === "hire_confirmed" ||
        type === "request_declined" ||
        type === "completion_approved") &&
      threadId
    ) {
      const role = n.recipientRole === "partner" ? "partner" : "partner";
      const projectKind = resolveBoardItemType(project);
      if (usesMvpPartnerThread(projectKind) || usesMvpPartnerThread(project)) {
        return mvpThreadHref(threadId, role, "ops_partner");
      }
      return mvpThreadHref(threadId, role);
    }
    if (type === "rejected" && pid && project) {
      return resolvePublicBoardDetailHref(project);
    }
    if ((type === "application" || type === "selected" || type === "attachment" || type === "template") && pid) {
      if (
        type === "application" &&
        (isGeneralBoardMvpProject(project) || (project && isBoardFeedItem(project) && !usesMvpPartnerThread(project)))
      ) {
        const explicit = String(n?.href || "");
        if (explicit && /board-project-detail/.test(explicit)) return explicit;
        return `board-project-detail.html?id=${encodeURIComponent(pid)}&view=applications&role=owner`;
      }
      return `mvp-project-detail.html?id=${encodeURIComponent(pid)}`;
    }
    return "index.html";
  }

  function normalizeMvpNotification(raw, state) {
    const n = raw && typeof raw === "object" ? raw : {};
    const type = inferMvpNotificationType({ type: n.type, title: n.title });
    const projectId = n.projectId || n.project_id || null;
    const project =
      projectId && state?.projects
        ? (state.projects || []).find((p) => p.project_id === projectId)
        : null;
    const threadId = n.threadId || n.thread_id || project?.main_thread_id || null;
    const row = {
      id: String(n.id || uid("notif")),
      type,
      label: String(n.label || MVP_NOTIFICATION_TYPE_UI[type]?.label || n.title || "通知"),
      projectId: projectId ? String(projectId) : null,
      projectTitle: String(n.projectTitle || n.project_title || project?.title || ""),
      threadId: threadId ? String(threadId) : null,
      body: String(n.body || ""),
      attachments: Array.isArray(n.attachments) ? n.attachments : [],
      to: n.to ? String(n.to) : null,
      recipientPartnerId: n.recipientPartnerId ? String(n.recipientPartnerId) : n.to ? String(n.to) : null,
      partnerId: n.partnerId ? String(n.partnerId) : null,
      assignmentId: n.assignmentId ? String(n.assignmentId) : null,
      title: String(n.title || ""),
      actionLabel: String(n.actionLabel || ""),
      recipientRole: n.recipientRole ? String(n.recipientRole) : "",
      recipientUserId: n.recipientUserId ? String(n.recipientUserId) : "",
      recipientSlot: n.recipientSlot ? String(n.recipientSlot) : "",
      bench_flow_id: n.bench_flow_id ? String(n.bench_flow_id) : "",
      bench_thread_type: n.bench_thread_type ? String(n.bench_thread_type) : "",
      secondaryActionLabel: n.secondaryActionLabel ? String(n.secondaryActionLabel) : "",
      senderUserId: n.senderUserId ? String(n.senderUserId) : "",
      senderRole: n.senderRole ? String(n.senderRole) : "",
      createdAt: String(n.createdAt || n.created_at || n.ts || nowIso()),
      read: Boolean(n.read),
      href: n.href ? String(n.href) : null,
    };
    row.href = resolveMvpNotificationHref(row, state || mvp().reload());
    return row;
  }

  function migrateLegacyMvpNotificationsIfNeeded() {
    try {
      const existing = localStorage.getItem(MVP_NOTIFICATIONS_KEY);
      if (existing) return;
    } catch {
      return;
    }
    const legacy = loadMvpState()?.notifications;
    if (!Array.isArray(legacy) || !legacy.length) return;
    const state = loadMvpState() || {};
    saveMvpNotifications(legacy.map((n) => normalizeMvpNotification(n, state)));
  }

  function getMvpNotifications() {
    const repo = b3Provider()?.getNotificationRepository?.();
    if (repo?.list) {
      try {
        return repo.list();
      } catch {
        /* fallback below */
      }
    }
    migrateLegacyMvpNotificationsIfNeeded();
    try {
      const raw = localStorage.getItem(MVP_NOTIFICATIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const state = loadMvpState() || {};
      return parsed.map((n) => normalizeMvpNotification(n, state));
    } catch {
      return [];
    }
  }

  function saveMvpNotifications(list) {
    const repo = b3Provider()?.getNotificationRepository?.();
    if (repo?.saveAll) {
      try {
        repo.saveAll(list);
        return;
      } catch {
        /* fallback below */
      }
    }
    const state = loadMvpState() || {};
    const normalized = (Array.isArray(list) ? list : []).map((n) => normalizeMvpNotification(n, state));
    try {
      localStorage.setItem(MVP_NOTIFICATIONS_KEY, JSON.stringify(normalized));
    } catch {
      // ignore
    }
    dispatchMvpNotificationsChanged();
  }

  function getMvpUnreadNotificationCount() {
    const adapter = global.TasuBuilderNotificationAdapter;
    if (adapter?.countUnread) {
      try {
        return adapter.countUnread({ skipActorFilter: true });
      } catch {
        /* fallback */
      }
    }
    return getMvpNotifications().filter((n) => !n.read).length;
  }

  function markMvpNotificationRead(notificationId) {
    const id = String(notificationId || "");
    if (!id) return;
    const adapter = global.TasuBuilderNotificationAdapter;
    if (adapter?.markAsRead) {
      adapter.markAsRead(id);
      return;
    }
    const list = getMvpNotifications();
    let changed = false;
    const next = list.map((n) => {
      if (n.id !== id || n.read) return n;
      changed = true;
      return { ...n, read: true };
    });
    if (changed) saveMvpNotifications(next);
  }

  function markAllMvpNotificationsRead() {
    const adapter = global.TasuBuilderNotificationAdapter;
    if (adapter?.markAllAsRead) {
      adapter.markAllAsRead();
      return;
    }
    const list = getMvpNotifications();
    if (!list.some((n) => !n.read)) return;
    saveMvpNotifications(list.map((n) => ({ ...n, read: true })));
  }

  function addMvpNotification(payload = {}) {
    const state = loadMvpState() || mvp().reload();
    const projectId = payload.projectId || payload.project_id || null;
    const project = projectId ? (state.projects || []).find((p) => p.project_id === projectId) : null;
    const row = normalizeMvpNotification(
      {
        id: uid("notif"),
        type: payload.type || inferMvpNotificationType(payload),
        label: payload.label,
        title: payload.title,
        projectId,
        projectTitle: payload.projectTitle || project?.title || "",
        threadId: payload.threadId || payload.thread_id || project?.main_thread_id || null,
        body: payload.body || "",
        attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
        to: payload.to || payload.recipientPartnerId || payload.partnerId || null,
        recipientPartnerId: payload.recipientPartnerId || payload.to || payload.partnerId || null,
        partnerId: payload.partnerId || payload.to || null,
        assignmentId: payload.assignmentId || null,
        title: payload.title || "",
        actionLabel: payload.actionLabel || "",
        recipientRole: payload.recipientRole || payload.audience || "",
        recipientUserId: payload.recipientUserId || "",
        recipientSlot: payload.recipientSlot || "",
        bench_flow_id: payload.bench_flow_id || project?.bench_flow_id || "",
        bench_thread_type: payload.bench_thread_type || project?.bench_thread_type || "",
        secondaryActionLabel: payload.secondaryActionLabel || "",
        senderUserId: payload.senderUserId || payload.sender_user_id || "",
        senderRole: payload.senderRole || payload.sender_role || "",
        createdAt: payload.createdAt || nowIso(),
        read: false,
        href: payload.href || null,
      },
      state
    );
    const adapter = global.TasuBuilderNotificationAdapter;
    if (adapter?.persistFromMvp) {
      adapter.persistFromMvp(row);
    } else {
      saveMvpNotifications([row, ...getMvpNotifications()]);
    }
    const recipientRole = payload.recipientRole || row.recipientRole || payload.audience || "";
    const thread = row.threadId ? (state.threads || {})[row.threadId] : null;
    const opsPartnerId =
      recipientRole === "partner" && project ? resolveOpsThreadNotifyPartnerId(project, thread, state) : null;
    const benchFlowRecipientUserId = (() => {
      const flowId = String(project?.bench_flow_id || "").trim();
      if (!flowId) return "";
      const flowSpec = getBenchGeneralFlowSpec(flowId, project);
      if (!flowSpec) return "";
      return gfRecipientUserId(flowSpec, {
        recipientUserId: payload.recipientUserId,
        recipientSlot: payload.recipientSlot,
        recipientRole,
      });
    })();
    const recipientUserId =
      String(payload.recipientUserId || "").trim() ||
      benchFlowRecipientUserId ||
      resolveBuilderOpsNotifyRecipientUserId(
        recipientRole,
        opsPartnerId || row.recipientPartnerId || row.partnerId
      );
    syncBuilderMvpTalkNotification({
      type: payload.type || row.type,
      body: row.body || row.label || row.title || "",
      title: row.title || row.label || "",
      projectTitle: row.projectTitle || "",
      projectId: row.projectId,
      project_id: row.projectId,
      threadId: row.threadId,
      thread_id: row.threadId,
      recipientRole,
      recipientUserId,
      recipientPartnerId: row.recipientPartnerId || row.partnerId || payload.partnerId || null,
      partnerId: row.partnerId || payload.partnerId || null,
      senderUserId: payload.senderUserId || payload.sender_user_id || null,
      senderRole: payload.senderRole || payload.sender_role || null,
      projectKind: payload.projectKind || payload.board_type || "",
      board_type: payload.board_type || payload.projectKind || "",
      actionLabel: payload.actionLabel || "",
      secondaryActionLabel: payload.secondaryActionLabel || "",
      builderNotifyKind: payload.builderNotifyKind || "",
      href: row.href || payload.href || null,
      bench_flow_id: payload.bench_flow_id || project?.bench_flow_id || "",
      threadType:
        payload.threadType ||
        payload.bench_thread_type ||
        (project?.bench_flow_id
          ? getBenchGeneralFlowSpec(project.bench_flow_id, project)?.threadType
          : "") ||
        project?.bench_thread_type ||
        "",
      bench_thread_type:
        payload.bench_thread_type ||
        payload.threadType ||
        project?.bench_thread_type ||
        "",
      notifyOnly: payload.notifyOnly === true || row.notifyOnly === true,
    });
  }

  function ensureMvpNotificationsDemoData() {
    if (isOpsBenchSession()) return;
    migrateLegacyMvpNotificationsIfNeeded();
    const demos = [
      {
        id: "notif-demo-001",
        type: "message",
        label: "メッセージ受信",
        projectId: "demo-project-001",
        projectTitle: "新宿区 共同住宅 外装改修",
        threadId: "thread-demo-001",
        body: "協力会社から新しいメッセージが届きました。",
        createdAt: "2026-06-03T10:30:00+09:00",
        read: false,
        threadType: "ops_partner",
        href: mvpThreadHref("thread-demo-001", "partner", "ops_partner"),
      },
      {
        id: "notif-demo-002",
        type: "application",
        label: "新規応募",
        projectId: "demo-project-001",
        projectTitle: "新宿区 共同住宅 外装改修",
        threadId: "thread-demo-001",
        body: "株式会社オレンジ建装から応募がありました。",
        createdAt: "2026-06-02T15:20:00+09:00",
        read: false,
        href: "mvp-project-detail.html?id=demo-project-001",
      },
      {
        id: "notif-demo-003",
        type: "selected",
        label: "選定完了",
        projectId: "demo-project-001",
        projectTitle: "新宿区 共同住宅 外装改修",
        threadId: "thread-demo-001",
        body: "協力会社の選定が完了しました。",
        createdAt: "2026-06-01T11:00:00+09:00",
        read: true,
        href: "mvp-project-detail.html?id=demo-project-001",
      },
      {
        id: "notif-demo-004",
        type: "attachment",
        label: "添付追加",
        projectId: "demo-project-001",
        projectTitle: "新宿区 共同住宅 外装改修",
        threadId: "thread-demo-001",
        body: "平面図.pdf がやりとりに添付されました。",
        createdAt: "2026-05-31T09:45:00+09:00",
        read: false,
        threadType: "ops_partner",
        href: mvpThreadHref("thread-demo-001", "partner", "ops_partner"),
      },
      {
        id: "notif-demo-005",
        type: "re_request",
        label: "再依頼",
        projectId: "demo-project-001",
        projectTitle: "新宿区 共同住宅 外装改修",
        body: "完了案件から再依頼の下書きが作成できます。",
        createdAt: "2026-05-30T16:00:00+09:00",
        read: true,
        href: "re-request.html?project_id=demo-project-001",
      },
      {
        id: "notif-demo-006",
        type: "admin",
        label: "運営通知",
        projectId: "demo-project-001",
        projectTitle: "新宿区 共同住宅 外装改修",
        body: "TASFUL運営より：安全書類の提出期限が近づいています。",
        createdAt: "2026-05-29T08:00:00+09:00",
        read: false,
        href: "mvp-project-detail.html?id=demo-project-001",
      },
      {
        id: "notif-demo-007",
        type: "rejected",
        label: "却下",
        projectId: "demo-project-001",
        projectTitle: "新宿区 共同住宅 外装改修",
        body: "応募者の却下処理が完了しました。",
        createdAt: "2026-05-28T14:10:00+09:00",
        read: true,
        href: "mvp-project-detail.html?id=demo-project-001",
      },
      {
        id: "notif-demo-008",
        type: "message",
        label: "パートナー返信",
        projectId: "demo-thread-list-002",
        projectTitle: "世田谷区 キッチンリフォーム 相談",
        threadId: "thread-demo-002",
        threadType: "partner_user",
        body: "佐藤建設から見積のご案内が届きました。",
        createdAt: "2026-06-04T11:15:00+09:00",
        read: false,
        href: mvpThreadHref("thread-demo-002", "user", "partner_user"),
      },
      {
        id: "notif-demo-009",
        type: "message",
        label: "一般ユーザー返信",
        projectId: "demo-thread-list-007",
        projectTitle: "横浜市 外壁塗装 仲介相談",
        threadId: "thread-demo-007",
        threadType: "user_user",
        body: "一般ユーザーから返信がありました。",
        createdAt: "2026-06-03T16:40:00+09:00",
        read: false,
        href: mvpThreadHref("thread-demo-007", "user", "user_user"),
      },
      {
        id: "notif-demo-010",
        type: "message",
        label: "業者返信",
        projectId: "demo-thread-list-008",
        projectTitle: "港区 設備修理 業者見積",
        threadId: "thread-demo-008",
        threadType: "vendor_user",
        body: "業者から見積のご案内が届きました。",
        createdAt: "2026-06-02T18:00:00+09:00",
        read: false,
        recipientRole: "user",
        href: mvpThreadHref("thread-demo-008", "user", "vendor_user"),
      },
    ];
    const existing = getMvpNotifications();
    const ids = new Set(existing.map((n) => n.id));
    const missing = demos.filter((d) => !ids.has(d.id));
    const state = loadMvpState() || {};
    if (missing.length) {
      saveMvpNotifications([
        ...missing.map((d) => normalizeMvpNotification(d, state)),
        ...existing,
      ]);
    }
    migrateMvpNotificationThreadHrefs();
  }

  function migrateMvpNotificationThreadHrefs() {
    const list = getMvpNotifications();
    const state = loadMvpState() || {};
    let changed = false;
    const next = list.map((n) => {
      if (!n.threadId) return n;
      const tt = getBuilderThreadTypeForId(n.threadId);
      const thread = state.threads?.[n.threadId];
      const project = (state.projects || []).find((p) => p.project_id === (thread?.project_id || n.projectId));
      const flowSpec = project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
      let role;
      if (flowSpec) {
        role = gfNotifyHrefRole(project, n, flowSpec);
      } else {
        role =
          n.recipientRole === "partner"
            ? "partner"
            : tt === "ops_partner"
              ? "partner"
              : normalizeMvpRole(n.recipientRole || "user");
      }
      const expected = mvpThreadHref(n.threadId, role, tt);
      if (n.href === expected) return n;
      changed = true;
      return { ...n, href: expected };
    });
    if (changed) saveMvpNotifications(next);
  }

  function emptyOpsBenchMvpState() {
    return {
      version: 1,
      owner_id: OWNER_ID,
      partners: [...DEMO_PARTNERS],
      projects: [],
      specs: {},
      threads: {},
      applications: [],
    };
  }

  function seedMvpStateIfEmpty() {
    const existing = loadMvpState();
    if (existing && existing.version === 1) return existing;
    if (isOpsBenchSession()) {
      const empty = emptyOpsBenchMvpState();
      saveMvpState(empty);
      return empty;
    }

    const mainThreadId = "thread-demo-001";
    const state = {
      version: 1,
      owner_id: OWNER_ID,
      partners: [...DEMO_PARTNERS],
      projects: [...DEMO_PROJECTS],
      specs: { ...DEMO_PROJECT_SPECS },
      threads: {
        [mainThreadId]: {
          thread_id: mainThreadId,
          thread_type: "ops_partner",
          counterpart_name: "TASFUL運営",
          project_id: "demo-project-001",
          events: [
            {
              type: "created",
              actor: { id: OWNER_ID, type: "owner", name: "TASFUL運営" },
              ts: "2026-05-25T01:10:00.000Z",
              text: "案件を投稿しました（demo）",
            },
          ],
          messages: [
            {
              msg_id: "msg-demo-001",
              from: { id: OWNER_ID, type: "owner", name: "TASFUL運営" },
              ts: "2026-05-25T01:12:00.000Z",
              text: "よろしくお願いします。条件確認はTalkで。",
            },
          ],
          photos: [],
          completion: null,
        },
      },
      applications: [
        {
          application_id: "app-demo-001",
          project_id: "demo-project-001",
          partner_id: "demo-partner-001",
          status: "applied",
          ts: "2026-05-27T02:30:00.000Z",
          contact_name: "田中 建一",
          phone: "090-1234-5678",
          email: "orange-kensou@example.com",
          desired_amount: "75万円〜85万円",
          memo: "足場経験豊富。近隣配慮対応可。",
          body: "条件確認のうえ応募します。日程調整可能です。",
          attachments: [{ name: "見積概算.pdf", type: "pdf" }],
        },
        {
          application_id: "app-demo-002",
          project_id: "demo-project-001",
          partner_id: "demo-partner-002",
          status: "applied",
          ts: "2026-05-27T03:05:00.000Z",
          contact_name: "鈴木 足場",
          phone: "080-9876-5432",
          email: "scaffold-works@example.com",
          desired_amount: "68万円",
          memo: "小規模足場に強み。即日見積可能。",
          body: "安全第一で対応します。現場写真報告も可能です。",
          attachments: [{ name: "安全書類サンプル.pdf", type: "pdf" }, { name: "実績写真_01.jpg", type: "image" }],
        },
      ],
    };

    saveMvpState(state);
    return state;
  }

  function mvp() {
    const state = seedMvpStateIfEmpty();
    const api = {
      state,
      reload() {
        let loaded = loadMvpState() || state;
        loaded = ensureTalkBuilderDemoInState(loaded);
        if (global.TasuBuilderBoardAdapter?.ensureFeedListings) {
          return global.TasuBuilderBoardAdapter.ensureFeedListings(loaded);
        }
        return window.TasuBuilderBoardFeed?.ensureBoardFeedListings?.(loaded) || loaded;
      },
      commit(next, meta) {
        saveMvpState(next);
        document.dispatchEvent(
          new CustomEvent("builder:mvp-changed", { detail: { state: next, ...(meta || {}) } })
        );
      },
      pushNotification(payload = {}) {
        addMvpNotification(payload);
      },
      reset() {
        try {
          localStorage.removeItem(MVP_STORAGE_KEY);
          localStorage.removeItem(MVP_THREADS_STORAGE_KEY);
        } catch {
          // ignore
        }
        seedMvpStateIfEmpty();
        document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
      },
    };
    return api;
  }

  const DEMO_STATS_USER = {
    inProgress: "12件",
    applications: "8件",
    unreadThreads: "3件",
    reRequestCandidates: "5件",
  };

  const DEMO_STATS_ADMIN = {
    companies: "18社",
    registeredPartners: "86社",
    unreadThreads: "9件",
    pendingReview: "5件",
  };

  const RECENT_ICON_SVG = {
    site:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" aria-hidden="true"><path d="M3 21h18"/><path d="M7 21V7l8-4v18"/><path d="M17 21V11l-6-4"/></svg>',
    plan:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>',
    review:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    alert:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>',
  };

  const DEMO_RECENT_PROJECTS = [
    {
      title: "新宿区 共同住宅 外装改修",
      message: "足場設置の段取り確認。協力会社の手配状況を更新。",
      statusText: "募集中",
      statusMod: "open",
      icon: "site",
      iconMod: "site",
      datetime: "2026/06/02 09:10",
      period_range: "2026年6月1日～6月30日",
    },
    {
      title: "横浜市 店舗内装 工程調整",
      message: "工程表のドラフトを共有。資材搬入ルートの確認待ち。",
      statusText: "下書き",
      statusMod: "draft",
      icon: "plan",
      iconMod: "plan",
      datetime: "2026/06/01 18:40",
      period_range: "2026年6月1日～6月30日",
    },
    {
      title: "千葉市 倉庫新築 見積審査",
      message: "見積書の再提出あり。差分の確認と承認が必要です。",
      statusText: "審査待ち",
      statusMod: "review",
      icon: "review",
      iconMod: "review",
      datetime: "2026/06/01 11:05",
      period_range: "2026年6月1日～6月30日",
    },
    {
      title: "港区 オフィス改装 安全確認",
      message: "KYミーティングの記録が未提出。現場責任者へ確認。",
      statusText: "要対応",
      statusMod: "urgent",
      icon: "alert",
      iconMod: "alert",
      datetime: "2026/05/31 16:20",
      period_range: "2026年6月1日～6月30日",
    },
  ];

  const DEMO_ADMIN_RECENT_PROJECTS = [
    {
      title: "港区 オフィス改装 手配待ち",
      message: "応募2件。パートナー手配とスレッド初回返信が必要です。",
      statusText: "未手配",
      statusMod: "urgent",
      icon: "alert",
      iconMod: "alert",
      datetime: "2026/06/02 10:30",
      period_range: "2026年6月5日～6月25日",
    },
    {
      title: "横浜市 店舗内装 審査中",
      message: "協力会社の書類審査待ち。未審査1件があります。",
      statusText: "審査待ち",
      statusMod: "review",
      icon: "review",
      iconMod: "review",
      datetime: "2026/06/01 15:20",
      period_range: "2026年6月1日～6月30日",
    },
    {
      title: "千葉市 倉庫新築 手配済",
      message: "オレンジ建装を手配済み。入場確認をスレッドでフォロー。",
      statusText: "手配中",
      statusMod: "applied",
      icon: "site",
      iconMod: "site",
      datetime: "2026/05/31 09:45",
      period_range: "2026年6月1日～7月15日",
    },
    {
      title: "新宿区 共同住宅 通知送信",
      message: "工期変更の運営通知を配信済み。未読スレッドを確認。",
      statusText: "対応中",
      statusMod: "open",
      icon: "plan",
      iconMod: "plan",
      datetime: "2026/05/30 17:10",
      period_range: "2026年6月1日～6月30日",
    },
  ];

  /** Phase2 demo data (UI only) */
  const DEMO_PARTNERS = [
    {
      partner_id: "demo-partner-001",
      display_name: "株式会社オレンジ建装",
      site_contact_name: "田中建一",
      partner_type: "company",
      trades: ["interior", "carpenter"],
      areas: ["tokyo", "kanagawa"],
      headline: "店舗内装・原状回復をスピード対応",
      profile:
        "夜間対応可。現場調整〜職人手配までワンストップ。短工期の案件が得意です。",
      contact_policy: "tasful_talk_only",
      availability: "available",
      status: "active",
      rating: 4.8,
      track_record: 32,
      updated_at: "2026-06-01T10:00:00+09:00",
    },
    {
      partner_id: "demo-partner-002",
      display_name: "足場ワークス（個人）",
      partner_type: "individual",
      trades: ["scaffold"],
      areas: ["tokyo", "saitama", "chiba"],
      headline: "安全第一。小規模〜中規模の足場に対応",
      profile: "資格保有。戸建て・低層の足場組立に強み。",
      contact_policy: "tasful_talk_only",
      availability: "limited",
      status: "active",
      rating: 4.6,
      track_record: 18,
      updated_at: "2026-05-28T16:00:00+09:00",
    },
    {
      partner_id: "demo-partner-003",
      display_name: "株式会社スレート設備",
      partner_type: "company",
      trades: ["plumbing", "electric"],
      areas: ["kanagawa", "chiba"],
      headline: "設備・電気のまとめ依頼歓迎",
      profile: "現場代理人対応可。写真報告と検査対応まで一式。",
      contact_policy: "admin_only",
      availability: "busy",
      status: "paused",
      updated_at: "2026-05-20T09:00:00+09:00",
    },
  ];

  try {
    globalThis.__BUILDER_DEMO_PARTNER_NAMES__ = DEMO_PARTNERS;
  } catch {
    // ignore
  }

  const DEMO_FAVORITES = new Set(["demo-partner-001", "demo-partner-002"]);

  function builderPartnerPerfBlock(partnerId, partnerName) {
    const E = globalThis.TasuBuilderPartnerEval;
    if (!E?.formatScoreSummary) return "";
    return E.formatScoreSummary(partnerId, partnerName).html;
  }

  const DEMO_TEMPLATES = [
    {
      template_id: "demo-template-001",
      owner_id: OWNER_ID,
      name: "店舗内装（標準）",
      visibility: "private",
      default_kind: "builder_board",
      default_visibility: "partner_only",
      default_contact_policy: "tasful_talk_only",
      spec_snapshot: {
        trade_tags: ["interior", "carpenter"],
        area_codes: ["tokyo"],
        description:
          "店舗内装の軽微工事。夜間搬入あり。安全書類はTASFUL Talkで案内。",
      },
      created_at: "2026-05-10T12:00:00+09:00",
      updated_at: "2026-05-30T09:00:00+09:00",
    },
    {
      template_id: "demo-template-002",
      owner_id: OWNER_ID,
      name: "足場（低層）",
      visibility: "team_only",
      default_kind: "tasful_managed",
      default_visibility: "team_only",
      default_contact_policy: "admin_only",
      spec_snapshot: {
        trade_tags: ["scaffold"],
        area_codes: ["tokyo", "chiba"],
        description: "戸建て〜低層。近隣対策を重視。養生込み。",
      },
      created_at: "2026-05-12T12:00:00+09:00",
      updated_at: "2026-05-29T17:00:00+09:00",
    },
  ];

  const TALK_BUILDER_DEMO_PROJECT_ID = "builder_demo_001";
  const TALK_BUILDER_DEMO_THREAD_ID = "builder_thread_demo_001";

  const DEMO_PROJECTS = [
    {
      project_id: TALK_BUILDER_DEMO_PROJECT_ID,
      owner_id: OWNER_ID,
      title: "店舗内装リニューアル（Builder）",
      kind: "builder_board",
      status: "open",
      required_partners: 1,
      selected_partner_ids: [],
      calendar_assigned_partner_id: "demo-partner-001",
      assignment_status: "pending",
      visibility: "partner_only",
      contact_policy: "tasful_talk_only",
      main_thread_id: null,
      board_type: "calendar",
      projectKind: "calendar",
      assignment_status: "pending",
      source: "tasful_talk_notify",
      talk_deal_id: TALK_BUILDER_DEMO_PROJECT_ID,
      created_at: "2026-06-06T00:00:00+09:00",
    },
    {
      project_id: "demo-project-001",
      owner_id: OWNER_ID,
      title: "新宿区 共同住宅 外装改修",
      kind: "builder_board",
      status: "open",
      required_partners: 1,
      selected_partner_ids: [],
      visibility: "partner_only",
      contact_policy: "tasful_talk_only",
      main_thread_id: "thread-demo-001",
      source: "company",
      source_template_id: "demo-template-002",
      created_at: "2026-05-25T10:10:00+09:00",
    },
  ];

  const DEMO_PROJECT_SPECS = {
    [TALK_BUILDER_DEMO_PROJECT_ID]: {
      trade_tags: ["interior"],
      area: { label: "東京都渋谷区" },
      site_address: "東京都渋谷区道玄坂1-2-3",
      site_access: "B1F 搬入口から入場",
      notes: "Helmet必須・9:00前入場不可",
      period: { start: "2026-06-10", end: "2026-06-28" },
      reward: "¥980,000",
      builder_summary: "店舗内装リニューアル一式（設計・施工・仕上げ）",
      schedule_summary: "着工 6/10 → 中間検査 6/20 → 完工 6/28",
    },
    "demo-project-001": {
      trade_tags: ["scaffold"],
      area_codes: ["tokyo"],
      area: { label: "東京都新宿区" },
      site_address: "東京都新宿区（詳細はTalkで共有）",
      period: { start: "2026-06-10", end: "2026-06-30" },
      budget: { min: 600000, max: 900000 },
      description:
        "共同住宅の外装改修に伴う足場。現場条件はTASFUL Talkで共有。",
      overview:
        "築15年の共同住宅（5階建）の外装改修工事に伴う足場工事です。オーナー様・管理会社との調整済み。近隣配慮と安全書類の提出が必須です。",
      work_content:
        "仮設足場の設計・施工・解体まで一括対応。\n\n【作業範囲】\n・足場架設（5階建外周）\n・養生シート・垂直ネット設置\n・通路確保と仮囲い設置\n・工事完了後の解体・清掃\n\n工程は6月中旬着手〜6月末完了予定。天候・近隣調整により前後する場合があります。",
      preferred_conditions:
        "足場施工1級または同等の実績。近隣対策・安全書類提出が可能な協力会社。TASFUL Talkでの連絡を基本とします。",
      notes:
        "現場詳細・図面はスレッド内で共有します。直接連絡先の交換は連絡ポリシーに従ってください。",
      attachments: [
        { name: "平面図.pdf", type: "pdf" },
        { name: "立面図.pdf", type: "pdf" },
        {
          name: "現場写真_01.jpg",
          type: "image",
          url: "https://placehold.co/480x320/1a1429/00f2fe?text=Site+Photo",
        },
      ],
    },
  };

  const DEMO_PROJECT_LINKS = {
    "demo-project-001": [
      {
        partner_id: "demo-partner-002",
        role: "invited",
        state: "pending",
        message_thread_id: "thread-demo-002",
        created_at: "2026-05-26T10:00:00+09:00",
      },
      {
        partner_id: "demo-partner-001",
        role: "applied",
        state: "accepted",
        message_thread_id: "thread-demo-003",
        created_at: "2026-05-27T11:30:00+09:00",
      },
    ],
  };

  function getPage() {
    return document.body?.dataset?.page || "";
  }

  function getBuilderAdminDashboardHref() {
    try {
      const p = String(window.location.pathname || "");
      if (p.includes("/builder-admin/")) return "admin-index.html";
    } catch {
      // ignore
    }
    return "../builder-admin/admin-index.html";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setText(sel, text) {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  }

  function getParam(name) {
    try {
      const u = new URL(window.location.href);
      return u.searchParams.get(name) || "";
    } catch {
      return "";
    }
  }

  function getProjectIdParam() {
    return getParam("id") || getParam("project_id") || "";
  }

  function getProjectSpec(state, projectId) {
    const raw = state?.specs?.[projectId] || DEMO_PROJECT_SPECS[projectId] || {};
    const areaLabel =
      raw.area?.label ||
      (raw.area_codes || []).map(formatArea).join("・") ||
      (raw.site_address ? String(raw.site_address).replace(/（.*$/, "") : "") ||
      "—";
    const trades = (raw.trade_tags || []).map(formatTrade);
    return {
      ...raw,
      areaLabel,
      trades,
      overview: raw.overview || raw.description || "—",
      work_content: raw.work_content || raw.description || "—",
      preferred_conditions:
        raw.preferred_conditions ||
        "安全書類・保険加入済み。近隣対策と養生を重視。",
      notes: raw.notes || raw.cautions || "現場詳細・図面はスレッド（Talk）で共有します。",
      attachments:
        raw.attachments ||
        [
          { name: "平面図.pdf", type: "pdf" },
          { name: "立面図.pdf", type: "pdf" },
          {
            name: "現場写真_01.jpg",
            type: "image",
            url: "https://placehold.co/480x320/1a1429/00f2fe?text=Site+Photo",
          },
        ],
    };
  }

  function toDetailStatusLabel({ project, spec, state, status }) {
    if (status === "completed" || status === "invoiced") return "完了";
    if (status === "in_progress" || status === "exited" || status === "selected") return "手配中";
    if (isUrgentProject({ project, spec, state, status })) return "締切間近";
    return toStatusLabel(status);
  }

  function detailStatusMod(status, urgent) {
    if (status === "completed" || status === "invoiced") return "muted";
    if (status === "in_progress" || status === "selected") return "applied";
    if (urgent) return "urgent";
    if (status === "open" || status === "applied") return "open";
    return "muted";
  }

  function detailStatusPillMod(statusLabel) {
    if (statusLabel === "完了") return "muted";
    if (statusLabel === "手配中") return "selected";
    if (statusLabel === "応募あり") return "applied";
    if (statusLabel === "募集中") return "open";
    if (statusLabel === "締切間近") return "urgent";
    return "muted";
  }

  function partnerRating(partner) {
    const n = Number(partner?.rating);
    return Number.isFinite(n) ? n.toFixed(1) : "4.5";
  }

  function partnerTrackRecord(partner) {
    const n = Number(partner?.track_record ?? partner?.completed_projects);
    return Number.isFinite(n) ? n : 0;
  }

  function buildMvpPdStat(label, value) {
    return (
      `<div class="mvp-pd-stat">` +
      `<dt class="mvp-pd-stat__label">${esc(label)}</dt>` +
      `<dd class="mvp-pd-stat__value">${esc(value)}</dd>` +
      `</div>`
    );
  }

  function formatTrade(t) {
    const map = {
      carpenter: "大工",
      scaffold: "足場",
      interior: "内装",
      electric: "電気",
      plumbing: "設備",
    };
    return map[t] || t;
  }

  function ensureMvpProjectTemplatesStorage() {
    try {
      const raw = localStorage.getItem(MVP_PROJECT_TEMPLATES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return;
      }
      localStorage.setItem(MVP_PROJECT_TEMPLATES_KEY, JSON.stringify([]));
    } catch {
      // ignore
    }
  }

  function getMvpProjectTemplates() {
    ensureMvpProjectTemplatesStorage();
    try {
      const raw = localStorage.getItem(MVP_PROJECT_TEMPLATES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveMvpProjectTemplates(templates) {
    ensureMvpProjectTemplatesStorage();
    const list = Array.isArray(templates) ? templates : [];
    try {
      localStorage.setItem(MVP_PROJECT_TEMPLATES_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  function mvpProjectTemplateId() {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `tpl_${ymd}_${Math.random().toString(16).slice(2, 5)}`;
  }

  function formatBudgetRangeText(budget) {
    if (typeof budget === "string" && budget.trim()) return budget.trim();
    if (!budget || typeof budget !== "object") return "—";
    const min = Number(budget.min);
    const max = Number(budget.max);
    const hasMin = Number.isFinite(min) && min > 0;
    const hasMax = Number.isFinite(max) && max > 0;
    if (hasMin && hasMax && min !== max) return `${formatJPYUnits(min)}〜${formatJPYUnits(max)}`;
    if (hasMin) return formatJPYUnits(min);
    if (hasMax) return formatJPYUnits(max);
    return "—";
  }

  function createMvpProjectTemplateFromProject(projectId) {
    const pid = String(projectId || "").trim();
    if (!pid) return null;
    const state = mvp().reload();
    const project =
      (state.projects || []).find((p) => p.project_id === pid) ||
      DEMO_PROJECTS.find((p) => p.project_id === pid);
    if (!project) return null;

    const spec = getProjectSpec(state, pid);
    const raw = state?.specs?.[pid] || DEMO_PROJECT_SPECS[pid] || {};
    const projectTitle = String(project.title || project.name || "案件").trim();
    const trades = (spec.trades || []).filter(Boolean);
    const category =
      project.category ||
      spec.category ||
      raw.category ||
      (trades.length ? trades.join("・") : "") ||
      (raw.trade_tags || []).map(formatTrade).filter(Boolean).join("・") ||
      "—";
    const area =
      project.area ||
      project.location ||
      spec.areaLabel ||
      raw.area?.label ||
      project.site_address ||
      "—";
    const budgetValue = project.budget ?? spec.budget ?? raw.budget;
    const budget = formatBudgetRangeText(showcaseBudget(budgetValue, { area, title: projectTitle }));
    const period = spec.period || project.period || project.schedule || raw.period;
    const schedule =
      (typeof project.schedule === "string" && project.schedule) ||
      (typeof project.dueDate === "string" && project.dueDate) ||
      formatJapaneseDateRange(period) ||
      "—";
    const overview = spec.overview && spec.overview !== "—" ? spec.overview : "";
    const work = spec.work_content && spec.work_content !== "—" ? spec.work_content : "";
    const description =
      project.description ||
      project.detail ||
      [overview, work].filter(Boolean).join("\n\n") ||
      "—";
    const attachments = (spec.attachments || project.attachments || raw.attachments || [])
      .map((a) => ({
        name: String(a?.name || a?.file_name || "—"),
        type: String(a?.type || "file"),
      }))
      .filter((a) => a.name && a.name !== "—");
    const ts = nowIso();

    return {
      id: mvpProjectTemplateId(),
      title: `${projectTitle}テンプレ`,
      sourceProjectId: pid,
      projectTitle,
      category: String(category || "—"),
      area: String(area || "—"),
      budget,
      schedule: String(schedule || "—"),
      description: String(description || "—"),
      attachments,
      createdAt: ts,
      updatedAt: ts,
    };
  }

  let mvpTemplateToastTimer = null;

  function showMvpTemplateSavedToast(message) {
    let toast = document.querySelector("[data-builder-template-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "builder-template-toast";
      toast.setAttribute("data-builder-template-toast", "");
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message || "テンプレートを保存しました";
    toast.hidden = false;
    toast.classList.add("is-show");
    if (mvpTemplateToastTimer) clearTimeout(mvpTemplateToastTimer);
    mvpTemplateToastTimer = setTimeout(() => {
      toast.classList.remove("is-show");
      toast.hidden = true;
    }, 2800);
  }

  function renderMvpProjectTemplateSaveButton(projectId) {
    const btn = document.querySelector("[data-builder-mvp-pd-save-template]");
    if (!btn) return;
    const pid = String(projectId || getProjectIdParam() || "").trim();
    btn.disabled = !pid;
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const id = getProjectIdParam();
      if (!id) return;
      const tpl = createMvpProjectTemplateFromProject(id);
      if (!tpl) {
        alert("案件が見つかりません。");
        return;
      }
      saveMvpProjectTemplates([tpl, ...getMvpProjectTemplates()]);
      mvp().pushNotification({
        type: "template",
        label: "テンプレ保存",
        body: "案件内容をテンプレートとして保存しました。",
        project_id: id,
        href: `mvp-project-detail.html?id=${encodeURIComponent(id)}`,
      });
      showMvpTemplateSavedToast(`「${tpl.title}」を保存しました`);
    });
  }

  function getMvpTemplateById(templateId) {
    const id = String(templateId || "").trim();
    if (!id) return null;
    return getMvpProjectTemplates().find((t) => t.id === id) || null;
  }

  function deleteMvpProjectTemplate(templateId) {
    const id = String(templateId || "").trim();
    if (!id) return false;
    const prev = getMvpProjectTemplates();
    const next = prev.filter((t) => t.id !== id);
    if (next.length === prev.length) return false;
    saveMvpProjectTemplates(next);
    return true;
  }

  function useMvpProjectTemplate(templateId) {
    const id = String(templateId || "").trim();
    if (!id) return;
    window.location.href = `mvp-post.html?template_id=${encodeURIComponent(id)}`;
  }

  function formatMvpTemplateCreatedAt(iso) {
    try {
      const d = new Date(String(iso || ""));
      if (Number.isNaN(d.getTime())) return "—";
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${y}/${mo}/${da} ${h}:${mi}`;
    } catch {
      return "—";
    }
  }

  function parseMvpTemplateSchedule(schedule) {
    const s = String(schedule || "").trim();
    if (!s || s === "—") return { start: "", end: "" };
    const iso = s.match(/(\d{4}-\d{2}-\d{2})\s*[〜～\-–—]\s*(\d{4}-\d{2}-\d{2})/);
    if (iso) return { start: iso[1], end: iso[2] };
    const jp = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日[～〜\-–—](?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
    if (jp) {
      const y1 = jp[1];
      const m1 = String(jp[2]).padStart(2, "0");
      const d1 = String(jp[3]).padStart(2, "0");
      const y2 = jp[4] || y1;
      const m2 = String(jp[5]).padStart(2, "0");
      const d2 = String(jp[6]).padStart(2, "0");
      return { start: `${y1}-${m1}-${d1}`, end: `${y2}-${m2}-${d2}` };
    }
    return { start: "", end: "" };
  }

  function splitMvpTemplateCategory(category) {
    const raw = String(category || "").trim();
    if (!raw || raw === "—") return [];
    return raw
      .split(/[・,、/]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function applyMvpTemplateToPostForm(templateId) {
    const tpl = getMvpTemplateById(templateId);
    if (!tpl) return null;
    const form = document.querySelector("[data-builder-mvp-project-form]");
    if (!form) return null;

    const titleEl = form.querySelector("[data-builder-mvp-project-title]");
    const startEl = form.querySelector("[data-builder-mvp-project-start]");
    const endEl = form.querySelector("[data-builder-mvp-project-end]");
    const tradesEl = form.querySelector("[data-builder-mvp-project-trades]");
    const areasEl = form.querySelector("[data-builder-mvp-project-areas]");
    const descEl = form.querySelector("[data-builder-mvp-project-desc]");

    const postTitle = String(tpl.projectTitle || tpl.title || "")
      .replace(/テンプレ$/, "")
      .trim();
    if (titleEl) titleEl.value = postTitle || String(tpl.title || "").trim();

    const trades = splitMvpTemplateCategory(tpl.category);
    if (tradesEl && trades.length) tradesEl.value = trades.join(", ");

    const area = String(tpl.area || "").trim();
    if (areasEl && area && area !== "—") areasEl.value = area;

    const desc = String(tpl.description || "").trim();
    if (descEl && desc && desc !== "—") descEl.value = desc;

    const period = parseMvpTemplateSchedule(tpl.schedule);
    if (startEl && period.start) startEl.value = period.start;
    if (endEl && period.end) endEl.value = period.end;

    form.dataset.sourceTemplateId = tpl.id;
    form.dataset.sourceTemplateBudget = String(tpl.budget || "").trim();
    form.dataset.sourceTemplateSchedule = String(tpl.schedule || "").trim();

    return tpl;
  }

  function renderMvpPostTemplateNotice(template) {
    const host = document.querySelector("[data-builder-mvp-post-template-notice]");
    if (!host) return;
    if (!template) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }

    const budget = String(template.budget || "—").trim() || "—";
    const schedule = String(template.schedule || "—").trim() || "—";
    const attachments = Array.isArray(template.attachments) ? template.attachments : [];
    const attachHtml = attachments.length
      ? `<ul class="builder-post-template-attachments">${attachments
          .map(
            (a) =>
              `<li class="builder-post-template-attachments__item">${esc(String(a?.name || "—"))}</li>`
          )
          .join("")}</ul>`
      : `<p class="builder-post-template-notice__empty">添付資料なし</p>`;

    host.hidden = false;
    host.innerHTML =
      `<div class="builder-post-template-notice__head">` +
      `<p class="builder-post-template-notice__title">テンプレートから入力を反映しました</p>` +
      `<p class="builder-post-template-notice__sub">「${esc(template.title || "—")}」をもとにフォームへ反映済みです。内容は自由に編集できます。</p>` +
      `</div>` +
      `<dl class="builder-template-meta builder-template-meta--notice">` +
      `<div class="builder-template-meta__row"><dt>元案件名</dt><dd>${esc(template.projectTitle || "—")}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>予算</dt><dd>${esc(budget)}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>工期/希望日程</dt><dd>${esc(schedule)}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>元テンプレ添付</dt><dd>${attachHtml}</dd></div>` +
      `</dl>`;
  }

  function buildMvpTemplateCard(tpl) {
    const attachments = Array.isArray(tpl.attachments) ? tpl.attachments : [];
    return (
      `<article class="builder-template-card" data-builder-mvp-template-card data-template-id="${esc(tpl.id)}">` +
      `<div class="builder-template-card__head">` +
      `<h3 class="builder-template-card__title">${esc(tpl.title || "—")}</h3>` +
      `<p class="builder-template-card__sub">元案件: ${esc(tpl.projectTitle || "—")}</p>` +
      `</div>` +
      `<dl class="builder-template-meta">` +
      `<div class="builder-template-meta__row"><dt>カテゴリ</dt><dd>${esc(tpl.category || "—")}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>エリア</dt><dd>${esc(tpl.area || "—")}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>予算</dt><dd>${esc(tpl.budget || "—")}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>工期</dt><dd>${esc(tpl.schedule || "—")}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>添付数</dt><dd>${attachments.length} 件</dd></div>` +
      `<div class="builder-template-meta__row"><dt>作成日時</dt><dd>${esc(formatMvpTemplateCreatedAt(tpl.createdAt))}</dd></div>` +
      `</dl>` +
      `<div class="builder-template-actions">` +
      `<button type="button" class="builder-btn builder-btn--primary" data-builder-mvp-template-use="${esc(tpl.id)}">このテンプレを使う</button>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-mvp-template-delete="${esc(tpl.id)}">削除</button>` +
      `</div>` +
      `</article>`
    );
  }

  function renderMvpTemplatesPage() {
    const list = document.querySelector("[data-builder-mvp-template-list]");
    const countEl = document.querySelector("[data-builder-mvp-template-count]");
    if (!list || !countEl) return;

    const render = () => {
      const templates = getMvpProjectTemplates();
      countEl.textContent = `${templates.length} 件`;
      if (!templates.length) {
        list.innerHTML =
          `<div class="builder-template-empty">` +
          `<p class="builder-template-empty__title">保存済みテンプレがありません</p>` +
          `<p class="builder-template-empty__sub">案件詳細ページの「テンプレとして保存」からテンプレートを作成できます。</p>` +
          `<a class="builder-btn builder-btn--secondary" href="mvp-projects.html">案件一覧へ</a>` +
          `</div>`;
        return;
      }
      list.innerHTML = templates.map((tpl) => buildMvpTemplateCard(tpl)).join("");
    };

    render();
    if (list.dataset.bound === "1") return;
    list.dataset.bound = "1";
    list.addEventListener("click", (ev) => {
      const useBtn = ev.target?.closest?.("[data-builder-mvp-template-use]");
      if (useBtn) {
        useMvpProjectTemplate(useBtn.getAttribute("data-builder-mvp-template-use") || "");
        return;
      }
      const delBtn = ev.target?.closest?.("[data-builder-mvp-template-delete]");
      if (!delBtn) return;
      const id = delBtn.getAttribute("data-builder-mvp-template-delete") || "";
      const tpl = getMvpTemplateById(id);
      const name = tpl?.title || id || "このテンプレ";
      if (!confirm(`「${name}」を削除しますか？`)) return;
      if (deleteMvpProjectTemplate(id)) render();
    });
  }

  function notifyMvpTemplateUseOnce(template) {
    if (!template?.id) return;
    const key = `tasful:builder:mvp:templateUseNotif:${template.id}`;
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      // ignore
    }
    mvp().pushNotification({
      type: "template",
      label: "テンプレ使用",
      project_id: "",
      projectTitle: template.title || template.projectTitle || "案件テンプレ",
      body: "保存済みテンプレートから案件作成を開始しました。",
      href: `mvp-post.html?template_id=${encodeURIComponent(template.id)}`,
    });
  }

  function ensureMvpReRequestsStorage() {
    try {
      const raw = localStorage.getItem(MVP_RE_REQUESTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return;
      }
      localStorage.setItem(MVP_RE_REQUESTS_KEY, JSON.stringify([]));
    } catch {
      // ignore
    }
  }

  function getMvpReRequests() {
    ensureMvpReRequestsStorage();
    try {
      const raw = localStorage.getItem(MVP_RE_REQUESTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveMvpReRequests(list) {
    ensureMvpReRequestsStorage();
    const rows = Array.isArray(list) ? list : [];
    try {
      localStorage.setItem(MVP_RE_REQUESTS_KEY, JSON.stringify(rows));
    } catch {
      // ignore
    }
  }

  function mvpReRequestId() {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `re-request-${ymd}-${Math.random().toString(16).slice(2, 5)}`;
  }

  function createMvpReRequestFromProject(projectId, options = {}) {
    const base = createMvpProjectTemplateFromProject(projectId);
    if (!base) return null;
    const noteText = String(options.note || "").trim();
    let description = String(base.description || "").trim();
    if (noteText) {
      description = description && description !== "—" ? `${noteText}\n\n${description}` : noteText;
    }
    if (!description || description === "—") description = "前回と同内容で依頼";

    return {
      id: mvpReRequestId(),
      sourceProjectId: base.sourceProjectId,
      projectTitle: base.projectTitle,
      category: base.category,
      area: base.area,
      budget: base.budget,
      schedule: base.schedule,
      description,
      attachments: base.attachments,
      draftPayload: {
        target_kind: options.targetKind || "builder_board",
        visibility: options.visibility || "partner_only",
        contact_policy: options.contactPolicy || "tasful_talk_only",
        note: noteText,
      },
      createdAt: nowIso(),
    };
  }

  function saveMvpReRequest(record) {
    if (!record?.id) return false;
    const list = getMvpReRequests();
    const idx = list.findIndex((r) => r.id === record.id);
    if (idx >= 0) list[idx] = record;
    else list.unshift(record);
    saveMvpReRequests(list);
    return true;
  }

  function getMvpReRequestById(reRequestId) {
    const id = String(reRequestId || "").trim();
    if (!id) return null;
    return getMvpReRequests().find((r) => r.id === id) || null;
  }

  function useMvpReRequest(reRequestId) {
    const id = String(reRequestId || "").trim();
    if (!id) return;
    window.location.href = `mvp-post.html?re_request_id=${encodeURIComponent(id)}`;
  }

  function applyMvpReRequestToPostForm(reRequestId) {
    const rr = getMvpReRequestById(reRequestId);
    if (!rr) return null;
    const form = document.querySelector("[data-builder-mvp-project-form]");
    if (!form) return null;

    const titleEl = form.querySelector("[data-builder-mvp-project-title]");
    const kindEl = form.querySelector("[data-builder-mvp-project-kind]");
    const visEl = form.querySelector("[data-builder-mvp-project-visibility]");
    const cpEl = form.querySelector("[data-builder-mvp-project-contact-policy]");
    const startEl = form.querySelector("[data-builder-mvp-project-start]");
    const endEl = form.querySelector("[data-builder-mvp-project-end]");
    const tradesEl = form.querySelector("[data-builder-mvp-project-trades]");
    const areasEl = form.querySelector("[data-builder-mvp-project-areas]");
    const descEl = form.querySelector("[data-builder-mvp-project-desc]");

    if (titleEl) titleEl.value = String(rr.projectTitle || "").trim() || "無題案件";

    const trades = splitMvpTemplateCategory(rr.category);
    if (tradesEl && trades.length) tradesEl.value = trades.join(", ");

    const area = String(rr.area || "").trim();
    if (areasEl && area && area !== "—") areasEl.value = area;

    const desc = String(rr.description || "").trim();
    if (descEl && desc && desc !== "—") descEl.value = desc;

    const period = parseMvpTemplateSchedule(rr.schedule);
    if (startEl && period.start) startEl.value = period.start;
    if (endEl && period.end) endEl.value = period.end;

    const draft = rr.draftPayload || {};
    if (kindEl && draft.target_kind) kindEl.value = draft.target_kind;
    if (visEl && draft.visibility) visEl.value = draft.visibility;
    if (cpEl && draft.contact_policy) cpEl.value = draft.contact_policy;

    form.dataset.sourceProjectId = String(rr.sourceProjectId || "");
    form.dataset.sourceReRequestId = rr.id;
    form.dataset.sourceReRequestBudget = String(rr.budget || "").trim();
    form.dataset.sourceReRequestSchedule = String(rr.schedule || "").trim();

    return rr;
  }

  function renderMvpReRequestNotice(reRequest) {
    const host = document.querySelector("[data-builder-mvp-post-rerequest-notice]");
    if (!host) return;
    if (!reRequest) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }

    const budget = String(reRequest.budget || "—").trim() || "—";
    const schedule = String(reRequest.schedule || "—").trim() || "—";
    const attachments = Array.isArray(reRequest.attachments) ? reRequest.attachments : [];
    const attachHtml = attachments.length
      ? `<ul class="builder-post-template-attachments">${attachments
          .map(
            (a) =>
              `<li class="builder-post-template-attachments__item">${esc(String(a?.name || "—"))}</li>`
          )
          .join("")}</ul>`
      : `<p class="builder-post-template-notice__empty">添付資料なし</p>`;

    host.hidden = false;
    host.innerHTML =
      `<div class="builder-post-rerequest-notice__head">` +
      `<p class="builder-post-rerequest-notice__title">再依頼案件から内容を引き継いでいます</p>` +
      `<p class="builder-post-rerequest-notice__sub">元案件の内容をフォームへ反映済みです。必要に応じて編集してください。</p>` +
      `</div>` +
      `<dl class="builder-template-meta builder-template-meta--notice">` +
      `<div class="builder-template-meta__row"><dt>元案件</dt><dd>${esc(reRequest.projectTitle || "—")}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>元案件ID</dt><dd>${esc(reRequest.sourceProjectId || "—")}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>予算</dt><dd>${esc(budget)}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>工期</dt><dd>${esc(schedule)}</dd></div>` +
      `<div class="builder-template-meta__row"><dt>前回案件添付</dt><dd>${attachHtml}</dd></div>` +
      `</dl>`;
  }

  function buildMvpReRequestSummaryHtml(data) {
    if (!data) {
      return (
        `<div class="builder-rerequest-summary builder-rerequest-summary--empty">` +
        `<p class="builder-rerequest-summary__empty">元案件が指定されていません。</p>` +
        `<a class="builder-btn builder-btn--secondary" href="mvp-projects.html">案件一覧へ</a>` +
        `</div>`
      );
    }
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    return (
      `<div class="builder-rerequest-summary">` +
      `<h3 class="builder-rerequest-summary__title">元案件サマリー</h3>` +
      `<dl class="builder-rerequest-summary-grid">` +
      `<div class="builder-rerequest-summary-grid__row"><dt>元案件名</dt><dd>${esc(data.projectTitle || "—")}</dd></div>` +
      `<div class="builder-rerequest-summary-grid__row"><dt>カテゴリ</dt><dd>${esc(data.category || "—")}</dd></div>` +
      `<div class="builder-rerequest-summary-grid__row"><dt>エリア</dt><dd>${esc(data.area || "—")}</dd></div>` +
      `<div class="builder-rerequest-summary-grid__row"><dt>予算</dt><dd>${esc(data.budget || "—")}</dd></div>` +
      `<div class="builder-rerequest-summary-grid__row"><dt>工期</dt><dd>${esc(data.schedule || "—")}</dd></div>` +
      `<div class="builder-rerequest-summary-grid__row"><dt>添付数</dt><dd>${attachments.length} 件</dd></div>` +
      `</dl>` +
      `</div>`
    );
  }

  function notifyMvpReRequestUseOnce(reRequest) {
    if (!reRequest?.id) return;
    const key = `tasful:builder:mvp:reRequestUseNotif:${reRequest.id}`;
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      // ignore
    }
    mvp().pushNotification({
      type: "re_request",
      label: "再依頼開始",
      project_id: reRequest.sourceProjectId || "",
      projectTitle: reRequest.projectTitle || "再依頼案件",
      body: "再依頼案件から新規案件作成を開始しました。",
      href: `mvp-post.html?re_request_id=${encodeURIComponent(reRequest.id)}`,
    });
  }

  function formatArea(a) {
    const map = { tokyo: "東京", kanagawa: "神奈川", chiba: "千葉", saitama: "埼玉" };
    return map[a] || a;
  }

  const VISIBILITY_UI = {
    public: {
      label: "公開（全体）",
      desc: "広く表示される想定です（運用に応じて調整）。",
    },
    private: {
      label: "非公開（自分だけ）",
      desc: "自分（オーナー）のみ閲覧。下書きや検討中の管理向け。",
    },
    partner_only: {
      label: "パートナー限定",
      desc: "協力会社・職人などパートナー向けに表示。掲示板募集に適します。",
    },
    team_only: {
      label: "チーム限定",
      desc: "社内/チーム内のメンバーのみ閲覧。社内共有や下準備に適します。",
    },
  };

  const CONTACT_POLICY_UI = {
    tasful_talk_only: {
      label: "TASFUL Talkのみ（推奨）",
      desc: "連絡先交換はせず、TASFUL Talk上でやり取りします。",
      danger:
        "この案件はTASFUL Talkのみでやり取りします。電話/LINE/メールなどの連絡先交換はできません。",
    },
    owner_allowed: {
      label: "オーナー判断で共有可",
      desc: "必要に応じて、オーナー判断で連絡先共有を許可する想定です。",
    },
    admin_only: {
      label: "管理者のみ共有可",
      desc: "連絡先の共有は管理者のみ許可（監督/運営チェック向け）。",
    },
  };

  const SOURCE_UI = {
    tasful: {
      label: "TASFUL",
      badge: { tone: "tasful", text: "TASFUL管理案件" },
      desc: "TASFUL運営が管理する案件です。",
    },
    company: {
      label: "企業投稿",
      badge: { tone: "board", text: "掲示板案件（企業）" },
      desc: "企業が投稿した掲示板案件です。",
    },
    partner: {
      label: "協力会社投稿",
      badge: { tone: "board", text: "掲示板案件（パートナー）" },
      desc: "協力会社が投稿した掲示板案件です。",
    },
    public_user: {
      label: "一般投稿",
      badge: { tone: "board", text: "掲示板案件（一般）" },
      desc: "一般ユーザーが投稿した掲示板案件です。",
    },
  };

  function formatContactPolicy(p) {
    return CONTACT_POLICY_UI[p]?.label || "—";
  }

  function formatVisibility(v) {
    return VISIBILITY_UI[v]?.label || "—";
  }

  function formatSource(s) {
    return SOURCE_UI[s]?.label || "—";
  }

  function setHint(sel, text) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.textContent = text;
  }

  function renderPolicyHints({ visibility, contact_policy } = {}) {
    const v = VISIBILITY_UI[visibility];
    const c = CONTACT_POLICY_UI[contact_policy];
    setHint("[data-builder-visibility-hint]", v ? `${v.label}：${v.desc}` : "—");
    setHint("[data-builder-contact-policy-hint]", c ? `${c.label}：${c.desc}` : "—");
  }

  function buildBadgeHtml(badge) {
    if (!badge) return "";
    const tone = badge.tone === "tasful" ? "builder-badge--tasful" : "builder-badge--board";
    return `<span class="builder-badge ${tone}">${esc(badge.text)}</span>`;
  }

  function buildCalloutHtml({ title, text, tone = "warning" }) {
    const mod =
      tone === "danger" ? "builder-callout--danger" : tone === "warning" ? "builder-callout--warning" : "";
    return (
      `<div class="builder-callout ${mod}">` +
      `<p class="builder-callout__title">${esc(title)}</p>` +
      `<p class="builder-callout__text">${esc(text)}</p>` +
      `</div>`
    );
  }

  function renderStats() {
    const page = getPage();
    const stats = page === "builder-admin-dashboard" ? DEMO_STATS_ADMIN : DEMO_STATS_USER;
    Object.entries(stats).forEach(([key, val]) => {
      const el = document.querySelector(`[data-builder-stat-value="${key}"]`);
      if (el) el.textContent = val;
    });
    ensureMvpNotificationsDemoData();
    const unreadEl = document.querySelector('[data-builder-stat-value="unreadNotifications"]');
    if (unreadEl) unreadEl.textContent = `${getMvpUnreadNotificationCount()}件`;
  }

  function buildRecentCard(item) {
    const iconSvg = RECENT_ICON_SVG[item.icon] || RECENT_ICON_SVG.plan;
    const dt = esc(item.period_range || "2026年6月1日～6月30日");
    const statusText = esc(item.statusText || "—");
    const statusMod = esc(item.statusMod || "draft");
    const iconMod = esc(item.iconMod || "plan");
    const { areaText, nameText } = splitRecentTitle(String(item.title || ""));

    return (
      `<li data-builder-recent-item>` +
      `<a class="builder-recent-card" href="#" data-builder-recent-card>` +
      `<span class="builder-recent-card__icon builder-recent-card__icon--${iconMod}" aria-hidden="true">` +
      iconSvg +
      `</span>` +
      `<span class="builder-recent-card__content">` +
      `<span class="builder-recent-card__main">` +
      `<span class="builder-recent-card__area" data-builder-recent-area>${esc(areaText)}</span>` +
      `<span class="builder-recent-card__title" data-builder-recent-title>${esc(nameText)}</span>` +
      `</span>` +
      `<span class="builder-recent-card__aside">` +
      `<span class="builder-chip builder-chip--${statusMod}" data-builder-recent-status>${statusText}</span>` +
      `<span class="builder-datetime" data-builder-recent-datetime><time>${dt}</time></span>` +
      `</span>` +
      `</span>` +
      `<span class="builder-recent-card__chev" aria-hidden="true">›</span>` +
      `</a>` +
      `</li>`
    );
  }

  function splitRecentTitle(title) {
    const t = String(title || "").trim();
    const idx = t.indexOf(" ");
    if (idx <= 0) return { areaText: t || "—", nameText: t || "—" };
    const areaText = t.slice(0, idx).trim();
    const nameText = t.slice(idx + 1).trim() || t;
    return { areaText, nameText };
  }

  function renderRecentList() {
    const list = document.querySelector("[data-builder-recent-list]");
    if (!list) return;
    const page = getPage();
    const items = page === "builder-admin-dashboard" ? DEMO_ADMIN_RECENT_PROJECTS : DEMO_RECENT_PROJECTS;
    list.innerHTML = items.map(buildRecentCard).join("");
  }

  function wireMvpDashboardNotificationsStat() {
    document.addEventListener("builder:mvp-notifications-changed", () => {
      if (getPage() !== "builder-partner-dashboard") return;
      const unreadEl = document.querySelector('[data-builder-stat-value="unreadNotifications"]');
      if (unreadEl) unreadEl.textContent = `${getMvpUnreadNotificationCount()}件`;
    });
  }

  const PARTNER_CALENDAR_ACCENT = ["#00f2fe", "#22c55e", "#f97316", "#bd00ff", "#38bdf8"];

  const PARTNER_CALENDAR_EVENTS = [
    {
      id: "cal-001",
      partnerId: "demo-partner-001",
      threadId: "thread-demo-001",
      date: "2026-06-18",
      startTime: "09:00",
      endTime: "15:00",
      title: "□□商業施設 新築工事",
      address: "東京都新宿区西新宿2-8-1",
      building: "新宿スクエアビル",
      managerName: "佐藤 健一",
      managerRole: "運営",
      managerPhone: "090-1234-5678",
      workItems: ["内装下地工事", "ボード張り"],
      notes: ["安全帯、ヘルメット必須", "8:45 現場集合"],
      attachments: [
        { name: "指示書_0618.pdf", type: "PDF" },
        { name: "平面図_商業施設.pdf", type: "PDF" },
        { name: "現場写真_0617.jpg", type: "JPG" },
      ],
      mapUrl:
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("東京都新宿区西新宿2-8-1 新宿スクエアビル"),
      status: "confirmed",
      fieldStatus: "working",
      reward: 450000,
      accent: 0,
    },
    {
      id: "cal-002",
      partnerId: "demo-partner-001",
      date: "2026-06-10",
      startTime: "10:00",
      endTime: "16:00",
      title: "○○マンション 外壁補修",
      address: "東京都世田谷区桜丘3-12-5",
      building: "桜丘ハイツ",
      managerName: "田中 美咲",
      managerRole: "運営",
      managerPhone: "080-9876-5432",
      workItems: ["足場養生確認", "シーリング打替え"],
      notes: ["保険証提示", "9:45 現場集合"],
      attachments: [{ name: "作業指示書_0610.pdf", type: "PDF" }],
      mapUrl:
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("東京都世田谷区桜丘3-12-5"),
      status: "confirmed",
      fieldStatus: "preparing",
      reward: 128000,
      accent: 1,
    },
    {
      id: "cal-003",
      partnerId: "demo-partner-001",
      date: "2026-06-12",
      startTime: "08:30",
      endTime: "12:00",
      title: "△△ビル 内装クリーニング",
      address: "神奈川県横浜市西区みなとみらい2-2-1",
      building: "クイーンズタワーB",
      managerName: "鈴木 一郎",
      managerRole: "運営",
      managerPhone: "070-1111-2222",
      workItems: ["共用部清掃", "養生撤去"],
      notes: ["作業着持参"],
      attachments: [],
      mapUrl:
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("神奈川県横浜市西区みなとみらい2-2-1"),
      status: "confirmed",
      fieldStatus: "traveling",
      reward: 68000,
      accent: 2,
    },
    {
      id: "cal-004",
      partnerId: "demo-partner-001",
      date: "2026-06-22",
      startTime: "13:00",
      endTime: "17:30",
      title: "□□物流倉庫 棚卸支援",
      address: "千葉県市川市二俣新町1-1",
      building: "市川ロジスティクスセンター",
      managerName: "高橋 誠",
      managerRole: "運営",
      managerPhone: "090-5555-6666",
      workItems: ["棚卸補助", "ラベル貼付"],
      notes: ["安全靴必須"],
      attachments: [{ name: "倉庫図面.pdf", type: "PDF" }],
      mapUrl:
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("千葉県市川市二俣新町1-1"),
      status: "pending",
      fieldStatus: "scheduled",
      reward: 92000,
      accent: 3,
    },
    {
      id: "cal-005",
      partnerId: "demo-partner-002",
      date: "2026-06-15",
      startTime: "09:00",
      endTime: "12:00",
      title: "他社担当デモ案件",
      address: "東京都港区",
      building: "",
      managerName: "デモ",
      managerRole: "運営",
      managerPhone: "000-0000-0000",
      workItems: ["表示確認用"],
      notes: [],
      attachments: [],
      mapUrl: "https://www.google.com/maps",
      status: "confirmed",
      fieldStatus: "done",
      reward: 10000,
      accent: 4,
    },
  ];

  const PARTNER_CAL_FIELD_STATUSES = {
    scheduled: { label: "予定", tone: "scheduled" },
    preparing: { label: "準備中", tone: "preparing" },
    traveling: { label: "移動中", tone: "traveling" },
    working: { label: "作業中", tone: "working" },
    done: { label: "完了", tone: "done" },
  };

  const partnerCalendarUi = {
    month: new Date(2026, 5, 1),
    mode: "month",
    selectedEventId: "cal-001",
    wired: false,
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function partnerCalDateKey(y, m, d) {
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  function parsePartnerCalDateKey(key) {
    const m = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function formatPartnerCalMonthLabel(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  }

  function formatPartnerCalWeekdayJa(date) {
    return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  }

  function formatPartnerCalDisplayDate(key) {
    const d = parsePartnerCalDateKey(key);
    if (!d) return key || "—";
    return `${d.getMonth() + 1}月${d.getDate()}日（${formatPartnerCalWeekdayJa(d)}）`;
  }

  function formatPartnerCalShortDate(key) {
    const d = parsePartnerCalDateKey(key);
    if (!d) return key || "—";
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function formatPartnerCalReward(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "—";
    return `¥${n.toLocaleString("ja-JP")}`;
  }

  function getPartnerCalendarEventsForMe() {
    const pid = getPartnerId();
    return PARTNER_CALENDAR_EVENTS.filter((ev) => String(ev.partnerId) === String(pid));
  }

  function getPartnerCalendarEventById(id) {
    return getPartnerCalendarEventsForMe().find((ev) => ev.id === id) || null;
  }

  function partnerCalStatusLabel(status) {
    if (status === "confirmed") return "確定";
    if (status === "pending") return "調整中";
    return status || "—";
  }

  function partnerCalFieldStatusMeta(status) {
    return PARTNER_CAL_FIELD_STATUSES[status] || PARTNER_CAL_FIELD_STATUSES.scheduled;
  }

  function partnerCalAttachIcon(type, name) {
    const t = String(type || "").toUpperCase();
    const n = String(name || "").toLowerCase();
    if (t === "JPG" || t === "JPEG" || t === "PNG" || /\.(jpg|jpeg|png|gif|webp)$/.test(n)) return "🖼";
    return "📄";
  }

  function partnerCalAccentColor(ev) {
    const idx = Number(ev?.accent);
    return PARTNER_CALENDAR_ACCENT[Number.isFinite(idx) ? idx % PARTNER_CALENDAR_ACCENT.length : 0];
  }

  function setPartnerDashboardView(view) {
    const v = view === "calendar" ? "calendar" : "dashboard";
    document.querySelectorAll("[data-builder-view]").forEach((el) => {
      const on = el.getAttribute("data-builder-view") === v;
      el.classList.toggle("is-active", on);
      el.hidden = !on;
    });
    document.querySelectorAll("[data-builder-partner-view]").forEach((btn) => {
      const on = btn.getAttribute("data-builder-partner-view") === v;
      btn.classList.toggle("is-active", on);
    });
    const titleEl = document.querySelector("[data-builder-partner-page-title]");
    const subEl = document.querySelector("[data-builder-partner-page-sub]");
    if (titleEl) {
      titleEl.textContent = v === "calendar" ? "案件カレンダー" : "パートナーダッシュボード";
    }
    if (subEl) {
      subEl.textContent =
        v === "calendar"
          ? "担当案件のスケジュールを確認できます"
          : "案件投稿・応募確認・やりとりのサマリー";
    }
    document.body.classList.toggle("builder-dash-view-calendar", v === "calendar");
    if (v === "calendar") {
      renderPartnerCalendarView();
    }
    try {
      const u = new URL(window.location.href);
      if (v === "calendar") u.searchParams.set("view", "calendar");
      else u.searchParams.delete("view");
      window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
    } catch {
      /* ignore */
    }
  }

  function wirePartnerDashboardShell() {
    if (document.body.dataset.partnerDashWired === "1") return;
    document.body.dataset.partnerDashWired = "1";
    wireDashShellBase({ logoutHref: "../dashboard.html" });

    document.querySelectorAll("[data-builder-open-calendar]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        setPartnerDashboardView("calendar");
        closeDashSidebar();
      });
    });

    document.querySelectorAll("[data-builder-partner-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-builder-partner-view");
        if (view) setPartnerDashboardView(view);
        closeDashSidebar();
      });
    });

    document.querySelector("[data-builder-partner-logout]")?.addEventListener("click", () => {
      window.location.href = "../dashboard.html";
    });

    try {
      const view = new URLSearchParams(window.location.search).get("view");
      if (view === "calendar") setPartnerDashboardView("calendar");
    } catch {
      /* ignore */
    }
  }

  function closeDashSidebar() {
    document.body.classList.remove("builder-partner-sidebar-open", "builder-dash-shell-open");
    const toggle = document.querySelector("[data-builder-sidebar-toggle]");
    const backdrop = document.querySelector("[data-builder-sidebar-backdrop]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (backdrop) backdrop.hidden = true;
  }

  function syncSidebarNavActive() {
    const nav = document.querySelector(".builder-partner-sidebar__nav");
    if (!nav) return;

    const path = window.location.pathname || "";
    const file = (path.split("/").pop() || "").split("?")[0].toLowerCase();
    const base = file.replace(/\.html$/, "");
    const onConstructionTools =
      base === "construction-tools" || (base.startsWith("tool-") && /\/builder\//i.test(path));

    const hrefLinks = Array.from(nav.querySelectorAll("a.builder-partner-sidebar__link[href]"));
    let matchedHref = false;

    hrefLinks.forEach((link) => {
      const href = (link.getAttribute("href") || "").split("?")[0];
      const linkFile = (href.split("/").pop() || "").toLowerCase();
      const linkBase = linkFile.replace(/\.html$/, "");
      const key = link.getAttribute("data-builder-sidebar-key");
      let active = false;

      if (key === "construction-tools" || linkFile === "construction-tools.html") {
        active = onConstructionTools;
      } else if (linkFile && (file === linkFile || base === linkBase)) {
        active = true;
      }

      link.classList.toggle("is-active", active);
      if (active) matchedHref = true;
    });

    if (matchedHref) {
      nav.querySelectorAll("button.builder-partner-sidebar__link.is-active").forEach((btn) => {
        btn.classList.remove("is-active");
      });
    }
  }

  function closePartnerSidebar() {
    closeDashSidebar();
  }

  function wireDashShellBase(options) {
    if (document.body.dataset.dashShellWired === "1") return;
    document.body.dataset.dashShellWired = "1";
    const opts = options || {};

    const toggle = document.querySelector("[data-builder-sidebar-toggle]");
    const backdrop = document.querySelector("[data-builder-sidebar-backdrop]");
    const openSidebar = () => {
      document.body.classList.add("builder-partner-sidebar-open", "builder-dash-shell-open");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
      if (backdrop) backdrop.hidden = false;
    };
    if (toggle) {
      toggle.addEventListener("click", () => {
        if (document.body.classList.contains("builder-partner-sidebar-open")) closeDashSidebar();
        else openSidebar();
      });
    }
    if (backdrop) backdrop.addEventListener("click", closeDashSidebar);

    document.querySelector("[data-builder-dash-logout]")?.addEventListener("click", () => {
      window.location.href = opts.logoutHref || "../dashboard.html";
    });

    syncSidebarNavActive();
  }

  function renderPartnerCalendarToolbar() {
    const host = document.querySelector("[data-builder-cal-toolbar]");
    if (!host) return;
    const label = formatPartnerCalMonthLabel(partnerCalendarUi.month);
    host.innerHTML =
      `<div class="builder-partner-cal__toolbarNav">` +
      `<button type="button" class="builder-partner-cal__toolBtn" data-cal-prev aria-label="前月">‹</button>` +
      `<button type="button" class="builder-partner-cal__toolBtn" data-cal-today>今日</button>` +
      `<button type="button" class="builder-partner-cal__toolBtn" data-cal-next aria-label="次月">›</button>` +
      `</div>` +
      `<span class="builder-partner-cal__monthLabel">${esc(label)}</span>` +
      `<div class="builder-partner-cal__toolbarViews">` +
      `<button type="button" class="builder-partner-cal__toolBtn${partnerCalendarUi.mode === "month" ? " is-active" : ""}" data-cal-mode="month">月</button>` +
      `<button type="button" class="builder-partner-cal__toolBtn${partnerCalendarUi.mode === "week" ? " is-active" : ""}" data-cal-mode="week">週</button>` +
      `<button type="button" class="builder-partner-cal__toolBtn${partnerCalendarUi.mode === "day" ? " is-active" : ""}" data-cal-mode="day">日</button>` +
      `<button type="button" class="builder-partner-cal__toolBtn" data-cal-filter>フィルター</button>` +
      `</div>`;

    host.querySelector("[data-cal-prev]")?.addEventListener("click", () => {
      partnerCalendarUi.month = new Date(
        partnerCalendarUi.month.getFullYear(),
        partnerCalendarUi.month.getMonth() - 1,
        1
      );
      renderPartnerCalendarView();
    });
    host.querySelector("[data-cal-next]")?.addEventListener("click", () => {
      partnerCalendarUi.month = new Date(
        partnerCalendarUi.month.getFullYear(),
        partnerCalendarUi.month.getMonth() + 1,
        1
      );
      renderPartnerCalendarView();
    });
    host.querySelector("[data-cal-today]")?.addEventListener("click", () => {
      const now = new Date();
      partnerCalendarUi.month = new Date(now.getFullYear(), now.getMonth(), 1);
      renderPartnerCalendarView();
    });
    host.querySelectorAll("[data-cal-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        partnerCalendarUi.mode = btn.getAttribute("data-cal-mode") || "month";
        renderPartnerCalendarView();
      });
    });
    host.querySelector("[data-cal-filter]")?.addEventListener("click", () => {
      alert("デモ: フィルターは準備中です");
    });
  }

  function renderPartnerCalendarGrid() {
    const grid = document.querySelector("[data-builder-cal-grid]");
    if (!grid) return;
    const events = getPartnerCalendarEventsForMe();
    const byDate = new Map();
    events.forEach((ev) => {
      const list = byDate.get(ev.date) || [];
      list.push(ev);
      byDate.set(ev.date, list);
    });

    const year = partnerCalendarUi.month.getFullYear();
    const month = partnerCalendarUi.month.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = partnerCalDateKey(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate()
    );

    const cells = [];
    for (let i = 0; i < startOffset; i += 1) {
      const d = new Date(year, month, -startOffset + i + 1);
      cells.push({ y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate(), outside: true });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ y: year, m: month + 1, day, outside: false });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1];
      const d = new Date(last.y, last.m - 1, last.day + 1);
      cells.push({ y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate(), outside: true });
    }

    grid.innerHTML = cells
      .map((cell) => {
        const key = partnerCalDateKey(cell.y, cell.m, cell.day);
        const dayEvents = (byDate.get(key) || []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
        const isToday = key === todayKey;
        const eventHtml = dayEvents
          .map((ev) => {
            const accent = partnerCalAccentColor(ev);
            const selected = ev.id === partnerCalendarUi.selectedEventId ? " is-selected" : "";
            return (
              `<button type="button" class="builder-partner-cal__event${selected}" data-cal-event="${esc(ev.id)}" style="--cal-accent:${esc(accent)}">` +
              `<span class="builder-partner-cal__eventTime">${esc(ev.startTime)}〜${esc(ev.endTime)}</span>` +
              `<span class="builder-partner-cal__eventTitle">${esc(ev.title)}</span>` +
              `</button>`
            );
          })
          .join("");
        return (
          `<div class="builder-partner-cal__cell${cell.outside ? " is-outside" : ""}${isToday ? " is-today" : ""}" role="gridcell" data-cal-date="${esc(key)}">` +
          `<span class="builder-partner-cal__dayNum">${cell.day}</span>` +
          `<div class="builder-partner-cal__events">${eventHtml}</div>` +
          `</div>`
        );
      })
      .join("");

    const wrap = document.querySelector("[data-builder-cal-grid-wrap]");
    wrap?.querySelector("[data-cal-mode-hint]")?.remove();
    if (partnerCalendarUi.mode !== "month" && wrap) {
      wrap.insertAdjacentHTML(
        "afterbegin",
        `<p class="builder-partner-cal__modeHint" data-cal-mode-hint style="margin:0 0 10px;font-size:0.78rem;color:rgba(255,255,255,0.55);">` +
          `デモ: ${partnerCalendarUi.mode === "week" ? "週" : "日"}表示は月表示と同じデータを表示しています。</p>`
      );
    }

    grid.querySelectorAll("[data-cal-event]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        partnerCalendarUi.selectedEventId = btn.getAttribute("data-cal-event") || "";
        renderPartnerCalendarGrid();
        renderPartnerCalendarDetail();
      });
    });
  }

  function renderPartnerCalendarDetail() {
    const host = document.querySelector("[data-builder-cal-detail]");
    if (!host) return;
    const ev = getPartnerCalendarEventById(partnerCalendarUi.selectedEventId);
    if (!ev) {
      host.innerHTML = `<p class="builder-partner-cal__detailEmpty">カレンダーから案件を選択してください。</p>`;
      return;
    }
    const addrLine = [ev.address, ev.building].filter(Boolean).join("\n");
    const workHtml = (ev.workItems || []).map((x) => `<li>${esc(x)}</li>`).join("");
    const notesHtml = (ev.notes || []).map((x) => `<li>${esc(x)}</li>`).join("");
    const attachHtml = (ev.attachments || []).length
      ? `<ul class="builder-partner-cal__attachList">${(ev.attachments || [])
          .map((f) => {
            const icon = partnerCalAttachIcon(f.type, f.name);
            return (
              `<li class="builder-partner-cal__attachItem">` +
              `<span class="builder-partner-cal__attachIcon" aria-hidden="true">${icon}</span>` +
              `<span class="builder-partner-cal__attachName">${esc(f.name)}</span>` +
              `<span class="builder-partner-cal__attachType">${esc(f.type || "")}</span>` +
              `</li>`
            );
          })
          .join("")}</ul>`
      : `<p class="builder-partner-cal__detailText builder-partner-cal__detailText--meta">—</p>`;

    const fieldMeta = partnerCalFieldStatusMeta(ev.fieldStatus);

    host.innerHTML =
      `<div class="builder-partner-cal__detailHead">` +
      `<h3 class="builder-partner-cal__detailTitle">${esc(formatPartnerCalDisplayDate(ev.date))}の予定</h3>` +
      `<button type="button" class="builder-partner-cal__detailAdd" disabled>予定を追加</button>` +
      `</div>` +
      `<p class="builder-partner-cal__detailTime"><span>${esc(ev.startTime)}〜${esc(ev.endTime)}</span><span class="builder-partner-cal__tag">作業</span></p>` +
      `<p class="builder-partner-cal__detailProject">${esc(ev.title)}</p>` +
      `<p class="builder-partner-cal__fieldStatus is-${esc(fieldMeta.tone)}">${esc(fieldMeta.label)}</p>` +
      `<div class="builder-partner-cal__detailBlock builder-partner-cal__detailBlock--meta">` +
      `<p class="builder-partner-cal__detailLabel">住所</p><p class="builder-partner-cal__detailText builder-partner-cal__detailText--meta">${esc(addrLine)}</p>` +
      `</div>` +
      `<div class="builder-partner-cal__detailBlock builder-partner-cal__detailBlock--meta">` +
      `<p class="builder-partner-cal__detailLabel">現場担当</p><p class="builder-partner-cal__detailText builder-partner-cal__detailText--meta">${esc(ev.managerName)}（${esc(ev.managerRole || "運営")}）</p>` +
      `</div>` +
      `<div class="builder-partner-cal__detailBlock builder-partner-cal__detailBlock--meta">` +
      `<p class="builder-partner-cal__detailLabel">電話</p><p class="builder-partner-cal__detailText builder-partner-cal__detailText--meta">${esc(ev.managerPhone)}</p>` +
      `</div>` +
      `<div class="builder-partner-cal__detailBlock builder-partner-cal__detailBlock--emphasis">` +
      `<p class="builder-partner-cal__detailLabel builder-partner-cal__detailLabel--emphasis">作業内容</p><ul class="builder-partner-cal__detailList builder-partner-cal__detailList--emphasis">${workHtml}</ul>` +
      `</div>` +
      `<div class="builder-partner-cal__detailBlock builder-partner-cal__detailBlock--emphasis">` +
      `<p class="builder-partner-cal__detailLabel builder-partner-cal__detailLabel--emphasis">持ち物・注意事項</p><ul class="builder-partner-cal__detailList builder-partner-cal__detailList--emphasis">${notesHtml}</ul>` +
      `</div>` +
      `<div class="builder-partner-cal__detailBlock builder-partner-cal__detailBlock--meta">` +
      `<p class="builder-partner-cal__detailLabel">添付資料</p>${attachHtml}` +
      `</div>` +
      (ev.threadId
        ? `<a class="builder-btn builder-btn--primary builder-partner-cal__threadBtn" href="${esc(
            mvpThreadHref(ev.threadId, "partner", "ops_partner")
          )}">運営とのやりとり</a>`
        : "") +
      `<a class="builder-partner-cal__mapBtn" href="${esc(ev.mapUrl)}" target="_blank" rel="noopener noreferrer">Googleマップで開く</a>`;
  }

  function renderPartnerCalendarUpcoming() {
    const list = document.querySelector("[data-builder-cal-upcoming]");
    if (!list) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    const items = getPartnerCalendarEventsForMe()
      .filter((ev) => {
        const d = parsePartnerCalDateKey(ev.date);
        return d && d >= today && d <= end;
      })
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

    if (!items.length) {
      list.innerHTML = `<li><p class="builder-partner-cal__detailEmpty">直近7日間の予定はありません。</p></li>`;
      return;
    }

    list.innerHTML = items
      .map(
        (ev) =>
          `<li><button type="button" class="builder-partner-cal__upcomingItem" data-cal-event="${esc(ev.id)}">` +
          `<span class="builder-partner-cal__upcomingMain">` +
          `<strong class="builder-partner-cal__upcomingTitle">${esc(ev.title)}</strong>` +
          `<span class="builder-partner-cal__upcomingWhen">${esc(formatPartnerCalShortDate(ev.date))} · ${esc(ev.startTime)}</span>` +
          `<span class="builder-partner-cal__upcomingAddr">${esc(ev.address)}</span>` +
          `</span>` +
          `<span class="builder-partner-cal__status">${esc(partnerCalStatusLabel(ev.status))}</span>` +
          `</button></li>`
      )
      .join("");

    list.querySelectorAll("[data-cal-event]").forEach((btn) => {
      btn.addEventListener("click", () => {
        partnerCalendarUi.selectedEventId = btn.getAttribute("data-cal-event") || "";
        const ev = getPartnerCalendarEventById(partnerCalendarUi.selectedEventId);
        if (ev) {
          const d = parsePartnerCalDateKey(ev.date);
          if (d) partnerCalendarUi.month = new Date(d.getFullYear(), d.getMonth(), 1);
        }
        renderPartnerCalendarView();
      });
    });

  }

  function renderPartnerCalendarSummary() {
    const host = document.querySelector("[data-builder-cal-summary]");
    if (!host) return;
    const year = partnerCalendarUi.month.getFullYear();
    const month = partnerCalendarUi.month.getMonth();
    const prefix = `${year}-${pad2(month + 1)}`;
    const monthEvents = getPartnerCalendarEventsForMe().filter((ev) => String(ev.date).startsWith(prefix));
    const workDays = new Set(monthEvents.map((ev) => ev.date)).size;
    const rewardTotal = monthEvents.reduce((sum, ev) => sum + (Number(ev.reward) || 0), 0);

    host.innerHTML =
      `<h3 class="builder-partner-cal__sectionTitle">今月のサマリー</h3>` +
      `<div class="builder-partner-cal__summaryGrid">` +
      `<div class="builder-partner-cal__summaryCard"><span>案件数</span><strong>${monthEvents.length}件</strong></div>` +
      `<div class="builder-partner-cal__summaryCard"><span>稼働日数</span><strong>${workDays}日</strong></div>` +
      `<div class="builder-partner-cal__summaryCard"><span>報酬（見込）</span><strong>${esc(formatPartnerCalReward(rewardTotal))}</strong></div>` +
      `</div>` +
      `<button type="button" class="builder-partner-cal__summaryBtn" data-builder-cal-summary-detail>詳細を確認する</button>`;

    host.querySelector("[data-builder-cal-summary-detail]")?.addEventListener("click", () => {
      alert(`デモ: ${formatPartnerCalMonthLabel(partnerCalendarUi.month)} — 案件 ${monthEvents.length}件 / 報酬見込 ${formatPartnerCalReward(rewardTotal)}`);
    });
  }

  function renderPartnerCalendarView() {
    if (!getPartnerCalendarEventsForMe().some((ev) => ev.id === partnerCalendarUi.selectedEventId)) {
      const first = getPartnerCalendarEventsForMe()[0];
      partnerCalendarUi.selectedEventId = first?.id || "";
    }
    renderPartnerCalendarToolbar();
    renderPartnerCalendarGrid();
    renderPartnerCalendarDetail();
    renderPartnerCalendarUpcoming();
    renderPartnerCalendarSummary();
  }

  function wirePartnerCalendarDelegates() {
    if (partnerCalendarUi.wired) return;
    partnerCalendarUi.wired = true;
    document.querySelector("[data-builder-cal-upcoming-all]")?.addEventListener("click", () => {
      setPartnerDashboardView("calendar");
    });
  }

  const DEMO_STATS_GENERAL_USER = {
    activeRequests: "4件",
    unreadMessages: "6件",
    unreadNotifications: "2件",
    paymentPending: "1件",
    reviewPending: "2件",
  };

  const DEMO_USER_GENERAL_RECENT = [
    {
      title: "世田谷区 キッチンリフォーム",
      statusText: "依頼中",
      statusMod: "open",
      icon: "plan",
      iconMod: "plan",
      period_range: "2026年6月8日〜",
      inProgress: true,
      partnerName: "佐藤建設",
    },
    {
      title: "横浜市 外壁塗装 相談",
      statusText: "相談中",
      statusMod: "open",
      icon: "site",
      iconMod: "site",
      period_range: "2026年6月5日〜",
      inProgress: true,
      partnerName: "田中塗装",
    },
    {
      title: "港区 オフィス内装",
      statusText: "完了待ち",
      statusMod: "selected",
      icon: "review",
      iconMod: "review",
      period_range: "2026年5月28日〜6月15日",
      partnerName: "〇〇設備",
    },
    {
      title: "川崎市 バスルーム改修",
      statusText: "レビュー待ち",
      statusMod: "urgent",
      icon: "alert",
      iconMod: "alert",
      period_range: "2026年5月10日〜6月2日",
      partnerName: "関東外装パートナーズ",
    },
  ];

  const DEMO_USER_RECENT_CHATS = [
    {
      name: "佐藤建設（キッチンリフォーム）",
      status: "未読2件",
      tone: "unread",
      unreadCount: 2,
      href: mvpThreadHref("thread-demo-002", "user", "partner_user"),
    },
    {
      name: "佐藤建設（世田谷リフォーム）",
      status: "返信待ち",
      tone: "waiting",
      href: mvpThreadHref("thread-demo-005", "user", "partner_user"),
    },
    {
      name: "鈴木 美咲（外壁塗装相談）",
      status: "返信待ち",
      tone: "waiting",
      href: mvpThreadHref("thread-demo-007", "user", "user_user"),
    },
    {
      name: "港区設備サービス",
      status: "未読1件",
      tone: "unread",
      unreadCount: 1,
      href: mvpThreadHref("thread-demo-008", "user", "vendor_user"),
    },
  ];

  function buildUserRecentCard(item) {
    const activeClass = item.inProgress ? " builder-recent-card--in-progress" : "";
    let html = buildRecentCard(item).replace(
      'class="builder-recent-card"',
      `class="builder-recent-card${activeClass}"`
    );
    if (item.partnerName) {
      html = html.replace(
        /(<span class="builder-recent-card__title"[^>]*>[\s\S]*?<\/span>)/,
        `$1<span class="builder-recent-card__partner">${esc(item.partnerName)}</span>`
      );
    }
    return html;
  }

  function buildUserChatCard(item) {
    const initial = String(item.name || "?").trim().charAt(0) || "?";
    const unread = Number(item.unreadCount) > 0 ? Number(item.unreadCount) : 0;
    const badgeHtml = unread
      ? `<span class="builder-user-chat-card__badge" aria-label="未読${unread}件">${unread}</span>`
      : "";
    return (
      `<li>` +
      `<a class="builder-user-chat-card${unread ? " has-unread" : ""}" href="${esc(item.href || "../talk-home.html?tab=chat")}">` +
      `<span class="builder-user-chat-card__avatar" aria-hidden="true">${esc(initial)}</span>` +
      `<span class="builder-user-chat-card__body">` +
      `<span class="builder-user-chat-card__nameRow">` +
      `<strong class="builder-user-chat-card__name">${esc(item.name)}</strong>${badgeHtml}` +
      `</span>` +
      `<span class="builder-user-chat-card__status is-${esc(item.tone || "waiting")}">${esc(item.status)}</span>` +
      `</span>` +
      `<span class="builder-user-chat-card__chev" aria-hidden="true">›</span>` +
      `</a>` +
      `</li>`
    );
  }

  function renderGeneralUserStats() {
    Object.entries(DEMO_STATS_GENERAL_USER).forEach(([key, val]) => {
      const el = document.querySelector(`[data-builder-user-stat-value="${key}"]`);
      if (el) el.textContent = val;
    });
  }

  function renderGeneralUserRecentList() {
    const list = document.querySelector("[data-builder-user-recent-list]");
    if (!list) return;
    list.innerHTML = DEMO_USER_GENERAL_RECENT.map(buildUserRecentCard).join("");
  }

  function renderGeneralUserChatList() {
    const list = document.querySelector("[data-builder-user-chat-list]");
    if (!list) return;
    list.innerHTML = DEMO_USER_RECENT_CHATS.map(buildUserChatCard).join("");
  }

  function wireGeneralUserDashboardShell() {
    if (document.body.dataset.userDashWired === "1") return;
    document.body.dataset.userDashWired = "1";
    wireDashShellBase({ logoutHref: "../dashboard.html" });
    document.querySelector("[data-builder-user-logout]")?.addEventListener("click", () => {
      window.location.href = "../dashboard.html";
    });
  }

  function renderUserDashboardPage() {
    renderGeneralUserStats();
    renderGeneralUserRecentList();
    renderGeneralUserChatList();
    wireGeneralUserDashboardShell();
  }

  function renderPartnerDashboardPage() {
    ensureMvpNotificationsDemoData();
    renderStats();
    renderRecentList();
    wireMvpDashboardNotificationsStat();
    wirePartnerDashboardShell();
    wirePartnerCalendarDelegates();
    if (new URLSearchParams(window.location.search).get("view") === "calendar") {
      setPartnerDashboardView("calendar");
    }
  }

  function renderAdminDashboardPage() {
    ensureMvpNotificationsDemoData();
    renderStats();
    renderRecentList();
    renderAdminDashboardApplicationStat();
    renderAdminDashboardReviewStat();
    renderAdminDashboardNotificationStat();
    renderAdminDashboardDispatchStat();
    mountAdminCsvExport(document.querySelector("[data-admin-csv-export-host]"));
    document.addEventListener("builder:admin-notifications-changed", renderAdminDashboardNotificationStat);
    document.addEventListener("builder:mvp-changed", renderAdminDashboardDispatchStat);
  }

  function iconBtnStar(active) {
    const cls = active ? "builder-icon-btn is-active" : "builder-icon-btn";
    return (
      `<button type="button" class="${cls}" data-builder-fav-btn aria-label="お気に入り">` +
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">` +
      `<path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z"/>` +
      `</svg>` +
      `</button>`
    );
  }

  function buildPartnerListItem(p, { showFav = true } = {}) {
    const trades = (p.trades || []).map(formatTrade).slice(0, 3).join("・") || "—";
    const areas = (p.areas || []).map(formatArea).slice(0, 3).join("・") || "—";
    const fav = DEMO_FAVORITES.has(p.partner_id);
    const status = p.status === "paused" ? "休止中" : "稼働中";
    const availability =
      p.availability === "available"
        ? "空きあり"
        : p.availability === "limited"
          ? "一部可"
          : "満枠";

    return (
      `<li class="builder-list-item" data-builder-partner-row data-partner-id="${esc(p.partner_id)}">` +
      `<div class="builder-list-item__icon" aria-hidden="true">` +
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
      `<path d="M3 21h18"/><path d="M6 21V7l8-4v18"/><path d="M18 21V11l-6-4"/>` +
      `</svg>` +
      `</div>` +
      `<div class="builder-list-item__main">` +
      `<p class="builder-list-item__title">${esc(p.display_name)}</p>` +
      `<p class="builder-list-item__sub">${esc(trades)} · ${esc(areas)} · ${esc(status)} · ${esc(
        availability
      )}</p>` +
      `<p class="builder-list-item__sub">${esc(p.headline || "")}</p>` +
      builderPartnerPerfBlock(p.partner_id, p.display_name) +
      `</div>` +
      `<div class="builder-list-item__actions">` +
      `<a class="builder-btn builder-btn--secondary" href="partner.html?partner_id=${esc(
        p.partner_id
      )}" data-builder-partner-open>詳細</a>` +
      (showFav ? iconBtnStar(fav) : "") +
      `</div>` +
      `</li>`
    );
  }

  function bindFavoriteButtons(root) {
    root.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-builder-fav-btn]");
      if (!btn) return;
      const row = btn.closest?.("[data-builder-partner-row]");
      const id = row?.getAttribute?.("data-partner-id") || "";
      if (!id) return;
      if (DEMO_FAVORITES.has(id)) DEMO_FAVORITES.delete(id);
      else DEMO_FAVORITES.add(id);
      btn.classList.toggle("is-active", DEMO_FAVORITES.has(id));
      document.dispatchEvent(new CustomEvent("builder:favorites-changed"));
    });
  }

  const ADMIN_REVIEW_STATUS_UI = {
    unreviewed: { label: "未審査", mod: "unreviewed" },
    reviewing: { label: "審査中", mod: "reviewing" },
    approved: { label: "承認済み", mod: "approved" },
    returned: { label: "差し戻し", mod: "returned" },
    suspended: { label: "停止中", mod: "suspended" },
  };

  const ADMIN_REVIEW_NOTIFICATION = {
    unreviewed: { label: "審査未審査", body: "パートナー審査を未審査状態に戻しました。" },
    reviewing: { label: "審査開始", body: "パートナー審査を開始しました。" },
    approved: { label: "審査承認", body: "パートナー審査を承認しました。" },
    returned: { label: "審査差し戻し", body: "パートナー審査を差し戻しました。" },
    suspended: { label: "審査停止", body: "パートナーを停止状態に変更しました。" },
  };

  function normalizeReviewStatusKey(status) {
    const s = String(status || "").trim();
    if (s === "pending") return "unreviewed";
    if (s === "rejected") return "returned";
    return s;
  }

  function normalizePartnerSearchFields(partner) {
    if (!partner || typeof partner !== "object") return partner;
    const prefectures =
      Array.isArray(partner.prefectures) && partner.prefectures.length
        ? partner.prefectures.map(String)
        : Array.isArray(partner.areas)
          ? partner.areas.map(String)
          : [];
    const categories =
      Array.isArray(partner.categories) && partner.categories.length
        ? partner.categories.map(String)
        : Array.isArray(partner.trades)
          ? partner.trades.map(String)
          : [];
    const reviewStatus = normalizeReviewStatusKey(partner.reviewStatus);
    const reviewUi = ADMIN_REVIEW_STATUS_UI[reviewStatus];
    const availUi = ADMIN_AVAILABILITY_UI[partner.availability] || ADMIN_AVAILABILITY_UI.active;
    return {
      ...partner,
      prefectures,
      categories,
      areas: prefectures.length ? prefectures : partner.areas || [],
      trades: categories.length ? categories : partner.trades || [],
      isFavorite: Boolean(partner.isFavorite),
      rating: Number.isFinite(Number(partner.rating)) ? Number(partner.rating) : null,
      completedProjects: Number.isFinite(Number(partner.completedProjects)) ? Number(partner.completedProjects) : 0,
      reviewStatus,
      reviewStatusLabel: reviewUi?.label || partner.reviewStatusLabel || "—",
      availability: partner.availability || "active",
      availabilityLabel: availUi?.label || partner.availabilityLabel || "稼働中",
    };
  }

  function normalizeAdminPartner(partner) {
    return normalizePartnerSearchFields(partner);
  }

  function migrateAdminPartnersReviewStatuses() {
    try {
      const raw = localStorage.getItem(ADMIN_PARTNERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      let changed = false;
      const next = parsed.map((p) => {
        const normalized = normalizeAdminPartner(p);
        if (JSON.stringify(normalized) !== JSON.stringify(p)) changed = true;
        return normalized;
      });
      if (changed) {
        localStorage.setItem(ADMIN_PARTNERS_KEY, JSON.stringify(next));
        document.dispatchEvent(new CustomEvent("builder:admin-partners-changed"));
      }
    } catch {
      // ignore
    }
  }

  const ADMIN_AVAILABILITY_UI = {
    active: { label: "稼働中", mod: "active" },
    busy: { label: "忙しい", mod: "busy" },
    closed: { label: "受付停止", mod: "closed" },
  };

  const ADMIN_DEMO_PARTNERS = [
    {
      id: "partner-demo-001",
      companyName: "関東外装パートナーズ",
      contactName: "田中 太郎",
      phone: "090-0000-0000",
      email: "partner@example.com",
      areas: ["埼玉県", "東京都", "千葉県"],
      trades: ["外壁補修", "屋根工事", "塗装"],
      reviewStatus: "approved",
      reviewStatusLabel: "承認済み",
      availability: "active",
      availabilityLabel: "稼働中",
      rating: 4.8,
      completedProjects: 18,
      isFavorite: true,
      note: "外壁・屋根の対応が早い。写真報告も丁寧。",
      createdAt: "2026-06-01T10:00:00+09:00",
      updatedAt: "2026-06-03T10:30:00+09:00",
    },
    {
      id: "partner-demo-002",
      companyName: "株式会社スマート内装",
      contactName: "佐藤 花子",
      phone: "080-1111-2222",
      email: "smart-interior@example.com",
      areas: ["東京都", "神奈川県"],
      trades: ["内装", "大工", "原状回復"],
      reviewStatus: "reviewing",
      reviewStatusLabel: "審査中",
      availability: "busy",
      availabilityLabel: "忙しい",
      rating: 4.5,
      completedProjects: 12,
      note: "店舗内装の短工期案件に強み。夜間対応可。",
      createdAt: "2026-05-28T14:00:00+09:00",
      updatedAt: "2026-06-02T09:15:00+09:00",
    },
    {
      id: "partner-demo-003",
      companyName: "足場ワークス東京",
      contactName: "鈴木 一郎",
      phone: "070-3333-4444",
      email: "scaffold-tokyo@example.com",
      areas: ["東京都", "埼玉県"],
      trades: ["足場", "仮設"],
      reviewStatus: "approved",
      reviewStatusLabel: "承認済み",
      availability: "active",
      availabilityLabel: "稼働中",
      rating: 4.6,
      completedProjects: 24,
      isFavorite: true,
      note: "低層〜中層の足場に特化。安全書類提出が早い。",
      createdAt: "2026-05-20T11:00:00+09:00",
      updatedAt: "2026-06-01T16:40:00+09:00",
    },
    {
      id: "partner-demo-004",
      companyName: "北関東設備サービス",
      contactName: "高橋 健",
      phone: "090-5555-6666",
      email: "kitakanto-plumb@example.com",
      areas: ["群馬県", "埼玉県", "栃木県"],
      trades: ["設備", "電気", "空調"],
      reviewStatus: "unreviewed",
      reviewStatusLabel: "未審査",
      availability: "active",
      availabilityLabel: "稼働中",
      rating: 4.2,
      completedProjects: 6,
      note: "新規登録。設備更新案件の実績確認中。",
      createdAt: "2026-06-02T08:00:00+09:00",
      updatedAt: "2026-06-02T08:00:00+09:00",
    },
    {
      id: "partner-demo-005",
      companyName: "横浜リフォーム工房",
      contactName: "伊藤 美咲",
      phone: "080-7777-8888",
      email: "yokohama-reform@example.com",
      areas: ["神奈川県"],
      trades: ["リフォーム", "防水", "塗装"],
      reviewStatus: "returned",
      reviewStatusLabel: "差し戻し",
      availability: "closed",
      availabilityLabel: "受付停止",
      rating: 3.9,
      completedProjects: 9,
      note: "書類不備のため差し戻し。再提出待ち。",
      createdAt: "2026-04-10T10:00:00+09:00",
      updatedAt: "2026-05-15T12:00:00+09:00",
    },
    {
      id: "partner-a",
      companyName: "デモ協力会社A",
      contactName: "協力 A 担当",
      phone: "090-1000-1001",
      email: "partner-a@example.com",
      areas: ["東京都"],
      trades: ["内装"],
      reviewStatus: "approved",
      reviewStatusLabel: "承認済み",
      availability: "active",
      availabilityLabel: "稼働中",
      rating: 4.7,
      completedProjects: 8,
      createdAt: "2026-06-01T10:00:00+09:00",
      updatedAt: "2026-06-06T10:00:00+09:00",
    },
    {
      id: "partner-b",
      companyName: "デモ協力会社B",
      contactName: "協力 B 担当",
      phone: "090-2000-2002",
      email: "partner-b@example.com",
      areas: ["東京都", "神奈川県"],
      trades: ["外装", "足場"],
      reviewStatus: "approved",
      reviewStatusLabel: "承認済み",
      availability: "active",
      availabilityLabel: "稼働中",
      rating: 4.5,
      completedProjects: 11,
      createdAt: "2026-06-01T10:00:00+09:00",
      updatedAt: "2026-06-06T10:00:00+09:00",
    },
    {
      id: "partner-demo-006",
      companyName: "千葉総合建設協力",
      contactName: "渡辺 誠",
      phone: "090-9999-0000",
      email: "chiba-sogo@example.com",
      areas: ["千葉県", "東京都"],
      trades: ["土木", "外構", "舗装"],
      reviewStatus: "suspended",
      reviewStatusLabel: "停止中",
      availability: "closed",
      availabilityLabel: "受付停止",
      rating: 4.0,
      completedProjects: 15,
      note: "運営判断により一時停止中。",
      createdAt: "2026-03-01T09:00:00+09:00",
      updatedAt: "2026-05-01T09:00:00+09:00",
    },
  ];

  function ensureAdminPartnersStorage() {
    try {
      const raw = localStorage.getItem(ADMIN_PARTNERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return;
      }
      localStorage.setItem(ADMIN_PARTNERS_KEY, JSON.stringify(ADMIN_DEMO_PARTNERS));
    } catch {
      // ignore
    }
  }

  function ensureAdminPartnersDemoData() {
    ensureAdminPartnersStorage();
    migrateAdminPartnersReviewStatuses();
    const list = getAdminPartners();
    if (!list.length) saveAdminPartners(ADMIN_DEMO_PARTNERS.map(normalizeAdminPartner));
  }

  function getAdminPartners() {
    ensureAdminPartnersStorage();
    migrateAdminPartnersReviewStatuses();
    try {
      const raw = localStorage.getItem(ADMIN_PARTNERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeAdminPartner) : [];
    } catch {
      return [];
    }
  }

  function saveAdminPartners(partners) {
    ensureAdminPartnersStorage();
    const list = (Array.isArray(partners) ? partners : []).map(normalizeAdminPartner);
    try {
      localStorage.setItem(ADMIN_PARTNERS_KEY, JSON.stringify(list));
      document.dispatchEvent(new CustomEvent("builder:admin-partners-changed"));
    } catch {
      // ignore
    }
  }

  function getAdminPartnerById(partnerId) {
    const id = String(partnerId || "").trim();
    if (!id) return null;
    return getAdminPartners().find((p) => p.id === id) || null;
  }

  function escapeCsvValue(value) {
    if (value == null) return "";
    const s = String(value);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadCsv(fileName, rows) {
    const bom = "\uFEFF";
    const body = (Array.isArray(rows) ? rows : [])
      .map((row) => (Array.isArray(row) ? row : []).map(escapeCsvValue).join(","))
      .join("\r\n");
    const blob = new Blob([bom + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function extractPrefectureFromAddress(address) {
    const m = String(address || "").match(/^(.+?[都道府県])/);
    return m ? m[1] : "";
  }

  function csvDateStamp() {
    return ymdFromDate(new Date());
  }

  function formatTradeLabel(trade) {
    const map = { scaffold: "足場", interior: "内装", carpenter: "大工" };
    const k = String(trade || "").trim();
    return map[k] || k || "—";
  }

  function buildProjectsCsvRows() {
    const state = mvp().reload();
    const header = [
      "案件ID",
      "案件名",
      "カテゴリ",
      "エリア",
      "予算",
      "ステータス",
      "応募数",
      "手配パートナー",
      "作成日",
      "更新日",
    ];
    const rows = [header];
    for (const p of state.projects || []) {
      const spec = getProjectSpec(state, p.project_id);
      const budget = spec.budget || {};
      const budgetLabel =
        budget.min != null && budget.max != null
          ? `${budget.min}〜${budget.max}円`
          : budget.max != null
            ? `${budget.max}円`
            : budget.min != null
              ? `${budget.min}円`
              : "";
      const apps = (state.applications || []).filter((a) => a.project_id === p.project_id);
      const selected = (p.selected_partner_ids || [])
        .map((pid) => partnerLabel(state, pid))
        .filter(Boolean)
        .join(" / ");
      const assignedCal = p.calendar_assigned_partner_id
        ? partnerLabel(state, p.calendar_assigned_partner_id)
        : "";
      const assignees = selected || assignedCal || "—";
      rows.push([
        p.project_id,
        p.title || "",
        formatTradeLabel(p.category || spec.trade_tags?.[0] || ""),
        spec.areaLabel || spec.site_address || "",
        budgetLabel,
        toStatusLabel(computeProjectStatus(state, p)),
        apps.length,
        assignees,
        p.created_at || "",
        p.updated_at || "",
      ]);
    }
    return rows;
  }

  function buildCalendarAssignmentsCsvRows() {
    const header = [
      "予定ID",
      "邸名",
      "作業日",
      "開始時間",
      "終了時間",
      "都道府県",
      "現場住所",
      "カテゴリ",
      "担当パートナー",
      "指示書PDF",
      "駐車場PDF",
      "備考",
      "ステータス",
      "作成日",
    ];
    const rows = [header];
    for (const a of getAdminCalendarAssignments()) {
      const partner = getAdminPartnerById(a.partnerId);
      const category = (partner?.categories || partner?.trades || [])[0] || "現場予定";
      rows.push([
        a.id,
        a.houseName,
        a.workDate,
        a.startTime || "",
        a.endTime || "",
        extractPrefectureFromAddress(a.siteAddress),
        a.siteAddress || "",
        category,
        a.partnerName || partner?.companyName || "",
        a.instructionPdf?.name || "",
        a.parkingPdf?.name || "",
        a.notes || "",
        a.status === "completed" ? "完了" : "手配済み",
        a.createdAt || "",
      ]);
    }
    return rows;
  }

  function buildPartnersCsvRows() {
    const header = [
      "パートナーID",
      "会社名",
      "担当者",
      "電話",
      "メール",
      "都道府県",
      "対応エリア",
      "カテゴリ/工種",
      "評価",
      "完了案件数",
      "お気に入り",
      "審査状態",
      "稼働状態",
      "メモ",
      "登録日",
    ];
    const rows = [header];
    for (const p of getAdminPartners()) {
      rows.push([
        p.id,
        p.companyName || "",
        p.contactName || "",
        p.phone || "",
        p.email || "",
        (p.prefectures || p.areas || []).join(" / "),
        (p.prefectures || p.areas || []).join(" / "),
        (p.categories || p.trades || []).join(" / "),
        p.rating != null ? p.rating : "",
        p.completedProjects ?? "",
        p.isFavorite ? "はい" : "いいえ",
        p.reviewStatusLabel || p.reviewStatus || "",
        p.availabilityLabel || p.availability || "",
        p.note || "",
        p.createdAt || "",
      ]);
    }
    return rows;
  }

  function findCalendarAssignmentNotification(assignment) {
    if (!assignment) return null;
    const notifs = getMvpNotifications().filter((n) => n.type === "calendar_assignment");
    return (
      notifs.find((n) => n.assignmentId === assignment.id) ||
      notifs.find(
        (n) =>
          (n.projectTitle === assignment.houseName || String(n.body || "").includes(assignment.houseName)) &&
          String(n.body || "").includes(assignment.houseName)
      ) ||
      null
    );
  }

  function buildDispatchHistoryCsvRows() {
    const state = mvp().reload();
    const header = [
      "案件ID",
      "案件名",
      "邸名",
      "パートナーID",
      "パートナー名",
      "作業日",
      "手配日時",
      "通知送信日時",
      "ステータス",
    ];
    const rows = [header];
    const seen = new Set();

    for (const a of getAdminCalendarAssignments()) {
      const key = `assignment:${a.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const notif = findCalendarAssignmentNotification(a);
      const proj = a.projectId ? (state.projects || []).find((p) => p.project_id === a.projectId) : null;
      rows.push([
        proj?.project_id || a.projectId || "",
        proj?.title || "",
        a.houseName,
        a.partnerId,
        a.partnerName || "",
        a.workDate,
        a.createdAt || "",
        notif?.createdAt || "",
        a.status === "completed" ? "完了" : "手配済み",
      ]);
    }

    for (const p of state.projects || []) {
      const calPid = getProjectCalendarAssignedPartnerId(p);
      if (!calPid) continue;
      const key = `project:${p.project_id}:${calPid}`;
      if (seen.has(key)) continue;
      const adminPid = mvpPartnerIdToAdminPartnerId(calPid);
      const partner = getAdminPartnerById(adminPid) || getAdminPartnerById(calPid);
      const spec = getProjectSpec(state, p.project_id);
      const workDate = spec.period?.start || spec.period?.end || "";
      const notif = getMvpNotifications().find(
        (n) => n.type === "calendar_assignment" && n.project_id === p.project_id
      );
      seen.add(key);
      rows.push([
        p.project_id,
        p.title || "",
        p.title || "",
        adminPid || calPid,
        partner?.companyName || partnerLabel(state, calPid),
        workDate,
        p.updated_at || p.created_at || "",
        notif?.createdAt || "",
        toStatusLabel(computeProjectStatus(state, p)),
      ]);
    }

    return rows;
  }

  function buildCompletedProjectsCsvRows() {
    const state = mvp().reload();
    const header = [
      "案件ID",
      "案件名",
      "邸名",
      "パートナー名",
      "作業日",
      "完了日時",
      "請求書PDF",
      "作業報告書PDF",
      "完了報告書PDF",
    ];
    const rows = [header];

    for (const p of state.projects || []) {
      const status = computeProjectStatus(state, p);
      const thread = p.main_thread_id ? state.threads?.[p.main_thread_id] : null;
      const siteData = normalizeMvpThreadSiteData(thread?.siteData, {
        threadId: p.main_thread_id,
        projectId: p.project_id,
        state,
      });
      if (!siteData.completed && status !== "completed" && status !== "invoiced") continue;

      const assignment =
        getAdminCalendarAssignments().find((a) => a.projectId === p.project_id) ||
        getAdminCalendarAssignments().find((a) => a.houseName === p.title);
      const partnerId = (p.selected_partner_ids || [])[0] || p.calendar_assigned_partner_id || "";
      const pdfOutputs = p.main_thread_id ? getThreadPdfOutputs(p.main_thread_id, state) : [];
      const pdfName = (kind) => pdfOutputs.find((x) => x.kind === kind)?.fileName || "";
      const spec = getProjectSpec(state, p.project_id);

      rows.push([
        p.project_id,
        p.title || "",
        assignment?.houseName || p.title || "",
        partnerLabel(state, partnerId) || assignment?.partnerName || "",
        assignment?.workDate || spec.period?.end || spec.period?.start || "",
        siteData.completedAt || thread?.completion_report?.ts || "",
        pdfName("invoice"),
        pdfName("work_report"),
        pdfName("completion_report"),
      ]);
    }

    return rows;
  }

  const BUILDER_CSV_EXPORTS = {
    projects: { label: "案件一覧CSV", fileName: () => `案件一覧_${csvDateStamp()}.csv`, build: buildProjectsCsvRows },
    calendar_assignments: {
      label: "現場予定CSV",
      fileName: () => `現場予定_${csvDateStamp()}.csv`,
      build: buildCalendarAssignmentsCsvRows,
    },
    partners: { label: "パートナー一覧CSV", fileName: () => `パートナー一覧_${csvDateStamp()}.csv`, build: buildPartnersCsvRows },
    dispatch_history: {
      label: "手配履歴CSV",
      fileName: () => `手配履歴_${csvDateStamp()}.csv`,
      build: buildDispatchHistoryCsvRows,
    },
    completed_projects: {
      label: "完了案件CSV",
      fileName: () => `完了案件_${csvDateStamp()}.csv`,
      build: buildCompletedProjectsCsvRows,
    },
  };

  function exportBuilderCsv(type) {
    const key = String(type || "").trim();
    const spec = BUILDER_CSV_EXPORTS[key];
    if (!spec) return { ok: false, error: "unknown_type" };
    downloadCsv(spec.fileName(), spec.build());
    return { ok: true, type: key };
  }

  function renderAdminCsvExportMenu() {
    return (
      `<div class="admin-csvExport" data-admin-csv-export>` +
      `<button type="button" class="builder-btn builder-btn--ghost admin-csvExport__toggle" data-admin-csv-export-toggle aria-haspopup="true" aria-expanded="false">CSV出力</button>` +
      `<div class="admin-csvExport__menu" data-admin-csv-export-menu hidden role="menu">` +
      Object.entries(BUILDER_CSV_EXPORTS)
        .map(
          ([type, item]) =>
            `<button type="button" class="admin-csvExport__item" role="menuitem" data-admin-csv-export-type="${esc(type)}">${esc(item.label)}</button>`
        )
        .join("") +
      `</div></div>`
    );
  }

  let adminCsvExportWired = false;

  function wireAdminCsvExport(root) {
    if (adminCsvExportWired) return;
    adminCsvExportWired = true;

    const closeMenus = () => {
      document.querySelectorAll("[data-admin-csv-export-menu]").forEach((menu) => {
        menu.hidden = true;
      });
      document.querySelectorAll("[data-admin-csv-export]").forEach((wrap) => {
        wrap.classList.remove("is-open");
      });
      document.querySelectorAll("[data-admin-csv-export-toggle]").forEach((btn) => {
        btn.setAttribute("aria-expanded", "false");
      });
    };

    (root || document).addEventListener("click", (ev) => {
      const toggle = ev.target?.closest?.("[data-admin-csv-export-toggle]");
      if (toggle) {
        ev.stopPropagation();
        const wrap = toggle.closest("[data-admin-csv-export]");
        const menu = wrap?.querySelector("[data-admin-csv-export-menu]");
        if (!menu) return;
        const willOpen = menu.hidden;
        closeMenus();
        menu.hidden = !willOpen;
        wrap?.classList.toggle("is-open", willOpen);
        toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
        return;
      }

      const item = ev.target?.closest?.("[data-admin-csv-export-type]");
      if (item) {
        exportBuilderCsv(item.getAttribute("data-admin-csv-export-type"));
        closeMenus();
        return;
      }

      if (!ev.target?.closest?.("[data-admin-csv-export]")) closeMenus();
    });
  }

  function mountAdminCsvExport(host) {
    if (!host) return;
    if (host.querySelector("[data-admin-csv-export]")) return;
    host.insertAdjacentHTML("beforeend", renderAdminCsvExportMenu());
    wireAdminCsvExport(host);
  }

  function collectCalendarPartnerFilterOptions() {
    const prefectures = new Set();
    const categories = new Set();
    getAdminPartners().forEach((p) => {
      normalizePartnerSearchFields(p).prefectures.forEach((x) => prefectures.add(x));
      normalizePartnerSearchFields(p).categories.forEach((x) => categories.add(x));
    });
    return {
      prefectures: [...prefectures].sort((a, b) => a.localeCompare(b, "ja")),
      categories: [...categories].sort((a, b) => a.localeCompare(b, "ja")),
    };
  }

  function filterCalendarPartnerCandidates(partners, filters = {}) {
    const q = String(filters.keyword || filters.q || "").trim().toLowerCase();
    const pref = String(filters.prefecture || "").trim();
    const cat = String(filters.category || "").trim();
    return (Array.isArray(partners) ? partners : getAdminPartners())
      .map(normalizePartnerSearchFields)
      .filter((p) => {
        if (filters.favoritesOnly && !p.isFavorite) return false;
        if (filters.approvedOnly && p.reviewStatus !== "approved") return false;
        if (filters.activeOnly && p.availability !== "active") return false;
        if (pref && !p.prefectures.some((x) => x === pref || x.includes(pref))) return false;
        if (cat && !p.categories.some((x) => x === cat || x.includes(cat))) return false;
        if (!q) return true;
        const hay = [
          p.companyName,
          p.contactName,
          p.email,
          p.note,
          ...(p.prefectures || []),
          ...(p.categories || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }

  function sortCalendarPartnerCandidates(partners, sortKey) {
    const key = String(sortKey || "favorite");
    const rows = [...(Array.isArray(partners) ? partners : [])];
    rows.sort((a, b) => {
      if (key === "favorite") {
        if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) return a.isFavorite ? -1 : 1;
        return String(a.companyName || "").localeCompare(String(b.companyName || ""), "ja");
      }
      if (key === "rating") {
        return (
          (b.rating || 0) - (a.rating || 0) ||
          String(a.companyName || "").localeCompare(String(b.companyName || ""), "ja")
        );
      }
      if (key === "completed") {
        return (
          (b.completedProjects || 0) - (a.completedProjects || 0) ||
          String(a.companyName || "").localeCompare(String(b.companyName || ""), "ja")
        );
      }
      if (key === "newest") {
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      }
      return String(a.companyName || "").localeCompare(String(b.companyName || ""), "ja");
    });
    return rows;
  }

  function readCalendarPartnerFiltersFromDom() {
    return {
      keyword:
        document.querySelector("[data-admin-cal-partner-filter-keyword]")?.value ||
        document.querySelector("[data-admin-cal-assignment-partner-search]")?.value ||
        "",
      prefecture: document.querySelector("[data-admin-cal-partner-filter-prefecture]")?.value || "",
      category: document.querySelector("[data-admin-cal-partner-filter-category]")?.value || "",
      favoritesOnly: Boolean(document.querySelector("[data-admin-cal-partner-filter-favorite]")?.checked),
      approvedOnly: Boolean(document.querySelector("[data-admin-cal-partner-filter-approved]")?.checked),
      activeOnly: Boolean(document.querySelector("[data-admin-cal-partner-filter-active]")?.checked),
      sortKey: document.querySelector("[data-admin-cal-partner-filter-sort]")?.value || "favorite",
    };
  }

  function renderCalendarPartnerFilters(options = {}) {
    const opts = options.prefectures ? options : collectCalendarPartnerFilterOptions();
    const prefOptions =
      `<option value="">すべて</option>` +
      opts.prefectures.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
    const catOptions =
      `<option value="">すべて</option>` +
      opts.categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    return (
      `<div class="admin-cal-partnerFilters">` +
      `<div class="admin-cal-partnerFilters__row">` +
      `<label class="builder-field builder-field--full">` +
      `<span class="builder-field__label">キーワード検索</span>` +
      `<input class="builder-input admin-cal-partnerSearch" type="search" placeholder="会社名・担当者・工種・エリア…" data-admin-cal-partner-filter-keyword data-admin-cal-assignment-partner-search autocomplete="off" />` +
      `</label></div>` +
      `<div class="admin-cal-partnerFilters__row admin-cal-partnerFilters__row--4">` +
      `<label class="builder-field"><span class="builder-field__label">都道府県</span>` +
      `<select class="builder-select" data-admin-cal-partner-filter-prefecture>${prefOptions}</select></label>` +
      `<label class="builder-field"><span class="builder-field__label">カテゴリ / 工種</span>` +
      `<select class="builder-select" data-admin-cal-partner-filter-category>${catOptions}</select></label>` +
      `<label class="builder-field"><span class="builder-field__label">並び替え</span>` +
      `<select class="builder-select" data-admin-cal-partner-filter-sort>` +
      `<option value="favorite">お気に入り順</option>` +
      `<option value="rating">評価高い順</option>` +
      `<option value="completed">完了案件数多い順</option>` +
      `<option value="newest">新着順</option>` +
      `<option value="name">会社名順</option>` +
      `</select></label>` +
      `</div>` +
      `<div class="admin-cal-partnerFilters__checks">` +
      `<label class="admin-cal-partnerFilters__check"><input type="checkbox" data-admin-cal-partner-filter-favorite /> お気に入りのみ</label>` +
      `<label class="admin-cal-partnerFilters__check"><input type="checkbox" data-admin-cal-partner-filter-approved /> 審査済みのみ</label>` +
      `<label class="admin-cal-partnerFilters__check"><input type="checkbox" data-admin-cal-partner-filter-active /> 稼働中のみ</label>` +
      `</div></div>`
    );
  }

  function renderCalendarPartnerCandidateList(partners, selectedPartnerId, filters = {}) {
    const filtered = filterCalendarPartnerCandidates(partners, filters);
    const rows = sortCalendarPartnerCandidates(filtered, filters.sortKey);
    if (!rows.length) {
      return `<p class="admin-cal-partnerSearch__empty">該当する協力会社がありません。条件を変更してください。</p>`;
    }
    return (
      `<ul class="admin-cal-partnerSearchList">` +
      rows
        .map((p) => {
          const review = ADMIN_REVIEW_STATUS_UI[p.reviewStatus] || { label: p.reviewStatusLabel || "—", mod: "unreviewed" };
          const avail = ADMIN_AVAILABILITY_UI[p.availability] || { label: p.availabilityLabel || "—", mod: "active" };
          const rating = p.rating != null ? Number(p.rating).toFixed(1) : "—";
          const prefectureLabel = (p.prefectures || []).slice(0, 2).join(" · ") || "—";
          const categoryLabel = (p.categories || []).slice(0, 3).join(" · ") || "—";
          return (
            `<li>` +
            `<label class="admin-cal-partnerSearchItem admin-cal-partnerSearchItem--rich${selectedPartnerId === p.id ? " is-selected" : ""}">` +
            `<input type="radio" name="admin-cal-assignment-partner" value="${esc(p.id)}"${selectedPartnerId === p.id ? " checked" : ""} data-admin-cal-assignment-partner-radio />` +
            `<span class="admin-cal-partnerSearchItem__body">` +
            `<span class="admin-cal-partnerSearchItem__head">` +
            `<span class="admin-cal-partnerSearchItem__main">${esc(p.companyName || p.id)}</span>` +
            (p.isFavorite ? `<span class="admin-cal-partnerSearchItem__favorite">★ お気に入り</span>` : "") +
            `</span>` +
            `<span class="admin-cal-partnerSearchItem__sub">担当: ${esc(p.contactName || "—")}</span>` +
            `<span class="admin-cal-partnerSearchItem__meta">` +
            `<span>都道府県: ${esc(prefectureLabel)}</span>` +
            `<span>カテゴリ: ${esc(categoryLabel)}</span>` +
            `<span>評価: ${esc(rating)}</span>` +
            `<span>完了: ${esc(String(p.completedProjects ?? 0))} 件</span>` +
            `</span>` +
            `<span class="admin-cal-partnerSearchItem__badges">` +
            adminStatusBadge(review.label, review.mod, "review") +
            adminStatusBadge(avail.label, avail.mod, "availability") +
            `</span>` +
            `</span></label></li>`
          );
        })
        .join("") +
      `</ul>`
    );
  }

  function renderAdminCalendarAssignmentModal(partners, selectedPartnerId, filters) {
    return renderCalendarPartnerCandidateList(partners, selectedPartnerId, filters);
  }

  function getAdminDispatchCandidates() {
    try {
      const raw = localStorage.getItem(ADMIN_DISPATCH_CANDIDATES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getMvpProjects() {
    seedMvpStateIfEmpty();
    const state = mvp().reload();
    return Array.isArray(state.projects) ? state.projects : [];
  }

  function getProjectAssignedPartners(project) {
    return Array.isArray(project?.assignedPartners) ? project.assignedPartners : [];
  }

  function isProjectDispatched(project) {
    return getProjectAssignedPartners(project).length > 0;
  }

  function getAdminPartnerLabel(partnerId) {
    const partner = getAdminPartnerById(partnerId);
    return partner?.companyName || partnerId || "—";
  }

  function ensureAdminDispatchDemoData() {
    ensureAdminPartnersDemoData();
    const prev = getAdminDispatchCandidates();
    if (prev.length) return;
    getAdminPartners()
      .filter((p) => p.reviewStatus === "approved")
      .slice(0, 3)
      .forEach((p) => addAdminDispatchCandidate(p));
  }

  function getUndispatchedProjectCount() {
    return getMvpProjects().filter((p) => !isProjectDispatched(p)).length;
  }

  function assignPartnerToProject(projectId, partnerId) {
    const pid = String(projectId || "").trim();
    const ppid = String(partnerId || "").trim();
    if (!pid || !ppid) return { ok: false, error: "invalid" };

    const partner = getAdminPartnerById(ppid);
    if (!partner) return { ok: false, error: "partner_not_found" };

    const api = mvp();
    const state = api.reload();
    const pidx = (state.projects || []).findIndex((p) => p.project_id === pid);
    if (pidx < 0) return { ok: false, error: "project_not_found" };

    const project = state.projects[pidx];
    const assigned = getProjectAssignedPartners(project);
    if (assigned.some((a) => a.partnerId === ppid)) {
      return { ok: false, error: "duplicate" };
    }

    const next = api.reload();
    const nextAssigned = [...assigned, { partnerId: ppid, assignedAt: nowIso() }];
    next.projects[pidx] = { ...next.projects[pidx], assignedPartners: nextAssigned };

    const threadId = project.main_thread_id || "";
    const companyName = partner.companyName || ppid;
    const dispatchText = `案件手配: ${companyName} を手配しました。`;

    if (threadId && next.threads?.[threadId]) {
      next.threads[threadId] = { ...next.threads[threadId] };
      next.threads[threadId].events = [...(next.threads[threadId].events || [])];
      next.threads[threadId].messages = [...(next.threads[threadId].messages || [])];
      next.threads[threadId].events.push({
        type: "dispatch",
        actor: { id: next.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" },
        ts: nowIso(),
        text: dispatchText,
      });
      next.threads[threadId].messages.push({
        msg_id: uid("msg"),
        from: { id: next.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" },
        ts: nowIso(),
        text: dispatchText,
      });
    }

    api.commit(next);
    api.pushNotification({
      type: "dispatch",
      label: "案件手配完了",
      body: `案件${project.title || pid}にパートナー${companyName}を手配しました。`,
      project_id: pid,
      thread_id: threadId || null,
      href: threadId
        ? mvpThreadHref(threadId)
        : `mvp-project-detail.html?id=${encodeURIComponent(pid)}`,
    });

    return { ok: true, project: next.projects[pidx], partner };
  }

  function renderAdminDispatchProjectCards(projects, selectedProjectId) {
    const rows = Array.isArray(projects) ? projects : getMvpProjects();
    if (!rows.length) {
      return (
        `<div class="builder-admin-empty">` +
        `<p class="builder-admin-empty__title">案件がありません</p>` +
        `<p class="builder-admin-empty__sub">MVP案件を投稿するとここに表示されます。</p>` +
        `</div>`
      );
    }
    const state = mvp().reload();
    return rows
      .map((p) => {
        const dispatched = isProjectDispatched(p);
        const statusMod = dispatched ? "assigned" : "pending";
        const statusLabel = dispatched ? "手配済み" : "未手配";
        const apps = (state.applications || []).filter((a) => a.project_id === p.project_id).length;
        const selected = selectedProjectId === p.project_id ? " is-selected" : "";
        return (
          `<article class="builder-admin-dispatch-card${selected}" data-builder-admin-dispatch-project data-project-id="${esc(p.project_id)}" tabindex="0" role="button">` +
          `<div class="builder-admin-dispatch-card__head">` +
          `<h3 class="builder-admin-dispatch-card__title">${esc(p.title || "—")}</h3>` +
          `<span class="builder-admin-dispatch-status builder-admin-dispatch-status--${esc(statusMod)}">${esc(statusLabel)}</span>` +
          `</div>` +
          `<p class="builder-admin-dispatch-card__meta">応募 ${esc(String(apps))} 件 · 手配 ${esc(String(getProjectAssignedPartners(p).length))} 件</p>` +
          `</article>`
        );
      })
      .join("");
  }

  function renderAdminDispatchProjectDetail(project) {
    const host = document.querySelector("[data-builder-admin-dispatch-project-detail]");
    if (!host) return;
    if (!project) {
      host.innerHTML = `<div class="builder-admin-empty"><p class="builder-admin-empty__title">案件を選択してください</p></div>`;
      return;
    }

    const state = mvp().reload();
    const spec = getProjectSpec(state, project.project_id);
    const kindLabel = project.kind === "tasful_managed" ? "TASFUL案件管理" : "Builder掲示板";
    const area = spec.areaLabel || "—";
    const period = formatJapaneseDateRange(spec.period);
    const budgetText = formatBudget(showcaseBudget(spec.budget, { area, title: project.title || "" }));
    const apps = (state.applications || []).filter((a) => a.project_id === project.project_id).length;
    const assigned = getProjectAssignedPartners(project);
    const assignedNames =
      assigned.map((a) => getAdminPartnerLabel(a.partnerId)).filter(Boolean).join(" · ") || "—";
    const dispatched = assigned.length > 0;
    const statusMod = dispatched ? "assigned" : "pending";
    const statusLabel = dispatched ? "手配済み" : "未手配";
    const projectHref = `mvp-project-detail.html?id=${encodeURIComponent(project.project_id)}`;
    const threadHref = project.main_thread_id
      ? mvpThreadHref(project.main_thread_id)
      : null;

    host.innerHTML =
      `<div class="builder-panel__head">` +
      `<h2 class="builder-section-title">案件サマリー</h2>` +
      `<span class="builder-admin-dispatch-status builder-admin-dispatch-status--${esc(statusMod)}">${esc(statusLabel)}</span>` +
      `</div>` +
      `<div class="builder-admin-dispatch-detail">` +
      `<h3 class="builder-admin-dispatch-detail__title">${esc(project.title || "—")}</h3>` +
      `<dl class="builder-admin-notification-meta">` +
      `<div class="builder-admin-notification-meta__row"><dt>カテゴリ</dt><dd>${esc(kindLabel)}</dd></div>` +
      `<div class="builder-admin-notification-meta__row"><dt>エリア</dt><dd>${esc(area)}</dd></div>` +
      `<div class="builder-admin-notification-meta__row"><dt>予算</dt><dd>${esc(budgetText)}</dd></div>` +
      `<div class="builder-admin-notification-meta__row"><dt>工期</dt><dd>${esc(period)}</dd></div>` +
      `<div class="builder-admin-notification-meta__row"><dt>応募件数</dt><dd>${esc(String(apps))} 件</dd></div>` +
      `<div class="builder-admin-notification-meta__row"><dt>手配済み</dt><dd>${esc(assignedNames)}</dd></div>` +
      `</dl>` +
      `<div class="builder-admin-dispatch-actions">` +
      `<a class="builder-admin-notification-link" href="${esc(projectHref)}">案件詳細 ›</a>` +
      (threadHref ? `<a class="builder-admin-notification-link" href="${esc(threadHref)}">スレッド ›</a>` : "") +
      `</div>` +
      `</div>`;
  }

  function renderAdminDispatchCandidates(selectedProjectId, selectedPartnerId) {
    const host = document.querySelector("[data-builder-admin-dispatch-partner-list]");
    if (!host) return;
    ensureAdminDispatchDemoData();
    const candidates = getAdminDispatchCandidates();
    if (!selectedProjectId) {
      host.innerHTML = `<div class="builder-admin-empty"><p class="builder-admin-empty__sub">案件を選択すると候補が表示されます。</p></div>`;
      return;
    }
    if (!candidates.length) {
      host.innerHTML =
        `<div class="builder-admin-empty">` +
        `<p class="builder-admin-empty__title">候補がありません</p>` +
        `<p class="builder-admin-empty__sub"><a class="builder-admin-notification-link" href="admin-partners.html">パートナー検索</a>から候補を追加してください。</p>` +
        `</div>`;
      return;
    }

    const state = mvp().reload();
    const project = (state.projects || []).find((p) => p.project_id === selectedProjectId);
    const assignedIds = new Set(getProjectAssignedPartners(project).map((a) => a.partnerId));

    host.innerHTML =
      `<div class="builder-admin-dispatch-partner-list">` +
      candidates
        .map((c) => {
          const partner = getAdminPartnerById(c.partnerId);
          if (!partner) return "";
          const selected = selectedPartnerId === c.partnerId ? " is-selected" : "";
          const assigned = assignedIds.has(c.partnerId);
          const trades = (partner.trades || []).join(" · ") || "—";
          return (
            `<article class="builder-admin-dispatch-card builder-admin-dispatch-card--partner${selected}" data-builder-admin-dispatch-candidate data-partner-id="${esc(c.partnerId)}" tabindex="0" role="button">` +
            `<div class="builder-admin-dispatch-card__head">` +
            `<h3 class="builder-admin-dispatch-card__title">${esc(partner.companyName || c.companyName || "—")}</h3>` +
            (assigned ? `<span class="builder-admin-dispatch-status builder-admin-dispatch-status--assigned">手配済</span>` : "") +
            `</div>` +
            `<p class="builder-admin-dispatch-card__meta">担当: ${esc(partner.contactName || "—")} · ${esc(trades)}</p>` +
            `</article>`
          );
        })
        .join("") +
      `</div>`;
  }

  function renderAdminDispatchPartnerDetail(projectId, partnerId) {
    const host = document.querySelector("[data-builder-admin-dispatch-partner-detail]");
    if (!host) return;
    if (!partnerId) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    const partner = getAdminPartnerById(partnerId);
    if (!partner) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }

    const state = mvp().reload();
    const project = projectId ? (state.projects || []).find((p) => p.project_id === projectId) : null;
    const alreadyAssigned = project ? getProjectAssignedPartners(project).some((a) => a.partnerId === partnerId) : false;
    const review = ADMIN_REVIEW_STATUS_UI[partner.reviewStatus] || { label: partner.reviewStatusLabel || "—", mod: "unreviewed" };
    const avail = ADMIN_AVAILABILITY_UI[partner.availability] || { label: partner.availabilityLabel || "—", mod: "active" };

    host.hidden = false;
    host.innerHTML =
      `<div class="builder-panel__head">` +
      `<h2 class="builder-section-title">パートナー詳細</h2>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-admin-dispatch-partner-close>閉じる</button>` +
      `</div>` +
      `<div class="builder-admin-dispatch-detail">` +
      `<h3 class="builder-admin-dispatch-detail__title">${esc(partner.companyName || "—")}</h3>` +
      `<dl class="builder-admin-partner-meta">` +
      `<div class="builder-admin-partner-meta__row"><dt>担当者</dt><dd>${esc(partner.contactName || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>電話</dt><dd>${esc(partner.phone || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>メール</dt><dd>${esc(partner.email || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>エリア</dt><dd>${esc((partner.areas || []).join(" · ") || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>工種</dt><dd>${esc((partner.trades || []).join(" · ") || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>審査</dt><dd>${adminStatusBadge(review.label, review.mod, "review")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>稼働</dt><dd>${adminStatusBadge(avail.label, avail.mod, "availability")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>評価</dt><dd>${esc(Number.isFinite(Number(partner.rating)) ? Number(partner.rating).toFixed(1) : "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>完了案件</dt><dd>${esc(String(partner.completedProjects ?? "—"))} 件</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>メモ</dt><dd>${esc(partner.note || "—")}</dd></div>` +
      `</dl>` +
      `<div class="builder-admin-dispatch-actions">` +
      (projectId && !alreadyAssigned
        ? `<button type="button" class="builder-btn builder-btn--primary" data-builder-admin-dispatch-assign data-project-id="${esc(projectId)}" data-partner-id="${esc(partnerId)}">このパートナーを手配</button>`
        : `<button type="button" class="builder-btn builder-btn--secondary" disabled>${alreadyAssigned ? "手配済み" : "案件を選択してください"}</button>`) +
      `</div>` +
      `</div>`;
  }

  function renderAdminDispatchStats() {
    const projects = getMvpProjects();
    const undispatched = projects.filter((p) => !isProjectDispatched(p)).length;
    const dispatched = projects.length - undispatched;
    const set = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = String(val);
    };
    set("[data-builder-admin-dispatch-stat-undispatched]", undispatched);
    set("[data-builder-admin-dispatch-stat-dispatched]", dispatched);
  }

  function renderAdminDashboardDispatchStat() {
    if (getPage() !== "builder-admin-dashboard") return;
    ensureAdminDispatchDemoData();
    const el = document.querySelector('[data-builder-stat-value="undispatchedProjects"]');
    if (el) el.textContent = `${getUndispatchedProjectCount()}件`;
  }

  function renderAdminDispatchPage() {
    ensureAdminPartnersDemoData();
    ensureAdminDispatchDemoData();
    seedMvpStateIfEmpty();

    const projectListHost = document.querySelector("[data-builder-admin-dispatch-project-list]");
    const candidateHost = document.querySelector("[data-builder-admin-dispatch-partner-list]");
    const detailHost = document.querySelector("[data-builder-admin-dispatch-partner-detail]");
    if (!projectListHost) return;

    let selectedProjectId = getParam("project_id") || "";
    let selectedPartnerId = getParam("partner_id") || "";

    const run = () => {
      renderAdminDispatchStats();
      const projects = getMvpProjects();
      projectListHost.innerHTML = `<div class="builder-admin-dispatch-list">${renderAdminDispatchProjectCards(projects, selectedProjectId)}</div>`;
      const project = projects.find((p) => p.project_id === selectedProjectId) || null;
      renderAdminDispatchProjectDetail(project);
      renderAdminDispatchCandidates(selectedProjectId, selectedPartnerId);
      renderAdminDispatchPartnerDetail(selectedProjectId, selectedPartnerId);
    };

    if (projectListHost.dataset.bound !== "1") {
      projectListHost.dataset.bound = "1";
      projectListHost.addEventListener("click", (ev) => {
        const card = ev.target?.closest?.("[data-builder-admin-dispatch-project]");
        if (!card) return;
        selectedProjectId = card.getAttribute("data-project-id") || "";
        selectedPartnerId = "";
        run();
      });
      projectListHost.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const card = ev.target?.closest?.("[data-builder-admin-dispatch-project]");
        if (!card) return;
        ev.preventDefault();
        selectedProjectId = card.getAttribute("data-project-id") || "";
        selectedPartnerId = "";
        run();
      });

      candidateHost?.addEventListener("click", (ev) => {
        const card = ev.target?.closest?.("[data-builder-admin-dispatch-candidate]");
        if (!card) return;
        selectedPartnerId = card.getAttribute("data-partner-id") || "";
        renderAdminDispatchPartnerDetail(selectedProjectId, selectedPartnerId);
        renderAdminDispatchCandidates(selectedProjectId, selectedPartnerId);
      });
      candidateHost?.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const card = ev.target?.closest?.("[data-builder-admin-dispatch-candidate]");
        if (!card) return;
        ev.preventDefault();
        selectedPartnerId = card.getAttribute("data-partner-id") || "";
        renderAdminDispatchPartnerDetail(selectedProjectId, selectedPartnerId);
        renderAdminDispatchCandidates(selectedProjectId, selectedPartnerId);
      });

      detailHost?.addEventListener("click", (ev) => {
        if (ev.target?.closest?.("[data-builder-admin-dispatch-partner-close]")) {
          selectedPartnerId = "";
          renderAdminDispatchPartnerDetail(selectedProjectId, selectedPartnerId);
          renderAdminDispatchCandidates(selectedProjectId, selectedPartnerId);
          return;
        }
        const assignBtn = ev.target?.closest?.("[data-builder-admin-dispatch-assign]");
        if (!assignBtn) return;
        const projectId = assignBtn.getAttribute("data-project-id") || "";
        const partnerId = assignBtn.getAttribute("data-partner-id") || "";
        const result = assignPartnerToProject(projectId, partnerId);
        if (!result.ok) {
          if (result.error === "duplicate") {
            alert("このパートナーは既に手配済みです。");
          } else {
            alert("手配に失敗しました。");
          }
          return;
        }
        alert(`「${result.partner?.companyName || partnerId}」を手配しました。`);
        run();
      });
    }

    if (!selectedProjectId && getMvpProjects().length) {
      selectedProjectId = getMvpProjects()[0].project_id;
    }
    run();
    document.addEventListener("builder:mvp-changed", run);
  }

  function saveAdminDispatchCandidates(list) {
    try {
      localStorage.setItem(ADMIN_DISPATCH_CANDIDATES_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    } catch {
      // ignore
    }
  }

  function addAdminDispatchCandidate(partner) {
    if (!partner?.id) return false;
    const prev = getAdminDispatchCandidates();
    if (prev.some((c) => c.partnerId === partner.id)) return false;
    const row = {
      id: `candidate-${Date.now()}-${Math.random().toString(16).slice(2, 5)}`,
      partnerId: partner.id,
      companyName: partner.companyName || "—",
      selectedAt: nowIso(),
    };
    saveAdminDispatchCandidates([row, ...prev]);
    return true;
  }

  function filterAdminPartners(filters = {}) {
    const q = String(filters.q || "").trim().toLowerCase();
    const area = String(filters.area || "").trim();
    const trade = String(filters.trade || "").trim();
    const reviewStatus = normalizeReviewStatusKey(filters.reviewStatus);
    const availability = String(filters.availability || "").trim();

    return getAdminPartners().filter((p) => {
      if (reviewStatus && p.reviewStatus !== reviewStatus) return false;
      if (availability && p.availability !== availability) return false;
      if (area && !(p.areas || []).some((a) => String(a).includes(area))) return false;
      if (trade && !(p.trades || []).some((t) => String(t).includes(trade))) return false;
      if (!q) return true;
      const hay = [
        p.companyName,
        p.contactName,
        p.email,
        p.note,
        ...(p.areas || []),
        ...(p.trades || []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function adminStatusBadge(label, mod, kind) {
    return `<span class="builder-admin-status-badge builder-admin-status-badge--${esc(kind)} is-${esc(mod)}">${esc(label)}</span>`;
  }

  function renderAdminPartnerCards(partners) {
    const rows = Array.isArray(partners) ? partners : [];
    if (!rows.length) {
      return (
        `<div class="builder-admin-empty">` +
        `<p class="builder-admin-empty__title">該当するパートナーがありません</p>` +
        `<p class="builder-admin-empty__sub">検索条件を変更してください。</p>` +
        `</div>`
      );
    }
    return rows
      .map((p) => {
        const review = ADMIN_REVIEW_STATUS_UI[p.reviewStatus] || { label: p.reviewStatusLabel || "—", mod: "unreviewed" };
        const avail = ADMIN_AVAILABILITY_UI[p.availability] || { label: p.availabilityLabel || "—", mod: "active" };
        const areas = (p.areas || []).join(" · ") || "—";
        const trades = (p.trades || []).join(" · ") || "—";
        const perf = builderPartnerPerfBlock(p.id, p.companyName);
        return (
          `<article class="builder-admin-partner-card" data-builder-admin-partner-card data-partner-id="${esc(p.id)}">` +
          `<div class="builder-admin-partner-card__head">` +
          `<h3 class="builder-admin-partner-card__title">${esc(p.companyName || "—")}</h3>` +
          `<p class="builder-admin-partner-card__sub">担当: ${esc(p.contactName || "—")}</p>` +
          `</div>` +
          `<dl class="builder-admin-partner-meta">` +
          `<div class="builder-admin-partner-meta__row"><dt>対応エリア</dt><dd>${esc(areas)}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>対応工種</dt><dd>${esc(trades)}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>審査状態</dt><dd>${adminStatusBadge(review.label, review.mod, "review")}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>稼働状態</dt><dd>${adminStatusBadge(avail.label, avail.mod, "availability")}</dd></div>` +
          `<div class="builder-admin-partner-meta__row builder-admin-partner-meta__row--full"><dt>実績評価</dt><dd>${perf || "—"}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>完了案件数</dt><dd>${esc(String(p.completedProjects ?? "—"))} 件</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>メモ</dt><dd>${esc(p.note || "—")}</dd></div>` +
          `</dl>` +
          `<div class="builder-admin-partner-actions">` +
          `<button type="button" class="builder-btn builder-btn--secondary" data-builder-admin-partner-detail="${esc(p.id)}">詳細を見る</button>` +
          `<button type="button" class="builder-btn builder-btn--primary" data-builder-admin-partner-candidate="${esc(p.id)}">案件手配候補にする</button>` +
          `</div>` +
          `</article>`
        );
      })
      .join("");
  }

  function renderAdminPartnerDetailPanel(partner) {
    const host = document.querySelector("[data-builder-admin-partner-detail-panel]");
    if (!host) return;
    if (!partner) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    const review = ADMIN_REVIEW_STATUS_UI[partner.reviewStatus] || { label: partner.reviewStatusLabel || "—", mod: "unreviewed" };
    const avail = ADMIN_AVAILABILITY_UI[partner.availability] || { label: partner.availabilityLabel || "—", mod: "active" };
    host.hidden = false;
    host.innerHTML =
      `<div class="builder-panel__head">` +
      `<h2 class="builder-section-title">パートナー詳細</h2>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-admin-partner-detail-close>閉じる</button>` +
      `</div>` +
      `<div class="builder-admin-partner-detail">` +
      `<h3 class="builder-admin-partner-detail__title">${esc(partner.companyName || "—")}</h3>` +
      `<p class="builder-admin-partner-detail__id">ID: ${esc(partner.id)}</p>` +
      `<dl class="builder-admin-partner-meta">` +
      `<div class="builder-admin-partner-meta__row"><dt>担当者</dt><dd>${esc(partner.contactName || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>電話</dt><dd>${esc(partner.phone || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>メール</dt><dd>${esc(partner.email || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>対応エリア</dt><dd>${esc((partner.areas || []).join(" · ") || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>対応工種</dt><dd>${esc((partner.trades || []).join(" · ") || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>審査状態</dt><dd>${adminStatusBadge(review.label, review.mod, "review")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>稼働状態</dt><dd>${adminStatusBadge(avail.label, avail.mod, "availability")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row builder-admin-partner-meta__row--full"><dt>実績評価</dt><dd>${builderPartnerPerfBlock(partner.id, partner.companyName) || "—"}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>完了案件数</dt><dd>${esc(String(partner.completedProjects ?? "—"))} 件</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>メモ</dt><dd>${esc(partner.note || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>登録日</dt><dd>${esc(partner.createdAt || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>更新日</dt><dd>${esc(partner.updatedAt || "—")}</dd></div>` +
      `</dl>` +
      `<div class="builder-admin-partner-actions">` +
      `<button type="button" class="builder-btn builder-btn--primary" data-builder-admin-partner-candidate="${esc(partner.id)}">案件手配候補にする</button>` +
      `</div>` +
      `</div>`;
  }

  function renderAdminPartnersPage() {
    ensureAdminPartnersDemoData();
    const form = document.querySelector("[data-builder-admin-partner-search-form]");
    const listHost = document.querySelector("[data-builder-admin-partner-list]");
    const kpi = document.querySelector("[data-builder-admin-partner-count]");
    if (!form || !listHost || !kpi) return;

    const qEl = form.querySelector("[data-builder-admin-search-q]");
    const areaEl = form.querySelector("[data-builder-admin-search-area]");
    const tradeEl = form.querySelector("[data-builder-admin-search-trade]");
    const reviewEl = form.querySelector("[data-builder-admin-search-review]");
    const availEl = form.querySelector("[data-builder-admin-search-availability]");

    const readFilters = () => ({
      q: qEl?.value || "",
      area: areaEl?.value || "",
      trade: tradeEl?.value || "",
      reviewStatus: reviewEl?.value || "",
      availability: availEl?.value || "",
    });

    const run = () => {
      const rows = filterAdminPartners(readFilters());
      kpi.textContent = `${rows.length} 件`;
      listHost.innerHTML = `<div class="builder-admin-partner-list">${renderAdminPartnerCards(rows)}</div>`;
    };
    mountAdminCsvExport(document.querySelector("[data-admin-csv-export-host]"));

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      run();
    });
    form.addEventListener("input", run);
    form.addEventListener("change", run);

    const resetBtn = form.querySelector("[data-builder-admin-search-reset]");
    resetBtn?.addEventListener("click", () => {
      if (qEl) qEl.value = "";
      if (areaEl) areaEl.value = "";
      if (tradeEl) tradeEl.value = "";
      if (reviewEl) reviewEl.value = "";
      if (availEl) availEl.value = "";
      renderAdminPartnerDetailPanel(null);
      run();
    });

    if (listHost.dataset.bound !== "1") {
      listHost.dataset.bound = "1";
      listHost.addEventListener("click", (ev) => {
        const detailBtn = ev.target?.closest?.("[data-builder-admin-partner-detail]");
        if (detailBtn) {
          const id = detailBtn.getAttribute("data-builder-admin-partner-detail") || "";
          renderAdminPartnerDetailPanel(getAdminPartnerById(id));
          return;
        }
        const candidateBtn = ev.target?.closest?.("[data-builder-admin-partner-candidate]");
        if (!candidateBtn) return;
        const id = candidateBtn.getAttribute("data-builder-admin-partner-candidate") || "";
        const partner = getAdminPartnerById(id);
        if (!partner) return;
        const added = addAdminDispatchCandidate(partner);
        alert(added ? `「${partner.companyName}」を案件手配候補に追加しました。` : `「${partner.companyName}」は既に候補に登録済みです。`);
      });
    }

    const detailHost = document.querySelector("[data-builder-admin-partner-detail-panel]");
    detailHost?.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("[data-builder-admin-partner-detail-close]")) {
        renderAdminPartnerDetailPanel(null);
      }
      const candidateBtn = ev.target?.closest?.("[data-builder-admin-partner-candidate]");
      if (!candidateBtn) return;
      const id = candidateBtn.getAttribute("data-builder-admin-partner-candidate") || "";
      const partner = getAdminPartnerById(id);
      if (!partner) return;
      const added = addAdminDispatchCandidate(partner);
      alert(added ? `「${partner.companyName}」を案件手配候補に追加しました。` : `「${partner.companyName}」は既に候補に登録済みです。`);
    });

    const detailId = getParam("partner_id");
    if (detailId) renderAdminPartnerDetailPanel(getAdminPartnerById(detailId));

    run();
    document.addEventListener("builder:admin-partners-changed", run);
  }

  function getAdminReviewCounts() {
    const counts = { unreviewed: 0, reviewing: 0, approved: 0, returned: 0, suspended: 0, total: 0 };
    getAdminPartners().forEach((p) => {
      counts.total += 1;
      const key = normalizeReviewStatusKey(p.reviewStatus);
      if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
    });
    return counts;
  }

  function filterAdminReviewPartners(filters = {}) {
    const q = String(filters.q || "").trim().toLowerCase();
    const area = String(filters.area || "").trim();
    const trade = String(filters.trade || "").trim();
    const reviewStatus = normalizeReviewStatusKey(filters.reviewStatus);

    return getAdminPartners().filter((p) => {
      if (reviewStatus && p.reviewStatus !== reviewStatus) return false;
      if (area && !(p.areas || []).some((a) => String(a).includes(area))) return false;
      if (trade && !(p.trades || []).some((t) => String(t).includes(trade))) return false;
      if (!q) return true;
      const hay = [p.companyName, p.contactName].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function pushAdminReviewNotification(partner, reviewStatus) {
    const row = ADMIN_REVIEW_NOTIFICATION[reviewStatus];
    if (!row || !partner?.id) return;
    mvp().pushNotification({
      type: "review",
      label: row.label,
      body: row.body,
      href: `admin-reviews.html?partner_id=${encodeURIComponent(partner.id)}`,
    });
  }

  function updateAdminPartnerReviewStatus(partnerId, reviewStatus) {
    const id = String(partnerId || "").trim();
    const status = normalizeReviewStatusKey(reviewStatus);
    const ui = ADMIN_REVIEW_STATUS_UI[status];
    if (!id || !ui) return false;

    const list = getAdminPartners();
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return false;

    const prev = list[idx];
    if (prev.reviewStatus === status) return true;

    const next = {
      ...prev,
      reviewStatus: status,
      reviewStatusLabel: ui.label,
      updatedAt: nowIso(),
    };
    const updated = [...list];
    updated[idx] = next;
    saveAdminPartners(updated);
    pushAdminReviewNotification(next, status);
    return true;
  }

  function renderAdminReviewCards(partners) {
    const rows = Array.isArray(partners) ? partners : [];
    if (!rows.length) {
      return (
        `<div class="builder-admin-empty">` +
        `<p class="builder-admin-empty__title">該当する審査対象がありません</p>` +
        `<p class="builder-admin-empty__sub">検索条件を変更してください。</p>` +
        `</div>`
      );
    }
    return rows
      .map((p) => {
        const review = ADMIN_REVIEW_STATUS_UI[p.reviewStatus] || { label: p.reviewStatusLabel || "—", mod: "unreviewed" };
        const areas = (p.areas || []).join(" · ") || "—";
        const trades = (p.trades || []).join(" · ") || "—";
        const rating = Number.isFinite(Number(p.rating)) ? Number(p.rating).toFixed(1) : "—";
        return (
          `<article class="builder-admin-review-card" data-builder-admin-review-card data-partner-id="${esc(p.id)}" tabindex="0" role="button">` +
          `<div class="builder-admin-review-card__head">` +
          `<h3 class="builder-admin-review-card__title">${esc(p.companyName || "—")}</h3>` +
          `<p class="builder-admin-review-card__sub">担当: ${esc(p.contactName || "—")}</p>` +
          `</div>` +
          `<dl class="builder-admin-partner-meta">` +
          `<div class="builder-admin-partner-meta__row"><dt>対応工種</dt><dd>${esc(trades)}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>エリア</dt><dd>${esc(areas)}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>評価</dt><dd>${esc(rating)}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>完了案件数</dt><dd>${esc(String(p.completedProjects ?? "—"))} 件</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>審査状態</dt><dd>${adminStatusBadge(review.label, review.mod, "review")}</dd></div>` +
          `</dl>` +
          `</article>`
        );
      })
      .join("");
  }

  function renderAdminReviewDetail(partner) {
    const host = document.querySelector("[data-builder-admin-review-detail-panel]");
    if (!host) return;
    if (!partner) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    const review = ADMIN_REVIEW_STATUS_UI[partner.reviewStatus] || { label: partner.reviewStatusLabel || "—", mod: "unreviewed" };
    host.hidden = false;
    host.innerHTML =
      `<div class="builder-panel__head">` +
      `<h2 class="builder-section-title">審査詳細</h2>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-admin-review-detail-close>閉じる</button>` +
      `</div>` +
      `<div class="builder-admin-review-detail">` +
      `<p class="builder-admin-review-status">${adminStatusBadge(review.label, review.mod, "review")}</p>` +
      `<dl class="builder-admin-partner-meta">` +
      `<div class="builder-admin-partner-meta__row"><dt>会社名</dt><dd>${esc(partner.companyName || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>担当者</dt><dd>${esc(partner.contactName || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>電話</dt><dd>${esc(partner.phone || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>メール</dt><dd>${esc(partner.email || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>エリア</dt><dd>${esc((partner.areas || []).join(" · ") || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>工種</dt><dd>${esc((partner.trades || []).join(" · ") || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>評価</dt><dd>${esc(Number.isFinite(Number(partner.rating)) ? Number(partner.rating).toFixed(1) : "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>完了案件数</dt><dd>${esc(String(partner.completedProjects ?? "—"))} 件</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>メモ</dt><dd>${esc(partner.note || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>登録日</dt><dd>${esc(partner.createdAt || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>更新日</dt><dd>${esc(partner.updatedAt || "—")}</dd></div>` +
      `</dl>` +
      `<div class="builder-admin-review-actions">` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-admin-review-status="${esc(partner.id)}" data-review-status="unreviewed">未審査へ戻す</button>` +
      `<button type="button" class="builder-btn builder-btn--secondary" data-builder-admin-review-status="${esc(partner.id)}" data-review-status="reviewing">審査中</button>` +
      `<button type="button" class="builder-btn builder-btn--primary" data-builder-admin-review-status="${esc(partner.id)}" data-review-status="approved">承認</button>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-admin-review-status="${esc(partner.id)}" data-review-status="returned">差し戻し</button>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-admin-review-status="${esc(partner.id)}" data-review-status="suspended">停止</button>` +
      `</div>` +
      `</div>`;
  }

  function renderAdminReviewStats() {
    const counts = getAdminReviewCounts();
    const set = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = String(val);
    };
    set("[data-builder-admin-review-stat-unreviewed]", counts.unreviewed);
    set("[data-builder-admin-review-stat-reviewing]", counts.reviewing);
    set("[data-builder-admin-review-stat-approved]", counts.approved);
    set("[data-builder-admin-review-stat-returned]", counts.returned);
    set("[data-builder-admin-review-stat-suspended]", counts.suspended);
  }

  function renderAdminDashboardReviewStat() {
    if (getPage() !== "builder-admin-dashboard") return;
    ensureAdminPartnersDemoData();
    const counts = getAdminReviewCounts();
    const el = document.querySelector('[data-builder-stat-value="unreviewedReviews"]');
    if (el) el.textContent = `${counts.unreviewed}件`;
    const partnersEl = document.querySelector('[data-builder-stat-value="registeredPartners"]');
    if (partnersEl) partnersEl.textContent = `${counts.total}社`;
  }

  function renderAdminReviewsPage() {
    ensureAdminPartnersDemoData();
    const form = document.querySelector("[data-builder-admin-review-search-form]");
    const listHost = document.querySelector("[data-builder-admin-review-list]");
    const kpi = document.querySelector("[data-builder-admin-review-count]");
    if (!form || !listHost || !kpi) return;

    const qEl = form.querySelector("[data-builder-admin-review-search-q]");
    const areaEl = form.querySelector("[data-builder-admin-review-search-area]");
    const tradeEl = form.querySelector("[data-builder-admin-review-search-trade]");
    const reviewEl = form.querySelector("[data-builder-admin-review-search-status]");

    let selectedId = getParam("partner_id") || "";

    const readFilters = () => ({
      q: qEl?.value || "",
      area: areaEl?.value || "",
      trade: tradeEl?.value || "",
      reviewStatus: reviewEl?.value || "",
    });

    const run = () => {
      renderAdminReviewStats();
      const rows = filterAdminReviewPartners(readFilters());
      kpi.textContent = `${rows.length} 件`;
      listHost.innerHTML = `<div class="builder-admin-review-list">${renderAdminReviewCards(rows)}</div>`;
      if (selectedId) {
        const partner = rows.find((p) => p.id === selectedId) || getAdminPartnerById(selectedId);
        renderAdminReviewDetail(partner);
      }
    };

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      run();
    });
    form.addEventListener("input", run);
    form.addEventListener("change", run);

    const resetBtn = form.querySelector("[data-builder-admin-review-search-reset]");
    resetBtn?.addEventListener("click", () => {
      if (qEl) qEl.value = "";
      if (areaEl) areaEl.value = "";
      if (tradeEl) tradeEl.value = "";
      if (reviewEl) reviewEl.value = "";
      selectedId = "";
      renderAdminReviewDetail(null);
      run();
    });

    if (listHost.dataset.bound !== "1") {
      listHost.dataset.bound = "1";
      listHost.addEventListener("click", (ev) => {
        const card = ev.target?.closest?.("[data-builder-admin-review-card]");
        if (!card) return;
        selectedId = card.getAttribute("data-partner-id") || "";
        renderAdminReviewDetail(getAdminPartnerById(selectedId));
      });
      listHost.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const card = ev.target?.closest?.("[data-builder-admin-review-card]");
        if (!card) return;
        ev.preventDefault();
        selectedId = card.getAttribute("data-partner-id") || "";
        renderAdminReviewDetail(getAdminPartnerById(selectedId));
      });
    }

    const detailHost = document.querySelector("[data-builder-admin-review-detail-panel]");
    detailHost?.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("[data-builder-admin-review-detail-close]")) {
        selectedId = "";
        renderAdminReviewDetail(null);
        return;
      }
      const btn = ev.target?.closest?.("[data-builder-admin-review-status]");
      if (!btn) return;
      const partnerId = btn.getAttribute("data-builder-admin-review-status") || "";
      const nextStatus = btn.getAttribute("data-review-status") || "";
      if (!updateAdminPartnerReviewStatus(partnerId, nextStatus)) return;
      selectedId = partnerId;
      run();
      renderAdminReviewDetail(getAdminPartnerById(partnerId));
    });

    if (selectedId) renderAdminReviewDetail(getAdminPartnerById(selectedId));
    run();
    document.addEventListener("builder:admin-partners-changed", () => {
      run();
      if (selectedId) renderAdminReviewDetail(getAdminPartnerById(selectedId));
    });
  }

  const ADMIN_NOTIFICATION_TO_UI = {
    all: { label: "全体" },
    users: { label: "利用者" },
    partners: { label: "パートナー" },
  };

  function inferAdminAttachmentType(name) {
    const ext = String(name || "")
      .split(".")
      .pop()
      ?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    return "file";
  }

  function normalizeAdminNotification(raw) {
    const n = raw && typeof raw === "object" ? raw : {};
    const title = String(n.title || n.label || "").trim();
    return {
      id: String(n.id || uid("admin-notif")),
      type: "admin",
      label: title || "運営通知",
      title,
      to: ADMIN_NOTIFICATION_TO_UI[n.to] ? String(n.to) : "all",
      project_id: n.project_id || n.projectId || null,
      project_title: n.project_title || n.projectTitle || null,
      body: String(n.body || ""),
      attachments: Array.isArray(n.attachments) ? n.attachments : [],
      createdAt: String(n.createdAt || nowIso()),
      read: Boolean(n.read),
    };
  }

  function ensureAdminNotificationsDemoData() {
    try {
      const raw = localStorage.getItem(ADMIN_NOTIFICATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return;
      }
      localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, JSON.stringify([]));
    } catch {
      // ignore
    }
  }

  function getAdminNotifications() {
    ensureAdminNotificationsDemoData();
    try {
      const raw = localStorage.getItem(ADMIN_NOTIFICATIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeAdminNotification) : [];
    } catch {
      return [];
    }
  }

  function saveAdminNotifications(list) {
    ensureAdminNotificationsDemoData();
    const rows = (Array.isArray(list) ? list : []).map(normalizeAdminNotification);
    try {
      localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, JSON.stringify(rows));
      document.dispatchEvent(new CustomEvent("builder:admin-notifications-changed"));
    } catch {
      // ignore
    }
  }

  function resolveAdminNotificationLinks(record, state) {
    const pid = record?.project_id || null;
    const project = pid ? (state?.projects || []).find((p) => p.project_id === pid) : null;
    const threadId = project?.main_thread_id || null;
    return {
      projectHref: pid ? `mvp-project-detail.html?id=${encodeURIComponent(pid)}` : null,
      threadHref: threadId ? mvpThreadHref(threadId) : null,
    };
  }

  function syncAdminNotificationToMvp(record, state) {
    if (!record?.id) return;
    const st = state || mvp().reload();
    const links = resolveAdminNotificationLinks(record, st);
    const row = normalizeMvpNotification(
      {
        id: record.id,
        type: "admin",
        label: record.label || record.title || "運営通知",
        title: record.title || record.label || "",
        project_id: record.project_id,
        project_title: record.project_title,
        body: record.body,
        attachments: record.attachments,
        to: record.to,
        createdAt: record.createdAt,
        read: false,
        href: links.projectHref || "index.html",
      },
      st
    );
    saveMvpNotifications([row, ...getMvpNotifications()]);
  }

  function sendAdminNotification(payload = {}) {
    const to = ADMIN_NOTIFICATION_TO_UI[payload.to] ? String(payload.to) : "all";
    const title = String(payload.title || "").trim();
    const body = String(payload.body || "").trim();
    if (!body) return null;

    const state = mvp().reload();
    const projectId = String(payload.project_id || payload.projectId || "").trim() || null;
    const project = projectId ? (state.projects || []).find((p) => p.project_id === projectId) : null;
    const attachmentName = String(payload.attachmentName || payload.attachment || "").trim();
    const attachments = attachmentName ? [{ name: attachmentName, type: inferAdminAttachmentType(attachmentName) }] : [];

    const record = normalizeAdminNotification({
      id: uid("admin-notif"),
      type: "admin",
      label: title || "運営通知",
      title,
      to,
      project_id: projectId,
      project_title: project?.title || null,
      body,
      attachments,
      createdAt: nowIso(),
      read: false,
    });

    saveAdminNotifications([record, ...getAdminNotifications()]);
    syncAdminNotificationToMvp(record, state);
    return record;
  }

  function formatAdminNotificationDate(iso) {
    try {
      const d = new Date(String(iso || ""));
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString("ja-JP");
    } catch {
      return "—";
    }
  }

  function renderAdminNotificationCard(record) {
    const n = normalizeAdminNotification(record);
    const toLabel = ADMIN_NOTIFICATION_TO_UI[n.to]?.label || n.to || "—";
    const state = mvp().reload();
    const links = resolveAdminNotificationLinks(n, state);
    const attachHtml = n.attachments?.length
      ? `<ul class="builder-admin-notification-attachments">${n.attachments
          .map((f) => `<li>${esc(f.name || "—")}</li>`)
          .join("")}</ul>`
      : "";
    const linkHtml =
      (links.projectHref ? `<a class="builder-admin-notification-link" href="${esc(links.projectHref)}">案件詳細 ›</a>` : "") +
      (links.threadHref ? `<a class="builder-admin-notification-link" href="${esc(links.threadHref)}">スレッド ›</a>` : "") +
      `<a class="builder-admin-notification-link" href="mvp-notifications.html">通知一覧 ›</a>`;

    return (
      `<article class="builder-admin-notification-card" data-admin-notification-id="${esc(n.id)}">` +
      `<div class="builder-admin-notification-card__head">` +
      `<h3 class="builder-admin-notification-card__title">${esc(n.label || n.title || "運営通知")}</h3>` +
      `<time class="builder-admin-notification-card__time" datetime="${esc(n.createdAt)}">${esc(formatAdminNotificationDate(n.createdAt))}</time>` +
      `</div>` +
      `<dl class="builder-admin-notification-meta">` +
      `<div class="builder-admin-notification-meta__row"><dt>送信先</dt><dd>${esc(toLabel)}</dd></div>` +
      `<div class="builder-admin-notification-meta__row"><dt>案件</dt><dd>${esc(n.project_title || "—")}</dd></div>` +
      `<div class="builder-admin-notification-meta__row"><dt>本文</dt><dd>${esc(n.body || "—")}</dd></div>` +
      (attachHtml ? `<div class="builder-admin-notification-meta__row"><dt>添付</dt><dd>${attachHtml}</dd></div>` : "") +
      `</dl>` +
      `<div class="builder-admin-notification-actions">${linkHtml}</div>` +
      `</article>`
    );
  }

  function renderAdminDashboardNotificationStat() {
    if (getPage() !== "builder-admin-dashboard") return;
    ensureAdminNotificationsDemoData();
    const el = document.querySelector('[data-builder-stat-value="adminNotifications"]');
    if (el) el.textContent = `${getAdminNotifications().length}件`;
  }

  function renderAdminNotificationsPage() {
    ensureAdminNotificationsDemoData();
    const form = document.querySelector("[data-builder-admin-notification-form]");
    const historyHost = document.querySelector("[data-builder-admin-notification-history]");
    const countEl = document.querySelector("[data-builder-admin-notification-count]");
    if (!form || !historyHost) return;

    const projectEl = form.querySelector("[data-builder-admin-notif-project]");
    const state = mvp().reload();
    if (projectEl && projectEl.options.length <= 1) {
      (state.projects || []).forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.project_id;
        opt.textContent = p.title || p.project_id;
        projectEl.appendChild(opt);
      });
    }

    const renderHistory = () => {
      const rows = getAdminNotifications()
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 10);
      if (countEl) countEl.textContent = `${getAdminNotifications().length} 件`;
      historyHost.innerHTML = rows.length
        ? rows.map(renderAdminNotificationCard).join("")
        : `<div class="builder-admin-empty"><p class="builder-admin-empty__title">送信履歴はありません</p><p class="builder-admin-empty__sub">通知を送信するとここに表示されます。</p></div>`;
    };

    if (form.dataset.bound !== "1") {
      form.dataset.bound = "1";
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const to = form.querySelector("[data-builder-admin-notif-to]")?.value || "all";
        const project_id = form.querySelector("[data-builder-admin-notif-project]")?.value || "";
        const title = form.querySelector("[data-builder-admin-notif-title]")?.value || "";
        const body = form.querySelector("[data-builder-admin-notif-body]")?.value || "";
        const attachmentName = form.querySelector("[data-builder-admin-notif-attachment]")?.value || "";
        const sent = sendAdminNotification({ to, project_id, title, body, attachmentName });
        if (!sent) {
          alert("本文を入力してください。");
          return;
        }
        form.querySelector("[data-builder-admin-notif-title]").value = "";
        form.querySelector("[data-builder-admin-notif-body]").value = "";
        form.querySelector("[data-builder-admin-notif-attachment]").value = "";
        renderHistory();
        alert("通知を送信しました。");
      });
    }

    renderHistory();
    document.addEventListener("builder:admin-notifications-changed", renderHistory);
  }

  const ADMIN_APPLICATION_STATUS_UI = {
    pending: { label: "保留", mod: "pending" },
    selected: { label: "選定", mod: "selected" },
    rejected: { label: "却下", mod: "rejected" },
  };

  const DEMO_APPLICATION_ENRICHMENTS = {
    "demo-project-001:demo-partner-001": {
      application_id: "app-demo-001",
      contact_name: "田中 建一",
      phone: "090-1234-5678",
      email: "orange-kensou@example.com",
      desired_amount: "75万円〜85万円",
      memo: "足場経験豊富。近隣配慮対応可。",
      body: "条件確認のうえ応募します。日程調整可能です。",
      attachments: [{ name: "見積概算.pdf", type: "pdf" }],
    },
    "demo-project-001:demo-partner-002": {
      application_id: "app-demo-002",
      contact_name: "鈴木 足場",
      phone: "080-9876-5432",
      email: "scaffold-works@example.com",
      desired_amount: "68万円",
      memo: "小規模足場に強み。即日見積可能。",
      body: "安全第一で対応します。現場写真報告も可能です。",
      attachments: [{ name: "安全書類サンプル.pdf", type: "pdf" }, { name: "実績写真_01.jpg", type: "image" }],
    },
  };

  function adminApplicationId(app) {
    return String(app?.application_id || `${app?.project_id || ""}:${app?.partner_id || ""}`).trim();
  }

  function resolveAdminApplicationStatus(app, project) {
    const selectedIds = Array.isArray(project?.selected_partner_ids) ? project.selected_partner_ids : [];
    if (selectedIds.includes(app.partner_id)) return "selected";
    const raw = app?.status || "applied";
    if (raw === "selected") return "selected";
    if (raw === "rejected") return "rejected";
    return "pending";
  }

  function ensureAdminApplicationsDemoData() {
    const api = mvp();
    const state = api.reload();
    let changed = false;
    const nextApps = (state.applications || []).map((a) => {
      const key = `${a.project_id}:${a.partner_id}`;
      const extra = DEMO_APPLICATION_ENRICHMENTS[key] || {};
      const application_id = a.application_id || extra.application_id || adminApplicationId(a);
      const patched = {
        ...a,
        ...extra,
        application_id,
        project_id: a.project_id,
        partner_id: a.partner_id,
        status: a.status || "applied",
        ts: a.ts || nowIso(),
      };
      if (JSON.stringify(patched) !== JSON.stringify(a)) changed = true;
      return patched;
    });
    if (changed) api.commit({ ...state, applications: nextApps });
  }

  function enrichAdminApplication(app, state) {
    const project = (state.projects || []).find((p) => p.project_id === app.project_id) || DEMO_PROJECTS.find((p) => p.project_id === app.project_id);
    const partner =
      (state.partners || []).find((p) => p.partner_id === app.partner_id) ||
      DEMO_PARTNERS.find((p) => p.partner_id === app.partner_id);
    const spec = state.specs?.[app.project_id] || DEMO_PROJECT_SPECS[app.project_id] || {};
    const adminStatus = resolveAdminApplicationStatus(app, project);
    const statusUi = ADMIN_APPLICATION_STATUS_UI[adminStatus] || ADMIN_APPLICATION_STATUS_UI.pending;
    const area =
      spec.area?.label ||
      (spec.area_codes || []).map(formatArea).join("・") ||
      (partner?.areas || []).map(formatArea).join("・") ||
      "—";
    const id = adminApplicationId(app);
    return {
      id,
      application_id: id,
      project_id: app.project_id,
      partner_id: app.partner_id,
      projectTitle: project?.title || app.project_id || "—",
      companyName: partner?.display_name || app.partner_id || "—",
      contactName: app.contact_name || "—",
      phone: app.phone || "—",
      email: app.email || "—",
      area,
      appliedAt: app.ts || app.updated_at || "",
      adminStatus,
      statusLabel: statusUi.label,
      statusMod: statusUi.mod,
      desiredAmount: app.desired_amount || app.desiredAmount || "",
      memo: app.memo || partner?.headline || "",
      body: app.body || app.message || partner?.profile || "応募しました。",
      attachments: Array.isArray(app.attachments) ? app.attachments : [],
    };
  }

  function getAdminApplications() {
    ensureAdminApplicationsDemoData();
    const state = mvp().reload();
    return (state.applications || [])
      .map((a) => enrichAdminApplication(a, state))
      .sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)));
  }

  function getAdminApplicationById(applicationId) {
    const id = String(applicationId || "").trim();
    if (!id) return null;
    return getAdminApplications().find((a) => a.id === id || a.application_id === id) || null;
  }

  function filterAdminApplications(filters = {}) {
    const q = String(filters.q || "").trim().toLowerCase();
    const status = String(filters.status || "").trim();
    const area = String(filters.area || "").trim();

    return getAdminApplications().filter((a) => {
      if (status && a.adminStatus !== status) return false;
      if (area && !String(a.area || "").includes(area)) return false;
      if (!q) return true;
      const hay = [a.projectTitle, a.companyName, a.contactName, a.memo, a.body, a.area]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function formatAdminApplicationDate(iso) {
    try {
      const d = new Date(String(iso || ""));
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString("ja-JP");
    } catch {
      return "—";
    }
  }

  function adminApplicationStatusBadge(app) {
    return `<span class="builder-admin-application-status is-${esc(app.statusMod)}">${esc(app.statusLabel)}</span>`;
  }

  function pushAdminApplicationStatusNotification({ applicationId, projectId, projectTitle, adminStatus }) {
    const map = {
      selected: { label: "案件応募承認", body: "案件応募が承認されました。" },
      rejected: { label: "応募却下", body: "応募ステータスが却下に変更されました。" },
      pending: { label: "応募保留", body: "応募ステータスが保留に変更されました。" },
    };
    const row = map[adminStatus];
    if (!row) return;
    mvp().pushNotification({
      type: "application",
      label: row.label,
      project_id: projectId || "",
      projectTitle: projectTitle || "",
      body: row.body,
      href: `admin-applications.html?application_id=${encodeURIComponent(applicationId || "")}`,
    });
  }

  function updateAdminApplicationStatus(applicationId, adminStatus) {
    const id = String(applicationId || "").trim();
    const nextStatus = String(adminStatus || "").trim();
    if (!id || !ADMIN_APPLICATION_STATUS_UI[nextStatus]) return false;

    const api = mvp();
    const state = api.reload();
    const apps = [...(state.applications || [])];
    const idx = apps.findIndex((a) => adminApplicationId(a) === id);
    if (idx < 0) return false;

    const app = apps[idx];
    const pidx = (state.projects || []).findIndex((p) => p.project_id === app.project_id);
    if (pidx < 0) return false;

    const pr = { ...(state.projects[pidx] || {}) };
    const required = Number(pr.required_partners || 1);
    let selectedIds = Array.isArray(pr.selected_partner_ids) ? [...pr.selected_partner_ids] : [];
    const partnerId = app.partner_id;
    const projectId = app.project_id;
    let nextApps = apps.map((a) => ({ ...a }));

    if (nextStatus === "selected") {
      if (!selectedIds.includes(partnerId)) selectedIds.push(partnerId);
      if (required === 1) {
        nextApps = nextApps.map((a) => {
          if (a.project_id !== projectId) return a;
          if (a.partner_id === partnerId) return { ...a, status: "selected", updated_at: nowIso() };
          if ((a.status || "applied") === "applied" || a.status === "selected") {
            return { ...a, status: "rejected", updated_at: nowIso() };
          }
          return a;
        });
        selectedIds = [partnerId];
      } else {
        nextApps[idx] = { ...app, status: "selected", updated_at: nowIso() };
      }
    } else if (nextStatus === "rejected") {
      selectedIds = selectedIds.filter((x) => x !== partnerId);
      nextApps[idx] = { ...app, status: "rejected", updated_at: nowIso() };
    } else {
      selectedIds = selectedIds.filter((x) => x !== partnerId);
      nextApps[idx] = { ...app, status: "applied", updated_at: nowIso() };
    }

    pr.selected_partner_ids = selectedIds;
    const next = {
      ...state,
      applications: nextApps,
      projects: [...(state.projects || [])],
    };
    next.projects[pidx] = pr;

    const threadId = pr.main_thread_id;
    if (threadId && next.threads?.[threadId]) {
      const opLabel = nextStatus === "selected" ? "選定" : nextStatus === "rejected" ? "却下" : "保留";
      next.threads = {
        ...next.threads,
        [threadId]: {
          ...next.threads[threadId],
          events: [
            ...(next.threads[threadId].events || []),
            {
              type: nextStatus === "selected" ? "selected" : nextStatus === "rejected" ? "rejected" : "application",
              actor: { id: state.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" },
              ts: nowIso(),
              text: `運営操作: ${opLabel} (${partnerLabel(next, partnerId)})`,
            },
          ],
        },
      };
    }

    api.commit(next);
    pushAdminApplicationStatusNotification({
      applicationId: id,
      projectId,
      projectTitle: pr.title || "",
      adminStatus: nextStatus,
    });
    return true;
  }

  function renderAdminApplicationCards(applications) {
    const rows = Array.isArray(applications) ? applications : [];
    if (!rows.length) {
      return (
        `<div class="builder-admin-empty">` +
        `<p class="builder-admin-empty__title">応募がありません</p>` +
        `<p class="builder-admin-empty__sub">案件への応募が表示されます。</p>` +
        `</div>`
      );
    }
    return rows
      .map(
        (a) =>
          `<article class="builder-admin-application-card" data-builder-admin-application-card data-application-id="${esc(a.id)}" tabindex="0" role="button">` +
          `<div class="builder-admin-application-card__head">` +
          `<h3 class="builder-admin-application-card__title">${esc(a.projectTitle)}</h3>` +
          `${adminApplicationStatusBadge(a)}` +
          `</div>` +
          `<p class="builder-admin-application-card__company">${esc(a.companyName)}</p>` +
          `<dl class="builder-admin-partner-meta">` +
          `<div class="builder-admin-partner-meta__row"><dt>担当者</dt><dd>${esc(a.contactName || "—")}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>エリア</dt><dd>${esc(a.area || "—")}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>応募日時</dt><dd>${esc(formatAdminApplicationDate(a.appliedAt))}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>希望金額</dt><dd>${esc(a.desiredAmount || "—")}</dd></div>` +
          `<div class="builder-admin-partner-meta__row"><dt>メモ</dt><dd>${esc(a.memo || "—")}</dd></div>` +
          `</dl>` +
          `</article>`
      )
      .join("");
  }

  function renderAdminApplicationDetail(app) {
    const host = document.querySelector("[data-builder-admin-application-detail-panel]");
    if (!host) return;
    if (!app) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    const attachHtml = app.attachments?.length
      ? `<ul class="builder-admin-application-attachments">${app.attachments
          .map((f) => `<li>${esc(f.name || "—")}</li>`)
          .join("")}</ul>`
      : `<p class="builder-admin-empty__sub">添付資料なし</p>`;

    host.hidden = false;
    host.innerHTML =
      `<div class="builder-panel__head">` +
      `<h2 class="builder-section-title">応募詳細</h2>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-admin-application-detail-close>閉じる</button>` +
      `</div>` +
      `<div class="builder-admin-application-detail">` +
      `<p class="builder-admin-application-detail__status">${adminApplicationStatusBadge(app)}</p>` +
      `<dl class="builder-admin-partner-meta">` +
      `<div class="builder-admin-partner-meta__row"><dt>案件名</dt><dd>${esc(app.projectTitle)}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>応募会社</dt><dd>${esc(app.companyName)}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>担当者</dt><dd>${esc(app.contactName || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>電話</dt><dd>${esc(app.phone || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>メール</dt><dd>${esc(app.email || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>エリア</dt><dd>${esc(app.area || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>応募内容</dt><dd>${esc(app.body || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>応募日時</dt><dd>${esc(formatAdminApplicationDate(app.appliedAt))}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>希望金額</dt><dd>${esc(app.desiredAmount || "—")}</dd></div>` +
      `<div class="builder-admin-partner-meta__row"><dt>添付資料</dt><dd>${attachHtml}</dd></div>` +
      `</dl>` +
      `<div class="builder-admin-application-actions">` +
      `<button type="button" class="builder-btn builder-btn--primary" data-builder-admin-app-select="${esc(app.id)}">選定</button>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-admin-app-reject="${esc(app.id)}">却下</button>` +
      `<button type="button" class="builder-btn builder-btn--secondary" data-builder-admin-app-pending="${esc(app.id)}">保留へ戻す</button>` +
      `</div>` +
      `</div>`;
  }

  function renderAdminApplicationStats(applications) {
    const rows = Array.isArray(applications) ? applications : getAdminApplications();
    const counts = { total: rows.length, pending: 0, selected: 0, rejected: 0 };
    rows.forEach((a) => {
      if (a.adminStatus === "selected") counts.selected += 1;
      else if (a.adminStatus === "rejected") counts.rejected += 1;
      else counts.pending += 1;
    });
    const set = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = String(val);
    };
    set("[data-builder-admin-app-stat-total]", counts.total);
    set("[data-builder-admin-app-stat-pending]", counts.pending);
    set("[data-builder-admin-app-stat-selected]", counts.selected);
    set("[data-builder-admin-app-stat-rejected]", counts.rejected);
  }

  function renderAdminDashboardApplicationStat() {
    if (getPage() !== "builder-admin-dashboard") return;
    ensureAdminApplicationsDemoData();
    const el = document.querySelector('[data-builder-stat-value="applications"]');
    if (el) el.textContent = `${getAdminApplications().length}件`;
  }

  function renderAdminApplicationsPage() {
    ensureAdminApplicationsDemoData();
    const form = document.querySelector("[data-builder-admin-application-search-form]");
    const listHost = document.querySelector("[data-builder-admin-application-list]");
    const kpi = document.querySelector("[data-builder-admin-application-count]");
    if (!form || !listHost || !kpi) return;

    const qEl = form.querySelector("[data-builder-admin-app-search-q]");
    const statusEl = form.querySelector("[data-builder-admin-app-search-status]");
    const areaEl = form.querySelector("[data-builder-admin-app-search-area]");

    const readFilters = () => ({
      q: qEl?.value || "",
      status: statusEl?.value || "",
      area: areaEl?.value || "",
    });

    const refresh = () => {
      const rows = filterAdminApplications(readFilters());
      kpi.textContent = `${rows.length} 件`;
      renderAdminApplicationStats(getAdminApplications());
      listHost.innerHTML = `<div class="builder-admin-application-list">${renderAdminApplicationCards(rows)}</div>`;
      const activeId = document.querySelector("[data-builder-admin-application-detail-panel]")?.dataset?.activeId || "";
      if (activeId) renderAdminApplicationDetail(getAdminApplicationById(activeId));
    };

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      refresh();
    });
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);

    form.querySelector("[data-builder-admin-app-search-reset]")?.addEventListener("click", () => {
      if (qEl) qEl.value = "";
      if (statusEl) statusEl.value = "";
      if (areaEl) areaEl.value = "";
      renderAdminApplicationDetail(null);
      refresh();
    });

    const handleStatusUpdate = (applicationId, status) => {
      if (!updateAdminApplicationStatus(applicationId, status)) {
        alert("応募の更新に失敗しました。");
        return;
      }
      refresh();
      renderAdminApplicationDetail(getAdminApplicationById(applicationId));
    };

    if (listHost.dataset.bound !== "1") {
      listHost.dataset.bound = "1";
      listHost.addEventListener("click", (ev) => {
        const card = ev.target?.closest?.("[data-builder-admin-application-card]");
        if (!card) return;
        const id = card.getAttribute("data-application-id") || "";
        const panel = document.querySelector("[data-builder-admin-application-detail-panel]");
        if (panel) panel.dataset.activeId = id;
        renderAdminApplicationDetail(getAdminApplicationById(id));
      });
      listHost.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const card = ev.target?.closest?.("[data-builder-admin-application-card]");
        if (!card) return;
        ev.preventDefault();
        const id = card.getAttribute("data-application-id") || "";
        const panel = document.querySelector("[data-builder-admin-application-detail-panel]");
        if (panel) panel.dataset.activeId = id;
        renderAdminApplicationDetail(getAdminApplicationById(id));
      });
    }

    const detailHost = document.querySelector("[data-builder-admin-application-detail-panel]");
    detailHost?.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("[data-builder-admin-application-detail-close]")) {
        if (detailHost) delete detailHost.dataset.activeId;
        renderAdminApplicationDetail(null);
        return;
      }
      const sel = ev.target?.closest?.("[data-builder-admin-app-select]");
      const rej = ev.target?.closest?.("[data-builder-admin-app-reject]");
      const pend = ev.target?.closest?.("[data-builder-admin-app-pending]");
      const btn = sel || rej || pend;
      if (!btn) return;
      const id =
        btn.getAttribute("data-builder-admin-app-select") ||
        btn.getAttribute("data-builder-admin-app-reject") ||
        btn.getAttribute("data-builder-admin-app-pending") ||
        "";
      if (sel) handleStatusUpdate(id, "selected");
      else if (rej) handleStatusUpdate(id, "rejected");
      else if (pend) handleStatusUpdate(id, "pending");
    });

    document.addEventListener("builder:mvp-changed", refresh);

    const openId = getParam("application_id");
    if (openId) {
      const panel = document.querySelector("[data-builder-admin-application-detail-panel]");
      if (panel) panel.dataset.activeId = openId;
      renderAdminApplicationDetail(getAdminApplicationById(openId));
    }

    refresh();
  }

  function filterPartners({ q, trade, area, availability }) {
    const qq = String(q || "").trim().toLowerCase();
    return DEMO_PARTNERS.filter((p) => {
      if (globalThis.TasuBuilderPartnerEval?.isPartnerHidden?.(p.partner_id, p.display_name)) {
        return false;
      }
      if (trade && !(p.trades || []).includes(trade)) return false;
      if (area && !(p.areas || []).includes(area)) return false;
      if (availability && p.availability !== availability) return false;
      if (!qq) return true;
      const hay = `${p.display_name} ${p.headline} ${(p.trades || []).join(" ")} ${(p.areas || []).join(
        " "
      )}`.toLowerCase();
      return hay.includes(qq);
    });
  }

  function renderPartnerSearchPage() {
    const form = document.querySelector("[data-builder-partner-search-form]");
    const list = document.querySelector("[data-builder-partner-results]");
    const kpi = document.querySelector("[data-builder-partner-results-kpi]");
    if (!form || !list || !kpi) return;

    const qEl = form.querySelector("[data-builder-search-q]");
    const tradeEl = form.querySelector("[data-builder-search-trade]");
    const areaEl = form.querySelector("[data-builder-search-area]");
    const availEl = form.querySelector("[data-builder-search-availability]");

    const run = () => {
      const query = {
        q: qEl?.value || "",
        trade: tradeEl?.value || "",
        area: areaEl?.value || "",
        availability: availEl?.value || "",
      };
      const rows = filterPartners(query);
      kpi.textContent = `${rows.length} 件`;
      list.innerHTML = rows.map((p) => buildPartnerListItem(p, { showFav: true })).join("");
    };

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      run();
    });

    const resetBtn = form.querySelector("[data-builder-search-reset]");
    resetBtn?.addEventListener("click", () => {
      if (qEl) qEl.value = "";
      if (tradeEl) tradeEl.value = "";
      if (areaEl) areaEl.value = "";
      if (availEl) availEl.value = "";
      run();
    });

    bindFavoriteButtons(list);
    document.addEventListener("builder:favorites-changed", () => run());

    run();
  }

  function renderFavoritesPage() {
    const list = document.querySelector("[data-builder-favorite-list]");
    if (!list) return;
    const favorites = DEMO_PARTNERS.filter((p) => DEMO_FAVORITES.has(p.partner_id));
    list.innerHTML = favorites.map((p) => buildPartnerListItem(p, { showFav: false })).join("");
  }

  function renderPartnerDetailPage() {
    const id = getParam("partner_id") || "demo-partner-001";
    const p = DEMO_PARTNERS.find((x) => x.partner_id === id) || DEMO_PARTNERS[0];
    if (!p) return;

    setText("[data-builder-partner-name]", p.display_name);
    const meta = `${(p.trades || []).map(formatTrade).join("・")} · ${(p.areas || [])
      .map(formatArea)
      .join("・")}`;
    setText("[data-builder-partner-meta]", meta || "—");
    setText("[data-builder-partner-headline]", p.profile || p.headline || "—");
    setText("[data-builder-partner-contact]", formatContactPolicy(p.contact_policy));

    const tags = document.querySelector("[data-builder-partner-tags]");
    if (tags) {
      const items = [
        ...(p.trades || []).map((t) => `工種: ${formatTrade(t)}`),
        ...(p.areas || []).map((a) => `エリア: ${formatArea(a)}`),
        `稼働: ${
          p.availability === "available" ? "空きあり" : p.availability === "limited" ? "一部可" : "満枠"
        }`,
        `状態: ${p.status === "paused" ? "休止中" : "稼働中"}`,
      ];
      tags.innerHTML = items.map((x) => `<li class="builder-tag">${esc(x)}</li>`).join("");
    }

    const favBtn = document.querySelector("[data-builder-fav-toggle]");
    if (favBtn) {
      const apply = () => {
        const fav = DEMO_FAVORITES.has(p.partner_id);
        favBtn.textContent = fav ? "お気に入り解除" : "お気に入りに追加";
      };
      apply();
      favBtn.addEventListener("click", () => {
        if (DEMO_FAVORITES.has(p.partner_id)) DEMO_FAVORITES.delete(p.partner_id);
        else DEMO_FAVORITES.add(p.partner_id);
        apply();
        document.dispatchEvent(new CustomEvent("builder:favorites-changed"));
      });
    }

    const reLink = document.querySelector("[data-builder-re-request-link]");
    if (reLink) reLink.setAttribute("href", `re-request.html?partner_id=${encodeURIComponent(p.partner_id)}`);
  }

  function buildTemplateListItem(tpl) {
    const kinds = { tasful_managed: "TASFUL案件管理", builder_board: "Builder掲示板" };
    const visibilityLabel = formatVisibility(tpl.default_visibility || "private");
    const contactLabel = formatContactPolicy(tpl.default_contact_policy || "tasful_talk_only");
    const trades = (tpl.spec_snapshot?.trade_tags || []).map(formatTrade).join("・") || "—";
    const areas = (tpl.spec_snapshot?.area_codes || []).map(formatArea).join("・") || "—";
    return (
      `<li class="builder-list-item" data-builder-template-row data-template-id="${esc(tpl.template_id)}">` +
      `<div class="builder-list-item__icon" aria-hidden="true">` +
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
      `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>` +
      `</svg>` +
      `</div>` +
      `<div class="builder-list-item__main">` +
      `<p class="builder-list-item__title">${esc(tpl.name)}</p>` +
      `<p class="builder-list-item__sub">${esc(kinds[tpl.default_kind] || tpl.default_kind)} · ${esc(
        visibilityLabel
      )}</p>` +
      `<p class="builder-list-item__sub">${esc(contactLabel)}</p>` +
      `<p class="builder-list-item__sub">${esc(trades)} · ${esc(areas)}</p>` +
      `</div>` +
      `<div class="builder-list-item__actions">` +
      `<a class="builder-btn builder-btn--secondary" href="template-edit.html?template_id=${esc(
        tpl.template_id
      )}" data-builder-template-edit>編集</a>` +
      `<a class="builder-btn builder-btn--ghost" href="re-request.html?template_id=${esc(
        tpl.template_id
      )}" data-builder-template-use>再依頼</a>` +
      `</div>` +
      `</li>`
    );
  }

  function renderTemplatesPage() {
    const list = document.querySelector("[data-builder-template-list]");
    if (!list) return;
    list.innerHTML = DEMO_TEMPLATES.map(buildTemplateListItem).join("");
  }

  function renderTemplateEditPage() {
    const form = document.querySelector("[data-builder-template-form]");
    const kpi = document.querySelector("[data-builder-template-edit-kpi]");
    if (!form || !kpi) return;

    const id = getParam("template_id") || "demo-template-001";
    const isNew = id === "new";
    const tpl = isNew
      ? {
          template_id: "new",
          owner_id: OWNER_ID,
          name: "",
          visibility: "private",
          default_kind: "builder_board",
          spec_snapshot: { trade_tags: [], area_codes: [], description: "" },
        }
      : DEMO_TEMPLATES.find((t) => t.template_id === id) || DEMO_TEMPLATES[0];

    kpi.textContent = isNew ? "新規" : `template_id: ${tpl.template_id}`;

    const nameEl = form.querySelector("[data-builder-template-name]");
    const kindEl = form.querySelector("[data-builder-template-kind]");
    const visEl = form.querySelector("[data-builder-template-visibility]");
    const cpEl = form.querySelector("[data-builder-template-contact-policy]");
    const tradesEl = form.querySelector("[data-builder-template-trades]");
    const areasEl = form.querySelector("[data-builder-template-areas]");
    const descEl = form.querySelector("[data-builder-template-desc]");
    const callouts = document.querySelector("[data-builder-template-callouts]");

    if (nameEl) nameEl.value = tpl.name || "";
    if (kindEl) kindEl.value = tpl.default_kind || "builder_board";
    if (visEl) visEl.value = tpl.default_visibility || "partner_only";
    if (cpEl) cpEl.value = tpl.default_contact_policy || "tasful_talk_only";
    if (tradesEl) tradesEl.value = (tpl.spec_snapshot?.trade_tags || []).join(", ");
    if (areasEl) areasEl.value = (tpl.spec_snapshot?.area_codes || []).join(", ");
    if (descEl) descEl.value = tpl.spec_snapshot?.description || "";

    const rerenderTemplateHelp = () => {
      renderPolicyHints({ visibility: visEl?.value, contact_policy: cpEl?.value });
      if (!callouts) return;
      const items = [];
      const v = VISIBILITY_UI[visEl?.value];
      if (v)
        items.push(
          buildCalloutHtml({
            title: "公開範囲（デフォルト）",
            text: `${v.label}：${v.desc}`,
            tone: "warning",
          })
        );
      const cp = CONTACT_POLICY_UI[cpEl?.value];
      if (cp)
        items.push(
          buildCalloutHtml({
            title: "連絡ポリシー（デフォルト）",
            text: `${cp.label}：${cp.desc}`,
            tone: "warning",
          })
        );
      if (cp?.danger && cpEl?.value === "tasful_talk_only") {
        items.push(buildCalloutHtml({ title: "注意", text: cp.danger, tone: "danger" }));
      }
      callouts.innerHTML = items.join("");
    };
    visEl?.addEventListener("change", rerenderTemplateHelp);
    cpEl?.addEventListener("change", rerenderTemplateHelp);
    rerenderTemplateHelp();

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const next = {
        template_id: isNew ? `demo-template-${String(DEMO_TEMPLATES.length + 1).padStart(3, "0")}` : tpl.template_id,
        owner_id: OWNER_ID,
        name: String(nameEl?.value || "").trim() || "無題テンプレ",
        visibility: tpl.visibility || "private",
        default_kind: kindEl?.value || "builder_board",
        default_visibility: visEl?.value || "partner_only",
        default_contact_policy: cpEl?.value || "tasful_talk_only",
        spec_snapshot: {
          trade_tags: String(tradesEl?.value || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          area_codes: String(areasEl?.value || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          description: String(descEl?.value || "").trim(),
        },
        created_at: tpl.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (isNew) DEMO_TEMPLATES.unshift(next);
      else {
        const idx = DEMO_TEMPLATES.findIndex((t) => t.template_id === tpl.template_id);
        if (idx >= 0) DEMO_TEMPLATES[idx] = { ...DEMO_TEMPLATES[idx], ...next };
      }
      window.location.href = "templates.html";
    });
  }

  function buildMetaRow(label, value) {
    return (
      `<div class="builder-meta__row">` +
      `<div class="builder-meta__label">${esc(label)}</div>` +
      `<div class="builder-meta__value">${esc(value)}</div>` +
      `</div>`
    );
  }

  function renderProjectDetailPage() {
    const id = getParam("project_id") || "demo-project-001";
    const p = DEMO_PROJECTS.find((x) => x.project_id === id) || DEMO_PROJECTS[0];
    if (!p) return;
    const spec = DEMO_PROJECT_SPECS[p.project_id] || {};

    setText("[data-builder-project-title]", p.title);
    setText(
      "[data-builder-project-sub]",
      `${p.kind === "tasful_managed" ? "TASFUL案件管理" : "Builder掲示板"} · ${p.status}`
    );
    const kpi = document.querySelector("[data-builder-project-kpi]");
    if (kpi) kpi.textContent = `project_id: ${p.project_id}`;

    const meta = document.querySelector("[data-builder-project-meta]");
    if (meta) {
      meta.innerHTML =
        buildMetaRow("公開範囲", formatVisibility(p.visibility)) +
        buildMetaRow("連絡ポリシー", formatContactPolicy(p.contact_policy)) +
        buildMetaRow("案件区分", formatSource(p.source)) +
        buildMetaRow("Talkスレッド", p.main_thread_id ? "作成済み" : "未作成") +
        buildMetaRow("工種", (spec.trade_tags || []).map(formatTrade).join("・") || "—") +
        buildMetaRow("エリア", (spec.area_codes || []).map(formatArea).join("・") || "—") +
        buildMetaRow("期間", spec.period ? `${spec.period.start}〜${spec.period.end}` : "—") +
        buildMetaRow(
          "予算",
          spec.budget ? `${Number(spec.budget.min || 0).toLocaleString()}〜${Number(spec.budget.max || 0).toLocaleString()}円` : "—"
        );
    }

    const badges = document.querySelector("[data-builder-project-badges]");
    if (badges) {
      badges.innerHTML = buildBadgeHtml(SOURCE_UI[p.source]?.badge || null);
    }

    const callouts = document.querySelector("[data-builder-project-callouts]");
    if (callouts) {
      const items = [];
      const v = VISIBILITY_UI[p.visibility];
      if (v) items.push(buildCalloutHtml({ title: "公開範囲", text: `${v.label}：${v.desc}`, tone: "warning" }));
      const cp = CONTACT_POLICY_UI[p.contact_policy];
      if (cp) items.push(buildCalloutHtml({ title: "連絡ポリシー", text: `${cp.label}：${cp.desc}`, tone: "warning" }));
      const src = SOURCE_UI[p.source];
      if (src) items.push(buildCalloutHtml({ title: "案件区分", text: `${src.label}：${src.desc}`, tone: "warning" }));
      if (cp?.danger && p.contact_policy === "tasful_talk_only") {
        items.push(buildCalloutHtml({ title: "注意", text: cp.danger, tone: "danger" }));
      }
      callouts.innerHTML = items.join("");
    }

    const talkBtn = document.querySelector("[data-builder-talk-open]");
    const threadMissing = document.querySelector("[data-builder-thread-missing]");
    if (talkBtn && threadMissing) {
      if (p.main_thread_id) {
        talkBtn.hidden = false;
        threadMissing.hidden = true;
        talkBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          alert(`demo: TASFUL Talk を開く\nthread: ${p.main_thread_id}`);
        });
      } else {
        talkBtn.hidden = true;
        threadMissing.hidden = false;
      }
    }

    const re = document.querySelector("[data-builder-project-re-request]");
    if (re) re.setAttribute("href", `re-request.html?from_project_id=${encodeURIComponent(p.project_id)}`);
    const tpl = document.querySelector("[data-builder-project-template]");
    if (tpl) tpl.setAttribute("href", `template-edit.html?from_project_id=${encodeURIComponent(p.project_id)}`);

    const links = document.querySelector("[data-builder-project-links]");
    const linksKpi = document.querySelector("[data-builder-project-links-kpi]");
    const rows = DEMO_PROJECT_LINKS[p.project_id] || [];
    if (links && linksKpi) {
      linksKpi.textContent = `${rows.length} 件`;
      links.innerHTML = rows
        .map((l) => {
          const partner = DEMO_PARTNERS.find((x) => x.partner_id === l.partner_id);
          const title = partner?.display_name || l.partner_id;
          const sub = `${l.role} · ${l.state} · thread: ${l.message_thread_id || "—"}`;
          return (
            `<li class="builder-list-item">` +
            `<div class="builder-list-item__icon" aria-hidden="true">` +
            `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
            `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>` +
            `</svg>` +
            `</div>` +
            `<div class="builder-list-item__main">` +
            `<p class="builder-list-item__title">${esc(title)}</p>` +
            `<p class="builder-list-item__sub">${esc(sub)}</p>` +
            `</div>` +
            `<div class="builder-list-item__actions">` +
            `<a class="builder-btn builder-btn--secondary" href="partner.html?partner_id=${esc(
              l.partner_id
            )}">詳細</a>` +
            `</div>` +
            `</li>`
          );
        })
        .join("");
    }

    // MVP applicants panel (Phase2 project.html)
    const appKpi = document.querySelector("[data-builder-project-app-kpi]");
    const appCallouts = document.querySelector("[data-builder-project-app-callouts]");
    const appMeta = document.querySelector("[data-builder-project-app-meta]");
    const appList = document.querySelector("[data-builder-project-app-list]");
    if (appKpi && appCallouts && appMeta && appList) {
      const api = mvp();
      const state = api.reload();
      const proj = (state.projects || []).find((x) => x.project_id === p.project_id) || p;
      const required = Number(proj.required_partners || 1);
      const selectedIds = Array.isArray(proj.selected_partner_ids) ? proj.selected_partner_ids : [];
      const filled = selectedIds.length >= required;
      const role = getRole();
      const myId = getPartnerId();
      const apps = (state.applications || []).filter((a) => a.project_id === p.project_id);
      appKpi.textContent = `${apps.length} 件`;
      appMeta.innerHTML =
        buildMetaRow("募集人数", String(required)) +
        buildMetaRow("選定済み人数", String(selectedIds.length)) +
        buildMetaRow("状態", filled ? "募集人数に達しました" : "募集中");

      const call = [];
      if (role === "owner") {
        call.push(
          buildCalloutHtml({
            title: "操作",
            text: filled ? "募集人数に達しました。選定ボタンは非表示です。" : "応募者の選定/却下ができます。",
            tone: "warning",
          })
        );
      } else {
        const mine = apps.find((a) => a.partner_id === myId);
        call.push(
          buildCalloutHtml({
            title: "あなたの状況",
            text: mine
              ? selectedIds.includes(myId)
                ? "選定済みです。"
                : mine.status === "rejected"
                  ? "却下されています。"
                  : "応募中です。"
              : "未応募です。",
            tone: "warning",
          })
        );
      }
      appCallouts.innerHTML = call.join("");

      const buildRow = (a) => {
        const partner =
          global.TasuBuilderPartnerAdapter?.resolvePartnerForApplication?.(a, state) ||
          (state.partners || []).find((x) => x.partner_id === a.partner_id) ||
          DEMO_PARTNERS.find((x) => x.partner_id === a.partner_id);
        const name = partner?.display_name || a.partner_id;
        const trades = (partner?.skills || partner?.trades || []).map(formatTrade).slice(0, 2).join("・") || "—";
        const areas = (partner?.areas || []).map(formatArea).slice(0, 2).join("・") || "—";
        const st = selectedIds.includes(a.partner_id) ? "selected" : a.status || "applied";
        const stLabel = st === "selected" ? "選定済み" : st === "rejected" ? "却下" : "応募中";
        const highlight = role === "partner" && a.partner_id === myId ? ` style="border-color:#fb923c;background:#fff7ed"` : "";
        const canSelect = role === "owner" && !filled && st !== "selected";
        const btns =
          role === "owner"
            ? `${canSelect ? `<button type="button" class="builder-btn builder-btn--secondary" data-builder-phase2-select data-partner-id="${esc(a.partner_id)}">選定</button>` : ""}` +
              `<button type="button" class="builder-btn builder-btn--ghost" data-builder-phase2-reject data-partner-id="${esc(a.partner_id)}" ${st === "rejected" ? "disabled" : ""}>却下</button>`
            : "";
        return (
          `<li class="builder-list-item" ${highlight}>` +
          `<div class="builder-list-item__icon" aria-hidden="true">` +
          `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>` +
          `</div>` +
          `<div class="builder-list-item__main">` +
          `<p class="builder-list-item__title">${esc(name)} <span class="builder-chip ${st === "selected" ? "builder-chip--open" : st === "rejected" ? "builder-chip--urgent" : "builder-chip--draft"}">${esc(stLabel)}</span></p>` +
          `<p class="builder-list-item__sub">${esc(trades)} · ${esc(areas)} · ${esc(new Date(a.ts || nowIso()).toLocaleString())}</p>` +
          `</div>` +
          `<div class="builder-list-item__actions">${btns}</div>` +
          `</li>`
        );
      };

      appList.innerHTML = apps
        .slice()
        .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
        .map(buildRow)
        .join("");

      appList.addEventListener("click", (ev) => {
        const sel = ev.target?.closest?.("[data-builder-phase2-select]");
        const rej = ev.target?.closest?.("[data-builder-phase2-reject]");
        if (!sel && !rej) return;
        if (getRole() !== "owner") return;
        const partner_id = (sel || rej).getAttribute("data-partner-id");
        if (!partner_id) return;

        const partnerAdapter = global.TasuBuilderPartnerAdapter;
        if (partnerAdapter?.updateApplicationStatus) {
          const result = partnerAdapter.updateApplicationStatus({
            projectId: proj.project_id,
            partnerId: partner_id,
            status: sel ? "selected" : "rejected",
          });
          if (!result?.ok) return;
          const next = api.reload();
          const pr = next.projects.find((x) => x.project_id === proj.project_id) || proj;
          const threadId = pr.main_thread_id;
          const pname = partnerLabel(next, partner_id);
          if (threadId && next.threads?.[threadId]) {
            next.threads[threadId].events.push({
              type: sel ? "selected" : "rejected",
              actor: { id: next.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" },
              ts: nowIso(),
              text: `${sel ? "選定" : "却下"}: ${pname}`,
            });
            api.commit(next);
          }
          api.pushNotification({
            type: sel ? "selected" : "rejected",
            body: `${pr.title}: ${pname} を${sel ? "選定" : "却下"}しました。`,
            project_id: pr.project_id,
            thread_id: threadId || pr.main_thread_id || null,
          });
          renderProjectDetailPage();
          return;
        }

        const next = api.reload();
        const pidx = (next.projects || []).findIndex((x) => x.project_id === proj.project_id);
        if (pidx < 0) return;
        const pr = next.projects[pidx];
        const required = Number(pr.required_partners || 1);
        const selectedIds = Array.isArray(pr.selected_partner_ids) ? [...pr.selected_partner_ids] : [];
        const filledNow = selectedIds.length >= required;
        if (sel && filledNow) return;

        // update application status
        next.applications = (next.applications || []).map((a) => {
          if (a.project_id !== proj.project_id) return a;
          if (a.partner_id !== partner_id) return a;
          return { ...a, status: sel ? "selected" : "rejected", updated_at: nowIso() };
        });
        if (sel) {
          if (!selectedIds.includes(partner_id)) selectedIds.push(partner_id);
          if (required === 1) {
            next.applications = (next.applications || []).map((a) => {
              if (a.project_id !== proj.project_id) return a;
              if (a.partner_id === partner_id) return { ...a, status: "selected", updated_at: nowIso() };
              if ((a.status || "applied") === "applied") return { ...a, status: "rejected", updated_at: nowIso() };
              return a;
            });
          }
        } else {
          const filtered = selectedIds.filter((x) => x !== partner_id);
          selectedIds.length = 0;
          selectedIds.push(...filtered);
        }
        next.projects[pidx] = { ...pr, selected_partner_ids: selectedIds };

        const threadId = pr.main_thread_id;
        const pname = partnerLabel(next, partner_id);
        if (threadId && next.threads?.[threadId]) {
          next.threads[threadId].events.push({
            type: sel ? "selected" : "rejected",
            actor: { id: next.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" },
            ts: nowIso(),
            text: `${sel ? "選定" : "却下"}: ${pname}`,
          });
        }
        api.commit(next);
        api.pushNotification({
          type: sel ? "selected" : "rejected",
          body: `${pr.title}: ${pname} を${sel ? "選定" : "却下"}しました。`,
          project_id: pr.project_id,
          thread_id: threadId || pr.main_thread_id || null,
        });
        renderProjectDetailPage();
      });
    }
  }

  function focusGeneralFlowApplyCta() {
    if (getParam("benchFocus") !== "apply") return;
    const run = () => {
      const hero = document.querySelector("[data-builder-mvp-pd-apply-hero]:not([hidden])");
      const btn = document.querySelector("[data-builder-mvp-pd-apply]:not([hidden])");
      const target = hero || btn;
      if (!target) return;
      try {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        target.scrollIntoView();
      }
      target.classList.add("mvp-pd-applyHero--focus");
      global.setTimeout(() => target.classList.remove("mvp-pd-applyHero--focus"), 1800);
    };
    global.requestAnimationFrame(() => global.setTimeout(run, 120));
  }

  function renderGeneralFlowProjectDetailCta(project, state, api) {
    const applyBtns = document.querySelectorAll("[data-builder-mvp-pd-apply]");
    const applyStatus = document.querySelector("[data-builder-mvp-pd-apply-status]");
    const applyHero = document.querySelector("[data-builder-mvp-pd-apply-hero]");
    const startChatBtn = document.querySelector("[data-builder-mvp-pd-start-chat]");
    const declineBtn = document.querySelector("[data-builder-mvp-pd-decline-applicant]");
    const flowId = String(project?.bench_flow_id || "").trim();
    if (!flowId) {
      applyBtns.forEach((b) => {
        b.hidden = true;
      });
      if (applyHero) applyHero.hidden = true;
      if (startChatBtn) startChatBtn.hidden = true;
      if (declineBtn) declineBtn.hidden = true;
      return;
    }
    const spec = getBenchGeneralFlowSpec(flowId, project);
    if (!spec) return;
    const me = getActor(state);
    const apps = (state.applications || []).filter((a) => a.project_id === project.project_id);
    const applicantId = String(spec.applicant?.id || "").trim();
    const myApp = apps.find((a) => String(a.partner_id || "") === applicantId);
    const isApplicant = me.id === applicantId;
    const isPoster = me.id === String(spec.poster?.id || "").trim();
    const threadId = String(project.main_thread_id || "").trim();
    const required = Math.max(1, Number(project.required_partners || 1));
    const selectedIds = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
    const filled = selectedIds.length >= required;
    const pendingApps = apps.filter((a) => (a.status || "applied") === "applied");

    if (isApplicant) {
      const canApply = !myApp && !filled && !threadId;
      const benchEmbed = isBuilderBenchEmbedPage();
      applyBtns.forEach((b) => {
        const inHero = Boolean(b.closest("[data-builder-mvp-pd-apply-hero]"));
        const show = canApply && (!benchEmbed || inHero);
        b.hidden = !show;
        b.textContent = b.classList.contains("mvp-pd-applyHero__btn") ? "応募する" : "この案件に応募する";
      });
      if (applyHero) {
        if (canApply) {
          applyHero.hidden = false;
          applyHero.removeAttribute("hidden");
        } else {
          applyHero.hidden = true;
          applyHero.setAttribute("hidden", "");
        }
      }
      if (applyStatus) {
        if (canApply) {
          applyStatus.hidden = false;
          applyStatus.textContent = "条件を確認のうえ、応募してください。";
        } else if (myApp) {
          applyStatus.hidden = false;
          applyStatus.textContent =
            myApp.status === "selected"
              ? "選定済みです。チャットでやりとりできます。"
              : "応募済みです。掲載者の返答をお待ちください。";
        } else {
          applyStatus.hidden = true;
        }
      }
      if (startChatBtn) startChatBtn.hidden = true;
      if (declineBtn) declineBtn.hidden = true;
    } else if (isPoster) {
      applyBtns.forEach((b) => {
        b.hidden = true;
      });
      if (applyHero) applyHero.hidden = true;
      const canStart = !threadId && pendingApps.length > 0;
      const appsConfirm = isBoardApplicationsView();
      const threadHint = document.querySelector("[data-builder-mvp-pd-thread-hint]");
      if (startChatBtn) startChatBtn.hidden = !canStart;
      if (declineBtn) declineBtn.hidden = !canStart;
      if (applyStatus) applyStatus.hidden = true;
      if (threadHint) {
        if (canStart) {
          threadHint.hidden = false;
          threadHint.textContent = appsConfirm
            ? "応募者を確認のうえ「見送る」または「やりとりを開始する」を選んでください。"
            : `応募 ${pendingApps.length} 件 — 見送るか、やりとりを開始できます。`;
        } else if (threadId) {
          threadHint.hidden = false;
          threadHint.textContent = "やりとりチャットが開通しています。";
        } else {
          threadHint.hidden = true;
        }
      }
    } else {
      applyBtns.forEach((b) => {
        b.hidden = true;
      });
      if (applyHero) applyHero.hidden = true;
      if (startChatBtn) startChatBtn.hidden = true;
      if (declineBtn) declineBtn.hidden = true;
      if (applyStatus) applyStatus.hidden = true;
    }

    if (!document.body.dataset.generalFlowPdCtaWired) {
      document.body.dataset.generalFlowPdCtaWired = "1";
      document.addEventListener("click", (ev) => {
        const applyBtn = ev.target?.closest?.("[data-builder-mvp-pd-apply]");
        const startBtn = ev.target?.closest?.("[data-builder-mvp-pd-start-chat]");
        const declineApplicantBtn = ev.target?.closest?.("[data-builder-mvp-pd-decline-applicant]");
        if (!applyBtn && !startBtn && !declineApplicantBtn) return;
        const pid = getProjectIdParam();
        if (!pid) return;
        if (applyBtn) {
          const result = applyGeneralFlowProject(pid);
          if (result?.ok) {
            renderMvpProjectDetailPage();
            if (isBuilderBenchEmbedPage()) {
              try {
                global.parent?.postMessage?.(
                  {
                    type: "tasu-builder-bench-general-applied",
                    projectId: pid,
                    benchSide: getParam("benchSide"),
                  },
                  "*"
                );
              } catch {
                /* ignore */
              }
            }
          }
          return;
        }
        if (startBtn) {
          const result = startGeneralFlowChat(pid);
          if (result?.ok) {
            renderMvpProjectDetailPage();
            if (isBuilderBenchEmbedPage()) {
              try {
                global.parent?.postMessage?.(
                  {
                    type: "tasu-builder-bench-general-chat-started",
                    projectId: pid,
                    threadId: result.threadId,
                    benchSide: getParam("benchSide"),
                  },
                  "*"
                );
              } catch {
                /* ignore */
              }
            }
          }
          return;
        }
        if (declineApplicantBtn) {
          const result = rejectGeneralFlowApplicant(pid);
          if (result?.ok) {
            renderMvpProjectDetailPage();
            if (isBuilderBenchEmbedPage()) {
              try {
                global.parent?.postMessage?.(
                  {
                    type: "tasu-builder-bench-general-declined",
                    projectId: pid,
                    benchSide: getParam("benchSide"),
                  },
                  "*"
                );
              } catch {
                /* ignore */
              }
            }
          }
        }
      });
    }

    focusGeneralFlowApplyCta();
  }

  function renderMvpProjectDetailPage() {
    const api = mvp();
    const state = api.reload();
    const id = getProjectIdParam() || "demo-project-001";
    const project = (state.projects || []).find((x) => x.project_id === id) || DEMO_PROJECTS.find((x) => x.project_id === id);
    if (!project) {
      setText("[data-builder-mvp-pd-title]", "案件が見つかりません");
      setText("[data-builder-mvp-pd-sub]", `id: ${id}`);
      renderMvpProjectTemplateSaveButton("");
      return;
    }
    if (guardPosterOnlyApplicationsView(project, state)) return;

    const spec = getProjectSpec(state, project.project_id);
    const status = computeProjectStatus(state, project);
    const urgent = isUrgentProject({ project, spec, state, status });
    const statusLabel = toDetailStatusLabel({ project, spec, state, status });
    const statusPillMod = detailStatusPillMod(statusLabel);
    const kindLabel = project.kind === "tasful_managed" ? "TASFUL案件管理" : "Builder掲示板";
    const area = spec.areaLabel || "—";
    const period = formatJapaneseDateRange(spec.period);
    const budgetText = formatBudget(showcaseBudget(spec.budget, { area, title: project.title || "" }));
    const required = Math.max(1, Number(project.required_partners || 1));
    const selectedCount = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids.length : 0;
    const apps = (state.applications || []).filter((a) => a.project_id === project.project_id);
    const appCount = apps.length;
    const assignedPartners = getProjectAssignedPartners(project);
    const assignedLabel = assignedPartners.length
      ? assignedPartners.map((a) => getAdminPartnerLabel(a.partnerId)).join(" · ")
      : "未手配";
    const threadId = project.main_thread_id || "";

    if (isBoardApplicationsView()) {
      applyBoardApplicationsViewChrome(project);
    } else {
      setText("[data-builder-mvp-pd-title]", project.title || "案件詳細");
      setText(
        "[data-builder-mvp-pd-sub]",
        `${kindLabel} · ${formatVisibility(project.visibility)} · ${formatContactPolicy(project.contact_policy)}`
      );
      delete document.body.dataset.boardPdView;
    }
    setText("[data-builder-mvp-pd-hero-summary]", `${area} · ${budgetText} · ${period}`);

    const badges = document.querySelector("[data-builder-mvp-pd-badges]");
    if (badges) {
      badges.innerHTML =
        `<span class="mvp-pill mvp-pill--kind">${esc(kindLabel)}</span>` +
        `<span class="mvp-pill mvp-pill--${esc(statusPillMod)}">${esc(statusLabel)}</span>` +
        (urgent && statusLabel !== "締切間近" ? `<span class="mvp-pill mvp-pill--urgent">急募</span>` : "");
    }

    const stats = document.querySelector("[data-builder-mvp-pd-stats]");
    if (stats) {
      stats.innerHTML =
        buildMvpPdStat("エリア", area) +
        buildMvpPdStat("予算", budgetText) +
        buildMvpPdStat("工期", period) +
        buildMvpPdStat("募集人数", `${required} 名`) +
        buildMvpPdStat("応募数", `${appCount} 件`) +
        buildMvpPdStat("選定", `${selectedCount} / ${required}`) +
        buildMvpPdStat("運営手配", assignedPartners.length ? `${assignedPartners.length} 名` : "未手配");
    }

    setText("[data-builder-mvp-pd-overview]", spec.overview);
    setText("[data-builder-mvp-pd-work]", spec.work_content);
    setText("[data-builder-mvp-pd-preferred]", spec.preferred_conditions);
    setText("[data-builder-mvp-pd-notes]", spec.notes);

    const tradesHost = document.querySelector("[data-builder-mvp-pd-trades]");
    if (tradesHost) {
      const chips = (spec.trades || []).length
        ? spec.trades.map((t) => `<span class="mvp-pill mvp-pill--open">${esc(t)}</span>`).join("")
        : `<span class="mvp-pd-body">—</span>`;
      tradesHost.innerHTML = chips;
    }

    const attachList = document.querySelector("[data-builder-mvp-pd-attachments]");
    const attachKpi = document.querySelector("[data-builder-mvp-pd-attach-kpi]");
    const attachments = spec.attachments || [];
    if (attachKpi) attachKpi.textContent = `${attachments.length} 件`;
    if (attachList) {
      if (!attachments.length) {
        attachList.innerHTML = `<li class="mvp-pd-attach mvp-pd-attach--empty">添付資料はありません</li>`;
      } else {
        attachList.innerHTML = attachments
          .map((a) => {
            const isImage = a.type === "image" && a.url;
            const previewInner = isImage
              ? `<img class="mvp-pd-attach__img" src="${esc(a.url)}" alt="" loading="lazy" />`
              : `<span class="mvp-pd-attach__type">${a.type === "pdf" ? "PDF" : "DOC"}</span>`;
            return (
              `<li class="mvp-pd-attach">` +
              `<div class="mvp-pd-attach__preview">${previewInner}</div>` +
              `<span class="mvp-pd-attach__name">${esc(a.name || "—")}</span>` +
              `</li>`
            );
          })
          .join("");
      }
    }

    const threadBtn = document.querySelector("[data-builder-mvp-pd-thread]");
    const threadHint = document.querySelector("[data-builder-mvp-pd-thread-hint]");
    const reBtn = document.querySelector("[data-builder-mvp-pd-re-request]");
    const editBtn = document.querySelector("[data-builder-mvp-pd-edit]");
    const pid = encodeURIComponent(project.project_id);
    if (reBtn) {
      reBtn.setAttribute("href", `re-request.html?project_id=${pid}`);
    }
    if (editBtn) {
      editBtn.setAttribute("href", `mvp-project-new.html?project_id=${pid}`);
    }
    if (threadBtn && threadHint) {
      if (threadId) {
        threadBtn.hidden = false;
        threadHint.hidden = true;
        threadBtn.setAttribute(
          "href",
          `${mvpThreadsHref(getBuilderThreadTypeForId(threadId), getRole())}&project_id=${encodeURIComponent(project.project_id)}`
        );
        threadBtn.removeAttribute("aria-disabled");
      } else {
        threadBtn.hidden = true;
        threadHint.hidden = false;
      }
    }

    const appKpi = document.querySelector("[data-builder-mvp-pd-app-kpi]");
    const appCallouts = document.querySelector("[data-builder-mvp-pd-app-callouts]");
    const appMeta = document.querySelector("[data-builder-mvp-pd-app-meta]");
    const appList = document.querySelector("[data-builder-mvp-pd-app-list]");
    if (appKpi && appCallouts && appMeta && appList) {
      const selectedIds = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
      const filled = selectedIds.length >= required;
      const role = getRole();
      const myId = getPartnerId();
      appKpi.textContent = `${apps.length} 件`;
      const remainingSlots = Math.max(0, required - selectedIds.length);
      appMeta.innerHTML =
        buildMetaRow("応募人数", `${apps.length} 名`) +
        buildMetaRow("選定済み", `${selectedIds.length} 名`) +
        buildMetaRow("残り募集", `${remainingSlots} 名`) +
        buildMetaRow("運営手配", assignedLabel) +
        buildMetaRow("状態", statusLabel);

      const call = [];
      if (assignedPartners.length) {
        call.push(
          buildCalloutHtml({
            title: "運営手配済み",
            text: assignedLabel,
            tone: "warning",
          })
        );
      }
      const flowSpec = project.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
      const isFlowPoster = flowSpec && getActor(state).id === String(flowSpec.poster?.id || "").trim();
      if (role === "owner" || isFlowPoster) {
        call.push(
          buildCalloutHtml({
            title: "応募管理",
            text: filled
              ? "募集人数に達しました。"
              : apps.length
                ? "応募者を確認し「やりとりを開始する」でチャットを開通できます。"
                : "応募者の選定/却下ができます。",
            tone: "warning",
          })
        );
      } else {
        const applicantId = flowSpec?.applicant?.id || myId;
        const mine = apps.find((a) => a.partner_id === applicantId || a.partner_id === myId);
        call.push(
          buildCalloutHtml({
            title: "あなたの状況",
            text: mine
              ? selectedIds.includes(myId)
                ? "選定済みです。"
                : mine.status === "rejected"
                  ? "却下されています。"
                  : "応募中です。"
              : "未応募です。",
            tone: "warning",
          })
        );
      }
      appCallouts.innerHTML = call.join("");

      const buildRow = (a) => {
        const partner =
          (state.partners || []).find((x) => x.partner_id === a.partner_id) ||
          DEMO_PARTNERS.find((x) => x.partner_id === a.partner_id);
        const flowSpecRow = project.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
        const applicantName =
          flowSpecRow?.applicant?.id === a.partner_id
            ? flowSpecRow.applicant.name
            : partner?.display_name || a.partner_id;
        const name = applicantName || a.partner_id;
        const rating = partnerRating(partner);
        const trackRecord = partnerTrackRecord(partner);
        const tradesText = (partner?.trades || []).map(formatTrade).slice(0, 2).join("・") || "—";
        const st = selectedIds.includes(a.partner_id) ? "selected" : a.status || "applied";
        const stLabel = st === "selected" ? "選定済み" : st === "rejected" ? "却下" : "応募中";
        const chipMod = st === "selected" ? "open" : st === "rejected" ? "urgent" : "draft";
        const flowSpec = flowSpecRow;
        const posterActorId = flowSpec?.poster?.id || state?.owner_id || OWNER_ID;
        const canManageApps = role === "owner" || getActor(state).id === posterActorId;
        const isFlowConfirmView = isBoardApplicationsView() && flowSpec && canManageApps;
        const canSelect = canManageApps && !filled && st !== "selected" && !isFlowConfirmView;
        const comment = String(a.message || a.comment || a.note || "").trim();
        const appliedAt = new Date(a.ts || nowIso()).toLocaleString();
        const btns =
          canManageApps && !isFlowConfirmView
            ? `${canSelect ? `<button type="button" class="builder-btn builder-btn--secondary" data-builder-mvp-pd-select data-partner-id="${esc(a.partner_id)}">選定</button>` : ""}` +
              `<button type="button" class="builder-btn builder-btn--ghost" data-builder-mvp-pd-reject data-partner-id="${esc(a.partner_id)}" ${st === "rejected" ? "disabled" : ""}>却下</button>`
            : "";
        if (isFlowConfirmView) {
          return (
            `<li class="mvp-pd-appItem mvp-pd-appItem--confirm">` +
            `<p class="mvp-pd-appItem__project">${esc(project.title || "案件")}</p>` +
            `<div class="mvp-pd-appItem__head">` +
            `<p class="mvp-pd-appItem__name">${esc(name)}</p>` +
            `<span class="builder-chip builder-chip--${esc(chipMod)}">${esc(stLabel)}</span>` +
            `</div>` +
            `<p class="mvp-pd-appItem__meta"><span class="mvp-pd-appItem__label">応募日時</span> ${esc(appliedAt)}</p>` +
            (comment
              ? `<p class="mvp-pd-appItem__comment"><span class="mvp-pd-appItem__label">応募コメント</span> ${esc(comment)}</p>`
              : `<p class="mvp-pd-appItem__comment mvp-pd-appItem__comment--empty"><span class="mvp-pd-appItem__label">応募コメント</span> —</p>`) +
            `</li>`
          );
        }
        return (
          `<li class="mvp-pd-appItem">` +
          `<div class="mvp-pd-appItem__head">` +
          `<p class="mvp-pd-appItem__name">${esc(name)}</p>` +
          `<span class="builder-chip builder-chip--${esc(chipMod)}">${esc(stLabel)}</span>` +
          `</div>` +
          `<p class="mvp-pd-appItem__cred">` +
          `<span>評価 <strong class="mvp-pd-appItem__rating">★${esc(rating)}</strong></span>` +
          `<span>実績 <strong>${esc(String(trackRecord))}件</strong></span>` +
          `</p>` +
          `<p class="mvp-pd-appItem__meta">${esc(tradesText)} · ${esc(appliedAt)}</p>` +
          (comment ? `<p class="mvp-pd-appItem__comment">${esc(comment)}</p>` : "") +
          (btns ? `<div class="mvp-pd-appItem__actions">${btns}</div>` : "") +
          `</li>`
        );
      };

      appList.innerHTML = apps.length
        ? apps
            .slice()
            .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
            .map(buildRow)
            .join("")
        : `<li class="mvp-pd-appItem mvp-pd-appItem--empty"><p class="mvp-pd-appItem__name">応募者なし</p><p class="mvp-pd-appItem__meta">まだ応募はありません。</p></li>`;

      if (!appList.dataset.bound) {
        appList.dataset.bound = "1";
        appList.addEventListener("click", (ev) => {
          const sel = ev.target?.closest?.("[data-builder-mvp-pd-select]");
          const rej = ev.target?.closest?.("[data-builder-mvp-pd-reject]");
          if (!sel && !rej) return;
          const next = api.reload();
          const pr = (next.projects || []).find((x) => x.project_id === project.project_id);
          const flowSpec = pr?.bench_flow_id ? getBenchGeneralFlowSpec(pr.bench_flow_id, pr) : null;
          const posterActorId = flowSpec?.poster?.id || next?.owner_id || OWNER_ID;
          const canManageApps = getRole() === "owner" || getActor(next).id === posterActorId;
          if (!canManageApps) return;
          const partner_id = (sel || rej).getAttribute("data-partner-id");
          if (!partner_id) return;

          const pidx = (next.projects || []).findIndex((x) => x.project_id === project.project_id);
          if (pidx < 0) return;
          const req = Number(pr.required_partners || 1);
          const selectedIdsNext = Array.isArray(pr.selected_partner_ids) ? [...pr.selected_partner_ids] : [];
          if (sel && selectedIdsNext.length >= req) return;

          next.applications = (next.applications || []).map((a) => {
            if (a.project_id !== project.project_id || a.partner_id !== partner_id) return a;
            return { ...a, status: sel ? "selected" : "rejected", updated_at: nowIso() };
          });
          if (sel) {
            if (!selectedIdsNext.includes(partner_id)) selectedIdsNext.push(partner_id);
            if (req === 1) {
              next.applications = (next.applications || []).map((a) => {
                if (a.project_id !== project.project_id) return a;
                if (a.partner_id === partner_id) return { ...a, status: "selected", updated_at: nowIso() };
                if ((a.status || "applied") === "applied") return { ...a, status: "rejected", updated_at: nowIso() };
                return a;
              });
            }
          } else {
            const filtered = selectedIdsNext.filter((x) => x !== partner_id);
            selectedIdsNext.length = 0;
            selectedIdsNext.push(...filtered);
          }
          next.projects[pidx] = { ...pr, selected_partner_ids: selectedIdsNext };

          const tid = pr.main_thread_id;
          const pname = partnerLabel(next, partner_id);
          if (tid && next.threads?.[tid]) {
            next.threads[tid].events.push({
              type: sel ? "selected" : "rejected",
              actor: { id: next.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" },
              ts: nowIso(),
              text: `${sel ? "選定" : "却下"}: ${pname}`,
            });
          }
          api.commit(next);
          api.pushNotification({
            type: sel ? "selected" : "rejected",
            body: `${pr.title}: ${pname} を${sel ? "選定" : "却下"}しました。`,
            project_id: pr.project_id,
            thread_id: threadId || pr.main_thread_id || null,
          });
          renderMvpProjectDetailPage();
        });
      }
    }

    renderMvpProjectTemplateSaveButton(project.project_id);
    renderGeneralFlowProjectDetailCta(project, state, api);
    applyMvpApplicationsViewDom(project);
    scheduleBoardApplicationsFocus();
  }

  function renderReRequestPage() {
    const form = document.querySelector("[data-builder-re-request-form]");
    const kpi = document.querySelector("[data-builder-re-request-kpi]");
    const summaryHost = document.querySelector("[data-builder-re-summary]");
    const createBtn = document.querySelector("[data-builder-re-create-project]");
    if (!form || !kpi || !summaryHost || !createBtn) return;

    const fromProjectId = getParam("from_project_id") || getParam("project_id");
    const partnerId = getParam("partner_id");
    const templateId = getParam("template_id");

    const preview = fromProjectId ? createMvpReRequestFromProject(fromProjectId) : null;
    summaryHost.innerHTML = buildMvpReRequestSummaryHtml(preview);
    createBtn.disabled = !fromProjectId || !preview;

    const fromParts = [];
    if (fromProjectId) fromParts.push(`project_id=${fromProjectId}`);
    if (partnerId) fromParts.push(`partner_id=${partnerId}`);
    if (templateId) fromParts.push(`template_id=${templateId}`);
    kpi.textContent = fromParts.length ? fromParts.join(" · ") : "—";

    const kindEl = form.querySelector("[data-builder-re-target-kind]");
    const visEl = form.querySelector("[data-builder-re-visibility]");
    const cpEl = form.querySelector("[data-builder-re-contact-policy]");
    const noteEl = form.querySelector("[data-builder-re-note]");
    const callouts = document.querySelector("[data-builder-re-callouts]");

    if (cpEl) cpEl.value = "tasful_talk_only";
    if (visEl) visEl.value = "partner_only";
    if (kindEl) kindEl.value = "builder_board";

    const rerenderHelp = () => {
      renderPolicyHints({ visibility: visEl?.value, contact_policy: cpEl?.value });
      if (!callouts) return;
      const items = [];
      const v = VISIBILITY_UI[visEl?.value];
      if (v) items.push(buildCalloutHtml({ title: "公開範囲", text: `${v.label}：${v.desc}`, tone: "warning" }));
      const cp = CONTACT_POLICY_UI[cpEl?.value];
      if (cp) items.push(buildCalloutHtml({ title: "連絡ポリシー", text: `${cp.label}：${cp.desc}`, tone: "warning" }));
      if (cp?.danger && cpEl?.value === "tasful_talk_only") {
        items.push(buildCalloutHtml({ title: "注意", text: cp.danger, tone: "danger" }));
      }
      callouts.innerHTML = items.join("");
    };
    visEl?.addEventListener("change", rerenderHelp);
    cpEl?.addEventListener("change", rerenderHelp);
    rerenderHelp();

    if (createBtn.dataset.bound === "1") return;
    createBtn.dataset.bound = "1";
    createBtn.addEventListener("click", () => {
      const pid = getParam("from_project_id") || getParam("project_id");
      if (!pid) {
        alert("元案件が指定されていません。");
        return;
      }
      const record = createMvpReRequestFromProject(pid, {
        note: noteEl?.value || "",
        targetKind: kindEl?.value || "builder_board",
        visibility: visEl?.value || "partner_only",
        contactPolicy: cpEl?.value || "tasful_talk_only",
      });
      if (!record) {
        alert("案件が見つかりません。");
        return;
      }
      saveMvpReRequest(record);
      useMvpReRequest(record.id);
    });
  }

  const BUILDER_SETTINGS_KEY = "tasful:builder:settings:v1";

  function renderBuilderSettingsPage() {
    const form = document.querySelector("[data-builder-settings-form]");
    const kpi = document.querySelector("[data-builder-settings-kpi]");
    if (!form) return;

    const fields = {
      notify_applications: form.querySelector("[data-builder-settings-notify-applications]"),
      notify_messages: form.querySelector("[data-builder-settings-notify-messages]"),
      notify_completion: form.querySelector("[data-builder-settings-notify-completion]"),
      default_visibility: form.querySelector("[data-builder-settings-default-visibility]"),
      default_contact_policy: form.querySelector("[data-builder-settings-default-contact]"),
      accept_applications: form.querySelector("[data-builder-settings-accept-applications]"),
      default_required_partners: form.querySelector("[data-builder-settings-required-partners]"),
      max_applications: form.querySelector("[data-builder-settings-max-applications]"),
      default_list_view: form.querySelector("[data-builder-settings-list-view]"),
      default_role_view: form.querySelector("[data-builder-settings-role-view]"),
      contact_name: form.querySelector("[data-builder-settings-contact-name]"),
      contact_email: form.querySelector("[data-builder-settings-contact-email]"),
      contact_phone: form.querySelector("[data-builder-settings-contact-phone]"),
      company_name: form.querySelector("[data-builder-settings-company-name]"),
      company_address: form.querySelector("[data-builder-settings-company-address]"),
      company_bio: form.querySelector("[data-builder-settings-company-bio]"),
    };

    const apply = (data) => {
      if (!data || typeof data !== "object") return;
      Object.entries(fields).forEach(([key, el]) => {
        if (!el) return;
        const val = data[key];
        if (el.type === "checkbox") el.checked = Boolean(val);
        else if (val != null) el.value = String(val);
      });
    };

    try {
      const raw = localStorage.getItem(BUILDER_SETTINGS_KEY);
      if (raw) apply(JSON.parse(raw));
      if (kpi) kpi.textContent = raw ? "保存済み" : "demo";
    } catch {
      if (kpi) kpi.textContent = "demo";
    }

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const payload = {};
      Object.entries(fields).forEach(([key, el]) => {
        if (!el) return;
        payload[key] = el.type === "checkbox" ? el.checked : el.value;
      });
      payload.updated_at = new Date().toISOString();
      localStorage.setItem(BUILDER_SETTINGS_KEY, JSON.stringify(payload));
      if (kpi) kpi.textContent = "保存済み";
    });
  }

  function wireHeaderDemo() {
    const page = getPage();
    const isAdmin = page === "builder-admin-dashboard" || page.startsWith("builder-admin-");
    if (isAdmin) {
      setText("[data-dash-user-name]", "運営");
      setText("[data-builder-member-type]", "TASFUL運営");
      const avatar = document.querySelector("[data-dash-avatar]");
      if (avatar && !avatar.getAttribute("alt")) avatar.setAttribute("alt", "運営");
      return;
    }
    if (page === "builder-user-dashboard") {
      setText("[data-dash-user-name]", "田中 花子");
      setText("[data-builder-member-type]", "一般ユーザー");
      const avatar = document.querySelector("[data-dash-avatar]");
      if (avatar && !avatar.getAttribute("alt")) avatar.setAttribute("alt", "田中 花子");
      return;
    }
    if (page === "builder-partner-dashboard") {
      setText("[data-dash-user-name]", "山田 太郎");
      setText("[data-builder-member-type]", "認定パートナー");
      const avatar = document.querySelector("[data-dash-avatar]");
      if (avatar && !avatar.getAttribute("alt")) avatar.setAttribute("alt", "山田 太郎");
    }
  }

  function setBuilderPageBack(href, label) {
    const back = document.querySelector("[data-builder-page-back]");
    if (!back || !href) return;
    back.setAttribute("href", href);
    if (label) back.setAttribute("aria-label", label);
  }

  function applyBuilderBenchEmbedChrome() {
    try {
      if (new URLSearchParams(globalThis.location.search).get("benchEmbed") !== "1") return;
      document.documentElement.classList.add("builder-bench-embed-root");
      document.body.classList.add("builder-bench-embed");
      document.body.dataset.builderBenchEmbed = "1";
      syncPageScheduleChromeClasses();
    } catch {
      /* ignore */
    }
  }

  function isBuilderBenchEmbedPage() {
    try {
      return (
        document.body?.classList?.contains("builder-bench-embed") ||
        document.body?.dataset?.builderBenchEmbed === "1" ||
        new URLSearchParams(globalThis.location.search).get("benchEmbed") === "1"
      );
    } catch {
      return false;
    }
  }

  function scrollMvpThreadTimelineEnd(msgList) {
    if (isBuilderBenchEmbedPage()) {
      const scrollRoots = [
        document.body,
        document.documentElement,
        document.querySelector(".mvp-slack-thread"),
        document.querySelector(".mvp-slack-thread-app"),
      ].filter(Boolean);
      scrollRoots.forEach((el) => {
        try {
          el.scrollTop = el.scrollHeight;
        } catch {
          /* ignore */
        }
      });
      return;
    }
    if (msgList) msgList.scrollTop = msgList.scrollHeight;
  }

  function isMvpCalendarPartnerBenchView(isPartner) {
    if (getPage() !== "builder-mvp-calendar" || !isPartner) return false;
    try {
      const sp = new URLSearchParams(globalThis.location.search);
      if (sp.get("benchEmbed") === "1" && sp.get("benchSide") !== "B") return false;
    } catch {
      /* ignore */
    }
    return true;
  }

  function syncPageScheduleChromeClasses() {
    const page = getPage();
    const isAdminCal = page === "builder-admin-calendar";
    document.body.classList.toggle("admin-cal--ops-schedule", isAdminCal);
    if (isAdminCal) {
      document.body.classList.remove("mvp-cal--partner", "mvp-cal--partner-schedule");
    }
    if (page !== "builder-mvp-calendar") {
      document.body.classList.remove("mvp-cal--partner", "mvp-cal--partner-schedule");
    }
  }

  function init() {
    const root = document.querySelector("[data-builder-root]");
    if (!root || root.dataset.builderBound === "1") return;
    root.dataset.builderBound = "1";

    applyBuilderBenchEmbedChrome();
    applyMvpRoleFromUrl();
    wireHeaderDemo();
    const page = getPage();

    if (page === "builder-partner-dashboard") {
      renderPartnerDashboardPage();
    } else if (page === "builder-user-dashboard") {
      renderUserDashboardPage();
    } else if (page === "builder-admin-dashboard") {
      wireAdminCsvExport(document);
      renderAdminDashboardPage();
    } else if (page === "builder-admin-partners") {
      ensureAdminPartnersDemoData();
      wireAdminCsvExport(document);
      renderAdminPartnersPage();
    } else if (page === "builder-admin-partner-evaluations") {
      ensureAdminPartnersDemoData();
    } else if (page === "builder-admin-applications") {
      ensureAdminApplicationsDemoData();
      renderAdminApplicationsPage();
    } else if (page === "builder-admin-reviews") {
      ensureAdminPartnersDemoData();
      renderAdminReviewsPage();
    } else if (page === "builder-admin-notifications") {
      ensureAdminNotificationsDemoData();
      renderAdminNotificationsPage();
    } else if (page === "builder-admin-dispatch") {
      renderAdminDispatchPage();
    } else if (page === "builder-admin-calendar") {
      wireHeaderDemo();
      wireAdminCsvExport(document);
      renderAdminCalendarPage();
      document.addEventListener("builder:mvp-changed", () => renderAdminCalendarPage());
      document.addEventListener("builder:admin-calendar-assignments-changed", () => renderAdminCalendarPage());
    } else if (page === "builder-top") {
      renderBuilderTopPage();
    } else if (page === "builder-partners") {
      renderPartnerSearchPage();
    } else if (page === "builder-favorites") {
      renderFavoritesPage();
      document.addEventListener("builder:favorites-changed", () => renderFavoritesPage());
    } else if (page === "builder-partner-detail") {
      renderPartnerDetailPage();
    } else if (page === "builder-templates") {
      renderTemplatesPage();
    } else if (page === "builder-template-edit") {
      renderTemplateEditPage();
    } else if (page === "builder-settings") {
      renderBuilderSettingsPage();
    } else if (page === "builder-project-detail") {
      renderPhase2Role();
      renderProjectDetailPage();
    } else if (page === "builder-mvp-project-detail") {
      applyMvpRoleFromUrl();
      syncPartnerIdFromUrl();
      renderMvpRole();
      renderMvpProjectDetailPage();
      document.addEventListener("builder:mvp-changed", () => renderMvpProjectDetailPage());
    } else if (page === "builder-re-request") {
      renderReRequestPage();
    } else if (page === "builder-mvp-projects") {
      renderMvpRole();
      renderMvpProjectsPage();
    } else if (page === "builder-board-projects") {
      applyMvpRoleFromUrl();
      renderMvpRole();
      renderBoardProjectsPage();
      document.addEventListener("builder:mvp-changed", () => renderBoardProjectsPage());
    } else if (page === "builder-board-project-detail") {
      applyMvpRoleFromUrl();
      renderMvpRole();
      renderBoardProjectDetailPage();
      document.addEventListener("builder:mvp-changed", () => renderBoardProjectDetailPage());
    } else if (page === "builder-board-thread") {
      applyMvpRoleFromUrl();
      renderMvpRole();
      renderBoardThreadPage();
      document.addEventListener("builder:mvp-changed", () => renderBoardThreadPage());
    } else if (page === "builder-board-threads") {
      applyMvpRoleFromUrl();
      renderMvpRole();
      renderBoardThreadsPage();
      document.addEventListener("builder:mvp-changed", () => renderBoardThreadsPage());
    } else if (page === "builder-mvp-project-new") {
      renderMvpRole();
      renderMvpProjectNewPage();
    } else if (page === "builder-mvp-post") {
      renderMvpRole();
      renderMvpPostPage();
    } else if (page === "builder-mvp-templates") {
      renderMvpRole();
      renderMvpTemplatesPage();
    } else if (page === "builder-mvp-partner-register") {
      renderMvpRole();
      renderMvpPartnerRegisterPage();
    } else if (page === "builder-mvp-thread") {
      wireMvpThreadCompleteDelegation();
      window.__openMvpThreadCompletion = openMvpThreadCompletionPanel;
      window.__openMvpThreadSitePhoto = openMvpThreadSitePhotoPanel;
      window.__openMvpThreadReview = openMvpThreadReviewPanel;
      resetMvpThreadAuxUiOnLoad();
      applyMvpRoleFromUrl();
      ensureMvpThreadUrlParams();
      renderMvpRole();
      renderMvpThreadPage();
    } else if (page === "builder-mvp-talk") {
      renderMvpRole();
      renderMvpTalkPage();
    } else if (page === "builder-mvp-notifications") {
      applyMvpRoleFromUrl();
      renderMvpRole();
      ensureMvpNotificationsDemoData();
      renderMvpNotificationsPage();
      document.addEventListener("builder:mvp-notifications-changed", () => renderMvpNotificationsPage());
      window.addEventListener("storage", (event) => {
        if (event.key === MVP_NOTIFICATIONS_KEY) renderMvpNotificationsPage();
      });
    } else if (page === "builder-mvp-threads") {
      applyMvpRoleFromUrl();
      renderMvpRole();
      renderMvpThreadsPage();
      document.addEventListener("builder:mvp-changed", () => renderMvpThreadsPage());
    } else if (page === "builder-partner-assignment") {
      syncPartnerIdFromUrl();
      renderPartnerAssignmentPage();
      document.addEventListener("builder:mvp-changed", () => renderPartnerAssignmentPage());
      document.addEventListener("builder:admin-calendar-assignments-changed", () => renderPartnerAssignmentPage());
    } else if (page === "builder-mvp-calendar") {
      syncPartnerIdFromUrl();
      renderMvpRole();
      renderMvpCalendarPage();
      document.addEventListener("builder:mvp-changed", () => renderMvpCalendarPage());
      document.addEventListener("builder:admin-calendar-assignments-changed", () => renderMvpCalendarPage());
      window.addEventListener("storage", (event) => {
        if (
          event.key === MVP_STORAGE_KEY ||
          event.key === MVP_NOTIFICATIONS_KEY ||
          event.key === ADMIN_CALENDAR_ASSIGNMENTS_KEY
        ) {
          renderMvpCalendarPage();
        }
      });
    }

    wireBoardApplicationsMobileFocus();
  }

  let boardApplicationsMobileFocusWired = false;

  function wireBoardApplicationsMobileFocus() {
    if (boardApplicationsMobileFocusWired) return;
    boardApplicationsMobileFocusWired = true;
    global.addEventListener("tasu:mobile-shell-ready", () => {
      if (getPage() !== "builder-board-project-detail" && getPage() !== "builder-mvp-project-detail") return;
      scheduleBoardApplicationsFocus();
    });
    global.addEventListener("load", () => {
      if (getPage() !== "builder-board-project-detail" && getPage() !== "builder-mvp-project-detail") return;
      scheduleBoardApplicationsFocus();
    });
  }

  function renderBuilderTopPage() {
    const host = document.querySelector("[data-builder-top-projects]");
    if (!host) return;
    const api = mvp();
    const state = api.reload();
    const rows = (state.projects || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const topRows = rows.slice(0, 3);

    // Ensure we can show 3 cards on TOP. If projects are missing, append lightweight demo projects.
    if (topRows.length < 3) {
      const next = api.reload();
      const want = 3 - topRows.length;
      const add = [];
      const addSpecs = {};
      const addThreads = {};
      for (let i = 0; i < want; i++) {
        const id = `demo-project-top-${String(i + 1).padStart(3, "0")}`;
        const threadId = `thread-top-${String(i + 1).padStart(3, "0")}`;
        add.push({
          project_id: id,
          owner_id: next.owner_id || OWNER_ID,
          title: i === 0 ? "千葉市 倉庫新築 見積精査" : i === 1 ? "横浜市 店舗内装 工程調整" : "新宿区 共同住宅 外装改修（追加）",
          kind: "builder_board",
          status: "open",
          required_partners: 2,
          selected_partner_ids: [],
          visibility: "public",
          contact_policy: "talk_only",
          main_thread_id: threadId,
          source: "builder_board",
          source_template_id: null,
          created_at: nowIso(),
        });
        addSpecs[id] = {
          area: { label: i === 0 ? "千葉県" : i === 1 ? "神奈川県" : "東京都" },
          period: { start: "2026/06/01", end: "2026/06/30" },
        };
        addThreads[threadId] = {
          thread_id: threadId,
          project_id: id,
          events: [{ type: "created", actor: { id: next.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" }, ts: nowIso(), text: "案件を投稿しました（demo）" }],
          messages: [],
          photos: [],
          completion: null,
        };
      }
      next.projects = [...(next.projects || []), ...add];
      next.specs = { ...(next.specs || {}), ...addSpecs };
      next.threads = { ...(next.threads || {}), ...addThreads };
      api.commit(next);
    }

    const finalState = api.reload();
    const finalRows = filterBoardProjects(finalState.projects || [])
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 3);

    const buildTopProjectCard = (project) => {
      const spec = finalState.specs?.[project.project_id] || null;
      const status = computeProjectStatus(finalState, project);
      const statusLabel = toStatusLabel(status);
      const kindLabel = BOARD_KIND_LABEL;
      const area = spec?.area?.label || spec?.area || "—";
      const period = spec?.period ? `${spec.period.start}〜${spec.period.end}` : "—";
      const required = Number(project?.required_partners || 1);
      const apps = (finalState.applications || []).filter((a) => a.project_id === project.project_id);
      const appCount = apps.length;

      return (
        `<a class="builder-top-project-card" data-builder-top-project-card href="${esc(
          boardDetailHref(project.project_id)
        )}">` +
        `<div class="builder-top-project-card__head">` +
        `<span class="builder-top-project-card__badge">${esc(kindLabel)}</span>` +
        `<span class="builder-top-project-card__status">${esc(statusLabel)}</span>` +
        `</div>` +
        `<h3 class="builder-top-project-card__title">${esc(project.title || "—")}</h3>` +
        `<div class="builder-top-project-card__meta">` +
        `<div class="builder-top-project-card__row is-area"><span>エリア</span><strong>${esc(area)}</strong></div>` +
        `<div class="builder-top-project-card__row is-period"><span>期間</span><strong>${esc(period)}</strong></div>` +
        `<div class="builder-top-project-card__row"><span>募集人数</span><strong>${esc(String(required))}名</strong></div>` +
        `<div class="builder-top-project-card__row"><span>応募数</span><strong>${esc(String(appCount))}名</strong></div>` +
        `</div>` +
        `<div class="builder-top-project-card__more"><span>詳細を見る</span><span aria-hidden="true">→</span></div>` +
        `</a>`
      );
    };

    const moreCard = `<a class="builder-top-project-card builder-top-project-card--more" href="../public-board.html" aria-label="案件をもっと見る">` +
      `<div class="builder-top-project-card__moreIcon" aria-hidden="true">＋</div>` +
      `<div class="builder-top-project-card__moreText">案件をもっと見る</div>` +
      `</a>`;

    host.innerHTML = finalRows.map(buildTopProjectCard).join("") + moreCard;
  }

  window.TasuBuilder = {
    renderStats,
    renderRecentList,
    demo: {
      OWNER_ID,
      DEMO_PARTNERS,
      DEMO_TEMPLATES,
      DEMO_PROJECTS,
    },
  };

  function renderPhase2Role() {
    const host = document.querySelector("[data-builder-role]");
    if (!host) return;
    const state = mvp().reload();
    const role = getRole();
    const label = role === "owner" ? "オーナー" : "協力会社";
    const pid = getPartnerId();
    const pname = partnerLabel(state, pid);
    host.innerHTML =
      `<span class="builder-role__pill">表示: <strong>${esc(label)}</strong></span>` +
      (role === "partner" ? `<span class="builder-role__pill">協力会社: <strong>${esc(pname)}</strong></span>` : "") +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-role-owner>オーナー表示</button>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-role-partner>協力会社表示</button>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-builder-role-partner-toggle>協力会社切替</button>`;

    host.querySelector("[data-builder-role-owner]")?.addEventListener("click", () => {
      setRole("owner");
      renderPhase2Role();
      renderProjectDetailPage();
    });
    host.querySelector("[data-builder-role-partner]")?.addEventListener("click", () => {
      setRole("partner");
      renderPhase2Role();
      renderProjectDetailPage();
    });
    host.querySelector("[data-builder-role-partner-toggle]")?.addEventListener("click", () => {
      const ids = (mvp().reload().partners || []).map((p) => p.partner_id);
      const idx = Math.max(0, ids.indexOf(getPartnerId()));
      const next = ids[(idx + 1) % ids.length] || "demo-partner-001";
      setPartnerId(next);
      setRole("partner");
      renderPhase2Role();
      renderProjectDetailPage();
    });
  }

  function renderMvpRole() {
    const host = document.querySelector("[data-builder-role]");
    if (!host) return;
    const role = getRole();
    const label = role === "owner" ? "オーナー" : role === "user" ? "利用者" : "パートナー";
    const state = mvp().reload();
    const partnerId = getPartnerId();
    const partnerName = partnerLabel(state, partnerId);
    host.innerHTML =
      `<span class="builder-role__pill">表示: <strong>${esc(label)}</strong></span>` +
      (role === "partner" ? `<span class="builder-role__pill">協力会社: <strong>${esc(partnerName)}</strong></span>` : "") +
      (role === "user" ? `<span class="builder-role__pill">利用者: <strong>山田 太郎</strong></span>` : "") +
      `<details class="mvp-demoMenu">` +
      `<summary class="mvp-demoMenu__summary"><span class="mvp-demoMenu__icon" aria-hidden="true">▶</span> デモ操作</summary>` +
      `<div class="mvp-demoMenu__panel">` +
      `<button type="button" class="mvp-demoMenu__btn" data-builder-mvp-role-owner>オーナー表示</button>` +
      `<button type="button" class="mvp-demoMenu__btn" data-builder-mvp-role-partner>協力会社表示</button>` +
      `<button type="button" class="mvp-demoMenu__btn" data-builder-mvp-role-user>利用者表示</button>` +
      `<button type="button" class="mvp-demoMenu__btn" data-builder-mvp-partner-toggle>協力会社切替</button>` +
      `<button type="button" class="mvp-demoMenu__btn is-danger" data-builder-mvp-reset>デモデータ初期化</button>` +
      `</div>` +
      `</details>`;
    host.querySelector("[data-builder-mvp-role-owner]")?.addEventListener("click", () => {
      setRole("owner");
      renderMvpRole();
      document.dispatchEvent(new CustomEvent("builder:mvp-refresh"));
    });
    host.querySelector("[data-builder-mvp-role-partner]")?.addEventListener("click", () => {
      setRole("partner");
      renderMvpRole();
      document.dispatchEvent(new CustomEvent("builder:mvp-refresh"));
    });
    host.querySelector("[data-builder-mvp-role-user]")?.addEventListener("click", () => {
      setRole("user");
      renderMvpRole();
      document.dispatchEvent(new CustomEvent("builder:mvp-refresh"));
    });
    host.querySelector("[data-builder-mvp-reset]")?.addEventListener("click", () => {
      if (!confirm("demoData を初期化します。よろしいですか？")) return;
      mvp().reset();
      window.location.href = "mvp-projects.html";
    });

    host.querySelector("[data-builder-mvp-partner-toggle]")?.addEventListener("click", () => {
      const ids = (mvp().reload().partners || []).map((p) => p.partner_id);
      const idx = Math.max(0, ids.indexOf(getPartnerId()));
      const next = ids[(idx + 1) % ids.length] || "demo-partner-001";
      setPartnerId(next);
      renderMvpRole();
      document.dispatchEvent(new CustomEvent("builder:mvp-refresh"));
    });
  }

  function toStatusLabel(status) {
    return STATUS_UI[status]?.label || status || "—";
  }

  function computeProjectStatus(state, project) {
    const threadId = project?.main_thread_id || "";
    const t = state?.threads?.[threadId];
    const events = Array.isArray(t?.events) ? t.events : [];
    const has = (type) => events.some((e) => e?.type === type);
    if (has("invoiced")) return "invoiced";
    if (has("completed")) return "completed";
    if (has("check_out")) return "exited";
    if (has("check_in")) return "in_progress";
    const apps = (state.applications || []).filter((a) => a.project_id === project.project_id);
    const selectedCount = Array.isArray(project?.selected_partner_ids) ? project.selected_partner_ids.length : 0;
    if (selectedCount > 0) return "selected";
    if (apps.length) return "applied";
    if (project?.status === "draft") return "draft";
    return "open";
  }

  function getApplication(state, project_id, partner_id) {
    const adapter = global.TasuBuilderPartnerAdapter;
    if (adapter?.getApplication) {
      return adapter.getApplication(project_id, partner_id, { state });
    }
    return (state.applications || []).find((a) => a.project_id === project_id && a.partner_id === partner_id) || null;
  }

  function upsertApplication(state, app) {
    const adapter = global.TasuBuilderPartnerAdapter;
    if (adapter?.upsertApplication) {
      return adapter.upsertApplication(app, { state });
    }
    const next = { ...state };
    const list = [...(next.applications || [])];
    const idx = list.findIndex((a) => a.project_id === app.project_id && a.partner_id === app.partner_id);
    if (idx >= 0) list[idx] = { ...list[idx], ...app };
    else list.push(app);
    next.applications = list;
    return next;
  }

  function partnerLabel(state, partner_id) {
    const adapter = global.TasuBuilderPartnerAdapter;
    if (adapter?.getDisplayName) {
      const name = adapter.getDisplayName(partner_id, { state });
      if (name) return name;
    }
    const p =
      (state.partners || []).find((x) => x.partner_id === partner_id) ||
      DEMO_PARTNERS.find((x) => x.partner_id === partner_id);
    return p?.display_name || partner_id;
  }

  function getActor(state) {
    if (isBuilderProdHost()) {
      const ctx = resolveBuilderActorContext(state);
      const record = builderIdentity().getActorRecord?.(ctx);
      if (record && typeof record === "object") return record;
      return { id: "", type: "", name: "" };
    }
    const role = getRole();
    const st = state || mvp().reload();
    if (role === "owner") return { id: st?.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" };
    if (role === "user") {
      const uid = String(getPartnerId() || "demo-builder-user").trim();
      if (uid === "demo-user-peer-001") {
        return { id: uid, type: "user", name: "鈴木 美咲" };
      }
      return { id: uid || "demo-builder-user", type: "user", name: "山田 太郎" };
    }
    if (role === "vendor") {
      const vid = getPartnerId() || "demo-vendor-001";
      const vendor = (st.partners || []).find((p) => p.partner_id === vid);
      return { id: vid, type: "vendor", name: vendor?.display_name || "業者" };
    }
    const pid = getPartnerId();
    return { id: pid, type: "partner", name: partnerLabel(st, pid) };
  }

  function logMvpThreadActor(context, state) {
    if (typeof console === "undefined" || !console.log) return;
    const role = getRole();
    const me = getActor(state);
    console.log(`[MVP thread ${context}]`, {
      getRole: role,
      getPartnerId: getPartnerId(),
      me,
      from: me,
    });
  }

  function actorBadgeHtml(actor) {
    const t = actor?.type === "owner" ? "owner" : "partner";
    const text = t === "owner" ? "OWNER" : "PARTNER";
    const mod = t === "owner" ? "builder-chip--review" : "builder-chip--open";
    return `<span class="builder-chip ${mod}">${esc(text)}</span>`;
  }

  function actorToRow(actor) {
    const a = actor && typeof actor === "object" ? actor : { id: "", type: "", name: "" };
    return {
      actor_id: String(a.id || ""),
      actor_type: String(a.type || ""),
      actor_name: String(a.name || ""),
    };
  }

  function buildSupabaseReadyPayload(state, { omitDataUrls = true } = {}) {
    const s = normalizeMvpState(state || {});
    const builder_partners = (s.partners || []).map((p) => ({
      partner_id: String(p.partner_id || ""),
      display_name: String(p.display_name || ""),
      partner_type: String(p.partner_type || ""),
      trades: Array.isArray(p.trades) ? p.trades : [],
      areas: Array.isArray(p.areas) ? p.areas : [],
      headline: String(p.headline || ""),
      profile: String(p.profile || ""),
      contact_policy: String(p.contact_policy || ""),
      availability: String(p.availability || ""),
      status: String(p.status || ""),
      updated_at: String(p.updated_at || ""),
    }));
    const builder_projects = (s.projects || []).map((p) => ({
      project_id: String(p.project_id || ""),
      owner_id: String(p.owner_id || ""),
      title: String(p.title || ""),
      kind: String(p.kind || ""),
      status: String(p.status || ""),
      required_partners: Number(p.required_partners || 1),
      selected_partner_ids: Array.isArray(p.selected_partner_ids) ? p.selected_partner_ids : [],
      visibility: String(p.visibility || ""),
      contact_policy: String(p.contact_policy || ""),
      main_thread_id: String(p.main_thread_id || ""),
      source: String(p.source || ""),
      source_template_id: p.source_template_id ? String(p.source_template_id) : null,
      created_at: String(p.created_at || ""),
    }));
    const builder_project_applications = (s.applications || []).map((a) => ({
      application_id: String(a.application_id || uid("app")),
      project_id: String(a.project_id || ""),
      partner_id: String(a.partner_id || ""),
      status: String(a.status || "applied"),
      ts: String(a.ts || ""),
      updated_at: a.updated_at ? String(a.updated_at) : null,
    }));

    const builder_threads = [];
    const builder_messages = [];
    const builder_thread_events = [];
    const builder_thread_photos = [];
    const builder_completion_reports = [];
    const builder_invoice_meta = [];
    const builder_pdf_outputs = [];
    const builder_site_attendance = [];

    for (const [thread_id, t] of Object.entries(s.threads || {})) {
      if (!t) continue;
      const project_id = String(t.project_id || "");
      builder_threads.push({ thread_id, project_id });

      for (const m of t.messages || []) {
        const from = m.from || {};
        builder_messages.push({
          msg_id: String(m.msg_id || uid("msg")),
          thread_id,
          project_id,
          ts: String(m.ts || ""),
          text: String(m.text || ""),
          ...actorToRow(from),
        });
      }

      for (const e of t.events || []) {
        const a = e.actor || {};
        builder_thread_events.push({
          event_id: String(e.event_id || uid("ev")),
          thread_id,
          project_id,
          type: String(e.type || ""),
          ts: String(e.ts || ""),
          text: String(e.text || ""),
          ...actorToRow(a),
        });
      }

      for (const p of t.photos || []) {
        builder_thread_photos.push({
          photo_id: String(p.id || uid("photo")),
          thread_id,
          project_id,
          file_name: String(p.file_name || ""),
          caption: String(p.caption || ""),
          uploaded_at: String(p.uploaded_at || ""),
          ...actorToRow(p.uploaded_by || {}),
          url: omitDataUrls && String(p.url || "").startsWith("data:") ? "[dataURL omitted]" : String(p.url || ""),
        });
      }

      if (t.completion_report) {
        const r = t.completion_report;
        builder_completion_reports.push({
          report_id: String(r.report_id || uid("report")),
          thread_id,
          project_id,
          ts: String(r.ts || ""),
          updated_at: String(r.updated_at || r.ts || ""),
          work_content: String(r.work_content || ""),
          note: String(r.note || ""),
          extra_charge: !!r.extra_charge,
          extra_charge_note: String(r.extra_charge_note || ""),
          ...actorToRow(r.actor || {}),
        });
      }

      if (t.invoice_meta) {
        const im = t.invoice_meta;
        builder_invoice_meta.push({
          invoice_meta_id: String(im.invoice_meta_id || uid("invmeta")),
          thread_id,
          project_id,
          updated_at: String(im.updated_at || ""),
          amount: typeof im.amount === "number" ? im.amount : null,
          note: String(im.note || ""),
          status: String(im.status || "draft"),
          finalized_at: im.finalized_at ? String(im.finalized_at) : null,
          ...(() => {
            const fb = im.finalized_by ? actorToRow(im.finalized_by) : { actor_id: "", actor_type: "", actor_name: "" };
            return {
              finalized_by_actor_id: fb.actor_id,
              finalized_by_actor_type: fb.actor_type,
              finalized_by_actor_name: fb.actor_name,
            };
          })(),
        });
      }

      for (const x of t.pdf_outputs || []) {
        builder_pdf_outputs.push({
          pdf_id: String(x.id || uid("pdf")),
          thread_id,
          project_id,
          kind: String(x.kind || ""),
          label: String(x.label || ""),
          generated_at: String(x.generated_at || ""),
          ...actorToRow(x.actor || {}),
          url: omitDataUrls && String(x.url || "").startsWith("data:") ? "[dataURL omitted]" : String(x.url || ""),
        });
      }

      const site = normalizeMvpThreadSiteData(t.siteData, { threadId: thread_id, projectId: project_id, state: s });
      if (site.entry_at || site.exit_at) {
        builder_site_attendance.push({
          attendance_id: uid("att"),
          thread_id,
          project_id,
          entry_at: site.entry_at,
          entry_user_id: site.entry_user_id,
          exit_at: site.exit_at,
          exit_user_id: site.exit_user_id,
        });
      }
    }

    const builder_notifications = getMvpNotifications().map((n) => ({
      notification_id: String(n.id || uid("ntf")),
      type: String(n.type || ""),
      label: String(n.label || ""),
      project_id: n.projectId ? String(n.projectId) : null,
      project_title: String(n.projectTitle || ""),
      thread_id: n.threadId ? String(n.threadId) : null,
      body: String(n.body || ""),
      created_at: String(n.createdAt || ""),
      read: !!n.read,
      href: String(n.href || ""),
    }));

    return {
      builder_partners,
      builder_projects,
      builder_project_applications,
      builder_threads,
      builder_messages,
      builder_thread_events,
      builder_thread_photos,
      builder_completion_reports,
      builder_invoice_meta,
      builder_pdf_outputs,
      builder_site_attendance,
      builder_notifications,
    };
  }

  function buildProjectListItemMvp(project, spec, state) {
    const badge = buildBadgeHtml(SOURCE_UI[project.source]?.badge || null);
    const v = formatVisibility(project.visibility);
    const cp = formatContactPolicy(project.contact_policy);
    const period = spec?.period ? `${spec.period.start}〜${spec.period.end}` : "—";
    const myPartnerId = getPartnerId();
    const myApp = getApplication(state, project.project_id, myPartnerId);
    const applied = !!myApp;
    const status = computeProjectStatus(state, project);
    const role = getRole();
    const required = Number(project.required_partners || 1);
    const selectedIds = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
    const selectedCount = selectedIds.length;
    const filled = selectedCount >= required;
    const hiringText = filled ? "募集人数に達しました" : "募集中";
    const applyBtn =
      role === "partner"
        ? `<button type="button" class="builder-btn builder-btn--primary" data-builder-mvp-apply data-project-id="${esc(
            project.project_id
          )}" ${applied || filled || status === "completed" || status === "invoiced" ? "disabled" : ""}>${
            applied ? "応募済み" : filled ? "募集終了" : status === "completed" || status === "invoiced" ? "完了済み" : "応募"
          }</button>`
        : "";

    const threadId = project.main_thread_id || "";
    const threadLink = threadId ? mvpThreadHref(threadId) : "#";

    return (
      `<li class="builder-list-item" data-builder-mvp-project-row data-project-id="${esc(project.project_id)}">` +
      `<div class="builder-list-item__icon" aria-hidden="true">` +
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
      `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>` +
      `</svg>` +
      `</div>` +
      `<div class="builder-list-item__main">` +
      `<p class="builder-list-item__title">${esc(project.title)}</p>` +
      `<p class="builder-list-item__sub">${badge} ${esc(project.kind === "tasful_managed" ? "TASFUL案件管理" : "Builder掲示板")} · ${esc(
        v
      )} · ステータス: ${esc(toStatusLabel(status))}</p>` +
      `<p class="builder-list-item__sub">${esc(cp)} · 期間: ${esc(period)}</p>` +
      `<p class="builder-list-item__sub">募集人数: ${esc(String(required))} · 選定済み: ${esc(
        String(selectedCount)
      )} · ${esc(hiringText)}</p>` +
      `</div>` +
      `<div class="builder-list-item__actions">` +
      `<a class="builder-btn builder-btn--secondary" href="${esc(threadLink)}" data-builder-mvp-open-thread>スレッド</a>` +
      applyBtn +
      `</div>` +
      `</li>`
    );
  }

  function renderMvpProjectsPage() {
    const api = mvp();
    const state = api.reload();
    const list = document.querySelector("[data-builder-mvp-project-list]");
    const kpi = document.querySelector("[data-builder-mvp-project-count]");
    const topKpi = document.querySelector("[data-builder-mvp-kpi]");
    if (!list || !kpi || !topKpi) return;
    topKpi.textContent = `role: ${getRole()}`;

    const rows = (state.projects || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    kpi.textContent = `${rows.length} 件`;
    list.innerHTML = rows.map((p) => buildMvpProjectCard(p, state.specs?.[p.project_id], state)).join("");

    if (!list.dataset.detailNavBound) {
      list.dataset.detailNavBound = "1";
      list.addEventListener("click", (ev) => {
        if (ev.target?.closest?.("a, button, input, label")) return;
        const card = ev.target?.closest?.("[data-project-id]");
        const projectId = card?.getAttribute("data-project-id");
        if (!projectId) return;
        window.location.href = `mvp-project-detail.html?id=${encodeURIComponent(projectId)}`;
      });
    }

    list.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-builder-mvp-apply]");
      if (!btn) return;
      const projectId = btn.getAttribute("data-project-id");
      if (!projectId) return;
      const role = getRole();
      if (role !== "partner") return;

      const next = api.reload();
      const myPartnerId = getPartnerId();
      const already = (next.applications || []).some(
        (a) => a.project_id === projectId && a.partner_id === myPartnerId
      );
      if (already) return;
      next.applications = [
        ...(next.applications || []),
        { project_id: projectId, partner_id: myPartnerId, status: "applied", ts: nowIso() },
      ];
      const proj = (next.projects || []).find((x) => x.project_id === projectId);
      const status = computeProjectStatus(next, proj);
      if (status === "completed" || status === "invoiced") return;
      const required = Number(proj?.required_partners || 1);
      const selectedIds = Array.isArray(proj?.selected_partner_ids) ? proj.selected_partner_ids : [];
      if (selectedIds.length >= required) return;
      const threadId = proj?.main_thread_id || "";
      if (threadId && next.threads?.[threadId]) {
        const pname = partnerLabel(next, myPartnerId);
        next.threads[threadId].events.push({
          type: "applied",
          actor: { id: myPartnerId, type: "partner", name: pname },
          ts: nowIso(),
          text: "応募がありました（demo）",
        });
        next.threads[threadId].messages.push({
          msg_id: uid("msg"),
          from: { id: myPartnerId, type: "partner", name: pname },
          ts: nowIso(),
          text: "応募します。条件確認をお願いします。",
        });
        next.threads[threadId].events.push({
          type: "message",
          actor: { id: myPartnerId, type: "partner", name: pname },
          ts: nowIso(),
          text: "Talk: 応募します。条件確認をお願いします。",
        });
      }
      api.commit(next);
      api.pushNotification({
        type: "application",
        body: `案件に応募がありました（${proj?.title || projectId}）`,
        project_id: projectId,
        thread_id: proj?.main_thread_id || null,
      });
      renderMvpProjectsPage();
    });
  }

  function buildMvpProjectCard(project, spec, state) {
    const status = computeProjectStatus(state, project);
    const statusLabel = toStatusLabel(status);
    const statusMod = status === "open" ? "open" : status === "applied" ? "applied" : status === "selected" ? "selected" : "muted";
    const kindLabel = project?.kind === "tasful_managed" ? "TASFUL案件管理" : "Builder掲示板";
    const area = spec?.area?.label || spec?.area || "—";
    const period = formatJapaneseDateRange(spec?.period);
    const deadline = formatDeadline(spec?.period?.end);
    const budgetText = formatBudget(showcaseBudget(spec?.budget, { area, title: project?.title || "" }));
    const urgent = isUrgentProject({ project, spec, state, status });
    const required = Math.max(1, Number(project?.required_partners || 1));
    const selectedCount = Array.isArray(project?.selected_partner_ids) ? project.selected_partner_ids.length : 0;
    const apps = (state.applications || []).filter((a) => a.project_id === project.project_id);
    const appCount = apps.length;
    const pct = Math.max(0, Math.min(100, Math.round((selectedCount / required) * 100)));

    const role = getRole();
    const myPartnerId = getPartnerId();
    const myApp = getApplication(state, project.project_id, myPartnerId);
    const applied = !!myApp;
    const filled = selectedCount >= required;
    const disabled = applied || filled || status === "completed" || status === "invoiced";

    const threadId = project.main_thread_id || "";
    const threadLink = mvpThreadHref(threadId);

    const applyBtn =
      role === "partner"
        ? `<button type="button" class="mvp-card__btn mvp-card__btn--outline" data-builder-mvp-apply data-project-id="${esc(
            project.project_id
          )}" ${disabled ? "disabled" : ""}>${applied ? "応募済み" : filled ? "募集終了" : "応募"}</button>`
        : "";

    const barMod = urgent ? "urgent" : status === "applied" ? "applied" : status === "open" ? "open" : "neutral";
    const accentMod = urgent ? "key" : status === "open" ? "msg" : status === "applied" ? "warn" : "neutral";

    return (
      `<article class="mvp-card mvp-card--${esc(accentMod)}" data-project-id="${esc(project.project_id)}">` +
      `<div class="mvp-card__statusBar is-${esc(barMod)}" aria-hidden="true"></div>` +
      `<div class="mvp-card__top">` +
      `<div class="mvp-card__badges">` +
      `<span class="mvp-pill mvp-pill--kind">${esc(kindLabel)}</span>` +
      `<span class="mvp-pill mvp-pill--${esc(statusMod)}">${esc(statusLabel)}</span>` +
      (urgent ? `<span class="mvp-pill mvp-pill--urgent">急募</span>` : "") +
      `</div>` +
      `<div class="mvp-card__triple">` +
      `<div class="mvp-triple mvp-triple--budget"><span class="mvp-triple__label">予算</span><strong class="mvp-triple__value">${esc(
        budgetText
      )}</strong></div>` +
      `<div class="mvp-triple"><span class="mvp-triple__label">締切</span><strong class="mvp-triple__value">${esc(deadline)}</strong></div>` +
      `</div>` +
      `</div>` +
      `<h3 class="mvp-card__title"><a class="mvp-card__titleLink" href="mvp-project-detail.html?id=${esc(
        project.project_id
      )}">${esc(project.title || "—")}</a></h3>` +
      `<div class="mvp-card__meta">` +
      `<div class="mvp-metaRow"><span>エリア</span><strong>${esc(area)}</strong></div>` +
      `<div class="mvp-metaRow"><span>期間</span><strong>${esc(period)}</strong></div>` +
      `</div>` +
      `<div class="mvp-card__numbers">` +
      `<div class="mvp-number"><span class="mvp-number__icon" aria-hidden="true">👥</span><span class="mvp-number__label">募集</span><strong class="mvp-number__value">${esc(
        String(required)
      )}</strong></div>` +
      `<div class="mvp-number"><span class="mvp-number__icon" aria-hidden="true">✅</span><span class="mvp-number__label">選定</span><strong class="mvp-number__value">${esc(
        String(selectedCount)
      )}</strong></div>` +
      `<div class="mvp-number"><span class="mvp-number__icon" aria-hidden="true">✉️</span><span class="mvp-number__label">応募</span><strong class="mvp-number__value">${esc(
        String(appCount)
      )}</strong></div>` +
      `</div>` +
      `<div class="mvp-progress" aria-label="進捗">` +
      `<div class="mvp-progress__bar"><div class="mvp-progress__fill" style="width:${esc(String(pct))}%"></div></div>` +
      `<div class="mvp-progress__hint">${esc(String(selectedCount))} / ${esc(String(required))}</div>` +
      `</div>` +
      `<div class="mvp-card__actions">` +
      `<a class="mvp-card__btn mvp-card__btn--outline" href="mvp-project-detail.html?id=${esc(project.project_id)}">案件詳細</a>` +
      `<a class="mvp-card__btn mvp-card__btn--primary" href="${esc(threadLink)}" data-builder-mvp-open-thread><span class="mvp-btnIcon" aria-hidden="true">💬</span> スレッド</a>` +
      applyBtn +
      `</div>` +
      `</article>`
    );
  }

  const BOARD_KIND = "builder_board";
  const BOARD_KIND_LABEL = "案件";

  function isBoardKindProject(project) {
    return String(project?.kind || "").trim() === BOARD_KIND;
  }

  function resolveBoardItemType(project) {
    const fromFeed = window.TasuBuilderBoardFeed?.resolveBoardType?.(project);
    if (fromFeed) return fromFeed;
    const explicit = String(project?.board_type || project?.projectKind || project?.type || "").trim();
    if (explicit === "job" || explicit === "worker" || explicit === "project" || explicit === "calendar") {
      return explicit;
    }
    if (String(project?.source || "") === "admin_calendar") return "calendar";
    return "project";
  }

  function usesMvpPartnerThread(projectOrKind) {
    if (window.TasuBuilderBoardFeed?.usesMvpPartnerThread) {
      return window.TasuBuilderBoardFeed.usesMvpPartnerThread(projectOrKind);
    }
    const kind =
      typeof projectOrKind === "string" ? String(projectOrKind || "").trim() : resolveBoardItemType(projectOrKind);
    return kind === "calendar" || kind === "worker" || kind === "hire" || kind === "admin_ops";
  }

  function resolveBoardBadgeLabel(project) {
    if (window.TasuBuilderBoardFeed?.resolveProjectBadgeLabel) {
      return window.TasuBuilderBoardFeed.resolveProjectBadgeLabel(project);
    }
    const category = String(project?.project_category || project?.projectCategory || "").trim();
    if (category) return category;
    return getBoardTypeConfig(project).label;
  }

  function getBoardTypeConfig(project) {
    return (
      window.TasuBuilderBoardFeed?.getTypeConfig?.(project) || {
        type: "project",
        label: BOARD_KIND_LABEL,
        applyCta: "応募する",
        appliedCta: "応募済み",
        hireCta: "選定する",
        rejectCta: "断る",
        panelTitle: "応募状況",
        appsSectionLead:
          "応募者の選定 / 断りができます。選定後にやりとりチャットが開きます。",
        applyDetailCta: "この案件に応募する",
        matchVerb: "選定",
        hireNotifyApplicant: "選定されました",
        hireNotifyPoster: "選定が完了しました",
        hireBodyApplicant: "やりとりチャットへ進んでください。",
        hireBodyPoster: "さんとのやりとりチャットへ進んでください。",
        rejectNotify: "今回は見送りになりました",
        overviewTitle: "案件内容",
        workTitle: "作業内容",
        tradesTitle: "募集職種",
      }
    );
  }

  function isBoardFeedItem(project) {
    if (window.TasuBuilderBoardFeed?.isBoardFeedProject?.(project)) return true;
    return isBoardKindProject(project);
  }

  function filterBoardProjects(projects) {
    if (window.TasuBuilderBoardFeed?.filterBoardFeed) {
      return window.TasuBuilderBoardFeed.filterBoardFeed(projects);
    }
    return (projects || []).filter(isBoardKindProject);
  }

  function boardDetailHref(projectId, boardType) {
    if (window.TasuBuilderBoardFeed?.boardDetailHref) {
      return window.TasuBuilderBoardFeed.boardDetailHref(projectId, boardType);
    }
    const id = String(projectId || "").trim();
    return id ? `board-project-detail.html?id=${encodeURIComponent(id)}` : "board-projects.html";
  }

  function resolveBoardMainThreadId(state, project) {
    const direct = String(project?.main_thread_id || "").trim();
    if (direct && state?.threads?.[direct]) return direct;
    const match = Object.values(state?.threads || {}).find(
      (t) => String(t.project_id) === String(project?.project_id)
    );
    return String(match?.thread_id || "").trim();
  }

  function boardThreadsHref(projectId) {
    const sp = new URLSearchParams();
    const pid = String(projectId || "").trim();
    if (pid) sp.set("project_id", pid);
    if (getParam("from") === "talk") sp.set("from", "talk");
    const q = sp.toString();
    return q ? `board-threads.html?${q}` : "board-threads.html";
  }

  function boardThreadHref(threadId, role) {
    const tid = String(threadId || "").trim();
    if (!tid) return "board-thread.html";
    const sp = new URLSearchParams();
    sp.set("thread_id", tid);
    sp.set("role", normalizeMvpRole(role || getRole()));
    if (getParam("from") === "talk") sp.set("from", "talk");
    return `board-thread.html?${sp.toString()}`;
  }

  function resolveBoardOrMvpThreadNotifyHref(threadId, role, project, threadType, options = {}) {
    const tid = String(threadId || "").trim();
    if (!tid) return "board-thread.html";
    if (project && usesMvpPartnerThread(project)) {
      return mvpThreadHref(tid, role, threadType);
    }
    if (project && isGeneralBoardMvpProject(project)) {
      let href = boardThreadHref(tid, role);
      if (options.completionAnchor && !href.includes("#completion")) {
        href += "#completion";
      }
      return href;
    }
    return mvpThreadHref(tid, role, threadType);
  }

  function filterBoardThreads(state) {
    return Object.values(state?.threads || {}).filter((t) => {
      const project = (state.projects || []).find((p) => p.project_id === t.project_id);
      if (!project || !isBoardFeedItem(project)) return false;
      const rowType = getThreadRowType(t);
      if (BUILDER_ACTIVE_THREAD_TYPES.has(rowType)) return false;
      if (rowType === "general_project") return true;
      const mapped = BUILDER_THREAD_TYPE_BY_ID[resolveBuilderThreadId(t.thread_id)];
      return mapped === "general_project";
    });
  }

  function boardThreadListStatusLabel(project, state, thread) {
    if (!project) return "—";
    const status = computeProjectStatus(state, project);
    const events = Array.isArray(thread?.events) ? thread.events : [];
    const has = (type) => events.some((e) => e?.type === type);
    const msgCount = (thread?.messages || []).length;

    if (has("invoiced") || status === "invoiced") return "完了";
    if (has("completed") || status === "completed") return "支払い待ち";
    if (status === "selected" || (project.selected_partner_ids || []).length > 0) {
      return msgCount > 0 ? "条件相談中" : "選定済";
    }
    if (status === "applied" || status === "open") {
      const apps = (state.applications || []).filter((a) => a.project_id === project.project_id);
      if (apps.length) return "応募中";
    }
    if (has("completion_requested") || thread?.status === "completion_pending") return "完了確認待ち";
    return "応募中";
  }

  function boardThreadListStatusMod(label) {
    const map = {
      応募中: "applied",
      選定済: "selected",
      採用済: "selected",
      条件相談中: "open",
      完了確認待ち: "urgent",
      支払い待ち: "applied",
      完了: "muted",
    };
    return map[label] || "muted";
  }

  function boardThreadCounterpartLabel(project, state) {
    if (!project) return "—";
    const role = getRole();
    if (role === "partner") return "TASFUL運営";
    const selectedIds = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
    if (selectedIds.length === 1) return partnerLabel(state, selectedIds[0]);
    if (selectedIds.length > 1) {
      return selectedIds.map((id) => partnerLabel(state, id)).slice(0, 2).join("・");
    }
    const apps = (state.applications || []).filter((a) => a.project_id === project.project_id);
    if (apps.length === 1) return partnerLabel(state, apps[0].partner_id);
    if (apps.length > 1) return `応募 ${apps.length} 社`;
    return "応募待ち";
  }

  function resolveBoardTalkBackHref() {
    return getParam("from") === "talk" ? "../talk-home.html?tab=notify" : "index.html";
  }

  function replaceBoardThreadUrl({ threadId, role } = {}) {
    if (getPage() !== "builder-board-thread") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const tid = String(threadId || sp.get("thread_id") || getMvpThreadIdParam() || "").trim();
      if (!tid) return;
      sp.set("thread_id", tid);
      if (role) {
        sp.set("role", normalizeMvpRole(role));
      } else if (sp.get("role")) {
        sp.set("role", normalizeMvpRole(sp.get("role")));
      }
      const file = window.location.pathname.split("/").pop() || "board-thread.html";
      const next = `${file}?${sp.toString()}${window.location.hash || ""}`;
      const current = `${file}${window.location.search}${window.location.hash || ""}`;
      if (next !== current) {
        window.history.replaceState({}, "", next);
      }
    } catch {
      // ignore
    }
  }

  function ensureBoardThreadUrlParams() {
    if (getPage() !== "builder-board-thread") return;
    const urlRole = getParam("role");
    const threadId = getMvpThreadIdParam();
    if (!threadId || !urlRole) return;
    replaceBoardThreadUrl({ threadId, role: urlRole });
  }

  function applyBoardPageBackLinks() {
    const back = document.querySelector("[data-builder-page-back]");
    if (!back) return;
    if (getParam("from") !== "talk") return;
    const href = resolveBoardTalkBackHref();
    const label = "TASFUL TALKへ";
    back.setAttribute("href", href);
    back.setAttribute("aria-label", label);
    back.textContent = `‹ ${label}`;
  }

  /** 選定・依頼受諾時のみやりとりチャットを作成（応募・依頼時は作成しない） */
  function ensureBoardMatchThread(next, projectId, partnerId) {
    const pidx = (next.projects || []).findIndex((x) => x.project_id === projectId);
    if (pidx < 0) return null;
    const pr = next.projects[pidx];
    const typeCfg = getBoardTypeConfig(pr);
    let threadId = String(pr.main_thread_id || "").trim();
    const ownerId = next.owner_id || OWNER_ID;
    const ownerName = "TASFUL運営";
    const partnerName = partnerLabel(next, partnerId);

    const threadKind =
      window.TasuBuilderBoardFeed?.resolveThreadKind?.(pr) ||
      (resolveBoardItemType(pr) === "worker" ? "worker_request" : "board_match");

    if (!threadId || !next.threads?.[threadId]) {
      threadId = uid("thread");
      next.threads = {
        ...(next.threads || {}),
        [threadId]: {
          thread_id: threadId,
          thread_kind: threadKind,
          project_id: projectId,
          partner_id: partnerId,
          events: [],
          messages: [],
          photos: [],
          completion: null,
        },
      };
      next.projects[pidx] = { ...pr, main_thread_id: threadId };
    } else if (!next.threads[threadId].thread_kind) {
      next.threads[threadId].thread_kind = threadKind;
    }

    const thread = next.threads[threadId];
    thread.events = thread.events || [];
    thread.messages = thread.messages || [];
    const alreadyMatched = thread.events.some(
      (e) => e.type === "selected" && String(e.text || "").includes(partnerName)
    );
    if (!alreadyMatched) {
      const matchLabel = typeCfg.matchVerb || "選定";
      thread.events.push({
        type: "selected",
        actor: { id: ownerId, type: "owner", name: ownerName },
        ts: nowIso(),
        text: `${matchLabel}: ${partnerName}`,
      });
      thread.messages.push({
        msg_id: uid("msg"),
        from: { id: ownerId, type: "owner", name: ownerName },
        ts: nowIso(),
        text: `${partnerName} さんを${matchLabel}しました。条件確認・日程調整はこのチャットで進めてください。`,
      });
      thread.messages.push({
        msg_id: uid("msg"),
        from: { id: partnerId, type: "partner", name: partnerName },
        ts: nowIso(),
        text:
          typeCfg.type === "worker"
            ? "依頼ありがとうございます。よろしくお願いします。"
            : "選定ありがとうございます。よろしくお願いします。",
      });
    }
    return threadId;
  }

  function pushBoardTalkNotification({
    title,
    body,
    threadId,
    typeCfg,
    actionLabel,
    role,
    projectKind,
    href,
  }) {
    try {
      const kind =
        String(projectKind || typeCfg?.type || typeCfg?.projectKind || "").trim() || "project";
      const chatRole = normalizeMvpRole(role || (usesMvpPartnerThread(kind) ? "partner" : getRole()));
      const explicitHref = String(href || "").trim();
      const chatUrl = explicitHref
        ? explicitHref.replace(/^\.\.\//, "")
        : threadId
          ? usesMvpPartnerThread(kind)
            ? `builder/mvp-thread.html?thread_id=${encodeURIComponent(threadId)}&role=${encodeURIComponent(chatRole)}`
            : `builder/board-thread.html?thread_id=${encodeURIComponent(threadId)}&role=${encodeURIComponent(chatRole)}`
          : usesMvpPartnerThread(kind)
            ? `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(typeCfg?.projectId || "")}`
            : `builder/board-project-detail.html?id=${encodeURIComponent(typeCfg?.projectId || "")}`;
      window.TasuTalkPlatformNotify?.pushNotification?.({
        type: "builder",
        category: typeCfg?.label || "Builder",
        title,
        body,
        actionLabel: actionLabel || (threadId ? "チャットを開く" : "内容を確認"),
        href: chatUrl,
        targetUrl: chatUrl,
        priority: threadId ? "high" : "medium",
        source: "builder",
      });
    } catch {
      /* optional */
    }
  }

  function isCalendarThreadProject(project) {
    return resolveBoardItemType(project) === "calendar";
  }

  function resolveThreadPageHref(threadId, project, role) {
    const tid = String(threadId || "").trim();
    if (!tid) return "#";
    const r = normalizeMvpRole(role || getRole());
    if (usesMvpPartnerThread(project)) {
      return `mvp-thread.html?thread_id=${encodeURIComponent(tid)}&role=${encodeURIComponent(r)}`;
    }
    return boardThreadHref(tid, r);
  }

  function normalizeThreadCompletionSubmission(thread) {
    const raw = thread?.completion_submission;
    if (!raw || typeof raw !== "object") return null;
    const status = String(raw.status || "").trim();
    if (!status) return null;
    return {
      status,
      comment: String(raw.comment || ""),
      attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
      photos: Array.isArray(raw.photos) ? raw.photos : [],
      invoice: raw.invoice && typeof raw.invoice === "object" ? raw.invoice : null,
      submitted_at: raw.submitted_at || "",
      submitted_by: raw.submitted_by || null,
      rejected_reason: String(raw.rejected_reason || ""),
      rejected_at: raw.rejected_at || "",
      approved_at: raw.approved_at || "",
    };
  }

  function isGeneralBoardMvpProject(project) {
    return Boolean(project && isBoardFeedItem(project) && !usesMvpPartnerThread(project));
  }

  function threadCompletionSelectedApplicantId(project, state) {
    const selected = Array.isArray(project?.selected_partner_ids) ? project.selected_partner_ids : [];
    const fromSelected = String(selected[0] || "").trim();
    if (fromSelected) return fromSelected;
    const app = (state?.applications || []).find(
      (a) => a.project_id === project?.project_id && a.status === "selected"
    );
    return String(app?.partner_id || "").trim();
  }

  function resolveGeneralFlowActorId(project, state) {
    if (isBuilderProdHost()) {
      const ctx = {
        project,
        state,
        flowSpec: project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null,
      };
      return String(
        builderIdentity().resolveActorIdForDeal?.(ctx) ||
          builderIdentity().getBuilderActor?.(ctx)?.actorId ||
          ""
      ).trim();
    }
    const spec = project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
    const urlPid = String(getParam("partnerId") || getParam("partner_id") || getParam("userId") || "").trim();
    const ownerId = String(project?.owner_id || "").trim();
    const applicantId = threadCompletionSelectedApplicantId(project, state);
    const actorId = String(getActor(state).id || "").trim();

    if (spec) {
      const posterId = String(spec.poster?.id || "").trim();
      const appId = String(spec.applicant?.id || "").trim();
      if (urlPid && (urlPid === posterId || urlPid === appId)) return urlPid;
      if (actorId && (actorId === posterId || actorId === appId)) return actorId;
      return actorId || urlPid || posterId;
    }

    if (urlPid) {
      if (urlPid === ownerId || urlPid === applicantId) return urlPid;
    }

    const role = normalizeMvpRole(getRole());
    if (role === "partner") return String(getPartnerId() || applicantId || "").trim();
    if (role === "owner") return String(state?.owner_id || ownerId || OWNER_ID).trim();
    return actorId || String(getPartnerId() || "").trim();
  }

  function threadCompletionActorId(state, project) {
    if (project && isGeneralBoardMvpProject(project)) {
      return resolveGeneralFlowActorId(project, state);
    }
    const role = getRole();
    if (role === "owner") return String(state?.owner_id || OWNER_ID).trim();
    if (role === "user") return String(getPartnerId() || "demo-builder-user").trim();
    if (role === "vendor") return String(getPartnerId() || "demo-vendor-001").trim();
    if (role === "partner") return String(getPartnerId() || "").trim();
    return String(getActor(state).id || "").trim();
  }

  function threadCompletionPartnerAssigned(project, state) {
    if (isGeneralBoardMvpProject(project)) {
      const applicantId = threadCompletionSelectedApplicantId(project, state);
      return applicantId && threadCompletionActorId(state, project) === applicantId;
    }
    const pid = getPartnerId();
    const selected = Array.isArray(project?.selected_partner_ids) ? project.selected_partner_ids : [];
    if (selected.includes(pid)) return true;
    if (String(project?.calendar_assigned_partner_id || "") === pid) return true;
    return false;
  }

  function threadCompletionIsSubmitter(state, project) {
    if (isBuilderProdHost()) {
      const ctx = {
        project,
        state,
        flowSpec: project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null,
      };
      return builderIdentity().isCompletionSubmitter?.(ctx) === true;
    }
    if (isGeneralBoardMvpProject(project)) {
      const applicantId = threadCompletionSelectedApplicantId(project, state);
      return Boolean(applicantId && threadCompletionActorId(state, project) === applicantId);
    }
    return getRole() === "partner" && threadCompletionPartnerAssigned(project, state);
  }

  function threadCompletionIsReviewer(state, project) {
    if (isBuilderProdHost()) {
      const ctx = {
        project,
        state,
        flowSpec: project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null,
      };
      return builderIdentity().isCompletionReviewer?.(ctx) === true;
    }
    if (isGeneralBoardMvpProject(project)) {
      const spec = project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
      const actorId = threadCompletionActorId(state, project);
      if (spec) {
        return Boolean(actorId && actorId === String(spec.poster?.id || "").trim());
      }
      const ownerId = String(project?.owner_id || "").trim();
      return Boolean(ownerId && actorId === ownerId);
    }
    return getRole() === "owner";
  }

  function resolveGeneralBoardApplicantRole(project, state) {
    const applicantId = threadCompletionSelectedApplicantId(project, state);
    const app = (state?.applications || []).find(
      (a) => a.project_id === project?.project_id && String(a.partner_id || "") === applicantId
    );
    return String(app?.applicant_role || "partner").trim() || "partner";
  }

  function resolveGeneralBoardPosterRole(project, state) {
    const spec = project?.bench_flow_id ? getBenchGeneralFlowSpec(project.bench_flow_id, project) : null;
    if (spec?.poster?.role) return String(spec.poster.role).trim();
    const ownerId = String(project?.owner_id || "").trim();
    if (!ownerId || ownerId === OWNER_ID) return "owner";
    if (ownerId === "demo-builder-user" || ownerId === "demo-user-peer-001") return "user";
    if (ownerId === "demo-vendor-001") return "vendor";
    if ((state?.partners || []).some((p) => p.partner_id === ownerId)) return "partner";
    return "user";
  }

  const MVP_THREAD_CHAT_LOCK_BANNER_TEXT =
    "この案件は完了しました。履歴は閲覧できますが、新しいメッセージは送信できません。";

  function isMvpThreadChatLocked(thread, project, state) {
    if (!thread) return false;
    if (String(thread.status || "") === "cancelled") return true;
    const siteData = normalizeMvpThreadSiteData(thread.siteData, {
      threadId: thread.thread_id,
      projectId: thread.project_id,
      state,
    });
    const sub = normalizeThreadCompletionSubmission(thread);
    return Boolean(
      siteData.completed || thread.status === "completed" || sub?.status === "approved"
    );
  }

  function renderMvpThreadChatLockBanner() {
    return (
      `<div class="mvp-thread-chatLockBanner" role="status">` +
      `<p class="mvp-thread-chatLockBanner__text">${esc(MVP_THREAD_CHAT_LOCK_BANNER_TEXT)}</p>` +
      `</div>`
    );
  }

  function applyMvpThreadChatLockUi(locked) {
    const isLocked = Boolean(locked);
    const bannerHost = document.querySelector("[data-builder-mvp-thread-chat-lock]");
    const compose = document.querySelector(".mvp-slack-thread__compose");
    const form = document.querySelector("[data-builder-mvp-thread-form]");
    const input = document.querySelector("[data-builder-mvp-thread-input]");
    const sendBtn = document.querySelector("[data-builder-mvp-thread-send]");
    const imgInput = document.querySelector("[data-builder-mvp-thread-attach-image]");
    const pdfInput = document.querySelector("[data-builder-mvp-thread-attach-pdf]");
    const imgLabel = imgInput?.closest?.("label");
    const pdfLabel = pdfInput?.closest?.("label");
    const pendingHost = document.querySelector("[data-builder-mvp-thread-pending]");

    document.body.classList.toggle("mvp-thread--chat-locked", isLocked);

    if (bannerHost) {
      bannerHost.hidden = !isLocked;
      bannerHost.innerHTML = isLocked ? renderMvpThreadChatLockBanner() : "";
    }

    if (compose) compose.classList.toggle("mvp-thread-compose--locked", isLocked);
    if (form) form.setAttribute("aria-disabled", isLocked ? "true" : "false");
    [input, sendBtn, imgInput, pdfInput].forEach((el) => {
      if (!el) return;
      el.disabled = isLocked;
      if (isLocked && el === input) el.value = "";
    });
    [imgLabel, pdfLabel].forEach((el) => {
      if (!el) return;
      el.classList.toggle("is-disabled", isLocked);
      if (isLocked) el.setAttribute("aria-disabled", "true");
      else el.removeAttribute("aria-disabled");
    });
    if (isLocked) {
      mvpThreadComposePending = [];
      if (pendingHost) {
        pendingHost.hidden = true;
        pendingHost.innerHTML = "";
      }
      if (input) input.placeholder = "この案件は完了済みのため送信できません";
    } else if (input) {
      input.placeholder = "メッセージを入力…";
    }
  }

  function threadCanSubmitCompletion(thread, project, state) {
    if (isMvpThreadChatLocked(thread, project, state)) return false;
    const sub = normalizeThreadCompletionSubmission(thread);
    if (sub?.status === "submitted" || sub?.status === "approved") return false;
    const boardType = resolveBoardItemType(project);
    const siteData = normalizeMvpThreadSiteData(thread?.siteData, {
      threadId: thread?.thread_id,
      projectId: thread?.project_id,
      state,
    });
    if (siteData.completed || thread?.status === "completed") return false;
    const selected = (project?.selected_partner_ids || []).length > 0;
    if (!selected) return false;
    if (boardType === "worker") {
      return getRole() === "owner";
    }
    if (!threadCompletionIsSubmitter(state, project)) return false;
    return threadCompletionPartnerAssigned(project, state);
  }

  function threadCanReviewCompletion(thread, project, state) {
    const sub = normalizeThreadCompletionSubmission(thread);
    if (sub?.status !== "submitted") return false;
    const boardType = resolveBoardItemType(project);
    if (boardType === "worker") {
      if (getRole() !== "partner") return false;
      const myId = getPartnerId();
      const app = (state?.applications || []).find(
        (a) => a.project_id === project?.project_id && a.partner_id === myId
      );
      return app?.status === "selected" || threadCompletionPartnerAssigned(project, state);
    }
    return threadCompletionIsReviewer(state, project);
  }

  const threadCompletionDraft = {
    attachments: [],
    photos: [],
    invoice: null,
  };

  function resetThreadCompletionDraft() {
    threadCompletionDraft.attachments = [];
    threadCompletionDraft.photos = [];
    threadCompletionDraft.invoice = null;
  }

  function renderThreadCompletionFileList(files, label) {
    if (!files?.length) return "";
    return (
      `<ul class="mvp-thread-completion__files">` +
      files
        .map(
          (f) =>
            `<li><span class="mvp-thread-completion__fileType">${esc(f.type === "pdf" ? "PDF" : f.type === "image" ? "画像" : "FILE")}</span> ${esc(f.name || "—")}</li>`
        )
        .join("") +
      `</ul>`
    );
  }

  function renderThreadCompletionSummary(sub, options = {}) {
    const when = sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "—";
    const by = sub.submitted_by?.name || "—";
    return (
      `<div class="mvp-thread-completion__summary">` +
      `<h3 class="mvp-thread-completion__title">${options.approved ? "完了報告（承認済み）" : "完了報告"}</h3>` +
      `<dl class="mvp-thread-completion__rows">` +
      `<div class="mvp-thread-completion__row"><dt>報告者</dt><dd>${esc(by)}</dd></div>` +
      `<div class="mvp-thread-completion__row"><dt>作業完了コメント</dt><dd>${esc(sub.comment || "—")}</dd></div>` +
      `<div class="mvp-thread-completion__row"><dt>提出日時</dt><dd>${esc(when)}</dd></div>` +
      `</dl>` +
      (sub.attachments?.length
        ? `<div class="mvp-thread-completion__group"><span class="mvp-thread-completion__groupLabel">添付ファイル</span>${renderThreadCompletionFileList(sub.attachments)}</div>`
        : "") +
      (sub.photos?.length
        ? `<div class="mvp-thread-completion__group"><span class="mvp-thread-completion__groupLabel">完了写真</span>${renderThreadCompletionFileList(sub.photos)}</div>`
        : "") +
      (sub.invoice
        ? `<div class="mvp-thread-completion__group"><span class="mvp-thread-completion__groupLabel">請求書</span>${renderThreadCompletionFileList([sub.invoice])}</div>`
        : "") +
      `</div>`
    );
  }

  function renderThreadCompletionSubmitCard(threadId) {
    return (
      `<div class="mvp-thread-completion mvp-thread-completion--submit" data-thread-completion-card="submit">` +
      `<h3 class="mvp-thread-completion__title">完了報告</h3>` +
      `<p class="mvp-thread-completion__lead">作業完了後、コメント・写真・請求書を添えて提出してください。承認後に取引が完了します。</p>` +
      `<form class="mvp-thread-completion__form" data-thread-completion-form="${esc(threadId)}">` +
      `<label class="builder-field builder-field--full">` +
      `<span class="builder-field__label">作業完了コメント</span>` +
      `<textarea class="builder-textarea" rows="3" data-thread-completion-comment placeholder="作業内容・完了状況を記入"></textarea>` +
      `</label>` +
      `<div class="mvp-thread-completion__uploads">` +
      `<label class="builder-field">` +
      `<span class="builder-field__label">添付ファイル</span>` +
      `<label class="builder-btn builder-btn--ghost mvp-thread-compose__fileBtn">ファイルを追加` +
      `<input type="file" multiple data-thread-completion-attach hidden /></label>` +
      `<div class="mvp-thread-compose__pending" data-thread-completion-attach-pending hidden></div>` +
      `</label>` +
      `<label class="builder-field">` +
      `<span class="builder-field__label">完了写真</span>` +
      `<label class="builder-btn builder-btn--ghost mvp-thread-compose__fileBtn">写真を追加` +
      `<input type="file" accept="image/*" multiple data-thread-completion-photo hidden /></label>` +
      `<div class="mvp-thread-compose__pending" data-thread-completion-photo-pending hidden></div>` +
      `</label>` +
      `<label class="builder-field">` +
      `<span class="builder-field__label">請求書</span>` +
      `<label class="builder-btn builder-btn--ghost mvp-thread-compose__fileBtn">PDFを選択` +
      `<input type="file" accept="application/pdf,.pdf" data-thread-completion-invoice hidden /></label>` +
      `<div class="mvp-thread-compose__pending" data-thread-completion-invoice-pending hidden></div>` +
      `</label>` +
      `</div>` +
      `<div class="mvp-thread-completion__actions">` +
      `<button type="submit" class="builder-btn builder-btn--primary" data-thread-completion-submit>提出する</button>` +
      `</div>` +
      `</form>` +
      `</div>`
    );
  }

  function isThreadCompletionPhotoImage(photo) {
    const type = String(photo?.type || "").toLowerCase();
    if (type === "image" || type.includes("image")) return true;
    const name = String(photo?.name || photo?.fileName || photo?.file_name || "").toLowerCase();
    return /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(name);
  }

  function resolveThreadCompletionPhotoSrc(photo, thread, state) {
    if (!photo) return "";
    const direct = String(photo.dataUrl || photo.url || photo.previewUrl || "").trim();
    if (direct) return direct;
    const name = String(photo.name || photo.fileName || photo.file_name || "").trim();
    if (thread && name) {
      const sitePhotos = getSitePhotosFromThread(thread, state, {
        threadId: thread.thread_id,
        projectId: thread.project_id,
      });
      const match = sitePhotos.find((p) => {
        const fn = String(p.fileName || "").trim();
        return fn === name || fn.includes(name) || name.includes(fn);
      });
      if (match?.url) return match.url;
    }
    if (!name || !isThreadCompletionPhotoImage(photo)) return "";
    return `https://placehold.co/640x360/1e293b/cbd5e1?text=${encodeURIComponent(name.slice(0, 28))}`;
  }

  function renderThreadCompletionChatCardPhotoThumbnails(photos, thread, state) {
    const imagePhotos = (photos || []).filter((p) => isThreadCompletionPhotoImage(p));
    if (!imagePhotos.length) return "";
    const tiles = imagePhotos
      .map((photo, i) => {
        const src = resolveThreadCompletionPhotoSrc(photo, thread, state);
        if (!src) return "";
        const label = esc(photo.name || photo.fileName || photo.file_name || `写真${i + 1}`);
        return (
          `<a class="mvp-thread-completionChatCard__thumbLink" href="${esc(src)}" target="_blank" rel="noopener noreferrer" aria-label="${label}">` +
          `<img class="mvp-thread-completionChatCard__thumb" src="${esc(src)}" alt="${label}" loading="lazy" />` +
          `</a>`
        );
      })
      .filter(Boolean)
      .join("");
    if (!tiles) return "";
    return (
      `<div class="mvp-thread-completionChatCard__group">` +
      `<span class="mvp-thread-completionChatCard__groupLabel">完了写真</span>` +
      `<div class="mvp-thread-completionChatCard__thumbs">${tiles}</div>` +
      `</div>`
    );
  }

  function renderOpsPartnerThreadCompletionChatCard(threadId, thread, project, state) {
    const threadType = getBuilderThreadTypeParam() || getThreadRowType(thread);
    const isOpsPartner = threadType === "ops_partner";
    const isGeneralBoard = isGeneralBoardMvpProject(project);
    if (!isOpsPartner && !isGeneralBoard) return "";
    const sub = normalizeThreadCompletionSubmission(thread);
    if (!sub || !["submitted", "approved", "rejected"].includes(sub.status)) return "";

    const isReviewer = threadCompletionIsReviewer(state, project);
    const isSubmitter = threadCompletionIsSubmitter(state, project);
    const canReview = threadCanReviewCompletion(thread, project, state);
    const projectTitle = project?.title || thread.project_id || "—";
    const when = sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "—";
    const by = sub.submitted_by?.name || "—";
    const photosHtml = renderThreadCompletionChatCardPhotoThumbnails(sub.photos, thread, state);

    if (isSubmitter && !isReviewer) {
      let statusLine = "";
      if (sub.status === "submitted") {
        statusLine =
          `<p class="mvp-thread-completionChatCard__status mvp-thread-completionChatCard__status--pending">提出済み — 確認待ちです。</p>`;
      } else if (sub.status === "approved") {
        statusLine =
          `<p class="mvp-thread-completionChatCard__status mvp-thread-completionChatCard__status--approved">承認済み</p>`;
      } else if (sub.status === "rejected") {
        statusLine =
          `<p class="mvp-thread-completionChatCard__status mvp-thread-completionChatCard__status--rejected">差し戻し済み — 修正して再提出してください。</p>` +
          (sub.rejected_reason
            ? `<p class="mvp-thread-completionChatCard__rejectReason"><strong>差し戻し理由:</strong> ${esc(sub.rejected_reason)}</p>`
            : "");
      }
      return (
        `<li class="mvp-slack-msg mvp-slack-msg--completion-card">` +
        `<div class="mvp-thread-completionChatCard" data-ops-partner-completion-chat-card data-thread-completion-card="partner-submitted">` +
        `<h3 class="mvp-thread-completionChatCard__title">完了報告</h3>` +
        statusLine +
        `</div></li>`
      );
    }

    if (!isReviewer) return "";

    if (isGeneralBoard && onBoardThreadPage) return "";

    let statusBadge = "";
    if (sub.status === "approved") {
      statusBadge = `<span class="mvp-thread-completionChatCard__badge mvp-thread-completionChatCard__badge--approved">承認済み</span>`;
    } else if (sub.status === "rejected") {
      statusBadge = `<span class="mvp-thread-completionChatCard__badge mvp-thread-completionChatCard__badge--rejected">差し戻し済み</span>`;
    }

    const onBoardThreadPage = getPage() === "builder-board-thread";
    const reviewActions =
      canReview && sub.status === "submitted" && !(isGeneralBoard && onBoardThreadPage)
        ? `<div class="mvp-thread-completion mvp-thread-completion--review" data-thread-completion-card="review">` +
          `<div class="mvp-thread-completion__actions">` +
          `<button type="button" class="builder-btn builder-btn--primary" data-thread-completion-approve="${esc(threadId)}">承認する</button>` +
          `<button type="button" class="builder-btn builder-btn--ghost" data-thread-completion-reject-open="${esc(threadId)}">差し戻す</button>` +
          `</div>` +
          `<div class="mvp-thread-completion__reject" data-thread-completion-reject-form hidden>` +
          `<label class="builder-field builder-field--full">` +
          `<span class="builder-field__label">差し戻し理由</span>` +
          `<textarea class="builder-textarea" rows="2" data-thread-completion-reject-reason placeholder="修正が必要な点を記入"></textarea>` +
          `</label>` +
          `<button type="button" class="builder-btn builder-btn--secondary" data-thread-completion-reject-confirm="${esc(threadId)}">差し戻しを確定</button>` +
          `</div>` +
          `</div>`
        : sub.status === "rejected" && sub.rejected_reason
          ? `<p class="mvp-thread-completionChatCard__rejectReason"><strong>差し戻し理由:</strong> ${esc(sub.rejected_reason)}</p>`
          : "";

    return (
      `<li class="mvp-slack-msg mvp-slack-msg--completion-card">` +
      `<div class="mvp-thread-completionChatCard" data-ops-partner-completion-chat-card data-thread-completion-card="owner-review">` +
      `<div class="mvp-thread-completionChatCard__head">` +
      `<h3 class="mvp-thread-completionChatCard__title">完了報告申請</h3>` +
      statusBadge +
      `</div>` +
      (sub.status === "submitted"
        ? `<p class="mvp-thread-completionChatCard__lead">${
            isOpsPartner ? "パートナーから完了報告が提出されました" : "完了報告が提出されました"
          }</p>`
        : "") +
      `<dl class="mvp-thread-completionChatCard__rows">` +
      `<div class="mvp-thread-completionChatCard__row"><dt>案件名</dt><dd>${esc(projectTitle)}</dd></div>` +
      `<div class="mvp-thread-completionChatCard__row"><dt>報告者</dt><dd>${esc(by)}</dd></div>` +
      `<div class="mvp-thread-completionChatCard__row"><dt>提出日時</dt><dd>${esc(when)}</dd></div>` +
      `<div class="mvp-thread-completionChatCard__row"><dt>作業完了コメント</dt><dd>${esc(sub.comment || "—")}</dd></div>` +
      `</dl>` +
      photosHtml +
      reviewActions +
      `</div></li>`
    );
  }

  function renderThreadCompletionReviewActions(threadId, options = {}) {
    const compact = options.compact === true;
    const actionClass = compact
      ? "mvp-thread-completion__actions mvp-thread-completion__actions--notify-focus"
      : "mvp-thread-completion__actions";
    return (
      `<div class="mvp-thread-completion mvp-thread-completion--review${compact ? " mvp-thread-completion--review-compact" : ""}"${
        compact ? "" : ` data-thread-completion-card="review"`
      }>` +
      (compact
        ? ""
        : `<h3 class="mvp-thread-completion__title">完了報告の確認</h3>` +
          `<p class="mvp-thread-completion__lead">内容を確認のうえ、承認または差し戻しを選択してください。</p>`) +
      `<div class="${actionClass}">` +
      `<button type="button" class="builder-btn builder-btn--primary" data-thread-completion-approve="${esc(threadId)}">承認する</button>` +
      `<button type="button" class="builder-btn builder-btn--ghost" data-thread-completion-reject-open="${esc(threadId)}">差し戻す</button>` +
      `</div>` +
      `<div class="mvp-thread-completion__reject" data-thread-completion-reject-form hidden>` +
      `<label class="builder-field builder-field--full">` +
      `<span class="builder-field__label">差し戻し理由</span>` +
      `<textarea class="builder-textarea" rows="2" data-thread-completion-reject-reason placeholder="修正が必要な点を記入"></textarea>` +
      `</label>` +
      `<button type="button" class="builder-btn builder-btn--secondary" data-thread-completion-reject-confirm="${esc(threadId)}">差し戻しを確定</button>` +
      `</div>` +
      `</div>`
    );
  }

  function renderThreadCompletionReviewCard(threadId) {
    return renderThreadCompletionReviewActions(threadId, { compact: false });
  }

  function renderThreadCompletionNotifyFocus(sub, threadId, canReview) {
    const by = sub.submitted_by?.name || "パートナー";
    const comment = String(sub.comment || "").trim();
    const hasDetails =
      Boolean(comment) ||
      (Array.isArray(sub.photos) && sub.photos.length > 0) ||
      (Array.isArray(sub.attachments) && sub.attachments.length > 0) ||
      Boolean(sub.invoice);
    const actions =
      canReview && sub.status === "submitted"
        ? renderThreadCompletionReviewActions(threadId, { compact: true })
        : "";
    const details = hasDetails
      ? `<details class="mvp-thread-completion__notify-details">` +
        `<summary>報告内容を確認</summary>` +
        `<p class="mvp-thread-completion__notify-comment">${esc(comment || "作業が完了しました。")}</p>` +
        `</details>`
      : "";
    return (
      `<div class="mvp-thread-completion mvp-thread-completion--notify-focus" data-thread-completion-card="notify-focus">` +
      `<p class="mvp-thread-completion__notify-reporter">` +
      `<span class="mvp-thread-completion__notify-reporterLabel">完了報告者</span>` +
      `<strong>${esc(by)}</strong>` +
      `</p>` +
      (canReview && sub.status === "submitted" ? renderThreadCompletionSummary(sub) : "") +
      actions +
      details +
      `</div>`
    );
  }

  function renderThreadCompletionEmptyState(message = "完了報告はまだありません。") {
    return (
      `<div class="mvp-thread-completion mvp-thread-completion--empty" data-thread-completion-card="empty">` +
      `<p class="mvp-thread-completion__status mvp-thread-completion__status--empty">${esc(message)}</p>` +
      `</div>`
    );
  }

  function renderMvpThreadCompletionModalSubmitHtml() {
    return (
      `<form data-builder-mvp-thread-complete-form>` +
      `<label class="builder-field builder-field--full">` +
      `<span class="builder-field__label">完了写真（任意）</span>` +
      `<label class="builder-btn builder-btn--ghost mvp-thread-compose__fileBtn">` +
      `写真を追加` +
      `<input type="file" accept="image/*" multiple data-builder-mvp-thread-complete-photos hidden />` +
      `</label>` +
      `<div class="mvp-thread-compose__pending" data-builder-mvp-thread-complete-pending hidden></div>` +
      `</label>` +
      `<label class="mvp-slack-modal__consent">` +
      `<input type="checkbox" data-builder-mvp-thread-complete-consent />` +
      `作業完了に同意します` +
      `</label>` +
      `<div class="mvp-slack-modal__actions">` +
      `<button type="submit" class="builder-btn builder-btn--primary">完了を確定</button>` +
      `</div>` +
      `</form>`
    );
  }

  const MVP_THREAD_AUX_HASH_BLOCKLIST = new Set(["completion", "photos", "photo", "report", "files"]);

  function closeMvpThreadCompletionModal() {
    const completeModal = document.querySelector("[data-builder-mvp-thread-complete-modal]");
    if (!completeModal) return;
    completeModal.hidden = true;
    completeModal.setAttribute("hidden", "");
    if (mvpThreadUserAuxModal === "completion") mvpThreadUserAuxModal = "";
  }

  function closeMvpThreadSitePhotoModal() {
    const sitePhotoModal = document.querySelector("[data-builder-mvp-site-photo-modal]");
    if (!sitePhotoModal) return;
    sitePhotoModal.hidden = true;
    sitePhotoModal.setAttribute("hidden", "");
    delete sitePhotoModal.dataset.threadId;
    if (mvpThreadUserAuxModal === "photo") mvpThreadUserAuxModal = "";
  }

  let mvpThreadReviewModalWired = false;
  let mvpThreadReviewAutoOpened = false;
  let mvpThreadSelectedReviewRating = 5;

  function resetMvpThreadReviewForm() {
    mvpThreadSelectedReviewRating = 5;
    document.querySelectorAll("[data-builder-mvp-thread-review-star]").forEach((el) => {
      const star = Number(el.getAttribute("data-star"));
      const on = star <= mvpThreadSelectedReviewRating;
      el.classList.toggle("chat-review-star--on", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const commentEl = document.querySelector("[data-builder-mvp-thread-review-comment]");
    if (commentEl) commentEl.value = "";
  }

  function closeMvpThreadReviewModal() {
    const modal = document.querySelector("[data-builder-mvp-thread-review-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("hidden", "");
    if (mvpThreadUserAuxModal === "review") mvpThreadUserAuxModal = "";
    resetMvpThreadReviewForm();
  }

  function resolveMvpThreadReviewTargetLabel(thread, project, state) {
    const me = getActor(state);
    const flowCtx = resolveGeneralFlowBenchContext(project);
    if (flowCtx) {
      const target =
        String(me.id) === String(flowCtx.spec.poster?.id || "")
          ? flowCtx.spec.applicant
          : flowCtx.spec.poster;
      return target?.name ? `評価対象：${target.name}` : "評価対象：相手";
    }
    if (getRole() === "owner") {
      const pid = resolveOpsThreadNotifyPartnerId(project, thread, state);
      return `評価対象：${partnerLabel(state, pid)}`;
    }
    return "評価対象：TASFUL運営";
  }

  function openMvpThreadReviewPanel() {
    const modal = document.querySelector("[data-builder-mvp-thread-review-modal]");
    if (!modal) return false;
    const tid = getMvpThreadIdParam();
    const state = mvp().reload();
    const thread = state.threads?.[tid];
    const project = (state.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project || !isMvpThreadChatLocked(thread, project, state)) return false;
    if (thread?.review_submission?.status === "submitted") {
      alert("レビュー済みです。");
      return false;
    }
    resetMvpThreadReviewForm();
    const targetEl = document.querySelector("[data-builder-mvp-thread-review-target]");
    if (targetEl) targetEl.textContent = resolveMvpThreadReviewTargetLabel(thread, project, state);
    modal.hidden = false;
    modal.removeAttribute("hidden");
    mvpThreadUserAuxModal = "review";
    const firstStar = modal.querySelector("[data-builder-mvp-thread-review-star]");
    if (firstStar) firstStar.focus();
    return true;
  }

  function submitMvpThreadReviewFromModal(isSkipped) {
    const tid = getMvpThreadIdParam();
    const commentEl = document.querySelector("[data-builder-mvp-thread-review-comment]");
    const payload = {
      rating: isSkipped ? 5 : mvpThreadSelectedReviewRating,
      comment: isSkipped ? "" : commentEl?.value || "",
    };
    const bridge = window.TasuBuilderBenchBridge;
    const result = bridge?.submitGeneralFlowReview
      ? bridge.submitGeneralFlowReview(tid, payload)
      : submitGeneralFlowReview(tid, payload);
    if (!result?.ok) {
      alert("レビューの送信に失敗しました。");
      return result;
    }
    closeMvpThreadReviewModal();
    alert("評価を送信しました。");
    renderSlackStyleMvpThreadPage();
    return result;
  }

  function renderMvpThreadReviewChatCard(threadId, thread, project, state) {
    return "";
  }

  function stripMvpThreadOpenReviewParam() {
    try {
      const sp = new URLSearchParams(global.location.search);
      if (!sp.has("openReview") && !sp.has("reviewOpen")) return;
      sp.delete("openReview");
      sp.delete("reviewOpen");
      const nextUrl =
        global.location.pathname + (sp.toString() ? `?${sp.toString()}` : "") + (global.location.hash || "");
      if (global.history?.replaceState) global.history.replaceState(null, "", nextUrl);
    } catch {
      /* ignore */
    }
  }

  function shouldAutoOpenMvpThreadReview() {
    const v = getParam("openReview") || getParam("reviewOpen");
    return v === "1" || String(v).toLowerCase() === "true";
  }

  function bootMvpThreadReviewFromUrl(threadId, state) {
    if (mvpThreadReviewAutoOpened || !shouldAutoOpenMvpThreadReview()) return;
    const thread = state?.threads?.[threadId];
    const project = (state?.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project || !isMvpThreadChatLocked(thread, project, state)) return;
    mvpThreadReviewAutoOpened = true;
    stripMvpThreadOpenReviewParam();
    global.requestAnimationFrame(() => openMvpThreadReviewPanel());
  }

  function wireMvpThreadReviewModal() {
    if (mvpThreadReviewModalWired) return;
    mvpThreadReviewModalWired = true;
    const modal = document.querySelector("[data-builder-mvp-thread-review-modal]");
    if (!modal) return;
    modal.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("[data-builder-mvp-thread-review-close]") || ev.target === modal) {
        closeMvpThreadReviewModal();
      }
    });
    modal.querySelectorAll("[data-builder-mvp-thread-review-star]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mvpThreadSelectedReviewRating = Math.max(1, Math.min(5, Number(btn.getAttribute("data-star") || 5)));
        resetMvpThreadReviewForm();
      });
    });
    modal.querySelector("[data-builder-mvp-thread-review-submit]")?.addEventListener("click", () => {
      submitMvpThreadReviewFromModal(false);
    });
    modal.querySelector("[data-builder-mvp-thread-review-skip]")?.addEventListener("click", () => {
      submitMvpThreadReviewFromModal(true);
    });
    document.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-builder-mvp-thread-review-open]");
      if (!btn || document.body?.dataset?.page !== "builder-mvp-thread") return;
      ev.preventDefault();
      openMvpThreadReviewPanel();
    });
  }

  function isBuilderMvpThreadPage() {
    return getPage() === "builder-mvp-thread";
  }

  function isOpsPartnerMvpThreadContext() {
    if (!isBuilderMvpThreadPage()) return false;
    const tt = normalizeBuilderThreadType(getBuilderThreadTypeParam() || document.body?.dataset?.builderThreadType || "");
    return tt === "ops_partner";
  }

  function shouldSuppressMvpThreadAuxPanelAutoOpen() {
    if (!isBuilderMvpThreadPage()) return false;
    if (isOpsPartnerMvpThreadContext()) return true;
    try {
      const sp = new URLSearchParams(global.location.search);
      return sp.get("benchEmbed") === "1" && sp.get("builderFlow") === "ops_partner";
    } catch {
      return false;
    }
  }

  function clearMvpThreadAuxNavState() {
    if (!shouldSuppressMvpThreadAuxPanelAutoOpen()) return;
    try {
      const sp = new URLSearchParams(global.location.search);
      const blockedQuery = ["openPhoto", "openCompletion", "completion", "photo", "activePanel"];
      let queryChanged = false;
      blockedQuery.forEach((key) => {
        if (!sp.has(key)) return;
        sp.delete(key);
        queryChanged = true;
      });
      const hash = String(global.location.hash || "").replace(/^#/, "").trim().toLowerCase();
      const hashBlocked = hash && MVP_THREAD_AUX_HASH_BLOCKLIST.has(hash);
      if (!queryChanged && !hashBlocked) return;
      const nextUrl =
        global.location.pathname +
        (sp.toString() ? `?${sp.toString()}` : "") +
        (hashBlocked ? "" : global.location.hash || "");
      if (global.history?.replaceState) {
        global.history.replaceState(null, "", nextUrl);
      }
    } catch {
      /* ignore */
    }
  }

  let mvpThreadAuxUiBootThreadId = null;
  let mvpThreadUserAuxModal = "";

  function resetMvpThreadAuxUiOnLoad(force = false) {
    if (!shouldSuppressMvpThreadAuxPanelAutoOpen()) return;
    const tid = getMvpThreadIdParam();
    if (!force && tid && tid === mvpThreadAuxUiBootThreadId) return;
    mvpThreadAuxUiBootThreadId = tid || null;
    mvpThreadUserAuxModal = "";
    closeMvpThreadCompletionModal();
    closeMvpThreadSitePhotoModal();
    closeMvpThreadReviewModal();
    mvpThreadReviewAutoOpened = false;
    clearMvpThreadAuxNavState();
  }

  function stripMvpThreadNotifyOpenParam() {
    try {
      const sp = new URLSearchParams(global.location.search);
      if (!sp.has("notifyOpen")) return;
      sp.delete("notifyOpen");
      const nextUrl = global.location.pathname + (sp.toString() ? `?${sp.toString()}` : "") + (global.location.hash || "");
      if (global.history?.replaceState) global.history.replaceState(null, "", nextUrl);
    } catch {
      /* ignore */
    }
  }

  function ensureMvpThreadAuxUiBoot(threadId) {
    const tid = String(threadId || getMvpThreadIdParam() || "").trim();
    if (!shouldSuppressMvpThreadAuxPanelAutoOpen()) return;
    const notifyOpen = getParam("notifyOpen") === "1";
    if (notifyOpen) {
      mvpThreadUserAuxModal = "";
      mvpThreadAuxUiBootThreadId = null;
      resetMvpThreadAuxUiOnLoad(true);
      stripMvpThreadNotifyOpenParam();
      return;
    }
    if (tid === mvpThreadAuxUiBootThreadId) return;
    resetMvpThreadAuxUiOnLoad(true);
  }

  function syncMvpThreadAuxModalsClosedUnlessUserOpen() {
    if (!shouldSuppressMvpThreadAuxPanelAutoOpen() || mvpThreadUserAuxModal) return;
    closeMvpThreadCompletionModal();
    closeMvpThreadSitePhotoModal();
    closeMvpThreadReviewModal();
  }

  function openMvpThreadSitePhotoPanel(threadId) {
    const tid = String(threadId || getMvpThreadIdParam() || "").trim();
    const sitePhotoModal = document.querySelector("[data-builder-mvp-site-photo-modal]");
    const sitePhotoForm = document.querySelector("[data-builder-mvp-site-photo-form]");
    if (!tid || !sitePhotoModal) return false;
    const state = mvp().reload();
    const thread = state.threads?.[tid];
    const project = (state.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project || !threadCanAddSitePhoto(thread, project, state)) return false;
    sitePhotoModal.dataset.threadId = tid;
    sitePhotoForm?.reset();
    sitePhotoModal.hidden = false;
    sitePhotoModal.removeAttribute("hidden");
    mvpThreadUserAuxModal = "photo";
    return true;
  }

  function shouldRenderInlineThreadCompletionSubmit(thread, project, state) {
    if (isBuilderMvpThreadPage()) return false;
    return threadCanSubmitCompletion(thread, project, state) && threadCompletionIsSubmitter(state, project);
  }

  function renderMvpThreadCompletionModalBody(threadId, state) {
    const thread = state?.threads?.[threadId];
    const project = (state?.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project) return { title: "作業完了", html: "" };

    const sub = normalizeThreadCompletionSubmission(thread);
    const canSubmit = threadCanSubmitCompletion(thread, project, state);
    const canReview = threadCanReviewCompletion(thread, project, state);
    const isReviewer = threadCompletionIsReviewer(state, project);
    const isSubmitter = threadCompletionIsSubmitter(state, project);

    if (canSubmit && isSubmitter) {
      return { title: "完了報告", html: renderMvpThreadCompletionModalSubmitHtml() };
    }
    if (isReviewer && canReview) {
      return {
        title: "完了報告を確認",
        html: renderThreadCompletionSummary(sub) + renderThreadCompletionReviewCard(threadId),
      };
    }
    if (isReviewer) {
      return { title: "完了報告", html: "" };
    }
    if (sub?.status === "submitted" && isSubmitter) {
      return {
        title: "完了報告",
        html:
          renderThreadCompletionSummary(sub) +
          `<p class="mvp-thread-completion__status mvp-thread-completion__status--pending">提出済み — 確認待ちです。</p>`,
      };
    }
    if (sub?.status === "approved") {
      return {
        title: "完了報告",
        html:
          renderThreadCompletionSummary(sub, { approved: true }) +
          `<p class="mvp-thread-completion__status mvp-thread-completion__status--approved">完了報告が承認され、取引が完了しました。</p>`,
      };
    }
    return { title: "完了報告", html: "" };
  }

  function syncMvpThreadCompletionModal(threadId, state) {
    const bodyHost = document.querySelector("[data-builder-mvp-thread-complete-modal-body]");
    const titleEl = document.querySelector("[data-builder-mvp-thread-complete-modal-title]");
    if (!bodyHost) return;

    const st = state || mvp().reload();
    const { title, html } = renderMvpThreadCompletionModalBody(threadId, st);
    if (titleEl) titleEl.textContent = title;
    bodyHost.innerHTML = html;
  }

  function threadCanAddSitePhoto(thread, project, state) {
    if (!thread || !project) return false;
    const siteData = normalizeMvpThreadSiteData(thread.siteData, {
      threadId: thread.thread_id,
      projectId: thread.project_id,
      state,
    });
    if (siteData.completed || thread.status === "completed") return false;
    const threadType = getBuilderThreadTypeParam() || getThreadRowType(thread);
    if (threadType === "ops_partner" || usesMvpPartnerThread(project)) {
      return threadCompletionIsSubmitter(state, project);
    }
    return true;
  }

  function renderThreadCompletionHost(threadId, state) {
    const thread = state?.threads?.[threadId];
    const project = (state?.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project) return "";

    if (isBuilderMvpThreadPage()) return "";

    const sub = normalizeThreadCompletionSubmission(thread);
    const canSubmit = threadCanSubmitCompletion(thread, project, state);
    const canReview = threadCanReviewCompletion(thread, project, state);
    const parts = [];

    if (sub?.status === "rejected" && sub.rejected_reason) {
      parts.push(
        `<p class="mvp-thread-completion__status mvp-thread-completion__status--rejected">差し戻されました。内容を修正して再提出してください。</p>` +
          `<p class="mvp-thread-completion__rejectReason"><strong>差し戻し理由:</strong> ${esc(sub.rejected_reason)}</p>`
      );
    }

    if (shouldRenderInlineThreadCompletionSubmit(thread, project, state)) {
      parts.push(renderThreadCompletionSubmitCard(threadId));
    } else if (sub) {
      parts.push(renderThreadCompletionSummary(sub, { approved: sub.status === "approved" }));
      if (canReview) {
        parts.push(renderThreadCompletionReviewCard(threadId));
      } else if (sub.status === "submitted" && threadCompletionIsSubmitter(state, project)) {
        parts.push(
          `<p class="mvp-thread-completion__status mvp-thread-completion__status--pending">提出済み — 確認待ちです。</p>`
        );
      } else if (sub.status === "approved") {
        parts.push(
          `<p class="mvp-thread-completion__status mvp-thread-completion__status--approved">完了報告が承認され、取引が完了しました。</p>`
        );
      }
    } else if (threadCompletionIsReviewer(state, project)) {
      parts.push(renderThreadCompletionEmptyState());
    }

    return parts.join("");
  }

  function resolveThreadReviewRecipientParties(project, state) {
    const flowCtx = resolveGeneralFlowBenchContext(project);
    if (flowCtx) {
      return [flowCtx.spec.poster, flowCtx.spec.applicant];
    }
    if (usesMvpPartnerThread(project)) {
      return [{ role: "owner" }, { role: "partner" }];
    }
    return [
      { id: project?.owner_id, role: resolveGeneralBoardPosterRole(project, state) },
      {
        id: threadCompletionSelectedApplicantId(project, state),
        role: resolveGeneralBoardApplicantRole(project, state),
      },
    ].filter((p) => String(p.id || "").trim());
  }

  function pushThreadReviewRequestNotifications({ threadId, project, state }) {
    const st = state || mvp().reload();
    const thread = st.threads?.[threadId];
    if (!thread || !project) return;
    const flowCtx = resolveGeneralFlowBenchContext(project);
    const threadType = flowCtx
      ? resolveGeneralFlowThreadType(project, thread)
      : usesMvpPartnerThread(project)
        ? "ops_partner"
        : "";
    const title = "取引が完了しました";
    const reviewBody = `${project.title || project.project_id} — 相手の評価をお願いします。`;
    resolveThreadReviewRecipientParties(project, st).forEach((party) => {
      const role = gfPartyUrlRole(party);
      const flowCtx = resolveGeneralFlowBenchContext(project);
      const recipientSlot =
        flowCtx && party.id === flowCtx.spec.poster.id
          ? "poster"
          : flowCtx && party.id === flowCtx.spec.applicant.id
            ? "applicant"
            : "";
      notifyThreadCompletionEvent({
        title,
        body: reviewBody,
        threadId,
        project,
        recipientRole: role,
        recipientUserId: party.id,
        recipientSlot,
        notifyType: "review_request",
        actionLabel: "レビューする",
        href: resolveThreadReviewNotifyHref(threadId, role, threadType, project),
      });
    });
  }

  function pushThreadReviewSubmittedNotifications({ threadId, project, state }) {
    const st = state || mvp().reload();
    const thread = st.threads?.[threadId];
    if (!thread || !project) return;
    const api = mvp();
    const flowCtx = resolveGeneralFlowBenchContext(project);
    const threadType = flowCtx
      ? resolveGeneralFlowThreadType(project, thread)
      : usesMvpPartnerThread(project)
        ? "ops_partner"
        : "";
    const title = "レビューが投稿されました";
    const body = "相手からの評価が更新されました。";
    resolveThreadReviewRecipientParties(project, st).forEach((party) => {
      const role = gfPartyUrlRole(party);
      api.pushNotification({
        type: "review_received",
        title,
        body,
        project_id: project.project_id,
        projectId: project.project_id,
        projectTitle: project.title || "",
        thread_id: threadId,
        threadId,
        recipientRole: role,
        recipientUserId: party.id,
        href: mvpThreadReviewConfirmNotifyHref(threadId, role, threadType),
        actionLabel: "レビューを確認する",
        threadType,
        bench_thread_type: threadType,
      });
    });
  }

  function notifyThreadCompletionEvent({
    title,
    body,
    threadId,
    project,
    recipientRole,
    recipientUserId: recipientUserIdIn,
    recipientSlot,
    notifyType,
    actionLabel,
    href,
  }) {
    const api = mvp();
    const state = api.reload();
    const thread = state.threads?.[threadId];
    const flowCtx = resolveGeneralFlowBenchContext(project);
    const opsPartnerId = resolveOpsThreadNotifyPartnerId(project, thread, state);
    const flowParty = flowCtx
      ? gfPartyForRecipient(flowCtx.spec, {
          recipientUserId: recipientUserIdIn,
          recipientSlot,
          recipientRole,
        })
      : null;
    const recipientUserId =
      String(recipientUserIdIn || "").trim() ||
      (flowCtx ? gfRecipientUserId(flowCtx.spec, { recipientUserId: recipientUserIdIn, recipientSlot, recipientRole }) : "") ||
      resolveBuilderOpsNotifyRecipientUserId(
        recipientRole,
        recipientRole === "partner" ? opsPartnerId : OWNER_ID
      );
    const projectKind = usesMvpPartnerThread(project) ? resolveBoardItemType(project) || "admin_ops" : resolveBoardItemType(project);
    const threadType = flowCtx
      ? resolveGeneralFlowThreadType(project, thread)
      : projectKind === "calendar" || projectKind === "admin_ops"
        ? "ops_partner"
        : "";
    const hrefRole = flowParty
      ? gfPartyUrlRole(flowParty)
      : recipientRole === "owner"
        ? "owner"
        : "partner";
    const isGeneralPosterRecipient = flowCtx && flowParty && flowParty.id === flowCtx.spec.poster.id;
    const completionNotifyPayload = {
      type: notifyType,
      title,
      body,
      project_id: project.project_id,
      projectId: project.project_id,
      projectTitle: project.title,
      thread_id: threadId,
      threadId,
      recipientRole: flowParty ? gfPartyUrlRole(flowParty) : recipientRole,
      recipientUserId,
      recipientSlot,
      recipientPartnerId: recipientRole === "partner" ? opsPartnerId : null,
      projectKind,
      board_type: projectKind,
      actionLabel:
        actionLabel ||
        (flowCtx
          ? isGeneralPosterRecipient
            ? "完了報告を確認"
            : "チャットへ進む"
          : recipientRole === "owner"
            ? "完了報告を確認"
            : "現場連絡を開く"),
      href:
        href ||
        resolveBoardOrMvpThreadNotifyHref(threadId, hrefRole, project, threadType, {
          completionAnchor:
            notifyType === "completion_submitted" ||
            notifyType === "completion_report" ||
            notifyType === "completion_rejected",
        }),
      threadType,
      bench_thread_type: threadType,
    };
    api.pushNotification(completionNotifyPayload);
    emitBuilderOpsBenchEvent("builder:ops:completion-submitted", {
      threadId,
      projectId: project?.project_id || null,
      recipientRole,
      recipientUserId,
      notifyType,
    });
  }

  function submitThreadCompletionReport(threadId, payload = {}) {
    const tid = String(threadId || getMvpThreadIdParam() || "").trim();
    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const project = (next.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project) return { ok: false, error: "thread_not_found" };
    const page = getPage();
    const onMvpThreadPage = page === "builder-mvp-thread";
    const onBoardThreadPage = page === "builder-board-thread";
    const isGeneralBoard = isGeneralBoardMvpProject(project);
    if (!usesMvpPartnerThread(project) && !onBoardThreadPage) {
      if (!(isGeneralBoard && onMvpThreadPage)) {
        return { ok: false, error: "wrong_surface" };
      }
    }
    if (usesMvpPartnerThread(project) && !onMvpThreadPage) {
      return { ok: false, error: "wrong_surface" };
    }
    if (!threadCanSubmitCompletion(thread, project, next)) return { ok: false, error: "not_allowed" };

    const actor = getActor(next);
    const ts = nowIso();
    const comment = String(payload.comment || "").trim() || "作業が完了しました。";
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    const photos = Array.isArray(payload.photos) ? payload.photos : [];
    const invoice = payload.invoice && typeof payload.invoice === "object" ? payload.invoice : null;

    thread.completion_submission = {
      status: "submitted",
      comment,
      attachments,
      photos,
      invoice,
      submitted_at: ts,
      submitted_by: actor,
      rejected_reason: "",
      rejected_at: "",
      approved_at: "",
    };
    thread.status = "completion_pending";
    thread.events = [
      ...(thread.events || []),
      { type: "completion_requested", actor, ts, text: "完了報告を提出しました。" },
    ];

    global.TasuBuilderBoardAdapter?.recordBoardEvent?.(next, "completion_requested", {
      thread_id: tid,
      project_id: project.project_id,
      status: "submitted",
    });

    global.TasuBuilderStorageAdapter?.registerCompletionPhotos?.(photos, {
      project_id: project.project_id,
      thread_id: tid,
      partner_id: String(actor?.id || "").trim(),
    });

    api.commit(next);

    const body = `${project.title || project.project_id} — 完了報告をご確認ください。`;
    const flowCtx = resolveGeneralFlowBenchContext(project);
    const reviewerRole = usesMvpPartnerThread(project)
      ? "owner"
      : flowCtx
        ? gfPartyUrlRole(flowCtx.spec.poster)
        : isGeneralBoardMvpProject(project)
          ? resolveGeneralBoardPosterRole(project, next)
          : resolveBoardItemType(project) === "worker"
            ? "partner"
            : "owner";
    notifyThreadCompletionEvent({
      title: usesMvpPartnerThread(project) ? "完了報告が提出されました" : "完了報告が届きました",
      body,
      threadId: tid,
      project,
      recipientRole: reviewerRole,
      recipientUserId: flowCtx?.spec?.poster?.id,
      recipientSlot: flowCtx ? "poster" : "",
      notifyType: "completion_submitted",
    });

    return { ok: true };
  }

  function approveThreadCompletionReport(threadId) {
    const tid = String(threadId || getMvpThreadIdParam() || "").trim();
    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const project = (next.projects || []).find((p) => p.project_id === thread?.project_id);
    const sub = normalizeThreadCompletionSubmission(thread);
    if (!thread || !project || !sub || sub.status !== "submitted") {
      return { ok: false, error: "not_reviewable" };
    }
    if (!threadCanReviewCompletion(thread, project, next)) return { ok: false, error: "not_allowed" };

    const actor = getActor(next);
    const ts = nowIso();
    thread.completion_submission = {
      ...sub,
      status: "approved",
      approved_at: ts,
    };
    thread.status = "completed";
    if (project) project.status = "completed";
    const siteData = normalizeMvpThreadSiteData(thread.siteData, {
      threadId: tid,
      projectId: thread.project_id,
      state: next,
    });
    thread.siteData = {
      ...siteData,
      completed: true,
      completedAt: ts,
      completionConsent: true,
    };
    thread.completion_report = {
      actor: sub.submitted_by || actor,
      ts,
      updated_at: ts,
      work_content: sub.comment,
      note: "",
      extra_charge: false,
      extra_charge_note: "",
    };
    appendMvpThreadSystemMessage(next, thread, {
      actor,
      text: "完了報告が承認されました",
      eventType: "completion_approved",
    });
    appendMvpThreadSystemMessage(next, thread, {
      actor,
      text: "この案件は完了しました",
      eventType: "completed",
    });
    api.commit(next);

    const body = `${project.title || project.project_id} — 完了報告が承認されました。`;
    const flowCtx = resolveGeneralFlowBenchContext(project);
    const submitterRole = usesMvpPartnerThread(project)
      ? "partner"
      : flowCtx
        ? gfPartyUrlRole(flowCtx.spec.applicant)
        : isGeneralBoardMvpProject(project)
          ? resolveGeneralBoardApplicantRole(project, next)
          : resolveBoardItemType(project) === "worker"
            ? "owner"
            : "partner";
    notifyThreadCompletionEvent({
      title: usesMvpPartnerThread(project) ? "完了報告が承認されました" : "完了報告が承認されました",
      body,
      threadId: tid,
      project,
      recipientRole: submitterRole,
      recipientUserId: flowCtx?.spec?.applicant?.id,
      recipientSlot: flowCtx ? "applicant" : "",
      notifyType: "completion_approved",
    });

    pushThreadReviewRequestNotifications({ threadId: tid, project, state: next });

    return { ok: true };
  }

  function rejectThreadCompletionReport(threadId, reason) {
    const tid = String(threadId || getMvpThreadIdParam() || "").trim();
    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const project = (next.projects || []).find((p) => p.project_id === thread?.project_id);
    const sub = normalizeThreadCompletionSubmission(thread);
    if (!thread || !project || !sub || sub.status !== "submitted") {
      return { ok: false, error: "not_reviewable" };
    }
    if (!threadCanReviewCompletion(thread, project, next)) return { ok: false, error: "not_allowed" };

    const actor = getActor(next);
    const ts = nowIso();
    const rejectReason = String(reason || "").trim() || "内容をご確認ください。";
    thread.completion_submission = {
      ...sub,
      status: "rejected",
      rejected_reason: rejectReason,
      rejected_at: ts,
    };
    if (thread.status === "completion_pending") thread.status = "in_progress";
    appendMvpThreadSystemMessage(next, thread, {
      actor,
      text: "完了報告が差し戻されました",
      eventType: "completion_rejected",
    });
    api.commit(next);

    const body = `${project.title || project.project_id} — ${rejectReason}`;
    const submitterRole = isGeneralBoardMvpProject(project)
      ? resolveGeneralBoardApplicantRole(project, next)
      : resolveBoardItemType(project) === "worker"
        ? "owner"
        : "partner";
    notifyThreadCompletionEvent({
      title: "完了報告が差し戻されました",
      body,
      threadId: tid,
      project,
      recipientRole: submitterRole,
      notifyType: "completion_rejected",
    });

    return { ok: true };
  }

  let threadCompletionWired = false;

  function renderThreadCompletionPending(host, files, removeAttr) {
    if (!host) return;
    if (!files.length) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML = files
      .map(
        (f, i) =>
          `<span class="mvp-thread-compose__pendingItem">${esc(f.name)} <button type="button" data-${removeAttr}="${i}" aria-label="削除">×</button></span>`
      )
      .join("");
  }

  function wireThreadCompletionFlow() {
    if (threadCompletionWired) return;
    threadCompletionWired = true;

    document.body.addEventListener("change", (ev) => {
      const attachInput = ev.target?.closest?.("[data-thread-completion-attach]");
      if (attachInput?.files?.length) {
        Array.from(attachInput.files).forEach((f) => {
          threadCompletionDraft.attachments.push({
            name: f.name || "file",
            type: f.type?.includes("pdf") ? "pdf" : "file",
            ts: nowIso(),
          });
        });
        const host = attachInput.closest("form")?.querySelector("[data-thread-completion-attach-pending]");
        renderThreadCompletionPending(host, threadCompletionDraft.attachments, "thread-completion-attach-rm");
        attachInput.value = "";
        return;
      }
      const photoInput = ev.target?.closest?.("[data-thread-completion-photo]");
      if (photoInput?.files?.length) {
        Array.from(photoInput.files).forEach((f) => {
          threadCompletionDraft.photos.push({
            name: f.name || "photo.jpg",
            type: "image",
            ts: nowIso(),
          });
        });
        const host = photoInput.closest("form")?.querySelector("[data-thread-completion-photo-pending]");
        renderThreadCompletionPending(host, threadCompletionDraft.photos, "thread-completion-photo-rm");
        photoInput.value = "";
        return;
      }
      const invoiceInput = ev.target?.closest?.("[data-thread-completion-invoice]");
      if (invoiceInput?.files?.[0]) {
        const f = invoiceInput.files[0];
        threadCompletionDraft.invoice = {
          name: f.name || "invoice.pdf",
          type: "pdf",
          ts: nowIso(),
        };
        const host = invoiceInput.closest("form")?.querySelector("[data-thread-completion-invoice-pending]");
        renderThreadCompletionPending(host, threadCompletionDraft.invoice ? [threadCompletionDraft.invoice] : [], "thread-completion-invoice-rm");
        invoiceInput.value = "";
      }
    });

    document.body.addEventListener("click", (ev) => {
      const attachRm = ev.target?.closest?.("[data-thread-completion-attach-rm]");
      if (attachRm) {
        const idx = Number(attachRm.getAttribute("data-thread-completion-attach-rm"));
        if (Number.isFinite(idx)) threadCompletionDraft.attachments.splice(idx, 1);
        const host = attachRm.closest("[data-thread-completion-attach-pending]");
        renderThreadCompletionPending(host, threadCompletionDraft.attachments, "thread-completion-attach-rm");
        return;
      }
      const photoRm = ev.target?.closest?.("[data-thread-completion-photo-rm]");
      if (photoRm) {
        const idx = Number(photoRm.getAttribute("data-thread-completion-photo-rm"));
        if (Number.isFinite(idx)) threadCompletionDraft.photos.splice(idx, 1);
        const host = photoRm.closest("[data-thread-completion-photo-pending]");
        renderThreadCompletionPending(host, threadCompletionDraft.photos, "thread-completion-photo-rm");
        return;
      }
      const invoiceRm = ev.target?.closest?.("[data-thread-completion-invoice-rm]");
      if (invoiceRm) {
        threadCompletionDraft.invoice = null;
        const host = invoiceRm.closest("[data-thread-completion-invoice-pending]");
        renderThreadCompletionPending(host, [], "thread-completion-invoice-rm");
        return;
      }

      const rejectOpen = ev.target?.closest?.("[data-thread-completion-reject-open]");
      if (rejectOpen) {
        const card = rejectOpen.closest("[data-thread-completion-card='review']");
        const form = card?.querySelector("[data-thread-completion-reject-form]");
        if (form) form.hidden = false;
        return;
      }

      const approveBtn = ev.target?.closest?.("[data-thread-completion-approve]");
      if (approveBtn) {
        const tid = approveBtn.getAttribute("data-thread-completion-approve");
        const result = approveThreadCompletionReport(tid);
        if (!result.ok) {
          alert("承認に失敗しました。");
          return;
        }
        resetThreadCompletionDraft();
        const completeModal = document.querySelector("[data-builder-mvp-thread-complete-modal]");
        if (completeModal) completeModal.hidden = true;
        if (getPage() === "builder-board-thread") renderBoardThreadPage();
        else renderSlackStyleMvpThreadPage();
        return;
      }

      const rejectBtn = ev.target?.closest?.("[data-thread-completion-reject-confirm]");
      if (rejectBtn) {
        const tid = rejectBtn.getAttribute("data-thread-completion-reject-confirm");
        const reason = rejectBtn
          .closest("[data-thread-completion-card='review']")
          ?.querySelector("[data-thread-completion-reject-reason]")?.value;
        const result = rejectThreadCompletionReport(tid, reason);
        if (!result.ok) {
          alert("差し戻しに失敗しました。");
          return;
        }
        resetThreadCompletionDraft();
        const completeModal = document.querySelector("[data-builder-mvp-thread-complete-modal]");
        if (completeModal) completeModal.hidden = true;
        if (getPage() === "builder-board-thread") renderBoardThreadPage();
        else renderSlackStyleMvpThreadPage();
      }
    });

    document.body.addEventListener("submit", (ev) => {
      const form = ev.target?.closest?.("[data-thread-completion-form]");
      if (!form) return;
      ev.preventDefault();
      const tid = form.getAttribute("data-thread-completion-form");
      const comment = form.querySelector("[data-thread-completion-comment]")?.value;
      const result = submitThreadCompletionReport(tid, {
        comment,
        attachments: threadCompletionDraft.attachments.slice(),
        photos: threadCompletionDraft.photos.slice(),
        invoice: threadCompletionDraft.invoice,
      });
      if (!result.ok) {
        alert("完了報告の提出に失敗しました。");
        return;
      }
      resetThreadCompletionDraft();
      if (getPage() === "builder-board-thread") renderBoardThreadPage();
      else renderSlackStyleMvpThreadPage();
    });
  }

  function notifyBoardApplicationDecision(api, { project, partnerId, selected, threadId }) {
    const state = api.reload();
    const pname = partnerLabel(state, partnerId);
    const ptitle = project.title || project.project_id;
    const typeCfg = { ...getBoardTypeConfig(project), projectId: project.project_id };
    const projectKind = resolveBoardItemType(project);

    if (selected && threadId) {
      const applicantBody = `${ptitle} — ${typeCfg.hireBodyApplicant}`;
      const posterBody = `${typeCfg.hireBodyPoster}`;

      api.pushNotification({
        type: "selected",
        title: typeCfg.hireNotifyApplicant,
        body: applicantBody,
        project_id: project.project_id,
        projectTitle: ptitle,
        thread_id: threadId,
        partnerId,
        recipientRole: "partner",
        projectKind,
        board_type: projectKind,
      });
      api.pushNotification({
        type: "hire_confirmed",
        title: typeCfg.hireNotifyPoster,
        body: posterBody,
        project_id: project.project_id,
        projectTitle: ptitle,
        thread_id: threadId,
        recipientRole: "owner",
        projectKind,
        board_type: projectKind,
      });
      pushBoardTalkNotification({
        title: typeCfg.hireNotifyApplicant,
        body: applicantBody,
        threadId,
        typeCfg,
        actionLabel: "チャットを開く",
      });
      pushBoardTalkNotification({
        title: typeCfg.hireNotifyPoster,
        body: posterBody,
        threadId,
        typeCfg,
        actionLabel: "チャットを開く",
      });
      return;
    }

    const rejectBody = `${ptitle} の選考結果が届きました。`;
    const rejectHref = resolvePublicBoardDetailHref(project);
    api.pushNotification({
      type: "rejected",
      title: typeCfg.rejectNotify,
      body: rejectBody,
      project_id: project.project_id,
      projectTitle: ptitle,
      partnerId,
      recipientRole: "partner",
      thread_id: null,
      href: rejectHref,
      actionLabel: "案件を見る",
    });
    pushBoardTalkNotification({
      title: typeCfg.rejectNotify,
      body: rejectBody,
      threadId: null,
      typeCfg,
      actionLabel: "案件を見る",
      href: rejectHref.replace(/^\.\.\//, ""),
    });
  }

  function mutateBoardApplicationDecision(next, project, partnerId, selected) {
    const pidx = (next.projects || []).findIndex((x) => x.project_id === project.project_id);
    if (pidx < 0) return { ok: false, threadId: null, project: null };
    const pr = next.projects[pidx];
    const req = Number(pr.required_partners || 1);
    const selectedIdsNext = Array.isArray(pr.selected_partner_ids) ? [...pr.selected_partner_ids] : [];
    if (selected && selectedIdsNext.length >= req) return { ok: false, threadId: null, project: null };

    next.applications = (next.applications || []).map((a) => {
      if (a.project_id !== project.project_id || a.partner_id !== partnerId) return a;
      return { ...a, status: selected ? "selected" : "rejected", updated_at: nowIso() };
    });

    let threadId = null;
    if (selected) {
      if (!selectedIdsNext.includes(partnerId)) selectedIdsNext.push(partnerId);
      if (req === 1) {
        next.applications = (next.applications || []).map((a) => {
          if (a.project_id !== project.project_id) return a;
          if (a.partner_id === partnerId) return { ...a, status: "selected", updated_at: nowIso() };
          if ((a.status || "applied") === "applied") return { ...a, status: "rejected", updated_at: nowIso() };
          return a;
        });
      }
      threadId = ensureBoardMatchThread(next, project.project_id, partnerId);
    } else {
      const filtered = selectedIdsNext.filter((x) => x !== partnerId);
      selectedIdsNext.length = 0;
      selectedIdsNext.push(...filtered);
    }

    next.projects[pidx] = {
      ...next.projects[pidx],
      selected_partner_ids: selectedIdsNext,
    };
    return { ok: true, threadId, project: next.projects[pidx] };
  }

  function commitBoardApplicationDecision(api, project, partnerId, selected) {
    const adapter = global.TasuBuilderBoardAdapter;
    if (adapter?.commitBoardMutation) {
      let threadId = null;
      let updatedProject = null;
      const committed = adapter.commitBoardMutation(
        (next) => {
          const result = mutateBoardApplicationDecision(next, project, partnerId, selected);
          threadId = result.threadId;
          updatedProject = result.project;
          return result.ok ? next : null;
        },
        {
          source: "board_application_decision",
          boardEvent: {
            type: "application_status_changed",
            payload: {
              project_id: project.project_id,
              partner_id: partnerId,
              status: selected ? "selected" : "rejected",
            },
          },
        }
      );
      if (!committed || !updatedProject) return false;
      global.TasuBuilderPartnerAdapter?.recordPartnerEvent?.(
        committed,
        selected ? "partner_application_selected" : "partner_application_rejected",
        {
          project_id: project.project_id,
          partner_id: partnerId,
          status: selected ? "selected" : "rejected",
        }
      );
      notifyBoardApplicationDecision(api, {
        project: updatedProject,
        partnerId,
        selected,
        threadId,
      });
      return true;
    }

    const next = api.reload();
    const result = mutateBoardApplicationDecision(next, project, partnerId, selected);
    if (!result.ok) return false;
    api.commit(next);
    notifyBoardApplicationDecision(api, {
      project: result.project,
      partnerId,
      selected,
      threadId: result.threadId,
    });
    return true;
  }

  function boardApplyToProject(api, projectId) {
    const adapter = global.TasuBuilderBoardAdapter;
    if (adapter?.applyToProject) {
      const res = adapter.applyToProject(projectId, getPartnerId(), {
        isBoardFeedItem,
        computeProjectStatus,
        getBoardTypeConfig,
      });
      return res?.ok === true;
    }

    const next = api.reload();
    const myPartnerId = getPartnerId();
    const project = (next.projects || []).find((x) => x.project_id === projectId);
    if (!project || !isBoardFeedItem(project)) return false;
    const typeCfg = getBoardTypeConfig(project);
    const already = (next.applications || []).some(
      (a) => a.project_id === projectId && a.partner_id === myPartnerId
    );
    if (already) return false;
    const status = computeProjectStatus(next, project);
    if (status === "completed" || status === "invoiced") return false;
    const required = Number(project.required_partners || 1);
    const selectedIds = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
    if (selectedIds.length >= required) return false;
    next.applications = [
      ...(next.applications || []),
      { project_id: projectId, partner_id: myPartnerId, status: "applied", ts: nowIso() },
    ];
    api.commit(next);
    api.pushNotification({
      type: "application",
      body:
        typeCfg.type === "worker"
          ? `${project.title || projectId} に依頼がありました。`
          : `案件に応募がありました（${project.title || projectId}）`,
      project_id: projectId,
      thread_id: null,
    });
    return true;
  }

  let boardFeedTypeFilter = "all";

  function renderBoardTypeTabs(host, onChange) {
    if (!host) return;
    const tabs = window.TasuBuilderBoardFeed?.TYPE_TABS || [
      { key: "all", label: "すべて" },
      { key: "project", label: "案件" },
      { key: "worker", label: "ワーカー" },
    ];
    host.innerHTML = tabs
      .map(
        (t) =>
          `<button type="button" class="mvp-board-type-tab${boardFeedTypeFilter === t.key ? " is-active" : ""}" data-board-type-filter="${esc(
            t.key
          )}">${esc(t.label)}</button>`
      )
      .join("");
    if (!host.dataset.bound) {
      host.dataset.bound = "1";
      host.addEventListener("click", (ev) => {
        const btn = ev.target?.closest?.("[data-board-type-filter]");
        if (!btn) return;
        boardFeedTypeFilter = btn.getAttribute("data-board-type-filter") || "all";
        onChange?.();
      });
    }
  }

  function renderBoardProjectsPage() {
    applyBoardPageBackLinks();
    const threadsShortcut = document.querySelector("[data-builder-board-threads-link]");
    if (threadsShortcut) {
      const role = getRole();
      threadsShortcut.setAttribute(
        "href",
        role === "user" ? mvpThreadsHref("", "user") : boardThreadsHref()
      );
    }
    const typeTabsHost = document.querySelector("[data-builder-board-type-tabs]");
    renderBoardTypeTabs(typeTabsHost, () => renderBoardProjectsPage());
    const api = mvp();
    const adapter = global.TasuBuilderBoardAdapter;
    let state;
    let rows;
    if (adapter?.listBoardProjects) {
      const bundle = adapter.listBoardProjects();
      state = bundle.state;
      rows = (bundle.projects || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    } else {
      state = api.reload();
      rows = filterBoardProjects(state.projects || [])
        .slice()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }
    const list = document.querySelector("[data-builder-board-project-list]");
    const kpi = document.querySelector("[data-builder-board-project-count]");
    const topKpi = document.querySelector("[data-builder-board-kpi]");
    if (!list || !kpi || !topKpi) return;
    topKpi.textContent = `role: ${getRole()}`;

    if (boardFeedTypeFilter && boardFeedTypeFilter !== "all") {
      const matchesTab =
        window.TasuBuilderBoardFeed?.matchesBoardTabFilter ||
        ((project, key) => resolveBoardItemType(project) === key);
      rows = rows.filter((p) => matchesTab(p, boardFeedTypeFilter));
    }
    kpi.textContent = `${rows.length} 件`;
    list.innerHTML = rows.length
      ? rows.map((p) => buildBoardProjectCard(p, state.specs?.[p.project_id], state)).join("")
      : `<p class="talk-empty">表示できる投稿はありません。</p>`;

    if (!list.dataset.detailNavBound) {
      list.dataset.detailNavBound = "1";
      list.addEventListener("click", (ev) => {
        if (ev.target?.closest?.("a, button, input, label")) return;
        const card = ev.target?.closest?.("[data-project-id]");
        const projectId = card?.getAttribute("data-project-id");
        const boardType = card?.getAttribute("data-board-type") || "project";
        if (!projectId) return;
        window.location.href = boardDetailHref(projectId, boardType);
      });
    }

    list.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-builder-board-apply]");
      if (!btn) return;
      const projectId = btn.getAttribute("data-project-id");
      if (!projectId || getRole() !== "partner") return;
      if (boardApplyToProject(api, projectId)) renderBoardProjectsPage();
    });
  }

  function buildBoardProjectCard(project, spec, state) {
    const typeCfg = getBoardTypeConfig(project);
    const boardType = resolveBoardItemType(project);
    const status = computeProjectStatus(state, project);
    const statusLabel = toStatusLabel(status);
    const statusMod = status === "open" ? "open" : status === "applied" ? "applied" : status === "selected" ? "selected" : "muted";
    const area = spec?.area?.label || spec?.area || "—";
    const period = formatJapaneseDateRange(spec?.period);
    const deadline = formatDeadline(spec?.period?.end);
    const budgetText = formatBudget(showcaseBudget(spec?.budget, { area, title: project?.title || "" }));
    const urgent = isUrgentProject({ project, spec, state, status });
    const required = Math.max(1, Number(project?.required_partners || 1));
    const selectedCount = Array.isArray(project?.selected_partner_ids) ? project.selected_partner_ids.length : 0;
    const apps = (state.applications || []).filter((a) => a.project_id === project.project_id);
    const appCount = apps.length;
    const pct = Math.max(0, Math.min(100, Math.round((selectedCount / required) * 100)));
    const role = getRole();
    const myPartnerId = getPartnerId();
    const myApp = getApplication(state, project.project_id, myPartnerId);
    const applied = !!myApp;
    const filled = selectedCount >= required;
    const disabled = applied || filled || status === "completed" || status === "invoiced";
    const threadId = resolveBoardMainThreadId(state, project);
    const threadLink = boardThreadHref(threadId);
    const detailHref = boardDetailHref(project.project_id, boardType);

    const partnerActions =
      role === "partner"
        ? `<button type="button" class="mvp-card__btn mvp-card__btn--primary" data-builder-board-apply data-project-id="${esc(
            project.project_id
          )}" ${disabled ? "disabled" : ""}>${
            applied ? typeCfg.appliedCta : filled ? "募集終了" : typeCfg.applyCta
          }</button>` +
          `<a class="mvp-card__btn mvp-card__btn--outline" href="${esc(detailHref)}">詳細を見る</a>`
        : `<a class="mvp-card__btn mvp-card__btn--primary" href="${esc(
            `${detailHref}${detailHref.includes("?") ? "&" : "?"}view=applications`
          )}">${
            typeCfg.type === "worker" ? "依頼者を見る" : "応募者を見る"
          }</a>` +
          `<a class="mvp-card__btn mvp-card__btn--outline" href="${esc(detailHref)}">投稿管理</a>`;

    const barMod = urgent ? "urgent" : status === "applied" ? "applied" : status === "open" ? "open" : "neutral";
    const accentMod = urgent ? "key" : status === "open" ? "msg" : status === "applied" ? "warn" : "neutral";

    return (
      `<article class="mvp-card mvp-card--${esc(accentMod)}" data-project-id="${esc(project.project_id)}" data-board-type="${esc(
        boardType
      )}">` +
      `<div class="mvp-card__statusBar is-${esc(barMod)}" aria-hidden="true"></div>` +
      `<div class="mvp-card__top">` +
      `<div class="mvp-card__badges">` +
      `<span class="mvp-pill mvp-pill--kind">${esc(resolveBoardBadgeLabel(project))}</span>` +
      `<span class="mvp-pill mvp-pill--${esc(statusMod)}">${esc(statusLabel)}</span>` +
      (urgent ? `<span class="mvp-pill mvp-pill--urgent">急募</span>` : "") +
      `</div>` +
      `<div class="mvp-card__triple">` +
      `<div class="mvp-triple mvp-triple--budget"><span class="mvp-triple__label">報酬</span><strong class="mvp-triple__value">${esc(
        budgetText
      )}</strong></div>` +
      `<div class="mvp-triple"><span class="mvp-triple__label">締切</span><strong class="mvp-triple__value">${esc(deadline)}</strong></div>` +
      `</div>` +
      `</div>` +
      `<h3 class="mvp-card__title"><a class="mvp-card__titleLink" href="${esc(detailHref)}">${esc(project.title || "—")}</a></h3>` +
      `<div class="mvp-card__meta">` +
      `<div class="mvp-metaRow"><span>エリア</span><strong>${esc(area)}</strong></div>` +
      `<div class="mvp-metaRow"><span>工期</span><strong>${esc(period)}</strong></div>` +
      `</div>` +
      `<div class="mvp-card__numbers">` +
      `<div class="mvp-number"><span class="mvp-number__icon" aria-hidden="true">👥</span><span class="mvp-number__label">募集</span><strong class="mvp-number__value">${esc(
        String(required)
      )}</strong></div>` +
      `<div class="mvp-number"><span class="mvp-number__icon" aria-hidden="true">✅</span><span class="mvp-number__label">選定</span><strong class="mvp-number__value">${esc(
        String(selectedCount)
      )}</strong></div>` +
      `<div class="mvp-number"><span class="mvp-number__icon" aria-hidden="true">✉️</span><span class="mvp-number__label">応募</span><strong class="mvp-number__value">${esc(
        String(appCount)
      )}</strong></div>` +
      `</div>` +
      `<div class="mvp-progress" aria-label="進捗">` +
      `<div class="mvp-progress__bar"><div class="mvp-progress__fill" style="width:${esc(String(pct))}%"></div></div>` +
      `<div class="mvp-progress__hint">${esc(String(selectedCount))} / ${esc(String(required))}</div>` +
      `</div>` +
      `<div class="mvp-card__actions">${partnerActions}` +
      (threadId
        ? `<a class="mvp-card__btn mvp-card__btn--ghost" href="${esc(threadLink)}"><span class="mvp-btnIcon" aria-hidden="true">💬</span> チャット</a>`
        : "") +
      `</div>` +
      `</article>`
    );
  }

  let boardApplicationsFocusToken = 0;

  function isBoardApplicationsView() {
    return getParam("view") === "applications";
  }

  function isNotifyApplicationsEntry() {
    const from = String(getParam("from") || "").toLowerCase();
    return from === "talk" || from === "notify";
  }

  function boardApplicationsViewTitle() {
    return isNotifyApplicationsEntry() ? "応募者確認" : "応募状況";
  }

  function applyBoardApplicationsViewChrome(project) {
    if (!isBoardApplicationsView()) {
      delete document.body.dataset.boardPdView;
      return;
    }
    document.body.dataset.boardPdView = "applications";
    const title = boardApplicationsViewTitle();
    setText("[data-builder-mvp-pd-title]", title);
    const brandSub = document.querySelector(".builder-brand__sub");
    if (brandSub) brandSub.textContent = title;
    document.title = `${title} | Builder`;
    setText("[data-builder-mvp-pd-sub]", project?.title || "—");
    setText("[data-builder-mvp-pd-apps-title]", title);
    global.TasufulAppMobile?.refreshMobileShellTitle?.();
  }

  function applyMvpApplicationsViewDom(project) {
    const appsSection = document.querySelector("[data-builder-mvp-pd-apps-section]");
    const ctaPanel = document.querySelector(".mvp-pd-cta");
    if (!isBoardApplicationsView()) {
      appsSection?.classList.remove("mvp-pd-appsSection--confirm");
      ctaPanel?.classList.remove("mvp-pd-cta--applications");
      return;
    }
    appsSection?.classList.add("mvp-pd-appsSection--confirm");
    ctaPanel?.classList.add("mvp-pd-cta--applications");
    setText("[data-builder-mvp-pd-apps-title]", boardApplicationsViewTitle());
    setText("[data-builder-mvp-pd-sub]", project?.title || "—");
  }

  function measureBoardApplicationsScrollOffset() {
    const shellHead = document.querySelector("[data-tasu-mobile-shell-head]");
    if (shellHead) return Math.ceil(shellHead.getBoundingClientRect().height) + 10;
    const builderHeader = document.querySelector(".builder-header");
    if (builderHeader) return Math.ceil(builderHeader.getBoundingClientRect().height) + 8;
    return 12;
  }

  function resolveApplicationsSectionEl() {
    const page = getPage();
    if (page === "builder-mvp-project-detail") {
      return document.querySelector("[data-builder-mvp-pd-apps-section]");
    }
    return document.querySelector("[data-builder-board-pd-apps-section]");
  }

  function focusBoardApplicationsView() {
    if (!isBoardApplicationsView()) return false;
    const appsSection = resolveApplicationsSectionEl();
    if (!appsSection || appsSection.hidden) return false;

    const offset = measureBoardApplicationsScrollOffset();
    document.documentElement.style.setProperty("--tasu-board-pd-focus-offset", `${offset}px`);

    const firstCard = appsSection.querySelector(".mvp-pd-appItem:not(.mvp-pd-appItem--empty)");
    const target = firstCard || appsSection;
    const rect = target.getBoundingClientRect();
    const top = Math.max(0, window.scrollY + rect.top - offset);

    window.scrollTo({
      top,
      behavior: global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
    });

    appsSection.classList.remove("is-view-focus");
    void appsSection.offsetWidth;
    appsSection.classList.add("is-view-focus");
    global.clearTimeout(appsSection._boardPdFocusTimer);
    appsSection._boardPdFocusTimer = global.setTimeout(() => {
      appsSection.classList.remove("is-view-focus");
    }, 3200);

    return true;
  }

  function scheduleBoardApplicationsFocus() {
    if (!isBoardApplicationsView()) return;
    const token = ++boardApplicationsFocusToken;
    const attempts = [0, 80, 180, 360, 600, 900, 1200];
    attempts.forEach((delay) => {
      global.setTimeout(() => {
        if (token !== boardApplicationsFocusToken) return;
        focusBoardApplicationsView();
      }, delay);
    });
  }

  function renderBoardProjectDetailPage() {
    applyBoardPageBackLinks();
    const api = mvp();
    const id = getProjectIdParam() || "demo-project-001";
    const adapter = global.TasuBuilderBoardAdapter;
    let state;
    let project;
    if (adapter?.getBoardProject) {
      const bundle = adapter.getBoardProject(id);
      state = bundle?.state || api.reload();
      project =
        bundle?.project ||
        (state.projects || []).find((x) => x.project_id === id) ||
        DEMO_PROJECTS.find((x) => x.project_id === id);
    } else {
      state = api.reload();
      project = (state.projects || []).find((x) => x.project_id === id) || DEMO_PROJECTS.find((x) => x.project_id === id);
    }

    if (!project || !isBoardFeedItem(project)) {
      syncBoardPdApplyDock({ canApply: false });
      setText("[data-builder-mvp-pd-title]", "投稿が見つかりません");
      setText("[data-builder-mvp-pd-sub]", project && !isBoardFeedItem(project) ? "運営管理案件は board 画面では表示しません" : `id: ${id}`);
      return;
    }
    if (guardPosterOnlyApplicationsView(project, state)) {
      syncBoardPdApplyDock({ canApply: false });
      return;
    }

    const typeCfg = getBoardTypeConfig(project);
    const boardType = resolveBoardItemType(project);
    const spec = getProjectSpec(state, project.project_id);
    const status = computeProjectStatus(state, project);
    const urgent = isUrgentProject({ project, spec, state, status });
    const statusLabel = toDetailStatusLabel({ project, spec, state, status });
    const statusPillMod = detailStatusPillMod(statusLabel);
    const area = spec.areaLabel || "—";
    const period = formatJapaneseDateRange(spec.period);
    const budgetText = formatBudget(showcaseBudget(spec.budget, { area, title: project.title || "" }));
    const rewardText = spec.reward || budgetText;
    const required = Math.max(1, Number(project.required_partners || 1));
    const selectedCount = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids.length : 0;
    const apps =
      global.TasuBuilderBoardAdapter?.listBoardApplications?.(project.project_id, { state }) ||
      (state.applications || []).filter((a) => a.project_id === project.project_id);
    const appCount = apps.length;
    const threadId = resolveBoardMainThreadId(state, project);
    const role = getRole();
    const myId = getPartnerId();
    const myApp = apps.find((a) => a.partner_id === myId);
    const selectedIds = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
    const filled = selectedIds.length >= required;
    const hired = selectedIds.includes(myId);

    if (isBoardApplicationsView()) {
      applyBoardApplicationsViewChrome(project);
    } else {
      setText("[data-builder-mvp-pd-title]", project.title || `${typeCfg.label}詳細`);
      window.TasuCommonBreadcrumb?.setCurrentLabel(project.title || "案件詳細");
      setText(
        "[data-builder-mvp-pd-sub]",
        `${typeCfg.label} · ${formatVisibility(project.visibility)} · ${formatContactPolicy(project.contact_policy)}`
      );
      delete document.body.dataset.boardPdView;
    }
    document.querySelectorAll("[data-builder-board-pd-overview-title]").forEach((el) => {
      el.textContent = typeCfg.overviewTitle;
    });
    document.querySelectorAll("[data-builder-board-pd-work-title]").forEach((el) => {
      el.textContent = typeCfg.workTitle;
    });
    document.querySelectorAll("[data-builder-board-pd-trades-title]").forEach((el) => {
      el.textContent = typeCfg.tradesTitle;
    });
    const appsPanelTitle = document.querySelector("[data-builder-board-pd-apps-title]");
    if (appsPanelTitle) appsPanelTitle.textContent = typeCfg.panelTitle;
    setText("[data-builder-mvp-pd-hero-summary]", `${area} · ${rewardText} · ${period}`);

    const badges = document.querySelector("[data-builder-mvp-pd-badges]");
    if (badges) {
      badges.innerHTML =
        `<span class="mvp-pill mvp-pill--kind">${esc(resolveBoardBadgeLabel(project))}</span>` +
        `<span class="mvp-pill mvp-pill--${esc(statusPillMod)}">${esc(statusLabel)}</span>` +
        (urgent && statusLabel !== "締切間近" ? `<span class="mvp-pill mvp-pill--urgent">急募</span>` : "");
    }

    const stats = document.querySelector("[data-builder-mvp-pd-stats]");
    if (stats) {
      const categoryLabel = resolveBoardBadgeLabel(project);
      stats.innerHTML =
        buildMvpPdStat("案件種別", categoryLabel) +
        buildMvpPdStat("エリア", area) +
        buildMvpPdStat("報酬", rewardText) +
        buildMvpPdStat("工期", period) +
        buildMvpPdStat("募集人数", `${required} 名`) +
        buildMvpPdStat("応募数", `${appCount} 件`) +
        buildMvpPdStat("選定", `${selectedCount} / ${required}`);
    }

    setText("[data-builder-mvp-pd-overview]", spec.overview);
    setText("[data-builder-mvp-pd-work]", spec.work_content);
    setText("[data-builder-mvp-pd-preferred]", spec.preferred_conditions);
    setText("[data-builder-mvp-pd-notes]", spec.notes);

    const tradesHost = document.querySelector("[data-builder-mvp-pd-trades]");
    if (tradesHost) {
      const chips = (spec.trades || []).length
        ? spec.trades.map((t) => `<span class="mvp-pill mvp-pill--open">${esc(t)}</span>`).join("")
        : `<span class="mvp-pd-body">—</span>`;
      tradesHost.innerHTML = chips;
    }

    const attachList = document.querySelector("[data-builder-mvp-pd-attachments]");
    const attachKpi = document.querySelector("[data-builder-mvp-pd-attach-kpi]");
    const attachments = spec.attachments || [];
    if (attachKpi) attachKpi.textContent = `${attachments.length} 件`;
    if (attachList) {
      if (!attachments.length) {
        attachList.innerHTML = `<li class="mvp-pd-attach mvp-pd-attach--empty">添付資料はありません</li>`;
      } else {
        attachList.innerHTML = attachments
          .map((a) => {
            const isImage = a.type === "image" && a.url;
            const previewInner = isImage
              ? `<img class="mvp-pd-attach__img" src="${esc(a.url)}" alt="" loading="lazy" />`
              : `<span class="mvp-pd-attach__type">${a.type === "pdf" ? "PDF" : "DOC"}</span>`;
            return (
              `<li class="mvp-pd-attach">` +
              `<div class="mvp-pd-attach__preview">${previewInner}</div>` +
              `<span class="mvp-pd-attach__name">${esc(a.name || "—")}</span>` +
              `</li>`
            );
          })
          .join("");
      }
    }

    const applyBtn = document.querySelector("[data-builder-board-pd-apply]");
    const applyStatus = document.querySelector("[data-builder-board-pd-apply-status]");
    const threadsLink = document.querySelector("[data-builder-board-pd-threads]");
    const threadBtn = document.querySelector("[data-builder-board-pd-thread]");
    const threadHint = document.querySelector("[data-builder-board-pd-thread-hint]");
    const editBtn = document.querySelector("[data-builder-board-pd-edit]");
    const appsSection = document.querySelector("[data-builder-board-pd-apps-section]");

    if (threadsLink) threadsLink.setAttribute("href", boardThreadsHref(project.project_id));
    if (editBtn) {
      editBtn.hidden = role !== "owner";
      editBtn.setAttribute("href", `mvp-project-new.html?project_id=${encodeURIComponent(project.project_id)}`);
    }

    if (role === "partner") {
      if (appsSection) appsSection.hidden = true;
      const canApply = !myApp && !filled && status !== "completed" && status !== "invoiced";
      if (applyBtn) {
        applyBtn.hidden = !canApply;
        applyBtn.textContent = typeCfg.applyDetailCta;
      }
      if (applyStatus) {
        applyStatus.hidden = false;
        applyStatus.textContent = hired
          ? `${typeCfg.matchVerb}済みです。チャットで条件確認・やりとりができます。`
          : myApp
            ? myApp.status === "rejected"
              ? "見送りになりました。"
              : `${typeCfg.appliedCta}です。${typeCfg.matchVerb}結果をお待ちください。`
            : filled
              ? "募集は終了しました。"
              : "";
      }
      if (threadBtn && threadHint) {
        const showThread = Boolean(threadId) && (hired || myApp);
        threadBtn.hidden = !showThread;
        threadHint.hidden = showThread;
        if (showThread) threadBtn.setAttribute("href", boardThreadHref(threadId));
      }
    } else {
      if (appsSection) appsSection.hidden = false;
      if (applyBtn) applyBtn.hidden = true;
      if (applyStatus) applyStatus.hidden = true;
      if (threadBtn && threadHint) {
        if (threadId) {
          threadBtn.hidden = false;
          threadHint.hidden = true;
          threadBtn.setAttribute("href", boardThreadHref(threadId));
          threadBtn.textContent = "チャットを開く";
        } else {
          threadBtn.hidden = true;
          threadHint.hidden = false;
        }
      }
    }

    const appKpi = document.querySelector("[data-builder-mvp-pd-app-kpi]");
    const appCallouts = document.querySelector("[data-builder-mvp-pd-app-callouts]");
    const appMeta = document.querySelector("[data-builder-mvp-pd-app-meta]");
    const appList = document.querySelector("[data-builder-mvp-pd-app-list]");
    if (appKpi && appCallouts && appMeta && appList) {
      appKpi.textContent = `${apps.length} 件`;
      const remainingSlots = Math.max(0, required - selectedIds.length);
      appMeta.innerHTML =
        buildMetaRow("応募人数", `${apps.length} 名`) +
        buildMetaRow("選定済み", `${selectedIds.length} 名`) +
        buildMetaRow("残り募集", `${remainingSlots} 名`) +
        buildMetaRow("状態", statusLabel);

      const call = [];
      if (role === "owner") {
        call.push(
          buildCalloutHtml({
            title: typeCfg.panelTitle,
            text: filled ? "募集人数に達しました。" : typeCfg.appsSectionLead,
            tone: "warning",
          })
        );
      }
      appCallouts.innerHTML = call.join("");

      const buildRow = (a) => {
        const partner =
          (state.partners || []).find((x) => x.partner_id === a.partner_id) ||
          DEMO_PARTNERS.find((x) => x.partner_id === a.partner_id);
        const name = partner?.display_name || a.partner_id;
        const st = selectedIds.includes(a.partner_id) ? "selected" : a.status || "applied";
        const stLabel =
          st === "selected"
            ? `${typeCfg.matchVerb}済み`
            : st === "rejected"
              ? "見送り"
              : typeCfg.type === "worker"
                ? "依頼中"
                : "応募中";
        const chipMod = st === "selected" ? "open" : st === "rejected" ? "urgent" : "draft";
        const canSelect = role === "owner" && !filled && st !== "selected";
        const btns =
          role === "owner"
            ? `${canSelect ? `<button type="button" class="builder-btn builder-btn--secondary" data-builder-board-pd-select data-partner-id="${esc(a.partner_id)}">${esc(
                typeCfg.hireCta
              )}</button>` : ""}` +
              `<button type="button" class="builder-btn builder-btn--ghost" data-builder-board-pd-reject data-partner-id="${esc(a.partner_id)}" ${st === "rejected" ? "disabled" : ""}>${esc(
                typeCfg.rejectCta
              )}</button>`
            : "";
        return (
          `<li class="mvp-pd-appItem">` +
          `<div class="mvp-pd-appItem__head">` +
          `<p class="mvp-pd-appItem__name">${esc(name)}</p>` +
          `<span class="builder-chip builder-chip--${esc(chipMod)}">${esc(stLabel)}</span>` +
          `</div>` +
          `<p class="mvp-pd-appItem__meta">${esc(new Date(a.ts || nowIso()).toLocaleString())}</p>` +
          (btns ? `<div class="mvp-pd-appItem__actions">${btns}</div>` : "") +
          `</li>`
        );
      };

      appList.innerHTML = apps.length
        ? apps
            .slice()
            .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
            .map(buildRow)
            .join("")
        : `<li class="mvp-pd-appItem mvp-pd-appItem--empty"><p class="mvp-pd-appItem__name">応募者なし</p><p class="mvp-pd-appItem__meta">まだ応募はありません。</p></li>`;

      if (!appList.dataset.boardBound) {
        appList.dataset.boardBound = "1";
        appList.addEventListener("click", (ev) => {
          const sel = ev.target?.closest?.("[data-builder-board-pd-select]");
          const rej = ev.target?.closest?.("[data-builder-board-pd-reject]");
          if (!sel && !rej) return;
          if (getRole() !== "owner") return;
          const partner_id = (sel || rej).getAttribute("data-partner-id");
          if (!partner_id) return;
          if (commitBoardApplicationDecision(api, project, partner_id, Boolean(sel))) {
            renderBoardProjectDetailPage();
          }
        });
      }
    }

    if (applyBtn && !applyBtn.dataset.bound) {
      applyBtn.dataset.bound = "1";
      applyBtn.addEventListener("click", () => {
        if (getRole() !== "partner") return;
        if (boardApplyToProject(api, project.project_id)) renderBoardProjectDetailPage();
      });
    }

    syncBoardPdApplyDock({
      canApply: role === "partner" && applyBtn && !applyBtn.hidden,
      typeCfg,
    });

    scheduleBoardApplicationsFocus();
  }

  function isBoardPdApplyDockViewport() {
    try {
      return global.matchMedia("(max-width: 480px)").matches;
    } catch {
      return false;
    }
  }

  function syncBoardPdApplyDock({ canApply, typeCfg }) {
    const dock = document.querySelector("[data-builder-board-pd-apply-dock]");
    const dockBtn = document.querySelector("[data-builder-board-pd-apply-dock-btn]");
    if (!dock || !dockBtn) return;

    const show = Boolean(canApply && isBoardPdApplyDockViewport());
    dock.hidden = !show;
    document.body.classList.toggle("builder-board-pd-apply-dock-on", show);

    if (show && typeCfg) {
      dockBtn.textContent = typeCfg.applyCta || "応募する";
    }

    if (!dockBtn.dataset.bound) {
      dockBtn.dataset.bound = "1";
      dockBtn.addEventListener("click", () => {
        if (getRole() !== "partner") return;
        const primary = document.querySelector("[data-builder-board-pd-apply]");
        if (primary && !primary.hidden) primary.click();
      });
    }

    if (!document.body.dataset.boardPdApplyDockMq) {
      document.body.dataset.boardPdApplyDockMq = "1";
      try {
        global.matchMedia("(max-width: 480px)").addEventListener("change", () => {
          if (getPage() === "builder-board-project-detail") renderBoardProjectDetailPage();
        });
      } catch {
        /* ignore */
      }
    }
  }

  const BOARD_COMPLETION_DEMO_THREAD_ID = "thread-demo-001";
  const BOARD_COMPLETION_DEMO_PROJECT_ID = "demo-project-001";

  function isBoardThreadNotifyCompletionEntry() {
    const hash = String(global.location?.hash || "")
      .replace(/^#/, "")
      .trim()
      .toLowerCase();
    if (hash !== "completion") return false;
    const from = getParam("from");
    return from === "notify" || from === "talk";
  }

  function shouldFocusBoardThreadCompletion(state, threadId) {
    const hash = String(global.location?.hash || "")
      .replace(/^#/, "")
      .trim()
      .toLowerCase();
    if (hash === "completion") return true;
    const from = getParam("from");
    if (from !== "talk" && from !== "notify") return false;
    const thread = state?.threads?.[String(threadId || "").trim()];
    const sub = normalizeThreadCompletionSubmission(thread);
    return sub?.status === "submitted" || sub?.status === "rejected";
  }

  function shouldShowBoardThreadCompletionSection(completionHtml) {
    return Boolean(String(completionHtml || "").trim());
  }

  function scrollBoardThreadToCompletionSection() {
    const target = document.getElementById("completion");
    if (!target) return;
    global.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("mvp-thread-completion--highlight");
      global.setTimeout(() => target.classList.remove("mvp-thread-completion--highlight"), 1800);
    }, 120);
  }

  /** TALK マスター通知（#completion）向け — デモスレッドに確認待ち完了報告を補完 */
  function ensureBoardThreadCompletionReviewSeed(api, threadId) {
    const tid = String(threadId || "").trim();
    if (!tid) return false;
    const hash = String(global.location?.hash || "")
      .replace(/^#/, "")
      .trim()
      .toLowerCase();
    const from = getParam("from");
    if (hash !== "completion" && from !== "talk" && from !== "notify") return false;

    const state = api.reload();
    const thread = state.threads?.[tid];
    const project = (state.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project || usesMvpPartnerThread(project)) return false;

    const sub = normalizeThreadCompletionSubmission(thread);
    if (sub?.status === "submitted" || sub?.status === "approved" || sub?.status === "rejected") {
      return false;
    }
    if (tid !== BOARD_COMPLETION_DEMO_THREAD_ID || project.project_id !== BOARD_COMPLETION_DEMO_PROJECT_ID) {
      return false;
    }
    const next = api.reload();
    const pidx = (next.projects || []).findIndex((p) => p.project_id === BOARD_COMPLETION_DEMO_PROJECT_ID);
    if (pidx < 0) return false;
    const pr = next.projects[pidx];
    const selected = Array.isArray(pr.selected_partner_ids) ? [...pr.selected_partner_ids] : [];
    if (!selected.includes("demo-partner-001")) selected.push("demo-partner-001");
    const ts = nowIso();

    next.projects[pidx] = {
      ...pr,
      selected_partner_ids: selected,
      board_type: pr.board_type || "project",
      projectKind: pr.projectKind || "project",
    };
    const existingSite = normalizeMvpThreadSiteData(next.threads[tid]?.siteData, {
      threadId: tid,
      projectId: BOARD_COMPLETION_DEMO_PROJECT_ID,
      state: next,
    });
    next.threads[tid] = {
      ...next.threads[tid],
      status: "completion_pending",
      demo_completion_review_seeded: true,
      siteData: {
        ...existingSite,
        photos: [
          ...(existingSite.photos || []),
          {
            id: "demo-site-before",
            name: "着工前_外壁.jpg",
            stage: "before",
            ts: ts,
            memo: "足場設置前",
          },
          {
            id: "demo-site-after",
            name: "完了後_外壁.jpg",
            stage: "after",
            ts: ts,
            memo: "足場解体後",
          },
        ],
      },
      completion_submission: {
        status: "submitted",
        comment: "足場工事が完了しました。写真・請求書を添付します。",
        attachments: [{ name: "作業報告書.pdf", type: "pdf" }],
        photos: [
          { name: "完了写真_01.jpg", type: "image" },
          { name: "完了写真_02.jpg", type: "image" },
        ],
        invoice: { name: "請求書.pdf", type: "pdf" },
        submitted_at: ts,
        submitted_by: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
      },
      events: [
        ...(next.threads[tid]?.events || []),
        {
          type: "completion_requested",
          actor: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
          ts,
          text: "完了報告を提出しました。",
        },
      ],
    };
    api.commit(next);
    return true;
  }

  function renderBoardThreadCompletionPanel(threadId, state, project) {
    if (usesMvpPartnerThread(project)) {
      const mvpHref = resolveThreadPageHref(threadId, project, getRole());
      return (
        `<div class="mvp-thread-completion mvp-thread-completion--redirect" data-thread-completion-redirect>` +
        `<p class="mvp-thread-completion__lead">この案件の完了報告はパートナー用スレッドで行ってください。</p>` +
        `<a class="builder-btn builder-btn--primary" href="${esc(mvpHref)}">パートナースレッドを開く</a>` +
        `</div>`
      );
    }

    const thread = state?.threads?.[threadId];
    const sub = normalizeThreadCompletionSubmission(thread);
    const canReview = threadCanReviewCompletion(thread, project, state);
    if (
      isBoardThreadNotifyCompletionEntry() &&
      sub &&
      canReview &&
      sub.status === "submitted"
    ) {
      return renderThreadCompletionNotifyFocus(sub, threadId, canReview);
    }

    const inner = renderThreadCompletionHost(threadId, state);
    if (inner.trim()) return inner;

    const canSubmit = thread && shouldRenderInlineThreadCompletionSubmit(thread, project, state);
    if (canSubmit) {
      return renderThreadCompletionSubmitCard(threadId);
    }
    return "";
  }

  function renderBoardThreadSurfaceSections(threadId, state, thread, project) {
    const isGeneralBoard = project && !usesMvpPartnerThread(project);
    const photosPanel = document.querySelector("[data-builder-board-thread-photos-panel]");
    const reportsPanel = document.querySelector("[data-builder-board-thread-reports-panel]");
    const completionPanel = document.querySelector("[data-builder-board-thread-completion-panel]");
    const siteStatusEl = document.querySelector("[data-builder-mvp-thread-site-status]");
    const sitePhotosHost = document.querySelector("[data-builder-mvp-site-photos]");
    const reportsHost = document.querySelector("[data-builder-mvp-thread-reports]");
    const completionJumpBtn = document.querySelector("[data-builder-board-thread-completion-jump]");
    const focusCompletion = shouldFocusBoardThreadCompletion(state, threadId);

    if (completionJumpBtn) completionJumpBtn.hidden = !isGeneralBoard;

    if (!isGeneralBoard || !thread) {
      if (photosPanel) photosPanel.hidden = true;
      if (reportsPanel) reportsPanel.hidden = true;
      if (sitePhotosHost) sitePhotosHost.innerHTML = "";
      if (reportsHost) reportsHost.innerHTML = "";
      return;
    }

    const siteData = normalizeMvpThreadSiteData(thread.siteData, {
      threadId,
      projectId: thread.project_id,
      state,
    });

    if (siteStatusEl) {
      const siteLabel =
        siteData.completed || thread.status === "completed"
          ? "現場: 完了"
          : thread.status === "completion_pending"
            ? "現場: 完了報告確認中"
            : thread.status === "in_progress"
              ? "現場: 作業中"
              : thread.status === "exited"
                ? "現場: 退場済"
                : "現場: 未入場";
      siteStatusEl.textContent = siteLabel;
    }

    // 写真0件のときは #photos ごと非表示（追加ボタンのみの空パネルを出さない）
    const hasSitePhotos = (siteData.photos || []).length > 0;
    const sitePhotoHtml =
      focusCompletion || !hasSitePhotos
        ? ""
        : renderSitePhotoHistoryHtml(siteData.photos, {
            threadId,
            showAddButton: !(siteData.completed || thread.status === "completed"),
            hideEmptyStages: true,
            ctx: { threadId, projectId: thread.project_id, state },
          });

    const reportsHtml = focusCompletion
      ? ""
      : renderThreadReportsSection(threadId, state, { omitWhenEmpty: true });

    if (sitePhotosHost) sitePhotosHost.innerHTML = sitePhotoHtml;
    if (reportsHost) reportsHost.innerHTML = reportsHtml;

    if (photosPanel) photosPanel.hidden = !sitePhotoHtml.trim();
    if (reportsPanel) reportsPanel.hidden = !reportsHtml.trim();
  }

  let mvpSitePhotoModalWired = false;

  function wireMvpSitePhotoModal() {
    if (mvpSitePhotoModalWired) return;
    mvpSitePhotoModalWired = true;

    const sitePhotoModal = document.querySelector("[data-builder-mvp-site-photo-modal]");
    const sitePhotoForm = document.querySelector("[data-builder-mvp-site-photo-form]");
    let mvpSitePhotoPendingFileName = "";

    document.body.addEventListener("click", (ev) => {
      const addBtn = ev.target?.closest?.("[data-site-photo-add]");
      if (!addBtn) return;
      ev.preventDefault();
      mvpSitePhotoPendingFileName = "";
      openMvpThreadSitePhotoPanel(addBtn.getAttribute("data-site-photo-add"));
    });

    sitePhotoModal?.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("[data-builder-mvp-site-photo-close]") || ev.target === sitePhotoModal) {
        sitePhotoModal.hidden = true;
      }
    });

    document.querySelector("[data-builder-mvp-site-photo-file]")?.addEventListener("change", (ev) => {
      const file = ev.target?.files?.[0];
      mvpSitePhotoPendingFileName = file?.name || "";
      const nameInput = document.querySelector("[data-builder-mvp-site-photo-filename]");
      if (nameInput && file?.name) nameInput.value = file.name;
    });

    sitePhotoForm?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const tid = sitePhotoModal?.dataset.threadId || getMvpThreadIdParam();
      const fileName =
        String(document.querySelector("[data-builder-mvp-site-photo-filename]")?.value || "").trim() ||
        mvpSitePhotoPendingFileName;
      const stage = document.querySelector("[data-builder-mvp-site-photo-stage]")?.value || "progress";
      const memo = String(document.querySelector("[data-builder-mvp-site-photo-memo]")?.value || "").trim();
      const result = addSitePhotoToThread(tid, { fileName, stage, memo });
      if (!result.ok) {
        if (result.error === "invalid") alert("ファイル名を入力してください。");
        else alert("写真の追加に失敗しました。");
        return;
      }
      mvpSitePhotoPendingFileName = "";
      sitePhotoForm?.reset();
      if (sitePhotoModal) sitePhotoModal.hidden = true;
      if (getPage() === "builder-board-thread") renderBoardThreadPage();
      else renderSlackStyleMvpThreadPage();
    });
  }

  let boardThreadPageWired = false;

  function wireBoardThreadPage() {
    wireThreadPdfOutputActions();
    wireMvpSitePhotoModal();
    if (boardThreadPageWired) return;
    boardThreadPageWired = true;

    const form = document.querySelector("[data-builder-mvp-thread-form]");
    const input = document.querySelector("[data-builder-mvp-thread-input]");
    const pendingHost = document.querySelector("[data-builder-mvp-thread-pending]");
    const imgInput = document.querySelector("[data-builder-mvp-thread-attach-image]");
    const pdfInput = document.querySelector("[data-builder-mvp-thread-attach-pdf]");

    const renderPending = () => {
      if (!pendingHost) return;
      if (!mvpThreadComposePending.length) {
        pendingHost.hidden = true;
        pendingHost.innerHTML = "";
        return;
      }
      pendingHost.hidden = false;
      pendingHost.innerHTML =
        '<p class="mvp-thread-compose__pendingLabel">添付予定</p>' +
        mvpThreadComposePending
          .map(
            (a, i) =>
              `<span class="mvp-thread-compose__pendingItem">${esc(a.name)} <button type="button" class="mvp-thread-compose__pendingRemove" data-pending-index="${i}" aria-label="添付を削除">×</button></span>`
          )
          .join("");
    };

    const queueFile = (file, type) => {
      if (!file) return;
      mvpThreadComposePending.push({
        id: uid("pending"),
        name: file.name || (type === "pdf" ? "document.pdf" : "image.jpg"),
        type,
        ts: nowIso(),
      });
      renderPending();
    };

    imgInput?.addEventListener("change", () => {
      queueFile(imgInput.files?.[0], "image");
      imgInput.value = "";
    });
    pdfInput?.addEventListener("change", () => {
      queueFile(pdfInput.files?.[0], "pdf");
      pdfInput.value = "";
    });

    pendingHost?.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-pending-index]");
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-pending-index"));
      if (!Number.isFinite(idx)) return;
      mvpThreadComposePending.splice(idx, 1);
      renderPending();
    });

    const submitThreadMessage = () => {
      const text = String(input?.value || "").trim();
      const attachments = mvpThreadComposePending.slice();
      if (!sendMvpThreadMessage(text, attachments)) return;
      if (input) input.value = "";
      mvpThreadComposePending = [];
      renderPending();
      renderBoardThreadPage();
    };

    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      submitThreadMessage();
    });

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitThreadMessage();
      }
    });

    document.addEventListener("builder:mvp-changed", () => renderBoardThreadPage());
    document.addEventListener("builder:mvp-refresh", () => renderBoardThreadPage());
    document.addEventListener("builder:mvp-role-changed", () => renderBoardThreadPage());
    if (!document.body.dataset.boardThreadHashBound) {
      document.body.dataset.boardThreadHashBound = "1";
      global.addEventListener("hashchange", () => renderBoardThreadPage());
    }

    document.querySelector("[data-builder-board-thread-completion-jump]")?.addEventListener("click", () => {
      if (global.history?.replaceState) {
        const url = new URL(global.location.href);
        url.hash = "completion";
        global.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
      renderBoardThreadPage();
    });
  }

  function renderBoardThreadPage() {
    applyBoardPageBackLinks();
    const api = mvp();
    ensureMvpThreadsDemoData(api);
    wireBoardThreadPage();
    const threadId = getMvpThreadIdParam();
    ensureBoardThreadCompletionReviewSeed(api, threadId);
    ensureBoardThreadUrlParams();
    const state = api.reload();
    const thread = state.threads?.[threadId];
    const project = (state.projects || []).find((p) => p.project_id === thread?.project_id);

    const projectTitleEl = document.querySelector("[data-builder-mvp-thread-project-title]");
    const statusEl = document.querySelector("[data-builder-mvp-thread-status]");
    const unreadEl = document.querySelector("[data-builder-mvp-thread-unread]");
    const participantsEl = document.querySelector("[data-builder-mvp-thread-participants]");
    const updatedEl = document.querySelector("[data-builder-mvp-thread-updated]");
    const msgKpi = document.querySelector("[data-builder-mvp-thread-msg-kpi]");
    const msgList = document.querySelector("[data-builder-mvp-thread-msgs]");
    const completionBtn = document.querySelector("[data-builder-board-thread-completion]");
    const invoiceBtn = document.querySelector("[data-builder-board-thread-invoice]");

    if (!projectTitleEl || !statusEl || !msgList) return;

    const backHref = project?.project_id
      ? boardDetailHref(project.project_id, resolveBoardItemType(project))
      : "board-projects.html";
    setBuilderPageBack(backHref, "詳細へ");

    if (!thread || !project || !isBoardFeedItem(project)) {
      projectTitleEl.textContent = "チャットが見つかりません";
      statusEl.textContent = "—";
      statusEl.className = "mvp-pill mvp-pill--muted";
      if (unreadEl) unreadEl.hidden = true;
      msgList.innerHTML =
        '<li class="mvp-slack-msg mvp-slack-msg--system"><p class="mvp-slack-msg__system">掲示板投稿のスレッドを指定してください。</p></li>';
      applyMvpThreadChatLockUi(false);
      return;
    }

    const threadKindEl = document.querySelector("[data-builder-board-thread-kind]");
    if (threadKindEl) threadKindEl.textContent = getBoardTypeConfig(project).label;

    if (completionBtn) {
      completionBtn.hidden = true;
      completionBtn.removeAttribute("href");
    }
    if (invoiceBtn) {
      invoiceBtn.hidden = true;
      invoiceBtn.removeAttribute("href");
    }

    renderBoardThreadSurfaceSections(threadId, state, thread, project);

    wireThreadCompletionFlow();
    const completionHost = document.querySelector("[data-builder-thread-completion-host]");
    const completionPanel = document.querySelector("[data-builder-board-thread-completion-panel]");
    let completionHtml = "";
    if (completionHost) {
      completionHtml = renderBoardThreadCompletionPanel(threadId, state, project);
      completionHost.innerHTML = completionHtml;
    }
    if (completionPanel) {
      completionPanel.hidden = !shouldShowBoardThreadCompletionSection(completionHtml);
    }

    const spec = getProjectSpec(state, project.project_id);
    const status = computeProjectStatus(state, project);
    const statusLabel = toDetailStatusLabel({ project, spec, state, status });
    const statusMod = detailStatusPillMod(statusLabel);
    const unread = threadUnreadCountDemo(threadId);

    projectTitleEl.textContent = project.title || thread.project_id || "—";
    window.TasuCommonBreadcrumb?.setCurrentLabel(project.title || thread.project_id || "スレッド");
    statusEl.textContent = statusLabel;
    statusEl.className = `mvp-pill mvp-pill--${statusMod}`;

    if (unreadEl) {
      unreadEl.hidden = false;
      unreadEl.textContent = unread > 0 ? `${unread} 未読` : "既読";
      unreadEl.className = unread > 0 ? "mvp-thread-summary__unread" : "mvp-thread-summary__unread mvp-thread-summary__unread--zero";
    }

    if (participantsEl) participantsEl.textContent = String(threadParticipantCount(state, thread, project));
    const updatedTs = threadLastActivityTs(thread);
    if (updatedEl) {
      updatedEl.textContent = updatedTs ? new Date(updatedTs).toLocaleString() : "—";
      updatedEl.setAttribute("datetime", updatedTs || "");
    }

    const me = getActor(state);
    const events = (thread.events || []).slice();
    const msgs = (thread.messages || []).slice().sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const timeline = [
      ...events.map((e) => ({ kind: "event", ts: e.ts, event: e })),
      ...msgs.map((m) => ({ kind: "msg", ts: m.ts, msg: m })),
    ].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

    const focusCompletion = shouldFocusBoardThreadCompletion(state, threadId);
    document.body.classList.toggle(
      "builder-board-thread--notify-completion",
      isBoardThreadNotifyCompletionEntry() && focusCompletion
    );
    const msgBody = document.querySelector(".mvp-slack-thread__body");
    const msgCompose = document.querySelector(".mvp-slack-thread__compose");
    const hasTimeline = timeline.length > 0;

    if (msgKpi) msgKpi.textContent = `${msgs.length} 件`;

    if (!hasTimeline) {
      msgList.innerHTML = "";
      if (msgBody) msgBody.hidden = true;
    } else {
      const completionChatCard = renderOpsPartnerThreadCompletionChatCard(threadId, thread, project, state);
      msgList.innerHTML =
        timeline
        .map((row, idx) => {
          if (row.kind === "event") {
            const e = row.event;
            const label =
              e.type === "applied"
                ? "応募"
                : e.type === "selected"
                  ? "選定"
                  : e.type === "rejected"
                    ? "却下"
                    : e.type === "completion_requested"
                      ? "完了報告"
                      : e.type === "completion_rejected"
                        ? "差し戻し"
                        : e.type === "completed"
                          ? "承認"
                          : e.type === "created"
                            ? "案件作成"
                            : "イベント";
            return (
              `<li class="mvp-slack-msg mvp-slack-msg--system">` +
              `<p class="mvp-slack-msg__system"><strong>${esc(label)}</strong> · ${esc(e.text || "")}</p>` +
              `</li>`
            );
          }
          return buildSlackThreadMessageHtml(row.msg, me, unread, idx, timeline.length, state);
        })
        .join("") + completionChatCard;
      scrollMvpThreadTimelineEnd(msgList);
      if (msgBody) msgBody.hidden = focusCompletion;
    }

    const chatLocked = isMvpThreadChatLocked(thread, project, state);
    applyMvpThreadChatLockUi(chatLocked);
    if (msgCompose) msgCompose.hidden = focusCompletion;
    const completionJumpBtn = document.querySelector("[data-builder-board-thread-completion-jump]");
    if (completionJumpBtn) completionJumpBtn.hidden = chatLocked || focusCompletion;

    if (Object.prototype.hasOwnProperty.call(DEMO_THREAD_UNREAD, threadId)) {
      DEMO_THREAD_UNREAD[threadId] = 0;
    }

    if (focusCompletion) {
      scrollBoardThreadToCompletionSection();
    }

    ensureBoardThreadUrlParams();
  }

  function renderBoardThreadsPage() {
    applyBoardPageBackLinks();
    const api = mvp();
    ensureMvpThreadsDemoData(api);
    const state = api.reload();
    const list = document.querySelector("[data-builder-board-thread-list]");
    const kpi = document.querySelector("[data-builder-board-thread-kpi]");
    if (!list || !kpi) return;

    const highlightProjectId = getParam("project_id") || getParam("id") || "";
    const rows = filterBoardThreads(state)
      .slice()
      .sort((a, b) => threadLastActivityTs(b).localeCompare(threadLastActivityTs(a)));

    kpi.textContent = `${rows.length} 件`;
    if (!rows.length) {
      list.innerHTML =
        `<li class="mvp-thread-card mvp-thread-card--empty">` +
        `<p class="mvp-thread-card__title">やり取りはありません</p>` +
        `<p class="mvp-thread-card__preview">応募・依頼の選定 / 受諾後に、ここにチャットが表示されます。</p></li>`;
      return;
    }

    list.innerHTML = rows
      .map((t) => {
        const p = (state.projects || []).find((x) => x.project_id === t.project_id);
        const title = p?.title || t.project_id || "—";
        const counterpart = boardThreadCounterpartLabel(p, state);
        const statusLabel = boardThreadListStatusLabel(p, state, t);
        const statusMod = boardThreadListStatusMod(statusLabel);
        const lastMsg = (t.messages || []).slice(-1)[0];
        const lastEvent = (t.events || []).slice(-1)[0];
        const preview = lastMsg?.text || lastEvent?.text || "—";
        const ts = threadLastActivityTs(t);
        const when = ts ? new Date(ts).toLocaleString() : "—";
        const unread = threadUnreadCountDemo(t.thread_id);
        const href = boardThreadHref(t.thread_id);
        const isHighlight = highlightProjectId && p?.project_id === highlightProjectId;
        const unreadHtml =
          unread > 0
            ? `<span class="mvp-thread-card__unread">${esc(String(unread))} 未読</span>`
            : `<span class="mvp-thread-card__unread mvp-thread-card__unread--zero">既読</span>`;
        return (
          `<li>` +
          `<a class="mvp-thread-card${isHighlight ? " is-highlight" : ""}" href="${esc(href)}" data-thread-id="${esc(t.thread_id)}">` +
          `<div class="mvp-thread-card__head">` +
          `<h3 class="mvp-thread-card__title">${esc(title)}</h3>` +
          unreadHtml +
          `</div>` +
          `<p class="mvp-thread-card__counterpart"><span class="mvp-thread-card__statLabel">相手</span> ${esc(counterpart)}</p>` +
          `<p class="mvp-thread-card__preview">${esc(preview)}</p>` +
          `<div class="mvp-thread-card__foot">` +
          `<span class="mvp-thread-card__status mvp-pill mvp-pill--${esc(statusMod)}">${esc(statusLabel)}</span>` +
          `<time class="mvp-thread-card__time" datetime="${esc(ts)}">${esc(when)}</time>` +
          `</div>` +
          `</a>` +
          `</li>`
        );
      })
      .join("");
  }

  function formatBudget(budget) {
    if (!budget || typeof budget !== "object") return "—";
    const min = Number(budget.min || 0);
    const max = Number(budget.max || 0);
    const pick = Math.max(min, max);
    if (!Number.isFinite(pick) || pick <= 0) return "—";
    return formatJPYUnits(pick);
  }

  function showcaseBudget(budget, { area, title }) {
    if (budget && typeof budget === "object") return budget;
    const hay = `${String(area || "")} ${String(title || "")}`;
    if (hay.includes("千葉")) return { min: 120000000, max: 120000000 }; // 1.2億円
    if (hay.includes("横浜")) return { min: 45000000, max: 45000000 }; // 4500万円
    return budget;
  }

  function formatJPYUnits(amount) {
    const n = Math.round(Number(amount || 0));
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (n >= 100000000) {
      const oku = Math.round((n / 100000000) * 10) / 10;
      return `${oku.toLocaleString()}億円`;
    }
    if (n >= 10000) {
      const man = Math.round(n / 10000);
      return `${man.toLocaleString()}万円`;
    }
    return `${n.toLocaleString()}円`;
  }

  function formatJapaneseDateRange(period) {
    const start = period?.start ? new Date(String(period.start)) : null;
    const end = period?.end ? new Date(String(period.end)) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return period?.start && period?.end ? `${period.start}〜${period.end}` : "—";
    }
    const y1 = start.getFullYear();
    const m1 = start.getMonth() + 1;
    const d1 = start.getDate();
    const y2 = end.getFullYear();
    const m2 = end.getMonth() + 1;
    const d2 = end.getDate();
    const left = `${y1}年${m1}月${d1}日`;
    const right = y1 === y2 ? `${m2}月${d2}日` : `${y2}年${m2}月${d2}日`;
    return `${left}～${right}`;
  }

  function formatDeadline(end) {
    if (!end) return "—";
    const d = new Date(String(end));
    if (Number.isNaN(d.getTime())) return String(end);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function isUrgentProject({ project, spec, state, status }) {
    if (spec?.urgent === true) return true;
    if (status !== "open") return false;
    const end = spec?.period?.end;
    const d = end ? new Date(String(end)) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const required = Math.max(1, Number(project?.required_partners || 1));
    const selectedCount = Array.isArray(project?.selected_partner_ids) ? project.selected_partner_ids.length : 0;
    const filled = selectedCount >= required;
    if (filled) return false;
    const apps = (state?.applications || []).filter((a) => a.project_id === project.project_id);
    return days <= 7 || apps.length === 0;
  }

  function initMvpProjectFormPage({ applyTemplate = false, applyReRequest = false } = {}) {
    const api = mvp();
    const state = api.reload();
    const form = document.querySelector("[data-builder-mvp-project-form]");
    const kpi = document.querySelector("[data-builder-mvp-kpi]");
    const callouts = document.querySelector("[data-builder-mvp-project-callouts]");
    if (!form || !kpi || !callouts) return;
    kpi.textContent = `role: ${getRole()}`;

    const titleEl = form.querySelector("[data-builder-mvp-project-title]");
    const categoryEl = form.querySelector("[data-builder-mvp-project-category]");
    const kindEl = form.querySelector("[data-builder-mvp-project-kind]");
    const visEl = form.querySelector("[data-builder-mvp-project-visibility]");
    const cpEl = form.querySelector("[data-builder-mvp-project-contact-policy]");
    const srcEl = form.querySelector("[data-builder-mvp-project-source]");
    const startEl = form.querySelector("[data-builder-mvp-project-start]");
    const endEl = form.querySelector("[data-builder-mvp-project-end]");
    const tradesEl = form.querySelector("[data-builder-mvp-project-trades]");
    const areasEl = form.querySelector("[data-builder-mvp-project-areas]");
    const descEl = form.querySelector("[data-builder-mvp-project-desc]");
    const srcHint = document.querySelector("[data-builder-mvp-source-hint]");

    const chipTradesHost = form.querySelector('[data-mvp-chiprow="trades"]');
    const chipAreasHost = form.querySelector('[data-mvp-chiprow="areas"]');
    const counterEl = form.querySelector("[data-mvp-desc-count]");

    const setCommaValues = (el, values) => {
      if (!el) return;
      const next = (values || []).map((s) => String(s || "").trim()).filter(Boolean);
      el.value = next.join(", ");
    };

    const parseCommaValues = (val) =>
      String(val || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const renderChips = (host, values, { onRemove }) => {
      if (!host) return;
      const items = (values || []).slice(0, 12);
      host.innerHTML = items
        .map(
          (t) =>
            `<span class="mvp-chip"><span class="mvp-chip__text">${esc(t)}</span><button type="button" class="mvp-chip__x" data-chip-x="${esc(
              t
            )}" aria-label="削除">×</button></span>`
        )
        .join("");
      host.onclick = (ev) => {
        const btn = ev.target?.closest?.("[data-chip-x]");
        const v = btn?.getAttribute?.("data-chip-x") || "";
        if (!v) return;
        onRemove?.(v);
      };
    };

    const rerender = () => {
      renderPolicyHints({ visibility: visEl?.value, contact_policy: cpEl?.value });

      const v = VISIBILITY_UI[visEl?.value];
      const cp = CONTACT_POLICY_UI[cpEl?.value];
      const src = SOURCE_UI[srcEl?.value];
      const items = [];
      if (v) items.push(buildMvpInfoCard({ kind: "key", title: "公開範囲", text: `${v.label}：${v.desc}` }));
      if (cp) items.push(buildMvpInfoCard({ kind: "msg", title: "連絡ポリシー", text: `${cp.label}：${cp.desc}` }));
      if (src) items.push(buildMvpInfoCard({ kind: "flag", title: "案件区分", text: `${src.label}：${src.desc}` }));
      if (cp?.danger && cpEl?.value === "tasful_talk_only")
        items.push(buildMvpInfoCard({ kind: "warn", title: "注意", text: cp.danger }));
      callouts.innerHTML = items.join("");
      if (srcHint) srcHint.textContent = src ? src.desc : "—";

      renderChips(chipTradesHost, parseCommaValues(tradesEl?.value), {
        onRemove: (t) => setCommaValues(tradesEl, parseCommaValues(tradesEl?.value).filter((x) => x !== t)),
      });
      renderChips(chipAreasHost, parseCommaValues(areasEl?.value), {
        onRemove: (t) => setCommaValues(areasEl, parseCommaValues(areasEl?.value).filter((x) => x !== t)),
      });

      if (counterEl && descEl) counterEl.textContent = String(Math.min(2000, String(descEl.value || "").length));
    };
    visEl?.addEventListener("change", rerender);
    cpEl?.addEventListener("change", rerender);
    srcEl?.addEventListener("change", rerender);
    tradesEl?.addEventListener("input", rerender);
    areasEl?.addEventListener("input", rerender);
    descEl?.addEventListener("input", rerender);

    if (applyReRequest || applyTemplate) {
      const reRequestId = getParam("re_request_id");
      const templateId = getParam("template_id");
      if (reRequestId) {
        const rr = applyMvpReRequestToPostForm(reRequestId);
        if (rr) {
          renderMvpPostTemplateNotice(null);
          renderMvpReRequestNotice(rr);
          notifyMvpReRequestUseOnce(rr);
        } else {
          renderMvpReRequestNotice(null);
          alert("再依頼データが見つかりません。");
        }
      } else if (templateId) {
        const tpl = applyMvpTemplateToPostForm(templateId);
        if (tpl) {
          renderMvpReRequestNotice(null);
          renderMvpPostTemplateNotice(tpl);
          notifyMvpTemplateUseOnce(tpl);
        } else {
          renderMvpPostTemplateNotice(null);
          alert("テンプレートが見つかりません。");
        }
      }
    }

    rerender();

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (getRole() !== "owner") {
        alert("demo: オーナー表示に切り替えて投稿してください");
        return;
      }
      const project_id = uid("proj");
      const project = {
        project_id,
        owner_id: state.owner_id,
        title: String(titleEl?.value || "").trim() || "無題案件",
        project_category: String(categoryEl?.value || "").trim() || "協力会社募集",
        kind: kindEl?.value || "builder_board",
        status: "open",
        required_partners: 1,
        selected_partner_ids: [],
        visibility: visEl?.value || "partner_only",
        contact_policy: cpEl?.value || "tasful_talk_only",
        main_thread_id: null,
        source: srcEl?.value || "company",
        source_template_id: form.dataset.sourceTemplateId || null,
        source_project_id: form.dataset.sourceProjectId || null,
        source_re_request_id: form.dataset.sourceReRequestId || null,
        created_at: nowIso(),
      };
      const budgetNote = String(
        form.dataset.sourceReRequestBudget || form.dataset.sourceTemplateBudget || ""
      ).trim();
      const spec = {
        trade_tags: String(tradesEl?.value || "").split(",").map((s) => s.trim()).filter(Boolean),
        area_codes: String(areasEl?.value || "").split(",").map((s) => s.trim()).filter(Boolean),
        period: { start: startEl?.value || "", end: endEl?.value || "" },
        description: String(descEl?.value || "").trim(),
      };
      if (budgetNote && budgetNote !== "—") spec.budget_note = budgetNote;
      const next = api.reload();
      next.projects = [project, ...(next.projects || [])];
      next.specs = { ...(next.specs || {}), [project_id]: spec };
      api.commit(next, { project, mode: "create" });
      try {
        global.TasuTalkFollowNotify?.onProjectChanged?.(project, "create");
      } catch (err) {
        console.warn("[Builder] follow notify skipped:", err);
      }
      api.pushNotification({
        type: "admin",
        body: `${project.title} を投稿しました。`,
        project_id,
        thread_id: null,
      });
      window.location.href = `board-project-detail.html?id=${encodeURIComponent(project_id)}`;
    });
  }

  function renderMvpProjectNewPage() {
    initMvpProjectFormPage({ applyTemplate: false });
    // TALK AI 下書き連携（現状維持）— TASFUL AI 導線ではない。Builder AI 本実装時に専用下書きへ移行予定。
    try {
      window.TasuTalkAiDraftApply?.tryApplyProjectPage?.();
    } catch (err) {
      console.warn("[Builder] TALK AI draft apply skipped:", err);
    }
  }

  function renderMvpPostPage() {
    initMvpProjectFormPage({ applyTemplate: true, applyReRequest: true });
  }

  function buildMvpInfoCard({ kind, title, text }) {
    const icon =
      kind === "key"
        ? "🔒"
        : kind === "msg"
          ? "💬"
          : kind === "flag"
            ? "🏁"
            : kind === "warn"
              ? "⚠"
              : "ℹ";
    const k = kind || "info";
    return (
      `<div class="mvp-infoCard is-${esc(k)}">` +
      `<div class="mvp-infoCard__icon" aria-hidden="true">${esc(icon)}</div>` +
      `<div class="mvp-infoCard__body">` +
      `<p class="mvp-infoCard__title">${esc(title || "")}</p>` +
      `<p class="mvp-infoCard__text">${esc(text || "")}</p>` +
      `</div>` +
      `</div>`
    );
  }

  function renderMvpPartnerRegisterPage() {
    const api = mvp();
    const form = document.querySelector("[data-builder-mvp-partner-form]");
    const list = document.querySelector("[data-builder-mvp-partner-list]");
    const kpi = document.querySelector("[data-builder-mvp-kpi]");
    const count = document.querySelector("[data-builder-mvp-partner-count]");
    if (!form || !list || !kpi || !count) return;
    kpi.textContent = `role: ${getRole()}`;
    const state = api.reload();
    const rows = (state.partners || []).slice();
    count.textContent = `${rows.length} 件`;
    list.innerHTML = rows.map((p) => buildPartnerListItem(p, { showFav: true })).join("");
    bindFavoriteButtons(list);

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (getRole() !== "owner") {
        alert("demo: オーナー表示に切り替えて登録してください");
        return;
      }
      const nameEl = form.querySelector("[data-builder-mvp-partner-name]");
      const tradesEl = form.querySelector("[data-builder-mvp-partner-trades]");
      const areasEl = form.querySelector("[data-builder-mvp-partner-areas]");
      const availEl = form.querySelector("[data-builder-mvp-partner-availability]");
      const headEl = form.querySelector("[data-builder-mvp-partner-headline]");
      const p = {
        partner_id: uid("partner"),
        display_name: String(nameEl?.value || "").trim() || "無題パートナー",
        partner_type: "company",
        trades: String(tradesEl?.value || "").split(",").map((s) => s.trim()).filter(Boolean),
        areas: String(areasEl?.value || "").split(",").map((s) => s.trim()).filter(Boolean),
        headline: String(headEl?.value || "").trim(),
        profile: "",
        contact_policy: "tasful_talk_only",
        availability: availEl?.value || "available",
        status: "active",
        updated_at: nowIso(),
      };
      const next = api.reload();
      next.partners = [p, ...(next.partners || [])];
      api.commit(next);
      api.pushNotification({
        type: "admin",
        body: `${p.display_name} を登録しました。`,
        href: "index.html",
      });
      window.location.href = "mvp-partner-register.html";
    });
  }

  function mvpSpeakerLabel(actor) {
    const t = String(actor?.type || "");
    if (t === "builder") return "Builder";
    if (t === "partner") return "パートナー";
    if (t === "owner") return "運営";
    return "参加者";
  }

  function mvpSpeakerBadgeHtml(actor) {
    const t = String(actor?.type || "partner");
    const label = mvpSpeakerLabel(actor);
    const mod = t === "builder" ? "builder" : t === "partner" ? "partner" : "admin";
    return `<span class="mvp-thread-speaker mvp-thread-speaker--${esc(mod)}">${esc(label)}</span>`;
  }

  function collectThreadAttachments(thread) {
    const rows = [];
    const shared = Array.isArray(thread?.shared_attachments) ? thread.shared_attachments : [];
    shared.forEach((a) => rows.push({ ...a, source: "thread" }));
    (thread?.messages || []).forEach((m) => {
      (m.attachments || []).forEach((a) => {
        rows.push({ ...a, source: "message", msg_id: m.msg_id, ts: m.ts, from: m.from });
      });
    });
    return rows.sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
  }

  function ensureMvpThreadDetailDemoData(api) {
    if (isOpsBenchSession()) return;
    const next = api.reload();
    let changed = false;
    const enrich = (threadId, extras) => {
      const t = next.threads?.[threadId];
      if (!t || t.demo_phase2_enriched) return;
      changed = true;
      t.demo_phase2_enriched = true;
      t.messages = [...(t.messages || []), ...(extras.messages || [])];
      t.shared_attachments = [...(t.shared_attachments || []), ...(extras.shared_attachments || [])];
    };

    enrich("thread-demo-001", {
      messages: [
        {
          msg_id: "msg-demo-002",
          from: { id: "demo-builder-user", type: "builder", name: "山田 太郎" },
          ts: "2026-05-26T03:00:00.000Z",
          text: "現場確認の日程、来週火曜14時で可能でしょうか。",
        },
        {
          msg_id: "msg-demo-003",
          from: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
          ts: "2026-05-26T04:15:00.000Z",
          text: "承知しました。14時に伺います。必要書類があれば共有ください。",
        },
        {
          msg_id: "msg-demo-004",
          from: { id: OWNER_ID, type: "owner", name: "TASFUL運営" },
          ts: "2026-05-26T05:30:00.000Z",
          text: "日程確定しました。平面図を添付しますのでご確認ください。",
          attachments: [{ id: "att-demo-001", name: "平面図.pdf", type: "pdf", ts: "2026-05-26T05:30:00.000Z" }],
        },
        {
          msg_id: "msg-demo-005",
          from: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
          ts: "2026-05-27T02:30:00.000Z",
          text: "平面図確認しました。養生エリアについて1点確認させてください。",
        },
      ],
      shared_attachments: [
        { id: "att-demo-002", name: "現場写真_01.jpg", type: "image", ts: "2026-05-25T08:00:00.000Z" },
      ],
    });

    enrich("thread-demo-002", {
      messages: [
        {
          msg_id: uid("msg"),
          from: { id: "demo-builder-user", type: "builder", name: "山田 太郎" },
          ts: "2026-05-29T10:00:00.000Z",
          text: "工程表の初版を共有します。ご確認お願いします。",
          attachments: [{ id: uid("att"), name: "工程表_v1.pdf", type: "pdf", ts: "2026-05-29T10:00:00.000Z" }],
        },
        {
          msg_id: uid("msg"),
          from: { id: OWNER_ID, type: "owner", name: "TASFUL運営" },
          ts: "2026-05-30T09:20:00.000Z",
          text: "工程表のドラフトを確認お願いします。",
        },
      ],
    });

    enrich("thread-demo-003", {
      messages: [
        {
          msg_id: uid("msg"),
          from: { id: "demo-partner-002", type: "partner", name: "有限会社ブルー工務" },
          ts: "2026-05-31T12:00:00.000Z",
          text: "見積書を添付しました。差分についてご相談させてください。",
          attachments: [{ id: uid("att"), name: "見積書_修正版.pdf", type: "pdf", ts: "2026-05-31T12:00:00.000Z" }],
        },
        {
          msg_id: uid("msg"),
          from: { id: "demo-builder-user", type: "builder", name: "山田 太郎" },
          ts: "2026-05-31T14:45:00.000Z",
          text: "見積書の差分について確認させてください。内装工事の単価表も共有いただけますか。",
        },
      ],
    });

    if (changed) api.commit(next);
  }

  let mvpThreadComposePending = [];
  let mvpThreadPageWired = false;
  let mvpThreadCompleteDelegationWired = false;

  function openMvpThreadCompletionPanel() {
    const tid = getMvpThreadIdParam();
    const state = mvp().reload();
    const thread = state?.threads?.[tid];
    const project = (state?.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project) {
      closeMvpThreadCompletionModal();
      return;
    }

    const sub = normalizeThreadCompletionSubmission(thread);
    const canSubmit = threadCanSubmitCompletion(thread, project, state);
    const canReview = threadCanReviewCompletion(thread, project, state);
    const isReviewer = threadCompletionIsReviewer(state, project);
    const isSubmitter = threadCompletionIsSubmitter(state, project);

    if (!isSubmitter && !isReviewer) {
      closeMvpThreadCompletionModal();
      return;
    }
    if (isReviewer && !canReview) {
      closeMvpThreadCompletionModal();
      return;
    }
    if (isSubmitter && !canSubmit && sub?.status !== "rejected") {
      closeMvpThreadCompletionModal();
      return;
    }

    syncMvpThreadCompletionModal(tid, state);
    const { html } = renderMvpThreadCompletionModalBody(tid, state);
    if (!String(html || "").trim()) {
      closeMvpThreadCompletionModal();
      return;
    }

    emitBuilderOpsBenchEvent("builder:ops:completion-report-open", {
      threadId: tid,
      projectId: thread.project_id || null,
    });

    const benchEmbed =
      global.TasuBuilderBenchEmbed?.isBuilderBenchEmbed?.() ||
      document.body?.classList?.contains("builder-bench-embed");
    const target = document.getElementById("completion");
    const completeModal = document.querySelector("[data-builder-mvp-thread-complete-modal]");
    if (!benchEmbed && target && isMvpThreadCompletionPanelVisible(target)) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("mvp-thread-completion--highlight");
      global.setTimeout(() => target.classList.remove("mvp-thread-completion--highlight"), 1800);
      return;
    }
    if (completeModal) {
      completeModal.hidden = false;
      completeModal.removeAttribute("hidden");
      completeModal.scrollTop = 0;
      document.body.scrollTop = 0;
      mvpThreadUserAuxModal = "completion";
    }
  }

  function wireMvpThreadCompleteDelegation() {
    if (mvpThreadCompleteDelegationWired) return;
    mvpThreadCompleteDelegationWired = true;
    document.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-builder-mvp-thread-complete-open]");
      if (!btn || btn.disabled || btn.hidden) return;
      if (document.body?.dataset?.page !== "builder-mvp-thread") return;
      ev.preventDefault();
      openMvpThreadCompletionPanel();
    });
  }
  let threadPdfOutputActionsWired = false;
  let mvpThreadCrossTabSyncWired = false;
  let mvpThreadCompletePendingPhotos = [];

  function getMvpThreadIdParam() {
    return resolveBuilderThreadId(String(getParam("thread_id") || getParam("id") || "").trim());
  }

  function getCurrentThreadId() {
    return getMvpThreadIdParam();
  }

  function wireMvpThreadCrossTabSync() {
    if (mvpThreadCrossTabSyncWired) return;
    mvpThreadCrossTabSyncWired = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== MVP_THREADS_STORAGE_KEY) return;
      const currentThreadId = getCurrentThreadId();
      if (!currentThreadId) return;
      renderMvpThreadPage();
    });
  }

  function normalizeSitePhotoStage(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (s === "before" || s === "着工前") return "before";
    if (s === "after" || s === "完了後") return "after";
    return "progress";
  }

  function normalizeSitePhoto(raw, ctx = {}) {
    const p = raw && typeof raw === "object" ? raw : {};
    const state = ctx.state || mvp().reload();
    const threadId = String(p.threadId || p.thread_id || ctx.threadId || "");
    const projectId = String(p.projectId || p.project_id || ctx.projectId || "");
    const stage = normalizeSitePhotoStage(p.stage || (p.completion ? "after" : ""));
    const uploadedRaw = p.uploadedBy || p.uploaded_by || p.actor || ctx.actor;
    const uploadedBy = normalizeMvpActor(uploadedRaw, state);
    const fileName = String(p.fileName || p.file_name || p.name || "").trim();
    if (!fileName) return null;
    return {
      id: String(p.id || uid("photo")),
      projectId,
      threadId,
      stage,
      label: String(p.label || SITE_PHOTO_STAGES[stage]?.label || "施工中"),
      fileName,
      memo: String(p.memo || p.caption || ""),
      uploadedBy,
      createdAt: String(p.createdAt || p.created_at || p.uploaded_at || p.ts || nowIso()),
      url: typeof p.url === "string" ? p.url : "",
      type: String(p.type || "image"),
    };
  }

  function getSitePhotosFromThread(thread, state, ctx = {}) {
    if (!thread) return [];
    const siteData = normalizeMvpThreadSiteData(thread.siteData, {
      threadId: thread.thread_id || ctx.threadId,
      projectId: thread.project_id || ctx.projectId,
      state: state || mvp().reload(),
    });
    return siteData.photos;
  }

  function pushSitePhotoNotification(project, photo, siteTitleOverride) {
    if (!photo) return;
    const title = String(siteTitleOverride || project?.title || photo.fileName || "現場").trim();
    const stageLabel = SITE_PHOTO_STAGES[normalizeSitePhotoStage(photo.stage)]?.label || photo.label || "現場";
    mvp().pushNotification({
      type: "site_photo",
      label: "現場写真",
      body: `${title}に${stageLabel}写真が追加されました。`,
      project_id: photo.projectId || project?.project_id || null,
      thread_id: photo.threadId || null,
      href: photo.threadId ? mvpThreadHref(photo.threadId) : null,
    });
    dispatchMvpNotificationsChanged();
  }

  function addSitePhotoToThread(threadId, payload = {}) {
    const storage = global.TasuBuilderStorageAdapter;
    if (storage?.uploadProjectPhoto) {
      return storage.uploadProjectPhoto(threadId, payload, {
        getActor,
        threadCanAddSitePhoto,
        normalizeSitePhoto,
        normalizeMvpThreadSiteData,
        pushSitePhotoNotification,
      });
    }

    const tid = String(threadId || "").trim();
    const fileName = String(payload.fileName || payload.name || "").trim();
    const memo = String(payload.memo || "").trim();
    const stage = normalizeSitePhotoStage(payload.stage || "progress");
    if (!tid || !fileName) return { ok: false, error: "invalid" };

    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const project = (next.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread) return { ok: false, error: "thread_not_found" };
    if (!threadCanAddSitePhoto(thread, project, next)) return { ok: false, error: "not_allowed" };

    const actor = getActor(next);
    const siteData = normalizeMvpThreadSiteData(thread.siteData, {
      threadId: tid,
      projectId: thread.project_id,
      state: next,
    });
    const photo = normalizeSitePhoto(
      {
        projectId: thread.project_id,
        threadId: tid,
        stage,
        fileName,
        memo,
        uploadedBy: actor,
        createdAt: nowIso(),
      },
      { threadId: tid, projectId: thread.project_id, state: next, actor }
    );
    if (!photo) return { ok: false, error: "invalid" };

    thread.siteData = { ...siteData, photos: [...siteData.photos, photo] };
    api.commit(next);
    pushSitePhotoNotification(project, photo);
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    return { ok: true, photo };
  }

  function renderSitePhotoItemHtml(photo) {
    const when = photo.createdAt ? new Date(photo.createdAt).toLocaleString() : "—";
    const by = photo.uploadedBy?.name || "—";
    return (
      `<li class="builder-sitePhoto__item">` +
      `<p class="builder-sitePhoto__fileName">${esc(photo.fileName)}</p>` +
      (photo.memo ? `<p class="builder-sitePhoto__memo">${esc(photo.memo)}</p>` : "") +
      `<p class="builder-sitePhoto__meta">${esc(by)} · ${esc(when)}</p>` +
      `</li>`
    );
  }

  function renderSitePhotoHistoryHtml(photos, options = {}) {
    const stages = ["before", "progress", "after"];
    const grouped = { before: [], progress: [], after: [] };
    for (const raw of photos || []) {
      const p = normalizeSitePhoto(raw, options.ctx || {});
      if (!p) continue;
      grouped[normalizeSitePhotoStage(p.stage)].push(p);
    }
    const hideEmptyStages = Boolean(options.hideEmptyStages);
    const hasAnyPhoto = stages.some((stage) => grouped[stage].length > 0);
    const addBtn =
      options.showAddButton && options.threadId
        ? `<button type="button" class="builder-btn builder-btn--secondary builder-sitePhoto__add" data-site-photo-add="${esc(options.threadId)}">写真を追加</button>`
        : "";
    if (!hasAnyPhoto && !addBtn) return "";

    const groupsHtml = stages
      .map((stage) => {
        const rows = grouped[stage];
        if (!rows.length && hideEmptyStages) return "";
        const label = SITE_PHOTO_STAGES[stage].label;
        return (
          `<div class="builder-sitePhoto__group builder-sitePhoto__group--${stage}">` +
          `<h4 class="builder-sitePhoto__groupTitle">${esc(label)} <span class="builder-kpi">${rows.length} 件</span></h4>` +
          (rows.length
            ? `<ul class="builder-sitePhoto__list">${rows.map((p) => renderSitePhotoItemHtml(p)).join("")}</ul>`
            : `<p class="builder-sitePhoto__empty">—</p>`) +
          `</div>`
        );
      })
      .filter(Boolean)
      .join("");
    if (!groupsHtml && !addBtn) return "";

    return (
      `<section class="builder-sitePhoto">` +
      `<div class="builder-sitePhoto__head">` +
      `<h3 class="builder-section-title">現場写真</h3>${addBtn}` +
      `</div>` +
      groupsHtml +
      `</section>`
    );
  }

  function renderSitePhotoHistoryForThreadId(threadId, state, options = {}) {
    const tid = String(threadId || "").trim();
    if (!tid) return "";
    const st = state || mvp().reload();
    const thread = st.threads?.[tid];
    if (!thread) return "";
    const photos = getSitePhotosFromThread(thread, st, { threadId: tid, projectId: thread.project_id });
    if (!photos.length && !options.showAddButton) {
      return (
        `<section class="admin-cal-card__section builder-sitePhotoSection">` +
        `<h3>現場写真履歴</h3><p class="admin-cal-detail__empty">写真はまだありません。</p></section>`
      );
    }
    return (
      `<div class="admin-cal-card__section builder-sitePhotoSection">` +
      renderSitePhotoHistoryHtml(photos, {
        threadId: tid,
        showAddButton: Boolean(options.showAddButton),
        ctx: { threadId: tid, projectId: thread.project_id, state: st },
      }) +
      `</div>`
    );
  }

  function normalizeMvpThreadSiteData(raw, ctx = {}) {
    const d = raw && typeof raw === "object" ? raw : {};
    const photos = (Array.isArray(d.photos) ? d.photos : [])
      .map((photo) => {
        const normalized = normalizeSitePhoto(photo, ctx);
        if (normalized) return normalized;
        const legacyName = String(photo?.name || photo?.file_name || "").trim();
        if (!legacyName) return null;
        return normalizeSitePhoto(
          {
            ...photo,
            fileName: legacyName,
            stage: photo?.stage || (d.completed ? "after" : "progress"),
            memo: photo?.caption || photo?.memo || "",
          },
          ctx
        );
      })
      .filter(Boolean);
    return {
      photos,
      completed: Boolean(d.completed),
      completionConsent: Boolean(d.completionConsent),
      completedAt: d.completedAt ? String(d.completedAt) : null,
      entry_at: d.entry_at ? String(d.entry_at) : null,
      exit_at: d.exit_at ? String(d.exit_at) : null,
      entry_user_id: d.entry_user_id ? String(d.entry_user_id) : null,
      exit_user_id: d.exit_user_id ? String(d.exit_user_id) : null,
      lastAction: d.lastAction ? String(d.lastAction) : null,
      lastActionAt: d.lastActionAt ? String(d.lastActionAt) : null,
    };
  }

  function isOpsPartnerSiteSurface(project, thread) {
    if (!project) return false;
    const tt = resolveBuilderThreadTypeCanonical(thread?.thread_type || thread?.threadType || "");
    if (tt === "ops_partner") return true;
    return resolveBoardItemType(project) === "calendar" && usesMvpPartnerThread(project);
  }

  function getSiteAttendancePersonName(actor, state) {
    if (!actor) return "担当者";
    if (actor.type === "partner") {
      const apps = (state?.applications || []).filter((a) => a.partner_id === actor.id && a.contact_name);
      if (apps.length) return String(apps[apps.length - 1].contact_name).replace(/\s+/g, "");
      const p = (state?.partners || DEMO_PARTNERS).find((x) => x.partner_id === actor.id);
      if (p?.site_contact_name) return String(p.site_contact_name).replace(/\s+/g, "");
    }
    return String(actor.name || "担当者").replace(/\s+/g, "");
  }

  function buildSiteAttendanceSystemText(actor, action, state, isOpsSite) {
    const person = getSiteAttendancePersonName(actor, state);
    if (isOpsSite) {
      return action === "enter"
        ? `${person}さんが現場に入場しました`
        : `${person}さんが現場を退場しました`;
    }
    const label =
      actor.type === "partner" ? "協力会社" : actor.type === "owner" ? "運営" : actor.name || "参加者";
    return action === "enter" ? `${label} が入場しました。` : `${label} が退場しました。`;
  }

  function applySiteDataToThread(threadId, data) {
    const id = String(threadId || "").trim();
    if (!id) return false;
    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[id];
    if (!thread) return false;
    const prev = normalizeMvpThreadSiteData(thread.siteData, {
      threadId: id,
      projectId: thread.project_id,
      state: next,
    });
    thread.siteData = { ...prev, ...(data && typeof data === "object" ? data : {}) };
    if (thread.siteData.completed) thread.status = "completed";
    api.commit(next);
    return true;
  }

  function threadParticipantLabel(participant) {
    if (typeof participant === "string") return participant;
    return String(participant?.label || participant?.name || "").trim();
  }

  function threadHasParticipantLabel(thread, label) {
    const target = String(label || "").trim();
    if (!target) return false;
    return (Array.isArray(thread?.participants) ? thread.participants : []).some(
      (p) => threadParticipantLabel(p) === target
    );
  }

  function addThreadParticipant(thread, { label, actor }) {
    const name = String(label || actor?.name || "").trim();
    if (!name || !thread) return false;
    thread.participants = Array.isArray(thread.participants) ? thread.participants : [];
    const exists = thread.participants.some(
      (p) =>
        threadParticipantLabel(p) === name ||
        (actor?.id && typeof p === "object" && p?.id === actor.id && p?.type === actor.type)
    );
    if (exists) return false;
    thread.participants.push({
      id: String(actor?.id || ""),
      type: String(actor?.type || ""),
      label: name,
      name: String(actor?.name || name),
      joinedAt: nowIso(),
    });
    return true;
  }

  function ensureOwnerAutoJoinMvpThread(threadId) {
    if (getRole() !== "owner") return false;
    const tid = String(threadId || getCurrentThreadId() || "").trim();
    if (!tid) return false;

    const state = mvp().reload();
    const thread = state.threads?.[tid];
    if (!thread) return false;

    const siteData = normalizeMvpThreadSiteData(thread.siteData);
    if (siteData.completed || thread.status === "completed") return false;
    if (threadHasParticipantLabel(thread, "運営")) return false;

    return markMvpThreadEnterLeave("運営", "enter", tid);
  }

  function appendMvpThreadSystemMessage(state, thread, { actor, text, eventType, attachments = [] }) {
    const ts = nowIso();
    const msg = {
      msg_id: uid("msg"),
      from: actor,
      ts,
      text,
      attachments,
      read: true,
      system: Boolean(eventType),
    };
    thread.messages = [...(thread.messages || []), msg];
    if (eventType) {
      thread.events = [...(thread.events || []), { type: eventType, actor, ts, text }];
    }
    return msg;
  }

  function sendMvpThreadMessage(text, attachments, threadId) {
    const tid = String(threadId || getMvpThreadIdParam() || "").trim();
    const body = String(text || "").trim();
    let attach = Array.isArray(attachments) ? attachments : [];
    const storage = global.TasuBuilderStorageAdapter;
    if (storage?.normalizeChatAttachments && attach.length) {
      attach = storage.normalizeChatAttachments(attach, { threadId: tid });
    }
    if (!tid || (!body && !attach.length)) return false;

    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const project = (next.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread) return false;
    if (isMvpThreadChatLocked(thread, project, next)) return false;

    const actor = getActor(next);
    logMvpThreadActor("sendMvpThreadMessage", next);
    const msg = {
      msg_id: uid("msg"),
      from: actor,
      ts: nowIso(),
      text: body || (attach.length ? "ファイルを添付しました。" : ""),
      attachments: attach.map((a) => ({ ...a, ts: a.ts || nowIso() })),
      read: true,
    };
    thread.messages = [...(thread.messages || []), msg];
    thread.events = [...(thread.events || []), { type: "message", actor, ts: msg.ts, text: msg.text }];
    api.commit(next);

    if (Object.prototype.hasOwnProperty.call(DEMO_THREAD_UNREAD, tid)) {
      DEMO_THREAD_UNREAD[tid] = 0;
    }
    const isOpsSurface = usesMvpPartnerThread(project);
    const notifyRole = actor.type === "owner" ? "partner" : "owner";
    const sender = resolveBuilderOpsNotifySender(actor);
    const opsPartnerId = resolveOpsThreadNotifyPartnerId(project, thread, next);
    if (isOpsSurface) {
      const opsProjectKind = resolveBoardItemType(project) || "admin_ops";
      const threadType = opsProjectKind === "calendar" || opsProjectKind === "admin_ops" ? "ops_partner" : "";
      const recipientUserId = resolveBuilderOpsNotifyRecipientUserId(
        notifyRole,
        notifyRole === "partner" ? opsPartnerId : OWNER_ID
      );
      const opsNotifyPayload = {
        type: attach.length && !body ? "attachment" : "message",
        title: "新しいメッセージがあります",
        body: actor.type === "owner"
          ? "運営から新しいメッセージがあります。"
          : "パートナーから新しいメッセージがあります。",
        project_id: project?.project_id || null,
        projectTitle: project?.title || "",
        thread_id: tid,
        threadId: tid,
        projectKind: opsProjectKind,
        board_type: opsProjectKind,
        recipientRole: notifyRole,
        recipientUserId,
        recipientPartnerId: notifyRole === "partner" ? opsPartnerId : null,
        senderUserId: sender.senderUserId,
        senderRole: sender.senderRole,
        actionLabel: "現場連絡を開く",
        href: mvpThreadHref(tid, notifyRole === "owner" ? "owner" : "partner", threadType),
      };
      api.pushNotification(opsNotifyPayload);
      emitBuilderOpsBenchEvent("builder:ops:message-created", {
        threadId: tid,
        projectId: project?.project_id || null,
        recipientRole: notifyRole,
        recipientUserId,
        senderUserId: sender.senderUserId,
        senderRole: sender.senderRole,
        actorRole: actor.type,
        text: body || (attach.length ? "ファイルを添付しました。" : ""),
      });
    } else if (resolveGeneralFlowBenchContext(project)) {
      const recipient = resolveGeneralFlowMessageRecipient(project, actor);
      if (!recipient) return true;
      const payload = buildGeneralFlowMessageNotifyPayload({
        tid,
        project,
        thread,
        actor,
        body,
        attach,
        recipient,
      });
      api.pushNotification(payload);
      emitGeneralFlowBenchMessageCreated({
        threadId: tid,
        projectId: project?.project_id || null,
        recipientRole: recipient.role,
        recipientUserId: recipient.id,
      });
    } else {
      api.pushNotification({
        type: attach.length && !body ? "attachment" : "message",
        body: body
          ? `${project?.title || ""} にメッセージが届きました。`
          : `${project?.title || ""} にファイルが添付されました。`,
        project_id: project?.project_id || null,
        thread_id: tid,
        projectKind: resolveBoardItemType(project),
        recipientRole: notifyRole,
      });
    }
    return true;
  }

  function markMvpThreadEnterLeave(participant, action, threadId) {
    const tid = String(threadId || getMvpThreadIdParam() || "").trim();
    const act = String(action || "").trim();
    if (!tid || (act !== "enter" && act !== "leave")) return false;

    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const project = (next.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread) return false;
    if (isMvpThreadChatLocked(thread, project, next)) return false;

    const actor = getActor(next);
    const isOpsSite = isOpsPartnerSiteSurface(project, thread);
    const label =
      String(participant || "").trim() ||
      (isOpsSite
        ? getSiteAttendancePersonName(actor, next)
        : actor.type === "partner"
          ? "協力会社"
          : actor.type === "owner"
            ? "運営"
            : actor.name || "参加者");
    const eventType = act === "enter" ? "check_in" : "check_out";
    const ts = nowIso();
    const text = buildSiteAttendanceSystemText(actor, act, next, isOpsSite);

    appendMvpThreadSystemMessage(next, thread, { actor, text, eventType });
    const lastEv = (thread.events || [])[thread.events.length - 1];
    if (lastEv) lastEv.event_id = uid("ev");

    if (act === "enter") {
      addThreadParticipant(thread, { label, actor });
    }
    const siteData = normalizeMvpThreadSiteData(thread.siteData, {
      threadId: tid,
      projectId: thread.project_id,
      state: next,
    });
    if (act === "enter") {
      if (!siteData.completed && thread.status !== "completed") thread.status = "in_progress";
      siteData.entry_at = ts;
      siteData.entry_user_id = String(actor.id || "");
      if (project) {
        project.site_entry_at = ts;
        project.site_entry_user_id = String(actor.id || "");
        const pidx = (next.projects || []).findIndex((p) => p.project_id === project.project_id);
        if (pidx >= 0) next.projects[pidx] = { ...next.projects[pidx], ...project };
      }
    } else if (!siteData.completed && thread.status !== "completed") {
      thread.status = "exited";
      siteData.exit_at = ts;
      siteData.exit_user_id = String(actor.id || "");
      if (project) {
        project.site_exit_at = ts;
        project.site_exit_user_id = String(actor.id || "");
        const pidx = (next.projects || []).findIndex((p) => p.project_id === project.project_id);
        if (pidx >= 0) next.projects[pidx] = { ...next.projects[pidx], ...project };
      }
    }
    thread.siteData = { ...siteData, lastAction: act, lastActionAt: ts };
    api.commit(next);

    const projectKind = resolveBoardItemType(project);
    const isOpsSurface = usesMvpPartnerThread(project);
    const notifyRole = actor.type === "partner" ? "owner" : "partner";

    if (isOpsSurface && actor.type === "partner") {
      api.pushNotification({
        type: act === "enter" ? "attendance_enter" : "attendance_leave",
        title:
          act === "enter" ? "パートナーが現場に入場しました" : "パートナーが現場を退場しました",
        label: act === "enter" ? "現場入場" : "現場退場",
        body: text,
        project_id: project?.project_id || null,
        thread_id: tid,
        projectKind: "admin_ops",
        recipientRole: notifyRole,
        href: mvpThreadHref(tid, notifyRole, "ops_partner"),
      });
    } else {
      api.pushNotification({
        type: "message",
        label: act === "enter" ? "入場" : "退場",
        body: `${project?.title || ""}: ${text}`,
        project_id: project?.project_id || null,
        thread_id: tid,
        projectKind,
        recipientRole: notifyRole,
      });
    }
    return true;
  }

  function getThreadReportContext(threadId, state) {
    const st = state || mvp().reload();
    const tid = String(threadId || "").trim();
    const thread = st.threads?.[tid];
    if (!thread) return null;
    const project = (st.projects || []).find((p) => p.project_id === thread.project_id);
    const spec = project ? getProjectSpec(st, project.project_id) : {};
    const siteData = normalizeMvpThreadSiteData(thread.siteData, {
      threadId: tid,
      projectId: thread.project_id,
      state: st,
    });
    const partnerId =
      (project?.selected_partner_ids || [])[0] ||
      (project?.assignedPartners || [])[0]?.partnerId ||
      getPartnerId();
    const partnerName = partnerLabel(st, partnerId);
    const assignment =
      getAdminCalendarAssignments().find(
        (a) =>
          (a.projectId && a.projectId === project?.project_id) ||
          (a.houseName && project?.title && a.houseName === project.title)
      ) || null;
    const siteTitle = assignment?.houseName || project?.title || thread.project_id || "—";
    const siteAddress =
      assignment?.siteAddress ||
      spec.site_address ||
      project?.location ||
      spec.areaLabel ||
      "—";
    const workDate =
      assignment?.workDate ||
      spec.period?.start ||
      spec.period?.end ||
      "—";
    const instructions =
      spec.work_content ||
      spec.overview ||
      project?.instructions ||
      assignment?.notes ||
      "—";
    const notes = assignment?.notes || spec.notes || thread.completion_report?.note || "—";
    const photosByStage = { before: [], progress: [], after: [] };
    for (const photo of siteData.photos) {
      photosByStage[normalizeSitePhotoStage(photo.stage)].push(photo);
    }
    const attachmentNames = [
      ...(spec.attachments || []).map((a) => a?.name).filter(Boolean),
      ...(assignment?.instructionPdf?.name ? [assignment.instructionPdf.name] : []),
      ...(assignment?.parkingPdf?.name ? [assignment.parkingPdf.name] : []),
    ];
    const pdfOutputs = (thread.pdf_outputs || []).map((x) =>
      normalizeThreadPdfOutput(x, {
        project_id: thread.project_id,
        thread_id: tid,
        siteTitle,
        state: st,
      })
    );
    const invoicePdf = pdfOutputs.find((p) => p.kind === "invoice") || null;
    return {
      thread,
      project,
      spec,
      siteData,
      partnerName,
      partnerId,
      siteTitle,
      siteAddress,
      workDate,
      instructions,
      notes,
      photosByStage,
      attachmentNames,
      invoicePdf,
      pdfOutputs,
      assignment,
    };
  }

  function formatSitePhotoLines(photos) {
    if (!photos?.length) return ["（なし）"];
    return photos.map((p) => `- ${p.fileName}${p.memo ? ` (${p.memo})` : ""}`);
  }

  function buildWorkReportPdfOutput(threadId, state) {
    const ctx = getThreadReportContext(threadId, state);
    if (!ctx) return null;
    const {
      siteTitle,
      siteAddress,
      workDate,
      partnerName,
      instructions,
      notes,
      photosByStage,
      attachmentNames,
      thread,
      project,
    } = ctx;
    const lines = [
      `邸名: ${siteTitle}`,
      `現場住所: ${siteAddress}`,
      `作業日: ${workDate}`,
      `担当パートナー: ${partnerName}`,
      `作業内容: ${instructions}`,
      `備考: ${notes}`,
      "",
      "【着工前写真】",
      ...formatSitePhotoLines(photosByStage.before),
      "",
      "【施工中写真】",
      ...formatSitePhotoLines(photosByStage.progress),
      "",
      "【添付資料名】",
      ...(attachmentNames.length ? attachmentNames.map((n) => `- ${n}`) : ["（なし）"]),
    ];
    const dataUrl = buildMvpPdfDataUrl({
      title: `作業報告書 ${siteTitle}`,
      kind: "work_report",
      projectTitle: siteTitle,
      lines,
    });
    return normalizeThreadPdfOutput(
      {
        id: uid("pdf"),
        kind: "work_report",
        label: "作業報告書",
        fileName: `作業報告書_${sanitizePdfFileName(siteTitle)}.pdf`,
        actor: getActor(state || mvp().reload()),
        generated_at: nowIso(),
        url: dataUrl,
        dataUrl,
        storagePath: null,
      },
      { project_id: project?.project_id || thread.project_id, thread_id: threadId, siteTitle, state }
    );
  }

  function buildCompletionReportPdfOutput(threadId, state) {
    const ctx = getThreadReportContext(threadId, state);
    if (!ctx) return null;
    const { siteData, thread } = ctx;
    if (!siteData.completed && thread.status !== "completed") return null;

    const {
      siteTitle,
      siteAddress,
      workDate,
      partnerName,
      photosByStage,
      invoicePdf,
      project,
    } = ctx;
    const completedAt = siteData.completedAt
      ? new Date(siteData.completedAt).toLocaleString("ja-JP")
      : "—";
    const consentLabel = siteData.completionConsent ? "同意済み" : "未同意";
    const completionMemo = thread.completion_report?.note || thread.completion_report?.work_content || "—";
    const invoiceRef = invoicePdf
      ? `${invoicePdf.label} (${invoicePdf.fileName})`
      : "（請求書PDF未生成）";
    const lines = [
      `邸名: ${siteTitle}`,
      `現場住所: ${siteAddress}`,
      `作業日: ${workDate}`,
      `担当パートナー: ${partnerName}`,
      `完了日時: ${completedAt}`,
      `完了同意: ${consentLabel}`,
      "",
      "【完了後写真】",
      ...formatSitePhotoLines(photosByStage.after),
      "",
      "【着工前写真】",
      ...formatSitePhotoLines(photosByStage.before),
      "",
      "【施工中写真】",
      ...formatSitePhotoLines(photosByStage.progress),
      "",
      "【完了後写真（再掲）】",
      ...formatSitePhotoLines(photosByStage.after),
      "",
      `完了メモ: ${completionMemo}`,
      `請求書PDF: ${invoiceRef}`,
    ];
    const dataUrl = buildMvpPdfDataUrl({
      title: `完了報告書 ${siteTitle}`,
      kind: "completion_report",
      projectTitle: siteTitle,
      lines,
    });
    return normalizeThreadPdfOutput(
      {
        id: uid("pdf"),
        kind: "completion_report",
        label: "完了報告書",
        fileName: `完了報告書_${sanitizePdfFileName(siteTitle)}.pdf`,
        actor: getActor(state || mvp().reload()),
        generated_at: nowIso(),
        url: dataUrl,
        dataUrl,
        storagePath: null,
        meta: { invoicePdfId: invoicePdf?.id || null },
      },
      { project_id: project?.project_id || thread.project_id, thread_id: threadId, siteTitle, state }
    );
  }

  function getThreadPdfOutputs(threadId, state) {
    const tid = String(threadId || "").trim();
    if (!tid) return [];
    const pdfAdapter = global.TasuBuilderPdfAdapter;
    if (pdfAdapter?.listThreadPdfOutputs) {
      return pdfAdapter.listThreadPdfOutputs(tid, state);
    }
    const storage = global.TasuBuilderStorageAdapter;
    if (storage?.listFiles) {
      const indexed = storage.listFiles({ thread_id: tid, category: "pdf" });
      if (indexed.length) {
        return indexed.map((f) => ({
          id: f.file_id,
          project_id: f.project_id,
          thread_id: f.thread_id,
          kind: f.meta?.kind || "pdf",
          fileName: f.file_name,
          url: f.data_url,
          dataUrl: f.data_url,
          storagePath: f.storage_key,
        }));
      }
    }
    const st = state || mvp().reload();
    const thread = st.threads?.[tid];
    if (!thread) return [];
    const ctx = getThreadReportContext(tid, st);
    const siteTitle = ctx?.siteTitle || "";
    return (thread.pdf_outputs || []).map((x) =>
      normalizeThreadPdfOutput(x, {
        project_id: thread.project_id,
        thread_id: tid,
        siteTitle,
        state: st,
      })
    );
  }

  function getThreadReportPdfOutputs(threadId, state) {
    return getThreadPdfOutputs(threadId, state).filter((p) =>
      ["work_report", "completion_report"].includes(p.kind)
    );
  }

  function saveThreadPdfOutput(threadId, pdfOutput, state) {
    const pdfAdapter = global.TasuBuilderPdfAdapter;
    if (pdfAdapter?.saveThreadPdfOutput) {
      return pdfAdapter.saveThreadPdfOutput(threadId, pdfOutput, state, {
        normalizeThreadPdfOutput,
      })
        ? "adapter"
        : false;
    }
    const storage = global.TasuBuilderStorageAdapter;
    if (storage?.saveThreadPdfOutput) {
      storage.saveThreadPdfOutput(threadId, pdfOutput, state, {
        normalizeThreadPdfOutput,
      });
      return "adapter";
    }

    const tid = String(threadId || "").trim();
    if (!tid || !pdfOutput) return false;
    const st = state || mvp().reload();
    const thread = st.threads?.[tid];
    if (!thread) return false;
    const ctx = getThreadReportContext(tid, st);
    const normalized = normalizeThreadPdfOutput(pdfOutput, {
      project_id: thread.project_id,
      thread_id: tid,
      siteTitle: ctx?.siteTitle,
      state: st,
    });
    thread.pdf_outputs = [...(thread.pdf_outputs || []), normalized];
    return true;
  }

  function pushReportPdfNotification(threadId, type) {
    const ctx = getThreadReportContext(threadId);
    if (!ctx) return;
    const kindLabel = type === "work_report" ? "作業報告書" : "完了報告書";
    mvp().pushNotification({
      type,
      label: `${kindLabel}生成`,
      body: `${ctx.siteTitle}の${kindLabel}PDFが生成されました。`,
      project_id: ctx.project?.project_id || null,
      thread_id: threadId,
      href: mvpThreadHref(threadId),
    });
    dispatchMvpNotificationsChanged();
  }

  function openThreadPdfOutput(pdfOutput) {
    const url = pdfOutput?.dataUrl || pdfOutput?.url;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadThreadPdfOutput(pdfOutput) {
    const url = pdfOutput?.dataUrl || pdfOutput?.url;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfOutput?.fileName || `${pdfOutput?.label || "document"}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function findThreadPdfOutputById(threadId, pdfId, state) {
    return getThreadPdfOutputs(threadId, state).find((p) => p.id === pdfId) || null;
  }

  function renderReportPdfListItemHtml(pdf, threadId) {
    const when = pdf.generatedAt || pdf.generated_at;
    const whenLabel = when ? new Date(when).toLocaleString("ja-JP") : "—";
    return (
      `<li class="mvp-threadReports__item">` +
      `<div class="mvp-threadReports__itemMain">` +
      `<span class="mvp-threadReports__itemKind">${esc(pdf.label || PDF_KIND_LABELS[pdf.kind] || pdf.kind)}</span>` +
      `<span class="mvp-threadReports__itemName">${esc(pdf.fileName || "—")}</span>` +
      `<span class="mvp-threadReports__itemMeta">${esc(whenLabel)}</span>` +
      `</div>` +
      `<div class="mvp-threadReports__itemActions">` +
      `<button type="button" class="builder-btn builder-btn--ghost builder-btn--sm" data-thread-pdf-open="${esc(pdf.id)}" data-thread-pdf-thread="${esc(threadId)}">開く</button>` +
      `<button type="button" class="builder-btn builder-btn--secondary builder-btn--sm" data-thread-pdf-download="${esc(pdf.id)}" data-thread-pdf-thread="${esc(threadId)}">ダウンロード</button>` +
      `</div>` +
      `</li>`
    );
  }

  function renderReportPdfList(threadId, state) {
    const outputs = getThreadPdfOutputs(threadId, state);
    if (!outputs.length) {
      return `<p class="mvp-threadReports__empty">生成済みのPDFはまだありません。</p>`;
    }
    return (
      `<ul class="mvp-threadReports__list">` +
      outputs.map((pdf) => renderReportPdfListItemHtml(pdf, threadId)).join("") +
      `</ul>`
    );
  }

  function renderThreadReportsSection(threadId, state, options = {}) {
    const tid = String(threadId || "").trim();
    if (!tid) return "";
    const st = state || mvp().reload();
    const thread = st.threads?.[tid];
    if (!thread) return "";
    const outputs = getThreadPdfOutputs(tid, st);
    const omitWhenEmpty = Boolean(options.omitWhenEmpty);
    if (omitWhenEmpty && !outputs.length) return "";

    const siteData = normalizeMvpThreadSiteData(thread.siteData, {
      threadId: tid,
      projectId: thread.project_id,
      state: st,
    });
    const completed = siteData.completed || thread.status === "completed";
    const listHtml = renderReportPdfList(tid, st);
    const listSection = outputs.length
      ? `<div class="mvp-threadReports__listWrap">` +
        `<h3 class="mvp-threadReports__listTitle">生成済みPDF</h3>` +
        listHtml +
        `</div>`
      : "";
    return (
      `<section class="mvp-threadReports">` +
      `<div class="mvp-threadReports__head">` +
      `<h2 class="builder-section-title mvp-threadReports__title">報告書</h2>` +
      `<p class="mvp-threadReports__sub">現場写真・案件情報からPDFを生成します。</p>` +
      `</div>` +
      `<div class="mvp-threadReports__actions">` +
      `<button type="button" class="builder-btn builder-btn--secondary" data-thread-report-generate="work_report" data-thread-report-thread="${esc(tid)}">作業報告書PDF</button>` +
      `<button type="button" class="builder-btn builder-btn--primary" data-thread-report-generate="completion_report" data-thread-report-thread="${esc(tid)}"${completed ? "" : " disabled"}>完了報告書PDF</button>` +
      `</div>` +
      listSection +
      `</section>`
    );
  }

  function renderThreadPdfOutputsForCalendar(threadId, state, options = {}) {
    const tid = String(threadId || "").trim();
    if (!tid) return "";
    const kinds = options.kinds || ["work_report", "completion_report", "invoice"];
    const outputs = getThreadPdfOutputs(tid, state).filter((p) => kinds.includes(p.kind));
    if (!outputs.length) {
      return (
        `<section class="admin-cal-card__section mvp-threadReportsSection">` +
        `<h3>報告書・請求書PDF</h3>` +
        `<p class="admin-cal-detail__empty">生成済みの報告書・請求書PDFはまだありません。</p>` +
        `</section>`
      );
    }
    const rows = outputs
      .map((pdf) => {
        const kindLabel = PDF_KIND_LABELS[pdf.kind] || pdf.label || pdf.kind;
        return (
          `<li class="mvp-threadReports__item mvp-threadReports__item--cal">` +
          `<div class="mvp-threadReports__itemMain">` +
          `<span class="mvp-threadReports__itemKind">${esc(kindLabel)}</span>` +
          `<span class="mvp-threadReports__itemName">${esc(pdf.fileName || "—")}</span>` +
          `</div>` +
          `<div class="mvp-threadReports__itemActions">` +
          `<button type="button" class="builder-btn builder-btn--ghost builder-btn--sm" data-thread-pdf-open="${esc(pdf.id)}" data-thread-pdf-thread="${esc(tid)}">開く</button>` +
          `<button type="button" class="builder-btn builder-btn--secondary builder-btn--sm" data-thread-pdf-download="${esc(pdf.id)}" data-thread-pdf-thread="${esc(tid)}">ダウンロード</button>` +
          `</div>` +
          `</li>`
        );
      })
      .join("");
    return (
      `<section class="admin-cal-card__section mvp-threadReportsSection">` +
      `<h3>報告書・請求書PDF</h3>` +
      `<ul class="mvp-threadReports__list mvp-threadReports__list--cal">${rows}</ul>` +
      `</section>`
    );
  }

  function generateWorkReportPdf(threadId) {
    const tid = String(threadId || "").trim();
    if (!tid) return { ok: false, error: "thread_not_found" };
    const api = mvp();
    const next = api.reload();
    const output = buildWorkReportPdfOutput(tid, next);
    if (!output) return { ok: false, error: "thread_not_found" };
    const saved = saveThreadPdfOutput(tid, output, next);
    if (saved !== "adapter") api.commit(next);
    pushReportPdfNotification(tid, "work_report");
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    return { ok: true, pdfOutput: output };
  }

  function generateCompletionReportPdf(threadId) {
    const tid = String(threadId || "").trim();
    if (!tid) return { ok: false, error: "thread_not_found" };
    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const siteData = normalizeMvpThreadSiteData(thread?.siteData, {
      threadId: tid,
      projectId: thread?.project_id,
      state: next,
    });
    if (!siteData.completed && thread?.status !== "completed") {
      return { ok: false, error: "not_completed" };
    }
    const output = buildCompletionReportPdfOutput(tid, next);
    if (!output) return { ok: false, error: "build_failed" };
    const saved = saveThreadPdfOutput(tid, output, next);
    if (saved !== "adapter") api.commit(next);
    pushReportPdfNotification(tid, "completion_report");
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    return { ok: true, pdfOutput: output };
  }

  function generateInvoicePdf(projectId, partnerId, completedData = {}) {
    const state = mvp().reload();
    const project = (state.projects || []).find((p) => p.project_id === projectId);
    const spec = project ? getProjectSpec(state, projectId) : {};
    const budget = spec.budget || {};
    const amount = Number(completedData.amount ?? budget.max ?? budget.min ?? 0);
    const partnerName = partnerLabel(state, partnerId) || String(partnerId || "パートナー");
    const dateLabel = new Date().toLocaleDateString("ja-JP");
    const siteTitle = project?.title || projectId;
    const dataUrl = buildMvpPdfDataUrl({
      title: `請求書 ${siteTitle}`,
      kind: "invoice",
      projectTitle: `${siteTitle} / ${partnerName} / ${amount}円 / ${dateLabel}`,
      lines: [`amount: ${amount}円`, `partner: ${partnerName}`, `date: ${dateLabel}`],
    });
    return normalizeThreadPdfOutput(
      {
        id: uid("pdf"),
        kind: "invoice",
        label: "請求書PDF",
        fileName: `請求書_${sanitizePdfFileName(siteTitle)}.pdf`,
        actor: { id: state.owner_id || OWNER_ID, type: "owner", name: "TASFUL運営" },
        generated_at: nowIso(),
        url: dataUrl,
        dataUrl,
        storagePath: null,
        meta: { partnerId, partnerName, amount, date: dateLabel },
      },
      {
        project_id: String(projectId || ""),
        thread_id: String(completedData.threadId || project?.main_thread_id || ""),
        siteTitle,
        state,
      }
    );
  }

  function markMvpThreadCompleted(photos, consent, threadId) {
    if (!consent) return { ok: false, error: "consent_required" };
    const tid = String(threadId || getMvpThreadIdParam() || "").trim();
    if (!tid) return { ok: false, error: "thread_not_found" };

    const photoFiles = (Array.isArray(photos) ? photos : []).map((p) => ({
      name: p.name || p.fileName || "現場写真.jpg",
      type: p.type || "image",
      ts: nowIso(),
    }));

    return submitThreadCompletionReport(tid, {
      comment: "現場作業が完了しました。",
      photos: photoFiles,
      attachments: [],
      invoice: null,
    });
  }

  function mvpThreadActorTypesMatch(fromType, meType) {
    const f = String(fromType || "partner");
    const m = String(meType || "partner");
    if (f === "owner" && m === "owner") return true;
    if ((f === "user" || f === "builder") && (m === "user" || m === "builder")) return true;
    return f === m;
  }

  function mvpThreadActorsMatch(from, me) {
    if (!from || !me) return false;
    const fid = String(from.id || "").trim();
    const mid = String(me.id || "").trim();
    if (fid && mid && fid === mid) return mvpThreadActorTypesMatch(from.type, me.type);
    return mvpThreadActorTypesMatch(from.type, me.type) && from.type === "owner" && me.type === "owner";
  }

  function mvpThreadSide(from, me) {
    return mvpThreadActorsMatch(from, me) ? "right" : "left";
  }

  function mvpThreadRoleLabel(from) {
    const t = String(from?.type || "partner");
    if (t === "owner") return "運営";
    if (t === "user") return "利用者";
    if (t === "builder") return "Builder";
    return "協力会社";
  }

  function mvpThreadAvatarInitial(from) {
    const name = String(from?.name || "?").trim();
    return name.slice(0, 1) || "?";
  }

  function buildSlackThreadAttachmentHtml(attachments) {
    if (!attachments?.length) return "";
    return (
      `<ul class="mvp-slack-msg__attachments">` +
      attachments
        .map((a) => {
          const kind = a.type === "pdf" ? "pdf" : a.type === "image" ? "image" : "file";
          const label = kind === "pdf" ? "PDF" : kind === "image" ? "画像" : "FILE";
          return (
            `<li class="mvp-slack-msg__attachment mvp-slack-msg__attachment--${esc(kind)}">` +
            `<span class="mvp-slack-msg__attachmentType">${esc(label)}</span>` +
            `<span class="mvp-slack-msg__attachmentName">${esc(a.name || "—")}</span>` +
            `</li>`
          );
        })
        .join("") +
      `</ul>`
    );
  }

  function buildSlackThreadMessageHtml(m, me, unreadCount, idx, total, state) {
    const from = resolveMvpMessageFrom(m, state || {});
    const who = from?.name || "—";
    const side = m.system ? "system" : mvpThreadSide(from, me);
    const isUnread = !m.system && side === "left" && unreadCount > 0 && idx >= total - unreadCount;
    const roleLabel = mvpThreadRoleLabel(from);
    const initial = mvpThreadAvatarInitial(from);
    const timeStr = new Date(m.ts).toLocaleString();
    const attachHtml = buildSlackThreadAttachmentHtml(m.attachments || []);

    if (side === "system") {
      return (
        `<li class="mvp-slack-msg mvp-slack-msg--system">` +
        `<div class="mvp-slack-msg__systemWrap">` +
        `<p class="mvp-slack-msg__system">${esc(m.text || "")}</p>` +
        `<time class="mvp-slack-msg__systemTime" datetime="${esc(m.ts)}">${esc(timeStr)}</time>` +
        `</div>` +
        `</li>`
      );
    }

    const bubbleInner =
      `<div class="mvp-slack-msg__meta">` +
      `<span class="mvp-slack-msg__metaMain">` +
      `<strong class="mvp-slack-msg__name">${esc(who)}</strong>` +
      `<span class="mvp-slack-msg__role mvp-slack-msg__role--${esc(side)}">${esc(roleLabel)}</span>` +
      `</span>` +
      `<time class="mvp-slack-msg__time" datetime="${esc(m.ts)}">${esc(timeStr)}</time>` +
      `</div>` +
      (m.text ? `<p class="mvp-slack-msg__text">${esc(m.text)}</p>` : "") +
      attachHtml;

    const avatarClass =
      from.type === "partner"
        ? "mvp-slack-msg__avatar mvp-slack-msg__avatar--partner"
        : "mvp-slack-msg__avatar mvp-slack-msg__avatar--staff";

    return (
      `<li class="mvp-slack-msg mvp-slack-msg--${esc(side)}${isUnread ? " is-unread" : ""}">` +
      `<div class="mvp-slack-msg__row">` +
      (side === "left"
        ? `<span class="${avatarClass}" aria-hidden="true">${esc(initial)}</span>`
        : "") +
      `<div class="mvp-slack-msg__content">` +
      `<div class="mvp-slack-msg__bubble">${bubbleInner}</div>` +
      `</div>` +
      (side === "right"
        ? `<span class="${avatarClass}" aria-hidden="true">${esc(initial)}</span>`
        : "") +
      `</div>` +
      `</li>`
    );
  }

  function wireThreadPdfOutputActions() {
    if (threadPdfOutputActionsWired) return;
    threadPdfOutputActionsWired = true;

    document.addEventListener("click", (ev) => {
      const genBtn = ev.target?.closest?.("[data-thread-report-generate]");
      if (genBtn) {
        if (genBtn.disabled) return;
        const type = genBtn.getAttribute("data-thread-report-generate");
        const tid = genBtn.getAttribute("data-thread-report-thread") || getMvpThreadIdParam();
        if (type === "work_report") {
          const result = generateWorkReportPdf(tid);
          if (!result.ok) alert("作業報告書PDFの生成に失敗しました。");
          else if (document.body?.dataset?.page === "builder-mvp-thread") renderSlackStyleMvpThreadPage();
          else if (document.body?.dataset?.page === "builder-board-thread") renderBoardThreadPage();
          else document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
          return;
        }
        if (type === "completion_report") {
          const result = generateCompletionReportPdf(tid);
          if (!result.ok) {
            if (result.error === "not_completed") alert("完了報告書は作業完了後に生成できます。");
            else alert("完了報告書PDFの生成に失敗しました。");
            return;
          }
          if (document.body?.dataset?.page === "builder-mvp-thread") renderSlackStyleMvpThreadPage();
          else if (document.body?.dataset?.page === "builder-board-thread") renderBoardThreadPage();
          else document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
        }
        return;
      }

      const openBtn = ev.target?.closest?.("[data-thread-pdf-open]");
      if (openBtn) {
        const pdfId = openBtn.getAttribute("data-thread-pdf-open");
        const tid = openBtn.getAttribute("data-thread-pdf-thread");
        const pdf = findThreadPdfOutputById(tid, pdfId);
        if (pdf) openThreadPdfOutput(pdf);
        return;
      }

      const dlBtn = ev.target?.closest?.("[data-thread-pdf-download]");
      if (dlBtn) {
        const pdfId = dlBtn.getAttribute("data-thread-pdf-download");
        const tid = dlBtn.getAttribute("data-thread-pdf-thread");
        const pdf = findThreadPdfOutputById(tid, pdfId);
        if (pdf) downloadThreadPdfOutput(pdf);
      }
    });
  }

  function wireSlackStyleMvpThreadPage() {
    wireMvpThreadCompleteDelegation();
    wireThreadPdfOutputActions();
    wireMvpThreadCrossTabSync();
    if (mvpThreadPageWired) return;
    mvpThreadPageWired = true;

    const form = document.querySelector("[data-builder-mvp-thread-form]");
    const input = document.querySelector("[data-builder-mvp-thread-input]");
    const pendingHost = document.querySelector("[data-builder-mvp-thread-pending]");
    const imgInput = document.querySelector("[data-builder-mvp-thread-attach-image]");
    const pdfInput = document.querySelector("[data-builder-mvp-thread-attach-pdf]");
    const enterBtn = document.querySelector("[data-builder-mvp-thread-enter]");
    const leaveBtn = document.querySelector("[data-builder-mvp-thread-leave]");
    const completeBtn = document.querySelector("[data-builder-mvp-thread-complete-open]");
    const completeModal = document.querySelector("[data-builder-mvp-thread-complete-modal]");

    const renderPending = () => {
      if (!pendingHost) return;
      if (!mvpThreadComposePending.length) {
        pendingHost.hidden = true;
        pendingHost.innerHTML = "";
        return;
      }
      pendingHost.hidden = false;
      pendingHost.innerHTML =
        '<p class="mvp-thread-compose__pendingLabel">添付予定</p>' +
        mvpThreadComposePending
          .map(
            (a, i) =>
              `<span class="mvp-thread-compose__pendingItem">${esc(a.name)} <button type="button" class="mvp-thread-compose__pendingRemove" data-pending-index="${i}" aria-label="添付を削除">×</button></span>`
          )
          .join("");
    };

    const renderCompletePending = () => {
      const completePendingHost = completeModal?.querySelector("[data-builder-mvp-thread-complete-pending]");
      if (!completePendingHost) return;
      if (!mvpThreadCompletePendingPhotos.length) {
        completePendingHost.hidden = true;
        completePendingHost.innerHTML = "";
        return;
      }
      completePendingHost.hidden = false;
      completePendingHost.innerHTML = mvpThreadCompletePendingPhotos
        .map((p, i) => `<span class="mvp-thread-compose__pendingItem">${esc(p.name)} <button type="button" data-complete-photo-index="${i}">×</button></span>`)
        .join("");
    };

    const queueFile = (file, type, target) => {
      if (!file) return;
      const row = {
        id: uid("pending"),
        name: file.name || (type === "pdf" ? "document.pdf" : "image.jpg"),
        type,
        ts: nowIso(),
      };
      if (target === "complete") {
        mvpThreadCompletePendingPhotos.push(row);
        renderCompletePending();
      } else {
        mvpThreadComposePending.push(row);
        renderPending();
      }
    };

    imgInput?.addEventListener("change", () => {
      queueFile(imgInput.files?.[0], "image", "message");
      imgInput.value = "";
    });
    pdfInput?.addEventListener("change", () => {
      queueFile(pdfInput.files?.[0], "pdf", "message");
      pdfInput.value = "";
    });
    completeModal?.addEventListener("change", (ev) => {
      const input = ev.target?.closest?.("[data-builder-mvp-thread-complete-photos]");
      if (!input) return;
      Array.from(input.files || []).forEach((f) => queueFile(f, "image", "complete"));
      input.value = "";
    });

    pendingHost?.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-pending-index]");
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-pending-index"));
      if (!Number.isFinite(idx)) return;
      mvpThreadComposePending.splice(idx, 1);
      renderPending();
    });

    completeModal?.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-complete-photo-index]");
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-complete-photo-index"));
      if (!Number.isFinite(idx)) return;
      mvpThreadCompletePendingPhotos.splice(idx, 1);
      renderCompletePending();
    });

    const submitThreadMessage = () => {
      const text = String(input?.value || "").trim();
      const attachments = mvpThreadComposePending.slice();
      if (!sendMvpThreadMessage(text, attachments)) return;
      if (input) input.value = "";
      mvpThreadComposePending = [];
      renderPending();
      renderSlackStyleMvpThreadPage();
    };

    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      submitThreadMessage();
    });

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitThreadMessage();
      }
    });

    enterBtn?.addEventListener("click", () => {
      markMvpThreadEnterLeave("", "enter");
      renderSlackStyleMvpThreadPage();
    });
    leaveBtn?.addEventListener("click", () => {
      markMvpThreadEnterLeave("", "leave");
      renderSlackStyleMvpThreadPage();
    });

    completeBtn?.addEventListener("click", (ev) => {
      ev.preventDefault();
      openMvpThreadCompletionPanel();
    });
    completeModal?.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("[data-builder-mvp-thread-complete-close]") || ev.target === completeModal) {
        completeModal.hidden = true;
      }
    });
    completeModal?.addEventListener("submit", (ev) => {
      const form = ev.target?.closest?.("[data-builder-mvp-thread-complete-form]");
      if (!form || !completeModal.contains(form)) return;
      ev.preventDefault();
      const api = mvp();
      const state = api.reload();
      const tid = getMvpThreadIdParam();
      const thread = state.threads?.[tid];
      const project = (state.projects || []).find((p) => p.project_id === thread?.project_id);
      if (!threadCanSubmitCompletion(thread, project, state)) return;
      const consent = Boolean(form.querySelector("[data-builder-mvp-thread-complete-consent]")?.checked);
      const result = markMvpThreadCompleted(mvpThreadCompletePendingPhotos.slice(), consent, tid);
      if (!result.ok) {
        if (result.error === "consent_required") alert("作業完了に同意してください。");
        else if (result.error === "not_allowed") alert("完了報告の提出はパートナーのみ可能です。");
        else if (result.error === "already_completed") alert("この案件は既に完了しています。");
        else alert("完了処理に失敗しました。");
        return;
      }
      mvpThreadCompletePendingPhotos = [];
      renderCompletePending();
      if (completeModal) completeModal.hidden = true;
      const consentInput = form.querySelector("[data-builder-mvp-thread-complete-consent]");
      if (consentInput) consentInput.checked = false;
      alert("完了報告を提出しました。承認をお待ちください。");
      renderSlackStyleMvpThreadPage();
    });

    document.addEventListener("builder:mvp-changed", () => renderSlackStyleMvpThreadPage());
    document.addEventListener("builder:mvp-refresh", () => renderSlackStyleMvpThreadPage());
    document.addEventListener("builder:mvp-role-changed", () => renderSlackStyleMvpThreadPage());
    document.addEventListener("builder:mvp-partner-changed", () => renderSlackStyleMvpThreadPage());

    wireMvpSitePhotoModal();
    wireMvpThreadReviewModal();
  }

  function renderSlackStyleMvpThreadPage() {
    const api = mvp();
    ensureMvpThreadsDemoData(api);
    ensureMvpThreadDetailDemoData(api);
    wireSlackStyleMvpThreadPage();
    const threadId = getMvpThreadIdParam();
    ensureMvpThreadAuxUiBoot(threadId);
    if (ensureOwnerAutoJoinMvpThread(threadId)) return;
    ensureMvpThreadUrlParams();
    const state = api.reload();
    const thread = state.threads?.[threadId];

    const projectTitleEl = document.querySelector("[data-builder-mvp-thread-project-title]");
    const statusEl = document.querySelector("[data-builder-mvp-thread-status]");
    const unreadEl = document.querySelector("[data-builder-mvp-thread-unread]");
    const participantsEl = document.querySelector("[data-builder-mvp-thread-participants]");
    const updatedEl = document.querySelector("[data-builder-mvp-thread-updated]");
    const msgKpi = document.querySelector("[data-builder-mvp-thread-msg-kpi]");
    const msgList = document.querySelector("[data-builder-mvp-thread-msgs]");
    const enterBtn = document.querySelector("[data-builder-mvp-thread-enter]");
    const leaveBtn = document.querySelector("[data-builder-mvp-thread-leave]");
    const completeBtn = document.querySelector("[data-builder-mvp-thread-complete-open]");
    const cancelBtn = document.querySelector("[data-builder-mvp-thread-cancel]");
    const siteStatusEl = document.querySelector("[data-builder-mvp-thread-site-status]");
    const sitePhotosHost = document.querySelector("[data-builder-mvp-site-photos]");
    const reportsHost = document.querySelector("[data-builder-mvp-thread-reports]");
    const photosPanel = document.querySelector(".mvp-sitePhotosPanel");
    const reportsPanel = document.querySelector(".mvp-threadReportsPanel");
    const completionPanel = document.querySelector(".mvp-thread-completionPanel");
    const contextHost = document.querySelector("[data-builder-mvp-thread-context]");
    const headerSub = document.querySelector("[data-builder-mvp-thread-header-sub]");
    if (!projectTitleEl || !statusEl || !msgList) return;

    if (!thread) {
      projectTitleEl.textContent = "スレッドが見つかりません";
      statusEl.textContent = "—";
      statusEl.className = "mvp-pill mvp-pill--muted";
      if (unreadEl) unreadEl.hidden = true;
      if (participantsEl) participantsEl.textContent = "—";
      if (updatedEl) updatedEl.textContent = "—";
      if (msgKpi) msgKpi.textContent = "—";
      msgList.innerHTML = '<li class="mvp-slack-msg mvp-slack-msg--system"><p class="mvp-slack-msg__system">thread_id を指定してください。</p></li>';
      applyMvpThreadSiteEntryVisibility(enterBtn, leaveBtn, siteStatusEl, false, "");
      applyMvpThreadChatLockUi(false);
      return;
    }

    const projectEarly = (state.projects || []).find((p) => p.project_id === thread.project_id);
    const generalFlowCtx = resolveGeneralFlowBenchContext(projectEarly);
    const threadType = generalFlowCtx
      ? resolveGeneralFlowThreadType(projectEarly, thread)
      : normalizeBuilderThreadType(
          getBuilderThreadTypeParam() ||
            getThreadRowType(thread) ||
            projectEarly?.bench_thread_type ||
            ""
        ) || "";
    const typeCfg = getBuilderThreadTypeConfig(threadType);
    const role = getRole();
    document.body.dataset.builderThreadType = threadType;

    const backHref = isExcludedFromMvpThreads(threadType)
      ? boardThreadsHref()
      : mvpThreadsHref(normalizeBuilderThreadType(threadType) || threadType, role);
    const backQs = thread?.project_id ? `&project_id=${encodeURIComponent(thread.project_id)}` : "";
    setBuilderPageBack(`${backHref}${backQs}`, "やりとり一覧へ");

    const detailSub = getBuilderThreadDetailSub(threadType, role);
    if (headerSub) headerSub.textContent = detailSub;
    const pageHeaderSub = document.querySelector(".builder-header__sub");
    if (pageHeaderSub && !headerSub) pageHeaderSub.textContent = detailSub;

    const suppressAuxPanels = shouldSuppressMvpThreadAuxPanelAutoOpen();
    if (photosPanel) {
      photosPanel.hidden = suppressAuxPanels || !typeCfg.features.sitePhotos;
    }
    if (reportsPanel) reportsPanel.hidden = suppressAuxPanels || !typeCfg.features.reports;
    if (completionPanel) {
      completionPanel.hidden = suppressAuxPanels || !typeCfg.features.completion;
    }
    applyMvpThreadSiteEntryVisibility(
      enterBtn,
      leaveBtn,
      siteStatusEl,
      shouldShowMvpThreadSiteEntryActions(threadType, projectEarly),
      threadType
    );

    const unread = threadUnreadCountDemo(threadId);
    const project = projectEarly || (state.projects || []).find((p) => p.project_id === thread.project_id);
    if (contextHost) {
      contextHost.hidden = false;
      contextHost.innerHTML = renderBuilderThreadContextCard(thread, project, threadType);
    }
    const spec = project ? getProjectSpec(state, project.project_id) : null;
    const status = computeProjectStatus(state, project);
    const statusLabel = project ? toDetailStatusLabel({ project, spec, state, status }) : "—";
    const statusMod = detailStatusPillMod(statusLabel);
    const siteData = normalizeMvpThreadSiteData(thread.siteData, {
      threadId,
      projectId: thread.project_id,
      state,
    });

    projectTitleEl.textContent = project?.title || thread.project_id || "—";
    statusEl.textContent = statusLabel;
    statusEl.className = `mvp-pill mvp-pill--${statusMod}`;

    if (siteStatusEl) {
      const siteLabel =
        siteData.completed || thread.status === "completed"
          ? "現場: 完了"
          : thread.status === "in_progress"
            ? "現場: 作業中"
            : thread.status === "exited"
              ? "現場: 退場済"
              : "現場: 未入場";
      siteStatusEl.textContent = siteLabel;
    }

    if (sitePhotosHost) {
      const photos = siteData.photos;
      const showSitePhotoAdd =
        !suppressAuxPanels &&
        threadCanAddSitePhoto(thread, project, state) &&
        threadCompletionIsSubmitter(state, project);
      sitePhotosHost.innerHTML = renderSitePhotoHistoryHtml(photos, {
        threadId,
        showAddButton: showSitePhotoAdd,
        ctx: { threadId, projectId: thread.project_id, state },
      });
    }

    if (reportsHost) {
      reportsHost.innerHTML = renderThreadReportsSection(threadId, state);
    }

    const partnerThreadSurface = project && usesMvpPartnerThread(project);
    const generalBoardOnMvp =
      project && isBoardFeedItem(project) && !usesMvpPartnerThread(project);

    wireThreadCompletionFlow();
    const completionHost = document.querySelector("[data-builder-thread-completion-host]");
    if (completionHost) {
      if (partnerThreadSurface || !project) {
        completionHost.innerHTML = renderThreadCompletionHost(threadId, state);
      } else {
        completionHost.innerHTML = "";
      }
    }

    if (unreadEl) {
      unreadEl.hidden = false;
      unreadEl.textContent = unread > 0 ? `${unread} 未読` : "既読";
      unreadEl.className = unread > 0 ? "mvp-thread-summary__unread" : "mvp-thread-summary__unread mvp-thread-summary__unread--zero";
    }

    if (participantsEl) participantsEl.textContent = String(threadParticipantCount(state, thread, project));

    const updatedTs = threadLastActivityTs(thread);
    if (updatedEl) {
      updatedEl.textContent = updatedTs ? new Date(updatedTs).toLocaleString() : "—";
      updatedEl.setAttribute("datetime", updatedTs || "");
    }

    const sub = normalizeThreadCompletionSubmission(thread);
    const chatLocked = isMvpThreadChatLocked(thread, project, state);
    const canSubmitCompletion = threadCanSubmitCompletion(thread, project, state);
    const canReviewCompletion = threadCanReviewCompletion(thread, project, state);
    const isCompletionReviewer = threadCompletionIsReviewer(state, project);
    const isCompletionSubmitter = threadCompletionIsSubmitter(state, project);
    const completed =
      siteData.completed || thread.status === "completed" || sub?.status === "approved";
    const threadClosed = completed || thread.status === "cancelled";
    applyMvpThreadChatLockUi(chatLocked);
    if (chatLocked) {
      [enterBtn, leaveBtn].forEach((btn) => {
        if (!btn) return;
        btn.hidden = true;
        btn.disabled = true;
      });
    } else {
      if (enterBtn) enterBtn.disabled = threadClosed;
      if (leaveBtn) leaveBtn.disabled = threadClosed;
    }
    if (cancelBtn) {
      cancelBtn.hidden = !generalFlowCtx || threadClosed || chatLocked;
      if (!cancelBtn.hidden && cancelBtn.dataset.generalFlowCancelWired !== "1") {
        cancelBtn.dataset.generalFlowCancelWired = "1";
        cancelBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          const tid = getMvpThreadIdParam();
          if (!tid) return;
          if (!global.confirm?.("やりとりをキャンセルしますか？")) return;
          const result = cancelGeneralFlowThread(tid);
          if (!result?.ok) {
            alert("キャンセルに失敗しました。");
            return;
          }
          renderSlackStyleMvpThreadPage();
        });
      }
    }
    if (chatLocked) {
      closeMvpThreadCompletionModal();
    } else {
      syncMvpThreadCompletionModal(threadId, state);
    }
    if (completeBtn) {
      const showCompletionFeature = typeCfg.features.completion || generalBoardOnMvp;
      let showCompleteBtn = showCompletionFeature;
      let completeBtnLabel = "完了報告";
      let completeBtnDisabled = completed;

      if (isCompletionSubmitter) {
        completeBtnLabel = "完了報告";
        showCompleteBtn = showCompletionFeature && (canSubmitCompletion || sub?.status === "rejected");
        completeBtnDisabled = completed || !canSubmitCompletion;
      } else if (isCompletionReviewer) {
        completeBtnLabel = "完了報告を確認";
        showCompleteBtn = showCompletionFeature && canReviewCompletion;
        completeBtnDisabled = completed || !canReviewCompletion;
      } else {
        showCompleteBtn = false;
      }

      completeBtn.hidden = chatLocked || !showCompleteBtn;
      completeBtn.disabled = completeBtnDisabled;
      completeBtn.textContent = completeBtnLabel;
      if (completeBtn.dataset.completionWired !== "1") {
        completeBtn.dataset.completionWired = "1";
        completeBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          openMvpThreadCompletionPanel();
        });
      }
    }

    const me = getActor(state);
    const msgs = (thread.messages || []).slice().sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    if (msgKpi) msgKpi.textContent = `${msgs.length} 件`;
    const completionChatCard = renderOpsPartnerThreadCompletionChatCard(threadId, thread, project, state);
    const reviewChatCard = renderMvpThreadReviewChatCard(threadId, thread, project, state);
    const msgItems = msgs.map((m, idx) => buildSlackThreadMessageHtml(m, me, unread, idx, msgs.length, state)).join("");
    msgList.innerHTML =
      (msgItems || '<li class="mvp-slack-msg mvp-slack-msg--system"><p class="mvp-slack-msg__system">メッセージはまだありません。</p></li>') +
      completionChatCard +
      reviewChatCard;
    scrollMvpThreadTimelineEnd(msgList);

    if (Object.prototype.hasOwnProperty.call(DEMO_THREAD_UNREAD, threadId)) {
      DEMO_THREAD_UNREAD[threadId] = 0;
    }

    const next = api.reload();
    const t = next.threads?.[threadId];
    if (t?.messages?.length && t.messages.some((m) => !m.read)) {
      t.messages = t.messages.map((m) => ({ ...m, read: true }));
      api.commit(next);
    }

    ensureMvpThreadUrlParams();
    syncMvpThreadAuxModalsClosedUnlessUserOpen();
    bootMvpThreadReviewFromUrl(threadId, state);
  }

  function renderMvpThreadPage() {
    renderSlackStyleMvpThreadPage();
  }

  function wireMvpThreadPage() {
    wireSlackStyleMvpThreadPage();
  }

  function renderMvpTalkPage() {
    const api = mvp();
    const state = api.reload();
    const threadId = getParam("thread_id") || "";
    const thread = state.threads?.[threadId];
    const list = document.querySelector("[data-builder-mvp-chat-list]");
    const form = document.querySelector("[data-builder-mvp-chat-form]");
    const input = document.querySelector("[data-builder-mvp-chat-input]");
    const kpi = document.querySelector("[data-builder-mvp-talk-kpi]");
    const sub = document.querySelector("[data-builder-mvp-talk-sub]");
    if (!list || !form || !input || !kpi || !sub) return;
    if (!thread) {
      kpi.textContent = "—";
      sub.textContent = "スレッドが見つかりません";
      return;
    }
    const project = (state.projects || []).find((p) => p.project_id === thread.project_id);
    sub.textContent = project?.title || "—";
    kpi.textContent = `thread_id: ${threadId}`;
    setBuilderPageBack(mvpThreadHref(threadId), "スレッド詳細へ");

    const role = getRole();
    const me = getActor(state);
    const render = () => {
      const next = api.reload();
      const t = next.threads?.[threadId];
      const msgs = (t?.messages || []).slice();
      list.innerHTML = msgs
        .map((m) => {
          const from = m.from || { id: "actor-unknown", type: "partner", name: "不明" };
          const who = from?.name || "—";
          const mine = from?.id === me.id && from?.type === me.type ? " builder-chat__item--me" : "";
          return (
            `<li class="builder-chat__item${mine}">` +
            `<div class="builder-chat__meta"><span>${actorBadgeHtml(from)} ${esc(who)}</span><span>${esc(
              new Date(m.ts).toLocaleString()
            )}</span></div>` +
            `<div class="builder-chat__text">${esc(m.text)}</div>` +
            `</li>`
          );
        })
        .join("");
      list.scrollTop = list.scrollHeight;
    };
    render();

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const text = String(input.value || "").trim();
      if (!text) return;
      const next = api.reload();
      const actor = getActor(next);
      next.threads[threadId].messages.push({ msg_id: uid("msg"), from: actor, ts: nowIso(), text });
      next.threads[threadId].events.push({ type: "message", actor, ts: nowIso(), text: `Talk: ${text}` });
      api.commit(next);
      api.pushNotification({
        type: "message",
        body: `${project?.title || ""} にメッセージが届きました。`,
        project_id: project?.project_id || null,
        thread_id: threadId,
      });
      input.value = "";
      render();
    });

    document.addEventListener("builder:mvp-changed", render);
  }

  let mvpNotificationsPageWired = false;

  function wireMvpNotificationsPage() {
    if (mvpNotificationsPageWired) return;
    mvpNotificationsPageWired = true;

    document.querySelector("[data-builder-mvp-notif-mark-all]")?.addEventListener("click", () => {
      markAllMvpNotificationsRead();
      renderMvpNotificationsPage();
    });

    document.querySelector("[data-builder-mvp-notif-list]")?.addEventListener("click", (ev) => {
      const card = ev.target?.closest?.("[data-notification-id]");
      if (!card) return;
      ev.preventDefault();
      const id = card.getAttribute("data-notification-id");
      const href = card.getAttribute("href") || "index.html";
      const notifType = card.getAttribute("data-notification-type") || "";
      markMvpNotificationRead(id);
      if (notifType === "request_declined" || href === "#") return;
      if (window.TasuBuilderBenchEmbed?.followNotification?.(href, id, { type: notifType })) return;
      window.location.href = href;
    });
  }

  function renderMvpNotificationsPage() {
    mvp().reload();
    ensureMvpNotificationsDemoData();
    wireMvpNotificationsPage();
    const role = getRole();
    const dashBack =
      role === "user"
        ? { href: "user-dashboard.html", label: "一般ダッシュボードへ" }
        : { href: "index.html", label: "Builderダッシュボードへ" };
    setBuilderPageBack(dashBack.href, dashBack.label);
    document.querySelector(".builder-brand[href]")?.setAttribute("href", dashBack.href);

    const list = document.querySelector("[data-builder-mvp-notif-list]");
    const kpi = document.querySelector("[data-builder-mvp-notif-kpi]");
    const unreadKpi = document.querySelector("[data-builder-mvp-notif-unread-kpi]");
    if (!list) return;

    const rows = getMvpNotificationsForCurrentUser()
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const unread = rows.filter((n) => !n.read).length;

    if (kpi) kpi.textContent = `${rows.length} 件`;
    if (unreadKpi) unreadKpi.textContent = `${unread} 件未読`;

    if (!rows.length) {
      list.innerHTML =
        `<li class="builder-notification-card builder-notification-card--empty">` +
        `<p class="builder-notification-card__body">通知はありません</p></li>`;
      return;
    }

    list.innerHTML = rows
      .map((n) => {
        const readBadge = n.read
          ? `<span class="builder-notification-read-badge builder-notification-read-badge--read">既読</span>`
          : `<span class="builder-notification-read-badge builder-notification-read-badge--unread">未読</span>`;
        const typeMod = esc(String(n.type || "admin").replace(/[^a-z0-9_-]/gi, ""));
        const when = n.createdAt ? new Date(n.createdAt).toLocaleString() : "—";
        const attachHtml = n.attachments?.length
          ? `<p class="builder-notification-card__attachments">添付: ${esc(n.attachments.map((f) => f.name).filter(Boolean).join(" · "))}</p>`
          : "";
        return (
          `<li>` +
          `<a class="builder-notification-card${n.read ? "" : " is-unread"}" href="${esc(n.href || "index.html")}" data-notification-id="${esc(n.id)}" data-notification-type="${esc(n.type || "")}">` +
          `<div class="builder-notification-card__head">` +
          `<span class="builder-notification-type builder-notification-type--${typeMod}">${esc(n.label || "通知")}</span>` +
          readBadge +
          `</div>` +
          `<p class="builder-notification-card__project">${esc(n.projectTitle || "—")}</p>` +
          `<p class="builder-notification-card__body">${esc(n.body || "")}</p>` +
          attachHtml +
          `<div class="builder-notification-meta">` +
          `<time datetime="${esc(n.createdAt || "")}">${esc(when)}</time>` +
          `</div>` +
          `</a>` +
          `</li>`
        );
      })
      .join("");
  }

  function threadLastActivityTs(thread) {
    const msgTs = (thread.messages || []).slice(-1)[0]?.ts;
    const eventTs = (thread.events || []).slice(-1)[0]?.ts;
    return String(msgTs || eventTs || "");
  }

  const DEMO_THREAD_UNREAD = {
    "thread-demo-001": 2,
    "thread-demo-002": 2,
    "thread-demo-003": 5,
    "thread-demo-004": 3,
    "thread-demo-005": 1,
    "thread-demo-006": 0,
    "thread-demo-007": 1,
    "thread-demo-008": 2,
  };

  function threadUnreadCountDemo(threadId) {
    if (Object.prototype.hasOwnProperty.call(DEMO_THREAD_UNREAD, threadId)) {
      return DEMO_THREAD_UNREAD[threadId];
    }
    return 0;
  }

  function threadParticipantCount(state, thread, project) {
    const ids = new Set();
    if (state?.owner_id || OWNER_ID) ids.add(state?.owner_id || OWNER_ID);
    (thread?.messages || []).forEach((m) => {
      if (m?.from?.id) ids.add(m.from.id);
    });
    (thread?.events || []).forEach((e) => {
      if (e?.actor?.id) ids.add(e.actor.id);
    });
    if (project?.project_id) {
      (state.applications || [])
        .filter((a) => a.project_id === project.project_id)
        .forEach((a) => ids.add(a.partner_id));
    }
    return Math.max(ids.size, 1);
  }

  function ensureBuilderThreadMeta(api) {
    const next = api.reload();
    let changed = false;
    const threadPatches = {
      "thread-demo-001": {
        thread_type: "ops_partner",
        counterpart_name: "TASFUL運営",
        list_title: "現場指示について",
      },
      "thread-demo-002": { thread_type: "partner_user", counterpart_name: "佐藤建設" },
      "thread-demo-003": { thread_type: "general_project", counterpart_name: "株式会社オレンジ建装" },
      "thread-demo-004": {
        thread_type: "partner_user",
        counterpart_name: "田中 花子",
        list_title: "倉庫内装の相談",
      },
      "thread-demo-005": {
        thread_type: "partner_user",
        counterpart_name: "山田 太郎",
        list_title: "キッチンリフォーム相談",
      },
      "thread-demo-007": {
        thread_type: "user_user",
        counterpart_name: "鈴木 美咲",
        list_title: "外壁塗装の仲介相談",
      },
      "thread-demo-008": {
        thread_type: "vendor_user",
        counterpart_name: "港区設備サービス",
        list_title: "設備修理の見積",
      },
      "thread-demo-006": {
        thread_type: "general_project",
        counterpart_name: "山田 太郎",
        list_title: "共同住宅 外装改修",
      },
    };
    Object.entries(threadPatches).forEach(([tid, patch]) => {
      const t = next.threads?.[tid];
      if (!t) return;
      Object.entries(patch).forEach(([k, v]) => {
        if (t[k] !== v) {
          t[k] = v;
          changed = true;
        }
      });
    });
    const projectTitlePatches = {
      "demo-thread-list-002": "世田谷区 キッチンリフォーム 相談",
    };
    (next.projects || []).forEach((p) => {
      const title = projectTitlePatches[p.project_id];
      if (title && p.title !== title) {
        p.title = title;
        changed = true;
      }
    });
    if (changed) api.commit(next);
  }

  function ensureBuilderThreadTypedDemoMessages(api) {
    const next = api.reload();
    let changed = false;
    const enrichTyped = (threadId, extras) => {
      const t = next.threads?.[threadId];
      if (!t || t.demo_typed_messages_v1) return;
      changed = true;
      t.demo_typed_messages_v1 = true;
      t.messages = [...(extras.messages || []), ...(t.messages || [])];
      if (extras.shared_attachments?.length) {
        t.shared_attachments = [...(t.shared_attachments || []), ...extras.shared_attachments];
      }
    };

    enrichTyped("thread-demo-001", {
      messages: [
        {
          msg_id: "msg-demo-ops-site",
          from: { id: OWNER_ID, type: "owner", name: "TASFUL運営" },
          ts: "2026-05-25T01:30:00.000Z",
          text: "【現場指示】6/18 新宿スクエアビル。8:45集合、安全帯・ヘルメット必須。駐車場はB2機械式（台数2）。",
          attachments: [
            { id: "att-site-inst", name: "指示書_0618.pdf", type: "pdf", ts: "2026-05-25T01:30:00.000Z" },
            { id: "att-parking", name: "駐車場案内.pdf", type: "pdf", ts: "2026-05-25T01:30:00.000Z" },
          ],
        },
        {
          msg_id: "msg-demo-ops-reply",
          from: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
          ts: "2026-05-25T02:10:00.000Z",
          text: "承知しました。8:45に現場入りします。指示書・駐車場案内を確認済みです。",
        },
      ],
    });

    enrichTyped("thread-demo-002", {
      messages: [
        {
          msg_id: "msg-demo-user-consult",
          from: { id: "demo-builder-user", type: "builder", name: "田中 花子" },
          ts: "2026-05-28T10:00:00.000Z",
          text: "キッチンリフォームの相談です。見積の概算と日程候補を教えてください。",
        },
        {
          msg_id: "msg-demo-partner-estimate",
          from: { id: "demo-partner-002", type: "partner", name: "佐藤建設" },
          ts: "2026-05-29T14:30:00.000Z",
          text: "概算見積と日程候補をお送りします。6/12・6/19のいずれかで現地調査が可能です。",
          attachments: [
            { id: "att-estimate", name: "概算見積_キッチン.pdf", type: "pdf", ts: "2026-05-29T14:30:00.000Z" },
          ],
        },
      ],
    });

    enrichTyped("thread-demo-004", {
      messages: [
        {
          msg_id: "msg-demo-partner-user-request",
          from: { id: "demo-builder-user", type: "builder", name: "田中 花子" },
          ts: "2026-05-27T09:00:00.000Z",
          text: "大田区倉庫内装の相談です。6/20までに下地工事の見積をお願いします。",
        },
        {
          msg_id: "msg-demo-partner-user-reply",
          from: { id: "demo-partner-001", type: "partner", name: "関東外装パートナーズ" },
          ts: "2026-05-28T11:00:00.000Z",
          text: "ご依頼ありがとうございます。現地確認後、正式見積を共有します。",
        },
        {
          msg_id: "msg-demo-partner-user-photo",
          from: { id: "demo-partner-001", type: "partner", name: "関東外装パートナーズ" },
          ts: "2026-06-02T17:30:00.000Z",
          text: "現地確認の写真を共有します。ご確認ください。",
          attachments: [
            { id: "att-worker-photo", name: "現地確認_倉庫.jpg", type: "image", ts: "2026-06-02T17:30:00.000Z" },
          ],
        },
      ],
    });

    enrichTyped("thread-demo-005", {
      messages: [
        {
          msg_id: "msg-demo-user-partner-ask",
          from: { id: "demo-builder-user", type: "builder", name: "山田 太郎" },
          ts: "2026-06-01T10:00:00.000Z",
          text: "キッチンリフォームの相談です。見積と日程候補を教えてください。",
        },
        {
          msg_id: "msg-demo-user-partner-reply",
          from: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
          ts: "2026-06-01T15:30:00.000Z",
          text: "ご相談ありがとうございます。6/12か6/19に現地確認が可能です。概算見積も共有します。",
          attachments: [
            { id: "att-user-partner-est", name: "概算見積_キッチン.pdf", type: "pdf", ts: "2026-06-01T15:30:00.000Z" },
          ],
        },
      ],
    });

    enrichTyped("thread-demo-006", {
      messages: [
        {
          msg_id: "msg-demo-project-partner",
          from: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
          ts: "2026-05-26T09:00:00.000Z",
          text: "共同住宅外装改修の案件に応募しました。条件確認のうえご検討ください。",
        },
        {
          msg_id: "msg-demo-project-user",
          from: { id: "demo-builder-user", type: "builder", name: "山田 太郎" },
          ts: "2026-05-27T11:20:00.000Z",
          text: "選定が決まりました。スケジュールと作業範囲を共有します。",
        },
      ],
    });

    enrichTyped("thread-demo-007", {
      messages: [
        {
          msg_id: "msg-demo-user-user-ask",
          from: { id: "demo-user-peer-001", type: "builder", name: "鈴木 美咲" },
          ts: "2026-06-02T10:00:00.000Z",
          text: "外壁塗装の業者紹介をお願いします。横浜市の物件です。",
        },
        {
          msg_id: "msg-demo-user-user-reply",
          from: { id: "demo-builder-user", type: "builder", name: "田中 花子" },
          ts: "2026-06-02T16:20:00.000Z",
          text: "以前お世話になった塗装業者をご紹介します。連絡先を共有しますね。",
        },
      ],
    });

    enrichTyped("thread-demo-008", {
      messages: [
        {
          msg_id: "msg-demo-vendor-user-ask",
          from: { id: "demo-builder-user", type: "builder", name: "田中 花子" },
          ts: "2026-06-01T09:30:00.000Z",
          text: "港区マンションの設備修理見積をお願いします。",
        },
        {
          msg_id: "msg-demo-vendor-user-reply",
          from: { id: "demo-vendor-001", type: "vendor", name: "港区設備サービス" },
          ts: "2026-06-01T14:00:00.000Z",
          text: "現地確認のうえ見積をお送りします。6/8午前が可能です。",
          attachments: [
            { id: "att-vendor-est", name: "設備修理見積.pdf", type: "pdf", ts: "2026-06-01T14:00:00.000Z" },
          ],
        },
      ],
    });

    if (changed) api.commit(next);
  }

  function migrateBuilderThreadTypes(api) {
    const next = api.reload();
    let changed = false;
    Object.values(next.threads || {}).forEach((t) => {
      const raw = String(t?.thread_type || t?.threadType || "").trim();
      if (!raw) return;
      const canonical = resolveBuilderThreadTypeCanonical(raw);
      if (canonical && canonical !== raw && BUILDER_ACTIVE_THREAD_TYPES.has(canonical)) {
        t.thread_type = canonical;
        changed = true;
      }
    });
    if (changed) api.commit(next);
  }

  function ensureMvpThreadsDemoData(api) {
    if (isOpsBenchSession() && !isAdminCalOpsBenchEmbed()) return;
    ensureBuilderThreadMeta(api);
    migrateBuilderThreadTypes(api);
    const state = api.reload();
    const need = [
      {
        thread_type: "partner_user",
        project_id: "demo-thread-list-002",
        thread_id: "thread-demo-002",
        title: "世田谷区 キッチンリフォーム 相談",
        area: { label: "東京都世田谷区" },
        period: { start: "2026-06-12", end: "2026-07-20" },
        unread: 2,
        participants: 2,
        lastMessage: "概算見積と日程候補をお送りします。",
        lastFrom: "佐藤建設",
        lastTs: "2026-05-29T14:30:00.000Z",
        counterpart_name: "佐藤建設",
      },
      {
        thread_type: "general_project",
        project_id: "demo-thread-list-003",
        thread_id: "thread-demo-003",
        title: "千葉市 倉庫新築 見積精査",
        area: { label: "千葉県千葉市" },
        period: { start: "2026-06-01", end: "2026-07-15" },
        unread: 5,
        participants: 4,
        lastMessage: "見積書の差分について確認させてください。",
        lastFrom: "株式会社オレンジ建装",
        lastTs: "2026-05-31T14:45:00.000Z",
        counterpart_name: "株式会社オレンジ建装",
      },
      {
        thread_type: "partner_user",
        project_id: "demo-thread-list-004",
        thread_id: "thread-demo-004",
        title: "大田区 倉庫内装 相談",
        area: { label: "東京都大田区" },
        period: { start: "2026-06-05", end: "2026-06-20" },
        unread: 3,
        participants: 2,
        lastMessage: "現地確認の写真を共有します。ご確認ください。",
        lastFrom: "関東外装パートナーズ",
        lastTs: "2026-06-02T17:30:00.000Z",
        counterpart_name: "田中 花子",
        list_title: "倉庫内装の相談",
      },
      {
        thread_type: "partner_user",
        project_id: "demo-thread-list-005",
        thread_id: "thread-demo-005",
        title: "世田谷区 キッチンリフォーム",
        area: { label: "東京都世田谷区" },
        period: { start: "2026-06-12", end: "2026-07-25" },
        unread: 1,
        participants: 2,
        lastMessage: "6/12か6/19に現地確認が可能です。",
        lastFrom: "株式会社オレンジ建装",
        lastTs: "2026-06-01T15:30:00.000Z",
        counterpart_name: "山田 太郎",
        list_title: "キッチンリフォーム相談",
      },
      {
        thread_type: "general_project",
        project_id: "demo-project-001",
        thread_id: "thread-demo-006",
        title: "新宿区 共同住宅 外装改修",
        area: { label: "東京都新宿区" },
        period: { start: "2026-06-01", end: "2026-08-31" },
        unread: 0,
        participants: 3,
        lastMessage: "選定が決まりました。スケジュールと作業範囲を共有します。",
        lastFrom: "山田 太郎",
        lastTs: "2026-05-27T11:20:00.000Z",
        counterpart_name: "山田 太郎",
        list_title: "共同住宅 外装改修",
      },
      {
        thread_type: "user_user",
        project_id: "demo-thread-list-007",
        thread_id: "thread-demo-007",
        title: "横浜市 外壁塗装 仲介相談",
        area: { label: "神奈川県横浜市" },
        period: { start: "2026-06-10", end: "2026-07-10" },
        unread: 1,
        participants: 2,
        lastMessage: "以前お世話になった塗装業者をご紹介します。",
        lastFrom: "田中 花子",
        lastTs: "2026-06-02T16:20:00.000Z",
        counterpart_name: "鈴木 美咲",
        list_title: "外壁塗装の仲介相談",
      },
      {
        thread_type: "vendor_user",
        project_id: "demo-thread-list-008",
        thread_id: "thread-demo-008",
        title: "港区 設備修理 業者見積",
        area: { label: "東京都港区" },
        period: { start: "2026-06-08", end: "2026-06-25" },
        unread: 1,
        participants: 2,
        lastMessage: "現地確認のうえ見積をお送りします。",
        lastFrom: "港区設備サービス",
        lastTs: "2026-06-01T14:00:00.000Z",
        counterpart_name: "港区設備サービス",
        list_title: "設備修理の見積",
      },
    ];

    let changed = false;
    const next = api.reload();
    for (const row of need) {
      if (next.threads?.[row.thread_id]) continue;
      changed = true;
      const hasProject = (next.projects || []).some((p) => p.project_id === row.project_id);
      if (!hasProject) {
        next.projects = [
          ...(next.projects || []),
          {
            project_id: row.project_id,
            owner_id: next.owner_id || OWNER_ID,
            title: row.title,
            kind: "builder_board",
            status: "open",
            required_partners: 2,
            selected_partner_ids: [],
            visibility: "partner_only",
            contact_policy: "tasful_talk_only",
            main_thread_id: row.thread_id,
            source: "builder_board",
            source_template_id: null,
            created_at: row.lastTs,
          },
        ];
        next.specs = {
          ...(next.specs || {}),
          [row.project_id]: {
            area: row.area,
            period: row.period,
            trade_tags: ["interior"],
            description: row.title,
          },
        };
      }
      next.threads = {
        ...(next.threads || {}),
        [row.thread_id]: {
          thread_id: row.thread_id,
          thread_type: row.thread_type,
          counterpart_name: row.counterpart_name || "",
          list_title: row.list_title || "",
          project_id: row.project_id,
          events: [
            {
              type: "created",
              actor: { id: OWNER_ID, type: "owner", name: "TASFUL運営" },
              ts: row.lastTs,
              text: "案件スレッドを開始しました（demo）",
            },
          ],
          messages: [
            {
              msg_id: uid("msg"),
              from: { id: row.lastFrom === "TASFUL運営" ? OWNER_ID : "demo-partner-001", type: row.lastFrom === "TASFUL運営" ? "owner" : "partner", name: row.lastFrom },
              ts: row.lastTs,
              text: row.lastMessage,
            },
          ],
          photos: [],
          completion: null,
        },
      };
      DEMO_THREAD_UNREAD[row.thread_id] = row.unread;
    }
    if (changed) api.commit(next);
    ensureBuilderThreadTypedDemoMessages(api);
  }

  function renderMvpThreadsPage() {
    const api = mvp();
    ensureMvpThreadsDemoData(api);
    const state = api.reload();
    const list = document.querySelector("[data-builder-mvp-thread-list]");
    const kpi = document.querySelector("[data-builder-mvp-thread-kpi]");
    if (!list || !kpi) return;

    const role = getRole();
    const pageThreadType = getBuilderThreadTypeParam();
    const titleEl = document.querySelector("[data-builder-mvp-threads-title]");
    const subEl = document.querySelector("[data-builder-mvp-threads-sub]");
    if (titleEl) titleEl.textContent = getMvpThreadsPageTitle(role, pageThreadType);
    if (subEl) subEl.textContent = getMvpThreadsPageSub(role, pageThreadType);
    document.body.dataset.builderThreadType = pageThreadType || "all";
    document.title = `${titleEl?.textContent || "やりとり"} | Builder MVP`;
    renderMvpThreadsTypeFilter(role);

    const dashBack =
      role === "user"
        ? { href: "user-dashboard.html", label: "一般ダッシュボードへ" }
        : role === "vendor"
          ? { href: "user-dashboard.html", label: "業者ダッシュボードへ" }
          : { href: "index.html", label: "Builderダッシュボードへ" };
    const pageBack = document.querySelector("[data-builder-page-back]");
    if (pageBack) {
      pageBack.setAttribute("href", dashBack.href);
      pageBack.textContent = `‹ ${dashBack.label}`;
    }
    document.querySelector(".builder-brand[href]")?.setAttribute("href", dashBack.href);

    const highlightProjectId = getParam("project_id") || "";
    let rows = Object.values(state.threads || {})
      .slice()
      .sort((a, b) => threadLastActivityTs(b).localeCompare(threadLastActivityTs(a)));
    rows = filterThreadsForViewerRole(rows, role);
    if (pageThreadType) {
      rows = rows.filter((t) => getThreadRowType(t) === pageThreadType);
    }

    kpi.textContent = `${rows.length} 件`;
    if (!rows.length) {
      list.innerHTML =
        `<li class="mvp-thread-card mvp-thread-card--empty">` +
        `<p class="mvp-thread-card__title">やりとりがありません</p>` +
        `<p class="mvp-thread-card__preview">${
          pageThreadType ? "該当するやりとりはまだありません。" : "案件や相談が始まると、ここに表示されます。"
        }</p></li>`;
      return;
    }

    list.innerHTML = rows
      .map((t) => {
        const rowType = getThreadRowType(t);
        const p = (state.projects || []).find((x) => x.project_id === t.project_id);
        const title = getThreadListCardTitle(t, p);
        const counterpart = t.counterpart_name || t.counterpartName || "";
        const lastMsg = (t.messages || []).slice(-1)[0];
        const lastEvent = (t.events || []).slice(-1)[0];
        const preview = lastMsg?.text || lastEvent?.text || "—";
        const ts = threadLastActivityTs(t);
        const when = ts ? new Date(ts).toLocaleString() : "—";
        const unread = threadUnreadCountDemo(t.thread_id);
        const participants = threadParticipantCount(state, t, p);
        const href = mvpThreadHref(t.thread_id, role, rowType);
        const isHighlight = highlightProjectId && p?.project_id === highlightProjectId;
        const unreadHtml =
          unread > 0
            ? `<span class="mvp-thread-card__unread">${esc(String(unread))} 未読</span>`
            : `<span class="mvp-thread-card__unread mvp-thread-card__unread--zero">既読</span>`;
        const typeBadge = pageThreadType ? "" : renderBuilderThreadTypeBadge(rowType);
        const counterpartHtml = counterpart
          ? `<p class="mvp-thread-card__counterpart">${esc(counterpart)}</p>`
          : "";
        return (
          `<li>` +
          `<a class="mvp-thread-card${isHighlight ? " is-highlight" : ""}" href="${esc(href)}" data-thread-id="${esc(t.thread_id)}" data-thread-type="${esc(rowType)}">` +
          `<div class="mvp-thread-card__head">` +
          `<h3 class="mvp-thread-card__title">${esc(title)}</h3>` +
          `${typeBadge}${unreadHtml}` +
          `</div>` +
          counterpartHtml +
          `<p class="mvp-thread-card__preview">${esc(preview)}</p>` +
          `<div class="mvp-thread-card__foot">` +
          `<span class="mvp-thread-card__stat"><span class="mvp-thread-card__statLabel">参加者</span> ${esc(String(participants))}</span>` +
          `<time class="mvp-thread-card__time" datetime="${esc(ts)}">${esc(when)}</time>` +
          `</div>` +
          `</a>` +
          `</li>`
        );
      })
      .join("");
  }

  function getMvpNotificationsForCurrentUser() {
    const rows = getMvpNotifications();
    const role = getRole();
    const roleScoped = rows.filter((n) => {
      const rr = String(n.recipientRole || "").toLowerCase();
      if (!rr) return true;
      if (role === "owner") return rr === "owner" || rr === "ops";
      if (role === "partner") return rr === "partner";
      return true;
    });
    if (role !== "partner") return roleScoped;
    const partnerId = getPartnerId();
    const myAdminId = mvpPartnerIdToAdminPartnerId(partnerId);
    return roleScoped.filter((n) => {
      const target = n.recipientPartnerId || n.to || n.partnerId || null;
      if (!target) return true;
      return target === partnerId || target === myAdminId || adminPartnerToMvpPartnerId(target) === partnerId;
    });
  }

  function adminPartnerToMvpPartnerId(adminPartnerId) {
    const id = String(adminPartnerId || "").trim();
    if (!id) return "";
    const m = id.match(/^partner-demo-(\d+)$/);
    if (m) return `demo-partner-${m[1].padStart(3, "0")}`;
    if ((DEMO_PARTNERS || []).some((p) => p.partner_id === id)) return id;
    return id;
  }

  function mvpPartnerIdToAdminPartnerId(mvpPartnerId) {
    const id = String(mvpPartnerId || "").trim();
    if (!id) return "";
    const m = id.match(/^demo-partner-(\d+)$/);
    if (m) return `partner-demo-${String(Number(m[1]))}`;
    if (getAdminPartnerById(id)) return id;
    return id;
  }

  function normalizeCalendarAssignmentPdf(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.name || "").trim();
    if (!name) return null;
    return {
      name,
      type: String(raw.type || "pdf"),
      storageKey: raw.storageKey ? String(raw.storageKey) : null,
      url: raw.url ? String(raw.url) : null,
    };
  }

  function normalizeCalendarAssignment(raw) {
    const row = raw && typeof raw === "object" ? raw : {};
    const ts = nowIso();
    const partnerId = String(row.partnerId || "").trim();
    const partner = getAdminPartnerById(partnerId);
    const siteAddress = String(row.siteAddress || row.site_address || "").trim();
    return {
      id: String(row.id || uid("calendar-job")),
      projectId: row.projectId ? String(row.projectId) : null,
      partnerId,
      partnerName: String(row.partnerName || partner?.companyName || ""),
      houseName: String(row.houseName || row.house_name || "").trim(),
      workDate: String(row.workDate || row.work_date || "").slice(0, 10),
      startTime: String(row.startTime || row.start_time || "").slice(0, 5),
      endTime: String(row.endTime || row.end_time || "").slice(0, 5),
      instructionPdf: normalizeCalendarAssignmentPdf(row.instructionPdf || row.instruction_pdf),
      parkingPdf: normalizeCalendarAssignmentPdf(row.parkingPdf || row.parking_pdf),
      siteAddress,
      googleMapUrl:
        String(row.googleMapUrl || row.google_map_url || "").trim() ||
        (siteAddress ? buildGoogleMapSearchUrl(siteAddress) : ""),
      notes: String(row.notes || "").trim(),
      summary: String(row.summary || row.builder_summary || "").trim(),
      reward: String(row.reward || "").trim(),
      siteAccess: String(row.siteAccess || row.site_access || "").trim(),
      scheduleLabel: String(row.scheduleLabel || row.schedule_label || "").trim(),
      attachments: Array.isArray(row.attachments)
        ? row.attachments.filter((x) => x && (x.name || x.url))
        : [],
      status: row.status === "completed" ? "completed" : row.status === "assigned" ? "assigned" : "assigned",
      createdAt: String(row.createdAt || row.created_at || ts),
      updatedAt: String(row.updatedAt || row.updated_at || ts),
    };
  }

  function buildGoogleMapSearchUrl(address) {
    const q = encodeURIComponent(String(address || "").trim());
    return q ? `https://www.google.com/maps/search/?api=1&query=${q}` : "";
  }

  function getAdminCalendarAssignments() {
    ensureAdminPartnersDemoData();
    try {
      const raw = localStorage.getItem(ADMIN_CALENDAR_ASSIGNMENTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeCalendarAssignment);
    } catch {
      return [];
    }
  }

  function saveAdminCalendarAssignments(list) {
    const normalized = (Array.isArray(list) ? list : []).map(normalizeCalendarAssignment);
    try {
      localStorage.setItem(ADMIN_CALENDAR_ASSIGNMENTS_KEY, JSON.stringify(normalized));
      document.dispatchEvent(new CustomEvent("builder:admin-calendar-assignments-changed"));
    } catch {
      // ignore
    }
  }

  function findDuplicateCalendarAssignment({ partnerId, workDate, houseName }) {
    const pid = String(partnerId || "").trim();
    const date = String(workDate || "").slice(0, 10);
    const house = String(houseName || "").trim();
    if (!pid || !date || !house) return null;
    return (
      getAdminCalendarAssignments().find(
        (a) => a.partnerId === pid && a.workDate === date && a.houseName === house
      ) || null
    );
  }

  function filterCalendarAssignmentsForPartner(partnerId) {
    const pid = String(partnerId || "").trim();
    if (!pid) return [];
    const adminId = mvpPartnerIdToAdminPartnerId(pid);
    return getAdminCalendarAssignments().filter((a) => {
      if (a.partnerId === pid || a.partnerId === adminId) return true;
      return adminPartnerToMvpPartnerId(a.partnerId) === pid;
    });
  }

  function pushCalendarAssignmentNotification(partnerId, assignment) {
    if (!assignment || !partnerId) return;
    const mvpPid = adminPartnerToMvpPartnerId(partnerId);
    const houseName = assignment.houseName || "現場";
    mvp().pushNotification({
      type: "calendar_assignment",
      label: "現場予定追加",
      to: mvpPid,
      recipientPartnerId: mvpPid,
      partnerId: mvpPid,
      assignmentId: assignment.id,
      projectTitle: houseName,
      body: `${houseName}の現場予定がカレンダーに追加されました。`,
      href: partnerAssignmentPageHref(assignment.projectId || "", {
        partnerId: mvpPid,
      }),
      project_id: assignment.projectId || null,
      assignmentId: assignment.id,
    });
    dispatchMvpNotificationsChanged();
  }

  function createAdminCalendarAssignment(payload = {}) {
    const partnerId = String(payload.partnerId || "").trim();
    const houseName = String(payload.houseName || "").trim();
    const workDate = String(payload.workDate || "").slice(0, 10);
    const startTime = String(payload.startTime || "").slice(0, 5);
    const endTime = String(payload.endTime || "").slice(0, 5);
    const siteAddress = String(payload.siteAddress || "").trim();
    const notes = String(payload.notes || "").trim();
    const forceDuplicate = Boolean(payload.forceDuplicate);

    if (!partnerId) return { ok: false, error: "partner_required" };
    if (!houseName) return { ok: false, error: "house_name_required" };
    if (!workDate) return { ok: false, error: "work_date_required" };

    const partner = getAdminPartnerById(partnerId);
    if (!partner) return { ok: false, error: "partner_not_found" };

    const duplicate = findDuplicateCalendarAssignment({ partnerId, workDate, houseName });
    if (duplicate && !forceDuplicate) {
      return { ok: false, error: "duplicate", duplicate };
    }

    const ts = nowIso();
    const assignment = normalizeCalendarAssignment({
      id: uid("calendar-job"),
      projectId: payload.projectId ? String(payload.projectId) : null,
      partnerId,
      partnerName: partner.companyName || partner.contactName || partnerId,
      houseName,
      workDate,
      startTime,
      endTime,
      instructionPdf: payload.instructionPdf || null,
      parkingPdf: payload.parkingPdf || null,
      siteAddress,
      googleMapUrl: siteAddress ? buildGoogleMapSearchUrl(siteAddress) : "",
      notes,
      status: "assigned",
      createdAt: ts,
      updatedAt: ts,
    });

    saveAdminCalendarAssignments([assignment, ...getAdminCalendarAssignments()]);
    pushCalendarAssignmentNotification(partnerId, assignment);
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    showAssignmentPreview(assignment);
    return { ok: true, assignment };
  }

  function updateAdminCalendarAssignment(assignmentId, payload = {}) {
    const id = String(assignmentId || "").trim();
    if (!id) return { ok: false, error: "invalid" };

    const list = getAdminCalendarAssignments();
    const idx = list.findIndex((a) => a.id === id);
    if (idx < 0) return { ok: false, error: "not_found" };

    const current = list[idx];
    const partnerId = String(payload.partnerId || current.partnerId || "").trim();
    const partner = getAdminPartnerById(partnerId);
    const houseName = String(payload.houseName ?? current.houseName ?? "").trim();
    const workDate = String(payload.workDate ?? current.workDate ?? "").slice(0, 10);
    if (!houseName || !workDate) return { ok: false, error: "invalid" };

    const assignment = normalizeCalendarAssignment({
      ...current,
      ...payload,
      id,
      partnerId,
      partnerName: partner?.companyName || partner?.contactName || current.partnerName,
      houseName,
      workDate,
      startTime: String(payload.startTime ?? current.startTime ?? "").slice(0, 5),
      endTime: String(payload.endTime ?? current.endTime ?? "").slice(0, 5),
      siteAddress: String(payload.siteAddress ?? current.siteAddress ?? "").trim(),
      notes: String(payload.notes ?? current.notes ?? "").trim(),
      instructionPdf: payload.instructionPdf !== undefined ? payload.instructionPdf : current.instructionPdf,
      parkingPdf: payload.parkingPdf !== undefined ? payload.parkingPdf : current.parkingPdf,
      googleMapUrl:
        String(payload.siteAddress ?? current.siteAddress ?? "").trim()
          ? buildGoogleMapSearchUrl(String(payload.siteAddress ?? current.siteAddress ?? "").trim())
          : current.googleMapUrl,
      updatedAt: nowIso(),
    });

    const next = [...list];
    next[idx] = assignment;
    saveAdminCalendarAssignments(next);
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    showAssignmentPreview(assignment);
    return { ok: true, assignment };
  }

  function markAssignmentCompleted(assignmentId) {
    const id = String(assignmentId || "").trim();
    if (!id) return { ok: false, error: "invalid" };

    const list = getAdminCalendarAssignments();
    const idx = list.findIndex((a) => a.id === id);
    if (idx < 0) return { ok: false, error: "not_found" };

    const next = [...list];
    next[idx] = normalizeCalendarAssignment({
      ...next[idx],
      status: "completed",
      updatedAt: nowIso(),
    });
    saveAdminCalendarAssignments(next);
    document.dispatchEvent(new CustomEvent("builder:admin-calendar-assignments-changed"));
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    hideAssignmentPreview();
    return { ok: true, assignment: next[idx] };
  }

  function normalizeAssignmentPreviewPayload(raw) {
    const row = raw && typeof raw === "object" ? raw : {};
    const assignment = row.assignment ? normalizeCalendarAssignment(row.assignment) : normalizeCalendarAssignment(row);
    const previewKind = row.previewKind || (assignment.id?.startsWith("calendar-job") ? "assignment" : row.kind || "assignment");
    const title = String(row.houseName || row.title || assignment.houseName || "—");
    const workDate = String(row.workDate || assignment.workDate || row.start || "—").slice(0, 10);
    const startTime = String(row.startTime || assignment.startTime || "").slice(0, 5);
    const endTime = String(row.endTime || assignment.endTime || "").slice(0, 5);
    const dateLabel =
      startTime || endTime
        ? `${workDate}${startTime ? ` ${startTime}` : ""}${endTime ? ` 〜 ${endTime}` : ""}`
        : workDate;
    return {
      id: String(row.id || assignment.id || ""),
      previewKind,
      title,
      workDate: dateLabel,
      partnerName: String(row.partnerName || assignment.partnerName || "—"),
      notes: String(row.notes ?? assignment.notes ?? "—").trim() || "—",
      status: row.status || assignment.status || "assigned",
    };
  }

  function renderAssignmentPreviewDom(preview) {
    const data = normalizeAssignmentPreviewPayload(preview);
    const titleEl = document.querySelector("[data-admin-cal-assignment-preview-title]");
    const dateEl = document.querySelector("[data-admin-cal-assignment-preview-date]");
    const partnerEl = document.querySelector("[data-admin-cal-assignment-preview-partner]");
    const notesEl = document.querySelector("[data-admin-cal-assignment-preview-notes]");
    const completeBtn = document.querySelector("[data-admin-cal-assignment-preview-complete]");
    const card = document.querySelector("[data-admin-cal-assignment-preview-card]");
    if (titleEl) titleEl.textContent = data.title;
    if (dateEl) dateEl.textContent = data.workDate;
    if (partnerEl) partnerEl.textContent = data.partnerName;
    if (notesEl) notesEl.textContent = data.notes;
    if (completeBtn) {
      completeBtn.dataset.assignmentId = data.id;
      completeBtn.dataset.previewKind = data.previewKind;
    }
    if (card) card.dataset.previewId = data.id;
  }

  function showAssignmentPreview(assignment) {
    if (!assignment) return;
    adminCalendarAssignmentPreviewData = normalizeAssignmentPreviewPayload(assignment);
    adminCalendarAssignmentPreviewVisible = true;

    const host = document.querySelector("[data-admin-cal-assignment-preview]");
    if (!host) return;

    renderAssignmentPreviewDom(adminCalendarAssignmentPreviewData);
    host.hidden = false;
    host.classList.remove("is-visible");
    requestAnimationFrame(() => {
      host.classList.add("is-visible");
    });
  }

  function hideAssignmentPreview() {
    const host = document.querySelector("[data-admin-cal-assignment-preview]");
    if (!host) {
      adminCalendarAssignmentPreviewVisible = false;
      adminCalendarAssignmentPreviewData = null;
      return;
    }
    host.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!host.classList.contains("is-visible")) {
        host.hidden = true;
      }
    }, 220);
    adminCalendarAssignmentPreviewVisible = false;
    adminCalendarAssignmentPreviewData = null;
  }

  function restoreAssignmentPreviewIfVisible() {
    if (!adminCalendarAssignmentPreviewVisible || !adminCalendarAssignmentPreviewData) return;
    const host = document.querySelector("[data-admin-cal-assignment-preview]");
    if (!host) return;
    renderAssignmentPreviewDom(adminCalendarAssignmentPreviewData);
    host.hidden = false;
    host.classList.add("is-visible");
  }

  function calendarAssignmentToAdminEvent(assignment, state) {
    const a = normalizeCalendarAssignment(assignment);
    let threadId = "";
    if (a.projectId && state?.projects) {
      const p = state.projects.find((x) => x.project_id === a.projectId);
      threadId = p?.main_thread_id || "";
    }
    return {
      id: a.id,
      kind: "assignment",
      title: a.houseName,
      start: a.workDate,
      end: a.workDate,
      status: a.status || "assigned",
      category: "現場予定",
      assignee: a.partnerName || "—",
      assignedPartner: a.partnerId ? { id: a.partnerId, name: a.partnerName, type: "partner" } : null,
      location: a.siteAddress || "—",
      instructions: a.notes || "—",
      notes: a.notes ? [a.notes] : [],
      attachments: [a.instructionPdf, a.parkingPdf].filter(Boolean),
      threadId,
      projectId: a.projectId,
      assignment: a,
    };
  }

  function renderAdminCalendarAssignmentDetail(ev, state) {
    const a = ev?.assignment || {};
    const timeRange =
      a.startTime || a.endTime
        ? `${a.startTime || "—"}${a.endTime ? ` 〜 ${a.endTime}` : ""}`
        : "—";
    const pdfBtn = (file, label) => {
      if (!file?.name) return `<p>—</p>`;
      return (
        `<button type="button" class="admin-cal-attachments__btn" data-admin-cal-assignment-pdf="${esc(label)}">` +
        `<span>PDF</span><span>${esc(file.name)}</span></button>`
      );
    };
    const mapSection = a.siteAddress
      ? `<section class="admin-cal-card__section"><h3>現場住所</h3><p>${esc(a.siteAddress)}</p>` +
        (a.googleMapUrl
          ? `<p><a class="admin-cal-mapLink" href="${esc(a.googleMapUrl)}" target="_blank" rel="noopener noreferrer">Google Mapsで開く</a></p>`
          : "") +
        `<iframe class="admin-cal-map" title="Google Maps" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(adminCalendarMapsEmbedUrl(a.siteAddress))}"></iframe></section>`
      : `<section class="admin-cal-card__section"><h3>現場住所</h3><p>—</p></section>`;
    const threadHtml = ev.threadId
      ? `<div class="admin-cal-assignmentActions"><a class="builder-btn builder-btn--secondary" href="${esc(mvpThreadHref(ev.threadId, "owner"))}">スレッドを見る</a></div>`
      : "";
    return (
      `<article class="admin-cal-card admin-cal-card--assignment" data-admin-cal-event-id="${esc(ev.id)}" data-admin-cal-kind="assignment">` +
      `<span class="admin-cal-card__status admin-cal-card__status--${esc(ev.status)}">${esc(adminCalendarStatusLabel(ev.status))}</span>` +
      `<span class="admin-cal-card__kind">現場予定</span>` +
      `<h3 class="builder-section-title">${esc(a.houseName || ev.title)}</h3>` +
      `<div class="admin-cal-card__meta">` +
      `<span>邸名: ${esc(a.houseName || "—")}</span>` +
      `<span>担当パートナー: ${esc(a.partnerName || ev.assignee || "—")}</span>` +
      `<span>作業日: ${esc(a.workDate || ev.start || "—")}</span>` +
      `<span>時間: ${esc(timeRange)}</span>` +
      `</div>` +
      `<section class="admin-cal-card__section"><h3>指示書PDF</h3>${pdfBtn(a.instructionPdf, "instruction")}</section>` +
      `<section class="admin-cal-card__section"><h3>駐車場PDF</h3>${pdfBtn(a.parkingPdf, "parking")}</section>` +
      mapSection +
      `<section class="admin-cal-card__section"><h3>備考</h3><p>${esc(a.notes || "—")}</p></section>` +
      renderSitePhotoHistoryForThreadId(ev.threadId, state || mvp().reload()) +
      renderThreadPdfOutputsForCalendar(ev.threadId, state || mvp().reload()) +
      threadHtml +
      `</article>`
    );
  }

  function getProjectCalendarAssignedPartnerId(project) {
    return project?.calendar_assigned_partner_id ? String(project.calendar_assigned_partner_id) : null;
  }

  function ensureTalkBuilderDemoInState(state) {
    if (isOpsBenchSession()) return state && typeof state === "object" ? state : {};
    const next = state && typeof state === "object" ? { ...state } : {};
    const pid = TALK_BUILDER_DEMO_PROJECT_ID;
    const demoProject = DEMO_PROJECTS.find((p) => p.project_id === pid);
    if (!demoProject) return next;

    const projects = [...(next.projects || [])];
    const idx = projects.findIndex((p) => p.project_id === pid);
    const tid = TALK_BUILDER_DEMO_THREAD_ID;
    if (idx >= 0) {
      projects[idx] = {
        ...demoProject,
        ...projects[idx],
        board_type: projects[idx].board_type || demoProject.board_type || "calendar",
        projectKind: projects[idx].projectKind || demoProject.projectKind || "calendar",
        main_thread_id: projects[idx].main_thread_id || tid,
        calendar_assigned_partner_id:
          projects[idx].calendar_assigned_partner_id || demoProject.calendar_assigned_partner_id,
        assignment_status: projects[idx].assignment_status || demoProject.assignment_status || "pending",
      };
    } else {
      projects.unshift({ ...demoProject, main_thread_id: tid });
    }
    next.projects = projects;
    next.specs = {
      ...(next.specs || {}),
      [pid]: { ...(DEMO_PROJECT_SPECS[pid] || {}), ...(next.specs?.[pid] || {}) },
    };

    const threads = { ...(next.threads || {}) };
    if (!threads[tid]) {
      threads[tid] = {
        thread_id: tid,
        project_id: pid,
        events: [],
        messages: [],
        photos: [],
        siteData: {},
        status: "open",
      };
    }
    next.threads = threads;

    return next;
  }

  function getCalendarTypeConfig(project) {
    if (window.TasuBuilderBoardFeed?.getTypeConfig) {
      return window.TasuBuilderBoardFeed.getTypeConfig(project || "calendar");
    }
    return getBoardTypeConfig(project);
  }

  function isCalendarOpsProject(project) {
    if (!project) return false;
    if (resolveBoardItemType(project) === "calendar") return true;
    return String(project.source || "") === "admin_calendar" || project.project_id === TALK_BUILDER_DEMO_PROJECT_ID;
  }

  function resolveCalendarMainThreadId(state, project) {
    const direct = String(project?.main_thread_id || "").trim();
    if (direct && state?.threads?.[direct]) return direct;
    const match = Object.values(state?.threads || {}).find(
      (t) =>
        String(t.project_id) === String(project?.project_id) &&
        String(t.thread_kind || "") === "calendar_request"
    );
    return String(match?.thread_id || "").trim();
  }

  /** カレンダー受諾時のみ — calendar_request スレッドを作成 */
  function ensureCalendarRequestThread(next, projectId, partnerId) {
    const pidx = (next.projects || []).findIndex((x) => x.project_id === projectId);
    if (pidx < 0) return null;
    const pr = next.projects[pidx];
    const typeCfg = getCalendarTypeConfig(pr);
    const threadKind = typeCfg.threadKind || "calendar_request";
    let threadId = resolveCalendarMainThreadId(next, pr);
    const ownerId = next.owner_id || OWNER_ID;
    const ownerName = "TASFUL運営";
    const partnerName = partnerLabel(next, partnerId);

    if (!threadId || !next.threads?.[threadId]) {
      threadId = uid("thread");
      next.threads = {
        ...(next.threads || {}),
        [threadId]: {
          thread_id: threadId,
          thread_type: "ops_partner",
          thread_kind: threadKind,
          project_id: projectId,
          partner_id: partnerId,
          counterpart_name: partnerName,
          list_title: pr.title || projectId,
          events: [],
          messages: [],
          photos: [],
          completion: null,
        },
      };
      next.projects[pidx] = { ...pr, main_thread_id: threadId, board_type: "calendar", projectKind: "calendar" };
    } else if (!next.threads[threadId].thread_kind) {
      next.threads[threadId].thread_kind = threadKind;
      if (!next.threads[threadId].thread_type) next.threads[threadId].thread_type = "ops_partner";
    }

    const thread = next.threads[threadId];
    thread.events = thread.events || [];
    thread.messages = thread.messages || [];
    const matchLabel = typeCfg.matchVerb || "受諾";
    const alreadyMatched = thread.events.some(
      (e) => e.type === "selected" && String(e.text || "").includes(partnerName)
    );
    if (!alreadyMatched) {
      thread.events.push({
        type: "selected",
        actor: { id: ownerId, type: "owner", name: ownerName },
        ts: nowIso(),
        text: `${matchLabel}: ${partnerName}`,
      });
      thread.messages.push({
        msg_id: uid("msg"),
        from: { id: ownerId, type: "owner", name: ownerName },
        ts: nowIso(),
        text: `${partnerName} さんの案件を${matchLabel}しました。条件確認・日程調整はこのチャットで進めてください。`,
      });
      thread.messages.push({
        msg_id: uid("msg"),
        from: { id: partnerId, type: "partner", name: partnerName },
        ts: nowIso(),
        text: "受諾ありがとうございます。よろしくお願いします。",
      });
    }
    return threadId;
  }

  function notifyCalendarAssignmentDecision(api, { project, partnerId, selected, threadId }) {
    const state = api.reload();
    const pname = partnerLabel(state, partnerId);
    const ptitle = project.title || project.project_id;
    const typeCfg = { ...getCalendarTypeConfig(project), projectId: project.project_id };

    if (selected && threadId) {
      const threadHref = mvpThreadHref(threadId, "partner", "ops_partner");
      const calendarKind = "calendar";
      api.pushNotification({
        type: "selected",
        title: "案件を受け付けました",
        body: "運営とのやりとりを開始できます。",
        project_id: project.project_id,
        projectTitle: ptitle,
        thread_id: threadId,
        partnerId,
        recipientRole: "partner",
        recipientPartnerId: partnerId,
        href: threadHref,
        projectKind: calendarKind,
        board_type: calendarKind,
      });
      api.pushNotification({
        type: "hire_confirmed",
        title: "パートナーが案件を受けました",
        body: `${pname} が「${ptitle}」を受諾しました。`,
        project_id: project.project_id,
        projectTitle: ptitle,
        thread_id: threadId,
        recipientRole: "owner",
        href: threadHref,
        projectKind: calendarKind,
        board_type: calendarKind,
      });
      return;
    }

    api.pushNotification({
      type: "request_declined",
      title: "パートナーが案件を辞退しました",
      body: `${pname} が「${ptitle}」を辞退しました。`,
      project_id: project.project_id,
      projectTitle: ptitle,
      partnerId,
      recipientRole: "owner",
      thread_id: null,
      projectKind: "calendar",
      board_type: "calendar",
      href: "#",
      notifyOnly: true,
    });
  }

  function getCalendarRole() {
    const raw = String(getParam("role") || "").trim().toLowerCase();
    if (!raw) return "partner";
    if (raw === "worker" || raw === "partner") return "partner";
    if (raw === "admin" || raw === "ops" || raw === "owner") return "admin";
    return "partner";
  }

  function isCalendarPartnerRole() {
    return getCalendarRole() === "partner";
  }

  function isCalendarAdminRole() {
    return getCalendarRole() === "admin";
  }

  function mvpCalendarThreadHref(project, roleOverride, state) {
    const st = state || mvp().reload();
    const threadId = resolveCalendarMainThreadId(st, project);
    if (!threadId) return "../talk-home.html?tab=chat";
    const role = roleOverride || (isCalendarAdminRole() ? "admin" : "partner");
    if (threadId === TALK_BUILDER_DEMO_THREAD_ID) {
      const sp = new URLSearchParams();
      sp.set("id", threadId);
      sp.set("role", role);
      return `mvp-thread.html?${sp.toString()}`;
    }
    return mvpThreadHref(threadId, role, "ops_partner");
  }

  function getCalendarAssignmentStatusLabel(project, state) {
    const assignmentStatus = String(project?.assignment_status || "").trim();
    if (assignmentStatus === "accepted") return "受諾済み";
    if (assignmentStatus === "declined") return "辞退済み";
    if (assignmentStatus === "pending") return "未回答";
    return toStatusLabel(computeProjectStatus(state, project));
  }

  function calendarPartnerIdsMatch(assignmentPartnerId, currentPartnerId) {
    const a = String(assignmentPartnerId || "").trim();
    const b = String(currentPartnerId || "").trim();
    if (!a || !b) return false;
    if (a === b) return true;
    if (mvpPartnerIdToAdminPartnerId(b) === a) return true;
    if (adminPartnerToMvpPartnerId(a) === b) return true;
    return false;
  }

  function isPartnerAssignedToCalendarProject(projectId, partnerId) {
    const pid = String(projectId || "").trim();
    const ppid = String(partnerId || "").trim();
    if (!pid || !ppid) return false;
    return Boolean(findPartnerAdminCalendarAssignment(pid, ppid));
  }

  function isPartnerAssignmentProject(project, partnerId) {
    const pid = String(partnerId || "").trim();
    if (!project || !pid) return false;
    return isPartnerAssignedToCalendarProject(project.project_id, pid);
  }

  function shouldShowPartnerAssignmentDetail(project, partnerId) {
    if (!project || !isCalendarPartnerRole()) return false;
    return isPartnerAssignmentProject(project, partnerId);
  }

  function shouldShowAdminAssignmentDetail(project) {
    if (!project || !isCalendarAdminRole()) return false;
    return Boolean(project.project_id);
  }

  function isPartnerDeclinedAssignment(project, partnerId) {
    const pid = String(partnerId || "").trim();
    if (!project || !pid) return false;
    if (String(project.assignment_status || "").trim() !== "declined") return false;
    return isPartnerAssignmentProject(project, pid);
  }

  function isPartnerPendingAssignment(project, partnerId) {
    const pid = String(partnerId || "").trim();
    if (!project || !pid) return false;
    const status = String(project.assignment_status || "pending").trim();
    if (status === "accepted" || status === "declined") return false;
    return isPartnerAssignmentProject(project, pid);
  }

  function currentCalendarMonthKey(refDate) {
    const d = refDate instanceof Date ? refDate : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function formatPartnerScheduleMd(dateStr) {
    const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(dateStr || "—");
    return `${Number(m[2])}/${Number(m[3])}`;
  }

  function isPartnerAcceptedAssignment(project, partnerId) {
    if (!isPartnerAssignmentProject(project, partnerId)) return false;
    return String(project?.assignment_status || "").trim() === "accepted";
  }

  function ensurePartnerFilterDemoPartners() {
    const required = ADMIN_DEMO_PARTNERS.filter((p) => p.id === "partner-a" || p.id === "partner-b");
    const list = getAdminPartners();
    let changed = false;
    for (const row of required) {
      if (!list.some((p) => p.id === row.id)) {
        list.push(normalizeAdminPartner(row));
        changed = true;
      }
    }
    if (changed) saveAdminPartners(list);
  }

  function ensureAdminCalendarPartnerDemoData() {
    if (isOpsPartnerBenchEmbed()) return;
    if (isOpsBenchSession() && !isAdminCalOpsBenchEmbed()) return;
    ensureAdminPartnersDemoData();
    ensurePartnerFilterDemoPartners();
    const monthKey = currentCalendarMonthKey();
    const api = mvp();
    const next = api.reload();
    const ts = nowIso();
    const demos = [
      {
        assignmentId: "calendar-demo-builder-001",
        projectId: TALK_BUILDER_DEMO_PROJECT_ID,
        partnerId: "demo-partner-001",
        partnerName: "株式会社オレンジ建装",
        houseName: "店舗内装リニューアル（Builder）",
        workDate: `${monthKey}-10`,
        startTime: "09:00",
        endTime: "17:00",
        summary: "店舗内装リニューアル一式（設計・施工・仕上げ）",
        reward: "¥980,000",
        siteAddress: "東京都渋谷区道玄坂1-2-3",
        siteAccess: "B1F 搬入口から入場",
        notes: "Helmet必須・9:00前入場不可",
        scheduleLabel: "着工 6/10 → 中間検査 6/20 → 完工 6/28",
        assignmentStatus: "pending",
        instructionPdf: { name: "作業指示書_builder_demo.pdf", type: "pdf" },
        parkingPdf: { name: "駐車場案内_builder_demo.pdf", type: "pdf" },
        attachments: [{ name: "平面図.pdf", type: "pdf" }],
      },
      {
        assignmentId: "calendar-demo-partner-a",
        projectId: "partner-cal-demo-a",
        partnerId: "partner-a",
        partnerName: "デモ協力会社A",
        houseName: "店舗内装リニューアル",
        workDate: `${monthKey}-10`,
        startTime: "09:00",
        endTime: "17:00",
        summary: "店舗内装リニューアル一式（設計・施工・仕上げ）",
        reward: "¥980,000",
        siteAddress: "東京都渋谷区道玄坂1-2-3",
        siteAccess: "B1F 搬入口から入場",
        notes: "Helmet必須・9:00前入場不可",
        scheduleLabel: "6/10 着工",
        assignmentStatus: "accepted",
      },
      {
        assignmentId: "calendar-demo-partner-b",
        projectId: "partner-cal-demo-b",
        partnerId: "partner-b",
        partnerName: "デモ協力会社B",
        houseName: "共同住宅外装改修",
        workDate: `${monthKey}-10`,
        startTime: "09:00",
        endTime: "17:00",
        summary: "共同住宅の外装改修に伴う足場工事",
        reward: "¥650,000",
        siteAddress: "東京都新宿区西新宿2-8-1",
        siteAccess: "正門より入場、受付で名札交換",
        notes: "安全書類持参",
        scheduleLabel: "6/10 足場着手",
        assignmentStatus: "accepted",
      },
      {
        assignmentId: "calendar-demo-partner-a-2",
        projectId: "partner-cal-demo-a-2",
        partnerId: "partner-a",
        partnerName: "デモ協力会社A",
        houseName: "共同住宅外装改修",
        workDate: `${monthKey}-15`,
        startTime: "09:00",
        endTime: "17:00",
        summary: "共同住宅の外装改修（別現場）",
        reward: "¥650,000",
        siteAddress: "東京都新宿区西新宿2-8-1",
        siteAccess: "正門より入場",
        notes: "安全書類持参",
        scheduleLabel: "6/15 足場着手",
        assignmentStatus: "accepted",
      },
      {
        assignmentId: "calendar-demo-partner-b-2",
        projectId: "partner-cal-demo-b-2",
        partnerId: "partner-b",
        partnerName: "デモ協力会社B",
        houseName: "倉庫新築見積調査",
        workDate: `${monthKey}-20`,
        startTime: "09:00",
        endTime: "17:00",
        summary: "倉庫新築の現地調査・見積作成",
        reward: "¥120,000",
        siteAddress: "神奈川県横浜市港北区新横浜3-7-11",
        siteAccess: "南側搬入口",
        notes: "長靴・ヘルメット持参",
        scheduleLabel: "6/20 現地調査",
        assignmentStatus: "accepted",
      },
    ];

    let projectsChanged = false;
    let assignmentsChanged = false;
    const projects = [...(next.projects || [])];
    const assignments = getAdminCalendarAssignments().slice();

    for (const demo of demos) {
      const projectIdx = projects.findIndex((p) => p.project_id === demo.projectId);
      const projectRow = {
        project_id: demo.projectId,
        owner_id: next.owner_id || OWNER_ID,
        title: demo.houseName,
        kind: "builder_board",
        board_type: "calendar",
        projectKind: "calendar",
        status: "open",
        required_partners: 1,
        selected_partner_ids: demo.assignmentStatus === "accepted" ? [demo.partnerId] : [],
        calendar_assigned_partner_id: demo.partnerId,
        assignment_status: demo.assignmentStatus,
        visibility: "partner_only",
        contact_policy: "tasful_talk_only",
        main_thread_id: demo.projectId === TALK_BUILDER_DEMO_PROJECT_ID ? TALK_BUILDER_DEMO_THREAD_ID : null,
        source: "admin_calendar",
        created_at: ts,
        updated_at: ts,
      };
      if (projectIdx < 0) {
        projects.push(projectRow);
        projectsChanged = true;
      } else {
        const merged = {
          ...projects[projectIdx],
          calendar_assigned_partner_id: demo.partnerId,
          assignment_status: demo.assignmentStatus,
          title: demo.houseName,
          source: "admin_calendar",
        };
        if (JSON.stringify(merged) !== JSON.stringify(projects[projectIdx])) {
          projects[projectIdx] = merged;
          projectsChanged = true;
        }
      }

      const assignmentIdx = assignments.findIndex((a) => a.id === demo.assignmentId);
      const assignmentRow = normalizeCalendarAssignment({
        id: demo.assignmentId,
        projectId: demo.projectId,
        partnerId: demo.partnerId,
        partnerName: demo.partnerName,
        houseName: demo.houseName,
        workDate: demo.workDate,
        startTime: demo.startTime,
        endTime: demo.endTime,
        summary: demo.summary,
        reward: demo.reward,
        siteAddress: demo.siteAddress,
        siteAccess: demo.siteAccess,
        notes: demo.notes,
        scheduleLabel: demo.scheduleLabel,
        instructionPdf: demo.instructionPdf || null,
        parkingPdf: demo.parkingPdf || null,
        attachments: demo.attachments || [],
        status: "assigned",
        createdAt: ts,
        updatedAt: ts,
      });
      if (assignmentIdx < 0) {
        assignments.push(assignmentRow);
        assignmentsChanged = true;
      } else {
        const merged = normalizeCalendarAssignment({ ...assignments[assignmentIdx], ...assignmentRow });
        if (JSON.stringify(merged) !== JSON.stringify(assignments[assignmentIdx])) {
          assignments[assignmentIdx] = merged;
          assignmentsChanged = true;
        }
      }
    }

    if (projectsChanged) {
      next.projects = projects;
    }
    let threadsChanged = false;
    for (const demo of demos) {
      if (demo.assignmentStatus !== "accepted") continue;
      const idx = (next.projects || []).findIndex((p) => p.project_id === demo.projectId);
      if (idx < 0) continue;
      const before = resolveCalendarMainThreadId(next, next.projects[idx]);
      const threadId = ensureCalendarRequestThread(next, demo.projectId, demo.partnerId);
      if (threadId && before !== threadId) threadsChanged = true;
    }
    if (projectsChanged || threadsChanged) {
      api.commit(next);
    }
    if (assignmentsChanged) {
      saveAdminCalendarAssignments(assignments);
    }
  }

  function getPartnerMyScheduleItems(state, partnerId) {
    const pid = String(partnerId || "").trim();
    const monthKey = currentCalendarMonthKey();
    const entries = [];

    for (const a of filterCalendarAssignmentsForPartner(pid)) {
      const workDate = String(a.workDate || "").slice(0, 10);
      if (!workDate.startsWith(monthKey)) continue;
      const project = a.projectId ? (state.projects || []).find((p) => p.project_id === a.projectId) : null;
      if (!project || !isPartnerAcceptedAssignment(project, pid)) continue;
      entries.push({
        id: `my-schedule-${a.id}`,
        workDate,
        dateLabel: formatPartnerScheduleMd(workDate),
        title: a.houseName || project.title || "—",
        projectId: project.project_id,
        assignmentId: a.id,
      });
    }

    entries.sort((a, b) => a.workDate.localeCompare(b.workDate) || a.title.localeCompare(b.title, "ja"));
    return entries;
  }

  function renderPartnerMySchedulePanel(state, partnerId) {
    const wrap = document.querySelector("[data-mvp-cal-my-schedule-wrap]");
    const listEl = document.querySelector("[data-mvp-cal-my-schedule-list]");
    const countEl = document.querySelector("[data-mvp-cal-my-schedule-count]");
    if (!wrap || !listEl || !countEl) return;

    if (!isCalendarPartnerRole()) {
      wrap.hidden = true;
      listEl.innerHTML = "";
      return;
    }

    const items = getPartnerMyScheduleItems(state, partnerId);
    wrap.hidden = false;
    countEl.textContent = `${items.length}件`;

    if (!items.length) {
      listEl.innerHTML = `<li class="mvp-cal-mySchedule__empty">今月の受諾済み予定はありません。</li>`;
      return;
    }

    listEl.innerHTML = items
      .map(
        (row) =>
          `<li>` +
          `<button type="button" class="mvp-cal-mySchedule__item" data-mvp-cal-my-schedule-item data-project-id="${esc(
            row.projectId
          )}" data-item-id="${esc(row.id)}">` +
          `<span class="mvp-cal-mySchedule__date">${esc(row.dateLabel)}</span>` +
          `<span class="mvp-cal-mySchedule__name">${esc(row.title)}</span>` +
          `</button></li>`
      )
      .join("");
  }

  function findPartnerAdminCalendarAssignment(projectId, partnerId) {
    const pid = String(projectId || "").trim();
    const ppid = String(partnerId || "").trim();
    if (!pid || !ppid) return null;
    const matches = filterCalendarAssignmentsForPartner(ppid).filter((a) => a.projectId === pid);
    if (!matches.length) return null;
    return matches.sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)))[0];
  }

  function pickPartnerCalendarText(master, fallback) {
    const m = String(master || "").trim();
    if (m && m !== "—") return m;
    const f = String(fallback || "").trim();
    return f && f !== "—" ? f : "";
  }

  function formatPartnerCalendarSchedule(adminAssignment, spec) {
    const label = pickPartnerCalendarText(adminAssignment?.scheduleLabel, spec?.schedule_summary);
    if (label) return label;
    const date = String(adminAssignment?.workDate || "").trim();
    const start = String(adminAssignment?.startTime || "").trim();
    const end = String(adminAssignment?.endTime || "").trim();
    if (date) {
      const time = start || end ? `${start || "—"}${end ? `〜${end}` : ""}` : "";
      return time ? `${date} ${time}` : date;
    }
    const period = spec?.period || {};
    if (period.start && period.end) return `${period.start}〜${period.end}`;
    return pickPartnerCalendarText(period.start, period.end);
  }

  /** 運営カレンダー登録データ（admin assignment）をマスターにした表示モデル */
  function buildPartnerCalendarViewModel(adminAssignment, project, rawSpec) {
    const spec = rawSpec && typeof rawSpec === "object" ? rawSpec : {};
    const a = adminAssignment && typeof adminAssignment === "object" ? adminAssignment : {};
    const budgetMax = Number(spec.budget?.max);
    const fallbackReward =
      Number.isFinite(budgetMax) && budgetMax > 0 ? `¥${budgetMax.toLocaleString("ja-JP")}` : "";
    const attachments = Array.isArray(a.attachments) && a.attachments.length
      ? a.attachments
      : Array.isArray(spec.attachments)
        ? spec.attachments
        : [];

    return {
      title: pickPartnerCalendarText(a.houseName, project?.title),
      summary: pickPartnerCalendarText(a.summary, spec.builder_summary || spec.overview || spec.description),
      reward: pickPartnerCalendarText(a.reward, spec.reward || fallbackReward),
      schedule: formatPartnerCalendarSchedule(a, spec),
      address: pickPartnerCalendarText(a.siteAddress, spec.site_address || spec.area?.label),
      access: pickPartnerCalendarText(a.siteAccess, spec.site_access || spec.access),
      notes: pickPartnerCalendarText(a.notes, spec.notes),
      instructionPdf: a.instructionPdf || null,
      parkingPdf: a.parkingPdf || null,
      googleMapUrl: pickPartnerCalendarText(a.googleMapUrl, a.siteAddress ? buildGoogleMapSearchUrl(a.siteAddress) : ""),
      attachments,
    };
  }

  function getBuilderAssignmentMeta(project, rawSpec, adminAssignment) {
    return buildPartnerCalendarViewModel(adminAssignment, project, rawSpec);
  }

  function renderPartnerCalendarPdfReadonly(file) {
    if (!file?.name) return "";
    return `<span class="mvp-cal-assignment__file">${esc(file.name)}</span>`;
  }

  function renderPartnerGoogleNavButton(url) {
    if (!url) return "";
    return (
      `<a class="partner-assignment-navBtn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">` +
      `📍 Googleナビを開く</a>`
    );
  }

  function renderPartnerCalendarFieldRows(view, options = {}) {
    const useNavButton = Boolean(options.googleNavButton);
    const rows = [];
    const push = (label, text, html, rowClass = "") => {
      if (!text && !html) return;
      rows.push(
        `<div class="mvp-cal-assignment__row${rowClass ? ` ${rowClass}` : ""}"><dt>${esc(label)}</dt><dd>${html || esc(text)}</dd></div>`
      );
    };
    push("案件名", view.title);
    push("案件概要", view.summary);
    push("報酬", view.reward);
    push("工期 / 日程", view.schedule);
    push("現場住所", view.address);
    push("入場条件", view.access);
    push("注意事項", view.notes);
    if (view.instructionPdf?.name) push("指示書", "", renderPartnerCalendarPdfReadonly(view.instructionPdf));
    if (view.parkingPdf?.name) push("駐車場地図", "", renderPartnerCalendarPdfReadonly(view.parkingPdf));
    if (view.googleMapUrl) {
      if (useNavButton) {
        push("Googleナビ", "", renderPartnerGoogleNavButton(view.googleMapUrl), "mvp-cal-assignment__row--nav");
      } else {
        push(
          "GoogleナビURL",
          "",
          `<a class="mvp-cal-assignment__link" href="${esc(view.googleMapUrl)}" target="_blank" rel="noopener noreferrer">Google Mapsで開く</a>`
        );
      }
    }
    if (view.attachments?.length) {
      const html = `<ul class="mvp-cal-assignment__attachList">${view.attachments
        .map((file) => `<li>${esc(file.name || "資料")}</li>`)
        .join("")}</ul>`;
      push("添付資料", "", html);
    }
    return rows.join("");
  }

  function renderPartnerCalendarDeniedDetail(projectId) {
    return (
      `<div class="mvp-cal-assignment mvp-cal-assignment--partner mvp-cal-assignment--denied">` +
      `<p class="mvp-cal-detail__denied">この案件はあなたに割り当てられていません</p>` +
      (projectId ? `<p class="mvp-cal-detail__deniedMeta">projectId: ${esc(projectId)}</p>` : "") +
      `</div>`
    );
  }

  function resolvePartnerCalendarDetailContext(item, state, urlProjectId) {
    const partnerId = getPartnerId();
    const projectId = String(item?.projectId || urlProjectId || "").trim();
    if (!projectId) return null;
    if (!isPartnerAssignedToCalendarProject(projectId, partnerId)) {
      return { denied: true, projectId };
    }
    const project = (state.projects || []).find((p) => p.project_id === projectId) || null;
    const assignment = findPartnerAdminCalendarAssignment(projectId, partnerId);
    const spec = project ? state.specs?.[project.project_id] || DEMO_PROJECT_SPECS[project.project_id] || null : null;
    return { project, spec, assignment, denied: false };
  }

  function renderMvpCalendarPartnerAssignmentDetail(project, spec, state, adminAssignment) {
    const view = buildPartnerCalendarViewModel(adminAssignment, project, spec);
    const partnerId = getPartnerId();
    const pending = project ? isPartnerPendingAssignment(project, partnerId) : false;
    const status = String(project?.assignment_status || "pending").trim();

    let statusNote = "";
    let actions = "";

    if (status === "accepted") {
      const chatHref = project ? mvpCalendarThreadHref(project, "partner", state) : "";
      statusNote = `<p class="mvp-cal-assignment__status is-accepted">受諾済み</p>`;
      if (chatHref && !chatHref.includes("talk-home")) {
        actions =
          `<div class="mvp-cal-assignment__actions">` +
          `<a class="builder-btn builder-btn--primary" href="${esc(chatHref)}">スレッドへ</a>` +
          `</div>`;
      }
    } else if (status === "declined") {
      statusNote = `<p class="mvp-cal-assignment__status is-declined">辞退済み</p>`;
    } else if (pending && project) {
      statusNote = `<p class="mvp-cal-assignment__lead">案件内容を確認し、対応可否を判断してください。</p>`;
      actions =
        `<div class="mvp-cal-assignment__actions">` +
        `<button type="button" class="builder-btn builder-btn--primary" data-mvp-cal-accept data-project-id="${esc(
          project.project_id
        )}">受ける</button>` +
        `<button type="button" class="builder-btn builder-btn--outline" data-mvp-cal-decline data-project-id="${esc(
          project.project_id
        )}">受けない</button>` +
        `</div>`;
    }

    return (
      `<div class="mvp-cal-assignment mvp-cal-assignment--partner">` +
      `<div class="mvp-cal-detail__head"><h3 class="builder-section-title">仕事確認</h3></div>` +
      statusNote +
      `<dl class="mvp-cal-assignment__rows">` +
      renderPartnerCalendarFieldRows(view, { googleNavButton: true }) +
      `</dl>` +
      actions +
      `</div>`
    );
  }

  function partnerAcceptedThreadHref(project, partnerId, state) {
    if (!project || String(project.assignment_status || "").trim() !== "accepted") return "";
    const href = mvpCalendarThreadHref(project, "partner", state);
    if (href && href.includes("mvp-thread.html")) return href;
    const threadId = resolveCalendarMainThreadId(state, project);
    return threadId ? mvpThreadHref(threadId, "partner") : "";
  }

  function partnerAssignmentPageHref(projectId, opts = {}) {
    const sp = new URLSearchParams();
    sp.set("role", "partner");
    const pid = String(projectId || "").trim();
    if (pid) sp.set("projectId", pid);
    const partnerId = String(opts.partnerId || getPartnerId() || "").trim();
    if (partnerId) sp.set("partnerId", partnerId);
    const calendarEventId = String(opts.calendarEventId || opts.assignmentId || "").trim();
    if (calendarEventId) sp.set("calendarEventId", calendarEventId);
    const from = String(opts.from || getParam("from") || "").trim();
    if (from) sp.set("from", from);
    return `partner-assignment.html?${sp.toString()}`;
  }

  function getPartnerAssignmentProgressLabel(state, project) {
    if (!project) return "—";
    const status = computeProjectStatus(state, project);
    const map = {
      in_progress: "入場済み",
      exited: "退場済み",
      completed: "完了報告済み",
      invoiced: "完了承認",
      selected: "受諾済み",
      open: "受諾済み",
    };
    return map[status] || toStatusLabel(status);
  }

  function renderPartnerAssignmentDetailOnly(project, spec, state, adminAssignment) {
    const view = buildPartnerCalendarViewModel(adminAssignment, project, spec);
    const partnerId = getPartnerId();
    const pending = project ? isPartnerPendingAssignment(project, partnerId) : false;
    const status = String(project?.assignment_status || "pending").trim();

    let statusNote = "";
    let actions = "";

    if (status === "declined") {
      return (
        `<div class="mvp-cal-assignment mvp-cal-assignment--partner partner-assignment-card">` +
        `<p class="mvp-cal-detail__empty">この案件は辞退済みのため、カレンダーから非表示になりました。</p>` +
        `</div>`
      );
    } else if (status === "accepted") {
      statusNote = `<p class="mvp-cal-assignment__status is-accepted">受諾済み — スレッドで進行中です。</p>`;
      const chatHref = project ? mvpCalendarThreadHref(project, "partner", state) : "";
      if (chatHref && !chatHref.includes("talk-home")) {
        actions =
          `<div class="mvp-cal-assignment__actions">` +
          `<a class="builder-btn builder-btn--primary" href="${esc(chatHref)}">スレッドへ</a>` +
          `</div>`;
      }
    } else if (pending && project) {
      statusNote = `<p class="mvp-cal-assignment__lead">案件内容を確認し、対応可否を判断してください。</p>`;
      actions =
        `<div class="mvp-cal-assignment__actions">` +
        `<button type="button" class="builder-btn builder-btn--primary" data-partner-assignment-accept data-project-id="${esc(
          project.project_id
        )}">受ける</button>` +
        `<button type="button" class="builder-btn builder-btn--outline" data-partner-assignment-decline data-project-id="${esc(
          project.project_id
        )}">受けない</button>` +
        `</div>`;
    }

    return (
      `<div class="mvp-cal-assignment mvp-cal-assignment--partner partner-assignment-card">` +
      `<div class="mvp-cal-detail__head"><h3 class="builder-section-title">仕事確認</h3></div>` +
      statusNote +
      `<dl class="mvp-cal-assignment__rows">` +
      renderPartnerCalendarFieldRows(view, { googleNavButton: true }) +
      `</dl>` +
      actions +
      `</div>`
    );
  }

  let partnerAssignmentPageWired = false;

  function wirePartnerAssignmentPage() {
    if (partnerAssignmentPageWired) return;
    partnerAssignmentPageWired = true;
    document.querySelector("[data-partner-assignment-detail]")?.addEventListener("click", (ev) => {
      const acceptBtn = ev.target?.closest?.("[data-partner-assignment-accept]");
      if (acceptBtn) {
        const projectId = acceptBtn.getAttribute("data-project-id") || "";
        const result = acceptCalendarAssignment(projectId);
        if (result.ok) {
          const st = mvp().reload();
          const project = st.projects?.find((p) => p.project_id === projectId) || result.project;
          const href = mvpCalendarThreadHref(project, "partner", st);
          const threadId = String(
            result.threadId || result.thread_id || project?.main_thread_id || ""
          ).trim();
          if (
            window.TasuBuilderBenchEmbed?.followPartnerAccepted?.(href, {
              projectId,
              threadId,
            })
          ) {
            renderPartnerAssignmentPage();
            return;
          }
          window.location.assign(href);
        }
        return;
      }
      const declineBtn = ev.target?.closest?.("[data-partner-assignment-decline]");
      if (declineBtn) {
        const projectId = declineBtn.getAttribute("data-project-id") || "";
        const result = declineCalendarAssignment(projectId);
        if (result.ok) {
          const declineHref = partnerAssignmentPageHref(projectId, {
            partnerId: getPartnerId() || undefined,
          });
          if (
            window.TasuBuilderBenchEmbed?.followPartnerDeclined?.(declineHref, { projectId })
          ) {
            renderPartnerAssignmentPage();
            return;
          }
          renderPartnerAssignmentPage();
        }
      }
    });
  }

  function renderPartnerAssignmentPage() {
    wirePartnerAssignmentPage();
    syncPartnerIdFromUrl();
    renderMvpRole();
    ensureAdminCalendarPartnerDemoData();
    const state = mvp().reload();
    const detail = document.querySelector("[data-partner-assignment-detail]");
    if (!detail) return;
    const projectId = getCalendarProjectIdParam();
    if (!projectId) {
      detail.innerHTML = `<p class="mvp-cal-detail__empty">案件が指定されていません。</p>`;
      return;
    }
    if (!isPartnerAssignedToCalendarProject(projectId, getPartnerId())) {
      detail.innerHTML = renderPartnerCalendarDeniedDetail(projectId);
      return;
    }
    const ctx = resolvePartnerCalendarDetailContext({ projectId }, state, projectId);
    if (!ctx || ctx.denied) {
      detail.innerHTML = renderPartnerCalendarDeniedDetail(projectId);
      return;
    }
    detail.innerHTML = renderPartnerAssignmentDetailOnly(ctx.project, ctx.spec, state, ctx.assignment);
  }

  function renderPartnerAcceptedScheduleList(state, partnerId) {
    const wrap = document.querySelector("[data-mvp-cal-partner-schedule]");
    const listEl = document.querySelector("[data-mvp-cal-partner-accepted-list]");
    const kpi = document.querySelector("[data-mvp-cal-partner-kpi]");
    const emptyEl = document.querySelector("[data-mvp-cal-partner-empty]");
    if (!wrap || !listEl) return;

    const monthKey = currentCalendarMonthKey();
    const benchOps = isOpsPartnerBenchEmbed();
    const entries = [];
    for (const a of filterCalendarAssignmentsForPartner(partnerId)) {
      const workDate = String(a.workDate || "").slice(0, 10);
      if (!benchOps && !workDate.startsWith(monthKey)) continue;
      const project = a.projectId ? (state.projects || []).find((p) => p.project_id === a.projectId) : null;
      if (!project || !isPartnerAssignmentProject(project, partnerId)) continue;
      const schedule = formatPartnerCalendarSchedule(a, state.specs?.[project.project_id] || null);
      const accepted = isPartnerAcceptedAssignment(project, partnerId);
      const pending = isPartnerPendingAssignment(project, partnerId);
      if (accepted) {
        const progress = getPartnerAssignmentProgressLabel(state, project);
        const threadHref = partnerAcceptedThreadHref(project, partnerId, state);
        if (!threadHref || !threadHref.includes("mvp-thread.html")) continue;
        entries.push({
          projectId: project.project_id,
          title: a.houseName || project.title || "—",
          schedule,
          progress,
          threadHref,
          workDate,
          pending: false,
        });
      } else if (pending && benchOps) {
        const benchProjectId = opsStateProjectIdForBench();
        if (project.project_id !== benchProjectId) continue;
        entries.push({
          projectId: project.project_id,
          assignmentId: a.id || "",
          title: a.houseName || project.title || "—",
          schedule,
          progress: "未回答",
          threadHref: "",
          workDate,
          pending: true,
        });
      }
    }
    entries.sort((a, b) => a.workDate.localeCompare(b.workDate) || a.title.localeCompare(b.title, "ja"));

    wrap.hidden = false;
    if (kpi) kpi.textContent = `${entries.length}件`;
    if (emptyEl) emptyEl.hidden = entries.length > 0;

    if (!entries.length) {
      listEl.innerHTML = "";
      return;
    }

    listEl.innerHTML = entries
      .map((row) => {
        if (row.pending) {
          return (
            `<li>` +
            `<div class="mvp-cal-partnerSchedule__card mvp-cal-partnerSchedule__card--pending" data-project-id="${esc(row.projectId)}">` +
            `<div class="mvp-cal-partnerSchedule__title">${esc(row.title)}</div>` +
            `<div class="mvp-cal-partnerSchedule__meta">` +
            `<span class="mvp-cal-partnerSchedule__date">${esc(row.schedule)}</span>` +
            `<span class="mvp-cal-partnerSchedule__status">${esc(row.progress)}</span>` +
            `</div>` +
            `<button type="button" class="mvp-cal-partnerSchedule__go" data-mvp-cal-open-assignment data-project-id="${esc(
              row.projectId
            )}" data-calendar-event-id="${esc(row.assignmentId)}">通知から案件を確認</button>` +
            `</div></li>`
          );
        }
        return (
          `<li>` +
          `<a class="mvp-cal-partnerSchedule__card" href="${esc(row.threadHref)}" data-mvp-cal-thread-link data-project-id="${esc(
            row.projectId
          )}">` +
          `<div class="mvp-cal-partnerSchedule__title">${esc(row.title)}</div>` +
          `<div class="mvp-cal-partnerSchedule__meta">` +
          `<span class="mvp-cal-partnerSchedule__date">${esc(row.schedule)}</span>` +
          `<span class="mvp-cal-partnerSchedule__status">${esc(row.progress)}</span>` +
          `</div>` +
          `<span class="mvp-cal-partnerSchedule__go">スレッドへ →</span>` +
          `</a></li>`
        );
      })
      .join("");
  }

  function syncMvpCalendarPartnerChrome(isPartner) {
    syncPageScheduleChromeClasses();
    const partnerView = isMvpCalendarPartnerBenchView(isPartner);
    document.body.classList.toggle("mvp-cal--partner", partnerView);
    document.body.classList.toggle("mvp-cal--partner-schedule", partnerView);
    const opsLayout = document.querySelector("[data-mvp-cal-ops-layout]");
    const partnerSchedule = document.querySelector("[data-mvp-cal-partner-schedule]");
    if (opsLayout) {
      opsLayout.hidden = Boolean(isPartner);
      opsLayout.style.display = isPartner ? "none" : "";
    }
    if (partnerSchedule) partnerSchedule.hidden = !isPartner;
    const sub = document.querySelector("[data-mvp-cal-header-sub]");
    if (sub) {
      sub.textContent = isPartner
        ? isOpsPartnerBenchEmbed()
          ? "未回答・受諾済みの予定確認"
          : "受諾済み案件の予定確認"
        : "公式カレンダー — 運営管理";
    }
    const layout = document.querySelector(".mvp-cal-layout");
    if (layout) layout.classList.toggle("mvp-cal-layout--partner", Boolean(isPartner));
    const heading = document.querySelector("[data-mvp-cal-detail-heading]");
    if (heading && !isPartner) heading.textContent = "現場詳細";
  }

  function renderMvpCalendarAdminDetail(project, spec, state) {
    const meta = getBuilderAssignmentMeta(project, spec);
    const partnerId =
      getProjectCalendarAssignedPartnerId(project) || (project.selected_partner_ids || [])[0] || "";
    const partnerName = partnerId ? partnerLabel(state, partnerId) : "—";
    const statusLabel = getCalendarAssignmentStatusLabel(project, state);
    const updatedAt = project.updated_at || project.created_at || "—";
    const chatHref = mvpCalendarThreadHref(project, "admin", state);
    const detailHref = `mvp-project-detail.html?id=${encodeURIComponent(project.project_id)}`;

    return (
      `<div class="mvp-cal-assignment mvp-cal-assignment--admin">` +
      `<div class="mvp-cal-detail__head"><h3 class="builder-section-title">案件確認（運営）</h3></div>` +
      `<dl class="mvp-cal-assignment__rows">` +
      `<div class="mvp-cal-assignment__row"><dt>案件名</dt><dd>${esc(meta.title)}</dd></div>` +
      `<div class="mvp-cal-assignment__row"><dt>担当者 / 協力会社</dt><dd>${esc(partnerName)}</dd></div>` +
      `<div class="mvp-cal-assignment__row"><dt>状態</dt><dd>${esc(statusLabel)}</dd></div>` +
      `<div class="mvp-cal-assignment__row"><dt>工期 / 日程</dt><dd>${esc(meta.schedule)}</dd></div>` +
      `<div class="mvp-cal-assignment__row"><dt>現場住所</dt><dd>${esc(meta.address)}</dd></div>` +
      `<div class="mvp-cal-assignment__row"><dt>最新更新</dt><dd>${esc(String(updatedAt))}</dd></div>` +
      `</dl>` +
      `<div class="mvp-cal-assignment__actions">` +
      `<a class="builder-btn builder-btn--secondary" href="${esc(chatHref)}">チャット確認</a>` +
      `<a class="builder-btn builder-btn--primary" href="${esc(detailHref)}">詳細確認</a>` +
      `<a class="builder-btn builder-btn--ghost" href="../talk-home.html?tab=notify">TASFUL TALK</a>` +
      `</div>` +
      `</div>`
    );
  }

  function acceptCalendarAssignment(projectId) {
    const pid = String(projectId || "").trim();
    if (!pid) return { ok: false };
    const api = mvp();
    const next = api.reload();
    const idx = (next.projects || []).findIndex((p) => p.project_id === pid);
    if (idx < 0) return { ok: false, error: "not_found" };
    const myPartnerId = getPartnerId();
    const threadId = ensureCalendarRequestThread(next, pid, myPartnerId);
    const project = {
      ...next.projects[idx],
      assignment_status: "accepted",
      updated_at: nowIso(),
      board_type: "calendar",
      projectKind: "calendar",
      calendar_assigned_partner_id:
        String(next.projects[idx]?.calendar_assigned_partner_id || myPartnerId || "").trim() || myPartnerId,
    };
    const selected = Array.isArray(project.selected_partner_ids) ? [...project.selected_partner_ids] : [];
    if (!selected.includes(myPartnerId)) selected.push(myPartnerId);
    project.selected_partner_ids = selected;
    if (threadId) project.main_thread_id = threadId;
    next.projects[idx] = project;
    api.commit(next);
    notifyCalendarAssignmentDecision(api, {
      project: next.projects[idx],
      partnerId: myPartnerId,
      selected: true,
      threadId,
    });
    return { ok: true, project: next.projects[idx], threadId };
  }

  function declineCalendarAssignment(projectId) {
    const pid = String(projectId || "").trim();
    if (!pid) return { ok: false };
    const api = mvp();
    const next = api.reload();
    const idx = (next.projects || []).findIndex((p) => p.project_id === pid);
    if (idx < 0) return { ok: false, error: "not_found" };
    const myPartnerId = getPartnerId();
    next.projects[idx] = {
      ...next.projects[idx],
      assignment_status: "declined",
      updated_at: nowIso(),
    };
    api.commit(next);
    notifyCalendarAssignmentDecision(api, {
      project: next.projects[idx],
      partnerId: myPartnerId,
      selected: false,
      threadId: null,
    });
    return { ok: true };
  }

  function getCalendarProjectIdParam() {
    return String(getParam("projectId") || getParam("project_id") || "").trim();
  }

  function getCalendarListItemClass(item, state, selectedId) {
    let cls = "builder-notif__item mvp-cal-listItem";
    if (item.id === selectedId) cls += " is-selected";
    if (item.kind === "assignment") cls += " is-assignment";
    if (item.projectId) {
      const project = (state.projects || []).find((p) => p.project_id === item.projectId);
      if (project?.assignment_status === "declined") cls += " is-declined";
      if (project?.assignment_status === "accepted") cls += " is-accepted";
    }
    return cls;
  }

  function isProjectVisibleOnPartnerCalendar(project, partnerId) {
    const pid = String(partnerId || "").trim();
    if (!pid || !project) return false;
    return getProjectCalendarAssignedPartnerId(project) === pid;
  }

  function sendCalendarAssignmentNotification(state, { project, partnerId, assignmentId }) {
    if (!project || !partnerId) return;
    const aid = String(assignmentId || "").trim();
    const mvpPid = adminPartnerToMvpPartnerId(partnerId) || partnerId;
    const calHref = partnerAssignmentPageHref(project.project_id, {
      partnerId: mvpPid,
      calendarEventId: aid,
    });
    mvp().pushNotification({
      type: "calendar_assignment",
      label: "現場予定追加",
      title: "現場予定を追加",
      to: mvpPid,
      project_id: project.project_id,
      projectTitle: project.title || "",
      thread_id: null,
      body: `${project.title || "現場"}の現場予定がカレンダーに追加されました。`,
      href: calHref,
      recipientRole: "partner",
      recipientPartnerId: mvpPid,
      partnerId: mvpPid,
      assignmentId: aid,
      projectKind: "calendar",
      board_type: "calendar",
    });
    dispatchMvpNotificationsChanged();
  }

  function assignAdminCalendarPartner(projectId, partnerId) {
    const pid = String(projectId || "").trim();
    const ppid = String(partnerId || "").trim();
    if (!pid || !ppid) return { ok: false, error: "invalid" };

    const api = mvp();
    const next = api.reload();
    const pidx = (next.projects || []).findIndex((p) => p.project_id === pid);
    if (pidx < 0) return { ok: false, error: "project_not_found" };

    const project = { ...next.projects[pidx] };
    project.calendar_assigned_partner_id = ppid;
    project.assignment_status = "pending";
    project.main_thread_id = null;
    project.board_type = project.board_type || "calendar";
    project.projectKind = project.projectKind || "calendar";
    const selected = Array.isArray(project.selected_partner_ids) ? [...project.selected_partner_ids] : [];
    if (!selected.includes(ppid)) selected.push(ppid);
    project.selected_partner_ids = selected;

    const assigned = getProjectAssignedPartners(project);
    if (!assigned.some((a) => a.partnerId === ppid)) {
      project.assignedPartners = [...assigned, { partnerId: ppid, assignedAt: nowIso() }];
    }

    next.projects[pidx] = project;
    api.commit(next);
    sendCalendarAssignmentNotification(next, { project, partnerId: ppid });
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    return { ok: true, project };
  }

  function createAdminCalendarProject(payload = {}) {
    const title = String(payload.title || "").trim();
    const partnerId = String(payload.partnerId || "").trim();
    const start = String(payload.start || "").trim() || ymdFromDate(new Date());
    const end = String(payload.end || "").trim() || start;
    const location = String(payload.location || "").trim() || "—";
    const instructions = String(payload.instructions || "").trim() || "—";
    const category = String(payload.category || "scaffold").trim();
    const fixedProjectId = String(payload.project_id || payload.projectId || "").trim();
    const fixedAssignmentId = String(payload.assignment_id || payload.assignmentId || "").trim();
    if (!title) return { ok: false, error: "title_required" };
    if (!partnerId) return { ok: false, error: "partner_required" };

    const api = mvp();
    const next = api.reload();
    if (fixedProjectId) {
      const existingProject = (next.projects || []).find((p) => p.project_id === fixedProjectId);
      const existingAssignment = fixedAssignmentId
        ? getAdminCalendarAssignments().find((a) => a.id === fixedAssignmentId)
        : null;
      if (existingProject && existingAssignment) {
        if (isOpsBenchSession()) {
          const pidx = (next.projects || []).findIndex((p) => p.project_id === fixedProjectId);
          if (pidx >= 0) {
            next.projects[pidx] = {
              ...next.projects[pidx],
              assignment_status: "pending",
              main_thread_id: null,
              calendar_assigned_partner_id: partnerId,
            };
            api.commit(next);
          }
        }
        return {
          ok: true,
          project_id: fixedProjectId,
          assignment_id: existingAssignment.id,
          thread_id: isOpsBenchSession() ? null : existingProject.main_thread_id || null,
          duplicate: true,
        };
      }
    }
    const project_id = fixedProjectId || uid("proj-cal");
    const ts = nowIso();
    const existingProjectIdx = (next.projects || []).findIndex((p) => p.project_id === project_id);

    const project = {
      ...(existingProjectIdx >= 0 ? next.projects[existingProjectIdx] : {}),
      project_id,
      owner_id: next.owner_id || OWNER_ID,
      title,
      kind: "builder_board",
      board_type: "calendar",
      projectKind: "calendar",
      type: "calendar",
      status: "open",
      required_partners: 1,
      selected_partner_ids: [partnerId],
      calendar_assigned_partner_id: partnerId,
      assignment_status: "pending",
      assignedPartners: [{ partnerId, assignedAt: ts }],
      visibility: "partner_only",
      contact_policy: "tasful_talk_only",
      main_thread_id: isOpsBenchSession() ? null : existingProjectIdx >= 0 ? next.projects[existingProjectIdx].main_thread_id || null : null,
      source: "admin_calendar",
      source_template_id: null,
      created_at: existingProjectIdx >= 0 ? next.projects[existingProjectIdx].created_at || ts : ts,
    };

    if (existingProjectIdx >= 0) {
      next.projects = [...next.projects];
      next.projects[existingProjectIdx] = project;
    } else {
      next.projects = [...(next.projects || []), project];
    }
    next.specs = {
      ...(next.specs || {}),
      [project_id]: {
        trade_tags: [category],
        area: { label: location.split("（")[0] || location },
        site_address: location,
        period: { start, end },
        reward: payload.reward || "応相談",
        description: instructions,
        overview: instructions,
        work_content: instructions,
        notes: "運営カレンダーから登録された案件です。",
        attachments: [],
      },
    };

    const partner =
      getAdminPartnerById(partnerId) ||
      (next.partners || []).find((p) => p.partner_id === partnerId);
    const partnerName =
      payload.partnerName ||
      partner?.display_name ||
      partner?.companyName ||
      partnerLabel(next, partnerId);
    const assignment = normalizeCalendarAssignment({
      id: fixedAssignmentId || uid("calendar-job"),
      projectId: project_id,
      partnerId,
      partnerName,
      houseName: title,
      workDate: start.slice(0, 10),
      startTime: payload.startTime || "09:00",
      endTime: payload.endTime || "17:00",
      siteAddress: location,
      googleMapUrl: location && location !== "—" ? buildGoogleMapSearchUrl(location) : "",
      notes: String(payload.memo || payload.notes || instructions).trim() || instructions,
      summary: instructions,
      status: "assigned",
      instructionPdf: payload.instructionPdf || null,
      parkingPdf: payload.parkingPdf || null,
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      createdAt: ts,
      updatedAt: ts,
    });
    saveAdminCalendarAssignments([assignment, ...getAdminCalendarAssignments()]);

    api.commit(next);
    if (!payload.skipNotification) {
      sendCalendarAssignmentNotification(next, {
        project,
        partnerId,
        assignmentId: assignment.id,
      });
    }
    if (isOpsBenchSession()) {
      try {
        globalThis.sessionStorage.setItem("tasu:builder:ops-bench-focus-date", start.slice(0, 10));
      } catch {
        /* ignore */
      }
    }
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    document.dispatchEvent(new CustomEvent("builder:admin-calendar-assignments-changed"));
    return { ok: true, project_id, assignment_id: assignment.id, thread_id: null };
  }

  function renderAdminCalendarPartnerPick(state, ev) {
    const partners = (state.partners || DEMO_PARTNERS).slice();
    const selected = ev?.assignedPartner?.id || "";
    return (
      `<section class="admin-cal-card__section admin-cal-partnerSection">` +
      `<h3>担当パートナー選択</h3>` +
      `<p class="admin-cal-partnerSection__hint">選択したパートナーのみカレンダー反映・通知されます。</p>` +
      `<ul class="admin-cal-partnerPick">` +
      partners
        .map(
          (p) =>
            `<li>` +
            `<label class="admin-cal-partnerPick__item">` +
            `<input type="radio" name="admin-cal-partner" value="${esc(p.partner_id)}"${selected === p.partner_id ? " checked" : ""} />` +
            `<span>${esc(p.display_name || p.partner_id)}</span>` +
            `</label></li>`
        )
        .join("") +
      `</ul>` +
      `<div class="admin-cal-partnerActions">` +
      `<button type="button" class="builder-btn builder-btn--primary" data-admin-cal-assign-notify data-project-id="${esc(ev.id)}">手配して通知</button>` +
      `</div>` +
      `</section>`
    );
  }

  function populateAdminCalendarAddForm() {
    const partnerSel = document.querySelector("[data-admin-cal-add-partner]");
    if (partnerSel) {
      const state = mvp().reload();
      const partners = (state.partners || DEMO_PARTNERS).slice();
      const val = partnerSel.value;
      partnerSel.innerHTML =
        `<option value="">選択してください</option>` +
        partners
          .map((p) => `<option value="${esc(p.partner_id)}">${esc(p.display_name || p.partner_id)}</option>`)
          .join("");
      if (val) partnerSel.value = val;
    }
    const today = ymdFromDate(new Date());
    const startInput = document.querySelector("[data-admin-cal-add-start]");
    const endInput = document.querySelector("[data-admin-cal-add-end]");
    const anchorDate = adminCalendarUi.selectedDate || today;
    if (startInput && !startInput.value) startInput.value = anchorDate;
    if (endInput && !endInput.value) endInput.value = startInput?.value || anchorDate;
  }

  let adminCalendarPageWired = false;
  let adminCalendarCompletePending = [];
  let adminCalendarEventsCache = [];
  let adminCalendarAssignmentPreviewVisible = false;
  let adminCalendarAssignmentPreviewData = null;
  let adminCalendarUi = {
    view: "month",
    anchor: new Date(),
    selectedDate: "",
    selectedEventId: null,
    filters: { assignee: "", category: "", status: "", dateFrom: "", dateTo: "" },
  };

  function ymdFromDate(d) {
    const x = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(x.getTime())) return "";
    return x.toISOString().slice(0, 10);
  }

  function parseYmd(s) {
    const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function startOfWeekMonday(d) {
    const x = new Date(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function adminCalendarEventStatus(state, project) {
    const thread = state.threads?.[project?.main_thread_id];
    const siteDone = normalizeMvpThreadSiteData(thread?.siteData).completed;
    const computed = computeProjectStatus(state, project);
    if (siteDone || computed === "completed" || computed === "invoiced") return "completed";
    const selected =
      (Array.isArray(project?.selected_partner_ids) && project.selected_partner_ids.length) ||
      getProjectAssignedPartners(project).length ||
      isProjectDispatched(project);
    if (selected) return "assigned";
    return "unassigned";
  }

  function buildAdminCalendarEvents(state) {
    if (shouldSeedAdminCalendarDisplayData()) {
      ensureMvpThreadsDemoData(mvp());
    }
    const events = [];
    for (const p of state.projects || []) {
      const spec = getProjectSpec(state, p.project_id);
      const status = adminCalendarEventStatus(state, p);
      const partnerId =
        getProjectCalendarAssignedPartnerId(p) ||
        (p.selected_partner_ids || [])[0] ||
        getProjectAssignedPartners(p)[0]?.partnerId ||
        (p.assignedPartners || [])[0]?.partnerId ||
        null;
      const partnerName = partnerId ? partnerLabel(state, partnerId) : "";
      const trades = spec.trades?.length ? spec.trades : (spec.trade_tags || []).map(formatTrade);
      const category = trades.length ? trades.join("・") : "—";
      const start = spec.period?.start || String(p.created_at || "").slice(0, 10) || ymdFromDate(new Date());
      const end = spec.period?.end || start;
      const notes = [];
      if (spec.notes) notes.push(String(spec.notes));
      if (spec.preferred_conditions) notes.push(String(spec.preferred_conditions));
      const location = spec.site_address || spec.areaLabel || spec.area?.label || "—";
      events.push({
        id: p.project_id,
        kind: "project",
        title: p.title || p.project_id,
        start,
        end,
        status,
        category,
        assignee: partnerName || "未割当",
        assignedPartner: partnerId
          ? { id: partnerId, name: partnerName, type: "partner" }
          : null,
        location,
        instructions: spec.work_content || spec.overview || spec.description || "—",
        notes,
        attachments: Array.isArray(spec.attachments) ? spec.attachments : [],
        threadId: p.main_thread_id || "",
        projectId: p.project_id,
      });
    }
    for (const assignment of getAdminCalendarAssignments()) {
      events.push(calendarAssignmentToAdminEvent(assignment, state));
    }
    return events.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  }

  function adminCalendarEventOnDate(ev, ymd) {
    if (!ev?.start || !ymd) return false;
    const end = ev.end || ev.start;
    return ymd >= ev.start && ymd <= end;
  }

  function filterAdminCalendarEvents(events) {
    const f = adminCalendarUi.filters;
    return events.filter((ev) => {
      if (f.status && ev.status !== f.status) return false;
      if (f.category && ev.category !== f.category) return false;
      if (f.assignee) {
        if (f.assignee === "未割当" && ev.assignee !== "未割当") return false;
        if (f.assignee !== "未割当" && ev.assignee !== f.assignee) return false;
      }
      if (f.dateFrom && ev.end < f.dateFrom) return false;
      if (f.dateTo && ev.start > f.dateTo) return false;
      return true;
    });
  }

  function adminCalendarStatusLabel(status) {
    if (status === "assigned") return "手配済み";
    if (status === "completed") return "完了";
    return "未手配";
  }

  function adminCalendarMapsEmbedUrl(location) {
    const q = encodeURIComponent(String(location || "東京都"));
    return `https://maps.google.com/maps?q=${q}&z=15&output=embed`;
  }

  function renderAdminCalendarDetail(ev, state) {
    if (!ev) {
      return `<p class="admin-cal-detail__empty">日付または案件を選択してください。</p>`;
    }
    if (ev.kind === "assignment" && ev.assignment) {
      return renderAdminCalendarAssignmentDetail(ev, state);
    }
    const notesHtml = ev.notes?.length
      ? `<ul>${ev.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
      : `<p>—</p>`;
    const attachHtml = ev.attachments?.length
      ? `<ul class="admin-cal-attachments">${ev.attachments
          .map(
            (a, i) =>
              `<li><button type="button" class="admin-cal-attachments__btn" data-admin-cal-attach-index="${i}">` +
              `<span>${esc(a.type === "pdf" ? "PDF" : a.type === "image" ? "画像" : "FILE")}</span>` +
              `<span>${esc(a.name || "—")}</span></button></li>`
          )
          .join("")}</ul>`
      : `<p>—</p>`;
    return (
      `<article class="admin-cal-card" data-admin-cal-event-id="${esc(ev.id)}">` +
      `<span class="admin-cal-card__status admin-cal-card__status--${esc(ev.status)}">${esc(adminCalendarStatusLabel(ev.status))}</span>` +
      `<h3 class="builder-section-title">${esc(ev.title)}</h3>` +
      `<div class="admin-cal-card__meta">` +
      `<span>期間: ${esc(ev.start)} 〜 ${esc(ev.end)}</span>` +
      `<span>カテゴリ: ${esc(ev.category)}</span>` +
      `<span>担当: ${esc(ev.assignee)}</span>` +
      `</div>` +
      renderAdminCalendarPartnerPick(state || mvp().reload(), ev) +
      `<section class="admin-cal-card__section"><h3>指示書</h3><p>${esc(ev.instructions)}</p></section>` +
      `<section class="admin-cal-card__section"><h3>現場住所</h3><p>${esc(ev.location)}</p>` +
      `<iframe class="admin-cal-map" title="Google Maps" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(adminCalendarMapsEmbedUrl(ev.location))}"></iframe></section>` +
      `<section class="admin-cal-card__section"><h3>注意事項</h3>${notesHtml}</section>` +
      `<section class="admin-cal-card__section"><h3>添付資料</h3>${attachHtml}</section>` +
      renderSitePhotoHistoryForThreadId(ev.threadId, state || mvp().reload()) +
      renderThreadPdfOutputsForCalendar(ev.threadId, state || mvp().reload()) +
      `</article>`
    );
  }

  function syncAdminCalendarActionLinks(ev) {
    const threadLinks = document.querySelectorAll("[data-admin-cal-thread-link], [data-admin-cal-footer-thread]");
    const completeBtns = document.querySelectorAll("[data-admin-cal-complete-open], [data-admin-cal-footer-complete]");
    const show = Boolean(ev?.threadId);
    threadLinks.forEach((el) => {
      if (!show) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.href = mvpThreadHref(ev.threadId, "owner");
    });
    const canComplete = show && ev?.kind !== "assignment" && ev.status !== "completed";
    completeBtns.forEach((el) => {
      el.hidden = !canComplete;
      if (canComplete) el.dataset.threadId = ev.threadId;
    });
  }

  function renderAdminCalendarPage() {
    syncPageScheduleChromeClasses();
    const api = mvp();
    if (shouldSeedAdminCalendarDisplayData()) {
      ensureMvpThreadsDemoData(api);
      ensureAdminPartnersDemoData();
      ensureAdminCalendarPartnerDemoData();
    }
    wireAdminCalendarPage();
    const state = api.reload();
    adminCalendarEventsCache = buildAdminCalendarEvents(state);
    const events = filterAdminCalendarEvents(adminCalendarEventsCache);

    const grid = document.querySelector("[data-admin-cal-grid]");
    const detail = document.querySelector("[data-admin-cal-detail]");
    const periodLabel = document.querySelector("[data-admin-cal-period-label]");
    const kpi = document.querySelector("[data-admin-cal-kpi]");
    if (!grid || !detail) return;

    if (!adminCalendarUi.selectedDate) adminCalendarUi.selectedDate = ymdFromDate(new Date());
    if (isAdminCalOpsBenchEmbed()) {
      try {
        const focusDate = globalThis.sessionStorage.getItem("tasu:builder:ops-bench-focus-date");
        if (focusDate) {
          adminCalendarUi.selectedDate = focusDate;
          adminCalendarUi.anchor = new Date(`${focusDate}T12:00:00`);
          const focusEv = events.find((e) => adminCalendarEventOnDate(e, focusDate));
          if (focusEv) adminCalendarUi.selectedEventId = focusEv.id;
          globalThis.sessionStorage.removeItem("tasu:builder:ops-bench-focus-date");
        }
      } catch {
        /* ignore */
      }
    }
    const selectedEv =
      adminCalendarEventsCache.find((e) => e.id === adminCalendarUi.selectedEventId) ||
      events.find((e) => e.id === adminCalendarUi.selectedEventId) ||
      null;

    populateAdminCalendarFilters(adminCalendarEventsCache);

    if (adminCalendarUi.view === "month") {
      renderAdminCalendarMonthGrid(grid, events);
      if (periodLabel) {
        periodLabel.textContent = `${adminCalendarUi.anchor.getFullYear()}年 ${adminCalendarUi.anchor.getMonth() + 1}月`;
      }
    } else if (adminCalendarUi.view === "week") {
      renderAdminCalendarWeekGrid(grid, events);
      const ws = startOfWeekMonday(adminCalendarUi.anchor);
      const we = addDays(ws, 6);
      if (periodLabel) periodLabel.textContent = `${ymdFromDate(ws)} 〜 ${ymdFromDate(we)}`;
    } else {
      renderAdminCalendarDayGrid(grid, events);
      if (periodLabel) periodLabel.textContent = adminCalendarUi.selectedDate || ymdFromDate(adminCalendarUi.anchor);
    }

    if (kpi) kpi.textContent = `${events.length} 件`;

    detail.innerHTML = selectedEv
      ? renderAdminCalendarDetail(selectedEv, state)
      : renderAdminCalendarDayDetail(events, adminCalendarUi.selectedDate, state);
    syncAdminCalendarActionLinks(selectedEv);

    document.querySelectorAll("[data-admin-cal-view]").forEach((btn) => {
      const v = btn.getAttribute("data-admin-cal-view");
      const active = v === adminCalendarUi.view;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    restoreAssignmentPreviewIfVisible();
    mountAdminCsvExport(document.querySelector("[data-admin-cal-csv-export-host]"));
  }

  function renderAdminCalendarDayDetail(events, ymd, state) {
    const dayEvents = events.filter((e) => adminCalendarEventOnDate(e, ymd));
    if (!dayEvents.length) {
      return `<p class="admin-cal-detail__empty">${esc(ymd || "—")} の案件はありません。</p>`;
    }
    return dayEvents.map((ev) => renderAdminCalendarDetail(ev, state)).join("");
  }

  function renderAdminCalendarMonthGrid(grid, events) {
    const y = adminCalendarUi.anchor.getFullYear();
    const m = adminCalendarUi.anchor.getMonth();
    const first = new Date(y, m, 1);
    const start = startOfWeekMonday(first);
    const weeks = [];
    let cursor = new Date(start);
    for (let w = 0; w < 6; w++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        row.push(new Date(cursor));
        cursor = addDays(cursor, 1);
      }
      weeks.push(row);
      if (cursor.getMonth() !== m && cursor.getDate() > 7) break;
    }
    const weekdays = ["月", "火", "水", "木", "金", "土", "日"];
    let html = `<div class="admin-cal-monthHead">${weekdays.map((w) => `<span>${w}</span>`).join("")}</div><div class="admin-cal-monthBody">`;
    for (const row of weeks) {
      for (const day of row) {
        const ymd = ymdFromDate(day);
        const inMonth = day.getMonth() === m;
        const dayEvents = events.filter((e) => adminCalendarEventOnDate(e, ymd));
        const isSelected = ymd === adminCalendarUi.selectedDate;
        const isToday = ymd === ymdFromDate(new Date());
        html +=
          `<div class="admin-cal-day${inMonth ? "" : " is-outside"}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}" data-admin-cal-date="${esc(ymd)}" role="button" tabindex="0">` +
          `<div class="admin-cal-day__num">${day.getDate()}</div>` +
          (dayEvents.length ? `<div class="admin-cal-day__count">${dayEvents.length} 件</div>` : "") +
          dayEvents
            .slice(0, 3)
            .map(
              (ev) =>
                `<button type="button" class="admin-cal-badge admin-cal-badge--${esc(ev.status)}${adminCalendarUi.selectedEventId === ev.id ? " is-selected" : ""}" data-admin-cal-event="${esc(ev.id)}">${esc(ev.title)}</button>`
            )
            .join("") +
          (dayEvents.length > 3 ? `<div class="admin-cal-day__count">+${dayEvents.length - 3}</div>` : "") +
          `</div>`;
      }
    }
    html += `</div>`;
    grid.innerHTML = html;
  }

  function renderAdminCalendarWeekGrid(grid, events) {
    const ws = startOfWeekMonday(adminCalendarUi.anchor);
    const weekdays = ["月", "火", "水", "木", "金", "土", "日"];
    let html = `<div class="admin-cal-weekHead">${weekdays.map((w) => `<span>${w}</span>`).join("")}</div><div class="admin-cal-weekBody">`;
    for (let i = 0; i < 7; i++) {
      const day = addDays(ws, i);
      const ymd = ymdFromDate(day);
      const dayEvents = events.filter((e) => adminCalendarEventOnDate(e, ymd));
      const isSelected = ymd === adminCalendarUi.selectedDate;
      html +=
        `<div class="admin-cal-weekDay${isSelected ? " is-selected" : ""}">` +
        `<button type="button" class="admin-cal-day__num" data-admin-cal-date="${esc(ymd)}">${ymd.slice(5)} (${weekdays[i]})</button>` +
        dayEvents
          .map(
            (ev) =>
              `<button type="button" class="admin-cal-badge admin-cal-badge--${esc(ev.status)}${adminCalendarUi.selectedEventId === ev.id ? " is-selected" : ""}" data-admin-cal-event="${esc(ev.id)}">${esc(ev.title)}</button>`
          )
          .join("") +
        `</div>`;
    }
    html += `</div>`;
    grid.innerHTML = html;
  }

  function renderAdminCalendarDayGrid(grid, events) {
    const ymd = adminCalendarUi.selectedDate || ymdFromDate(adminCalendarUi.anchor);
    const dayEvents = events.filter((e) => adminCalendarEventOnDate(e, ymd));
    grid.innerHTML =
      `<div class="admin-cal-dayView is-selected">` +
      `<div class="admin-cal-day__num">${esc(ymd)}</div>` +
      (dayEvents.length
        ? dayEvents
            .map(
              (ev) =>
                `<button type="button" class="admin-cal-badge admin-cal-badge--${esc(ev.status)}${adminCalendarUi.selectedEventId === ev.id ? " is-selected" : ""}" data-admin-cal-event="${esc(ev.id)}">${esc(ev.title)} · ${esc(adminCalendarStatusLabel(ev.status))}</button>`
            )
            .join("")
        : `<p class="admin-cal-detail__empty">この日の案件はありません。</p>`) +
      `</div>`;
  }

  function populateAdminCalendarFilters(allEvents) {
    const assigneeSel = document.querySelector("[data-admin-cal-filter-assignee]");
    const catSel = document.querySelector("[data-admin-cal-filter-category]");
    if (!assigneeSel || !catSel) return;
    const assignees = [...new Set(allEvents.map((e) => e.assignee).filter(Boolean))].sort();
    const categories = [...new Set(allEvents.map((e) => e.category).filter(Boolean))].sort();
    const aVal = assigneeSel.value;
    const cVal = catSel.value;
    assigneeSel.innerHTML =
      `<option value="">すべて</option>` + assignees.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join("");
    catSel.innerHTML =
      `<option value="">すべて</option>` + categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    assigneeSel.value = aVal;
    catSel.value = cVal;
  }

  function wireAdminCalendarPage() {
    wireThreadPdfOutputActions();
    if (adminCalendarPageWired) return;
    adminCalendarPageWired = true;

    document.querySelector("[data-admin-cal-grid]")?.addEventListener("click", (ev) => {
      const eventBtn = ev.target?.closest?.("[data-admin-cal-event]");
      const dateBtn = ev.target?.closest?.("[data-admin-cal-date]");
      if (eventBtn) {
        ev.stopPropagation();
        hideAssignmentPreview();
        adminCalendarUi.selectedEventId = eventBtn.getAttribute("data-admin-cal-event");
        const parentDate = eventBtn.closest("[data-admin-cal-date]")?.getAttribute("data-admin-cal-date");
        if (parentDate) adminCalendarUi.selectedDate = parentDate;
        renderAdminCalendarPage();
        return;
      }
      if (dateBtn) {
        adminCalendarUi.selectedDate = dateBtn.getAttribute("data-admin-cal-date") || "";
        adminCalendarUi.selectedEventId = null;
        renderAdminCalendarPage();
      }
    });

    document.querySelector("[data-admin-cal-detail]")?.addEventListener("click", (ev) => {
      const pdfBtn = ev.target?.closest?.("[data-admin-cal-assignment-pdf]");
      if (pdfBtn) {
        const card = pdfBtn.closest("[data-admin-cal-event-id]");
        const eventId = card?.getAttribute("data-admin-cal-event-id");
        const event = adminCalendarEventsCache.find((e) => e.id === eventId);
        const kind = pdfBtn.getAttribute("data-admin-cal-assignment-pdf");
        const file =
          kind === "parking" ? event?.assignment?.parkingPdf : event?.assignment?.instructionPdf;
        if (file) openAdminCalendarAttachmentPreview(file);
        return;
      }
      const assignBtn = ev.target?.closest?.("[data-admin-cal-assign-notify]");
      if (assignBtn) {
        const projectId = assignBtn.getAttribute("data-project-id");
        const card = assignBtn.closest("[data-admin-cal-event-id]");
        const partnerId = card?.querySelector('input[name="admin-cal-partner"]:checked')?.value;
        if (!partnerId) {
          alert("担当パートナーを選択してください。");
          return;
        }
        const result = assignAdminCalendarPartner(projectId, partnerId);
        if (!result.ok) {
          alert("手配に失敗しました。");
          return;
        }
        alert(`${partnerLabel(mvp().reload(), partnerId)} に手配・通知しました。`);
        renderAdminCalendarPage();
        return;
      }
      const attachBtn = ev.target?.closest?.("[data-admin-cal-attach-index]");
      if (!attachBtn) return;
      const card = attachBtn.closest("[data-admin-cal-event-id]");
      const eventId = card?.getAttribute("data-admin-cal-event-id");
      const event = adminCalendarEventsCache.find((e) => e.id === eventId);
      const idx = Number(attachBtn.getAttribute("data-admin-cal-attach-index"));
      const file = event?.attachments?.[idx];
      if (!file) return;
      openAdminCalendarAttachmentPreview(file);
    });

    document.querySelectorAll("[data-admin-cal-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        adminCalendarUi.view = btn.getAttribute("data-admin-cal-view") || "month";
        renderAdminCalendarPage();
      });
    });

    document.querySelector("[data-admin-cal-prev]")?.addEventListener("click", () => {
      if (adminCalendarUi.view === "month") adminCalendarUi.anchor = addDays(adminCalendarUi.anchor, -30);
      else if (adminCalendarUi.view === "week") adminCalendarUi.anchor = addDays(adminCalendarUi.anchor, -7);
      else adminCalendarUi.selectedDate = ymdFromDate(addDays(parseYmd(adminCalendarUi.selectedDate) || adminCalendarUi.anchor, -1));
      renderAdminCalendarPage();
    });

    document.querySelector("[data-admin-cal-next]")?.addEventListener("click", () => {
      if (adminCalendarUi.view === "month") adminCalendarUi.anchor = addDays(adminCalendarUi.anchor, 30);
      else if (adminCalendarUi.view === "week") adminCalendarUi.anchor = addDays(adminCalendarUi.anchor, 7);
      else adminCalendarUi.selectedDate = ymdFromDate(addDays(parseYmd(adminCalendarUi.selectedDate) || adminCalendarUi.anchor, 1));
      renderAdminCalendarPage();
    });

    document.querySelector("[data-admin-cal-today]")?.addEventListener("click", () => {
      adminCalendarUi.anchor = new Date();
      adminCalendarUi.selectedDate = ymdFromDate(new Date());
      renderAdminCalendarPage();
    });

    const readFilters = () => {
      adminCalendarUi.filters = {
        assignee: document.querySelector("[data-admin-cal-filter-assignee]")?.value || "",
        category: document.querySelector("[data-admin-cal-filter-category]")?.value || "",
        status: document.querySelector("[data-admin-cal-filter-status]")?.value || "",
        dateFrom: document.querySelector("[data-admin-cal-filter-from]")?.value || "",
        dateTo: document.querySelector("[data-admin-cal-filter-to]")?.value || "",
      };
      renderAdminCalendarPage();
    };

    document.querySelector("[data-admin-cal-filters]")?.addEventListener("change", readFilters);
    document.querySelector("[data-admin-cal-filter-reset]")?.addEventListener("click", () => {
      adminCalendarUi.filters = { assignee: "", category: "", status: "", dateFrom: "", dateTo: "" };
      const form = document.querySelector("[data-admin-cal-filters]");
      form?.querySelectorAll("select, input").forEach((el) => {
        if (el.tagName === "SELECT") el.selectedIndex = 0;
        else el.value = "";
      });
      renderAdminCalendarPage();
    });

    window.addEventListener("storage", (event) => {
      if (
        event.key !== MVP_THREADS_STORAGE_KEY &&
        event.key !== MVP_STORAGE_KEY &&
        event.key !== ADMIN_CALENDAR_ASSIGNMENTS_KEY
      ) {
        return;
      }
      renderAdminCalendarPage();
    });

    const completeModal = document.querySelector("[data-admin-cal-complete-modal]");
    const completeForm = document.querySelector("[data-admin-cal-complete-form]");
    const completePhotos = document.querySelector("[data-admin-cal-complete-photos]");
    const completePending = document.querySelector("[data-admin-cal-complete-pending]");
    const completeConsent = document.querySelector("[data-admin-cal-complete-consent]");

    const renderCompletePending = () => {
      if (!completePending) return;
      if (!adminCalendarCompletePending.length) {
        completePending.hidden = true;
        completePending.innerHTML = "";
        return;
      }
      completePending.hidden = false;
      completePending.innerHTML = adminCalendarCompletePending
        .map((p, i) => `<span class="mvp-thread-compose__pendingItem">${esc(p.name)} <button type="button" data-cal-pending-index="${i}">×</button></span>`)
        .join("");
    };

    document.querySelectorAll("[data-admin-cal-complete-open], [data-admin-cal-footer-complete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (completeModal) completeModal.hidden = false;
      });
    });

    completeModal?.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("[data-admin-cal-complete-close]") || ev.target === completeModal) {
        completeModal.hidden = true;
      }
    });

    completePhotos?.addEventListener("change", () => {
      Array.from(completePhotos.files || []).forEach((f) => {
        adminCalendarCompletePending.push({
          name: f.name || "photo.jpg",
          type: "image",
          url: "",
        });
      });
      completePhotos.value = "";
      renderCompletePending();
    });

    completePending?.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-cal-pending-index]");
      if (!btn) return;
      adminCalendarCompletePending.splice(Number(btn.getAttribute("data-cal-pending-index")), 1);
      renderCompletePending();
    });

    completeForm?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const tid = adminCalendarEventsCache.find((e) => e.id === adminCalendarUi.selectedEventId)?.threadId || "";
      const result = markMvpThreadCompleted(adminCalendarCompletePending.slice(), Boolean(completeConsent?.checked), tid);
      if (!result.ok) {
        if (result.error === "consent_required") alert("作業完了に同意してください。");
        else if (result.error === "already_completed") alert("この案件は既に完了しています。");
        else alert("完了処理に失敗しました。");
        return;
      }
      adminCalendarCompletePending = [];
      renderCompletePending();
      if (completeModal) completeModal.hidden = true;
      if (completeConsent) completeConsent.checked = false;
      hideAssignmentPreview();
      alert("作業を完了し、請求書PDFを生成しました。");
      renderAdminCalendarPage();
    });

    document.querySelector("[data-admin-cal-assignment-preview-complete]")?.addEventListener("click", () => {
      const btn = document.querySelector("[data-admin-cal-assignment-preview-complete]");
      const previewKind = btn?.dataset.previewKind || "assignment";
      const assignmentId = btn?.dataset.assignmentId || adminCalendarAssignmentPreviewData?.id || "";
      if (previewKind === "assignment" && assignmentId) {
        const result = markAssignmentCompleted(assignmentId);
        if (!result.ok) {
          hideAssignmentPreview();
          renderAdminCalendarPage();
          return;
        }
        renderAdminCalendarPage();
        return;
      }
      hideAssignmentPreview();
    });

    document.querySelector("[data-admin-cal-preview-close]")?.addEventListener("click", () => {
      const modal = document.querySelector("[data-admin-cal-preview-modal]");
      if (modal) modal.hidden = true;
    });
    document.querySelector("[data-admin-cal-preview-modal]")?.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("[data-admin-cal-preview-close]") || ev.target === ev.currentTarget) {
        ev.currentTarget.hidden = true;
      }
    });

    const addModal = document.querySelector("[data-admin-cal-add-modal]");
    const addForm = document.querySelector("[data-admin-cal-add-form]");

    document.querySelector("[data-admin-cal-add-open]")?.addEventListener("click", () => {
      populateAdminCalendarAddForm();
      if (addModal) addModal.hidden = false;
    });

    addModal?.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("[data-admin-cal-add-close]") || ev.target === addModal) {
        addModal.hidden = true;
      }
    });

    addForm?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const title = document.querySelector("[data-admin-cal-add-title]")?.value || "";
      const start = document.querySelector("[data-admin-cal-add-start]")?.value || "";
      const end = document.querySelector("[data-admin-cal-add-end]")?.value || "";
      const partnerId = document.querySelector("[data-admin-cal-add-partner]")?.value || "";
      const category = document.querySelector("[data-admin-cal-add-category]")?.value || "scaffold";
      const location = document.querySelector("[data-admin-cal-add-location]")?.value || "";
      const instructions = document.querySelector("[data-admin-cal-add-instructions]")?.value || "";
      const result = createAdminCalendarProject({ title, start, end, partnerId, category, location, instructions });
      if (!result.ok) {
        if (result.error === "title_required") alert("案件名を入力してください。");
        else if (result.error === "partner_required") alert("担当パートナーを選択してください。");
        else alert("登録に失敗しました。");
        return;
      }
      adminCalendarUi.selectedEventId = result.project_id;
      adminCalendarUi.selectedDate = start || adminCalendarUi.selectedDate;
      addForm.reset();
      if (addModal) addModal.hidden = true;
      const state = mvp().reload();
      showAssignmentPreview({
        id: result.project_id,
        previewKind: "project",
        houseName: title,
        workDate: start,
        endTime: end !== start ? end : "",
        partnerName: partnerLabel(state, partnerId),
        notes: instructions || "—",
      });
      renderAdminCalendarPage();
    });

    let adminCalendarAssignmentPartnerId = "";
    let adminCalendarAssignmentInstructionPdf = null;
    let adminCalendarAssignmentParkingPdf = null;

    const assignmentModal = document.querySelector("[data-admin-cal-assignment-modal]");
    const assignmentForm = document.querySelector("[data-admin-cal-assignment-form]");
    const assignmentPartnerList = document.querySelector("[data-admin-cal-assignment-partner-list]");
    const assignmentPartnerFiltersHost = document.querySelector("[data-admin-cal-partner-filters]");

    const refreshAssignmentPartnerList = () => {
      if (!assignmentPartnerList) return;
      assignmentPartnerList.innerHTML = renderCalendarPartnerCandidateList(
        getAdminPartners(),
        adminCalendarAssignmentPartnerId,
        readCalendarPartnerFiltersFromDom()
      );
    };

    const renderAssignmentPartnerFilters = () => {
      if (!assignmentPartnerFiltersHost) return;
      assignmentPartnerFiltersHost.innerHTML = renderCalendarPartnerFilters();
    };

    const populateAdminCalendarAssignmentForm = () => {
      ensureAdminPartnersDemoData();
      adminCalendarAssignmentPartnerId = "";
      adminCalendarAssignmentInstructionPdf = null;
      adminCalendarAssignmentParkingPdf = null;
      renderAssignmentPartnerFilters();
      const workDateInput = document.querySelector("[data-admin-cal-assignment-work-date]");
      const anchorDate = adminCalendarUi.selectedDate || ymdFromDate(new Date());
      if (workDateInput) workDateInput.value = anchorDate;
      assignmentForm?.reset();
      if (workDateInput) workDateInput.value = anchorDate;
      refreshAssignmentPartnerList();
    };

    const openAdminCalendarAssignmentModal = () => {
      populateAdminCalendarAssignmentForm();
      if (!assignmentModal) return;
      assignmentModal.hidden = false;
      document.body.classList.add("admin-cal-modal-open");
      window.setTimeout(() => {
        document.querySelector("[data-admin-cal-partner-filter-keyword]")?.focus();
      }, 0);
    };

    const closeAdminCalendarAssignmentModal = () => {
      if (!assignmentModal) return;
      assignmentModal.hidden = true;
      document.body.classList.remove("admin-cal-modal-open");
    };

    const assignmentOpenBtn = document.querySelector("[data-admin-cal-assignment-open]");
    if (assignmentOpenBtn && assignmentOpenBtn.dataset.adminCalAssignmentWired !== "1") {
      assignmentOpenBtn.dataset.adminCalAssignmentWired = "1";
      assignmentOpenBtn.addEventListener("click", () => {
        if (requestOpsBenchAddCalendarDemo("admin-calendar-btn")) return;
        openAdminCalendarAssignmentModal();
      });
    }

    assignmentModal?.querySelector(".admin-cal-assignmentModal__panel")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
    });

    assignmentModal?.addEventListener("click", (ev) => {
      if (ev.target === assignmentModal) closeAdminCalendarAssignmentModal();
    });

    document.querySelectorAll("[data-admin-cal-assignment-close], [data-admin-cal-assignment-cancel]").forEach((btn) => {
      btn.addEventListener("click", closeAdminCalendarAssignmentModal);
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape" || assignmentModal?.hidden) return;
      closeAdminCalendarAssignmentModal();
    });

    assignmentPartnerFiltersHost?.addEventListener("input", refreshAssignmentPartnerList);
    assignmentPartnerFiltersHost?.addEventListener("change", refreshAssignmentPartnerList);

    assignmentPartnerList?.addEventListener("change", (ev) => {
      const radio = ev.target?.closest?.("[data-admin-cal-assignment-partner-radio]");
      if (!radio) return;
      adminCalendarAssignmentPartnerId = radio.value || "";
      refreshAssignmentPartnerList();
    });

    document.querySelector("[data-admin-cal-assignment-instruction-pdf]")?.addEventListener("change", (ev) => {
      const file = ev.target?.files?.[0];
      adminCalendarAssignmentInstructionPdf = file
        ? { name: file.name || "指示書.pdf", type: "pdf", storageKey: null, url: null }
        : null;
    });

    document.querySelector("[data-admin-cal-assignment-parking-pdf]")?.addEventListener("change", (ev) => {
      const file = ev.target?.files?.[0];
      adminCalendarAssignmentParkingPdf = file
        ? { name: file.name || "駐車場案内.pdf", type: "pdf", storageKey: null, url: null }
        : null;
    });

    assignmentForm?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const partnerId =
        assignmentPartnerList?.querySelector('input[name="admin-cal-assignment-partner"]:checked')?.value ||
        adminCalendarAssignmentPartnerId ||
        "";
      const houseName = document.querySelector("[data-admin-cal-assignment-house-name]")?.value || "";
      const workDate = document.querySelector("[data-admin-cal-assignment-work-date]")?.value || "";
      const startTime = document.querySelector("[data-admin-cal-assignment-start-time]")?.value || "";
      const endTime = document.querySelector("[data-admin-cal-assignment-end-time]")?.value || "";
      const siteAddress = document.querySelector("[data-admin-cal-assignment-site-address]")?.value || "";
      const notes = document.querySelector("[data-admin-cal-assignment-notes]")?.value || "";

      const submitAssignment = (forceDuplicate) => {
        const result = createAdminCalendarAssignment({
          partnerId,
          houseName,
          workDate,
          startTime,
          endTime,
          instructionPdf: adminCalendarAssignmentInstructionPdf,
          parkingPdf: adminCalendarAssignmentParkingPdf,
          siteAddress,
          notes,
          forceDuplicate,
        });
        if (!result.ok) {
          if (result.error === "partner_required") alert("協力パートナーを選択してください。");
          else if (result.error === "house_name_required") alert("邸名を入力してください。");
          else if (result.error === "work_date_required") alert("作業日を入力してください。");
          else if (result.error === "duplicate") {
            const ok = confirm(
              `同じパートナー・日付・邸名（${houseName}）の予定が既にあります。別予定として追加しますか？`
            );
            if (ok) submitAssignment(true);
            return;
          } else alert("登録に失敗しました。");
          return;
        }
        adminCalendarUi.selectedEventId = result.assignment.id;
        adminCalendarUi.selectedDate = workDate || adminCalendarUi.selectedDate;
        assignmentForm?.reset();
        adminCalendarAssignmentInstructionPdf = null;
        adminCalendarAssignmentParkingPdf = null;
        closeAdminCalendarAssignmentModal();
        renderAdminCalendarPage();
      };

      submitAssignment(false);
    });
  }

  function openAdminCalendarAttachmentPreview(file) {
    const modal = document.querySelector("[data-admin-cal-preview-modal]");
    const title = document.querySelector("[data-admin-cal-preview-title]");
    const body = document.querySelector("[data-admin-cal-preview-body]");
    if (!modal || !body) return;
    if (title) title.textContent = file.name || "添付プレビュー";
    if (file.type === "image" && file.url) {
      body.innerHTML = `<img src="${esc(file.url)}" alt="${esc(file.name || "")}" />`;
    } else if (file.type === "pdf") {
      body.innerHTML = `<p>${esc(file.name || "PDF")}（デモ: 実ファイルは未アップロード）</p>`;
    } else {
      body.innerHTML = `<p>${esc(file.name || "—")}</p>`;
    }
    modal.hidden = false;
  }

  let mvpCalendarPageWired = false;
  let mvpCalendarItemsCache = [];
  let mvpCalendarUi = { selectedId: null };

  function openPartnerCalendarAssignment(projectId, calendarEventId) {
    const pid = String(projectId || "").trim();
    if (!pid) return false;
    const href = partnerAssignmentPageHref(pid, {
      partnerId: getPartnerId(),
      calendarEventId: String(calendarEventId || "").trim(),
    });
    if (
      globalThis.TasuBuilderBenchEmbed?.followCalendarAssignment?.(pid, calendarEventId, {
        partnerId: getPartnerId(),
      })
    ) {
      return true;
    }
    globalThis.location.href = href;
    return true;
  }

  function wireMvpCalendarPage() {
    wireThreadPdfOutputActions();
    if (mvpCalendarPageWired) return;
    mvpCalendarPageWired = true;
    document.querySelector("[data-builder-mvp-cal-list]")?.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-mvp-cal-item]");
      if (!btn) return;
      mvpCalendarUi.selectedId = btn.getAttribute("data-mvp-cal-item");
      renderMvpCalendarPage();
    });
    document.querySelector("[data-mvp-cal-partner-accepted-list]")?.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-mvp-cal-open-assignment]");
      if (!btn) return;
      ev.preventDefault();
      openPartnerCalendarAssignment(
        btn.getAttribute("data-project-id"),
        btn.getAttribute("data-calendar-event-id")
      );
    });
  }

  function renderMvpCalendarDetail(item, state) {
    const detail = document.querySelector("[data-builder-mvp-cal-detail]");
    if (!detail) return;
    const urlProjectId = getCalendarProjectIdParam();

    if (isCalendarPartnerRole()) {
      if (item?.denied) {
        detail.innerHTML = renderPartnerCalendarDeniedDetail(item.projectId || urlProjectId);
        return;
      }
      const ctx = resolvePartnerCalendarDetailContext(item, state, urlProjectId);
      if (!ctx) {
        detail.innerHTML = `<p class="mvp-cal-detail__empty">案件を選択すると内容を確認できます。</p>`;
        return;
      }
      if (ctx.denied) {
        detail.innerHTML = renderPartnerCalendarDeniedDetail(ctx.projectId);
        return;
      }
      detail.innerHTML = renderMvpCalendarPartnerAssignmentDetail(
        ctx.project,
        ctx.spec,
        state,
        ctx.assignment
      );
      return;
    }

    if (!item) {
      detail.innerHTML = `<p class="mvp-cal-detail__empty">予定を選択すると詳細を表示します。</p>`;
      return;
    }

    const project = item.projectId
      ? (state.projects || []).find((p) => p.project_id === item.projectId)
      : null;
    const spec = project ? state.specs?.[project.project_id] || DEMO_PROJECT_SPECS[project.project_id] : null;

    if (project && shouldShowAdminAssignmentDetail(project)) {
      detail.innerHTML = renderMvpCalendarAdminDetail(project, spec, state);
      return;
    }

    if (!item.threadId) {
      detail.innerHTML =
        `<div class="mvp-cal-detail__head"><h3 class="builder-section-title">${esc(item.siteTitle || item.title)}</h3></div>` +
        `<p class="mvp-cal-detail__empty">この予定には現場写真スレッドがありません。</p>`;
      return;
    }
    detail.innerHTML =
      `<div class="mvp-cal-detail__head"><h3 class="builder-section-title">${esc(item.siteTitle || item.title)}</h3></div>` +
      renderSitePhotoHistoryForThreadId(item.threadId, state) +
      renderThreadPdfOutputsForCalendar(item.threadId, state);
  }

  function renderMvpCalendarPage() {
    wireMvpCalendarPage();
    syncPartnerIdFromUrl();
    const api = mvp();
    const calendarRole = getCalendarRole();
    const isCalendarPartner = calendarRole === "partner";
    syncMvpCalendarPartnerChrome(isCalendarPartner);

    if (isCalendarPartner) {
      ensureAdminCalendarPartnerDemoData();
      const state = api.reload();
      renderPartnerAcceptedScheduleList(state, getPartnerId());
      return;
    }

    let state = api.reload();
    const list = document.querySelector("[data-builder-mvp-cal-list]");
    const kpi = document.querySelector("[data-builder-mvp-cal-kpi]");
    if (!list || !kpi) return;
    const items = [];
    const today = new Date();
    const ymd = today.toISOString().slice(0, 10);
    const isCalendarAdmin = calendarRole === "admin";
    const myPartnerId = getPartnerId();
    const urlProjectId = getCalendarProjectIdParam();

    {
      for (const p of state.projects || []) {
        const spec = state.specs?.[p.project_id];
        const periodStart = spec?.period?.start || "";
        const periodEnd = spec?.period?.end || "";
        const status = computeProjectStatus(state, p);
        const selectedIds = Array.isArray(p.selected_partner_ids) ? p.selected_partner_ids : [];
        const hasSelected = selectedIds.length > 0;
        const hasCalendarAssign = Boolean(getProjectCalendarAssignedPartnerId(p));

        if (isCalendarAdmin && !hasSelected && !hasCalendarAssign) continue;

        if (periodStart || periodEnd) {
          items.push({
            id: `period-${p.project_id}`,
            ts: periodStart || periodEnd,
            title: `案件期間: ${p.title}`,
            body: `${periodStart || "—"}〜${periodEnd || "—"} · ${toStatusLabel(status)}`,
            threadId: p.main_thread_id || "",
            projectId: p.project_id,
            siteTitle: p.title,
          });
          if (periodStart) {
            items.push({
              id: `start-${p.project_id}`,
              ts: periodStart,
              title: `入場予定: ${p.title}`,
              body: `開始日 ${periodStart}（予定）`,
              threadId: p.main_thread_id || "",
              projectId: p.project_id,
              siteTitle: p.title,
            });
          }
          if (periodEnd) {
            items.push({
              id: `end-${p.project_id}`,
              ts: periodEnd,
              title: `完了予定: ${p.title}`,
              body: `終了日 ${periodEnd}（予定）`,
              threadId: p.main_thread_id || "",
              projectId: p.project_id,
              siteTitle: p.title,
            });
          }
        }

        if (periodStart && periodEnd && ymd >= periodStart && ymd <= periodEnd && status !== "completed" && status !== "invoiced") {
          items.push({
            id: `today-${p.project_id}`,
            ts: ymd,
            title: `今日の作業: ${p.title}`,
            body: `期間内の作業日です（${toStatusLabel(status)}）`,
            threadId: p.main_thread_id || "",
            projectId: p.project_id,
            siteTitle: p.title,
          });
        }

        const t = state.threads?.[p.main_thread_id];
        for (const ev of t?.events || []) {
          if (ev.type === "check_in" || ev.type === "check_out" || ev.type === "completed") {
            items.push({
              id: `ev-${p.project_id}-${ev.ts}`,
              ts: ev.ts,
              title: `${ev.type}: ${p.title}`,
              body: ev.text || "",
              threadId: p.main_thread_id || "",
              projectId: p.project_id,
              siteTitle: p.title,
            });
          }
        }

        if (p.main_thread_id) {
          const photoCount = getSitePhotosFromThread(t, state, {
            threadId: p.main_thread_id,
            projectId: p.project_id,
          }).length;
          items.push({
            id: `site-${p.project_id}`,
            kind: "site",
            ts: periodEnd || periodStart || ymd,
            title: `現場写真: ${p.title}`,
            body: photoCount ? `${photoCount} 枚の写真` : "写真履歴を見る",
            threadId: p.main_thread_id,
            projectId: p.project_id,
            siteTitle: p.title,
          });
        }
      }
    }

    if (isCalendarAdmin) {
      for (const a of getAdminCalendarAssignments()) {
        const linkedProject = a.projectId ? (state.projects || []).find((p) => p.project_id === a.projectId) : null;
        items.push({
          id: `assignment-${a.id}`,
          ts: a.workDate,
          title: `現場予定: ${a.houseName}`,
          body: `${a.workDate} · ${a.partnerName || "—"}`,
          threadId: linkedProject?.main_thread_id || "",
          projectId: a.projectId || "",
          siteTitle: a.houseName,
        });
      }
    }

    items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    mvpCalendarItemsCache = items;
    kpi.textContent = `${items.length} 件`;

    let detailItem = null;
    if (urlProjectId && isCalendarPartner && !isPartnerAssignedToCalendarProject(urlProjectId, myPartnerId)) {
      mvpCalendarUi.selectedId = null;
      detailItem = { denied: true, projectId: urlProjectId };
    } else if (urlProjectId) {
      const project = (state.projects || []).find((p) => p.project_id === urlProjectId);
      const declined = isCalendarPartner && project && isPartnerDeclinedAssignment(project, myPartnerId);
      if (!declined) {
        const match =
          items.find((x) => x.projectId === urlProjectId && x.kind === "assignment") ||
          items.find((x) => x.projectId === urlProjectId);
        if (match) mvpCalendarUi.selectedId = match.id;
      }
    } else if (!mvpCalendarUi.selectedId && items.length) {
      mvpCalendarUi.selectedId = items.find((x) => x.kind === "assignment")?.id || items[0].id;
    }
    const selected = items.find((x) => x.id === mvpCalendarUi.selectedId) || null;
    if (!detailItem) {
      detailItem = selected;
      if (
        !detailItem &&
        urlProjectId &&
        isCalendarPartner &&
        isPartnerAssignedToCalendarProject(urlProjectId, myPartnerId)
      ) {
        detailItem = { id: `assignment-resolved-${urlProjectId}`, projectId: urlProjectId, kind: "assignment" };
      }
    }

    list.innerHTML = items
      .map((x) => {
        const itemClass = getCalendarListItemClass(x, state, mvpCalendarUi.selectedId);
        return (
          `<li>` +
          `<button type="button" class="${itemClass}" data-mvp-cal-item="${esc(x.id)}">` +
          `<p class="builder-notif__title">${esc(x.title)}</p>` +
          `<p class="builder-notif__meta">${esc(String(x.ts))}</p>` +
          `<div class="builder-notif__body">${esc(x.body)}</div>` +
          `</button></li>`
        );
      })
      .join("");

    renderMvpCalendarDetail(detailItem, state);
  }

  function getBenchGeneralFlowSpec(flowId, project) {
    return generalFlowApi()?.getBenchGeneralFlowSpec?.(flowId, project) || null;
  }

  function resolveGeneralFlowBenchContext(project) {
    const flowId = String(project?.bench_flow_id || "").trim();
    if (!flowId) return null;
    const spec = getBenchGeneralFlowSpec(flowId, project);
    if (!spec) return null;
    return { flowId, spec };
  }

  function resolveGeneralFlowMessageRecipient(project, actor) {
    const ctx = resolveGeneralFlowBenchContext(project);
    if (!ctx) return null;
    return gfCounterparty(actor, ctx.spec);
  }

  function resolveGeneralFlowThreadType(project, thread) {
    const ctx = resolveGeneralFlowBenchContext(project);
    return (
      String(ctx?.spec?.threadType || "").trim() ||
      String(project?.bench_thread_type || "").trim() ||
      getThreadRowType(thread) ||
      ""
    );
  }

  function resolveGeneralFlowNotifyRecipientUserId(project, recipientRef) {
    const ctx = resolveGeneralFlowBenchContext(project);
    if (!ctx) return "";
    const ref =
      recipientRef && typeof recipientRef === "object"
        ? recipientRef
        : { recipientRole: recipientRef };
    return gfRecipientUserId(ctx.spec, ref);
  }

  function buildGeneralFlowMessageNotifyPayload({ tid, project, thread, actor, body, attach, recipient }) {
    const threadType = resolveGeneralFlowThreadType(project, thread);
    const text = String(body || "").trim();
    const flowCtx = resolveGeneralFlowBenchContext(project);
    const recipientSlot =
      flowCtx && recipient.id === flowCtx.spec.poster.id
        ? "poster"
        : flowCtx && recipient.id === flowCtx.spec.applicant.id
          ? "applicant"
          : "";
    return {
      type: attach.length && !text ? "attachment" : "message",
      title: "新しいメッセージがあります",
      body: attach.length && !text ? `${actor.name}からファイルが届きました。` : `${actor.name}から: ${text}`,
      project_id: project.project_id,
      projectId: project.project_id,
      projectTitle: project?.title || "",
      thread_id: tid,
      threadId: tid,
      recipientRole: recipient.role,
      recipientUserId: recipient.id,
      recipientSlot,
      actionLabel: "チャットへ進む",
      href: mvpThreadHref(tid, gfPartyUrlRole(recipient), threadType),
    };
  }

  function emitGeneralFlowBenchMessageCreated(detail = {}) {
    if (!isBuilderBenchEmbedPage()) return;
    try {
      global.parent?.postMessage?.({ type: "tasu-builder-bench-general-message-created", ...detail }, "*");
    } catch {
      /* ignore */
    }
  }

  function ensureGeneralFlowThread(next, project, spec) {
    const applicant = spec.applicant;
    const poster = spec.poster;
    const threadType = spec.threadType;
    const typeCfg = getBuilderThreadTypeConfig(threadType);
    let threadId = String(project.main_thread_id || "").trim();
    if (!threadId || !next.threads?.[threadId]) {
      threadId = uid("thread");
      const ts = nowIso();
      next.threads = {
        ...(next.threads || {}),
        [threadId]: {
          thread_id: threadId,
          thread_type: threadType,
          threadType,
          project_id: project.project_id,
          counterpart_name: applicant.name,
          list_title: typeCfg.listTitle || "やりとり",
          messages: [],
          events: [
            {
              type: "selected",
              actor: poster,
              ts,
              text: `チャットを開始しました（${applicant.name}）`,
            },
          ],
          photos: [],
          status: "open",
          participants: [
            { id: poster.id, type: poster.role, name: poster.name, label: poster.name },
            { id: applicant.id, type: applicant.role, name: applicant.name, label: applicant.name },
          ],
        },
      };
      const pidx = (next.projects || []).findIndex((p) => p.project_id === project.project_id);
      if (pidx >= 0) {
        next.projects[pidx] = { ...next.projects[pidx], main_thread_id: threadId };
      }
    }
    return threadId;
  }

  function createGeneralFlowProject(flowId) {
    const spec = getBenchGeneralFlowSpec(flowId);
    if (!spec) return { ok: false, error: "unknown_flow" };
    const api = mvp();
    const next = api.reload();
    const project_id = uid("proj-gen");
    const ts = nowIso();
    const project = {
      project_id,
      owner_id: spec.poster.id,
      title: spec.title,
      kind: "builder_board",
      board_type: "project",
      projectKind: "project",
      type: "project",
      status: "open",
      required_partners: 1,
      selected_partner_ids: [],
      main_thread_id: null,
      bench_flow_id: flowId,
      bench_thread_type: spec.threadType,
      created_at: ts,
    };
    next.projects = [...(next.projects || []), project];
    next.specs = {
      ...(next.specs || {}),
      [project_id]: {
        overview: spec.title,
        description: `${spec.title}（2窓ベンチ検証）`,
      },
    };
    api.commit(next);
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    return { ok: true, project_id, flowId, threadType: spec.threadType };
  }

  function applyGeneralFlowProject(projectId) {
    const pid = String(projectId || "").trim();
    if (!pid) return { ok: false, error: "no_project" };
    const api = mvp();
    const next = api.reload();
    const project = (next.projects || []).find((p) => p.project_id === pid);
    if (!project) return { ok: false, error: "not_found" };
    const spec = getBenchGeneralFlowSpec(project.bench_flow_id, project);
    if (!spec) return { ok: false, error: "no_flow_spec" };
    const applicant = spec.applicant;
    const existingIdx = (next.applications || []).findIndex(
      (a) => a.project_id === pid && a.partner_id === applicant.id
    );
    const existing = existingIdx >= 0 ? next.applications[existingIdx] : null;
    const existingStatus = String(existing?.status || "").trim();
    if (existing && existingStatus !== "rejected") {
      return { ok: false, error: "already_applied" };
    }
    const applicationRow = {
      project_id: pid,
      partner_id: applicant.id,
      applicant_role: applicant.role,
      status: "applied",
      ts: nowIso(),
      message: `${project.title || "案件"} に応募しました。条件・日程のご確認をお願いします。`,
    };
    if (existingIdx >= 0) {
      next.applications = (next.applications || []).map((a, i) =>
        i === existingIdx ? { ...a, ...applicationRow, updated_at: nowIso() } : a
      );
    } else {
      next.applications = [...(next.applications || []), applicationRow];
    }
    api.commit(next);
    const poster = spec.poster;
    api.pushNotification({
      type: "application",
      title: "応募がありました",
      body: `${applicant.name} から応募がありました（${project.title}）`,
      project_id: pid,
      projectTitle: project.title || "",
      thread_id: null,
      recipientRole: poster.role,
      recipientUserId: poster.id,
      recipientSlot: "poster",
      href: `builder/board-project-detail.html?id=${encodeURIComponent(pid)}&view=applications&role=owner&from=notify`,
      actionLabel: "やりとりを開始する",
      secondaryActionLabel: "見送る",
      builderNotifyKind: "general_flow_application_poster",
    });
    api.pushNotification({
      type: "application_submitted",
      title: "応募しました",
      body: `${project.title} — 掲載者の確認をお待ちください。`,
      project_id: pid,
      projectTitle: project.title || "",
      thread_id: null,
      recipientRole: applicant.role,
      recipientUserId: applicant.id,
      recipientSlot: "applicant",
      href: `mvp-project-detail.html?id=${encodeURIComponent(pid)}`,
      actionLabel: "案件を見る",
    });
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    return { ok: true, project_id: pid };
  }

  function rejectGeneralFlowApplicant(projectId) {
    const pid = String(projectId || "").trim();
    if (!pid) return { ok: false, error: "no_project" };
    const api = mvp();
    const next = api.reload();
    const pidx = (next.projects || []).findIndex((p) => p.project_id === pid);
    if (pidx < 0) return { ok: false, error: "not_found" };
    const project = next.projects[pidx];
    const spec = getBenchGeneralFlowSpec(project.bench_flow_id, project);
    if (!spec) return { ok: false, error: "no_flow_spec" };
    const applicant = spec.applicant;
    const poster = spec.poster;
    const threadId = String(project.main_thread_id || "").trim();
    if (threadId) return { ok: false, error: "chat_started" };
    const mine = (next.applications || []).find(
      (a) => a.project_id === pid && a.partner_id === applicant.id
    );
    if (!mine || (mine.status || "applied") === "rejected") {
      return { ok: false, error: "no_pending_application" };
    }
    next.applications = (next.applications || []).map((a) => {
      if (a.project_id !== pid || a.partner_id !== applicant.id) return a;
      return { ...a, status: "rejected", updated_at: nowIso() };
    });
    api.commit(next);
    api.pushNotification({
      type: "rejected",
      title: "今回は見送りになりました",
      body: `${project.title} — 掲載者が見送りました。`,
      project_id: pid,
      projectTitle: project.title || "",
      recipientRole: applicant.role,
      recipientUserId: applicant.id,
      recipientSlot: "applicant",
      href: resolvePublicBoardDetailHref(project),
      actionLabel: "案件を見る",
      projectKind: project.board_type || "project",
      bench_flow_id: project.bench_flow_id,
      bench_thread_type: spec.threadType,
    });
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    return { ok: true, project_id: pid, applicant_id: applicant.id, poster_id: poster.id };
  }

  function startGeneralFlowChat(projectId) {
    const pid = String(projectId || "").trim();
    if (!pid) return { ok: false, error: "no_project" };
    const api = mvp();
    const next = api.reload();
    const pidx = (next.projects || []).findIndex((p) => p.project_id === pid);
    if (pidx < 0) return { ok: false, error: "not_found" };
    const project = next.projects[pidx];
    const spec = getBenchGeneralFlowSpec(project.bench_flow_id, project);
    if (!spec) return { ok: false, error: "no_flow_spec" };
    const applicant = spec.applicant;
    const poster = spec.poster;
    next.applications = (next.applications || []).map((a) => {
      if (a.project_id !== pid) return a;
      if (a.partner_id === applicant.id) return { ...a, status: "selected", updated_at: nowIso() };
      if ((a.status || "applied") === "applied") return { ...a, status: "rejected", updated_at: nowIso() };
      return a;
    });
    next.projects[pidx] = {
      ...project,
      selected_partner_ids: [applicant.id],
      assignment_status: "accepted",
    };
    const threadId = ensureGeneralFlowThread(next, next.projects[pidx], spec);
    api.commit(next);

    const applicantHref = mvpThreadHref(threadId, applicant.role, spec.threadType);
    const posterHref = mvpThreadHref(threadId, poster.role, spec.threadType);
    api.pushNotification({
      type: "selected",
      title: "選定されました",
      body: `${project.title} — やりとりチャットへ進んでください。`,
      project_id: pid,
      thread_id: threadId,
      recipientRole: applicant.role,
      recipientUserId: applicant.id,
      recipientSlot: "applicant",
      href: applicantHref,
      actionLabel: "チャットへ進む",
    });
    api.pushNotification({
      type: "hire_confirmed",
      title: "選定が完了しました",
      body: `${applicant.name} さんとのやりとりチャットへ進んでください。`,
      project_id: pid,
      thread_id: threadId,
      recipientRole: poster.role,
      recipientUserId: poster.id,
      recipientSlot: "poster",
      href: posterHref,
      actionLabel: "チャットへ進む",
    });
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    return { ok: true, threadId, threadType: spec.threadType, project_id: pid };
  }

  function sendGeneralFlowMessage(threadId, fromRole, text, attachments) {
    const tid = String(threadId || "").trim();
    const specRole = normalizeMvpRole(fromRole);
    setRole(specRole);
    const attach = Array.isArray(attachments) ? attachments : [];
    const body = String(text || "").trim();
    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const project = (next.projects || []).find((p) => p.project_id === thread?.project_id);
    const spec = getBenchGeneralFlowSpec(project?.bench_flow_id, project);
    if (!thread || !spec) return false;
    const actor = getActor(next);
    const ok = sendMvpThreadMessage(body, attach, tid);
    if (!ok) return false;
    const recipient = gfIsPoster(actor, spec) ? spec.applicant : spec.poster;
    const payload = buildGeneralFlowMessageNotifyPayload({
      tid,
      project,
      thread,
      actor,
      body,
      attach,
      recipient,
    });
    api.pushNotification(payload);
    emitGeneralFlowBenchMessageCreated({
      threadId: tid,
      projectId: project.project_id,
      recipientRole: recipient.role,
      recipientUserId: recipient.id,
    });
    return true;
  }

  function cancelGeneralFlowThread(threadId) {
    const tid = String(threadId || "").trim();
    if (!tid) return { ok: false, error: "no_thread" };
    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const project = (next.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project) return { ok: false, error: "not_found" };
    const spec = getBenchGeneralFlowSpec(project.bench_flow_id, project);
    if (!spec) return { ok: false, error: "no_flow_spec" };
    if (isMvpThreadChatLocked(thread, project, next) || thread.status === "cancelled") {
      return { ok: false, error: "already_closed" };
    }
    const actor = getActor(next);
    const isPoster = gfIsPoster(actor, spec);
    const isApplicant = gfIsApplicant(actor, spec);
    if (!isPoster && !isApplicant) return { ok: false, error: "not_allowed" };
    const recipient = isPoster ? spec.applicant : spec.poster;
    const ts = nowIso();
    thread.status = "cancelled";
    appendMvpThreadSystemMessage(next, thread, {
      actor,
      text: "やりとりがキャンセルされました",
      eventType: "cancelled",
    });
    api.commit(next);
    const threadType = resolveGeneralFlowThreadType(project, thread);
    api.pushNotification({
      type: "cancelled",
      title: "やりとりがキャンセルされました",
      body: `${project.title} — 相手がやりとりをキャンセルしました。`,
      project_id: project.project_id,
      projectId: project.project_id,
      projectTitle: project.title || "",
      thread_id: tid,
      threadId: tid,
      recipientRole: recipient.role,
      recipientUserId: recipient.id,
      recipientSlot: isPoster ? "applicant" : "poster",
      href: mvpThreadHref(tid, gfPartyUrlRole(recipient), threadType),
      actionLabel: "チャットへ進む",
    });
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    if (isBuilderBenchEmbedPage()) {
      try {
        global.parent?.postMessage?.(
          {
            type: "tasu-builder-bench-general-cancelled",
            projectId: project.project_id,
            threadId: tid,
            benchSide: getParam("benchSide"),
          },
          "*"
        );
      } catch {
        /* ignore */
      }
    }
    return { ok: true, threadId: tid, project_id: project.project_id };
  }

  function completeGeneralFlowThread(threadId) {
    const tid = String(threadId || "").trim();
    if (!tid) return { ok: false, error: "no_thread" };
    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const project = (next.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project) return { ok: false, error: "not_found" };
    const spec = getBenchGeneralFlowSpec(project.bench_flow_id, project);
    const ts = nowIso();
    thread.status = "completed";
    thread.siteData = { ...(thread.siteData || {}), completed: true, completedAt: ts };
    appendMvpThreadSystemMessage(next, thread, {
      actor: spec?.poster || { id: "demo-builder-user", type: "user", name: "掲載者" },
      text: "このやりとりは完了しました",
      eventType: "completed",
    });
    if (project.project_id) {
      const pidx = (next.projects || []).findIndex((p) => p.project_id === project.project_id);
      if (pidx >= 0) next.projects[pidx] = { ...next.projects[pidx], status: "completed" };
    }
    api.commit(next);
    const threadType = spec?.threadType || thread.thread_type || "";
    const applicant = spec?.applicant;
    const poster = spec?.poster;
    if (applicant && poster) {
      api.pushNotification({
        type: "completed",
        title: "やりとりが完了しました",
        body: `${project.title} — お疲れさまでした。`,
        project_id: project.project_id,
        thread_id: tid,
        recipientRole: applicant.role,
        href: mvpThreadHref(tid, applicant.role, threadType),
      });
      api.pushNotification({
        type: "completed",
        title: "やりとりが完了しました",
        body: `${project.title} — 取引が完了しました。`,
        project_id: project.project_id,
        thread_id: tid,
        recipientRole: poster.role,
        href: mvpThreadHref(tid, poster.role, threadType),
      });
      [poster, applicant].forEach((recipient) => {
        api.pushNotification({
          type: "review_request",
          title: "取引が完了しました",
          body: `${project.title} — 相手の評価をお願いします。`,
          project_id: project.project_id,
          thread_id: tid,
          recipientRole: recipient.role,
          href: mvpThreadReviewNotifyHref(tid, recipient.role, threadType),
          actionLabel: "レビューする",
        });
      });
    }
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    return { ok: true, threadId: tid };
  }

  function submitGeneralFlowReview(threadId, payload = {}) {
    const tid = String(threadId || "").trim();
    if (!tid) return { ok: false, error: "no_thread" };
    const api = mvp();
    const next = api.reload();
    const thread = next.threads?.[tid];
    const project = (next.projects || []).find((p) => p.project_id === thread?.project_id);
    if (!thread || !project) return { ok: false, error: "not_found" };
    const spec = getBenchGeneralFlowSpec(project.bench_flow_id, project);
    const reviewer = spec?.poster || getActor(next);
    const ts = nowIso();
    const rating = Math.max(1, Math.min(5, Number(payload.rating || 5)));
    const comment = String(payload.comment || "").trim() || "丁寧な対応でした。ありがとうございました。";
    thread.review_submission = {
      status: "submitted",
      rating,
      comment,
      submitted_at: ts,
      submitted_by: reviewer,
    };
    next.reviews = Array.isArray(next.reviews) ? next.reviews : [];
    next.reviews.push({
      review_id: uid("review"),
      thread_id: tid,
      project_id: project.project_id,
      rating,
      comment,
      reviewer_id: reviewer.id,
      reviewer_role: reviewer.role || reviewer.type,
      reviewed_user_id: spec?.applicant?.id || "",
      ts,
    });
    appendMvpThreadSystemMessage(next, thread, {
      actor: reviewer,
      text: `レビューを投稿しました（${rating}点）`,
      eventType: "review",
    });
    api.commit(next);
    pushThreadReviewSubmittedNotifications({ threadId: tid, project, state: next });
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
    return { ok: true, threadId: tid, rating };
  }

  window.TasuBuilderBenchBridge = {
    setContext({ role, partnerId, applicantId } = {}) {
      if (role) setRole(role);
      const aid = partnerId || applicantId;
      if (aid) setPartnerId(aid);
      return { role: getRole(), partnerId: getPartnerId() };
    },
    createGeneralFlowProject,
    applyGeneralFlowProject,
    rejectGeneralFlowApplicant,
    startGeneralFlowChat,
    sendGeneralFlowMessage,
    cancelGeneralFlowThread,
    completeGeneralFlowThread,
    submitGeneralFlowReview,
    getBenchGeneralFlowSpec,
    createAdminCalendarProject,
    acceptCalendarAssignment,
    declineCalendarAssignment,
    sendMvpThreadMessage,
    markMvpThreadEnterLeave,
    submitThreadCompletionReport(threadId, payload) {
      document.body.dataset.page = "builder-mvp-thread";
      return submitThreadCompletionReport(threadId, payload);
    },
    approveThreadCompletionReport(threadId) {
      document.body.dataset.page = "builder-mvp-thread";
      return approveThreadCompletionReport(threadId);
    },
    rejectThreadCompletionReport(threadId, reason) {
      document.body.dataset.page = "builder-mvp-thread";
      return rejectThreadCompletionReport(threadId, reason);
    },
    mvpThreadHref,
    partnerAssignmentPageHref,
    getMvpState: () => mvp().reload(),
    getNotifications: () => getMvpNotifications(),
    resetDemo(opts = {}) {
      const opsBench = isOpsBenchSession() || opts.opsBench === true;
      const clearKeys = [
        MVP_STORAGE_KEY,
        MVP_NOTIFICATIONS_KEY,
        ADMIN_CALENDAR_ASSIGNMENTS_KEY,
        "tasful_talk_notifications",
        "tasful_talk_notifications_seeded_v2",
        "tasful_builder_notify_master_v1",
        "tasful_platform_notify_master_v2",
        "tasful_anpi_notify_master_v1",
        ADMIN_NOTIFICATIONS_KEY,
      ];
      try {
        clearKeys.forEach((key) => localStorage.removeItem(key));
      } catch {
        /* ignore */
      }
      seedMvpStateIfEmpty();
      if (!opts.skipCalendarSeed && !opsBench) ensureAdminCalendarPartnerDemoData();
      document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
      document.dispatchEvent(new CustomEvent("builder:admin-calendar-assignments-changed"));
      return { ok: true };
    },
  };

  if (global.TasuBuilderB3Init?.registerBuilderBridge) {
    global.TasuBuilderB3Init.registerBuilderBridge({
      normalizeMvpState,
      normalizeMvpNotification,
      migrateLegacyMvpNotificationsIfNeeded,
      dispatchMvpNotificationsChanged,
    });
    global.TasuBuilderB3Init.finish();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
