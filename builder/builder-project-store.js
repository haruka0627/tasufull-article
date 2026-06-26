/**
 * Builder Project Hub — 案件ストア（Phase 6-A/6-B · localStorage）
 * Builder 専用 · Platform / AI秘書 / TASFUL AI 非連携
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_builder_project_hub_v1";
  const SCHEMA_VERSION = 2;

  const STATUSES = Object.freeze([
    { id: "inquiry", label: "問い合わせ" },
    { id: "estimating", label: "見積中" },
    { id: "contracted", label: "契約済" },
    { id: "in_progress", label: "施工中" },
    { id: "completed", label: "完了" },
  ]);

  const CATEGORIES = Object.freeze([
    { id: "exterior", label: "外壁" },
    { id: "roof", label: "屋根" },
    { id: "interior", label: "内装" },
    { id: "wet_area", label: "水回り" },
    { id: "renovation", label: "リフォーム" },
    { id: "new_build", label: "新築" },
    { id: "other", label: "その他" },
  ]);

  const TIMELINE_LABELS = Object.freeze({
    project_created: "案件作成",
    estimate_submitted: "見積提出",
    ai_diagnosis: "Builder AI 診断",
    contract_signed: "契約",
    construction_started: "施工開始",
    completed: "完了",
    memo_updated: "メモ更新",
    status_changed: "ステータス変更",
    schedule_updated: "日程変更",
  });

  /** 工程（Phase 6-B）— 案件スケジュールの工程ステップ */
  const SCHEDULE_PHASES = Object.freeze([
    { id: "inquiry", label: "問い合わせ" },
    { id: "site_survey", label: "現地調査" },
    { id: "estimate", label: "見積" },
    { id: "contract", label: "契約" },
    { id: "groundbreaking", label: "着工" },
    { id: "construction", label: "施工中" },
    { id: "completed_work", label: "完了" },
    { id: "aftercare", label: "アフター" },
  ]);

  const SCHEDULE_INTENT_TYPES = Object.freeze({
    RESCHEDULE_BY_DAYS: "reschedule_by_days",
    SET_DATES: "set_dates",
    SET_PHASE: "set_phase",
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function statusLabel(id) {
    return STATUSES.find((s) => s.id === id)?.label || id;
  }

  function categoryLabel(id) {
    return CATEGORIES.find((c) => c.id === id)?.label || id;
  }

  function schedulePhaseLabel(id) {
    return SCHEDULE_PHASES.find((p) => p.id === id)?.label || id;
  }

  function dateOnlyOffset(daysFromToday) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + daysFromToday);
    return d.toISOString().slice(0, 10);
  }

  function parseDateOnly(value) {
    const s = String(value || "").trim();
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function toDateOnlyString(value) {
    const d = value instanceof Date ? value : parseDateOnly(value);
    if (!d) return "";
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }

  function todayDateOnly() {
    return toDateOnlyString(new Date());
  }

  function isDateInRange(dateStr, startStr, endStr) {
    const d = parseDateOnly(dateStr);
    const start = parseDateOnly(startStr);
    const end = parseDateOnly(endStr);
    if (!d || !start || !end) return false;
    const t = d.getTime();
    return t >= start.getTime() && t <= end.getTime();
  }

  function hasScheduleRange(project) {
    return !!(project?.scheduleStartDate && project?.scheduleEndDate);
  }

  function readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = JSON.parse(raw || "{}");
      if (!data || typeof data !== "object") return { version: SCHEMA_VERSION, projects: [] };
      return {
        version: data.version || SCHEMA_VERSION,
        projects: Array.isArray(data.projects) ? data.projects : [],
      };
    } catch {
      return { version: SCHEMA_VERSION, projects: [] };
    }
  }

  function writeAll(data) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        projects: data.projects || [],
        updatedAt: nowIso(),
      })
    );
  }

  function normalizeProject(raw) {
    const p = raw && typeof raw === "object" ? raw : {};
    const status = String(p.status || "inquiry");
    const category = String(p.category || "other");
    const schedulePhase = String(p.schedulePhase || "inquiry");
    return {
      id: String(p.id || uid("PRJ")),
      name: String(p.name || "（無題）"),
      category,
      categoryLabel: String(p.categoryLabel || categoryLabel(category)),
      customerName: String(p.customerName || ""),
      customerContact: String(p.customerContact || ""),
      assignedVendor: String(p.assignedVendor || ""),
      status,
      statusLabel: String(p.statusLabel || statusLabel(status)),
      scheduleStartDate: String(p.scheduleStartDate || ""),
      scheduleEndDate: String(p.scheduleEndDate || ""),
      schedulePhase,
      schedulePhaseLabel: String(p.schedulePhaseLabel || schedulePhaseLabel(schedulePhase)),
      memo: String(p.memo || ""),
      createdAt: String(p.createdAt || nowIso()),
      updatedAt: String(p.updatedAt || p.createdAt || nowIso()),
      visionDiagnoses: Array.isArray(p.visionDiagnoses) ? p.visionDiagnoses : [],
      timeline: Array.isArray(p.timeline) ? p.timeline : [],
      source: String(p.source || "builder"),
    };
  }

  function addTimelineEvent(project, type, detail) {
    const events = Array.isArray(project.timeline) ? [...project.timeline] : [];
    events.push({
      id: uid("tl"),
      type,
      label: TIMELINE_LABELS[type] || type,
      at: nowIso(),
      detail: String(detail || "").slice(0, 500),
    });
    project.timeline = events;
    return project;
  }

  function seedDemoProjects() {
    const t = nowIso();
    const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
    return [
      normalizeProject({
        id: "PRJ-2026-001",
        name: "世田谷区 戸建 外壁補修",
        category: "exterior",
        customerName: "田中 様",
        customerContact: "03-1234-5678",
        assignedVendor: "株式会社イワショウリフォーム",
        status: "estimating",
        scheduleStartDate: dateOnlyOffset(14),
        scheduleEndDate: dateOnlyOffset(20),
        schedulePhase: "estimate",
        memo: "外壁ひび・塗装剥離。現調済み。",
        createdAt: day(14),
        updatedAt: day(2),
        timeline: [
          { id: "tl1", type: "project_created", label: "案件作成", at: day(14), detail: "Builder 経由で登録" },
          { id: "tl2", type: "estimate_submitted", label: "見積提出", at: day(7), detail: "概算見積 120万円（参考）" },
        ],
        source: "builder",
      }),
      normalizeProject({
        id: "PRJ-2026-002",
        name: "横浜市 マンション 水回りリフォーム",
        category: "wet_area",
        customerName: "佐藤 様",
        customerContact: "info@sato-home.example.jp",
        assignedVendor: "（未アサイン）",
        status: "inquiry",
        scheduleStartDate: dateOnlyOffset(2),
        scheduleEndDate: dateOnlyOffset(9),
        schedulePhase: "inquiry",
        memo: "キッチン・浴室の同時リフォーム相談。",
        createdAt: day(5),
        updatedAt: day(1),
        timeline: [
          { id: "tl3", type: "project_created", label: "案件作成", at: day(5), detail: "問い合わせフォーム経由" },
        ],
        source: "builder",
      }),
      normalizeProject({
        id: "PRJ-2026-003",
        name: "大阪市 店舗 内装工事",
        category: "interior",
        customerName: "山本商事",
        assignedVendor: "関西内装工業",
        status: "in_progress",
        scheduleStartDate: dateOnlyOffset(-20),
        scheduleEndDate: dateOnlyOffset(-2),
        schedulePhase: "construction",
        memo: "施工週次報告あり。",
        createdAt: day(30),
        updatedAt: day(0),
        timeline: [
          { id: "tl4", type: "project_created", label: "案件作成", at: day(30), detail: "" },
          { id: "tl5", type: "contract_signed", label: "契約", at: day(20), detail: "" },
          { id: "tl6", type: "construction_started", label: "施工開始", at: day(10), detail: "" },
        ],
        source: "builder",
      }),
    ];
  }

  function ensureSeed() {
    const data = readAll();
    if (data.projects.length) return data;
    data.projects = seedDemoProjects();
    writeAll(data);
    return data;
  }

  function listProjects() {
    ensureSeed();
    return readAll()
      .projects.map(normalizeProject)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  function getProject(id) {
    const pid = String(id || "").trim();
    if (!pid) return null;
    return listProjects().find((p) => p.id === pid) || null;
  }

  /**
   * @param {{ q?: string, category?: string, status?: string }} filters
   */
  function searchProjects(filters) {
    const f = filters && typeof filters === "object" ? filters : {};
    const q = String(f.q || "")
      .trim()
      .toLowerCase();
    const category = String(f.category || "").trim();
    const status = String(f.status || "").trim();

    return listProjects().filter((p) => {
      if (category && p.category !== category) return false;
      if (status && p.status !== status) return false;
      if (!q) return true;
      const hay = [p.id, p.name, p.customerName, p.assignedVendor, p.categoryLabel, p.statusLabel]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function saveProject(project) {
    const data = readAll();
    const p = normalizeProject(project);
    p.updatedAt = nowIso();
    const idx = data.projects.findIndex((x) => x.id === p.id);
    if (idx >= 0) data.projects[idx] = p;
    else {
      addTimelineEvent(p, "project_created", "案件ハブで作成");
      data.projects.push(p);
    }
    writeAll(data);
    return p;
  }

  function updateProject(id, patch) {
    const existing = getProject(id);
    if (!existing) return { ok: false, error: "not_found" };
    const next = normalizeProject({ ...existing, ...patch, id: existing.id });
    if (patch.status && patch.status !== existing.status) {
      addTimelineEvent(
        next,
        "status_changed",
        `${existing.statusLabel} → ${statusLabel(patch.status)}`
      );
      next.statusLabel = statusLabel(patch.status);
    }
    if (patch.memo != null && String(patch.memo) !== existing.memo) {
      addTimelineEvent(next, "memo_updated", "メモを更新");
    }
    const scheduleChanged =
      (patch.scheduleStartDate != null && patch.scheduleStartDate !== existing.scheduleStartDate) ||
      (patch.scheduleEndDate != null && patch.scheduleEndDate !== existing.scheduleEndDate) ||
      (patch.schedulePhase != null && patch.schedulePhase !== existing.schedulePhase);
    if (scheduleChanged) {
      next.schedulePhaseLabel = schedulePhaseLabel(next.schedulePhase);
      const detail =
        patch.scheduleReason != null
          ? String(patch.scheduleReason).slice(0, 500)
          : formatScheduleDetail(next.scheduleStartDate, next.scheduleEndDate, next.schedulePhaseLabel);
      addTimelineEvent(next, "schedule_updated", detail);
    }
    next.updatedAt = nowIso();
    const data = readAll();
    const idx = data.projects.findIndex((x) => x.id === id);
    data.projects[idx] = next;
    writeAll(data);
    return { ok: true, project: next };
  }

  /**
   * @param {string} projectId
   * @param {object} diagnosis — Vision JSON 正本
   * @param {{ userText?: string, imageName?: string }} [meta]
   */
  function saveVisionDiagnosis(projectId, diagnosis, meta) {
    const project = getProject(projectId);
    if (!project) return { ok: false, error: "not_found" };
    if (!diagnosis || typeof diagnosis !== "object") {
      return { ok: false, error: "invalid_diagnosis" };
    }

    const entry = {
      id: uid("vd"),
      at: nowIso(),
      category: diagnosis.category || "",
      categoryLabel: diagnosis.categoryLabel || "",
      diagnosis,
      summary: String(diagnosis.condition || diagnosis.aiComment || "").slice(0, 200),
      userText: String(meta?.userText || "").slice(0, 300),
      imageName: String(meta?.imageName || "").slice(0, 120),
    };

    const diagnoses = Array.isArray(project.visionDiagnoses) ? [...project.visionDiagnoses] : [];
    diagnoses.unshift(entry);
    project.visionDiagnoses = diagnoses.slice(0, 20);

    const label = diagnosis.categoryLabel || "現場";
    addTimelineEvent(
      project,
      "ai_diagnosis",
      `Builder AI Vision: ${label} — ${entry.summary || "参考診断を保存"}`
    );
    project.updatedAt = nowIso();

    const data = readAll();
    const idx = data.projects.findIndex((x) => x.id === projectId);
    data.projects[idx] = project;
    writeAll(data);
    return { ok: true, project, entry };
  }

  function formatScheduleDetail(start, end, phaseLabel) {
    const parts = [];
    if (start || end) parts.push(`${start || "—"} → ${end || "—"}`);
    if (phaseLabel) parts.push(`工程: ${phaseLabel}`);
    return parts.join(" · ") || "日程を更新";
  }

  /**
   * @param {string} projectId
   * @param {{ scheduleStartDate?: string, scheduleEndDate?: string, schedulePhase?: string, reason?: string }} patch
   */
  function updateSchedule(projectId, patch) {
    const p = patch && typeof patch === "object" ? patch : {};
    return updateProject(projectId, {
      scheduleStartDate: p.scheduleStartDate,
      scheduleEndDate: p.scheduleEndDate,
      schedulePhase: p.schedulePhase,
      scheduleReason: p.reason,
    });
  }

  /**
   * Builder AI 連携準備 — 将来「来週へ変更」等の intent を適用（現時点では UI/テストからのみ）
   * @param {string} projectId
   * @param {{ type: string, deltaDays?: number, startDate?: string, endDate?: string, schedulePhase?: string, reason?: string, source?: string }} intent
   */
  function previewScheduleIntent(projectId, intent) {
    const project = getProject(projectId);
    if (!project) return { ok: false, error: "not_found" };
    const i = intent && typeof intent === "object" ? intent : {};
    const type = String(i.type || "");
    const next = {
      scheduleStartDate: project.scheduleStartDate,
      scheduleEndDate: project.scheduleEndDate,
      schedulePhase: project.schedulePhase,
    };

    if (type === SCHEDULE_INTENT_TYPES.RESCHEDULE_BY_DAYS) {
      const delta = Number(i.deltaDays) || 0;
      if (next.scheduleStartDate) {
        const s = parseDateOnly(next.scheduleStartDate);
        if (s) s.setDate(s.getDate() + delta);
        next.scheduleStartDate = toDateOnlyString(s);
      }
      if (next.scheduleEndDate) {
        const e = parseDateOnly(next.scheduleEndDate);
        if (e) e.setDate(e.getDate() + delta);
        next.scheduleEndDate = toDateOnlyString(e);
      }
    } else if (type === SCHEDULE_INTENT_TYPES.SET_DATES) {
      if (i.startDate != null) next.scheduleStartDate = String(i.startDate);
      if (i.endDate != null) next.scheduleEndDate = String(i.endDate);
    } else if (type === SCHEDULE_INTENT_TYPES.SET_PHASE) {
      if (i.schedulePhase) next.schedulePhase = String(i.schedulePhase);
    } else {
      return { ok: false, error: "invalid_intent" };
    }

    if (i.schedulePhase && type !== SCHEDULE_INTENT_TYPES.SET_PHASE) {
      next.schedulePhase = String(i.schedulePhase);
    }

    return {
      ok: true,
      preview: {
        ...next,
        schedulePhaseLabel: schedulePhaseLabel(next.schedulePhase),
        reason: String(i.reason || ""),
        source: String(i.source || "builder_ui"),
      },
    };
  }

  function applyScheduleIntent(projectId, intent) {
    const preview = previewScheduleIntent(projectId, intent);
    if (!preview.ok) return preview;
    const p = preview.preview;
    const reason =
      intent?.reason ||
      (intent?.source === "ai_assistant"
        ? `AI 提案: ${formatScheduleDetail(p.scheduleStartDate, p.scheduleEndDate, p.schedulePhaseLabel)}`
        : "");
    return updateSchedule(projectId, {
      scheduleStartDate: p.scheduleStartDate,
      scheduleEndDate: p.scheduleEndDate,
      schedulePhase: p.schedulePhase,
      reason,
    });
  }

  function listScheduledProjects() {
    return listProjects().filter(hasScheduleRange);
  }

  function getProjectsForDate(dateStr) {
    const d = toDateOnlyString(dateStr);
    if (!d) return [];
    return listScheduledProjects().filter((p) =>
      isDateInRange(d, p.scheduleStartDate, p.scheduleEndDate)
    );
  }

  function getWeekRange(anchorDate) {
    const base = parseDateOnly(anchorDate) || new Date();
    const day = base.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(base);
    start.setDate(base.getDate() + mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toDateOnlyString(start), end: toDateOnlyString(end) };
  }

  function getProjectsForDateRange(startStr, endStr) {
    const start = parseDateOnly(startStr);
    const end = parseDateOnly(endStr);
    if (!start || !end) return [];
    return listScheduledProjects().filter((p) => {
      const ps = parseDateOnly(p.scheduleStartDate);
      const pe = parseDateOnly(p.scheduleEndDate);
      if (!ps || !pe) return false;
      return pe.getTime() >= start.getTime() && ps.getTime() <= end.getTime();
    });
  }

  function getTodayProjects() {
    return getProjectsForDate(todayDateOnly());
  }

  function getThisWeekProjects() {
    const range = getWeekRange(todayDateOnly());
    return getProjectsForDateRange(range.start, range.end);
  }

  function isDelayedProject(project) {
    if (!project || project.status === "completed") return false;
    if (!project.scheduleEndDate) return false;
    const end = parseDateOnly(project.scheduleEndDate);
    const today = parseDateOnly(todayDateOnly());
    if (!end || !today) return false;
    return end.getTime() < today.getTime();
  }

  function getDelayedProjects() {
    return listScheduledProjects()
      .filter(isDelayedProject)
      .sort((a, b) => String(a.scheduleEndDate).localeCompare(String(b.scheduleEndDate)));
  }

  function clearForTests() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  global.TasuBuilderProjectStore = {
    STORAGE_KEY,
    SCHEMA_VERSION,
    STATUSES,
    CATEGORIES,
    SCHEDULE_PHASES,
    SCHEDULE_INTENT_TYPES,
    TIMELINE_LABELS,
    statusLabel,
    categoryLabel,
    schedulePhaseLabel,
    parseDateOnly,
    toDateOnlyString,
    todayDateOnly,
    isDateInRange,
    hasScheduleRange,
    isDelayedProject,
    listProjects,
    getProject,
    searchProjects,
    saveProject,
    updateProject,
    updateSchedule,
    saveVisionDiagnosis,
    previewScheduleIntent,
    applyScheduleIntent,
    listScheduledProjects,
    getProjectsForDate,
    getProjectsForDateRange,
    getWeekRange,
    getTodayProjects,
    getThisWeekProjects,
    getDelayedProjects,
    ensureSeed,
    seedDemoProjects,
    clearForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
