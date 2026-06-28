# TLV Payment Engine — Chargeback / Refund / Clawback Design (TODO-06)

**Date:** 2026-06-28  
**Scope:** **設計のみ** — migration · DB · RPC · Edge · Stripe live **禁止**  
**前提:** TODO-07 RLS — staging 適用・30/30 PASS · production 未適用  
**正本:** [`docs/TLV_PAYMENT_ENGINE.md`](../docs/TLV_PAYMENT_ENGINE.md) · [`docs/TLV_DB_SCHEMA.md`](../docs/TLV_DB_SCHEMA.md) · [`reports/tlv-payment-rls-staging-test.md`](./tlv-payment-rls-staging-test.md)

---

## 0. 現行実装サマリ（調査）

| コンポーネント | 状態 |
| --- | --- |
| `tlv.create_tip_transaction` | ✅ staging 19/19 PASS |
| `tlv.handle_payment_webhook_success` | ✅ coin 購入確定のみ |
| `tlv-payment-webhook` | ✅ `payment_intent.succeeded/failed/canceled` のみ |
| `viewer_wallets` / `wallet_ledger` / `coin_lots` | ✅ DDL + RPC |
| `tip_coin_lot_allocations` | ✅ tip FIFO 溯源 |
| `revenue_ledger` / `creator_score_events` | ✅ tip 成功時 INSERT |
| `payment_provider_events` | ✅ 冪等 UNIQUE |
| `gauge_state` / extension | ✅ create_tip RPC 内 |
| RLS | ✅ staging `20260628150000` |
| **Refund / Dispute / Clawback** | ❌ **未実装** |

**既存 DDL 資産:** `payments.refund_amount_jpy` · `chargeback_amount_jpy` · `status=refunded/disputed` · `wallet_ledger.refund_credit/chargeback_debit/lock/unlock` · `revenue_ledger.event_kind=adjustment`

**実装 blocker（DDL）:** `revenue_ledger` CHECK が `net/gross >= 0` 固定 — adjustment 逆仕訳に **負値不可**（§⑤）

---

## ① Event 一覧

| Stripe Event | 採用 | 理由 |
| --- | --- | --- |
| `payment_intent.succeeded` | ✅ 済 | coin 購入確定 · 現行実装 |
| `payment_intent.payment_failed` | ✅ 済 | terminal 記録 · wallet 変更なし |
| `payment_intent.canceled` | ✅ 済 | 同上 |
| **`charge.refunded`** | **✅ P0 採用** | 通常返金 · 部分/全額 · coin clawback 正本トリガ |
| **`charge.refund.updated`** | **△ P1 採用** | refund 状態同期 · `charge.refunded` で足りる場合は no-op 可 |
| **`charge.dispute.created`** | **✅ P0 採用** | 異議申立開始 · hold · lock |
| **`charge.dispute.updated`** | **△ P1 採用** | 証拠期限 · status 同期 · created/closed と組合 |
| **`charge.dispute.closed`** | **✅ P0 採用** | won/lost 確定 · lost 時 clawback 実行 |
| **`charge.dispute.funds_withdrawn`** | **△ P1 採用** | 資金引出 · hold 強化（lost 前の防御） |
| `charge.dispute.funds_reinstated` | ❌ 不採用 v1 | `dispute.closed(won)` で代替 |
| `payment_intent.processing` | ❌ 不採用 | TLV coin 購入に無関係 |
| `checkout.session.*` | ❌ 不採用 | PI 経由で十分 |
| Connect `transfer.*` / `payout.*` | ❌ 不採用 v1 | payout 後 clawback は FinOps manual |
| Membership / Invoice events | ❌ 不採用 | Payment Engine 分離（Membership は別レーン） |

**フィルタ:** `metadata.order_type = TLV_STRIPE_ORDER_TYPE` 以外 → `payment_provider_events.status=ignored`

---

## ② Refund フロー（通常返金 · merchant-initiated）

### 2.1 共通

```text
charge.refunded
  → Edge 署名検証 → service_role
  → tlv.handle_payment_refund (単一 TX)
       1. provider_events 冪等
       2. payments: refund_amount_jpy += delta · net 再計 · status
       3. coin_lot(payment_id) 特定
       4. coin clawback（§2.2–2.4）
       5. wallet_ledger
       6. tip 溯源 → revenue_ledger adjustment（使用分）
       7. payment_reversals 監査行
```

**Coin 按分式（部分 refund）:**

```text
refund_coins = floor(payment.coins_granted * refund_jpy_delta / payment.gross_amount_jpy)
```

最終 refund で lot 残 coin を zero 調整（rounding metadata）。

### 2.2 Coin 未使用（lot.coins_remaining = coins_granted）

| 步骤 | 処理 |
| --- | --- |
| 1 | `coins_claw = min(lot.coins_remaining, refund_coins)` |
| 2 | `coin_lots.coins_remaining -= coins_claw` |
| 3 | `viewer_wallets.coin_balance -= coins_claw` |
| 4 | `wallet_ledger` **`chargeback_debit`**（coins_delta 負） |
| 5 | `payments.refund_amount_jpy += jpy` · status → `refunded`（全額時） |

**JPY:** `net_amount_jpy` CHECK 維持 · refund 累積で net 減少。

### 2.3 Coin 一部使用（0 < coins_remaining < coins_granted）

| 対象 | 処理 |
| --- | --- |
| 未使用分 | §2.2 と同様（lot remaining から claw） |
| 使用済分 | §2.4 + §⑦ revenue 逆仕訳 |
| Viewer wallet | 使用済分も `chargeback_debit` で回収試行 |

### 2.4 Coin 全使用（coins_remaining = 0）

| 步骤 | 処理 |
| --- | --- |
| 1 | `tip_coin_lot_allocations` → 影響 `tips[]` |
| 2 | 各 tip: `revenue_ledger` adjustment 逆仕訳（§⑤） |
| 3 | `wallet_ledger.chargeback_debit` — 全 refund_coins |
| 4 | 不足 → §⑥ frozen + shortfall |

**Refund vs Chargeback entry:** coin 減少は **`chargeback_debit` に統一** · JPY 区別は `payments.refund_amount_jpy` のみ（`refund_credit` wallet entry は v1 不使用 — 符号混乱防止）。

---

## ③ Chargeback（カード会社 · dispute）

### 3.1 フェーズ

| Phase | Event | 処理 |
| --- | --- | --- |
| **Open** | `dispute.created` | `payments.status=disputed` · wallet **lock**（該当 lot 相当 coin） · creator **payout_hold** · provider_events 記録 |
| **Update** | `dispute.updated` | metadata 同期 · hold 延長 |
| **Closed won** | `dispute.closed(status=won)` | lock **unlock** · status `succeeded` 維持 · hold 解除 |
| **Closed lost** | `dispute.closed(status=lost)` | **§② と同 clawback 実行** · `chargeback_amount_jpy += amount` · TS event |

### 3.2 シナリオ別

| シナリオ | Coin | Creator Tip | Payout 前 | Payout 後 |
| --- | --- | --- | --- | --- |
| **未使用 coin** | lot remaining claw · balance↓ | 影響なし | hold 30d · PL なし | 同上 + payout_log hold |
| **使用済 coin** | wallet debit · tip 溯源 | revenue adjustment 逆仕訳 | hold · adjustment | adjustment + **FinOps manual** Connect clawback |
| **Creator へ Tip 済** | 上記 + tip 按分 | creator_id 単位 adjustment | creator_score_events TS | Ops 手動 |
| **Payout 前** | 自動 RPC | adjustment 行 INSERT | `payout_log.status=hold` | — |
| **Payout 後** | 自動 RPC（coin 部分） | adjustment 行 INSERT | — | **Stripe Connect 逆送金 v1 外** · Ops |

### 3.3 フロー図

```text
dispute.created
  → lock coins (wallet_ledger lock/unlock)
  → creators.payout_hold = true
  → payment_reversals(dispute_open)

dispute.closed(lost)
  → handle_payment_dispute(closed_lost)
  → ② Refund と同 clawback パス + chargeback_amount_jpy
  → creator_score_events: CHARGEBACK_RECEIVED
  → hold_until = now() + 30d

dispute.closed(won)
  → unlock · reversal case closed · no clawback
```

---

## ④ Clawback（内部補正 · 非 Stripe）

| 種別 | 経路 | 処理 |
| --- | --- | --- |
| **Fraud / Abuse** | Ops Edge + service_role | `adjustment_debit` + `reason_code=FRAUD_CLAWBACK` · wallet frozen |
| **Manual Admin** | 既存 T21 パターン | `adjustment_credit/debit` + reason 必須 · **Stripe 非連動** |
| **Double Payment** | provider_events duplicate | **自動 no-op**（既存冪等）— clawback 不要 |
| **Duplicate Webhook** | 同一 event.id | `status=processed` → 200 no-op |
| **Erroneous grant** | Ops | `adjustment_debit` · 必要なら lot 手動調整 |

**原則:** Stripe 連動 clawback は **③ RPC** · 内部のみは **adjustment_* + reason_code**（監査必須）。新 entry_type **不要**。

---

## ⑤ Ledger 逆仕訳方針

### 5.1 wallet_ledger（INSERT-only · 既存 enum）

| entry_type | 方向 | 用途 | 新規追加 |
| --- | --- | --- | --- |
| `purchase_credit` | + | 購入 | 不要 |
| `tip_debit` | − | tip | 不要 |
| **`chargeback_debit`** | − | refund/dispute lost clawback | **使用開始（未実装）** |
| `refund_credit` | + | 返金で coin 復帰 | **v1 不使用**（debit 統一） |
| **`lock` / `unlock`** | 0 | dispute open/close | **使用開始** |
| `adjustment_credit/debit` | ± | Ops · fraud | 既存 · reason 必須 |

### 5.2 revenue_ledger

| event_kind | 用途 | 新規追加 |
| --- | --- | --- |
| `gift` / `extension` | tip 正方向 | 不要 |
| **`adjustment`** | 逆仕訳 · chargeback 按分 | **負値許可 CHECK migration 必須** |

**逆仕訳行:** `net_amount_jpy` **負** · `tip_id` / `payment_id` リンク · `notes=chargeback:{dispute_id}|refund:{event_id}`

### 5.3 payment_provider_events

| 変更 | 要否 |
| --- | --- |
| 列追加 | **不要** — 既存 status/error_message/payment_id で足りる |
| 新 status | **不要** — `processed/failed/ignored` 維持 |

### 5.4 creator_score_events

| reason_code | 用途 | 新規 |
| --- | --- | --- |
| `CHARGEBACK_RECEIVED` | dispute lost | 定義済 · INSERT 開始 |
| `REFUND_RECEIVED` | 任意 · 通常 refund | **v1 省略可**（TS 軽度なら CHARGEBACK に統一） |

**新 axis / reason enum:** **不要**（既存 TS + reason_code text）

### 5.5 新テーブル

| テーブル | 判定 | 理由 |
| --- | --- | --- |
| **`tlv.payment_reversals`** | **推奨** | 部分 refund 累積 · dispute ライフサイクル · Ops 監査 |
| `viewer_clawback_debt` | **v1 不要** | shortfall は `payment_reversals.coins_shortfall` + wallet frozen |
| `coin_lots.status` | **不要** | `coins_remaining` + metadata |

#### payment_reversals 案

| 列 | 備考 |
| --- | --- |
| payment_id | FK |
| provider_event_id | Stripe event.id |
| reversal_kind | refund · dispute_open · dispute_lost · dispute_won |
| stripe_dispute_id | nullable |
| jpy_delta · coins_clawed · coins_shortfall | |
| status | pending · applied · failed |
| metadata | tip_ids · lot_ids |

**RLS:** admin + service_role（TODO-07 パターン踏襲）

---

## ⑥ Wallet 方針

| 項目 | 方針 | 理由 |
| --- | --- | --- |
| **`coin_balance`** | **0 未満禁止** | DDL CHECK `>= 0` · 変更しない |
| **`locked_coin_balance`** | dispute open 時に該当 coin を lock | 調査中 spend 防止 |
| **negative balance** | **❌ 禁止** | DB 制約 · ゲーム内通貨は負債テーブルで表現しない（v1） |
| **不足時（shortfall）** | claw 可能分のみ debit → **frozen** | 残りは `payment_reversals.coins_shortfall` + Ops |
| **`status=frozen`** | shortfall / fraud / dispute lost 後 | createTip · 購入 RPC 拒否（既存 T22 パターン） |
| **`status=closed`** | v1 自動設定 **しない** | Ops manual のみ |

**許可:** frozen + shortfall 記録 · **禁止:** balance 負値 · silent 残高改ざん

---

## ⑦ Creator Revenue / Gauge / Score / Extension

| 対象 | 補正タイミング | 方法 |
| --- | --- | --- |
| **Creator Revenue（PL）** | refund/dispute lost **確定時**（同一 TX） | `revenue_ledger` adjustment · tip 溯源按分 |
| **Creator Score** | 同上 | `creator_score_events` TS · `CHARGEBACK_RECEIVED` |
| **Payout hold** | dispute created **即時** · lost 後 30d | `creators.payout_hold` · `payout_log.hold_until` |
| **Gauge（extension）** | tip 溯源確定後 **P1** | `gauge_state.paid_extension_coins` 減算（下限 0） |
| **Extension block** | stream live 中のみベストエフォート | stream ended → Ops or スキップ |
| **stream_events** | 監査のみ P1 | `metadata.clawback_tip_id` · **JPY なし** |

**locked 月次 PL:** `creator_score_monthly.locked_at IS NOT NULL` → adjustment 行のみ（直接 UPDATE 禁止）

---

## ⑧ Idempotency

| ケース | キー | 動作 |
| --- | --- | --- |
| Webhook 重複 | `(provider, provider_event_id)` UNIQUE | processed → 200 no-op |
| Refund 重複 event | 同上 | 各 event 1 行 · 累積 refund は payment 列で管理 |
| 同一 refund 再送 | event.id 同一 | no-op |
| Dispute 更新 | event.id ごと新行 · `stripe_dispute_id` で phase 管理 | open 済 → closed のみ clawback |
| RPC 再実行 | provider_events + payment_reversals.status | applied なら no-op |
| 部分 refund 2 回目 | 異 event.id · 累積 `refund_amount_jpy` | 残 coin から追加 claw |

**安全設計:** 全副作用 **1 TX** · 失敗 → ROLLBACK · provider_events `failed` 記録 · Stripe 再送可

---

## ⑨ RPC 設計

| RPC | 呼び出し | service_role | TX 境界 |
| --- | --- | --- | --- |
| **`tlv.handle_payment_refund`** | Edge `charge.refunded` | **必須** | 単一 TX |
| **`tlv.handle_payment_dispute`** | Edge dispute.* | **必須** | 単一 TX |
| **`tlv.apply_coin_clawback_for_payment`** | 上記から internal | service_role のみ | 呼び出し元 TX 内 |
| **`tlv.reverse_tip_revenue_for_lot`** | internal | 同上 | 同上 |

**変更禁止:** `create_tip_transaction` · `handle_payment_webhook_success`（凍結）

### Rollback 条件

| 条件 | 動作 |
| --- | --- |
| payment 未存在 | raise · event `failed` |
| payment 未 succeeded | ignore or failed（refund 不可） |
| coin_balance 不足 | **部分 claw + frozen** — TX commit（shortfall 記録） |
| revenue_ledger CHECK 違反 | **ROLLBACK** — migration 前提 |
| 二重 processed | no-op return |

**GRANT:** `REVOKE EXECUTE FROM anon, authenticated` · service_role only（TODO-07 同様）

---

## ⑩ テスト設計

| ID | カテゴリ | ケース | 期待 |
| --- | --- | --- | --- |
| T-CB-01 | Full Refund | 購入 → 全額 refund · coin 未使用 | lot=0 · balance↓ · ledger debit |
| T-CB-02 | Partial Refund | 50% ×2回 | 累積 refund_jpy · 比例 coin |
| T-CB-03 | Chargeback | dispute created → closed lost | hold → clawback · TS event |
| T-CB-04 | Payout 前 | 還元未 paid | adjustment · payout_log hold |
| T-CB-05 | Payout 後 | paid 済 | adjustment · FinOps flag（自動 Connect なし） |
| T-CB-06 | Coin 未使用 | remaining=granted | lot claw only |
| T-CB-07 | Coin 使用済 | tip 後 refund | tip 溯源 · revenue adjustment |
| T-CB-08 | Ledger 整合 | 後 | wallet balance = latest ledger.balance_after |
| T-CB-09 | Idempotency | 同一 event 2 回 | 1 副作用 |
| T-CB-10 | Webhook duplicate | 2 webhook same id | no-op |
| T-CB-11 | RLS 回帰 | 後 | logic 26/26 · RPC 19/19 · RLS 30/30 · edge PASS |

**スクリプト（実装時）:**

- `scripts/test-tlv-payment-chargeback-logic.mjs` — CB-L01〜08
- `scripts/sql/tlv-staging-chargeback-integration.sql` — T-CB-01〜10
- 回帰: 既存 4 スイート

**ENGINE T10 マッピング:** payment net↓ · chargeback_debit · hold 30d

---

## 実装フェーズ（参考 · 今回未着手）

| Phase | 内容 |
| --- | --- |
| P0-a | DDL: revenue_ledger CHECK · payment_reversals |
| P0-b | RPC refund + clawback helper |
| P0-c | Edge charge.refunded |
| P0-d | RPC dispute + Edge |
| P0-f | Tests T-CB-01〜11 |
| P1 | Gauge extension rollback |

---

## Production Go 残タスク

| # | タスク | Blocker |
| --- | --- | --- |
| 1 | TODO-06 **実装**（上記 Phase） | Yes |
| 2 | TODO-07 **production RLS** | Yes |
| 3 | FinOps payout 後 clawback 手順 | Yes |
| 4 | Stripe webhook 本番 register | Deploy 時 |

---

## 参照

- [tlv-payment-rls-staging-test.md](./tlv-payment-rls-staging-test.md)
- [tlv-wallet-ledger-schema.md](./tlv-wallet-ledger-schema.md)
- [docs/TLV_PAYMENT_ENGINE.md §6.4 / §9.5](../docs/TLV_PAYMENT_ENGINE.md)
