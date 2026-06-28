# TLV Payment Engine — Production Readiness Review

**Date:** 2026-06-28  
**Phase:** 開発フェーズ完了 → **Production Readiness Review**  
**状態:** Runbook / Checklist 確定 · **Production 変更は未実施**  
**正本:** [docs/TLV_PAYMENT_ENGINE.md](../docs/TLV_PAYMENT_ENGINE.md) · [docs/TLV_DB_SCHEMA.md](../docs/TLV_DB_SCHEMA.md)

---

## Executive summary

| 項目 | 状態 |
| --- | --- |
| P0 実装（purchase · tip · chargeback · RLS） | **完了** |
| Staging 検証 | **全スイート PASS** |
| Production migration | **未適用** |
| Production Edge deploy | **未実施** |
| Stripe Production webhook | **未更新** |
| **Production Go/No-Go（現時点）** | **No-Go** |

**Staging 参照:** project `ddojquacsyqesrjhcvmn` · commit `d1547de`（TODO-06）

---

## 1. Production Migration Runbook

### 1.1 前提

| 項目 | 要件 |
| --- | --- |
| 対象 DB | **Production Supabase project**（staging とは別 link） |
| バックアップ | **必須** — Supabase PITR または手動 snapshot 直前 |
| メンテナンス | RPC 追加のみの migration は短時間 · RLS ENABLE は即時 |
| 禁止 | staging link のまま production 操作 · `git add -A` |

### 1.2 適用順（厳守）

Production に `tlv` スキーマが **未存在** の場合、Step 0 から。  
**既に Phase 2 RPC まで適用済** の場合は、未適用分のみ実行。

| Step | ファイル / 操作 | 内容 | Blocker |
| --- | --- | --- | --- |
| **0** | `db/tlv_schema.sql` | ベース DDL（creators · payments · wallet · ledger 等） | 初回のみ |
| **1** | `20260628120000_tlv_payment_phase2_rpc.sql` | `handle_payment_webhook_success` · terminal event RPC | Step 0 後 |
| **2** | `20260628130000_tlv_payer_user_uuid.sql` | payer_user_uuid 整合 · webhook RPC 更新 | Step 1 後 |
| **3** | `20260628140000_tlv_create_tip_transaction_rpc.sql` | `create_tip_transaction` 単一 TX | Step 2 後 |
| **4** | `20260628150000_tlv_payment_rls.sql` | **TODO-07** RLS ENABLE+FORCE · 23 policies · RPC REVOKE | Step 3 後 · **PostgREST expose 前** |
| **5** | `20260628160000_tlv_payment_chargeback_clawback.sql` | **TODO-06** revenue CHECK · payment_reversals · refund/dispute RPC | Step 4 後 |

**順序理由:**

- RPC は RLS より先（service_role が書込主体 · RLS は client 防御層）
- RLS は **PostgREST `tlv` schema expose より必ず先**
- Chargeback migration は `payment_reversals` 独自 RLS を含む · TODO-07 後が安全

### 1.3 適用コマンド（production link 確認後）

```bash
# 1. production project に link（初回のみ · 要確認）
npx supabase link --project-ref <PRODUCTION_PROJECT_REF>

# 2. 各 migration を順に（例: Step 4 RLS）
npx supabase db query --linked -f supabase/migrations/20260628150000_tlv_payment_rls.sql

# 3. Step 5 chargeback
npx supabase db query --linked -f supabase/migrations/20260628160000_tlv_payment_chargeback_clawback.sql
```

**Verify link target:** Dashboard URL / `supabase projects list` で **production ref** を目視確認してから実行。

### 1.4 Rollback 方針

| レベル | 手段 | 備考 |
| --- | --- | --- |
| **P0（推奨）** | Supabase **PITR / backup restore** | 全 migration 前に snapshot |
| **P1（部分）** | 新 migration で `DROP FUNCTION` · `DROP TABLE payment_reversals` | データ損失リスク · FinOps 承認必須 |
| **P2（非推奨）** | RLS `DISABLE` | **禁止** — 漏洩リスク |
| **Chargeback のみ戻す** | `20260628160000` 逆操作 SQL を **別 migration** で作成 | adjustment 行が存在する場合は不可 |

**原則:** ledger / payment_provider_events / wallet_ledger は **INSERT-only** — 本番 rollback は **DB restore** が正本。

### 1.5 Migration 後 Verification（production）

各 Step 後に実行:

```bash
# Meta — RLS enabled（Step 4 後）
npx supabase db query --linked -f scripts/sql/tlv-staging-rls-meta.sql

# RPC exists
# SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
#   WHERE n.nspname='tlv' AND proname IN ('create_tip_transaction','handle_payment_refund','handle_payment_dispute');

# payment_reversals exists（Step 5 後）
# SELECT count(*) FROM information_schema.tables
#   WHERE table_schema='tlv' AND table_name='payment_reversals';
```

**Automated suites（production DB 向け · staging と同スクリプト）:**

| Script | 期待 | Step |
| --- | --- | --- |
| `node scripts/test-tlv-payment-logic.mjs` | 26/26 | 随時（DB 不要） |
| `node scripts/test-tlv-create-tip-rpc-staging.mjs` | 19/19 | 3+ |
| `node scripts/test-tlv-payment-rls-staging.mjs` | 30/30 | 4+ |
| `node scripts/test-tlv-payment-chargeback-staging.mjs` | 10/10 | 5+ |

**注意:** `--linked` は **production ref** であることを確認。fixture SQL は production では **専用 sandbox user** に限定するか、smoke 用に縮小版を別途用意。

---

## 2. Production Deploy Runbook

### 2.1 推奨リリース順序

```text
[Pre] Backup + Go/No-Go 承認
  ↓
[A] DB migration Step 0〜5（§1.2）
  ↓
[B] Supabase config push（PostgREST tlv expose）
  ↓
[C] Edge Functions deploy
  ↓
[D] Stripe Production webhook 更新
  ↓
[E] Production Smoke Test（§3）
  ↓
[F] Go 宣言 · 監視開始
```

### 2.2 Edge Functions deploy

| Function | 必須 | 用途 |
| --- | --- | --- |
| `tlv-create-coin-purchase` | **Yes** | Viewer coin 購入 PI 作成 |
| `tlv-payment-webhook` | **Yes** | Stripe webhook → RPC |
| `tlv-create-tip` | **Yes** | Tip 送信 |
| `tlv-e2e-simulate-payment` | **No（production 禁止推奨）** | staging E2E のみ |

```bash
# production project に link 済み前提
npx supabase functions deploy tlv-create-coin-purchase --linked
npx supabase functions deploy tlv-payment-webhook --linked
npx supabase functions deploy tlv-create-tip --linked
```

**Secrets（Dashboard 設定 · 本 Runbook では変更しない）:**

| Secret | 用途 |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe API（live key） |
| `STRIPE_WEBHOOK_SECRET_TLV` | TLV 専用 webhook 署名（推奨） |
| `STRIPE_WEBHOOK_SECRET` | fallback（既存 Platform webhook と分離推奨） |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge → RPC |

### 2.3 PostgREST / RLS 適用順

| 順 | 操作 | 理由 |
| --- | --- | --- |
| 1 | Migration Step 4（RLS）適用 | FORCE RLS で authenticated 直書込禁止 |
| 2 | `supabase/config.toml` — `schemas = [..., "tlv"]` | **RLS 後のみ** expose |
| 3 | `npx supabase config push --linked` | production API に反映 |

**禁止:** RLS 未適用のまま `tlv` schema を PostgREST expose → 全表漏洩。

### 2.4 Stripe Webhook 切替

**Endpoint:** `https://<PRODUCTION_PROJECT>.supabase.co/functions/v1/tlv-payment-webhook`

**登録イベント（P0 必須）:**

| Event | 状態 |
| --- | --- |
| `payment_intent.succeeded` | 既存 |
| `payment_intent.payment_failed` | 既存 |
| `payment_intent.canceled` | 既存 |
| **`charge.refunded`** | **新規追加** |
| **`refund.updated`** | **新規追加** |
| **`charge.dispute.created`** | **新規追加** |
| **`charge.dispute.closed`** | **新規追加** |

**切替手順:**

1. Stripe Dashboard → Developers → Webhooks → **Production endpoint**（TLV 専用推奨）
2. 上記 7 event を subscribe
3. Signing secret を `STRIPE_WEBHOOK_SECRET_TLV` に設定（Edge Secrets）
4. **Deploy 後** に Stripe 「Send test webhook」で `payment_intent.succeeded` 1 件
5. `payment_provider_events` に `processed` 行が 1 件 · duplicate 再送で増えないことを確認

**metadata フィルタ:** `order_type = TLV_STRIPE_ORDER_TYPE` 以外は `ignored` — Platform 決済と共存可。

---

## 3. Production Smoke Test

### 3.1 自動スイート（DB / Edge）

| ID | カテゴリ | Script / 操作 | Pass 基準 |
| --- | --- | --- | --- |
| PS-01 | Payment logic | `test-tlv-payment-logic.mjs` | 26/26 |
| PS-02 | Tip RPC | `test-tlv-create-tip-rpc-staging.mjs` ※prod fixture | 19/19 |
| PS-03 | RLS | `test-tlv-payment-rls-staging.mjs` | 30/30 |
| PS-04 | Chargeback | `test-tlv-payment-chargeback-staging.mjs` | 10/10 |
| PS-05 | Edge | `test-tlv-payment-edge.mjs` | anon 401 · e2e optional |

### 3.2 手動 Smoke（Production · 小額 / Stripe test user）

| ID | カテゴリ | 手順 | 期待 |
| --- | --- | --- | --- |
| PS-M01 | **Payment** | Live PI 最小 pack 購入 | `payments.status=succeeded` · wallet +coins · `purchase_credit` |
| PS-M02 | **Tip** | ライブ配信中 gift tip | `tips` 1行 · `tip_debit` · gauge 更新 |
| PS-M03 | **Wallet** | Viewer wallet 表示 | `coin_balance` = 最新 ledger `balance_after` |
| PS-M04 | **Ledger** | Admin SQL | wallet / revenue 整合 · stream_events に JPY なし |
| PS-M05 | **Webhook duplicate** | Stripe 同一 event 再送 | `payment_provider_events` 1行 · 残高二重加算なし |
| PS-M06 | **Refund** | Stripe Dashboard 部分返金（sandbox または ops 承認済 mini） | `handle_payment_refund` · `chargeback_debit` · `payment_reversals` |
| PS-M07 | **Chargeback** | Stripe test dispute（可能なら） | dispute open → lock · lost → clawback · TS-20 |
| PS-M08 | **RLS** | Viewer JWT で他 user wallet SELECT | 0 行 · INSERT 403 |
| PS-M09 | **Frozen** | shortfall シナリオ（staging 再現 or ops） | `viewer_wallets.status=frozen` · tip 拒否 |

**Viewport / Console:** 8788 ローカル確認は UI 用 · Payment smoke は **Supabase + Stripe** 正本。

---

## 4. Go / No-Go Checklist

### 4.1 Pre-release（必須 ALL）

- [ ] Staging 全スイート PASS 記録あり（logic 26 · RPC 19 · RLS 30 · CB 10 · edge）
- [ ] Production DB **backup / PITR** 取得
- [ ] Production project ref **目視確認**（staging 誤 link 防止）
- [ ] `db/tlv_schema.sql` + Step 1〜5 適用計画承認
- [ ] RLS migration **PostgREST expose より先** — 順序確認
- [ ] Edge Secrets 存在確認（`STRIPE_*` · service_role）— **値の変更は別チケット**
- [ ] FinOps Runbook（§5）配布 · on-call 確認
- [ ] Rollback 手順（PITR）確認

### 4.2 Release day（順序付き）

- [ ] Step 0〜5 migration 適用 · 各 Step verification PASS
- [ ] `config push` — `tlv` schema expose
- [ ] Edge 3 functions deploy
- [ ] Stripe webhook 7 events 登録
- [ ] PS-01〜05 自動 PASS
- [ ] PS-M01〜05 手動 PASS（M06/M07 は ops 判断）
- [ ] `docs/TODO.md` Production Go 更新

### 4.3 Go 判定

| 結果 | 条件 |
| --- | --- |
| **Go** | Pre-release ALL + Release day 自動 ALL + PS-M01〜05 PASS |
| **No-Go** | RLS 未適用 · Edge 未 deploy · webhook 4 event 未登録 · いずれか smoke FAIL |

### 4.4 Post-release（24h）

- [ ] `payment_provider_events` error/failed 率監視
- [ ] Stripe webhook delivery success > 99%
- [ ] 初回 live purchase / tip 1 件目視確認
- [ ] FinOps: `payment_reversals.metadata.manual_finops=true` 件数ゼロ確認

---

## 5. FinOps Runbook — Chargeback / Payout 後 Clawback

### 5.1 自動処理（Engine）

| トリガ | 自動 |
| --- | --- |
| `charge.refunded` | coin claw · revenue adjustment · `payment_reversals` |
| `dispute.created` | wallet lock · creator `payout_hold` · payout_log `hold` |
| `dispute.closed(lost)` | clawback · TS-20 · hold 30d |
| `payout_log.status=paid` 後の CB | **`manual_finops=true`** フラグのみ — Connect 逆送金は **手動** |

### 5.2 Ops キュー（毎日）

| キュー | クエリ目安 | アクション |
| --- | --- | --- |
| **Frozen wallet** | `viewer_wallets.status='frozen'` | shortfall 調査 · 回収 or 貸倒判断 |
| **Manual FinOps** | `payment_reversals.metadata->>'manual_finops'='true'` | Stripe Connect 逆送金 / 次回 payout 相殺 |
| **Payout hold** | `creators.payout_hold=true` | 30d 経過 · dispute 解消確認 |
| **Paid + chargeback** | join payout_log(paid) + payment_reversals | §5.3 手順 |

### 5.3 Payout 後 Chargeback（手動 · v1）

```text
1. payment_reversals 行を特定（dispute_lost / refund + manual_finops）
2. revenue_ledger adjustment 済みを確認（同一 payment_id / tip_id）
3. creator_id · 影響 JPY 額を FinOps チケットに記録
4. Stripe Connect Dashboard:
     - Transfer reversal または次回 payout 相殺（Platform ポリシーに従う）
5. 完了後 payment_reversals.metadata に ops_ticket_id · resolved_at を追記（UPDATE 禁止 → 新 reversal 行 or Ops 外部台帳）
6. creators.payout_hold 解除は TS / 30d 条件後
```

**禁止:** wallet `coin_balance` 負値 · silent ledger 削除

### 5.4 Shortfall（coin 不足）

| 項目 | 対応 |
| --- | --- |
| `coins_shortfall` > 0 | wallet **frozen** · 新規 purchase/tip 拒否 |
| 回収 | Ops `adjustment_debit` + reason_code（Stripe 非連動） |
| Creator 側 | revenue adjustment は **実行済み** — payout 側で相殺 |

### 5.5 エスカレーション

| 条件 | 連絡 |
| --- | --- |
| 同一 payment 二重 processed 疑い | Eng — idempotency 調査 |
| revenue_ledger CHECK 違反 | Eng — migration 未適用疑い |
| paid payout 後 CB 週 3 件超 | FinOps lead + Product |

---

## 6. Production Release 手順（確定版）

### Phase A — 準備（D-7〜D-1）

1. 本ドキュメント + Go/No-Go §4.1 レビュー
2. Production backup 手順確認
3. FinOps Runbook §5 周知
4. Staging 最終 PASS 記録アーカイブ

### Phase B — DB（Release day · 要メンテナンス窓 15〜30min）

1. production link 確認
2. Migration Step 0〜5 順次適用（§1.2）
3. 各 Step verification（§1.5）
4. PS-02〜04 production linked 実行

### Phase C — Platform（Release day）

1. `npx supabase config push --linked`（tlv schema）
2. Edge deploy 3 functions（§2.2）
3. Stripe webhook 7 events（§2.4）

### Phase D — 検証（Release day）

1. PS-01〜05 自動
2. PS-M01〜05 手動 smoke
3. Go/No-Go 判定 §4.3

### Phase E — 完了

1. `docs/TODO.md` · `TLV_PAYMENT_ENGINE.md` を **Production Go** に更新
2. 監視 24h（§4.4）
3. 振り返り · KNOWN_ISSUES 更新

---

## 7. 参照

| ドキュメント | 内容 |
| --- | --- |
| [tlv-payment-chargeback-clawback-implementation.md](./tlv-payment-chargeback-clawback-implementation.md) | TODO-06 実装 |
| [tlv-payment-rls-staging-test.md](./tlv-payment-rls-staging-test.md) | TODO-07 RLS |
| [tlv-payment-chargeback-clawback-design.md](./tlv-payment-chargeback-clawback-design.md) | 設計 ①〜⑩ |
| [docs/TLV_PAYMENT_ENGINE.md](../docs/TLV_PAYMENT_ENGINE.md) | Engine 正本 |
| [docs/production-release-checklist.md](../docs/production-release-checklist.md) | Platform 全体 checklist |

---

## 8. Blocker サマリ（Production Go まで）

| # | Blocker | Owner |
| --- | --- | --- |
| 1 | Production migration Step 0〜5 | Eng |
| 2 | Production RLS + config push | Eng |
| 3 | Production Edge deploy | Eng |
| 4 | Stripe Production webhook（+4 events） | Eng + FinOps |
| 5 | FinOps payout 後 clawback 運用開始 | FinOps |

**開発フェーズ:** **完了** · **Production Readiness Review:** **本ドキュメントで確定**
