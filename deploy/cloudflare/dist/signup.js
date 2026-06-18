/**
 * TASFUL 会員登録（signup.html）
 * 現状: localStorage 保存 + Supabase 接続可能な構造
 */
(function initSignupPage() {
  "use strict";

  const STORAGE_KEY = "tasu_member_signups";
  const SESSION_KEY = "tasu_member_session";

  const form = document.querySelector("[data-signup-form]");
  if (!form) return;

  const tabs = [...document.querySelectorAll("[data-signup-member-type]")];
  const memberTypeInput = document.querySelector("[data-signup-member-type-input]");
  const emailInput = document.querySelector("[data-signup-email]");
  const passwordInput = document.querySelector("[data-signup-password]");
  const passwordConfirmInput = document.querySelector("[data-signup-password-confirm]");
  const nicknameInput = document.querySelector("[data-signup-nickname]");
  const agreeInput = document.querySelector("[data-signup-agree]");
  const submitBtn = document.querySelector("[data-signup-submit]");
  const toastEl = document.querySelector("[data-signup-toast]");
  const passwordToggle = document.querySelector("[data-signup-password-toggle]");

  const errorEls = {
    email: document.querySelector('[data-signup-error="email"]'),
    password: document.querySelector('[data-signup-error="password"]'),
    passwordConfirm: document.querySelector('[data-signup-error="passwordConfirm"]'),
    nickname: document.querySelector('[data-signup-error="nickname"]'),
    agree: document.querySelector('[data-signup-error="agree"]'),
  };

  function readStoredSignups() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeStoredSignups(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
    [emailInput, passwordInput, passwordConfirmInput, nicknameInput].forEach((input) => {
      input?.classList.remove("is-invalid");
    });
  }

  function setError(field, message) {
    const el = errorEls[field];
    const inputMap = {
      email: emailInput,
      password: passwordInput,
      passwordConfirm: passwordConfirmInput,
      nickname: nicknameInput,
    };
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
    let valid = true;

    const email = String(emailInput?.value || "").trim();
    const password = String(passwordInput?.value || "");
    const passwordConfirm = String(passwordConfirmInput?.value || "");
    const nickname = String(nicknameInput?.value || "").trim();
    const agree = Boolean(agreeInput?.checked);

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
    } else if (password.length < 8) {
      setError("password", "パスワードは8文字以上で入力してください。");
      valid = false;
    }

    if (!passwordConfirm) {
      setError("passwordConfirm", "パスワード（確認）を入力してください。");
      valid = false;
    } else if (password && passwordConfirm && password !== passwordConfirm) {
      setError("passwordConfirm", "パスワードが一致しません。");
      valid = false;
    }

    if (!nickname) {
      setError("nickname", "ニックネームを入力してください。");
      valid = false;
    }

    if (!agree) {
      if (errorEls.agree) {
        errorEls.agree.hidden = false;
        errorEls.agree.textContent = "利用規約とプライバシーポリシーへの同意が必要です。";
      }
      valid = false;
    }

    return valid
      ? {
          ok: true,
          payload: {
            email,
            password,
            nickname,
            memberType: String(memberTypeInput?.value || "individual"),
          },
        }
      : { ok: false };
  }

  function setMemberType(type) {
    const next = type === "business" ? "business" : "individual";
    if (memberTypeInput) memberTypeInput.value = next;

    tabs.forEach((tab) => {
      const active = tab.dataset.signupMemberType === next;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setMemberType(tab.dataset.signupMemberType);
    });
  });

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

  async function trySupabaseSignup(payload) {
    const client = window.TasuSupabase?.getClient?.();
    if (!client?.auth?.signUp) {
      return { ok: false, reason: "no_supabase" };
    }

    const { data, error } = await client.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          nickname: payload.nickname,
          member_type: payload.memberType,
          display_name: payload.nickname,
        },
      },
    });

    if (error) {
      return { ok: false, reason: "supabase_error", error };
    }

    return { ok: true, data };
  }

  function saveLocalSignup(payload) {
    const list = readStoredSignups();
    const duplicate = list.some(
      (item) => String(item.email || "").toLowerCase() === payload.email.toLowerCase()
    );
    if (duplicate) {
      return { ok: false, reason: "duplicate_email" };
    }

    const record = {
      id: `member_${Date.now()}`,
      email: payload.email,
      nickname: payload.nickname,
      memberType: payload.memberType,
      createdAt: new Date().toISOString(),
      passwordHint: "(stored locally for PoC only)",
      password: payload.password,
    };

    list.push(record);
    writeStoredSignups(list);

    window.TasuMemberAuth?.establishLocalSession?.({
      id: record.id,
      email: record.email,
      nickname: record.nickname,
      display_name: record.nickname,
      name: record.nickname,
      memberType: record.memberType,
    });

    return { ok: true, record };
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = validateForm();
    if (!result.ok) return;

    const payload = result.payload;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "登録処理中…";
    }

    try {
      let supabaseResult = null;
      if (window.TasuSupabase?.isConfigured?.()) {
        supabaseResult = await trySupabaseSignup(payload);
        if (supabaseResult.ok) {
          showToast(
            "会員登録を受け付けました。確認メールをご確認ください。",
            "success"
          );
          if (supabaseResult.data?.user) {
            await window.TasuMemberAuth?.establishSupabaseSession?.(supabaseResult.data.user);
          }
          form.reset();
          setMemberType("individual");
          return;
        }
        if (supabaseResult.reason === "supabase_error") {
          const msg =
            supabaseResult.error?.message ||
            "Supabase 登録に失敗しました。時間をおいて再度お試しください。";
          showToast(msg, "error");
          return;
        }
      }

      const localResult = saveLocalSignup(payload);
      if (!localResult.ok && localResult.reason === "duplicate_email") {
        setError("email", "このメールアドレスは既に登録されています。");
        showToast("このメールアドレスは既に登録されています。", "error");
        return;
      }

      const typeLabel = payload.memberType === "business" ? "業者・法人" : "一般会員";
      showToast(
        `${typeLabel}として登録しました（PoC: ローカル保存）。会員ページへ進めます。`,
        "success"
      );

      window.setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 900);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "無料で会員登録";
      }
    }
  });

  document.querySelectorAll("[data-signup-social]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const provider = btn.dataset.signupSocial;
      showToast(
        `${provider === "line" ? "LINE" : "Google"} 登録は準備中です。メール登録をご利用ください。`,
        "info"
      );
    });
  });

  setMemberType("individual");
})();
