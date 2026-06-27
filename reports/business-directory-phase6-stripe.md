# Business Directory Phase 6 — Stripe Subscription

**日付:** 2026-06-27  
**ブランチ:** `cf-pages-deploy`  
**スコープ:** Free / Standard / Pro 月額サブスク連携のみ（予約 · 見積 · チャット · 決済代行 · 成果報酬 **除外**）

---

## 概要

Business Directory 掲載の **Stripe 月額サブスク** を Phase 6 として実装した。

| 領域 | 内容 |
| --- | --- |
| **DB** | `business_directory_listings` に subscription カラム追加 |
| **Edge API** | checkout · billing portal · sync |
| **Webhook** | 既存 `stripe-webhook` に BD 分岐 |
| **Owner UI** | アップグレード · Billing Portal · 支払い警告 |
| **Plan Guard** | active/trialing 維持 · past_due grace · 解約後 free 降格 |

---

## 環境変数

| 変数 | 用途 |
| --- | --- |
| `BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD` | Standard 月額 Price ID |
| `BUSINESS_DIRECTORY_STRIPE_PRICE_PRO` | Pro 月額 Price ID |
| `STRIPE_SECRET_KEY` | Stripe API（既存） |
| `STRIPE_WEBHOOK_SECRET` | Webhook 署名（既存） |
| `SITE_URL` | Checkout 成功/キャンセル URL 生成（既存） |

---

## Migration

`supabase/migrations/20260712100000_business_directory_phase6_stripe_subscription.sql`

追加カラム（`business_directory_listings`）:

- `stripe_price_id`
- `subscription_status`
- `current_period_end`
- `cancel_at_period_end`
- `plan_changed_at`

Phase 1 既存: `stripe_customer_id` · `stripe_subscription_id` · `plan_code` · `plan_assigned_at`

---

## API Actions（business-directory Edge）

| action | 認証 | 説明 |
| --- | --- | --- |
| `create_subscription_checkout` | owner | Free→Standard/Pro · Standard↔Pro（既存 sub は Stripe update） |
| `create_billing_portal_session` | owner | 解約 · 支払い方法変更 |
| `sync_subscription_status` | owner | Checkout 戻り · 手動同期 |

metadata: `order_type=business_directory_subscription` · `listing_id` · `owner_user_id` · `plan_code`

---

## Webhook イベント

`supabase/functions/stripe-webhook/index.ts` に BD 分岐追加:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

反映: `plan_code` · subscription カラム · `business_directory_audit_logs`

---

## Plan Guard（MVP · 安全側）

| 状態 | 動作 |
| --- | --- |
| `active` / `trialing` | 現行 plan 維持 |
| `past_due` / `unpaid` | Owner UI 警告 · 期間内は plan 維持（公開も維持） |
| `cancel_at_period_end` | 期間終了まで現行 plan |
| 解約完了 / 期間終了 | `free` 降格 · Pro/Standard 機能ロック |

実装: `business-directory-plans.ts` · Owner UI `effectivePlanCode()` ミラー

---

## Owner UI

- 編集画面プランカード: Standard / Pro アップグレード · Billing Portal
- `?bd_checkout=success` → `sync_subscription_status`
- 新規作成は **Free 固定**（有料は編集画面から Checkout）
- 支払い警告バナー `[data-bd-billing-banner]`

---

## 非干渉確認

| 領域 | 結果 |
| --- | --- |
| Marketplace `shop-checkout.js` | BD Stripe 参照なし |
| Platform Connect | 変更なし |
| Admin UI | 変更なし |
| Public UI | 変更なし |

---

## テスト

```bash
node scripts/test-business-directory-phase6-stripe.mjs   # 52/52 PASS
node scripts/test-business-directory-phase3-owner-ui.mjs # 55/55 PASS
node scripts/test-business-directory-phase4-admin-ui.mjs # 35/35 PASS
node scripts/test-business-directory-phase5-public-ui.mjs # 27/27 PASS
```

Plan guard 単体: `scripts/test-business-directory-phase6-plan-guard.ts`

---

## 未実装（スコープ外）

- Premium プラン
- 予約 / 見積 / チャット / TASFUL 内決済
- Stripe Connect
- 成果報酬

---

## 参照

- [business-directory-subscription-model.md](../docs/business-directory-subscription-model.md)
- [business-directory-mvp-design.md](../docs/business-directory-mvp-design.md)
- [business-directory-ui-flow-design.md](../docs/business-directory-ui-flow-design.md)
