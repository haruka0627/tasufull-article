# TLV Payment Engine — Migration Recovery Plan

**Date:** 2026-06-28  
**Scope:** Migration / Git / Runbook 整合性回復  
**Project:** `ddojquacsyqesrjhcvmn`（linked · read-only 照会）  
**Release 状態:** **停止維持** · Production DB 変更 **禁止**  
**Recovery Phase:** **P1 完了**（2026-06-28）— Git Step 0〜4 tracked · Git ↔ DB 一致  
**Related:** [tlv-payment-production-drift-analysis.md](./tlv-payment-production-drift-analysis.md) · [tlv-payment-production-readiness.md](./tlv-payment-production-readiness.md)

---

## Executive summary

| レイヤ | TLV Payment Step 0〜5 の状態 | 整合 |
| --- | --- | --- |
| **Git（commit 正本）** | Step 0〜5 **すべて tracked**（P1: `db67363` 後 commit） | ✅ |
| **schema_migrations** | TLV 行 **0 件**（registry drift · 意図的に参照しない） | ⚠️ 既知 |
| **実 DB（fingerprint）** | Step 0〜5 **すべて適用済み** | ✅ |
| **Git ↔ DB** | manifest `git_db_aligned: true` · fingerprint 全 PASS | ✅ |
| **docs / Runbook** | Inventory → Skip → Verify（`db67363` で更新済） | ✅ |

**正本の推奨:** Release 再開まで **`reports/tlv-payment-migration-manifest.json`（本計画 §5）+ fingerprint SQL** を運用上の migration 正本とし、`schema_migrations` は **TLV について参照しない**。

---

## 1. Migration Inventory（4 軸比較）

### 1.1 比較マトリクス — TLV Payment Engine

| Step | アーティファクト | Git | schema_migrations | 実 DB fingerprint | docs 記載 |
| ---: | --- | --- | --- | --- | --- |
| **0** | `db/tlv_schema.sql` | **tracked**（P1） | ❌ 未登録 | ✅ `tlv` schema exists | manifest 正本 |
| **1** | `20260628120000_tlv_payment_phase2_rpc.sql` | **tracked**（P1） | ❌ | ✅ `handle_payment_webhook_success` | migration パス記載 |
| **2** | `20260628130000_tlv_payer_user_uuid.sql` | **tracked**（P1） | ❌ | ✅ `payments.payer_user_uuid` | 間接参照 |
| **3** | `20260628140000_tlv_create_tip_transaction_rpc.sql` | **tracked**（P1） | ❌ | ✅ `create_tip_transaction` | 正本参照あり |
| **4** | `20260628150000_tlv_payment_rls.sql` | **tracked**（P1） | ❌ | ✅ `vw_owner_select` + 20 policies | linked DB 適用済 |
| **5** | `20260628160000_tlv_payment_chargeback_clawback.sql` | **tracked**（`d1547de`） | ❌ | ✅ `payment_reversals` + refund RPC | 実装完了 |

### 1.2 schema_migrations（linked DB · 全件 · 2026-06-28）

| version | name | TLV 関連 |
| --- | --- | --- |
| `20260630100000` | partner_p1_schema | — |
| `20260630100001` | partner_p1_auth_hook | — |
| `20260710100000` | secretary_google_token_vault | — |
| `20260711100000` | business_directory_phase1_schema | — |
| `20260711100001` | business_directory_phase1_seed | — |
| `20260712100000` | business_directory_phase6_stripe_subscription | — |

**TLV Payment（`20260628120000`〜`20260628160000`）:** **0 行**

### 1.3 実 DB fingerprint（read-only · 全 Step PASS）

```json
[
  {"step": "step0_tlv_schema", "ok": true},
  {"step": "step1_handle_payment_webhook_success", "ok": true},
  {"step": "step2_payer_user_uuid_column", "ok": true},
  {"step": "step3_create_tip_transaction", "ok": true},
  {"step": "step4_rls_vw_owner_select", "ok": true},
  {"step": "step5_payment_reversals_table", "ok": true},
  {"step": "step5_handle_payment_refund", "ok": true}
]
```

**SQL 正本:** `scripts/sql/tlv-recovery-fingerprints-all.sql`

### 1.4 Git — tracked migrations（TLV 以外 · 参考）

リポジトリ `supabase/migrations/` には match / live / partner 等 **30+ ファイル** が tracked。  
linked DB の `schema_migrations` は **6 件のみ** → **プロジェクト全体**でも registry と git/DB の drift が存在（TLV 以外も `db query -f` 適用が主流）。

### 1.5 docs 記載 vs 実態

| ドキュメント | 記載 | 実 DB | 整合 |
| --- | --- | --- | --- |
| `reports/tlv-payment-production-readiness.md` §Executive | Production migration **未適用** | 適用済 | ❌ |
| `docs/TLV_DB_SCHEMA.md` | RLS/chargeback **production 未適用** | 適用済 | ❌ |
| `docs/TODO.md` TODO-06/07 | **production適用待ち** | 適用済 | ❌ |
| `reports/tlv-payment-rls-staging-test.md` | staging apply · production 未 | linked=production 同一 ref | ❌ |
| `docs/TLV_PAYMENT_ENGINE.md` | migration パス正本 | 内容 OK · 適用状態古い | ⚠️ |

**根因:** 「staging」と「production」の project ref 分離が docs 上のみ存在し、実作業は **同一 linked ref** + **`db query -f`**（registry 非更新）。

---

## 2. Missing Migration Report

### 2.1 分類定義

| 分類 | 意味（本レポート） |
| --- | --- |
| **Git のみ** | Git（commit または working tree）に SQL があるが **DB fingerprint 未充足** |
| **DB のみ** | DB fingerprint **充足**だが Git commit 正本に **ない** |
| **両方** | Git commit **かつ** DB fingerprint 充足 |
| **未適用** | Git にも DB にも **未充足** |
| **Registry のみ** | `schema_migrations` にあるが Git/DB と不一致（TLV では該当なし） |

### 2.2 TLV Payment Step 別分類

| Step | ファイル | Git | DB | schema_migrations | **分類** |
| ---: | --- | --- | --- | --- | --- |
| 0 | `db/tlv_schema.sql` | **commit** | ✅ | ❌ | **両方** |
| 1 | `20260628120000_…` | **commit** | ✅ | ❌ | **両方** |
| 2 | `20260628130000_…` | **commit** | ✅ | ❌ | **両方** |
| 3 | `20260628140000_…` | **commit** | ✅ | ❌ | **両方** |
| 4 | `20260628150000_…` | **commit** | ✅ | ❌ | **両方** |
| 5 | `20260628160000_…` | **commit**（`d1547de`） | ✅ | ❌ | **両方** |

**Git のみ:** **0 件**  
**未適用:** **0 件**  
**DB のみ（Git 未 commit）:** **0 件**（P1 完了後）  
**両方（Git + DB）:** **6 件**（Step 0〜5 · registry 未登録は既知）  
**Registry（schema_migrations）:** **全 Step 未登録** — manifest + fingerprint で管理

### 2.3 なぜ「DB のみ」か（registry 視点）

| 適用経路 | schema_migrations 更新 | TLV での使用 |
| --- | --- | --- |
| `npx supabase db query --linked -f <file>` | **しない** | Step 0〜5 **すべて** |
| `npx supabase db push` / CLI migration up | **する** | partner / secretary / business（6 件） |

staging レポートが記録した apply コマンドは **すべて `db query -f`**:

- [tlv-payment-create-tip-transaction-staging-test.md](./tlv-payment-create-tip-transaction-staging-test.md)
- [tlv-payment-rls-staging-test.md](./tlv-payment-rls-staging-test.md)
- [tlv-payment-chargeback-clawback-implementation.md](./tlv-payment-chargeback-clawback-implementation.md)

---

## 3. Recovery Plan — schema_migrations 整合

### 3.1 方針（Production 変更禁止 · 本フェーズ）

| 原則 | 内容 |
| --- | --- |
| **再適用禁止** | fingerprint OK の Step に `db query -f` **実行しない** |
| **registry 直接更新禁止** | `INSERT INTO supabase_migrations…` · `migration repair` **本フェーズでは実施しない** |
| **db push 禁止** | 既存 prod で未登録 migration を push すると **二重 apply / 失敗** |
| **正本の二層化** | **Git** = ソース正本 · **Manifest + fingerprint** = 適用状態正本 |

### 3.2 Recovery 手順（段階的 · 書き込みは Git/docs のみ）

#### Phase R1 — Git 正本化（Production DB 変更なし） — **✅ P1 完了**

1. **選別 commit**（AD-007）— 以下を commit:
   - `db/tlv_schema.sql` ✅
   - `supabase/migrations/20260628120000` 〜 `20260628150000` ✅
   - `20260628160000` — 済（`d1547de`）
   - manifest + recovery report 更新 ✅
2. **結果:** Step 0〜5 がすべて **Git + DB 両方** · `git_db_aligned: true`

#### Phase R2 — 運用 Manifest 導入（Production DB 変更なし）

1. `reports/tlv-payment-migration-manifest.json` を **Git 正本**として維持
2. Release / smoke 前に必ず:

```bash
npx supabase db query --linked -f scripts/sql/tlv-recovery-fingerprints-all.sql
```

3. manifest の `expected_fingerprints` と照合 · 不一致 → **Stop**

#### Phase R3 — docs / Runbook 整合（Production DB 変更なし）

1. [tlv-payment-production-readiness.md](./tlv-payment-production-readiness.md) — **Inventory → Skip → Verify**（§4 参照 · **実施済**）
2. `docs/TODO.md` · `docs/TLV_DB_SCHEMA.md` — 「未適用」→ **「linked DB 適用済 · registry 未登録 · manifest 正本」**
3. policy count **20** に統一（[drift-analysis §4](./tlv-payment-production-drift-analysis.md#4-rls-diff--23-件-vs-20-件)）

#### Phase R4 — schema_migrations 整合（将来 · 別 Go/No-Go · **本計画では実行しない**）

| オプション | 手法 | リスク | 推奨 |
| --- | --- | --- | --- |
| **A（推奨）** | **registry を TLV の正本にしない** — manifest + fingerprint を Release gate | 低 | ✅ 現行採用 |
| **B** | 新規 **空 marker migration** を作り **新規 project のみ** `db push` で履歴化 | prod 無関係 | 将来の greenfield 用 |
| **C** | `supabase migration repair --status applied` で backfill | registry と実 SQL の checksum 不一致 · 監査リスク | ⚠️ FinOps+Eng 承認必須 · **prod では非推奨** |
| **D** | registry 行の手動 INSERT | 高 | ❌ **禁止**（本計画） |

**結論:** Production では **Option A** を採用。`schema_migrations` に TLV 行が無いことは **既知の drift** として manifest で管理。Release Phase 1 は **Apply ではなく Inventory → Skip → Verify**。

### 3.3 Release 再開時の Step 処理（Apply しない）

| Step | Inventory 条件 | Action | Verify |
| ---: | --- | --- | --- |
| 0 | `tlv` schema exists | **Skip** | 20 tables 存在 |
| 1 | `handle_payment_webhook_success` | **Skip** | RPC + terminal RPC |
| 2 | `payments.payer_user_uuid` | **Skip** | column + webhook RPC signature |
| 3 | `create_tip_transaction` | **Skip** | PS-02 19/19 |
| 4 | `vw_owner_select` + 20 policies | **Skip** | PS-03 30/30 |
| 5 | `payment_reversals` + refund/dispute RPC | **Skip** | PS-04 10/10 |

**Apply が許可される条件（将来）:** fingerprint **false** の Step **のみ** · PITR 取得後 · 単一 Step · idempotent SQL 確認後。

---

## 4. Runbook 修正 — Inventory → Skip → Verify

**対象:** [tlv-payment-production-readiness.md](./tlv-payment-production-readiness.md) §1 · §6 · §4.2

### 4.1 旧フロー（廃止）

```text
Migration Step 0〜5 を順次 db query -f で適用
```

### 4.2 新フロー（正本）

```text
[Pre] Backup + manifest 確認
  ↓
[1] Inventory — fingerprint SQL + manifest 照合
  ↓
[2] Skip — 充足 Step は apply しない（ログに SKIP 記録）
  ↓
[3] Verify — Step ごと automated suite（PS-02〜04 等）
  ↓
[4] 不足 Step のみ — PITR 後 · 単体 apply（通常 0 件）
  ↓
[5] Post-Release — manifest updated_at · release report 更新
```

### 4.3 Inventory チェックリスト（各 Step）

| Step | Fingerprint query | Automated verify |
| ---: | --- | --- |
| 0 | `information_schema.schemata` · `tlv` tables count | logic 26/26 |
| 1 | `handle_payment_webhook_success` exists | edge webhook smoke |
| 2 | `payments.payer_user_uuid` column | — |
| 3 | `create_tip_transaction` exists | PS-02 19/19 |
| 4 | RLS FORCE + 20 policies | PS-03 30/30 · `tlv-staging-rls-meta.sql` |
| 5 | `payment_reversals` + refund/dispute RPC | PS-04 10/10 |

**Runbook 本文:** §1.2〜1.5 · §6 Phase B を上記に合わせ **更新済**（同一ファイル）。

---

## 5. Migration Manifest（Git 正本 · 適用状態）

**正本ファイル:** [tlv-payment-migration-manifest.json](./tlv-payment-migration-manifest.json)

**P1 更新（2026-06-28）:**

| 項目 | P0 前 | P1 後 |
| --- | --- | --- |
| `git_db_aligned` | — | `true` |
| `recovery_phase` | — | `P1_complete` |
| Step 0〜4 `git_tracked` | `false` | `true` |
| Step 0〜5 `classification` | `db_only_uncommitted` / mixed | `git_and_db_registry_missing` |
| `schema_migrations` | 全 Step `false` | 変更なし（registry 非正本） |

**Manifest ↔ DB 差分:** **なし** — 全 Step `db_applied: true` · fingerprint SQL と一致（DB 変更なし · read-only 照会済）

---

## 6. リスク

| 優先 | リスク | 緩和 |
| --- | --- | --- |
| P0 | Runbook 通り **再 apply** → duplicate object エラー / 部分失敗 | Inventory → **Skip** |
| P0 | Git 未 commit → deploy コードと SQL 監査不能 | **P1 完了** |
| P1 | `schema_migrations` を信頼して **未 apply と誤判断** | manifest 正本化 · docs 更新 |
| P1 | `db push` で一括 apply 試行 | **禁止** · fingerprint _gate |
| P2 | registry backfill（repair/INSERT）で checksum 不一致 | Option A · repair は別チケット |

---

## 7. 推奨対応（優先順）

| # | 作業 | DB 変更 | 状態 |
| ---: | --- | --- | --- |
| 1 | **Git R1** — Step 0〜4 SQL + `db/tlv_schema.sql` 選別 commit | なし | **✅ P1 完了** |
| 2 | **Manifest** — §5 JSON · `git_db_aligned: true` | なし | **✅ 完了** |
| 3 | **docs** — TODO / TLV_DB_SCHEMA inventory ベース | なし | **✅ 完了**（`db67363`） |
| 4 | **Release Phase 0** — fingerprint Inventory PASS · migration Skip | なし | 未着手 |
| 5 | PostgREST / Stripe / Edge — read-only 確認 | なし | 未着手 |
| 6 | （将来）registry 整合 Option B/C | **要承認** | 任意 · 非必須 |

---

## 8. 参照 · 再現コマンド（read-only）

```bash
npx supabase db query --linked -f scripts/sql/tlv-recovery-schema-migrations.sql
npx supabase db query --linked -f scripts/sql/tlv-recovery-fingerprints-all.sql
git ls-files supabase/migrations/ db/
git status --short supabase/migrations/ db/
```

**Production 変更:** **実施なし**
