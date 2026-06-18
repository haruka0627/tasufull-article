/**
 * 会員プロフィール（avatar_url）— 会員ページ・チャット・掲載表示で共通利用
 */
(function () {
  "use strict";

  const SESSION_KEY = "tasu_member_session";
  const DEFAULT_AVATAR = "https://placehold.co/64x64/f3ead4/967622?text=ME";
  const STORAGE_BUCKET = "listing-images";
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const MAX_BYTES = 5 * 1024 * 1024;
  const TARGET_PX = 512;
  const MAX_DATA_URL_CHARS = 900000;
  const JPEG_QUALITY = 0.88;

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeSession(patch) {
    const current = readSession() || {};
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...patch }));
  }

  function pickAvatarFromSession(session) {
    if (!session) return "";
    return String(session.avatar_url || session.avatarUrl || "").trim();
  }

  function getSessionUserId() {
    return String(readSession()?.id || "").trim();
  }

  function getAvatarUrlForUser(userId) {
    const uid = String(userId || "").trim();
    if (!uid) return "";
    const session = readSession();
    if (String(session?.id || "").trim() !== uid) return "";
    return pickAvatarFromSession(session);
  }

  function getStoredAvatarUrl() {
    return getAvatarUrlForUser(getSessionUserId());
  }

  function resolveDisplayUrl(url) {
    const u = String(url || "").trim();
    return u || DEFAULT_AVATAR;
  }

  function applyAvatarToDom(url, alt) {
    const src = resolveDisplayUrl(url);
    const label = String(alt || "会員").trim() || "会員";
    document.querySelectorAll(
      "[data-dash-avatar], [data-member-avatar], [data-profile-avatar-preview]"
    ).forEach((el) => {
      if (el.tagName === "IMG") {
        el.src = src;
        el.alt = label;
      }
    });
  }

  function syncChatConfigMe() {
    const session = readSession();
    const avatarUrl = pickAvatarFromSession(session);
    if (!avatarUrl) return;

    const cfg = window.TASU_CHAT_SUPABASE_CONFIG || {};
    const meId = String(cfg.me?.id || cfg.currentUserId || session?.id || "").trim();
    const sessionId = String(session?.id || "").trim();

    if (!window.TASU_CHAT_SUPABASE_CONFIG) {
      window.TASU_CHAT_SUPABASE_CONFIG = {};
    }
    if (sessionId && meId && sessionId !== meId) return;

    const me = { ...(cfg.me || {}), avatarUrl };
    if (sessionId) me.id = sessionId;
    window.TASU_CHAT_SUPABASE_CONFIG.me = me;
    if (sessionId) window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = sessionId;
    window.TasuChatUserIdentity?.applyToConfig?.();
    if (window.TASU_CHAT_SUPABASE_CONFIG.me) {
      window.TASU_CHAT_SUPABASE_CONFIG.me.avatarUrl = avatarUrl;
    }
  }

  function dispatchUpdated(detail) {
    document.dispatchEvent(
      new CustomEvent("tasu-member-profile-updated", { detail: detail || {} })
    );
  }

  function setAvatarUrl(url, options) {
    const avatar_url = String(url || "").trim();
    if (!avatar_url) return false;

    const session = readSession() || {};
    writeSession({
      id: session.id || "",
      avatar_url,
      avatarUrl: avatar_url,
    });

    syncChatConfigMe();
    applyAvatarToDom(avatar_url, options?.displayName);
    dispatchUpdated({ avatar_url });
    window.TasuMemberAuth?.saveLastProfile?.(
      window.TasuMemberAuth.collectProfileSnapshot?.() || { avatarUrl: avatar_url }
    );
    return true;
  }

  function isAllowedImageFile(file) {
    if (!file) return false;
    if (file.size > MAX_BYTES) return false;
    const type = String(file.type || "").toLowerCase();
    if (ALLOWED_TYPES.has(type)) return true;
    return /\.(jpe?g|png|webp)$/i.test(String(file.name || ""));
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました。"));
      reader.readAsDataURL(file);
    });
  }

  function compressImageFile(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        const maxSide = Math.max(width, height);
        if (maxSide > TARGET_PX) {
          const scale = TARGET_PX / maxSide;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("画像の処理に失敗しました。"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("画像の圧縮に失敗しました。"));
              return;
            }
            const ext = outType === "image/png" ? ".png" : ".jpg";
            resolve(
              new File([blob], String(file.name || "avatar").replace(/\.\w+$/, "") + ext, {
                type: outType,
              })
            );
          },
          outType,
          JPEG_QUALITY
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("画像の読み込みに失敗しました。"));
      };

      img.src = objectUrl;
    });
  }

  async function uploadToStorage(file, userId) {
    const client = window.TasuSupabase?.getClient?.();
    if (!client?.storage) return "";

    const safeId = String(userId || "anon").replace(/[^\w\-]+/g, "_");
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `avatars/${safeId}/profile-${Date.now()}.${ext}`;

    const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

    if (error) {
      console.warn("[TasuMemberProfile] storage upload failed:", error);
      return "";
    }

    const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return String(data?.publicUrl || "").trim();
  }

  async function fileToAvatarUrl(file, userId) {
    const prepared = await compressImageFile(file);
    const remote = await uploadToStorage(prepared, userId);
    if (remote) return remote;

    const dataUrl = await readFileAsDataUrl(prepared);
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error("画像サイズが大きすぎます。別の画像をお試しください。");
    }
    return dataUrl;
  }

  async function persistAvatarUrl(avatar_url, userId) {
    const url = String(avatar_url || "").trim();
    if (!url) return;

    setAvatarUrl(url);

    const client = window.TasuSupabase?.getClient?.();
    const uid = String(userId || getSessionUserId() || "").trim();
    if (!uid || !client?.from) return;

    const { error } = await client.from("profiles").upsert(
      {
        user_id: uid,
        avatar_url: url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) console.warn("[TasuMemberProfile] profiles avatar upsert failed:", error);

    if (client.auth) {
      const { error: metaError } = await client.auth.updateUser({
        data: { avatar_url: url },
      });
      if (metaError) console.warn("[TasuMemberProfile] auth metadata avatar failed:", metaError);
    }
  }

  async function saveAvatarFile(file, options) {
    if (!isAllowedImageFile(file)) {
      throw new Error("JPG / JPEG / PNG / WebP 形式の画像を選択してください。");
    }

    const userId =
      String(options?.userId || "").trim() ||
      getSessionUserId() ||
      (await window.TasuDashboardData?.resolveAuthContext?.())?.userId ||
      "";

    const avatar_url = await fileToAvatarUrl(file, userId);
    await persistAvatarUrl(avatar_url, userId);
    return avatar_url;
  }

  function initFromSession() {
    const url = getStoredAvatarUrl();
    if (url) {
      syncChatConfigMe();
      applyAvatarToDom(url);
    }
  }

  window.TasuMemberProfile = {
    SESSION_KEY,
    DEFAULT_AVATAR,
    readSession,
    writeSession,
    getStoredAvatarUrl,
    getAvatarUrlForUser,
    resolveDisplayUrl,
    applyAvatarToDom,
    syncChatConfigMe,
    setAvatarUrl,
    isAllowedImageFile,
    saveAvatarFile,
    persistAvatarUrl,
    initFromSession,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFromSession);
  } else {
    initFromSession();
  }
})();
