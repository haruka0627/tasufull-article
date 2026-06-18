# TasuFull（静的フロント）

HTML / CSS / JavaScript と Supabase を使ったマーケットプレイス UI です。

## ローカルで起動する（推奨）

`file:///` 直開きだと fetch・モジュール・一部画像読み込みで制限が出るため、**必ず HTTP サーバー経由**で確認してください。

### 初回

```bash
cd c:\Users\rubih\tasufull-article
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

ブラウザで次の URL が開きます（Vite 既定ポート **5173**）:

- スキル詳細（LEGEND 出品者確認）  
  http://localhost:5173/detail-skill.html?userId=u_me&id=skill_test_001

### その他のページ例

| ページ | URL |
|--------|-----|
| 一覧 | http://localhost:5173/index.html |
| TASFUL市場 TOP | http://localhost:5173/shop-store.html |
| 市場 商品検索 | http://localhost:5173/shop-search.html |
| 出品フォーム | http://localhost:5173/post.html |
| スキル詳細（DB id） | http://localhost:5173/detail-skill.html?id=YOUR_LISTING_UUID |

ポートが使用中の場合、Vite が別ポート（5174 等）を使います。ターミナルに表示された URL を開いてください。

### 本番ビルドプレビュー（任意）

```bash
npm run preview
```

## Supabase

接続設定は `chat-supabase-config.js`（サンプル: `chat-supabase-config.example.js`）。  
DB シードは `supabase/` 内の SQL を Supabase SQL Editor で実行してください。

## 画像アセット

ランクプレート: `images/rank/` — 詳細は `images/rank/README.md`
