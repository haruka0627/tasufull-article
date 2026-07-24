# Payment Engine — Lock Order Design Review

**Date:** 2026-06-28  
**Phase:** Production Release 前監査（**設計・監査のみ**）  
**Scope:** `create_tip_transaction` · `handle_payment_refund` · `handle_payment_dispute`  
**正本:** [docs/PAYMENT_ENGINE.md](../docs/PAYMENT_ENGINE.md)  
**Git HEAD:** `aebf23c`  
**Production 変更:** **なし**（SQL / RPC / migration / deploy 禁止遵守）

---

## Executive summary

| ルール | 状態 |
| --- | --- |
| Payment Lock Order Rule | **正式追加** — [PAYMENT_ENGINE.md](../docs/PAYMENT_ENGINE.md) |
| Deadlock Rule | **正式追加** |
| Double Spend Rule | **正式追加** |
| 3 RPC 完全一致 | **❌ 部分一致** — 既知の順序差分あり |
| Production Go 追加 Blocker | **❌ なし** — 既存 PRE-FLIGHT blocker のみ（webhook deploy 等） |
| 修正 | **TODO のみ** — 実装変更は本監査範囲外 |

---

## 1. 正式ルール（追加内容）

### 1.1 Payment Lock Order Rule

```text
① Wallet → ② FIFO Coin Lots → ③ Payment Reversals
→ ④ Wallet Ledger → ⑤ Revenue Ledger → ⑥ Creator Score → Commit
```

- 逆順禁止（Wallet より先に FIFO / Ledger / Revenue を `FOR UPDATE` しない）
- 冪等レイヤ: `payment_provider_events` → `payments` は Wallet **前**可（§2.2）

### 1.2 Deadlock Rule

- 全 RPC 同一順序 · 途中変更禁止 · 複数 Wallet 同時ロック禁止
- 長時間 TX 禁止 · TX 内外部 API 禁止 · TX 内 DB のみ

### 1.3 Double Spend Rule

```text
Wallet 取得 → FOR UPDATE → 残高判定 → FIFO → Ledger → Commit
```

- Wallet ロック前の残高判定で spend 判断 **禁止**

---

## 2. RPC レビュー — `tlv.create_tip_transaction`

**Source:** `supabase/migrations/20260628140000_tlv_create_tip_transaction_rpc.sql`  
**Staging:** PS-02 **19/19 PASS**

### 2.1 実際のロック / 更新順

| 順 | 操作 | 種別 |
| ---: | --- | --- |
| 1 | `tips` idempotency SELECT（副作用なし path） | 読取 · 無ロック |
| 2 | **`streams` FOR UPDATE** | ⚠️ Wallet 前 |
| 3 | **`gauge_state` FOR UPDATE**（extension 時） | ⚠️ Wallet 前 |
| 4 | **`viewer_wallets` FOR UPDATE** | ① Wallet |
| 5 | 残高判定 `coin_balance - locked_coin_balance` | ✅ ロック後 |
| 6 | **`coin_lots` FIFO FOR UPDATE** loop | ② Lots |
| 7 | `tips` INSERT · allocations INSERT | — |
| 8 | `viewer_wallets` UPDATE | ① 更新 |
| 9 | `wallet_ledger` INSERT | ④ Ledger |
| 10 | `revenue_ledger` INSERT（条件付き） | ⑤ Revenue |
| 11 | `creators` SELECT · `creator_score_events` INSERT | ⑥ Score |
| 12 | `gauge_state` UPDATE · `streams` UPDATE | 補助 |

### 2.2 ルール照合

| ルール | 判定 | 備考 |
| --- | --- | --- |
| Lock Order | **⚠️ 部分不一致** | `streams` / `gauge_state` が Wallet **前** |
| Deadlock | **⚠️ リスク** | dispute open（lot→wallet）と逆順 · 同一 wallet 并发 |
| Double Spend | **✅ 一致** | 残高判定は Wallet `FOR UPDATE` 後 |
| 複数 Wallet | **✅** | 単一 `p_payer_user_uuid` |
| TX 内外部 API | **✅** | DB のみ |
| payment_reversals | **N/A** | tip 経路では未使用 |

### 2.3 TODO

| ID | 内容 | 優先 |
| --- | --- | --- |
| TODO-LOCK-01 | `streams` / `gauge_state` を **Wallet ロック後** に移動 | P2 |
| TODO-LOCK-07 | tip ∥ dispute open 並行 deadlock テスト追加 | P2 |

---

## 3. RPC レビュー — `tlv.handle_payment_refund`

**Source:** `supabase/migrations/20260628160000_tlv_payment_chargeback_clawback.sql`  
**内部:** `tlv.apply_coin_clawback_for_payment`  
**Staging:** PS-04 **10/10 PASS**

### 3.1 実際の順序

**`handle_payment_refund`:**

| 順 | 操作 |
| ---: | --- |
| 1 | `payment_provider_events` FOR UPDATE（冪等） |
| 2 | `payments` SELECT（**無ロック**） |
| 3 | `payment_reversals` SELECT（重複チェック · 無ロック） |
| 4 | `apply_coin_clawback_for_payment(...)` |

**`apply_coin_clawback_for_payment`:**

| 順 | 操作 |
| ---: | --- |
| 1 | `payments` FOR UPDATE |
| 2 | `viewer_wallets` FOR UPDATE |
| 3 | `coin_lots` FOR UPDATE |
| 4 | lot UPDATE · `reverse_tip_revenue_for_lot` → revenue INSERT |
| 5 | wallet UPDATE · `wallet_ledger` INSERT |
| 6 | `payments` UPDATE |
| 7 | `creators` FOR UPDATE loop · score INSERT · payout hold |
| 8 | `payment_reversals` INSERT |

### 3.2 ルール照合

| ルール | 判定 | 備考 |
| --- | --- | --- |
| Lock Order | **⚠️ 部分不一致** | 0b `payments` が Wallet 前（§2.2 許容）· clawback 内は payment→wallet→lot ✅ |
| Deadlock | **✅ おおむね** | 単一 wallet · 順序は clawback 内で一定 |
| Double Spend | **✅** | clawback は locked wallet 上で `v_actual_claw` 計算 |
| 複数 Wallet | **✅** | 1 payment → 1 payer wallet |
| payment_reversals | **⚠️** | ledger **後** INSERT — 仕様上 ③ は INSERT で lock 不要 · **順序 OK** |

### 3.3 TODO

| ID | 内容 | 優先 |
| --- | --- | --- |
| TODO-LOCK-03 | `handle_payment_refund` 入口で `payments` を early `FOR UPDATE`（clawback 前） | P3 |
| TODO-LOCK-04 | `apply_coin_clawback` の `payments`→`wallet`→`lot` をドキュメント上 **標準 clawback 順** として固定 | P3 |

---

## 4. RPC レビュー — `tlv.handle_payment_dispute`

**Source:** 同上 migration  
**Staging:** PS-04 **10/10 PASS**

### 4.1 フェーズ別順序

**`dispute.open`（問題最大）:**

| 順 | 操作 | 照合 |
| ---: | --- | --- |
| 1 | `payment_provider_events` FOR UPDATE | 0a ✅ |
| 2 | `payments` FOR UPDATE | 0b ✅ |
| 3 | **`coin_lots` FOR UPDATE** | ⚠️ **Wallet 前** |
| 4 | `viewer_wallets` FOR UPDATE | ① |
| 5 | wallet UPDATE · `wallet_ledger` INSERT | ④ |
| 6 | `creators` / `payout_log` UPDATE | hold |
| 7 | `payment_reversals` INSERT | ③ |

**`dispute.won`:** wallet FOR UPDATE → unlock ledger → reversals INSERT — **✅ おおむね**

**`dispute.lost`:** `apply_coin_clawback_for_payment` — §3 と同じ

### 4.2 ルール照合

| ルール | 判定 | 備考 |
| --- | --- | --- |
| Lock Order | **❌ open 不一致** | lot **→** wallet は §2 逆順 |
| Deadlock | **⚠️ P1 リスク** | `create_tip`（wallet→lots）と **逆順** · 同一 payer |
| Double Spend | **✅ open** | lock coins は wallet ロック後に計算 |
| Double Spend | **✅ lost** | clawback 経由 |

### 4.3 TODO

| ID | 内容 | 優先 |
| --- | --- | --- |
| **TODO-LOCK-02** | **`dispute.open`:`viewer_wallets` FOR UPDATE を `coin_lots` より前へ** | **P1** |
| TODO-LOCK-05 | dispute / refund / tip 横断 Lock Order 一覧を migration コメントに同期 | P2 |

---

## 5. 横断比較

| RPC | Wallet 前の FOR UPDATE | Wallet→Lots | Double Spend | Staging |
| --- | --- | --- | --- | --- |
| `create_tip_transaction` | streams, gauge | ✅ wallet→lots | ✅ | 19/19 |
| `handle_payment_refund` | provider_event, payment(0b) | ✅ wallet→lot | ✅ | 10/10 |
| `handle_payment_dispute` open | provider_event, payment, **lot** | ❌ lot→wallet | ✅ | 10/10 |
| `handle_payment_dispute` lost | （clawback 経由） | ✅ wallet→lot | ✅ | 10/10 |

**参考（本監査副次）:** `handle_payment_webhook_success` — event→payment→wallet→lot INSERT — purchase 経路 · Wallet 前に payment lock · Wallet 後に lot 作成（UPDATE lock なし）— **おおむね §2.2 準拠**

---

## 6. TODO 一覧（実装変更なし）

| ID | 内容 | 優先 | Production Go |
| --- | --- | --- | --- |
| **TODO-LOCK-02** | dispute.open: Wallet before lot | **P1** | 止めない · 高并发前に修正推奨 |
| TODO-LOCK-01 | create_tip: stream/gauge after wallet | P2 | 止めない |
| TODO-LOCK-03 | refund: early payment FOR UPDATE | P3 | 止めない |
| TODO-LOCK-04 | clawback 順序を標準パターンとして明文化 | P3 | 止めない |
| TODO-LOCK-05 | migration コメント ↔ PAYMENT_ENGINE 同期 | P2 | 止めない |
| TODO-LOCK-06 | 冪等 early-return 路径のドキュメント例外をテストで固定 | P3 | 止めない |
| TODO-LOCK-07 | 並行 tip + dispute stress テスト | P2 | 止めない |

---

## 7. Production Go 判定

| 質問 | 回答 |
| --- | --- |
| 本監査で **新たな Production Go Blocker** が生じたか | **No** |
| 理由 | staging 全 PASS · 既知順序差分 · 単一 wallet · service_role 直 RPC · 既存 PRE-FLIGHT（webhook deploy · Stripe · backup）が支配的 |
| 推奨 | **TODO-LOCK-02（P1）** は Production Go **後** · 高并发前までに実施 |
| 既存 Blocker | [payment-production-final-preflight.md](./payment-production-final-preflight.md) — 変更なし |

---

## 8. Git diff

**本監査でのコード変更:** **なし**

| 種別 | 変更 |
| --- | --- |
| SQL / RPC / migration | **0 files** |
| deploy / Production | **0** |
| ドキュメントのみ | `docs/PAYMENT_ENGINE.md`（新規）· `docs/TLV_PAYMENT_ENGINE.md` · `docs/TLV_DB_SCHEMA.md` · `docs/TODO.md` · 本レポート |

---

## 9. 参照

- [docs/PAYMENT_ENGINE.md](../docs/PAYMENT_ENGINE.md)
- [FINAL PRE-FLIGHT](./payment-production-final-preflight.md)
- [RV3 Release Plan](./tlv-payment-release-plan-rv3.md)

---

*Review completed 2026-06-28 · design-only · no implementation changes*
