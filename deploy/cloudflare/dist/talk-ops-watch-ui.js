/**
 * TASFUL OPS WATCH — talk-ops-room 管理 UI（手動実行）
 */
(function (global) {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setRunning(running) {
    document.querySelectorAll("[data-ops-watch-run]").forEach((btn) => {
      btn.disabled = running;
    });
    const status = $("[data-ops-watch-status]");
    if (status) status.classList.toggle("is-busy", running);
  }

  function renderResult(payload) {
    const host = $("[data-ops-watch-result]");
    if (!host) return;

    if (!payload) {
      host.hidden = true;
      host.textContent = "";
      return;
    }

    host.hidden = false;
    if (payload.skipped) {
      host.innerHTML = `<p class="talk-ops-watch-result__line">自動実行スキップ: ${esc(payload.reason || "interval")}</p>`;
      return;
    }

    const stats = payload.stats || payload.batch?.stats || {};
    const lines = [
      `<p class="talk-ops-watch-result__line"><strong>完了</strong> ${esc(payload.ranAt || new Date().toISOString())}</p>`,
      `<p class="talk-ops-watch-result__line">カテゴリ: ${stats.categoriesRun ?? 0} / 成功: ${payload.batch?.okCount ?? payload.okCount ?? "-"}</p>`,
      `<p class="talk-ops-watch-result__line">TALK通知: ${stats.talkNotifications ?? 0} · 重要 ${stats.high ?? 0} / 中 ${stats.medium ?? 0} / 低 ${stats.low ?? 0}</p>`,
      `<p class="talk-ops-watch-result__line">検索失敗: ${stats.searchFailed ?? 0} · 新規候補: ${stats.newServiceCandidates ?? 0}</p>`,
    ];
    if (stats.failedCategories?.length) {
      lines.push(
        `<p class="talk-ops-watch-result__line talk-ops-watch-result__warn">失敗: ${esc(stats.failedCategories.join(", "))}</p>`
      );
    }
    if (payload.summaryBody) {
      lines.push(`<pre class="talk-ops-watch-result__pre">${esc(payload.summaryBody)}</pre>`);
    }
    host.innerHTML = lines.join("");
  }

  async function runManual(action) {
    const Watch = global.TasuOpsWatch;
    const Daily = global.TasuOpsWatchDaily;
    if (!Watch) return;

    setRunning(true);
    renderResult({ ranAt: new Date().toISOString(), stats: {}, summaryBody: "実行中…" });

    try {
      let result;
      if (action === "all") {
        result = await Daily?.runDailyOpsWatch?.({
          force: true,
          forceNotify: true,
          skipMarkRun: false,
        });
        if (!result) {
          const batch = await Watch.runAll({ forceNotify: true, dailyRun: true, dedupeHours: 0 });
          Daily?.markDailyOpsWatchRun?.();
          result = { ok: batch.ok, batch, stats: batch.stats, summaryBody: batch.summaryBody };
        }
      } else {
        const batch = await Watch.runCategory(action, { forceNotify: true, dedupeHours: 0 });
        result = {
          ok: batch.ok,
          batch,
          stats: Daily?.aggregateRunResults?.([batch]) || {},
          summaryBody: batch.ok
            ? `${action}: ${batch.card?.headline || "完了"} (${batch.card?.analysisSource || ""})`
            : `失敗: ${batch.error || batch.reason}`,
        };
      }
      renderResult(result);
    } catch (err) {
      renderResult({
        ok: false,
        summaryBody: `エラー: ${String(err?.message || err)}`,
        stats: {},
      });
    } finally {
      setRunning(false);
    }
  }

  function wireButtons() {
    document.querySelectorAll("[data-ops-watch-run]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-ops-watch-run") || "all";
        void runManual(action);
      });
    });
  }

  function init() {
    wireButtons();
    global.TasuOpsWatchBrowser?.initOpsWatchAutoRunOnLoad?.({ surface: "talk-ops-room" });

    global.addEventListener("tasu:ops-watch-daily-completed", (ev) => {
      renderResult(ev.detail);
    });
  }

  global.TasuTalkOpsWatchUi = {
    init,
    runManual,
    renderResult,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
