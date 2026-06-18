# NB-1 — tasful.jp ホスト構築・公開準備

**実施日:** 2026-06-18  
**種別:** 現状確認・不足一覧（**ホスト構築作業・Auth Smoke は未実施**）  
**目的:** Auth GO 判定（AUTH-RB-2）の前提である `https://tasful.jp` 公開環境の readiness 監査  
**参照:** [`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md) · [`release-blocker-roadmap.md`](release-blocker-roadmap.md) NB-1

---

## エグゼクティブサマリ

| 判定 | **FAIL** |
|------|----------|
| 理由 | **本番 origin 未到達** — 実施環境から `tasful.jp` DNS 解決不可 · HTTPS/静的配信未確認 |
| Auth Smoke | **開始不可**（Phase A 未 PASS） |
| リポジトリ | 静的 HTML/JS **ローカルには存在** · **本番デプロイパイプライン未整備** |
| Supabase API | プロジェクト `ddojquacsyqesrjhcvmn` は **到達可**（バックエンドは稼働） |

**外部プローブ補足:** 別経路の HTTP fetch では `www.tasful.jp` が **502 Bad Gateway** を返した記録あり（DNS は部分的に存在する可能性）。**本番検証環境（開発者端末）では NXDOMAIN** — いずれにせよ **Auth Smoke 可能な安定 HTTPS 200 には未達**。

---

# 確認① ドメイン状態

**対象:** `tasful.jp` · `www.tasful.jp`

| 項目 | 実施方法 | 結果 | 判定 |
|------|----------|------|------|
| **DNS（apex）** | `nslookup tasful.jp` · `Resolve-DnsName tasful.jp` | **Non-existent domain** / 空 | **FAIL** |
| **DNS（www）** | `nslookup www.tasful.jp` | **Non-existent domain** | **FAIL** |
| **A レコード** | 上記 | 取得不可 | **FAIL** |
| **AAAA** | 上記 | 取得不可 | **FAIL** |
| **CNAME（www）** | 上記 | 取得不可 | **FAIL** |
| **NS / TTL** | `nslookup -type=NS` | 取得不可 | **FAIL** |

### 判定: **FAIL**

### 必要作業（Ops）

1. ドメイン `tasful.jp` の登録・ネームサーバー設定（未登録の場合は取得）
2. apex `tasful.jp` → 静的ホスト（A/AAAA または CNAME flatten）
3. `www.tasful.jp` → apex 向け CNAME（またはホスト側リダイレクト）
4. TTL: 切替時は事前に **300s 以下**に下げてから変更推奨

---

# 確認② HTTPS

| 項目 | 実施方法 | 結果 | 判定 |
|------|----------|------|------|
| **HTTPS 有効** | `curl.exe -v https://tasful.jp/` | `Could not resolve host` | **FAIL** |
| **証明書** | 同上 | 検証不可 | **FAIL** |
| **HTTP→HTTPS** | `curl.exe -I http://tasful.jp/` | 検証不可 | **FAIL** |
| **Mixed Content** | 本番 HTML 未配信のため未検証 | N/A | **保留** |
| **HSTS** | レスポンスヘッダ未取得 | 未設定とみなす | **FAIL**（本番前に要検討） |

**補足:** 外部 fetch で `www.tasful.jp` → **502**（オリジン前段のみ存在しアプリ未配信の可能性）。

### 判定: **FAIL**

### 必要作業

1. ホスト（Cloudflare Pages / Netlify / S3+CloudFront 等）で **TLS 証明書自動発行**
2. apex `https://tasful.jp` で **200** を確認
3. デプロイ後: 代表ページで **Mixed Content 0**（DevTools Console）
4. 本番安定後: `Strict-Transport-Security` 検討（Auth Smoke 後でも可）

---

# 確認③ リダイレクト

**期待:**

```
https://www.tasful.jp/*
  → 301/308
https://tasful.jp/*
```

| 項目 | 結果 | 判定 |
|------|------|------|
| **www → apex** | 検証不可（DNS 失敗） | **FAIL** |
| **HTTP → HTTPS** | 検証不可 | **FAIL** |
| **Canonical** | リポジトリ HTML に `<link rel="canonical" href="https://tasful.jp/...">` **未整備**（代表 `index.html` 確認） | **WARNING** |
| **SITE_URL 整合** | 方針 `https://tasful.jp`（[`stripe-live-values-template.md`](stripe-live-values-template.md)）· Secret **未投入** | **FAIL** |

### 判定: **FAIL**

### 必要作業

1. ホストで `www` → `https://tasful.jp` **301/308**
2. Supabase Dashboard → Authentication → URL Configuration:
   - **Site URL:** `https://tasful.jp`
   - **Redirect URLs:** `https://tasful.jp/**`（必要パス）
3. `supabase secrets set SITE_URL=https://tasful.jp`（Edge Functions 用）
4. （任意）主要 HTML に canonical 追加 — **P2 · Smoke 後でも可**

---

# 確認④ SITE_URL

**確定方針:** `SITE_URL=https://tasful.jp`（末尾 `/` なし · apex · www なし）

## 利用箇所一覧

| 利用箇所 | ファイル / 設定 | 用途 | 現状 |
|----------|-----------------|------|------|
| **Supabase Secret** | `SITE_URL` | Edge 共通 origin | **未設定**（[`stripe-live-values-template.md`](stripe-live-values-template.md) §0） |
| **GenAI Checkout** | `supabase/functions/stripe-create-genai-checkout/index.ts` | success/cancel URL | 未設定時 → `http://localhost:5173` |
| **Featured Checkout** | `supabase/functions/stripe-create-checkout/index.ts` | success/cancel URL | 同上 |
| **Shop Checkout** | `supabase/functions/stripe-create-shop-checkout/index.ts` | success/cancel URL | 同上 |
| **Service Fee** | `supabase/functions/stripe-create-service-fee/index.ts` | return URL | 同上 |
| **GenAI Portal** | `supabase/functions/stripe-create-genai-portal/index.ts` | return URL | 同上 → `/gen-ai-workspace.html` |
| **Connect** | Edge 間接（Checkout 戻り） | payment-settings 等 | SITE_URL 依存 |
| **Auth Redirect** | Supabase Dashboard（手動） | OAuth / メールリンク | **要 Dashboard 確認** |
| **クライアント body.origin** | 上記 Edge `resolveSiteOrigin()` | リクエスト origin フォールバック | 本番では **SITE_URL 必須** |

### Success / Cancel URL パターン（SITE_URL 設定後）

| 機能 | パターン（例） |
|------|----------------|
| GenAI | `{SITE_URL}/gen-ai-workspace.html?genai_checkout=success&session_id=...` |
| Featured | `{SITE_URL}/detail-*.html?id={uuid}&featured_checkout=success&...` |
| Shop | `{SITE_URL}/shop-*.html?...`（関数実装参照） |

### 判定: **FAIL**（Secret 未投入 · Auth URL 未確認）

**今回のスコープ:** Stripe Live 切替は実施しない。ホスト稼働後に Secret 投入のみ計画。

---

# 確認⑤ 静的公開

## 本番 URL プローブ（`https://tasful.jp`）

| パス | HTTP | 判定 |
|------|------|------|
| `/` | 到達不可 | **FAIL** |
| `/talk-home.html` | 到達不可 | **FAIL** |
| `/dashboard.html` | 到達不可 | **FAIL** |
| `/shop-store.html` | 到達不可 | **FAIL** |
| `/shop-products.html` | 到達不可 | **FAIL** |
| `/payment-settings.html` | 到達不可 | **FAIL** |
| `/builder/` | 到達不可 | **FAIL** |
| `/ai-workspace.html` | 到達不可 | **FAIL** |
| `/gen-ai-workspace.html` | 到達不可 | **FAIL** |
| `/auth-current-user.js` | 到達不可 | **FAIL** |

## リポジトリ内（デプロイ候補 · ローカル）

| パス | 存在 | 備考 |
|------|------|------|
| `index.html` | ✅ | 市場トップ |
| `talk-home.html` | ✅ | `auth-current-user.js` · `auth-ops-guard.js` 読込済 |
| `dashboard.html` | ✅ | |
| `shop-store.html` | ✅ | |
| `shop-products.html` | ✅ | |
| `payment-settings.html` | ✅ | `connect-state.js` 読込済 |
| `builder/index.html` | ✅ | `auth-current-user.js` 読込済 |
| `ai-workspace.html` | ✅ | ナビからリンク |
| `gen-ai-workspace.html` | ✅ | GenAI 本体 |
| `auth-current-user.js` | ✅ | Auth STEP2/7 |

### デプロイ基盤

| 項目 | 状態 |
|------|------|
| `netlify.toml` / `vercel.json` / CI deploy workflow | **リポジトリに未検出** |
| `npm run build` 本番静的バンドル | **vite preview 想定** · 全量 `dist/` ビルド手順は未固定 |
| `chat-supabase-config.js` | **gitignore** · 本番ホストに **別途配置必須**（anon key · Supabase URL） |
| `dist/index.html` | 存在（部分ビルド成果物） |

### JS/CSS / Console

本番未配信のため **未検証**。デプロイ後 Runbook Phase A-5 / A-6 で実施。

### 判定: **FAIL**（本番） / **PASS**（リポジトリ資産存在）

---

# 確認⑥ Supabase接続

**プロジェクト:** `ddojquacsyqesrjhcvmn` · `https://ddojquacsyqesrjhcvmn.supabase.co`

| 項目 | 実施 | 結果 | 判定 |
|------|------|------|------|
| **API 到達** | `GET /auth/v1/health` | 401（gateway 応答 · project-ref ヘッダあり） | **PASS** |
| **REST Gateway** | `GET /rest/v1/` | 401（到達可） | **PASS** |
| **Auth / Session** | 本番 origin 未配信 | ブラウザ Session 未検証 | **保留** |
| **JWT** | ステージング検証ユーザー存在 | DB RLS probe 済（STEP 8B/10） | **PASS**（DB 側） |
| **Edge Functions** | デプロイ済み想定 | SITE_URL 未設定 | **WARNING** |
| **Environment** | `.env` ローカル | 開発用 · **本番 `chat-supabase-config.js` 未配線** | **FAIL**（本番フロント） |

### 判定: **WARNING**

- **バックエンド（Supabase）は稼働**
- **フロント本番 origin からの接続はホスト完成後に再確認**

---

# 確認⑦ Auth Smoke 事前条件

[`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md) Phase A 照合:

| 条件 | 状態 | Phase A 開始 |
|------|------|--------------|
| **DNS** | FAIL | ❌ |
| **HTTPS** | FAIL | ❌ |
| **SITE_URL** | Secret 未設定 · Dashboard 未確認 | ❌ |
| **deploy** | パイプライン未整備 · 本番未配信 | ❌ |
| **env** | 本番 `chat-supabase-config.js` 未配置方針 | ❌ |
| **auth スタック** | リポジトリに JS 存在 | ✅（配信待ち） |
| **DB RLS / AUTH-H-1** | 適用済（[`auth-step10-exec-apply.md`](auth-step10-exec-apply.md)） | ✅ |
| **Runbook** | 作成済 | ✅ |

### Phase A 開始可能か: **NO**

### 不足項目一覧（優先順）

| P | 項目 | 担当 | 想定工数 |
|---|------|------|----------|
| **P0** | ドメイン DNS（apex + www） | Ops / Infra | 0.5〜1d |
| **P0** | 静的ホスト選定・初回デプロイ | Ops / Eng | 1d |
| **P0** | HTTPS 200（`https://tasful.jp/`） | Ops | 同左 |
| **P0** | `www` → apex 301 | Ops | 0.5h |
| **P0** | 本番 `chat-supabase-config.js` 配置（CI secret 注入） | Eng | 0.5d |
| **P1** | Supabase Auth Site URL = `https://tasful.jp` | Ops | 15min |
| **P1** | `SITE_URL` Secret 投入 | Ops | 15min |
| **P1** | 代表 8 URL + `auth-current-user.js` 200 確認 | QA | 1h |
| **P2** | canonical / HSTS | Eng | 任意 |
| **P2** | CI デプロイ workflow 固定 | Eng | 1d |

---

# 確認⑧ GO判定

## 分類: **FAIL**

| READY 条件 | 状態 |
|------------|------|
| tasful.jp 到達可能 | ❌ |
| HTTPS 正常 | ❌ |
| www → apex 正常 | ❌ |
| SITE_URL 整合 | ❌（方針のみ確定） |
| 静的公開正常 | ❌ |
| Auth Smoke 開始可能 | ❌ |

### WARNING 相当（単独では GO にしない）

- リポジトリに静的資産・auth JS は揃っている
- Supabase API は到達可能
- `www` 経路で 502（DNS 部分的存在の兆候）→ **インフラ途中状態の可能性**

### FAIL 条件（該当）

- ✅ **到達不可**（検証環境 DNS NXDOMAIN）
- ✅ **HTTPS 不可**
- ✅ **SITE_URL 未整合**（Secret 未投入）

---

# 推奨ホスト構築手順（次アクション · コード変更最小）

Auth Smoke **実施前**に Ops/Eng が行う順序:

```
[1] ドメイン・DNS 有効化（apex + www）
[2] 静的ホスト作成（例: Cloudflare Pages）
      - Build: なし（静的アップロード）または vite build 方針を1つに固定
      - Root: リポジトリルート（index.html 直下）
      - 除外: .env · chat-supabase-config.js（CI で生成）
[3] chat-supabase-config.js 本番生成
      - url: https://ddojquacsyqesrjhcvmn.supabase.co
      - anonKey: Dashboard anon key
      - talkProductionMode: true（任意 · host 判定で足りる場合は省略可）
[4] HTTPS 確認 · www → apex 301
[5] Supabase Dashboard Site URL = https://tasful.jp
[6] supabase secrets set SITE_URL=https://tasful.jp
[7] curl/ブラウザで Phase A 再実行（auth-production-smoke-runbook.md）
[8] Phase A PASS 後 · Auth Smoke 9 シナリオ（別タスク）
```

**今回実施していないこと（意図的）:**

- Auth Smoke 9 シナリオ
- Stripe Live / Connect 本番 onboarding / 市場 checkout 本格化
- DNS/ホストの実際の変更（権限・インフラ作業は Ops 領域）

---

# 再検証コマンド（ホスト構築後）

```powershell
# DNS
Resolve-DnsName tasful.jp
Resolve-DnsName www.tasful.jp

# HTTPS / リダイレクト
curl.exe -sI https://tasful.jp/
curl.exe -sI https://www.tasful.jp/
curl.exe -sI http://tasful.jp/

# 静的（代表）
curl.exe -sI https://tasful.jp/talk-home.html
curl.exe -sI https://tasful.jp/auth-current-user.js

# Supabase（変更なし）
curl.exe -sI https://ddojquacsyqesrjhcvmn.supabase.co/auth/v1/health
```

**PASS 後:** [`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md) に従い Auth Smoke を実施し、結果を `reports/auth-production-smoke-results.md` に記録。

---

## 参照

| ファイル | 用途 |
|----------|------|
| [`release-blocker-roadmap.md`](release-blocker-roadmap.md) | NB-1 解消ロードマップ |
| [`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md) | Smoke 手順 |
| [`auth-step10-exec-apply.md`](auth-step10-exec-apply.md) | DB/Auth パッチ済 |
| [`stripe-live-values-template.md`](stripe-live-values-template.md) | SITE_URL 方針 |
