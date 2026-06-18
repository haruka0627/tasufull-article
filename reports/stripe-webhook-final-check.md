# Stripe Webhook 最終確認レポート

**作成日:** 2026-06-17  
**目的:** 本番前接続確認（調査・検証のみ）  
**方針:** RELEASE FROZEN 維持 / 新機能・UI 変更なし / 修正は本レポートで P0/P1 判定のみ  
**対象プロジェクト:** `ddojquacsyqesrjhcvmn`（Supabase）

**関連ドキュメント:** [`pre-production-p0-action-plan.md`](pre-production-p0-action-plan.md) / [`pre-production-cross-audit-remaining-issues.md`](pre-production-cross-audit-remaining-issues.md) / [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) / [`connect-release-status.md`](connect-release-status.md)

---

## エグゼクティブサマリー

| 項目 | 判定 |
|------|------|
| **Webhook 実装（コード）** | ✅ 署名検証・GenAI/上位掲載処理は実装済み |
| **Edge Function デプロイ** | ✅ `stripe-webhook` ACTIVE（v21） |
| **Supabase Secrets** | ✅ `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / GenAI Price IDs 設定済み |
| **Stripe Dashboard 配線** | ⚠️ **本セッションでは未確認**（過去監査: 未接続想定） |
| **Connect / 市場EC shop Webhook** | ❌ サーバー側未実装（ブラウザ sim / confirm フォールバック） |
| **本番投入（Webhook スコープ限定）** | ⚠️ **条件付き可** — Dashboard 登録・疎通・Live 切替が P0 運用タスク |
| **本番投入（Connect + 市場EC DB 含む全体）** | ❌ **不可**（RELEASE FROZEN 上 P2 として既知） |

---

## 1. 現状調査

### 1.1 アーキテクチャ概要

```
Stripe Dashboard
    │ POST + Stripe-Signature
    ▼
supabase/functions/stripe-webhook/index.ts   ← 唯一のサーバー Webhook
    │ service_role (getServiceSupabase)
    ├── gen_ai_subscriptions / gen_ai_entitlements / gen_ai_3d_*
    └── listings (featured)

フォールバック（Webhook 非依存・anon 呼び出し可）:
    stripe-confirm-checkout        → listings (featured)
    stripe-confirm-genai-checkout  → gen_ai_* + dailyVoiceLimit 等
    stripe-confirm-shop-checkout   → shop_orders（※未デプロイ）

Connect / 運営 KPI:
    stripe-connect-ingest.js       → localStorage のみ（本番 HTTP endpoint なし）
```

### 1.2 本セッションで実施した検証

| 検証 | コマンド / 操作 | 結果 |
|------|-----------------|------|
| GenAI Checkout スモーク | `node scripts/test-genai-stripe.mjs` | **PASS**（0 failed） |
| Webhook 署名なし POST | `curl.exe -X POST .../stripe-webhook` | **400** `Missing stripe-signature` |
| Supabase Secrets | `supabase secrets list` | STRIPE_* / GENAI Price IDs あり |
| Functions デプロイ | `supabase functions list` | `stripe-webhook` ACTIVE v21 |
| Shop Functions | 同上 | `stripe-create-shop-checkout` / `stripe-confirm-shop-checkout` **未デプロイ** |
| Stripe Dashboard delivery | — | **未実施**（Dashboard API / CLI ログ未確認） |

---

## 2. Webhook endpoint 一覧

| # | 種別 | URL / 所在 | 署名検証 | 状態 |
|---|------|------------|----------|------|
| 1 | **本番 Edge Function** | `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook` | ✅ `constructEventAsync` | デプロイ済み・稼働中 |
| 2 | Connect ingest（ブラウザ） | `stripe-connect-ingest.js` → `localStorage` | ❌ なし（sim） | RELEASE FROZEN / P2-8 |
| 3 | AI 運営 KPI ingest | `admin-ai-kpi-center.js` 等 | ❌ sim のみ | P2 |
| 4 | GenAI セットアップ補助 | `stripe-setup-genai-catalog` → `ensureGenAiWebhook()` | Stripe API で endpoint 作成（**sk_test_ のみ**） | テストモード用 |

**Stripe Dashboard 登録 URL（推奨）:**

```
https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook
```

---

## 3. 対応イベント一覧

### 3.1 `stripe-webhook` が処理するイベント

| イベント | 処理内容 | DB / 副作用 |
|----------|----------|-------------|
| `checkout.session.completed` | GenAI metadata 判定 → プラン/entitlement 適用 | `gen_ai_subscriptions`, `gen_ai_entitlements`, `gen_ai_3d_tickets`, `gen_ai_3d_ticket_grants` |
| `checkout.session.completed` | `listing_id` + `featured_plan` metadata | `listings`（featured 列） |
| `customer.subscription.updated` | GenAI basic/pro 同期 | `gen_ai_subscriptions` |
| `customer.subscription.updated` | 2D Live 同期 | `gen_ai_entitlements` |
| `customer.subscription.deleted` | 同上（解約・期間末処理） | 同上 |

### 3.2 未処理イベント（コード上存在しない）

| イベント | 影響範囲 | 現状フォールバック |
|----------|----------|-------------------|
| `payment_intent.succeeded` | Connect 決済完了 KPI | ブラウザ `stripe-connect-event-map.js` のみ |
| `payment_intent.payment_failed` | Connect 障害チケット | 同上（sim PASS 13/13） |
| `account.updated` / `capability.updated` | Connect 本人確認状態 | `connect-member-ui.js` デモ seed / localStorage |
| `payout.paid` / `payout.failed` | 振込通知 | 同上 |
| `charge.dispute.*` | チャージバック | 同上 |
| `checkout.session.completed`（`order_type: shop_product`） | 市場EC `shop_orders` | `stripe-confirm-shop-checkout`（未デプロイ） |
| `checkout.session.completed`（`order_type: service_platform_fee`） | サービス手数料 | confirm Function **未実装** |
| `invoice.payment_failed` 等 | サブスク請求失敗 | 未処理（`subscription.updated` の status 依存） |

---

## 4. DB 更新一覧

| テーブル | 更新経路 | Webhook | confirm-* | RLS（client 直接） |
|----------|----------|---------|-----------|-------------------|
| `gen_ai_subscriptions` | `apply-genai-plan.ts` | ✅ | ✅ | **deny all** ✅ |
| `gen_ai_entitlements` | `apply-genai-entitlements.ts` | ✅ | ✅ | **deny all** ✅ |
| `gen_ai_3d_tickets` | 同上 | ✅ | ✅ | deny（grants 経由） |
| `gen_ai_3d_ticket_grants` | 同上（冪等キー） | ✅ | ✅ | **deny all** ✅ |
| `listings`（featured） | `apply-featured-listing.ts` | ✅ | ✅ | ⚠️ `*_dev` 残存時 anon CRUD（P1 RLS） |
| `shop_orders` | `apply-shop-order.ts` | ❌ | ✅（コードのみ） | テーブル未デプロイ（RLS 監査 404） |

### dailyVoiceLimit 反映経路

- Checkout / Subscription 適用時に `gen_ai_subscriptions.daily_voice_limit` をプラン定義値で upsert
- 読取: `stripe-get-genai-plan` → `dailyVoiceLimit` をフロント（`stripe-genai-config.js` FREE_PLAN / PLANS 定義と整合）
- Webhook 経由でも confirm 経由でも **同一 upsert 関数** を使用

---

## 5. env 必須項目

### 5.1 Supabase Edge Function Secrets（必須）

| 変数 | 用途 | 本番 DB 確認 |
|------|------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API | ✅ 設定済み（digest あり） |
| `STRIPE_WEBHOOK_SECRET` | 署名検証 `whsec_...` | ✅ 設定済み |
| `SUPABASE_SERVICE_ROLE_KEY` | DB 更新 | ✅ 設定済み |
| `SUPABASE_URL` | DB 接続 | ✅ 自動注入 + secret あり |

### 5.2 GenAI / Featured 関連（Webhook 処理に必要）

| 変数 | 用途 | 状態 |
|------|------|------|
| `STRIPE_GENAI_PRICE_BASIC_300` | Basic プラン price 解決 | ✅ |
| `STRIPE_GENAI_PRICE_PRO_980` | Pro プラン | ✅ |
| `STRIPE_GENAI_PRICE_2D_LIVE_300` | 2D Live サブスク | ✅ |
| `STRIPE_GENAI_PRICE_3D_GENERATE_500` | 3D チケット | ✅ |
| `SITE_URL` | Checkout 戻り URL（create 系） | ⚠️ secrets list に**未表示**（Featured ドキュメント推奨） |

Featured 上位掲載は price を Checkout metadata / price_data で生成するため、専用 Price ID secret は必須ではない。

### 5.3 ローカル開発

| 項目 | 内容 |
|------|------|
| Stripe CLI | `stripe listen --forward-to https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook` |
| `.env` | Stripe secret を**コミットしない** |
| テスト | `node scripts/test-genai-stripe.mjs` |

### 5.4 不足・要確認項目

| ID | 項目 | 重要度 |
|----|------|--------|
| E-1 | `SITE_URL` 本番ドメイン確定後の設定 | P1（Checkout 戻り先） |
| E-2 | Live モード用 **別** `sk_live_` + **別** `whsec_` | P0（本番決済時） |
| E-3 | Stripe Dashboard endpoint 登録と secret ペア一致 | P0（運用） |
| E-4 | `shop_orders` テーブル + shop Edge Functions デプロイ | P1（市場EC Supabase 連携時） |

---

## 6. 署名検証状況

**実装:** `supabase/functions/stripe-webhook/index.ts`

| チェック項目 | 実装 | 検証結果 |
|-------------|------|----------|
| `STRIPE_WEBHOOK_SECRET` 未設定 | `500 Stripe secrets not configured` — **処理しない** | ✅ コード確認 |
| `STRIPE_SECRET_KEY` 未設定 | 同上 | ✅ |
| `stripe-signature` ヘッダ欠落 | `400 Missing stripe-signature` | ✅ **live 疎通** |
| 署名不一致 | `400 Invalid signature` + error log | ✅ コード確認 |
| 検証ライブラリ | `stripe.webhooks.constructEventAsync` | ✅ |

**confirm-* 系:** Webhook 署名は**不要**（設計上）。代わりに Stripe API で `checkout.sessions.retrieve(sessionId)` し `payment_status === paid` を確認。

---

## 7. Idempotency 状況

| 処理 | 冪等キー | 再送時の挙動 | 評価 |
|------|----------|-------------|------|
| 上位掲載 | `listings.featured_stripe_session_id` | 同一 session → 早期 return | ✅ |
| 3D チケット | `gen_ai_3d_ticket_grants.stripe_session_id` UNIQUE | 23505 / 既存 grant → skip | ✅ |
| GenAI サブスク | `gen_ai_subscriptions.user_id` upsert | 同一内容再適用 | ✅（上書きは意図通り） |
| 2D Live | `(user_id, entitlement_type)` upsert | 同上 | ✅ |
| **Stripe Event ID** | **なし**（`stripe_webhook_events` 等未実装） | 処理失敗後の部分成功リスクは低いが追跡不可 | ⚠️ P2 |
| shop_orders | `stripe_checkout_session_id` UNIQUE | confirm 経路のみ | ✅（Webhook 未接続） |

**Stripe 再試行方針（現状）:**

- DB apply 失敗 → **500** 返却 → Stripe が再送（適切）
- metadata 不足（featured）→ **200 skip** + warn log → 再送しても修復されない（設定ミスは P2 運用リスク）
- 未対応 event type → **200** `{ received: true }` → 再送ループなし

---

## 8. Connect 対応状況

| 項目 | 状態 |
|------|------|
| サーバー Webhook | ❌ `account.*` / `payout.*` / `payment_intent.*` 未処理 |
| 本人確認状態 DB 同期 | ❌ Edge Function なし。UI は `connect-member-ui.js` + デモ seed |
| 運営トラブル ingest | ✅ ブラウザ sim（`stripe-connect-ingest.js`）— RELEASE FROZEN |
| リリース判定 | Connect RELEASE FROZEN / P2-8「本番 webhook 統合テスト」 |
| コード変更要否（FROZEN 内） | **不要**（接続フェーズは別 Epic） |

---

## 9. Subscription / GenAI 対応状況

| プラン | Checkout | Webhook | Subscription イベント | dailyVoiceLimit |
|--------|----------|---------|----------------------|-----------------|
| free（既定） | — | — | 解約時 revert | 5 |
| genai_basic_300 | ✅ | ✅ | ✅ updated/deleted | 30 |
| genai_pro_980 | ✅ | ✅ | ✅ | 100 |
| genai_2d_live_300 | ✅ | ✅ | ✅ | entitlements 側（無制限フラグ） |
| genai_3d_generate_500 | ✅ payment | ✅ | — | チケット制 |

**検証:** `node scripts/test-genai-stripe.mjs` → **全 PASS**

**Portal:** `stripe-create-genai-portal` デプロイ済み（Customer Portal 経由の変更は Stripe → `subscription.updated` webhook で同期）

---

## 10. service_role 使用箇所

| モジュール | 用途 |
|-----------|------|
| `_shared/apply-featured-listing.ts` | `getServiceSupabase()` 定義元 |
| `_shared/apply-genai-plan.ts` | subscriptions upsert / read |
| `_shared/apply-genai-entitlements.ts` | entitlements / 3D tickets / grants |
| `_shared/apply-shop-order.ts` | shop_orders insert |
| `stripe-webhook/index.ts` | 上記 apply 関数を呼び出し |
| `stripe-confirm-*` | 同上 |
| `stripe-get-genai-plan` | read only（service_role） |
| `stripe-create-service-fee` | 参照用 DB read |

**anon/client から service_role キーは露出していない**（`chat-supabase-config.js` は anon のみ）。

---

## 11. anon/client から直接更新できないか

| テーブル | client 直接 UPDATE | 備考 |
|----------|-------------------|------|
| `gen_ai_subscriptions` | ❌ deny（ポリシー 0 または deny ポリシー） | ✅ |
| `gen_ai_entitlements` | ❌ explicit deny policy | ✅ |
| `gen_ai_3d_ticket_grants` | ❌ explicit deny | ✅ |
| `listings` featured | ⚠️ **可能（dev RLS 残存時）** | P1 — RLS 監査 H-1 |
| `shop_orders` | テーブル未存在 | デプロイ時 RLS 必須（P2-2 監査案） |

**Edge Function 経由の昇格リスク（Webhook 外）:**

- `stripe-confirm-genai-checkout` / `stripe-confirm-checkout` は **JWT 未検証**、anon key で呼び出し可
- ただし **有効な paid `session_id`** が必要 → 決済なしの任意 plan 付与は不可
- 他ユーザーの session_id を知っている場合は理論上 apply 可能 → **P1**（本番では user JWT と metadata.user_id 突合推奨、FROZEN 解凍要）

---

## 12. テストモード / 本番モード切替

| 項目 | 現状推定 | 本番切替 |
|------|----------|----------|
| Stripe API キー | `sk_test_` 想定（GenAI smoke PASS、`stripe-setup-genai-catalog` は test のみ） | Dashboard Live → `sk_live_` を secret 更新 |
| Webhook endpoint | Test / Live で **別 URL 同一でも別 whsec** | Live endpoint 新規 + `STRIPE_WEBHOOK_SECRET` 更新 |
| Price IDs | Test mode Product/Price | Live で再作成 or 本番 Price ID を secret 更新 |
| E2E 補助 | `stripe-e2e-*` Functions デプロイ済み | 本番では無効化推奨（P2 運用） |

---

## 13. エラー時ログ / 再試行方針

| ケース | HTTP | ログ | Stripe 再送 |
|--------|------|------|------------|
| secret 未設定 | 500 | なし（早期 return） | 再送 |
| 署名 NG | 400 | `[stripe-webhook] signature verification failed` | 通常は再送しない |
| genai apply 失敗 | 500 | `[stripe-webhook] genai apply failed` | 再送 ✅ |
| featured apply 失敗 | 500 | `[stripe-webhook] apply failed` | 再送 ✅ |
| metadata 不足 | 200 | `missing metadata` warn | 再送（修復されない） |
| ハンドラ例外 | 500 | `[stripe-webhook]` stack | 再送 ✅ |

**監視推奨:** Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs / Stripe Dashboard → Webhook deliveries

---

## 14. リスク分類

### P0 — 本番 Webhook 接続ブロッカー

| ID | リスク | 種別 | 内容 | 修正 |
|----|--------|------|------|------|
| **P0-W1** | Stripe Dashboard endpoint 未登録 or delivery 未確認 | **運用** | Secrets はあるが Dashboard 側の Enabled / 200 delivery を本セッション未確認。過去監査も「未接続」 | Dashboard 登録 + `stripe trigger` / テスト決済 + Logs 確認。**コード変更不要** |
| **P0-W2** | Live 決済時の Test/Live キー・whsec 混在 | **運用** | 現状 Test 想定。本番決済前に Live ペア必須 | Live endpoint + secrets 更新。**コード変更不要** |

**コード上の P0（署名スキップ・二重付与・secret 未設定時処理）:** **検出なし**

### P1 — 本番前に計画すべき項目（FROZEN 解凍 or 運用のみ）

| ID | リスク | 内容 |
|----|--------|------|
| P1-W1 | `SITE_URL` 未設定の可能性 | Checkout success/cancel URL が localhost 残り |
| P1-W2 | confirm-* JWT 未検証 | session_id 保持者が apply 可能 |
| P1-W3 | 市場EC Supabase 未配線 | `shop_orders` 未デプロイ、shop Functions 未デプロイ |
| P1-W4 | `listings` dev RLS | featured 列の client 直接改ざん（RLS P1 と共通） |
| P1-W5 | `stripe-confirm-service-fee` 未実装 | config 参照あるが Function なし |

### P2 — リリース後 / FROZEN 既知

| ID | リスク | 内容 |
|----|--------|------|
| P2-W1 | Connect 本番 Webhook | `stripe-connect-ingest.js` sim のみ（Connect P2-8） |
| P2-W2 | `payment_intent.*` 未処理 | Connect KPI / 障害は sim |
| P2-W3 | shop Webhook 未処理 | confirm フォールバック設計（Functions デプロイ後も可） |
| P2-W4 | Stripe Event ID 永続化なし | 監査・デバッグ用テーブル未実装 |
| P2-W5 | metadata 不足時 200 | 運用検知が Dashboard logs 依存 |
| P2-W6 | E2E simulate Functions 本番残存 | 攻撃面・誤用の運用リスク |

---

## 15. 修正候補（実装は FROZEN 解凍後）

### 15.1 運用のみ（RELEASE FROZEN 非影響）— P0 推奨

```bash
# 1. Dashboard Webhook 登録（イベント 3 種）
#    checkout.session.completed
#    customer.subscription.updated
#    customer.subscription.deleted

# 2. whsec を Supabase に反映（Test 例）
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# 3. 疎通
stripe listen --forward-to https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook
stripe trigger checkout.session.completed

# 4. Logs 確認（signature OK → 200）
```

### 15.2 SQL 候補（P2 — Event 冪等ログ）

```sql
-- 任意: Stripe event.id 単位の処理済み記録
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now(),
  payload_summary jsonb default '{}'::jsonb
);
alter table public.stripe_webhook_events enable row level security;
-- deny all for anon/authenticated; service_role only
```

### 15.3 コード候補（P1 — FROZEN 解凍要）

**`stripe-webhook/index.ts` 先頭付近（event 重複ガード）:**

```typescript
// 擬似: insert event_id → 23505 なら 200 return
```

**`stripe-confirm-genai-checkout/index.ts`（JWT 突合）:**

```typescript
// Authorization Bearer の user.id === metadata.user_id を検証
```

**`stripe-webhook/index.ts`（shop 分岐 — 市場EC Epic）:**

```typescript
// checkout.session.completed で order_type === "shop_product"
// → upsertShopOrderFromCheckout(...)
```

**Connect Epic（新 Edge Function 推奨、既存 webhook 拡張は FROZEN 方針次第）:**

```typescript
// account.updated / capability.updated → seller connect status テーブル
// payment_intent.payment_failed → 運営 ticket ingest（サーバー側）
```

---

## 16. 本番投入可否

### 16.1 スコープ別判定

| スコープ | 可否 | 条件 |
|----------|------|------|
| **GenAI 課金 + 上位掲載（Webhook 経路）** | ⚠️ **条件付き可** | P0-W1/W2 運用作業完了後 |
| **GenAI（confirm フォールバックのみ）** | ✅ 可 | 既に Edge Functions 稼働・smoke PASS |
| **Connect 本人確認 / payout** | ❌ 不可（設計通り） | P2-8。sim で RELEASE OK 済み |
| **市場EC shop_orders → Supabase** | ❌ 不可 | テーブル + Functions 未配線 |
| **Builder / TALK 決済 UI** | ✅ UI 凍結のまま | GenAI Stripe 導線は confirm/webhook 両対応 |

### 16.2 RELEASE FROZEN への影響

| 操作 | FROZEN 影響 |
|------|-------------|
| Dashboard Webhook 登録 | **なし**（インフラのみ） |
| Secrets 更新（whsec / sk_live） | **なし** |
| `supabase functions deploy stripe-webhook`（現行 Git） | **なし**（再デプロイのみ） |
| P0-W1 疎通確認 | **なし** |
| P1/P2 コード修正（JWT / shop / Connect / event 表） | **あり** — 解凍・別 PR 要 |

---

## 17. 最終回答

### Stripe Webhook は本番投入可能か？

**部分的に可能（条件付き）。**

- **実装品質:** 署名検証・secret 未設定時の停止・GenAI/Featured の DB 更新経路は **本番水準**。
- **接続完了:** **P0-W1（Dashboard 登録 + delivery 200 確認）** が未完了のため、現時点では「本番接続確認完了」とは言えない。
- **Connect / 市場EC 全体:** RELEASE FROZEN ドキュメント通り **Webhook スコープ外**。本番 Stripe イベントで Connect 状態や `shop_orders` を更新する要件がある場合は **投入不可**。

### P0 修正の有無

| 区分 | 有無 |
|------|------|
| **コード P0** | **なし** |
| **運用 P0** | **あり（2 件）** — P0-W1 Dashboard 配線確認、P0-W2 Live 切替時 secret ペア |

### 修正対象ファイル（将来・FROZEN 解凍時）

| 優先 | ファイル | 目的 |
|------|----------|------|
| P0 運用 | Stripe Dashboard / Supabase Secrets | 配線・Live 切替 |
| P1 | `supabase/functions/stripe-confirm-genai-checkout/index.ts` | JWT 検証 |
| P1 | `supabase/functions/stripe-confirm-checkout/index.ts` | 同上 |
| P1 | — | `SITE_URL` secret 設定 |
| P1 | shop Functions + `shop_orders.sql` | 市場EC DB |
| P2 | `supabase/functions/stripe-webhook/index.ts` | shop / event id / Connect |
| P2 | 新規 `stripe-connect-webhook` 等 | Connect 本番 ingest |
| P2 | `sql/stripe_webhook_events.sql`（新規） | Event 冪等ログ |

---

## 18. 推奨チェックリスト（本番前・コード変更なし）

- [ ] Stripe Dashboard（Test）→ Webhook endpoint **Enabled**
- [ ] 購読イベント 3 種が有効
- [ ] `STRIPE_WEBHOOK_SECRET` が Dashboard の whsec と一致
- [ ] `stripe trigger checkout.session.completed` → Edge Log **200**
- [ ] GenAI テスト Checkout → `gen_ai_subscriptions` 反映確認
- [ ] Featured テスト Checkout → `listings.is_featured` 反映確認
- [ ] Live 切替時: 別 endpoint + `sk_live_` + Live Price IDs
- [ ] `node scripts/test-genai-stripe.mjs` 再実行 PASS

---

**検証実施者:** Agent（調査・検証のみ / コード・UI 未変更）  
**次アクション（ユーザー判断）:** P0-W1 運用配線の実施可否。実装修正は本レポート P1/P2 を承認後に別タスク。
