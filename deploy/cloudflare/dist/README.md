# TasuFull（静的フロント）

HTML / CSS / JavaScript と Supabase を使ったマーケットプレイス UI です。

## ローカルで起動する

`file:///` 直開きだと fetch・モジュール・一部画像読み込みで制限が出るため、**必ず HTTP サーバー経由**で確認してください。

**標準 URL:** **http://127.0.0.1:8788/**（Cloudflare Pages dist + Wrangler Pages Dev）

詳細手順は **[docs/local-dev.md](docs/local-dev.md)** を参照してください。

### クイックスタート

```bash
cd c:\Users\rubih\tasufull-article
npm install

# Supabase（build:pages 用）
# $env:TASFUL_SUPABASE_URL / TASFUL_SUPABASE_ANON_KEY を設定

npm run build:pages
npm run dev
```

ブラウザ: http://127.0.0.1:8788/index.html

| ページ | URL |
|--------|-----|
| 一覧 | http://127.0.0.1:8788/index.html |
| TASFUL市場 TOP | http://127.0.0.1:8788/shop-store.html |
| 市場 商品検索 | http://127.0.0.1:8788/shop-search.html |
| 出品フォーム | http://127.0.0.1:8788/post.html |
| IWASHO TOP | http://127.0.0.1:8788/iwasho/ |

**5173（Vite）は標準確認に使いません。** Gen AI HMR 等が必要な場合のみ `npm run dev:vite`。

## Supabase

接続設定は `chat-supabase-config.js`（サンプル: `chat-supabase-config.example.js`）。  
DB シードは `supabase/` 内の SQL を Supabase SQL Editor で実行してください。

## 画像アセット

ランクプレート: `images/rank/` — 詳細は `images/rank/README.md`
