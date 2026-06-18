/**
 * 一般公開 — 案件詳細（public-project-detail.html）
 * builder_board のみ表示。応募は既存 MVP ストア構造を利用。
 */
(function () {
  "use strict";

  const MVP_KEY = "tasful:builder:mvp:v1";
  const MVP_NOTIF_KEY = "tasful:builder:mvp:notifications:v1";
  const PARTNER_ID_KEY = "tasful:builder:mvp:partner_id";
  const DEFAULT_PARTNER_ID = "demo-partner-001";

  const PUBLIC_PROJECT_FALLBACK = [
    {
      project_id: "demo-project-001",
      title: "共同住宅外装改修（足場工事）",
      kind: "builder_board",
      status: "open",
      visibility: "public",
      created_at: "2026-05-25T10:10:00+09:00",
      required_partners: 1,
      selected_partner_ids: [],
    },
    {
      project_id: "builder_demo_001",
      title: "店舗内装リニューアル（Builder）",
      kind: "builder_board",
      status: "open",
      visibility: "partner_only",
      created_at: "2026-06-06T00:00:00+09:00",
      required_partners: 1,
      selected_partner_ids: [],
    },
  ];

  const PUBLIC_PROJECT_SPEC_FALLBACK = {
    "demo-project-001": {
      area: { label: "東京都新宿区" },
      period: { start: "2026-06-10", end: "2026-06-30" },
      budget: { min: 600000, max: 900000 },
      trade_tags: ["足場", "建設"],
      overview: "共同住宅の外装改修に伴う足場工事の一般案件です。",
      work_content: "仮設足場の設計・施工・解体まで一括対応。",
      preferred_conditions: "足場工事の実績がある方歓迎。",
      notes: "安全帯・ヘルメット等の装備は各自でご用意ください。",
      attachments: [],
    },
    builder_demo_001: {
      area: { label: "東京都渋谷区" },
      period: { start: "2026-06-10", end: "2026-06-28" },
      reward: "¥980,000",
      trade_tags: ["内装"],
      overview: "店舗内装リニューアル一式の協力会社募集。",
      work_content: "設計・施工・仕上げまでの内装工事。",
      preferred_conditions: "内装工事の経験者優遇。",
      notes: "現場見学は事前予約制です。",
      attachments: [],
    },
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getProjectId() {
    try {
      return new URLSearchParams(window.location.search).get("id") || "";
    } catch {
      return "";
    }
  }

  function readState() {
    try {
      const raw = localStorage.getItem(MVP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeState(state) {
    localStorage.setItem(MVP_KEY, JSON.stringify(state));
    document.dispatchEvent(new CustomEvent("builder:mvp-changed"));
  }

  function getPartnerId() {
    return localStorage.getItem(PARTNER_ID_KEY) || DEFAULT_PARTNER_ID;
  }

  function formatBudget(budget, reward) {
    if (reward) return String(reward);
    if (!budget || typeof budget !== "object") return "応相談";
    const max = Number(budget.max || budget.min || 0);
    if (!Number.isFinite(max) || max <= 0) return "応相談";
    if (max >= 10000) return `${Math.round(max / 10000).toLocaleString()}万円`;
    return `${max.toLocaleString()}円`;
  }

  function formatPeriod(period) {
    if (!period?.start || !period?.end) return "—";
    return `${period.start}〜${period.end}`;
  }

  function formatTradeLabel(tag) {
    const map = { scaffold: "足場", interior: "内装", carpenter: "大工", electrician: "電気" };
    const t = String(tag || "").trim();
    return map[t] || t;
  }

  function isBoardProject(project) {
    return String(project?.kind || "") === "builder_board";
  }

  function findProject(state, id) {
    let project = (state.projects || []).find((p) => p.project_id === id);
    if (!project) project = PUBLIC_PROJECT_FALLBACK.find((p) => p.project_id === id);
    if (!project || !isBoardProject(project)) return null;
    const spec =
      state.specs?.[id] ||
      PUBLIC_PROJECT_SPEC_FALLBACK[id] ||
      {};
    return { project, spec };
  }

  function buildMetric(label, value) {
    return (
      `<div class="job-top-metrics__item">` +
      `<dt class="job-top-metrics__label">${esc(label)}</dt>` +
      `<dd class="job-top-metrics__value">${esc(value)}</dd>` +
      `</div>`
    );
  }

  function canApply(state, project) {
    const partnerId = getPartnerId();
    const apps = state.applications || [];
    const myApp = apps.find((a) => a.project_id === project.project_id && a.partner_id === partnerId);
    if (myApp) return false;
    const required = Math.max(1, Number(project.required_partners || 1));
    const selected = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids.length : 0;
    if (selected >= required) return false;
    if (project.status === "completed" || project.status === "invoiced") return false;
    return true;
  }

  function applyStatusText(state, project) {
    const partnerId = getPartnerId();
    const apps = state.applications || [];
    const myApp = apps.find((a) => a.project_id === project.project_id && a.partner_id === partnerId);
    const selectedIds = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
    const required = Math.max(1, Number(project.required_partners || 1));

    if (selectedIds.includes(partnerId)) {
      return "採用済みです。詳細確認はチャットで行えます。";
    }
    if (myApp) {
      return myApp.status === "rejected" ? "却下されました。" : "応募済みです。採用結果をお待ちください。";
    }
    if (selectedIds.length >= required) return "募集は終了しました。";
    return "";
  }

  function pushNotification(payload) {
    try {
      const list = JSON.parse(localStorage.getItem(MVP_NOTIF_KEY) || "[]");
      list.unshift({
        id: uid("notif"),
        ts: nowIso(),
        read: false,
        ...payload,
      });
      localStorage.setItem(MVP_NOTIF_KEY, JSON.stringify(list.slice(0, 200)));
    } catch {
      // ignore
    }
  }

  function applyToProject(projectId) {
    const state = readState();
    const partnerId = getPartnerId();
    const project = (state.projects || []).find((p) => p.project_id === projectId) ||
      PUBLIC_PROJECT_FALLBACK.find((p) => p.project_id === projectId);
    if (!project || !isBoardProject(project)) return false;
    if (!canApply(state, project)) return false;

    const next = { ...state };
    if (!Array.isArray(next.projects)) next.projects = [...PUBLIC_PROJECT_FALLBACK];
    if (!next.projects.some((p) => p.project_id === projectId)) {
      next.projects = [...next.projects, project];
    }
    next.applications = [
      ...(next.applications || []),
      { project_id: projectId, partner_id: partnerId, status: "applied", ts: nowIso() },
    ];

    const threadId = project.main_thread_id || "";
    if (threadId && next.threads?.[threadId]) {
      next.threads = { ...next.threads };
      next.threads[threadId] = {
        ...next.threads[threadId],
        events: [
          ...(next.threads[threadId].events || []),
          {
            type: "applied",
            actor: { id: partnerId, type: "partner", name: "応募者" },
            ts: nowIso(),
            text: "応募がありました",
          },
        ],
        messages: [
          ...(next.threads[threadId].messages || []),
          {
            msg_id: uid("msg"),
            from: { id: partnerId, type: "partner", name: "応募者" },
            ts: nowIso(),
            text: "応募します。条件確認をお願いします。",
          },
        ],
      };
    }

    writeState(next);
    pushNotification({
      type: "application",
      body: `${project.title || projectId} に応募がありました。`,
      project_id: projectId,
      thread_id: project.main_thread_id || null,
    });
    return true;
  }

  function syncApplyUi(state, project) {
    const applyBtn = $("[data-public-project-apply]");
    const dockApply = $("[data-public-project-dock-apply]");
    const statusEl = $("[data-public-project-apply-status]");
    const showApply = canApply(state, project);
    const statusText = applyStatusText(state, project);

    [applyBtn, dockApply].forEach((btn) => {
      if (!btn) return;
      btn.hidden = !showApply;
      btn.disabled = !showApply;
    });

    if (statusEl) {
      if (statusText) {
        statusEl.hidden = false;
        statusEl.textContent = statusText;
      } else {
        statusEl.hidden = true;
        statusEl.textContent = "";
      }
    }
  }

  function renderAttachments(spec) {
    const host = $("[data-public-project-attachments]");
    if (!host) return;
    const attachments = spec.attachments || [];
    if (!attachments.length) {
      host.innerHTML = `<li class="text-gray-500">添付資料はありません</li>`;
      return;
    }
    host.innerHTML = attachments
      .map((a) => {
        const name = esc(a.name || "資料");
        if (a.url) {
          return `<li style="margin-bottom:0.5rem;"><a href="${esc(a.url)}" class="text-gold-dark hover:underline" target="_blank" rel="noopener">${name}</a></li>`;
        }
        return `<li style="margin-bottom:0.5rem;">${name}</li>`;
      })
      .join("");
  }

  function render() {
    const id = getProjectId() || "demo-project-001";
    const state = readState();
    const found = findProject(state, id);

    if (!found) {
      setText("[data-public-project-title]", "案件が見つかりません");
      setText("[data-public-project-summary]", `id: ${id}`);
      syncApplyUi(state, { project_id: id, required_partners: 1, selected_partner_ids: [] });
      return;
    }

    const { project, spec } = found;
    const area = spec.area?.label || spec.area || "—";
    const period = formatPeriod(spec.period);
    const reward = formatBudget(spec.budget, spec.reward);
    const trades = (spec.trade_tags || spec.trades || []).map(formatTradeLabel).filter(Boolean);
    const tags = ["一般案件", "業務委託", ...trades];

    setText("[data-public-project-title]", project.title || "案件");
    setText("[data-public-project-summary]", `${area} · ${reward} · ${period}`);
    setText("[data-public-project-reward]", reward);
    setText("[data-public-project-overview]", spec.overview || "—");
    setText("[data-public-project-work]", spec.work_content || "—");

    const tagsHost = $("[data-public-project-tags]");
    if (tagsHost) {
      tagsHost.innerHTML = tags.map((t) => `<span class="job-hero-tag">${esc(t)}</span>`).join("");
    }

    const tradesHost = $("[data-public-project-trades]");
    if (tradesHost) {
      tradesHost.innerHTML = trades.length
        ? trades.map((t) => `<span class="job-hero-tag">${esc(t)}</span>`).join("")
        : `<span class="text-gray-500">—</span>`;
    }

    const metricsHost = $("[data-public-project-metrics]");
    if (metricsHost) {
      metricsHost.innerHTML =
        buildMetric("勤務地", area) +
        buildMetric("報酬", reward) +
        buildMetric("工期", period) +
        buildMetric("雇用形態", "業務委託") +
        buildMetric("募集状況", project.status === "open" ? "募集中" : "受付終了");
    }

    renderAttachments(spec);
    syncApplyUi(state, project);
  }

  function setText(sel, text) {
    const el = $(sel);
    if (el) el.textContent = text || "—";
  }

  function wireApply() {
    const handler = () => {
      const id = getProjectId() || "demo-project-001";
      if (applyToProject(id)) {
        render();
        const statusEl = $("[data-public-project-apply-status]");
        if (statusEl) statusEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };

    $("[data-public-project-apply]")?.addEventListener("click", handler);
    $("[data-public-project-dock-apply]")?.addEventListener("click", handler);
  }

  function initBackLink() {
    const link = $("[data-public-project-back-link]");
    if (!link) return;
    const ref = String(document.referrer || "");
    link.href = ref.includes("public-projects.html") ? ref : "public-projects.html";
  }

  function init() {
    initBackLink();
    wireApply();
    render();
    document.addEventListener("builder:mvp-changed", render);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
