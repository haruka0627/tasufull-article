/**
 * TASFUL LIVE — 通知一覧（プレースホルダー）
 */
(function (global) {
  "use strict";

  function renderNotificationsPageHtml() {
    return `
      <div class="live-empty tlv-notifications-page">
        <p class="live-empty__title">通知はまだありません</p>
        <p class="live-empty__text">ライブ配信・コメント・フォローなどの通知は、今後ここに表示されます。</p>
      </div>`;
  }

  function mountNotificationsPage(root, options = {}) {
    const roots = (options.roots || [root]).filter(Boolean);
    const html = renderNotificationsPageHtml();
    roots.forEach((r) => {
      r.innerHTML = html;
    });
  }

  global.TasuLiveNotificationsPage = {
    mountNotificationsPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
