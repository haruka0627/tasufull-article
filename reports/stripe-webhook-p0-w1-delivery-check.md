# Stripe Webhook P0-W1 接続確認レポート

**実施日:** 2026-06-17  
**目的:** P0-W1（Dashboard Webhook 配線・疎通・DB 反映）の運用確認  
**方針:** RELEASE FROZEN 維持 / コード・UI 変更なし / GenAI + 上位掲載スコープのみ  
**前提レポート:** [`stripe-webhook-final-check.md`](stripe-webhook-final-check.md)

---

## エグゼクティブサマリー

| 項目 | 結果 |
|------|------|
| **P0-W1（Test mode 配線）** | ✅ **PASS — LOCK 可** |
| **Webhook endpoint 登録** | ✅ 既存 endpoint 確認・イベント有効 |
| **署名検証** | ✅ 欠落/不正 → 400 |
| **checkout.session.completed 疎通** | ✅ 実決済 → DB 反映（confirm 前） |
| **二重付与防止** | ✅ 3D / Featured で confirm 二重 OK |
| **残 P0** | ⚠️ **P0-W2 のみ**（Live モード切替） |
| **本番投入（Test スコープ）** | ✅ 可 |
| **FROZEN 影響** | **なし**（運用・検証のみ） |

---

## 1. 登録した Webhook endpoint

| 項目 | 値 |
|------|-----|
| **URL** | `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook` |
| **Endpoint ID** | `we_1TR70n5tJSRSYcyiMrAzpuGF` |
| **モード** | Stripe **Test** |
| **登録手段** | `stripe-setup-genai-catalog` Edge Function（`ensureGenAiWebhook`） |
| **新規作成** | 否（`created: false` — 既存 endpoint を確認・イベント更新） |
| **Edge Function** | `stripe-webhook` ACTIVE v21 |

**確認コマンド（実施済み）:**

```bash
# API 経由（anon key）で webhook 状態を取得
POST /functions/v1/stripe-setup-genai-catalog
```

---

## 2. 登録イベント

### 2.1 ユーザー指定（最低限）

| イベント | 状態 |
|----------|------|
| `checkout.session.completed` | ✅ **有効** |

### 2.2 endpoint 上の全イベント（既存設定）

| イベント | 状態 | 備考 |
|----------|------|------|
| `checkout.session.completed` | ✅ | 本確認の主対象 |
| `customer.subscription.updated` | ✅ | GenAI サブスク同期（既存・変更なし） |
| `customer.subscription.deleted` | ✅ | 解約同期（既存・変更なし） |

**方針:** 新イベント追加は実施していない。既存 endpoint の `enabled_events` を確認したのみ。

---

## 3. Supabase Secrets 確認結果

**コマンド:** `supabase secrets list`

| Secret | 状態 | 備考 |
|--------|------|------|
| `STRIPE_SECRET_KEY` | ✅ digest あり | Test mode（Edge Function 動作より `sk_test_` 想定） |
| `STRIPE_WEBHOOK_SECRET` | ✅ digest あり | 設定済み |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ digest あり | DB 更新用 |
| `STRIPE_GENAI_PRICE_*`（4件） | ✅ | Checkout 作成 PASS |
| `SUPABASE_URL` | ✅ | 自動注入 + secret |

### STRIPE_WEBHOOK_SECRET 一致確認

| 方法 | 結果 |
|------|------|
| Dashboard `whsec` 値の直接比較 | ⚠️ **未実施**（secret 値は CLI から読取不可） |
| **機能検証（推奨）** | ✅ **一致と判断** |

**根拠（機能検証）:**

1. Stripe Test 決済完了後、**confirm 系を呼ぶ前**に DB が更新された（§5）
2. 不正署名 POST → `400 Invalid signature`（§6）
3. 上記は Stripe が正しい `whsec` で署名したイベントのみ到達し、Edge Function が検証通過したことを示す

---

## 4. Stripe delivery 結果

### 4.1 直接確認（Dashboard / Stripe CLI）

| 手段 | 状態 |
|------|------|
| Stripe Dashboard → Webhooks → Deliveries | ⚠️ 本セッション未スクリーンショット |
| Stripe CLI `stripe trigger` | ⚠️ CLI インストール済み（v1.42.13）だが **未 login**（API key ローカル未保持） |

### 4.2 間接確認（実決済 + Webhook 経路 DB 反映）

| テスト | Session ID（抜粋） | confirm 前 DB 反映 | 推定 delivery |
|--------|-------------------|-------------------|---------------|
| 3D チケット | `cs_test_a1rSjkt0X8BK...` | ✅ ~2s | **200（推定）** |
| Basic サブスク | `cs_test_a1BDqkJXgGQf...` | ✅ ~2s | **200（推定）** |
| 上位掲載 | `cs_test_a1YEslP9RNEe...` | ✅ ~2s | **200（推定）** |

**判定:** Stripe は非 2xx 時に再送する。confirm 未呼び出しで DB が更新されたため、**署名付き delivery が 200 で受理された**と判断（P0-W1 完了条件を満たす）。

### 4.3 補助検証

| 検証 | 結果 |
|------|------|
| `node scripts/test-genai-stripe.mjs` | PASS（0 failed） |
| 署名なし POST | 400 `Missing stripe-signature` |

---

## 5. DB 反映結果（confirm 前・Webhook 経路）

**方法:** Playwright で Stripe Hosted Checkout を Test カード決済 → success URL への遷移（= confirm 自動実行）を **abort** → `stripe-get-genai-plan` / REST のみでポーリング（**confirm 系未呼び出し**）

### 5.1 gen_ai_subscriptions（Basic 300 / dailyVoiceLimit）

| 項目 | 結果 |
|------|------|
| user_id | `u_p0w1_subpure_1781644837748` |
| confirm 前 | `plan_code=basic_300`, `dailyVoiceLimit=30` |
| 反映時間 | **~2 秒** |
| stripe_subscription_id | `sub_1Tj4PU5tJSRSYcyiDTitnKxO` |
| 判定 | ✅ **PASS** |

### 5.2 entitlements（2D Live）

| 項目 | 結果 |
|------|------|
| 本確認での 2D Live 決済 | 未実施（スコープ最小化） |
| 備考 | `checkout.session.completed` + subscription metadata パスは Basic で代替確認済み |

### 5.3 3D grants / tickets

| 項目 | 結果 |
|------|------|
| user_id | `u_p0w1_pure_1781644799736` |
| session_id | `cs_test_a1rSjkt0X8BKPdtaIb6Vd6QlXdiq5A80VGFp3R8UpUwuWvO4auWsJTbnNw` |
| confirm 前 tickets | `0 → 1`（~2s） |
| total_purchased | 1（grant 経由 upsert） |
| 判定 | ✅ **PASS** |

### 5.4 listings 上位掲載

| 項目 | 結果 |
|------|------|
| listing_id | `52e33be8-b49b-442e-8e0d-69b473e26f8b` |
| session_id | `cs_test_a1YEslP9RNEevCwga0zMsjHgbEjuJ4RtmjGzQk8fkIXi70YWZafjNfLoR3` |
| confirm 前 | `is_featured=true`, `featured_plan=featured_7days`, `featured_stripe_session_id` 一致 |
| 反映時間 | **~2 秒** |
| 判定 | ✅ **PASS** |

### 5.5 参考（E2E 全体フロー）

`node scripts/e2e-genai-3d-stripe-purchase.mjs` — 決済〜チケット `0→1` PASS（3D 生成ステップは Tripo タイムアウトで中断、**Webhook 確認には影響なし**）

---

## 6. 署名 NG テスト結果

| ケース | HTTP | Body |
|--------|------|------|
| `stripe-signature` 欠落 | **400** | `Missing stripe-signature` |
| 不正署名 `t=1,v1=invalidsig` | **400** | `Invalid signature` |

**再確認:** ✅ 実施済み（本セッション + 前回 final-check）

---

## 7. 二重送信テスト結果

### 7.1 3D チケット（Webhook 反映後 + confirm 二重）

| 操作 | 結果 |
|------|------|
| Webhook のみ（confirm 前） | tickets `0→1` |
| `stripe-confirm-genai-checkout` ×2 | 両方 `ok: true` |
| 最終 tickets | **1（増えない）** |
| 判定 | ✅ **冪等 PASS** |

**別 session 参考（u_me / 既存購入）:**

- session `cs_test_a1E5lznap1SzO4AzeiN4j2H5dnpz4z0e0puONEAaEjiBUTXMFvVbTmZSgr`
- confirm ×2 → tickets 変化なし ✅

### 7.2 上位掲載（confirm 二重）

| 操作 | 結果 |
|------|------|
| Webhook 反映後 | `featured_stripe_session_id` 設定済み |
| `stripe-confirm-checkout` ×2 | 両方 `ok: true`、エラーなし |
| 判定 | ✅ **冪等 PASS**（session ID ベース早期 return） |

### 7.3 Stripe イベント ID 再送

| 項目 | 状態 |
|------|------|
| `stripe_webhook_events` 表 | 未実装（final-check P2） |
| 同一 checkout session の再 apply | ✅ grants / featured session で防止確認済み |

---

## 8. 残 P0 の有無

| ID | 内容 | 状態 |
|----|------|------|
| **P0-W1** | Test mode Webhook 配線・疎通 | ✅ **解消** |
| **P0-W2** | Live モード `sk_live_` + Live `whsec_` ペア | ⚠️ **未実施**（本番 Live 決済前必須） |

**コード P0:** なし

---

## 9. 本番投入可否

| スコープ | Test mode | Live mode |
|----------|-----------|-----------|
| GenAI Checkout / Subscription | ✅ 可 | P0-W2 後 |
| 3D チケット | ✅ 可 | P0-W2 後 |
| 上位掲載 Featured | ✅ 可 | P0-W2 後 |
| Connect / shop_orders | 対象外（変更なし） | 対象外 |

---

## 10. 最終回答

### Stripe Webhook P0 LOCK 可否

**✅ P0-W1 LOCK 可（Test mode / GenAI + 上位掲載）**

- endpoint 登録済み・イベント有効
- 実決済 `checkout.session.completed` → Webhook 経路 DB 反映を confirm 前に確認
- 署名 NG → 400
- 二重 apply → 増殖なし

**P0-W2（Live 切替）は LOCK 対象外** — 本番 Live 決済開始前に別途実施。

### Live mode に進める条件

1. Stripe Dashboard **Live mode** で同一 URL の Webhook endpoint 作成（または Test endpoint を Live 用に複製）
2. Live `whsec_...` を `STRIPE_WEBHOOK_SECRET` に設定（Test とは別値）
3. `STRIPE_SECRET_KEY` を `sk_live_...` に更新
4. Live Product/Price ID を `STRIPE_GENAI_PRICE_*` に反映
5. `SITE_URL` を本番ドメインに設定
6. Live で 1 件 Test 決済 → confirm 前 DB 反映を再確認（本レポート §5 と同手順）
7. （推奨）Stripe Dashboard Deliveries で **200** を目視確認

### FROZEN 影響

| 操作 | 影響 |
|------|------|
| Webhook endpoint 確認（既存） | なし |
| Test 決済 E2E | なし（テストデータのみ） |
| コード / UI 変更 | **なし** |
| Connect / shop デプロイ | **未実施**（禁止遵守） |

---

## 11. 実施ログ（参考）

| 時刻（UTC 概算） | 操作 |
|------------------|------|
| 2026-06-16T21:00Z | `stripe-setup-genai-catalog` → endpoint 確認 |
| 2026-06-16T21:00Z | 署名 NG テスト 400 ×2 |
| 2026-06-16T21:07Z | `e2e-genai-3d-stripe-purchase.mjs` 決済 PASS |
| 2026-06-16T21:19Z | 3D pure webhook（confirm 前 `0→1`） |
| 2026-06-16T21:20Z | Basic subscription + Featured pure webhook |
| 2026-06-16T21:20Z | 二重 confirm 冪等確認 |

**検証用一時スクリプト:** `%TEMP%\stripe-p0w1-*.mjs`（リポジトリ外・未コミット）

---

**判定者:** Agent（運用・疎通確認のみ）  
**関連:** [`pre-production-p0-action-plan.md`](pre-production-p0-action-plan.md) P0-1 Phase A 完了（Test mode）
