# Connect 本番化 — 準備調査（Gap 分析）

**作成日:** 2026-06-18  
**種別:** 調査のみ（コード変更なし）  
**前提:** Connect UX **RELEASE FROZEN** · 36 PASS（[`connect-release-status.md`](connect-release-status.md)）  
**Stripe Live との関係:** GenAI/Featured Live と **独立**だが、**Marketplace GMV は Connect 前提**

---

## 1. 機能別現状

### Account Link

| 分類 | 状態 | 根拠 |
|------|------|------|
| **未接続** | Stripe `AccountLink` / `accounts.create` **API 呼出なし** | 全 repo grep · Edge Function なし |
| mock | デモボタンで localStorage ステップ進行 | `payment-settings.js` |
| 本番前必須 | **Connect Epic 新規 Edge** | Marketplace B-4 |
| 後回し | — | — |

---

### Onboarding

| 分類 | 状態 | 根拠 |
|------|------|------|
| **実装済み（UX）** | ステップマシン top→identity→qualification→ready | `connect-member-ui.js` · `payment-settings.js` |
| **localStorage** | `tasful_connect_onboarding_v1` | 同上 |
| **mock** | identity submit = ローカル状態更新のみ | `payment-settings.js` |
| **未接続** | Stripe hosted onboarding リダイレクトなし | — |
| 本番前必須 | onboarding API + DB 永続化 | C-1 |
| 後回し | payout エラー再セットアップ wizard | P2-9 |

---

### Webhook（Connect イベント）

| 分類 | 状態 | 根拠 |
|------|------|------|
| **実装済み（分類マップ）** | 14+ イベント定義 | `stripe-connect-event-map.js` |
| **mock** | `stripe-connect-ingest.js` → **ブラウザ localStorage のみ** | HTTP endpoint なし |
| **未接続** | `stripe-webhook` に Connect 分岐 **なし** | `stripe-webhook/index.ts` |
| 本番前必須 | `account.*` · `payout.*` · `payment_intent.*` サーバー処理 | C-3 |
| 後回し | `stripe_webhook_events` 冪等 | P2 |

---

### Account Status

| 分類 | 状態 | 根拠 |
|------|------|------|
| **mock** | `tasful_demo_connect_seller_status_v1` | `platform-chat-connect-chat-flow.js` |
| **実装済み（表示）** | バナー · バッジ · 免責 | `connect-member-ui.js` |
| **Supabase** | `business_listings.stripe_account_id` 等 **列設計あり** · UI 未同期 | `resolve-shop-payout.ts` |
| **未接続** | Webhook による status 同期 | — |
| 本番前必須 | DB + Webhook sync | C-2, C-3 |
| 後回し | stale requirement 表示 | P2 |

---

### Payout

| 分類 | 状態 | 根拠 |
|------|------|------|
| **実装済み（コード）** | destination charge + `application_fee` | `stripe-create-shop-checkout/index.ts` |
| **mock** | sim `payout.paid` / `payout.failed` | ingest + event-map |
| **未接続** | 実 payout 状態 DB 反映 | — |
| 本番前必須 | Connect onboarding + `payout_enabled` gate | C-1, C-2 |
| 後回し | payout ダッシュボード UI | P2 |

---

### 本人確認（Identity / KYC）

| 分類 | 状態 | 根拠 |
|------|------|------|
| **実装済み（UX）** | identity パネル · submit | `payment-settings.html` |
| **mock** | Stripe リダイレクトなし · localStorage のみ | — |
| **実装済み（運営）** | requirements_past_due → support ticket | ingest sim · 13/13 PASS |
| **未接続** | `account.updated` Webhook → DB | — |
| 本番前必須 | AccountLink + Webhook | C-1, C-3 |
| 後回し | バッジ文言統一 | P2 |

---

### 出金

| 分類 | 状態 | 根拠 |
|------|------|------|
| **mock** | sim イベント · 通知 UI | `platform-chat-connect-chat-flow.js` |
| **未接続** | 実 Stripe payout schedule | — |
| 本番前必須 | Connect Express/Standard 設定 + Webhook | C-3 |
| 後回し | 売主向け payout 履歴 UI | P2 |

---

### 失敗時処理

| 分類 | 状態 | 根拠 |
|------|------|------|
| **実装済み（sim）** | payment_failed · payout.failed · dispute 分類 → ticket / AI ops | `stripe-connect-ingest.js` · 13/13 |
| **localStorage** | `tasu_connect_issues_v1` · ingest logs | — |
| **未接続** | サーバー ingest · 本番 Stripe イベント | `ingestProductionWebhook` は browser のみ |
| 本番前必須 | ingest サーバー Edge 化 | C-4 |
| 後回し | chargeback evidence 自動 submit | P2 |

---

## 2. 主要ファイル索引

| ファイル | 役割 |
|----------|------|
| `payment-settings.js` / `.html` | Connect ハブ UI |
| `connect-member-ui.js` | ダッシュボードバナー |
| `stripe-connect-ingest.js` | ブラウザ sim ingest |
| `stripe-connect-event-map.js` | イベント分類 |
| `stripe-connect-trouble-ui.js` | 運営トラブル UI |
| `platform-chat-connect-*.js` | TALK Connect 取引 UX |
| `shop-payout.js` | payout_enabled ゲート |
| `resolve-shop-payout.ts` | Shop checkout 売主解決 |
| `sql/stripe-connect-trouble-ddl-draft.sql` | DDL ドラフト · **未適用** |

---

## 3. localStorage 依存一覧

| キー | 用途 |
|------|------|
| `tasful_connect_onboarding_v1` | オンボーディングステップ |
| `tasful_demo_connect_seller_status_v1` | 売主 Connect 状態 |
| `tasful_payment_settings` | 設定デモ |
| `tasu_stripe_ingest_mode_v1` | simulation / production |
| `tasu_stripe_event_ingest_logs_v1` | ingest 監査 |
| `tasu_connect_issues_v1` | Connect issue |
| `tasful_platform_connect_payments_v1` | TALK Connect 決済デモ |

---

## 4. 分類サマリー

| 状態 | 件数（機能域） |
|------|----------------|
| **実装済み（UX/ops sim）** | onboarding 表示 · trouble ingest sim · shop payout **コード** |
| **mock / localStorage** | 全 Connect 状態 · ingest |
| **未接続** | AccountLink · Connect Webhook · サーバー ingest · DB sync |
| **本番前必須** | C-1〜C-8（[`revenue-production-readiness-review.md`](revenue-production-readiness-review.md)） |
| **後回し可能** | P2 UX · bench flaky · 冪等テーブル |

---

## 5. Stripe Live 切替との順序

| 順 | 内容 |
|----|------|
| 1 | **Stripe Live**（GenAI/Featured）— Connect 不要 |
| 2 | **Connect onboarding + Webhook** — Marketplace 前提 |
| 3 | Shop checkout + `shop_orders` |

**Connect は Stripe Live 承認後すぐ着手可能**（同一 Stripe アカウント · Connect 有効化は Dashboard 設定）。

---

## 6. 想定工数 · リスク

| 項目 | 工数 | リスク |
|------|------|--------|
| Connect 本番 Epic 全体 | 12〜18 人日 | Marketplace と並行必須 |
| ingest サーバー化のみ | 5〜8 人日 | 運営 KPI 信頼性 |
| onboarding Edge のみ | 5〜7 人日 | Shop checkout ブロック |

**検証:** コード変更 0。
