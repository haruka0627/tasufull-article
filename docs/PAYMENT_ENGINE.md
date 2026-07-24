# Payment Engine — Concurrency & Lock Order（正式仕様）

**版:** 1.0  
**最終更新:** 2026-06-28  
**種別:** 正式設計（Lock Order · Deadlock · Double Spend）  
**適用範囲:** TLV Payment Engine 全 PostgreSQL RPC（`tlv.*` SECURITY DEFINER）  
**正本関係:** [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) · [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md)  
**監査:** [payment-lock-order-review.md](../reports/payment-lock-order-review.md)

---

## 1. 目的

Payment Engine 開発において以下を防止するため、全 RPC で **同一のロック順序** を守る。

- **Double Spend** — 残高・lot の二重消費
- **Deadlock** — 異なる RPC 間のロック循環待ち
- **Lock 競合** — 順序逆転による長時間ブロック

**原則:** 新規 RPC · 既存 RPC 改修は本書に従う。冪等レイヤ（`payment_provider_events`）は §2 例外。

---

## 2. Payment Lock Order Rule

全 Payment RPC は、**同一トランザクション内**で次の順に **ロック → 参照 → 更新** する。

```text
① Wallet          (tlv.viewer_wallets · FOR UPDATE)
      ↓
② FIFO Coin Lots  (tlv.coin_lots · FOR UPDATE · expires_at, created_at 昇順)
      ↓
③ Payment Reversals (tlv.payment_reversals · INSERT / 必要時 SELECT FOR UPDATE)
      ↓
④ Wallet Ledger   (tlv.wallet_ledger · INSERT only)
      ↓
⑤ Revenue Ledger  (tlv.revenue_ledger · INSERT only)
      ↓
⑥ Creator Score   (tlv.creator_score_events · INSERT · creators 更新は score 直前)
      ↓
Commit
```

### 2.1 禁止（逆順）

| 禁止 | 理由 |
| --- | --- |
| Wallet **より先に** FIFO / Ledger / Revenue を `FOR UPDATE` | Deadlock · Double Spend 窓 |
| `wallet_ledger` 更新前に `revenue_ledger` を確定させる読取依存 | 監査順序破壊 |
| Commit 前に別トランザクションへ副作用を委譲 | 原子性破壊 |

### 2.2 冪等・親エンティティ（例外レイヤ · 最優先）

Webhook / 逆仕訳 RPC では、副作用の **前** に次をロックしてよい（Wallet より前）。

| 順 | 対象 | 操作 |
| ---: | --- | --- |
| 0a | `tlv.payment_provider_events` | `FOR UPDATE` — 冪等 |
| 0b | `tlv.payments` | `FOR UPDATE` — 購入 / 返金 / dispute の親行 |

**ルール:** 0a → 0b の後、**必ず §2 ① Wallet へ進む**。0b の後に lot のみ `FOR UPDATE` して Wallet を後回しに **しない**。

### 2.3 補助エンティティ（Wallet 同一 TX 内）

| 対象 | 順序 |
| --- | --- |
| `tlv.streams` / `tlv.gauge_state` | **Wallet ロック後** に `FOR UPDATE`（tip / extension 時） |
| `tlv.tips` / allocations | Wallet + lots 確定後 |
| `tlv.creators` / `tlv.payout_log` | Revenue / reversal 確定後 · score / hold 更新 |

---

## 3. Deadlock Rule

| # | ルール |
| ---: | --- |
| 1 | **全 RPC で同一 Lock Order**（§2 + §2.2 例外レイヤ） |
| 2 | **途中で順番変更禁止** — 条件分岐で lot→wallet / stream→wallet 等にしない |
| 3 | **複数 Wallet の同時 `FOR UPDATE` 禁止** — 1 RPC = 1 payer wallet |
| 4 | **長時間 Transaction 禁止** — ゲージ計算・大量 loop は必要最小 |
| 5 | **外部 API 呼び出しを Transaction 内で禁止** — Stripe / HTTP は Edge のみ |
| 6 | **Transaction 開始後は DB 処理のみ** — RPC 内に network I/O なし |

---

## 4. Double Spend Rule

Wallet 残高の **判定・消費** は次の順序のみ有効。

```text
Wallet 取得（同一 TX 内）
      ↓
Wallet FOR UPDATE（ロック）
      ↓
残高判定（coin_balance - locked_coin_balance）
      ↓
FIFO lots FOR UPDATE + 消費
      ↓
Wallet UPDATE + wallet_ledger INSERT
      ↓
Commit
```

| 禁止 | 理由 |
| --- | --- |
| Wallet ロック **前** に残高判定で reject/accept | TOCTOU · 二重 spend |
| ロック前の残高読取を spend 判断に使用 | 同上 |

**冪等 early-return:** `idempotency_key` 等で **副作用なし return** する路径では、表示用残高の unlocked SELECT は可（debit なし）。

---

## 5. 対象 RPC（最低限）

| RPC | 用途 |
| --- | --- |
| `tlv.create_tip_transaction` | tip 消費 |
| `tlv.handle_payment_refund` | 返金 clawback |
| `tlv.handle_payment_dispute` | dispute open/won/lost |
| `tlv.handle_payment_webhook_success` | 購入 credit（新規 RPC も §2 準拠） |
| `tlv.apply_coin_clawback_for_payment` | 内部 · refund/dispute lost 共通 |

---

## 6. 検証

- コードレビュー: [payment-lock-order-review.md](../reports/payment-lock-order-review.md)
- 回帰: PS-02 · PS-04 staging PASS 維持
- 将来: 並行 tip + dispute open の stress / deadlock 検出テスト（TODO-LOCK-07）

---

## 7. 関連

| ドキュメント | 内容 |
| --- | --- |
| [TLV_PAYMENT_ENGINE.md §9.7](./TLV_PAYMENT_ENGINE.md) | Engine 正本への参照 |
| [TLV_DB_SCHEMA.md §5.2.1](./TLV_DB_SCHEMA.md) | RPC · DB 不変条件 |
| [tlv-payment-production-readiness.md](../reports/tlv-payment-production-readiness.md) | Production Release |

---

## 変更履歴

| 日付 | 版 | 内容 |
| --- | --- | --- |
| 2026-06-28 | 1.0 | Lock Order · Deadlock · Double Spend 正式追加（PRE-FLIGHT 監査） |
