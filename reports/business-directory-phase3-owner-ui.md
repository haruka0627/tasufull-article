# Business Directory Phase 3 — Owner UI

**日付:** 2026-06-27  
**種別:** 事業者 Self-Service UI（運営 UI / 公開検索 / Stripe なし）

---

## 成果物

| ファイル | 内容 |
| --- | --- |
| `business-directory/index.html` | 事業者ダッシュボード |
| `business-directory/new.html` | 新規掲載（最小フォーム） |
| `business-directory/edit.html` | タブ型編集 · プレビュー · 公開申請 |
| `business-directory/business-directory-owner.js` | UI ロジック · Phase 2 API 接続 |
| `business-directory/business-directory-*.js` | categories / plan / local store / common |
| `business-directory/business-directory.css` | Owner UI スタイル |
| `member-auth.js` | 会員ガード page 追加 |
| `scripts/test-business-directory-phase3-owner-ui.mjs` | 静的 + browser smoke |

---

## 画面

| URL | 機能 |
| --- | --- |
| `/business-directory/` | 掲載一覧 · ステータス · プラン · 公開申請状態 |
| `/business-directory/new.html` | 種別切替 · 最小初回フォーム · draft 作成 |
| `/business-directory/edit.html?id=` | 基本/写真/営業時間/プレビュー/公開 · TLV/SNS/実績ロック |

---

## API 接続

`business-directory-repository.js` 経由:

- `createDraftListing` · `updateDraftListing` · `getOwnerListings` · `getOwnerListingDetail` · `submitListingForReview`

ローカル検証: `?bdMock=1`（mock repository） · `?devSkipAuth=1`（member-auth dev skip）

写真 / 営業時間は Phase 2 API 未対応のため `business-directory-local-store.js` で UI 永続化。

---

## プラン制限 UI

- **Free:** 写真1枚
- **Standard:** SNS — 近日公開表示
- **Pro:** TLV / 上位表示 / AI紹介 — 近日公開表示
- プラン変更ボタン — disabled / Coming soon

---

## テスト

```bash
node scripts/test-business-directory-phase3-owner-ui.mjs
```

（browser smoke は `http://127.0.0.1:8788` 起動時）

---

## 未着手

- 運営審査 UI
- 公開検索ページ（`/shop-directory/:slug` 等）
- Stripe 課金
- 写真/営業時間の Edge API 永続化

---

## 境界

Marketplace / Platform / `listing-management.html` 非変更（参照なし）
