# TLV Payment Engine — Release Verification (RV1)

**Date:** 2026-06-28  
**Phase:** RV1 — Production Release 最終確認（**read-only · 変更禁止**）  
**Project:** `ddojquacsyqesrjhcvmn`（`tasful-ai` · Tokyo）  
**Git HEAD:** `dded4b4` — `chore(payment): track tlv platform release assets (recovery P2)`  
**Release 状態:** **停止維持**  
**Outcome:** **No-Go** — Phase 0 一部 PASS · Platform / Smoke / Go 承認 **未完了**

---

## Executive summary

| 区分 | 結果 |
| --- | --- |
| Phase 0 — fingerprint / Skip | **PASS** |
| Phase 0 — PITR / backup | **NOT READY**（未確認） |
| Platform — PostgREST `tlv` expose | **NOT READY**（remote 404） |
| Platform — Edge 3 functions | **READY**（ACTIVE v3 · HTTP 到達） |
| Platform — Stripe webhook 7 events | **NOT READY**（Dashboard 未確認） |
| Git Review | **READY**（P1+P2 tracked · HEAD 一致） |
| Smoke PS-01〜05 | **PARTIAL**（PS-01 logic のみ RV1 実行） |
| Smoke PS-M01〜05 | **NOT READY**（未実施） |
| TODO-PROD-01〜07 | **0 / 7 READY** |

**Go / No-Go:** **No-Go**

---

## 1. Phase 0 Verify（Runbook 順）

### 1.1 Fingerprint inventory

**Command:** `npx supabase db query --linked -f scripts/sql/tlv-recovery-fingerprints-all.sql`

| Fingerprint | Result |
| --- | --- |
| `step0_tlv_schema` | ✅ true |
| `step1_handle_payment_webhook_success` | ✅ true |
| `step2_payer_user_uuid_column` | ✅ true |
| `step3_create_tip_transaction` | ✅ true |
| `step4_rls_vw_owner_select` | ✅ true |
| `step5_payment_reversals_table` | ✅ true |
| `step5_handle_payment_refund` | ✅ true |

**Manifest 照合:** [tlv-payment-migration-manifest.json](./tlv-payment-migration-manifest.json) — 全 Step `db_applied: true` · **一致**

**判定:** **PASS**

### 1.2 PITR / backup

| 項目 | 状態 |
| --- | --- |
| Supabase Dashboard snapshot | **未確認** |
| PITR 有効 / 復元手順 | **未確認** |
| Runbook §4.1 記録 | **なし** |

**判定:** **NOT READY** — Release 再開前に Dashboard 目視 + 日時記録必須

### 1.3 Migration Skip 判定

| Step | Fingerprint | Apply | RV1 判定 |
| ---: | --- | --- | --- |
| 0 | ✅ | **SKIP** | 記録 |
| 1 | ✅ | **SKIP** | 記録 |
| 2 | ✅ | **SKIP** | 記録 |
| 3 | ✅ | **SKIP** | 記録 |
| 4 | ✅ | **SKIP** | 記録 |
| 5 | ✅ | **SKIP** | 記録 |

**Apply 件数:** **0**（再 apply 禁止 · Runbook 準拠）

**判定:** **PASS**（Skip 方針確定 · 実行なし）

### 1.4 Verification 手順（Runbook §1.5）

| Verify | RV1 実施 | 結果 |
| --- | --- | --- |
| `tlv-recovery-fingerprints-all.sql` | ✅ | 7/7 PASS |
| `test-tlv-payment-logic.mjs`（PS-01） | ✅ | **26/26 PASS** |
| `test-tlv-payment-chargeback-logic.mjs`（回帰） | ✅ | **13/13 PASS** |
| `test-tlv-create-tip-rpc-staging.mjs`（PS-02） | ❌ 未実施 | linked DB 書込 · RV1 範囲外 |
| `test-tlv-payment-rls-staging.mjs`（PS-03） | ❌ 未実施 | 同上 |
| `test-tlv-payment-chargeback-staging.mjs`（PS-04） | ❌ 未実施 | 同上 |
| `test-tlv-payment-edge.mjs`（PS-05） | ❌ 未実施 | Edge 副作用あり · RV1 範囲外 |
| `tlv-staging-rls-meta.sql` | ❌ 未実施 | Release day |

**Phase 0 総合:** **PARTIAL PASS** — inventory + Skip OK · 完全 Verify suite **未完了**

---

## 2. Platform Verify（read-only）

### 2.1 PostgREST remote · `tlv` schema expose

**Local git（`dded4b4` · `supabase/config.toml`）:**

```toml
[api]
schemas = ["public", "graphql_public", "tlv"]
extra_search_path = ["public", "extensions", "tlv"]
```

**Remote probe（read-only HTTP · anon key）:**

| Probe | HTTP | 解釈 |
| --- | ---: | --- |
| `GET /rest/v1/viewer_wallets?limit=1` | **404** | `tlv` 表 **未 expose**（PostgREST path なし） |
| `POST /rest/v1/rpc/create_tip_transaction` | **404** | RPC **未 expose** |

**判定:** **NOT READY** — git に設定あり · **remote `config push` 未反映**（push は RV1 禁止 · Release day 作業）

### 2.2 Edge Functions

| SLUG | STATUS | VERSION | UPDATED (UTC) |
| --- | --- | ---: | --- |
| `tlv-create-coin-purchase` | ACTIVE | 3 | 2026-06-28 03:45:31 |
| `tlv-create-tip` | ACTIVE | 3 | 2026-06-28 03:45:31 |
| `tlv-payment-webhook` | ACTIVE | 3 | 2026-06-28 03:45:31 |
| `tlv-e2e-simulate-payment` | ACTIVE | 3 | 2026-06-28 03:45:31 |

**HTTP probe（read-only）:**

| Function | anon POST | 解釈 |
| --- | ---: | --- |
| `tlv-payment-webhook` | **400** | 到達 · signature 不足（404 ではない = deploy 済） |
| `tlv-create-tip` | **401** | 到達 · auth ガード |

**Git parity:** deploy **v3**（03:45 UTC）vs git **P2 `dded4b4`**（13:35 JST）— **バンドル diff 未レビュー**

**判定:** **PARTIAL READY** — 3 functions ACTIVE · **git=remote 一致は未確認** · `tlv-e2e-simulate-payment` production **非推奨だが ACTIVE**

### 2.3 Stripe webhook（7 events）

**RV1:** Stripe Dashboard **未アクセス**（API キー変更禁止）

| Event | RV1 確認 |
| --- | --- |
| `payment_intent.succeeded` | **未確認** |
| `payment_intent.payment_failed` | **未確認** |
| `payment_intent.canceled` | **未確認** |
| `charge.refunded` | **未確認** |
| `refund.updated` | **未確認** |
| `charge.dispute.created` | **未確認** |
| `charge.dispute.closed` | **未確認** |

**Secrets（名前のみ · 存在確認）:** `STRIPE_SECRET_KEY` ✅ · `STRIPE_WEBHOOK_SECRET` ✅ · `STRIPE_WEBHOOK_SECRET_TLV` ❌

**判定:** **NOT READY**

### 2.4 `verify_jwt`（git 正本 · `supabase/config.toml`）

| Function | `verify_jwt` |
| --- | --- |
| `tlv-create-coin-purchase` | `false` |
| `tlv-payment-webhook` | `false` |
| `tlv-create-tip` | `false` |
| `tlv-e2e-simulate-payment` | `false`（除外推奨） |

**Remote 挙動:** webhook **400**（JWT 前段）· create-tip **401** — Edge 到達確認済

**判定:** **READY**（git 設定 · RV1 変更なし）

---

## 3. Git Review（HEAD `dded4b4`）

### 3.1 Recovery commits

| Commit | 内容 |
| --- | --- |
| `db67363` | Recovery plan · manifest · fingerprint SQL · runbook Inventory |
| `8d651d4` | P1 — Step 0〜4 SQL + `db/tlv_schema.sql` |
| `dded4b4` | P2 — Edge · config · smoke scripts · fixtures |

### 3.2 Tracked assets vs manifest

| 区分 | manifest | git `ls-files` | HEAD diff |
| --- | --- | --- | --- |
| Step 0〜5 SQL | ✅ | ✅ | **clean** |
| Edge 3 + `_shared/tlv-*` | ✅ | ✅ | **clean** |
| `supabase/config.toml` | ✅ | ✅ | **clean** |
| PS-01〜05 scripts | ✅ | ✅ | **clean** |
| SQL fixtures | ✅ | ✅ | **clean** |
| manifest / recovery / runbook | ✅ | ✅ | **clean** |

**除外（意図的）:** `tlv-e2e-simulate-payment` · 設計レポート untracked · `deploy/cloudflare/dist/**`

**判定:** **READY**

---

## 4. Production Smoke Plan（最終確認）

### 4.1 自動 PS-01〜05 — 実施順序

```text
PS-01 logic（DB 不要）
  ↓
PS-02 tip RPC（linked + fixture · sandbox user）
  ↓
PS-03 RLS（linked + fixture/cleanup）
  ↓
PS-04 chargeback（linked + fixture）
  ↓
PS-05 Edge（HTTP · anon 401 · E2E optional）
```

| ID | Pass 基準 | RV1 | Release day |
| --- | --- | --- | --- |
| PS-01 | 26/26 | **✅ PASS** | 必須 |
| PS-02 | 19/19 | 未実施 | 必須 |
| PS-03 | 30/30 | 未実施 | 必須 |
| PS-04 | 10/10 | 未実施 | 必須 |
| PS-05 | anon guards PASS | 未実施 | 必須 |

### 4.2 手動 PS-M01〜05 — 実施順序

```text
PS-M01 Purchase（live 最小 pack）
  ↓
PS-M02 Tip（live 配信中）
  ↓
PS-M03 Wallet 表示
  ↓
PS-M04 Ledger Admin SQL
  ↓
PS-M05 Webhook duplicate
```

PS-M06/M07/M08/M09 — ops 判断（Runbook §3.2）

### 4.3 停止条件（Runbook · 厳守）

1. fingerprint **false** → Stop · PITR 後に不足 Step のみ apply
2. PS-01〜05 **いずれか FAIL** → Stop
3. PS-M01〜05 **いずれか FAIL** → Stop
4. PostgREST `tlv` **RLS 前 expose** → **禁止**（順序違反）
5. エラー・警告・想定外差異 **1 件** → Stop · 以降未実行

### 4.4 成功条件（Go 判定 · Runbook §4.3）

- Pre-release **ALL**
- Release day 自動 **ALL**（PS-01〜05）
- PS-M01〜05 **ALL PASS**
- config push · Edge deploy · Stripe 7 events **完了**

**RV1 時点:** 上記 **未充足**

---

## 5. Release Checklist — TODO-PROD-01〜07

| ID | 内容 | 判定 | 根拠 |
| --- | --- | --- | --- |
| **TODO-PROD-01** | Inventory → Skip → Verify | **NOT READY** | fingerprint ✅ · Skip ✅ · PS-02〜05 Verify **未実施** |
| **TODO-PROD-02** | PostgREST `tlv` expose | **NOT READY** | remote `/rest/v1/viewer_wallets` **404** · push 未実施 |
| **TODO-PROD-03** | Edge deploy 3 functions | **NOT READY** | ACTIVE v3 だが **git `dded4b4` との parity 未確認** · redeploy 未実施 |
| **TODO-PROD-04** | Stripe webhook +4 events | **NOT READY** | Dashboard 7 events **未確認** |
| **TODO-PROD-05** | PS-01〜05 + PS-M01〜05 | **NOT READY** | PS-01 のみ PASS · 残 **未実施** |
| **TODO-PROD-06** | FinOps Runbook 運用開始 | **NOT READY** | on-call / キュー運用 **未開始** |
| **TODO-PROD-07** | Go/No-Go 承認 · 24h 監視 | **NOT READY** | **No-Go** · 承認なし |

---

## 6. READY 一覧

| # | 項目 |
| ---: | --- |
| 1 | Fingerprint inventory 7/7 PASS |
| 2 | Migration Skip 判定（Step 0〜5 · Apply 0 件） |
| 3 | Manifest ↔ DB 一致 |
| 4 | Git Step 0〜5 + Platform assets tracked（P1+P2） |
| 5 | Git tracked files = HEAD（TLV Payment 範囲 clean） |
| 6 | PS-01 logic 26/26 PASS（RV1 実行） |
| 7 | Chargeback logic 13/13 PASS（回帰） |
| 8 | Edge 3 functions **ACTIVE** + HTTP 到達 |
| 9 | `verify_jwt=false` git 設定（TLV 3 + webhook） |
| 10 | Stripe secrets 存在（`STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET`） |
| 11 | Production project ref `ddojquacsyqesrjhcvmn` link 確認 |
| 12 | Runbook Inventory → Skip → Verify 手順確定 |

---

## 7. NOT READY 一覧

| # | 項目 | 解除条件 |
| ---: | --- | --- |
| 1 | **PITR / backup** 未確認 | Dashboard snapshot + 記録 |
| 2 | **PostgREST remote** `tlv` 未 expose | `config push`（Go 承認後） |
| 3 | **Stripe webhook** 7 events 未確認 | Dashboard 目視 + 記録 |
| 4 | **PS-02〜05** 未実行 | Release day linked 実行 |
| 5 | **PS-M01〜05** 未実行 | 手動 smoke |
| 6 | **Edge git parity** 未確認 | deploy v3 vs `dded4b4` diff レビュー · 必要なら redeploy |
| 7 | **`tlv-e2e-simulate-payment`** production ACTIVE | 無効化方針 · Go 判断 |
| 8 | **FinOps** 運用未開始 | §5 Runbook 周知 |
| 9 | **Go/No-Go 承認** なし | 全 TODO-PROD READY 後 |

---

## 8. Production Go Blocker

| 優先 | Blocker |
| ---: | --- |
| P0 | PITR / backup 未確認 |
| P0 | PostgREST `tlv` remote 未 expose |
| P0 | Stripe webhook 7 events 未確認 |
| P0 | PS-02〜05 + PS-M01〜05 未 PASS |
| P1 | Edge deploy git parity 未確認 |
| P1 | FinOps 運用未開始 |
| P2 | `tlv-e2e-simulate-payment` production ACTIVE |

---

## 9. Go / No-Go 判定

| 判定 | 理由 |
| --- | --- |
| **No-Go** | TODO-PROD **0/7 READY** · Platform 2 項目（PostgREST · Stripe）未確認 · Smoke 大部分未実施 · PITR 未記録 |

**Release 状態:** **停止維持**

**次アクション（変更作業は Go 承認後）:**

1. PITR snapshot 記録
2. PS-02〜05 実行（Skip 後 Verify）
3. Dashboard: PostgREST + Stripe webhook 確認
4. `config push` → Edge redeploy（parity 確認後）
5. PS-M01〜05 → Go/No-Go 再判定

---

## 10. RV1 実施ログ

| 操作 | 実施 | Production 変更 |
| --- | --- | --- |
| `db query` fingerprint | ✅ | **なし**（SELECT のみ） |
| `functions list` | ✅ | なし |
| `secrets list`（名前） | ✅ | なし |
| HTTP probe（REST/Edge） | ✅ | なし（read-only GET/POST） |
| `test-tlv-payment-logic.mjs` | ✅ | なし |
| migration / push / deploy / webhook / Secret | ❌ | **なし** |

---

## 11. 参照

- [tlv-payment-production-readiness.md](./tlv-payment-production-readiness.md)
- [tlv-payment-migration-recovery-plan.md](./tlv-payment-migration-recovery-plan.md)
- [tlv-payment-migration-manifest.json](./tlv-payment-migration-manifest.json)
- [tlv-payment-production-release.md](./tlv-payment-production-release.md)
