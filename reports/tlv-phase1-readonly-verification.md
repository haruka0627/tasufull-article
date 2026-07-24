# Phase 1 Read-Only Verification — TLV Payment 本番化前提確認

**日付:** 2026-06-28  
**種別:** Inventory / Verify **のみ**（read-only）  
**Project:** `ddojquacsyqesrjhcvmn`（tasful-ai · Tokyo · **● linked 確認済**）  
**禁止事項遵守:** migration apply · deploy · webhook 更新 · secret 変更 · DB 更新 · コード変更 — **すべて未実施**

**正本 Runbook:** [tlv-payment-production-readiness.md](./tlv-payment-production-readiness.md) · [tlv-payment-migration-manifest.json](./tlv-payment-migration-manifest.json)

---

## Executive summary

| 観点 | 結果 |
| --- | --- |
| **Fingerprint Inventory** | **7/7 PASS** |
| **Migration Apply 件数** | **0 件**（期待どおり） |
| **Verify スイート** | **PS-01〜04 PASS** · PS-05 部分 PASS |
| **Schema / RLS / PostgREST** | **Ready** |
| **Registry（fingerprint モデル）** | **Ready**（`schema_migrations` 非登録は **設計どおり**） |
| **Go Approval 前の Read-Only 判定** | **✅ Go**（Inventory/Verify 合格 · Apply 不要） |
| **Phase 1 本番作業 Go** | **❌ No-Go**（Backup/PITR · Stripe · FinOps Runbook · Go Approval 未） |

---

## 1. Fingerprint Inventory

**Command:** `npx supabase db query --linked -f scripts/sql/tlv-recovery-fingerprints-all.sql`

| step | ok |
| --- | --- |
| step0_tlv_schema | **true** |
| step1_handle_payment_webhook_success | **true** |
| step2_payer_user_uuid_column | **true** |
| step3_create_tip_transaction | **true** |
| step4_rls_vw_owner_select | **true** |
| step5_payment_reversals_table | **true** |
| step5_handle_payment_refund | **true** |

**Apply 件数:** **0**（全 fingerprint true → Skip 正本どおり）

---

## 2. Migration / Registry Inventory

### 2.1 `supabase_migrations.schema_migrations`（registry）

**Command:** `scripts/sql/tlv-recovery-schema-migrations.sql`

| version | name |
| --- | --- |
| 20260630100000 | partner_p1_schema |
| 20260630100001 | partner_p1_auth_hook |
| 20260710100000 | secretary_google_token_vault |
| 20260711100000 | business_directory_phase1_schema |
| 20260711100001 | business_directory_phase1_seed |
| 20260712100000 | business_directory_phase6_stripe_subscription |

**TLV Payment Step 0〜5（`20260628120000`〜`20260628160000`）:** registry **未登録** — manifest 注記「**schema_migrations does NOT track TLV steps; use fingerprints**」どおり **期待動作**。

### 2.2 Git migration inventory（参照）

| ファイル | Step | fingerprint 正本 |
| --- | --- | --- |
| `db/tlv_schema.sql` | 0 | step0_tlv_schema ✅ |
| `20260628120000_tlv_payment_phase2_rpc.sql` | 1 | step1 ✅ |
| `20260628130000_tlv_payer_user_uuid.sql` | 2 | step2 ✅ |
| `20260628140000_tlv_create_tip_transaction_rpc.sql` | 3 | step3 ✅ |
| `20260628150000_tlv_payment_rls.sql` | 4 | step4 ✅ |
| `20260628160000_tlv_payment_chargeback_clawback.sql` | 5 | step5 ✅ |
| `20260628100000_live_p0_schema.sql` | TLV-P0-01 関連 | `live_broadcasts` 等 **DB 存在** |

**manifest:** [tlv-payment-migration-manifest.json](./tlv-payment-migration-manifest.json) — `recovery_phase: P2_complete` · `db_applied: true`（Step 0〜5）· `config_push: false`（git 記録 · 下記 PostgREST は **実 API で tlv expose 確認済**）

---

## 3. Schema Inventory

### 3.1 `tlv` schema

| 項目 | 値 |
| --- | --- |
| schema 存在 | **true** |
| テーブル数 | **20** |
| 主要 RPC | webhook · create_tip · refund · dispute — **すべて存在** |
| RLS policy 数 | **20** |

**テーブル一覧（`tlv-drift-tables.sql`）:** coin_lots · creators · creator_score_* · fee_config · gauge_state · legend_waitlist · payment_* · payout_log · revenue_ledger · stream_events · streams · tips · viewer_wallets · wallet_ledger 等 **20 件**

### 3.2 `public.live_*`（TLV-P0-01 参考）

**live_broadcasts_exists:** **true** · `live_*` テーブル **19 件**（P0 + 後続 monetization 含む）

→ TODO「live_p0 staging 適用待ち」との **ステータス差分**あり（linked DB には live 系 **既存**）。Phase 1 Payment Apply には **影響なし** · Phase 2 前に live migration 状態の **別途 fingerprint 化**を推奨。

---

## 4. Verify 結果

### 4.1 Automated suites（linked DB · read-only 中心）

| ID | Script | 結果 |
| --- | --- | --- |
| **PS-01** | `test-tlv-payment-logic.mjs` | **26/26 PASS** |
| **PS-02** | `test-tlv-create-tip-rpc-staging.mjs` | **19/19 PASS** |
| **PS-03** | `test-tlv-payment-rls-staging.mjs` | **30/30 PASS** |
| **PS-04** | `test-tlv-payment-chargeback-staging.mjs` | **10/10 PASS** |
| **PS-05** | `test-tlv-payment-edge.mjs` | **PASS**（anon 401 · e2e webhook 成功 · duplicate no-op）· createTip RPC integration **SKIP** |

### 4.2 RLS verify（`tlv-staging-rls-meta.sql`）

対象 10 表すべて **`rls=true` · `force_rls=true`**

### 4.3 PostgREST expose verify（HTTP read-only）

| Probe | Accept-Profile | Status | 解釈 |
| --- | --- | --- | --- |
| `/rest/v1/viewer_wallets` | `public` | **404** | public 未 expose ✅ |
| `/rest/v1/viewer_wallets` | `tlv` | **401** | **tlv schema expose 済**（auth 必須） |
| `/rest/v1/payments` | `tlv` | **401** | 同上 |
| `/rest/v1/live_broadcasts` | `public` | **200** | public live 読取可 |

**git `config.toml`:** `schemas = ["public", "graphql_public", "tlv"]` — **production API と整合**

### 4.4 Registry verify

| チェック | 結果 |
| --- | --- |
| fingerprint Step 0〜5 | **全 true** |
| git manifest `db_applied` | **true**（inventory と一致） |
| `schema_migrations` に TLV 行 | **なし**（**意図的** · fingerprint 正本） |
| Apply 必要 Step | **0 件** |

### 4.5 Backup / PITR（read-only CLI）

**Command:** `npx supabase backups list --project-ref ddojquacsyqesrjhcvmn`

| 項目 | 値 |
| --- | --- |
| WALG | **true** |
| PITR | **false** |
| Snapshot 日時記録 | **未記録**（Runbook 要件未充足） |

---

## 5. 差分一覧

### 5.1 Missing

| 項目 | 深刻度 | 備考 |
| --- | --- | --- |
| `schema_migrations` への TLV Step 0〜5 行 | **なし（設計）** | fingerprint 正本 |
| Stripe Production 7 events 確認 | **Ops** | Dashboard 未確認 · PRE-FLIGHT と同様 |
| Release 直前 snapshot 日時 | **Ops** | 未記録 |
| FinOps Clawback Runbook **実施記録** | **Ops** | TODO-CB-OPS-01 未 |
| Go Approval | **Ops** | 未 |

### 5.2 Drift

| 項目 | 内容 | 対応 |
| --- | --- | --- |
| **Registry drift** | TLV DB 適用済みだが `schema_migrations` 未登録 | **既知 · manifest 分類 `git_and_db_registry_missing`** · Apply 不要 |
| **manifest `config_push: false`** | git 上は未 push だが API で tlv expose 確認 | production は **既に expose 済** の可能性 · Release 時に Dashboard 再確認 |
| **TODO TLV-P0-01 文言** | 「live_p0 未適用」 vs DB に `live_*` 19 表 | **ドキュメントステータス遅れ** · Payment Phase 1 blocker ではない |
| **Edge webhook** | PRE-FLIGHT「deploy 未」と edge e2e **成功** | webhook **デプロイ済** · chargeback 用 Stripe event 追加は **未確認** |

### 5.3 Unexpected objects

| 項目 | 内容 |
| --- | --- |
| なし（blocker 級） | `tlv` 20 表 · 20 RLS · 4 RPC — 設計範囲内 |
| 参考 | `live_*` に monetization 系（`live_video_*` 等）— 後続 migration 適用済みの正常拡張 |

### 5.4 Fingerprint mismatch

**なし** — 7/7 true

### 5.5 Migration mismatch

| Git | DB registry | DB fingerprint |
| --- | --- | --- |
| Step 0〜5 tracked | **未登録** | **applied** |
| live_p0 + 後続 live migrations | 一部未登録 | **live 表存在** |

→ Payment Phase 1:** Apply 0 件で Release Verify 可能** · live 系は **別 inventory** 推奨（Phase 2 前）

---

## 6. Go Readiness

| 項目 | 状態 | 備考 |
| --- | --- | --- |
| **Backup/PITR** | **NG** | WALG ✅ · **PITR ❌** · snapshot 日時未記録 |
| **Schema** | **Ready** | tlv 20 表 · RPC 4 種 · fingerprint 7/7 |
| **Registry** | **Ready** | fingerprint モデル整合 · Apply **0 件** |
| **RLS** | **Ready** | 20 policies · FORCE RLS · PS-03 **30/30** |
| **PostgREST** | **Ready** | tlv profile **401**（expose 済）· public tlv 表 **404** |
| **Stripe Production** | **NG** | Dashboard / 7 events / signing secret **未確認**（変更なし） |
| **Edge Deploy** | **Partial Ready** | webhook · purchase · tip **応答あり** · refund/dispute event 登録 **未確認** |
| **Runbook** | **NG** | FinOps clawback 未実施 · PS-M 未 · Go Approval なし |

---

## 7. Go / No-Go 判定

### 7.1 Read-Only Verification（今回）

| 判定 | 結果 |
| --- | --- |
| **Inventory / Verify Go** | **✅ Go** |
| 理由 | 全 fingerprint true · Verify スイート PASS · **Apply 0 件** · Schema/RLS/PostgREST Ready |

### 7.2 Phase 1 本番作業（Go Approval 後）

| 判定 | 結果 |
| --- | --- |
| **Phase 1 Production Go** | **❌ No-Go** |
| 残 blocker | Backup/PITR 方針 · snapshot 記録 · Stripe 7 events 確認 · FinOps Clawback Runbook · Go Approval · PS-M01〜05 |

---

## 8. Phase 1 開始可否

| フェーズ | 可否 | 条件 |
| --- | --- | --- |
| **Read-Only Verification** | **完了 ✅** | 本レポート |
| **Go Approval 提出** | **可 ✅** | Inventory/Verify 問題なし · Apply 不要 |
| **Phase 1 本番作業開始** | **Go Approval 後** | Backup 記録 · PITR 方針文書化 or 有効化 · Stripe 確認 · Runbook Step 5〜10 |
| **Phase 2（Live 基盤）** | **Phase 1 Go 後** | 実装フェーズ計画どおり |

---

## 9. Go Approval 前に人間作業が必要な項目

1. Supabase Dashboard → Backups → **最新 snapshot 日時を Runbook に記録**
2. **PITR** 有効化 **または** WAL-G-only 復旧方針の **文書承認**
3. Stripe Dashboard → Production webhook → **7 events** · signing secret 目視確認
4. **Go Approval** 署名（FinOps / Eng）
5. Release day: **Verify のみ再実行**（本レポート PS-01〜05 コマンド）→ PS-M01〜05

**Apply は Go Approval 後も fingerprint true 継続なら 0 件のまま。**

---

## 10. 実行コマンドログ（再現用）

```bash
npx supabase projects list
npx supabase db query --linked -f scripts/sql/tlv-recovery-fingerprints-all.sql
npx supabase db query --linked -f scripts/sql/tlv-recovery-schema-migrations.sql
npx supabase db query --linked -f scripts/sql/tlv-drift-tables.sql
npx supabase db query --linked -f scripts/sql/tlv-staging-rls-meta.sql
npx supabase db query --linked -f scripts/sql/tlv-drift-rls-policies.sql
npx supabase backups list --project-ref ddojquacsyqesrjhcvmn
node scripts/test-tlv-payment-logic.mjs
node scripts/test-tlv-create-tip-rpc-staging.mjs
node scripts/test-tlv-payment-rls-staging.mjs
node scripts/test-tlv-payment-chargeback-staging.mjs
node scripts/test-tlv-payment-edge.mjs
```

---

*本レポートは read-only 監査。DB · deploy · Stripe への書き込みは一切行っていない。*
