/**
 * お気に入り — ボタンごとに target_id / target_type を解決（グローバル toggleFavorite）
 */
(function () {
  "use strict";

  const FAVORITE_BUTTON_SELECTOR = "[data-favorite-button], [data-tasu-favorite]";

  const DETAIL_TYPE_TO_TARGET = {
    product: "product",
    skill: "skill",
    job: "job",
    worker: "worker",
  };

  function getEffectiveUserId(button) {
    const fromBtn = button?.dataset?.userId;
    if (fromBtn) return String(fromBtn).trim();

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("userId");
    if (fromUrl) return String(fromUrl).trim();

    const fromBody = document.body?.dataset?.userId;
    if (fromBody) return String(fromBody).trim();

    if (window.TasuChatUserIdentity?.getEffectiveUserId) {
      return window.TasuChatUserIdentity.getEffectiveUserId();
    }

    const cfg = window.TASU_CHAT_SUPABASE_CONFIG || {};
    return cfg.currentUserId || cfg.me?.id || "u_me";
  }

  function isFavoritesListPage() {
    return Boolean(
      document.querySelector("[data-favorites-list]") ||
      document.body?.dataset?.page === "favorites-list"
    );
  }

  function mapDetailTypeToTargetType(detailType) {
    return DETAIL_TYPE_TO_TARGET[String(detailType || "").toLowerCase()] || "";
  }

  function readIdFromDataset(el) {
    if (!el?.dataset) return "";
    const d = el.dataset;
    return String(
      d.targetId ||
        d.productId ||
        d.workerId ||
        d.jobId ||
        d.skillId ||
        d.listingId ||
        ""
    ).trim();
  }

  function resolveTargetIdFromButton(button) {
    let targetId = readIdFromDataset(button);

    const card = button.closest(
      "[data-favorite-item], [data-favorite-card], [data-favorite-row], article, .card"
    );
    if (!targetId && card) {
      targetId = readIdFromDataset(card);
    }

    if (!targetId && !isFavoritesListPage()) {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("id");
      if (fromUrl) targetId = String(fromUrl).trim();
    }

    if (!targetId && !isFavoritesListPage()) {
      targetId = readIdFromDataset(document.body);
    }

    return targetId;
  }

  function resolveTargetTypeFromButton(button) {
    let targetType = button.dataset?.targetType || button.getAttribute("data-target-type") || "";

    const typeHost = button.closest("[data-target-type]");
    if (!targetType && typeHost?.dataset?.targetType) {
      targetType = typeHost.dataset.targetType;
    }

    if (!targetType) {
      const detailType = document.body?.dataset?.detailType || "";
      targetType = mapDetailTypeToTargetType(detailType);
    }

    if (window.TasuFavoritesDb?.normalizeType) {
      return window.TasuFavoritesDb.normalizeType(targetType);
    }

    return String(targetType || "").trim().toLowerCase();
  }

  function resolveFavoriteButton(event, triggerEl) {
    const button =
      triggerEl ||
      (event?.currentTarget instanceof HTMLElement ? event.currentTarget : null) ||
      (event?.target instanceof HTMLElement
        ? event.target.closest(FAVORITE_BUTTON_SELECTOR)
        : null);

    if (!button) {
      return { button: null, targetId: "", targetType: "", userId: "" };
    }

    const targetId = resolveTargetIdFromButton(button);
    const targetType = resolveTargetTypeFromButton(button);
    const userId = getEffectiveUserId(button);

    console.log({
      action: "favorite click resolved",
      targetId,
      targetType,
      button,
    });

    return { button, targetId, targetType, userId };
  }

  function resolveToggleContext(triggerEl) {
    const { button, targetId, targetType, userId } = resolveFavoriteButton(null, triggerEl);
    return {
      userId,
      targetType,
      targetId,
      detailType: document.body?.dataset?.detailType || "",
      button,
    };
  }

  /** 詳細ページの掲載 target（body から解決） */
  function resolveFavoriteTarget() {
    const detailType = document.body?.dataset?.detailType || "";
    const targetType = mapDetailTypeToTargetType(detailType);
    const targetId = readIdFromDataset(document.body);
    const userId = getEffectiveUserId();
    return { userId, targetType, targetId };
  }

  function normalizeFavoriteEventDetail(detail) {
    const db = window.TasuFavoritesDb;
    const targetType = db?.normalizeType
      ? db.normalizeType(detail?.targetType || detail?.target_type || "")
      : String(detail?.targetType || detail?.target_type || "")
          .trim()
          .toLowerCase();
    const targetId = db?.normalizeId
      ? db.normalizeId(detail?.targetId || detail?.target_id || "")
      : String(detail?.targetId || detail?.target_id || "").trim();
    const userId = db?.normalizeId
      ? db.normalizeId(detail?.userId || detail?.user_id || getEffectiveUserId())
      : String(detail?.userId || detail?.user_id || getEffectiveUserId()).trim();
    return {
      targetType,
      targetId,
      userId,
      saved: Boolean(detail?.saved),
      source: String(detail?.source || ""),
    };
  }

  function pageMatchesFavoriteTarget(normalized) {
    const current = resolveFavoriteTarget();
    if (!current.targetType || !current.targetId) return false;
    return (
      current.targetType === normalized.targetType &&
      current.targetId === normalized.targetId
    );
  }

  /** favorite-changed 受信 — UI / localStorage のみ（DB・再dispatch 禁止） */
  function onFavoriteChanged(event) {
    if (isFavoritesListPage()) return;

    const normalized = normalizeFavoriteEventDetail(event?.detail || {});
    if (!normalized.targetType || !normalized.targetId) return;
    if (!pageMatchesFavoriteTarget(normalized)) return;
    if (!window.TasuFavoritesDb?.applyFavoriteUiOnly) return;

    const filter = window.TasuFavoritesDb.buildFilter(
      normalized.userId,
      normalized.targetType,
      normalized.targetId
    );

    window.TasuFavoritesDb.applyFavoriteUiOnly(filter, normalized.saved);
  }

  function onFavoriteStorageSync(event) {
    const storageKey = window.TasuFavoritesDb?.STORAGE_KEY || "tasu_favorites_v1";
    if (event.key !== storageKey) return;
    if (isFavoritesListPage()) return;
    void syncAllButtonsOnPage();
  }

  let detailFavoriteRealtimeChannel = null;

  function teardownDetailFavoriteRealtime() {
    const sb = window.TasuFavoritesDb?.getClient?.();
    const channel =
      detailFavoriteRealtimeChannel || window.__detailFavoritesRealtimeChannel;
    if (sb && channel) {
      void sb.removeChannel(channel);
    }
    detailFavoriteRealtimeChannel = null;
    window.__detailFavoritesRealtimeSubscribed = false;
    window.__detailFavoritesRealtimeChannel = null;
  }

  function subscribeDetailFavoriteRealtime() {
    if (isFavoritesListPage()) return;
    if (window.__detailFavoritesRealtimeSubscribed) return;

    const sb = window.TasuFavoritesDb?.getClient?.();
    if (!sb) return;

    const page = resolveFavoriteTarget();
    if (!page.targetType || !page.targetId) return;

    const userId = page.userId || getEffectiveUserId();
    const channelName = `favorites-detail-${userId}`;

    detailFavoriteRealtimeChannel = sb
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "favorites",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload?.new || payload?.old;
          if (!row) return;

          const rowType = window.TasuFavoritesDb.normalizeType(row.target_type);
          const rowId = window.TasuFavoritesDb.normalizeId(row.target_id);
          if (rowType !== page.targetType || rowId !== page.targetId) return;

          const filter = window.TasuFavoritesDb.buildFilter(userId, rowType, rowId);
          const eventType = payload.eventType || payload.event;

          if (eventType === "DELETE") {
            window.TasuFavoritesDb.applyFavoriteUiOnly(filter, false);
            return;
          }
          if (eventType === "INSERT") {
            window.TasuFavoritesDb.applyFavoriteUiOnly(filter, true);
            return;
          }
          void syncAllButtonsOnPage();
        }
      )
      .subscribe();

    window.__detailFavoritesRealtimeSubscribed = true;
    window.__detailFavoritesRealtimeChannel = detailFavoriteRealtimeChannel;
  }

  function isSavedOnButton(btn) {
    return btn?.dataset?.tasuFavoriteSaved === "1" || btn?.getAttribute("aria-pressed") === "true";
  }

  function buildInFlightKey(userId, targetType, targetId) {
    if (window.TasuFavoritesDb?.buildInFlightKey) {
      return window.TasuFavoritesDb.buildInFlightKey(userId, targetType, targetId);
    }
    return `${userId}:${targetType}:${targetId}`;
  }

  async function checkFavoriteStatus(ctx) {
    if (!window.TasuFavoritesDb?.isFavorite) return false;
    return window.TasuFavoritesDb.isFavorite(ctx.userId, ctx.targetType, ctx.targetId);
  }

  async function syncSingleButton(btn) {
    const ctx = resolveToggleContext(btn);
    if (!ctx.targetType || !ctx.targetId || !window.TasuFavoritesDb) {
      return;
    }
    const saved = await checkFavoriteStatus(ctx);
    const filter = window.TasuFavoritesDb.buildFilter(
      ctx.userId,
      ctx.targetType,
      ctx.targetId
    );
    window.TasuFavoritesDb.syncFavoriteButtonsUi(filter, saved, btn);
  }

  async function syncAllButtonsOnPage() {
    const buttons = document.querySelectorAll(FAVORITE_BUTTON_SELECTOR);
    await Promise.all(Array.from(buttons).map((btn) => syncSingleButton(btn)));
  }

  /**
   * @param {Event} [event]
   * @param {HTMLElement} [triggerEl]
   */
  async function toggleFavorite(event, triggerEl) {
    console.log("toggleFavorite start");

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const { button, targetId, targetType, userId } = resolveFavoriteButton(event, triggerEl);

    if (!button) {
      console.warn("[TasuDetailFavorites] toggleFavorite: button not found");
      return;
    }

    if (button.tagName === "A") {
      button.setAttribute("href", "#");
    }
    if (button.tagName === "BUTTON" && !button.type) {
      button.type = "button";
    }

    const ctx = { userId, targetType, targetId, detailType: document.body?.dataset?.detailType || "", button };

    console.log({
      userId: ctx.userId,
      targetType: ctx.targetType,
      targetId: ctx.targetId,
    });

    if (!ctx.targetType || !ctx.targetId) {
      console.warn("[TasuDetailFavorites] toggle aborted — empty target_type or target_id", ctx);
      return;
    }

    if (!window.TasuFavoritesDb) {
      console.warn("[TasuDetailFavorites] TasuFavoritesDb not loaded");
      return;
    }

    const inFlightKey = buildInFlightKey(ctx.userId, ctx.targetType, ctx.targetId);
    if (window.TasuFavoritesDb?.isFavoriteInFlight?.(ctx.userId, ctx.targetType, ctx.targetId)) {
      console.warn("[TasuDetailFavorites] toggle skipped — in flight", inFlightKey);
      return;
    }

    const wasSaved = isSavedOnButton(button);
    button.disabled = true;

    try {
      let result;
      if (wasSaved) {
        result = await window.TasuFavoritesDb.removeFavorite(
          ctx.userId,
          ctx.targetType,
          ctx.targetId
        );
      } else {
        result = await window.TasuFavoritesDb.addFavorite(
          ctx.userId,
          ctx.targetType,
          ctx.targetId
        );
      }

      if (!result?.success) {
        if (result?.reason !== "in_flight") {
          console.warn("[TasuDetailFavorites] toggle rejected:", result, ctx);
        }
        return;
      }

      console.log("[TasuDetailFavorites] toggle complete", {
        saved: Boolean(result.saved),
        targetId: ctx.targetId,
        targetType: ctx.targetType,
      });

      if (isFavoritesListPage() && typeof window.notifyFavoriteChangedFromList === "function") {
        window.notifyFavoriteChangedFromList(
          Boolean(result.saved),
          ctx.targetType,
          ctx.targetId
        );
      }
    } catch (err) {
      console.warn("[TasuDetailFavorites] toggle failed:", err, ctx);
    } finally {
      button.disabled = false;
    }
  }

  function onFavoriteButtonClick(event) {
    const btn = event.target.closest(FAVORITE_BUTTON_SELECTOR);
    if (!btn) return;

    console.log("favorite button clicked");
    event.preventDefault();
    event.stopPropagation();

    void toggleFavorite(event, btn);
  }

  function bindFavoriteButtons() {
    document.querySelectorAll(FAVORITE_BUTTON_SELECTOR).forEach((btn) => {
      if (btn.dataset.tasuFavoriteBound === "1") return;
      btn.dataset.tasuFavoriteBound = "1";
      if (btn.tagName === "BUTTON" && !btn.type) {
        btn.type = "button";
      }
      if (btn.tagName === "A") {
        const href = btn.getAttribute("href");
        if (href && href !== "#") {
          btn.dataset.tasuFavoriteHref = href;
        }
        btn.setAttribute("href", "#");
      }
    });
  }

  function initFavoritePage() {
    bindFavoriteButtons();
    if (!isFavoritesListPage()) {
      void syncAllButtonsOnPage();
      subscribeDetailFavoriteRealtime();
    }
  }

  window.toggleFavorite = toggleFavorite;

  document.addEventListener("click", onFavoriteButtonClick, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFavoritePage);
  } else {
    initFavoritePage();
  }

  const eventName = window.TasuFavoritesDb?.EVENT_NAME || "favorite-changed";
  document.addEventListener(eventName, onFavoriteChanged);
  window.addEventListener("storage", onFavoriteStorageSync);
  window.addEventListener("beforeunload", teardownDetailFavoriteRealtime);

  window.TasuDetailFavorites = {
    toggleFavorite,
    syncAllButtonsOnPage,
    resolveToggleContext,
    resolveFavoriteTarget,
    resolveFavoriteButton,
    onFavoriteChanged,
    subscribeDetailFavoriteRealtime,
    FAVORITE_BUTTON_SELECTOR,
  };
})();
