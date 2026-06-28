# TLV Payment / PL Engine — 実装仕様 v1.1

**版:** 1.6  
**最終更新:** 2026-06-28  
**種別:** 処理仕様（How）— **新制度追加なし**  
**正本:**

| ドキュメント | 役割 |
| --- | --- |
| [TLV_PRD.md](./TLV_PRD.md) v1.2.1 | 制度 · Score · Rank · Override |
| [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) | ER · 責務分離 |
| [`db/tlv_schema.sql`](../db/tlv_schema.sql) | DDL 正本 |
| [PRICING.md](./PRICING.md) | コイン · SKU · 手数料 |
| [FINANCIAL_MODEL.md](./FINANCIAL_MODEL.md) | PL · infra |

**固定前提（変更禁止）**

- `payments` + `revenue_ledger` = **金の正本**
- `creator_score_monthly` = **Rank / 還元の正本**
- `stream_events` = **UX / ゲージ / 演出**（金額正本ではない）
- Base Rank + Override 90/95% 二層 · **500 coin = 30 分**

---

## 0. アーキテクチャ概要

```text
┌─────────────┐     webhook      ┌──────────────┐
│ Stripe/IAP  │ ───────────────► │ payments     │ ◄── 金の正本（購入）
└─────────────┘                  └──────┬───────┘
                                      │ coins credit
                                      ▼
                               ┌──────────────┐
                               │viewer_wallets│ ◄── coin 残高正本
                               └──────┬───────┘
                                      │ spend
                                      ▼
┌──────────────┐   gauge    ┌──────────────┐   PL行   ┌─────────────────┐
│ stream_events│ ◄───────── │ tips         │ ───────► │ revenue_ledger  │
│ (UXのみ)     │            │ (+ fraud flg)│          │ (金の正本·分配)  │
└──────────────┘            └──────┬───────┘          └────────┬────────┘
                                   │                            │
                                   ▼                            ▼
                            ┌──────────────┐          ┌───────────────────┐
                            │ gauge_state  │          │ creator_score_*   │
                            │ (500/stock)  │          │ (events/monthly)  │
                            └──────────────┘          └───────────────────┘
                                                              │
                                                              ▼
                                                       ┌──────────────┐
                                                       │ payout_log   │
                                                       └──────────────┘
```

**トランザクション境界:** 各 Edge Function は **1 ビジネス操作 = 1 DB トランザクション**。跨ぎは Outbox / 再試行可能ジョブで接続。

---

## 1. Coin Purchase Flow

### 1.1 概要

Viewer がコインパックを Web（Stripe）または App（IAP）で購入し、`tlv.payments` に Gross/Fee/Net を記録 · ウォレット残高を増やす。

### 1.2 シーケンス

```text
Client                    Edge/API                  DB / Provider
  │ createCoinPurchase         │                          │
  ├──────────────────────────►│ fee_config 読取           │
  │                           │ Stripe PI / IAP order 作成 │
  │◄──────────────────────────┤ client_secret / sku      │
  │ 決済 UI                    │                          │
  │                           │◄──── webhook ─────────────│
  │                           │ handlePaymentWebhook      │
  │                           │  (idempotent)             │
  │                           ├─► payments INSERT         │
  │                           ├─► payment_provider_events │
  │                           ├─► coin_lots INSERT        │
  │                           ├─► viewer_wallets credit   │
  │                           ├─► wallet_ledger           │
  │◄── wallet sync ───────────┤                           │
```

### 1.3 `createCoinPurchase` 入力

| フィールド | 必須 | 説明 |
| --- | --- | --- |
| `payer_user_id` | ✓ | 互換 text（talk_user_id 等 · 監査用） |
| `payer_user_uuid` | ✓（自動） | **正本** — auth `user.id` · wallet JOIN 用 |
| `sku_id` | ✓ | PRICING.md §2（例: `web_coin_500`） |
| `channel` | ✓ | `web_stripe` / `ios_iap` / `android_iap` |
| `creator_id` | — | 深リンク経由の attribution（任意） |
| `idempotency_key` | ✓ | クライアント UUID |

### 1.4 金額計算（PRICING.md 準拠）

```typescript
const cfg = await getActiveFeeConfig(channel); // tlv.fee_config
const pack = COIN_PACKS[sku_id];              // アプリ定数 · PRICING 正本

const gross = roundJpy(pack.coins * pack.unit_price * cfg.price_multiplier);
const fee   = floor(gross * cfg.fee_rate);
const net   = gross - fee;                   // refund/chargeback 前

// 例 web_coin_500: gross=550, fee=floor(550*0.036)=19, net=531
// PRICING 参照値 net≈530 — 実装は integer 円で floor 統一 · FinOps 月次監視
```

**保存値（`payments`）:**

| カラム | 値 |
| --- | --- |
| `payment_kind` | `coin_purchase` |
| `gross_amount_jpy` | 上記 gross |
| `fee_amount_jpy` | fee |
| `net_amount_jpy` | net |
| `fee_rate_applied` | cfg.fee_rate |
| `coins_granted` | pack.coins + pack.bonus |
| `is_web_payment` | channel === `web_stripe` |
| `status` | `pending` → webhook で `succeeded` |

### 1.5 `handlePaymentWebhook` — 成功パス

**前提:** Stripe `payment_intent.succeeded` / IAP `verified purchase` 等。

```text
1. provider + provider_event_id で payment_provider_events 冪等チェック（§9）
   - status=processed なら 200 OK · 二重 coin / ledger なし
2. INSERT payment_provider_events (status=processing)
3. payments を stripe_payment_intent / external_ref で SELECT FOR UPDATE
4. payments.status が succeeded なら event を processed にして終了
5. 同一 TX 内:
   a. payments.status = succeeded · paid_at = now()
   b. viewer_wallets UPSERT · coin_balance += coins_granted · lifetime_purchased_coins += coins_granted
   c. coin_lots INSERT:
        wallet_id, user_id, payment_id, lot_source=channel, is_web_payment,
        gross/fee/net ← payments からコピー,
        coins_original = coins_remaining = coins_granted,
        expires_at = now()+180d（PRICING §1.1 · welcome 除く）
   d. wallet_ledger INSERT (entry_type=purchase_credit · coins_delta=+N · balance_after=wallet.coin_balance)
6. payment_provider_events.status = processed · processed_at = now()
7. commit
```

**FS_WR 注:** 購入時の `is_web_payment` は lot に保存するが、**FS_WR 集計は tip 消費時の lot origin**（§2.6）を正とする。購入時点の `creator_score_events` は発行しない。

### 1.6 失敗 · キャンセル

| イベント | `payments.status` | ウォレット |
| --- | --- | --- |
| PI 失敗 | `failed` | 変更なし |
| ユーザーキャンセル | `failed` | 変更なし |
| refund（Ops） | `refunded` | coins  clawback · `refund_amount_jpy` 更新 |
| chargeback | `disputed` | §8 · hold · 逆仕訳 |

**CHECK 維持:**

```text
net_amount_jpy = gross - fee - refund - chargeback
```

### 1.7 初回無料コイン

- `POST /api/tlv/wallet/grant-welcome` — **payments 行を作らない**（Platform マーケ費 · PRICING §3）
- `coin_lots` に `lot_source=welcome_grant` · `is_web_payment=false` · gross/fee/net=0
- `extension_allowed=false` · `expires_at=now()+30d`
- `viewer_wallets.coin_balance` 加算 · `coin_lots` welcome lot 作成
- `wallet_ledger` INSERT (`entry_type=adjustment_credit` · `reason_code=WELCOME_GRANT`)

---

## 1.8 Wallet / Ledger モデル（v1.2.3 · TODO-01 解消）

| テーブル | 責務 |
| --- | --- |
| `viewer_wallets` | **コイン残高正本**（`coin_balance` · `locked_coin_balance` · lifetime 集計） |
| `wallet_ledger` | コイン増減監査（**INSERT-only** · JPY 正本ではない） |
| `coin_lots` | 購入ロット · WR origin · FIFO 消費（残高正本ではない） |

### 1.8.1 `viewer_wallets`

| カラム | 説明 |
| --- | --- |
| `id` | PK · `wallet_ledger.wallet_id` 参照先 |
| `user_id` | Platform UUID · UNIQUE · 1 user = 1 wallet |
| `coin_balance` | 総残高（spend 可否: `coin_balance - locked_coin_balance`） |
| `locked_coin_balance` | 保留中 coin（chargeback 調査等） |
| `lifetime_purchased_coins` / `lifetime_spent_coins` | 監査用累計 |
| `status` | `active` / `frozen` / `closed` |

**不変条件（アプリ層 · 同一 TX）:**

```text
available = coin_balance - locked_coin_balance
wallet_ledger 最新行.balance_after = viewer_wallets.coin_balance
```

### 1.8.2 `wallet_ledger`

| entry_type | coins_delta | 用途 |
| --- | --- | --- |
| `purchase_credit` | + | Webhook 成功 · coin 購入 |
| `tip_debit` | − | tip 消費 |
| `refund_credit` | + | 返金で coin 復帰 |
| `chargeback_debit` | − | チャージバック clawback |
| `adjustment_credit` / `adjustment_debit` | ± | **Ops 理由必須**（`reason_code` NOT NULL） |
| `lock` / `unlock` | 0（coin_balance 不変） | `locked_coin_balance` 増減 · metadata に詳細 |

**ポリシー:** UPDATE / DELETE **禁止**（RLS · アプリ層 · §9.2）。JPY 金額は `payments` / `revenue_ledger` を参照。

**lot 作成タイミング:** Webhook 成功 · welcome grant · refund clawback

**FIFO 消費順:** `expires_at ASC NULLS LAST` → `created_at ASC`

---

## 2. Tip Flow

### 2.1 概要

Viewer が保有コインを消費して `tlv.tips` を作成。不正判定後、**有効 tip のみ** `revenue_ledger` / PPC / ES 対象。

### 2.2 `createTip` シーケンス（v1.5 — 単一 TX RPC）

**実装:** Edge `tlv-create-tip` → PostgreSQL **`tlv.create_tip_transaction`**（`20260628140000_tlv_create_tip_transaction_rpc.sql`）

Edge（TS）責務: JWT · 入力検証 · fraud プリチェック · `idempotency_key` · RPC 呼出 · レスポンス整形。

RPC（単一 TX）責務: wallet `FOR UPDATE` · FIFO lot 消費 · tips / allocations / wallet_ledger · 条件付き revenue_ledger · gauge + **§3.4 grant ガード** · creator_score_events · stream_events。

```text
Edge                          RPC tlv.create_tip_transaction (1 TX)
  │ auth uuid → p_payer_user_uuid
  │ talk id  → p_payer_user_id (audit only)
  ├──────────────────────────► idempotency_key / tip_id duplicate → no-op
  │                            wallet FOR UPDATE (uuid only)
  │                            coin_lots FOR UPDATE FIFO
  │                            tips + tip_coin_lot_allocations
  │                            wallet debit + wallet_ledger
  │                            revenue_ledger (if NOT review_required/fraud/bot)
  │                            gauge + §3.4 grant guard (extension only)
  │                            creator_score_events + stream_events
  ◄──────────────────────────┤ jsonb result
```

**解消（v1.5）:** DEV-01 非原子性 · DEV-02 同時 tip race · DEV-03 §3.4 grant ガード · DEV-04 INSERT error 未検知。

```text
（legacy TS 逐次 — 参照のみ）
1. 入力検証（coins 1..10000 · 日次 cap 100000/user/creator · PRICING §5.1）
2. stream.status = live 確認
3. welcome coin · 無料 coin · 延長+無料 の組合せ禁止（延長は有償のみ）
4. viewer_wallets SELECT FOR UPDATE · status=active
   · (coin_balance - locked_coin_balance) >= coins_amount
5. coin_lots FIFO 消費計画（§2.6）— extension は extension_allowed=false lot をスキップ
6. fraud プリチェック（§2.3）→ self_gift_flag / bot_suspect_flag
7. tips INSERT + origin スナップショット列
8. tip_coin_lot_allocations INSERT（lot 混在時は按分）
9. coin_lots.coins_remaining 減算
   · viewer_wallets.coin_balance -= coins_amount
   · lifetime_spent_coins += coins_amount（同一 TX）
10. wallet_ledger INSERT (entry_type=tip_debit · coins_delta=-N · balance_after=wallet.coin_balance)
11. tips の gross/net 設定（§2.4）
12. if NOT fraud_excluded:
       revenue_ledger 1行 INSERT（event_kind = gift | extension）
       creator_score_events 発行
13. if tip_kind = extension:
       applyTipToGauge（§3）— 同一 TX または直列ジョブ
14. stream_events INSERT（cheer_display / extension_coin — 金額なし）
15. commit
（以上は RPC 内で自動 commit）
```

### 2.2.1 `tlv.create_tip_transaction` RPC 入出力

| 入力 | 型 | 備考 |
| --- | --- | --- |
| `p_stream_id` | uuid | live 必須 |
| `p_creator_id` | uuid | streams.creator_id と一致 |
| `p_payer_user_uuid` | uuid | **wallet 正本** |
| `p_payer_user_id` | text | 監査 · stream_events のみ |
| `p_tip_kind` | tip_kind | gift / extension / cheer |
| `p_coin_amount` | int | 1..10000 |
| `p_idempotency_key` | text | 重複時 no-op |
| `p_self_gift_flag` / `p_fraud_excluded` / `p_bot_flag` | bool | Edge プリチェック |

| 出力 | 備考 |
| --- | --- |
| `tip_id` | tips PK |
| `wallet_balance_after` | viewer_wallets.coin_balance |
| `gauge_total_after` | paid_extension_coins |
| `extension_unlocked` | §3.4 通過後 grant したか |
| `review_required` | self_gift 疑義 |

### 2.3 不正判定（INSERT 時 · ADMIN_SYSTEM / TLV_PRD §7）

| ルール | 条件 | フラグ |
| --- | --- | --- |
| SG-01 | payer.kyc_id == creator.kyc_id | `self_gift_flag=true` |
| SG-02 | payer device == creator 登録 device | `self_gift_flag=true` |
| SG-03 | 新規 account 7日 · 単一 Creator ≥¥50k | `self_gift_flag=true` + Ops queue |
| BOT | bot_score >= 0.7 | `bot_suspect_flag=true` |

**確定時（Ops / 自動）:**

```text
fraud_excluded = self_gift_confirmed OR bot_suspect_flag
```

| 区分 | UX（視聴者） | 会計 |
| --- | --- | --- |
| 有効 tip | ギフト演出 · ゲージ反映 · ランキング表示 | `revenue_ledger` 計上 · PPC/ES 対象 |
| `fraud_excluded=true` | **演出は表示可**（UX 要件次第で匿名化） | **ledger 除外** · PPC 除外 · 還元対象外 |
| 疑義（未確定） | 通常表示 | ledger 計上 **保留**（`payout_hold` 連動可） |

**TODO:** 疑義中 tip の ledger 計上タイミング（即時計上 vs 保留）— Ops ポリシー確定待ち。v1 推奨: **疑義は ledger 保留行なし · tip のみ存在 · FinOps 確定後に ledger POST**。

### 2.4 Tip 金額（ウォレット消費 · payment_id NULL）

購入時に手数料は既に `payments` で計上済み。tip 消費時の PL 入力:

```text
tips.gross_amount_jpy = coins_amount * 100   // ¥1/coin 名目（PRICING §1.1）
tips.fee_amount_jpy   = 0                    // tips 行には fee 列なし · ledger で 0
tips.net_amount_jpy   = coins_amount * 100   // 還元・PPC 按分基準
```

**直接決済 tip（将来）:** `payment_id` 必須 · gross/fee/net は `payments` からコピー。

### 2.5 `tip_kind` マッピング

| tip_kind | revenue_ledger.event_kind | gauge 加算 |
| --- | --- | --- |
| `gift` | `gift` | いいえ（gauge_pct の paid/5 のみ） |
| `extension` | `extension` | **はい** · `paid_extension_coins` |
| `cheer` | `gift` | いいえ（cheer_count のみ） |

### 2.6 WR origin 追跡（Phase 1.2.2 · TODO-04 解消）

**原則:** FS_WR の Web 比率は **購入時ではなく tip 消費時** に消費した `coin_lots` の origin を正とする。

**FIFO 消費 + 按分:**

```typescript
function allocateLotsForTip(userId: string, coinsNeeded: number, tipKind: TipKind): Allocation[] {
  const lots = await selectLotsForUpdate(userId, { fifo: true, skipNonExtension: tipKind === 'extension' });
  // extension: extension_allowed=false（welcome）をスキップ
  let remaining = coinsNeeded;
  const allocs: Allocation[] = [];
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.coins_remaining, remaining);
    const netAlloc = floor(lot.net_amount_jpy * take / lot.coins_original);
    const grossAlloc = floor(lot.gross_amount_jpy * take / lot.coins_original);
    allocs.push({
      coin_lot_id: lot.id,
      coins_allocated: take,
      net_allocated_jpy: netAlloc,
      gross_allocated_jpy: grossAlloc,
      is_web_origin: lot.is_web_payment,
      lot_source: lot.lot_source,
    });
    remaining -= take;
  }
  if (remaining > 0) throw insufficientBalance();
  return allocs;
}
```

**tips スナップショット（tip 確定時 denormalize）:**

| カラム | 意味 |
| --- | --- |
| `web_origin_coins` / `app_origin_coins` | lot 由来 coin 数 |
| `web_origin_net_jpy` / `app_origin_net_jpy` | lot 按分 Net（welcome は 0） |
| `wr_at_tip` | `web_origin_net / max(web+app net, 1)` |

**Creator FS_WR 集計（rolling 30d · fraud_excluded 除外）:**

```text
WR_30d(C) = Σ tips.web_origin_net_jpy
          / max(Σ (tips.web_origin_net_jpy + tips.app_origin_net_jpy), 1)
          WHERE attributed creator = C AND NOT fraud_excluded
```

`tip_coin_lot_allocations` が行単位の監査正本 · `tips.*_origin_*` は集計用キャッシュ。

---

## 3. Gauge Contribution Flow

### 3.1 DB カラム（正本名称）

指示の `current_coins` は **`tlv.gauge_state.paid_extension_coins`** に対応（DB 正本名称を使用）。

### 3.2 `applyTipToGauge`

**前提:** `tip_kind = 'extension'` · `fraud_excluded = false`

```typescript
async function applyTipToGauge(tip: Tip, tx: DbTx) {
  const g = await tx.gauge_state.findForUpdate(tip.stream_id);

  // 有効 tip のみ加算
  g.paid_extension_coins += tip.coins_amount;

  // ブロック計算（PRD §4.3）
  const unit = g.extension_unit_coins; // 500 · CHECK 固定
  const totalBlocks = Math.floor(g.paid_extension_coins / unit);
  const newBlocks = totalBlocks - g.completed_extension_blocks;

  g.extension_stock_coins = g.paid_extension_coins - totalBlocks * unit;
  g.next_block_cost_coins = Math.max(0, unit - g.extension_stock_coins);

  // extension_contributors（ES 用 · 同一 payer は 1 回のみ）
  if (!await hasContributed(tx, tip.stream_id, tip.payer_user_id)) {
    g.extension_contributors += 1;
  }

  // gauge_pct 再計算（PRD §4.2 · PRICING §4.3）
  g.gauge_pct = computeGaugePct(g);
  g.adjusted_gauge_pct = g.gauge_pct / g.gauge_difficulty;

  await tx.gauge_state.update(g);

  // 500 到達ごとに grantExtension（複数ブロック一括可）
  for (let i = 0; i < newBlocks; i++) {
    await grantExtension(tip.stream_id, tx);
  }
}
```

### 3.3 端数 · 複数 Viewer 合算

| 例 | paid_extension_coins | completed_blocks | stock | next_block |
| --- | --- | --- | --- | --- |
| A が 300 | 300 | 0 | 300 | 200 |
| B が 200 | 500 | 1 → grant | 0 | 500 |
| C が 750 | 1250 | 2 → grant×2 | 250 | 250 |

**端数:** コイン整数のみ · 小数なし · `floor(paid/500)` でブロック決定。

### 3.4 延長解放条件（grant 前ガード）

```text
allow =
  (adjusted_gauge_pct >= 100 AND paid_extension_coins >= 500)
  OR (paid_extension_coins >= 500 AND effective_ccu >= 5)
```

未達時: coins は `paid_extension_coins` に蓄積 · **grantExtension は呼ばない** · UI「あと N コイン / 条件未達」。

**Rank ゲート:** Creator `score_ma30 < 500` → 月 `extension_blocks_completed` cap 4（`creators.extension_month_count`）。

---

## 4. Extension Grant Flow

### 4.1 `extensions` テーブルについて

**現行 DDL に `tlv.extensions` は存在しない。** 延長記録は以下で表現する（制度変更なし）:

| 役割 | 保存先 |
| --- | --- |
| 延長回数 | `streams.extension_blocks_completed` |
| フェーズ | `streams.phase = 'extension_30'` |
| 終了予定 | `gauge_state.free_phase_ends_at`（現セグメント終了） |
| 会計 | `revenue_ledger`（tip 行と連動済） |
| UX ログ | `stream_events.event_kind = 'extension_unlock'` |

**TODO（差分案 · §12）:** 監査強化用 `tlv.stream_extension_grants` 追加を検討。v1 は上記で足りる。

### 4.2 `grantExtension`

```typescript
async function grantExtension(streamId: string, tx: DbTx) {
  const stream = await tx.streams.findForUpdate(streamId);
  const gauge  = await tx.gauge_state.findForUpdate(streamId);

  // Profit First（PF-04 · FINANCIAL_MODEL §4.2）
  assertExtensionPLPositive(stream, gauge); // 赤字なら grant 拒否 · Ops アラート

  const now = new Date();
  const segmentEnd = gauge.free_phase_ends_at ?? now;
  const newEnd = addMinutes(max(now, segmentEnd), 30);

  stream.extension_blocks_completed += 1;
  stream.phase = 'extension_30';
  gauge.completed_extension_blocks += 1;
  gauge.gauge_phase = 'extended';
  gauge.free_phase_ends_at = newEnd;
  gauge.threshold_met_at = now;

  // stock 再計算（overkill 移動）
  const unit = 500;
  gauge.extension_stock_coins =
    gauge.paid_extension_coins - gauge.completed_extension_blocks * unit;
  gauge.next_block_cost_coins = Math.max(0, unit - gauge.extension_stock_coins);

  // gauge リセット（次ブロック向け · gauge_pct のみ · paid_coins は維持）
  gauge.gauge_pct = computeGaugePct(gauge);
  gauge.adjusted_gauge_pct = gauge.gauge_pct / gauge.gauge_difficulty;
  gauge.gauge_phase = 'accumulating';

  await tx.streams.update(stream);
  await tx.gauge_state.update(gauge);

  // UX ログ（金額なし）
  await tx.stream_events.insert({
    stream_id: streamId,
    event_kind: 'extension_unlock',
    payload_json: {
      block_number: stream.extension_blocks_completed,
      phase_ends_at: newEnd.toISOString(),
      stock_coins: gauge.extension_stock_coins,
      next_block_cost: gauge.next_block_cost_coins,
    },
  });

  // Score イベント（§7）
  await emitScoreEvent(stream.creator_id, 'ES', 0, 'EXTENSION_GRANTED', { streamId });

  // WebSocket（§4.3）
  await publishWs(streamId, buildExtensionGrantedPayload(stream, gauge));
}
```

### 4.3 WebSocket payload 案

```json
{
  "type": "EXTENSION_GRANTED",
  "stream_id": "uuid",
  "block_number": 2,
  "phase_ends_at": "2026-06-28T15:30:00+09:00",
  "extension_stock_coins": 250,
  "next_block_cost_coins": 250,
  "paid_extension_coins": 1250,
  "gauge_pct": 42.5,
  "adjusted_gauge_pct": 40.0
}
```

**禁止:** payload に `creator_payout_jpy` 等の PL 金額を含めない（クライアント表示は coins のみ）。

---

## 5. Revenue Ledger Flow

### 5.1 原則

- **1 tip（有効）= 1 ledger 行**（`event_kind = gift | extension`）
- **infra** = セッション終了時または定期 tick で `infra_allocation` 行
- **platform_revenue_jpy = net - creator_payout - infra_cost**（DB CHECK enforced）

### 5.2 `calculateStreamRevenueLedger` — tip 行 POST（createTip 内）

```typescript
function postTipLedger(tip: Tip, creator: Creator, stream: Stream) {
  if (tip.fraud_excluded) return null;

  const baseRate = creator.base_payout_rate; // Rank Base · リアルタイム preview
  // 月次還元正本は creator_score_monthly.effective_rate · ここでは preview 按分
  const effectiveRate = creator.effective_rate_preview ?? baseRate;

  const net = tip.net_amount_jpy;
  const creatorPayout = Math.floor(net * effectiveRate);
  const infra = 0; // tip 行時点では 0 · infra は別行
  const platform = net - creatorPayout - infra;

  return {
    stream_id: tip.stream_id,
    creator_id: tip.creator_id,
    tip_id: tip.id,
    event_kind: tip.tip_kind === 'extension' ? 'extension' : 'gift',
    ledger_month: toLedgerMonth(nowJst()),
    gross_amount_jpy: tip.gross_amount_jpy,
    fee_amount_jpy: 0,
    net_amount_jpy: net,
    infra_cost_jpy: infra,
    creator_payout_jpy: creatorPayout,
    platform_revenue_jpy: platform,
    base_rate: baseRate,
    effective_rate: effectiveRate,
    self_gift_excluded: false,
  };
}
```

### 5.3 Infra 按分（セッション · FINANCIAL_MODEL §3）

```text
PerViewer30 = ¥2.00
InfraExt30  = effective_ccu * 2.00
SessionFixed = ¥2.00（無料枠で Platform 負担済の場合 extension のみ CCU 変動）
```

**`infra_allocation` 行（stream 終了 or 30分境界）:**

```typescript
{
  event_kind: 'infra_allocation',
  gross: 0, fee: 0,
  net: 0,
  infra_cost_jpy: computedInfra,
  creator_payout_jpy: 0,
  platform_revenue_jpy: -computedInfra,  // Platform コスト計上
}
```

**stream 集計キャッシュ更新:** `streams.infra_cost_jpy` · `streams.platform_profit_jpy` = SUM(ledger.platform_revenue).

### 5.4 再計算

- ledger 行は **INSERT only** が原則
- 修正は `event_kind = adjustment` の **逆仕訳行**（§9）
- `tip_id` / `payment_id` でトレース可能

### 5.5 stream_events 禁止事項

```text
❌ stream_events.payload_json に gross/net/payout を正本として保存
✅ tip_id のみ · UI 表示用 coins は tips.coins_amount 参照
```

---

## 6. Creator Payout Calculation

### 6.1 月次バッチ `createMonthlyPayout`

**トリガ:** 毎月 1 日 06:00 JST · 対象月 = 前月。

```text
1. creator_score_monthly を確定（locked_at 設定）— Rank/還元正本
2. 各 Creator:
   a. net_attributed_clean = SUM(revenue_ledger.net)
        WHERE creator_id AND ledger_month AND NOT self_gift_excluded
   b. infra_allocated = SUM(revenue_ledger.infra_cost)
   c. base_rate = RANK_BASE_RATE[rank_tier]  // monthly から
   d. override_tier → effective_rate（§6.2）
   e. creator_payout = floor(net_clean * effective_rate)
   f. PF-06 赤字ガード
3. payout_log INSERT
4. hold 判定（§6.3）
5. Stripe Connect transfer（hold 解除後）
```

### 6.2 二層還元（TLV_PRD §3.2 · §5.8）

```typescript
function resolveEffectiveRate(monthly: CreatorScoreMonthly): RateResult {
  const base = monthly.base_rate;
  let override = 0;
  let tier: OverrideTier = 'none';

  if (monthly.tier_95_pass) { override = 0.95; tier = 'tier_95'; }
  else if (monthly.tier_90_pass) { override = 0.90; tier = 'tier_90'; }

  let effective = Math.min(0.95, Math.max(base, override));
  effective = applyProfitFirstGuard(monthly, effective); // PF-06

  return { base, override, effective, override_tier: tier };
}
```

**tier_*_pass 条件:** TLV_PRD §5.8 表どおり（Diamond+ / Legend · Score_MA30 · WR · TS · PPC 等）。

### 6.3 Payout Hold（30 日 · TLV_PRD §7.4）

| 条件 | `payout_log.status` | `hold_until` |
| --- | --- | --- |
| 新規 Creator 初回 | `hold` | created_at + 30d |
| chargeback 発生 | `hold` | last_cb + 30d |
| self_gift 疑義 | `hold` | 解消まで |
| TS < 50 | `hold` | レビューまで |
| 通常 | `approved` → `paid` | D+7 |

### 6.4 Chargeback 逆仕訳 `handleChargeback`

```text
1. payments.chargeback_amount_jpy += cb_amount
2. payments.net_amount_jpy 再計算（CHECK 維持）
3. payments.status = disputed
4. revenue_ledger に adjustment 行:
     net = -cb_net_portion
     platform_revenue = -...
     notes = 'chargeback:{stripe_dispute_id}'
5. creator_score_events: TS -20 · reason CHARGEBACK_RECEIVED
6. creators.payout_hold = true · payout_hold_until = now+30d
7. 既存 payout_log が paid なら FinOps クラウドバック（別 adjustment · TODO 運用手順）
```

**原則:** `creator_score_monthly.locked_at IS NOT NULL` の月は **直接 UPDATE 禁止** · adjustment 行で修正。

---

## 7. Score Event Emission

Score **計算式の実装は Score サービス担当**。本 Engine は **イベント発行のみ**。

### 7.1 発行タイミング

| トリガ | axis | reason_code | source |
| --- | --- | --- | --- |
| payment succeeded (web) | FS | `PAYMENT_SUCCEEDED_WEB` | payments.id |
| payment succeeded (app) | FS | `PAYMENT_SUCCEEDED_APP` | payments.id |
| ledger posted（有効 tip） | FS | `REVENUE_LEDGER_POSTED` | revenue_ledger.id |
| extension grant | ES | `EXTENSION_GRANTED` | streams.id |
| extension tip（有効） | ES | `ES_EXTENSION_PARTICIPATION` | tips.id |
| chat/active 閾値 | ES | `ES_CHAT_THRESHOLD` | streams.id |
| fraud 確定 | TS | `SELF_GIFT_CONFIRMED` / `BOT_FRAUD_CONFIRMED` | tips.id |
| chargeback | TS | `CHARGEBACK_RECEIVED` | payments.id |
| DMCA | TS | `DMCA_STRIKE` | trust case id |

### 7.2 イベント行フォーマット

```typescript
await insertCreatorScoreEvent({
  creator_id,
  axis: 'FS',           // tlv.score_axis
  delta: 0,             // 実 delta は Score ワーカーが計算
  score_before: creator.total_live,
  score_after: creator.total_live, // ワーカー更新後に patch 可
  reason_code: 'REVENUE_LEDGER_POSTED',
  source_table: 'revenue_ledger',
  source_id: ledgerId,
  payload_json: { net_jpy, is_web, ppc_delta_hint: true },
});
```

### 7.3 FS_PPC / FS_WR 入力

- **PPC_30d** = SUM(`platform_revenue_jpy`) from `revenue_ledger` where `NOT self_gift_excluded` · rolling 30d
- **WR_30d** = SUM(net where is_web) / SUM(net) from `payments` succeeded + tip net（web 購入 lot 追跡 **TODO** §12）

Score ワーカーが `creator_score_daily` / `creators.fs_live` を更新。

---

## 8. API / Edge Function 一覧

| 関数 | 配置 | メソッド | 責務 | 状態 |
| --- | --- | --- | --- | --- |
| `tlv-create-coin-purchase` | `supabase/functions/tlv-create-coin-purchase/` | POST | PI 開始 · 見積もり | **Phase 2 実装済** |
| `tlv-payment-webhook` | `supabase/functions/tlv-payment-webhook/` | POST webhook | 購入確定 · 冪等 | **Phase 2 実装済** |
| `tlv-create-tip` | `supabase/functions/tlv-create-tip/` | POST | tip · lot · gauge | **Phase 2 実装済** |
| `tlv-e2e-simulate-payment` | `supabase/functions/tlv-e2e-simulate-payment/` | POST | E2E テスト用 | **Phase 2 実装済** |
| `applyTipToGauge` | `_shared/tlv-create-tip.ts` | internal | gauge 加算 | **Phase 2 実装済** |
| `grantExtension` | `_shared/tlv-create-tip.ts` | internal | 30分延長 · events | **Phase 2 実装済** |
| `createMonthlyPayout` | — | cron | 還元確定 | 未実装 |
| `handleChargeback` | `handle_payment_refund` / `handle_payment_dispute` | webhook | 逆仕訳 | **実装済（staging PASS）** |

**共有モジュール:** `supabase/functions/_shared/tlv-*.ts`  
**DB RPC:** `supabase/migrations/20260628120000_tlv_payment_phase2_rpc.sql`  
**レポート:** [reports/tlv-payment-engine-phase2.md](../reports/tlv-payment-engine-phase2.md)

**Phase 2 実装ノート:**

- **Viewer 正本:** 認証 `user.id` (uuid) → `payer_user_uuid` · `viewer_wallets.user_id`
- **`payer_user_id` text:** talk_user_id / 旧 ID 互換 · **wallet JOIN 禁止**（[TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) §5.1）
- `createCoinPurchase` — wallet **更新なし** · Stripe PI metadata に `payer_user_uuid` 保存
- `handlePaymentWebhook` — `tlv.handle_payment_webhook_success` RPC · 冪等
- `createTip` — 疑義 tip（`self_gift_flag`）は `review_required` · **revenue_ledger なし**（TODO-03）
- `createTip` — `bot_suspect` / `fraud_excluded` は gauge 加算なし
- Score 再計算ワーカーなし · `creator_score_events` INSERT のみ

| 旧名（仕様） | 実装名 |
| --- | --- |
| `createCoinPurchase` | `tlv-create-coin-purchase` |
| `handlePaymentWebhook` | `tlv-payment-webhook` |
| `createTip` | `tlv-create-tip` |

**認証:**

| API | 認証 |
| --- | --- |
| createCoinPurchase / createTip | Viewer JWT |
| handlePaymentWebhook / chargeback | Provider signature |
| 月次/cron | Service role · cron secret |

---

## 9. Idempotency / Audit

### 9.1 Webhook 冪等（Phase 1.2.2 · TODO-02 解消）

**正本:** `tlv.payment_provider_events` — `(provider, provider_event_id)` UNIQUE

| カラム | 用途 |
| --- | --- |
| `provider` | `stripe` / `apple_iap` / `google_iap` |
| `provider_event_id` | Stripe `event.id` · IAP transaction id |
| `event_type` | `payment_intent.succeeded` 等 |
| `status` | `received` → `processing` → `processed` / `failed` / `ignored` |
| `payload_hash` | SHA-256（再送検知 · 改ざん監査） |
| `payment_id` | 処理成功時に紐付け |

```typescript
async function handleWebhook(event: ProviderEvent) {
  const existing = await db.payment_provider_events.findUnique({
    provider: event.provider,
    provider_event_id: event.id,
  });
  if (existing?.status === 'processed') return 200;

  await db.transaction(async tx => {
    const row = await tx.payment_provider_events.upsertProcessing(event);
    // payments + coin_lots + wallet — §1.5
    await tx.payment_provider_events.markProcessed(row.id, { payment_id });
  });
  return 200;
}
```

**二重防止ガード（多層）:**

1. `payment_provider_events` UNIQUE — 同一 event id は 1 行
2. `payments.status=succeeded` — 既成功なら lot/wallet 加算スキップ
3. 全副作用は **単一 DB トランザクション**

**v1 補助:** `payments.stripe_payment_intent` partial UNIQUE は維持（lookup 用）。

### 9.2 監査原則

| 対象 | 原則 |
| --- | --- |
| `payments` | UPDATE は status/fee/refund/chargeback フィールドのみ |
| `revenue_ledger` | INSERT only · 修正は `adjustment` |
| `creator_score_monthly` | `locked_at` 後 UPDATE 禁止 |
| `payout_log` | `paid` 後 UPDATE 禁止 · 訂正は adjustment + Ops |
| `stream_events` | INSERT only |
| `wallet_ledger` | **INSERT only** · UPDATE/DELETE 禁止 · coin 監査のみ（JPY 正本ではない） |

### 9.3 再送 · 再計算

- Stripe webhook: 同一 `event.id` は no-op
- `calculateStreamRevenueLedger`: stream_id 単位で ledger 再集計可能（adjustment で差分吸収）
- 月次確定前: `creator_score_monthly` 再生成可 · 確定後は adjustment のみ

### 9.4 Security — Row Level Security（TODO-07）

**正本設計:** [reports/tlv-payment-rls-design.md](../reports/tlv-payment-rls-design.md) · **staging 検証:** [reports/tlv-payment-rls-staging-test.md](../reports/tlv-payment-rls-staging-test.md)  
**状態:** **staging 適用済 · production 未適用**（2026-06-28）

| 層 | 責務 |
| --- | --- |
| Edge Function | Viewer JWT 検証 · **service_role** で RPC のみ書込 |
| SECURITY DEFINER RPC | `create_tip_transaction` · `handle_payment_webhook_success` — EXECUTE **service_role のみ** |
| RLS（未適用） | authenticated 直接書込禁止 · Viewer/Creator 限定 SELECT · revenue/provider_event は admin のみ |
| Admin | **既存** `public.talk_is_admin()` + JWT `app_metadata.is_ops` — 新規 `tlv_admin` は設けない |

**書込経路:**

```text
Viewer JWT → tlv-create-tip Edge → service_role → tlv.create_tip_transaction
Stripe     → tlv-payment-webhook → service_role → handle_payment_webhook_success
PostgREST  → authenticated → SELECT only（RLS 適用後）
```

**PostgREST `tlv` expose（staging 適用済）:**

- [`supabase/config.toml`](../supabase/config.toml) `schemas = [..., "tlv"]`
- **RLS 未設定 + 広い GRANT = 全表漏洩リスク** → production は **RLS migration PASS 後のみ expose**
- クライアント読取は Edge または `public.*_safe` VIEW を推奨

**RPC privilege:** `create_tip_transaction` · `handle_payment_webhook_success` · `compute_gauge_pct` は migration 上 **GRANT EXECUTE TO service_role のみ** — authenticated 直叩き不可。

**セキュリティ要点:** Wallet/ledger 改ざん防止 · revenue_ledger Creator 直読禁止 · text ID JOIN 禁止 · stream_events JPY なし · **CAND-P2-05** bot_flag/gauge は RLS 外。

**Production No-Go:** TODO-06 chargeback **staging検証済 · production適用待ち** + TODO-07 **production RLS 未適用**（staging PASS 済）。

### 9.5 Chargeback / Refund / Clawback（TODO-06 · 実装完了 · staging検証済）

**正本設計:** [reports/tlv-payment-chargeback-clawback-design.md](../reports/tlv-payment-chargeback-clawback-design.md)  
**実装:** [reports/tlv-payment-chargeback-clawback-implementation.md](../reports/tlv-payment-chargeback-clawback-implementation.md)  
**Migration:** `20260628160000_tlv_payment_chargeback_clawback.sql`  
**状態:** **P0 実装完了 · staging検証済 · production適用待ち**（2026-06-28）

| コンポーネント | 状態 |
| --- | --- |
| `tlv.handle_payment_refund` | ✅ staging |
| `tlv.handle_payment_dispute` | ✅ staging |
| `tlv.payment_reversals` | ✅ DDL |
| `revenue_ledger` adjustment 負値 | ✅ CHECK 緩和 |
| Edge `charge.refunded` / `refund.updated` / `dispute.*` | ✅ 実装（deploy 待ち） |

**現行 webhook:** PI succeeded/failed/canceled + **refund/dispute P0 追加済**（Edge deploy で有効化）。

---

## 10. Test Cases

| # | ケース | 期待結果 |
| --- | --- | --- |
| T1 | Web 決済成功 `web_coin_500` | gross=550, fee=20, net=530, coins=500 · wallet coin_balance+500 · ledger purchase_credit |
| T2 | App 決済成功 `app_coin_500` | gross=786, fee=235, net=551, is_web=false · lifetime_purchased+500 |
| T3 | Web vs App 手数料差 | 同一 coins · net 差 ≈ PRICING 表どおり |
| T4 | coin 残高不足 tip | 402 · tips/wallet_ledger なし · coin_balance 不変 |
| T5 | extension 500  coin ぴったり | 1 grant · stock=0 · next=500 · blocks=1 |
| T6 | extension 750 coin | grant×1 · stock=250 · next=250 |
| T7 | A300+B200 合算 | paid=500 · grant×1 · contributors=2 |
| T8 | self_gift 確定 tip | fraud_excluded=true · **ledger 0件** · TS event |
| T9 | bot_suspect tip | fraud_excluded=true · ES 除外 |
| T10 | chargeback | payment net↓ · wallet_ledger chargeback_debit · hold 30d |
| T11 | tier_90 monthly | effective=0.90 · override_tier=tier_90 |
| T12 | tier_95 Legend | effective=0.95 · PPC≥500k 必須 |
| T13 | stream_events 金額 | payload に jpy フィールドなし · tip_id のみ |
| T14 | 二重 webhook | payments 1行 · coin_lots 1行 · wallet 1回加算 · event processed 1行 |
| T15 | PF-06 赤字 Creator | effective_rate 自動ダウン · override 無効化可 |
| T16 | 混在 lot tip（Web300+App200） | allocations 2行 · wr_at_tip = web_net/(web+app) |
| T17 | welcome lot tip | net_allocated=0 · WR 分母分子に影響なし |
| T18 | extension + welcome lot | 402 または welcome lot スキップ · 有償のみ消費 |
| T19 | tip 成功 | wallet_ledger tip_debit · balance_after = coin_balance |
| T20 | locked 残高 | coin_balance=500 locked=200 → 301 coin tip は 402 |
| T21 | Ops adjustment | adjustment_credit/debit · reason_code 必須 · 無 reason は DB CHECK 違反 |
| T22 | frozen wallet | status=frozen → 購入/tip 共に拒否 |
| T23 | ledger 整合性 | 直近 ledger.balance_after = viewer_wallets.coin_balance |
| T24 | welcome grant | adjustment_credit · coin_lots welcome · payments 行なし |

---

## 11. TODO（仕様未確定 · 勝手に変更しない）

| ID | 内容 | 状態 |
| --- | --- | --- |
| ~~TODO-01~~ | `viewer_wallets` / `wallet_ledger` | **解消** — v1.2.3 正式 DDL · §1.8 |
| ~~TODO-02~~ | `payment_provider_events` 冪等 | **解消** — §9.1 |
| TODO-03 | 疑義 tip の ledger 計上タイミング | Ops ポリシー待ち |
| ~~TODO-04~~ | tip 消費時 WR origin 追跡 | **解消** — `tip_coin_lot_allocations` · §2.6 |
| TODO-05 | `streams.phase_ends_at` 専用列 | 現状 `gauge_state.free_phase_ends_at` で代替 |
| TODO-06 | paid payout 後 chargeback のクラウドバック | **実装完了 · staging検証済 · production適用待ち** — [implementation](../reports/tlv-payment-chargeback-clawback-implementation.md) |
| ~~TODO-07~~ | RLS ポリシー | **staging 検証済 · production 適用待ち** — [reports/tlv-payment-rls-staging-test.md](../reports/tlv-payment-rls-staging-test.md) |

---

## 12. Phase 1.2.3 適用済み DDL

**正本:** [`db/tlv_schema.sql`](../db/tlv_schema.sql) — `viewer_wallets` · `wallet_ledger` 正式定義

| テーブル | 用途 |
| --- | --- |
| `viewer_wallets` | **コイン残高正本** · lifetime · status |
| `wallet_ledger` | コイン増減監査 · INSERT-only |
| `coin_lots` | 購入ロット · Web/App origin |
| `payment_provider_events` | Webhook 冪等 |
| `tip_coin_lot_allocations` | tip ↔ lot 按分 · WR 監査 |

**設計レポート:** [reports/tlv-wallet-ledger-schema.md](../reports/tlv-wallet-ledger-schema.md) · [reports/tlv-payment-engine-todo-phase1.md](../reports/tlv-payment-engine-todo-phase1.md)

### 12.1 任意 · 未適用

**`tlv.stream_extension_grants`（監査強化 · 任意）**

**理由:** 指示の「extensions INSERT」相当の監査行。v1 は `streams.extension_blocks_completed` + `stream_events` で可。

```sql
create table tlv.stream_extension_grants (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references tlv.streams(id),
  block_number smallint not null,
  granted_at timestamptz not null default now(),
  phase_ends_at timestamptz not null,
  trigger_tip_id uuid references tlv.tips(id),
  unique (stream_id, block_number)
);
```

---

## 13. 関連ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [TLV_PRD.md](./TLV_PRD.md) | 制度正本 |
| [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) | テーブル定義 |
| [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) | 還元プログラム |
| [ADMIN_SYSTEM.md](./ADMIN_SYSTEM.md) | T&S · fraud ルール |
| [reports/tlv-membership-design.md](../reports/tlv-membership-design.md) | Membership 追加設計 |
| [reports/tlv-payment-chargeback-clawback-design.md](../reports/tlv-payment-chargeback-clawback-design.md) | Chargeback / clawback 設計（TODO-06） |
| [reports/tlv-payment-rls-design.md](../reports/tlv-payment-rls-design.md) | RLS 設計 · Policy SQL 案 |
| [reports/tlv-payment-rls-staging-test.md](../reports/tlv-payment-rls-staging-test.md) | RLS staging 適用 · 検証（TODO-07） |

---

## 14. Membership Subscription レーン（追加設計 · 未実装）

**正本:** [reports/tlv-membership-design.md](../reports/tlv-membership-design.md) · [TLV_PRD.md](./TLV_PRD.md) §11

**重要:** Coin Purchase / Tip / Gauge / Extension / `tlv.create_tip_transaction` RPC は **変更しない**。サブスクは **別レーン**。

### 14.1 レーン分離

```text
Coin/Tip レーン（Phase 2 · 実装済）          Membership レーン（未実装）
────────────────────────────────────         ─────────────────────────────
tlv-create-coin-purchase                       tlv-create-membership-checkout（候補）
tlv-payment-webhook                            tlv-membership-webhook（候補）
tlv-create-tip → tlv.create_tip_transaction         Stripe Billing / IAP Subscription
viewer_wallets · coin_lots                     user_subscriptions · subscription_invoices
revenue_ledger (gift/extension)                revenue_ledger (subscription_revenue)
```

**不変:**

- サブスク課金は **Wallet coin を消費しない**
- 法定通貨の直接決済 · PaymentIntent ではなく **Subscription + Invoice**
- `stream_events` に JPY 正本を **持たせない**
- coin 特典 grant 時のみ `wallet_ledger` に記録（購入扱いにしない）

### 14.2 将来 Edge Functions（候補）

#### 14.2.1 `createMembershipCheckout`

| 項目 | 内容 |
| --- | --- |
| 配置 | `supabase/functions/tlv-create-membership-checkout/`（未作成） |
| 決済 | Stripe Checkout / Billing · **Subscription 型** |
| 入力 | `creator_id` · `tier_id` · `channel=web_stripe` |
| 禁止 | Wallet debit · PaymentIntent coin 購入フローとの混在 |

#### 14.2.2 `handleMembershipWebhook`

| Stripe event（処理候補） | 責務 |
| --- | --- |
| `customer.subscription.created` | `user_subscriptions` INSERT |
| `customer.subscription.updated` | status · period · cancel_at_period_end |
| `customer.subscription.deleted` | canceled |
| `invoice.paid` | **売上認識** · `subscription_invoices` · `revenue_ledger` |
| `invoice.payment_failed` | past_due · grace 開始候補 |
| `charge.refunded` | マイナス仕訳 |
| `dispute.created` | Ops アラート · hold |

**TODO-MEM-04:** 上記 event リストの最終確定。

### 14.3 Membership Revenue Ledger

**売上認識タイミング:** `invoice.paid`

```text
invoice.paid
  → subscription_invoices INSERT（請求正本）
  → revenue_ledger INSERT
       event_kind = subscription_revenue   // tip の gift/extension と別
       gross / fee / net / creator_payout / platform_revenue 分離
  → creator_score_events（SPC · 係数は TODO-MEM-01）
```

| 項目 | tip レーン | membership レーン |
| --- | --- | --- |
| JPY 正本 | `revenue_ledger` + `tips` | `subscription_invoices` + `revenue_ledger` |
| coin | `viewer_wallets` debit | **使用しない** |
| refund | TODO-06（tip/chargeback） | TODO-MEM-05 |

### 14.4 `user_subscriptions` 状態機械

| status | 意味 |
| --- | --- |
| `incomplete` | 初回決済未完了 |
| `active` | 有効 |
| `trialing` | トライアル中 |
| `past_due` | 支払い失敗 · リトライ中 |
| `grace_period` | 猶予（**日数 TODO-MEM-03** · 3〜7 日候補） |
| `canceled` | 解約（`cancel_at_period_end` なら period_end まで権利） |
| `unpaid` | 回収不能 |

**解約:** `cancel_at_period_end=true` → `current_period_end` まで特典維持。

**支払い失敗:** 即剥奪せず Grace Period → 失敗後 canceled。

### 14.5 App / Web

| チャネル | MVP | 備考 |
| --- | --- | --- |
| Web Stripe Billing | **優先** | Checkout · Customer Portal |
| Apple IAP | 将来 | receipt validation · server notification |
| Google Play Billing | 将来 | 状態同期遅延 · server 正本 |

- Web / App 価格分離可（TODO-MEM-06）
- App 内 Web 安価誘導 **禁止**

### 14.6 Membership TODO（ENGINE 管轄）

| ID | 内容 |
| --- | --- |
| TODO-MEM-03 | Grace Period 日数 |
| TODO-MEM-04 | Stripe Billing webhook event 確定 |
| TODO-MEM-05 | refund / chargeback / clawback |
| TODO-MEM-07 | monthly coin grant → `wallet_ledger` only |

---

## 変更履歴

| 日付 | 版 | 内容 |
| --- | --- | --- |
| 2026-06-28 | 1.6.5 | §9.5 TODO-06 設計完成（①〜⑩ · reports/tlv-payment-chargeback-clawback-design.md） |
| 2026-06-28 | 1.6.3 | RLS migration staging 適用 · 30/30 RLS test PASS |
| 2026-06-28 | 1.6.2 | §9.4 拡張 — admin= talk_is_admin · RPC privilege · PostgREST expose リスク |
| 2026-06-28 | 1.6.1 | §9.4 Security / RLS 設計（TODO-07 · 未適用） |
| 2026-06-28 | 1.6 | §14 Membership Subscription 追加設計（未実装 · Phase 2 不変） |
| 2026-06-28 | 1.5 | `tlv.create_tip_transaction` RPC · DEV-01/02/03/04 · W1-GAP-01 解消 |
| 2026-06-28 | 1.3 | Phase 2 Edge Functions 実装 · §8 ステータス |
| 2026-06-28 | 1.2 | v1.2.3 viewer_wallets / wallet_ledger 正式化 · §1.8 · T19–T24 |
| 2026-06-28 | 1.1 | Phase 1.2.2 — wallet/lot/idempotency/WR origin · TODO-01/02/04 解消 |
| 2026-06-28 | 1.0 | 初版 — Payment/PL Engine 処理仕様 |
