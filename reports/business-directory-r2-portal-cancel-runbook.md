# Business Directory R2 — Portal 解約フロー Runbook

**作成日:** 2026-07-01  
**種別:** 運用手順（**Test / Live 共通** · 本書は **Production Test mode E2E** 向け）  
**Project ref:** `ddojquacsyqesrjhcvmn`（Production Supabase · Edge は本番接続）  
**Stripe mode:** **Test**（R2）— Live は OB2 後に同一手順を Live Dashboard で実施  
**正本コード:** `supabase/functions/_shared/business-directory-stripe.ts` · `stripe-webhook/index.ts`

> **禁止:** 本 Runbook は **手順記述のみ**。Dashboard 変更 · secrets · DB · Edge deploy は **別タスク・人手承認後** に実施する。

---

## 0. 目的

Owner が **Customer Portal（Billing Portal）** からサブスクリプションを解約したとき、Stripe → Webhook → Supabase → UI planGate までが期待どおり動くことを **再現可能に検証** する。

---

## 1. 前提（Checkout まで完了していること）

| 項目 | 期待状態 |
| --- | --- |
| listing | `business_directory_listings` に対象 `id` が存在 · Owner が所有 |
| Stripe Customer | `stripe_customer_id` が listing に保存済 |
| Stripe Subscription | `stripe_subscription_id` · `subscription_status=active`（または `trialing`） |
| plan | `plan_code=standard` または `pro` · Public rich 表示が有効 |
| metadata | `order_type=business_directory_subscription` · `listing_id` · `owner_user_id` |

**未到達の場合:** [Production Test Stripe E2E Runbook](./business-directory-r2-production-test-stripe-e2e-runbook.md) の Phase B（Checkout）を先に実施。

---

## 2. フロー概要

```text
[Checkout 済み]
      ↓
Owner edit.html → 「支払い・解約 (Billing Portal)」
      ↓
Edge create_billing_portal_session → Stripe Billing Portal URL
      ↓
Owner が Portal で「解約」または「期間終了時に解約」
      ↓
Stripe: customer.subscription.updated（cancel_at_period_end=true 等）
      ↓
Webhook stripe-webhook → syncBusinessDirectoryFromStripeSubscription
      ↓
Supabase: subscription_status · cancel_at_period_end · current_period_end · plan_code 更新
      ↓
Owner UI: 解約予約バナー / Public: planGate（期間内は Standard+ 維持）
      ↓
（期間終了後）Stripe: customer.subscription.deleted
      ↓
Webhook → plan_code=free · rich セクション非表示
```

---

## 3. Checkout（参照 · 解約前の購入）

| 項目 | 内容 |
| --- | --- |
| **起点** | Owner `edit.html` → Standard / Pro アップグレード |
| **API** | `POST /functions/v1/business-directory` · `action=create_subscription_checkout` |
| **Stripe** | `checkout.sessions.create` · `mode=subscription` |
| **戻り URL** | `success_path` / `cancel_path` · `bd_checkout=success|cancel` |
| **Test カード** | `4242 4242 4242 4242` · 任意未来日 · 任意 CVC |

**期待結果:** Checkout 完了後 webhook または `sync_subscription_status` で `plan_code=standard|pro`。

---

## 4. Subscription（解約前の状態）

| DB 列 | 解約前の典型値 |
| --- | --- |
| `stripe_subscription_id` | `sub_…` |
| `stripe_price_id` | `price_1TmyY0…`（Standard）等 |
| `subscription_status` | `active` |
| `cancel_at_period_end` | `false` |
| `current_period_end` | 未来 ISO 8601 |
| `plan_code` | `standard` または `pro` |

**確認:** Owner プランカードに有効プラン表示 · Public detail で FAQ / full_description 等が **表示**（published · planGate）。

---

## 5. Customer Portal（解約操作）

### 5.1 手順

1. Owner で `http://127.0.0.1:8788/business-directory/edit.html?id={listing_id}&tab=basic` を開く（または本番公開 URL）
2. プランカードの **「支払い・解約 (Billing Portal)」** をクリック
3. Edge `create_billing_portal_session` が Portal URL を返却 → リダイレクト
4. Stripe Billing Portal で **サブスクリプションの解約** を選択  
   - **期間終了時解約**（`cancel_at_period_end=true`）— **MVP 想定パス**
   - 即時解約 — Stripe / Portal 設定次第（Test で要確認）

### 5.2 API / コード正本

| 項目 | 値 |
| --- | --- |
| Edge action | `create_billing_portal_session` |
| Stripe API | `billingPortal.sessions.create({ customer, return_url })` |
| return_url | `{origin}/business-directory/edit.html?id={listing_id}&tab=basic` |

### 5.3 Dashboard 前提（人手確認 · 変更は別タスク）

- Stripe Dashboard → **Settings → Billing → Customer portal** が **有効**
- 解約・支払い方法更新が Portal に表示されること

---

## 6. 解約（Stripe 側）

| 操作 | Stripe 上の変化 |
| --- | --- |
| **期間終了時解約** | `cancel_at_period_end=true` · status は `active` のまま期間内 |
| **期間終了** | `customer.subscription.deleted` または `status=canceled` + period 経過 |
| **即時解約** | `status=canceled` · period 次第で即 free 化 |

**BD コード:** `buildPatchFromStripeSubscription` — `hasPaidBusinessDirectoryAccess` が period 内 grace を判定（`past_due` も period 内は維持）。

---

## 7. Webhook

### 7.1 Endpoint

```text
https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook
```

### 7.2 解約関連イベント

| イベント | 処理 |
| --- | --- |
| `customer.subscription.updated` | `syncBusinessDirectoryFromStripeSubscription` |
| `customer.subscription.deleted` | 同上（`plan_code` → `free` ロジック） |
| `invoice.payment_failed` | sync + audit `subscription.payment_failed`（解約直前の支払い失敗時） |

**分岐条件:** `metadata.order_type=business_directory_subscription` または BD subscription 判定。

**署名:** `STRIPE_WEBHOOK_SECRET` · 失敗時 **400** → Stripe 再送。

### 7.3 確認ポイント（Dashboard · 読取のみ）

- [ ] 上記 events が endpoint に **購読** されている（Test mode）
- [ ] 解約操作後 **配信成功**（2xx）
- [ ] 失敗時は Response body / Edge log を記録

---

## 8. Supabase 反映

### 8.1 更新経路

- **正規:** Webhook → `createBusinessDirectoryServiceClient()`（service role）→ `business_directory_listings` UPDATE
- **フォールバック:** Owner UI `?bd_checkout=success` 同様 · **`sync_subscription_status`**（Owner JWT · Edge）

### 8.2 解約予約直後（期間内）

| 列 | 期待 |
| --- | --- |
| `cancel_at_period_end` | `true` |
| `subscription_status` | `active`（典型） |
| `plan_code` | **変更なし**（standard / pro） |
| `current_period_end` | 未来日時 |

**audit_logs:** `action=subscription.sync` · metadata に `subscription_id`

### 8.3 期間終了後（free 化）

| 列 | 期待 |
| --- | --- |
| `plan_code` | `free` |
| `subscription_status` | `canceled` 等 |
| `cancel_at_period_end` | `false` または period 経過 |
| `plan_changed_at` | 更新タイムスタンプ |

---

## 9. 期待結果（UI · 権限）

### 9.1 解約予約直後（期間内）

| 画面 | 期待 |
| --- | --- |
| **Owner edit** | 解約予約バナー（`subscriptionWarning`）· プランは Standard/Pro 表示維持 |
| **Public detail** | FAQ · full_description · recommended_uses **表示継続**（planGate Standard+） |
| **写真上限** | Standard 10 / Pro 20 のまま |

### 9.2 期間終了後（free）

| 画面 | 期待 |
| --- | --- |
| **Owner edit** | Free プラン表示 · アップグレードボタン再表示 |
| **Public detail** | rich セクション **非表示** または Free 相当 |
| **Billing Portal** | 有効 sub なし · 新規 Checkout が必要 |

---

## 10. 確認ポイント（チェックリスト）

### 10.1 解約予約時

- [ ] Stripe Dashboard — Subscription に **Cancel at period end**
- [ ] Webhook `customer.subscription.updated` — **Succeeded**
- [ ] Supabase listing — `cancel_at_period_end=true` · `plan_code` 維持
- [ ] Owner UI — 解約予約メッセージ表示
- [ ] Public — rich コンテンツ **まだ表示**

### 10.2 期間終了後（Test では Dashboard から period 短縮テスト可 · **変更は人手・Test のみ**）

- [ ] Webhook `customer.subscription.deleted` — **Succeeded**
- [ ] Supabase — `plan_code=free`
- [ ] Public planGate — rich **非表示**
- [ ] audit_logs — sync 記録あり

### 10.3 手動 sync フォールバック

Webhook 遅延時:

1. Owner edit で **「サブスク状態を同期」**（表示されている場合）または API `sync_subscription_status`
2. listing 再読込 · plan / バナー確認

---

## 11. 異常時の確認方法

| 症状 | 確認順 | 対処（運用 · 実装変更は別タスク） |
| --- | --- | --- |
| Portal URL が取れない | Edge log · `stripe_customer_id` 有無 | 先に Checkout 完了 · Customer 作成確認 |
| Portal に解約ボタンがない | Stripe Dashboard → Customer portal 設定 | Dashboard 有効化（Test · 人手） |
| 解約後も plan が paid のまま | Webhook 配信ログ · signing secret | Dashboard test delivery · `sync_subscription_status` |
| Webhook 400 signature | `STRIPE_WEBHOOK_SECRET` と Dashboard whsec 一致 | secrets 整合（**変更は承認後**） |
| Webhook 500 | Edge Functions log · listing_id metadata | metadata 欠落 · listing 存在確認 |
| Public が free なのに rich 表示 | `subscription_status` / stripe 信号なしで stored plan 信頼 | M6 参照 · effectivePlanCode 確認 |
| 期間内なのに free 化 | `current_period_end` · `hasPaidBusinessDirectoryAccess` | Stripe sub 状態 · 手動 sync |
| audit が重複 | webhook 再送（M2） | 運用上許容 · 将来 idempotency テーブル |

**ログ参照（読取のみ）:**

- Stripe Dashboard → Developers → Webhooks → イベント詳細
- Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs
- `business_directory_audit_logs` — listing_id でフィルタ

---

## 12. 関連ドキュメント

| ファイル | 用途 |
| --- | --- |
| [r2-production-test-stripe-e2e-runbook.md](./business-directory-r2-production-test-stripe-e2e-runbook.md) | Checkout 含む Test E2E 全体 |
| [production-stripe-e2e-readiness.md](./business-directory-production-stripe-e2e-readiness.md) | Go/No-Go · ブロッカー |
| [phase6-stripe.md](./business-directory-phase6-stripe.md) | Stripe 実装正本 |
| [subscription-model.md](../docs/business-directory-subscription-model.md) | プラン · 解約方針 |

---

## 13. 実行記録（2026-07-01）

| 項目 | 状態 |
| --- | --- |
| Runbook 整備 | ✅ 完了 |
| Portal 解約 E2E 実施 | ⏸ **未実施** |
| Portal API（`create_billing_portal_session`） | ✅ **PASS** — `billing.stripe.com` URL 返却 |
| 解約 → webhook → free 化 | ⏸ 未実施 |

**次アクション:** §10 チェックリストを **Test mode · 4242 済み listing** で実施（Dashboard 変更なし）。

---

*R2 運用準備 — Portal 解約 Runbook。E2E 実施時は本書 §10 チェックリストを記録に残す。*
