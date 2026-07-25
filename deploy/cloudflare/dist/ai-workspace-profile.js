/**
 * TASFUL AI Workspace — プロフィール編集モーダル
 */
(function (global) {
  "use strict";

  /** @type {{ displayName: string, username: string, avatarUrl: string | null } | null} */
  let openSnapshot = null;
  /** @type {string | null} */
  let draftAvatarObjectUrl = null;

  function $(sel, root) {
    return (root || global.document).querySelector(sel);
  }

  function readProfileState() {
    const auth = global.TasuAuthCurrentUser?.getCurrentUser?.();
    const profile = global.TasuMemberProfile?.getStoredProfile?.() || {};
    const displayName =
      String(auth?.displayName || auth?.nickname || profile.nickname || profile.display_name || "")
        .trim() ||
      (auth?.email ? String(auth.email).split("@")[0] : "") ||
      "ゲスト";

    let username =
      String(profile.username || profile.handle || auth?.talkUserId || "")
        .trim()
        .replace(/^@/, "");
    if (!username && auth?.email) {
      username = String(auth.email).split("@")[0] || "";
    }
    if (!username) username = "guest";

    const avatarUrl =
      global.TasuMemberProfile?.getStoredAvatarUrl?.() ||
      global.TasuMemberProfile?.resolveDisplayUrl?.(profile.avatar_url || profile.avatarUrl) ||
      null;

    return { displayName, username, avatarUrl: avatarUrl || null };
  }

  function revokeDraftAvatarUrl() {
    if (draftAvatarObjectUrl) {
      try {
        URL.revokeObjectURL(draftAvatarObjectUrl);
      } catch {
        /* ignore */
      }
      draftAvatarObjectUrl = null;
    }
  }

  function renderAvatarPreview(state) {
    const img = $("[data-ai-profile-avatar-img]");
    const initial = $("[data-ai-profile-avatar-initial]");
    const sidebarAvatar = $("[data-ai-workspace-user-avatar]");
    const url = state.avatarUrl;

    if (img && initial) {
      if (url) {
        img.src = url;
        img.hidden = false;
        initial.hidden = true;
      } else {
        img.removeAttribute("src");
        img.hidden = true;
        initial.hidden = false;
        initial.textContent = String(state.displayName || "G").slice(0, 1).toUpperCase();
      }
    }

    if (sidebarAvatar) {
      if (url && sidebarAvatar.tagName === "IMG") {
        sidebarAvatar.src = url;
      } else if (!url) {
        sidebarAvatar.textContent = String(state.displayName || "G").slice(0, 1).toUpperCase();
      } else if (sidebarAvatar.tagName !== "IMG") {
        sidebarAvatar.textContent = String(state.displayName || "G").slice(0, 1).toUpperCase();
      }
    }
  }

  function fillForm(state) {
    const displayInput = $("[data-ai-profile-display-name]");
    const usernameInput = $("[data-ai-profile-username]");
    if (displayInput) displayInput.value = state.displayName;
    if (usernameInput) usernameInput.value = state.username;
    renderAvatarPreview(state);
  }

  function readFormState() {
    return {
      displayName: $("[data-ai-profile-display-name]")?.value?.trim() || "ゲスト",
      username: $("[data-ai-profile-username]")?.value?.trim().replace(/^@/, "") || "guest",
      avatarUrl: $("[data-ai-profile-avatar-img]")?.hidden
        ? null
        : $("[data-ai-profile-avatar-img]")?.getAttribute("src") || null,
    };
  }

  function applyProfileToWorkspace(state) {
    const nameEl = $("[data-ai-workspace-user-name]");
    const avatarEl = $("[data-ai-workspace-user-avatar]");
    if (nameEl) nameEl.textContent = state.displayName || "ゲスト";
    if (avatarEl) {
      if (state.avatarUrl) {
        if (avatarEl.tagName === "IMG") {
          avatarEl.src = state.avatarUrl;
        } else {
          avatarEl.textContent = state.displayName.slice(0, 1).toUpperCase();
        }
      } else {
        avatarEl.textContent = String(state.displayName || "G").slice(0, 1).toUpperCase();
      }
    }
    global.TasuAiWorkspaceUserMenu?.syncUserMenuHeader?.();
  }

  function openProfileModal() {
    const backdrop = $("[data-ai-workspace-profile-backdrop]");
    if (!backdrop) return;

    revokeDraftAvatarUrl();
    openSnapshot = readProfileState();
    fillForm(openSnapshot);

    backdrop.hidden = false;
    global.document.body.classList.add("ai-workspace-profile-open");
    global.TasuAiWorkspaceUserMenu?.closeUserMenu?.();
    global.TasuAiWorkspaceSettings?.closeSettings?.();
    global.TasuAiWorkspacePlanUpgrade?.closePlanUpgrade?.();
    global.TasuTgaShell?.closeSidebar?.();

    $("[data-ai-profile-display-name]")?.focus();
  }

  function closeProfileModal({ revert } = { revert: false }) {
    const backdrop = $("[data-ai-workspace-profile-backdrop]");
    if (!backdrop) return;

    if (revert && openSnapshot) {
      fillForm(openSnapshot);
      applyProfileToWorkspace(openSnapshot);
    }

    revokeDraftAvatarUrl();
    backdrop.hidden = true;
    global.document.body.classList.remove("ai-workspace-profile-open");
  }

  function handleSave(ev) {
    ev.preventDefault();
    const next = readFormState();
    applyProfileToWorkspace(next);
    openSnapshot = { ...next };
    closeProfileModal();
  }

  function handleAvatarChange(file) {
    if (!file) return;
    revokeDraftAvatarUrl();
    draftAvatarObjectUrl = URL.createObjectURL(file);
    const state = readFormState();
    state.avatarUrl = draftAvatarObjectUrl;
    renderAvatarPreview(state);
  }

  function bindProfileModal() {
    const backdrop = $("[data-ai-workspace-profile-backdrop]");
    const form = $("[data-ai-profile-form]");
    if (!backdrop || !form) return;

    form.addEventListener("submit", handleSave);

    global.document.querySelectorAll("[data-ai-workspace-profile-close], [data-ai-workspace-profile-cancel]").forEach(
      (btn) => {
        btn.addEventListener("click", () => closeProfileModal({ revert: true }));
      },
    );

    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop) closeProfileModal({ revert: true });
    });

    $("[data-ai-profile-avatar-change]")?.addEventListener("click", () => {
      $("[data-ai-profile-avatar-input]")?.click();
    });

    $("[data-ai-profile-avatar-input]")?.addEventListener("change", (ev) => {
      const file = ev.target.files?.[0];
      if (file) handleAvatarChange(file);
      ev.target.value = "";
    });

    global.document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !backdrop.hidden) closeProfileModal({ revert: true });
    });
  }

  function init() {
    bindProfileModal();
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuAiWorkspaceProfile = {
    openProfileModal,
    closeProfileModal,
    readProfileState,
  };
})(typeof window !== "undefined" ? window : globalThis);
