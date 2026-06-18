# Stripe Webhook 依存監査

**作成日:** 2026-06-18  
**種別:** 調査のみ（コード変更なし）  
**実装:** `supabase/functions/stripe-webhook/index.ts`  
**Endpoint:** `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook`  
**Test Endpoint ID:** `we_1TR70n5tJSRSYcyiMrAzpuGF`（P0-W1 PASS）

---

## 1. 処理フロー概要

```
POST + stripe-signature
  → STRIPE_WEBHOOK_SECRET で constructEventAsync
  → event.type 分岐
  → apply-* (service_role)
  → 200 { received: true } または 500（Stripe 再送）
```

**JWT:** なし · **anon 不可:** 署名必須

---

## 2. 実装済みイベント

### 2.1 `checkout.session.completed`

| 項目 | 内容 |
|------|------|
| **分岐** | ① GenAI metadata あり → GenAI apply · ② `listing_id` + `featured_plan` → Featured apply · ③ それ以外 → 200 skip |
| **GenAI 前提** | `payment_status=paid` or `status=complete` · metadata `user_id` + `genai_plan` / `order_type` |
| **Featured 前提** | `payment_status=paid` · metadata `listing_id` + `featured_plan` |

#### GenAI — DB 反映先

| プラン種別 | apply 関数 | DB テーブル |
|------------|------------|-------------|
| Basic / Pro サブスク | `syncGenAiFromStripeSubscription` / `applyGenAiPlanFromCheckout` | `gen_ai_subscriptions` |
| 2D Live サブスク | `sync2dLiveFromStripeSubscription` | `gen_ai_entitlements` |
| 3D チケット（payment） | `apply3dTicketFromCheckout` | `gen_ai_3d_tickets` · `gen_ai_3d_ticket_grants` |

#### Featured — DB 反映先

| apply 関数 | DB |
|------------|-----|
| `applyFeaturedToListing` | `listings`: `is_featured`, `featured_plan`, `featured_until`, `featured_stripe_session_id`, `form_data` |

#### 成功時

| 経路 | HTTP | レスポンス |
|------|------|------------|
| GenAI apply OK | 200 | `{ received: true, kind: "genai" }` |
| Featured apply OK | 200 | `{ received: true }` |
| GenAI 未払い skip | 200 | `{ received: true, skipped: true, kind: "genai" }` |
| Featured metadata 欠落 | 200 | `{ received: true }` + warn log |

#### 失敗時

| 条件 | HTTP | ログ |
|------|------|------|
| GenAI apply DB エラー | **500** | `[stripe-webhook] genai apply failed` |
| Featured apply エラー | **500** | `[stripe-webhook] apply failed` |
| listing 404 | 500 | apply-featured 経由 |

#### 再送時

| 条件 | 挙動 |
|------|------|
| 500 応答 | Stripe **自動再送** ✅ |
| 200 skip（metadata 欠落） | 再送されるが **修復されない** ⚠️ |
| Featured / 3D 冪等 | 同一 `session_id` で **二重付与なし** ✅ |

---

### 2.2 `customer.subscription.updated`

| 項目 | 内容 |
|------|------|
| **分岐** | metadata `order_type=genai_2d_live_subscription` → 2D Live · 否则 GenAI Basic/Pro |
| **処理** | `sync2dLiveFromStripeSubscription` / `syncGenAiFromStripeSubscription` |
| **DB** | `gen_ai_entitlements` / `gen_ai_subscriptions` |
| **成功** | 200 `{ received: true, kind: "genai_2d_live" }` 等 |
| **失敗** | 500 + error log → **再送** |
| **用途** | プラン変更 · period_end 更新 · cancel_at_period_end |

---

### 2.3 `customer.subscription.deleted`

| 項目 | 内容 |
|------|------|
| **処理** | 同上 sync 関数 — status canceled / free 降格 |
| **DB** | 同上 |
| **成功/失敗/再送** | `subscription.updated` と同様 |

---

## 3. Dashboard 登録イベント（Test · P0-W1 確認済）

| イベント | 必須 | Live でも同一 |
|----------|------|---------------|
| `checkout.session.completed` | ✅ | ✅ 登録必須 |
| `customer.subscription.updated` | ✅ | ✅ 登録必須 |
| `customer.subscription.deleted` | ✅ | ✅ 登録必須 |

**追加イベントはコード上不要**（GenAI + Featured スコープ）。

---

## 4. 未実装イベント（コードに分岐なし）

| イベント | 影響 | 優先 |
|----------|------|------|
| `checkout.session.completed` (`order_type: shop_product`) | Marketplace 注文が Webhook 経路で保存されない | Marketplace Epic |
| `checkout.session.completed` (`service_platform_fee`) | 手数料 confirm なし | Connect Epic |
| `invoice.payment_failed` | サブスク支払失敗の即時通知なし | P1 |
| `charge.refunded` | 返金後 entitlement 残存 | P1 |
| `payment_intent.succeeded` / `payment_failed` | Connect KPI | Connect Epic |
| `account.updated` / `capability.updated` | Connect 売主状態 | Connect Epic |
| `payout.paid` / `payout.failed` | 出金同期 | Connect Epic |
| `charge.dispute.*` | チャージバック | P2 |

---

## 5. フォールバック経路（Webhook 非依存）

| Function | イベント | リスク |
|----------|----------|--------|
| `stripe-confirm-genai-checkout` | 同上 GenAI apply | success_url 到達時 · JWT なし |
| `stripe-confirm-checkout` | Featured apply | 同上 |

**本番推奨:** Webhook primary · confirm は UX 補助（P0-W1 検証済）。

---

## 6. エラー・再送マトリクス（全体）

| ケース | HTTP | Stripe 再送 |
|--------|------|-------------|
| secret 未設定 | 500 | ✅ |
| 署名欠落 | 400 | ❌ |
| 署名 NG | 400 | ❌ |
| apply 失敗 | 500 | ✅ |
| metadata 不足 Featured | 200 | ✅（無意味再送） |
| ハンドラ例外 | 500 | ✅ |

---

## 7. 監査ログ

| 種別 | 所在 | 備考 |
|------|------|------|
| Edge console | Supabase → `stripe-webhook` Logs | 一時保持 |
| Stripe delivery | Dashboard → Webhooks → Deliveries | **Live 前に 200 目視推奨** |
| DB 監査 | `featured_stripe_session_id` · `gen_ai_3d_ticket_grants.stripe_session_id` | 冪等キー |
| event.id テーブル | **未実装** | P2 観測性 |

---

## 8. 本番前に必要な確認（Live 切替時）

| # | 確認 | PASS 条件 |
|---|------|-----------|
| 1 | Live endpoint 3 イベント登録 | enabled_events 一致 |
| 2 | `STRIPE_WEBHOOK_SECRET` = Live whsec | 実決済で 200（400 なし） |
| 3 | confirm **前** DB 更新 | P0-W1 手順再現 |
| 4 | 二重 confirm 冪等 | grants / featured 増殖なし |
| 5 | Edge Logs エラー 0 | Live smoke 後 |
| 6 | Dashboard Deliveries 200 | 目視（推奨） |

---

## 9. Live 切替との関係

| 項目 | 変更要否 |
|------|----------|
| Webhook **コード** | **不要** |
| Live **endpoint 新規** | **必須** |
| Live **whsec** Secret | **必須** |
| イベント一覧 | **Test と同一で可** |

**検証:** 本レポート作成のみ · コード変更 0。
