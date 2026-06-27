# Platform all-browser — 現行失敗ログ

実行日: 2026-06-26

## 実行コマンド

```bash
BASE_URL=http://127.0.0.1:8788 node scripts/test-platform-all-browser.mjs
```

## BASE_URL

`http://127.0.0.1:8788`（`npm run dev` / wrangler pages dev）

## 結果

exit code: **1** — SUMMARY: FAIL (7 failures)

ReferenceError (`errors is not defined`) は **解消済み**（commit `760ea15`）。

### 合格セクション（抜粋）

- 投稿フォーム 6/6
- job-top / shop-store / business カード件数 OK
- 詳細ページ 6/6
- 会員導線 10/10
- TALK連携 5/5
- レスポンシブ 15/15

### 失敗 7件（SUMMARY）

```
- index-top: 求人一覧 (missing)
- index-top: AI相談 (missing)
- index-top: TALK導線(chat-list) (missing)
- index.html: 求人 (missing)
- index skill: カード0件
- index worker: カード0件
- index product: カード0件
```

### 合格した index-top / index 導線（参考）

```
✓ index-top: スキル一覧 → /market/?category=skill
✓ index-top: ワーカー一覧 → /market/?category=worker
✓ index-top: 商品一覧 → /market/?category=product
✓ index-top: 店舗・販売 → shop-store.html
✓ index-top: 業務サービス → business.html
✓ index.html: 一般TOP 表示
✓ index.html: 店舗・販売 → shop-store.html
✓ index.html: 業務サービス → business.html
✓ index.html: AI相談 → index-top.html
```
