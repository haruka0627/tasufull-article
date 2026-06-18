# Supabase JWT / Auth 本番接続確認レポート

**作成日:** 2026-06-17  
**種別:** 調査・検証のみ（コード / UI 変更なし）  
**対象 DB:** `ddojquacsyqesrjhcvmn`  
**前提:** RELEASE FROZEN 維持 · RLS P0 dev DROP 済み（[`supabase-rls-p0-fix.md`](supabase-rls-p0-fix.md)）

**関連:** [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) / [`pre-production-p0-action-plan.md`](pre-production-p0-action-plan.md) P0-2 / [`docs/anpi-rls-jwt-setup.md`](../docs/anpi-rls-jwt-setup.md)

---

## エグゼクティブサマリー

| 項目 | 判定 |
|------|------|
| **JWT 更新・Auth 接続（重点ドメイン）** | ✅ **PASS — LOCK 可** |
| **anon key / project URL** | ✅ 現行プロジェクトと一致 |
| **RLS + JWT 整合（TALK / 安否 / Call / GenAI）** | ✅ 検証 PASS |
| **invalid / expired JWT** | ✅ 401 拒否 |
| **service_role client 露出** | ✅ 検出なし |
| **残 P0（Auth/JWT）** | **なし** |
| **残 P1** | profiles / members / listings / business_listings の anon 読取 |
| **本番投入（Auth 全体）** | ⚠️ **条件付き可**（P1 marketplace 別 Epic） |

---

## 1. 現状設定

### 1.1 Supabase プロジェクト

| 項目 | 値 |
|------|-----|
| **Project URL** | `https://ddojquacsyqesrjhcvmn.supabase.co` |
| **Project ref** | `ddojquacsyqesrjhcvmn` |
| **Auth health** | `GET /auth/v1/health` → **200** |

### 1.2 クライアント設定（`chat-supabase-config.js`）

| キー | 状態 | 備考 |
|------|------|------|
| `url` | ✅ 上記 URL | Dashboard と一致想定 |
| `anonKey` | ✅ `eyJ...`（legacy anon JWT） | payload `ref=ddojquacsyqesrjhcvmn`, `role=anon`, `exp=2094344390` |
| `currentUserId` | `u_me` | **クライアント mock**（本番 Auth とは別・§12） |
| Git 追跡 | ⚠️ **コミット済み** | `.gitignore` は `.local` のみ（§8） |

### 1.3 JWT クレームモデル（RLS 連携）

| ドメイン | クレーム | RLS 関数 |
|----------|----------|----------|
| **TALK** | `app_metadata.talk_user_id` / `member_id` | `talk_current_user_id()` |
| **安否** | `app_metadata.member_id` / `user_metadata.member_id` | `anpi_*` 系 |
| **TALK Call** | 同上（authenticated） | caller/callee = `talk_current_user_id()` |
| **GenAI** | —（REST 直接 deny） | Edge `service_role` のみ |
| **Supabase Auth sub** | UUID (`sub`) | Builder signed URL 等で `auth.uid()` |

---

## 2. env / secrets 差分

### 2.1 レイヤ別

| レイヤ | 内容 | 本セッション確認 |
|--------|------|------------------|
| **リポジトリ client** | `chat-supabase-config.js` → url + anonKey | ✅ ref 一致 |
| **ローカル `.env`** | `SUPABASE_*`, `ANPI_RLS_*_JWT`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ JWT **再発行済み**（`issue-anpi-rls-jwt.mjs --write-env`） |
| **Edge Secrets** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS` 等 | ✅ digest あり（値は CLI 非表示） |
| **本番 HTML 配布** | 同上 client JS | anon のみ（service_role なし） |

### 2.2 anon key が古い参照でないか

| チェック | 結果 |
|----------|------|
| anon JWT `ref` vs URL | ✅ **一致** |
| Auth API 疎通 | ✅ password grant / REST 成功 |
| 別プロジェクト key | ❌ 検出なし |
| `sb_publishable_` 形式 | 未使用（legacy `eyJ` anon — **有効**） |

### 2.3 差分・注意

| ID | 項目 | 重要度 |
|----|------|--------|
| D-1 | `.env` の user JWT は **~1 時間で失効** | P1 運用（CI / 手動検証前に再発行） |
| D-2 | Edge Secrets と client anon は **同一プロジェクト** 想定 | ✅ 問題なし |
| D-3 | `chat-supabase-config.js` が Git 追跡 | P2（anon ローテ時はコミット更新要） |

---

## 3. JWT 検証結果（自動スクリプト）

| スクリプト | 結果 | 内容 |
|-----------|------|------|
| `verify-talk-rls-staging.mjs` | ✅ **PASS** | JWT 発行、anon 拒否、本人/他人分離、admin fanout |
| `verify-anpi-rls-real-db.mjs` | ✅ **17/17 PASS** | JWT 再発行後 |
| `verify-anpi-no-response-rls-p0.mjs` | ✅ **PASS** | Phase2 anon 拒否、監査 immutability |
| `issue-anpi-rls-jwt.mjs --write-env` | ✅ 成功 | A/B/Admin 3 本更新 |

**JWT 再発行（本セッション）:** `ANPI_RLS_*_JWT` を `.env` に書き込み。有効期限 ~1h（検証時点）。

---

## 4. user_id / auth.uid() 整合性

### 4.1 TALK（`talk_user_id`）

| テスト | 結果 |
|--------|------|
| Login `talk-rls-a@tasful-dev.test` → JWT | ✅ `talk_user_id=u_me` |
| `talk_notifications` 本人 SELECT | ✅ 自分の行のみ |
| 他ユーザー（u_store） | ✅ u_me 行を読めない |
| Admin fanout | ✅ PASS（staging 脚本内） |

### 4.2 安否（`member_id`）

| テスト | 結果 |
|--------|------|
| JWT A `member_id=anpi_rls_member_a` | ✅ |
| 他人 context/logs 拒否 | ✅ 17/17 内 |
| Admin 全件 | ✅ |
| Phase2 sessions / audit | ✅ P0 脚本 PASS |

### 4.3 TALK Call（`talk_call_sessions` / `talk_call_signals`）

| テスト | 結果 |
|--------|------|
| anon SELECT | ✅ 0 行 |
| caller INSERT（JWT + `expires_at`） | ✅ **201** |
| caller / callee SELECT | ✅ **1 行** |
| 非参加者（anpi test user）SELECT | ✅ **0 行** |
| 先行監査（[`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) §4.1） | ✅ 一致 |

### 4.4 GenAI（`gen_ai_subscriptions` / entitlements）

| テスト | 結果 |
|--------|------|
| anon SELECT subscriptions | ✅ **0 行**（deny all） |
| anon SELECT entitlements | ✅ **0 行** |
| 更新経路 | Edge `service_role` のみ（Stripe 確認済み） |

### 4.5 profiles / members / listings（marketplace）

| テーブル | anon SELECT | 判定 |
|----------|-------------|------|
| `profiles` | **4 行** | ⚠️ P1 dev SELECT 全許可 |
| `members` | **4 行** | ⚠️ P1 |
| `listings` | **5 行** | ⚠️ P1 |
| `business_listings` | **5 行** | ⚠️ P1 |

※ TALK / 安否 / Call / GenAI の **重点スコープ外**だが、本番 Auth 全体としては未解消。

---

## 5. anon / authenticated / invalid JWT テスト結果

| # | シナリオ | 期待 | 結果 |
|---|----------|------|------|
| 1 | anon → `talk_notifications` | 0 行 | ✅ |
| 2 | anon → `anpi_check_sessions` INSERT | 拒否 | ✅（Phase2 P0 脚本） |
| 3 | anon → `gen_ai_subscriptions` | 0 行 | ✅ |
| 4 | authenticated u_me → 自分の通知 | 可 | ✅ |
| 5 | authenticated u_store → u_me 通知 | 不可 | ✅ |
| 6 | **invalid JWT** | 401 | ✅ `PGRST301` |
| 7 | **expired JWT** | 401 | ✅ `PGRST301` |
| 8 | anon → profiles/listings | 現状可読 | ⚠️ P1 |

---

## 6. client key 露出チェック

| チェック | 結果 |
|----------|------|
| `chat-supabase-config.js` anonKey | `eyJ...` anon のみ ✅ |
| `sb_secret_` in client JS/HTML | **0 件**（grep） |
| `supabase-public-key.js` forbidden filter | ✅ 実装あり |
| `tasu-supabase-client.js` | ✅ `sb_secret_`  strip |
| Stripe / GenAI / Tripo configs | ✅ secret 拒否パターン |
| `scripts/scan-staged-secrets.mjs` | ✅ hits **0** |

---

## 7. service_role 露出チェック

| 所在 | 状態 |
|------|------|
| ブラウザ JS / HTML | ❌ **なし** |
| `chat-supabase-config.js` | ❌ なし |
| `.env`（gitignore） | ✅ ローカル / CI のみ |
| Supabase Edge Secrets | ✅ サーバーのみ（digest 確認） |
| コミット内 service_role JWT | ❌ grep 0 件 |

---

## 8. dev user / mock user 残存チェック

### 8.1 Supabase Auth（意図的テストユーザー）

| メール | 用途 | 本番影響 |
|--------|------|----------|
| `talk-rls-a/b/admin@tasful-dev.test` | TALK RLS 検証 | P2 — ステージング専用・本番会員に使わない |
| `anpi-rls-*@tasful-dev.test` | 安否 RLS 検証 | 同上 |

→ **Auth ユーザーとして DB に存在**するが、本番アプリがこれらにバインドされていない限り **ブロッカーではない**。

### 8.2 クライアント mock

| 項目 | 所在 | 判定 |
|------|------|------|
| `currentUserId: "u_me"` | `chat-supabase-config.js` | P2 — デモ / 未ログイン fallback |
| Builder `demo-builder-user` | `builder/builder.js` seed | P2 — FROZEN 領域・localStorage 中心 |
| `u_store` 等 HTML 属性 | 静的デモ | P2 — UI デモ |

### 8.3 Git / env

| ファイル | gitignore | 備考 |
|----------|-----------|------|
| `.env` | ✅ | JWT + service_role |
| `chat-supabase-config.js` | ❌ **追跡中** | anon key 含む |
| `chat-supabase-config.local.js` | ✅ | ローカル上書き用 |

---

## 9. Edge Functions 側 JWT 検証要否

| 関数群 | 呼び出しキー | ユーザー JWT 検証 | 評価 |
|--------|-------------|-------------------|------|
| `stripe-*`（GenAI / Featured） | anon + body `user_id` | ❌ なし | P1 — session_id / 業務ロジックで制限（Stripe 確認済み） |
| `stripe-webhook` | Stripe 署名 | N/A | ✅ |
| `builder-create-signed-url` | **ユーザー JWT 必須** | ✅ `auth.getUser()` | ✅ |
| `openai-chat` / `anpi-line-send` 等 | anon / 外部 token | 関数ごと | 現状設計通り |
| DB 更新（GenAI / Featured） | `service_role` 内部 | N/A | ✅ |

**結論:** DB 直結系は RLS + deny；Edge 経由 GenAI は **anon  callable**（意図）。Builder のみ strict JWT。

---

## 10. リスク分類

### P0 — なし（Auth/JWT 接続スコープ）

| 過去 P0 | 現状 |
|---------|------|
| dev RLS + prod OR → bypass | ✅ **解消済み**（[`supabase-rls-p0-fix.md`](supabase-rls-p0-fix.md)） |
| ANPI JWT expired で検証不能 | ✅ **解消**（再発行 + 17/17 PASS） |
| service_role client 露出 | ✅ **なし** |

### P1

| ID | リスク | 内容 |
|----|--------|------|
| P1-A1 | marketplace anon 読取 | `profiles` / `members` / `listings` / `business_listings` dev SELECT 残存 |
| P1-A2 | JWT 運用 | access token ~1h — CI / 手動検証前に `issue-anpi-rls-jwt.mjs` 必須 |
| P1-A3 | Edge GenAI | `stripe-get-genai-plan` 等が anon + 任意 `user_id`（JWT 未突合） |

### P2

| ID | リスク | 内容 |
|----|--------|------|
| P2-A1 | `currentUserId: u_me` mock | 本番 Supabase Auth ログイン導線と別 |
| P2-A2 | `@tasful-dev.test` Auth ユーザー | ステージング検証用 — 本番会員データと分離 |
| P2-A3 | anon key Git 追跡 | ローテ時の更新プロセス |
| P2-A4 | legacy anon JWT 形式 | `sb_publishable_` への移行は Dashboard 次第 |

---

## 11. 本番投入可否

| スコープ | 可否 |
|----------|------|
| **TALK + 通知 + AI drafts + follow** | ✅ Auth/JWT + RLS OK |
| **TALK WebRTC Call** | ✅ 参加者分離 OK |
| **安否 Phase1/2 + audit** | ✅ OK |
| **GenAI subscriptions / entitlements** | ✅ client 直更新不可 |
| **Marketplace profiles / listings** | ⚠️ anon 読取 — **P1 別途** |
| **全体** | ⚠️ **条件付き可**（重点 6 領域 Auth は LOCK 可） |

---

## 12. 必要修正案（実施は FROZEN 解凍 / 運用判断後）

### 12.1 運用のみ（コード変更なし）

```bash
# JWT 再発行（~1h ごと / CI 失敗時）
node scripts/issue-anpi-rls-jwt.mjs --write-env

# 検証
node scripts/verify-anpi-rls-real-db.mjs
node scripts/verify-talk-rls-staging.mjs
node scripts/verify-anpi-no-response-rls-p0.mjs
```

### 12.2 P1 SQL（marketplace — 別 Epic）

```sql
-- 例: listings dev ポリシー DROP（本番ポリシー適用後）
-- 詳細: supabase-rls-final-audit.md P1-1
DROP POLICY IF EXISTS "listings_select_dev" ON public.listings;
-- profiles / members / business_listings 同様
```

### 12.3 P1 コード候補（FROZEN 解凍時）

- `stripe-confirm-genai-checkout` / `stripe-get-genai-plan` — Authorization JWT と `user_id` 突合
- 本番 Auth ログイン後に `currentUserId` を Supabase session から設定（mock 除去）

---

## 13. 最終回答

### Supabase JWT 更新は LOCK 可能か？

**✅ LOCK 可（重点ドメイン）**

- JWT 再発行手順が機能し、ANPI 17/17・TALK staging・Phase2 P0 が PASS
- invalid / expired JWT は 401
- `talk_user_id` / `member_id` クレームが RLS と整合
- Call / GenAI の Auth 境界は確認済み

**LOCK 対象外:** marketplace 読取 P1、GenAI Edge の user JWT 突合 P1、JWT 1h 運用サイクル

### P0 修正の有無

**なし**（Auth/JWT 接続・重点テーブル RLS）

### 修正対象（将来）

| 優先 | 対象 |
|------|------|
| P1 運用 | `.env` JWT 定期再発行 / CI secret |
| P1 SQL | `listings` / `profiles` / `members` / `business_listings` dev DROP |
| P1 コード | GenAI Edge JWT 突合（FROZEN 解凍） |
| P2 | mock `u_me` / dev Auth ユーザー整理 / anon key Git 方針 |

### RELEASE FROZEN 影響

| 操作 | 影響 |
|------|------|
| JWT 再発行・検証脚本実行 | **なし** |
| `.env` 更新（ローカル / CI） | **なし** |
| P1 SQL / Edge JWT コード | **あり** — 解凍要 |

---

**検証実施:** 2026-06-17 — Agent（調査・検証のみ）  
**補助:** `%TEMP%\supabase-jwt-auth-probe.mjs`, `%TEMP%\supabase-talk-call-probe.mjs`（リポジトリ外）
