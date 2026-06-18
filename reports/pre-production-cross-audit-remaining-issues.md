# 本番接続前 — システム横断監査 残課題一覧

**実施日:** 2026-06-17  
**方針:** 製品修正なし・横断監査のみ  
**RELEASE FROZEN:** 市場EC / TALK / Builder / AI運営秘書 / Connect / 安否（6領域）

---

## 総合評価

| 項目 | 判定 |
|------|------|
| **TASFUL 総合再監査** `review-tasful-final.mjs` | **WARNING**（FAIL 1 / WARNING 115） |
| **本番接続統合レビュー** `review-admin-ai-production-connectivity.mjs` | **PASS**（要修正 0） |
| **接続 Phase P0 / P1 / P2** | **PASS**（各 全件） |
| **Stripe Connect 障害ハードニング** | **PASS**（13/13） |
| **安否 本番 RLS ブラウザ** | **PASS**（22/22） |
| **安否 実 Supabase RLS** | **FAIL**（9/18 — JWT expired） |
| **P0（本番接続ブロッカー）** | **3 件**（インフラ / 運用） |
| **P1（要製品修正）** | **なし**（凍結 6 領域） |
| **P2（接続後改善）** | **120+ 件** |
| **フロント導線（凍結領域）** | **PASS** — talk / builder / connect / market 各導線監査 PASS |

### 本番接続可否（監査観点）

| 観点 | 結論 |
|------|------|
| デモ / localStorage 上の利用者導線 | **接続可** — 6 領域 E2E 主要 PASS |
| 運営・AI 横断連携（シミュレーション） | **接続可** — P0/P1/P2 接続テスト PASS |
| **実 Stripe Webhook** | **未接続** — 本番決済イベントは P0 |
| **実 Supabase JWT / RLS** | **要更新** — 検証 JWT 期限切れ P0 |
| **サーバー側認証** | **未統合** — P2（接続フェーズで対応） |

---

## 12領域 × 横断判定

| # | 領域 | 判定 | 根拠 |
|---|------|------|------|
| 1 | **認証** | **WARNING** | 安否 RLS ブラウザ 22/22 PASS。デモ `userId` 主体。JWT 本番検証 JWT expired |
| 2 | **Connect** | **PASS** | `review-connect-user-flow.mjs` PASS（36/4/0）・Stripe trouble 13/13 |
| 3 | **TALK** | **PASS** | `review-talk-user-flow.mjs` PASS（総合監査） |
| 4 | **市場EC** | **PASS** | `review-market-user-flow.mjs` PASS |
| 5 | **Builder** | **PASS** | `review-builder-user-flow.mjs` PASS |
| 6 | **安否** | **PASS** | 通知 26/26・LINE admin 26/26・RLS browser 22/22（[`anpi-release-status.md`](anpi-release-status.md)） |
| 7 | **AI運営秘書** | **WARNING** | Phase1〜12 WARNING・本番接続 PASS・大量件数 UX volume FAIL |
| 8 | **通知** | **PASS** | TALK/Connect/Builder/安否 通知→遷移 各導線監査 PASS |
| 9 | **権限** | **WARNING** | 安否 RLS mock 34/34 + browser 22/22。実 DB 9/18（JWT） |
| 10 | **Stripe** | **WARNING** | ingest シミュレーション PASS。実 Webhook 未接続 |
| 11 | **Webhook** | **FAIL** | `stripe-webhook` Edge Function 存在・**本番未配線**（ingest ログのみ） |
| 12 | **Supabase** | **WARNING** | クライアント設定あり・RLS SQL 整備済。実 DB 検証 JWT 要更新 |

---

## 確認項目マトリクス

| 確認項目 | 判定 | 備考 |
|----------|------|------|
| **ログイン状態** | ⚠️ WARNING | デモ `talkDev` / `userId` / 安否 member_id 解決 PASS。本番 JWT 未統合 |
| **権限** | ⚠️ WARNING | 安否 RLS browser PASS。実 Supabase JWT expired |
| **通知** | ✅ PASS | 6 領域 通知→遷移 E2E PASS |
| **遷移** | ✅ PASS | talk / builder / connect / market 導線 PASS |
| **Connect 状態** | ✅ PASS | onboarding step / badge / 差し戻し PASS |
| **未読** | ✅ PASS | TALK 未読同期・安否未読サマリー PASS |
| **運営連携** | ✅ PASS | Support / Connect / 安否 emergency / Builder → Inbox/Ops Watch PASS |
| **AI 連携** | ⚠️ WARNING | 学習チェーン PASS。TALK bus 未購読・chat_started 未配線（P2） |
| **本番イベント** | ❌ FAIL | 実 Stripe Webhook 未接続。`stripe_webhook_sim` のみ |

---

## 自動監査ログ

| スクリプト | 結果 | 出力 |
|-----------|------|------|
| `review-tasful-final.mjs` | **WARNING** | `screenshots/tasful-final-review/review-report.md` |
| `review-admin-ai-production-connectivity.mjs` | **PASS** | `screenshots/admin-ai-production-connectivity/connectivity-report.md` |
| `test-admin-ai-connectivity-p0.mjs` | **PASS** | — |
| `test-admin-ai-connectivity-p1.mjs` | **PASS** | — |
| `test-admin-ai-connectivity-p2.mjs` | **PASS** | — |
| `test-stripe-connect-trouble-hardening-browser.mjs` | **PASS** | 13/13 |
| `test-anpi-rls-production-browser.mjs` | **PASS** | 22/22 |
| `verify-anpi-rls-real-db.mjs` | **FAIL** | 9/18（JWT expired） |
| `review-connect-user-flow.mjs` | **PASS** | （総合監査内） |
| `review-talk-user-flow.mjs` | **PASS** | exit 1 だが JSON overall PASS |
| `review-builder-user-flow.mjs` | **PASS** | — |
| `review-market-user-flow.mjs` | **PASS** | — |
| `review-admin-ai-full-system.mjs` | **WARNING** | Phase E2E 10/10 PASS、UX volume 大量件 FAIL |
| `review-ui-full-system.mjs` | **WARNING** | 35 warnings |
| `review-cta-mobile-ux.mjs` | **WARNING** | Builder 応募 CTA 1 FAIL |

**dev サーバー:** Vite `http://127.0.0.1:8765`

---

## 総合再監査 — カテゴリ別

| カテゴリ | 判定 | 監査 |
|----------|------|------|
| AI運営秘書 | **WARNING** | Phase1〜12 + 接続 P0/P1/P2 + 本番接続 |
| TALK | **PASS** | 利用者導線 |
| Builder | **PASS** | 利用者導線 |
| Connect | **PASS** | 利用者導線 |
| 市場EC | **PASS** | 利用者導線 |
| UI | **WARNING** | 横スクロール・CTA 残 |
| CTA | **WARNING** | Builder 案件詳細 応募 1 FAIL |

---

## P0 — 本番接続ブロッカー（インフラ / 運用）

製品コード変更は不要。**本番接続作業**で解消する項目。

| ID | 領域 | 内容 | 対応 |
|----|------|------|------|
| **P0-1** | Webhook / Stripe | **実 Stripe Webhook 未接続** — `stripe_webhook_sim` / ingest ログのみ。Connect payout・市場決済の本番イベントが届かない | `supabase/functions/stripe-webhook` デプロイ + `STRIPE_WEBHOOK_SECRET` 設定 + ダッシュボード登録 |
| **P0-2** | Supabase / 安否 | **RLS 実 DB 検証 JWT expired** — `verify-anpi-rls-real-db.mjs` 9/18 NG | `scripts/issue-anpi-rls-jwt.mjs` で JWT 再発行・CI  secrets 更新 |
| **P0-3** | Supabase / 安否 | **dev RLS ポリシー** — anon insert 拒否テストで「dev ポリシー未検出」warning | `sql/anpi-rls-production.sql` を本番 DB に適用済みか確認 |

---

## P1 — 要製品修正

**なし**（6 領域 RELEASE FROZEN）

| 候補 | 切り分け | 分類 |
|------|----------|------|
| CTA Builder 応募 FAIL | 凍結 Builder・モバイル到達性 — 導線監査本体 PASS | **P2-1** |
| AI UX volume daily100/500 FAIL | localStorage 大量件 — 本番 DB 移行後 | **P2-2** |
| 本番接続 gaps（TALK chat_started 等） | 監査上 P2 送り済み | **P2** |

---

## P2 — 本番接続後 / 横断改善

### 本番接続・バックエンド

| ID | 内容 |
|----|------|
| P2-3 | TALK `tasful-talk-notifications-changed` admin-ai 購読 |
| P2-4 | TALK chat_started / user_block admin-ai 収集 |
| P2-5 | 市場イベントパイプライン（order/cancel/refund → Inbox） |
| P2-6 | 市場 KPI `tasu_shop_orders` 本番反映 |
| P2-7 | 安否 confirmed 構造化 KPI（anpi-dashboard 直結） |
| P2-8 | Connect/Builder 手数料 KPI 内訳 |
| P2-9 | サーバー側承認 API（localStorage 脱却） |
| P2-10 | JWT ロール + Connect/安否状態のサーバー検証 |
| P2-11 | Ops Watch log dedupe（snapshot 連打） |

### 凍結領域 — 監査 / UX（製品変更なし）

| ID | 内容 |
|----|------|
| P2-12 | Connect 承認後 requirement 通知 seed 整理 |
| P2-13 | Connect payment-settings 戻る導線 |
| P2-14 | 安否 register E2E セレクタ / LINE バッジ文言 |
| P2-15 | UI 総監査 WARNING（横スクロール・CTA） |
| P2-16 | CTA モバイル — Builder 応募 / 市場 buy 固定バー |
| P2-17 | AI 運営 Inbox 100+/500+ virtual scroll |
| P2-18 | `dev-server-url.mjs` port 8765 統一 |

詳細は各領域 release-status / final-audit を参照。

---

## 本番接続レビュー — 接続済み / 未接続

### 接続済み（PASS）

Support 新規/complaint/reopened · TALK 未読重要/通報 · Connect 本人確認/payout · 安否 emergency/未確認 · Builder 応募/採用/完了/差し戻し/審査 · 学習チェーン

### 本番未接続（接続フェーズで対応 — 製品 P1 ではない）

| 領域 | 項目 | 分類 |
|------|------|------|
| Stripe | 実 Webhook | **P0-1** |
| TALK | chat_started / block / bus 購読 | P2 |
| 市場 | 注文/キャンセル/返金パイプライン | P2 |
| 安否 | confirmed KPI 構造化 | P2 |
| Connect | 手数料 KPI 内訳 | P2 |

---

## RELEASE FROZEN 6領域 — 横断サマリー

| 領域 | 凍結ドキュメント | 導線監査 | 本番接続 |
|------|-----------------|---------|---------|
| 市場EC | [`market-ec-release-status.md`](market-ec-release-status.md) | **PASS** | イベント P2 |
| TALK | [`talk-release-status.md`](talk-release-status.md) | **PASS** | 一部 P2 |
| Builder | [`builder-release-status.md`](builder-release-status.md) | **PASS** | 反映 PASS |
| AI運営秘書 | [`ai-ops-secretary-release-status.md`](ai-ops-secretary-release-status.md) | **WARNING** | **PASS** |
| Connect | [`connect-release-status.md`](connect-release-status.md) | **PASS** | Webhook P0 |
| 安否 | [`anpi-release-status.md`](anpi-release-status.md) | **PASS** | RLS JWT P0 |

---

## 本番接続前チェックリスト（推奨順）

1. **P0-1** Stripe Webhook 本番配線 + 署名検証 E2E
2. **P0-2/3** Supabase 本番 RLS 適用 + JWT 再発行 + `verify-anpi-rls-real-db.mjs` 全 PASS
3. Edge Functions 到達性（`anpi-line-send` / `anpi-line-token-exchange` / `stripe-webhook`）
4. `chat-supabase-config.js` 本番 Project URL / anon key 確認
5. LINE Login 本番チャネル（[`docs/anpi-line-manual-test.md`](../docs/anpi-line-manual-test.md)）
6. 接続後: `review-tasful-final.mjs` + `review-admin-ai-production-connectivity.mjs` 再実行

---

## 再実行コマンド

```bash
# 横断総合（約 12 分）
node scripts/review-tasful-final.mjs

# 本番接続
node scripts/review-admin-ai-production-connectivity.mjs
node scripts/test-admin-ai-connectivity-p0.mjs
node scripts/test-admin-ai-connectivity-p1.mjs
node scripts/test-admin-ai-connectivity-p2.mjs

# Stripe / 安否
node scripts/test-stripe-connect-trouble-hardening-browser.mjs
node scripts/test-anpi-rls-production-browser.mjs
node scripts/verify-anpi-rls-real-db.mjs
```

---

## 参照

- [`tasful-final-review/review-report.md`](../screenshots/tasful-final-review/review-report.md)
- [`admin-ai-production-connectivity/connectivity-report.md`](../screenshots/admin-ai-production-connectivity/connectivity-report.md)
- [`connect-final-audit-remaining-issues.md`](connect-final-audit-remaining-issues.md)
- [`anpi-final-audit-remaining-issues.md`](anpi-final-audit-remaining-issues.md)
- [`docs/anpi-supabase-production-checklist.md`](../docs/anpi-supabase-production-checklist.md)
- 各 `*-release-status.md`（6 領域）
