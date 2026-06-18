import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
writeFileSync(join(root, "signup.html"), `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\u4F1A\u54E1\u767B\u9332 | TASFUL</title>
  <meta name="description" content="TASFUL\u306E\u65B0\u898F\u4F1A\u54E1\u767B\u9332 \u2014 AI\u3068\u306E\u4F1A\u8A71\u3001\u4ED5\u4E8B\u63A2\u3057\u3001\u5E97\u8217\u30B5\u30FC\u30D3\u30B9\u307E\u3067\u3059\u3079\u3066\u306E\u6A5F\u80FD\u3092\u3054\u5229\u7528\u3044\u305F\u3060\u3051\u307E\u3059\u3002">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="signup.css">
  <link rel="stylesheet" href="tasful-ai-logo.css?v=4">
</head>
<body class="signup-page">
  <header class="signup-header" aria-label="TASFUL \u30D8\u30C3\u30C0\u30FC">
    <div class="signup-header__inner">
      <a href="index-top.html" class="tasful-ai-logo signup-header__logo" aria-label="TASFUL \u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0TOP">
        <img src="images/tasful-ai-globe.png?v=4" alt="" class="tasful-ai-logo-icon" decoding="async">
        <div class="tasful-ai-logo-text">
          <span class="main">TASFUL</span>
          <span class="sub">\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0</span>
        </div>
      </a>
      <nav class="signup-nav" aria-label="\u30E1\u30A4\u30F3\u30CA\u30D3">
        <a href="index-top.html">\u30B5\u30FC\u30D3\u30B9</a>
        <a href="gen-ai-workspace.html">AI\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC</a>
        <a href="job-top.html">\u6C42\u4EBA\u3092\u63A2\u3059</a>
        <a href="index.html">\u30EF\u30FC\u30AB\u30FC\u3092\u63A2\u3059</a>
        <a href="shop-store.html">\u5E97\u8217\u30FB\u30B5\u30FC\u30D3\u30B9</a>
      </nav>
      <div class="signup-header__actions">
        <a class="signup-header__login" href="dashboard.html">\u30ED\u30B0\u30A4\u30F3</a>
        <a class="signup-header__register signup-header__register--current" href="signup.html" aria-current="page">\u4F1A\u54E1\u767B\u9332</a>
      </div>
    </div>
  </header>
  <main class="signup-main" aria-label="\u4F1A\u54E1\u767B\u9332">
    <div class="signup-layout">
      <div class="signup-left">
        <div class="signup-copy">
          <p class="signup-left__eyebrow">\u65B0\u898F\u4F1A\u54E1\u767B\u9332</p>
          <h1 class="signup-left__title">TASFUL\u3092\u306F\u3058\u3081\u3088\u3046</h1>
          <p class="signup-left__lead">AI\u3068\u306E\u4F1A\u8A71\u3001\u4ED5\u4E8B\u63A2\u3057\u3001\u5E97\u8217\u30B5\u30FC\u30D3\u30B9\u306E\u5229\u7528\u307E\u3067<br>\u3059\u3079\u3066\u306E\u6A5F\u80FD\u3092\u3054\u5229\u7528\u3044\u305F\u3060\u3051\u307E\u3059\u3002</p>
        </div>
        <div class="signup-feature-card" aria-label="TASFUL\u3067\u3067\u304D\u308B\u3053\u3068">
          <h3 class="signup-feature-card-title">TASFUL\u3067\u3067\u304D\u308B\u3053\u3068 \u2728</h3>
          <div class="signup-feature-list">
            <div class="signup-feature-item">
              <div class="signup-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
              <div class="signup-feature-label">AI\u3068\u4F1A\u8A71</div>
              <p class="signup-feature-desc">AI\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u3068\u81EA\u7136\u306B\u4F1A\u8A71</p>
            </div>
            <div class="signup-feature-item">
              <div class="signup-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div>
              <div class="signup-feature-label">\u4ED5\u4E8B\u3092\u63A2\u3059</div>
              <p class="signup-feature-desc">\u81EA\u5206\u306B\u5408\u3063\u305F\u4ED5\u4E8B\u304C\u898B\u3064\u304B\u308B</p>
            </div>
            <div class="signup-feature-item">
              <div class="signup-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
              <div class="signup-feature-label">\u30EF\u30FC\u30AB\u30FC\u3092\u63A2\u3059</div>
              <p class="signup-feature-desc">\u30B9\u30AD\u30EB\u3084\u6761\u4EF6\u3067\u6700\u9069\u306A\u4EBA\u6750\u3092\u767A\u898B</p>
            </div>
            <div class="signup-feature-item">
              <div class="signup-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
              <div class="signup-feature-label">\u5E97\u8217\u30FB\u30B5\u30FC\u30D3\u30B9\u3092\u63A2\u3059</div>
              <p class="signup-feature-desc">\u5168\u56FD\u306E\u5E97\u8217\u3084\u30B5\u30FC\u30D3\u30B9\u3092\u691C\u7D22</p>
            </div>
            <div class="signup-feature-item">
              <div class="signup-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
              <div class="signup-feature-label">\u304A\u6C17\u306B\u5165\u308A\u7BA1\u7406</div>
              <p class="signup-feature-desc">\u6C17\u306B\u306A\u308B\u60C5\u5831\u3092\u307E\u3068\u3081\u3066\u7BA1\u7406</p>
            </div>
          </div>
        </div>
        <div class="signup-character-wrap">
          <img
            class="signup-character"
            src="images/signup-character.png?v=5"
            alt="TASFUL\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC"
            decoding="async"
          >
        </div>
      </div>
      <section class="signup-form-area" aria-label="\u4F1A\u54E1\u767B\u9332\u30D5\u30A9\u30FC\u30E0">
        <div class="signup-card">
          <header class="signup-card__head">
            <h2 class="signup-card__title">\u4F1A\u54E1\u767B\u9332</h2>
            <p class="signup-card__subtitle">\u30A2\u30AB\u30A6\u30F3\u30C8\u60C5\u5831\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044</p>
          </header>
          <div class="signup-tabs" role="tablist" aria-label="\u4F1A\u54E1\u7A2E\u5225">
            <button type="button" class="signup-tabs__btn is-active" role="tab" id="signup-tab-individual" aria-selected="true" aria-controls="signup-panel-individual" data-signup-member-type="individual"><span class="signup-tabs__main">\u4E00\u822C\u4F1A\u54E1</span><span class="signup-tabs__sub">\u500B\u4EBA\u3067\u3054\u5229\u7528\u306E\u65B9</span></button>
            <button type="button" class="signup-tabs__btn" role="tab" id="signup-tab-business" aria-selected="false" aria-controls="signup-panel-business" data-signup-member-type="business"><span class="signup-tabs__main">\u696D\u8005\u30FB\u6CD5\u4EBA</span><span class="signup-tabs__sub">\u6CD5\u4EBA\u30FB\u4E8B\u696D\u8005\u306E\u65B9</span></button>
          </div>
          <form class="signup-form" data-signup-form novalidate>
            <input type="hidden" name="memberType" value="individual" data-signup-member-type-input>
            <div class="signup-form__panel" id="signup-panel-individual" role="tabpanel" aria-labelledby="signup-tab-individual">
              <div class="signup-field"><label class="signup-field__label" for="signup-email">\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9</label><input class="signup-field__input" type="email" id="signup-email" name="email" autocomplete="email" inputmode="email" placeholder="example@mail.com" required data-signup-email><p class="signup-field__error" data-signup-error="email" hidden></p></div>
              <div class="signup-field"><label class="signup-field__label" for="signup-password">\u30D1\u30B9\u30EF\u30FC\u30C9</label><div class="signup-field__password"><input class="signup-field__input" type="password" id="signup-password" name="password" autocomplete="new-password" placeholder="\u534A\u89D2\u82F1\u65708\u6587\u5B57\u4EE5\u4E0A" minlength="8" required data-signup-password><button type="button" class="signup-field__toggle" data-signup-password-toggle aria-label="\u30D1\u30B9\u30EF\u30FC\u30C9\u3092\u8868\u793A" aria-pressed="false"><svg class="signup-field__toggle-icon signup-field__toggle-icon--show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><svg class="signup-field__toggle-icon signup-field__toggle-icon--hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true" hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg></button></div><p class="signup-field__error" data-signup-error="password" hidden></p></div>
              <div class="signup-field"><label class="signup-field__label" for="signup-nickname">\u30CB\u30C3\u30AF\u30CD\u30FC\u30E0</label><input class="signup-field__input" type="text" id="signup-nickname" name="nickname" autocomplete="nickname" maxlength="40" placeholder="\u30CB\u30C3\u30AF\u30CD\u30FC\u30E0\u3092\u5165\u529B\uFF08\u516C\u958B\u3055\u308C\u307E\u3059\uFF09" required data-signup-nickname><p class="signup-field__hint">\u203B\u5F8C\u304B\u3089\u5909\u66F4\u3067\u304D\u307E\u3059</p><p class="signup-field__error" data-signup-error="nickname" hidden></p></div>
            </div>
            <label class="signup-agree"><input type="checkbox" name="agree" required data-signup-agree><span class="signup-agree__box" aria-hidden="true"></span><span class="signup-agree__text"><a href="/contact" class="signup-agree__link">\u5229\u7528\u898F\u7D04</a> \u3068 <a href="/contact" class="signup-agree__link">\u30D7\u30E9\u30A4\u30D0\u30B7\u30FC\u30DD\u30EA\u30B7\u30FC</a> \u306B\u540C\u610F\u3059\u308B</span></label>
            <p class="signup-field__error signup-field__error--center" data-signup-error="agree" hidden></p>
            <button type="submit" class="signup-submit" data-signup-submit>\u7121\u6599\u3067\u4F1A\u54E1\u767B\u9332</button>
            <div class="signup-divider" aria-hidden="true"><span>\u307E\u305F\u306F</span></div>
            <div class="signup-social">
              <button type="button" class="signup-social__btn" data-signup-social="google"><span class="signup-social__icon" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg></span><span>Google\u3067\u767B\u9332</span></button>
              <button type="button" class="signup-social__btn signup-social__btn--line" data-signup-social="line"><img class="signup-social__img signup-social__img--line" src="images/LINE_Brand_icon(1).png" alt="LINE"><span>LINE\u3067\u767B\u9332</span></button>
            </div>
            <p class="signup-card__footer">\u3059\u3067\u306B\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u304A\u6301\u3061\u306E\u65B9\u306F <a href="dashboard.html" class="signup-card__footer-link">\u30ED\u30B0\u30A4\u30F3</a></p>
          </form>
          <div class="signup-toast" data-signup-toast hidden role="status" aria-live="polite"></div>
        </div>
      </section>
    </div>
  </main>
  <script src="signup.js" defer></script>
</body>
</html>`, "utf8");
console.log("ok");
