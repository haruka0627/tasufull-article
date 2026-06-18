# P0-W3: Stripe 承認前 — 最終実務チェック

**作成日:** 2026-06-18  
**種別:** 監査のみ（**コード / Secrets / Stripe Dashboard / DB 変更なし**）  
**プロジェクト:** `ddojquacsyqesrjhcvmn`  
**参照:** [`stripe-live-values-template.md`](stripe-live-values-template.md) · [`stripe-live-cutover-audit.md`](stripe-live-cutover-audit.md) · [`stripe-live-go-live-checklist.md`](stripe-live-go-live-checklist.md) · [`stripe-webhook-p0-w1-delivery-check.md`](stripe-webhook-p0-w1-delivery-check.md)

---

## 確認① Test 値バックアップ

**対象テンプレート:** [`stripe-live-values-template.md`](stripe-live-values-template.md) §0 · §1

### 判定: **PASS**（運用記入待ち 2 件あり）

テンプレート §0 は、Live 切替で上書きされる **7 Secret 相当**（`STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · Price ×4 · 暗黙的に `SITE_URL` は §1 で更新）と **Test Webhook Endpoint ID** を退避先として定義しており、P0-W1 で確認済みの Supabase Secrets 名と **1:1 で一致**する。

| テンプレート §0 項目 | コード / Secrets 実名 | 用途一致 | 退避可否 |
|---------------------|----------------------|----------|----------|
| Test `STRIPE_SECRET_KEY` | `STRIPE_SECRET_KEY` | 全 Stripe Edge API | ✅ |
| Test `STRIPE_WEBHOOK_SECRET` | `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` 署名検証 | ✅ |
| Test Endpoint ID | `we_1TR70n5tJSRSYcyiMrAzpuGF`（P0-W1 記録） | Test Webhook | ✅ |
| Test Price BASIC_300 | `STRIPE_GENAI_PRICE_BASIC_300` | Basic ¥300/月 | ✅ |
| Test Price PRO_980 | `STRIPE_GENAI_PRICE_PRO_980` | Pro ¥980/月 | ✅ |
| Test Price 2D_LIVE_300 | `STRIPE_GENAI_PRICE_2D_LIVE_300` | 2D Live ¥300/月 | ✅ |
| Test Price 3D_GENERATE_500 | `STRIPE_GENAI_PRICE_3D_GENERATE_500` | 3D ¥500 単発 | ✅ |

**Secret 名と用途:** `genai-plans.ts` / `genai-checkout-plans.ts` の `resolveStripePriceId*` とテンプレート §2.4〜2.6 の対応表は一致。**存在しない誤名**（`STRIPE_GENAI_PRICE_ULTRA` · `ENTERPRISE` · `BASIC` 后缀なし）はテンプレート §7.1 でも明示済み。

### 不足項目一覧（テンプレート / vault 記入前）

| # | 不足 | 重要度 | 備考 |
|---|------|--------|------|
| 1 | **§0 の実値が未記入**（プレースホルダーのみ） | 高 | `sk_test_` / `whsec_` / `price_` ×4 は **vault から手動転記**が必要。Git には入れない |
| 2 | **Test Price ID の Dashboard 控え** | 中 | Secrets digest のみでは値復元不可。Stripe Dashboard Test mode から各 `price_...` を §0 に転記 |
| 3 | **切替前 `SITE_URL` の現行値** | 低 | 現状 **未設定**（P0-W2 / webhook-final-check）。ロールバック時は変更不要だが、誤設定時の復元用に「未設定」と明記推奨 |
| 4 | **Featured Price Secret** | —（対象外） | Featured は `price_data` 動的生成。**Price Secret は存在しない** — バックアップ対象に含めないのが正しい |
| 5 | **`GENAI_SETUP_TOKEN`** | 低 | Test catalog セットアップ用（任意）。Live 切替では **変更しない** — §0 必須ではない |
| 6 | **`STRIPE_DEMO_CONNECTED_ACCOUNT_ID`** | 低 | Marketplace デモ用。GenAI/Featured Live 切替では **変更しない** |

---

## 確認② Live Product / Price 命名

### 判定: **PASS**

Live 作成時はテンプレート §4 と `stripe-setup-genai-catalog` の idempotent ロジックに従う。**metadata `genai_plan` が一意キー**であり、Product 表示名の揺れ（Basic の「生成AIスタンダード」 vs `GENAI Basic`）は Webhook / apply 経路に影響しない。

### 命名一覧

#### GenAI（Price Secret あり · Live 必須）

| plan ID | Product 名（推奨） | metadata `genai_plan` | metadata `tasful_product_id` | lookup_key | 金額 | 課金 | Secret |
|---------|-------------------|----------------------|------------------------------|------------|------|------|--------|
| `genai_basic_300` | 生成AIスタンダード | `genai_basic_300` | `prod_TASFUL_GENAI_BASIC_300` | `tasful_genai_basic_300` | ¥300 | 月次 sub | `STRIPE_GENAI_PRICE_BASIC_300` |
| `genai_pro_980` | 生成AIプロ | `genai_pro_980` | `prod_TASFUL_GENAI_PRO_980` | `tasful_genai_pro_980` | ¥980 | 月次 sub | `STRIPE_GENAI_PRICE_PRO_980` |
| `genai_2d_live_300` | TASFUL AI 2D Live | `genai_2d_live_300` | `prod_TASFUL_GENAI_2D_LIVE_300` | `tasful_genai_2d_live_300` | ¥300 | 月次 sub | `STRIPE_GENAI_PRICE_2D_LIVE_300` |
| `genai_3d_generate_500` | TASFUL AI 3D Generate | `genai_3d_generate_500` | `prod_TASFUL_GENAI_3D_GENERATE_500` | `tasful_genai_3d_generate_500` | ¥500 | 単発 | `STRIPE_GENAI_PRICE_3D_GENERATE_500` |

**DB 反映先（参考）:** Basic/Pro → `gen_ai_subscriptions` · 2D Live → `gen_ai_entitlements` · 3D → `gen_ai_3d_ticket_grants` / `gen_ai_3d_tickets`

#### Featured（Price Secret なし · `price_data` 動的）

| plan ID | Product 名（Checkout 時） | 金額 | DB |
|---------|------------------------|------|-----|
| `featured_7days` | 上位掲載 7日 | ¥980 | `listings` |
| `featured_30days` | 上位掲載 30日 | ¥2,980 | 同上 |
| `pr_30days` | PR掲載 30日 | ¥4,980 | 同上 |

### 重複・衝突評価

| 観点 | 結果 |
|------|------|
| **Product 名の重複** | GenAI 4 商品 + Featured 3 ラベルは **すべて異なる** |
| **¥300 が 2 プラン** | `genai_basic_300` と `genai_2d_live_300` — **metadata / lookup_key / Secret が分離**されており衝突なし |
| **プラン ↔ Secret 対応** | 4 Secret ↔ 4 plan ID で **完全対応** |
| **将来プラン追加** | 命名規則 `STRIPE_GENAI_PRICE_{PLAN}_{AMOUNT}` + `metadata.genai_plan` が確立。`ULTRA` / `ENTERPRISE` は **未実装** — 追加時は新 Secret + 新 metadata キーが必要（既存と衝突しない） |
| **Live/Test 混在** | 同一 Stripe アカウント内で mode 分離。Live Product は **Dashboard Live mode のみ**で作成（§7.1） |

**注意（運用）:** Basic Product 名を Dashboard で `GENAI Basic` にした場合でも、`metadata.genai_plan=genai_basic_300` を守れば apply 経路は安全。

---

## 確認③ SITE_URL / 関連 URL 変数

### 判定: **FAIL**（本番 URL 未確定 · `SITE_URL` Secret 未設定 · Featured が `origin` 非送信）

### 環境変数調査

| 変数名 | リポジトリ使用 | Stripe 決済経路 | 備考 |
|--------|---------------|-----------------|------|
| **`SITE_URL`** | ✅ Supabase Secret（**未設定**） | ✅ **必須** | Edge `resolveSiteOrigin` の第 2 優先 |
| **`APP_URL`** | ❌ 未使用 | — | 該当なし |
| **`PUBLIC_URL`** | ❌ 未使用 | — | 該当なし |
| **`origin`**（body） | ✅ クライアント POST | 第 1 優先 | GenAI · Shop · 手数料は送信。**Featured は未送信** |
| **`redirect_url`** | ❌ Stripe 文脈では未使用 | — | TALK `tasu_talk_return_url` のみ（決済無関係） |
| **`success_url`** | ✅ Checkout Session パラメータ | Edge 内生成 | `SITE_URL` / `origin` / referer から構築 |
| **`cancel_url`** | ✅ 同上 | 同上 | 同上 |
| **`return_url`** | ✅ Customer Portal | `stripe-create-genai-portal` | Portal 戻り先 |

### 使用箇所一覧（Stripe 決済経路）

| ファイル | 変数 | URL 構築内容 |
|----------|------|-------------|
| `supabase/functions/stripe-create-genai-checkout/index.ts` | `SITE_URL` · body `origin` · referer | `{origin}/gen-ai-workspace.html?genai_checkout=success\|cancelled&...` |
| `supabase/functions/stripe-create-checkout/index.ts` | 同上 | `{origin}/detail-{type}.html?id={uuid}&featured_checkout=...` |
| `supabase/functions/stripe-create-genai-portal/index.ts` | `SITE_URL` · body `returnUrl`/`return_url` | `{origin}/gen-ai-workspace.html` |
| `supabase/functions/stripe-create-shop-checkout/index.ts` | 同上 | Shop 戻り URL（Live スコープ外だが同一 Secret） |
| `supabase/functions/stripe-create-service-fee/index.ts` | 同上 | 手数料戻り URL |
| `gen-ai-workspace.js` L4420 | `location.origin` | Checkout POST に **`origin` 送信** |
| `listing-featured.js` L233-236 | — | **`origin` 未送信** → `SITE_URL` または referer 依存 |
| `shop-checkout.js` L298 | `window.location.origin` | Shop Checkout |
| `service-fee-pay.js` L93 | `window.location.origin` | 手数料 |
| `platform-chat-fee-pay.js` L333 | `window.location.origin` | 手数料 |

**fallback  chain（Featured 含む全 create-* 共通）:**

1. body `origin`（Featured はスキップ）
2. **`SITE_URL` Secret**（現状 **空**）
3. `Referer` / `Origin` ヘッダ
4. **`http://localhost:5173`**

### 本番候補 URL 一覧

| 候補 | 出典 | 確定度 |
|------|------|--------|
| **（未確定）** | 運用決定待ち | — |
| `https://tasful.app` | `talk-friend-hub-store.js` フォールバック | コード内参考値のみ · **SITE_URL として未採用** |
| `https://www.tasful.jp` | `stripe-live-production-plan.md` 例 | ドキュメント例 |
| `https://www.example.com` | go-live-checklist 例 | プレースホルダー |
| `http://localhost:5173` | Edge fallback · dev スクリプト | **本番では不可** |

### FAIL 理由

1. **`SITE_URL` が Supabase Secrets に未設定**（P0-W2 · webhook-final-check と一致）
2. **本番フロント URL がリポジトリ上で確定していない**
3. **Featured Checkout**（`listing-featured.js`）は `origin` を送らないため、Live 前に **`SITE_URL` 必須** — GenAI よりリスクが高い

**Live 切替前の必須アクション（監査外 · 運用）:** 本番 URL 確定 → `supabase secrets set SITE_URL=https://...`（末尾 `/` なし）→ Featured / GenAI 各 1 回 Checkout URL を Dashboard で目視確認

---

## 確認④ ¥300 Smoke SQL

### 判定: **PASS**

テンプレート §6 の SQL は **実 DB スキーマと整合**。監査対象候補テーブルとの関係を以下に整理。

### SQL 一覧（テンプレート記載）

**GenAI Basic ¥300（必須 smoke）:**

```sql
SELECT user_id, plan_code, subscription_status, stripe_subscription_id, updated_at
FROM gen_ai_subscriptions
WHERE user_id = '【テスト user_id】'
ORDER BY updated_at DESC LIMIT 3;
```

**Featured ¥980（任意 · テンプレート §6 表形式）:**

```sql
SELECT id, is_featured, featured_plan, featured_until, featured_stripe_session_id
FROM listings
WHERE id = '【listings UUID】';
```

**go-live-checklist 参考（Featured 汎用）:**

```sql
SELECT id, is_featured, featured_plan, featured_until, featured_stripe_session_id
FROM listings
WHERE featured_stripe_session_id IS NOT NULL
ORDER BY updated_at DESC LIMIT 5;
```

### 実在確認結果

| テーブル | 監査候補 | 実在 | Stripe 連携用途 |
|----------|----------|------|----------------|
| **`gen_ai_subscriptions`** | —（テンプレート採用） | ✅ `supabase/gen_ai_subscriptions.sql` | Basic/Pro サブスク · **¥300 smoke 正解** |
| **`gen_ai_entitlements`** | — | ✅ `supabase/gen_ai_entitlements.sql` | 2D Live addon |
| **`gen_ai_3d_ticket_grants`** | — | ✅ `supabase/gen_ai_3d_ticket_grants.sql` | 3D 単発 · 冪等 `stripe_session_id` |
| **`listings`** | — | ✅ `listings_featured_*.sql` | Featured |
| `subscriptions` | 候補 | ❌ **存在しない** | — |
| `payments` | 候補 | ❌ **存在しない** | Stripe Payments は Dashboard 確認 |
| `orders` | 候補 | ❌ 汎名なし | `shop_orders` は Marketplace 用（Live スコープ外） |
| `billing_events` | 候補 | ❌ **存在しない** | — |
| `stripe_events` | 候補 | ❌ **存在しない** | Webhook ログは Stripe Dashboard |

**列整合（`gen_ai_subscriptions`）:**

| SQL 列 | スキーマ | 結果 |
|--------|----------|------|
| `user_id` | PK `text` | ✅ |
| `plan_code` | `text not null default 'free'` | ✅ smoke 期待値 `basic_300` |
| `subscription_status` | `text` | ✅ |
| `stripe_subscription_id` | `text` | ✅ |
| `updated_at` | `timestamptz` | ✅ |

**注意:** 2D Live ¥300 smoke を行う場合は **`gen_ai_entitlements`** を別途確認。Basic ¥300 smoke には §6 SQL で十分。

---

## 確認⑤ ロールバック

### 判定: **PASS**（5 分厳密達成は **vault 事前準備必須**）

### ロールバック手順（実行順序固定）

| 順 | 対象 | 操作 | 所要目安 |
|----|------|------|----------|
| **1** | **Stripe Live Webhook** | Dashboard → Live endpoint → **Disable**（または Delete） | 0〜1 分 |
| **2** | **`STRIPE_SECRET_KEY`** | Supabase Secrets → §0 Test `sk_test_...` | 1〜2 分 |
| **3** | **`STRIPE_WEBHOOK_SECRET`** | §0 Test `whsec_...`（**Test endpoint とペア**） | （2 と同時） |
| **4** | **`STRIPE_GENAI_PRICE_*` ×4** | §0 Test `price_...` ×4 | （2 と同時） |
| **5** | **`SITE_URL`** | **変更不要**（本番 URL 維持で Test Checkout 可） | — |
| **6** | **Supabase その他 Secrets** | `SUPABASE_SERVICE_ROLE_KEY` · `GEMINI_API_KEY` 等 **触らない** | — |
| **7** | **Edge 再デプロイ** | **通常不要** — Secrets 反映は数秒〜1 分（§7.2）。障害時のみ `supabase functions deploy stripe-webhook` 任意 | 0〜3 分（任意） |
| **8** | **検証** | 署名なし POST → 400 · `node scripts/test-genai-stripe.mjs` PASS · Checkout 画面 **TEST** 表示 | 1〜2 分 |
| **9** | **Live 決済済み救済** | `stripe-confirm-genai-checkout` 1 回 POST または手動 DB / 返金 | 障害時のみ |

**一括コマンド例（vault から貼付 · 手順 2〜4）:**

```bash
supabase link --project-ref ddojquacsyqesrjhcvmn

supabase secrets set \
  STRIPE_SECRET_KEY=【§0 sk_test】 \
  STRIPE_WEBHOOK_SECRET=【§0 whsec】 \
  STRIPE_GENAI_PRICE_BASIC_300=【§0 price】 \
  STRIPE_GENAI_PRICE_PRO_980=【§0 price】 \
  STRIPE_GENAI_PRICE_2D_LIVE_300=【§0 price】 \
  STRIPE_GENAI_PRICE_3D_GENERATE_500=【§0 price】
```

### 手順漏れチェック

| 項目 | 状態 |
|------|------|
| Live Webhook 停止 | ✅ 手順 1 — **Secrets より先** |
| sk / whsec **ペア**で Test に戻す | ✅ テンプレート §7.1 #3-4 |
| Price ×4 同時復元 | ✅ |
| `SITE_URL` ロールバック不要 | ✅ 明記済み |
| 再デプロイ | ✅ 必須ではない（任意） |
| 既付与 DB 行 | ✅ 自動ロールバック対象外 — 手動判断 |
| Live 決済・未反映ユーザー | ✅ confirm フォールバック手順あり |

### 想定所要時間

| シナリオ | 時間 | 5 分以内 |
|----------|------|----------|
| **§0 vault 記入済み · 手順 1〜8 のみ** | **3〜5 分** | ✅ 達成可能 |
| テンプレート記載（§7.3） | 5〜7 分 | ⚠️ 検証込みでギリギリ超過 |
| Live 決済救済込み | 10 分+ | ❌ |

**結論:** 手順は **漏れなし · 順序明確**。§0 バックアップが vault に **事前転記済み**なら **5 分以内復旧可能**。

---

# 総合判定

## **WARNING**

| 確認 | 判定 | ブロッカー |
|------|------|-----------|
| ① Test バックアップ | PASS | vault 実値未記入（承認前に可能） |
| ② Live 命名 | PASS | — |
| ③ SITE_URL | **FAIL** | 本番 URL 未確定 · Secret 未設定 · Featured `origin` 非送信 |
| ④ ¥300 SQL | PASS | — |
| ⑤ ロールバック | PASS | §0 未記入だと 5 分復旧不可 |

**READY に昇格する条件:**

1. 本番フロント URL を運用で確定
2. §0 に Test Secrets 実値を vault 転記（Git 不可）
3. Live 切替時に `SITE_URL` を同時投入

**Stripe Live 技術経路（Webhook · apply · Price Secret 名）は承認前準備として合格。** 残りは **URL 確定と vault 記入** の運用ゲート。

---

# Stripe 承認後の実施手順

1. **§0 バックアップ確認** — vault に Test `sk_test_` · `whsec_` · `price_` ×4 · Endpoint `we_1TR70n5tJSRSYcyiMrAzpuGF` が記入済みであることを確認
2. **本番 `SITE_URL` 確定** — HTTPS · 末尾 `/` なし · `gen-ai-workspace.html` / `detail-*.html` が当該ホストで配信されていること
3. **Stripe Dashboard → Live mode** — Product/Price 4 件を §4 命名規則で作成（metadata `genai_plan` 必須 · lookup_key 推奨）
4. **Live Webhook 作成** — URL `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook` · Events 3 種 · `whsec_` を控え
5. **Supabase Secrets 一括更新** — Live `sk_live_` + Live `whsec_` + Live Price ×4 + `SITE_URL`（**sk と whsec は同時 · Test 混在禁止**）
6. **反映待ち 30〜60 秒** — 必要なら `supabase secrets list` で digest 更新確認
7. **GenAI ¥300 smoke** — 本番 `gen-ai-workspace.html` → 生成AIスタンダード → Live 決済 → Webhook 200 → §6 SQL で `gen_ai_subscriptions.plan_code=basic_300`
8. **Featured ¥980 smoke（任意）** — 実 listings UUID · `is_featured` · `featured_stripe_session_id` 確認（`SITE_URL` 依存のため GenAI より後でも可）
9. **Customer Portal / 解約同期** — `customer.subscription.updated` / `deleted` が Live endpoint に届くことを Dashboard Deliveries で確認
10. **障害時** — 手順 ⑤ に従い Live Webhook Disable → Test Secrets 復元 → `node scripts/test-genai-stripe.mjs` → 記録

---

**監査実施:** リポジトリ静的解析 · 既存レポート（P0-W1/W2）照合 · **コード / Secrets / Dashboard / DB 変更 0 件**
