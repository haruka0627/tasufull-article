/**
 * 一般公開 — 統合詳細（public-board-detail.html）
 * type=project → 案件 / type=job → 求人（listing-detail-loader 連携）
 */
(function () {
  "use strict";

  const LOG = "public-board-detail";
  const MVP_KEY = "tasful:builder:mvp:v1";
  const MVP_NOTIF_KEY = "tasful:builder:mvp:notifications:v1";
  const PARTNER_ID_KEY = "tasful:builder:mvp:partner_id";
  const DEFAULT_PARTNER_ID = "demo-partner-001";

  /** 通知URLなどレガシーID → デモデータ正規ID */
  const PROJECT_ID_ALIASES = Object.freeze({
    "pub-board-project-001": "pub-board-proj-001",
  });

  const PUBLIC_PROJECT_FALLBACK = [
    {
      project_id: "demo-project-001",
      title: "新宿区 共同住宅 外装改修",
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
      attachments: [],
    },
    builder_demo_001: {
      area: { label: "東京都渋谷区" },
      period: { start: "2026-06-10", end: "2026-06-28" },
      reward: "¥980,000",
      trade_tags: ["内装"],
      overview: "店舗内装リニューアル一式の協力会社募集。",
      work_content: "設計・施工・仕上げまでの内装工事。",
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

  function getParams() {
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return new URLSearchParams();
    }
  }

  function log(step, detail) {
    try {
      console.info(`[${LOG}] ${step}`, detail ?? "");
    } catch {
      /* ignore */
    }
  }

  function normalizeProjectId(id) {
    const raw = String(id || "").trim();
    return PROJECT_ID_ALIASES[raw] || raw;
  }

  function getProjectId() {
    return getParams().get("id") || "";
  }

  function getResolvedProjectId() {
    const raw = getProjectId();
    return normalizeProjectId(raw) || raw;
  }

  function resolveDetailType() {
    const params = getParams();
    let type = String(params.get("type") || "").trim().toLowerCase();
    const id = getProjectId();
    if (!type && id) {
      try {
        const state = JSON.parse(localStorage.getItem(MVP_KEY) || "{}");
        const isProject = (state.projects || []).some(
          (p) => p.project_id === id && String(p.kind || "") === "builder_board"
        );
        if (isProject) type = "project";
      } catch {
        /* ignore */
      }
      if (!type && PUBLIC_PROJECT_FALLBACK.some((p) => p.project_id === id)) {
        type = "project";
      }
    }
    return type === "project" ? "project" : "job";
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

  function getDemoSource() {
    return window.TasuPublicBoardDemo || null;
  }

  function findProject(state, id) {
    const canonicalId = normalizeProjectId(id);
    const demo = getDemoSource();
    const pools = [
      state.projects || [],
      demo?.PROJECTS || PUBLIC_PROJECT_FALLBACK,
    ];
    let project = null;
    for (const pool of pools) {
      project =
        pool.find((p) => p.project_id === canonicalId) ||
        pool.find((p) => p.project_id === id);
      if (project) break;
    }
    if (!project || !isBoardProject(project)) return null;
    const specKey = project.project_id;
    const spec =
      state.specs?.[specKey] ||
      state.specs?.[id] ||
      demo?.SPECS?.[specKey] ||
      demo?.SPECS?.[id] ||
      PUBLIC_PROJECT_SPEC_FALLBACK[specKey] ||
      PUBLIC_PROJECT_SPEC_FALLBACK[id] ||
      {};
    return { project, spec, canonicalId: specKey, requestedId: id };
  }

  function getProjectRoot() {
    return document.querySelector('[data-board-detail-root="project"]');
  }

  function ensureErrorHost() {
    const root = getProjectRoot();
    const main = root?.querySelector(".detail-page-main");
    if (!main) return null;
    let host = main.querySelector("[data-public-board-detail-error]");
    if (!host) {
      host = document.createElement("div");
      host.className = "listing-detail-status listing-detail-status--error";
      host.setAttribute("data-public-board-detail-error", "");
      host.setAttribute("role", "alert");
      main.insertBefore(host, main.firstChild);
    }
    return host;
  }

  let publicProjectFocusToken = 0;
  let publicProjectMobileFocusWired = false;

  function markProjectDetailLoaded(status) {
    const loaded = status === "error" ? "error" : "true";
    document.body.dataset.listingLoaded = loaded;
    document.body.dataset.boardDetailLoaded = loaded;
    log("render:marked-loaded", { listingLoaded: loaded, boardDetailLoaded: loaded });
  }

  function isFromTalkEntry() {
    return getParams().get("from") === "talk";
  }

  function syncPublicProjectChrome(project) {
    const fromTalk = isFromTalkEntry();
    if (fromTalk) {
      document.body.dataset.publicBoardFromTalk = "true";
    } else {
      delete document.body.dataset.publicBoardFromTalk;
    }
    const pageTitle = project?.title || "案件詳細";
    document.title = `${pageTitle} | TASFUL`;
    window.TasufulAppMobile?.refreshMobileShellTitle?.();
    log("render:chrome", { fromTalk, pageTitle, mobileTitle: document.title });
  }

  function measurePublicProjectScrollOffset() {
    const shellHead = document.querySelector("[data-tasu-mobile-shell-head]");
    if (shellHead) return Math.ceil(shellHead.getBoundingClientRect().height) + 10;
    return 12;
  }

  function focusPublicProjectApplyView() {
    if (!isFromTalkEntry()) return false;
    const mobile = window.matchMedia?.("(max-width: 960px)")?.matches;
    const shellHead = document.querySelector("[data-tasu-mobile-shell-head]");
    const shellHeight = shellHead?.getBoundingClientRect().height || 0;
    if (mobile && shellHeight < 20) {
      log("render:focus-skip", { reason: "shell-not-ready" });
      return false;
    }
    const root = getProjectRoot();
    const heroCard = root?.querySelector(".job-top-card.job-hero-section");
    const ctaPanel = root?.querySelector("[data-public-project-cta]");
    const heroApply = root?.querySelector("[data-public-project-apply]");
    const dockApply = root?.querySelector("[data-public-project-dock-apply]");
    const target =
      heroApply && !heroApply.hidden
        ? ctaPanel || heroApply
        : dockApply && !dockApply.hidden
          ? dockApply.closest("[data-public-project-bottom-dock]") || dockApply
          : heroCard;
    if (!target) {
      log("render:focus-skip", { reason: "no-target" });
      return false;
    }

    const offset = measurePublicProjectScrollOffset();
    document.documentElement.style.setProperty("--tasu-public-board-focus-offset", `${offset}px`);

    const rect = target.getBoundingClientRect();
    const top = Math.max(0, window.scrollY + rect.top - offset);
    window.scrollTo({
      top,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
    });

    const highlightEl = heroCard || ctaPanel;
    if (highlightEl) {
      highlightEl.classList.remove("is-view-focus");
      void highlightEl.offsetWidth;
      highlightEl.classList.add("is-view-focus");
      window.clearTimeout(highlightEl._publicBoardFocusTimer);
      highlightEl._publicBoardFocusTimer = window.setTimeout(() => {
        highlightEl.classList.remove("is-view-focus");
      }, 3200);
    }

    log("render:focus-apply", {
      target: target.getAttribute?.("data-public-project-cta") ? "cta-panel" : target.tagName,
      offset,
      scrollTop: top,
      heroApplyVisible: Boolean(heroApply && !heroApply.hidden),
      dockApplyVisible: Boolean(dockApply && !dockApply.hidden),
    });
    return true;
  }

  function schedulePublicProjectFocus() {
    if (!isFromTalkEntry() || resolveDetailType() !== "project") return;
    const token = ++publicProjectFocusToken;
    [0, 80, 180, 360, 600, 900, 1200].forEach((delay) => {
      window.setTimeout(() => {
        if (token !== publicProjectFocusToken) return;
        if (document.body.dataset.boardDetailLoaded !== "true") return;
        focusPublicProjectApplyView();
      }, delay);
    });
  }

  function wirePublicProjectMobileFocus() {
    if (publicProjectMobileFocusWired) return;
    publicProjectMobileFocusWired = true;
    window.addEventListener("tasu:mobile-shell-ready", () => {
      if (resolveDetailType() !== "project") return;
      log("init:mobile-shell-ready", {
        listingLoaded: document.body.dataset.listingLoaded,
        boardDetailLoaded: document.body.dataset.boardDetailLoaded,
      });
      window.TasufulAppMobile?.refreshMobileShellTitle?.();
      schedulePublicProjectFocus();
    });
    window.addEventListener("load", () => {
      if (resolveDetailType() !== "project") return;
      schedulePublicProjectFocus();
    });
  }

  function renderProjectError(message, id) {
    const errorHost = ensureErrorHost();
    if (errorHost) {
      errorHost.hidden = false;
      errorHost.innerHTML =
        `<p class="listing-detail-status__title">${esc(message)}</p>` +
        `<p class="listing-detail-status__body">id: <code>${esc(id)}</code></p>` +
        `<p class="listing-detail-status__actions"><a href="public-board.html" class="text-gold-dark hover:underline">一覧に戻る</a></p>`;
    }
    setText("[data-public-project-title]", message);
    setText("[data-public-project-summary]", `id: ${id}`);
    setText("[data-public-project-overview]", "案件データを取得できませんでした。");
    const applyBtn = $("[data-public-project-apply]");
    const dockApply = $("[data-public-project-dock-apply]");
    [applyBtn, dockApply].forEach((btn) => {
      if (!btn) return;
      btn.hidden = true;
      btn.disabled = true;
    });
    markProjectDetailLoaded("error");
    log("render:fail", { id, message });
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
    const myApp = (state.applications || []).find(
      (a) => a.project_id === project.project_id && a.partner_id === partnerId
    );
    if (myApp) return false;
    const required = Math.max(1, Number(project.required_partners || 1));
    const selected = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids.length : 0;
    if (selected >= required) return false;
    if (project.status === "completed" || project.status === "invoiced") return false;
    return true;
  }

  function applyStatusText(state, project) {
    const partnerId = getPartnerId();
    const myApp = (state.applications || []).find(
      (a) => a.project_id === project.project_id && a.partner_id === partnerId
    );
    const selectedIds = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
    const required = Math.max(1, Number(project.required_partners || 1));
    if (selectedIds.includes(partnerId)) return "採用済みです。詳細確認はチャットで行えます。";
    if (myApp) return myApp.status === "rejected" ? "却下されました。" : "応募済みです。採用結果をお待ちください。";
    if (selectedIds.length >= required) return "募集は終了しました。";
    return "";
  }

  function pushNotification(payload) {
    try {
      const list = JSON.parse(localStorage.getItem(MVP_NOTIF_KEY) || "[]");
      list.unshift({ id: uid("notif"), ts: nowIso(), read: false, ...payload });
      localStorage.setItem(MVP_NOTIF_KEY, JSON.stringify(list.slice(0, 200)));
    } catch {
      /* ignore */
    }
  }

  function applyToProject(projectId) {
    const state = readState();
    const partnerId = getPartnerId();
    const project =
      (state.projects || []).find((p) => p.project_id === projectId) ||
      PUBLIC_PROJECT_FALLBACK.find((p) => p.project_id === projectId);
    if (!project || !isBoardProject(project) || !canApply(state, project)) return false;

    const next = { ...state };
    if (!Array.isArray(next.projects)) next.projects = [...PUBLIC_PROJECT_FALLBACK];
    if (!next.projects.some((p) => p.project_id === projectId)) {
      next.projects = [...next.projects, project];
    }
    next.applications = [
      ...(next.applications || []),
      { project_id: projectId, partner_id: partnerId, status: "applied", ts: nowIso() },
    ];
    writeState(next);
    pushNotification({
      type: "application",
      body: `${project.title || projectId} に応募がありました。`,
      project_id: projectId,
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
      statusEl.hidden = !statusText;
      statusEl.textContent = statusText || "";
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
        return a.url
          ? `<li style="margin-bottom:0.5rem;"><a href="${esc(a.url)}" class="text-gold-dark hover:underline" target="_blank" rel="noopener">${name}</a></li>`
          : `<li style="margin-bottom:0.5rem;">${name}</li>`;
      })
      .join("");
  }

  function setText(sel, text) {
    const el = $(sel);
    if (el) el.textContent = text || "—";
  }

  function renderProject() {
    const rawId = getProjectId();
    const id = rawId || "demo-project-001";
    const state = readState();
    const root = getProjectRoot();
    log("render:start", { rawId, resolvedId: normalizeProjectId(id), rootFound: Boolean(root) });
    if (!root) {
      log("render:fail", { reason: "project-root-missing", id });
      return;
    }
    const found = findProject(state, id);
    if (!found) {
      renderProjectError("案件が見つかりません", rawId || id);
      return;
    }
    const errorHost = root.querySelector("[data-public-board-detail-error]");
    if (errorHost) {
      errorHost.hidden = true;
      errorHost.innerHTML = "";
    }
    const { project, spec } = found;
    log("render:resolved", {
      requestedId: found.requestedId,
      canonicalId: found.canonicalId,
      title: project.title,
    });
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
    syncPublicProjectChrome(project);
    markProjectDetailLoaded("true");
    schedulePublicProjectFocus();
    log("render:success", {
      id: project.project_id,
      title: project.title,
      canonicalId: found.canonicalId,
      fromTalk: isFromTalkEntry(),
    });
  }

  function applyJobLabels() {
    const map = [
      ["#jobContentTitle", "求人内容"],
      ["#jobSalaryTitle", "給与"],
      ["[data-listing-cta-heading]", "ご応募"],
      [".skill-cta-panel__label", "給与（目安）"],
      ["[data-job-section-nav][href='#section-description']", "求人内容"],
      ["[data-job-section-nav][href='#section-reward']", "給与"],
      [".page-subheader span", "TASFUL 求人"],
    ];
    map.forEach(([sel, text]) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el.childNodes.length === 1 && el.firstChild?.nodeType === Node.TEXT_NODE) {
          el.textContent = text;
        } else if (sel.includes("skill-cta-panel__label") && el.textContent?.includes("報酬")) {
          el.textContent = text;
        }
      });
    });
    const categoryBadge = document.querySelector("[data-listing-category-badge]");
    if (categoryBadge) categoryBadge.textContent = "求人";
    document.title = "求人詳細 | TASFUL";
  }

  function showRoot(type) {
    document.body.dataset.boardDetailType = type;
    const projectRoot = $('[data-board-detail-root="project"]');
    const jobRoot = $('[data-board-detail-root="job"]');
    const projectDock = projectRoot?.querySelector("[data-public-project-bottom-dock]");
    const jobDock = document.querySelector(
      '[data-board-detail-root="job"] ~ [data-job-bottom-dock], body > .job-bottom-dock[data-job-bottom-dock]'
    );
    if (type === "project") {
      projectRoot?.removeAttribute("hidden");
      projectDock?.removeAttribute("hidden");
      jobRoot?.setAttribute("hidden", "");
      jobDock?.setAttribute("hidden", "");
    } else {
      jobRoot?.removeAttribute("hidden");
      jobDock?.removeAttribute("hidden");
      projectRoot?.setAttribute("hidden", "");
      projectDock?.setAttribute("hidden", "");
    }
    if (type === "project" || type === "job") {
      document.body.dataset.detailType = "job";
      document.body.classList.add("job-detail-page");
    } else {
      delete document.body.dataset.detailType;
    }
    const headerLabel = $("[data-board-detail-header-label]");
    if (headerLabel) headerLabel.textContent = type === "project" ? "TASFUL 案件" : "TASFUL 求人";
    document.title = type === "project" ? "案件詳細 | TASFUL" : "求人詳細 | TASFUL";
  }

  function initBackLink() {
    document.querySelectorAll("[data-job-back-link], [data-board-detail-back]").forEach((a) => {
      if (!(a instanceof HTMLAnchorElement)) return;
      const ref = String(document.referrer || "");
      a.href = ref.includes("public-board.html") ? ref : "public-board.html";
    });
  }

  function wireProjectApply() {
    const handler = () => {
      const id = getProjectId() || "demo-project-001";
      if (applyToProject(id)) renderProject();
    };
    $("[data-public-project-apply]")?.addEventListener("click", handler);
    $("[data-public-project-dock-apply]")?.addEventListener("click", handler);
  }

  function initBackFromTalk() {
    if (getParams().get("from") !== "talk") return;
    document.querySelectorAll("[data-board-detail-back]").forEach((a) => {
      if (!(a instanceof HTMLAnchorElement)) return;
      a.href = "talk-home.html?tab=notify";
      a.textContent = "TALKに戻る";
    });
  }

  function init() {
    const params = Object.fromEntries(getParams().entries());
    const type = resolveDetailType();
    log("init:start", {
      params,
      type,
      readyState: document.readyState,
      resolvedId: getResolvedProjectId(),
      note: "builder.js data-board-pd-view は builder 専用（本ページでは未使用）",
    });
    window.__BOARD_DETAIL_TYPE__ = type;
    showRoot(type);
    initBackLink();
    initBackFromTalk();
    wirePublicProjectMobileFocus();
    if (type === "project") {
      wireProjectApply();
      renderProject();
      document.addEventListener("builder:mvp-changed", renderProject);
      return;
    }
    applyJobLabels();
    window.addEventListener("tasu:listing-loaded", applyJobLabels);
  }

  function scheduleInit() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
    window.addEventListener("load", () => {
      if (resolveDetailType() !== "project") return;
      if (document.body.dataset.boardDetailLoaded !== "true") {
        log("init:retry-on-load", { listingLoaded: document.body.dataset.listingLoaded });
        renderProject();
        return;
      }
      schedulePublicProjectFocus();
    }, { once: true });
  }

  scheduleInit();
})();
