# Company Mobile UI Audit (390px)

- **Base URL:** http://127.0.0.1:8788
- **Viewport:** 390 × 844
- **Date:** 2026-06-20
- **Note:** コード修正なし・監査のみ

## Summary

| Page | Verdict | HTTP |
|------|---------|------|
| /company/ | **FIX_REQUIRED** | 200 |
| /company/services | **FIX_REQUIRED** | 200 |
| /company/platform | **FIX_REQUIRED** | 200 |
| /company/team | **FIX_REQUIRED** | 200 |
| /company/partners | **FIX_REQUIRED** | 200 |
| /company/about | **WARNING** | 200 |
| /company/faq | **FIX_REQUIRED** | 200 |
| /company/legal/terms | **WARNING** | 200 |
| /company/legal/privacy | **WARNING** | 200 |
| /company/legal/tokushoho | **WARNING** | 200 |

---

## /company/

**Verdict:** FIX_REQUIRED · HTTP 200

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | FIX_REQUIRED | ビューポート幅を超過 |
| フッター | PASS | 3列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"TASFUL PLATFORM","w":177,"h":42,"cls":"tas-hp-header__line-btn"}] |
| ヒーロー | WARNING | ヒーロータイトル要素未検出（画像ヒーロー） |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-home-full.png`

---

## /company/services

**Verdict:** FIX_REQUIRED · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/services`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | FIX_REQUIRED | ビューポート幅を超過 |
| フッター | PASS | 3列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"TASFUL PLATFORM","w":177,"h":42,"cls":"tas-hp-header__line-btn"}] |
| サービスカード | PASS | 幅 310, 310, 310, 310, 310px |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-services-full.png`

---

## /company/platform

**Verdict:** FIX_REQUIRED · HTTP 200

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | WARNING | custom-header 未検出 |
| フッター | FIX_REQUIRED | modern-footer 未検出 |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"メッセージ","w":107,"h":24,"cls":"home-icon-btn"},{"text":"お気に入り","w":107,"h":24,"cls":"home-icon-btn"},{"text":"出品する","w":64,"h":24,"cls":"home-cta"},{"text":"AI相談をはじめる","w":129,"h":24,"cls":"home-ai-btn"},{"text":"もっと見る","w":83,"h":26,"cls":"btn-outline"},{"text":"詳細を見る","w":80,"h":24,"cls":"btn-primary side-card__btn"}] |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-platform-full.png`

---

## /company/team

**Verdict:** FIX_REQUIRED · HTTP 200

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | WARNING | custom-header 未検出 |
| フッター | FIX_REQUIRED | modern-footer 未検出 |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"メッセージ","w":107,"h":24,"cls":"home-icon-btn"},{"text":"お気に入り","w":107,"h":24,"cls":"home-icon-btn"},{"text":"出品する","w":64,"h":24,"cls":"home-cta"},{"text":"AI相談をはじめる","w":129,"h":24,"cls":"home-ai-btn"},{"text":"もっと見る","w":83,"h":26,"cls":"btn-outline"},{"text":"詳細を見る","w":80,"h":24,"cls":"btn-primary side-card__btn"}] |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-team-full.png`

---

## /company/partners

**Verdict:** FIX_REQUIRED · HTTP 200

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | WARNING | custom-header 未検出 |
| フッター | FIX_REQUIRED | modern-footer 未検出 |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"メッセージ","w":107,"h":24,"cls":"home-icon-btn"},{"text":"お気に入り","w":107,"h":24,"cls":"home-icon-btn"},{"text":"出品する","w":64,"h":24,"cls":"home-cta"},{"text":"AI相談をはじめる","w":129,"h":24,"cls":"home-ai-btn"},{"text":"もっと見る","w":83,"h":26,"cls":"btn-outline"},{"text":"詳細を見る","w":80,"h":24,"cls":"btn-primary side-card__btn"}] |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-partners-full.png`

---

## /company/about

**Verdict:** WARNING · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/about`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | PASS | 高さ 90px / ナビ 非表示(SP想定) |
| フッター | PASS | 3列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"TASFUL PLATFORM","w":159,"h":40,"cls":"tas-hp-header__line-btn"}] |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-about-full.png`

---

## /company/faq

**Verdict:** FIX_REQUIRED · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/faq`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | PASS | 高さ 90px / ナビ 非表示(SP想定) |
| フッター | PASS | 3列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"TASFUL PLATFORM","w":159,"h":40,"cls":"tas-hp-header__line-btn"}] |
| Q&A検索UI | PASS | あり |
| FAQアコーディオン | FIX_REQUIRED | FAQ項目なし（空セクション） |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-faq-full.png`

---

## /company/legal/terms

**Verdict:** WARNING · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/legal/terms`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | PASS | 高さ 90px / ナビ 非表示(SP想定) |
| フッター | PASS | 3列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"TASFUL PLATFORM","w":159,"h":40,"cls":"tas-hp-header__line-btn"}] |
| 法務テーブル | PASS | テーブルなし（条文形式） |
| 法務長文可読性 | PASS | line-height 1.8 維持 / 横スクロールなし |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-terms-full.png`

---

## /company/legal/privacy

**Verdict:** WARNING · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/legal/privacy`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | PASS | 高さ 90px / ナビ 非表示(SP想定) |
| フッター | PASS | 3列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"TASFUL PLATFORM","w":159,"h":40,"cls":"tas-hp-header__line-btn"}] |
| 法務テーブル | PASS | 4 行 OK |
| 法務長文可読性 | PASS | line-height 1.8 維持 / 横スクロールなし |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-privacy-full.png`

---

## /company/legal/tokushoho

**Verdict:** WARNING · HTTP 200 · Redirect: `http://127.0.0.1:8788/company/legal/tokushoho`

| 確認項目 | 結果 | 詳細 |
|----------|------|------|
| 横スクロール | PASS | なし |
| ヘッダー | PASS | 高さ 90px / ナビ 非表示(SP想定) |
| フッター | PASS | 3列リンク / 2列グリッド |
| テキストサイズ | PASS | 概ね 12px 以上 |
| CTAタップ領域 | WARNING | [{"text":"TASFUL PLATFORM","w":159,"h":40,"cls":"tas-hp-header__line-btn"}] |
| 法務テーブル | PASS | 12 行 OK |
| 法務長文可読性 | PASS | line-height 1.8 維持 / 横スクロールなし |

Screenshot: `reports/screenshots/company-mobile-audit-390/company-tokushoho-full.png`

---

