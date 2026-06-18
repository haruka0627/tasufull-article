# 本番接続 P0 切り分け・対応手順書

**作成日:** 2026-06-17  
**対象:** 本番接続前ブロッカー P0-1 / P0-2 / P0-3  
**方針:** 本ドキュメントは **手順書のみ**。実配線・SQL 適用・JWT 更新は **まだ実施しない**。  
**製品コード:** 原則変更しない（RELEASE FROZEN 6 領域を維持）

| 凍結領域 | ドキュメント |
|----------|-------------|
| 市場EC | [`market-ec-release-status.md`](market-ec-release-status.md) |
| TALK | [`talk-release-status.md`](talk-release-status.md) |
| Builder | [`builder-release-status.md`](builder-release-status.md) |
| AI運営秘書 | [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) |
| Connect | [`connect-release-status.md`](connect-release-status.md) |
| 安否 | [`anpi-release-status.md`](anpi-release-status.md) |

**根拠監査:** [`pre-production-cross-audit-remaining-issues.md`](pre-production-cross-audit-remaining-issues.md)

---

## サマリー

| ID | 問題 | 原因（切り分け） | 製品コード変更 | 実施主体 |
|----|------|------------------|----------------|----------|
| **P0-1** | 実 Stripe Webhook 未接続 | Stripe Dashboard に endpoint 未登録、または `STRIPE_WEBHOOK_SECRET` 不一致。Connect ingest はブラウザ `localStorage` シミュレーションのみ | **P0 範囲: 不要**（既存 Edge Function 配線のみ）。Connect/市場 KPI 連携は **別途要検討** | インフラ / Stripe 運用 |
| **P0-2** | RLS 実 DB 検証 JWT expired | `.env` の `ANPI_RLS_*_JWT` 期限切れ（Supabase access token 既定 ~1h） | **不要** | 運用（JWT 再発行） |
| **P0-3** | 本番 RLS ポリシー適用確認 | `*_prod` 未適用、または `*_dev` 残存で RLS 無効化のリスク | **不要** | Supabase SQL Editor |

**推奨実施順:** P0-3（RLS 確認・適用）→ P0-2（JWT 再発行）→ P0-1（Stripe Webhook 配線）

---

## P0-1 — 実 Stripe Webhook 未接続

### 現状

| レイヤ | 状態 | 根拠 |
|--------|------|------|
| Edge Function `stripe-webhook` | **実装・デプロイ済み**（要 Dashboard 登録確認） | `supabase/functions/stripe-webhook/index.ts`、`docs/production-release-checklist.md` |
| Stripe Dashboard endpoint | **未配線（想定）** | 監査: `stripe_webhook_sim` / ingest ログのみ |
| Connect トラブル ingest | **ブラウザシミュレーション** | `stripe-connect-ingest.js` → `localStorage` + `stripe_webhook_sim` |
| 市場 EC 決済 | **success_url → confirm 系** | `stripe-confirm-shop-checkout`（Webhook 非依存パスあり） |

### 原因

1. **インフラ未完了:** Stripe Dashboard → Developers → Webhooks に、Supabase Edge Function URL が **未登録**、または **Live/Test モード不一致**。
2. **Secret 不一致:** Dashboard の署名シークレット（`whsec_...`）と Supabase secret `STRIPE_WEBHOOK_SECRET` が **別値**。
3. **スコープの切り分け（重要）:** 既存 `stripe-webhook` が処理するのは **上位掲載・GenAI Checkout / Subscription** のみ。Connect payout（`account.updated`, `payout.*` 等）や AI 運営 KPI への **サーバー側 ingest ブリッジは未実装** — これは P0-1 の「Dashboard 配線」とは別問題（後述「製品コード要否」参照）。

### 必要な作業（実配線フェーズ — 本書では未実施）

#### Phase A — 既存 Edge Function の本番配線（P0 最小スコープ）

| # | 作業 | 詳細 |
|---|------|------|
| A-1 | Supabase CLI ログイン・リンク | `supabase login` → `supabase link --project-ref ddojquacsyqesrjhcvmn` |
| A-2 | Secrets 確認・設定 | 下記「環境変数」参照 |
| A-3 | Function 再デプロイ（任意・推奨） | `supabase functions deploy stripe-webhook` |
| A-4 | Stripe Dashboard 登録 | URL: `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook` |
| A-5 | イベント購読設定 | 最低限: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |
| A-6 | 署名シークレット反映 | Dashboard で発行された `whsec_...` を `STRIPE_WEBHOOK_SECRET` に設定 |
| A-7 | 疎通確認 | 下記「検証コマンド」 |

#### Phase B — Connect / 市場 KPI 連携（P0 外・接続フェーズ P2）

| 項目 | 現状 | 備考 |
|------|------|------|
| Connect payout イベント | Edge Function 未処理 | `stripe-connect-ingest.js` はブラウザのみ |
| 市場 EC `checkout.session.completed`（shop metadata） | Edge Function 未処理 | `stripe-confirm-shop-checkout` で success_url 確認可能 |
| AI 運営 KPI ingest | `ingestProductionWebhook()` はテスト/手動呼び出し | `test-admin-ai-connectivity-p2.mjs` |

→ Phase B は **本 P0 手順完了後** に別途設計。製品コード変更の要否は末尾セクション参照。

### 必要な環境変数

#### Supabase Edge Function Secrets（Dashboard / CLI）

| 変数 | 用途 | 取得元 |
|------|------|--------|
| `STRIPE_SECRET_KEY` | Stripe API 呼び出し | Stripe Dashboard → Developers → API keys（**本番は `sk_live_...`**） |
| `STRIPE_WEBHOOK_SECRET` | 署名検証 | Webhook endpoint 作成時の `whsec_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | DB 更新（featured / genai 適用） | Supabase Dashboard → Settings → API |
| `SITE_URL` | Checkout 戻り URL 構築（関連 Function 用） | 本番ドメイン確定後 |

`SUPABASE_URL` は Functions 実行時に **自動注入**（手動設定不要）。

#### ローカル検証用（開発者マシン）

| 変数 | 用途 |
|------|------|
| Stripe CLI ログイン | `stripe login` |
| `stripe listen` 転送先 | `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` |

リポジトリの `.env` に Stripe secret を **コミットしない**。

### 本番 / ローカルの違い

| 項目 | ローカル（開発） | 本番 |
|------|------------------|------|
| Stripe モード | `sk_test_...` + Test Webhook | `sk_live_...` + Live Webhook |
| Webhook 到達 | `stripe listen --forward-to ...` で CLI 経由 | Stripe → Supabase Edge 直接 POST |
| Connect ingest | `TasuStripeConnectIngest.setIngestMode("simulation")` 既定 | 実 HTTP Webhook 未到達（現状） |
| イベント処理 | 同一 Edge Function URL（project-ref は共通） | Test/Live で **別 endpoint・別 whsec** |

### 検証コマンド

```bash
# --- Secrets / デプロイ状態 ---
supabase secrets list
supabase functions list | findstr stripe-webhook

# --- ローカルから Stripe CLI 転送（Test mode） ---
stripe listen --forward-to https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook

# 別ターミナル: テストイベント送信
stripe trigger checkout.session.completed

# --- Edge Function ログ（Dashboard） ---
# Supabase Dashboard → Edge Functions → stripe-webhook → Logs
# 期待: signature OK → 200 {"received":true,...}
# 失敗例: 400 Invalid signature → STRIPE_WEBHOOK_SECRET 不一致

# --- ブラウザ E2E（Connect ハードニング — シミュレーション PASS 確認） ---
# 別途 dev server 起動後
set BASE_URL=http://127.0.0.1:8765
node scripts/test-stripe-connect-trouble-hardening-browser.mjs

# --- AI 運営 P2 ingest（localStorage 経由 — 本番 Webhook ではない） ---
node scripts/test-admin-ai-connectivity-p2.mjs
```

**P0-1 完了判定（Phase A）:**

- Stripe Dashboard で endpoint が **Enabled**、直近 delivery が **200**
- `stripe trigger checkout.session.completed` 後、Edge Function ログに **signature verification 成功**
- （任意）上位掲載 / GenAI テスト決済で DB 反映を目視確認

### ロールバック方法

| 操作 | 手順 | 影響 |
|------|------|------|
| Webhook 無効化 | Stripe Dashboard → 該当 endpoint → **Disable** または Delete | イベント停止。Checkout は **success_url → confirm-* Function** フォールバックが残る機能あり |
| Secret ロールバック | `supabase secrets set STRIPE_WEBHOOK_SECRET=<旧 whsec>` | 旧 Dashboard endpoint とペアで使用 |
| Function ロールバック | `supabase functions deploy stripe-webhook`（Git 過去版 checkout 後） | デプロイ履歴に依存。通常は Disable endpoint で十分 |
| Connect ingest | 変更なし | 引き続き `simulation` モード（`localStorage`） |

---

## P0-2 — Supabase RLS 実 DB 検証 JWT expired

### 現状

`node scripts/verify-anpi-rls-real-db.mjs` → **9/18 NG**（2026-06 監査時）

| 結果 | 内容 |
|------|------|
| OK（9） | JWT member_id 解決、cleanup、preflight（anon insert 拒否）、anon 系拒否テスト等 |
| NG（9） | User A/B / Admin の CRUD テスト → `HTTP 401` / `"JWT expired"`（`PGRST303`） |

**切り分け:** RLS ポリシー自体ではなく、**検証用 access token の期限切れ** が主因。preflight が PASS しているため、anon 全許可（`*_dev` 残存）は **当時未検出**（P0-3 と併せて SQL 確認は推奨）。

### 原因

1. Supabase Auth `access_token` の **exp 期限切れ**（通常 1 時間程度）。
2. `.env` の `ANPI_RLS_USER_A_JWT` / `ANPI_RLS_USER_B_JWT` / `ANPI_RLS_ADMIN_JWT` が **再発行されていない**。
3. CI / 共有 `.env` に古い JWT が残存している可能性。

### 必要な作業（実施フェーズ — 本書では未実施）

| # | 作業 | 詳細 |
|---|------|------|
| B-1 | P0-3 完了確認 | `*_dev` 0 行・`*_prod` 8 本存在を先に確認 |
| B-2 | Service Role 準備 | Dashboard → API_BASE → `service_role` を `.env` に（**コミット禁止**） |
| B-3 | テストユーザー確認 | 未作成なら `issue-anpi-rls-jwt.mjs` が自動作成（ステージング専用メール） |
| B-4 | JWT 再発行 | `node scripts/issue-anpi-rls-jwt.mjs --write-env` |
| B-5 | 実 DB 検証 | `node scripts/verify-anpi-rls-real-db.mjs` → **18/18 PASS** |
| B-6 | CI secrets 更新 | CI で同 JWT を使う場合、リポジトリ secrets を更新 |
| B-7 | ブラウザ E2E（任意） | `node scripts/test-anpi-rls-production-browser.mjs`（JWT 不要・モック中心） |

### 必要な環境変数

#### JWT 発行（`issue-anpi-rls-jwt.mjs`）

| 変数 | 必須 | 説明 |
|------|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | **必須** | Admin API でユーザー作成・トークン発行 |
| `SUPABASE_URL` | 任意 | 未設定時 `chat-supabase-config.js` から読取 |
| `SUPABASE_ANON_KEY` | 任意 | 同上 |

#### テストユーザー上書き（任意）

| 変数 | 既定 |
|------|------|
| `ANPI_RLS_USER_A_EMAIL` / `_PASSWORD` / `_MEMBER_ID` | `anpi-rls-a@tasful-dev.test` / `AnpiRlsTestA1!` / `anpi_rls_member_a` |
| `ANPI_RLS_USER_B_EMAIL` / `_PASSWORD` / `_MEMBER_ID` | `anpi-rls-b@tasful-dev.test` / `AnpiRlsTestB1!` / `anpi_rls_member_b` |
| `ANPI_RLS_ADMIN_EMAIL` / `_PASSWORD` / `_MEMBER_ID` | `anpi-rls-admin@tasful-dev.test` / `AnpiRlsAdmin1!` / `anpi_rls_admin` |

#### 実 DB 検証（`verify-anpi-rls-real-db.mjs`）

| 変数 | 説明 |
|------|------|
| `SUPABASE_URL` | プロジェクト URL |
| `SUPABASE_ANON_KEY` | anon public key |
| `ANPI_RLS_USER_A_JWT` | 会員 A access token |
| `ANPI_RLS_USER_B_JWT` | 会員 B access token |
| `ANPI_RLS_ADMIN_JWT` | 管理者 access token（`app_metadata.role = tasu_admin`） |

詳細: [`docs/anpi-rls-jwt-setup.md`](../docs/anpi-rls-jwt-setup.md)

### 本番 / ローカルの違い

| 項目 | ローカル | 本番 / ステージング DB |
|------|----------|------------------------|
| JWT 発行先 | 同一 Supabase プロジェクト（`ddojquacsyqesrjhcvmn`） | 同左（検証は **実 DB** に対して実行） |
| テストユーザー | `@tasful-dev.test` 等ステージング専用 | **実会員メールは使わない** |
| 有効期限 | 再発行のたび `.env` 更新が必要 | 本番 Auth セッションは別フロー（ブラウザログイン） |
| 検証スクリプト | Node から REST API 直接 | RLS 有効 DB に対する自動 CRUD 18 ケース |

### 検証コマンド

```bash
# 1. JWT 再発行（.env の 3 変数のみ上書き）
node scripts/issue-anpi-rls-jwt.mjs --write-env

# 2. JWT 内容確認（member_id / role / exp）
node -e "const p=JSON.parse(Buffer.from(process.argv[1].split('.')[1],'base64url'));console.log(p)" %ANPI_RLS_USER_A_JWT%

# 3. 実 DB RLS 全件検証
node scripts/verify-anpi-rls-real-db.mjs
# 期待: 18/18 PASS、exit code 0

# 4. ブラウザ E2E（補助）
set BASE_URL=http://127.0.0.1:8765
node scripts/test-anpi-rls-production-browser.mjs
# 期待: 22/22 PASS
```

**P0-2 完了判定:** `verify-anpi-rls-real-db.mjs` が **18/18 PASS**、exit code **0**。

### ロールバック方法

| 操作 | 手順 | 影響 |
|------|------|------|
| JWT のみ失効 | 再発行で上書き（旧 token は自然失効） | 検証スクリプトのみ影響 |
| テストユーザー削除 | Dashboard → Authentication → Users → 削除 | 再実行時に `issue-anpi-rls-jwt.mjs` が再作成 |
| 検証データ残留 | スクリプトは `cleanup()` で verify 用行を削除 | 失敗中断時は admin JWT で手動 DELETE 可 |
| RLS 自体 | **JWT 更新では RLS を変更しない** | P0-3 ロールバック参照 |

---

## P0-3 — 本番 RLS ポリシー適用確認

### 現状

| 確認経路 | 結果 | 解釈 |
|----------|------|------|
| `verify-anpi-rls-real-db.mjs` preflight | **OK** — anon insert 拒否、「dev ポリシー未検出」 | `*_dev` による anon 全許可は **当時検出されず** |
| 監査分類 P0-3 | **要確認** | SQL Editor による **正式確認が未記録** |
| ブラウザ E2E | **22/22 PASS** | クライアント側 RLS 拒否 UI（モック中心） |

**用語整理:** 検証ログの「dev ポリシー**未**検出」は **良好**（dev ポリシーが残っていない）。P0-3 は **Dashboard / SQL による prod 適用の証跡** が不足している状態。

### 原因（想定シナリオ）

1. `sql/anpi-rls-production.sql` が本番 DB に **未適用**、または部分適用。
2. `sql/anpi-rls-drop-dev-policies.sql` が **未実行** — `*_dev`（`using (true)`）が `*_prod` と OR 結合され **RLS 実質無効**。
3. 前提 SQL（`anpi-user-context.sql` 等）未適用で prod ポリシー作成失敗。
4. `anpi_is_admin()` 等ヘルパー関数が古い定義のまま。

### 必要な作業（実施フェーズ — 本書では未実施）

#### SQL 適用順序（Supabase SQL Editor）

| 順 | ファイル | 内容 |
|----|----------|------|
| 1 | `sql/anpi-user-context.sql` | テーブル + 開発用 RLS |
| 2 | `sql/anpi-notification-logs.sql` | テーブル + 開発用 RLS |
| 3 | `sql/anpi-identity-linking.sql` | `member_id` 等カラム |
| 4 | `sql/anpi-rls-production.sql` | 本番ヘルパー + `*_prod` ポリシー |
| 5 | **`sql/anpi-rls-drop-dev-policies.sql`** | **`*_dev` 全削除（必須）** |

適用後:

| 順 | ファイル | 目的 |
|----|----------|------|
| 6 | `sql/anpi-rls-staging-verify.sql` | 結果セット目視（セクション 3 = 0 行が必須） |

詳細: [`docs/anpi-supabase-production-checklist.md`](../docs/anpi-supabase-production-checklist.md)

#### 期待する prod ポリシー（各テーブル 4 操作）

**anpi_user_contexts:** `anpi_user_contexts_select_prod`, `_insert_prod`, `_update_prod`, `_delete_prod`  
**anpi_notification_logs:** `anpi_notification_logs_select_prod`, `_insert_prod`, `_update_prod`, `_delete_prod`

#### dev ポリシー（本番では 0 件であること）

- `anpi_user_contexts_*_dev`（4 本）
- `anpi_notification_logs_*_dev`（4 本）

### 必要な環境変数

P0-3 は **SQL Editor 操作** のため環境変数不要。  
後続 P0-2 検証用に `SUPABASE_URL` / `SUPABASE_ANON_KEY` / JWT 3 本を使用。

### 本番 / ローカルの違い

| 項目 | ローカル | 本番 DB |
|------|----------|---------|
| RLS 検証 | Node スクリプトが **リモート Supabase** に REST | 同左（ローカル DB ではない） |
| `*_dev` ポリシー | 開発中は残存しうる | **必ず DROP**（残存 = 全許可 OR 結合） |
| 管理者判定 | JWT `app_metadata.role = tasu_admin` | 本番 Auth でも同 claim 設計 |
| 未ログイン UX | localStorage のみ（製品側） | Supabase upsert しない |

### 検証コマンド

```bash
# --- SQL Editor（手動） ---
# 1. sql/anpi-rls-staging-verify.sql を実行
# セクション 3: dev ポリシー → 0 行
# セクション 4: prod_policy_count = 4 / dev_policy_count = 0（各テーブル）

# --- 自動 preflight + 全 CRUD ---
node scripts/verify-anpi-rls-real-db.mjs
# preflight NG 例:
#   "HTTP 201 — *_dev ポリシーが残っている可能性があります"
#   → sql/anpi-rls-drop-dev-policies.sql を実行

# --- ブラウザ E2E ---
set BASE_URL=http://127.0.0.1:8765
node scripts/test-anpi-rls-production-browser.mjs
```

**P0-3 完了判定:**

- `anpi-rls-staging-verify.sql` セクション **3 = 0 行**、セクション **4** で `prod_policy_count = 4`
- `verify-anpi-rls-real-db.mjs` preflight **PASS**（P0-2 JWT 更新後に全 18 PASS）

### ロールバック方法

| 操作 | 手順 | リスク |
|------|------|--------|
| prod ポリシー削除 | Dashboard → Authentication → Policies から `*_prod` を DROP | **安否 DB 書き込み不可** — メンテナンス窗口で実施 |
| dev ポリシー再追加 | `anpi-user-context.sql` / `anpi-notification-logs.sql` の dev 部分を再実行 | **本番禁止** — ステージングのみ |
| ヘルパー関数 | 旧版 SQL を再 `create or replace` | RLS 判定変更 — 要検証 |
| 推奨 | 問題時は **メンテナンス表示 + anon 書き込み遮断** を優先し、ステージングで再検証後に prod 再適用 | — |

---

## 製品コード変更の要否

### P0 実施に必要な変更: **なし**

P0-1 / P0-2 / P0-3 はすべて **インフラ配線・運用・Supabase SQL** で完結する。

### 接続フェーズで別途検討が必要な変更（P0 外）

以下は監査で「実 Webhook 未接続」と関連するが、**既存 `stripe-webhook` の Dashboard 登録だけでは解決しない** 項目。RELEASE FROZEN 方針のため **事前報告のみ**（実装は別承認）。

| 要否 | 変更理由 | 対象ファイル（候補） |
|------|----------|---------------------|
| **要検討** | Connect payout / account イベントをサーバー側で受信し、Connect トラブル・AI 運営 KPI に反映する | `supabase/functions/stripe-webhook/index.ts`（イベント分岐追加）、新規 `_shared/` ヘルパー、（必要なら）DB テーブル / ingest API |
| **要検討** | 市場 EC shop checkout の Webhook 経由確定（success_url 非依存化） | `supabase/functions/stripe-webhook/index.ts`、`supabase/functions/_shared/resolve-shop-payout.ts` |
| **要検討** | ブラウザ `stripe-connect-ingest.js` からサーバー ingest への移行 | `stripe-connect-ingest.js`、`admin-operations-dashboard.html` 連携 JS |
| **不要（現状）** | 上位掲載・GenAI — 既存 Edge Function で処理済み | 配線のみ |
| **不要** | 安否 RLS / JWT — 運用 + SQL のみ | — |

**判定:** 本番接続 **Go/No-Go の P0** は Phase A（既存 webhook 配線）+ P0-2 + P0-3 で足りる。Connect KPI・市場パイプラインの **実イベント連携** は [`pre-production-cross-audit-remaining-issues.md`](pre-production-cross-audit-remaining-issues.md) の P2 として扱う。

---

## 実施チェックリスト（実行時用）

実配線フェーズでこの順にチェック:

- [ ] **P0-3** `sql/anpi-rls-staging-verify.sql` — dev 0 行 / prod 4×2 確認
- [ ] **P0-3** 未適用なら SQL 1→5 を順適用
- [ ] **P0-2** `issue-anpi-rls-jwt.mjs --write-env`
- [ ] **P0-2** `verify-anpi-rls-real-db.mjs` → 18/18 PASS
- [ ] **P0-1** Supabase secrets（`STRIPE_*`）本番値確認
- [ ] **P0-1** Stripe Dashboard Webhook 登録 + イベント購読
- [ ] **P0-1** `stripe trigger` またはテスト決済 → Edge Logs 200
- [ ] 成果記録を `docs/production-release-checklist.md` に反映

---

## 関連ドキュメント

| ドキュメント | 用途 |
|-------------|------|
| [`supabase/STRIPE_FEATURED_SETUP.md`](../supabase/STRIPE_FEATURED_SETUP.md) | Stripe Webhook URL・デプロイ手順 |
| [`docs/production-release-checklist.md`](../docs/production-release-checklist.md) | 横断本番チェックリスト |
| [`docs/anpi-supabase-production-checklist.md`](../docs/anpi-supabase-production-checklist.md) | 安否 SQL 順序 |
| [`docs/anpi-rls-jwt-setup.md`](../docs/anpi-rls-jwt-setup.md) | JWT 発行詳細 |
| [`sql/anpi-rls-staging-verify.sql`](../sql/anpi-rls-staging-verify.sql) | RLS 確認クエリ |
| [`sql/anpi-rls-drop-dev-policies.sql`](../sql/anpi-rls-drop-dev-policies.sql) | dev ポリシー削除 |

---

*本書は手順書のみ。実 Stripe Webhook 配線・JWT 更新・RLS SQL 適用は別タスクで実施すること。*
