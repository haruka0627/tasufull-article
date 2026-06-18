# P0-W2: Stripe Live 切替 — 事前監査

**作成日:** 2026-06-18  
**種別:** 調査・レポートのみ（**コード / Secrets / Dashboard 変更なし**）  
**目的:** Stripe 承認後 **30 分以内**で Live 切替可能な状態の洗い出し  
**プロジェクト:** `ddojquacsyqesrjhcvmn`

**関連成果物:** [`stripe-webhook-audit.md`](stripe-webhook-audit.md) · [`connect-production-gap.md`](connect-production-gap.md) · [`marketplace-payment-production-gap.md`](marketplace-payment-production-gap.md)

---

## 1. Stripe Live 切替対象 — Secrets 棚卸し

### 1.1 監査対象名と実装名の対応

ユーザー指定名のうち、**リポジトリに存在しない Secret 名**を先に明示します。

| 指定名（監査依頼） | リポジトリ実名 | 判定 |
|-------------------|----------------|------|
| `STRIPE_GENAI_PRICE_BASIC` | **`STRIPE_GENAI_PRICE_BASIC_300`** | 名称差異 — Live 切替は `_300` 版 |
| `STRIPE_GENAI_PRICE_PRO` | **`STRIPE_GENAI_PRICE_PRO_980`** | 同上 |
| `STRIPE_GENAI_PRICE_ULTRA` | **存在しない** | 未実装プラン |
| `STRIPE_GENAI_PRICE_ENTERPRISE` | **存在しない** | 未実装プラン |

**実在する GenAI Price Secrets（4 件）:**

- `STRIPE_GENAI_PRICE_BASIC_300`（¥300/月）
- `STRIPE_GENAI_PRICE_PRO_980`（¥980/月）
- `STRIPE_GENAI_PRICE_2D_LIVE_300`（¥300/月 · アドオン）
- `STRIPE_GENAI_PRICE_3D_GENERATE_500`（¥500 · 単発）

---

### 1.2 `STRIPE_SECRET_KEY`

| 項目 | 内容 |
|------|------|
| **現在** | Test `sk_test_...` 想定（P0-W1 PASS） |
| **Live 切替** | **必須** → `sk_live_...` |
| **使用目的** | Stripe API 呼出（Checkout 作成 · Session 取得 · Subscription 取得 · Customer Portal） |

| 使用箇所 | 種別 | 用途 |
|----------|------|------|
| `supabase/functions/stripe-webhook/index.ts` | Edge | Webhook 内 subscription retrieve |
| `supabase/functions/stripe-create-genai-checkout/index.ts` | Edge | GenAI Checkout Session |
| `supabase/functions/stripe-confirm-genai-checkout/index.ts` | Edge | Session retrieve + apply |
| `supabase/functions/stripe-create-genai-portal/index.ts` | Edge | Customer Portal |
| `supabase/functions/stripe-get-genai-plan/index.ts` | Edge | （read のみ · key 未使用の可能性 — 要 read） |
| `supabase/functions/stripe-create-checkout/index.ts` | Edge | Featured Checkout |
| `supabase/functions/stripe-confirm-checkout/index.ts` | Edge | Featured confirm |
| `supabase/functions/stripe-create-shop-checkout/index.ts` | Edge | Marketplace（**Live スコープ外だが同一 Secret**） |
| `supabase/functions/stripe-confirm-shop-checkout/index.ts` | Edge | 同上 |
| `supabase/functions/stripe-create-service-fee/index.ts` | Edge | 手数料（未本番） |
| `supabase/functions/stripe-setup-genai-catalog/index.ts` | Edge | Test のみ（`sk_test_` ガード） |
| `supabase/functions/stripe-e2e-*` ×3 | Edge | Test のみ |
| `listing-featured.js` L221 | frontend | エラーメッセージ参照のみ |
| `supabase/STRIPE_FEATURED_SETUP.md` | docs | セットアップ手順 |
| `docs/production-release-checklist.md` | docs | チェックリスト |
| `scripts/setup-genai-stripe-secrets.mjs` | scripts | 間接（catalog 経由） |
| `scripts/test-genai-stripe.mjs` | scripts | create checkout smoke |

**注意点:** Live 切替は **GenAI + Featured + Shop + Service fee すべて同一キー**に影響。Marketplace を Live のまま触らない場合も Secret は共有。

---

### 1.3 `STRIPE_WEBHOOK_SECRET`

| 項目 | 内容 |
|------|------|
| **現在** | Test endpoint `we_1TR70n5tJSRSYcyiMrAzpuGF` の `whsec_...` |
| **Live 切替** | **必須** → Live endpoint の **別** `whsec_...` |
| **使用目的** | `constructEventAsync` 署名検証 |

| 使用箇所 | 種別 |
|----------|------|
| `supabase/functions/stripe-webhook/index.ts` L113-133 | Edge（**唯一**） |
| `supabase/functions/stripe-setup-genai-catalog/index.ts` | Edge（新規 endpoint 作成時のみ secret 返却） |
| `supabase/STRIPE_FEATURED_SETUP.md` | docs |
| 各種 reports | docs |

**注意点:** Test whsec + Live sk の混在は **全 Webhook 400**。`STRIPE_SECRET_KEY` と **ペアで同時更新**。

---

### 1.4 `STRIPE_GENAI_PRICE_BASIC_300` / `STRIPE_GENAI_PRICE_PRO_980` / `STRIPE_GENAI_PRICE_2D_LIVE_300` / `STRIPE_GENAI_PRICE_3D_GENERATE_500`

| 項目 | 内容 |
|------|------|
| **現在** | Test `price_...`（Secrets 設定済 · P0-W1） |
| **Live 切替** | **必須**（推奨）— 各 Live Price ID |
| **未設定時** | `stripe-create-genai-checkout` が `price_data` 動的生成にフォールバック |

| 使用箇所 | 種別 | 用途 |
|----------|------|------|
| `supabase/functions/_shared/genai-plans.ts` L67-71 | Edge shared | Basic / Pro 解決 |
| `supabase/functions/_shared/genai-checkout-plans.ts` L74-82 | Edge shared | 全 4 プラン解決 |
| `supabase/functions/stripe-create-genai-checkout/index.ts` L109 | Edge | line_items |
| `supabase/functions/stripe-setup-genai-catalog/index.ts` L273-276 | Edge | secrets_to_set 出力 |
| `supabase/functions/stripe-e2e-simulate-*` | Edge | Test E2E |
| `stripe-genai-config.js` L3 | frontend | コメントのみ（値は Edge 側） |
| `scripts/setup-genai-stripe-secrets.mjs` | scripts | catalog → secrets 反映 |
| `scripts/test-genai-stripe.mjs` | scripts | smoke（origin のみ · Price は Edge） |

**注意点:** ULTRA / ENTERPRISE は **コードに存在しない**。Live Product 作成時は上記 4 プランのみ。

---

### 1.5 `SITE_URL`

| 項目 | 内容 |
|------|------|
| **現在** | 未設定 or 未確認（`secrets list` に明示なしの監査記録あり） |
| **Live 切替** | **必須** — 本番フロント URL |
| **未設定時** | referer → 最終 fallback **`http://localhost:5173`** |

| 使用箇所 | 種別 | 用途 |
|----------|------|------|
| `stripe-create-genai-checkout/index.ts` L14-19 | Edge | GenAI success/cancel URL |
| `stripe-create-checkout/index.ts` L24-32 | Edge | Featured success/cancel URL |
| `stripe-create-genai-portal/index.ts` L9-26 | Edge | Portal return URL |
| `stripe-create-shop-checkout/index.ts` L15-22 | Edge | Shop（Marketplace） |
| `stripe-create-service-fee/index.ts` L8-13 | Edge | 手数料 |
| `supabase/STRIPE_FEATURED_SETUP.md` L19 | docs | 例 `http://localhost:5173` |
| frontend | — | **直接参照なし**（Checkout body の `origin` も可） |

**注意点:** Live 前に **必ず Secret 設定**。未設定は本番決済後の success URL が localhost になる **P0 リスク**。

---

### 1.6 その他 Stripe 関連 Secret（Live 切替スコープ外だが依存）

| Secret | Live 変更 | 用途 |
|--------|-----------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | 不要 | apply-* DB 書込 |
| `STRIPE_DEMO_CONNECTED_ACCOUNT_ID` | Marketplace 時 | `resolve-shop-payout.ts` デモ Connect |

---

### 1.7 `STRIPE_PUBLISHABLE_KEY`

| 項目 | 内容 |
|------|------|
| **リポジトリ** | **未使用 · 未定義** |
| **Live 切替** | **不要** |

---

## 2. 本番 URL 監査（localhost / 127.0.0.1）

### 2.1 本番化で対処必須（Stripe / 決済経路）

| ファイル | 行 | 用途 | 本番 URL 化 | 後回し |
|----------|-----|------|-------------|--------|
| `supabase/functions/stripe-create-genai-checkout/index.ts` | 19 | `SITE_URL` 未設定時 fallback | **`SITE_URL` Secret で回避**（コード変更不要） | — |
| `supabase/functions/stripe-create-checkout/index.ts` | 32 | 同上（Featured） | 同上 | — |
| `supabase/functions/stripe-create-genai-portal/index.ts` | 14, 26 | Portal return fallback | 同上 | — |
| `supabase/functions/stripe-create-shop-checkout/index.ts` | 22 | Shop checkout fallback | Marketplace Epic 時 | Connect 後 |
| `supabase/functions/stripe-create-service-fee/index.ts` | 13 | 手数料 fallback | Connect Epic 時 | P1 |
| `supabase/STRIPE_FEATURED_SETUP.md` | 19, 54 | ドキュメント例 | 手順書更新（任意） | 可 |
| `scripts/test-genai-stripe.mjs` | 39, 50, 61 | smoke `origin` | Live smoke 時に本番 origin 指定 | テストのみ |
| `scripts/e2e-genai-stripe.mjs` | 10 | E2E URL | Live 手動テスト時 | 可 |
| `scripts/debug-checkout-session.mjs` | 13 | デバッグ | 開発用 | **後回し** |
| `scripts/debug-stripe-checkout-dom.mjs` | 14 | デバッグ | 開発用 | **後回し** |

**結論（Stripe Live）:** コード内 localhost は **Edge の fallback**。Live 切替時は **`SITE_URL` Secret 設定で解消**（コード変更不要）。リクエスト body の `origin` もクライアントから渡せる。

---

### 2.2 本番 URL 化不要（開発・テスト・フォールバック）

| カテゴリ | 例 | 件数規模 | 後回し |
|----------|-----|----------|--------|
| `scripts/test-*.mjs` / `scripts/capture-*.mjs` | `BASE_URL` default `127.0.0.1:8765` 等 | 100+ ファイル | **後回し** |
| `scripts/lib/dev-base-url.mjs` | dev サーバー検出 | 1 | 後回し |
| `supabase/functions/_shared/cors.ts` | CORS dev hosts | 1 | 後回し（本番 CORS は Origin ベース） |
| `talk-runtime.js` | localhost = dev mode 判定 | 1 | 後回し |
| `breadcrumb-config.js` 等 | URL parse fallback `http://localhost/` | 少数 | 後回し |
| `reports/*.md` · `job-ui-review.md` 等 | ドキュメント例 | 多数 | 後回し |
| `payment-settings.js` L252 | 相対 URL 解決 fallback | 1 | 後回し |
| `shop-market-notify.js` L70 | notify link fallback | 1 | 後回し |

---

### 2.3 Live 切替前チェック（運用）

- [ ] 本番 `SITE_URL` を Secrets に設定済み
- [ ] Live smoke 時、Checkout API に `origin: "<本番URL>"` を渡すか、Secret のみで足りることを確認
- [ ] 本番ホストで `gen-ai-workspace.html` / `detail-*.html` が HTTPS で配信されている

---

## 6. 総合まとめ

### Stripe 承認前にできること

| # | 作業 | 工数 |
|---|------|------|
| 1 | Test Secrets バックアップ（sk / whsec / price ×4） | 15分 |
| 2 | 本番 `SITE_URL` 確定 · DNS/HTTPS 確認 | 可変 |
| 3 | `supabase link` · `functions list` 確認 | 10分 |
| 4 | `node scripts/test-genai-stripe.mjs` Test smoke PASS | 5分 |
| 5 | Live Product/Price **設計**（metadata 一覧 · 金額表） | 30分 |
| 6 | テスト用 `user_id` · Featured 用 listings UUID 準備 | 15分 |
| 7 | ロールバック Runbook 共有（[`stripe-live-go-live-checklist.md`](stripe-live-go-live-checklist.md) §4） | 15分 |
| 8 | Connect / Marketplace gap レポート読了（本監査 3 成果物） | 30分 |

### Stripe 承認後にやること（〜30 分）

| # | 作業 |
|---|------|
| 1 | Live Product/Price 作成 ×4 |
| 2 | Live Webhook 登録 + whsec |
| 3 | Supabase Secrets Live 一括更新 |
| 4 | 署名疎通 · ¥300 Live 決済 smoke |
| 5 | GO / ロールバック判定 |

### Connect 前にできること

| 作業 |
|------|
| `payment-settings` UX 監査 PASS 維持（凍結） |
| `stripe-connect-event-map.js` イベント一覧の運用 Runbook 化 |
| `business_listings` payout 列の DB 確認 |
| Connect Webhook 要件の Epic 起票 |
| **Connect Live onboarding は Stripe Live 承認後でも可**（別 Stripe Connect 設定） |

### Connect 後にやること

| 作業 |
|------|
| AccountLink / accounts.create Edge 実装（**新 Epic · 凍結解除**） |
| Connect Webhook → サーバー ingest |
| `stripe_account_id` / `payout_enabled` DB 永続化 |
| Shop checkout `destination` charge 本番 smoke |

### Marketplace 本番決済までの最短順序

```
1. Stripe Live（GenAI/Featured）          ← 本監査 P0-W2
2. Connect onboarding + seller acct_*     ← connect-production-gap.md
3. shop_orders DDL + RLS デプロイ
4. stripe-create/confirm-shop-checkout デプロイ確認
5. Market EC 凍結解除 · buy → checkout.html
6. Webhook shop_product 分岐（推奨）
7. 注文履歴/KPI を Supabase 接続
```

### ブロッカー

| ID | ブロッカー | 影響 |
|----|-----------|------|
| **B-1** | Live `sk_live_` + Live `whsec_` 未設定 | 実売上ゼロ |
| **B-2** | `SITE_URL` 未設定 | success URL が localhost |
| **B-3** | Test/Live Secret 混在 | Webhook 全滅 |
| **B-4** | Connect 未接続 | Marketplace GMV 不可 |
| **B-5** | `shop_orders` 404 | Shop 注文永続化不可 |
| **B-6** | Market EC Path A（localStorage）が現行導線 | 実決済に到達しない |

### 想定工数

| フェーズ | 工数 | 依存 |
|----------|------|------|
| **P0-W2 Stripe Live（GenAI+Featured）** | **0.5〜1 人日**（運用のみ） | Stripe 承認 |
| Connect 本番 Epic | 12〜18 人日 | Live Stripe |
| Marketplace 決済接続 | 12〜18 人日 | Connect + shop_orders |
| Webhook shop 分岐 + RLS | 2〜3 人日 | Marketplace |

---

## 検証

**コード変更:** 本監査はレポート作成のみ。`git diff` で **0 ファイル**変更を確認（§検証ログ）。

**次アクション:** Stripe 承認後 → [`stripe-live-go-live-checklist.md`](stripe-live-go-live-checklist.md) Step 7〜18 を実行。
