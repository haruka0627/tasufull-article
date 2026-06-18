# NB-1C — Cloudflare Pages 初回デプロイ後 smoke

**実施日:** 2026-06-18 · **Dashboard 解除試行:** 2026-06-18（第5回）  
**種別:** `*.pages.dev` Production デプロイ + smoke  
**スコープ:** **pages.dev のみ** — `tasful.jp` / DNS / Custom Domain **未実施・禁止**

**参照:** `scripts/smoke-cloudflare-pages.mjs` · `scripts/deploy-cloudflare-pages.mjs`

---

## NB-1C 判定: **BLOCKED**

| 判定 | **BLOCKED** |
|------|-------------|
| 理由 | **Production deploy 未 Success** — エージェントから Cloudflare Dashboard **ログイン不可** · API トークン未設定 |
| コード | `build:pages` · `verify:pages-stage` · ローカル smoke **PASS** |
| インフラ | `https://tasufull-article.pages.dev` → **全パス 404**（2026-06-18 第5回プローブ） |
| 解除 | **Ops が Dashboard 操作** または **`CLOUDFLARE_API_TOKEN` 設定** → deploy Success → smoke |

---

# Dashboard 操作試行（第5回）

| # | 手順 | エージェント | 結果 |
|---|------|--------------|------|
| 1 | Workers & Pages → Pages | **不可** | ブラウザ / CF セッションなし |
| 2 | `tasufull-article` 確認 | 間接のみ | `*.pages.dev` 404 |
| 3 | GitHub 接続・新規作成 | **不可** | Dashboard 要人手 |
| 4 | Build / Output 設定 | **不可** | 下記値を Ops が入力 |
| 5 | Production Env 設定 | **不可** | 下記値を Ops が入力 |
| 6 | Production deploy 実行 | **不可** | Wrangler も token なし |
| 7 | Visit site URL 取得 | **未取得** | |
| 8 | smoke | **未実施**（404） | |
| 9 | 本レポート更新 | ✅ | BLOCKED |

**技術的制約:** Cursor エージェントは Cloudflare Dashboard にログインできない。同等作業は **`CLOUDFLARE_API_TOKEN` + `npm run deploy:pages`** で自動化可能。

---

# pages.dev URL

| 項目 | 値 |
|------|-----|
| 想定 URL | `https://tasufull-article.pages.dev` |
| `/` | **404** |
| `/chat-supabase-config.js` | **404** |
| Visit site（確定） | ⬜ |

---

# Ops 用 — Dashboard 手順（コピペ用）

## 1. プロジェクト

[Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Pages**

- **`tasufull-article` がある** → 開く  
- **ない** → **Create a project** → **Connect to Git** → 本リポジトリ

## 2. Build 設定

| 項目 | 値 |
|------|-----|
| Build command | `node deploy/cloudflare/stage-cloudflare-pages.mjs` |
| Build output directory | `deploy/cloudflare/dist` |
| Root directory | `/` |
| `NODE_VERSION`（推奨） | `20` |

## 3. Production Environment Variables

| 変数 | 値 |
|------|-----|
| `TASFUL_SUPABASE_URL` | `https://ddojquacsyqesrjhcvmn.supabase.co` |
| `TASFUL_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → **anon public** |

## 4. Deploy

**Save and Deploy** または **Retry deployment**

## 5. Deployments 確認

| ステータス | 次 |
|------------|-----|
| **Success** | **Visit site** URL をコピー → smoke へ |
| **Failed** | Build log → [失敗 triage](#build-failed) → 本レポート **FAIL** 候補 |
| **Building** | 待機 |

## 6. Custom Domain

**触らない**（`tasful.jp` は NB-1D 以降）

---

# エージェント自動デプロイ（トークンあり · Dashboard 代替）

Ops が [API Token](https://dash.cloudflare.com/profile/api-tokens) を作成（**Account · Cloudflare Pages · Edit**）し、Cursor ターミナルで:

```powershell
cd C:\Users\rubih\tasufull-article
$env:TASFUL_SUPABASE_URL="https://ddojquacsyqesrjhcvmn.supabase.co"
$env:TASFUL_SUPABASE_ANON_KEY="<anon public>"
$env:CLOUDFLARE_API_TOKEN="<token>"
npm run deploy:pages
node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
```

---

# Build Failed

Dashboard → Deployments → Failed → **View build log** を本レポートに追記。

| 症状 | 修正 |
|------|------|
| `TASFUL_SUPABASE_* required` | Production env 追加 |
| output 空 | `deploy/cloudflare/dist` 確認 |
| `node: not found` | `NODE_VERSION=20` |

---

# smoke結果

## 第5回（pages.dev · デプロイ前）

```text
node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
→ FAIL: chat-supabase-config.js HTTP 404
```

| # | パス | HTTP |
|---|------|------|
| 1–8 | `/` … `/ai-workspace.html` | **404** |
| — | `/chat-supabase-config.js` | **404** |

### Success 後に再実行

```powershell
node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
```

| 確認 | 条件 |
|------|------|
| HTTP 200 | 8 URL |
| CSS / JS | smoke 内チェック |
| console error 0 | major のみ（401 許容） |
| config 200 | demo フィールドなし |
| fallback | talkProductionMode シミュレーション |

**全 PASS → NB-1C READY**

---

# console error / config / fallback

| 区分 | pages.dev |
|------|-----------|
| console | N/A（404） |
| config | **404** |
| fallback | 未実施 |

ローカル dist: すべて **PASS**（参考）

---

# 判定マトリクス

| 状態 | 判定 |
|------|------|
| 全 smoke PASS | **READY** |
| Production 未作成 / URL 未取得 / Dashboard 未完了 | **BLOCKED** ← **現状** |
| Build Failed（log 記録済） | **FAIL** |
| Success 後 404 / console / fallback | **FAIL** |

---

# 次のアクション（どちらか1つ）

| 経路 | 担当 | 完了後 |
|------|------|--------|
| **A** Dashboard 手順（上記） | Ops | Visit site URL をチャット共有 |
| **B** `CLOUDFLARE_API_TOKEN` 設定 | Ops | エージェントが `deploy:pages` + smoke |

---

**ステータス:** NB-1C **BLOCKED** — **Cloudflare 認証（Dashboard 操作 or API トークン）待ち**
