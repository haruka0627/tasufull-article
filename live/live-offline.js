/**
 * TASFUL LIVE — オフライン（YouTube /feed/downloads 風 · UI のみ）
 */
(function (global) {
  "use strict";

  function renderOfflinePageHtml() {
    return `
      <div class="tlv-offline-page">
        <div class="tlv-offline-content">
          <div class="tlv-offline-content__visual">
            <div class="tlv-offline-illus" aria-hidden="true">
              <div class="tlv-offline-illus__lines">
                <span></span>
                <span></span>
              </div>
              <div class="tlv-offline-illus__card">
                <svg class="tlv-offline-illus__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 15V3"/>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <path d="m7 10 5 5 5-5"/>
                </svg>
              </div>
            </div>
          </div>
          <div class="tlv-offline-content__copy">
            <h1 class="tlv-offline-content__title">接続が切れても視聴を継続</h1>
            <p class="tlv-offline-content__desc">
              オフライン保存に対応すると、インターネット接続がなくても動画を視聴できます。
            </p>
            <p class="tlv-offline-content__note">現在は準備中です。</p>
            <button type="button" class="tlv-offline-content__cta" data-tlv-offline-cta>今後対応予定</button>
          </div>
        </div>
      </div>`;
  }

  function bindOfflinePage(roots) {
    roots.filter(Boolean).forEach((root) => {
      root.querySelectorAll("[data-tlv-offline-cta]").forEach((btn) => {
        btn.addEventListener("click", () => {
          global.alert("オフライン再生は今後対応予定です");
        });
      });
    });
  }

  function mountOfflinePage(root, options = {}) {
    const roots = (options.roots || [root]).filter(Boolean);
    const html = renderOfflinePageHtml();
    roots.filter(Boolean).forEach((r) => {
      r.innerHTML = html;
    });
    bindOfflinePage(roots);
  }

  global.TasuLiveOffline = {
    mountOfflinePage,
  };
})(typeof window !== "undefined" ? window : globalThis);
