# Stripe Live 本番化 — 実装計画

**作成日:** 2026-06-18  
**種別:** 調査・設計のみ（**コード変更なし**）  
**目的:** TASFUL で **最初の実売上**（GenAI 課金 + Featured 掲載課金）を発生させる  
**スコープ:** Stripe · Webhook · GenAI · Featured（**Marketplace / Connect / Builder は対象外**）  
**前提:** TALK / AI運営司令塔 / サポート導線は凍結 · P0-W1（Test Webhook PASS）完了

**参照:** [`stripe-webhook-final-check.md`](stripe-webhook-final-check.md) · [`stripe-webhook-p0-w1-delivery-check.md`](stripe-webhook-p0-w1-delivery-check.md) · [`revenue-production-readiness-review.md`](revenue-production-readiness-review.md) · [`supabase/STRIPE_FEATURED_SETUP.md`](../supabase/STRIPE_FEATURED_SETUP.md)

---

## エグゼクティブサマリー

| 項目 | 判定 |
|------|------|
| **GenAI + Featured のコード完成度** | ✅ Checkout / Webhook / confirm フォールバック実装済 |
| **Test 環境** | ✅ P0-W1 PASS — Webhook 経路で confirm 前 DB 更新を確認済 |
| **Live 環境** | ❌ **P0-W2 未実施** — `sk_live_` / Live `whsec_` / Live Price IDs |
| **本番化に必要なコード変更** | **なし**（運用・Secrets・Dashboard 設定のみ） |
| **最初の1円の最短経路** | Live Secrets 切替 → Live Webhook 登録 → Live 決済 smoke |

---

## 現状

### アーキテクチャ

```
[ブラウザ]
  gen-ai-workspace.html ──> stripe-genai-config.js ──> stripe-create-genai-checkout
  detail-*.html / post.html ──> stripe-featured-config.js ──> stripe-create-checkout
         │ Hosted Checkout リダイレクト（pk_* 不要）
         ▼
[Stripe Dashboard]
         │ checkout.session.completed 等
         ▼
[Supabase Edge] stripe-webhook/index.ts
         │ constructEventAsync + STRIPE_WEBHOOK_SECRET
         ├── apply-genai-plan.ts        → gen_ai_subscriptions
         ├── apply-genai-entitlements.ts → gen_ai_entitlements / gen_ai_3d_tickets / gen_ai_3d_ticket_grants
         └── apply-featured-listing.ts  → listings (is_featured, featured_until)

[フォールバック] success_url 到達時
  stripe-confirm-genai-checkout / stripe-confirm-checkout（anon 呼出可 · JWT なし）
```

**プロジェクト:** `ddojquacsyqesrjhcvmn`  
**Webhook URL（Test 登録済）:**  
`https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook`  
**Test Endpoint ID:** `we_1TR70n5tJSRSYcyiMrAzpuGF`

### 収益プラン一覧

| 種別 | プラン ID | 金額 | Checkout mode | DB 反映先 |
|------|-----------|------|---------------|-----------|
| GenAI | `genai_basic_300` | ¥300/月 | subscription | `gen_ai_subscriptions` |
| GenAI | `genai_pro_980` | ¥980/月 | subscription | 同上 |
| GenAI | `genai_2d_live_300` | ¥300/月 | subscription | `gen_ai_entitlements` |
| GenAI | `genai_3d_generate_500` | ¥500 | payment（単発） | `gen_ai_3d_tickets` + `gen_ai_3d_ticket_grants` |
| Featured | `featured_7days` | ¥980 | payment | `listings.is_featured` 等 |
| Featured | `featured_30days` | ¥2,980 | payment | 同上 |
| Featured | `pr_30days` | ¥4,980 | payment | 同上 |

### Edge Functions（GenAI + Featured スコープ）

| Function | 状態（監査時） | 役割 |
|----------|----------------|------|
| `stripe-webhook` | ACTIVE v21 | **唯一のサーバー Webhook** |
| `stripe-create-genai-checkout` | ACTIVE | GenAI Checkout Session 作成 |
| `stripe-confirm-genai-checkout` | ACTIVE | GenAI success_url フォールバック |
| `stripe-get-genai-plan` | ACTIVE | プラン・entitlements 読取 |
| `stripe-create-genai-portal` | ACTIVE | Customer Portal（解約・支払方法） |
| `stripe-create-checkout` | ACTIVE | Featured Checkout Session 作成 |
| `stripe-confirm-checkout` | ACTIVE | Featured success_url フォールバック |
| `stripe-setup-genai-catalog` | ACTIVE | **Test のみ** — 商品/Price/Webhook 自動セットアップ |

**JWT:** 上記 checkout/confirm/webhook は `verify_jwt = false`（`supabase/config.toml`）— anon key で呼出可。

### クライアント設定（秘密鍵なし）

| ファイル | 役割 |
|----------|------|
| `stripe-genai-config.js` | Edge URL · プラン表示 · `TASU_SUPABASE_CONFIG` から anon |
| `stripe-featured-config.js` | 同上（Featured） |
| `chat-supabase-config.js` | Supabase URL + anon key（ブラウザ公開可） |

**Stripe publishable key（`pk_test_` / `pk_live_`）はクライアントに存在しない** — Hosted Checkout リダイレクト方式。

### P0-W1 検証済み事項（Test）

| 検証 | 結果 |
|------|------|
| 署名なし POST | 400 `Missing stripe-signature` |
| 実決済 → confirm **前** DB 更新 | ✅ 3D / Basic / Featured |
| 二重 confirm 冪等 | ✅ 3D grants / Featured session_id |
| `node scripts/test-genai-stripe.mjs` | PASS |

---

## Test利用箇所

### 1. Supabase Secrets（Test 想定）

| Secret | 用途 | Live 時の変更 |
|--------|------|---------------|
| `STRIPE_SECRET_KEY` | 全 Stripe Edge API | **`sk_live_...` に差替** |
| `STRIPE_WEBHOOK_SECRET` | Webhook 署名検証 | **Live endpoint の `whsec_...` に差替** |
| `STRIPE_GENAI_PRICE_BASIC_300` | Basic サブスク Price ID | Live Price ID |
| `STRIPE_GENAI_PRICE_PRO_980` | Pro Price ID | Live Price ID |
| `STRIPE_GENAI_PRICE_2D_LIVE_300` | 2D Live Price ID | Live Price ID |
| `STRIPE_GENAI_PRICE_3D_GENERATE_500` | 3D チケット Price ID | Live Price ID |
| `SITE_URL` | success/cancel URL 基底 | **本番ドメイン** |
| `SUPABASE_SERVICE_ROLE_KEY` | DB apply | 変更なし |
| `SUPABASE_URL` | 自動注入 | 変更なし |

### 2. Test 専用ガード（コード内）

| 箇所 | ガード | Live 影響 |
|------|--------|-----------|
| `stripe-setup-genai-catalog/index.ts` | `sk_test_` 以外 → 403 | Live では **手動で Product/Price/Webhook 作成** |
| `stripe-e2e-simulate-genai-subscription` | `sk_test_` のみ | 本番では呼ばない / アクセス制限推奨 |
| `stripe-e2e-simulate-genai-addon` | 同上 | 同上 |
| `stripe-e2e-pay-genai-checkout` | 同上 | 同上 |

### 3. Test / Live 混在リスク箇所

| 箇所 | リスク |
|------|--------|
| `STRIPE_SECRET_KEY=sk_live_` + `STRIPE_WEBHOOK_SECRET=Test whsec` | 署名検証 **全失敗** |
| Live key + Test Price ID | Checkout **作成失敗** |
| `SITE_URL` 未設定 | success_url が `localhost:5173` フォールバック |
| Test endpoint に Live 決済イベント | 届かない / 署名不一致 |

### 4. Test 依存の運用スクリプト

| スクリプト | 用途 | Live 時 |
|------------|------|---------|
| `scripts/setup-genai-stripe-secrets.mjs` | `stripe-setup-genai-catalog` 呼出 → Secrets 反映 | **Test のみ有効** — Live は Dashboard 手動 |
| `scripts/test-genai-stripe.mjs` | GenAI smoke | Live smoke 用に **別手順**（本計画 §Live移行） |
| `scripts/e2e-genai-3d-stripe-purchase.mjs` | 3D 購入 E2E | Test card 前提 — Live では実カード or 限定テスト |

### 5. Price 未設定時のフォールバック（Test/Live 共通）

`STRIPE_GENAI_PRICE_*` が空の場合、`stripe-create-genai-checkout` は **`price_data` で動的生成**（Product metadata に `genai_plan`）。Live では **固定 Price ID を Secrets に設定することを強く推奨**（監査・会計のため）。

Featured は常に `price_data` 動的生成（`stripe-create-checkout/index.ts`）— Live でもコード変更不要。

---

## Live移行手順

### Phase A — 事前準備（コード変更なし）

| # | 作業 | 担当 | 詳細 |
|---|------|------|------|
| A-1 | Stripe Dashboard **Live mode** に切替 | 運用 | Developers → API keys で Live 有効化確認 |
| A-2 | Live Product / Price 作成 | 運用 | 下表「Live カタログ」参照 · metadata 必須 |
| A-3 | Live Webhook endpoint 作成 | 運用 | 同一 Supabase URL · イベント 3 種 |
| A-4 | ロールバック用 Test Secrets のバックアップ | 運用 | 現行 digest 記録 · Test whsec を安全保管 |
| A-5 | 本番 `SITE_URL` 確定 | 運用 | 例: `https://www.tasful.jp`（未確定ならデプロイ前に決定） |
| A-6 | `listings` RLS 本番確認 | 運用 | dev policy 残存時 featured 改ざんリスク（P1-W4） |

#### Live カタログ（Stripe Dashboard 手動作成）

**GenAI サブスク（Basic / Pro / 2D Live）**

| Product metadata | Price |
|------------------|-------|
| `genai_plan`: プラン ID | JPY · 月次 · 金額はコード定義通り |
| `order_type`: `genai_subscription` または `genai_2d_live_subscription` | |
| `tasful_product_id`: `prod_TASFUL_*` 参照 | |

**GenAI 3D チケット**

| metadata | Price |
|----------|-------|
| `genai_plan`: `genai_3d_generate_500` | JPY · 単発 ¥500 |
| `order_type`: `genai_3d_ticket` | lookup_key: `tasful_genai_3d_generate_500` 推奨 |

**Featured:** Checkout 時に `price_data` 生成のため **事前 Product 作成は任意**（metadata は Session 側で付与）。

### Phase B — Secrets 切替（メンテナンス窓推奨 · 5〜15 分）

```bash
# プロジェクトリンク済み前提
supabase link --project-ref ddojquacsyqesrjhcvmn

# Live 値に一括更新（値は Dashboard から取得 · リポジトリに書かない）
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_*** \
  STRIPE_WEBHOOK_SECRET=whsec_*** \
  STRIPE_GENAI_PRICE_BASIC_300=price_*** \
  STRIPE_GENAI_PRICE_PRO_980=price_*** \
  STRIPE_GENAI_PRICE_2D_LIVE_300=price_*** \
  STRIPE_GENAI_PRICE_3D_GENERATE_500=price_*** \
  SITE_URL=https://<本番ドメイン>
```

| 注意 | 内容 |
|------|------|
| **原子性** | `STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` は **同時に Live ペア**で更新 |
| **再デプロイ** | Secrets 変更後 Edge Functions は自動反映 · 任意で `supabase functions deploy stripe-webhook` |
| **確認** | `supabase secrets list` で digest 更新時刻を確認 |

### Phase C — Live Webhook 登録

| 項目 | 値 |
|------|-----|
| URL | `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook` |
| イベント | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |
| 署名 secret | Dashboard 表示の `whsec_...` → `STRIPE_WEBHOOK_SECRET` |

**Test endpoint（`we_1TR70n5tJSRSYcyiMrAzpuGF`）は残置可** — Live は **別 endpoint · 別 whsec**。

### Phase D — Live smoke（最初の1円検証）

| # | 手順 | 期待結果 |
|---|------|----------|
| D-1 | 本番 `gen-ai-workspace.html` で最低額プラン（Basic ¥300）を購入 | Stripe Live Checkout 表示 |
| D-2 | **confirm を意図的に遅延**（DevTools で success URL 到達前に DB 確認） | `gen_ai_subscriptions` に行追加 |
| D-3 | Stripe Dashboard → Webhooks → Live Deliveries | **200 OK** |
| D-4 | success_url 到達後 UI | プラン表示更新 · 二重付与なし |
| D-5 | Featured: 実 UUID `listings` 行で ¥980 プラン購入 | `is_featured=true` · `featured_stripe_session_id` 設定 |
| D-6 | Supabase Edge Logs `stripe-webhook` | `[stripe-webhook]` エラー 0 |

**検証 SQL（例）:**

```sql
-- GenAI Basic
SELECT user_id, plan_code, subscription_status, stripe_subscription_id, updated_at
FROM gen_ai_subscriptions ORDER BY updated_at DESC LIMIT 5;

-- Featured
SELECT id, is_featured, featured_plan, featured_until, featured_stripe_session_id
FROM listings WHERE featured_stripe_session_id IS NOT NULL ORDER BY updated_at DESC LIMIT 5;

-- 3D 冪等
SELECT user_id, stripe_session_id, created_at FROM gen_ai_3d_ticket_grants ORDER BY created_at DESC LIMIT 5;
```

---

## 実装順序

本計画は **コード実装順ではなく運用実施順**。いずれも **製品コード変更不要**。

| 順 | フェーズ | 内容 | ブロッカー |
|----|----------|------|------------|
| **1** | A-5 | 本番 `SITE_URL` 確定 | ホスト未確定 |
| **2** | A-2 | Live Product/Price 作成 | Stripe Live 有効化 |
| **3** | A-3 | Live Webhook endpoint 作成 | — |
| **4** | B | Supabase Secrets Live 切替 | A-2, A-3 の ID/whsec |
| **5** | D | Live smoke（GenAI → Featured） | B |
| **6** | — | 本番公開（Checkout 導線を一般ユーザーに開放） | D PASS |
| **7** | P1 | confirm JWT バインディング（別 Epic · 任意） | スケール前 |
| **8** | P1 | `listings` dev RLS 完全除去 | featured 改ざん防止 |

**並行不可:** Secrets 切替（4）より前に Live Price ID（2）が必要。  
**Marketplace / Connect は本計画に含めない** — 別 Epic。

---

## 必要シークレット

### 必須（Live 本番化）

| Secret | 形式 | 取得元 |
|--------|------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Live Webhook endpoint 作成時（**Test とは別**） |
| `STRIPE_GENAI_PRICE_BASIC_300` | `price_...` | Live Product/Price |
| `STRIPE_GENAI_PRICE_PRO_980` | `price_...` | 同上 |
| `STRIPE_GENAI_PRICE_2D_LIVE_300` | `price_...` | 同上 |
| `STRIPE_GENAI_PRICE_3D_GENERATE_500` | `price_...` | 同上 |
| `SITE_URL` | `https://...` | 本番フロント URL（末尾 `/` なし） |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT | Supabase Dashboard（既存） |

### 自動注入（設定不要）

| 変数 | 供給元 |
|------|--------|
| `SUPABASE_URL` | Supabase Edge ランタイム |

### リポジトリに含めてはいけないもの

- `sk_test_` / `sk_live_` / `whsec_` / `price_` の実値
- `SUPABASE_SERVICE_ROLE_KEY` 平文

**検出:** `scripts/scan-staged-secrets.mjs` · `scripts/report-deploy-git-manifest.mjs`

---

## Webhook一覧

### サーバー Webhook（本番）

| 項目 | 値 |
|------|-----|
| **Endpoint** | `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook` |
| **実装** | `supabase/functions/stripe-webhook/index.ts` |
| **認証** | `stripe-signature` + `STRIPE_WEBHOOK_SECRET` |
| **JWT** | なし（Stripe → Edge 直接） |

### 購読イベント（GenAI + Featured スコープ）

| イベント | 処理 | DB / 副作用 |
|----------|------|-------------|
| `checkout.session.completed` | GenAI metadata 判定 → apply | subscriptions / entitlements / 3D tickets |
| `checkout.session.completed` | `listing_id` + `featured_plan` → apply | `listings` featured 列 |
| `customer.subscription.updated` | GenAI / 2D Live sync | プラン状態 · period_end |
| `customer.subscription.deleted` | GenAI / 2D Live sync | 解約 · free 降格 |

### 未購読（本スコープ外 · 将来 Epic）

| イベント | 影響 |
|----------|------|
| `checkout.session.completed` (`shop_product`) | Marketplace |
| `invoice.payment_failed` | サブスク支払失敗通知 |
| `charge.refunded` | 返金後 entitlement 取り消し |
| `account.*` / `payout.*` | Connect |

### ブラウザ sim（本番 Webhook ではない）

| 所在 | 用途 |
|------|------|
| `stripe-connect-ingest.js` | Connect イベント sim → localStorage |
| `admin-ai-kpi-center.js` | ingest ログ読取 |

---

## 成功時処理

### GenAI — `checkout.session.completed`

| プラン | 分岐条件 | apply 関数 | 書込先 |
|--------|----------|------------|--------|
| Basic / Pro | `order_type=genai_subscription` | `syncGenAiFromStripeSubscription` or `applyGenAiPlanFromCheckout` | `gen_ai_subscriptions` |
| 2D Live | `order_type=genai_2d_live_subscription` | `sync2dLiveFromStripeSubscription` | `gen_ai_entitlements` |
| 3D チケット | `order_type=genai_3d_ticket` | `apply3dTicketFromCheckout` | `gen_ai_3d_tickets` + `gen_ai_3d_ticket_grants` |

**前提:** `payment_status=paid` or `status=complete` · metadata に `user_id` + `genai_plan`

### Featured — `checkout.session.completed`

| 条件 | apply | 結果 |
|------|-------|------|
| `listing_id` + `featured_plan` + paid | `applyFeaturedToListing` | `is_featured=true`, `featured_until`, `featured_stripe_session_id` |

### サブスク更新 — `customer.subscription.updated/deleted`

| 対象 | 処理 |
|------|------|
| Basic / Pro | `syncGenAiFromStripeSubscription` — status / period_end / cancel 反映 |
| 2D Live | `sync2dLiveFromStripeSubscription` / `deactivate2dLiveEntitlement` |

### 冪等性（二重付与防止）

| 経路 | 机制 |
|------|------|
| Featured | `featured_stripe_session_id === session.id` なら skip |
| 3D チケット | `gen_ai_3d_ticket_grants.stripe_session_id` UNIQUE チェック → `alreadyGranted` |
| サブスク | `stripe_subscription_id` upsert |

### クライアント success_url フォールバック

| ページ | 処理 |
|--------|------|
| `gen-ai-workspace.html?genai_checkout=success&session_id=...` | `confirmGenAiCheckout()` → `stripe-confirm-genai-checkout` |
| `detail-*.html?featured_checkout=success&session_id=...` | `confirmCheckoutSession()` → `stripe-confirm-checkout` |

**本番推奨:** Webhook を primary · confirm は UX 高速化の secondary（P0-W1 と同じ）。

---

## 失敗時処理

### Webhook レイヤ

| ケース | HTTP | Stripe 再送 | ログ |
|--------|------|-------------|------|
| `STRIPE_*` secret 未設定 | 500 | ✅ | 早期 return |
| 署名欠落 | 400 | ❌ | — |
| 署名不一致 | 400 | ❌ | `[stripe-webhook] signature verification failed` |
| GenAI apply DB エラー | 500 | ✅ | `[stripe-webhook] genai apply failed` |
| Featured apply DB エラー | 500 | ✅ | `[stripe-webhook] apply failed` |
| metadata 不足（Featured） | 200 skip | ✅（修復されない） | `missing metadata` warn |
| ハンドラ例外 | 500 | ✅ | stack trace |

### Checkout 作成レイヤ

| ケース | 応答 |
|--------|------|
| `STRIPE_SECRET_KEY` 未設定 | 500 |
| 無効 `user_id` / `listing_id` | 400 / 404 |
| Stripe API エラー | 500 + message |

### confirm フォールバック

| ケース | 応答 |
|--------|------|
| 未払い session | 402 `決済が完了していません` |
| metadata 欠落 | 400 |

### サブスク支払失敗（`invoice.payment_failed`）

**現状: Webhook 未処理** — Stripe がリトライ · 最終的に `subscription.updated` で status 変化する可能性はあるが、**専用通知・即時 free 降格は未実装**。Live 初期は Stripe Dashboard + Customer Portal で運用対応。

### 運用エスカレーション

1. Stripe Dashboard → Webhooks → Failed deliveries 確認  
2. Supabase → Edge Functions → `stripe-webhook` Logs  
3. 手動: paid `session_id` で `stripe-confirm-*` を **一度だけ** 呼出（冪等）  
4. それでも不可: service_role で DB 手動補正（Runbook 別途）

---

## 返金処理

### 現状（コード調査結果）

| 項目 | 状態 |
|------|------|
| `charge.refunded` Webhook | **未実装** |
| `charge.refund.updated` | **未実装** |
| Dashboard 手動返金 → DB 自動巻き戻し | **なし** |
| サブスク解約 | ✅ `customer.subscription.deleted` → plan sync |
| Customer Portal | ✅ `stripe-create-genai-portal` — ユーザー自助解約 |

### プラン別の返金影響（Live 運用時）

| 種別 | Stripe 返金後の DB | 推奨運用（コード変更前） |
|------|-------------------|-------------------------|
| GenAI サブスク | Portal 解約で sync · **返金のみでは自動降格しない** | Dashboard 返金 + 必要なら subscription cancel |
| 2D Live | 同上 | 同上 |
| 3D チケット（単発） | **チケット残数は減らない** | 返金時 service_role で tickets 調整 |
| Featured（単発） | **featured 状態は維持** | 返金時 listings featured 手動解除 |

### 将来 Epic（本計画スコープ外）

- `charge.refunded` → entitlement 取り消し / featured 解除  
- 返金監査ログテーブル  
- 運営 UI からの返金トリガー

---

## 監査ログ

### 現状のログ源

| レイヤ | 内容 | 保持 |
|--------|------|------|
| Supabase Edge Logs | `[stripe-webhook]` / `[apply-featured]` / `[genai-entitlements]` console | Dashboard 期間限定 |
| Stripe Dashboard | Webhook deliveries · Payments · Customers | Stripe 保持 |
| DB: `gen_ai_3d_ticket_grants` | `stripe_session_id` 付与記録 | 永続 |
| DB: `listings.featured_stripe_session_id` | Featured 決済 session | 永続 |
| DB: `gen_ai_subscriptions` | `stripe_subscription_id`, status, updated_at | 永続 |

### 未実装（ギャップ）

| 項目 | 影響 |
|------|------|
| `stripe_webhook_events` テーブル | event.id 単位の冪等・監査不可 |
| 構造化 audit log（誰が・いつ・何円） | 会計連携は Stripe Dashboard 依存 |
| Live/Test モードフラグ on payment rows | 混在排查困難 |

### Live 本番化時の監視設定（推奨 · コード変更なし）

| 監視 | 方法 |
|------|------|
| Webhook 失敗 | Stripe Dashboard アラート（failed delivery） |
| Edge 5xx | Supabase Log drain / 定期確認 |
| 売上確認 | Stripe Dashboard → Payments（Live mode） |
| DB 整合 | 日次: subscriptions 件数 vs Stripe active subscriptions |

---

## 想定リスク

| ID | リスク | 深刻度 | 対策 |
|----|--------|--------|------|
| R-1 | Test/Live whsec 混在 | **高** | ペア同時更新 · smoke 必須 |
| R-2 | Live Price ID 未設定 → 動的 price_data | 中 | Secrets 4 件を必ず設定 |
| R-3 | `SITE_URL` localhost 残存 | **高** | 切替前に本番 URL 確定 |
| R-4 | confirm-* JWT なし · session_id 悪用 | 中 | Live 初期は低リスク · P1 で JWT 绑定 |
| R-5 | 返金後 entitlement 残存 | 中 | 運用手順（§返金）· 将来 Webhook |
| R-6 | metadata 欠落 Featured → 200 skip | 中 | Checkout 作成側は必須 metadata · ログ監視 |
| R-7 | `listings` dev RLS 残存 | 中 | RLS verify 再実行 |
| R-8 | E2E simulate 関数が Live key で呼ばれる | 低 | Dashboard IP 制限 / 関数無効化検討 |
| R-9 | 本番ホスト未確定で Checkout 導線公開 | **高** | smoke 完了まで限定公開 |
| R-10 | Webhook 未到達 + ユーザーが success URL も閉じる | 低 | confirm フォールバック + 運営 manual apply |

---

## ロールバック手順

### 即時ロールバック（決済障害時 · 5 分以内目標）

| # | 作業 |
|---|------|
| 1 | Stripe Dashboard → Live Webhook endpoint を **Disable**（または削除） |
| 2 | Supabase Secrets を **Test ペア**に戻す: |
| | `STRIPE_SECRET_KEY=sk_test_...` |
| | `STRIPE_WEBHOOK_SECRET=whsec_...`（Test endpoint の値） |
| 3 | `STRIPE_GENAI_PRICE_*` を Test Price ID に戻す |
| 4 | 本番サイトの Checkout CTA を一時非表示（**運用** · コード変更なしならメンテ告知） |
| 5 | Edge Logs で Test 鍵でのエラー消失を確認 |

### 部分ロールバック

| 状況 | 対応 |
|------|------|
| GenAI のみ障害 | Featured は Live 維持不可（同一 `STRIPE_SECRET_KEY`）— **全 Stripe を Test に戻す** |
| 特定プランのみ Price 誤り | 該当 `STRIPE_GENAI_PRICE_*` のみ修正 · 関数再デプロイ不要 |
| 誤付与 DB 行 | service_role で手動修正 · Stripe 側 refund/cancel |

### ロールバック後の確認

```bash
node scripts/test-genai-stripe.mjs   # Test mode smoke
```

### バックアップ保持項目

| 項目 | 保管場所 |
|------|----------|
| Test `sk_test_` / `whsec_` | パスワードマネージャ / Ops vault |
| Test Price IDs 4 件 | 同上 |
| Live 切替日時・実施者 | 本 Runbook 記録 |

---

## 最初の1円が入るまでの手順（時系列）

以下は **GenAI Basic ¥300/月** を最初の実売上とする標準シナリオ。Featured を先にする場合は Phase 6 を Phase 5 と入替可。

---

### T-7〜T-1 日（準備）

| 時刻目安 | 作業 | 成果物 |
|----------|------|--------|
| | Stripe アカウント Live 有効化確認（本人確認・口座） | Dashboard Live 利用可 |
| | 本番フロント URL（`SITE_URL`）確定 | URL 決定書 |
| | Live Product/Price 4 件作成（Basic/Pro/2D/3D） | Price ID 一覧（vault 保管） |
| | Test Secrets バックアップ | ロールバック用メモ |
| | `listings` RLS 本番状態確認 | verify PASS 記録 |

---

### T-0 日 — 切替日

#### 09:00 — Live Webhook 登録

1. Stripe Dashboard → **Live mode** → Developers → Webhooks → **Add endpoint**
2. URL: `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. 作成直後の **`whsec_...` を控える**（再表示不可）

#### 09:15 — Supabase Secrets 更新

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_*** STRIPE_WEBHOOK_SECRET=whsec_***
supabase secrets set STRIPE_GENAI_PRICE_BASIC_300=price_*** ... (4件)
supabase secrets set SITE_URL=https://<本番ドメイン>
```

#### 09:25 — 疎通確認（決済前）

```bash
curl -X POST https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook
# 期待: 400 Missing stripe-signature
```

#### 09:30 — 最初の Live 決済（内部テスト）

1. 本番 `gen-ai-workspace.html` を開く（テスト用 `user_id` でログイン済み状態）
2. **生成AIスタンダード ¥300/月** を選択 → Checkout
3. **実カード**で Live 決済完了
4. **success URL 到達前**（可能なら 2〜3 秒待ち）に Supabase SQL Editor:

```sql
SELECT * FROM gen_ai_subscriptions
WHERE user_id = '<テスト user_id>'
ORDER BY updated_at DESC LIMIT 1;
```

5. **行が存在 · plan_code = basic_300** → **Webhook 経路成功**

#### 09:35 — Stripe 側確認

1. Stripe Dashboard → **Payments**（Live）→ 該当 **¥300** が **Succeeded**
2. Webhooks → Live endpoint → Deliveries → 最新 **200 OK**

#### 09:40 — クライアント confirm 確認

1. success URL 到達 → ワークスペース UI にプラン反映
2. 再度 SQL — **二重行なし**（upsert 冪等）

#### 10:00 — Featured 第2売上（任意 · 同日）

1. 本番 Supabase に存在する **UUID listings** 行を用意
2. 掲載詳細 → **上位掲載（7日）¥980** → Live Checkout
3. 決済後 `listings.is_featured = true` · `featured_stripe_session_id` 設定を確認
4. Stripe Payments に **+¥980**

#### 10:30 — 公開判定

| 条件 | 状態 |
|------|------|
| Live Webhook 200 | ☐ |
| GenAI DB 反映 | ☐ |
| Stripe Payments Live 表示 | ☐ |
| Edge Logs エラー 0 | ☐ |
| ロールバック手順共有済 | ☐ |

**→ 全 PASS で一般ユーザーへの Checkout 導線公開 = 「最初の1円」達成**

---

### T+1 日 — 安定化

| 作業 |
|------|
| 24h Stripe Deliveries 再確認 |
| サブスク Portal（解約）Live smoke |
| 運用 Runbook 共有（返金 · 手動 apply · ロールバック） |
| P1 バックログ起票: confirm JWT · `charge.refunded` · audit テーブル |

---

## 付録 — ファイル索引

| 領域 | パス |
|------|------|
| Webhook 本体 | `supabase/functions/stripe-webhook/index.ts` |
| GenAI create/confirm | `supabase/functions/stripe-create-genai-checkout/`, `stripe-confirm-genai-checkout/` |
| Featured create/confirm | `supabase/functions/stripe-create-checkout/`, `stripe-confirm-checkout/` |
| apply 共有 | `supabase/functions/_shared/apply-genai-plan.ts`, `apply-genai-entitlements.ts`, `apply-featured-listing.ts` |
| プラン定義 | `supabase/functions/_shared/genai-plans.ts`, `genai-checkout-plans.ts`, `featured-plans.ts` |
| クライアント GenAI | `stripe-genai-config.js`, `gen-ai-workspace.js` |
| クライアント Featured | `stripe-featured-config.js`, `listing-featured.js` |
| Test セットアップ | `supabase/functions/stripe-setup-genai-catalog/`, `scripts/setup-genai-stripe-secrets.mjs` |
| 検証 | `scripts/test-genai-stripe.mjs`, `reports/stripe-webhook-p0-w1-delivery-check.md` |
| 手順書 | `supabase/STRIPE_FEATURED_SETUP.md`, `docs/production-release-checklist.md` |

---

**判定:** GenAI + Featured の **Live 本番化はコード変更なしで可能**。残作業は **Stripe Dashboard + Supabase Secrets + Live smoke** の運用タスク（P0-W2）。完了即可に **最初の実売上**（GenAI ¥300 または Featured ¥980）が発生する。
