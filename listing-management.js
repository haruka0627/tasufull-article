/**
 * 掲載管理（listing-management.html）
 * localStorage ベース — 将来 Supabase 連携予定
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_listings";
  const LEGACY_KEYS = [
    "tasful_my_listings",
    "tasu_member_listings",
  ];

  const STATUS_LABELS = {
    active: "掲載中",
    draft: "下書き",
    paused: "停止中",
    review: "審査中",
    ended: "終了",
  };

  const TYPE_LABELS = {
    business: "業務サービス",
    skill: "スキル",
    product: "商品",
    job: "求人",
    worker: "ワーカー",
    shop_store: "店舗・販売",
  };

  const TABS = [
    { id: "all", label: "すべて" },
    { id: "active", label: "掲載中" },
    { id: "draft", label: "下書き" },
    { id: "paused", label: "停止中" },
    { id: "review", label: "審査中" },
    { id: "ended", label: "終了" },
  ];

  const DEMO_LISTINGS = [
    {
      id: "lm-demo-1",
      title: "TASFULハウスケア — 定期清掃",
      listingType: "business-service",
      scope: "business",
      businessType: "field_service",
      category: "出張・訪問サービス",
      price: 8800,
      status: "active",
      imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Clean",
      postedAt: "2026-04-12T09:00:00.000Z",
      views: 128,
      favorites: 14,
      inquiries: 6,
    },
    {
      id: "lm-demo-2",
      title: "Webサイト制作（下書き）",
      listingType: "skill",
      scope: "skill",
      category: "スキル",
      price: 120000,
      status: "draft",
      imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Web",
      postedAt: "2026-05-20T11:30:00.000Z",
      views: 0,
      favorites: 0,
      inquiries: 0,
      description: "要件定義からデザイン・実装・公開後保守までワンストップで支援します。",
      tags: ["Web", "制作", "保守"],
      draft: {
        title: "Webサイト制作（下書き）",
        category: "スキル",
        price: 120000,
        description: "要件定義からデザイン・実装・公開後保守までワンストップで支援します。",
        images: [
          "https://placehold.co/800x600/e8eef5/1e3a5f?text=Main",
          "https://placehold.co/800x600/dbeafe/1e3a5f?text=Sub+1",
        ],
        tags: ["Web", "制作", "保守"],
      },
    },
    {
      id: "lm-demo-3",
      title: "TASFUL空港送迎サービス",
      listingType: "business-service",
      scope: "business",
      businessType: "field_service",
      category: "送迎・運転",
      price: 15000,
      status: "paused",
      imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Car",
      postedAt: "2026-03-05T08:00:00.000Z",
      views: 256,
      favorites: 22,
      inquiries: 11,
    },
    {
      id: "lm-demo-4",
      title: "店舗リニューアル支援",
      listingType: "shop-store",
      scope: "business",
      businessType: "shop_store",
      category: "店舗・販売",
      price: 98000,
      status: "review",
      imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Shop",
      postedAt: "2026-05-28T14:00:00.000Z",
      views: 12,
      favorites: 1,
      inquiries: 2,
    },
    {
      id: "lm-demo-5",
      title: "求人：カスタマーサポート（終了）",
      listingType: "job",
      scope: "job",
      category: "カスタマーサポート",
      price: 0,
      status: "ended",
      imageUrl: "https://placehold.co/240x180/e8eef5/1e3a5f?text=Job",
      postedAt: "2025-12-01T10:00:00.000Z",
      views: 540,
      favorites: 8,
      inquiries: 34,
    },
  ];

  let listings = [];
  let activeTab = "all";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatYen(n) {
    if (window.TasuDashboardData?.formatYen) return window.TasuDashboardData.formatYen(n);
    return `¥${Math.max(0, Math.round(Number(n) || 0)).toLocaleString("ja-JP")}`;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }

  function normalizeStatus(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (s === "public" || s === "published") return "active";
    if (STATUS_LABELS[s]) return s;
    if (s === "inactive" || s === "stopped") return "paused";
    return "draft";
  }

  function normalizeTypeKey(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
  }

  function resolveListingTypeKey(item) {
    const listingType = normalizeTypeKey(item.listingType || item.listing_type || item.type);
    const scope = normalizeTypeKey(item.scope);
    const businessSub = normalizeTypeKey(
      item.businessType ||
        item.business_type ||
        item.draft?.businessType ||
        item.draft?.business_type
    );

    if (listingType === "business_service") return "business_service";
    if (listingType === "shop_store") return "shop_store";
    if (listingType === "skill") return "skill";
    if (listingType === "product" || listingType === "item") return "product";
    if (listingType === "job") return "job";
    if (listingType === "worker") return "worker";
    if (listingType === "business") {
      return businessSub === "shop_store" ? "shop_store" : "business_service";
    }
    if (listingType === "general" || listingType === "other") {
      if (scope === "business") {
        return businessSub === "shop_store" ? "shop_store" : "business_service";
      }
      if (scope === "skill") return "skill";
      if (scope === "job") return "job";
      if (scope === "worker") return "worker";
      if (scope === "product") return "product";
      return "general";
    }
    const rawType = String(item?.listingType || item?.listing_type || item?.type || "").trim();
    if (rawType === "その他") {
      if (businessSub === "shop_store") return "shop_store";
      if (scope === "business") {
        return businessSub === "shop_store" ? "shop_store" : "business_service";
      }
      return "general";
    }

    if (scope === "business") {
      return businessSub === "shop_store" ? "shop_store" : "business_service";
    }
    if (scope === "skill") return "skill";
    if (scope === "job") return "job";
    if (scope === "worker") return "worker";
    if (scope === "product") return "product";

    return listingType || scope || "general";
  }

  function buildDetailUrl(item) {
    if (global.TasuListingLocalStore?.buildDetailPageUrl) {
      return global.TasuListingLocalStore.buildDetailPageUrl(item);
    }
    const id = String(item?.id || item?.listingId || item?.listing_id || "").trim();
    if (!id) return "#";

    const enc = encodeURIComponent(id);
    const typeKey = resolveListingTypeKey(item);

    switch (typeKey) {
      case "business_service":
        return `detail-business-service.html?id=${enc}`;
      case "shop_store":
        return `detail-shop-store.html?id=${enc}`;
      case "skill":
        return `detail-skill.html?id=${enc}`;
      case "product":
        return `detail-product.html?id=${enc}`;
      case "job":
        return `detail-job.html?id=${enc}`;
      case "worker":
        return `detail-worker.html?id=${enc}`;
      case "general":
        return `detail-general.html?id=${enc}`;
      default:
        return `detail-general.html?id=${enc}`;
    }
  }

  function normalizeListing(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || raw.listingId || raw.listing_id || "").trim();
    if (!id) return null;
    const scope = String(raw.scope || raw.listing_type || raw.listingType || "business").trim();
    const businessType = String(
      raw.businessType ||
        raw.business_type ||
        raw.draft?.businessType ||
        raw.draft?.business_type ||
        ""
    ).trim();
    return {
      id,
      title: String(raw.title || raw.service_name || raw.name || "（タイトル未設定）").trim(),
      listingType: String(raw.listingType || raw.listing_type || scope).trim(),
      scope,
      businessType,
      category: String(raw.category || raw.business_category || raw.subcategory || "—").trim(),
      price: Number(raw.price ?? raw.price_yen ?? raw.amount ?? 0) || 0,
      status: normalizeStatus(raw.status || raw.publish_status),
      imageUrl: String(
        raw.imageUrl ||
          raw.image_url ||
          raw.thumbnail_url ||
          raw.thumbnail ||
          ""
      ).trim(),
      postedAt: raw.postedAt || raw.posted_at || raw.created_at || raw.createdAt || "",
      views: Number(raw.views ?? raw.view_count ?? 0) || 0,
      favorites: Number(raw.favorites ?? raw.favorite_count ?? 0) || 0,
      inquiries: Number(raw.inquiries ?? raw.inquiry_count ?? 0) || 0,
      description: String(raw.description || raw.draft?.description || "").trim(),
      tags: Array.isArray(raw.tags)
        ? raw.tags
        : Array.isArray(raw.draft?.tags)
          ? raw.draft.tags
          : [],
      images: parseImages(raw.images || raw.draft?.images || raw.imageUrl),
      source: String(raw.source || "").trim(),
      createdAt: raw.createdAt || raw.postedAt || raw.posted_at || "",
      updatedAt: raw.updatedAt || "",
      businessType: String(
        raw.businessType ||
          raw.business_type ||
          raw.draft?.businessType ||
          ""
      ).trim(),
      draft: raw.draft && typeof raw.draft === "object" ? raw.draft : null,
    };
  }

  function parseImages(raw) {
    if (global.TasuListingLocalStore?.parseImages) {
      return global.TasuListingLocalStore.parseImages(raw);
    }
    if (Array.isArray(raw)) {
      return raw.map((u) => String(u).trim()).filter(Boolean).slice(0, 6);
    }
    const text = String(raw || "").trim();
    if (!text) return [];
    if (text.startsWith("http")) return [text];
    return text
      .split(/\r?\n|,/)
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  function readJsonKey(key) {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) return parsed.items;
      if (parsed && typeof parsed === "object") return [parsed];
      return [];
    } catch {
      return null;
    }
  }

  function loadListings() {
    const map = new Map();
    [STORAGE_KEY, ...LEGACY_KEYS].forEach((key) => {
      const rows = readJsonKey(key);
      if (!rows) return;
      rows.forEach((row) => {
        const item = normalizeListing(row);
        if (item) map.set(item.id, item);
      });
    });

    if (map.size === 0) {
      const seeded = readJsonKey(STORAGE_KEY);
      if (seeded === null) {
        writeListings(DEMO_LISTINGS);
        return DEMO_LISTINGS.map((item) => ({ ...item }));
      }
      return [];
    }

    return [...map.values()];
  }

  function writeListings(list) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function saveListings(changedItem) {
    writeListings(listings);
    try {
      global.dispatchEvent(
        new CustomEvent("tasu:listings-updated", { detail: { key: STORAGE_KEY } })
      );
    } catch {
      /* noop */
    }
    if (changedItem?.id) {
      try {
        global.TasuTalkFollowNotify?.onListingChanged?.({
          record: changedItem,
          mode: "update",
        });
      } catch (err) {
        console.warn("[ListingManagement] follow notify skipped:", err);
      }
    }
  }

  function reloadListingsFromStorage() {
    listings = loadListings();
    renderStats();
    renderTabs();
    renderList();
  }

  function buildEditUrl(item) {
    return `post.html?edit=${encodeURIComponent(item.id)}`;
  }

  function showToast(message) {
    const el = document.querySelector("[data-lm-toast]");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    global.clearTimeout(showToast._timer);
    showToast._timer = global.setTimeout(() => {
      el.hidden = true;
    }, 3200);
  }

  function countByStatus(status) {
    if (status === "all") return listings.length;
    return listings.filter((item) => item.status === status).length;
  }

  function filteredListings() {
    if (activeTab === "all") return listings;
    return listings.filter((item) => item.status === activeTab);
  }

  function renderStats() {
    const root = document.querySelector("[data-lm-stats]");
    if (!root) return;
    const defs = [
      { key: "active", label: "掲載中" },
      { key: "draft", label: "下書き" },
      { key: "paused", label: "停止中" },
      { key: "review", label: "審査中" },
      { key: "ended", label: "終了" },
    ];
    root.innerHTML = defs
      .map(
        (d) => `<div class="lm-stat">
          <p class="lm-stat__label">${esc(d.label)}</p>
          <p class="lm-stat__value">${countByStatus(d.key)}</p>
        </div>`
      )
      .join("");
  }

  function renderTabs() {
    const root = document.querySelector("[data-lm-tabs]");
    if (!root) return;
    root.innerHTML = TABS.map(
      (tab) =>
        `<button type="button" class="lm-tabs__btn${activeTab === tab.id ? " is-active" : ""}" data-lm-tab="${esc(tab.id)}">${esc(tab.label)}</button>`
    ).join("");
    root.querySelectorAll("[data-lm-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.getAttribute("data-lm-tab") || "all";
        renderTabs();
        renderList();
      });
    });
  }

  function renderList() {
    const listRoot = document.querySelector("[data-lm-list]");
    const emptyRoot = document.querySelector("[data-lm-empty]");
    if (!listRoot || !emptyRoot) return;

    const rows = filteredListings();
    renderStats();

    if (!rows.length) {
      listRoot.innerHTML = "";
      emptyRoot.hidden = false;
      return;
    }

    emptyRoot.hidden = true;
    listRoot.innerHTML = rows
      .map((item) => {
        const typeLabel = TYPE_LABELS[item.listingType] || TYPE_LABELS[item.scope] || item.listingType;
        const statusLabel = STATUS_LABELS[item.status] || item.status;
        const img =
          item.imageUrl ||
          "https://placehold.co/240x180/e8eef5/1e3a5f?text=No+Image";
        const pauseLabel = item.status === "paused" ? "再開" : "停止";
        const pauseAction = item.status === "paused" ? "resume" : "pause";
        const canPause = item.status === "active" || item.status === "paused";

        const aiBadge =
          item.source === "ai-agent"
            ? '<span class="listing-ai-badge" data-ai-agent-badge>AI作成</span>'
            : "";

        return `<article class="lm-card" data-lm-card="${esc(item.id)}">
          <img class="lm-card__thumb" src="${esc(img)}" alt="" width="120" height="90" loading="lazy" decoding="async">
          <div class="lm-card__body">
            <div class="lm-card__head">
              <h3 class="lm-card__title">${esc(item.title)}</h3>
              ${aiBadge}
              <span class="lm-badge lm-badge--${esc(item.status)}">${esc(statusLabel)}</span>
            </div>
            <ul class="lm-card__meta">
              <li>掲載種別: <strong>${esc(typeLabel)}</strong></li>
              <li>カテゴリ: <strong>${esc(item.category)}</strong></li>
              <li>価格: <strong>${item.price > 0 ? esc(formatYen(item.price)) : "要相談"}</strong></li>
              <li>投稿日: <strong>${esc(formatDate(item.postedAt))}</strong></li>
            </ul>
            <div class="lm-card__stats">
              <span>閲覧 ${item.views}</span>
              <span>お気に入り ${item.favorites}</span>
              <span>問い合わせ ${item.inquiries}</span>
            </div>
            <div class="lm-card__actions">
              <a class="dash-btn dash-btn--secondary dash-btn--sm" href="${esc(buildDetailUrl(item))}" data-lm-detail-link data-lm-id="${esc(item.id)}" data-lm-listing-type="${esc(resolveListingTypeKey(item))}">詳細を見る</a>
              <a class="dash-btn dash-btn--secondary dash-btn--sm" href="${esc(buildEditUrl(item))}">編集</a>
              <button type="button" class="dash-btn dash-btn--secondary dash-btn--sm" data-lm-action="duplicate" data-lm-id="${esc(item.id)}">複製</button>
              ${canPause ? `<button type="button" class="dash-btn dash-btn--secondary dash-btn--sm" data-lm-action="${pauseAction}" data-lm-id="${esc(item.id)}">${pauseLabel}</button>` : ""}
              <button type="button" class="dash-btn dash-btn--secondary dash-btn--sm" data-lm-action="delete" data-lm-id="${esc(item.id)}">削除</button>
            </div>
          </div>
        </article>`;
      })
      .join("");

    listRoot.querySelectorAll("[data-lm-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(btn));
    });
  }

  function findListing(id) {
    return listings.find((item) => item.id === id);
  }

  function handleAction(btn) {
    const action = btn.getAttribute("data-lm-action");
    const id = btn.getAttribute("data-lm-id");
    const item = findListing(id);
    if (!item) return;

    if (action === "pause") {
      item.status = "paused";
      item.updatedAt = new Date().toISOString();
      saveListings(item);
      showToast("掲載を停止しました。");
      renderList();
      return;
    }

    if (action === "resume") {
      item.status = "active";
      item.updatedAt = new Date().toISOString();
      saveListings(item);
      showToast("掲載を再開しました。");
      renderList();
      return;
    }

    if (action === "duplicate") {
      const copy = {
        ...item,
        id: `lm-copy-${Date.now()}`,
        title: `${item.title}（複製）`,
        status: "draft",
        postedAt: new Date().toISOString(),
        views: 0,
        favorites: 0,
        inquiries: 0,
      };
      listings.unshift(copy);
      saveListings();
      activeTab = "draft";
      renderTabs();
      renderList();
      showToast("下書きとして複製しました。");
      return;
    }

    if (action === "delete") {
      if (!global.confirm(`「${item.title}」を削除しますか？`)) return;
      listings = listings.filter((row) => row.id !== id);
      saveListings();
      showToast("掲載を削除しました。");
      renderList();
    }
  }

  function bindPage() {
    if (document.body?.dataset?.page !== "listing-management") return;
    listings = loadListings();
    renderStats();
    renderTabs();
    renderList();

    global.addEventListener("pageshow", () => {
      if (document.body?.dataset?.page !== "listing-management") return;
      reloadListingsFromStorage();
    });

    if (global.TasuListingLocalStore?.bindStorageSync) {
      global.TasuListingLocalStore.bindStorageSync(reloadListingsFromStorage);
    }
  }

  global.TasuListingManagement = {
    STORAGE_KEY,
    STATUS_LABELS,
    loadListings,
    writeListings,
    reloadListingsFromStorage,
    resolveListingTypeKey,
    buildDetailUrl,
    getListings: () => listings,
    setListings: (next) => {
      listings = Array.isArray(next) ? next : [];
      saveListings();
      renderStats();
      renderList();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPage);
  } else {
    bindPage();
  }
})(typeof window !== "undefined" ? window : globalThis);
