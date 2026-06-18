# Marketplace 決済 — 本番化 Gap 調査

**作成日:** 2026-06-18  
**種別:** 調査のみ（コード変更なし）  
**前提:** Market EC UI **RELEASE FROZEN**（デモ checkout 意図的）  
**Stripe Live との関係:** GenAI Live **単独可** · Marketplace GMV は **Connect + shop_orders + 導線配線** 必須

---

## 1. 二系統アーキテクチャ

| Path | 入口 | 決済 | 永続化 |
|------|------|------|--------|
| **A. 現行（FROZEN UI）** | `shop-market-checkout.html` | **モック** | localStorage |
| **B. 設計（Stripe Connect）** | `checkout.html` | Stripe Hosted | `shop_orders` Supabase |

**配線 gap:** `detail-shop-product.html` の buy → **Path A**（`shop-market-product-detail.js`）。Path B の `detail-shop-product-page.js` は HTML 未 include。

---

## 2. 導線別調査

### shop_orders

| 項目 | 状態 |
|------|------|
| DDL | ✅ `supabase/shop_orders.sql` · `shop_orders_connect_columns.sql` |
| Supabase 接続 | ❌ **REST 404 未デプロイ**（監査） |
| Edge apply | ✅ `apply-shop-order.ts` |
| localStorage | ❌（Supabase テーブル · demo は `tasu_shop_orders`） |
| Stripe | confirm 経由で insert 設計 |
| 分類 | **本番前必須** M-1 |

---

### checkout

| 導線 | ファイル | Stripe | Supabase | 分類 |
|------|----------|--------|----------|------|
| Path A 市場 | `shop-market-checkout.js` | ❌ デモ | ❌ LS | **デモのみ** |
| Path A 店舗 | `shop-store-checkout.js` | ❌ | ❌ LS | デモのみ |
| Path B Stripe | `checkout-page.js` → `shop-checkout.js` | ✅ コード | ⚠️ confirm 時 | **未配線（入口）** |
| Edge create | `stripe-create-shop-checkout` | ✅ コード | — | **デプロイ要確認** |
| Edge confirm | `stripe-confirm-shop-checkout` | ✅ コード | ✅ apply | 同上 |

**localStorage（Path B fallback）:** `shop-checkout.js` → `createDemoOrder()` → `tasu_shop_orders`

---

### order_complete

| 導線 | ファイル | 状態 |
|------|----------|------|
| Path A | `shop-market-complete.js` | LS `tasu_market_last_order` 読取 · デモ fallback |
| Path B | `order-complete-page.js` | `confirmCheckoutSession()` → Edge → `shop_orders` |

| 接続 | Path A | Path B |
|------|--------|--------|
| Stripe | ❌ | ✅ 設計 |
| Supabase | ❌ | ⚠️ テーブル未デプロイ |
| 分類 | デモのみ | **本番前必須**（M-1, M-2） |

---

### seller_orders（売主注文管理）

| 項目 | 状態 |
|------|------|
| ファイル | `shop-market-seller-orders.js` |
| データ源 | `shop-market-product-data.js` → `tasu_market_order_history` |
| Supabase | ❌ |
| Stripe | ❌ |
| 分類 | **localStorage · デモのみ** · 本番前必須 M-6 |

---

### buyer_orders（購入者履歴）

| 項目 | 状態 |
|------|------|
| ファイル | `shop-market-order-history.js` |
| データ源 | `tasu_market_order_history` localStorage |
| Supabase | ❌ |
| 分類 | **デモのみ** · 本番前必須 M-5 |

---

### seller revenue（売上反映）

| 項目 | 状態 |
|------|------|
| 売主 UI |  fulfillment ステータスのみ · GMV 集計なし |
| Admin KPI | `shop-market-event-store.js` · `admin-ai-ops-watch.js` — **LS 合成** |
| Connect 分配 | `seller_amount` · `platform_fee_amount` in `shop_orders` 設計 |
| `tasu_shop_orders` LS | デモ Connect KPI 用 |
| Supabase `shop_orders` 読取 | ❌ KPI 未接続 |
| 分類 | **デモのみ** · 本番前必須 M-7 |

---

### payment_status

| レイヤ | 実装 | 永続化 |
|--------|------|--------|
| Path A | UI のみ（未課金） | — |
| Path B Stripe | `shop_orders.payment_status` | Supabase（未デプロイ） |
| Path B demo | `payment_status: "paid"` in LS | `tasu_shop_orders` |
| Webhook | **未実装**（shop_product） | confirm のみ |
| 分類 | Stripe コードあり · **DB+Webhook 未接続** |

---

### order_status（発送ステータス）

| レイヤ | 実装 | 永続化 |
|--------|------|--------|
| 定義 | `ORDER_STATUSES` in `shop-market-product-data.js` | — |
| 更新 | `updateOrderStatus()` | `tasu_market_order_history` LS |
| 同期 | 同一ブラウザのみ | — |
| Supabase | ❌ |
| 分類 | **デモのみ** · 本番前必須 M-6 |

---

## 3. localStorage 依存（決済関連）

| キー | ファイル | 用途 |
|------|----------|------|
| `tasu_market_cart_*` | `shop-market-product-data.js` | カート |
| `tasu_market_last_order` | 同上 | 完了表示 |
| `tasu_market_order_history` | 同上, seller/buyer UI, event-store | 注文 · KPI |
| `tasu_shop_orders` | `shop-checkout.js`, KPI | デモ Stripe 注文 |
| `tasu_market_admin_events_v1` | `shop-market-event-store.js` | 管理イベント |
| `tasu_market_notify_sent_v1` | `shop-market-notify.js` | TALK dedupe |

---

## 4. 接続状態マトリクス

| コンポーネント | localStorage | Supabase | Edge Fn | Stripe | 分類 |
|----------------|-------------|----------|---------|--------|------|
| Path A checkout | ✅ | ❌ | ❌ | ❌ | デモのみ |
| Path B checkout | fallback | ❌ table | ⚠️ deploy | ✅ code | 未接続 |
| order complete A | ✅ | ❌ | ❌ | ❌ | デモのみ |
| order complete B | — | ❌ | ⚠️ | ✅ | 未接続 |
| seller/buyer orders | ✅ | ❌ | ❌ | ❌ | デモのみ |
| revenue KPI | ✅ | ❌ | ❌ | partial | デモのみ |
| shop_orders DDL | — | repo only | apply ✅ | — | **本番前必須** |

---

## 5. 本番前必須 / 後回し

### 本番前必須

| # | タスク | 依存 |
|---|--------|------|
| M-1 | `shop_orders` + RLS デプロイ | — |
| M-2 | Shop Edge Functions デプロイ + Live smoke | Stripe Live · Connect |
| M-3 | Connect onboarding（売主 `acct_*`） | Connect Epic |
| M-4 | buy CTA → `checkout.html`（**凍結解除**） | M-2 |
| M-5 | 購入者履歴 → `shop_orders` API | M-1 |
| M-6 | 売主注文 → `shop_orders` フィルタ | M-1 |
| M-7 | KPI → Supabase クエリ | M-1 |
| M-8 | Webhook `shop_product` 分岐 | 推奨 |
| M-9 | `SITE_URL` Live 設定 | P0-W2 |

### 後回し可能

| 項目 |
|------|
| カート複数品 Stripe checkout |
| 在庫自動減算 |
| `DEMO_CATALOG` 除去 |
| `shop_notified` バックグラウンド |
| Path A デモ checkout 維持（限定公開として） |

---

## 6. Stripe Live 切替との関係

| 質問 | 回答 |
|------|------|
| Live 切替だけで Marketplace GMV？ | **No** — Path A が現行 |
| Live Secret は Shop にも効く？ | **Yes** — 同一 `STRIPE_SECRET_KEY` |
| Live 後すぐ Shop smoke 可能？ | **条件付き** — shop_orders + Connect + 導線 |

---

## 7. 最短順序 · 工数

```
P0-W2 Stripe Live
  → Connect onboarding (C-1)
  → shop_orders deploy (M-1)
  → Shop Edge deploy (M-2)
  → Market EC 凍結解除 + buy 配線 (M-4)
  → 注文/KPI Supabase (M-5〜7)
```

| フェーズ | 工数 |
|----------|------|
| shop_orders + Edge deploy | 2〜3 人日 |
| Connect + 導線配線 | 10〜15 人日 |
| **合計 Marketplace GMV** | **12〜18 人日** |

**検証:** コード変更 0。
