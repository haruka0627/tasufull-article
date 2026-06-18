/**
 * TASFUL TALK — AI業者検索（原型）
 * サブスク会員業者の条件検索 → 相談 → 既存 vendor_user 一般案件フローへ接続
 */
(function (global) {
  "use strict";

  const ADMIN_PARTNERS_KEY = "tasful:builder:admin:partners:v1";
  const MVP_STORAGE_KEY = "tasful:builder:mvp:v1";
  const MVP_THREADS_STORAGE_KEY = "tasful:builder:mvp:threads:v1";
  const MVP_NOTIFICATIONS_KEY = "tasful:builder:mvp:notifications:v1";

  const POSTER = Object.freeze({
    role: "user",
    id: "demo-builder-user",
    name: "田中 花子",
  });

  const FALLBACK_VENDORS = Object.freeze([
    {
      vendorId: "vendor-partner-demo-001",
      partnerId: "partner-demo-001",
      companyName: "関東外装パートナーズ",
      trades: ["外壁補修", "屋根工事", "塗装"],
      areas: ["埼玉県", "東京都", "千葉県"],
      rating: 4.8,
      subscriptionMember: true,
      reviewStatus: "approved",
    },
    {
      vendorId: "vendor-partner-demo-003",
      partnerId: "partner-demo-003",
      companyName: "足場ワークス東京",
      trades: ["足場", "仮設"],
      areas: ["東京都", "埼玉県"],
      rating: 4.6,
      subscriptionMember: true,
      reviewStatus: "approved",
    },
    {
      vendorId: "demo-vendor-001",
      partnerId: "demo-vendor-001",
      companyName: "港区設備サービス",
      trades: ["設備", "電気", "空調"],
      areas: ["東京都", "港区"],
      rating: 4.7,
      subscriptionMember: true,
      reviewStatus: "approved",
    },
    {
      vendorId: "vendor-partner-a",
      partnerId: "partner-a",
      companyName: "デモ協力会社A",
      trades: ["内装"],
      areas: ["東京都"],
      rating: 4.7,
      subscriptionMember: true,
      reviewStatus: "approved",
    },
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeVendorFromPartner(partner) {
    const id = pickStr(partner?.id);
    if (!id) return null;
    const approved = pickStr(partner?.reviewStatus).toLowerCase() === "approved";
    const subscription =
      partner?.subscriptionMember !== false && partner?.subscription_member !== false;
    if (!approved || !subscription) return null;
    return {
      vendorId: id.startsWith("vendor-") ? id : `vendor-${id}`,
      partnerId: id,
      companyName: pickStr(partner?.companyName, partner?.name) || "業者",
      trades: Array.isArray(partner?.trades) ? partner.trades : [],
      areas: Array.isArray(partner?.areas) ? partner.areas : [],
      rating: Number(partner?.rating) || 0,
      subscriptionMember: true,
      reviewStatus: "approved",
      note: pickStr(partner?.note),
    };
  }

  function loadAdminPartners() {
    try {
      const raw = global.localStorage?.getItem(ADMIN_PARTNERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function listSubscribedVendors() {
    const fromAdmin = loadAdminPartners()
      .map(normalizeVendorFromPartner)
      .filter(Boolean);
    if (fromAdmin.length) return fromAdmin;
    return [...FALLBACK_VENDORS];
  }

  /**
   * @param {{ trade?: string, area?: string, date?: string, keyword?: string }} criteria
   */
  function searchVendors(criteria = {}) {
    const trade = pickStr(criteria.trade).toLowerCase();
    const area = pickStr(criteria.area).toLowerCase();
    const keyword = pickStr(criteria.keyword).toLowerCase();
    const vendors = listSubscribedVendors();

    return vendors.filter((v) => {
      if (trade) {
        const hit = (v.trades || []).some((t) => String(t).toLowerCase().includes(trade));
        if (!hit) return false;
      }
      if (area) {
        const hit = (v.areas || []).some((a) => String(a).toLowerCase().includes(area));
        if (!hit) return false;
      }
      if (keyword) {
        const hay = [
          v.companyName,
          v.note || "",
          ...(v.trades || []),
          ...(v.areas || []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      return true;
    });
  }

  function mvpThreadHref(threadId, role, threadType) {
    const sp = new URLSearchParams();
    sp.set("thread_id", threadId);
    sp.set("id", threadId);
    sp.set("role", role || "user");
    if (threadType) sp.set("threadType", threadType);
    return `builder/mvp-thread.html?${sp.toString()}`;
  }

  function loadMvpState() {
    try {
      const raw = global.localStorage?.getItem(MVP_STORAGE_KEY);
      if (!raw) return { version: 1, partners: [], projects: [], specs: {}, threads: {}, applications: [] };
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : { version: 1, partners: [], projects: [], specs: {}, threads: {}, applications: [] };
    } catch {
      return { version: 1, partners: [], projects: [], specs: {}, threads: {}, applications: [] };
    }
  }

  function saveMvpState(state) {
    try {
      global.localStorage?.setItem(MVP_STORAGE_KEY, JSON.stringify(state));
      const threads = state?.threads && typeof state.threads === "object" ? state.threads : {};
      global.localStorage?.setItem(MVP_THREADS_STORAGE_KEY, JSON.stringify(threads));
      global.document?.dispatchEvent?.(new CustomEvent("builder:mvp-changed", { detail: { state } }));
    } catch {
      /* ignore */
    }
  }

  function appendMvpNotification(row) {
    try {
      const raw = global.localStorage?.getItem(MVP_NOTIFICATIONS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(list) ? list : [];
      next.unshift(row);
      global.localStorage?.setItem(MVP_NOTIFICATIONS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function pushTalkBuilderNotify(payload) {
    try {
      const viaGuide = global.TasuTalkPlatformNotify?.notifyBuilderGuide?.(payload);
      if (viaGuide) return viaGuide;
      const store = global.TasuTalkNotifications;
      if (store?.add) {
        return store.add({
          ...payload,
          type: "builder",
          category: "Builder",
          source: "builder-mvp",
          targetUrl: payload.href,
        });
      }
      return null;
    } catch {
      return null;
    }
  }

  function formatCriteriaSummary(criteria = {}) {
    const parts = [];
    if (pickStr(criteria.trade)) parts.push(`業種: ${criteria.trade}`);
    if (pickStr(criteria.area)) parts.push(`エリア: ${criteria.area}`);
    if (pickStr(criteria.date)) parts.push(`希望日: ${criteria.date}`);
    if (pickStr(criteria.keyword)) parts.push(`キーワード: ${criteria.keyword}`);
    return parts.join(" / ") || "条件未指定";
  }

  function ensureVendorPartner(state, vendor) {
    const partners = Array.isArray(state.partners) ? [...state.partners] : [];
    const vid = vendor.vendorId;
    if (!partners.some((p) => p.partner_id === vid)) {
      partners.push({
        partner_id: vid,
        display_name: vendor.companyName,
        type: "vendor",
      });
    }
    return { ...state, partners };
  }

  function resolveVendorFlowSpec(project, vendor) {
    const fromModule = global.TasuBuilderGeneralFlow?.getBenchGeneralFlowSpec?.("vendor_user", project);
    if (fromModule) return fromModule;
    return {
      threadType: "vendor_user",
      title: project.title,
      poster: POSTER,
      applicant: { role: "vendor", id: vendor.vendorId, name: vendor.companyName },
    };
  }

  function pushGeneralFlowApplyNotifications(project, spec) {
    const pid = project.project_id;
    const applicant = spec.applicant;
    const poster = spec.poster;
    const ts = nowIso();
    const notifBase = {
      project_id: pid,
      projectId: pid,
      projectTitle: project.title || "",
      thread_id: null,
      threadId: null,
      projectKind: "project",
      board_type: "project",
      bench_flow_id: "vendor_user",
      bench_thread_type: spec.threadType || "vendor_user",
    };
    appendMvpNotification({
      id: uid("notif"),
      type: "application",
      title: "応募がありました",
      body: `${applicant.name} から応募がありました（${project.title}）`,
      recipientRole: poster.role,
      recipientUserId: poster.id,
      recipientSlot: "poster",
      href: `builder/mvp-project-detail.html?id=${encodeURIComponent(pid)}&view=applications&from=notify&role=${encodeURIComponent(poster.role)}`,
      actionLabel: "やりとりを開始する",
      secondaryActionLabel: "見送る",
      createdAt: ts,
      read: false,
      ...notifBase,
    });
    appendMvpNotification({
      id: uid("notif"),
      type: "application_submitted",
      title: "応募しました",
      body: `${project.title} — 掲載者の確認をお待ちください。`,
      recipientRole: applicant.role,
      recipientUserId: applicant.id,
      recipientSlot: "applicant",
      href: `builder/mvp-project-detail.html?id=${encodeURIComponent(pid)}&role=${encodeURIComponent(applicant.role)}&partnerId=${encodeURIComponent(applicant.id)}`,
      actionLabel: "案件を見る",
      createdAt: ts,
      read: false,
      ...notifBase,
    });
    pushTalkBuilderNotify({
      type: "application",
      title: "応募がありました",
      body: `${applicant.name} から応募がありました（${project.title}）`,
      recipientRole: poster.role,
      recipientUserId: poster.id,
      recipientSlot: "poster",
      actionLabel: "やりとりを開始する",
      href: `builder/mvp-project-detail.html?id=${encodeURIComponent(pid)}&view=applications&from=notify&role=${encodeURIComponent(poster.role)}`,
      ...notifBase,
    });
    pushTalkBuilderNotify({
      type: "application_submitted",
      title: "応募しました",
      body: `${project.title} — 掲載者の確認をお待ちください。`,
      recipientRole: applicant.role,
      recipientUserId: applicant.id,
      recipientSlot: "applicant",
      actionLabel: "案件を見る",
      href: `builder/mvp-project-detail.html?id=${encodeURIComponent(pid)}&role=${encodeURIComponent(applicant.role)}&partnerId=${encodeURIComponent(applicant.id)}`,
      ...notifBase,
    });
  }

  function findVendor(vendorId) {
    const id = pickStr(vendorId);
    return listSubscribedVendors().find((v) => v.vendorId === id || v.partnerId === id) || null;
  }

  /**
   * @param {string} vendorId
   * @param {{ trade?: string, area?: string, date?: string, keyword?: string }} [criteria]
   */
  function startVendorConsult(vendorId, criteria = {}) {
    const vendor = findVendor(vendorId);
    if (!vendor) return { ok: false, error: "vendor_not_found" };

    let next = loadMvpState();
    next = ensureVendorPartner(next, vendor);

    const project_id = uid("proj-ai-vendor");
    const ts = nowIso();
    const criteriaText = formatCriteriaSummary(criteria);
    const title = `AI業者検索 — ${vendor.companyName}`;

    const project = {
      project_id,
      owner_id: POSTER.id,
      title,
      kind: "builder_board",
      board_type: "project",
      projectKind: "project",
      type: "project",
      status: "open",
      required_partners: 1,
      selected_partner_ids: [],
      main_thread_id: null,
      bench_flow_id: "vendor_user",
      bench_thread_type: "vendor_user",
      talk_ai_vendor_id: vendor.vendorId,
      talk_ai_vendor_name: vendor.companyName,
      talk_ai_search_criteria: { ...criteria },
      source: "talk_ai_vendor_search",
      created_at: ts,
    };

    next.projects = [...(next.projects || []), project];
    next.specs = {
      ...(next.specs || {}),
      [project_id]: {
        overview: title,
        description: `TASFUL TALK AI業者検索からの相談（原型）\n${criteriaText}`,
      },
    };

    const spec = resolveVendorFlowSpec(project, vendor);
    next.applications = [
      ...(next.applications || []),
      {
        project_id,
        partner_id: spec.applicant.id,
        applicant_role: spec.applicant.role,
        status: "applied",
        ts,
        memo: criteriaText,
        message: `${project.title || "案件"} に応募しました。条件・日程のご確認をお願いします。`,
      },
    ];
    saveMvpState(next);
    pushGeneralFlowApplyNotifications(project, spec);

    const posterHref = `builder/mvp-project-detail.html?id=${encodeURIComponent(project_id)}&view=applications&role=${encodeURIComponent(spec.poster.role)}`;
    const applicantHref = `builder/mvp-project-detail.html?id=${encodeURIComponent(project_id)}&role=${encodeURIComponent(spec.applicant.role)}&partnerId=${encodeURIComponent(spec.applicant.id)}`;

    return {
      ok: true,
      project_id,
      threadId: null,
      threadType: spec.threadType || "vendor_user",
      href: posterHref,
      applicantHref,
      vendor,
      criteriaText,
    };
  }

  function renderVendorCard(vendor) {
    const trades = (vendor.trades || []).slice(0, 4).join("・") || "—";
    const areas = (vendor.areas || []).slice(0, 3).join("・") || "—";
    const rating = vendor.rating ? `${vendor.rating.toFixed(1)}` : "—";
    return `
      <article class="talk-ai-vendor-card" data-vendor-id="${escapeHtml(vendor.vendorId)}">
        <div class="talk-ai-vendor-card__head">
          <h4 class="talk-ai-vendor-card__name">${escapeHtml(vendor.companyName)}</h4>
          <span class="talk-ai-vendor-card__badge">サブスク会員</span>
        </div>
        <dl class="talk-ai-vendor-card__meta">
          <div><dt>業種</dt><dd>${escapeHtml(trades)}</dd></div>
          <div><dt>対応エリア</dt><dd>${escapeHtml(areas)}</dd></div>
          <div><dt>評価</dt><dd>★ ${escapeHtml(rating)}</dd></div>
        </dl>
        <button type="button" class="talk-ai-vendor-card__cta" data-talk-vendor-consult="${escapeHtml(vendor.vendorId)}">
          相談する
        </button>
      </article>`;
  }

  function mountUi(root) {
    if (!root || root.dataset.vendorUiWired === "1") return;
    root.dataset.vendorUiWired = "1";

    const form = root.querySelector("[data-talk-ai-vendor-form]");
    const results = root.querySelector("[data-talk-ai-vendor-results]");
    const status = root.querySelector("[data-talk-ai-vendor-status]");

    function setStatus(message, tone) {
      if (!status) return;
      status.textContent = String(message || "");
      status.classList.remove("is-ok", "is-error");
      if (tone === "ok") status.classList.add("is-ok");
      if (tone === "error") status.classList.add("is-error");
    }

    function readCriteria() {
      return {
        trade: pickStr(root.querySelector("[data-talk-vendor-trade]")?.value),
        area: pickStr(root.querySelector("[data-talk-vendor-area]")?.value),
        date: pickStr(root.querySelector("[data-talk-vendor-date]")?.value),
        keyword: pickStr(root.querySelector("[data-talk-vendor-keyword]")?.value),
      };
    }

    function renderResults(rows) {
      if (!results) return;
      if (!rows.length) {
        results.innerHTML = `<p class="talk-ai-vendor-empty">条件に合うサブスク会員業者が見つかりませんでした。</p>`;
        return;
      }
      results.innerHTML = `<div class="talk-ai-vendor-results__grid">${rows.map(renderVendorCard).join("")}</div>`;
    }

    function runSearch() {
      const criteria = readCriteria();
      const rows = searchVendors(criteria);
      renderResults(rows);
      setStatus(`${rows.length}件の業者候補を表示しています（原型・簡易一致）`, rows.length ? "ok" : "");
      return criteria;
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      runSearch();
    });

    root.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("[data-talk-vendor-consult]") : null;
      if (!btn || !root.contains(btn)) return;
      const vid = btn.getAttribute("data-talk-vendor-consult") || "";
      const criteria = readCriteria();
      btn.setAttribute("disabled", "true");
      setStatus("相談を送信中…");
      const result = startVendorConsult(vid, criteria);
      btn.removeAttribute("disabled");
      if (!result.ok) {
        setStatus("相談の開始に失敗しました。もう一度お試しください。", "error");
        return;
      }
      setStatus(
        `${result.vendor.companyName} へ応募しました。掲載者画面で「やりとりを開始」できます。案件画面へ移動します…`,
        "ok"
      );
      global.setTimeout(() => {
        global.location.href = result.href;
      }, 600);
    });

    runSearch();
  }

  function renderPanel() {
    const root = global.document?.querySelector("[data-talk-ai-vendor-search]");
    if (root) mountUi(root);
  }

  global.TasuTalkAiVendorSearch = {
    listSubscribedVendors,
    searchVendors,
    startVendorConsult,
    renderPanel,
    formatCriteriaSummary,
    mvpThreadHref,
  };
})(typeof window !== "undefined" ? window : globalThis);
