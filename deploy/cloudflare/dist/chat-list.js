/**
 * チャット一覧 UI — すべてのやりとり
 * - 検索 / フィルター / ソート
 * - 種別ラベル（相談・見積・取引・通知・運営）
 */
(function () {
  "use strict";

  const TYPE_META = {
    consult: { label: "相談", className: "chat-type--consult" },
    estimate: { label: "見積", className: "chat-type--estimate" },
    deal: { label: "取引", className: "chat-type--deal" },
    notify: { label: "通知", className: "chat-type--notify" },
    ops: { label: "運営", className: "chat-type--ops" },
  };

  const ONGOING_LIFECYCLES = new Set([
    "active",
    "fee_pending",
    "completion_pending",
    "awaiting_payment",
  ]);

  const COMPLETED_LIFECYCLES = new Set(["completed", "cancelled", "expired"]);

  /** @type {Array<object>} */
  let threadsCache = [];
  /** @type {(() => void)|null} */
  let unsubscribeListRealtime = null;

  const viewState = {
    search: "",
    filter: "all",
    sort: "newest",
  };

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function getMeId() {
    if (window.TasuChatUserIdentity?.getEffectiveUserId) {
      return window.TasuChatUserIdentity.getEffectiveUserId();
    }
    return window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId || "u_me";
  }

  function getLifecycle(thread) {
    if (window.TasuChatRoomStatus?.resolveRoomLifecycleStatus) {
      return window.TasuChatRoomStatus.resolveRoomLifecycleStatus(thread);
    }
    const status = String(thread?.status || thread?.roomStatus || "active").toLowerCase();
    if (status === "expired") return "expired";
    if (status === "completed") return "completed";
    if (status === "cancelled") return "cancelled";
    return "active";
  }

  function classifyTypeKey(thread) {
    const id = String(thread?.id || "");
    const contactKind = pickStr(thread?.platformContactKind, thread?.contactKind, thread?.contact_kind).toLowerCase();
    const threadKind = pickStr(thread?.threadKind, thread?.thread_kind).toLowerCase();
    const listingType = pickStr(thread?.listing?.type, thread?.listing_type, thread?.listingType).toLowerCase();
    const lifecycle = getLifecycle(thread);

    if (thread?._notifyCard || thread?.minimalNotifyCard) {
      return "notify";
    }
    if (thread?._officialRoom || /^official_/i.test(id)) {
      if (
        thread?.source === "notify" ||
        thread?._talkChannel === "notify" ||
        threadKind === "notify"
      ) {
        return "notify";
      }
      return "ops";
    }
    if (thread?._staticCard && /support|official|notify|tasful/i.test(id)) {
      return id.includes("notify") ? "notify" : "ops";
    }

    if (contactKind === "estimate" || contactKind === "quote" || threadKind === "estimate") {
      return "estimate";
    }
    if (lifecycle === "fee_pending" || thread?._feePending || thread?.status === "fee_pending") {
      return "estimate";
    }

    const transactionListingTypes = new Set([
      "worker",
      "skill",
      "product",
      "shop_store",
      "shop",
      "job",
      "deal",
      "builder",
    ]);
    const isTransactionListing = transactionListingTypes.has(listingType);
    const isDealMarker =
      thread?._dealThread ||
      thread?._transactionThread ||
      contactKind === "deal" ||
      contactKind === "transaction" ||
      threadKind === "transaction" ||
      (/^chat_/i.test(id) &&
        isTransactionListing &&
        contactKind !== "consult" &&
        !thread?._localConsult) ||
      /^txn_|^deal_/i.test(id);

    if (
      isDealMarker ||
      (isTransactionListing && lifecycle !== "fee_pending") ||
      lifecycle === "completion_pending" ||
      lifecycle === "awaiting_payment" ||
      (lifecycle === "active" && thread?.expiresAt && !thread?._localConsult && contactKind !== "consult") ||
      ((lifecycle === "completed" || lifecycle === "cancelled" || lifecycle === "expired") &&
        isTransactionListing)
    ) {
      return "deal";
    }

    const hasListing = Boolean(
      thread?.listing?.id || thread?.listingId || thread?._localConsult || threadKind === "listing_inquiry"
    );
    if (contactKind === "consult" || thread?._localConsult || threadKind === "listing_inquiry") {
      return "consult";
    }
    if (listingType === "business" || listingType === "service") {
      return "consult";
    }
    if (hasListing && !isTransactionListing) {
      return "consult";
    }

    return hasListing ? "consult" : "deal";
  }

  function annotateThread(thread) {
    const typeKey = classifyTypeKey(thread);
    const lifecycle = getLifecycle(thread);
    return {
      ...thread,
      _chatListType: typeKey,
      _chatListLifecycle: lifecycle,
    };
  }

  function formatUnreadBadge(unreadCount) {
    if (!unreadCount || unreadCount <= 0) return "";
    if (unreadCount === 1) {
      return `<span class="chat-unread" aria-label="未読 1件">NEW</span>`;
    }
    const label = unreadCount > 99 ? "99+" : String(unreadCount);
    return `<span class="chat-unread" aria-label="未読 ${unreadCount}件">${label}</span>`;
  }

  function formatLocalUpdatedAt(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `更新 ${y}/${m}/${day} ${hh}:${mm}`;
    } catch {
      return "";
    }
  }

  function formatPreviewFromRow(row) {
    if (window.TasuChatSupabase?.formatMessagePreview) {
      return window.TasuChatSupabase.formatMessagePreview(row);
    }
    if (row?.image_url) return "📎 画像";
    return String(row?.message || "").trim();
  }

  function isUnreadRow(row, lastReadAtIso) {
    if (window.TasuChatSupabase?.isUnreadMessageRow) {
      return window.TasuChatSupabase.isUnreadMessageRow(row, lastReadAtIso);
    }
    const meId = getMeId();
    if (String(row.sender_id) === String(meId)) return false;
    const lastReadMs = lastReadAtIso ? new Date(lastReadAtIso).getTime() : 0;
    const created = new Date(row.created_at).getTime();
    return Number.isFinite(created) && created > lastReadMs;
  }

  function getSortTimestamp(thread) {
    const raw = pickStr(thread?._sortAt, thread?.updatedAt, thread?.lastReadAt, thread?.createdAt);
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  function getSearchHaystack(thread) {
    const Model = window.TasuTalkChatThreadModel;
    const row = Model?.enrichThread ? Model.enrichThread(thread) : thread;
    const partner = pickStr(
      row?._resolvedPartnerName,
      row?.partnerProfile?.display_name,
      row?.partner?.displayName,
      row?.partner?.display_name,
      row?.partnerName,
      row?.sellerName,
      row?.buyerName
    );
    const listing = pickStr(row?._resolvedListingTitle, row?.listing?.title, row?.listingTitle);
    const preview = pickStr(row?.lastMessagePreview, row?.lastMessage);
    const category = pickStr(row?._category, row?.listing?.category);
    return `${partner} ${listing} ${preview} ${category}`.toLowerCase();
  }

  function mergeShowcaseThreads(threads) {
    const showcase = window.TasuChatDisplayCatalog?.getShowcaseThreads?.() || [];
    if (!showcase.length) return threads;
    const ids = new Set((threads || []).map((t) => String(t.id)));
    const prepend = showcase.filter((t) => !ids.has(String(t.id)));
    return [...prepend, ...(threads || [])];
  }

  function matchesFilter(thread) {
    const filter = viewState.filter;
    const typeKey = thread._chatListType || classifyTypeKey(thread);
    const lifecycle = thread._chatListLifecycle || getLifecycle(thread);
    const unread = Math.max(0, Number(thread.unreadCount) || 0);

    switch (filter) {
      case "unread":
        return unread > 0;
      case "consult":
        return typeKey === "consult" || typeKey === "estimate";
      case "ongoing":
        return typeKey === "deal" && ONGOING_LIFECYCLES.has(lifecycle);
      case "completed":
        return COMPLETED_LIFECYCLES.has(lifecycle);
      case "ops":
        return typeKey === "notify" || typeKey === "ops";
      default:
        return true;
    }
  }

  function matchesSearch(thread) {
    const q = viewState.search.trim().toLowerCase();
    if (!q) return true;
    return getSearchHaystack(thread).includes(q);
  }

  function sortThreads(threads) {
    const list = threads.slice();
    const sort = viewState.sort;
    list.sort((a, b) => {
      if (sort === "unread") {
        const ua = Math.max(0, Number(a.unreadCount) || 0) > 0 ? 1 : 0;
        const ub = Math.max(0, Number(b.unreadCount) || 0) > 0 ? 1 : 0;
        if (ub !== ua) return ub - ua;
      }
      const ta = getSortTimestamp(a);
      const tb = getSortTimestamp(b);
      if (sort === "oldest") return ta - tb;
      return tb - ta;
    });
    return list;
  }

  function getVisibleThreads() {
    return sortThreads(threadsCache.filter((t) => matchesFilter(t) && matchesSearch(t)));
  }

  function renderTypeLabel(typeKey) {
    const meta = TYPE_META[typeKey] || TYPE_META.consult;
    return `<span class="chat-type ${meta.className}">${escapeHtml(meta.label)}</span>`;
  }

  function renderThreadRow(thread) {
    const Model = window.TasuTalkChatThreadModel;
    const row = Model?.enrichThread ? Model.enrichThread(thread) : thread;
    const typeKey = thread._chatListType || classifyTypeKey(row);
    const typeLabel = renderTypeLabel(typeKey);

    const lifecycle = thread._chatListLifecycle || getLifecycle(row);
    const statusDisplay = window.TasuChatRoomStatus?.getListStatusDisplay?.(lifecycle) || {
      label: lifecycle === "expired" ? "期限切れ" : lifecycle === "completed" ? "完了" : "進行中",
      pillClass:
        lifecycle === "expired"
          ? "chat-pill--expired"
          : lifecycle === "completed"
            ? "chat-pill--completed"
            : "chat-pill--active",
    };
    const unreadBadge = formatUnreadBadge(row.unreadCount);

    const profile = row.partnerProfile || (Model?.buildPartnerProfile ? Model.buildPartnerProfile(row) : null);
    const avatar = escapeHtml(
      pickStr(profile?.profile_image, row.partner?.avatarUrl, row.partner?.avatar_url, row._listingImage)
    );
    const displayName = escapeHtml(
      pickStr(
        row._resolvedPartnerName,
        profile?.display_name,
        row.partner?.displayName,
        row.partner?.display_name,
        "（相手）"
      )
    );
    const lastPreview = escapeHtml(row.lastMessagePreview || "（メッセージなし）");
    const listingTitle = pickStr(row._resolvedListingTitle, row.listing?.title, row.listingTitle);
    const title =
      row.chatDomain === "work" || listingTitle
        ? escapeHtml(listingTitle || "（掲載名未設定）")
        : displayName;
    const partnerLine =
      row.chatDomain === "work" || listingTitle
        ? `<span class="chat-thread__partner" title="相手：${displayName}">相手：${displayName}</span>`
        : "";

    const isLocal = Boolean(row._localConsult);
    const category = escapeHtml(row._category || row.listing?.category || "");
    const detailUrl = escapeHtml(row._detailUrl || row.listing?.detailUrl || "");
    const hideRemainingLabel = lifecycle === "completed" || lifecycle === "expired";
    const expires = hideRemainingLabel ? "" : escapeHtml(row.remainingLabel || "");
    const updatedLabel = isLocal ? escapeHtml(formatLocalUpdatedAt(row._sortAt || row.updatedAt)) : "";

    const detailPath =
      window.TasuChatService?.chatDetailUrl?.(row.id) ||
      (isLocal
        ? `chat-detail.html?thread=${encodeURIComponent(row.id)}`
        : `chat-detail.html?roomId=${encodeURIComponent(row.id)}`);
    const chatHref = escapeHtml(
      window.TasuChatUserIdentity?.appendUserIdToUrl?.(detailPath) || detailPath
    );

    const detailLink =
      detailUrl && isLocal
        ? `<a class="chat-thread__detail-link" href="${detailUrl}">掲載詳細を見る</a>`
        : "";

    const avatarHtml = avatar
      ? `<span class="chat-thread__avatar-wrap"><img class="chat-thread__avatar" src="${avatar}" alt="" width="48" height="48" loading="lazy" decoding="async"></span>`
      : "";

    return `
      <li class="chat-list__item${isLocal ? " chat-list__item--local-consult" : ""}" data-chat-thread-id="${escapeHtml(row.id)}" data-chat-list-type="${escapeHtml(typeKey)}" data-listing-id="${escapeHtml(row.listing?.id || "")}">
        <div class="chat-thread-row chat-thread-row--line">
          <a class="chat-thread chat-thread--line" href="${chatHref}">
            ${avatarHtml}
            <div class="chat-thread__body">
              <div class="chat-thread__top">
                <span class="chat-thread__labels">${typeLabel}</span>
                <p class="chat-thread__title" title="${title}">${title}</p>
                ${partnerLine}
                ${category ? `<span class="chat-thread__category">${category}</span>` : ""}
              </div>
              <p class="chat-thread__preview">${lastPreview}</p>
              ${updatedLabel ? `<p class="chat-thread__updated">${updatedLabel}</p>` : ""}
            </div>
            <div class="chat-thread__right">
              <div class="chat-thread__meta">
                ${unreadBadge}
                <span class="chat-pill ${statusDisplay.pillClass}">${escapeHtml(statusDisplay.label)}</span>
              </div>
              ${expires ? `<div class="chat-thread__expires">${expires}</div>` : ""}
            </div>
          </a>
          ${detailLink}
        </div>
      </li>
    `;
  }

  function updateEmptyState(visibleCount, totalCount) {
    const emptyEl = document.querySelector("[data-chat-hub-empty]");
    const listEl = document.getElementById("chatThreadList");
    const titleEl = document.querySelector("[data-chat-hub-empty-title]");
    const subEl = document.querySelector("[data-chat-hub-empty-sub]");
    if (!emptyEl || !listEl) return;

    if (visibleCount > 0) {
      emptyEl.hidden = true;
      listEl.hidden = false;
      return;
    }

    emptyEl.hidden = false;
    listEl.hidden = true;

    const hasSearch = Boolean(viewState.search.trim());
    const hasFilter = viewState.filter !== "all";

    if (hasSearch) {
      if (titleEl) titleEl.textContent = "検索結果なし";
      if (subEl) subEl.textContent = "キーワードを変えるか、フィルターを「すべて」に戻してお試しください。";
    } else if (hasFilter && totalCount > 0) {
      if (titleEl) titleEl.textContent = "該当するやりとりはありません";
      if (subEl) subEl.textContent = "別のフィルターを選ぶか、検索条件を見直してください。";
    } else {
      if (titleEl) titleEl.textContent = "該当するやりとりはありません";
      if (subEl) subEl.textContent = "掲載詳細から相談・見積りを始めると、ここに表示されます。";
    }
  }

  function renderThreads() {
    const list = document.getElementById("chatThreadList");
    if (!list) return;

    const visible = getVisibleThreads();
    updateEmptyState(visible.length, threadsCache.length);

    if (!visible.length) {
      list.innerHTML = "";
      return;
    }

    list.innerHTML = visible.map((t) => renderThreadRow(t)).join("");
  }

  function applyRealtimeInsert(row) {
    const rid = String(row.room_id);
    const idx = threadsCache.findIndex((t) => String(t.id) === rid);
    if (idx < 0) return;

    const thread = { ...threadsCache[idx] };
    thread.lastMessagePreview = formatPreviewFromRow(row);
    if (row.created_at) {
      thread._sortAt = row.created_at;
    }

    if (isUnreadRow(row, thread.lastReadAt || "")) {
      thread.unreadCount = (thread.unreadCount || 0) + 1;
    }

    threadsCache[idx] = annotateThread(thread);
    renderThreads();
  }

  function teardownListRealtime() {
    if (unsubscribeListRealtime) {
      unsubscribeListRealtime();
      unsubscribeListRealtime = null;
    }
    window.TasuChatService.unsubscribeListMessages?.();
  }

  function startListRealtime() {
    teardownListRealtime();
    if (!window.TasuChatService.isUsingSupabase?.()) return;

    unsubscribeListRealtime = window.TasuChatService.subscribeListMessages({
      onInsert: (row) => applyRealtimeInsert(row),
    });
  }

  async function hydratePreviews(threads) {
    if (window.TasuChatService.isUsingSupabase?.()) {
      return threads;
    }

    const needsPreview = threads.some((t) => !t.lastMessagePreview);
    if (!needsPreview) {
      return threads;
    }

    return Promise.all(
      threads.map(async (t) => {
        if (t.lastMessagePreview) {
          return t;
        }
        const { messages } = await window.TasuChatService.loadMessages(t.id);
        const last = messages[messages.length - 1];
        return {
          ...t,
          lastMessagePreview: last?.attachment?.dataUrl ? "📎 画像" : last?.text || "",
        };
      })
    );
  }

  function setActiveFilter(filter) {
    viewState.filter = filter;
    document.querySelectorAll("[data-chat-hub-filter]").forEach((btn) => {
      const active = btn.getAttribute("data-chat-hub-filter") === filter;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    renderThreads();
  }

  function bindToolbar() {
    const searchEl = document.querySelector("[data-chat-hub-search]");
    const sortEl = document.querySelector("[data-chat-hub-sort]");
    const filtersEl = document.querySelector("[data-chat-hub-filters]");

    searchEl?.addEventListener("input", () => {
      viewState.search = searchEl.value;
      renderThreads();
    });

    sortEl?.addEventListener("change", () => {
      viewState.sort = sortEl.value || "newest";
      renderThreads();
    });

    filtersEl?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-chat-hub-filter]");
      if (!btn) return;
      setActiveFilter(btn.getAttribute("data-chat-hub-filter") || "all");
    });
  }

  async function loadAndRenderThreads() {
    const list = document.getElementById("chatThreadList");
    const emptyEl = document.querySelector("[data-chat-hub-empty]");
    if (list) {
      list.hidden = false;
      list.innerHTML = `<li class="chat-list__item chat-list__item--loading"><p class="chat-hub-loading">読み込み中…</p></li>`;
    }
    if (emptyEl) emptyEl.hidden = true;

    const params = new URLSearchParams(window.location.search);
    const highlightThread = String(params.get("thread") || "").trim();

    await window.TasuChatService.ensureInitialized();
    let threads = await window.TasuChatService.loadThreads();
    threads = mergeShowcaseThreads(threads);
    const localRows = window.TasuChatThreadStore?.getAllForChatList?.() || [];
    if (localRows.length) {
      const localIds = new Set(localRows.map((t) => String(t.id)));
      threads = [...localRows, ...threads.filter((t) => !localIds.has(String(t.id)))];
    }
    const enriched = await hydratePreviews(threads);
    let sorted = enriched;
    if (window.TasuTalkChatThreadModel?.enrichThreads) {
      sorted = window.TasuTalkChatThreadModel.enrichThreads(enriched);
    }
    threadsCache = sorted.map((t) => annotateThread({ ...t }));
    renderThreads();
    startListRealtime();

    if (highlightThread) {
      const safeId = String(highlightThread).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const row = document.querySelector(
        `[data-chat-thread-id="${safeId}"], .chat-thread[href*="thread=${encodeURIComponent(highlightThread)}"], .chat-thread[href*="roomId=${encodeURIComponent(highlightThread)}"]`
      );
      row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  async function init() {
    bindToolbar();
    try {
      await loadAndRenderThreads();
    } catch (err) {
      console.error(err);
      const list = document.getElementById("chatThreadList");
      if (list) {
        list.innerHTML = `<li class="chat-list__item"><p class="chat-hub-loading">読み込みに失敗しました</p></li>`;
      }
    }
  }

  window.addEventListener("pagehide", teardownListRealtime);
  window.addEventListener("pageshow", (e) => {
    if (e.persisted || document.getElementById("chatThreadList")) {
      loadAndRenderThreads().catch(console.error);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
