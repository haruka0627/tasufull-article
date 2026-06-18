# P0 dev RLS DROP 適用結果

**実施日:** 2026-06-17  
**種別:** リンク DB への SQL 適用 + verify  
**対象 DB:** linked Supabase `ddojquacsyqesrjhcvmn`  
**根拠:** [`dev-rls-cleanup-plan.md`](dev-rls-cleanup-plan.md) · [`dev-rls-p0-drop-preflight.md`](dev-rls-p0-drop-preflight.md)

---

## 1. 総合判定: **PASS**

| 完了条件 | 結果 |
|----------|------|
| P0 dev/staging policy 削除 | ✅ `*_dev` 0 件 · staging PoC 0 件 |
| TALK verify | ✅ PASS |
| 安否 verify | ✅ PASS（セッション内 JWT 再発行後） |
| Marketplace RLS | ✅ **38/38 PASS** 維持 |
| 本番 policy 維持 | ✅ prod / owner / ops 系は DROP 未実施 |
| Marketplace P3 非退行 | ✅ `*_select_public` 0 件 |

---

## 2. 実行したコマンド

作業ディレクトリ: `C:\Users\rubih\tasufull-article`

### 2.1 適用（DROP）

```powershell
cd C:\Users\rubih\tasufull-article

node scripts/issue-anpi-rls-jwt.mjs

node scripts/apply-supabase-rls-p0-drop-dev.mjs

npx supabase db query --linked --yes -f sql/marketplace-rls-drop-dev-policies.sql

npx supabase db query --linked --yes -f sql/ops-rls-drop-dev-policies.sql
```

| コマンド | 終了 | 備考 |
|----------|------|------|
| `issue-anpi-rls-jwt.mjs` | 0 | verify 用 JWT 発行（`.env` 未更新） |
| `apply-supabase-rls-p0-drop-dev.mjs` | 0 | TALK + 安否 Phase1/2 · 末尾残存 SELECT **0 行** |
| `marketplace-rls-drop-dev-policies.sql` | 0 | 末尾残存 SELECT **0 行** |
| `ops-rls-drop-dev-policies.sql` | 0 | 末尾残存 SELECT **0 行**（staging 未存在時 no-op） |

**実行しなかったもの（指示通り）:**

- `apply-marketplace-rls.mjs` — 使用禁止（P3 `*_select_public` 再作成リスク）
- `marketplace-rls-production.sql` — 再実行なし
- `talk-call-push-rls-production.sql` / Push dev DROP — 残留確認のみ（後述）

### 2.2 事後確認 SQL

```powershell
npx supabase db query --linked --yes -f sql/dev-rls-p0-post-check.sql
```

### 2.3 verify

```powershell
node scripts/verify-talk-rls-staging.mjs

# 安否: .env の JWT 期限切れのため、issue 直後に同一セッション env で verify
node scripts/verify-anpi-rls-real-db.mjs      # （fresh JWT 注入後）
node scripts/verify-anpi-no-response-rls-p0.mjs

node scripts/verify-marketplace-rls.mjs

$env:SUPABASE_STRICT="1"; node scripts/test-talk-call-push-notification-design.mjs
```

---

## 3. DROP された policy 数

`DROP POLICY IF EXISTS` のため、**既に DROP 済みの場合は no-op**。監査時点の P0 対象と適用結果:

| ドメイン | 対象本数 | スクリプト | 今回の実効 DROP |
|----------|----------|------------|-----------------|
| TALK | 16 | `talk-rls-drop-dev-policies.sql` | 前回 P0 修正で **16 本 DROP 済** · 再実行 no-op |
| 安否 Phase2 | 6 | `anpi-no-response-phase2-drop-dev-policies.sql` | 前回 **6 本 DROP 済** · 再実行 no-op |
| 安否 Phase1 | 8（存在時） | `anpi-rls-drop-dev-policies.sql` | **未検出** · no-op |
| Marketplace | 10 | `marketplace-rls-drop-dev-policies.sql` | **10 本 DROP**（今回新規） |
| ops staging PoC | 可変 | `ops-rls-drop-dev-policies.sql` | **未検出** · no-op |
| TALK Push | 7（存在時） | — | **未実施** · dev **0 件**（Phase7 prod 適用済み） |

**P0 監査→適用完了時点の累計 DROP: 32 本**（16 + 6 + 10。Phase1 / ops / Push は DB 上も 0 件）

### 3.1 Marketplace DROP 内訳（10 本）

```
listings_{select,insert,update,delete}_dev
business_listings_{select,insert,update,delete}_dev
profiles_select_dev
members_select_dev
```

---

## 4. 残存 policy 数（事後 SQL）

`sql/dev-rls-p0-post-check.sql` 集計:

| 指標 | 件数 | 期待 |
|------|------|------|
| `all_dev_count`（`*_dev` 全体） | **0** | 0 |
| `staging_count`（`*staging_read*` / `*staging_dual_write*`） | **0** | 0 |
| `select_public_count`（Marketplace P3 退行） | **0** | 0 |
| P0 対象表 `*_dev` / `*_staging` | **0 行** | 0 行 |
| `talk_call_push_*` の `*_dev` | **0 行** | 0 行 |

本番 policy（`*_prod` / `*_own` / `*_owner` / `*_callee` / `*_participant` / `*_ops`）は DROP 対象外のため **維持**。

---

## 5. verify 結果

| スクリプト | 結果 | 詳細 |
|------------|------|------|
| `verify-talk-rls-staging.mjs` | **PASS** | Production RLS verification passed |
| `verify-anpi-rls-real-db.mjs` | **PASS** | **17/17 OK**（fresh JWT 後） |
| `verify-anpi-no-response-rls-p0.mjs` | **PASS** | 0 errors |
| `verify-marketplace-rls.mjs` | **PASS** | P1 + P2 + P3 · **38 チェック全 OK** · `no *_select_public base policies` |
| `test-talk-call-push-notification-design.mjs` | **PASS** | `SUPABASE_STRICT=1` · ALL PASS |
| | **INFO** | Edge invoke skipped (404) — 設計/統合テストは unit 側でカバー |

### 5.1 WARNING / 一度 FAIL した項目

| 項目 | 原因 | 対処 | 最終 |
|------|------|------|------|
| `verify-anpi-rls-real-db.mjs` | `.env` の `ANPI_RLS_*_JWT` 期限切れ（PGRST303） | `issue-anpi-rls-jwt.mjs` で再発行し、verify 時に JWT を上書き注入 | **PASS** |
| `verify-anpi-no-response-rls-p0.mjs` | 同上 | 同上 | **PASS** |
| Push Edge 404 | `talk-call-push-notify` 未デプロイ | 今回スコープ外 · 設計 verify は PASS | **INFO** |

**推奨:** ローカル `.env` を更新する場合は `node scripts/issue-anpi-rls-jwt.mjs --write-env`（有効期限 ~1h）。

---

## 6. 触らなかった P1 / スコープ外

| 対象 | 分類 | 理由 |
|------|------|------|
| `favorites_*_dev` | P1 保留 | owner-scoped prod 未整備 |
| `blocked_users_dev_all` | P1 保留 | 同上 |
| `moderation_logs_insert_dev` | P1 保留 | 同上 |
| `reports_insert_dev` | P1 保留 | 同上 |
| `transaction_*` Allow all | スコープ外 | dev 命名ではない · 別 Epic |
| `ai_messages`, `chats`, `reviews` Allow all | スコープ外 | 別 Epic |
| TALK Push dev 7 本 | 別途判断 | DB 上 dev **0 件** · prod のみ · DROP 不要 |
| 本番 `*_prod` / `*_own` / `*_ops` 等 | 禁止 | prod 維持 |

---

## 7. 次にやるべきこと

1. **`.env` JWT 更新** — `node scripts/issue-anpi-rls-jwt.mjs --write-env` で安否 verify を単独実行可能にする
2. **P1 dev RLS** — favorites / blocked_users / moderation_logs / reports の prod policy 整備後に dev DROP
3. **TALK Push 本番接続** — Edge `talk-call-push-notify` デプロイ · VAPID secrets · Phase7.1 migration · 実機 E2E
4. **transaction_* Allow all** — 別 Epic で owner/admin スコープ化
5. **定期確認** — `sql/dev-rls-p0-post-check.sql` で `*_dev` / staging / `*_select_public` が 0 のままか監視

---

## 8. 関連成果物

| ファイル | 用途 |
|----------|------|
| `sql/dev-rls-p0-post-check.sql` | 事後残存・退行・本番サンプル確認 |
| `reports/supabase-rls-p0-fix.md` | 前回 TALK + 安否 Phase2 DROP（22 本） |
| `reports/dev-rls-p0-drop-preflight.md` | 適用前監査 |

**Verdict:** P0 dev/staging policy はリンク DB から除去済み。本番 RLS が実効化され、全 verify PASS（Marketplace 38/38 維持）。
