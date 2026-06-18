/**
 * 会員プロフィール設定（profile-settings.html）
 */
(function () {
  "use strict";

  const SESSION_KEY = "tasu_member_session";

  const page = document.body?.dataset?.page;
  if (page !== "profile-settings" && page !== "profile-edit") return;

  const form = document.querySelector("[data-profile-form]");
  const nicknameInput = document.querySelector("[data-profile-nickname]");
  const emailInput = document.querySelector("[data-profile-email]");
  const submitBtn = document.querySelector("[data-profile-submit]");
  const toastEl = document.querySelector("[data-profile-toast]");
  const errorEl = document.querySelector("[data-profile-error]");

  const avatarPreview = document.querySelector("[data-profile-avatar-preview]");
  const avatarInput = document.querySelector("[data-profile-avatar-input]");
  const avatarUploadBtn = document.querySelector("[data-profile-avatar-upload]");
  const avatarChangeBtn = document.querySelector("[data-profile-avatar-change]");
  const avatarErrorEl = document.querySelector("[data-profile-avatar-error]");

  function showToast(message, tone) {
    if (!toastEl) return;
    toastEl.hidden = false;
    toastEl.dataset.tone = tone || "info";
    toastEl.textContent = message;
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 4200);
  }

  function readLocalSession() {
    return window.TasuMemberProfile?.readSession?.() || null;
  }

  function writeLocalSession(patch) {
    if (window.TasuMemberProfile?.writeSession) {
      window.TasuMemberProfile.writeSession(patch);
      return;
    }
    const current = readLocalSession() || {};
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...patch }));
  }

  function getCurrentAvatarUrl() {
    return (
      window.TasuMemberProfile?.getStoredAvatarUrl?.() ||
      String(readLocalSession()?.avatar_url || readLocalSession()?.avatarUrl || "").trim()
    );
  }

  function updateAvatarButtons(hasCustom) {
    if (avatarUploadBtn) avatarUploadBtn.hidden = Boolean(hasCustom);
    if (avatarChangeBtn) avatarChangeBtn.hidden = !hasCustom;
  }

  function setAvatarPreview(url, displayName) {
    const src = window.TasuMemberProfile?.resolveDisplayUrl?.(url) || url;
    if (avatarPreview) {
      avatarPreview.src = src;
      avatarPreview.alt = displayName ? `${displayName}のプロフィール画像` : "プロフィール画像";
    }
    window.TasuMemberProfile?.applyAvatarToDom?.(url, displayName);
    updateAvatarButtons(Boolean(String(url || "").trim()));
  }

  function clearAvatarError() {
    if (!avatarErrorEl) return;
    avatarErrorEl.hidden = true;
    avatarErrorEl.textContent = "";
  }

  function showAvatarError(message) {
    if (!avatarErrorEl) return;
    avatarErrorEl.hidden = false;
    avatarErrorEl.textContent = message;
  }

  function openAvatarPicker() {
    avatarInput?.click();
  }

  async function loadProfile() {
    const ctx = await window.TasuDashboardData?.resolveAuthContext?.();
    const profile = ctx?.profile || {};
    const authUser = await fetchAuthUser();

    if (nicknameInput) {
      nicknameInput.value =
        profile.nickname || profile.display_name || profile.displayName || "";
    }
    if (emailInput) {
      emailInput.value = authUser?.email || readLocalSession()?.email || "";
    }

    const avatarUrl = String(profile.avatarUrl || getCurrentAvatarUrl() || "").trim();
    const displayName =
      profile.displayName || profile.nickname || profile.display_name || "会員";
    setAvatarPreview(avatarUrl, displayName);

    if (ctx?.userId) {
      writeLocalSession({
        id: ctx.userId,
        nickname: profile.nickname || readLocalSession()?.nickname || "",
        display_name: profile.display_name || profile.displayName || "",
        avatar_url: avatarUrl,
      });
    }
  }

  async function fetchAuthUser() {
    const client = window.TasuSupabase?.getClient?.();
    if (!client?.auth) return null;
    try {
      const { data: sessionData } = await client.auth.getSession();
      if (sessionData?.session?.user) return sessionData.session.user;
      const { data } = await client.auth.getUser();
      return data?.user || null;
    } catch {
      return null;
    }
  }

  async function handleAvatarFile(file) {
    clearAvatarError();
    if (!file) return;

    if (!window.TasuMemberProfile?.isAllowedImageFile?.(file)) {
      showAvatarError("JPG / JPEG / PNG / WebP 形式の画像を選択してください（5MB以下）。");
      return;
    }

    avatarUploadBtn && (avatarUploadBtn.disabled = true);
    avatarChangeBtn && (avatarChangeBtn.disabled = true);

    try {
      const ctx = await window.TasuDashboardData?.resolveAuthContext?.();
      const avatar_url = await window.TasuMemberProfile.saveAvatarFile(file, {
        userId: ctx?.userId || "",
      });
      const displayName = String(nicknameInput?.value || "").trim() || "会員";
      setAvatarPreview(avatar_url, displayName);
      window.TasuMemberAuth?.saveLastProfile?.(
        window.TasuMemberAuth.collectProfileSnapshot?.() || {
          nickname: displayName,
          avatarUrl: avatar_url,
        }
      );
      showToast("プロフィール画像を保存しました。", "success");
    } catch (err) {
      console.error("[ProfileSettings] avatar save failed:", err);
      showAvatarError(
        err?.message || "画像の保存に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      avatarUploadBtn && (avatarUploadBtn.disabled = false);
      avatarChangeBtn && (avatarChangeBtn.disabled = false);
      if (avatarInput) avatarInput.value = "";
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }

    const nickname = String(nicknameInput?.value || "").trim();
    if (!nickname) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = "ニックネームを入力してください。";
      }
      nicknameInput?.focus();
      return;
    }

    submitBtn && (submitBtn.disabled = true);

    try {
      const ctx = await window.TasuDashboardData?.resolveAuthContext?.();
      const userId = ctx?.userId || "";
      const client = window.TasuSupabase?.getClient?.();
      const avatar_url = getCurrentAvatarUrl();

      if (ctx?.hasSupabaseAuth && client?.auth) {
        const { error: metaError } = await client.auth.updateUser({
          data: { nickname, display_name: nickname, avatar_url: avatar_url || undefined },
        });
        if (metaError) throw metaError;

        if (userId && client.from) {
          const row = {
            user_id: userId,
            display_name: nickname,
            updated_at: new Date().toISOString(),
          };
          if (avatar_url) row.avatar_url = avatar_url;

          const { error: profileError } = await client.from("profiles").upsert(row, {
            onConflict: "user_id",
          });
          if (profileError) {
            console.warn("[ProfileSettings] profiles upsert failed:", profileError);
          }
        }
      }

      writeLocalSession({
        id: userId || readLocalSession()?.id || "",
        nickname,
        display_name: nickname,
        avatar_url,
      });

      window.TasuMemberProfile?.syncChatConfigMe?.();
      setAvatarPreview(avatar_url, nickname);
      window.TasuMemberAuth?.saveLastProfile?.(
        window.TasuMemberAuth.collectProfileSnapshot?.() || {
          id: userId,
          nickname,
          display_name: nickname,
          avatarUrl: avatar_url,
        }
      );
      showToast("プロフィールを保存しました。", "success");
    } catch (err) {
      console.error("[ProfileSettings] save failed:", err);
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = "保存に失敗しました。時間をおいて再度お試しください。";
      }
    } finally {
      submitBtn && (submitBtn.disabled = false);
    }
  }

  avatarUploadBtn?.addEventListener("click", openAvatarPicker);
  avatarChangeBtn?.addEventListener("click", openAvatarPicker);
  avatarInput?.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    void handleAvatarFile(file);
  });

  document.addEventListener("tasu-member-profile-updated", (event) => {
    const url = event?.detail?.avatar_url || getCurrentAvatarUrl();
    const name = String(nicknameInput?.value || "").trim() || "会員";
    if (avatarPreview && url) setAvatarPreview(url, name);
  });

  form?.addEventListener("submit", (event) => void saveProfile(event));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void loadProfile());
  } else {
    void loadProfile();
  }
})();
