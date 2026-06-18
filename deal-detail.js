/**
 * 案件詳細（進行中取引デモ）
 */
(function () {
  "use strict";

  const BUILDER_FOCUS_CARD_BY_HASH = Object.freeze({
    project: "project",
    schedule: "project",
    "site-info": "project",
    completion: "completion",
    invoice: "invoice",
    attendance: "attendance",
  });

  const BUILDER_PHASES = Object.freeze(["assigned", "accepted", "started", "completed", "invoiced"]);

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pickDealId() {
    try {
      const params = new URLSearchParams(window.location.search);
      return String(params.get("id") || "").trim();
    } catch {
      return "";
    }
  }

  function pickHash() {
    return String(window.location.hash || "").replace(/^#/, "").trim();
  }

  function resolveViewerRole(deal) {
    try {
      const role = String(new URLSearchParams(window.location.search).get("role") || "").trim();
      if (role === "client" || role === "worker") return role;
    } catch {
      /* ignore */
    }
    return deal?.viewerRole === "worker" ? "worker" : "client";
  }

  function isClientView(deal) {
    return resolveViewerRole(deal) === "client";
  }

  function isBuilderDeal(deal) {
    return Boolean(deal?.isBuilderDeal);
  }

  function resolveBuilderFocusCard(hash) {
    const key = String(hash || "").trim();
    if (!key) return null;
    return BUILDER_FOCUS_CARD_BY_HASH[key] || null;
  }

  function pickPhaseParam() {
    try {
      const phase = String(new URLSearchParams(window.location.search).get("phase") || "").trim();
      if (BUILDER_PHASES.includes(phase)) return phase;
    } catch {
      /* ignore */
    }
    return null;
  }

  function resolveBuilderPhase(deal, viewerRole, focusCard) {
    const fromUrl = pickPhaseParam();
    if (fromUrl) return fromUrl;
    if (focusCard === "project") return "assigned";
    if (!pickHash() && viewerRole === "worker") return "assigned";
    return deal?.builderPhase || "invoiced";
  }

  function builderPhaseAtLeast(phase, minPhase) {
    const current = BUILDER_PHASES.indexOf(phase);
    const min = BUILDER_PHASES.indexOf(minPhase);
    if (current < 0 || min < 0) return false;
    return current >= min;
  }

  function shouldShowBuilderCard(cardId, deal, { phase, focusCard, viewerRole }) {
    if (cardId === "project") return false;

    if (focusCard) {
      if (focusCard !== cardId) return false;
      if (cardId === "completion") return Boolean(deal.hasCompletionReport) && viewerRole === "client";
      if (cardId === "invoice") return Boolean(deal.builderInvoice);
      if (cardId === "attendance") return Boolean(deal.builderAttendance?.entries?.length);
      return false;
    }

    switch (cardId) {
      case "completion":
        return (
          builderPhaseAtLeast(phase, "completed") &&
          deal.hasCompletionReport &&
          viewerRole === "client"
        );
      case "invoice":
        return builderPhaseAtLeast(phase, "invoiced") && Boolean(deal.builderInvoice);
      case "attendance":
        return (
          builderPhaseAtLeast(phase, "started") && Boolean(deal.builderAttendance?.entries?.length)
        );
      case "auxiliary":
        return (
          builderPhaseAtLeast(phase, "completed") &&
          deal.hasCompletionReport &&
          viewerRole === "client"
        );
      default:
        return false;
    }
  }

  function isBuilderWorkerPending(deal, phase, viewerRole) {
    return viewerRole === "worker" && phase === "assigned";
  }

  function resolveBuilderCalendarHref(dealId) {
    const key = String(dealId || "").trim() || "builder_demo_001";
    return `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(key)}`;
  }

  function shouldRedirectBuilderDealToCalendar(deal) {
    if (!isBuilderDeal(deal)) return false;
    if (resolveViewerRole(deal) === "client") return false;
    const hash = pickHash();
    if (hash === "project" || hash === "schedule" || hash === "site-info") return true;
    if (!hash && resolveViewerRole(deal) === "worker") return true;
    return false;
  }

  function maybeRedirectBuilderDeal(deal) {
    if (!shouldRedirectBuilderDealToCalendar(deal)) return false;
    window.location.replace(resolveBuilderCalendarHref(deal.id || pickDealId()));
    return true;
  }

  function resolveChatHref(deal) {
    return String(deal?.threadHref || deal?.chatHref || "talk-home.html?tab=chat");
  }

  function clampProgress(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function renderNotFound(root, id) {
    root.innerHTML =
      `<div class="deal-detail-empty">` +
      `<h1 class="deal-detail-empty__title">案件が見つかりません</h1>` +
      `<p class="deal-detail-empty__text">指定された案件（${esc(id || "—")}）はデモデータに存在しません。</p>` +
      `<a class="demo-deal-btn demo-deal-btn--ghost" href="demo-progress.html">進行中の取引一覧へ</a>` +
      `</div>`;
    document.title = "案件が見つかりません | TASFUL";
  }

  function getCompletionMeta(deal) {
    const report = deal.completionReport || {};
    return {
      reporterName: report.reporterName || deal.clientName || "—",
      submittedContent: report.submittedContent || "作業完了報告（デモ）",
      attachments: report.attachments || "—",
      receivedAt: report.receivedAt || deal.updatedLabel || "—",
    };
  }

  function getBuilderReward(deal) {
    return deal.builderReward || deal.builderInvoice?.amount || "—";
  }

  function buildProgressSection(deal, { hidden = false } = {}) {
    if (hidden) return "";
    const percent = clampProgress(deal.progressPercent);
    return (
      `<section class="deal-detail-panel deal-detail-panel--progress" aria-label="進捗">` +
      `<h2 class="deal-detail-panel__label">進捗</h2>` +
      `<div class="demo-progress-deal-card__progress deal-detail-panel__progress">` +
      `<div class="demo-progress-deal-card__progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="進捗 ${percent}パーセント">` +
      `<span class="demo-progress-deal-card__progress-fill" style="width:${percent}%"></span>` +
      `</div>` +
      `<span class="demo-progress-deal-card__progress-value">${percent}%</span>` +
      `</div>` +
      `</section>`
    );
  }

  function buildEstimateSection(deal) {
    if (deal.isBuilderDeal || !deal.hasEstimate) return "";
    const est = deal.estimate || {};
    return (
      `<section class="deal-detail-panel deal-detail-panel--estimate" id="estimate" aria-label="見積">` +
      `<h2 class="deal-detail-panel__label">見積</h2>` +
      `<dl class="deal-detail-completion__rows">` +
      `<div class="deal-detail-completion__row"><dt>案件名</dt><dd>${esc(deal.title)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>見積金額</dt><dd>${esc(est.amount || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>内容</dt><dd>${esc(est.summary || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>提出日時</dt><dd>${esc(est.submittedAt || "—")}</dd></div>` +
      `</dl>` +
      `</section>`
    );
  }

  function buildScheduleSection(deal) {
    if (!deal.builderSchedule) return "";
    const sch = deal.builderSchedule;
    return (
      `<section class="deal-detail-panel deal-detail-panel--schedule" id="schedule" aria-label="工程">` +
      `<h2 class="deal-detail-panel__label">工程</h2>` +
      `<dl class="deal-detail-completion__rows">` +
      `<div class="deal-detail-completion__row"><dt>案件名</dt><dd>${esc(deal.title)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>工程</dt><dd>${esc(sch.summary || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>更新日時</dt><dd>${esc(sch.updatedAt || "—")}</dd></div>` +
      `</dl>` +
      `</section>`
    );
  }

  function buildInvoiceSection(deal) {
    if (!deal.builderInvoice) return "";
    const inv = deal.builderInvoice;
    return (
      `<section class="deal-detail-panel deal-detail-panel--invoice" id="invoice" aria-label="請求書">` +
      `<h2 class="deal-detail-panel__label">請求書</h2>` +
      `<dl class="deal-detail-completion__rows">` +
      `<div class="deal-detail-completion__row"><dt>案件名</dt><dd>${esc(deal.title)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>請求金額</dt><dd>${esc(inv.amount || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>支払期限</dt><dd>${esc(inv.dueDate || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>状態</dt><dd>${esc(inv.status || "—")}</dd></div>` +
      `</dl>` +
      `</section>`
    );
  }

  function buildSiteInfoSection(deal) {
    if (!deal.builderSiteInfo) return "";
    const site = deal.builderSiteInfo;
    return (
      `<section class="deal-detail-panel deal-detail-panel--site" id="site-info" aria-label="現場情報">` +
      `<h2 class="deal-detail-panel__label">現場情報</h2>` +
      `<dl class="deal-detail-completion__rows">` +
      `<div class="deal-detail-completion__row"><dt>住所</dt><dd>${esc(site.address || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>入場</dt><dd>${esc(site.access || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>注意事項</dt><dd>${esc(site.notes || "—")}</dd></div>` +
      `</dl>` +
      `</section>`
    );
  }

  function buildAttendanceSection(deal) {
    const entries = deal.builderAttendance?.entries;
    if (!Array.isArray(entries) || !entries.length) return "";
    const rows = entries
      .map(
        (e) =>
          `<div class="deal-detail-completion__row"><dt>${esc(e.action)}</dt><dd>${esc(e.worker)} · ${esc(e.time)}</dd></div>`
      )
      .join("");
    return (
      `<section class="deal-detail-panel deal-detail-panel--attendance" id="attendance" aria-label="入退場">` +
      `<h2 class="deal-detail-panel__label">入退場</h2>` +
      `<dl class="deal-detail-completion__rows">${rows}</dl>` +
      `</section>`
    );
  }

  function buildClientCompletionSection(deal, chatHref) {
    if (!deal.hasCompletionReport) return "";
    const meta = getCompletionMeta(deal);

    return (
      `<section class="deal-detail-panel deal-detail-panel--completion" id="completion" aria-label="完了報告を確認">` +
      `<h2 class="deal-detail-panel__label deal-detail-panel__label--completion">完了報告を確認</h2>` +
      `<p class="deal-detail-completion__lead">協力会社から完了報告が届いています。内容を確認してください。</p>` +
      `<dl class="deal-detail-completion__rows">` +
      `<div class="deal-detail-completion__row"><dt>案件名</dt><dd>${esc(deal.title)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>報告者</dt><dd>${esc(meta.reporterName)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>提出内容</dt><dd>${esc(meta.submittedContent)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>添付ファイル</dt><dd>${esc(meta.attachments)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>受信日時</dt><dd>${esc(meta.receivedAt)}</dd></div>` +
      `</dl>` +
      `<div class="deal-detail-actions deal-detail-actions--completion deal-detail-actions--client">` +
      `<button type="button" class="demo-deal-btn demo-deal-btn--gold" data-deal-approve>承認する</button>` +
      `<button type="button" class="demo-deal-btn demo-deal-btn--outline" data-deal-reject>差し戻す</button>` +
      `</div>` +
      `</section>`
    );
  }

  function buildBottomActions(deal, chatHref) {
    const client = isClientView(deal);

    if (client) {
      return (
        `<section class="deal-detail-panel deal-detail-panel--actions" aria-label="アクション">` +
        `<p class="deal-detail-note">完了報告の確認・承認はやりとりチャットで行ってください。</p>` +
        `</section>`
      );
    }

    return (
      `<section class="deal-detail-panel deal-detail-panel--actions" aria-label="アクション">` +
      `<div class="deal-detail-actions deal-detail-actions--worker">` +
      `<a class="demo-deal-btn demo-deal-btn--chat" href="${chatHref}">チャット</a>` +
      `<button type="button" class="demo-deal-btn demo-deal-btn--gold" data-deal-complete-report>完了報告</button>` +
      `<button type="button" class="demo-deal-btn demo-deal-btn--ghost" data-deal-add-deliverable>納品物を追加</button>` +
      `</div>` +
      `<p class="deal-detail-note">デモ表示です。作業者側の操作画面です。</p>` +
      `</section>`
    );
  }

  function buildBuilderHead(deal, { compact = false } = {}) {
    const statusKey = esc(deal.statusKey || "working");
    const client = isClientView(deal);
    const partnerLabel = client
      ? `協力会社：${esc(getCompletionMeta(deal).reporterName)}`
      : `依頼者：${esc(deal.clientName)}`;

    if (compact) {
      return (
        `<header class="deal-detail-head deal-detail-head--compact">` +
        `<p class="deal-detail-focus-banner">通知から開いた項目です。この内容をご確認ください。</p>` +
        `<div class="deal-detail-head__row">` +
        `<span class="demo-progress-deal-card__status demo-progress-deal-card__status--${statusKey}">${esc(deal.status)}</span>` +
        `<span class="deal-detail-head__updated">最終更新 ${esc(deal.updatedLabel)}</span>` +
        `</div>` +
        `<h1 class="deal-detail-head__title" data-deal-detail-title>${esc(deal.title)}</h1>` +
        `<p class="deal-detail-head__client">${partnerLabel}</p>` +
        `</header>`
      );
    }

    return (
      `<header class="deal-detail-head">` +
      `<div class="deal-detail-head__row">` +
      `<span class="demo-progress-deal-card__status demo-progress-deal-card__status--${statusKey}">${esc(deal.status)}</span>` +
      `<span class="deal-detail-head__updated">最終更新 ${esc(deal.updatedLabel)}</span>` +
      `</div>` +
      `<h1 class="deal-detail-head__title" data-deal-detail-title>${esc(deal.title)}</h1>` +
      `<p class="deal-detail-head__client">${partnerLabel}</p>` +
      `</header>`
    );
  }

  function buildBuilderProjectCard(deal, chatHref, { phase, viewerRole }) {
    const workerPending = isBuilderWorkerPending(deal, phase, viewerRole);
    const site = deal.builderSiteInfo || {};
    const schedule = deal.builderSchedule || {};
    const summary = deal.builderSummary || "内装リニューアル一式（設計・施工・仕上げ）";

    const workerActions = workerPending
      ? `<div class="deal-detail-actions deal-detail-actions--project">` +
        `<button type="button" class="demo-deal-btn demo-deal-btn--gold" data-deal-accept>受ける</button>` +
        `<button type="button" class="demo-deal-btn demo-deal-btn--outline" data-deal-decline>受けない</button>` +
        `<a class="demo-deal-btn demo-deal-btn--chat" href="${chatHref}">チャットで質問</a>` +
        `</div>`
      : "";

    return (
      `<section class="deal-builder-card deal-builder-card--project" id="project" aria-label="案件確認">` +
      `<h2 class="deal-builder-card__title">案件確認</h2>` +
      `<p class="deal-builder-card__lead">案件内容を確認し、対応可否を判断してください。</p>` +
      `<dl class="deal-detail-completion__rows">` +
      `<div class="deal-detail-completion__row"><dt>案件概要</dt><dd>${esc(summary)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>報酬</dt><dd>${esc(getBuilderReward(deal))}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>工期</dt><dd>${esc(schedule.summary || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>現場住所</dt><dd>${esc(site.address || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>入場条件</dt><dd>${esc(site.access || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>注意事項</dt><dd>${esc(site.notes || "—")}</dd></div>` +
      `</dl>` +
      workerActions +
      `</section>`
    );
  }

  function buildBuilderCompletionCard(deal, chatHref) {
    if (!deal.hasCompletionReport) return "";
    const meta = getCompletionMeta(deal);

    return (
      `<section class="deal-builder-card deal-builder-card--completion" id="completion" aria-label="完了報告">` +
      `<h2 class="deal-builder-card__title">完了報告</h2>` +
      `<p class="deal-builder-card__lead">協力会社から完了報告が届いています。内容を確認してください。</p>` +
      `<dl class="deal-detail-completion__rows">` +
      `<div class="deal-detail-completion__row"><dt>報告者</dt><dd>${esc(meta.reporterName)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>完了報告内容</dt><dd>${esc(meta.submittedContent)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>添付ファイル</dt><dd>${esc(meta.attachments)}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>受信日時</dt><dd>${esc(meta.receivedAt)}</dd></div>` +
      `</dl>` +
      `<div class="deal-detail-actions deal-detail-actions--completion">` +
      `<button type="button" class="demo-deal-btn demo-deal-btn--gold" data-deal-approve>承認する</button>` +
      `<button type="button" class="demo-deal-btn demo-deal-btn--outline" data-deal-reject>差し戻す</button>` +
      `<a class="demo-deal-btn demo-deal-btn--chat" href="${chatHref}">チャットで確認</a>` +
      `</div>` +
      `</section>`
    );
  }

  function buildBuilderInvoiceCard(deal) {
    if (!deal.builderInvoice) return "";
    const inv = deal.builderInvoice;
    return (
      `<section class="deal-builder-card deal-builder-card--invoice" id="invoice" aria-label="請求書">` +
      `<h2 class="deal-builder-card__title">請求書</h2>` +
      `<p class="deal-builder-card__lead">請求内容をご確認ください。</p>` +
      `<dl class="deal-detail-completion__rows">` +
      `<div class="deal-detail-completion__row"><dt>請求金額</dt><dd>${esc(inv.amount || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>支払期限</dt><dd>${esc(inv.dueDate || "—")}</dd></div>` +
      `<div class="deal-detail-completion__row"><dt>状態</dt><dd>${esc(inv.status || "—")}</dd></div>` +
      `</dl>` +
      `</section>`
    );
  }

  function buildBuilderAttendanceCard(deal) {
    const entries = deal.builderAttendance?.entries;
    if (!Array.isArray(entries) || !entries.length) return "";
    const rows = entries
      .map(
        (e) =>
          `<div class="deal-detail-completion__row"><dt>${esc(e.action)}</dt><dd>${esc(e.worker)} · ${esc(e.time)}</dd></div>`
      )
      .join("");
    return (
      `<section class="deal-builder-card deal-builder-card--attendance" id="attendance" aria-label="入退場">` +
      `<h2 class="deal-builder-card__title">入退場</h2>` +
      `<p class="deal-builder-card__lead">現場の入退場・作業記録です。</p>` +
      `<dl class="deal-detail-completion__rows">${rows}</dl>` +
      `</section>`
    );
  }

  function buildBuilderAuxiliaryCard(deal, chatHref) {
    if (!isClientView(deal) || !deal.hasCompletionReport) return "";
    return (
      `<section class="deal-builder-card deal-builder-card--auxiliary" id="auxiliary" aria-label="関連アクション">` +
      `<h2 class="deal-builder-card__title deal-builder-card__title--sub">関連アクション</h2>` +
      `<div class="deal-detail-actions deal-detail-actions--auxiliary">` +
      `<a class="demo-deal-btn demo-deal-btn--gold" href="#completion">完了報告を確認</a>` +
      `<a class="demo-deal-btn demo-deal-btn--chat" href="${chatHref}">チャットで確認</a>` +
      `</div>` +
      `</section>`
    );
  }

  function renderBuilderDeal(root, deal) {
    const hash = pickHash();
    const focusCard = resolveBuilderFocusCard(hash);
    const chatHref = esc(resolveChatHref(deal));
    const viewerRole = resolveViewerRole(deal);
    const phase = resolveBuilderPhase(deal, viewerRole, focusCard);
    const notifyFocus = Boolean(focusCard) || (phase === "assigned" && viewerRole === "worker" && !pickHash());

    document.title = `${deal.title} | 案件詳細 | TASFUL`;
    document.body.dataset.dealViewRole = viewerRole;
    document.body.dataset.dealBuilderPhase = phase;
    document.body.classList.toggle("deal-detail-page--notify-focus", notifyFocus);
    document.body.classList.toggle("deal-detail-page--completion-focus", false);
    if (focusCard) {
      document.body.dataset.dealFocusCard = focusCard;
    } else {
      document.body.removeAttribute("data-deal-focus-card");
    }

    const cardContext = { phase, focusCard, viewerRole };
    const cards = [];

    if (shouldShowBuilderCard("project", deal, cardContext)) {
      cards.push(buildBuilderProjectCard(deal, chatHref, { phase, viewerRole }));
    }
    if (shouldShowBuilderCard("completion", deal, cardContext)) {
      cards.push(buildBuilderCompletionCard(deal, chatHref));
    }
    if (shouldShowBuilderCard("invoice", deal, cardContext)) {
      cards.push(buildBuilderInvoiceCard(deal));
    }
    if (shouldShowBuilderCard("attendance", deal, cardContext)) {
      cards.push(buildBuilderAttendanceCard(deal));
    }
    if (shouldShowBuilderCard("auxiliary", deal, cardContext)) {
      cards.push(buildBuilderAuxiliaryCard(deal, chatHref));
    }

    root.innerHTML = buildBuilderHead(deal, { compact: notifyFocus }) + cards.join("");
    bindDealActions(root);
    scrollToFocusedCard(focusCard || (notifyFocus ? "project" : null));
  }

  function renderStandardDeal(root, deal) {
    const statusKey = esc(deal.statusKey || "working");
    const chatHref = esc(deal.chatHref || "talk-home.html?tab=chat");
    const client = isClientView(deal);
    const viewerRole = resolveViewerRole(deal);

    document.title = `${deal.title} | 取引詳細 | TASFUL`;
    document.body.dataset.dealViewRole = viewerRole;
    document.body.classList.remove("deal-detail-page--notify-focus", "deal-detail-page--completion-focus");
    document.body.removeAttribute("data-deal-focus-card");

    root.innerHTML =
      `<header class="deal-detail-head">` +
      `<div class="deal-detail-head__row">` +
      `<span class="demo-progress-deal-card__status demo-progress-deal-card__status--${statusKey}">${esc(deal.status)}</span>` +
      `<span class="deal-detail-head__updated">最終更新 ${esc(deal.updatedLabel)}</span>` +
      `</div>` +
      `<h1 class="deal-detail-head__title" data-deal-detail-title>${esc(deal.title)}</h1>` +
      `<p class="deal-detail-head__client">${client ? `協力会社：${esc(getCompletionMeta(deal).reporterName)}` : `依頼者：${esc(deal.clientName)}`}</p>` +
      `</header>` +
      buildProgressSection(deal) +
      buildEstimateSection(deal) +
      buildScheduleSection(deal) +
      buildInvoiceSection(deal) +
      buildSiteInfoSection(deal) +
      buildAttendanceSection(deal) +
      (client ? "" : "") +
      buildBottomActions(deal, chatHref);

    bindDealActions(root);
    scrollToFocusedCard(resolveBuilderFocusCard(pickHash()) || (pickHash() === "completion" ? "completion" : null));
  }

  function scrollToFocusedCard(cardId) {
    if (!cardId) return;
    const target = document.getElementById(cardId);
    if (!target) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const absoluteTop = window.scrollY + rect.top;
        const nextTop = Math.max(0, absoluteTop - window.innerHeight * 0.18);
        window.scrollTo({ top: nextTop, behavior: "smooth" });
        target.classList.add("deal-builder-card--highlight");
        window.setTimeout(() => target.classList.remove("deal-builder-card--highlight"), 2200);
      });
    });
  }

  function bindDealActions(root) {
    root.querySelector("[data-deal-complete-report]")?.addEventListener("click", () => {
      window.alert("デモ：完了報告を送信しました（実際の処理は行いません）");
    });
    root.querySelector("[data-deal-add-deliverable]")?.addEventListener("click", () => {
      window.alert("デモ：納品物の追加画面は準備中です");
    });
    root.querySelector("[data-deal-approve]")?.addEventListener("click", () => {
      window.alert("デモ：完了報告を承認しました（実際の処理は行いません）");
    });
    root.querySelector("[data-deal-reject]")?.addEventListener("click", () => {
      window.alert("デモ：完了報告を差し戻しました（実際の処理は行いません）");
    });
    root.querySelector("[data-deal-accept]")?.addEventListener("click", () => {
      window.alert("デモ：案件を受諾しました（実際の処理は行いません）");
    });
    root.querySelector("[data-deal-decline]")?.addEventListener("click", () => {
      window.alert("デモ：案件を辞退しました（実際の処理は行いません）");
    });
  }

  function renderDeal(root, deal) {
    if (isBuilderDeal(deal)) {
      renderBuilderDeal(root, deal);
      return;
    }
    renderStandardDeal(root, deal);
  }

  function init() {
    const root = $("[data-deal-detail-root]");
    if (!root) return;

    const headTitle = document.querySelector(".tasu-mobile-page-head__title");
    if (headTitle) headTitle.textContent = "取引詳細";

    const id = pickDealId();
    const deal = window.TasuDemoDealsData?.getProgressDealById?.(id);
    if (!deal) {
      renderNotFound(root, id);
      return;
    }
    if (pickHash() === "estimate" && deal.isBuilderDeal) {
      window.location.replace(
        deal.threadHref || "builder/mvp-thread.html?id=builder_thread_demo_001"
      );
      return;
    }
    if (maybeRedirectBuilderDeal(deal)) return;
    renderDeal(root, deal);
    window.addEventListener("hashchange", () => {
      if (maybeRedirectBuilderDeal(deal)) return;
      renderDeal(root, deal);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
