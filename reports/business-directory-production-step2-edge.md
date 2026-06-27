# Business Directory Production Step 2 — Edge Deploy / Secrets

**日付:** 2026-06-27  
**種別:** staging Edge deploy · secrets · smoke（Pages production deploy **未実施**）  
**Project ref:** `ddojquacsyqesrjhcvmn`

---

## 結論

| 項目 | 結果 |
| --- | --- |
| **Edge deploy** | ✅ `business-directory` · `stripe-webhook` |
| **SITE_URL** | ✅ `https://tasufull-article.pages.dev` |
| **BD Stripe prices** | ✅ Test mode 作成 · secrets 設定済 |
| **Remote smoke** | ✅ **15/15 PASS** |

---

## Secrets 設定（実施済）

| Secret | 状態 |
| --- | --- |
| `STRIPE_SECRET_KEY` | 既存 |
| `STRIPE_WEBHOOK_SECRET` | 既存 |
| `SITE_URL` | ✅ 新規設定 |
| `BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD` | ✅ `price_1TmyY05tJSRSYcyiaeQoIeBa`（¥980/月） |
| `BUSINESS_DIRECTORY_STRIPE_PRICE_PRO` | ✅ `price_1TmyY25tJSRSYcyiNuE9lna5`（¥2,980/月） |

**bootstrap:**

```bash
node scripts/bootstrap-business-directory-stripe-prices.mjs
```

`ops_ensure_stripe_prices`（service role JWT）で Stripe Test Product/Price を find-or-create → secrets set。

---

## Edge deploy（実施済）

```bash
npx supabase secrets set SITE_URL=https://tasufull-article.pages.dev --project-ref ddojquacsyqesrjhcvmn
npx supabase functions deploy business-directory stripe-webhook --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

---

## Remote smoke

```bash
node scripts/test-business-directory-production-step2-edge.mjs          # 6/6 + 1 note
node scripts/test-business-directory-production-step2-edge.mjs --remote # 15/15 PASS
```

| チェック | 結果 |
| --- | --- |
| `POST …/business-directory` health | `service=business-directory` · `phase=6` |
| `get_public_listings` | 200 · `listings[]` |
| functions list | `business-directory` · `stripe-webhook` ACTIVE |
| secrets list | BD price ×2 · STRIPE_* · SITE_URL |

---

## Stripe Webhook（手動確認推奨）

Endpoint: `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook`

BD 分岐用イベント（既存 endpoint に未購読なら Dashboard で追加）:

- `checkout.session.completed`
- `customer.subscription.created` / `updated` / `deleted`
- `invoice.payment_succeeded` / `payment_failed`

metadata: `order_type=business_directory_subscription`

---

## 次ステップ（Step 3 完了 → Step 4）

1. Pages **production** deploy（別指示）
2. Production 同一手順の最終 smoke
3. Stripe Live / webhook 本番確認

Step 3 結果: [business-directory-production-step3-preview-e2e.md](./business-directory-production-step3-preview-e2e.md) — **15/15 PASS**

---

## 参照

- [business-directory-production-step1-migration.md](./business-directory-production-step1-migration.md)
- [business-directory-phase7-deploy-preflight.md](./business-directory-phase7-deploy-preflight.md)
- [business-directory-phase6-stripe.md](./business-directory-phase6-stripe.md)
