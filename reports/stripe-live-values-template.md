# Stripe Live 切替 — 実値記入テンプレート

**用途:** Stripe Live 承認後、Supabase Secrets / Stripe Dashboard に入力する値の控え  
**記入者:** _______________　**記入日:** _______________  
**切替実施日:** _______________　**ロールバック担当:** _______________

> ⚠️ **このファイルに `sk_live_` / `whsec_` / `price_` の実値を Git コミットしないこと。**  
> 記入後は Ops vault / パスワードマネージャに保管し、リポジトリからは削除または `[VAULT]` のみ残す。

**参照:** [`stripe-live-go-live-checklist.md`](stripe-live-go-live-checklist.md) · [`stripe-live-cutover-audit.md`](stripe-live-cutover-audit.md)

**Supabase プロジェクト:** `ddojquacsyqesrjhcvmn`

**本番 URL（P0-W4 確定 · 2026-06-18）:** `https://tasful.jp`（末尾 `/` なし · **www なし**）  
**参照:** [`stripe-ready-check.md`](stripe-ready-check.md)

---

## 0. 切替前バックアップ（Test · 必ず先に記入）

> **保管場所:** 実値（`sk_test_` / `whsec_` / `price_`）は **Ops vault のみ**。Git には `[VAULT]` または空欄のまま。  
> **P0-W4:** Endpoint ID · SITE_URL 方針はリポジトリに記録済み。残り 6 項目は vault 転記後 ☑。

| 項目 | Test / 現行値（vault 参照） | 記入済 |
|------|----------------------------|--------|
| Test `STRIPE_SECRET_KEY` | `[VAULT]` Stripe Dashboard → Test → API keys → Secret key | ☐ |
| Test `STRIPE_WEBHOOK_SECRET` | `[VAULT]` Test endpoint `we_1TR70n...` → Signing secret | ☐ |
| Test Endpoint ID | `we_1TR70n5tJSRSYcyiMrAzpuGF` | ☑ |
| Test Price BASIC_300 | `[VAULT]` Secret `STRIPE_GENAI_PRICE_BASIC_300` または Dashboard Test Products | ☐ |
| Test Price PRO_980 | `[VAULT]` 同上 `STRIPE_GENAI_PRICE_PRO_980` | ☐ |
| Test Price 2D_LIVE_300 | `[VAULT]` 同上 `STRIPE_GENAI_PRICE_2D_LIVE_300` | ☐ |
| Test Price 3D_GENERATE_500 | `[VAULT]` 同上 `STRIPE_GENAI_PRICE_3D_GENERATE_500` | ☐ |
| 切替前 `SITE_URL` | **未設定**（`supabase secrets list` に無し · P0-W4 確認） | ☑ |
| 本番 `SITE_URL`（投入予定） | `https://tasful.jp`（**Live 切替時または静的ホスト稼働後に投入**） | ☑ 方針 |

**vault 転記チェック（Ops · Stripe 承認前に完了）:**

```text
☐ STRIPE_SECRET_KEY      sk_test_...
☐ STRIPE_WEBHOOK_SECRET  whsec_...  （endpoint we_1TR70n5tJSRSYcyiMrAzpuGF とペア）
☐ price BASIC_300        price_...
☐ price PRO_980          price_...
☐ price 2D_LIVE_300      price_...
☐ price 3D_GENERATE_500  price_...
```

**Dashboard から取得（Secrets digest だけでは復元不可）:** Price ID ×4 · Webhook signing secret（初回作成時控え · 再表示不可の場合は Roll で再発行）

---

## 1. Live 切替で更新する Secret 一覧

| # | Secret 名 | Live 更新 |
|---|-----------|-----------|
| 1 | `STRIPE_SECRET_KEY` | ☐ |
| 2 | `STRIPE_WEBHOOK_SECRET` | ☐ |
| 3 | `STRIPE_GENAI_PRICE_BASIC_300` | ☐ |
| 4 | `STRIPE_GENAI_PRICE_PRO_980` | ☐ |
| 5 | `STRIPE_GENAI_PRICE_2D_LIVE_300` | ☐ |
| 6 | `STRIPE_GENAI_PRICE_3D_GENERATE_500` | ☐ |
| 7 | `SITE_URL` | ☐ |

**一括更新コマンド（値は vault から貼付 · 実行前にダブルチェック）:**

```bash
supabase link --project-ref ddojquacsyqesrjhcvmn

supabase secrets set \
  STRIPE_SECRET_KEY=【sk_live_...】 \
  STRIPE_WEBHOOK_SECRET=【whsec_...】 \
  STRIPE_GENAI_PRICE_BASIC_300=【price_...】 \
  STRIPE_GENAI_PRICE_PRO_980=【price_...】 \
  STRIPE_GENAI_PRICE_2D_LIVE_300=【price_...】 \
  STRIPE_GENAI_PRICE_3D_GENERATE_500=【price_...】 \
  SITE_URL=https://tasful.jp
```

---

## 2. Secret 別詳細テンプレート

---

### 2.1 `STRIPE_SECRET_KEY`

| 項目 | 内容 |
|------|------|
| **現在値種別** | Test（`sk_test_...` 想定 · P0-W1 PASS） |
| **Live で入れる値** | `sk_live________________________________` |
| **取得場所** | Stripe Dashboard → **Live mode** → Developers → **API keys** → Secret key |
| **使用 Function** | `stripe-webhook` · `stripe-create-genai-checkout` · `stripe-confirm-genai-checkout` · `stripe-create-genai-portal` · `stripe-get-genai-plan` · `stripe-create-checkout` · `stripe-confirm-checkout` · （Marketplace/手数料: `stripe-create-shop-checkout` 等 · 同一 Secret） |
| **失敗時の影響** | Checkout 作成不可 · Webhook 内 subscription 取得不可 · **全 Stripe 決済停止** |
| **ロールバック値** | §0 Test `sk_test_...` |
| **チェック** | ☐ Live mode でコピーした ☐ `sk_live_` プレフィックス確認 ☐ Test キーと混同していない |

---

### 2.2 `STRIPE_WEBHOOK_SECRET`

| 項目 | 内容 |
|------|------|
| **現在値種別** | Test endpoint `we_1TR70n5tJSRSYcyiMrAzpuGF` の `whsec_...` |
| **Live で入れる値** | `whsec________________________________` |
| **取得場所** | Stripe Dashboard → **Live mode** → Developers → **Webhooks** → 【Live endpoint 名】→ **Signing secret**（作成直後のみ全文表示 · **必ず控える**） |
| **使用 Function** | **`stripe-webhook` のみ**（`constructEventAsync` 署名検証） |
| **失敗時の影響** | 全 Webhook **400 Invalid signature** · DB 未更新 · ユーザー支払済みだが権限未付与 |
| **ロールバック値** | §0 Test `whsec_...` + Test endpoint を再有効化 |
| **チェック** | ☐ Live endpoint 用の whsec ☐ Test whsec と別値 ☐ `STRIPE_SECRET_KEY` と同時更新 |

---

### 2.3 `STRIPE_GENAI_PRICE_BASIC_300`

| 項目 | 内容 |
|------|------|
| **現在値種別** | Test `price_...`（Supabase Secrets 設定済） |
| **Live で入れる値** | `price________________________________` |
| **取得場所** | Stripe Dashboard → **Live** → Products → 【GenAI Basic】→ Price → **Price ID** |
| **使用 Function** | `stripe-create-genai-checkout`（via `_shared/genai-plans.ts` · `genai-checkout-plans.ts`） |
| **失敗時の影響** | Basic Checkout 失敗 or 動的 `price_data` フォールバック（非推奨） |
| **ロールバック値** | §0 Test `price_...` |
| **チェック** | ☐ 金額 **¥300/月** ☐ JPY ☐ Secret 名 **`_BASIC_300`**（`BASIC` のみ不可） |

---

### 2.4 `STRIPE_GENAI_PRICE_PRO_980`

| 項目 | 内容 |
|------|------|
| **現在値種別** | Test `price_...` |
| **Live で入れる値** | `price________________________________` |
| **取得場所** | Stripe Dashboard → **Live** → Products → 【GenAI Pro】→ Price ID |
| **使用 Function** | `stripe-create-genai-checkout` |
| **失敗時の影響** | Pro Checkout 失敗 |
| **ロールバック値** | §0 Test `price_...` |
| **チェック** | ☐ **¥980/月** ☐ Secret 名 **`_PRO_980`** |

---

### 2.5 `STRIPE_GENAI_PRICE_2D_LIVE_300`

| 項目 | 内容 |
|------|------|
| **現在値種別** | Test `price_...` |
| **Live で入れる値** | `price________________________________` |
| **取得場所** | Stripe Dashboard → **Live** → Products → 【TASFUL AI 2D Live】→ Price ID |
| **使用 Function** | `stripe-create-genai-checkout` |
| **失敗時の影響** | 2D Live サブスク Checkout 失敗 |
| **ロールバック値** | §0 Test `price_...` |
| **チェック** | ☐ **¥300/月** · subscription ☐ lookup_key `tasful_genai_2d_live_300` 推奨 |

---

### 2.6 `STRIPE_GENAI_PRICE_3D_GENERATE_500`

| 項目 | 内容 |
|------|------|
| **現在値種別** | Test `price_...` |
| **Live で入れる値** | `price________________________________` |
| **取得場所** | Stripe Dashboard → **Live** → Products → 【TASFUL AI 3D Generate】→ Price ID |
| **使用 Function** | `stripe-create-genai-checkout` |
| **失敗時の影響** | 3D チケット Checkout 失敗 |
| **ロールバック値** | §0 Test `price_...` |
| **チェック** | ☐ **¥500** · **one-time**（recurring なし） ☐ lookup_key `tasful_genai_3d_generate_500` 推奨 |

---

### 2.7 `SITE_URL`

| 項目 | 内容 |
|------|------|
| **現在値種別** | **未設定**（P0-W4: `supabase secrets list` に `SITE_URL` なし） |
| **Live で入れる値** | `https://tasful.jp`（末尾 **`/` なし** · P0-W4 確定） |
| **取得場所** | 本番フロント公開 URL（運用確定値） |
| **使用 Function** | `stripe-create-genai-checkout` · `stripe-create-checkout`（Featured）· `stripe-create-genai-portal` · （Shop/手数料は本スコープ外だが同一 Secret） |
| **失敗時の影響** | success/cancel URL が **`http://localhost:5173` に fallback** · 決済後ユーザーが本番に戻れない |
| **ロールバック値** | 本番 URL のままで可（Test 切替時も変更不要） |
| **チェック** | ☐ HTTPS ☐ 末尾スラッシュなし ☐ `gen-ai-workspace.html` がこの origin で開ける |

---

## 3. 未使用（別枠）

### `STRIPE_PUBLISHABLE_KEY`（`pk_live_` / `pk_test_`）

| 項目 | 内容 |
|------|------|
| **使用有無** | **未使用** — リポジトリ・Supabase Secrets に定義なし |
| **理由** | Hosted Checkout リダイレクト方式（クライアントは Supabase anon key のみ） |
| **Live 切替** | **設定不要** |
| **チェック** | ☐ 誤って Secrets に追加しない |

---

## 4. Live Product / Price 作成テンプレート

Stripe Dashboard → **Live mode** → **Product catalog** → Add product

### 4.1 GenAI Basic — ¥300/月

| 項目 | 記入 |
|------|------|
| **Product 名** | 生成AIスタンダード（または `GENAI Basic`） |
| **metadata `genai_plan`** | `genai_basic_300` |
| **metadata `order_type`** | `genai_subscription` |
| **metadata `tasful_product_id`** | `prod_TASFUL_GENAI_BASIC_300` |
| **Price 金額** | **¥300** JPY |
| **Billing interval** | **Monthly（月次）** |
| **Live Price ID** | `price________________________________` |
| **対応 Secret** | `STRIPE_GENAI_PRICE_BASIC_300` |
| **チェック** | ☐ Product active ☐ Price active ☐ Secret に反映 |

---

### 4.2 GenAI Pro — ¥980/月

| 項目 | 記入 |
|------|------|
| **Product 名** | 生成AIプロ |
| **metadata `genai_plan`** | `genai_pro_980` |
| **metadata `order_type`** | `genai_subscription` |
| **metadata `tasful_product_id`** | `prod_TASFUL_GENAI_PRO_980` |
| **Price 金額** | **¥980** JPY |
| **Billing interval** | **Monthly** |
| **Live Price ID** | `price________________________________` |
| **対応 Secret** | `STRIPE_GENAI_PRICE_PRO_980` |
| **チェック** | ☐ |

---

### 4.3 GenAI 2D Live — ¥300/月

| 項目 | 記入 |
|------|------|
| **Product 名** | TASFUL AI 2D Live |
| **metadata `genai_plan`** | `genai_2d_live_300` |
| **metadata `order_type`** | `genai_2d_live_subscription` |
| **metadata `tasful_product_id`** | `prod_TASFUL_GENAI_2D_LIVE_300` |
| **Price 金額** | **¥300** JPY |
| **Billing interval** | **Monthly** |
| **lookup_key（推奨）** | `tasful_genai_2d_live_300` |
| **Live Price ID** | `price________________________________` |
| **対応 Secret** | `STRIPE_GENAI_PRICE_2D_LIVE_300` |
| **チェック** | ☐ |

---

### 4.4 GenAI 3D Generate — ¥500 単発

| 項目 | 記入 |
|------|------|
| **Product 名** | TASFUL AI 3D Generate |
| **metadata `genai_plan`** | `genai_3d_generate_500` |
| **metadata `order_type`** | `genai_3d_ticket` |
| **metadata `tasful_product_id`** | `prod_TASFUL_GENAI_3D_GENERATE_500` |
| **Price 金額** | **¥500** JPY |
| **Billing interval** | **One time（単発）** |
| **lookup_key（推奨）** | `tasful_genai_3d_generate_500` |
| **Live Price ID** | `price________________________________` |
| **対応 Secret** | `STRIPE_GENAI_PRICE_3D_GENERATE_500` |
| **チェック** | ☐ recurring **なし** |

---

### 4.5 Featured 掲載（参考 · Price Secret なし）

Featured は Checkout 時に `price_data` 動的生成。**事前 Product 作成は任意。**

| プラン ID | 金額 | 日数 |
|-----------|------|------|
| `featured_7days` | ¥980 | 7 |
| `featured_30days` | ¥2,980 | 30 |
| `pr_30days` | ¥4,980 | 30 |

---

## 5. Webhook 作成テンプレート

### 5.1 Endpoint

| 項目 | 記入 |
|------|------|
| **Stripe mode** | **Live** |
| **Endpoint URL** | `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook` |
| **Endpoint 名（任意）** | `TASFUL Live — GenAI + Featured` |
| **Live Endpoint ID** | `we__________________________________` |
| **チェック** | ☐ URL  typo なし ☐ Test endpoint `we_1TR70n...` とは **別 ID** |

### 5.2 Events（この 3 つのみで可）

| イベント | 有効 |
|----------|------|
| `checkout.session.completed` | ☐ |
| `customer.subscription.updated` | ☐ |
| `customer.subscription.deleted` | ☐ |

### 5.3 Signing secret

| 項目 | 記入 |
|------|------|
| **Signing secret** | `whsec________________________________` |
| **投入先** | Supabase Secret **`STRIPE_WEBHOOK_SECRET`** |
| **チェック** | ☐ 作成直後に控えた ☐ Test whsec と **別値** |

---

## 6. 最初の1円チェック（¥300 · GenAI Basic）

**テスト user_id:** `________________________________`  
**実施時刻:** _______________  
**Session ID（控え）:** `cs_live________________________________`

| # | 確認項目 | PASS | 確認方法 / メモ |
|---|----------|------|-----------------|
| 1 | **¥300 Checkout 起動** | ☐ | 本番 `gen-ai-workspace.html` → 生成AIスタンダード → Stripe **Live** 画面 |
| 2 | **Live 決済成功** | ☐ | 実カード · Stripe 成功画面 |
| 3 | **Webhook 200** | ☐ | Dashboard → Webhooks → Live → Deliveries → 最新 **200** |
| 4 | **DB 反映**（confirm 前推奨） | ☐ | `gen_ai_subscriptions` · `plan_code=basic_300` · `user_id=【上記】` |
| 5 | **UI 権限反映** | ☐ | ワークスペースに Basic 表示 · 日次上限 30 等 |
| 6 | **Stripe Dashboard Payments** | ☐ | Live → Payments → **¥300 Succeeded** |

**SQL（Supabase SQL Editor）:**

```sql
SELECT user_id, plan_code, subscription_status, stripe_subscription_id, updated_at
FROM gen_ai_subscriptions
WHERE user_id = '【テスト user_id】'
ORDER BY updated_at DESC LIMIT 3;
```

**Featured 第2売上（任意 · ¥980）:**

| 項目 | PASS |
|------|------|
| listings UUID | `________________________________` |
| `is_featured = true` | ☐ |
| `featured_stripe_session_id` 設定 | ☐ |
| Payments +¥980 | ☐ |

---

## 7. 注意点

### 7.1 必読

| # | 注意 |
|---|------|
| 1 | **`SITE_URL` 未設定** → Edge Functions が **`http://localhost:5173` に fallback**。Live 前に必ず Secret 設定。 |
| 2 | **Price Secret 名を間違えない** — 実在名は `_BASIC_300` / `_PRO_980` / `_2D_LIVE_300` / `_3D_GENERATE_500`。`ULTRA` · `ENTERPRISE` · `BASIC`（后缀なし）は **存在しない**。 |
| 3 | **Webhook secret は Test と Live で別** — Live `sk_live_` + Test `whsec_` の混在は **全 Webhook 失敗**。 |
| 4 | **`STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` はペアで同時更新**。 |
| 5 | **Live Product/Price は Test モードでは作成しない** — Dashboard 右上が Live であることを確認。 |

### 7.2 反映遅延・タイミング

| 現象 | 対処 |
|------|------|
| Secrets 更新直後 Checkout が旧挙動 | 数秒〜1 分待機 · 必要なら `supabase functions deploy stripe-webhook`（任意） |
| Webhook 200 だが DB 空 | 2〜5 秒待って再クエリ · metadata `user_id` 確認 |
| success URL 到達後のみ UI 更新 | Webhook 未到達時 — confirm フォールバックが UI を更新（正常系は Webhook 先行） |
| Stripe Dashboard Payments に表示遅延 | 数十秒〜数分 · **Deliveries 200 を先に確認** |
| サブスク entitlement が UI に即反映されない | `stripe-get-genai-plan` 再読込 · ページリロード |

### 7.3 ロールバック早見

| 手順 | 操作 |
|------|------|
| 1 | Live Webhook endpoint → **Disable** |
| 2 | Supabase Secrets → §0 Test 値に戻す |
| 3 | `node scripts/test-genai-stripe.mjs` → PASS |
| 想定時間 | **5〜7 分** |

---

## 8. 実施サインオフ

| 役割 | 名前 | 日時 | 署名 |
|------|------|------|------|
| 実施 | | | |
| 確認 | | | |
| GO 判定 | ☐ GO / ☐ ロールバック | | |

---

**本テンプレート:** レポート追加のみ · コード / Secrets / Dashboard 変更なし
