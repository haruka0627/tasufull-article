# Company Mobile UI Audit (390px)

- **Base URL:** http://127.0.0.1:8788
- **Viewport:** 390 × 844
- **Date:** 2026-06-26
- **Note:** コード修正なし・監査のみ

## Summary

| Page | Verdict | HTTP |
|------|---------|------|
| /company/ | **FIX_REQUIRED** | 200 |
| /company/services | **FIX_REQUIRED** | 200 |
| /company/platform | **FIX_REQUIRED** | 200 |
| /company/team | **FIX_REQUIRED** | 200 |
| /company/partners | **FIX_REQUIRED** | 200 |
| /company/about | **FIX_REQUIRED** | 200 |
| /company/faq | **FIX_REQUIRED** | 200 |
| /company/legal/terms | **FIX_REQUIRED** | 200 |
| /company/legal/privacy | **FIX_REQUIRED** | 200 |
| /company/legal/tokushoho | **FIX_REQUIRED** | 200 |

---

## /company/

**Verdict:** FIX_REQUIRED · HTTP 200

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | FIX_REQUIRED | ビューポート幅を超過 |
| フッター | PASS | 4列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | PASS | 4 件 ≥44px |
| ヒーロー | WARNING | ヒーロータイトル要素未検出（画像ヒーロー） |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-home-full.png`

---

## /company/services

**Verdict:** FIX_REQUIRED · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/services`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | FIX_REQUIRED | ビューポート幅を超過 |
| フッター | PASS | 4列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | PASS | 12 件 ≥44px |
| サービスカード | PASS | 幅 310, 310, 310, 310, 310px |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-services-full.png`

---

## /company/platform

**Verdict:** FIX_REQUIRED · HTTP 200

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | FIX_REQUIRED | 571px > 390px ([{"tag":"IMG","cls":"tas-hero__ai-card-img","w":563}]) |
| ヘッダー | WARNING | custom-header 未検出 |
| フッター | FIX_REQUIRED | modern-footer 未検出 |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"無料で登録する","w":112,"h":24,"cls":"top-site-header__cta top-portal-header__register"},{"text":"現在地","w":56,"h":26,"cls":"platform-search-hub__btn"},{"text":"TASFUL AI検索","w":108,"h":26,"cls":"platform-search-hub__btn platform-search-hub__btn-"},{"text":"AI比較","w":55,"h":26,"cls":"platform-search-hub__btn"},{"text":"","w":38,"h":31,"cls":"top-search__btn"},{"text":"無料で始める →","w":117,"h":24,"cls":"top-site-footer__btn top-site-footer__btn--gold"},{"text":"サービスについて →","w":149,"h":24,"cls":"top-site-footer__btn top-site-footer__btn--outline"}] |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-platform-full.png`

---

## /company/team

**Verdict:** FIX_REQUIRED · HTTP 200

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | FIX_REQUIRED | 571px > 390px ([{"tag":"IMG","cls":"tas-hero__ai-card-img","w":563}]) |
| ヘッダー | WARNING | custom-header 未検出 |
| フッター | FIX_REQUIRED | modern-footer 未検出 |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"無料で登録する","w":112,"h":24,"cls":"top-site-header__cta top-portal-header__register"},{"text":"現在地","w":56,"h":26,"cls":"platform-search-hub__btn"},{"text":"TASFUL AI検索","w":108,"h":26,"cls":"platform-search-hub__btn platform-search-hub__btn-"},{"text":"AI比較","w":55,"h":26,"cls":"platform-search-hub__btn"},{"text":"","w":38,"h":31,"cls":"top-search__btn"},{"text":"無料で始める →","w":117,"h":24,"cls":"top-site-footer__btn top-site-footer__btn--gold"},{"text":"サービスについて →","w":149,"h":24,"cls":"top-site-footer__btn top-site-footer__btn--outline"}] |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-team-full.png`

---

## /company/partners

**Verdict:** FIX_REQUIRED · HTTP 200

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | FIX_REQUIRED | 571px > 390px ([{"tag":"IMG","cls":"tas-hero__ai-card-img","w":563}]) |
| ヘッダー | WARNING | custom-header 未検出 |
| フッター | FIX_REQUIRED | modern-footer 未検出 |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"無料で登録する","w":112,"h":24,"cls":"top-site-header__cta top-portal-header__register"},{"text":"現在地","w":56,"h":26,"cls":"platform-search-hub__btn"},{"text":"TASFUL AI検索","w":108,"h":26,"cls":"platform-search-hub__btn platform-search-hub__btn-"},{"text":"AI比較","w":55,"h":26,"cls":"platform-search-hub__btn"},{"text":"","w":38,"h":31,"cls":"top-search__btn"},{"text":"無料で始める →","w":117,"h":24,"cls":"top-site-footer__btn top-site-footer__btn--gold"},{"text":"サービスについて →","w":149,"h":24,"cls":"top-site-footer__btn top-site-footer__btn--outline"}] |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-partners-full.png`

---

## /company/about

**Verdict:** FIX_REQUIRED · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/about`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | FIX_REQUIRED | ビューポート幅を超過 |
| フッター | PASS | 4列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | PASS | 2 件 ≥44px |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-about-full.png`

---

## /company/faq

**Verdict:** FIX_REQUIRED · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/faq`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | FIX_REQUIRED | ビューポート幅を超過 |
| フッター | PASS | 4列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | PASS | 2 件 ≥44px |
| Q&A検索UI | PASS | あり |
| FAQアコーディオン | FIX_REQUIRED | FAQ項目なし（空セクション） |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-faq-full.png`

---

## /company/legal/terms

**Verdict:** FIX_REQUIRED · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/legal/terms`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | FIX_REQUIRED | ビューポート幅を超過 |
| フッター | PASS | 4列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | PASS | 1 件 ≥44px |
| 法務テーブル | PASS | テーブルなし（条文形式） |
| 法務長文可読性 | PASS | line-height 1.8 維持 / 横スクロールなし |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-terms-full.png`

---

## /company/legal/privacy

**Verdict:** FIX_REQUIRED · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/legal/privacy`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | FIX_REQUIRED | ビューポート幅を超過 |
| フッター | PASS | 4列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | PASS | 1 件 ≥44px |
| 法務テーブル | PASS | 4 行 OK |
| 法務長文可読性 | PASS | line-height 1.8 維持 / 横スクロールなし |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-privacy-full.png`

---

## /company/legal/tokushoho

**Verdict:** FIX_REQUIRED · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/legal/tokushoho`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | FIX_REQUIRED | ビューポート幅を超過 |
| フッター | PASS | 4列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | PASS | 1 件 ≥44px |
| 法務テーブル | PASS | 12 行 OK |
| 法務長文可読性 | PASS | line-height 1.8 維持 / 横スクロールなし |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-tokushoho-full.png`

---

