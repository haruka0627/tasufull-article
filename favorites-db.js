/**
 * お気に入り — Supabase / localStorage
 */
(function () {
  "use strict";

  const STORAGE_KEY = "tasu_favorites_v1";
  const VALID_TYPES = new Set(["skill", "product", "job", "worker"]);
  const EVENT_NAME = "favorite-changed";
  const favoriteInFlight = new Set();

  const LABEL_OFF = "お気に入り";
  const LABEL_ON = "お気に入り済み";

  function normalizeType(type) {
    const t = String(type || "").trim().toLowerCase();
    return VALID_TYPES.has(t) ? t : "";
  }

  function normalizeId(id) {
    return String(id || "").trim();
  }

  function buildFilter(userId, targetType, targetId) {
    return {
      user_id: normalizeId(userId),
      target_type: normalizeType(targetType),
      target_id: normalizeId(targetId),
    };
  }

  function buildInFlightKey(userId, targetType, targetId) {
    const filter = buildFilter(userId, targetType, targetId);
    return `${filter.user_id}:${filter.target_type}:${filter.target_id}`;
  }

  function isFavoriteInFlight(userId, targetType, targetId) {
    return favoriteInFlight.has(buildInFlightKey(userId, targetType, targetId));
  }

  async function withFavoriteInFlight(userId, targetType, targetId, work) {
    const key = buildInFlightKey(userId, targetType, targetId);
    if (favoriteInFlight.has(key)) {
      console.warn("[TasuFavorites] skipped — already in flight", key);
      return { ok: false, success: false, reason: "in_flight", filter: buildFilter(userId, targetType, targetId) };
    }
    favoriteInFlight.add(key);
    try {
      return await work();
    } finally {
      favoriteInFlight.delete(key);
    }
  }

  function isValidFilter(filter) {
    return Boolean(filter.user_id && filter.target_type && filter.target_id);
  }

  function isConfigured() {
    return window.TasuSupabase?.isConfigured?.() || false;
  }

  function getClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  function loadLocalFavorites() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocalFavorites(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("[TasuFavorites] localStorage save failed:", err);
    }
  }

  function favoriteKey(userId, targetType, targetId) {
    return `${userId}|${targetType}|${targetId}`;
  }

  function isFavoriteLocal(userId, targetType, targetId) {
    const key = favoriteKey(userId, targetType, targetId);
    return loadLocalFavorites().some(
      (row) => favoriteKey(row.user_id, row.target_type, row.target_id) === key
    );
  }

  function addFavoriteLocal(userId, targetType, targetId) {
    const list = loadLocalFavorites();
    if (isFavoriteLocal(userId, targetType, targetId)) return list;
    list.push({
      id: `local_${Date.now()}`,
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
      created_at: new Date().toISOString(),
    });
    saveLocalFavorites(list);
    return list;
  }

  function removeFavoriteLocal(userId, targetType, targetId) {
    const key = favoriteKey(userId, targetType, targetId);
    const list = loadLocalFavorites().filter(
      (row) => favoriteKey(row.user_id, row.target_type, row.target_id) !== key
    );
    saveLocalFavorites(list);
    return list;
  }

  function dispatchFavoriteChanged(payload) {
    if (window.__favoriteDispatching) {
      return;
    }
    const detail = {
      ...payload,
      user_id: normalizeId(payload?.user_id || payload?.userId),
      target_type: normalizeType(payload?.target_type || payload?.targetType),
      target_id: normalizeId(payload?.target_id || payload?.targetId),
      saved: Boolean(payload?.saved),
      userId: normalizeId(payload?.user_id || payload?.userId),
      targetType: normalizeType(payload?.target_type || payload?.targetType),
      targetId: normalizeId(payload?.target_id || payload?.targetId),
    };
    window.__favoriteDispatching = true;
    try {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
    } catch (err) {
      console.warn("[TasuFavorites] dispatch event failed:", err, detail);
    } finally {
      window.__favoriteDispatching = false;
    }
  }

  function rememberButtonLayout(btn) {
    if (btn.dataset.tasuFavoriteLayout === "1") return;
    btn.dataset.tasuFavoriteLayout = "1";
    btn.dataset.tasuFavoriteHadSvg = btn.querySelector("svg") ? "1" : "0";
    btn.dataset.tasuFavoriteHadLabel = (btn.textContent || "").includes("お気に入り") ? "1" : "0";
  }

  function renderFavoriteButton(btn, saved) {
    rememberButtonLayout(btn);

    const icon = saved ? "♥" : "♡";
    const label = saved ? LABEL_ON : LABEL_OFF;

    btn.classList.remove("tasu-favorite-btn--saved", "saved", "is-saved", "is-active", "active");
    btn.classList.add("tasu-favorite-btn");
    if (saved) {
      btn.classList.add("tasu-favorite-btn--saved", "saved", "is-saved", "is-active", "active");
    }

    btn.dataset.tasuFavoriteSaved = saved ? "1" : "0";
    btn.setAttribute("aria-pressed", saved ? "true" : "false");
    btn.setAttribute("aria-label", `${icon} ${label}`);

    btn.innerHTML = "";

    const iconOnly =
      btn.dataset.favoriteIconOnly === "1" ||
      btn.hasAttribute("data-tasu-mdetail-hero-favorite") ||
      btn.classList.contains("job-favorite-btn") ||
      Boolean(btn.closest(".job-actions"));

    const iconSpan = document.createElement("span");
    iconSpan.className = "tasu-favorite-btn__icon";
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.textContent = icon;
    btn.appendChild(iconSpan);

    if (iconOnly) return;

    const labelSpan = document.createElement("span");
    labelSpan.className = "tasu-favorite-btn__label";
    labelSpan.textContent = label;
    btn.appendChild(labelSpan);
  }

  const FAVORITE_BUTTON_SELECTOR = "[data-favorite-button], [data-tasu-favorite]";

  function readButtonTargetId(btn) {
    const d = btn?.dataset || {};
    return normalizeId(
      d.targetId || d.productId || d.workerId || d.jobId || d.skillId || d.listingId || ""
    );
  }

  function buttonMatchesFilter(btn, filter) {
    const btnType = normalizeType(
      btn.getAttribute("data-target-type") || btn.dataset?.targetType || ""
    );
    const btnId = readButtonTargetId(btn);
    if (!btnType && !btnId) return false;
    return btnType === filter.target_type && btnId === filter.target_id;
  }

  function syncFavoriteButtonsUi(filter, saved, triggerEl) {
    const buttons = document.querySelectorAll(FAVORITE_BUTTON_SELECTOR);
    buttons.forEach((btn) => {
      if (!buttonMatchesFilter(btn, filter)) return;
      renderFavoriteButton(btn, saved);
    });

    if (triggerEl instanceof HTMLElement) {
      renderFavoriteButton(triggerEl, saved);
    }
  }

  /** UI + localStorage のみ（イベント発火なし） */
  function applyFavoriteUiOnly(filter, saved, triggerEl) {
    if (!isValidFilter(filter)) {
      console.warn("[TasuFavorites] applyFavoriteUiOnly skipped — invalid filter", filter);
      return;
    }

    if (saved) {
      addFavoriteLocal(filter.user_id, filter.target_type, filter.target_id);
    } else {
      removeFavoriteLocal(filter.user_id, filter.target_type, filter.target_id);
    }

    syncFavoriteButtonsUi(filter, saved, triggerEl);

    if (!saved) {
      removeFavoriteListItems(filter.user_id, filter.target_type, filter.target_id);
    }

    console.log("[TasuFavorites] UI synced", { saved, filter });
  }

  /** DB成功直後: UI更新 → イベント1回のみ */
  function commitFavoriteDbSuccess(filter, saved, triggerEl) {
    applyFavoriteUiOnly(filter, saved, triggerEl);
    dispatchFavoriteChanged({ ...filter, saved });
  }

  /** @deprecated イベント再帰防止のため commitFavoriteDbSuccess を使用 */
  function applyFavoriteUiAfterDbSuccess(filter, saved, triggerEl) {
    applyFavoriteUiOnly(filter, saved, triggerEl);
  }

  /** イベント受信側: DOM のみ（DB / localStorage / dispatch 禁止） */
  function syncFavoriteUiFromEvent(detail) {
    if (!detail) return;

    const filter = {
      user_id: normalizeId(detail.user_id),
      target_type: normalizeType(detail.target_type),
      target_id: normalizeId(detail.target_id),
    };
    if (!isValidFilter(filter)) return;

    const saved = Boolean(detail.saved);
    syncFavoriteButtonsUi(filter, saved);
    if (!saved) {
      removeFavoriteListItems(filter.user_id, filter.target_type, filter.target_id);
    }
  }

  function matchesFavoriteItem(el, filter) {
    const uid = el.getAttribute("data-user-id") || el.dataset?.userId || "";
    const type = el.getAttribute("data-target-type") || el.dataset?.targetType || "";
    const tid = el.getAttribute("data-target-id") || el.dataset?.targetId || "";
    return (
      normalizeId(uid) === filter.user_id &&
      normalizeType(type) === filter.target_type &&
      normalizeId(tid) === filter.target_id
    );
  }

  function removeFavoriteListItems(userId, targetType, targetId) {
    const filter = buildFilter(userId, targetType, targetId);
    if (!isValidFilter(filter)) return 0;

    let removed = 0;
    document.querySelectorAll("[data-favorite-item]").forEach((el) => {
      if (!matchesFavoriteItem(el, filter)) return;
      const row =
        el.closest("[data-favorite-row]") ||
        el.closest(".card") ||
        el.closest("article") ||
        el.closest("li") ||
        el;
      row.remove();
      removed += 1;
    });

    const listRoot = document.querySelector("[data-favorites-list]");
    if (listRoot && !listRoot.querySelector("[data-favorite-item]")) {
      const empty = document.querySelector("[data-favorites-empty]");
      if (empty) empty.hidden = false;
    }

    return removed;
  }

  async function isFavorite(userId, targetType, targetId) {
    const filter = buildFilter(userId, targetType, targetId);
    if (!isValidFilter(filter)) return false;

    const sb = getClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("favorites")
          .select("id")
          .eq("user_id", filter.user_id)
          .eq("target_type", filter.target_type)
          .eq("target_id", filter.target_id)
          .maybeSingle();
        if (error) {
          console.warn("[TasuFavorites] isFavorite query failed:", error, filter);
          return isFavoriteLocal(filter.user_id, filter.target_type, filter.target_id);
        }
        return Boolean(data?.id);
      } catch (err) {
        console.warn("[TasuFavorites] isFavorite failed:", err, filter);
        return isFavoriteLocal(filter.user_id, filter.target_type, filter.target_id);
      }
    }

    return isFavoriteLocal(filter.user_id, filter.target_type, filter.target_id);
  }

  function hasReturnedRows(data) {
    if (data == null) return false;
    if (Array.isArray(data)) return data.length > 0;
    return typeof data === "object" && Object.keys(data).length > 0;
  }

  function failResult(filter, saved, error, reason) {
    return {
      ok: false,
      success: false,
      saved,
      filter,
      error: error || null,
      reason: reason || error?.message || "unknown error",
    };
  }

  function okResult(filter, saved, data, extra) {
    return {
      ok: true,
      success: true,
      saved,
      filter,
      data: data ?? null,
      ...extra,
    };
  }

  async function addFavorite(userId, targetType, targetId) {
    console.log("addFavorite called");

    const filter = buildFilter(userId, targetType, targetId);
    if (!isValidFilter(filter)) {
      console.warn("[TasuFavorites] addFavorite: invalid parameters — upsert skipped", {
        user_id: filter.user_id,
        target_type: filter.target_type,
        target_id: filter.target_id,
      });
      return failResult(filter, true, null, "invalid parameters");
    }

    return withFavoriteInFlight(filter.user_id, filter.target_type, filter.target_id, async () => {
      const payload = {
        user_id: filter.user_id,
        target_type: filter.target_type,
        target_id: filter.target_id,
      };

      const sb = getClient();
      if (!sb) {
        console.warn("[TasuFavorites] addFavorite: Supabase not configured — local fallback only");
        const fallbackResult = okResult(filter, true, [{ id: "local_fallback" }], { fallback: true });
        commitFavoriteDbSuccess(filter, true);
        return fallbackResult;
      }

      try {
        console.log("before insert", payload);
        const { data, error } = await sb
          .from("favorites")
          .upsert(payload, { onConflict: "user_id,target_type,target_id" })
          .select();

        console.log({
          action: "addFavorite result",
          data,
          error,
        });

        if (error) {
          console.error("addFavorite failed", error);
          return failResult(filter, true, error, error.message || "upsert failed");
        }

        if (!hasReturnedRows(data)) {
          const emptyError = {
            message: "upsert returned no rows (check RLS INSERT/SELECT policies)",
          };
          console.error("addFavorite failed", emptyError, { data, payload });
          return failResult(filter, true, emptyError, emptyError.message);
        }

        const result = okResult(filter, true, data);
        commitFavoriteDbSuccess(filter, true);
        return result;
      } catch (err) {
        console.error("addFavorite failed", err);
        return failResult(filter, true, err, String(err));
      }
    });
  }

  async function removeFavorite(userId, targetType, targetId) {
    console.log("removeFavorite called");

    const filter = buildFilter(userId, targetType, targetId);
    if (!isValidFilter(filter)) {
      console.warn("[TasuFavorites] removeFavorite: invalid parameters", filter);
      return failResult(filter, false, null, "invalid parameters");
    }

    return withFavoriteInFlight(filter.user_id, filter.target_type, filter.target_id, async () => {
      const sb = getClient();
      if (!sb) {
        console.warn("[TasuFavorites] removeFavorite: Supabase not configured — local fallback only");
        const fallbackResult = okResult(filter, false, [], { fallback: true, deletedCount: 0 });
        commitFavoriteDbSuccess(filter, false);
        return fallbackResult;
      }

      try {
        console.log("before delete", filter);
        const { data, error } = await sb
          .from("favorites")
          .delete()
          .eq("user_id", filter.user_id)
          .eq("target_type", filter.target_type)
          .eq("target_id", filter.target_id)
          .select();

        console.log({
          action: "removeFavorite result",
          data,
          error,
        });

        if (error) {
          console.error("removeFavorite failed", error);
          return failResult(filter, false, error, error.message || "delete failed");
        }

        const deletedCount = Array.isArray(data) ? data.length : 0;
        const result = okResult(filter, false, data, { deletedCount });
        commitFavoriteDbSuccess(filter, false);
        return result;
      } catch (err) {
        console.error("removeFavorite failed", err);
        return failResult(filter, false, err, String(err));
      }
    });
  }

  async function loadFavoritesByUserId(userId) {
    const uid = normalizeId(userId);
    if (!uid) return { data: [], error: null };

    const sb = getClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("favorites")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false });
        if (error) {
          console.warn("[TasuFavorites] loadFavoritesByUserId failed:", error, { user_id: uid });
          return { data: [], error };
        }
        return { data: data || [], error: null };
      } catch (err) {
        console.warn("[TasuFavorites] loadFavoritesByUserId error:", err, { user_id: uid });
        return { data: [], error: err };
      }
    }

    return {
      data: loadLocalFavorites().filter((row) => row.user_id === uid),
      error: null,
      fallback: true,
    };
  }

  window.TasuFavoritesDb = {
    isConfigured,
    getClient,
    isFavorite,
    addFavorite,
    removeFavorite,
    loadFavoritesByUserId,
    isFavoriteInFlight,
    buildInFlightKey,
    removeFavoriteListItems,
    dispatchFavoriteChanged,
    commitFavoriteDbSuccess,
    applyFavoriteUiOnly,
    applyFavoriteUiAfterDbSuccess,
    syncFavoriteUiFromEvent,
    syncFavoriteButtonsUi,
    renderFavoriteButton,
    normalizeType,
    normalizeId,
    buildFilter,
    EVENT_NAME,
    STORAGE_KEY,
    FAVORITE_BUTTON_SELECTOR,
  };
})();
