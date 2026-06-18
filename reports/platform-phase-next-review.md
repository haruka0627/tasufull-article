# 次フェーズ棚卸し — Marketplace / Builder / Connect / 安否

**作成日:** 2026-06-18  
**種別:** 調査のみ（**コード変更なし**）  
**前提:** TALK・AI運営司令塔・サポート導線は回帰 PASS のため **凍結**（不具合対応以外は変更禁止）

---

## 凍結対象（触らない）

| 領域 | 状態 | 根拠 |
|------|------|------|
| 利用者 TALK / 運営 TALK | 凍結 | `test-talk-support-room.mjs` 等 PASS |
| AI秘書（運営 TALK） | 凍結 | `test-talk-ops-split-browser.mjs` PASS |
| AI運営司令塔 | 凍結 | `test-admin-operations-dashboard-browser.mjs` PASS |
| ワンボタン実行 / actionLevel | 凍結 | Lv.1–3 実行可 · Lv.4–5 チェックリスト |
| サポートルーム | 凍結 | インラインルーム + `support-intake.html` 導線 PASS |

**次フェーズの調査・実装対象:** Marketplace · Builder · Connect · 安否

---

## エグゼクティブサマリー

| ドメイン | デモ / 限定公開 | 本番（収益・実データ） | 最大の収益ブロッカー |
|----------|----------------|----------------------|----------------------|
| **Marketplace** | UI・RLS は PASS | **不可** | 決済未配線（localStorage チェックアウト） |
| **Builder** | フロー監査 PASS | **不可** | Supabase 未実行・決済なし |
| **Connect** | UX 監査 PASS | **不可** | 実 Stripe Connect 未接続・Webhook 未実装 |
| **安否** | RELEASE FROZEN | **条件付き** | LINE 本番・RLS 本番切替・サーバー timeout |

**横断判定（`release-readiness-overview.md` 整合）:** 限定公開（デモ/パイロット）は可。フル本番公開・**実収益化**はインフラ接続が未完了。

---

## 1. Marketplace

### 完了

| 項目 | 内容 | 根拠 |
|------|------|------|
| Market EC UI | TOP / 検索 / 詳細 / チェックアウト / 完了 — RELEASE FROZEN | `reports/market-ec-release-status.md` |
| ユーザー導線 E2E | 390/1280 監査 PASS | `scripts/review-market-user-flow.mjs` |
| Supabase listings RLS | P1–P3 適用 · verify **38/38 PASS** | `reports/marketplace-rls-final-lock-review.md` |
| 公開 safe view 経由読取 | `listings-db.js` / `business-listings-db.js` | `sql/marketplace-public-safe-layer.sql` |
| オーナー `payment_url` マスク | 認証オーナーのみ base テーブル参照 | `listings-db.js` |
| Featured 課金（Webhook 分岐） | `stripe-webhook` に `listing_id` + `featured_plan` 処理 | `supabase/functions/stripe-webhook/index.ts` |
| TALK 経由 product/shop 決済 UX | 6/6 payment-method ケース PASS（デモ） | `reports/product-shop-payment-final-verify/` |

### 未完了

| 項目 | 内容 | 影響 |
|------|------|------|
| **実決済チェックアウト** | `shop-market-checkout.js` が localStorage 注文のみ（Stripe 未呼出） | **売上ゼロ** |
| **出品の Supabase 永続化** | `publishSellerProduct()` → localStorage | 本番データ不在 |
| **shop_orders テーブル** | リポジトリに DDL あり · リンク DB **404 未デプロイ** | 注文履歴・Webhook 反映不可 |
| **Shop Stripe Edge Functions** | `stripe-create-shop-checkout` / `stripe-confirm-shop-checkout` **未デプロイ** | Connect 分配 checkout 不可 |
| **本番 JWT 出品 CRUD** | mock `u_me` + anon では insert/update 不可 | 出品者オンボーディング未接続 |
| **カート/注文/売上 KPI** | localStorage イベント · デモ checkout は `shop_market` チャネル | 管理 KPI が実売上と不一致 |

### 本番前必須

| # | 作業 | 種別 | 収益影響 |
|---|------|------|----------|
| M-1 | `shop_orders` + RLS を本番 DB にデプロイ | SQL / Ops | 注文・Webhook の前提 |
| M-2 | `stripe-create-shop-checkout` / `stripe-confirm-shop-checkout` デプロイ | Edge / Ops | **Marketplace 実決済の核心** |
| M-3 | Stripe Live Webhook 配線（GenAI/featured は Test PASS 済） | Stripe Dashboard | Live 課金 |
| M-4 | 凍結 EC checkout を Stripe パスへ接続（または buy-now → `shop-checkout.js`） | **凍結解除が必要** | ユーザー購入の実収益 |
| M-5 | 出品フローを `business_listings` / Supabase へ永続化 | 新規配線 | 在庫・出品の実データ |
| M-6 | Supabase Auth JWT（`talk_user_id`）でオーナー CRUD | Auth | 出品者操作 |
| M-7 | 本番 DB で `verify-marketplace-rls.mjs` 再実行 | 検証 | セキュリティ |

### 後回し可能

| 項目 | 内容 |
|------|------|
| PC CTA 42px 等 UX WARNING | `market-ec-release-status.md` P2 |
| `users` safe view（売主プロフィール） | `marketplace-rls-final-lock-review.md` W-PUB-2 |
| AI ops Marketplace KPI パイプライン | `ai-ops-secretary-release-status.md` |
| `transaction_*` / `favorites` RLS 強化 | `supabase-rls-final-audit.md` |
| サーバー側キャンセル/返金 → Inbox | `prelaunch-p1-backlog-review.md` P2 |

### ダミー / 仮実装依存（要認識）

- `DEMO_CATALOG` / `DUMMY_REVIEW_COUNTS` — `shop-market-product-data.js`
- カート・注文・お気に入り — localStorage キー群（同ファイル）
- `listing-demo-catalog.js` / `DEMO_LISTING_BY_ID` — `listings-db.js`
- デモ住所固定 · 送料 0 · 「デモ版では未対応」 — `shop-market-checkout.js`
- 売上 KPI — `shop-market-event-store.js`（localStorage イベント集計）

---

## 2. Builder

### 完了

| 項目 | 内容 | 根拠 |
|------|------|------|
| コアユーザーフロー | 掲示板 · 応募 · 採用 · スレッド · 完了報告 · 承認 | `reports/builder-release-status.md` RELEASE FROZEN |
| 3 フロー E2E | partner_user / user_user / vendor_user **45/45** | `reports/builder-general-flow-ng.md` |
| 運営 admin | 申請 · 派遣 · レビュー · カレンダー · 通知 | `builder/admin-*.html` |
| **パートナー評価** | NL 解析 · スコア · 非表示フィルタ · 管理 UI | `builder-partner-evaluation-*.js` · E2E PASS |
| TALK 通知連携 | apply / hire / completion チェーン | `talk-builder-notify-master-v1.js` · 7/7 ルーティング PASS |
| 監査 | user-flow **44 PASS / 0 FAIL** | `scripts/review-builder-user-flow.mjs` |
| Supabase **設計** | schema / RLS / Storage DDL（**未実行**） | `sql/builder-*.sql` |

### 未完了

| 項目 | 内容 | 影響 |
|------|------|------|
| **永続化** | 全 MVP 状態が `localStorage` | マルチデバイス・本番不可 |
| **認証** | デモロール切替 · ログイン「未実装」 | `builder-top.html` |
| **Supabase 実行** | DDL/RLS/Storage — チェックリスト「まだ実行しない」 | DB なし |
| **Migration `--execute`** | エクスポート → UUID マップ未実装 | データ移行不可 |
| **Edge Function** | `builder-create-signed-url` ドラフト · RPC auth TODO | 添付ファイル本番不可 |
| **PDF 生成** | Base64 テキスト stub（「not implemented」） | 請求書として不可用 |
| **決済** | Builder 内に Stripe 参照なし · `sales-fees.html` はデモ | **収益化なし** |
| admin「利用会社数」 | 準備中（`aria-disabled`） | 表示のみ |

### 本番前必須

| # | 作業 | 種別 | 収益影響 |
|---|------|------|----------|
| B-1 | Supabase schema + RLS + private Storage **実行** | SQL / Ops | データ基盤 |
| B-2 | JWT claims（`actor_id`, `partner_id` 等） | Auth | RLS 前提 |
| B-3 | `migrate-builder-export-to-supabase.mjs --execute` | Migration | 既存デモデータ移行 |
| B-4 | `builder-create-signed-url` デプロイ | Edge | 書類・添付 |
| B-5 | 本番認証（デモロール廃止） | Auth | なりすまし防止 |
| B-6 | 完了 → プラットフォーム決済/Stripe 配線 | **Connect/Marketplace 依存** | **取引完了後の課金** |
| B-7 | 実 PDF（請求/完了報告） | 実装 | B2B 請求の法務 |

### 後回し可能

| 項目 | 内容 |
|------|------|
| 2-window bench ヘッドレス flaky | P2-1 `verify-builder-dual-window-bench.mjs` |
| partner-assignment decline 監査環境 | P2-2 |
| completion notify href 混在 | P2-7 |
| 390px 完了/承認ボタン到達性 | P2-9 |
| CTA mobile Builder apply 1 FAIL | P2-13 |
| パートナー評価 Supabase スキーマ実行 | 任意（localStorage で MVP 完結） |

### ダミー / 仮実装依存

- `builder.js` ヘッダ: 「デモ表示のみ · DB/Supabase ロジックは扱わない」
- `DEMO_STATS_*` / `DEMO_RECENT_PROJECTS` / `demo-thread-*` シード
- `buildMvpPdfDataUrl` — PDF stub
- `listing-demo-catalog.js` 経由の掲示板デモ
- `sales-fees.html` + `demo-deals-data.js` へのリンクのみ（決済 UI）

---

## 3. Connect（Stripe Connect）

### 完了

| 項目 | 内容 | 根拠 |
|------|------|------|
| Connect ハブ UX | identity → qualification → ready | `payment-settings.js` · **36 PASS** |
| メンバー UI | バナー · バッジ · 免責 | `connect-member-ui.js` |
| TALK Connect 取引 UX | 完了カード · 手数料ゲート · seller confirm | `platform-chat-connect-*.js` |
| 運営トラブル連携 | ingest → チケット · AI ops · フィルタ | `stripe-connect-ingest.js` · **13/13 PASS** |
| Marketplace payout **コード** | destination charge + application_fee | `stripe-create-shop-checkout/index.ts` |
| GenAI / Featured Webhook | Test P0-W1 PASS（**Connect とは別経路**） | `stripe-webhook-p0-w1-delivery-check.md` |

### 未完了

| 項目 | 内容 | 影響 |
|------|------|------|
| **実 Stripe Connect オンボーディング** | `accounts.create` / AccountLink **なし** | 売主 `acct_*` 不在 |
| **Connect Webhook（サーバー）** | `account.*` / `payout.*` / dispute 未処理 | 状態同期不可 |
| **ingest 本番経路** | ブラウザ localStorage シミュレーションのみ | 運営 KPI が実 Stripe と不一致 |
| **Shop checkout デプロイ** | Functions + `shop_orders` 未デプロイ | Marketplace GMV ブロック |
| **service platform fee confirm** | create のみ · confirm/Webhook なし | TALK 取引手数料の自動決済不可 |
| **Connect trouble DDL** | ドラフトのみ · 本番未適用 | 監査ログの永続化弱い |
| **Stripe Live 切替** | P0-W2 未 | 実課金不可 |

### 本番前必須

| # | 作業 | 種別 | 収益影響 |
|---|------|------|----------|
| C-1 | Stripe Connect オンボーディング API 統合 | 新規配線 | **売主が受取可能に** |
| C-2 | `stripe_account_id` / `payout_enabled` の Supabase 永続化 | DB + Webhook | Shop checkout 前提 |
| C-3 | Connect イベント Webhook（Edge 拡張 or 専用 Fn） | Edge | payout/dispute 運用 |
| C-4 | ingest をブラウザ → サーバー Edge へ移行 | Edge | 本番運営の信頼性 |
| C-5 | Shop Functions + `shop_orders` デプロイ（Marketplace 共通） | Ops | **分配決済 GMV** |
| C-6 | `stripe-confirm-service-fee` + Webhook 分岐 | Edge | プラットフォーム手数料 5% |
| C-7 | Live `sk_live_` + Live `whsec_` | Stripe Dashboard | 全 Stripe 収益 |
| C-8 | JWT + Connect 状態のサーバー検証 | Auth | クライアントのみ信頼の排除 |

### 後回し可能

| 項目 | 内容 |
|------|------|
| payout requirement 通知の stale 表示 | P2-1 |
| `payment-settings` browser back / returnTo | P2-2 |
| 390px CTA 再監視 | P2-15 |
| Category bench ヘッドレス timeout | QA のみ |
| `stripe_webhook_events` 冪等テーブル | 観測性 P2-W4 |

### ダミー / 仮実装依存

- `tasful_connect_onboarding_v1` — localStorage ステップマシン
- `tasful_demo_connect_seller_status_v1` — デモ seller 状態
- `stripe-connect-ingest.js` — デフォルト `simulation` · 本番 endpoint なし
- `shop-checkout.js` — `demo-order-*` / `use_demo_checkout` フォールバック
- `platform-chat-fee-pay.js` — `demoPayOk` バイパス
- `admin-ai-kpi-center.js` — Connect 売上が ingest ログ由来

---

## 4. 安否（ANPI）

### 完了

| 項目 | 内容 | 根拠 |
|------|------|------|
| コア 12 領域 | 登録 · ダッシュボード · 通知 · 緊急 · 家族 · 履歴 · LINE 管理 | `reports/anpi-release-status.md` RELEASE FROZEN |
| No-response Phase2 | セッション · 監査ログ · 家族通知 · WebRTC · 3 CTA | `reports/anpi-no-response-phase2-implementation.md` PASS |
| Supabase 設計 + prod RLS 定義 | core + Phase2 | `sql/anpi-rls-production.sql` 等 |
| LINE Edge **コード** | send / token-exchange | `supabase/functions/anpi-line-*` |
| RLS 検証（JWT  fresh 時） | **17/17 PASS** | `reports/anpi-rls-jwt-refresh-result.md` |
| Ops 読取 | Daily Inbox · Ops Watch · 司令塔安否監視 | admin-ai-* · talk-hub-ops-anpi |
| E2E | dashboard 37/38 · notifications 26/26 · line 26/26 等 | 各 `test-anpi-*.mjs` |

### 未完了

| 項目 | 内容 | 影響 |
|------|------|------|
| **サーバー側 no-response timeout** | クライアント polling のみ · Edge cron 未構築 | 本番で取りこぼしリスク |
| **Phase2 prod RLS 切替** | dev `using(true)` と prod 共存 | 本番前に DROP 必須 |
| **Core ANPI prod RLS 切替** | `anpi-rls-drop-dev-policies.sql` 未実行（環境依存） | 横断 BLOCKER B-1 |
| **LINE 本番到達** | Edge デプロイ + Secrets + 本番チャネル | 実 LINE 配信不可 |
| **本番 JWT 統一** | デモ `userId` / `member_id` 混在 | サーバー RLS 前提 |
| **TALK 配信 E2E** | headless timeout（TALK 凍結境界） | 低 |

### 本番前必須

| # | 作業 | 種別 | 収益影響 |
|---|------|------|----------|
| A-1 | `anpi-rls-drop-dev-policies.sql` 実行 + verify | SQL / Ops | セキュリティ |
| A-2 | `anpi-no-response-phase2-drop-dev-policies.sql` 実行 | SQL / Ops | Phase2 本番 RLS |
| A-3 | `anpi-line-send` / `anpi-line-token-exchange` デプロイ | Edge | **実 LINE 配信** |
| A-4 | Secrets: `LINE_CHANNEL_ACCESS_TOKEN` 等 · `ANPI_LINE_MOCK=0` | Ops | mock 無効化 |
| A-5 | クライアント mock localStorage キー全削除手順 | 運用 | 本番誤 mock 防止 |
| A-6 | JWT 発行・ローテーション運用 | Ops | RLS verify 維持 |
| A-7 | No-response timeout Edge + cron（推奨） | Edge | 可用性 |
| A-8 | `docs/anpi-line-manual-test.md` 本番 smoke | QA | リリースゲート |

### 後回し可能

| 項目 | 内容 |
|------|------|
| dashboard quick-action E2E 1件 | P2-2 |
| LINE バッジ文言「TALK送信失敗」統一 | P2-6 |
| TALK delivery headless 安定化 | P2-3 |
| 定期確認専用 E2E | P2-8 |
| 複数緊急連絡先 | Phase3+ |
| Ops Watch 確認 KPI → dashboard | P2-14 |

### ダミー / 仮実装依存

- `tasu_anpi_line_send_mock_v1` / Edge `ANPI_LINE_MOCK=1`
- `tasu_anpi_context_supabase_mock_v1`
- `tasu_anpi_no_response_phase2_mock_v1`
- `tasful_anpi_notify_demo_v1` ダッシュボード seed
- LINE admin mock/production モード表示

---

## 5. 収益導線 — 横断マトリクス

| 収益ストリーム | 状態 | ブロッカー | 主担当ドメイン |
|----------------|------|------------|----------------|
| GenAI サブスク / 3D·2D チケット | Test Webhook PASS · Live 未 | P0-W2 Live 鍵 | Stripe（横断） |
| Featured 出品課金 | Webhook コードあり · Live 未 | 同上 | Marketplace |
| Market EC 商品販売 | **デモのみ** | M-2〜M-4 | Marketplace + Connect |
| Shop Connect 分配 checkout | **コードのみ未デプロイ** | M-1, C-5 | Marketplace + Connect |
| TALK 取引プラットフォーム手数料 5% | デモ/localStorage | C-6, C-1 | Connect |
| TALK チャット開始料 ¥550 | localStorage | Connect 本番 + 決済 confirm | Connect |
| Builder 完了 → 請求/決済 | **未配線** | B-6, PDF B-7 | Builder + Connect |
| 安否 LINE 配信 | コストセンター | A-3, A-4 | 安否（直接売上なし） |

**収益化のクリティカルパス（推奨順）:**

1. **Stripe Live**（P0-W2）— 全 Stripe 収益の前提  
2. **Connect オンボーディング + Webhook**（C-1〜C-4）— 売主受取・運営同期  
3. **shop_orders + Shop Checkout デプロイ**（M-1, M-2, C-5）— Marketplace GMV  
4. **Market EC checkout 配線**（M-4 · **凍結解除要**）— ユーザー購入体験と接続  
5. **Builder Supabase + 完了決済**（B-1〜B-6）— B2B 取引の決済クローズ  
6. **安否 LINE 本番**（A-3〜A-5）— 直接売上ではなく信頼・解約抑止

---

## 6. 次フェーズ推奨（調査結論）

| 優先 | フェーズ | 内容 | 製品コード変更 |
|------|----------|------|----------------|
| **1** | Connect + Stripe 基盤 | Live 鍵 · Connect onboarding · Connect Webhook · ingest サーバー化 | **要**（凍結域外） |
| **2** | Marketplace 決済 | shop_orders デプロイ · Edge デプロイ · checkout 配線 | **要**（Market EC 凍結解除） |
| **3** | Builder 本番 DB | Supabase 実行 · migration · 認証 | **要** |
| **4** | 安否 本番切替 | RLS DROP · LINE デプロイ · mock 除去 · timeout cron | **Ops 中心** · 一部 Edge |
| **5** | 横断 Auth/JWT | 本番 JWT 統一（marketplace CRUD / Connect / ANPI） | Auth 基盤 |

---

## 7. 参照レポート・検証コマンド

| 用途 | パス / コマンド |
|------|-----------------|
| 横断 readiness | `reports/release-readiness-overview.md` |
| P1 残件 | `reports/prelaunch-p1-backlog-review.md` |
| Marketplace RLS | `node scripts/verify-marketplace-rls.mjs` |
| Market EC 導線 | `node scripts/review-market-user-flow.mjs` |
| Builder 導線 | `node scripts/review-builder-user-flow.mjs` |
| Connect 導線 | `node scripts/review-connect-user-flow.mjs` |
| Connect trouble | `node scripts/test-stripe-connect-trouble-hardening-browser.mjs` |
| 安否 Phase2 | `node scripts/test-anpi-no-response-phase2-browser.mjs` |
| 安否 RLS | `node scripts/verify-anpi-rls-real-db.mjs` |
| 回帰（凍結域） | `node scripts/test-tasful-regression-final.mjs` |

---

## 8. 判定まとめ（4 分類 × 4 ドメイン）

| | Marketplace | Builder | Connect | 安否 |
|---|-------------|---------|---------|------|
| **完了** | UI/RLS/閲覧 · Featured コード | デモ MVP 全フロー · 評価 · 通知 | UX/ops シミュレーション · payout コード | コア+Phase2 製品 · E2E |
| **未完了** | 実決済 · Supabase 出品 · shop_orders | DB · Auth · PDF · 決済 | 実 Connect · Webhook · Live | サーバー timeout · LINE 本番 |
| **本番前必須** | M-1〜M-7（決済デプロイ中心） | B-1〜B-7（DB+決済） | C-1〜C-8（Connect+Live） | A-1〜A-8（RLS+LINE） |
| **後回し可能** | UX WARNING · transaction RLS | bench flaky · mobile CTA | stale 通知 · bench | バッジ文言 · Phase3 複数連絡先 |

**結論:** 4 ドメインとも **デモ・限定公開としては「完了」に近い**。**実収益・実データ・本番セキュリティ**は **未完了** が支配的で、**本番前必須**は主に **Stripe Live · Connect 実装 · Supabase デプロイ · RLS 本番切替 · mock 除去** に集中する。
