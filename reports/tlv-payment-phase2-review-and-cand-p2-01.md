# TLV Payment Engine Phase 2 — 実装レビュー & CAND-P2-01 調査

**日付:** 2026-06-28  
**Reviewer:** Cursor Agent（readonly）  
**正本:** `docs/TLV_PAYMENT_ENGINE.md` v1.4 · `docs/TLV_DB_SCHEMA.md` v1.2.4 · `docs/TLV_PRD.md` · `db/tlv_schema.sql`

**テスト実行:**

| スクリプト | 結果 |
| --- | --- |
| `node scripts/test-tlv-payment-logic.mjs` | **PASS**（9/9） |
| `node scripts/test-tlv-payment-edge.mjs` | **FAIL** — Edge Functions 未デプロイ（404 NOT_FOUND）· E2E 不可 |

---

## 1. 総合判定

| 領域 | 判定 | コメント |
| --- | --- | --- |
| createCoinPurchase | **PASS**（軽微注意） | 設計どおり PI のみ |
| handlePaymentWebhook | **PASS** | RPC 単一 TX · 冪等 OK |
| createTip | **PARTIAL** | コアフローは仕様方向一致 · **TX 非原子 · 延長 grant ガード未実装 · エラー処理不足** |
| DB 責務分離 | **PASS** | 正本レイヤは維持 |
| CAND-P2-01 RPC 化 | **Go** | 本番 staging 前に実装推奨 |

**本番 Go/No-Go:** **No-Go（staging 可）** — createTip の単一 TX RPC 化 + 下記 Medium 修正後に本番 Go。

---

## 2. 作業1 — Phase 2 実装レビュー

### 2.1 createCoinPurchase

| 確認项 | 結果 | 根拠 |
| --- | --- | --- |
| Stripe PaymentIntent のみ | ✅ | `createStripeCoinPurchase` — PI create + quote 返却のみ |
| wallet / coin_lots / ledger 直接更新なし | ✅ | DB write なし（`getActiveFeeConfig` 読取のみ） |
| PRICING SKU 一致 | ⚠️ 概ね OK | 下表 |

**SKU 検算（`tlv-coin-packs.ts` + `computePurchaseQuote`）:**

| SKU | PRICING 参照 | 実装 gross | 差分 |
| --- | --- | --- | --- |
| `web_coin_500` | ¥550 | 550 | OK |
| `web_coin_500` fee | ≈¥20 / net≈530 | fee=19, net=531 | OK（ENGINE §1.4 floor 統一） |
| `app_coin_500` | ¥786 | 786 | OK |
| `app_coin_1000` | ¥1,572 | 1,571 | **±¥1**（unitPrice 近似） |
| `app_coin_10000` | ¥15,715 | 15,719 | **±¥4** |

**軽微注意:** Webhook 側は PI metadata の gross/fee/net/coins を **再検証せず** RPC に渡す。createCoinPurchase 経由なら一致するが、metadata 改ざん耐性はない（staging 後 hardening 候補）。

---

### 2.2 handlePaymentWebhook

| 確認项 | 結果 | 根拠 |
| --- | --- | --- |
| `payment_provider_events` 冪等 | ✅ | RPC 先頭 `FOR UPDATE` + `status=processed` early return |
| processed guard | ✅ | 二重 event · 二重 PI succeeded とも no-op |
| 成功時のみ副作用 | ✅ | `payment_intent.succeeded` → RPC のみ |
| failed/canceled | ✅ | `record_payment_provider_event_terminal` · coin 付与なし |
| 二重 webhook 二重 credit なし | ✅ | RPC 内 wallet + lot + ledger 1回 |

**更新テーブル（成功 RPC）:**

| テーブル | 更新 | 備考 |
| --- | --- | --- |
| `payment_provider_events` | ✅ | |
| `payments` | ✅ | INSERT on success |
| `viewer_wallets` | ✅ | credit |
| `coin_lots` | ✅ | |
| `wallet_ledger` | ✅ | purchase_credit |
| `revenue_ledger` | **更新なし** | **正しい** — 購入 JPY 正本は `payments` · tip 時に `revenue_ledger` |

**注意:** レビュー観点の「webhook で revenue_ledger 更新」は **coin 購入フローでは不要**。設計どおり。

**軽微:** `recordTerminalProviderEvent` の TS fallback は RPC 未適用時用。本番は migration 必須。

---

### 2.3 createTip

| 確認项 | 結果 | 根拠 |
| --- | --- | --- |
| viewer_wallets 減算 | ✅ | L194–205 · optimistic `eq(coin_balance)` |
| wallet_ledger tip_debit | ✅ | L207–216 |
| coin_lots FIFO | ✅ | `allocateLotsFifo` + 残高減算 |
| tip_coin_lot_allocations | ✅ | L168–177 |
| WR origin スナップショット | ✅ | `tips.web_origin_*` / `wr_at_tip` |
| revenue_ledger JPY | ⚠️ | INSERT するが **error 未チェック**（L224–237） |
| review_required → ledger なし | ✅ | `shouldPostLedger` — self_gift_flag のみ |
| fraud_excluded / bot → gauge なし | ✅ | `shouldApplyGauge` |
| 500coin → extension_unlock | ⚠️ | イベントは出るが **§3.4 grant ガード未実装** |
| stream_events 非 JPY | ✅ | payload `{}` or `{kind, block_number, tip_id}` |
| creator_score_events INSERT のみ | ✅ | delta=0 · 再計算なし |

#### 設計逸脱（要修正 · 実装前に差分案提示）

| ID | 深刻度 | 内容 | 仕様根拠 |
| --- | --- | --- | --- |
| **DEV-01** | **High** | 逐次 TX — tip/lot 更新後に wallet 失敗で不整合 | ENGINE §0 1操作=1TX |
| **DEV-02** | **High** | `SELECT FOR UPDATE` なし — 同時 tip で残高/lot 競合 | FIFO + optimistic lock だけでは不足 |
| **DEV-03** | **Medium** | §3.4 grant ガード未実装 — 500coin 到達即 `extension_unlock` | ENGINE §3.4 · PRD §4 |
| **DEV-04** | **Medium** | `revenue_ledger` / `creator_score_events` / gauge / stream_events の **error 未チェック** | サイレント欠落 |
| **DEV-05** | **Low** | `extension_contributors` 未更新 | ENGINE §3.2 |
| **DEV-06** | **Low** | `review_required` が tips 列に無い（API 返却 + ledger metadata のみ） | TODO-03 運用追跡性 |
| **DEV-07** | **Low** | self_gift 判定が text `payer_user_id` のみ（uuid 不一致取りこぼし可） | CAND-W1 後も残る edge |

#### createTip 処理順（現状 — 問題箇所）

```text
1. stream/creator 読取
2. wallet 読取（FOR UPDATE なし）
3. lots 読取（FOR UPDATE なし）
4. tips INSERT          ← ここで確定
5. allocations INSERT
6. coin_lots UPDATE     ← lot 減算
7. viewer_wallets UPDATE ← 失敗時 4–6 が孤立
8. wallet_ledger INSERT
9. revenue_ledger / score_events（error 無視可）
10. gauge / stream_events
```

#### review_required / fraud 動作（TODO-03 準拠）

| ケース | tips | wallet debit | revenue_ledger | gauge |
| --- | --- | --- | --- | --- |
| 正常 | ✅ | ✅ | ✅ | extension のみ |
| self_gift_flag（review） | ✅ `self_gift_flag=true` | ✅ | **なし** ✅ | **なし** ✅ |
| bot_suspect | ✅ `fraud_excluded=true` | ✅ | **なし** ✅ | **なし** ✅ |

bot/疑義 tip でも **coin は消費される** — TODO-03 推奨どおり ledger 保留。UX/返金ポリシーは Ops 範囲（変更しない）。

---

### 2.4 DB 責務分離

| レイヤ | 正本 | Phase 2 実装 |
| --- | --- | --- |
| JPY | `payments` + `revenue_ledger` | ✅ 購入=payments · tip=revenue_ledger |
| coin 残高 | `viewer_wallets` | ✅ |
| coin 監査 | `wallet_ledger` | ✅ |
| WR origin | `coin_lots` + `tip_coin_lot_allocations` | ✅ |
| UX | `stream_events` | ✅ JPY なし |
| Score trace | `creator_score_events` | ✅ INSERT のみ |

**二重正本なし:** `payer_user_uuid` = wallet JOIN 正本 · text `payer_user_id` は互換のみ（v1.2.4）。

---

## 3. 作業2 — CAND-P2-01 調査（createTip 単一 TX RPC）

### 3.1 中途半端状態は起きるか — **Yes**

| 失敗点 | 残存状態 |
| --- | --- |
| allocations 後 wallet UPDATE 失敗 | tip + lot 減算済 · wallet 未減 |
| wallet_ledger 失敗 | wallet 減済 · ledger 欠落 |
| revenue_ledger 失敗（現状） | coin 消費済 · PL 行なし（error 未検知） |
| gauge 失敗 | coin 消費 · PL あり · ゲージ未反映 |

**結論:** 本番前に **単一 TX 必須**。

### 3.2 同時 tip の race — **Yes**

- wallet: 読取→チェック→更新の間に別 tip が割込可
- coin_lots: optimistic `eq(coins_remaining)` で **1 loser は 500** になるが、winner/loser 混在で FIFO 整合が崩れる可能性
- gauge: `paid_extension_coins` 読取→加算が非ロック — **double unlock / block 数ずれ**

**結論:** `viewer_wallets` + `gauge_state` + 対象 `coin_lots` を **`SELECT … FOR UPDATE`**。

### 3.3 PostgreSQL RPC で原子化可能か — **Yes**

| 項目 | 可否 |
| --- | --- |
| 単一 plpgsql 関数内 TX | ✅ デフォルト |
| wallet / lots row lock | ✅ `FOR UPDATE` |
| allocations + ledger + revenue + events 同一 TX | ✅ 同一 schema |
| review_required で ledger スキップ | ✅ `IF NOT v_review_required THEN INSERT revenue_ledger` |
| §3.4 grant ガード | ✅ RPC 内 `IF allow THEN grant` |
| extension_unlock 重複防止 | ✅ gauge `completed_extension_blocks` を lock 下で increment · `newBlocks` 1回計算 |

### 3.4 推奨 RPC シグネチャ（設計案のみ · 未実装）

```sql
-- 設計案 · 未適用
create or replace function tlv.create_tip(
  p_stream_id uuid,
  p_creator_id uuid,
  p_payer_user_uuid uuid,
  p_payer_user_id text,
  p_coins integer,
  p_tip_kind tlv.tip_kind,
  p_message text default null,
  p_device_id text default null,
  p_bot_score numeric default 0
) returns jsonb ...
```

**TS 側:** 入力検証 + fraud プリチェック → RPC 1 call → 結果 JSON。

**FIFO ロジック:** TS `allocateLotsFifo` を SQL に移植するか、RPC 内 cursor loop（ENGINE §2.6 式を踏襲）。

### 3.5 CAND-P2-01 判断

| 判断 | **Go** |
| --- | --- |
| タイミング | **本番デプロイ前 · staging 投入前** |
| 理由 | 不整合/race が実ユーザー残高・延長ブロックに直結 |
| スコープ | `tlv.create_tip` RPC + TS thin wrapper · テスト追加 |
| 非スコープ | Score 再計算 · RLS · chargeback（TODO-06/07） |

---

## 4. 修正案（実装前差分案 · 今回は未適用）

### 4.1 必須（CAND-P2-01 · Go）

1. `supabase/migrations/YYYYMMDD_tlv_create_tip_rpc.sql` — `tlv.create_tip`
2. `tlv-create-tip.ts` — RPC 呼出に置換 · 逐次 INSERT 削除
3. テスト: 同時 tip · partial mock failure · review_required · 500 unlock

### 4.2 Medium（RPC と同時 or 直後）

| ID | 修正 |
| --- | --- |
| DEV-03 | RPC 内 §3.4 guard — 未達時は `paid_extension_coins` のみ加算 · unlock なし |
| DEV-04 | 全 INSERT に error handling（RPC なら RAISE） |

### 4.3 Low（別 PR 可）

| ID | 修正 |
| --- | --- |
| DEV-05 | `extension_contributors` increment |
| DEV-06 | `tips.metadata_json` or bool `review_required` 列（要 ADR · DB 変更はユーザー承認後） |
| DEV-07 | self_gift: `payer_user_uuid` vs creator mapping 強化 |

### 4.4 Webhook hardening（Optional）

- Webhook 成功時に sku_id + fee_config から gross/fee/net/coins **再計算**し metadata と照合

---

## 5. 追加テスト案

| ID | 種別 | 内容 |
| --- | --- | --- |
| T-WH-DUP | integration | 同一 `provider_event_id` 2回 → coin_balance 不変 |
| T-TIP-RACE | integration | 同一 wallet 並列 tip 2本 → 合計 debit 一致 · 負残なし |
| T-TIP-REVIEW | integration | self_gift → tips 存在 · revenue_ledger 0 · gauge 不変 |
| T-TIP-UNLOCK | integration | extension 500 · gauge 未達 → paid 増 · unlock 0 |
| T-TIP-UNLOCK-OK | integration | 500 + gauge/CCU 条件達成 → unlock 1 |
| T-STREAM-NO-JPY | unit | stream_events payload に `*jpy*` キーなし |

**現状:** logic 9件 PASS · edge は deploy 後再実行。

---

## 6. 関連ファイル索引

```
supabase/functions/tlv-create-coin-purchase/index.ts
supabase/functions/tlv-payment-webhook/index.ts
supabase/functions/tlv-create-tip/index.ts
supabase/functions/_shared/tlv-create-tip.ts      ← レビュー重点
supabase/functions/_shared/tlv-payment-webhook.ts
supabase/migrations/20260628120000_tlv_payment_phase2_rpc.sql
scripts/test-tlv-payment-logic.mjs
scripts/test-tlv-payment-edge.mjs
```

---

## 7. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-06-28 | 初版 — Phase 2 レビュー + CAND-P2-01 Go |
