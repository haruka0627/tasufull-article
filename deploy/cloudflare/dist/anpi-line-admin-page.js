/**
 * LINE運用画面（管理者専用）— anpi-line-admin.html
 */
(function () {
  "use strict";

  const ROOT_SEL = "[data-anpi-line-admin-root]";

  /** @type {{ ok: boolean, error_message?: string, error_code?: string } | null} */
  let lastTestPushResult = null;

  /** 並列 refreshPage が古い test_push_result:null で DOM を上書きしないよう直列化 */
  let refreshChain = Promise.resolve();

  /**
   * @param {{ ok: boolean, error_message?: string, error_code?: string } | null | undefined} [testPushResult]
   *   省略時は lastTestPushResult を維持（通知イベント再描画で結果表示が消えないようにする）
   */
  function refreshPage(testPushResult) {
    if (arguments.length > 0) {
      lastTestPushResult = testPushResult || null;
    }
    refreshChain = refreshChain.then(async () => {
      await window.TasuAnpiLineAdmin?.renderAdminPage?.(ROOT_SEL, {
        test_push_result: lastTestPushResult,
      });
      bindTestPush();
    });
    return refreshChain;
  }

  function bindTestPush() {
    const btn = document.querySelector("[data-anpi-line-test-push]");
    if (!btn || btn.dataset.anpiLineTestBound === "1") return;
    btn.dataset.anpiLineTestBound = "1";

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "送信中…";

      let result;
      try {
        result = await window.TasuAnpiNotifications?.sendLineTestPush?.();
      } catch {
        result = { ok: false, error_message: "送信処理でエラーが発生しました。" };
      }

      btn.disabled = false;
      btn.textContent = prev;

      await refreshPage({
        ok: result?.ok === true,
        error_message: result?.errors?.[0] || result?.error_message || "",
        error_code: result?.error_code || result?.line_send?.error_code || "",
      });
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

  function bindRefreshEvents() {
    const rerender = () => void refreshPage();
    [
      "tasu:anpi-notification-line-sent",
      "tasu:anpi-line-send-failed",
      "tasu:anpi-line-send-retried",
      "tasful:anpi-notification-updated",
    ].forEach((name) => {
      document.addEventListener(name, rerender);
      window.addEventListener(name, rerender);
    });
  }

  async function init() {
    const root = document.querySelector(ROOT_SEL);
    if (!root || root.dataset.anpiLineAdminPageBound === "1") return;
    root.dataset.anpiLineAdminPageBound = "1";

    const params = new URLSearchParams(location.search);
    if (params.get("anpi_admin") === "1") {
      window.TasuAnpiLineHealthcheck?.setAnpiLineAdmin?.(true);
    }

    bindMenu();
    bindRefreshEvents();
    await refreshPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
