/**
 * 安否サービス登録フォーム
 */
(function () {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function collectFormData(form) {
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    data.notify_tasful_chat = form.querySelector('[name="notify_tasful_chat"]')?.checked === true;
    data.notify_line = form.querySelector('[name="notify_line"]')?.checked === true;
    data.notify_email = form.querySelector('[name="notify_email"]')?.checked === true;
    data.consent_no_auto_execution =
      form.querySelector('[name="consent_no_auto_execution"]')?.checked === true;
    data.consent_self_confirm_required =
      form.querySelector('[name="consent_self_confirm_required"]')?.checked === true;
    data.consent_tasful_no_guarantee =
      form.querySelector('[name="consent_tasful_no_guarantee"]')?.checked === true;
    data.consent_emergency_contact_required =
      form.querySelector('[name="consent_emergency_contact_required"]')?.checked === true;
    const lineRadio = form.querySelector('[name="line_notification_enabled"]:checked');
    data.line_notification_enabled = lineRadio?.value === "1";
    return data;
  }

  function showErrors(errors) {
    const box = $("[data-anpi-form-errors]");
    if (!box) return;
    if (!errors?.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = `<ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function showLineFeedback(message, tone = "info") {
    const el = $("[data-anpi-line-test-feedback]");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.className = `anpi-register-line-feedback is-${tone}`;
  }

  function hideLineFeedback() {
    const el = $("[data-anpi-line-test-feedback]");
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    el.className = "anpi-register-line-feedback";
  }

  function formatLinkedAt(iso) {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      }).format(new Date(iso));
    } catch {
      return String(iso);
    }
  }

  let lineTokenExchangeInFlight = false;

  function setExchangeLoading(visible) {
    const el = $("[data-anpi-line-exchange-loading]");
    if (!el) return;
    el.hidden = !visible;
  }

  function shouldSkipLineTokenExchange() {
    try {
      return new URLSearchParams(location.search).get("anpi_skip_line_token_exchange") === "1";
    } catch {
      return false;
    }
  }

  function isDevEnvironment() {
    try {
      const host = location.hostname;
      if (host === "127.0.0.1" || host === "localhost") return true;
      if (new URLSearchParams(location.search).get("anpi_dev") === "1") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function updateLineUi(form) {
    const state = window.TasuAnpiUserContext?.getLineLinkState?.() || {
      linked: false,
      line_user_id: "",
      line_notification_enabled: false,
      line_linked_at: "",
    };

    const loginCfg = window.TasuAnpiLineLoginConfig;
    const config = loginCfg?.getConfig?.() || { isConfigured: false };
    const authPending = loginCfg?.hasAuthCodePending?.() === true && !state.linked;

    const statusText = $("[data-anpi-line-status-text]");
    const idRow = $("[data-anpi-line-id-row]");
    const idMask = $("[data-anpi-line-user-id-mask]");
    const linkedAtRow = $("[data-anpi-line-linked-at-row]");
    const linkedAtTime = $("[data-anpi-line-linked-at]");
    const unlinkedHint = $("[data-anpi-line-unlinked-hint]");
    const pendingEl = $("[data-anpi-line-auth-pending]");
    const exchangeLoadingEl = $("[data-anpi-line-exchange-loading]");
    const warnEl = $("[data-anpi-line-config-warn]");
    const loginBtn = $("[data-anpi-line-login-link]");
    const unlinkBtn = $("[data-anpi-line-unlink]");
    const devWrap = $("[data-anpi-line-dev-wrap]");
    const enableRadio = form.querySelector("[data-anpi-line-enable]");
    const disableRadio = form.querySelector("[data-anpi-line-disable]");
    const enableLabel = enableRadio?.closest(".anpi-register-line-radio");
    const testBtn = $("[data-anpi-line-test]");
    const demoBtn = $("[data-anpi-line-demo-link]");

    if (statusText) {
      statusText.textContent = state.linked ? "TASFUL TALK連携済み" : "未連携";
      statusText.className = `anpi-register-line-status__value ${
        state.linked ? "is-linked" : "is-unlinked"
      }`;
    }

    if (linkedAtRow && linkedAtTime) {
      const at = state.line_linked_at;
      if (state.linked && at) {
        linkedAtRow.hidden = false;
        linkedAtTime.textContent = formatLinkedAt(at);
        linkedAtTime.setAttribute("datetime", at);
      } else {
        linkedAtRow.hidden = true;
        linkedAtTime.textContent = "";
      }
    }

    if (idRow && idMask) {
      if (state.linked && state.line_user_id) {
        idRow.hidden = false;
        idMask.textContent =
          loginCfg?.maskLineUserId?.(state.line_user_id) || "****";
      } else {
        idRow.hidden = true;
        idMask.textContent = "";
      }
    }

    if (pendingEl) {
      pendingEl.hidden = !authPending || lineTokenExchangeInFlight;
    }

    if (exchangeLoadingEl) {
      exchangeLoadingEl.hidden = !lineTokenExchangeInFlight;
    }

    if (unlinkedHint) {
      unlinkedHint.hidden = state.linked || authPending || lineTokenExchangeInFlight;
    }

    if (warnEl) {
      warnEl.hidden = config.isConfigured;
    }

    if (loginBtn) {
      loginBtn.hidden = state.linked;
      loginBtn.disabled = !config.isConfigured || state.linked;
    }

    if (unlinkBtn) {
      unlinkBtn.hidden = !state.linked;
      unlinkBtn.disabled = !state.linked || lineTokenExchangeInFlight;
    }

    if (devWrap) {
      devWrap.hidden = !isDevEnvironment();
    }

    if (demoBtn) {
      demoBtn.hidden = state.linked;
      demoBtn.disabled = state.linked;
    }

    if (enableRadio && disableRadio) {
      if (state.linked) {
        enableRadio.disabled = false;
        if (enableLabel) enableLabel.classList.remove("is-disabled");
      } else {
        enableRadio.disabled = true;
        if (enableLabel) enableLabel.classList.add("is-disabled");
        if (enableRadio.checked) {
          disableRadio.checked = true;
        }
      }
    }

    if (testBtn) {
      const lineOn = form.querySelector('[name="line_notification_enabled"]:checked')?.value === "1";
      testBtn.disabled = !state.linked || !lineOn;
    }
  }

  function restoreForm(form) {
    const defaults = window.TasuAnpiUserContext?.getRegisterFormDefaults?.();
    const editNote = $("[data-anpi-edit-note]");
    if (!defaults) {
      if (editNote) editNote.hidden = true;
      updateLineUi(form);
      return;
    }

    if (editNote) {
      editNote.hidden = false;
      editNote.textContent = `登録済みの設定を編集しています（最終更新: ${defaults.updated_at || "—"}）。電話番号を変更する場合のみ再入力してください。`;
    }

    const setVal = (name, value) => {
      const el = form.elements.namedItem(name);
      if (el && "value" in el && value != null) el.value = String(value);
    };

    setVal("contract_holder_name", defaults.contract_holder_name);
    setVal("contract_holder_relation", defaults.contract_holder_relation);
    setVal("contract_holder_email", defaults.contract_holder_email);
    setVal("contract_holder_contact_method", defaults.contract_holder_contact_method);
    setVal("user_name", defaults.user_name);
    setVal("user_age_optional", defaults.user_age_optional);
    setVal("user_relation_note", defaults.user_relation_note);
    setVal("emergency_note", defaults.emergency_note);

    const hintUser = $("[data-hint-user-phone]");
    const hintHolder = $("[data-hint-contract-holder-phone]");
    if (hintUser && defaults.user_phone_masked_hint) {
      hintUser.textContent = `登録済み: ${defaults.user_phone_masked_hint}`;
    }
    if (hintHolder && defaults.contract_holder_phone_masked_hint) {
      hintHolder.textContent = `登録済み: ${defaults.contract_holder_phone_masked_hint}`;
    }

    const notifyTasful = form.querySelector('[name="notify_tasful_chat"]');
    const notifyLine = form.querySelector('[name="notify_line"]');
    const notifyEmail = form.querySelector('[name="notify_email"]');
    if (notifyTasful) notifyTasful.checked = defaults.notify_tasful_chat;
    if (notifyLine) notifyLine.checked = defaults.notify_line;
    if (notifyEmail) notifyEmail.checked = defaults.notify_email;

    const level = form.querySelector(`[name="notification_level"][value="${defaults.notification_level}"]`);
    if (level) level.checked = true;

    const lineEnable = form.querySelector('[name="line_notification_enabled"][value="1"]');
    const lineDisable = form.querySelector('[name="line_notification_enabled"][value="0"]');
    if (defaults.line_notification_enabled && defaults.line_linked && lineEnable) {
      lineEnable.checked = true;
    } else if (lineDisable) {
      lineDisable.checked = true;
    }

    form.querySelector('[name="consent_no_auto_execution"]').checked =
      defaults.consent_no_auto_execution;
    form.querySelector('[name="consent_self_confirm_required"]').checked =
      defaults.consent_self_confirm_required;
    form.querySelector('[name="consent_tasful_no_guarantee"]').checked =
      defaults.consent_tasful_no_guarantee;
    form.querySelector('[name="consent_emergency_contact_required"]').checked =
      defaults.consent_emergency_contact_required;

    const submit = $("[data-anpi-submit]");
    if (submit) submit.textContent = "変更を保存する";

    updateLineUi(form);
  }

  function showSuccess(context) {
    const form = $("[data-anpi-register-form]");
    const success = $("[data-anpi-register-success]");
    const meta = $("[data-anpi-success-meta]");
    if (form) form.hidden = true;
    if (success) success.hidden = false;
    if (meta && context) {
      const lineNote = context.line_notification_enabled ? " / TASFUL TALK通知: 利用" : "";
      meta.textContent = `利用者: ${context.user_name} / 契約者: ${context.contract_holder_name}${lineNote} / 更新: ${context.updated_at}`;
    }
    showErrors([]);
  }

  async function attemptLineTokenExchange(form) {
    const loginCfg = window.TasuAnpiLineLoginConfig;
    const tokenClient = window.TasuAnpiLineTokenClient;
    const code = loginCfg?.getAuthCode?.() || "";
    if (!code) return;

    const linkState = window.TasuAnpiUserContext?.getLineLinkState?.() || {};
    if (linkState.linked) {
      loginCfg?.clearAuthCode?.();
      return;
    }

    if (lineTokenExchangeInFlight) return;
    lineTokenExchangeInFlight = true;
    setExchangeLoading(true);
    updateLineUi(form);
    hideLineFeedback();

    const redirectUri = loginCfg?.getRedirectUri?.() || "";
    const nonce = loginCfg?.getSavedNonce?.() || "";

    let result;
    try {
      result = await tokenClient?.exchangeAuthCode?.({
        code,
        redirectUri,
        nonce,
      });
    } catch {
      result = {
        success: false,
        error_message: "TASFUL TALK連携の通信に失敗しました。",
      };
    }

    lineTokenExchangeInFlight = false;
    setExchangeLoading(false);

    if (result?.success && result?.userId) {
      const applyResult = await window.TasuAnpiUserContext?.applyLineOAuthLink?.({
        userId: result.userId,
        access_token: result.access_token,
        expires_at: result.expires_at,
      });

      if (applyResult?.ok) {
        loginCfg?.clearAuthCode?.();
        loginCfg?.clearNonce?.();
        showLineFeedback(
          "TASFUL TALK連携が完了しました。内容を確認して登録を保存してください。",
          "success"
        );
        restoreForm(form);
      } else {
        showLineFeedback(
          applyResult?.errors?.[0] || "TASFUL TALK連携の保存に失敗しました。",
          "error"
        );
        updateLineUi(form);
      }
      return;
    }

    const errMsg =
      result?.error_message ||
      (result?.error_code === "NONCE_MISMATCH"
        ? "TASFUL TALK連携の検証（nonce）に失敗しました。"
        : "TASFUL TALK連携に失敗しました。もう一度お試しください。");
    showLineFeedback(errMsg, "error");
    updateLineUi(form);
  }

  function bindLineControls(form) {
    form.querySelectorAll('[name="line_notification_enabled"]').forEach((el) => {
      el.addEventListener("change", () => {
        hideLineFeedback();
        updateLineUi(form);
      });
    });

    $("[data-anpi-line-login-link]")?.addEventListener("click", () => {
      const url = window.TasuAnpiLineLoginConfig?.createAuthUrl?.();
      if (!url) {
        showLineFeedback("TASFUL TALK Login Channel ID が未設定です。", "info");
        return;
      }
      hideLineFeedback();
      location.href = url;
    });

    $("[data-anpi-line-test]")?.addEventListener("click", () => {
      const state = window.TasuAnpiUserContext?.getLineLinkState?.();
      const lineOn = form.querySelector('[name="line_notification_enabled"]:checked')?.value === "1";
      if (!state?.linked || !lineOn) {
        showLineFeedback("TASFUL TALK連携と「利用する」の選択が必要です。", "info");
        return;
      }
      const result = window.TasuAnpiNotifications?.recordLinePreviewNotification?.({
        line_notification_enabled: true,
        line_user_id: state.line_user_id,
      });
      if (!result?.ok) {
        showLineFeedback(result?.errors?.[0] || "テスト通知の記録に失敗しました。", "info");
        return;
      }
      const btn = $("[data-anpi-line-test]");
      if (btn) btn.classList.add("is-ok");
      showLineFeedback(
        "テスト通知を記録しました（プレビュー）。TASFUL TALK API送信は通知ログから別途実行されます。",
        "success"
      );
      window.setTimeout(() => btn?.classList.remove("is-ok"), 2000);
    });

    $("[data-anpi-line-demo-link]")?.addEventListener("click", () => {
      window.TasuAnpiUserContext?.setLineLinkDemo?.();
      hideLineFeedback();
      restoreForm(form);
      showLineFeedback("デモ用のTASFUL TALK連携を登録しました。保存するまで設定は下書き状態です。", "info");
    });

    $("[data-anpi-line-unlink]")?.addEventListener("click", () => {
      const confirmed = window.confirm(
        "TASFUL TALK連携を解除すると、TASFUL TALKで安否通知を受け取れなくなります。解除しますか？"
      );
      if (!confirmed) return;

      hideLineFeedback();
      const unlinkResult = window.TasuAnpiUserContext?.unlinkLineOAuth?.();
      if (!unlinkResult?.success) {
        showLineFeedback("TASFUL TALK連携の解除に失敗しました。", "error");
        return;
      }

      window.TasuAnpiNotifications?.recordLineOAuthUnlinked?.();

      const notifyLine = form.querySelector('[name="notify_line"]');
      if (notifyLine) notifyLine.checked = false;
      const lineDisable = form.querySelector('[name="line_notification_enabled"][value="0"]');
      const lineEnable = form.querySelector('[name="line_notification_enabled"][value="1"]');
      if (lineDisable) lineDisable.checked = true;
      if (lineEnable) lineEnable.checked = false;

      restoreForm(form);
      showLineFeedback("TASFUL TALK連携を解除しました。", "success");
    });
  }

  function bindLineOAuthUnlinkRefresh(form) {
    const refresh = () => updateLineUi(form);
    [
      "tasu:anpi-line-oauth-unlinked",
      "tasful:anpi-line-oauth-unlinked",
      "tasful:anpi-notification-updated",
    ].forEach((name) => {
      document.addEventListener(name, refresh);
      window.addEventListener(name, refresh);
    });
  }

  function bindMenu() {
    const sidebar = document.getElementById("dashSidebar");
    const overlay = document.querySelector("[data-dash-overlay]");
    const menuBtn = document.querySelector("[data-dash-menu]");
    menuBtn?.addEventListener("click", () => {
      sidebar?.classList.toggle("is-open");
      overlay?.setAttribute(
        "aria-hidden",
        sidebar?.classList.contains("is-open") ? "false" : "true"
      );
    });
    overlay?.addEventListener("click", () => {
      sidebar?.classList.remove("is-open");
      overlay?.setAttribute("aria-hidden", "true");
    });
  }

  function bindFormSubmit(form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      hideLineFeedback();
      const data = collectFormData(form);
      const result = window.TasuAnpiUserContext?.saveFromRegisterForm?.(data);
      if (!result?.ok) {
        showErrors(result?.errors || ["保存に失敗しました。"]);
        return;
      }
      showSuccess(result.context);
    });
  }

  function bindContextRestoredRefresh(form) {
    const refresh = () => {
      if (form.hidden) return;
      restoreForm(form);
      updateLineUi(form);
    };
    ["tasu:anpi-context-restored", "tasful:anpi-context-restored"].forEach((name) => {
      document.addEventListener(name, refresh);
      window.addEventListener(name, refresh);
    });
  }

  async function syncContextAndRefreshForm(form) {
    await window.TasuAnpiUserContext?.initAnpiUserContext?.();
    updateLineUi(form);
    if (!shouldSkipLineTokenExchange()) {
      void attemptLineTokenExchange(form);
    }
  }

  function init() {
    const root = $("[data-anpi-register-root]");
    const form = $("[data-anpi-register-form]");
    if (!root || !form || root.dataset.anpiRegisterBound === "1") return;
    root.dataset.anpiRegisterBound = "1";

    bindMenu();
    bindLineControls(form);
    bindLineOAuthUnlinkRefresh(form);
    bindFormSubmit(form);
    bindContextRestoredRefresh(form);
    restoreForm(form);
    updateLineUi(form);
    void syncContextAndRefreshForm(form);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
