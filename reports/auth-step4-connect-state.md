# NB-3 STEP 4: Connect 状態 JWT/DB 化レポート

**作成日:** 2026-06-18  
**前提:** [`auth-jwt-design-final.md`](auth-jwt-design-final.md) · STEP 2 `TasuAuthCurrentUser` · STEP 3 `TasuAuthOpsGuard`  
**種別:** Connect 状態参照元整理 + 最小実装（Stripe Live / 実 onboarding / RLS / DB スキーマ変更 **未実施**）

---

# 実装内容

## 新規 `connect-state.js`（`window.TasuConnectState`）

| API | 役割 |
|-----|------|
| `getConnectState()` | `{ step, ready, onboardingRequired, talkUserId, stripeAccountId, source }` |
| `getConnectStateSource()` | 取得元ラベル |
| `getConnectStep()` / `isConnectReady()` | UI 互換 |
| `isConnectOnboardingRequired()` | 未完了判定 |
| `requireConnectReady()` | 未 ready 時 `CONNECT_ONBOARDING_REQUIRED` |
| `refreshConnectStateFromDb()` | Supabase `listings` / `business_listings` から非同期取得 |
| `getSellerStatusForUser()` | TALK 通知用 seller status（本番は JWT ユーザー） |
| `saveDemoOnboarding()` / `readDemoOnboardingLs()` | デモ LS 書込（本番 host では read 無効） |

### 状態解決優先順

| 環境 | 順序 |
|------|------|
| **本番 host** | ① JWT `talk_user_id` 必須 → ② Supabase 行（`stripe_account_id` / `payout_account_status` / `payout_enabled`）→ ③ 未確認は `top` / `onboardingRequired` |
| **デモ host** | ① LS `tasful_connect_onboarding_v1` → ② `?connectStep=` → ③ LS `tasful_demo_connect_seller_status_v1` → ④ デフォルト `top` |

## 既存接続

| ファイル | 変更 |
|----------|------|
| `payment-settings.js` | `resolveConnectStep` / `saveConnectOnboarding` → helper 委譲 · DB refresh 後 render |
| `connect-member-ui.js` | ダッシュボードバナー / step 解決 → helper 委譲 |
| `platform-chat-connect-chat-flow.js` | `getSellerConnectStatus` — 本番 LS 無視 · helper 優先 |
| `platform-chat-category-flow.js` | `readDemoConnectFlag` — 本番 host で `?demoConnect=` 無効 |
| `payment-settings.html` / `dashboard.html` | `<script src="connect-state.js">` 追加 |

---

# 追加/変更ファイル

| ファイル | 種別 |
|----------|------|
| **`connect-state.js`** | 新規 — ブラウザ helper |
| **`scripts/lib/connect-state-core.mjs`** | 新規 — Node 単体テスト |
| **`scripts/test-connect-state.mjs`** | 新規 — STEP 4 検証 |
| `payment-settings.js` | 変更 |
| `connect-member-ui.js` | 変更 |
| `platform-chat-connect-chat-flow.js` | 変更 |
| `platform-chat-category-flow.js` | 変更 |
| `payment-settings.html` | script 1 行 |
| `dashboard.html` | script 1 行 |

---

# Connect 状態の正規取得元

| source | 意味 | 本番 |
|--------|------|------|
| `jwt` + `db_listing` | JWT ユーザー + Supabase 行 | ✅ 正 |
| `unauthenticated` | 未ログイン | ✅ onboarding required |
| `none` | JWT あり · DB 未確認/未設定 | ✅ onboarding required |
| `demo_localStorage` | `tasful_connect_onboarding_v1` | ❌ 無視 |
| `demo_seller_status` | `tasful_demo_connect_seller_status_v1` | ❌ 無視 |
| `demo_url` | `?connectStep=` | ❌ 無視 |

**DB 参照列（既存 · スキーマ変更なし）:**  
`listings` / `business_listings` の `stripe_account_id`, `payout_account_status`, `payout_enabled`, `form_data.*`

**将来（STEP 4+ / Stripe 実装）:** Edge `resolve-shop-payout` 応答 · Stripe Account status API

---

# 本番で禁止した fallback

| 禁止対象 | 本番挙動 |
|----------|----------|
| `localStorage tasful_connect_onboarding_v1` | ready 判定に不使用 |
| `localStorage tasful_demo_connect_seller_status_v1` | 現行ユーザー以外は `identity` 安全側 |
| `?connectStep=` | 無視 |
| `?demoConnect=1` | `readDemoConnectFlag` で無視 |
| config / URL `connected=true` 相当 | 未実装 · LS ready 昇格不可 |
| 未ログイン | `onboardingRequired` · step `top` |

---

# demo 互換条件

| 条件 | LS / URL fallback |
|------|-------------------|
| localhost / 127.0.0.1 / file:// | ✅ |
| `?talkDev=1` | ✅ |
| `?connectStep=identity` 等 | ✅ |
| Connect デモフロー（本人確認通知 seed） | ✅ 維持 |

---

# payment-settings 接続結果

| ケース | 結果 |
|--------|------|
| localhost `?talkDev=1&connectStep=identity` | ✅ 本人確認 UI · バッジ表示 |
| localhost LS `step:ready` | ✅ ready 表示 |
| 本番想定 + LS ready | ✅ **無視** · not ready |
| 未ログイン（本番想定） | ✅ onboarding required |
| JWT + DB 未確認 | ✅ onboarding required |
| 表示 DOM（steps / onboarding root） | ✅ 崩れなし |

---

# TALK / AI秘書への影響

| 箇所 | 接続 | 備考 |
|------|------|------|
| **`platform-chat-connect-chat-flow.js`** `getSellerConnectStatus` | ✅ helper 接続 | 本番 LS 無効 |
| **`payment-settings.js`** `upsertConnectIdentityNotification` | ✅ 間接（demo seed 維持） | 通知生成はデモ導線のまま |
| **`talk-notifications-store.js`** Connect 通知 filter | — 変更なし | source 文字列で識別 · 表示維持 |
| **`talk-home.js`** Connect 通知 tier | — 変更なし | 重大影響なし |
| **`admin-operations-dashboard.js`** Connect カード | — 変更なし | support tickets / ingest 由来 · LS 非依存 |

### 次 STEP 対象（未接続 · 理由）

| 箇所 | 理由 |
|------|------|
| `syncDemoConnectRequirementNotifications` 全体 | デモ seed 専用 · 本番 Edge 通知に置換は Stripe onboarding 後 |
| `stripe-connect-ingest.js` LS シミュレーション | NB-7 / Webhook 実装スコープ |
| ops 書込 adapter Connect 状態 | STEP 8 RLS 再検証 |

---

# 市場 / Featured への影響

| 参照箇所 | 本番 LS 依存 | STEP 5 対応 |
|----------|-------------|-------------|
| `platform-chat-category-flow.js` `isCategoryConnectEnabled` | listing 行 + **本番 `?demoConnect` 禁止済** | seller JWT + listing DB |
| `shop-payout.js` `isShopPurchaseConnectEnabled` | URL `demoConnect` · listing 列 | 市場 checkout JWT 化 |
| `shop-checkout.js` `seller_stripe_account_id` | payout extract | Path B + DB |
| `platform-chat-fee.js` `hasStripeConnect` | listing フィールド | 同上 |
| `stripe-featured-config.js` / Featured checkout | Connect seller 未検証 | STEP 5 |
| `detail-shop-store-bottom.js` connect notice | Category helper 経由 | 最小影響 |

**今回変更:** `readDemoConnectFlag` の本番 URL 遮断のみ（listing 埋込 `connect:true` はデモ掲載用として残存）

---

# 未対応箇所

| ID | 内容 | 時期 |
|----|------|------|
| U-C1 | Stripe Connect 実 onboarding API | Stripe Live 承認後 |
| U-C2 | 専用 Edge `connect-status` エンドポイント | onboarding 実装時 |
| U-C3 | `tasful_platform_connect_payments_v1` LS | Webhook / NB-7 |
| U-C4 | 他ユーザー seller status の DB 参照（チャット相手方） | STEP 5 |
| U-C5 | Featured checkout seller Connect 強制 | STEP 5 |

---

# 検証結果

```bash
node scripts/test-connect-state.mjs                 # ALL PASS
node scripts/test-auth-current-user.mjs             # ALL PASS
node scripts/test-auth-ops-guard.mjs                # ALL PASS
node scripts/test-admin-operations-dashboard-browser.mjs  # 59/59 PASS
```

| # | ケース | 結果 |
|---|--------|------|
| 1 | localhost demo Connect ready（LS） | ✅ |
| 2 | localhost demo onboarding required（identity） | ✅ |
| 3 | `?talkDev=1` fallback | ✅ |
| 4 | production 想定 LS ready 無効 | ✅ |
| 5 | 未ログイン onboarding required | ✅ |
| 6 | JWT + DB 未確認 onboarding required | ✅ |
| 7 | payment-settings 表示 | ✅ |
| 8 | AI秘書 / TALK Connect 警告 | ✅ 回帰 PASS |

---

# STEP 4 判定

## **PASS**

| PASS 条件 | 状態 |
|-----------|------|
| 本番 host で LS Connect ready 無効 | ✅ |
| helper 経由で Connect 状態取得 | ✅ `TasuConnectState` |
| payment-settings helper 接続済 | ✅ |
| 既存デモ互換 | ✅ |
| STEP 5 市場 buyer/seller JWT 化へ進める | ✅ |

**次ステップ:** NB-3 STEP 5 — 市場 buyer/seller JWT 化（`shop-checkout.js` · `isCategoryConnectEnabled` · cart/orders）

---

**参照:** [`connect-state.js`](../connect-state.js) · [`auth-helper-step2-report.md`](auth-helper-step2-report.md) · [`auth-step3-ops-guard.md`](auth-step3-ops-guard.md)
