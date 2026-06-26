/**
 * Builder Project Hub — 案件ストア（Phase 6-A MVP · localStorage）
 * Builder 専用 · Platform / AI秘書 / TASFUL AI 非連携
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_builder_project_hub_v1";
  const SCHEMA_VERSION = 1;

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
    TIMELINE_LABELS,
    statusLabel,
    categoryLabel,
    listProjects,
    getProject,
    searchProjects,
    saveProject,
    updateProject,
    saveVisionDiagnosis,
    ensureSeed,
    seedDemoProjects,
    clearForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
