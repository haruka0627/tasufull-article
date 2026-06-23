# ローカル開発・確認手順

TasuFull フロントのローカル確認は **Cloudflare Pages 相当の dist** を **`http://127.0.0.1:8788/`** で配信する運用に統一します。

| 用途 | 標準 URL |
|------|----------|
| 手動ブラウザ確認 | `http://127.0.0.1:8788/` |
| HP レビュー（IWASHO / company） | `http://127.0.0.1:8788/iwasho/` 等 |
| UI レビュー | `http://127.0.0.1:8788/<page>.html` |
| Playwright キャプチャ / verify | 自動検出 → **8788**（`scripts/lib/dev-server-url.mjs`） |
| smoke test | `npm run smoke:pages` → **8788** |

**使用しない:** `npm run dev:vite`（5173）、Live Server 5500、`file://` 直開き。

---

## 前提

- Node.js 18+
- リポジトリルート: `c:\Users\rubih\tasufull-article`
- Supabase 設定: ルートの `chat-supabase-config.js`（例: `chat-supabase-config.example.js` をコピー）

---

## 初回セットアップ

```powershell
cd c:\Users\rubih\tasufull-article
npm install
```

`chat-supabase-config.js` が未作成なら example からコピーして値を設定してください。

---

## 標準起動（毎回）

### 1. dist を生成

Cloudflare Pages と同じ内容を `deploy/cloudflare/dist/` にステージします。

```powershell
$env:TASFUL_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:TASFUL_SUPABASE_ANON_KEY="eyJ...your-anon-key..."
npm run build:pages
npm run verify:pages-stage
```

`TASFUL_*` は Dashboard → Settings → API の **Project URL** と **anon public** を使用します。  
（本番 dist には `currentUserId` / `me` / `u_me` は含まれません。）

ソースを編集したら **必ず `npm run build:pages` を再実行**してから確認してください。

### 2. ローカルサーバー起動

```powershell
npm run dev
```

内部では **Wrangler Pages Dev** が dist を配信します。

| 項目 | 値 |
|------|-----|
| ベース URL | **http://127.0.0.1:8788/** |
| バインド | `127.0.0.1:8788` のみ |
| 配信元 | `deploy/cloudflare/dist/` |

dist が無い場合は `npm run build:pages` を促すメッセージが出ます。

**ビルドと起動を一度に:**

```powershell
npm run dev:fresh
```

---

## 手動確認 URL 例

| ページ | URL |
|--------|-----|
| TOP | http://127.0.0.1:8788/index.html |
| TASFUL 市場 TOP | http://127.0.0.1:8788/shop-store.html |
| Talk ホーム | http://127.0.0.1:8788/talk-home.html |
| ダッシュボード | http://127.0.0.1:8788/dashboard.html |
| 出品フォーム | http://127.0.0.1:8788/post.html |
| Builder MVP | http://127.0.0.1:8788/builder/ |
| AI Workspace | http://127.0.0.1:8788/ai-workspace.html |

### HP レビュー（コーポレート / IWASHO）

| ページ | URL |
|--------|-----|
| IWASHO TOP | http://127.0.0.1:8788/iwasho/ |
| IWASHO about | http://127.0.0.1:8788/iwasho/about.html |
| Company TOP | http://127.0.0.1:8788/company/ |
| 利用規約 | http://127.0.0.1:8788/company/legal/terms.html |

Playwright キャプチャ例:

```powershell
npm run dev
node scripts/capture-iwasho-home-top.mjs
```

---

## Playwright キャプチャ / verify

1. 別ターミナルで `npm run dev` を起動した状態にする
2. スクリプトを実行

```powershell
# 市場 UI
npm run verify:market-top

# ショップ UX 一括
npm run verify

# ベンチ（2窓デモ）
node scripts/capture-chat-dual-window-demo-390.mjs
```

### ベース URL の決まり方

| 優先 | 設定 |
|------|------|
| 1 | 環境変数 `BASE_URL` / `PAGES_BASE_URL` / `BENCH_BASE_URL` |
| 2 | `http://127.0.0.1:8788` を自動プローブ |

明示指定例:

```powershell
$env:BASE_URL="http://127.0.0.1:8788"
node scripts/test-anpi-dashboard-browser.mjs
```

Ops ダッシュボード系（`file://` 回避）:

```powershell
$env:BUILDER_BASE_URL="http://127.0.0.1:8788"
node scripts/test-admin-ops-dashboard-ui-final.mjs
```

---

## smoke test

```powershell
# ターミナル 1
npm run dev

# ターミナル 2
npm run smoke:pages
```

デプロイ後（`*.pages.dev`）:

```powershell
node scripts/smoke-cloudflare-pages.mjs --base https://<project-name>.pages.dev
```

---

## 環境変数一覧

| 変数 | 用途 |
|------|------|
| `TASFUL_SUPABASE_URL` | `npm run build:pages` 時の config 生成 |
| `TASFUL_SUPABASE_ANON_KEY` | 同上 |
| `BASE_URL` | Playwright / 手動テストの origin 上書き |
| `PAGES_BASE_URL` | smoke / Pages 向け origin |
| `BENCH_BASE_URL` | 2窓ベンチ系スクリプト |
| `BUILDER_BASE_URL` | 運営ダッシュボード browser テスト |

---

## トラブルシュート

### `deploy/cloudflare/dist が見つかりません`

```powershell
npm run build:pages
```

### `Dev server not reachable` / Playwright が 8788 に繋がらない

- `npm run dev` が起動中か確認
- ファイアウォールで `127.0.0.1:8788` をブロックしていないか確認
- ソース変更後に `npm run build:pages` を忘れていないか確認

### 5173 で開いてしまう

5173 は **Vite 専用（非推奨）** です。Gen AI 3D 等の Vite HMR が必要な場合のみ:

```powershell
npm run dev:vite
```

通常の HP / UI / 市場 / Talk / Builder 確認は **8788 + wrangler** を使用してください。

### `npx wrangler` が初回だけ遅い

Wrangler は `npx` 経由で取得されます。2 回目以降はキャッシュされます。  
頻繁に使う場合は `npm i -D wrangler` も可（任意）。

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `deploy/cloudflare/stage-cloudflare-pages.mjs` | dist 生成 |
| `scripts/lib/dev-server-url.mjs` | 標準 URL・ポート検出 |
| `scripts/lib/dev-base-url.mjs` | ベンチ / requireDevServer |
| `scripts/smoke-cloudflare-pages.mjs` | Pages smoke |
| `scripts/ensure-pages-dist.mjs` | dev 起動前 dist 確認 |

---

## クイックリファレンス

```powershell
# 日常の確認フロー
$env:TASFUL_SUPABASE_URL="..."
$env:TASFUL_SUPABASE_ANON_KEY="..."
npm run build:pages
npm run dev
# → http://127.0.0.1:8788/

# smoke
npm run smoke:pages
```
