import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const memberScripts = `
  <script src="dashboard-guard.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="chat-supabase-config.js"></script>
  <script src="supabase-public-key.js"></script>
  <script src="tasu-supabase-client.js"></script>
  <script src="chat-user-identity.js"></script>
  <script src="chat-supabase.js"></script>
  <script src="chat-service.js"></script>
  <script src="service-deals-db.js"></script>
  <script src="favorites-db.js"></script>
  <script src="business-service-data.js"></script>
  <script src="business-board-demo.js"></script>
  <script src="dashboard-data.js"></script>
  <script src="dashboard.js"></script>`;

function memberShell({ page, title, headerTitle, mainContent, pageScript }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | TASFUL</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="dashboard.css">
</head>
<body class="dash-body" data-page="${page}">
  <div class="dash-app">
    <div class="dash-sidebar__overlay" data-dash-overlay aria-hidden="true"></div>

    <aside class="dash-sidebar" id="dashSidebar" aria-label="\u4F1A\u54E1\u30E1\u30CB\u30E5\u30FC">
      <div class="dash-sidebar__brand">TASFUL</div>
      <nav class="dash-sidebar__nav" id="dashSidebarNav" aria-label="\u30B5\u30A4\u30C9\u30CA\u30D3"></nav>
    </aside>

    <div class="dash-main">
      <header class="dash-header">
        <div class="dash-shell dash-header__inner">
          <div class="dash-header__left">
            <button type="button" class="dash-menu-btn" data-dash-menu aria-label="\u30E1\u30CB\u30E5\u30FC\u3092\u958B\u304F">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <h1 class="dash-header__title">${headerTitle}</h1>
          </div>
          <div class="dash-header__actions">
            <a href="chat-list.html" class="dash-header-link" aria-label="\u30E1\u30C3\u30BB\u30FC\u30B8">
              <svg class="dash-header-link__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span class="dash-header-link__label">\u30E1\u30C3\u30BB\u30FC\u30B8</span>
              <span class="dash-header-link__badge" data-dash-msg-badge hidden>0</span>
            </a>
            <span class="dash-header__sep" aria-hidden="true"></span>
            <a href="dashboard.html#dash-notices" class="dash-header-link" aria-label="\u901A\u77E5">
              <svg class="dash-header-link__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span class="dash-header-link__label">\u901A\u77E5</span>
              <span class="dash-header-link__badge" data-dash-notice-badge hidden>0</span>
            </a>
            <span class="dash-header__sep" aria-hidden="true"></span>
            <a href="profile-settings.html" class="dash-profile" aria-label="\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB">
              <img class="dash-profile__avatar" data-dash-avatar src="https://placehold.co/64x64/f3ead4/967622?text=ME" width="40" height="40" alt="">
              <span class="dash-profile__text">
                <span class="dash-profile__name" data-dash-user-name>\u4F1A\u54E1</span>
                <span class="dash-profile__sub">\u500B\u4EBA\u30FB\u4E8B\u696D\u8005</span>
              </span>
              <svg class="dash-profile__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </a>
          </div>
        </div>
      </header>

      <main class="dash-content dash-shell">
        ${mainContent}
      </main>
    </div>
  </div>
${memberScripts}
  <script src="${pageScript}"></script>
</body>
</html>`;
}

writeFileSync(
  join(root, "profile-settings.html"),
  memberShell({
    page: "profile-settings",
    title: "\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u8A2D\u5B9A",
    headerTitle: "\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u8A2D\u5B9A",
    mainContent: `
        <section class="dash-card dash-settings" aria-labelledby="profileSettingsTitle">
          <div class="dash-card__head">
            <h2 class="dash-card__title" id="profileSettingsTitle">\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u8A2D\u5B9A</h2>
          </div>
          <div class="dash-card__body dash-card__body--padded">
            <p class="dash-settings__lead">\u8868\u793A\u540D\u3084\u30CB\u30C3\u30AF\u30CD\u30FC\u30E0\u3092\u7DE8\u96C6\u3067\u304D\u307E\u3059\u3002</p>
            <form class="dash-settings__form" data-profile-form novalidate>
              <div class="dash-field">
                <label class="dash-field__label" for="profileNickname">\u30CB\u30C3\u30AF\u30CD\u30FC\u30E0</label>
                <input class="dash-field__input" id="profileNickname" type="text" name="nickname" data-profile-nickname autocomplete="nickname" required>
              </div>
              <div class="dash-field">
                <label class="dash-field__label" for="profileEmail">\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9</label>
                <input class="dash-field__input" id="profileEmail" type="email" data-profile-email readonly aria-readonly="true">
                <p class="dash-field__hint">\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u306E\u5909\u66F4\u306F\u5225\u9014\u304A\u554F\u3044\u5408\u308F\u305B\u304F\u3060\u3055\u3044\u3002</p>
              </div>
              <p class="dash-field__error" data-profile-error hidden></p>
              <div class="dash-settings__actions">
                <button type="submit" class="dash-btn dash-btn--primary" data-profile-submit>\u4FDD\u5B58\u3059\u308B</button>
              </div>
            </form>
            <p class="dash-settings__toast" data-profile-toast hidden role="status"></p>
          </div>
        </section>`,
    pageScript: "profile-settings.js",
  }),
  "utf8"
);

writeFileSync(
  join(root, "account-settings.html"),
  memberShell({
    page: "account-settings",
    title: "\u652F\u6255\u3044\u30FB\u53E3\u5EA7\u7BA1\u7406",
    headerTitle: "\u652F\u6255\u3044\u30FB\u53E3\u5EA7\u7BA1\u7406",
    mainContent: `
        <section class="dash-card dash-settings" aria-labelledby="accountPaymentTitle">
          <div class="dash-card__head">
            <h2 class="dash-card__title" id="accountPaymentTitle">\u652F\u6255\u3044\u65B9\u6CD5</h2>
          </div>
          <div class="dash-card__body dash-card__body--padded">
            <p class="dash-settings__lead">TASFUL\u624B\u6570\u6599\u306E\u304A\u652F\u6255\u3044\u306F\u3001\u6210\u7D04\u5F8C\u306B\u8868\u793A\u3055\u308C\u308B\u624B\u6570\u6599\u652F\u6255\u3044\u753B\u9762\u304B\u3089\u884C\u3044\u307E\u3059\u3002</p>
            <a class="dash-btn dash-btn--secondary" href="dashboard.html#dash-fees" data-account-fee-link hidden>\u672A\u6255\u3044\u624B\u6570\u6599\u3092\u78BA\u8A8D\u3059\u308B</a>
          </div>
        </section>

        <section class="dash-card dash-settings" aria-labelledby="accountPayoutTitle">
          <div class="dash-card__head">
            <h2 class="dash-card__title" id="accountPayoutTitle">\u632F\u8FBC\u53E3\u5EA7\u7BA1\u7406</h2>
          </div>
          <div class="dash-card__body dash-card__body--padded">
            <p class="dash-settings__lead" data-account-payout-note>\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026</p>
            <a class="dash-btn dash-btn--secondary" href="post.html?scope=business">\u639B\u8F09\u7BA1\u7406\u3078</a>
          </div>
        </section>

        <section class="dash-card dash-settings" id="notifications" aria-labelledby="accountNotifyTitle">
          <div class="dash-card__head">
            <h2 class="dash-card__title" id="accountNotifyTitle">\u901A\u77E5\u8A2D\u5B9A</h2>
          </div>
          <div class="dash-card__body dash-card__body--padded">
            <p class="dash-settings__lead">\u304A\u77E5\u3089\u305B\u306F\u4F1A\u54E1\u30DA\u30FC\u30B8\u306E\u901A\u77E5\u30A8\u30EA\u30A2\u3067\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002</p>
            <a class="dash-btn dash-btn--secondary" href="dashboard.html#dash-notices">\u304A\u77E5\u3089\u305B\u3092\u898B\u308B</a>
          </div>
        </section>`,
    pageScript: "account-settings.js",
  }),
  "utf8"
);

console.log("Wrote profile-settings.html and account-settings.html");
