# TLV Payment Engine — create_tip_transaction RPC 実装レポート

**日付:** 2026-06-28  
**版:** v1.2.5 / ENGINE v1.5  
**解消:** CAND-P2-01 · DEV-01 · DEV-02 · DEV-03 · DEV-04 · W1-GAP-01

---

## 1. 実装概要

`createTip` を TypeScript 逐次 DB 更新から PostgreSQL **`tlv.create_tip_transaction`** 単一 TX RPC に移行した。

| 項目 | 内容 |
| --- | --- |
| migration | `supabase/migrations/20260628140000_tlv_create_tip_transaction_rpc.sql` |
| Edge | `tlv-create-tip` → RPC 薄ラッパ |
| 旧 RPC 名 | `tlv.create_tip` — migration 内で DROP |

---

## 2. RPC 入出力

### 2.1 入力

| パラメータ | 型 | 備考 |
| --- | --- | --- |
| `p_stream_id` | uuid | live 必須 |
| `p_creator_id` | uuid | FK · stream 整合 |
| `p_payer_user_uuid` | uuid | **wallet 正本** |
| `p_payer_user_id` | text | 監査のみ |
| `p_tip_kind` | tlv.tip_kind | gift / extension / cheer |
| `p_coin_amount` | integer | 1..10000 |
| `p_idempotency_key` | text | unique partial index |
| `p_metadata` | jsonb | wallet_ledger metadata |
| `p_tip_id` | uuid | optional |
| `p_creator_user_id` | uuid | optional · score payload |
| `p_message` / `p_device_id` | text | tips 列 |
| `p_self_gift_flag` / `p_fraud_excluded` / `p_bot_flag` | bool | Edge プリチェック |

### 2.2 出力 (jsonb)

| フィールド | 意味 |
| --- | --- |
| `tip_id` | tips PK |
| `wallet_balance_after` |  debit 後残高 |
| `gauge_total_after` | paid_extension_coins |
| `extension_unlocked` | §3.4 通過後 grant |
| `review_required` | self_gift 疑義 |

---

## 3. 単一 TX 処理

1. idempotency_key / tip_id 重複 → no-op
2. stream FOR UPDATE · live 検証
3. gauge FOR UPDATE（extension tip）
4. viewer_wallets FOR UPDATE（`p_payer_user_uuid`）
5. coin_lots FOR UPDATE FIFO
6. tips + tip_coin_lot_allocations INSERT
7. wallet debit + wallet_ledger
8. revenue_ledger（review/fraud/bot 除外）
9. creator_score_events（同上）
10. gauge 加算 + §3.4 grant guard
11. stream_events（UX · JPY なし）

---

## 4. Row lock / race 対策

| リスク | 対策 |
| --- | --- |
| 同時 tip 二重 debit | wallet `FOR UPDATE` |
| lot remaining マイナス | lot `FOR UPDATE` + `WHERE coins_remaining >= take` |
| extension_unlock 重複 | `completed_extension_blocks` 差分 + §3.4 |
| 部分失敗 | 単一 TX rollback |
| idempotency race | unique index + `unique_violation` handler |

---

## 5. Idempotency

- DDL: `tips.idempotency_key` + `tips_idempotency_key_uniq`（`WHERE idempotency_key IS NOT NULL`）
- Edge: body `idempotency_key` または `crypto.randomUUID()`
- 重複時: 既存 tip_id / balance / gauge を返し **debit なし**

---

## 6. review_required（TODO-03 範囲）

- `review_required = self_gift_flag AND NOT fraud_excluded`
- tips + wallet debit + allocations **記録**
- **revenue_ledger / gauge / score_event なし**

---

## 7. fraud / bot

- `fraud_excluded` / `bot_flag` → gauge 加算なし · extension_unlock なし · revenue なし
- tips 行は fraud フラグ付きで記録

---

## 8. DEV-03 grant guard

ENGINE §3.4:

```text
allow = (adjusted_gauge_pct >= 100 AND paid >= 500)
     OR (paid >= 500 AND effective_ccu >= 5)
```

- 500 coin 到達のみでは unlock しない
- `completed_extension_blocks` で同一 phase 重複 unlock 防止
- **TODO-05:** `streams.phase_ends_at` 専用列なし — `gauge_state.free_phase_ends_at` 使用

---

## 9. W1-GAP-01 修正

**ファイル:** `supabase/functions/_shared/tlv-payment-webhook.ts`

```typescript
resolvePayerUserUuidFromMetadata(meta)
// coalesce(meta.payer_user_uuid, meta.wallet_user_id)
// 両方欠落 → invalid_metadata 400
// RPC p_payer_user_uuid + payments.payer_user_uuid 保存
```

---

## 10. テスト結果

```text
node scripts/test-tlv-payment-logic.mjs  → PASS（27 tests incl. W1-GAP-01 · §3.4 · fraud）
node scripts/test-tlv-payment-edge.mjs   → PASS/SKIP（404 = Edge 未デプロイ）
```

### DB 統合テスト（要 migration + deploy）

| ID | シナリオ |
| --- | --- |
| T-TIP-01〜09 | 通常 tip / 残高不足 / lot不足 / idempotency / 同時 tip / review / fraud / grant guard |

---

## 11. Go / No-Go

| 環境 | 判断 | 理由 |
| --- | --- | --- |
| **staging** | **Go** | RPC + Edge デプロイ後 |
| **production** | **No-Go** | **TODO-06** chargeback · **TODO-07** RLS 未解消 |

---

## 12. 未解消（スコープ外）

| ID | 内容 |
| --- | --- |
| TODO-03 | 疑義 tip ledger 計上タイミング（Ops） |
| TODO-05 | phase_ends_at 専用列 |
| TODO-06 | chargeback clawback |
| TODO-07 | RLS |
| DEV-05 | extension_contributors 完全仕様 |
| DEV-07 | self_gift text のみ比較 |

---

## 13. 参照

- `supabase/migrations/20260628140000_tlv_create_tip_transaction_rpc.sql`
- `supabase/functions/_shared/tlv-create-tip.ts`
- `supabase/functions/_shared/tlv-payment-webhook.ts`
- `docs/TLV_PAYMENT_ENGINE.md` v1.5
- `docs/TLV_DB_SCHEMA.md` v1.2.5
