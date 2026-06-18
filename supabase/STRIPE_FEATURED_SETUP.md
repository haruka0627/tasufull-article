# Stripe 上位掲載（Checkout Session）

## 1. SQL（Supabase SQL Editor）

順に実行:

1. `listings_featured_columns.sql`
2. `listings_featured_stripe.sql`

## 2. Edge Functions デプロイ

```bash
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role>
supabase secrets set SITE_URL=http://localhost:5173

supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-confirm-checkout
supabase functions deploy stripe-webhook
```

`SUPABASE_URL` は Functions 実行時に自動注入されます。

## 3. Stripe Webhook

Dashboard → Developers → Webhooks → Add endpoint

- URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- イベント: `checkout.session.completed`
- 署名シークレットを `STRIPE_WEBHOOK_SECRET` に設定

## 4. プラン ID（metadata `featured_plan`）

| プラン | 金額（税込想定） | 日数 |
|--------|------------------|------|
| `featured_7days` | ¥980 | 7 |
| `featured_30days` | ¥2,980 | 30 |
| `pr_30days` | ¥4,980 | 30 |

決済成功後（Webhook または success_url → `stripe-confirm-checkout`）:

- `is_featured = true`
- `featured_plan` = 上記いずれか
- `featured_until` = 現在 + 日数

## 5. ローカル開発

```bash
npm run dev
# http://localhost:5173

stripe listen --forward-to https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

掲載は **Supabase UUID** の `listings` 行のみ Checkout 対象です（デモ slug ID は不可）。

## 6. フロント（動作確認）

1. Supabase に UUID の掲載を保存（`post.html` から投稿）
2. 詳細を **出品者ユーザー** で開く  
   - 例: 掲載の `user_id` が `u_me` ならそのまま、または `?userId=u_me` を付与
3. 「**上位掲載する**」→ モーダルでプラン選択 → Stripe テスト決済
4. 戻り後: `stripe-confirm-checkout` → ページ再読み込み → 「上位掲載が有効になりました」
5. `index.html` の「注目掲載」欄に表示されることを確認

- `stripe-featured-config.js` — Functions URL・プラン表示・（任意）Price ID
- `listing-featured.js` — 出品者のみボタン表示・モーダル・Checkout
- 戻り URL: `?featured_checkout=success&session_id={CHECKOUT_SESSION_ID}`
