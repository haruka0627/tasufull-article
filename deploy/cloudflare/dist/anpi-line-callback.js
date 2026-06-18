/**
 * LINE Login コールバック受け口（P8-1: 認可コード保存のみ）
 */
(function () {
  "use strict";

  const cfg = () => window.TasuAnpiLineLoginConfig || {};

  function $(sel) {
    return document.querySelector(sel);
  }

  function setUi(status, detail, showBack) {
    const statusEl = $("[data-anpi-callback-status]");
    const detailEl = $("[data-anpi-callback-detail]");
    const backEl = $("[data-anpi-callback-back]");
    if (statusEl) statusEl.textContent = status;
    if (detailEl) {
      if (detail) {
        detailEl.hidden = false;
        detailEl.textContent = detail;
      } else {
        detailEl.hidden = true;
        detailEl.textContent = "";
      }
    }
    if (backEl) {
      if (showBack) {
        backEl.hidden = false;
        backEl.removeAttribute("hidden");
      } else {
        backEl.hidden = true;
        backEl.setAttribute("hidden", "");
      }
    }
  }

  function stripSensitiveQuery() {
    try {
      const clean = `${location.pathname}${location.hash || ""}`;
      history.replaceState(null, "", clean);
    } catch {
      /* ignore */
    }
  }

  function handleCallback() {
    const params = new URLSearchParams(location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");
    const code = params.get("code");
    const state = params.get("state");

    if (error) {
      stripSensitiveQuery();
      const detail = errorDescription ? String(errorDescription) : String(error);
      setUi("LINE連携がキャンセルされました", detail, true);
      return;
    }

    if (code) {
      setUi("LINE連携を確認しています", "", false);

      const loginCfg = cfg();
      if (!loginCfg.verifyState?.(state)) {
        stripSensitiveQuery();
        setUi(
          "LINE連携の検証に失敗しました",
          "state が一致しません。もう一度お試しください。",
          true
        );
        return;
      }

      loginCfg.saveAuthCode?.(code);
      loginCfg.clearNonce?.();
      stripSensitiveQuery();

      setUi(
        "LINE連携の認可に成功しました",
        "次の画面で連携を完了します。",
        true
      );
      return;
    }

    stripSensitiveQuery();
    setUi(
      "LINE連携の結果を取得できませんでした",
      "認可コードがありません。",
      true
    );
  }

  function init() {
    const root = $("[data-anpi-line-callback-root]");
    if (!root || root.dataset.anpiCallbackBound === "1") return;
    root.dataset.anpiCallbackBound = "1";
    handleCallback();
  }

  init();
})();
