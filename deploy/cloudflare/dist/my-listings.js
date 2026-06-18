/**
 * 会員 — 自分の掲載一覧（my-listings.html）
 */
(function () {
  "use strict";

  if (document.body?.dataset?.page !== "my-listings") return;

  const TYPE_LABELS = {
    business: "業務サービス",
    skill: "スキル",
    product: "商品",
    job: "求人",
    worker: "ワーカー",
  };

  const PUBLISH_LABELS = {
    public: "公開中",
    draft: "非公開",
    scheduled: "予約公開",
  };

  /** business-board-demo.js の id と一致（詳細ページ確認用） */
  const SAMPLE_LISTINGS = [
    {
      id: "demo-biz-pr-1",
      title: "TASFUL建設パートナー",
      detailUrl: "detail-business-service.html?id=demo-biz-pr-1",
    },
    {
      id: "demo-biz-pr-2",
      title: "TASFUL空港送迎サービス",
      detailUrl: "detail-business-service.html?id=demo-biz-pr-2",
    },
    {
      id: "demo-biz-cleaning-1",
      title: "TASFULハウスケア",
      detailUrl: "detail-business-service.html?id=demo-biz-cleaning-1",
    },
  ];

  const loginPanel = document.querySelector("[data-my-listings-login]");
  const statusEl = document.querySelector("[data-my-listings-status]");
  const toastEl = document.querySelector("[data-my-listings-toast]");
  const tableWrap = document.querySelector("[data-my-listings-table-wrap]");
  const tbody = document.querySelector("[data-my-listings-tbody]");
  const samplesWrap = document.querySelector("[data-my-listings-samples]");
  const samplesGrid = document.querySelector("[data-my-listings-samples-grid]");

  let currentUserId = "";
  let rows = [];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(message, tone) {
    if (!toastEl) return;
    toastEl.hidden = false;
    toastEl.dataset.tone = tone || "success";
    toastEl.textContent = message;
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 4200);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }

  function resolveTitle(row) {
    const fd =
      row.form_data && typeof row.form_data === "object"
        ? row.form_data
        : typeof row.form_data === "string"
          ? (() => {
              try {
                return JSON.parse(row.form_data);
              } catch {
                return {};
              }
            })()
          : {};
    return (
      String(row.title || "").trim() ||
      String(fd.service_name || fd.serviceName || "").trim() ||
      String(row.job_title || fd.job_title || fd.jobTitle || "").trim() ||
      String(row.product_name || fd.product_name || "").trim() ||
      String(row.worker_display_name || fd.name || "").trim() ||
      "（タイトル未設定）"
    );
  }

  function resolveBusinessKind(row) {
    const bt = String(row.business_type || "").trim();
    const cat = String(row.business_category || "").trim();
    if (bt === "shop_store" || cat === "shop_store") return "shop_store";
    return "field_service";
  }

  function resolveKindLabel(row) {
    if (row.scope === "business") {
      return resolveBusinessKind(row) === "shop_store" ? "店舗・販売" : "業務サービス";
    }
    const t = String(row.listing_type || "").trim();
    return TYPE_LABELS[t] || t || "一般掲載";
  }

  function resolveCategoryLabel(row) {
    if (row.scope === "business") {
      if (window.TasuBusinessListings?.CATEGORY_LABELS) {
        const key = String(row.business_category || "").trim();
        return window.TasuBusinessListings.CATEGORY_LABELS[key] || key || "—";
      }
      return String(row.business_category || "—");
    }
    const cat = String(row.category || row.subcategory || "").trim();
    if (cat) return cat;
    const fd = row.form_data && typeof row.form_data === "object" ? row.form_data : {};
    return String(fd.category || fd.workerCategory || "—") || "—";
  }

  function publishBadgeClass(status) {
    const s = String(status || "").trim();
    if (s === "public") return "my-listings-badge--public";
    if (s === "scheduled") return "my-listings-badge--scheduled";
    return "my-listings-badge--draft";
  }

  function buildDetailPostUrl(listingId) {
    const id = encodeURIComponent(String(listingId || "").trim());
    if (!id) return "my-listings.html";
    return `detail-post.html?listingId=${id}`;
  }

  function buildEditPostUrl(listingId) {
    const id = encodeURIComponent(String(listingId || "").trim());
    if (!id) return "my-listings.html";
    return `edit-post.html?listingId=${id}`;
  }

  function resolveDetailUrl(row) {
    const id = encodeURIComponent(String(row.id || ""));
    if (row.scope === "business") {
      const path =
        resolveBusinessKind(row) === "shop_store"
          ? "detail-shop-store.html"
          : "detail-business-service.html";
      return `${path}?id=${id}`;
    }
    const map = {
      product: "detail-product.html",
      skill: "detail-skill.html",
      job: "detail-job.html",
      worker: "detail-worker.html",
    };
    const type = String(row.listing_type || "skill").trim();
    const path = map[type] || "detail-skill.html";
    return `${path}?id=${id}`;
  }

  function resolveEditUrl(row) {
    const id = encodeURIComponent(String(row.id || ""));
    if (row.scope === "business") {
      return `post.html?scope=business&id=${id}`;
    }
    const type = String(row.listing_type || "skill").trim();
    return `post.html?type=${encodeURIComponent(type)}&id=${id}`;
  }

  function normalizeBusinessRow(raw) {
    return {
      scope: "business",
      id: String(raw.id || "").trim(),
      user_id: String(raw.user_id || "").trim(),
      listing_type: "business",
      business_type: String(raw.business_type || "").trim(),
      business_category: String(raw.business_category || "").trim(),
      title: resolveTitle(raw),
      publish_status: String(raw.publish_status || "public").trim(),
      created_at: raw.created_at || "",
      updated_at: raw.updated_at || "",
      form_data: raw.form_data,
      _raw: raw,
    };
  }

  function normalizeGeneralRow(raw) {
    const type = String(raw.listing_type || "").trim();
    return {
      scope: "general",
      id: String(raw.id || "").trim(),
      user_id: String(raw.user_id || "").trim(),
      listing_type: type,
      business_type: "",
      business_category: "",
      title: resolveTitle(raw),
      publish_status: String(raw.publish_status || "public").trim(),
      created_at: raw.created_at || "",
      updated_at: raw.updated_at || "",
      form_data: raw.form_data,
      category: raw.category,
      subcategory: raw.subcategory,
      _raw: raw,
    };
  }

  async function resolveUserId() {
    const ctx = await window.TasuDashboardData?.resolveAuthContext?.();
    const fromAuth = String(ctx?.userId || "").trim();
    if (fromAuth) return fromAuth;

    try {
      const raw = localStorage.getItem("tasu_member_session");
      const session = raw ? JSON.parse(raw) : null;
      return String(session?.id || "").trim();
    } catch {
      return "";
    }
  }

  function isLoggedIn(userId, ctx) {
    if (window.TasuMemberAuth?.isAuthenticatedSync) {
      return window.TasuMemberAuth.isAuthenticatedSync();
    }
    if (!userId) return false;
    if (ctx?.hasSupabaseAuth || ctx?.isAuthenticated) return true;
    try {
      const raw = localStorage.getItem("tasu_member_session");
      const session = raw ? JSON.parse(raw) : null;
      return Boolean(String(session?.id || "").trim());
    } catch {
      return false;
    }
  }

  async function fetchMyListings(userId) {
    const [business, general] = await Promise.all([
      window.TasuBusinessListings?.fetchBusinessListingsByUser?.(userId, { limit: 200 }) ||
        Promise.resolve([]),
      window.TasuListingStore?.fetchListingsByUser?.(userId, { limit: 200 }) ||
        Promise.resolve([]),
    ]);

    const items = [
      ...(business || []).map(normalizeBusinessRow),
      ...(general || []).map(normalizeGeneralRow),
    ];

    items.sort((a, b) => {
      const ta = String(a.updated_at || a.created_at || "");
      const tb = String(b.updated_at || b.created_at || "");
      return tb.localeCompare(ta);
    });

    return items;
  }

  function hideSamples() {
    if (samplesWrap) samplesWrap.hidden = true;
    if (samplesGrid) samplesGrid.innerHTML = "";
  }

  function buildListingCardHtml(options) {
    const title = options.title;
    const kindLabel = options.kindLabel || "業務サービス";
    const isSample = options.sample === true;
    const pubLabel = options.publishLabel || "公開中";
    const pubClass = options.publishClass || "my-listings-badge--public";
    const listingId = String(options.listingId || "").trim();
    const detailUrl =
      options.detailUrl || (!isSample && listingId ? buildDetailPostUrl(listingId) : "");
    const editUrl =
      options.editUrl || (!isSample && listingId ? buildEditPostUrl(listingId) : "");
    const canUnpublish = options.canUnpublish === true;

    const badges = `<span class="my-listings-badge ${pubClass}">${esc(pubLabel)}</span>${
      isSample
        ? '<span class="my-listings-badge my-listings-badge--sample">サンプル表示</span>'
        : ""
    }`;

    const detailControl = isSample
      ? detailUrl
        ? `<a class="dash-btn dash-btn--secondary" href="${esc(detailUrl)}">詳細を見る</a>`
        : `<button type="button" class="dash-btn dash-btn--secondary" disabled aria-disabled="true">詳細を見る</button>`
      : `<a class="dash-btn dash-btn--secondary" href="${esc(detailUrl)}" data-my-listings-detail>詳細を見る</a>`;

    const editControl = isSample
      ? `<button type="button" class="dash-btn dash-btn--secondary" disabled aria-disabled="true">編集する</button>`
      : `<a class="dash-btn dash-btn--secondary" href="${esc(editUrl)}" data-my-listings-edit>編集する</a>`;

    const unpublishControl =
      !isSample && canUnpublish
        ? `<button type="button" class="dash-btn dash-btn--secondary" data-my-listings-unpublish>非公開にする</button>`
        : "";

    return `<article class="my-listings-listing-card${
      isSample ? " my-listings-listing-card--sample" : ""
    }" role="listitem"${
      listingId
        ? ` data-listing-id="${esc(listingId)}" data-listing-scope="${esc(options.listingScope || "")}"`
        : ""
    }>
      <div class="my-listings-listing-card__body">
        <h3 class="my-listings-listing-card__title">${esc(title)}</h3>
        <p class="my-listings-listing-card__kind">${esc(kindLabel)}</p>
        <div class="my-listings-listing-card__badges">${badges}</div>
      </div>
      <div class="my-listings-listing-card__actions my-listings-actions">
        ${detailControl}
        ${editControl}
        ${unpublishControl}
      </div>
    </article>`;
  }

  function renderSampleCards() {
    if (!samplesWrap || !samplesGrid) return;

    samplesWrap.hidden = false;
    samplesGrid.hidden = false;
    samplesGrid.removeAttribute("aria-hidden");
    samplesGrid.innerHTML = SAMPLE_LISTINGS.map((item) =>
      buildListingCardHtml({
        listingId: item.id,
        title: item.title,
        kindLabel: "業務サービス",
        sample: true,
        publishLabel: "公開中",
        publishClass: "my-listings-badge--public",
        detailUrl: item.detailUrl,
      })
    ).join("");

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "掲載は 0 件です。サンプルを表示しています。";
    }
  }

  function setLoading(message) {
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = message;
    }
    if (tableWrap) tableWrap.hidden = true;
    hideSamples();
    if (loginPanel) loginPanel.hidden = true;
  }

  function showLoginRequired() {
    if (loginPanel) loginPanel.hidden = false;
    if (statusEl) statusEl.hidden = true;
    if (tableWrap) tableWrap.hidden = true;
    hideSamples();
    if (tbody) tbody.innerHTML = "";
  }

  function renderTable() {
    if (!tbody) return;

    if (!rows.length) {
      if (tableWrap) tableWrap.hidden = true;
      tbody.innerHTML = "";
      renderSampleCards();
      return;
    }

    hideSamples();
    if (tableWrap) tableWrap.hidden = false;
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = `${rows.length} 件の掲載を表示しています。`;
    }

    tbody.innerHTML = rows
      .map((row) => {
        const pub = String(row.publish_status || "draft");
        const pubLabel = PUBLISH_LABELS[pub] || pub;
        const detailUrl = buildDetailPostUrl(row.id);
        const editUrl = buildEditPostUrl(row.id);
        const canUnpublish = pub === "public" || pub === "scheduled";

        return `<tr data-listing-id="${esc(row.id)}" data-listing-scope="${esc(row.scope)}">
          <td>
            <span class="my-listings-table__title">${esc(row.title)}</span>
            <span class="my-listings-table__meta">ID: ${esc(row.id)}</span>
          </td>
          <td>${esc(resolveKindLabel(row))}</td>
          <td>${esc(resolveCategoryLabel(row))}</td>
          <td><span class="my-listings-badge ${publishBadgeClass(pub)}">${esc(pubLabel)}</span></td>
          <td>${esc(formatDate(row.created_at))}</td>
          <td>${esc(formatDate(row.updated_at))}</td>
          <td>
            <div class="my-listings-actions">
              <a class="dash-btn dash-btn--secondary" href="${esc(detailUrl)}" data-my-listings-detail>詳細を見る</a>
              <a class="dash-btn dash-btn--secondary" href="${esc(editUrl)}" data-my-listings-edit>編集する</a>
              ${
                canUnpublish
                  ? `<button type="button" class="dash-btn dash-btn--secondary" data-my-listings-unpublish>非公開にする</button>`
                  : ""
              }
            </div>
          </td>
        </tr>`;
      })
      .join("");
  }

  async function handleUnpublish(button) {
    const tr = button.closest("tr");
    const id = String(tr?.dataset?.listingId || "").trim();
    const scope = String(tr?.dataset?.listingScope || "").trim();
    if (!id || !currentUserId) return;

    if (!window.confirm("この掲載を非公開にしますか？")) return;

    button.disabled = true;

    try {
      let result;
      if (scope === "business") {
        result = await window.TasuBusinessListings?.updateBusinessPublishStatus?.(
          id,
          currentUserId,
          "draft"
        );
      } else {
        result = await window.TasuListingStore?.updateListingPublishStatus?.(
          id,
          currentUserId,
          "draft"
        );
      }

      if (!result?.ok) {
        showToast(result?.error || "非公開への変更に失敗しました。", "error");
        return;
      }

      showToast("非公開にしました。", "success");
      rows = await fetchMyListings(currentUserId);
      renderTable();
    } catch (err) {
      console.error("[MyListings] unpublish failed:", err);
      showToast("非公開への変更に失敗しました。", "error");
    } finally {
      button.disabled = false;
    }
  }

  function navigateListingFromHost(host, mode) {
    const id = String(host?.dataset?.listingId || "").trim();
    if (!id || /^demo[-_]/.test(id) || id.startsWith("demo_sample_")) return false;
    const row = rows.find((r) => String(r.id) === id);
    if (!row) return false;
    const url = mode === "edit" ? resolveEditUrl(row) : resolveDetailUrl(row);
    window.location.href = url;
    return true;
  }

  function handleListingNavClick(event) {
    const detailLink = event.target.closest("[data-my-listings-detail]");
    const editLink = event.target.closest("[data-my-listings-edit]");
    if (!detailLink && !editLink) return;

    const host = event.target.closest("[data-listing-id]");
    if (!host) return;

    if (detailLink || editLink) {
      const mode = editLink ? "edit" : "detail";
      if (navigateListingFromHost(host, mode)) {
        event.preventDefault();
      }
    }
  }

  function bindTableActions() {
    tbody?.addEventListener("click", (event) => {
      if (event.target.closest("[data-my-listings-detail], [data-my-listings-edit]")) {
        handleListingNavClick(event);
        return;
      }
      const btn = event.target.closest("[data-my-listings-unpublish]");
      if (!btn) return;
      event.preventDefault();
      void handleUnpublish(btn);
    });

    samplesGrid?.addEventListener("click", handleListingNavClick);
  }

  async function init() {
    setLoading("読み込み中…");

    try {
      const ctx = await window.TasuDashboardData?.resolveAuthContext?.();
      currentUserId = await resolveUserId();

      if (!isLoggedIn(currentUserId, ctx)) {
        showLoginRequired();
        return;
      }

      rows = await fetchMyListings(currentUserId);
      renderTable();
    } catch (err) {
      console.error("[MyListings] init failed:", err);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "掲載一覧の読み込みに失敗しました。";
      }
    }
  }

  bindTableActions();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
