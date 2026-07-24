# TLV Payment Engine — Production Release Report

**Date:** 2026-06-28  
**Release Candidate:** RC1  
**Target commits:** `874390a` (runbook) · `d1547de` (chargeback)  
**HEAD at attempt:** `874390aaceb3fd73fa9476fbca12610d01810249`  
**Outcome:** **STOPPED at Phase 0** — **No-Go** · Phases 1–7 **未実施**

---

## Executive summary

| Phase | 内容 | 結果 |
| --- | --- | --- |
| **0** | Release Candidate 確認 | **FAIL — ここで停止** |
| 1 | Production Migration Step 0〜5 | **未実施** |
| 2 | PostgREST `tlv` expose | **未実施** |
| 3 | Edge Deploy + Health Check | **未実施** |
| 4 | Stripe Production Webhook | **未実施** |
| 5 | Production Smoke PS-01〜05 / PS-M01〜05 | **未実施** |
| 6 | Go / No-Go | **No-Go** |
| 7 | Docs / Report | 本レポート + `docs/` 更新 |

**Go / No-Go 判定:** **No-Go**

---

## Phase 0 — Release Candidate 確認

### 0.1 git status clean

| 項目 | 結果 |
| --- | --- |
| git status clean | **FAIL** |

**詳細:**

- **Modified:** `deploy/cloudflare/dist/**` 多数 · `docs/CREATOR_PROGRAM.md` · `supabase/config.toml` · secretary テスト関連
- **Untracked（Payment Engine 関連）:**
  - `db/tlv_schema.sql`
  - `supabase/migrations/20260628120000` 〜 `20260628150000`（Step 1〜4 · **git 未追跡**）
  - `supabase/functions/tlv-create-coin-purchase/` · `tlv-create-tip/` · `_shared/tlv-*` 等（部分のみ tracked）
  - テストスクリプト `scripts/test-tlv-payment-*.mjs` 等
- **Tracked RC:** `874390a` · `d1547de` · migration `20260628160000` のみ commit 済

**Runbook 要件:** Phase 0 で clean 必須 → **以降の Phase は実行しない**

### 0.2 main / release 対象 commit

| Commit | Message |
| --- | --- |
| `874390a` | docs(payment): add production readiness runbook |
| `d1547de` | feat(payment): implement chargeback and clawback workflow |
| `1f41322` | docs(platform): establish AD-014 creator economy platform vision |

**HEAD:** `874390a` — RC runbook commit が tip

### 0.3 Production Project Ref

| 項目 | 値 |
| --- | --- |
| Linked project | `ddojquacsyqesrjhcvmn` |
| Name | `tasful-ai` |
| Region | Northeast Asia (Tokyo) |
| 正本 | `docs/production-release-checklist.md` — 本番 Supabase として記載 |

**注意:** Runbook §1.1 は「staging とは別 link」と記載。本リポジトリでは **単一 project ref** のみ link 済み · staging 専用 ref は未設定。

### 0.4 Supabase Link

| 項目 | 結果 |
| --- | --- |
| `supabase projects list` | **● linked** → `ddojquacsyqesrjhcvmn` |

### 0.5 Stripe Production Keys（閲覧のみ）

| Secret | 存在 |
| --- | --- |
| `STRIPE_SECRET_KEY` | **あり**（digest のみ確認） |
| `STRIPE_WEBHOOK_SECRET` | **あり**（digest のみ確認） |
| `STRIPE_WEBHOOK_SECRET_TLV` | **なし**（Runbook 推奨 · fallback `STRIPE_WEBHOOK_SECRET`） |

### 0.6 PITR / Backup

| 項目 | 結果 |
| --- | --- |
| PITR / Backup 状態 | **未確認** — Dashboard 目視 · snapshot 取得 **未実施** |

Runbook §4.1 Pre-release 必須項目 **未充足**

### 0.7 想定外差異（Phase 0 追加調査 · Runbook との drift）

linked DB（`ddojquacsyqesrjhcvmn`）を read-only 照会した結果、Runbook「Production migration 未適用」と **不一致**:

| 確認項目 | DB 状態 | Runbook 期待 |
| --- | --- | --- |
| `tlv` schema | **exists** | Step 0 後 |
| RPC `handle_payment_webhook_success` | **exists** | Step 1 後 |
| RPC `create_tip_transaction` | **exists** | Step 3 後 |
| RPC `handle_payment_refund` / `handle_payment_dispute` | **exists** | Step 5 後 |
| RLS `payments` / `viewer_wallets` / `payment_reversals` | **enabled + forced** | Step 4/5 後 |
| RLS policy count | **20** | Staging 記録 **23** — **差異** |
| Edge `tlv-create-coin-purchase` | **ACTIVE v3** (2026-06-28) | Phase 3 待ち |
| Edge `tlv-payment-webhook` | **ACTIVE v3** | Phase 3 待ち |
| Edge `tlv-create-tip` | **ACTIVE v3** | Phase 3 待ち |
| `supabase_migrations.schema_migrations` | TLV payment migration **未登録** | staging 作業は `db query -f` 直適用 |

**解釈:** staging 検証が production link 上で実施済みの可能性。Phase 1 をそのまま再実行すると **duplicate object エラー** のリスク。**git clean + drift 解消 + PITR 確認** 後に Step ごと idempotency 確認が必要。

### 0.8 警告

```
npm warn Unknown env config "devdir"
```

CLI 警告 1 件 — Runbook「エラー・警告で停止」方針に照らし記録（単独 blocker ではないが Phase 0 FAIL と併記）

---

## Phase 1 — Production Migration

**状態:** **未実施**（Phase 0 FAIL により停止）

| Step | ファイル | 適用 | Verification |
| --- | --- | --- | --- |
| 0 | `db/tlv_schema.sql` | — | — |
| 1 | `20260628120000_tlv_payment_phase2_rpc.sql` | — | — |
| 2 | `20260628130000_tlv_payer_user_uuid.sql` | — | — |
| 3 | `20260628140000_tlv_create_tip_transaction_rpc.sql` | — | — |
| 4 | `20260628150000_tlv_payment_rls.sql` | — | — |
| 5 | `20260628160000_tlv_payment_chargeback_clawback.sql` | — | — |

---

## Phase 2 — PostgREST

**状態:** **未実施**

- ローカル `supabase/config.toml`: `schemas = [..., "tlv"]`（modified · push 未確認）

---

## Phase 3 — Production Deploy

**状態:** **未実施**（Runbook 手順としては未実施 · DB 上は Edge v3 ACTIVE 済み — §0.7 drift）

| Function | Deploy 結果 | Health Check |
| --- | --- | --- |
| `tlv-payment-webhook` | 未実施 | — |
| `tlv-create-tip` | 未実施 | — |
| `tlv-create-coin-purchase` | 未実施 | — |

---

## Phase 4 — Stripe Production Webhook

**状態:** **未実施**

| Event | 登録 |
| --- | --- |
| `payment_intent.succeeded` / `failed` / `canceled` | 未確認 |
| `charge.refunded` | 未追加 |
| `refund.updated` | 未追加 |
| `charge.dispute.created` | 未追加 |
| `charge.dispute.closed` | 未追加 |

Webhook Secret 更新: **未実施**

---

## Phase 5 — Production Smoke

**状態:** **未実施**

| ID | 結果 |
| --- | --- |
| PS-01〜05 | — |
| PS-M01〜05 | — |

Purchase · Wallet · Ledger · Tip · Refund · Chargeback · Duplicate Webhook · RLS — **未検証**

---

## Phase 6 — Go / No-Go

| 判定 | 理由 |
| --- | --- |
| **No-Go** | Phase 0 FAIL（git dirty · PITR 未確認 · Runbook/DB drift · RLS policy 20 vs 23） |

**Production Go:** **未宣言**

---

## Phase 7 — 成果物

| 成果物 | 状態 |
| --- | --- |
| 本レポート | **作成** |
| `docs/TLV_PAYMENT_ENGINE.md` | §9.6 RC1 release attempt 追記 |
| `docs/TODO.md` | Phase 0 stop · No-Go 維持 |

---

## 再開条件（Phase 0 クリア後）

1. **git status clean** — Payment Engine RC 関連ファイルを選別 commit（`git add -A` 禁止）
2. **PITR / backup** — Dashboard で snapshot 取得 · 記録
3. **DB drift 解消** — Step 0〜5 各 idempotency 照会 SQL · 未適用分のみ実行計画
4. **RLS policy count** — 20 vs 23 差異の原因特定（staging meta SQL 再実行）
5. **Production project ref** — staging / production 分離方針の明示確認
6. Runbook Phase 1 から **段階再開**

---

## Git 状態（試行終了時）

```
HEAD: 874390aaceb3fd73fa9476fbca12610d01810249
Branch: (main — dirty)
git status: NOT clean（§0.1 参照）
```

---

## 参照

- [tlv-payment-production-readiness.md](./tlv-payment-production-readiness.md)
- [tlv-payment-chargeback-clawback-implementation.md](./tlv-payment-chargeback-clawback-implementation.md)
- [tlv-payment-rls-staging-test.md](./tlv-payment-rls-staging-test.md)
