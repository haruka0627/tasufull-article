# Payment Engine — Architecture SSOT（Phase 1）

**最終更新:** 2026-07-01  
**種別:** 決済 · ウォレット · 会計 · Stripe 連携の **アーキテクチャ正本**（本ファイルは migration / コードを含まない）  
**Phase:** 1 — レーン構成 · 責務 · 整合性原則の地図。処理 How / 列定義は各正本を参照  
**Phase 1 ステータス:** **完了**（2026-07-01 · 実装 / migration / コード変更なし）  
**前提 AD:** [DECISIONS.md](../DECISIONS.md) **AD-013**（収益分離）· **AD-005**（Gateway 契約）

---

## ステータス凡例

| 記号 | 意味 |
| --- | --- |
| **実装済み** | migration · Edge · RPC 存在 · テスト / レポートで検証 |
| **設計済み** | SSOT ドキュメント · DDL / Edge 一部または UI 未接続 |
| **未実装** | Future Epic · 本 SSOT では方向性のみ |

**TLV 処理 How:** [TLV_PAYMENT_ENGINE.md](../TLV_PAYMENT_ENGINE.md)  
**TLV DDL / ER:** [TLV_DB_SCHEMA.md](../TLV_DB_SCHEMA.md) · [`db/tlv_schema.sql`](../../db/tlv_schema.sql)  
**並行制御 · Lock Order:** [PAYMENT_ENGINE.md](../PAYMENT_ENGINE.md)  
**BD サブスク:** [business-directory-subscription-model.md](../business-directory-subscription-model.md) · [architecture/business-directory-db-architecture.md](./business-directory-db-architecture.md)  
**Supabase 環境:** [supabase-environments.md](../supabase-environments.md)

**詳細 How / 列定義 / RPC 実装（本 SSOT では重複しない）:**

| ドキュメント | 参照内容 |
| --- | --- |
| [TLV_PAYMENT_ENGINE.md](../TLV_PAYMENT_ENGINE.md) | TLV 処理フロー · Edge 契約 · webhook |
| [PAYMENT_ENGINE.md](../PAYMENT_ENGINE.md) | Lock Order · Double Spend · 並行制御 |
| [TLV_DB_SCHEMA.md](../TLV_DB_SCHEMA.md) | TLV 表 · RLS · RPC 列定義 |

---

## Phase 1 完了状態（固定 · 2026-07-01）

| 項目 | 状態 |
| --- | --- |
| **Payment Engine Architecture SSOT Phase 1** | **完了** |
| **実装変更** | なし |
| **Migration 変更** | なし |
| **コード変更** | なし |
| **本ファイルの役割** | レーン地図 · 責務 · 整合性原則 · 製品連携 |

## レーン別実装状態（Phase 1 正本）

| レーン | 分類 | 備考 |
| --- | --- | --- |
| **TLV Payment Engine** | **実装済み / Go** | Live UI **未接続 / Production No-Go** · Staging **Conditional Go** · **REL-P0-02** 運用ゲート待ち · [接続前監査](../reports/tlv-payment-live-ui-connection-audit.md) |
| **Business Directory Stripe Subscription** | **実装済み** | 月額サブスク · AD-013 · Production DB apply 済 |
| **Platform featured Checkout** | **実装済み** | **限定実装**（都度 featured のみ） |
| **TASFUL AI quota / Stripe** | **実装済み** | **Wallet 外** · quota Edge + genai webhook |
| **Builder Credits** | **設計済み** | [AI/BUILDER_CREDITS.md](../AI/BUILDER_CREDITS.md) |
| **Marketplace Connect / Escrow** | **未実装** | AD-013 成約手数料 · 別 Epic |
| **TLV Membership** | **設計済み** | coin 消費と分離 · [TODO.md](../TODO.md) TODO-MEM-* |

---

# Overview

TASFUL の Payment Engine は **単一の統合 Wallet / Ledger コア** ではなく、製品ごとに **責務分離された決済レーン** で構成される。  
Phase 1 の正本役割は、各レーンの境界 · データ正本 · Stripe 入口 · セキュリティ原則を **一箇所に地図化** することである。

```text
                         ┌──────────────────────────────┐
                         │     Stripe（外部 PSP）          │
                         └──────┬───────────┬────────────┘
                                │           │
                   tlv-payment- │ stripe-   │  Checkout metadata
                   webhook     │ webhook   │  (BD / GenAI / featured)
                                ▼           ▼
┌────────────────────────────────────────────────────────────────────┐
│  Supabase Edge Functions                                           │
│  tlv-create-coin-purchase · tlv-create-tip · tlv-payment-webhook   │
│  business-directory · stripe-webhook · stripe-create-checkout      │
│  ai-workspace-quota                                                │
└───────────────────────────────┬────────────────────────────────────┘
                                │
       ┌────────────────────────┼────────────────────────┐
       ▼                        ▼                        ▼
┌─────────────┐        ┌─────────────────┐      ┌─────────────────┐
│ tlv schema  │        │ public schema   │      │ quota / plans   │
│ Wallet      │        │ listings · BD   │      │ (TASFUL AI)     │
│ FIFO · PL   │        │ featured · subs │      │ 非 Wallet       │
└─────────────┘        └─────────────────┘      └─────────────────┘
```

| レーン | 正本 | 主用途 | ステータス |
| --- | --- | --- | --- |
| **TLV Payment Engine** | `tlv.*` | コイン購入 · tip · stream PL · Creator 還元 | **実装済み / Go**（Live UI 未接続 / Production No-Go · REL-P0-02 待ち） |
| **Business Directory Stripe Subscription** | `public.business_directory_*` | 月額サブスク掲載（AD-013） | **実装済み** |
| **Platform featured Checkout** | `public.listings` | 都度 Checkout · featured | **実装済み**（限定） |
| **TASFUL AI quota / Stripe** | quota / entitlements | サブスク · チケット · 日次 quota | **実装済み**（Wallet 外） |
| **Builder Credits** | `builder_*`（将来） | Builder 専用クレジット | **設計済み** |
| **Marketplace Connect / Escrow** | Connect · deals | GMV 手数料 · エスクロー | **未実装** |
| **TLV Membership** | 将来 schema | 月額会員（coin 非消費） | **設計済み** |

**Phase 1 原則:** BD サブスク · TLV コイン · Marketplace 成約手数料は **混ぜない**（AD-013）。Wallet は **製品横断で統合しない**。

---

# System Architecture

## Wallet

| 項目 | TLV | 他レーン |
| --- | --- | --- |
| 残高正本 | `tlv.viewer_wallets.coin_balance` | BD: `plan_code` + Stripe 鏡像列 · AI: quota 表 |
| 利用可能 | `coin_balance - locked_coin_balance` | — |
| 監査 | `tlv.wallet_ledger`（INSERT-only） | BD: `audit_logs`（決済監査ではない） |
| ステータス | **実装済み** | BD/AI: **Wallet なし** · Builder: **設計済み** |

## Ledger

| 種別 | テーブル | 単位 | 正本性 |
| --- | --- | --- | --- |
| JPY 決済 | `tlv.payments` | 円 | Gross / Fee / Net · `coins_granted` |
| JPY PL | `tlv.revenue_ledger` | 円 | stream 単位 P&L |
| コイン監査 | `tlv.wallet_ledger` | coin | 増減トレース |
| Lot 原資 | `tlv.coin_lots` · `tip_coin_lot_allocations` | coin | FIFO 消費 · WR 按分 |

詳細: [TLV_DB_SCHEMA.md §1](../TLV_DB_SCHEMA.md)

## Escrow

**専用 `escrow` テーブルは存在しない。** 保留・エスクロー相当は次で表現する。

| パターン | 実装 | ステータス |
| --- | --- | --- |
| Tip 前ロック | `viewer_wallets.locked_coin_balance` | **実装済み** |
| 未消費購入ロット | `coin_lots.coins_remaining` | **実装済み**（FIFO 対象） |
| 返金 / dispute | `tlv.payment_reversals` · clawback RPC | **実装済み** |
| Creator payout 保留 | `tlv.payout_log.hold_until` · status | **実装済み** |
| Marketplace 取引 escrow | Connect + エスクロー口座 | **未実装** |

## Settlement

| 対象 | 経路 | ステータス |
| --- | --- | --- |
| Viewer コイン付与 | Webhook → `payments` → `coin_lots` → wallet credit | **実装済み** |
| Stream 収益計上 | tip RPC → `revenue_ledger` | **実装済み** |
| Creator 月次還元 | `creator_score_monthly` → `payout_log` → Ops 実行 | **実装済み**（batch · 運用ゲート待ち） |
| BD サブスク | Stripe invoice → `stripe-webhook` → listing 列 sync | **実装済み** |
| Platform featured | Checkout completed → listing featured 列 | **実装済み** |
| Marketplace 成約精算 | Connect transfer | **未実装** |

FinOps 参照: [FINANCIAL_MODEL.md](../FINANCIAL_MODEL.md) · [PRICING.md](../PRICING.md)

## Stripe

| レーン | 作成 API | Webhook |
| --- | --- | --- |
| TLV coin | `tlv-create-coin-purchase`（PaymentIntent） | `tlv-payment-webhook` |
| BD サブスク | `business-directory` checkout action | `stripe-webhook`（BD 分岐） |
| Platform featured | `stripe-create-checkout` | `stripe-webhook` / `stripe-confirm-checkout` |
| TASFUL AI | Checkout（genai metadata） | `stripe-webhook`（genai handlers） |

Secrets: `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_WEBHOOK_SECRET_TLV`（TLV 分離推奨 · [TODO.md](../TODO.md) REL-P0-02）

## Webhook

| 要件 | TLV | 共用 `stripe-webhook` |
| --- | --- | --- |
| 署名検証 | `stripe-signature` + `constructEventAsync` | 同左 |
| 冪等 | `tlv.payment_provider_events` | session / subscription id · 製品別 upsert |
| 再送対策 | event id UNIQUE · processed フラグ · terminal 記録 | handler 内 idempotent update |
| 失敗時 | Stripe 自動再送 · DB 側で二重付与防止 | 同左 |

## Accounting

| レポート | データ源 | ステータス |
| --- | --- | --- |
| Stream PL | `tlv.revenue_ledger` | **実装済み** |
| Creator 還元 | `tlv.payout_log` | **実装済み** |
| コイン残高 | `tlv.viewer_wallets` + `wallet_ledger` | **実装済み** |
| BD MRR | Stripe Dashboard + `business_directory_listings.stripe_*` | **実装済み** |
| 横断 GL / 請求書 | — | **未実装** |

---

# Database Architecture

> 列 · 型 · RLS の詳細は [TLV_DB_SCHEMA.md](../TLV_DB_SCHEMA.md) · [business-directory-db-architecture.md](./business-directory-db-architecture.md) を参照。

## TLV（`tlv` schema）— **実装済み**

| テーブル | 責務 |
| --- | --- |
| `fee_config` | チャネル別手数料 · App 価格係数 |
| `payments` | **JPY 決済正本** |
| `payment_provider_events` | Webhook 冪等 |
| `viewer_wallets` | **コイン残高正本** |
| `wallet_ledger` | コイン増減監査 |
| `coin_lots` | 購入ロット · FIFO |
| `tip_coin_lot_allocations` | tip 消費 lot 按分 |
| `tips` | ギフト / 延長 |
| `revenue_ledger` | **JPY PL 正本** |
| `payment_reversals` | 返金 · dispute · clawback 監査 |
| `payout_log` | Creator 月次還元 |
| `creators` · `creator_score_*` | Score · Rank |
| `streams` · `gauge_state` · `stream_events` | UX（**金額正本ではない**） |

**主要 RPC（SECURITY DEFINER）:**  
`tlv.create_tip_transaction` · `tlv.handle_payment_webhook_success` · `tlv.handle_payment_refund` · `tlv.handle_payment_dispute` · `tlv.apply_coin_clawback_for_payment`

**Migration:** `supabase/migrations/20260628120000` 〜 `20260628160000`  
**DDL 正本:** [`db/tlv_schema.sql`](../../db/tlv_schema.sql)

## Business Directory — **実装済み**

| オブジェクト | 責務 |
| --- | --- |
| `business_directory_listings.stripe_*` | Customer · Subscription 鏡像 |
| `business_directory_plan_features.stripe_price_id` | プラン ↔ Price |
| Edge `_shared/business-directory-stripe.ts` | Checkout · portal · webhook sync |

Migration: `20260712100000_business_directory_phase6_stripe_subscription.sql`

## Platform（`public.listings`）— **実装済み（限定）**

| オブジェクト | 責務 |
| --- | --- |
| `listings.is_featured` · `featured_plan` · `featured_until` | 上位掲載 |
| `stripe-create-checkout` · `stripe-confirm-checkout` | Checkout Session |

## TASFUL AI — **実装済み（Wallet 外）**

| オブジェクト | 責務 |
| --- | --- |
| `ai-workspace-quota` Edge + `_shared/ai-workspace-quota.ts` | quota consume |
| `stripe-webhook` genai handlers | プラン · チケット sync |
| `stripe-genai-config.js` · `ai-plan-models.js` | クライアント plan 定義 |

## Builder — **設計済み**

| オブジェクト | 責務 |
| --- | --- |
| `builder_wallets` · `builder_wallet_ledger` | Builder 専用クレジット |

正本: [AI/BUILDER_CREDITS.md](../AI/BUILDER_CREDITS.md)

## リレーション（概要）

```text
auth.users
    └── tlv.viewer_wallets (1:1)
            ├── wallet_ledger
            ├── coin_lots ──► tip_coin_lot_allocations ──► tips
            └── tips ──► revenue_ledger

payments ──► coin_lots
payment_provider_events ──► payments (冪等)
payments / tips ──► revenue_ledger

business_directory_listings ──► Stripe Customer/Subscription（別 FK 体系）
listings ──► Stripe Session metadata（featured）
```

**Viewer ID:** `payer_user_uuid` のみ JOIN 可 · `payer_user_id` (text) は legacy 監査のみ（[TLV_DB_SCHEMA.md §1](../TLV_DB_SCHEMA.md)）

## 整合性

| 原則 | 実装 |
| --- | --- |
| 金額正本の単一化 | JPY = `payments` / `revenue_ledger` · coin = `viewer_wallets` |
| 1 操作 = 1 TX | RPC / Edge 内で完結 · **TX 内 HTTP 禁止** |
| Lock Order 固定 | Wallet → FIFO lots → ledger（[PAYMENT_ENGINE.md](../PAYMENT_ENGINE.md)） |
| クライアント直接 UPDATE 禁止 | wallet / revenue ledger は RPC · service_role のみ |
| RLS | `20260628150000_tlv_payment_rls.sql` · admin / service 分離 |

---

# Payment Flow

| 操作 | TLV | 他レーン | ステータス |
| --- | --- | --- | --- |
| **入金** | PI succeeded → webhook → `payments` → `coin_lots` → wallet credit | BD: invoice · featured: session.completed | TLV/BD/Platform: **実装済み** |
| **保留** | `locked_coin_balance` 加算 · 未消費 lot | — | **実装済み** |
| **エスクロー相当** | dispute → `payment_reversals` · clawback | Marketplace Connect | TLV: **実装済み** · MP: **未実装** |
| **支払い（消費）** | tip RPC: lock → FIFO → `tips` → `revenue_ledger` | — | **実装済み** |
| **返金** | `handle_payment_refund` · lot 逆調整 | Stripe + 製品 handler | **実装済み** |
| **キャンセル** | PI failed/canceled → terminal event | Checkout cancel_url | **実装済み** |
| **FIFO** | `coin_lots` ORDER BY `expires_at`, `created_at` · `FOR UPDATE` | TLV 専用 | **実装済み** |

詳細シーケンス: [TLV_PAYMENT_ENGINE.md §1–§5](../TLV_PAYMENT_ENGINE.md)

---

# Wallet Architecture

| 操作 | TLV 実装 | ルール | ステータス |
| --- | --- | --- | --- |
| **残高** | `viewer_wallets.coin_balance` | JPY 正本ではない | **実装済み** |
| **Lock** | `locked_coin_balance` UPDATE | Wallet `FOR UPDATE` 先行 · 同一 TX | **実装済み** |
| **Release** | tip 完了 / rollback で lock 減算 | [PAYMENT_ENGINE.md §4](../PAYMENT_ENGINE.md) | **実装済み** |
| **Settlement** | Viewer: 購入即 credit · Creator: `payout_log` 月次 | Ops batch | **実装済み** |
| **履歴** | `wallet_ledger` · `entry_type` · `balance_after` | INSERT-only | **実装済み** |

**利用可能残高:** `coin_balance - locked_coin_balance` — tip 可否判定は **lock 取得後**のみ。

---

# Ledger Architecture

| 原則 | 実装 | ステータス |
| --- | --- | --- |
| **二重計上防止** | `payment_provider_events` · tip `idempotency_key` · RPC early return | **実装済み** |
| **監査** | `wallet_ledger` · `revenue_ledger` · `payment_reversals` — INSERT-only 系 | **実装済み** |
| **整合性** | Wallet → FIFO → ledger INSERT 順固定 · 1 TX | **実装済み** |
| **Transaction 設計** | SECURITY DEFINER RPC · Edge は RPC 委譲 · 例外は terminal event 記録 | **実装済み** |

Lock Order 正本: [PAYMENT_ENGINE.md §2–§3](../PAYMENT_ENGINE.md)

---

# Stripe Integration

| 項目 | 内容 | ステータス |
| --- | --- | --- |
| **Checkout** | TLV PI · BD subscription Session · featured Session · GenAI metadata | **実装済み** |
| **Webhook** | `tlv-payment-webhook`（TLV）· `stripe-webhook`（BD / GenAI / featured） | **実装済み** |
| **Idempotency** | DB event 表 · Stripe `idempotency_key`（作成 API） | **実装済み** |
| **署名検証** | 全 webhook で `stripe-signature` 必須 · 失敗時 400 | **実装済み** |
| **再送対策** | event id UNIQUE · processed フラグ · 同一 event 再処理で no-op | **実装済み** |

BD ルーティング: `_shared/business-directory-stripe.ts` · `isBusinessDirectoryCheckoutSession`

---

# Security

| 脅威 | 対策 | 正本 | ステータス |
| --- | --- | --- | --- |
| **Double Spend** | Wallet `FOR UPDATE` → 残高判定 → FIFO | [PAYMENT_ENGINE.md §4](../PAYMENT_ENGINE.md) | **実装済み** |
| **Race Condition** | 全 RPC 同一 Lock Order | [PAYMENT_ENGINE.md §2–§3](../PAYMENT_ENGINE.md) | **実装済み** |
| **Replay Attack** | `payment_provider_events` · event id 冪等 | [TLV_PAYMENT_ENGINE.md](../TLV_PAYMENT_ENGINE.md) | **実装済み** |
| **FIFO 不整合** | lot `coins_remaining` · allocation 行は RPC 内のみ | Engine RPC | **実装済み** |
| **Transaction 漏れ** | 1 操作 = 1 TX · TX 内 HTTP 禁止 | Engine 仕様 | **実装済み** |
| **Idempotency** | webhook event · client key · reversal UNIQUE | DDL + RPC | **実装済み** |

RLS: [TLV_DB_SCHEMA.md §8](../TLV_DB_SCHEMA.md)

---

# Platform Integration

| 製品 | 決済 / 課金 | Wallet | ステータス |
| --- | --- | --- | --- |
| **Business Directory** | Stripe **月額サブスク**（AD-013）· `stripe-webhook` sync | **なし** · `plan_code` | **実装済み** |
| **Platform** | featured 都度 Checkout · Marketplace Connect 成約（別 Epic） | **なし** | featured: **実装済み** · Connect: **未実装** |
| **TLV Live** | TLV Payment Engine 正本 · coin · tip | **`tlv.viewer_wallets`** | Engine: **実装済み / Go** · Live UI: **未接続 / Production No-Go** |
| **TASFUL AI** | Stripe サブスク / チケット + `ai-workspace-quota` | **なし** | **実装済み** |
| **Builder** | 将来 Credits 購入 | **専用 Wallet（設計）** · TLV 非統合 | **設計済み** |
| **AI 秘書** | DeepSeek 直（AD-010） | Payment Engine 外 | **実装済み**（別系統） |

**AD 整合:** AD-002 · AD-003 · AD-004 · AD-013 — 製品専用 AI / Wallet 統合 **禁止**。

---

# Migration Strategy

## 現在

| 領域 | Migration / 状態 |
| --- | --- |
| **TLV Payment** | `20260628120000` 〜 `20260628160000` — DDL + RPC + RLS + clawback |
| **BD Stripe** | `20260712100000` — Production apply 済 |
| **BD content_update / AI quota** | `20260715110000`（partial）· `20260716100000` — Production apply 済 |
| **BD Phase 2a** | `20260717120000` — Production apply 済 |

## Production / Staging

| 環境 | ref | Payment 備考 |
| --- | --- | --- |
| **Production** | `ddojquacsyqesrjhcvmn` | TLV Payment Step 0–5 **適用済** · Edge v4 · **REL-P0-02 運用ゲート待ち** · Live UI **未接続** · BD: DB 依存解消済 |
| **Staging** | `ahlxuyvhzqdqaojiywmu` | TLV 一式 **未セットアップ**（Live UI リハーサル前 · 高優先）· BD MVP-1 済 |

正本: [supabase-environments.md](../supabase-environments.md) · [reports/tlv-payment-production-readiness.md](../reports/tlv-payment-production-readiness.md)

## 今後

| 方針 | 内容 |
| --- | --- |
| TLV Production Go | Runbook 承認 · backup · webhook deploy · Go Approval（[TODO.md](../TODO.md) REL-P0-02） |
| TLV Live UI 接続 | **Production No-Go** · Staging **Conditional Go** — REL-P0-02 · TLV-P0-05 · `stream_id` · stub 廃止（**Critical:** `public.live_tips` 並存禁止）· [接続前監査](../reports/tlv-payment-live-ui-connection-audit.md) |
| 新規 Payment RPC | **必ず** [PAYMENT_ENGINE.md](../PAYMENT_ENGINE.md) Lock Order 準拠 |
| Wallet 横断統合 | **禁止** — 新レーンは独立 schema / quota |
| DDL 変更 | `db/tlv_schema.sql` と migration **同期** |

---

# Future Roadmap

## Phase 2 候補（未着手 · 設計バックログ）

| テーマ | ステータス | 備考 |
| --- | --- | --- |
| **Payment Lifecycle** | **未着手** | 状態遷移 · タイムアウト · 補償の横断整理 |
| **Failure Recovery** | **未着手** | webhook 失敗 · partial apply · manual FinOps |
| **Audit Trail** | **未着手** | 横断監査 · reconciliation 入力 |
| **Reconciliation** | **未着手** | Stripe ↔ ledger 突合 |
| **Marketplace Connect / Escrow** | **未実装** | AD-013 別 Epic |
| **TLV Membership 実装** | **設計済み** | TODO-MEM-* · coin と分離 |

## Phase 1 以降の拡張（参考）

| テーマ | ステータス | 備考 |
| --- | --- | --- |
| **Marketplace** | **未実装** | Connect · 成約 escrow |
| **ポイント** | **未実装** | coin とは別制度なら新 schema |
| **クーポン** | **未実装** | Stripe Coupon / 自前 redemption |
| **請求書** | **未実装** | B2B · BD Enterprise |
| **分割決済** | **未実装** | — |
| **多通貨** | **未実装** | 現状 JPY + coin 整数 |
| **Builder Credits 実装** | **設計済み** | [AI/BUILDER_CREDITS.md](../AI/BUILDER_CREDITS.md) |

---

# Edge Functions（Payment 関連 · 実装済み）

| Function | レーン | 役割 |
| --- | --- | --- |
| `tlv-create-coin-purchase` | TLV | PI 開始 |
| `tlv-payment-webhook` | TLV | 購入確定 · refund · dispute |
| `tlv-create-tip` | TLV | tip · gauge |
| ~~`tlv-e2e-simulate-payment`~~ | TLV | **削除済み**（旧 E2E シミュレーター · Webhook 署名バイパス）· 本番は `tlv-payment-webhook` のみ · Production 残存確認は deploy 前タスク |
| `business-directory` | BD | checkout · portal · sync |
| `stripe-webhook` | 共用 | BD · GenAI · featured |
| `stripe-create-checkout` | Platform | featured Session |
| `stripe-confirm-checkout` | Platform | success フォールバック |
| `ai-workspace-quota` | TASFUL AI | quota 照会 / consume |

---

# 関連ドキュメント（重複せず参照）

| ドキュメント | 役割 |
| --- | --- |
| **本ファイル** | Payment **Architecture SSOT Phase 1** — レーン · 責務 · 整合 |
| [PAYMENT_ENGINE.md](../PAYMENT_ENGINE.md) | Lock Order · Deadlock · Double Spend |
| [TLV_PAYMENT_ENGINE.md](../TLV_PAYMENT_ENGINE.md) | TLV 処理仕様 · Edge 契約 |
| [TLV_DB_SCHEMA.md](../TLV_DB_SCHEMA.md) | TLV 表 · RLS · RPC 詳細 |
| [business-directory-subscription-model.md](../business-directory-subscription-model.md) | BD 収益モデル |
| [AI/AI_MEMBERSHIP_PRICING.md](../AI/AI_MEMBERSHIP_PRICING.md) | TASFUL AI 価格 Draft |
| [AI/BUILDER_CREDITS.md](../AI/BUILDER_CREDITS.md) | Builder Wallet 設計 |
| [DECISIONS.md](../DECISIONS.md) | AD-013 等 |

---

# 本 SSOT の位置づけ

| 変更種別 | 更新先 |
| --- | --- |
| TLV RPC / フロー | `TLV_PAYMENT_ENGINE.md` + migration + 本ファイル要約 |
| Lock Order | `PAYMENT_ENGINE.md` + ADR |
| 新製品レーン | 本ファイル §Overview + 製品 doc |
| Production Go/No-Go | `PROJECT_STATUS.md` · `TODO.md` · reports |
| **Phase 2 以降** | 本ファイル Phase 2 候補 · 新 SSOT または § 追加（Phase 1 正本は維持） |

**Phase 1 完了記録（2026-07-01）:** Architecture SSOT 整備完了 · 実装 / migration / コード変更なし · 次フェーズは上記 Phase 2 候補。

---

*Phase 1 **完了** · 設計 · ドキュメントのみ。migration / Edge / Stripe 本番設定の変更は別タスク。*
