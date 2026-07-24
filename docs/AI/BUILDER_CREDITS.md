# Builder Credits — 共通クレジット設計（Future · Draft）

**Status:** Future Draft（**設計のみ · 未実装**）  
**最終更新:** 2026-06-28  
**正本:** 本ファイル · [BUILDER_AI.md](./BUILDER_AI.md)  
**分離:** [AI Membership Pricing](./AI_MEMBERSHIP_PRICING.md) · TLV Wallet / Coin · Platform Wallet · **統合しない**

---

## 目的

将来の Builder プラットフォーム全体で利用できる **共通クレジット（Builder Credits）** の設計を定義する。

> **Builder 専用ポイント · サブスクの代替ではなく補助 · 有料機能の共通決済レイヤ（Future）**

現行の都度課金（Contact Reveal 等）· 月額サブスク（Builder Pro / Business）· Provider Boost は [BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md) · [BUILDER_PROVIDER_LISTING.md](./BUILDER_PROVIDER_LISTING.md) が正本。  
Credits は **将来それらと併用可能な消費手段**として位置づける（**今回実装なし**）。

---

## 1. 位置づけ

| 項目 | 内容 |
| --- | --- |
| **名称** | Builder Credits（Builder 専用） |
| **スコープ** | Builder 領域のみ（`builder/*` · Builder AI · マッチング · Listing） |
| **非統合** | AI Membership · TLV · Platform Wallet · Coin |
| **役割** | 複数有料機能を **1 つの Wallet 残高**から消費 |

```text
┌──────────────────────────────────────────────────────────┐
│  Builder Pro / Business（月額サブスク）                   │
│  → 枠内機能はサブスク · 超過/追加は Credits 消費（Future）│
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│  Builder Credits Wallet                                   │
│  購入 → 加算 → 有料機能で消費 → Ledger 監査              │
└──────────────────────────┬───────────────────────────────┘
                           │
     Contact Reveal · AI追加 · Vision · PDF · Marketplace …
```

---

## 2. 対象機能（Future · 消費例）

| カテゴリ | 機能例 | 現行正本 |
| --- | --- | --- |
| マッチング | Contact Reveal | [BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md) |
| Builder AI | AI 追加実行 · Vision 追加解析 | [BUILDER_AI.md](./BUILDER_AI.md) |
| ドキュメント | PDF 追加生成 · レポート追加生成 | BUILDER_AI §業務 AI |
| マーケット | Builder Marketplace · Premium Template | Backlog |
| 掲載 | Sponsored 掲載 · Boost 超過 | [BUILDER_PROVIDER_LISTING.md](./BUILDER_PROVIDER_LISTING.md) |
| その他 | 将来 Builder 有料機能全般 | 本ファイル |

**注:** 各機能は **Credits または 直接決済（Stripe 等）のいずれか**を将来選択可能とする設計。初期リリース時は機能ごとに正本 doc の課金モデルを優先。

---

## 3. 利用イメージ（Future）

```text
1. Builder Credits 購入（Stripe Checkout 等）
        ↓
2. builder_wallets.balance へ加算（ledger: purchase）
        ↓
3. 有料機能利用（例: Contact Reveal 1件）
        ↓
4. トランザクション内で残高チェック → 減算（ledger: spend）
        ↓
5. reason_code + metadata で利用履歴保存
        ↓
6. 二重消費防止（idempotency key / 楽観ロック）
```

---

## 4. サブスクとの関係

| プラン | 月額 | Credits との関係 |
| --- | --- | --- |
| **Builder Pro** | 月額契約 | サブスク枠内機能 + **超過時 Credits 消費**（Future） |
| **Builder Business** | 月額契約 | Business 機能 + **超過時 Credits 消費**（Future） |

**原則:**

- Credits は **サブスクの代替ではない** — 補助 · 従量 · パック購入
- サブスク未加入でも Credits 単体利用可（機能 gate は機能別に定義）
- Builder AI entitlements · Contact Reveal · Provider Boost は **別フラグ**維持

---

## 5. Wallet 設計（Future · スキーマ案）

### `builder_wallets`

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | UNIQUE · 1 ユーザー 1 Wallet |
| `balance` | integer | 利用可能 Credits 残高（非負） |
| `locked_balance` | integer | 処理中ロック（二重消費防止） |
| `lifetime_purchased` | integer | 累計購入 |
| `lifetime_spent` | integer | 累計消費 |
| `status` | enum | `active` \| `suspended` \| `closed` |
| `updated_at` | timestamptz | |

### `builder_wallet_ledger`

**INSERT ONLY** — 残高変更は必ず ledger 経由。

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid | PK |
| `wallet_id` | uuid | FK → builder_wallets |
| `entry_type` | enum | 下記 |
| `credits_delta` | integer | 増減（spend は負） |
| `balance_after` | integer | 反映後残高 |
| `payment_id` | text nullable | Stripe 等 |
| `reason_code` | text | 機能識別子（例: `contact_reveal`） |
| `metadata` | jsonb | target_id · feature · idempotency_key 等 |
| `created_at` | timestamptz | |

### `entry_type`

| 値 | 説明 |
| --- | --- |
| `purchase` | Credits 購入 |
| `spend` | 有料機能消費 |
| `refund` | 返金 |
| `adjustment` | 運営調整 |
| `bonus` | キャンペーン付与 |
| `expiration` | 失効（将来ポリシー定義時） |

---

## 6. 設計原則

| # | 原則 |
| --- | --- |
| 1 | **Builder 専用** — TLV / Platform / AI Membership と混在しない |
| 2 | **FIFO 不要** — Credits は fungible · 単一 balance |
| 3 | **Wallet 分離** — `builder_wallets` は Builder スキーマ/RLS 内 |
| 4 | **Ledger 監査** — 残高は ledger から再計算可能 |
| 5 | **二重消費防止** — transaction + `locked_balance` + idempotency |
| 6 | **Transaction 前提** — spend は RPC/DB transaction 内で atomic |
| 7 | **Coin と混在しない** — 表示 · 換算 · 残高 UI すべて Builder 専用 |

### 消費フロー（Future · 疑似）

```sql
-- 概念のみ · 今回 migration なし
BEGIN;
  SELECT balance, locked_balance FROM builder_wallets
    WHERE user_id = $1 FOR UPDATE;
  -- 残高確認 → locked_balance += cost
  INSERT INTO builder_wallet_ledger (... entry_type=spend ...);
  UPDATE builder_wallets SET balance = balance - cost, locked_balance = ...;
COMMIT;
```

---

## 7. 禁止事項

| # | 禁止 |
| --- | --- |
| 1 | **今回の実装**（コード · DB · UI · Gateway · Stripe） |
| 2 | **migration** |
| 3 | **Payment Engine 変更**（TLV Payment Engine 正本を改変しない） |
| 4 | **Builder AI サブスクへの統合**（entitlements 混同） |
| 5 | **AI Membership 統合** |
| 6 | **TLV Wallet / Coin 統合** |
| 7 | Platform Wallet 統合 |

---

## 8. Backlog（Future）

| ID | 内容 | 状態 |
| --- | --- | --- |
| **BC-0** | 設計（本 doc） | ✅ Draft |
| **BC-1** | Wallet schema · RLS | 📋 未着手 |
| **BC-2** | Payment 連携（Builder 専用 Product） | 📋 |
| **BC-3** | Credits 購入 UI + Checkout | 📋 |
| **BC-4** | Credits 消費 hook（機能別 reason_code） | 📋 |
| **BC-5** | 管理画面（残高 · 調整 · 停止） | 📋 |
| **BC-6** | 監査ログ · 不正検知 · レポート | 📋 |

---

## 9. 関連ドキュメント

| ファイル | 内容 |
| --- | --- |
| [BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md) | Contact Reveal · Builder AI サブスク |
| [BUILDER_PROVIDER_LISTING.md](./BUILDER_PROVIDER_LISTING.md) | Provider Boost · Sponsored |
| [AI_MEMBERSHIP_PRICING.md](./AI_MEMBERSHIP_PRICING.md) | TASFUL AI（非統合） |
| [TLV_PAYMENT_ENGINE.md](../TLV_PAYMENT_ENGINE.md) | TLV 決済（参考 · 変更禁止） |
| [reports/builder-credits-design.md](../reports/builder-credits-design.md) | 本設計レポート |

---

*Future Draft · 設計のみ · 実装は BC-1 以降 Backlog 承認後*
