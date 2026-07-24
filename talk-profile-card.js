/**
 * TASFUL TALK — LINE風プロフィールカード（友達 / 通常Talk）
 */
(function (global) {
  "use strict";

  /** @type {HTMLElement|null} */
  let root = null;
  /** @type {object|null} */
  let activePayload = null;
  /** @type {boolean} */
  let wired = false;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isOfficialThread(thread) {
    if (!thread) return true;
    if (thread._staticCard || thread._officialRoom) return true;
    return Boolean(global.TasuTalkOfficialRooms?.isOfficialRoomId?.(thread.id));
  }

  /**
   * @param {object|null|undefined} thread
   * @returns {boolean}
   */
  function canShowForThread(thread) {
    if (!thread || isOfficialThread(thread)) return false;
    const wf = global.TasuTalkBuilderWorkflow;
    if (wf?.isBuilderWorkflowThread?.(thread)) return false;
    if (String(thread.chatDomain || "").toLowerCase() === "builder") return false;
    if (wf?.resolveBuilderThreadKind?.(thread)) return false;
    if (thread.chatDomain === "friend") return true;
    if (thread.chatDomain === "work") return true;
    return false;
  }

  /**
   * @param {object} thread
   */
  function buildPayloadFromThread(thread) {
    const row = global.TasuTalkChatThreadModel?.enrichThread?.(thread) || thread;
    const profile = row.partnerProfile || global.TasuTalkChatProfile?.resolveProfile?.(row.partner?.id) || {};
    const displayName = pickStr(row.groupName, profile.display_name, row.partner?.displayName, "相手");
    const coverImage = pickStr(
      profile.cover_image,
      profile.coverImage,
      row.partner?.cover_image,
      row.partner?.coverImage
    );
    const profileImage = pickStr(
      profile.profile_image,
      profile.profileImage,
      row.partner?.profile_image,
      row.partner?.avatarUrl
    );
    return {
      displayName,
      profileImage,
      coverImage,
      userId: pickStr(profile.user_id, row.partnerUserId, row.partner?.id),
      threadId: pickStr(row.id, row.roomId),
      thread: row,
      profile,
    };
  }

  function ensureRoot() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "talk-profile-card";
    root.hidden = true;
    root.setAttribute("data-talk-profile-card", "");
    root.innerHTML = `
      <div class="talk-profile-card__backdrop" data-talk-profile-close tabindex="-1" aria-hidden="true"></div>
      <div class="talk-profile-card__panel" role="dialog" aria-modal="true" aria-labelledby="talkProfileCardName">
        <div class="talk-profile-card__cover" data-talk-profile-cover></div>
        <button type="button" class="talk-profile-card__favorite" data-talk-profile-favorite hidden aria-label="お気に入り" title="ピン留め">☆</button>
        <button type="button" class="talk-profile-card__close" data-talk-profile-close aria-label="閉じる">×</button>
        <div class="talk-profile-card__body">
          <div class="talk-profile-card__avatar-slot" data-talk-profile-avatar></div>
          <h2 class="talk-profile-card__name" id="talkProfileCardName" data-talk-profile-name></h2>
          <div class="talk-profile-card__actions">
            <button type="button" class="talk-profile-card__action" data-talk-profile-action="talk">
              <span class="talk-profile-card__action-icon" aria-hidden="true">💬</span>
              <span class="talk-profile-card__action-label">トーク</span>
            </button>
            <button type="button" class="talk-profile-card__action" data-talk-profile-action="call">
              <span class="talk-profile-card__action-icon" aria-hidden="true">📞</span>
              <span class="talk-profile-card__action-label">音声通話</span>
            </button>
            <button type="button" class="talk-profile-card__action" data-talk-profile-action="video">
              <span class="talk-profile-card__action-icon" aria-hidden="true">🎥</span>
              <span class="talk-profile-card__action-label">ビデオ通話</span>
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);

    root.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-talk-profile-close]")) {
        ev.preventDefault();
        closeTalkProfileCard();
        return;
      }
      const actionBtn = ev.target.closest("[data-talk-profile-action]");
      if (actionBtn) {
        ev.preventDefault();
        handleAction(actionBtn.getAttribute("data-talk-profile-action"));
        return;
      }
      const favBtn = ev.target.closest("[data-talk-profile-favorite]");
      if (favBtn) {
        ev.preventDefault();
        toggleFavorite();
      }
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && root && !root.hidden) closeTalkProfileCard();
    });

    return root;
  }

  function showToast(message) {
    if (global.TasuTalkCallUi?.showToast) {
      global.TasuTalkCallUi.showToast(message);
      return;
    }
    const alertEl = document.getElementById("chatAlert");
    if (alertEl) {
      alertEl.textContent = message;
      alertEl.style.display = "block";
      global.setTimeout(() => {
        alertEl.style.display = "none";
      }, 2800);
      return;
    }
    global.alert?.(message);
  }

  function resolveThreadFromTrigger(el) {
    const threadId = pickStr(el.getAttribute("data-talk-thread-id"), el.dataset?.talkThreadId);
    if (threadId && global.TasuChatThreadStore?.readAll) {
      const found = global.TasuChatThreadStore.readAll().find((t) => String(t.id) === threadId);
      if (found) return found;
    }
    if (global.TasuTalkLineRoom?.getActiveThread) {
      const active = global.TasuTalkLineRoom.getActiveThread();
      if (active && (!threadId || String(active.id) === threadId)) return active;
    }
    if (typeof global.currentRoom !== "undefined" && global.currentRoom) return global.currentRoom;
    return null;
  }

  function renderAvatarSlot(host, payload) {
    if (!host) return;
    const html =
      global.TasuTalkChatProfile?.renderAvatarHtml?.({
        profile: payload.profile,
        hints: payload.thread?.partner,
        displayName: payload.displayName,
        size: 114,
        className: "talk-profile-card__avatar",
        escapeHtml,
      }) ||
      `<span class="talk-profile-card__avatar talk-profile-card__avatar--initials">${escapeHtml(payload.displayName.slice(0, 1) || "?")}</span>`;
    host.innerHTML = html;
  }

  function updateFavoriteButton(btn, thread) {
    if (!btn) return;
    const Safety = global.TasuTalkRoomSafetyStore;
    if (!Safety?.resolveTargetKey) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    const key = Safety.resolveTargetKey(thread);
    const pinned = Safety.isPinned?.(key);
    btn.textContent = pinned ? "★" : "☆";
    btn.classList.toggle("is-active", Boolean(pinned));
    btn.setAttribute("aria-pressed", pinned ? "true" : "false");
    btn.title = pinned ? "ピン留め解除" : "ピン留め";
  }

  function resolveCoverImageUrl(url) {
    if (global.TasuTalkChatProfile?.resolveImageUrl) {
      return global.TasuTalkChatProfile.resolveImageUrl(url);
    }
    return pickStr(url);
  }

  /**
   * @param {object} profile
   */
  function applyCoverToElement(coverEl, coverImage) {
    if (!coverEl) return;
    const coverUrl = resolveCoverImageUrl(coverImage);
    coverEl.classList.remove("talk-profile-card__cover--gradient", "talk-profile-card__cover--photo");
    if (coverUrl) {
      const safeUrl = String(coverUrl).replace(/"/g, "%22").replace(/'/g, "%27");
      coverEl.style.backgroundImage = `url("${safeUrl}")`;
      coverEl.classList.add("talk-profile-card__cover--photo");
      coverEl.dataset.talkProfileCoverMode = "photo";
    } else {
      coverEl.style.backgroundImage = "";
      coverEl.classList.add("talk-profile-card__cover--gradient");
      coverEl.dataset.talkProfileCoverMode = "gradient";
    }
  }

  /**
   * @param {object} profile
   */
  function showTalkProfileCard(profile) {
    if (!profile) return;
    const el = ensureRoot();
    activePayload = profile;

    const coverEl = el.querySelector("[data-talk-profile-cover]");
    const nameEl = el.querySelector("[data-talk-profile-name]");
    const avatarSlot = el.querySelector("[data-talk-profile-avatar]");
    const favBtn = el.querySelector("[data-talk-profile-favorite]");

    applyCoverToElement(coverEl, profile.coverImage);
    if (nameEl) nameEl.textContent = profile.displayName || "相手";
    renderAvatarSlot(avatarSlot, profile);
    updateFavoriteButton(favBtn, profile.thread);

    el.classList.remove("is-closing");
    el.hidden = false;
    document.body.classList.add("talk-profile-card-open");
    el.querySelector(".talk-profile-card__close")?.focus?.();
  }

  const PROFILE_CARD_CLOSE_MS = 200;

  function closeTalkProfileCard() {
    if (!root || root.hidden || root.classList.contains("is-closing")) return;
    root.classList.add("is-closing");
    global.setTimeout(() => {
      if (!root) return;
      root.hidden = true;
      root.classList.remove("is-closing");
      document.body.classList.remove("talk-profile-card-open");
      activePayload = null;
    }, PROFILE_CARD_CLOSE_MS);
  }

  function toggleFavorite() {
    const Safety = global.TasuTalkRoomSafetyStore;
    const thread = activePayload?.thread;
    if (!Safety || !thread) return;
    const key = Safety.resolveTargetKey(thread);
    Safety.togglePinned?.(key);
    updateFavoriteButton(root?.querySelector("[data-talk-profile-favorite]"), thread);
  }

  function handleTalkAction() {
    const threadId = activePayload?.threadId;
    closeTalkProfileCard();
    if (!threadId) return;
    if (global.TasuTalkLineRoom?.openThreadById) {
      global.TasuTalkLineRoom.openThreadById(threadId);
      return;
    }
    if (document.body?.dataset?.page === "chat") return;
    const href = `chat-detail.html?thread=${encodeURIComponent(threadId)}&from=chat`;
    const url = global.TasuChatUserIdentity?.appendUserIdToUrl?.(href) || href;
    global.location.href = url;
  }

  function handleCallAction() {
    const thread = activePayload?.thread;
    if (!thread) return;
    const CallDetail = global.TasuTalkCallChatDetail;
    const callThread = CallDetail?.buildCallThread?.(thread);
    const svc = global.TasuTalkCallService;
    if (callThread && svc?.canCallThread?.(callThread) && svc?.initiateCall) {
      closeTalkProfileCard();
      svc.init?.();
      svc.initiateCall(callThread).catch((err) => {
        showToast(err?.message || "発信に失敗しました");
      });
      return;
    }
    showToast("音声通話は準備中です（Supabase 接続時に利用できます）");
  }

  function handleVideoAction() {
    showToast("ビデオ通話は準備中です");
  }

  function handleAction(action) {
    if (action === "talk") handleTalkAction();
    else if (action === "call") handleCallAction();
    else if (action === "video") handleVideoAction();
  }

  function onProfileTriggerClick(ev) {
    const trigger = ev.target.closest("[data-talk-profile-trigger]");
    if (!trigger) return;

    const thread = resolveThreadFromTrigger(trigger);
    if (!canShowForThread(thread)) return;

    ev.preventDefault();
    ev.stopPropagation();
    showTalkProfileCard(buildPayloadFromThread(thread));
  }

  function onProfileTriggerKeydown(ev) {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const trigger = ev.target.closest("[data-talk-profile-trigger]");
    if (!trigger) return;
    ev.preventDefault();
    trigger.click();
  }

  function wireProfileTriggers() {
    if (wired) return;
    wired = true;
    document.addEventListener("click", onProfileTriggerClick);
    document.addEventListener("keydown", onProfileTriggerKeydown);
  }

  function applyTriggerToAvatarLink(linkEl, thread) {
    if (!linkEl) return;
    const show = canShowForThread(thread);
    const threadId = pickStr(thread?.id, thread?.roomId);
    if (show) {
      linkEl.setAttribute("data-talk-profile-trigger", "");
      if (threadId) linkEl.setAttribute("data-talk-thread-id", threadId);
      linkEl.setAttribute("href", "#");
      linkEl.setAttribute("aria-label", `${pickStr(thread?.partnerProfile?.display_name, thread?.partner?.displayName, "相手")}のプロフィール`);
      linkEl.removeAttribute("data-future-feature");
    } else {
      linkEl.removeAttribute("data-talk-profile-trigger");
      linkEl.removeAttribute("data-talk-thread-id");
      if (!linkEl.getAttribute("data-future-feature")) {
        linkEl.setAttribute("data-future-feature", "profile_page");
      }
    }
  }

  global.TasuTalkProfileCard = {
    canShowForThread,
    buildPayloadFromThread,
    showTalkProfileCard,
    closeTalkProfileCard,
    wireProfileTriggers,
    applyTriggerToAvatarLink,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireProfileTriggers);
  } else {
    wireProfileTriggers();
  }
})(typeof window !== "undefined" ? window : globalThis);
