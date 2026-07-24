# TLV Payment Engine — createTip RPC 実装レポート

**日付:** 2026-06-28  
**版:** v1.2.5 / ENGINE v1.5  
**解消:** CAND-P2-01 · DEV-01 · DEV-02 · DEV-03 · DEV-04

---

## 1. 概要

`createTip` を TypeScript 逐次 DB 更新から PostgreSQL **`tlv.create_tip`** 単一 TX RPC に移行した。

| レイヤ | 変更前 | 変更後 |
| --- | --- | --- |
| Edge `tlv-create-tip` | wallet/lot/gauge/ledger 逐次 | JWT · 検証 · fraud · RPC 呼出のみ |
| DB | 非原子 · race 可 | `FOR UPDATE` + 単一 TX |

**migration:** `supabase/migrations/20260628140000_tlv_create_tip_rpc.sql`

---

## 2. RPC 仕様 — `tlv.create_tip`

### 2.1 入力

| パラメータ | 型 | 備考 |
| --- | --- | --- |
| `p_stream_id` | uuid | `status = live` 必須 |
| `p_creator_id` | uuid | stream.creator_id と一致 |
| `p_payer_user_uuid` | uuid | **wallet 正本** |
| `p_payer_user_id` | text | 監査 · stream_events のみ |
| `p_tip_kind` | tlv.tip_kind | gift / extension / cheer |
| `p_coin_amount` | integer | 1..10000 |
| `p_idempotency_key` | text | optional · unique partial index |
| `p_metadata` | jsonb | wallet_ledger metadata |
| `p_tip_id` | uuid | optional · 重複時 no-op |
| `p_message` / `p_device_id` | text | tips 列 |
| `p_self_gift_flag` | boolean | Edge プリチェック |
| `p_fraud_excluded` | boolean | bot 等 |
| `p_bot_flag` | boolean | bot_suspect |

### 2.2 出力 (jsonb)

```json
{
  "ok": true,
  "duplicate": false,
  "tip_id": "uuid",
  "wallet_balance_after": 1200,
  "gauge_total_after": 750,
  "extension_unlocked": true,
  "extension_blocks_granted": 1,
  "review_required": false,
  "wr_at_tip": 0.5911,
  "fraud_excluded": false
}
```

### 2.3 DDL 追加

```sql
alter table tlv.tips add column idempotency_key text;
create unique index tips_idempotency_key_uniq
  on tlv.tips (idempotency_key) where idempotency_key is not null;
```

---

## 3. 単一 TX 処理順

1. **Idempotency** — `idempotency_key` / `p_tip_id` 既存 → 現状 balance/gauge を返し **debit なし**
2. **Stream FOR UPDATE** — live · creator 整合
3. **Gauge FOR UPDATE** — extension tip 時のみ
4. **Wallet FOR UPDATE** — `user_id = p_payer_user_uuid`（text JOIN なし）
5. **coin_lots FOR UPDATE FIFO** — extension は `extension_allowed=false` スキップ · `coins_remaining >= take` 楽観更新
6. **tips INSERT** — `payer_user_uuid` 正本 · WR origin スナップショット
7. **tip_coin_lot_allocations INSERT**
8. **wallet debit** + **wallet_ledger INSERT**
9. **revenue_ledger** — `NOT review_required AND NOT fraud AND NOT bot`
10. **creator_score_events** — 上記と同条件 · delta=0（Score 再計算なし）
11. **gauge 加算** — extension のみ · fraud/review 除外
12. **§3.4 grant guard** — 条件未達なら unlock なし
13. **stream_events** — UX のみ · JPY キーなし

---

## 4. Race 対策

| リスク | 対策 |
| --- | --- |
| 同時 tip 二重 debit | `viewer_wallets FOR UPDATE` |
| lot remaining マイナス | lot 行 `FOR UPDATE` + `WHERE coins_remaining >= take` |
| extension_unlock 重複 | `completed_extension_blocks` 差分 + §3.4 ガード |
| 部分失敗 orphan tip | 単一 TX — 例外時全 ROLLBACK |
| 二重 idempotency_key | unique index + 早期 return |

---

## 5. Idempotency

- Edge: `idempotency_key` body または `crypto.randomUUID()` 自動生成
- RPC: 既存 `tips.idempotency_key` 一致 → `{ duplicate: true }` · wallet/lot 再更新なし
- `p_tip_id` 指定時も同様

---

## 6. Grant guard (DEV-03)

ENGINE §3.4:

```text
allow =
  (adjusted_gauge_pct >= 100 AND paid_extension_coins >= 500)
  OR (paid_extension_coins >= 500 AND effective_ccu >= 5)
```

- `pending_blocks = floor(paid/500) - completed_extension_blocks`
- **`pending_blocks > 0 AND allow`** のときのみ grant
- 未達時: `paid_extension_coins` は蓄積 · `stream_events.extension_unlock` なし

**TODO-05 参照:** Rank 月 cap（`score_ma30 < 500` → extension cap 4）は **未実装**（本件スコープ外）。

---

## 7. review_required / fraud (TODO-03)

| 条件 | tips | revenue_ledger | gauge | score_event |
| --- | --- | --- | --- | --- |
| 通常 | ✓ | ✓ | extension のみ | ✓ |
| self_gift (review) | ✓ | ✗ | ✗ | ✗ |
| bot / fraud_excluded | ✓ | ✗ | ✗ | ✗ |

---

## 8. Edge 変更

**`tlv-create-tip/index.ts`:** `idempotency_key` 受付 · RPC 経由

**`tlv-create-tip.ts`:** `assessFraud` · `extensionGrantAllowed`（テスト用 export）· `createTip` → `client.rpc('create_tip')`

**削除:** TS 側 wallet/lot/gauge/ledger 逐次更新（二重化なし）

---

## 9. テスト結果

```text
node scripts/test-tlv-payment-logic.mjs  → PASS（FIFO · WR · §3.4 · fraud/review ポリシー）
node scripts/test-tlv-payment-edge.mjs   → PASS/SKIP（404 = Edge 未デプロイ · 記録済）
```

### 9.1 logic テスト（実装済）

- FIFO / WR / extension welcome skip
- self_gift → review_required · no revenue
- bot → no gauge / no revenue
- §3.4 grant allow/deny 境界
- uuid wallet JOIN 方針

### 9.2 統合テスト（要 migration + deploy）

| ID | シナリオ | 状態 |
| --- | --- | --- |
| T-TIP-01 | 通常 tip 全テーブル | 要 Supabase local |
| T-TIP-02 | 残高不足 ROLLBACK | 要 DB |
| T-TIP-03 | lot 不足 ROLLBACK | 要 DB |
| T-TIP-04 | 二重 idempotency_key | 要 DB |
| T-TIP-05 | 同時 tip Promise.all | 要 DB |
| T-TIP-06 | review_required | 要 DB |
| T-TIP-07 | fraud/bot gauge 除外 | 要 DB |
| T-TIP-08 | §3.4 grant guard | 要 DB |

---

## 10. Go / No-Go

| 環境 | 判断 | 条件 |
| --- | --- | --- |
| **staging** | **Go** | migration `20260628140000` 適用 · Edge デプロイ |
| **production** | **No-Go** | RLS 未整備 · chargeback 未解消 · DB 統合テスト未完了 |

---

## 11. 未解消 / TODO候補

| ID | 内容 |
| --- | --- |
| TODO-05 | Rank 月 extension cap |
| TODO-06 / TODO-07 | 本件スコープ外（未着手） |
| CAND-W2 | Platform text ID 統一 |
| DEV-07 | self_gift text のみ比較 |
| DEV-05 | extension_contributors 完全仕様（RPC は first-payer カウントのみ） |

---

## 12. 参照

- `supabase/migrations/20260628140000_tlv_create_tip_rpc.sql`
- `supabase/functions/_shared/tlv-create-tip.ts`
- `docs/TLV_PAYMENT_ENGINE.md` v1.5
- `docs/TLV_DB_SCHEMA.md` v1.2.5
