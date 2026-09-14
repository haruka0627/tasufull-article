/**
 * TASFUL Materials — 広告スロット（AdSense 等を後から差し替え可能）
 */
(function (global) {
  "use strict";

  const PRESETS = Object.freeze({
    leaderboard: { width: 728, height: 90, label: "728×90" },
    rectangle: { width: 300, height: 250, label: "300×250" },
    mobile: { width: 320, height: 50, label: "320×50" },
    mobileBanner: { width: 320, height: 100, label: "320×100" },
  });

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {object} opts
   * @param {keyof typeof PRESETS} [opts.preset]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {string} [opts.slotId] — 将来 AdSense data-ad-slot
   * @param {string} [opts.className]
   */
  function renderAdSlot(opts = {}) {
    const preset = PRESETS[opts.preset] || PRESETS.rectangle;
    const width = opts.width || preset.width;
    const height = opts.height || preset.height;
    const label = preset.label || `${width}×${height}`;
    const slotId = escapeHtml(opts.slotId || `materials-ad-${width}x${height}`);
    const extraClass = opts.className ? ` ${escapeHtml(opts.className)}` : "";

    return (
      `<aside class="materials-ad${extraClass}" data-materials-ad-slot="${slotId}" data-ad-width="${width}" data-ad-height="${height}" aria-label="広告">` +
      `<div class="materials-ad__inner" style="--materials-ad-w:${width}px;--materials-ad-h:${height}px">` +
      `<span class="materials-ad__label">広告バナー (${escapeHtml(label)})</span>` +
      `<span class="materials-ad__hint">Google AdSense 等を設置予定</span>` +
      `</div>` +
      `</aside>`
    );
  }

  /**
   * 将来 AdSense スクリプトをマウントするフック
   * @param {ParentNode} [root]
   */
  function mountAdSlots(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-materials-ad-slot]").forEach((el) => {
      if (el.dataset.materialsAdMounted === "1") return;
      el.dataset.materialsAdMounted = "1";
      // 例: (adsbygoogle = window.adsbygoogle || []).push({});
    });
  }

  global.TasuMaterialsAdSlot = {
    PRESETS,
    renderAdSlot,
    mountAdSlots,
  };
})(typeof window !== "undefined" ? window : globalThis);
