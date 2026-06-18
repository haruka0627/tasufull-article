/**
 * TASFUL OPS WATCH Phase2 — ブラウザ起動時の自動実行
 * talk-home.html / talk-ops-room.html から init する
 */
(function (global) {
  "use strict";

  const AUTO_SURFACES = new Set(["talk-home", "talk-ops-room"]);

  /** @type {Promise<object|null>|null} */
  let inflight = null;

  function getStorage() {
    return global.TasuOpsWatchDaily?.resolveStorage?.() || null;
  }

  /**
   * @param {{ surface?: string, force?: boolean }} [options]
   * @returns {Promise<object|null>}
   */
  async function maybeAutoRunDailyOpsWatch(options) {
    const Daily = global.TasuOpsWatchDaily;
    if (!Daily?.runDailyOpsWatch) return null;

    const surface = String(options?.surface || "").trim();
    if (surface && !AUTO_SURFACES.has(surface)) return null;

    if (inflight) return inflight;

    const storage = getStorage();
    const evalResult = Daily.evaluateAutoRun(storage, {
      force: options?.force === true,
      now: options?.now,
    });

    if (!evalResult.shouldRun) {
      return Promise.resolve({
        ok: true,
        skipped: true,
        reason: "interval_not_elapsed",
        eval: evalResult,
      });
    }

    inflight = Daily.runDailyOpsWatch({
      storage,
      force: options?.force === true,
      now: options?.now,
    })
      .then((result) => {
        try {
          global.dispatchEvent(
            new CustomEvent("tasu:ops-watch-daily-completed", { detail: result })
          );
        } catch {
          /* ignore */
        }
        return result;
      })
      .catch((err) => {
        console.warn("[TasuOpsWatchBrowser] auto run failed:", err);
        return { ok: false, reason: "auto_run_exception", error: String(err?.message || err) };
      })
      .finally(() => {
        inflight = null;
      });

    return inflight;
  }

  /**
   * ページ読込後に自動実行を試行（非ブロッキング）
   * @param {{ surface: string }} options
   */
  function initOpsWatchAutoRunOnLoad(options) {
    const surface = String(options?.surface || "").trim();
    if (!surface) return;

    const run = () => {
      void maybeAutoRunDailyOpsWatch({ surface });
    };

    if (global.document?.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  }

  global.TasuOpsWatchBrowser = {
    initOpsWatchAutoRunOnLoad,
    maybeAutoRunDailyOpsWatch,
    AUTO_SURFACES,
  };
})(typeof window !== "undefined" ? window : globalThis);
