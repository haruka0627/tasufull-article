# TLV viewer_wallets / wallet_ledger — 正式スキーマレポート

**日付:** 2026-06-28  
**版:** v1.2.3  
**正本:** `db/tlv_schema.sql` · `docs/TLV_PAYMENT_ENGINE.md` · `docs/TLV_DB_SCHEMA.md`

---

## 1. 目的

TLV Payment Engine 実装前に、**coin 残高の正本** `viewer_wallets` と **増減監査** `wallet_ledger` を DDL に正式追加する。

| レイヤ | 正本 |
| --- | --- |
| JPY 金額 | `payments` · `revenue_ledger` |
| coin 残高 | `viewer_wallets.coin_balance` |
| coin 増減履歴 | `wallet_ledger`（INSERT-only） |
| WR origin | `coin_lots` · `tip_coin_lot_allocations` |

**変更していないもの:** PL/Score/Rank/還元率 · `stream_events` 非金額正本

---

## 2. `tlv.viewer_wallets`

```sql
id                        uuid PK
user_id                   uuid NOT NULL UNIQUE
coin_balance              integer NOT NULL DEFAULT 0  -- CHECK >= 0
locked_coin_balance       integer NOT NULL DEFAULT 0  -- CHECK >= 0, <= coin_balance
lifetime_purchased_coins  integer NOT NULL DEFAULT 0
lifetime_spent_coins      integer NOT NULL DEFAULT 0
status                    tlv.wallet_status  -- active | frozen | closed
created_at / updated_at   timestamptz
```

### 2.1 責務

- **現在 coin 残高の唯一正本**
- tip 可否: `(coin_balance - locked_coin_balance) >= amount` かつ `status = active`
- JPY は保持しない

### 2.2 FK

- `user_id` → Platform ユーザー UUID（Supabase: `auth.users(id)`）
- DDL 本体では portability のため FK はコメントアウト — **別 migration で有効化推奨**

---

## 3. `tlv.wallet_ledger`

```sql
id                  uuid PK
wallet_id           uuid NOT NULL → viewer_wallets(id)
user_id             uuid NOT NULL
entry_type          tlv.wallet_ledger_entry_type
coins_delta         integer NOT NULL  -- CHECK <> 0
balance_after       integer NOT NULL  -- CHECK >= 0
payment_id          uuid NULL → payments
tip_id              uuid NULL → tips
provider_event_id   uuid NULL → payment_provider_events
reason_code         text NULL         -- adjustment_* では NOT NULL (CHECK)
metadata            jsonb DEFAULT '{}'
created_at          timestamptz
```

### 3.1 entry_type

| 値 | 方向 | 典型トリガ |
| --- | --- | --- |
| `purchase_credit` | + | Webhook coin 購入成功 |
| `tip_debit` | − | createTip |
| `refund_credit` | + | 返金で coin 復帰 |
| `chargeback_debit` | − | チャージバック clawback |
| `adjustment_credit` | + | Ops（**reason 必須**） |
| `adjustment_debit` | − | Ops（**reason 必須**） |
| `lock` / `unlock` | 0 | locked_coin_balance 操作 |

### 3.2 ポリシー

- **INSERT-only** — UPDATE/DELETE 禁止（アプリ · RLS · §9.2）
- **JPY 正本ではない** — 金額参照は `payments` / `revenue_ledger`
- `balance_after` = 同一 TX 直後の `viewer_wallets.coin_balance`

---

## 4. フロー連携

### 4.1 coin 購入（Webhook）

```text
payment_provider_events (冪等)
  → payments succeeded
  → viewer_wallets.coin_balance += N
  → lifetime_purchased_coins += N
  → coin_lots INSERT
  → wallet_ledger (purchase_credit, coins_delta=+N)
```

### 4.2 tip

```text
viewer_wallets FOR UPDATE
  → available >= coins
  → coin_lots FIFO 減算
  → coin_balance -= coins · lifetime_spent_coins += coins
  → wallet_ledger (tip_debit, coins_delta=-coins)
  → tips + revenue_ledger
```

### 4.3 welcome grant

```text
payments 行なし
  → coin_lots (welcome_grant)
  → coin_balance += N
  → wallet_ledger (adjustment_credit, reason_code=WELCOME_GRANT)
```

---

## 5. テスト観点

| # | ケース | 期待 |
| --- | --- | --- |
| W1 | coin 購入 | `purchase_credit` · coin_balance 増 · lifetime_purchased 増 |
| W2 | tip | `tip_debit` · coin_balance 減 · lifetime_spent 増 |
| W3 | 残高不足 | 402 · ledger/tips なし |
| W4 | chargeback | `chargeback_debit` · coin_balance 減 |
| W5 | Ops adjustment | reason_code 必須 · 無しは CHECK 違反 |
| W6 | ledger 整合 | 最新 `balance_after` = `coin_balance` |
| W7 | frozen | status=frozen → 購入/tip 拒否 |
| W8 | locked | available = coin - locked で tip 判定 |

（Payment Engine テスト T1–T4 · T10 · T19–T24 と対応）

---

## 6. coin_lots 連携変更（v1.2.3）

- `coin_lots.wallet_id` → `viewer_wallets.id` FK 追加
- `coin_lots.user_id` → uuid（denormalize · FIFO index 用）
- lot は **WR origin** · 残高正本ではない

---

## 7. TODO 候補（未確定 · 実装しない）

| ID | 内容 |
| --- | --- |
| ~~CAND-W1~~ | `payments`/`tips` payer UUID 整合 | **解消** — `payer_user_uuid` · [tlv-payment-user-uuid-alignment.md](./tlv-payment-user-uuid-alignment.md) |
| CAND-W2 | `public.users.id` text との Platform 統一 | 別 migration |
| CAND-W3 | `lock`/`unlock` entry の `coins_delta=0` CHECK — locked 変動を metadata のみで足りるか Ops 確認 |
| CAND-W4 | welcome 専用 `entry_type` 追加要否 — 現状 `adjustment_credit` + reason で代替 |
| CAND-W5 | refund 時 lot  clawback と wallet debit の順序 — FinOps 要確認 |

---

## 8. 関連ファイル

| ファイル | 変更内容 |
| --- | --- |
| `db/tlv_schema.sql` | v1.2.3 viewer_wallets / wallet_ledger 正式定義 |
| `docs/TLV_DB_SCHEMA.md` | §5.3–5.4 追記 |
| `docs/TLV_PAYMENT_ENGINE.md` | §1.8 · T19–T24 · TODO-01 解消 |
| `docs/TLV_PRD.md` | 変更履歴 v1.2.3 |
