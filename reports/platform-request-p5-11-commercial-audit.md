# Platform Request P5-11 — 商用運用監査（調査のみ）

**Date:** 2026-07-05  
**Phase:** P5-11（調査 · 設計 · **コード変更なし**）  
**対象:** P5-6〜P5-10 完了状態の商用可否監査  
**Staging ref:** `ahlxuyvhzqdqaojiywmu`  
**Production:** `ddojquacsyqesrjhcvmn` — **2026年10月まで凍結**

**参照:** [docs/platform-request-p5-integration.md](../docs/platform-request-p5-integration.md) · [Blueprint](./platform-request-p5-integration-blueprint.md) · [P0 仕様](../docs/platform-request.md)

---

## 1. 調査対象サマリ（現状）

| 領域 | P5 フェーズ | Staging 状態 | 商用観点 |
| --- | --- | --- | --- |
| `platform_requests` CRUD | P5-6 | **Go** · Adapter local/supabase/dual | デフォルト `local` — ログインなしでは DB 未使用 |
| `platform_request_matches` | P5-7 / 7b / 7c | **Go** · Edge match-sync · Builder E2E | 手動 sync · `company`/`listing` 型は未解決 |
| Notifications | P5-8 | **Go** · `platform_request_notifications` | PR ページ内のみ · **Talk Home 未連携** |
| Talk Bridge | P5-9 | **Go** · `transaction_rooms` | Edge に **決済ゲートなし** · local fallback 残存 |
| Payment / Reveal | P5-10 | **Go** · simulate 主体 | **Webhook なし** · 実 `sk_test_` E2E 未記録 |
| Edge Functions | P5-7c〜10 | 6 API · 8788 PASS | **CF Production 未デプロイ** |
| Payment Ledger | P5-10 | `platform_request_payments` | pending 重複可 · refund 未実装 |
| RLS | P5.1 / 5.2a | Staging 手動適用済み | **`supabase/migrations` 未登録** |
| Stripe | P5-10 | Test/simulate | Live 禁止 · catalog `enabled:false` |

### 1.1 Edge Functions 一覧（Staging のみ）

| API | 責務 |
| --- | --- |
| `/api/platform-request-match-sync` | Match INSERT + 通知 fan-out |
| `/api/platform-request-notify` | status_changed · mark_read |
| `/api/platform-request-create-talk` | Talk Room ensure |
| `/api/platform-request-create-checkout` | ¥550 Checkout 開始 |
| `/api/platform-request-confirm-checkout` | 決済確定（クライアント呼び出し） |
| `/api/platform-request-contact-reveal` | 支払い後連絡先開示 |

### 1.2 検証コマンド（いずれも 8788 · Staging）

```bash
node scripts/test-platform-request-p5-6-supabase-crud.mjs
node scripts/test-platform-request-p5-7-matches-crud.mjs
node scripts/test-platform-request-p5-7-builder-candidate-e2e.mjs
node scripts/verify-platform-request-p5-7c-edge-secrets.mjs
node scripts/test-platform-request-p5-8-notifications.mjs
node scripts/test-platform-request-p5-9-talk-bridge.mjs
node scripts/test-platform-request-p5-10-stripe-contact-reveal.mjs
```

**P5-6〜P5-10 単体:** 各レポート上 **Staging Go**（2026-07-05 時点）。

---

## 2. 商用運用で不足しているもの

### 2.1 重大（商用ローンチ前に必須）

| # | 不足 | 根拠 |
| --- | --- | --- |
| G1 | **デフォルトが `local` モード** | 一般ユーザーは LS のみ · `?prq_store=supabase` 必須（[P5-6](../reports/platform-request-p5-6-supabase-crud.md)） |
| G2 | **Stripe Webhook 未実装** | Blueprint §5.5 · confirm はクライアント依存のみ · 離脱・二重確定リスク |
| G3 | **実 Stripe Test（`sk_test_`）E2E 未検証** | P5-10 は `prq_sim_*` simulate が主 · 本番相当フロー未証明 |
| G4 | **Talk Edge に決済ゲートなし** | `create-talk` は paid 未確認で Room 作成可（UI のみゲート） |
| G5 | **Talk Home 通知未統合** | P0 は in_app 第一 · `talk_notifications` に `platform_request` 型なし（[P5.2 §5.1](./platform-request-p5.2-staging-review.md)） |
| G6 | **DDL が migrations 未登録** | Staging 手動適用のみ（[P5-5](./platform-request-p5-5-staging-ddl-apply.md)）· Production runbook 未整備 |
| G7 | **Cloudflare Production Edge 未デプロイ** | 6 Functions は `deploy/cloudflare/functions` のみ · Preview/8788 検証 |

### 2.2 中程度（Staging 商用試験までに推奨）

| # | 不足 | 根拠 |
| --- | --- | --- |
| M1 | **localStorage 移行 UI 未実装** | SSOT 手順 #12 残 · `legacy_local_id` UPSERT のみ |
| M2 | **自動マッチジョブなし** | `syncMatchesForRequestAsync` は手動 · P3 ローカル候補依存 |
| M3 | **投稿/受信サブスク未接続** | P0 フロー ③ · `platform_request_subscriptions` 構造のみ |
| M4 | **SKU catalog `enabled:false` / `provisional:true`** | [tasful-pricing-catalog.json](../shared/pricing/tasful-pricing-catalog.json) |
| M5 | **同一 match の pending payment 複数行** | `paid` は find 1 件 · UNIQUE は `stripe_checkout_session_id` のみ |
| M6 | **返金・キャンセル運用** | `refunded` status 定義のみ · 処理なし |
| M7 | **連絡先開示が email のみ** | 電話・専用 reveal 行なし · `builder_contact_reveals` パターン未採用 |
| M8 | **通知 idempotency_key なし** | P5.2 M2 · 再送で重複通知の可能性 |
| M9 | **詳細ページ通知件数不整合** | P5-8: UI 0 vs API 35（一覧のみ表示の可能性 · 要確認） |

### 2.3 軽微（Production 直前 or P6）

| # | 不足 |
| --- | --- |
| L1 | `talk_thread_id` 列なし（`transaction_rooms` で代替可） |
| L2 | `expires_at` / 依頼期限バッチなし |
| L3 | Email / Push 通知チャネル |
| L4 | `company` / `listing` 候補型の `candidate_user_id` 解決 |
| L5 | 「通知候補にする」ボタンが stub |
| L6 | 回帰テスト二重実行対策（`P5_*_SKIP_REGRESSION`）は暫定 |

---

## 3. Production 移行前に必要な作業

| 順 | 作業 | 担当イメージ | 凍結との関係 |
| --- | --- | --- | --- |
| 1 | **Supabase migration 正式化** — `platform_request_*` を `supabase/migrations/` + Production runbook | database-agent · 人間承認 | 10月まで Dashboard 手動のみ可 |
| 2 | **Cloudflare Production** — 6 Edge Functions + secrets（Staging service_role **禁止**） | devops-infra-agent | 10月まで deploy 禁止 |
| 3 | **Stripe Live 準備** — Product/Price · Webhook endpoint · `STRIPE_WEBHOOK_SECRET` | api-integration-agent | Live **禁止**まで Test のみ |
| 4 | **`chat-supabase-config.js` Production 切替** — anon key · ref ガード維持 | platform-agent | build 時注入 |
| 5 | **セキュリティレビュー** — RLS · Edge JWT · payment bypass · service_role 漏洩 | security-agent | 必須 |
| 6 | **E2E 証跡** — 実 `sk_test_` · Webhook 冪等 · 8788 + Staging フルフロー | qa-agent | Go ゲート |
| 7 | **Pricing catalog** — `platform_request_match_contact` enabled · 非 provisional（商品判断後） | product-agent | AD-006 下書き表示維持可 |
| 8 | **運用 Runbook** — 決済失敗 · reconcile · 手動返金 · 監視 | docs-agent | Production 直前 |

---

## 4. P5-12 として実装すべき内容（推奨スコープ）

SSOT 手順 #12 は **localStorage 移行**。商用ギャップを踏まえ、P5-12 を次の **2 トラック** に分割することを推奨する。

### Track A — P5-12a: 商用デフォルト経路（SSOT #12）

| 項目 | 内容 |
| --- | --- |
| localStorage 移行 UI | ログイン後「この端末の依頼を同期」· `legacy_local_id` UPSERT |
| デフォルト mode 見直し | ログイン済み → `dual` 自動（破壊的変更なし · 未ログインは `local` 維持） |
| 移行 E2E | `scripts/test-platform-request-p5-12-local-migration.mjs` |

### Track B — P5-12b: 決済・Talk 商用硬化（P5-10 補完）

| 項目 | 内容 |
| --- | --- |
| Stripe Webhook | `/api/platform-request-stripe-webhook`（CF Functions）· `checkout.session.completed` |
| 実 Stripe Test E2E | `sk_test_` 必須ゲート + simulate フォールバック |
| Talk Edge 決済ゲート | `create-talk` で `platform_request_payments.status=paid` 必須 |
| pending payment 整理 | 同一 `(match_id, payer_id)` の pending 再利用 or UNIQUE |

### Track C — P5-13 候補（P5-12 後）

| 項目 | 内容 |
| --- | --- |
| Talk Home 通知ブリッジ | `talk_notifications` type `platform_request` or PR 通知の deep link 集約 |
| 自動マッチジョブ | 依頼 `open` INSERT 後の Edge/RPC fan-out |
| サブスク entitlement（P6） | `platform_request_subscriptions` + Stripe Subscription |

---

## 5. 優先順位

| 優先 | ID | 内容 | 理由 |
| --- | --- | --- | --- |
| **P0** | P5-12a | localStorage 移行 + ログイン時 dual デフォルト | 商用で DB 正本を使う前提 |
| **P0** | P5-12b-1 | Stripe Webhook + 実 Test E2E | 決済の信頼性 · 商用必須 |
| **P0** | P5-12b-2 | Talk Edge 決済ゲート | P5-9/10 契約整合 · API bypass 封鎖 |
| **P1** | P5-12b-3 | pending payment 冪等強化 | 台帳汚染防止 |
| **P1** | P5-13a | Talk Home 通知連携 | P0 仕様「in_app 第一」 |
| **P2** | P5-13b | 自動マッチジョブ | 手動 sync 脱却 |
| **P2** | migrations 正式化 | Production runbook 入力 | 10月窓 |
| **P3** | サブスク · Push · 返金 | P6 / P7 |

---

## 6. 変更が必要なファイル一覧（P5-12 想定）

### P5-12a（移行）

| ファイル | 変更 |
| --- | --- |
| `platform-request.js` | 移行 UI · ログイン時 mode · `dual` 書き込み |
| `platform-request-detail.html` / `platform-request.html` | 移行バナー |
| `platform-request-supabase-store.js` | `legacy_local_id` bulk UPSERT |
| `scripts/test-platform-request-p5-12-local-migration.mjs` | **新規** |
| `docs/platform-request-p5-integration.md` | P5-12 Go 更新 |

### P5-12b（決済硬化）

| ファイル | 変更 |
| --- | --- |
| `deploy/cloudflare/functions/api/platform-request-stripe-webhook.js` | **新規** |
| `deploy/cloudflare/functions/_shared/platform-request-payments.mjs` | Webhook handler · pending 冪等 |
| `deploy/cloudflare/functions/_shared/platform-request-talk.mjs` | paid チェック |
| `platform-request-payment-bridge.js` | Webhook 待ち UI · return 処理 |
| `scripts/lib/sync-pages-dev-vars.mjs` | `STRIPE_WEBHOOK_SECRET`（済） |
| `scripts/test-platform-request-p5-10-stripe-contact-reveal.mjs` | 実 Stripe Test 分岐 |
| `shared/pricing/tasful-pricing-catalog.json` | `enabled:true`（商品判断後） |

### P5-13（通知・マッチ）

| ファイル | 変更 |
| --- | --- |
| `talk-notifications-store.js` / `talk-home.js` | `platform_request` 型 |
| `deploy/cloudflare/functions/_shared/platform-request-notifications.mjs` | `talk_notifications` 橋渡し |
| `platform-request.js` | 投稿後 auto match-sync トリガー |

---

## 7. 実装工数（目安）

| タスク | 工数 | 備考 |
| --- | --- | --- |
| P5-12a 移行 UI + dual デフォルト | **中** | Adapter 既存 · UI + E2E |
| P5-12b Webhook + 実 Stripe Test | **中** | CF Functions · 署名検証 · 冪等 |
| P5-12b Talk Edge 決済ゲート | **小** | `findPaidPayment` 再利用 |
| P5-12b pending 冪等 | **小** | DB index or Edge ロジック |
| P5-13 Talk Home 通知 | **中** | `talk_notifications` 契約 |
| P5-13 自動マッチ | **大** | 候補ソース · レート制限 · fan-out |
| migrations + Production runbook | **中** | 人間承認含む |
| サブスク P6 | **大** | Stripe Subscription 全体 |

---

## 8. 総合判定

### 現状

- **P5-6〜P5-10:** Staging `8788` で **機能連鎖は成立**（Request → Match → 通知 → 決済 simulate → 開示 → Talk）。
- **検証:** 各フェーズレポート **Go** · 回帰 PASS（SKIP フラグで集約テストは安定化済み）。
- **環境:** Staging のみ · Production / Stripe Live / CF Production **未着手**（意図どおり）。

### 不足（商用運用の観点）

- **エンドユーザー既定経路が local** — DB・RLS・決済が使われない。
- **決済は simulate 中心** — Webhook なし · 実 Stripe Test 証跡なし。
- **Talk API が決済をバイパス可能** — UI と Edge のポリシー不一致。
- **通知が PR ページ閉じ** — Talk Home 第一チャネル未達。
- **インフラ正本化不足** — migrations 未登録 · CF Production 未デプロイ。

### 推奨順（P5-12 着手）

1. **P5-12a** localStorage 移行 + ログイン時 `dual`  
2. **P5-12b** Webhook + 実 Stripe Test + Talk 決済ゲート  
3. **P5-13** Talk Home 通知 · 自動マッチ  
4. **10月窓** migrations · CF Prod · Stripe Live（人間 runbook）

### Go / No-Go

| ゲート | 判定 | 理由 |
| --- | --- | --- |
| **P5-6〜P5-10 Staging 機能** | **Go** | E2E · 回帰 PASS · 意図したスコープは完了 |
| **Staging 商用試験（限定ユーザー）** | **Conditional Go** | `?prq_store=supabase` + ログイン + simulate 決済で試験可 |
| **一般ユーザー商用運用** | **No-Go** | デフォルト local · Webhook なし · Talk Home 未連携 |
| **Production 接続** | **No-Go** | 2026年10月凍結 · runbook / migration / Live 未了 |

### P5-12 着手 Go 条件

- 本レポート承認後 **P5-12a → P5-12b** の順で実装可。
- **Production 反映は P5-12 完了 ≠ Production Go** — 10月 runbook まで別ゲート。

---

*P5-11 — 調査・設計のみ · コード変更なし*
