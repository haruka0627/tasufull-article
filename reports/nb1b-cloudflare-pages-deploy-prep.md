# NB-1B — Cloudflare Pages 初回デプロイ準備

**実施日:** 2026-06-18  
**種別:** ステージング検証・デプロイ手順整備（**CF 本番デプロイ・DNS 切替は未実施**）  
**目的:** `*.pages.dev` で検証可能な状態まで整備し、初回 Cloudflare Pages デプロイを実行可能にする  
**参照:** [`nb1a-cloudflare-pages-hosting-plan.md`](nb1a-cloudflare-pages-hosting-plan.md) · [`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md)

**未実施（禁止事項遵守）:** `tasful.jp` DNS 変更 · www リダイレクト · Supabase Auth Site URL · `SITE_URL` Secret · Auth Smoke Phase B · Stripe Live / Connect 本番 onboarding

---

## NB-1B 判定: **READY**

| 判定 | **READY** |
|------|-----------|
| 意味 | Cloudflare Pages **初回デプロイを実行できる状態**。ビルド・dist 検証・ローカル smoke **PASS** |
| 残作業 | CF Dashboard でプロジェクト作成 → Git 連携 or Wrangler upload → `*.pages.dev` で smoke 再実行 |
| 注意 | `*.pages.dev` 上では `isProductionHost()` が false — **本番 host 向け fallback 拒否の実機確認は NB-1C（DNS 後）** |

---

# 実施内容

| # | 項目 | 結果 |
|---|------|------|
| 1 | `stage-cloudflare-pages.mjs` 実行・dist 生成 | **PASS**（927 files） |
| 2 | `chat-supabase-config.js` ビルド時生成 | **PASS**（url + anonKey のみ） |
| 3 | demo フィールド除外確認 | **PASS**（`currentUserId` / `me` / `u_me` なし） |
| 4 | 必須 HTML/CSS/JS 揃い | **PASS**（検証スクリプト 22 項目） |
| 5 | `_redirects` / `_headers` dist 配置 | **PASS** |
| 6 | SPA fallback なし | **PASS**（`/* /index.html 200` なし） |
| 7 | セキュリティヘッダ草案 | **PASS**（`_headers` に 3 ヘッダ + auth 短キャッシュ） |
| 8 | ランタイム `scripts/*.js` 配信 | **PASS**（修正後 · talk-call 等 15 ファイル） |
| 9 | ローカル dist smoke（8 URL） | **PASS**（`http://127.0.0.1:8788`） |
| 10 | fallback 拒否（シミュレーション） | **PASS**（`talkProductionMode` + core policy） |
| 11 | CF Pages 初回デプロイ手順 | **文書化済**（本レポート §） |
| 12 | 実 CF `*.pages.dev` デプロイ | **未実施**（Dashboard / Wrangler 操作は Ops 待ち） |

### 実施中に検出・修正したギャップ

| 問題 | 対応 | 状態 |
|------|------|------|
| `builder/index.html` に `chat-supabase-config.js` 未読込 | Supabase JS + config + client を追加 | **修正済** |
| `dashboard-data.js` が `global` 参照（Vite 外で ReferenceError） | `globalThis` に変更 | **修正済** |
| `scripts/` 全体除外で talk-call JS が 404 | ランタイム `.js` のみコピーするよう stage 修正 | **修正済** |

---

# 追加/変更ファイル

| ファイル | 変更 |
|----------|------|
| `deploy/cloudflare/stage-cloudflare-pages.mjs` | `scripts/` ランタイム JS コピー許可 |
| `deploy/cloudflare/_redirects` | 変更なし（NB-1A 草案） |
| `deploy/cloudflare/_headers` | 変更なし（NB-1A 草案） |
| `scripts/verify-cloudflare-pages-stage.mjs` | **新規** — dist 静的検証 |
| `scripts/smoke-cloudflare-pages.mjs` | **新規** — pages.dev / ローカル smoke |
| `package.json` | `build:pages` · `verify:pages-stage` · `smoke:pages` 追加 |
| `.gitignore` | `deploy/cloudflare/dist/` 追加 |
| `builder/index.html` | Supabase config 読込追加 |
| `dashboard-data.js` | `global` → `globalThis` |
| `reports/nb1b-cloudflare-pages-deploy-prep.md` | 本レポート |

---

# dist生成結果

**コマンド:**

```powershell
$env:TASFUL_SUPABASE_URL="https://ddojquacsyqesrjhcvmn.supabase.co"
$env:TASFUL_SUPABASE_ANON_KEY="<Dashboard anon public>"
npm run build:pages
npm run verify:pages-stage
```

| 項目 | 値 |
|------|-----|
| 出力先 | `deploy/cloudflare/dist/` |
| ファイル数 | **927** |
| 除外 | `node_modules` · `reports` · `supabase` · `scripts/*.mjs` · `scripts/lib` · `deploy` |
| 含む | ルート静的資産 · `builder/` · `images/` · **ランタイム `scripts/*.js`（15）** · `_redirects` · `_headers` |

**`npm run verify:pages-stage`:** **PASS**（全チェック）

---

# config生成確認

**生成ファイル:** `deploy/cloudflare/dist/chat-supabase-config.js`

```javascript
window.TASU_CHAT_SUPABASE_CONFIG = {
  url: "https://ddojquacsyqesrjhcvmn.supabase.co",
  anonKey: "<ビルド時注入>",
};
window.TASU_TALK_CALL_CONFIG = window.TASU_TALK_CALL_CONFIG || {};
```

| チェック | 結果 |
|----------|------|
| `url` / `anonKey` 存在 | ✅ |
| `currentUserId` なし | ✅ |
| `me` なし | ✅ |
| `u_me` / demo user 文字列なし | ✅ |
| `webPushVapidPublicKey` 等 TURN 秘密なし | ✅ |
| リポジトリの `chat-supabase-config.js` は dist にコピーされない | ✅（ビルド生成で上書き） |

**本番 CF デプロイ時:** Dashboard の **anon public** を `TASFUL_SUPABASE_ANON_KEY` に設定すること（プレースホルダ不可）。

---

# Pages環境変数一覧

## Production 環境（Cloudflare Pages → Settings → Environment variables）

| 変数名 | 分類 | 必須 | 値（例） | 備考 |
|--------|------|------|----------|------|
| `TASFUL_SUPABASE_URL` | **Encrypted（Secret）** | ✅ | `https://ddojquacsyqesrjhcvmn.supabase.co` | ビルド時に config 生成 |
| `TASFUL_SUPABASE_ANON_KEY` | **Encrypted（Secret）** | ✅ | Dashboard → API → anon public | **service_role 禁止** |
| `NODE_VERSION` | Plain text | 推奨 | `20` | Node ビルドランタイム |

## Secret にしない値

| 変数 | 理由 |
|------|------|
| `NODE_VERSION` | 公開情報 · ローテーション不要 |
| Build command / output directory | Dashboard 設定（変数ではない） |

## 今回設定しない（NB-1B 禁止）

| 変数 / 設定 | タイミング |
|-------------|------------|
| Supabase Auth **Site URL** | NB-1C（`tasful.jp` DNS 後） |
| `SITE_URL` Secret | NB-1C |
| `TASFUL_TURN_*` / VAPID | Talk 本番通話時（Auth Smoke 範囲外） |

---

# 初回デプロイ手順

## A. Cloudflare Pages プロジェクト作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. リポジトリ: `tasufull-article`（または fork）
3. **Production branch:** 運用ブランチ（例: `main`）

## B. ビルド設定

| 項目 | 値 |
|------|-----|
| Framework preset | **None** |
| Build command | `node deploy/cloudflare/stage-cloudflare-pages.mjs` |
| Build output directory | `deploy/cloudflare/dist` |
| Root directory | `/` |

## C. 環境変数（Production）

`TASFUL_SUPABASE_URL` · `TASFUL_SUPABASE_ANON_KEY` · `NODE_VERSION=20` を設定（上表）。

## D. デプロイ実行

**Git 連携:** ブランチ push → 自動ビルド。

**手動（Wrangler · 検証用）:**

```powershell
npm run build:pages   # ローカルで env を設定してから
npx wrangler pages deploy deploy/cloudflare/dist --project-name=tasful-front
```

## E. デプロイ確認 URL

| 段階 | URL |
|------|-----|
| 初回（DNS 前） | `https://<project-name>.pages.dev/` |
| 代表確認 | `https://<project-name>.pages.dev/talk-home.html` |
| config | `https://<project-name>.pages.dev/chat-supabase-config.js` |
| auth stack | `https://<project-name>.pages.dev/auth-current-user.js` |

**カスタムドメイン `tasful.jp` は NB-1C まで追加しない。**

## F. デプロイ後コマンド

```powershell
node scripts/smoke-cloudflare-pages.mjs --base https://<project-name>.pages.dev
```

---

# pages.dev Smoke手順

## 自動（推奨）

```powershell
# ローカル dist ミラー（デプロイ前検証 — 本 NB-1B で実施済 PASS）
npx --yes http-server deploy/cloudflare/dist -p 8788 -c-1
node scripts/smoke-cloudflare-pages.mjs --base http://127.0.0.1:8788

# CF デプロイ後
node scripts/smoke-cloudflare-pages.mjs --base https://<project-name>.pages.dev
```

## 確認 URL（8）

| # | パス | ローカル smoke |
|---|------|----------------|
| 1 | `/` | ✅ 200 |
| 2 | `/talk-home.html` | ✅ 200 · auth JS |
| 3 | `/dashboard.html` | ✅ 200 |
| 4 | `/shop-store.html` | ✅ 200 |
| 5 | `/shop-products.html` | ✅ 200 |
| 6 | `/payment-settings.html` | ✅ 200 · auth JS |
| 7 | `/builder/` | ✅ 200 · auth JS |
| 8 | `/ai-workspace.html` | ✅ 200 |

## 確認項目

| 項目 | ローカル dist | `*.pages.dev`（デプロイ後） |
|------|---------------|------------------------------|
| HTTP 200 | ✅ | ⬜ 未実施 |
| CSS 読込（ローカル link HEAD） | ✅ | ⬜ |
| JS 読込（script/css 404 なし） | ✅ | ⬜ |
| `chat-supabase-config.js` 静的監査 | ✅ | ⬜ |
| major console error 0 | ✅ | ⬜ |
| fallback 拒否 | ✅ シミュレーション※ | ⬜ host 実機は NB-1C |

※ `talkProductionMode=true` で LS `u_ls_fake` ブロック + `isProductionHost(tasful.jp)` core policy。`*.pages.dev` では hostname ベースの本番拒否は **意図的に未発火**（NB-1A 計画どおり）。

## 手動補助（任意）

```powershell
curl.exe -sI https://<project-name>.pages.dev/
curl.exe -sI https://<project-name>.pages.dev/chat-supabase-config.js
curl.exe -sI https://<project-name>.pages.dev/auth-current-user.js
```

DevTools → Network: `chat-supabase-config.js` に demo フィールドがないこと。Console: 赤エラー 0（Supabase 未ログインの warn は可）。

---

# DNS切替前GO条件

| # | 条件 | NB-1B 状態 |
|---|------|------------|
| 1 | pages.dev で静的配信 PASS | ⬜ CF デプロイ後に smoke 再実行（ローカル dist は **PASS**） |
| 2 | auth JS 読込 PASS | ✅（talk-home · payment-settings · builder） |
| 3 | config 生成 PASS | ✅ |
| 4 | fallback 拒否 PASS | ✅ シミュレーション · **tasful.jp 実機は NB-1C** |
| 5 | major console error 0 | ✅ ローカル dist |
| 6 | rollback 可能 | ✅ CF Deployments ロールバック手順確立 |
| 7 | SPA fallback なし | ✅ |
| 8 | `scripts/talk-call-*.js` 404 なし | ✅ |

**DNS 切替（NB-1C）に進める条件:** 上記 1 を **実 `*.pages.dev`** で PASS + Ops がカスタムドメイン手順を承認。

---

# rollback

| シナリオ | 手順 |
|----------|------|
| 不良デプロイ | CF Pages → **Deployments** → 直前成功ビルド → **Rollback to this deployment** |
| ビルド失敗 | 環境変数 `TASFUL_SUPABASE_*` 確認 → ログで `stage-cloudflare-pages` エラー確認 → 修正 push |
| config 漏洩懸念 | anon key ローテーション（Supabase Dashboard）→ Pages Secret 更新 → 再デプロイ |
| ローカル検証 | `deploy/cloudflare/dist/` 削除 → `npm run build:pages` 再生成 |

**DNS / Site URL / SITE_URL は NB-1B では触らない** — rollback 対象は Pages デプロイのみ。

---

# Cloudflare Pages 用ファイル確認サマリ

| ファイル | dist 配置 | 内容 |
|----------|-----------|------|
| `_redirects` | ✅ | パス 301 のみ · **SPA fallback なし** |
| `_headers` | ✅ | `X-Content-Type-Options` · `Referrer-Policy` · `Permissions-Policy` · auth JS 短キャッシュ |
| MPA | ✅ | 各 URL が実 `.html` · `/* → index.html 200` なし |
| 404 挙動 | デフォルト | 存在しないパスは Pages 404（意図どおり） |

---

# 次ステップ（NB-1C 以降 · 本タスク外）

1. CF Pages 初回デプロイ → `*.pages.dev` smoke  
2. `tasful.jp` カスタムドメイン + www Redirect Rule  
3. Supabase Auth Site URL + `SITE_URL` Secret  
4. [`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md) Phase A  

---

**ステータス:** NB-1B **READY** — 初回 Cloudflare Pages デプロイ実行可能（`*.pages.dev` 検証前提 · DNS 未切替）
