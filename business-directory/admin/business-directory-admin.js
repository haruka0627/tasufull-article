/**
 * Business Directory Admin / Ops UI
 */
(function (global) {
  "use strict";

  const C = global.TasuBusinessDirectoryCommon;
  const Cats = global.TasuBusinessDirectoryCategories;

  if (!C) return;

  const MOCK_KEY = "bd_admin_mock_v1";
  const MOCK_LOG_KEY = "bd_admin_mock_audit_v1";

  function useAdminMock() {
    try {
      return new URLSearchParams(global.location.search).get("bdAdminMock") === "1";
    } catch {
      return false;
    }
  }

  function readMockStore() {
    try {
      const raw = global.localStorage.getItem(MOCK_KEY);
      return raw ? JSON.parse(raw) : { listings: [], queue: [], reviews: [] };
    } catch {
      return { listings: [], queue: [], reviews: [] };
    }
  }

  function writeMockStore(data) {
    global.localStorage.setItem(MOCK_KEY, JSON.stringify(data));
  }

  function readMockLogs(listingId) {
    try {
      const raw = global.localStorage.getItem(MOCK_LOG_KEY);
      const all = raw ? JSON.parse(raw) : {};
      return all[listingId] || [];
    } catch {
      return [];
    }
  }

  function appendMockLog(listingId, entry) {
    try {
      const raw = global.localStorage.getItem(MOCK_LOG_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[listingId] = [{ ...entry, created_at: new Date().toISOString() }, ...(all[listingId] || [])];
      global.localStorage.setItem(MOCK_LOG_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }

  function seedMockIfEmpty() {
    const store = readMockStore();
    if (store.queue?.length) return store;
    const listing = {
      id: "admin-mock-1",
      owner_user_id: "owner-001",
      display_name: "サンプル店舗",
      listing_type: "shop_retail",
      status: "review_requested",
      plan_code: "standard",
      category_id: "a1000001-0001-4000-8000-000000000001",
      service_areas: ["東京都", "神奈川県"],
      hp_mode: "full_page",
      website_url: "https://example.com",
      slug: "sample-shop",
      updated_at: new Date().toISOString(),
    };
    const profile = {
      company_name: "株式会社サンプル",
      contact_name: "山田太郎",
      contact_email: "owner@example.com",
      contact_phone: "03-1234-5678",
      prefecture: "東京都",
      city: "渋谷区",
      address_line1: "1-2-3",
      short_description: "地域密着の小売店です。",
      shop_sales_genre: "食品",
    };
    const queueItem = {
      id: "req-1",
      listing_id: listing.id,
      status: "open",
      submitted_at: new Date().toISOString(),
      business_directory_listings: listing,
    };
    store.listings = [listing];
    store.queue = [queueItem];
    store.profiles = { [listing.id]: profile };
    writeMockStore(store);
    return store;
  }

  function createAdminMockRepository() {
    seedMockIfEmpty();
    return {
      getReviewQueue: async () => {
        const store = readMockStore();
        return { queue: store.queue || [] };
      },
      getOpsListingDetail: async (listingId) => {
        const store = readMockStore();
        const listing = (store.listings || []).find((l) => l.id === listingId);
        if (!listing) throw Object.assign(new Error("not_found"), { code: "not_found" });
        return {
          detail: {
            listing,
            profile: store.profiles?.[listingId] || null,
            photos: store.photos?.[listingId] || [],
            business_hours: store.hours?.[listingId] || [],
            review_requests: store.reviews?.[listingId] || [],
            audit_logs: readMockLogs(listingId),
          },
        };
      },
      getListingAuditLogs: async (listingId) => ({ logs: readMockLogs(listingId) }),
      approveListing: async (listingId, opts) => {
        const store = readMockStore();
        const idx = store.listings.findIndex((l) => l.id === listingId);
        if (idx < 0) throw new Error("not_found");
        store.listings[idx] = { ...store.listings[idx], status: "published" };
        writeMockStore(store);
        appendMockLog(listingId, { action: "listing.approve", actor_role: "ops", metadata: opts || {} });
        return { listing: store.listings[idx] };
      },
      rejectListing: async (listingId, reason) => {
        if (!reason?.note?.trim()) {
          throw Object.assign(new Error("reject_reason_note required"), { code: "validation_error" });
        }
        const store = readMockStore();
        const idx = store.listings.findIndex((l) => l.id === listingId);
        store.listings[idx] = { ...store.listings[idx], status: "rejected" };
        writeMockStore(store);
        appendMockLog(listingId, { action: "listing.reject", actor_role: "ops", metadata: reason });
        return { listing: store.listings[idx] };
      },
      suspendListing: async (listingId, reason) => {
        if (!String(reason || "").trim()) {
          throw Object.assign(new Error("reason required"), { code: "validation_error" });
        }
        const store = readMockStore();
        const idx = store.listings.findIndex((l) => l.id === listingId);
        store.listings[idx] = { ...store.listings[idx], status: "suspended" };
        writeMockStore(store);
        appendMockLog(listingId, { action: "listing.suspend", actor_role: "ops", metadata: { reason } });
        return { listing: store.listings[idx] };
      },
      unpublishListing: async (listingId, reason) => {
        const store = readMockStore();
        const idx = store.listings.findIndex((l) => l.id === listingId);
        store.listings[idx] = { ...store.listings[idx], status: "unpublished" };
        writeMockStore(store);
        appendMockLog(listingId, { action: "listing.unpublish", actor_role: "ops", metadata: { reason } });
        return { listing: store.listings[idx] };
      },
      restoreListing: async (listingId, reason) => {
        const store = readMockStore();
        const idx = store.listings.findIndex((l) => l.id === listingId);
        store.listings[idx] = { ...store.listings[idx], status: "published" };
        writeMockStore(store);
        appendMockLog(listingId, { action: "listing.restore", actor_role: "ops", metadata: { reason } });
        return { listing: store.listings[idx] };
      },
    };
  }

  function getAdminRepository() {
    if (useAdminMock()) return createAdminMockRepository();
    return global.TasuBusinessDirectoryRepository || null;
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("ja-JP");
    } catch {
      return "—";
    }
  }

  function categoryName(id) {
    return Cats?.findById(id)?.name || id || "—";
  }

  function hpModeLabel(mode) {
    return mode === "external_redirect" ? "公式サイトへ送客" : "TASFUL簡易HP";
  }

  function renderStatusBadge(status) {
    const cls = `bd-status bd-status--${String(status).replace(/_/g, "-")}`;
    return `<span class="${cls}">${C.escapeHtml(C.statusLabel(status))}</span>`;
  }

  async function loadReviewQueue() {
    const repo = getAdminRepository();
    const host = C.qs("[data-bd-admin-queue]");
    const empty = C.qs("[data-bd-admin-queue-empty]");
    const toastEl = C.qs("[data-bd-admin-toast]");
    if (!repo) {
      C.toast(toastEl, "API 未設定 · ?bdAdminMock=1 で検証", "warn");
      return;
    }
    try {
      const res = await repo.getReviewQueue(100);
      const queue = (res.queue || []).filter((item) => {
        const listing = item.business_directory_listings || {};
        return String(listing.status) === "review_requested";
      });
      if (!queue.length) {
        if (host) host.innerHTML = "";
        if (empty) empty.hidden = false;
        return;
      }
      if (empty) empty.hidden = true;
      if (host) {
        host.innerHTML = `<table class="bd-admin-table"><thead><tr>
          <th>掲載名</th><th>種別</th><th>プラン</th><th>申請日時</th><th>事業者</th><th>状態</th><th></th>
        </tr></thead><tbody>${queue
          .map((item) => {
            const listing = item.business_directory_listings || {};
            const listingId = String(listing.id || item.listing_id);
            return `<tr>
              <td>${C.escapeHtml(listing.display_name || "—")}</td>
              <td>${C.escapeHtml(C.typeLabel(listing.listing_type))}</td>
              <td>${C.escapeHtml(String(listing.plan_code || "free").toUpperCase())}</td>
              <td>${C.escapeHtml(formatDateTime(item.submitted_at))}</td>
              <td>${C.escapeHtml(String(listing.owner_user_id || "—"))}</td>
              <td>${renderStatusBadge(listing.status || "review_requested")}</td>
              <td><a class="bd-admin-btn bd-admin-btn--ghost" href="listing.html?id=${encodeURIComponent(listingId)}">詳細確認</a></td>
            </tr>`;
          })
          .join("")}</tbody></table>`;
      }
    } catch (err) {
      C.toast(toastEl, err.message || "キュー取得失敗", "error");
    }
  }

  function renderReadonlyDetail(detail) {
    const listing = detail.listing || {};
    const profile = detail.profile || {};
    const photos = detail.photos || [];
    const hours = detail.business_hours || [];
    const host = C.qs("[data-bd-admin-detail-readonly]");
    if (!host) return;

    const serviceBlock =
      listing.listing_type === "shop_retail"
        ? `<dt>販売ジャンル</dt><dd>${C.escapeHtml(profile.shop_sales_genre || "—")}</dd>`
        : `<dt>サービス内容</dt><dd>${C.escapeHtml(profile.service_summary || "—")}</dd>
           <dt>料金目安</dt><dd>${C.escapeHtml(profile.price_range_text || "—")}</dd>`;

    host.innerHTML = `
      <p class="bd-admin-notice bd-admin-notice--readonly">運営は読取のみ — 事業者情報の入力代行は行いません</p>
      <dl class="bd-admin-dl">
        <dt>掲載名</dt><dd>${C.escapeHtml(listing.display_name || "—")}</dd>
        <dt>種別</dt><dd>${C.escapeHtml(C.typeLabel(listing.listing_type))}</dd>
        <dt>プラン</dt><dd>${C.escapeHtml(String(listing.plan_code || "free").toUpperCase())}</dd>
        <dt>ステータス</dt><dd>${renderStatusBadge(listing.status)}</dd>
        <dt>会社名</dt><dd>${C.escapeHtml(profile.company_name || "—")}</dd>
        <dt>担当者</dt><dd>${C.escapeHtml(profile.contact_name || "—")}</dd>
        <dt>メール</dt><dd>${C.escapeHtml(profile.contact_email || "—")}</dd>
        <dt>電話</dt><dd>${C.escapeHtml(profile.contact_phone || "—")}</dd>
        <dt>所在地</dt><dd>${C.escapeHtml([profile.prefecture, profile.city, profile.address_line1].filter(Boolean).join(" "))}</dd>
        <dt>対応地域</dt><dd>${C.escapeHtml((listing.service_areas || []).join("、"))}</dd>
        <dt>カテゴリ</dt><dd>${C.escapeHtml(categoryName(listing.category_id))}</dd>
        <dt>hp_mode</dt><dd>${C.escapeHtml(hpModeLabel(listing.hp_mode))}</dd>
        <dt>公式サイト</dt><dd>${listing.website_url ? `<a href="${C.escapeHtml(listing.website_url)}" target="_blank" rel="noopener">${C.escapeHtml(listing.website_url)}</a>` : "—"}</dd>
        <dt>紹介文</dt><dd>${C.escapeHtml(profile.short_description || "—")}</dd>
        ${serviceBlock}
      </dl>
      <div class="bd-admin-section" style="margin-top:16px">
        <h3 class="bd-admin-section__title">写真</h3>
        <div class="bd-admin-photo-row">${
          photos.length
            ? photos.map((p) => `<img src="${p.url || p.public_url || ""}" alt="">`).join("")
            : "<span>—</span>"
        }</div>
      </div>
      <div class="bd-admin-section" style="margin-top:16px">
        <h3 class="bd-admin-section__title">営業時間</h3>
        <p>${C.escapeHtml(hours.map((h) => h.label ? `${h.label}: ${h.value || h.hours_text}` : h.hours_text).join(" / ") || "—")}</p>
      </div>`;
  }

  function renderReviewHistory(requests) {
    const host = C.qs("[data-bd-admin-review-history]");
    if (!host) return;
    const list = requests || [];
    if (!list.length) {
      host.innerHTML = "<p class=\"bd-admin-empty\">申請履歴なし</p>";
      return;
    }
    host.innerHTML = `<ul class="bd-admin-log-list">${list
      .map(
        (r) => `<li class="bd-admin-log-item">
          <strong>${C.escapeHtml(r.request_type || "review")} · ${C.escapeHtml(r.status)}</strong>
          申請: ${C.escapeHtml(formatDateTime(r.submitted_at))}
          ${r.reviewed_at ? ` · 審査: ${C.escapeHtml(formatDateTime(r.reviewed_at))}` : ""}
          ${r.reject_reason_note ? `<br>差戻し: ${C.escapeHtml(r.reject_reason_note)}` : ""}
        </li>`,
      )
      .join("")}</ul>`;
  }

  function renderAuditLogs(logs) {
    const host = C.qs("[data-bd-admin-audit-logs]");
    if (!host) return;
    const list = logs || [];
    if (!list.length) {
      host.innerHTML = "<p class=\"bd-admin-empty\">監査ログなし</p>";
      return;
    }
    host.innerHTML = `<ul class="bd-admin-log-list">${list
      .map(
        (log) => `<li class="bd-admin-log-item">
          <strong>${C.escapeHtml(log.action || "—")}</strong>
          ${C.escapeHtml(formatDateTime(log.created_at))} · ${C.escapeHtml(log.actor_role || "")}
          ${log.from_status ? ` · ${C.escapeHtml(log.from_status)} → ${C.escapeHtml(log.to_status || "")}` : ""}
        </li>`,
      )
      .join("")}</ul>`;
  }

  function renderPreview(detail) {
    const host = C.qs("[data-bd-admin-preview]");
    if (!host) return;
    const listing = detail.listing || {};
    const profile = detail.profile || {};
    host.innerHTML = `<div class="bd-admin-preview">
      <p><strong>公開プレビュー</strong>（${C.escapeHtml(C.statusLabel(listing.status))}）</p>
      <h3>${C.escapeHtml(listing.display_name || "")}</h3>
      <p>${C.escapeHtml(profile.short_description || "")}</p>
    </div>`;
  }

  function wireActions(listingId, status) {
    const toastEl = C.qs("[data-bd-admin-toast]");
    const repo = getAdminRepository();
    const groups = {
      review: C.qs('[data-bd-admin-actions="review_requested"]'),
      published: C.qs('[data-bd-admin-actions="published"]'),
      restore: C.qs('[data-bd-admin-actions="restore"]'),
      archived: C.qs('[data-bd-admin-actions="archived"]'),
    };
    Object.entries(groups).forEach(([key, el]) => {
      if (!el) return;
      if (key === "review") el.hidden = status !== "review_requested";
      else if (key === "published") el.hidden = status !== "published";
      else if (key === "restore") el.hidden = !["suspended", "unpublished"].includes(status);
      else if (key === "archived") el.hidden = status !== "archived";
    });

    C.qs("[data-bd-admin-approve]")?.addEventListener("click", async () => {
      const note = C.qs("[data-bd-admin-reason-approve]")?.value?.trim() || "";
      try {
        await repo.approveListing(listingId, { note });
        C.toast(toastEl, "承認しました", "ok");
        global.location.reload();
      } catch (err) {
        C.toast(toastEl, err.message || "承認失敗", "error");
      }
    });

    C.qs("[data-bd-admin-reject]")?.addEventListener("click", async () => {
      const note = C.qs("[data-bd-admin-reason-reject]")?.value?.trim() || "";
      if (!note) {
        C.toast(toastEl, "差戻し理由は必須です", "error");
        return;
      }
      try {
        await repo.rejectListing(listingId, { note, code: "ops_reject" });
        C.toast(toastEl, "差戻しました", "ok");
        global.location.reload();
      } catch (err) {
        C.toast(toastEl, err.message || "差戻し失敗", "error");
      }
    });

    C.qs("[data-bd-admin-suspend]")?.addEventListener("click", async () => {
      const reason = C.qs("[data-bd-admin-reason-suspend]")?.value?.trim() || "";
      if (!reason) {
        C.toast(toastEl, "停止理由は必須です", "error");
        return;
      }
      try {
        await repo.suspendListing(listingId, reason);
        C.toast(toastEl, "停止しました", "ok");
        global.location.reload();
      } catch (err) {
        C.toast(toastEl, err.message || "停止失敗", "error");
      }
    });

    C.qs("[data-bd-admin-unpublish]")?.addEventListener("click", async () => {
      const reason = C.qs("[data-bd-admin-reason-unpublish]")?.value?.trim() || "";
      try {
        await repo.unpublishListing(listingId, reason);
        C.toast(toastEl, "非公開にしました", "ok");
        global.location.reload();
      } catch (err) {
        C.toast(toastEl, err.message || "非公開失敗", "error");
      }
    });

    C.qs("[data-bd-admin-restore]")?.addEventListener("click", async () => {
      const reason = C.qs("[data-bd-admin-reason-restore]")?.value?.trim() || "";
      try {
        await repo.restoreListing(listingId, reason);
        C.toast(toastEl, "再公開しました", "ok");
        global.location.reload();
      } catch (err) {
        C.toast(toastEl, err.message || "再公開失敗", "error");
      }
    });
  }

  async function loadListingDetail() {
    const listingId = new URLSearchParams(global.location.search).get("id") || "";
    const toastEl = C.qs("[data-bd-admin-toast]");
    const repo = getAdminRepository();
    if (!listingId || !repo) {
      C.toast(toastEl, "掲載 ID が不正です", "error");
      return;
    }
    try {
      const res = await repo.getOpsListingDetail(listingId);
      const detail = res.detail || res;
      const status = String(detail.listing?.status || "");
      C.qs("[data-bd-admin-listing-title]", document).textContent =
        detail.listing?.display_name || "掲載詳細";
      C.qs("[data-bd-admin-listing-status]", document).innerHTML = renderStatusBadge(status);
      renderReadonlyDetail(detail);
      renderPreview(detail);
      renderReviewHistory(detail.review_requests);
      renderAuditLogs(detail.audit_logs);
      wireActions(listingId, status);
    } catch (err) {
      C.toast(toastEl, err.message || "詳細取得失敗", "error");
    }
  }

  async function init() {
    if (global.TasuMemberAuth?.guardMemberPage) {
      await global.TasuMemberAuth.guardMemberPage();
    }
    const page = document.body?.dataset?.bdAdminPage;
    if (page === "reviews") await loadReviewQueue();
    if (page === "listing") await loadListingDetail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
