# NB-1D — Custom Domain / Auth 事前監査

**実施日:** 2026-06-18  
**種別:** 事前監査のみ（**コード変更なし · DNS / Dashboard / Secret 未変更**）  
**前提:** **NB-1C READY** — `https://tasufull-article.pages.dev` deploy Success · smoke PASS  
**除外:** Stripe Live · Connect 本番 onboarding · 本番決済

**参照:** [`nb1a-cloudflare-pages-hosting-plan.md`](nb1a-cloudflare-pages-hosting-plan.md) · [`nb1c-pages-dev-smoke.md`](nb1c-pages-dev-smoke.md) · [`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md)

---

## NB-1D 判定: **NEEDS_MANUAL_DASHBOARD**

| 判定 | **NEEDS_MANUAL_DASHBOARD** |
|------|----------------------------|
| 意味 | **リポジトリ / Pages ビルドは適用可能** — 残作業は **Cloudflare DNS · Pages Custom Domain · Supabase Auth URL · `SITE_URL` Secret** の手動設定のみ |
| Repo | **APPLY_READY**（カスタムドメイン用のコード変更は不要） |
| Ops 前提 | `tasful.jp` DNS は監査時点 **NXDOMAIN**（下記）— **レジストラ / Cloudflare ゾーン作成を先行** |
| 未実施 | 本監査では Dashboard / DNS / Supabase を **触っていない** |

### BLOCKED ではない理由

| 項目 | 状態 |
|------|------|
| NB-1C pages.dev | ✅ READY |
| Build / env / dist パイプライン | ✅ 確立済 |
| 本番 host 向け auth 定数 | ✅ `tasful.jp` / `www.tasful.jp` ハードコード済 |
| カスタムドメイン必須のコード差分 | **なし** |

### APPLY_READY 単独にしない理由

DNS · Auth Site URL · Edge `SITE_URL` は **エージェント非到達の Dashboard / CLI 操作** が必須。監査時点で `tasful.jp` は **未解決**。

---

# 1. Cloudflare Pages — Custom Domain 設定項目

**プロジェクト:** `tasufull-article` · **Production branch:** `main` · **pages.dev:** `https://tasufull-article.pages.dev`

## 前提（NB-1C 済）

| 項目 | 状態 |
|------|------|
| Production deploy Success | ✅ |
| Build command | `node deploy/cloudflare/stage-cloudflare-pages.mjs` |
| Output directory | `deploy/cloudflare/dist` |
| Production env | `TASFUL_SUPABASE_URL` · `TASFUL_SUPABASE_ANON_KEY` · `NODE_VERSION=20`（推奨） |

## Custom Domain 追加に必要な項目

| # | 項目 | 設定場所 | 値 / 備考 |
|---|------|----------|-----------|
| 1 | **Cloudflare ゾーン** | Cloudflare Dashboard | ゾーン `tasful.jp` がアカウント内に存在すること |
| 2 | **ネームサーバー** | レジストラ | ドメイン NS → Cloudflare 指定 NS へ（未設定なら **先行必須**） |
| 3 | **DNS レコード** | ゾーン DNS | `@` CNAME → `tasufull-article.pages.dev`（Proxied） |
| 4 | **DNS レコード** | 同上 | `www` CNAME → `tasufull-article.pages.dev`（Proxied） |
| 5 | **Custom domains** | Workers & Pages → `tasufull-article` → Custom domains | `tasful.jp` 追加（Primary 推奨） |
| 6 | **Custom domains** | 同上 | `www.tasful.jp` 追加（証明書発行用） |
| 7 | **SSL/TLS** | ゾーン SSL | Universal SSL 自動 · Pages オリジンは通常 **Full** で可 |
| 8 | **www → apex** | **Redirect Rule**（第一推奨） | `http.host eq "www.tasful.jp"` → `https://tasful.jp${http.request.uri.path}` · **301** |
| 9 | **検証** | curl / ブラウザ | `https://tasful.jp/` **200** · 同一 commit 内容が pages.dev と一致 |

## Pages 側で **不要 / 禁止**

| 項目 | 理由 |
|------|------|
| Build 設定変更 | NB-1C 設定で足りる |
| 別 Output directory | `deploy/cloudflare/dist` 固定 |
| SPA fallback | `_redirects` に `/* /index.html 200` **禁止**（NB-1A） |
| `service_role` を Pages env に追加 | 禁止（anon public のみ） |

## `_redirects` / `_headers`（リポジトリ既存）

- **ホスト名リダイレクト（www→apex）:** Redirect Rule に任せる · `_redirects` はパス補助のみ
- **Auth JS 短キャッシュ:** `_headers` で `auth-current-user.js` 等 `must-revalidate` 済

---

# 2. DNS — tasful.jp / www.tasful.jp を Pages へ向ける手順

**⚠️ 本監査では未実施。** 手順のみ。

## 推奨順序

```text
1. レジストラで tasful.jp 取得 / 更新確認
2. Cloudflare にゾーン tasful.jp 追加
3. レジストラ NS を Cloudflare へ切替（切替前 TTL 300s 推奨）
4. NS 伝播確認（nslookup / dig）
5. DNS レコード追加（下表）
6. NB-1C pages.dev Success を再確認
7. Pages Custom domains に tasful.jp / www.tasful.jp 追加
8. Redirect Rule（www → apex）
9. curl -sI https://tasful.jp/ → 200
10. Supabase Auth Site URL + SITE_URL Secret（§3 · §4）
11. Auth Phase A（Runbook）
```

## レコード案

| 名前 | タイプ | 内容 | Proxy |
|------|--------|------|-------|
| `@` | **CNAME** | `tasufull-article.pages.dev` | ✅ Proxied |
| `www` | **CNAME** | `tasufull-article.pages.dev` | ✅ Proxied |

> apex CNAME は **Cloudflare ゾーン上** で CNAME flattening が効く前提。

## 監査時 DNS プローブ（2026-06-18）

| ホスト | 結果 |
|--------|------|
| `tasful.jp` | **NXDOMAIN** |
| `www.tasful.jp` | **NXDOMAIN** |
| `tasufull-article.pages.dev` | **200 OK** |

**解釈:** カスタムドメイン適用前に **レジストラ / CF ゾーン / NS** の整備が必要。過去監査（[`nb1-host-production-readiness.md`](nb1-host-production-readiness.md)）では別経路で `www` **502** の記録あり — ゾーン片方だけ存在する可能性。**Ops が CF Dashboard でゾーン状態を要確認**。

## www → apex PASS 条件（Phase A-3）

```powershell
curl.exe -sI https://www.tasful.jp/
# → 301/308, Location: https://tasful.jp/...
```

---

# 3. Supabase Auth — Site URL / Redirect URLs

**Project:** `ddojquacsyqesrjhcvmn`  
**Dashboard:** Authentication → URL Configuration

## 推奨設定（NB-1A / Runbook 整合）

| 設定 | 値 |
|------|-----|
| **Site URL** | `https://tasful.jp`（**末尾スラッシュなし**） |
| **Redirect URLs（allow list）** | `https://tasful.jp/**` |
| 代表パス（明示追加推奨） | `https://tasful.jp/talk-home.html` |
| | `https://tasful.jp/payment-settings.html` |
| | `https://tasful.jp/builder/index.html` |
| | `https://tasful.jp/dashboard.html` |
| | `https://tasful.jp/login.html` |

## タイミング

| 操作 | タイミング |
|------|------------|
| Site URL 変更 | `https://tasful.jp` が **200** で開ける **直後** |
| `SITE_URL` Secret | 同上（§4） |
| **pages.dev から Site URL を本番 apex に早切替** | **非推奨** — DNS 前だとメール / リカバリリンクが未到達 origin を指す |

## pages.dev を Redirect URLs に入れるか

| 方針 | 推奨 |
|------|------|
| **Production Site URL** | `https://tasful.jp` のみ |
| `https://tasufull-article.pages.dev/**` | **任意** — ステージング検証用。本番 Auth smoke 完了後も残すかは Ops 判断 |
| 本番 Site URL を pages.dev のまま | **禁止**（Phase A-4 FAIL） |

## 認証方式と Redirect の関係（リポジトリ調査）

| 方式 | 使用 | Redirect URL 依存 |
|------|------|-------------------|
| `signInWithPassword`（`login.js`） | ✅ 主方式 | 低 — 同一 origin 内 `login.html` |
| `signInWithOAuth` | ❌ 未検出 | — |
| `emailRedirectTo` 明示 | ❌ 未検出 | パスワードリセット / Magic Link 利用時は allow list 要確認 |
| セッション | `@supabase/supabase-js` · `getSession()` | **origin 単位** — pages.dev ログインは tasful.jp に **引き継がれない** |

---

# 4. リポジトリ内 — SITE_URL / PUBLIC_SITE_URL / APP_URL

## サマリ

| 変数 | 使用 | 設定場所 | 本番値（方針） | 監査時状態 |
|------|------|----------|----------------|------------|
| **`SITE_URL`** | ✅ **使用中** | Supabase Edge **Secret** | `https://tasful.jp` | **未設定** |
| **`PUBLIC_SITE_URL`** | ❌ 未使用 | — | — | — |
| **`APP_URL`** | ❌ 未使用 | — | — | — |

## `SITE_URL` 参照箇所（Edge Functions）

| ファイル | 用途 |
|----------|------|
| `supabase/functions/stripe-create-checkout/index.ts` | Featured Checkout success/cancel URL |
| `supabase/functions/stripe-create-genai-checkout/index.ts` | GenAI Checkout |
| `supabase/functions/stripe-create-genai-portal/index.ts` | Customer Portal return |
| `supabase/functions/stripe-create-shop-checkout/index.ts` | Shop Checkout |
| `supabase/functions/stripe-create-service-fee/index.ts` | 手数料 Checkout |

**解決順（共通パターン）:** `body.origin` → **`SITE_URL` env** → `Referer`/`Origin` header → fallback `http://localhost:5173`

## クライアント側 origin（`SITE_URL` 非依存 · host 追随）

| ファイル | パターン |
|----------|----------|
| `shop-checkout.js` | `window.location.origin` |
| `service-fee-pay.js` | `window.location.origin` |
| `platform-chat-fee-pay.js` | `window.location.origin` |
| `gen-ai-workspace.js` | `location.origin` を body 送信 |

**Featured Checkout（`listing-featured.js`）:** `origin` **未送信** → **`SITE_URL` または Referer 必須**（[`stripe-ready-check.md`](stripe-ready-check.md)）

## 投入コマンド（未実施 · 記録のみ）

```bash
supabase secrets set SITE_URL=https://tasful.jp
supabase secrets list   # SITE_URL 存在確認
```

**注意:** 投入後、Featured 等のローカル Checkout テストは referer より `SITE_URL` が優先され **戻り先が tasful.jp になる**。

## Cloudflare Pages env（NB-1D 対象外）

| 変数 | 用途 |
|------|------|
| `TASFUL_SUPABASE_URL` | ビルド時 `chat-supabase-config.js` 生成 |
| `TASFUL_SUPABASE_ANON_KEY` | 同上 |

`SITE_URL` は **Pages には置かない**（Edge Secret のみ）。

---

# 5. pages.dev vs Custom Domain — 差分が出る箇所

## 5.1 本番 host 判定（**最大の挙動差**）

| モジュール | 本番 host | pages.dev |
|------------|-----------|-----------|
| `auth-current-user.js` | `tasful.jp` · `www.tasful.jp` → **LS/URL/u_me fallback 禁止** | hostname 不一致 → **dev 扱い**（`talkProductionMode` 未設定時） |
| `talk-runtime.js` | 同上 | localhost 以外でも dev 扱いになり得る |
| NB-1C smoke | `talkProductionMode` **シミュレーション** | 本番 apex では **実 host で lockdown 発火** |

**NB-1D 後に必要:** `https://tasful.jp` 向け smoke / [`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md) Phase A–C（**hostname 実機**）。

## 5.2 Auth / セッション

| 項目 | pages.dev | tasful.jp |
|------|-----------|-----------|
| Supabase anon / URL | 同一（ビルド生成 config） | 同一 |
| Auth セッション cookie | `*.pages.dev` origin | `tasful.jp` origin — **別セッション** |
| `member-auth.js` ログイン後 redirect | 相対 `login.html?return=...` | 同一パターン（host 追随） |
| `auth-current-user.js` `requireAuthenticated` | dev fallback 可 | 本番 fallback **不可** |

## 5.3 Redirect / Callback

| 経路 | pages.dev | tasful.jp |
|------|-----------|-----------|
| Member login return | `login.html?return=<path>` | 同左 |
| Stripe Checkout 戻り | `location.origin` または Referer | `https://tasful.jp/...`（`SITE_URL` 設定後は Featured も安定） |
| Supabase Auth メールリンク | Site URL 未整合時は misroute リスク | Site URL = apex で整合 |
| Edge `resolveSiteOrigin` fallback | Referer = pages.dev なら pages.dev 戻り | Referer = tasful.jp · **SITE_URL 推奨** |

## 5.4 静的配信 / パス

| 項目 | 差分 |
|------|------|
| `_redirects` | ホスト非依存（パス正規化のみ） |
| `/builder` → `/builder/` | 両 host で同一 |
| `chat-supabase-config.js` | CF ビルド生成 · host 非依存 |
| Mixed content | 両方 HTTPS 前提 · 本番 cutover 後 DevTools 確認 |

## 5.5 既知ギャップ（NB-1D ブロッカーではない ·  follow-up）

| 項目 | 状態 |
|------|------|
| `auth-ops-guard.js` | リポジトリに存在 · **main 未 push**（ops 系 HTML 未配線） |
| ops ページ auth stack | Phase B smoke 前に要確認 |
| `dashboard.html` | `connect-state.js` 未読込（fallback smoke 対象外 · Connect UI は別途） |

---

# 6. 適用手順チェックリスト（Ops · 未実施）

## Phase NB-1D-1 — DNS / Pages

- [ ] Cloudflare ゾーン `tasful.jp` 確認 / 作成
- [ ] NS 切替 · 伝播確認
- [ ] `@` / `www` CNAME → `tasufull-article.pages.dev`
- [ ] Pages Custom domains: `tasful.jp` · `www.tasful.jp`
- [ ] Redirect Rule: www → apex 301
- [ ] `curl -sI https://tasful.jp/` → **200**
- [ ] 代表 URL 200（Runbook A-5）

## Phase NB-1D-2 — Supabase Auth / Secret

- [ ] Auth Site URL = `https://tasful.jp`
- [ ] Redirect URLs allow list 更新
- [ ] `supabase secrets set SITE_URL=https://tasful.jp`
- [ ] `supabase secrets list` 確認

## Phase NB-1D-3 — 検証

- [ ] `node scripts/smoke-cloudflare-pages.mjs --base https://tasful.jp`（スクリプトは現状 tasful.jp base 非対応 assert あり — **要 `--base` 対応見直し or Runbook 手動**）
- [ ] Auth Phase A（Runbook）
- [ ] 本番 host fallback lockdown（Phase C）

---

# 7. 判定マトリクス

| 状態 | 判定 |
|------|------|
| Repo 準備完了 · Ops 手順明確 · DNS/Auth 未設定 | **NEEDS_MANUAL_DASHBOARD** ← **現状** |
| 上記 Dashboard/ DNS / Secret 完了 · tasful.jp 200 | **APPLY_READY**（Phase A 開始可） |
| NB-1C 未完了 · ビルド不能 · コード変更必須 | **BLOCKED** |

---

# 8. 関連コミット / ドキュメント

| 項目 | 値 |
|------|-----|
| NB-1C | **READY** · `e1626f7` · `https://tasufull-article.pages.dev` |
| 計画 | [`nb1a-cloudflare-pages-hosting-plan.md`](nb1a-cloudflare-pages-hosting-plan.md) |
| Auth smoke | [`auth-production-smoke-runbook.md`](auth-production-smoke-runbook.md) |
| SITE_URL 詳細 | [`stripe-ready-check.md`](stripe-ready-check.md) |
| 現状監査（DNS FAIL） | [`nb1-host-production-readiness.md`](nb1-host-production-readiness.md) |

---

**ステータス:** NB-1D 事前監査完了 — **NEEDS_MANUAL_DASHBOARD**（**Repo APPLY_READY · DNS/Auth/Secret は Ops 手動適用待ち**）
