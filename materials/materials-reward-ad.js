/**
 * TASFUL Materials — リワード広告（MVP: 20秒モック · 将来広告 SDK 差し替え用）
 */
(function (global) {
  "use strict";

  const DEFAULT_DURATION_MS = 20000;
  let activeModal = null;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function removeModal() {
    if (!activeModal) return;
    activeModal.el.remove();
    document.documentElement.classList.remove("mat-reward-ad-open");
    activeModal = null;
  }

  /**
   * @param {{ durationMs?: number, title?: string, provider?: string }} [options]
   * @returns {Promise<{ completed: true, provider: string }>}
   */
  function showRewardAd(options) {
    const opts = options && typeof options === "object" ? options : {};
    const provider = String(opts.provider || "mock").trim() || "mock";
    const durationMs = Math.max(Number(opts.durationMs) || DEFAULT_DURATION_MS, 1000);
    const title = String(opts.title || "広告視聴で無料ダウンロード").trim();

    if (provider !== "mock") {
      return Promise.reject(
        Object.assign(new Error("reward_ad_provider_not_configured"), {
          code: "provider_not_configured",
          provider,
        })
      );
    }

    return showMockRewardAd({ durationMs, title });
  }

  function showSuccessState(el, finish) {
    const body = el.querySelector(".mat-reward-ad__body");
    if (!body) {
      finish(true);
      return;
    }
    body.innerHTML =
      `<div class="mat-reward-ad__success" role="status">` +
      `<div class="mat-reward-ad__success-icon" aria-hidden="true">✓</div>` +
      `<p class="mat-reward-ad__success-title">ダウンロードを解放しました</p>` +
      `<p class="mat-reward-ad__success-copy">「ダウンロードする」ボタンから保存できます。</p>` +
      `<button type="button" class="mat-reward-ad__continue" data-mat-reward-ad-continue>ダウンロードへ進む</button>` +
      `</div>`;
    body.querySelector("[data-mat-reward-ad-continue]")?.addEventListener("click", () => finish(true));
    setTimeout(() => finish(true), 3500);
  }

  function showMockRewardAd({ durationMs, title }) {
    removeModal();

    return new Promise((resolve, reject) => {
      const el = document.createElement("div");
      el.className = "mat-reward-ad";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-labelledby", "mat-reward-ad-title");
      el.innerHTML =
        `<div class="mat-reward-ad__backdrop" aria-hidden="true"></div>` +
        `<div class="mat-reward-ad__dialog">` +
        `<header class="mat-reward-ad__head">` +
        `<p class="mat-reward-ad__eyebrow">リワード広告</p>` +
        `<h2 id="mat-reward-ad-title" class="mat-reward-ad__title">${escapeHtml(title)}</h2>` +
        `<p class="mat-reward-ad__lead">広告視聴後に無料ダウンロードできます</p>` +
        `</header>` +
        `<div class="mat-reward-ad__body">` +
        `<div class="mat-reward-ad__screen" aria-live="polite">` +
        `<div class="mat-reward-ad__slot" aria-label="広告枠">` +
        `<span class="mat-reward-ad__slot-label">広告</span>` +
        `<span class="mat-reward-ad__slot-note">本番ではここに広告が表示されます</span>` +
        `</div>` +
        `<div class="mat-reward-ad__countdown">` +
        `<span class="mat-reward-ad__countdown-num" data-mat-reward-ad-sec>${Math.ceil(durationMs / 1000)}</span>` +
        `<span class="mat-reward-ad__countdown-unit">秒</span>` +
        `</div>` +
        `<p class="mat-reward-ad__status" data-mat-reward-ad-status>視聴中… 完了までお待ちください</p>` +
        `<div class="mat-reward-ad__progress" aria-hidden="true"><span data-mat-reward-ad-bar style="width:0%"></span></div>` +
        `</div>` +
        `<p class="mat-reward-ad__hint">視聴を完了するとダウンロードが解放されます。有料会員は広告なしでダウンロードできます。</p>` +
        `<button type="button" class="mat-reward-ad__cancel" data-mat-reward-ad-cancel>広告を中断して閉じる</button>` +
        `</div>` +
        `</div>`;

      document.body.appendChild(el);
      document.documentElement.classList.add("mat-reward-ad-open");

      const secEl = el.querySelector("[data-mat-reward-ad-sec]");
      const barEl = el.querySelector("[data-mat-reward-ad-bar]");
      const statusEl = el.querySelector("[data-mat-reward-ad-status]");
      const started = Date.now();
      let closed = false;

      function finish(ok) {
        if (closed) return;
        closed = true;
        clearInterval(timerId);
        removeModal();
        if (ok) resolve({ completed: true, provider: "mock" });
        else reject(Object.assign(new Error("reward_ad_cancelled"), { code: "cancelled" }));
      }

      el.querySelector("[data-mat-reward-ad-cancel]")?.addEventListener("click", () => {
        if (window.confirm("広告視聴を中断しますか？ダウンロードは解放されません。")) {
          finish(false);
        }
      });

      const timerId = setInterval(() => {
        const elapsed = Date.now() - started;
        const remain = Math.max(durationMs - elapsed, 0);
        const pct = Math.min(100, (elapsed / durationMs) * 100);
        if (secEl) secEl.textContent = String(Math.ceil(remain / 1000));
        if (barEl) barEl.style.width = `${pct}%`;
        if (statusEl && remain <= 3 && remain > 0) {
          statusEl.textContent = `あと ${Math.ceil(remain / 1000)} 秒で完了`;
        }
        if (remain <= 0) {
          clearInterval(timerId);
          el.classList.add("mat-reward-ad--complete");
          showSuccessState(el, finish);
        }
      }, 200);

      activeModal = { el, finish };
    });
  }

  global.TasuMaterialsRewardAd = {
    DEFAULT_DURATION_MS,
    showRewardAd,
    showMockRewardAd,
  };
})(typeof window !== "undefined" ? window : globalThis);
