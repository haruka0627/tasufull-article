import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
writeFileSync(
  join(root, "dashboard.html"),
  `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\u4F1A\u54E1\u30DA\u30FC\u30B8 | TASFUL</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="dashboard.css">
</head>
<body class="dash-body" data-page="dashboard">
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
            <h1 class="dash-header__title">\u4F1A\u54E1\u30DA\u30FC\u30B8</h1>
          </div>
          <div class="dash-header__actions">
            <a href="chat-list.html" class="dash-header-link" aria-label="\u30E1\u30C3\u30BB\u30FC\u30B8">
              <svg class="dash-header-link__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span class="dash-header-link__label">\u30E1\u30C3\u30BB\u30FC\u30B8</span>
              <span class="dash-header-link__badge" data-dash-msg-badge hidden>0</span>
            </a>
            <span class="dash-header__sep" aria-hidden="true"></span>
            <a href="#dash-notices" class="dash-header-link" aria-label="\u901A\u77E5">
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

      <main class="dash-content dash-shell" id="dashContent">
        <p class="dash-welcome" data-dash-welcome>\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026</p>

        <section class="dash-stats" id="dashStats" aria-label="\u30B5\u30DE\u30EA\u30FC"></section>

        <div class="dash-grid">
          <div class="dash-grid__primary">
            <section class="dash-card" id="dash-ongoing" aria-labelledby="dashOngoingTitle">
              <div class="dash-card__head">
                <h2 class="dash-card__title" id="dashOngoingTitle">\u9032\u884C\u4E2D\u306E\u53D6\u5F15</h2>
                <a class="dash-card__link" href="#dash-ongoing">\u4E00\u89A7\u3092\u898B\u308B \u2192</a>
              </div>
              <div class="dash-card__body" data-dash-ongoing-list></div>
            </section>

            <section class="dash-quick" aria-label="\u30AF\u30A4\u30C3\u30AF\u30A2\u30AF\u30B7\u30E7\u30F3" data-dash-quick></section>

            <p class="dash-disclaimer">
              TASFUL\u306F\u53D6\u5F15\u4EE3\u91D1\u3092\u9810\u304B\u308A\u307E\u305B\u3093\u3002\u652F\u6255\u3044\u30FB\u8FD4\u91D1\u30FB\u53D7\u3051\u6E21\u3057\u306F\u639B\u8F09\u8005\u3068\u4F9D\u983C\u8005\u306E\u9593\u3067\u884C\u3063\u3066\u304F\u3060\u3055\u3044\u3002\u6210\u7D04\u5F8C\u306ETASFUL\u624B\u6570\u6599\u306F\u639B\u8F09\u8005\u69D8\u3088\u308A\u304A\u652F\u6255\u3044\u3044\u305F\u3060\u304D\u307E\u3059\u3002
            </p>
          </div>

          <div class="dash-grid__secondary">
            <section class="dash-card" id="dash-notices" aria-labelledby="dashNoticesTitle">
              <div class="dash-card__head">
                <h2 class="dash-card__title" id="dashNoticesTitle">\u304A\u77E5\u3089\u305B\u30FB\u6700\u65B0\u60C5\u5831</h2>
              </div>
              <div class="dash-card__body" data-dash-notices></div>
            </section>

            <section class="dash-card" id="dash-fees" aria-labelledby="dashFeesTitle">
              <div class="dash-card__head">
                <h2 class="dash-card__title" id="dashFeesTitle">TASFUL\u624B\u6570\u6599\u306B\u3064\u3044\u3066</h2>
              </div>
              <div class="dash-card__body dash-card__body--padded" data-dash-fee-panel></div>
            </section>
          </div>
        </div>
      </main>
    </div>
  </div>

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
  <script src="dashboard.js"></script>
</body>
</html>`,
  "utf8"
);
console.log("ok");
