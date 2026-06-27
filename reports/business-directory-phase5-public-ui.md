# Business Directory Phase 5 — Public Listing / Search UI

**日付:** 2026-06-27  
**種別:** 公開一覧 · 詳細 · 検索（Stripe / 予約 / チャット なし）

---

## 成果物

| ファイル | 内容 |
| --- | --- |
| `business-directory/public/list.html` | 公開一覧 + 検索/フィルター |
| `business-directory/public/detail.html` | 公開詳細 |
| `business-directory/public/business-directory-public.js` | Public UI · mock · hp_mode |
| `business-directory/public/business-directory-public.css` | Public スタイル |
| `index-top.html` · `business.html` · `shop-store.html` | 市場TOP導線（追加のみ） |
| `scripts/test-business-directory-phase5-public-ui.mjs` | 35+ 静的 + browser |

---

## 公開制御

- **API:** `business_directory_listings_public` view + `getPublicListingDetail` の `status=published`
- **Mock:** `bdPublicMock=1` — non-published を API 層相当で除外

---

## 検索 / フィルター

キーワード · 種別 · カテゴリ · 地域 · 並び替え（新着/プラン/名前） · ページネーション（12件）

---

## hp_mode

- **external_redirect:** 最小情報 + 公式サイト CTA
- **full_page:** 写真 · 紹介 · 営業時間 · 商品/サービス中心

---

## テスト

```bash
node scripts/test-business-directory-phase5-public-ui.mjs
```

`?bdPublicMock=1`

---

## 未着手

Stripe · 予約 · 見積 · チャット

---

## 境界

Owner / Admin UI 非変更 · Marketplace 既存リンク維持（導線追加のみ）
