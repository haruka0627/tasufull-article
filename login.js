/**
 * 会員ログイン（login.html）
 */
(function initLoginPage() {
  "use strict";

  if (document.body?.dataset?.page !== "login") return;

  const SIGNUPS_KEY = "tasu_member_signups";

  const form = document.querySelector("[data-login-form]");
  const emailInput = document.querySelector("[data-login-email]");
  const passwordInput = document.querySelector("[data-login-password]");
  const submitBtn = document.querySelector("[data-login-submit]");
  const toastEl = document.querySelector("[data-login-toast]");
  const passwordToggle = document.querySelector("[data-login-password-toggle]");
  const lastUserBox =
    document.querySelector("#last-user-box") ||
    document.querySelector("[data-login-last-user]");
  const lastAvatar =
    lastUserBox?.querySelector(".user-avatar") ||
    document.querySelector("[data-login-last-avatar]");
  const lastName =
    lastUserBox?.querySelector(".user-name") ||
    document.querySelector("[data-login-last-name]");
  const lastType = document.querySelector("[data-login-last-type]");

  const DEFAULT_AVATAR =
    window.TasuMemberAuth?.DEFAULT_AVATAR_URL ||
    "https://placehold.co/64x64/f3ead4/967622?text=ME";

  function resolveAvatarSrc(url) {
    const trimmed = String(url || "").trim();
    if (!trimmed) return DEFAULT_AVATAR;
    return window.TasuMemberProfile?.resolveDisplayUrl?.(trimmed) || trimmed;
  }

  function bindAvatarFallback(img) {
    if (!img) return;
    img.onerror = () => {
      img.onerror = null;
      img.src = DEFAULT_AVATAR;
    };
  }

  function parseLastProfileRaw() {
    try {
      const raw = localStorage.getItem("tasful_last_profile");
      if (!raw) return null;
      return window.TasuMemberAuth?.normalizeLastProfile?.(JSON.parse(raw)) ?? null;
    } catch {
      return null;
    }
  }

  function renderLastUser() {
    const lastProfile =
      window.TasuMemberAuth?.readLastProfile?.() || parseLastProfileRaw();

    if (!lastProfile || !lastProfile.name) {
      if (lastUserBox) lastUserBox.style.display = "none";
      if (lastName) lastName.textContent = "";
      return;
    }

    const name = String(lastProfile.name).trim();
    if (lastName) lastName.textContent = name;

    if (lastAvatar) {
      lastAvatar.alt = `${name}のプロフィール画像`;
      lastAvatar.src = lastProfile.avatarUrl
        ? resolveAvatarSrc(lastProfile.avatarUrl)
        : DEFAULT_AVATAR;
      bindAvatarFallback(lastAvatar);
    }

    if (lastType) {
      const typeLabel = String(lastProfile.accountType || "").trim();
      if (typeLabel) {
        lastType.hidden = false;
        lastType.textContent = typeLabel;
      } else {
        lastType.hidden = true;
        lastType.textContent = "";
      }
    }

    if (lastProfile.email && emailInput && !emailInput.value) {
      emailInput.value = lastProfile.email;
    }

    if (lastUserBox) lastUserBox.style.display = "flex";
  }

  const errorEls = {
    email: document.querySelector('[data-login-error="email"]'),
    password: document.querySelector('[data-login-error="password"]'),
  };

  function readStoredSignups() {
    try {
      const raw = localStorage.getItem(SIGNUPS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function showToast(message, tone = "info") {
    if (!toastEl) return;
    toastEl.hidden = false;
    toastEl.dataset.tone = tone;
    toastEl.textContent = message;
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 5200);
  }

  function clearErrors() {
    Object.values(errorEls).forEach((el) => {
      if (!el) return;
      el.hidden = true;
      el.textContent = "";
    });
    [emailInput, passwordInput].forEach((input) => input?.classList.remove("is-invalid"));
  }

  function setError(field, message) {
    const el = errorEls[field];
    const inputMap = { email: emailInput, password: passwordInput };
    if (el) {
      el.hidden = false;
      el.textContent = message;
    }
    inputMap[field]?.classList.add("is-invalid");
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function validateForm() {
    clearErrors();
    const email = String(emailInput?.value || "").trim();
    const password = String(passwordInput?.value || "");
    let valid = true;

    if (!email) {
      setError("email", "メールアドレスを入力してください。");
      valid = false;
    } else if (!isValidEmail(email)) {
      setError("email", "有効なメールアドレスを入力してください。");
      valid = false;
    }

    if (!password) {
      setError("password", "パスワードを入力してください。");
      valid = false;
    }

    return valid ? { ok: true, email, password } : { ok: false };
  }

  async function trySupabaseLogin(email, password) {
    const client = window.TasuSupabase?.getClient?.();
    if (!client?.auth?.signInWithPassword) {
      return { ok: false, reason: "no_supabase" };
    }

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, reason: "supabase_error", error };
    if (!data?.user) return { ok: false, reason: "no_user" };

    await window.TasuMemberAuth?.establishSupabaseSession?.(data.user);
    return { ok: true };
  }

  function tryLocalLogin(email, password) {
    const list = readStoredSignups();
    const record = list.find(
      (item) => String(item.email || "").toLowerCase() === email.toLowerCase()
    );
    if (!record) return { ok: false, reason: "not_found" };
    if (String(record.password || "") !== password) {
      return { ok: false, reason: "bad_password" };
    }

    window.TasuMemberAuth?.establishLocalSession?.({
      id: record.id,
      email: record.email,
      nickname: record.nickname,
      display_name: record.nickname,
      name: record.nickname,
      memberType: record.memberType || "individual",
    });

    return { ok: true };
  }

  function redirectAfterLogin() {
    const target = window.TasuMemberAuth?.getReturnUrl?.("dashboard.html") || "dashboard.html";
    window.location.href = target;
  }

  /** 開発専用 — 認証なしでダッシュボードへ（本番では DEV_SKIP_AUTH を false に） */
  function bindDevInstantLogin() {
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      redirectAfterLogin();
    });
  }

  function returnNeedsSupabaseAuth() {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = String(params.get("return") || params.get("next") || "").trim();
      const safe = raw.split("#")[0].split("?")[0].replace(/^\.\//, "");
      return /partner-management\.html|partner-detail\.html/.test(safe);
    } catch {
      return false;
    }
  }

  renderLastUser();

  passwordToggle?.addEventListener("click", () => {
    if (!passwordInput) return;
    const show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    passwordToggle.setAttribute("aria-label", show ? "パスワードを非表示" : "パスワードを表示");
    passwordToggle.setAttribute("aria-pressed", show ? "true" : "false");
    const showIcon = passwordToggle.querySelector(".signup-field__toggle-icon--show");
    const hideIcon = passwordToggle.querySelector(".signup-field__toggle-icon--hide");
    if (showIcon) showIcon.hidden = show;
    if (hideIcon) hideIcon.hidden = !show;
  });

  document.querySelectorAll("[data-login-social]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const provider = btn.dataset.loginSocial;
      showToast(
        `${provider === "line" ? "LINE" : "Google"} ログインは準備中です。メールログインをご利用ください。`,
        "info"
      );
    });
  });

  if (window.TasuMemberAuth?.DEV_SKIP_AUTH && !returnNeedsSupabaseAuth()) {
    bindDevInstantLogin();
    return;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = validateForm();
    if (!result.ok) return;

    const { email, password } = result;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "ログイン中…";
    }

    try {
      if (window.TasuSupabase?.isConfigured?.()) {
        const supabaseResult = await trySupabaseLogin(email, password);
        if (supabaseResult.ok) {
          showToast("ログインしました。", "success");
          window.setTimeout(redirectAfterLogin, 400);
          return;
        }
        if (supabaseResult.reason === "supabase_error") {
          const msg =
            supabaseResult.error?.message ||
            "ログインに失敗しました。メールアドレスとパスワードをご確認ください。";
          setError("password", msg);
          showToast(msg, "error");
          return;
        }
      }

      const localResult = tryLocalLogin(email, password);
      if (!localResult.ok) {
        if (localResult.reason === "not_found") {
          setError("email", "登録が見つかりません。会員登録をご確認ください。");
          showToast("登録が見つかりません。", "error");
        } else {
          setError("password", "パスワードが正しくありません。");
          showToast("パスワードが正しくありません。", "error");
        }
        return;
      }

      showToast("ログインしました。", "success");
      window.setTimeout(redirectAfterLogin, 400);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "ログイン";
      }
    }
  });
})();
