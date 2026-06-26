/**
 * Builder Project Hub — 案件ストア（Phase 6-A〜6-D · localStorage）
 * Builder 専用 · Platform / AI秘書 / TASFUL AI 非連携
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_builder_project_hub_v1";
  const SCHEMA_VERSION = 4;

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
    finance_updated: "収支更新",
    estimate_updated: "見積更新",
    invoice_updated: "請求更新",
  });

  const TAX_RATE = 0.1;

  /** 見積状態（Phase 6-D） */
  const ESTIMATE_STATUSES = Object.freeze([
    { id: "draft", label: "下書き" },
    { id: "submitted", label: "提出済" },
    { id: "approved", label: "承認済" },
    { id: "expired", label: "期限切れ" },
    { id: "cancelled", label: "取消" },
  ]);

  /** 請求状態（Phase 6-D） */
  const INVOICE_STATUSES = Object.freeze([
    { id: "draft", label: "下書き" },
    { id: "issued", label: "発行済" },
    { id: "paid", label: "入金済" },
    { id: "cancelled", label: "取消" },
  ]);

  const ESTIMATE_INTENT_TYPES = Object.freeze({
    SET_STATUS: "set_status",
    ADD_ITEM: "add_item",
    SET_VALID_UNTIL: "set_valid_until",
  });

  const INVOICE_INTENT_TYPES = Object.freeze({
    SET_STATUS: "set_status",
    SET_DUE_DATE: "set_due_date",
    MARK_PAID: "mark_paid",
  });

  /** 支払い状況（Phase 6-C） */
  const PAYMENT_STATUSES = Object.freeze([
    { id: "unpaid", label: "未入金" },
    { id: "partial", label: "一部入金" },
    { id: "paid", label: "入金済" },
  ]);

  const FINANCE_INTENT_TYPES = Object.freeze({
    SET_ESTIMATE: "set_estimate",
    SET_COST: "set_cost",
    SET_PAYMENT_STATUS: "set_payment_status",
    SET_DUE_DATE: "set_due_date",
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

  function paymentStatusLabel(id) {
    return PAYMENT_STATUSES.find((s) => s.id === id)?.label || id;
  }

  function estimateStatusLabel(id) {
    return ESTIMATE_STATUSES.find((s) => s.id === id)?.label || id;
  }

  function invoiceStatusLabel(id) {
    return INVOICE_STATUSES.find((s) => s.id === id)?.label || id;
  }

  function calcTax(subtotal) {
    return Math.round(toAmount(subtotal) * TAX_RATE);
  }

  function calcTotal(subtotal, tax) {
    return toAmount(subtotal) + toAmount(tax);
  }

  function normalizeEstimateItem(raw) {
    const it = raw && typeof raw === "object" ? raw : {};
    const quantity = Math.max(0, Number(it.quantity) || 0);
    const unitPrice = toAmount(it.unitPrice);
    const amount = toAmount(it.amount) || Math.round(quantity * unitPrice);
    return {
      id: String(it.id || uid("est_it")),
      description: String(it.description || ""),
      quantity,
      unitPrice,
      amount,
    };
  }

  function normalizeEstimate(raw, project) {
    const e = raw && typeof raw === "object" ? raw : {};
    const items = Array.isArray(e.items) ? e.items.map(normalizeEstimateItem) : [];
    const calc = calculateEstimateAmounts(items);
    const status = String(e.estimateStatus || "draft");
    return {
      estimateNumber: String(e.estimateNumber || ""),
      estimateStatus: status,
      estimateStatusLabel: String(e.estimateStatusLabel || estimateStatusLabel(status)),
      createdAt: String(e.createdAt || project?.createdAt || nowIso()),
      validUntil: String(e.validUntil || ""),
      customerName: String(e.customerName || project?.customerName || ""),
      customerAddress: String(e.customerAddress || ""),
      items,
      subtotal: calc.subtotal,
      tax: calc.tax,
      total: calc.total,
      memo: String(e.memo || ""),
      updatedAt: String(e.updatedAt || ""),
    };
  }

  function normalizeInvoice(raw) {
    const inv = raw && typeof raw === "object" ? raw : {};
    const subtotal = toAmount(inv.subtotal);
    const tax = inv.tax != null ? toAmount(inv.tax) : calcTax(subtotal);
    const status = String(inv.invoiceStatus || "draft");
    return {
      invoiceNumber: String(inv.invoiceNumber || ""),
      invoiceStatus: status,
      invoiceStatusLabel: String(inv.invoiceStatusLabel || invoiceStatusLabel(status)),
      issuedAt: String(inv.issuedAt || ""),
      dueDate: String(inv.dueDate || ""),
      paidAt: String(inv.paidAt || ""),
      subtotal,
      tax,
      total: inv.total != null ? toAmount(inv.total) : calcTotal(subtotal, tax),
      memo: String(inv.memo || ""),
      updatedAt: String(inv.updatedAt || ""),
    };
  }

  function calculateEstimateAmounts(items) {
    const list = Array.isArray(items) ? items.map(normalizeEstimateItem) : [];
    const subtotal = list.reduce((sum, it) => sum + toAmount(it.amount), 0);
    const tax = calcTax(subtotal);
    return { subtotal, tax, total: calcTotal(subtotal, tax), items: list };
  }

  function calculateEstimate(estimate) {
    return normalizeEstimate(estimate);
  }

  function calculateInvoice(invoice) {
    return normalizeInvoice(invoice);
  }

  function toAmount(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  }

  function formatYen(amount) {
    return `¥${toAmount(amount).toLocaleString("ja-JP")}`;
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

  function normalizeFinance(raw) {
    const f = raw && typeof raw === "object" ? raw : {};
    const estimateAmount = toAmount(f.estimateAmount);
    const costAmount = toAmount(f.costAmount);
    const paymentStatus = String(f.paymentStatus || "unpaid");
    const calc = calculateFinanceAmounts(estimateAmount, costAmount);
    return {
      estimateAmount,
      costAmount,
      grossProfit: calc.grossProfit,
      grossProfitRate: calc.grossProfitRate,
      paymentStatus,
      paymentStatusLabel: String(f.paymentStatusLabel || paymentStatusLabel(paymentStatus)),
      paymentDueDate: String(f.paymentDueDate || ""),
      paidAt: String(f.paidAt || ""),
      memo: String(f.memo || ""),
      updatedAt: String(f.updatedAt || ""),
    };
  }

  function calculateFinanceAmounts(estimateAmount, costAmount) {
    const estimate = toAmount(estimateAmount);
    const cost = toAmount(costAmount);
    const grossProfit = estimate - cost;
    const grossProfitRate =
      estimate > 0 ? Math.round((grossProfit / estimate) * 1000) / 10 : 0;
    return { grossProfit, grossProfitRate };
  }

  function calculateProjectFinance(project) {
    const f = normalizeFinance(project?.finance || project);
    return { ...f };
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
      finance: normalizeFinance(p.finance || p),
      estimate: normalizeEstimate(p.estimate, p),
      invoice: normalizeInvoice(p.invoice),
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
        finance: {
          estimateAmount: 1200000,
          costAmount: 800000,
          paymentStatus: "unpaid",
          paymentDueDate: dateOnlyOffset(30),
          memo: "概算見積ベース",
        },
        estimate: {
          estimateNumber: "EST-2026-001",
          estimateStatus: "submitted",
          validUntil: dateOnlyOffset(30),
          customerName: "田中 様",
          customerAddress: "東京都世田谷区 1-2-3",
          items: [
            { description: "外壁ひび補修", quantity: 1, unitPrice: 600000, amount: 600000 },
            { description: "部分塗装", quantity: 1, unitPrice: 490909, amount: 490909 },
          ],
          memo: "現調後正式見積",
        },
        invoice: {
          invoiceNumber: "",
          invoiceStatus: "draft",
          subtotal: 0,
          tax: 0,
          total: 0,
          memo: "未請求",
        },
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
        finance: {
          estimateAmount: 3500000,
          costAmount: 0,
          paymentStatus: "unpaid",
          paymentDueDate: dateOnlyOffset(45),
          memo: "見積作成中",
        },
        estimate: {
          estimateNumber: "EST-2026-002",
          estimateStatus: "draft",
          validUntil: dateOnlyOffset(45),
          customerName: "佐藤 様",
          customerAddress: "神奈川県横浜市…",
          items: [
            { description: "キッチンリフォーム", quantity: 1, unitPrice: 2000000, amount: 2000000 },
            { description: "浴室リフォーム", quantity: 1, unitPrice: 1181818, amount: 1181818 },
          ],
          memo: "打合せ後確定予定",
        },
        invoice: {
          invoiceNumber: "",
          invoiceStatus: "draft",
          subtotal: 0,
          tax: 0,
          total: 0,
        },
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
        finance: {
          estimateAmount: 2800000,
          costAmount: 2100000,
          paymentStatus: "partial",
          paymentDueDate: dateOnlyOffset(-5),
          paidAt: dateOnlyOffset(-20),
          memo: "着手金入金済・残金未収",
        },
        estimate: {
          estimateNumber: "EST-2026-003",
          estimateStatus: "approved",
          validUntil: dateOnlyOffset(-10),
          customerName: "山本商事",
          customerAddress: "大阪府大阪市…",
          items: [
            { description: "店舗内装工事", quantity: 1, unitPrice: 2545455, amount: 2545455 },
          ],
          memo: "承認済",
        },
        invoice: {
          invoiceNumber: "INV-2026-003",
          invoiceStatus: "issued",
          issuedAt: dateOnlyOffset(-15),
          dueDate: dateOnlyOffset(-3),
          subtotal: 2545455,
          tax: 254545,
          total: 2800000,
          memo: "残金請求中",
        },
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

  function isUnpaidProject(project) {
    const status = project?.finance?.paymentStatus || "unpaid";
    return status === "unpaid" || status === "partial";
  }

  function isOverduePaymentProject(project) {
    const f = project?.finance;
    if (!f || f.paymentStatus === "paid") return false;
    if (!f.paymentDueDate) return false;
    const due = parseDateOnly(f.paymentDueDate);
    const today = parseDateOnly(todayDateOnly());
    if (!due || !today) return false;
    return due.getTime() < today.getTime();
  }

  function getUnpaidProjects() {
    return listProjects().filter(isUnpaidProject);
  }

  function getOverduePaymentProjects() {
    return listProjects()
      .filter(isOverduePaymentProject)
      .sort((a, b) =>
        String(a.finance?.paymentDueDate || "").localeCompare(String(b.finance?.paymentDueDate || ""))
      );
  }

  function getFinanceSummary() {
    const projects = listProjects();
    let totalEstimate = 0;
    let totalCost = 0;
    let unpaidCount = 0;
    let overdueCount = 0;
    projects.forEach((p) => {
      const f = calculateProjectFinance(p);
      totalEstimate += f.estimateAmount;
      totalCost += f.costAmount;
      if (isUnpaidProject(p)) unpaidCount += 1;
      if (isOverduePaymentProject(p)) overdueCount += 1;
    });
    const totalGrossProfit = totalEstimate - totalCost;
    return {
      totalEstimate,
      totalCost,
      totalGrossProfit,
      unpaidCount,
      overdueCount,
      projectCount: projects.length,
    };
  }

  function formatFinanceDetail(finance) {
    const f = normalizeFinance(finance);
    const parts = [
      `見積 ${formatYen(f.estimateAmount)}`,
      `原価 ${formatYen(f.costAmount)}`,
      `粗利 ${formatYen(f.grossProfit)}（${f.grossProfitRate}%）`,
      f.paymentStatusLabel,
    ];
    if (f.paymentDueDate) parts.push(`支払予定 ${f.paymentDueDate}`);
    return parts.join(" · ");
  }

  /**
   * @param {string} projectId
   * @param {object} financePatch
   */
  function updateFinance(projectId, financePatch) {
    const existing = getProject(projectId);
    if (!existing) return { ok: false, error: "not_found" };
    const patch = financePatch && typeof financePatch === "object" ? financePatch : {};
    const prev = existing.finance || {};
    const merged = normalizeFinance({
      ...prev,
      ...patch,
      updatedAt: nowIso(),
    });
    const next = normalizeProject({ ...existing, finance: merged });
    addTimelineEvent(
      next,
      "finance_updated",
      patch.financeReason != null
        ? String(patch.financeReason).slice(0, 500)
        : formatFinanceDetail(merged)
    );
    next.updatedAt = nowIso();
    const data = readAll();
    const idx = data.projects.findIndex((x) => x.id === projectId);
    data.projects[idx] = next;
    writeAll(data);
    return { ok: true, project: next, finance: next.finance };
  }

  /**
   * Builder AI 連携準備 — 自然文から finance intent を推定（プレビューのみ）
   * @param {string} intentText
   */
  function previewFinanceIntent(intentText) {
    const text = String(intentText || "").trim();
    if (!text) return { ok: false, error: "empty_intent" };

    const intent = { source: "ai_assistant", rawText: text };
    const estimateMatch = text.match(/見積\s*[:：]?\s*([\d,.]+)\s*万?/);
    const costMatch = text.match(/原価\s*[:：]?\s*([\d,.]+)\s*万?/);
    const paidMatch = /入金済|支払い?済|paid/i.test(text);
    const partialMatch = /一部入金|partial/i.test(text);
    const dueMatch = text.match(/支払(?:予定|期限)\s*[:：]?\s*(\d{4}-\d{2}-\d{2})/);

    if (estimateMatch) {
      intent.type = FINANCE_INTENT_TYPES.SET_ESTIMATE;
      const n = Number(estimateMatch[1].replace(/,/g, ""));
      intent.estimateAmount = text.includes("万") ? Math.round(n * 10000) : Math.round(n);
    } else if (costMatch) {
      intent.type = FINANCE_INTENT_TYPES.SET_COST;
      const n = Number(costMatch[1].replace(/,/g, ""));
      intent.costAmount = text.includes("万") ? Math.round(n * 10000) : Math.round(n);
    } else if (paidMatch) {
      intent.type = FINANCE_INTENT_TYPES.SET_PAYMENT_STATUS;
      intent.paymentStatus = "paid";
    } else if (partialMatch) {
      intent.type = FINANCE_INTENT_TYPES.SET_PAYMENT_STATUS;
      intent.paymentStatus = "partial";
    } else if (dueMatch) {
      intent.type = FINANCE_INTENT_TYPES.SET_DUE_DATE;
      intent.paymentDueDate = dueMatch[1];
    } else {
      return { ok: false, error: "unrecognized_intent", rawText: text };
    }

    return { ok: true, intent };
  }

  /**
   * 将来 AI 連携用 — 現時点ではテスト/UI からのみ呼び出し可
   */
  function applyFinanceIntent(projectId, financeIntent) {
    const i = financeIntent && typeof financeIntent === "object" ? financeIntent : {};
    const type = String(i.type || "");
    const patch = { financeReason: i.reason || i.rawText || "AI 収支提案" };

    if (type === FINANCE_INTENT_TYPES.SET_ESTIMATE) {
      patch.estimateAmount = toAmount(i.estimateAmount);
    } else if (type === FINANCE_INTENT_TYPES.SET_COST) {
      patch.costAmount = toAmount(i.costAmount);
    } else if (type === FINANCE_INTENT_TYPES.SET_PAYMENT_STATUS) {
      patch.paymentStatus = String(i.paymentStatus || "unpaid");
      if (patch.paymentStatus === "paid" && !i.paidAt) {
        patch.paidAt = todayDateOnly();
      }
    } else if (type === FINANCE_INTENT_TYPES.SET_DUE_DATE) {
      patch.paymentDueDate = String(i.paymentDueDate || "");
    } else {
      return { ok: false, error: "invalid_intent" };
    }

    return updateFinance(projectId, patch);
  }

  function formatEstimateDetail(estimate) {
    const e = normalizeEstimate(estimate);
    return `見積 ${e.estimateNumber || "—"} · ${e.estimateStatusLabel} · ${formatYen(e.total)}`;
  }

  function formatInvoiceDetail(invoice) {
    const inv = normalizeInvoice(invoice);
    return `請求 ${inv.invoiceNumber || "—"} · ${inv.invoiceStatusLabel} · ${formatYen(inv.total)}`;
  }

  function isUninvoicedProject(project) {
    const inv = project?.invoice;
    if (!inv) return true;
    if (!inv.invoiceNumber && inv.invoiceStatus === "draft") return true;
    return inv.invoiceStatus === "draft" && toAmount(inv.total) === 0;
  }

  function isOutstandingInvoice(project) {
    return project?.invoice?.invoiceStatus === "issued";
  }

  function getOutstandingInvoices() {
    return listProjects()
      .filter(isOutstandingInvoice)
      .sort((a, b) =>
        String(a.invoice?.dueDate || "").localeCompare(String(b.invoice?.dueDate || ""))
      );
  }

  function getUninvoicedProjects() {
    return listProjects().filter(isUninvoicedProject);
  }

  function getEstimateSummary() {
    const projects = listProjects();
    let totalEstimate = 0;
    let uninvoicedCount = 0;
    projects.forEach((p) => {
      const e = calculateEstimate(p.estimate);
      totalEstimate += e.total;
      if (isUninvoicedProject(p)) uninvoicedCount += 1;
    });
    return { totalEstimate, uninvoicedCount, projectCount: projects.length };
  }

  function getInvoiceSummary() {
    const projects = listProjects();
    let totalInvoice = 0;
    let outstandingCount = 0;
    projects.forEach((p) => {
      const inv = calculateInvoice(p.invoice);
      if (inv.invoiceStatus !== "cancelled") totalInvoice += inv.total;
      if (isOutstandingInvoice(p)) outstandingCount += 1;
    });
    return { totalInvoice, outstandingCount, projectCount: projects.length };
  }

  /**
   * @param {string} projectId
   * @param {object} estimatePatch
   */
  function updateEstimate(projectId, estimatePatch) {
    const existing = getProject(projectId);
    if (!existing) return { ok: false, error: "not_found" };
    const patch = estimatePatch && typeof estimatePatch === "object" ? estimatePatch : {};
    const prev = existing.estimate || {};
    const mergedInput = { ...prev, ...patch, updatedAt: nowIso() };
    if (patch.items) mergedInput.items = patch.items;
    const merged = normalizeEstimate(mergedInput, existing);
    const next = normalizeProject({ ...existing, estimate: merged });
    addTimelineEvent(
      next,
      "estimate_updated",
      patch.estimateReason != null
        ? String(patch.estimateReason).slice(0, 500)
        : formatEstimateDetail(merged)
    );
    next.updatedAt = nowIso();
    const data = readAll();
    const idx = data.projects.findIndex((x) => x.id === projectId);
    data.projects[idx] = next;
    writeAll(data);
    return { ok: true, project: next, estimate: next.estimate };
  }

  /**
   * @param {string} projectId
   * @param {object} invoicePatch
   */
  function updateInvoice(projectId, invoicePatch) {
    const existing = getProject(projectId);
    if (!existing) return { ok: false, error: "not_found" };
    const patch = invoicePatch && typeof invoicePatch === "object" ? invoicePatch : {};
    const prev = existing.invoice || {};
    const merged = normalizeInvoice({ ...prev, ...patch, updatedAt: nowIso() });
    if (merged.invoiceStatus === "paid" && !merged.paidAt) {
      merged.paidAt = todayDateOnly();
    }
    const next = normalizeProject({ ...existing, invoice: merged });
    addTimelineEvent(
      next,
      "invoice_updated",
      patch.invoiceReason != null
        ? String(patch.invoiceReason).slice(0, 500)
        : formatInvoiceDetail(merged)
    );
    next.updatedAt = nowIso();
    const data = readAll();
    const idx = data.projects.findIndex((x) => x.id === projectId);
    data.projects[idx] = next;
    writeAll(data);
    return { ok: true, project: next, invoice: next.invoice };
  }

  function previewEstimateIntent(intentText) {
    const text = String(intentText || "").trim();
    if (!text) return { ok: false, error: "empty_intent" };
    const intent = { source: "ai_assistant", rawText: text };
    const statusMatch = text.match(/見積(?:状態|ステータス)\s*[:：]?\s*(下書き|提出済|承認済|draft|submitted|approved)/i);
    const validMatch = text.match(/有効期限\s*[:：]?\s*(\d{4}-\d{2}-\d{2})/);
    const itemMatch = text.match(/(.+?)\s+([\d,.]+)\s*円/);

    if (statusMatch) {
      intent.type = ESTIMATE_INTENT_TYPES.SET_STATUS;
      const map = { 下書き: "draft", 提出済: "submitted", 承認済: "approved", draft: "draft", submitted: "submitted", approved: "approved" };
      intent.estimateStatus = map[statusMatch[1]] || "draft";
    } else if (validMatch) {
      intent.type = ESTIMATE_INTENT_TYPES.SET_VALID_UNTIL;
      intent.validUntil = validMatch[1];
    } else if (itemMatch) {
      intent.type = ESTIMATE_INTENT_TYPES.ADD_ITEM;
      intent.item = { description: itemMatch[1].trim(), quantity: 1, unitPrice: toAmount(itemMatch[2].replace(/,/g, "")) };
    } else {
      return { ok: false, error: "unrecognized_intent", rawText: text };
    }
    return { ok: true, intent };
  }

  function previewInvoiceIntent(intentText) {
    const text = String(intentText || "").trim();
    if (!text) return { ok: false, error: "empty_intent" };
    const intent = { source: "ai_assistant", rawText: text };
    const statusMatch = text.match(/請求(?:状態|ステータス)\s*[:：]?\s*(下書き|発行済|入金済|draft|issued|paid)/i);
    const dueMatch = text.match(/支払期限\s*[:：]?\s*(\d{4}-\d{2}-\d{2})/);
    const paidMatch = /入金済|支払い?済|paid/i.test(text);

    if (paidMatch) {
      intent.type = INVOICE_INTENT_TYPES.MARK_PAID;
      intent.invoiceStatus = "paid";
    } else if (statusMatch) {
      intent.type = INVOICE_INTENT_TYPES.SET_STATUS;
      const map = { 下書き: "draft", 発行済: "issued", 入金済: "paid", draft: "draft", issued: "issued", paid: "paid" };
      intent.invoiceStatus = map[statusMatch[1]] || "draft";
    } else if (dueMatch) {
      intent.type = INVOICE_INTENT_TYPES.SET_DUE_DATE;
      intent.dueDate = dueMatch[1];
    } else {
      return { ok: false, error: "unrecognized_intent", rawText: text };
    }
    return { ok: true, intent };
  }

  function applyEstimateIntent(projectId, estimateIntent) {
    const i = estimateIntent && typeof estimateIntent === "object" ? estimateIntent : {};
    const type = String(i.type || "");
    const patch = { estimateReason: i.reason || i.rawText || "AI 見積提案" };

    if (type === ESTIMATE_INTENT_TYPES.SET_STATUS) {
      patch.estimateStatus = String(i.estimateStatus || "draft");
    } else if (type === ESTIMATE_INTENT_TYPES.SET_VALID_UNTIL) {
      patch.validUntil = String(i.validUntil || "");
    } else if (type === ESTIMATE_INTENT_TYPES.ADD_ITEM) {
      const project = getProject(projectId);
      const items = [...(project?.estimate?.items || []), normalizeEstimateItem(i.item || {})];
      patch.items = items;
    } else {
      return { ok: false, error: "invalid_intent" };
    }
    return updateEstimate(projectId, patch);
  }

  function applyInvoiceIntent(projectId, invoiceIntent) {
    const i = invoiceIntent && typeof invoiceIntent === "object" ? invoiceIntent : {};
    const type = String(i.type || "");
    const patch = { invoiceReason: i.reason || i.rawText || "AI 請求提案" };

    if (type === INVOICE_INTENT_TYPES.MARK_PAID) {
      patch.invoiceStatus = "paid";
      patch.paidAt = i.paidAt || todayDateOnly();
    } else if (type === INVOICE_INTENT_TYPES.SET_STATUS) {
      patch.invoiceStatus = String(i.invoiceStatus || "draft");
      if (patch.invoiceStatus === "issued" && !i.issuedAt) patch.issuedAt = todayDateOnly();
    } else if (type === INVOICE_INTENT_TYPES.SET_DUE_DATE) {
      patch.dueDate = String(i.dueDate || "");
    } else {
      return { ok: false, error: "invalid_intent" };
    }
    return updateInvoice(projectId, patch);
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
    PAYMENT_STATUSES,
    FINANCE_INTENT_TYPES,
    ESTIMATE_STATUSES,
    INVOICE_STATUSES,
    ESTIMATE_INTENT_TYPES,
    INVOICE_INTENT_TYPES,
    TAX_RATE,
    TIMELINE_LABELS,
    statusLabel,
    categoryLabel,
    schedulePhaseLabel,
    paymentStatusLabel,
    estimateStatusLabel,
    invoiceStatusLabel,
    toAmount,
    formatYen,
    normalizeFinance,
    normalizeEstimate,
    normalizeInvoice,
    normalizeEstimateItem,
    calculateFinanceAmounts,
    calculateProjectFinance,
    calculateEstimateAmounts,
    calculateEstimate,
    calculateInvoice,
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
    isUnpaidProject,
    isOverduePaymentProject,
    getUnpaidProjects,
    getOverduePaymentProjects,
    getFinanceSummary,
    updateFinance,
    previewFinanceIntent,
    applyFinanceIntent,
    updateEstimate,
    updateInvoice,
    getEstimateSummary,
    getInvoiceSummary,
    getOutstandingInvoices,
    getUninvoicedProjects,
    isUninvoicedProject,
    isOutstandingInvoice,
    previewEstimateIntent,
    previewInvoiceIntent,
    applyEstimateIntent,
    applyInvoiceIntent,
    ensureSeed,
    seedDemoProjects,
    clearForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
