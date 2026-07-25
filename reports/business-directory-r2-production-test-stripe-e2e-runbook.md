# Business Directory R2 — Production Stripe Test E2E 実施手順書

**作成日:** 2026-07-01  
**種別:** 運用手順（**Production スタック · Stripe Test mode · 4242**）  
**Project ref:** `ddojquacsyqesrjhcvmn`  
**Stripe mode:** **Test only**（`sk_test_*` · Test Price ID）— **Live 実課金禁止**  
**正本監査:** [production-stripe-e2e-readiness.md](./business-directory-production-stripe-e2e-readiness.md) §14

> **H1 正本推奨（2026-07-01 運用確認）:** **Step 4 smoke** が 4242 完走 + webhook/sync を検証。**Phase 2a** は Checkout URL のみで plan 同期 FAIL あり — H1 単独指定時は Step 4 を併用すること。

---

## 0. 目的

Controlled apply 後に **Stripe 連携が Production スタックで再び PASS する** ことを、Test カード **4242** で検証する。

**スコープ:**

- ✅ Checkout · webhook/sync · plan 反映 · Public planGate
- ✅ （任意）Portal 解約 — [portal-cancel-runbook.md](./business-directory-r2-portal-cancel-runbook.md)
- ❌ Live 実課金 · Commercial Launch Go

---

## 1. 事前チェック

### 1.1 環境 · 接続

| # | 項目 | 確認方法 | 期待 |
| --- | --- | --- | --- |
| P1 | Production ref | 作業メモ · Dashboard 目視 | `ddojquacsyqesrjhcvmn` **のみ**（Staging link 混同なし） |
| P2 | Stripe Dashboard mode | 右上トグル | **Test mode** |
| P3 | Edge 到達 | 過去 S3 記録 · 任意 HEAD | `business-directory` · `stripe-webhook` **ACTIVE** |
| P4 | ローカル dev | `npm run dev` · netstat 8788 | `http://127.0.0.1:8788` LISTEN |
| P5 | build 同期 | ソース変更時のみ | `npm run build:pages` 済 |

### 1.2 Stripe（Dashboard 読取 · 変更なし）

| # | 項目 | 期待（Step 2 記録） |
| --- | --- | --- |
| S1 | Standard Price ID | `price_1TmyY05tJSRSYcyiaeQoIeBa`（¥980/月） |
| S2 | Pro Price ID | `price_1TmyY25tJSRSYcyiNuE9lna5`（¥2,980/月） |
| S3 | Webhook URL | `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook` |
| S4 | Webhook events（BD 6 種） | `checkout.session.completed` · `customer.subscription.created/updated/deleted` · `invoice.payment_succeeded/failed` |
| S5 | Test delivery | 直近 **Succeeded** または E2E 後に成功記録 |

### 1.3 Supabase secrets（名前のみ · 値は読取禁止でも可）

| Secret | 必須 |
| --- | --- |
| `STRIPE_SECRET_KEY` | ✅（Test） |
| `STRIPE_WEBHOOK_SECRET` | ✅ |
| `BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD` | ✅ |
| `BUSINESS_DIRECTORY_STRIPE_PRICE_PRO` | ✅ |
| `SITE_URL` | ✅（`https://tasufull-article.pages.dev` · 8788 時は `origin` 優先） |

### 1.4 テストアカウント

| ロール | 参照 |
| --- | --- |
| Owner | `t2@tasful.invalid`（L7 · Step 4 smoke） |
| Ops Admin | `t4@tasful.invalid`（`tasu_admin` · 審査 approve） |

### 1.5 事前チェック Go 条件

**すべて ✅ 後に E2E 開始。** S4/S5 未確認の場合は **Conditional Go** — 実施可だが webhook 失敗リスクを記録に残す。

---

## 2. 実施手順

### Phase A — 静的回帰（ローカル · Production API 向け）

```bash
node scripts/test-business-directory-phase6-stripe.mjs
```

**期待:** **52/52 PASS**

---

### Phase B — Production API smoke（`--skip-stripe` 禁止）

**8788 ベース（推奨）:**

```bash
npm run dev
node scripts/test-business-directory-phase2a-production-smoke.mjs
```

**Step 4 フル（任意 · より広いカバレッジ）:**

```bash
node scripts/test-business-directory-production-step4-production.mjs --all
```

**重要:**

- **`--skip-stripe` を付けない**
- `BASE_URL` / deploy URL はスクリプト既定または `http://127.0.0.1:8788`
- Checkout URL 取得後、スクリプトが browser checkout をスキップする場合は **Phase C 手動** へ

---

### Phase C — 手動ブラウザ E2E（Owner → Stripe → Public）

1. **8788** で Owner ログイン → 新規 draft または既存 listing
2. 最小項目入力 → 審査申請 → Ops **approve** → `published`
3. `edit.html` → **Standard にアップグレード**
4. Stripe Checkout（Test **4242**）で完了
5. 戻り URL `?bd_checkout=success` → 自動 **`sync_subscription_status`**
6. Owner プランカード = **Standard**
7. Public detail — **FAQ / full_description / recommended_uses 表示**（planGate）
8. （任意）Portal 解約 — [portal-cancel-runbook.md](./business-directory-r2-portal-cancel-runbook.md)

**Console:** BD 関連ページ **エラー 0**（1280 / 768 / 390 いずれか 1 viewport 以上推奨）

---

### Phase D — 結果記録

| 記録先 | 内容 |
| --- | --- |
| 本 Runbook 実行ログ（別紙 or TODO） | 日時 · 実行者 · PASS/FAIL · スクリプト出力 |
| [production-stripe-e2e-readiness.md](./business-directory-production-stripe-e2e-readiness.md) | §9.3 チェックリストを ✅ 更新 |
| [commercial-launch-checklist.md](./business-directory-commercial-launch-checklist.md) | Stripe / Browser 行を更新 |

---

## 3. 確認項目

| # | 領域 | 確認内容 |
| --- | --- | --- |
| C1 | Checkout | `create_subscription_checkout` が URL 返却 · 4242 成功 |
| C2 | Webhook | Dashboard で `checkout.session.completed` **Succeeded** |
| C3 | Supabase | listing · `plan_code=standard` · `stripe_subscription_id` 設定 |
| C4 | sync フォールバック | success 戻りで sync 実行 · plan 反映 |
| C5 | Owner UI | Standard 表示 · 写真上限 10 |
| C6 | Public | published detail · rich セクション **表示** |
| C7 | 回帰 | Phase 6 52/52 · smoke **0 fail** |
| C8 | Console | 8788 · 対象 URL **error 0** |

---

## 4. 成功条件

| レベル | 条件 |
| --- | --- |
| **Minimum Go** | Phase A **52/52** · Phase B smoke **0 fail**（stripe 有効）· C3–C6 **手動 PASS** |
| **Recommended Go** | 上記 + C2 webhook **Succeeded** · C8 console 0 · viewport 3 サイズ記録 |
| **R2 Complete** | Minimum Go + 結果を readiness レポートに追記 · Commercial Launch checklist 更新 |

**Commercial Launch Go ではない** — OB1–OB8 · Live E2E は別 Epic。

---

## 5. ロールバック不要である理由

| 操作 | 理由 |
| --- | --- |
| **Test 決済（4242）** | 実資金移動なし · Stripe Test Customer/Subscription |
| **DB 更新** | listing 行の plan/stripe 列更新のみ · **migration / DDL なし** |
| **Edge** | redeploy 不要（apply 後も S3 PASS 記録） |
| **静的** | E2E は読取/更新のみ · dist ロールバック不要 |
| **解約** | Test sub は Dashboard から cancel 可能 · Production データ破壊なし |

**注意:** Test listing を残す場合、以降の smoke で **同一 Owner/sub 競合** あり — 新規 listing または Portal 解約で整理。

---

## 6. 失敗時の確認手順

### 6.1 Checkout URL が取れない

1. Edge log（`business-directory`）— `stripe_not_configured` / `price not configured`
2. secrets 名存在確認（Dashboard · **値変更はしない**）
3. `BUSINESS_DIRECTORY_STRIPE_PRICE_*` が Step 2 ID と一致（Test mode）

### 6.2 Checkout 成功後 plan が free のまま

1. Stripe Dashboard → Webhooks → `checkout.session.completed` 配信状態
2. Edge `stripe-webhook` log — signature 400 / 500
3. Owner **`sync_subscription_status`** 手動実行
4. listing metadata · `order_type=business_directory_subscription`（Stripe Subscription 側）

### 6.3 smoke FAIL（API）

1. 出力 JSON の fail 行を保存
2. `--skip-stripe` が **付いていないか** 確認
3. Production ref / auth テストユーザー確認
4. [controlled-apply-result.md](./business-directory-production-controlled-apply-result.md) — DB 状態

### 6.4 Public planGate FAIL

1. listing `plan_code` · `subscription_status` · `current_period_end`
2. `publicDisplayPlan` — stripe 信号あり → `effectivePlanCode`
3. published + approve 済みか
4. [public-detail-config-fix.md](./business-directory-public-detail-config-fix.md) — `chat-supabase-config.js` 読込

### 6.5 8788 不可

1. `npm run dev` · port 8788 LISTEN
2. EPERM 時: dev 停止 → build → dev 再起動（[local-dev.md](../docs/local-dev.md)）

---

## 7. 関連スクリプト

| スクリプト | 用途 |
| --- | --- |
| `scripts/test-business-directory-phase6-stripe.mjs` | 静的 52/52 |
| `scripts/test-business-directory-phase2a-production-smoke.mjs` | Phase 2a + Stripe（**skip 禁止**） |
| `scripts/test-business-directory-production-step4-production.mjs` | フル Production smoke |
| `scripts/test-business-directory-production-step2-edge.mjs` | Edge/secrets 名前確認 |

---

## 8. 参照

| ドキュメント | 用途 |
| --- | --- |
| [portal-cancel-runbook.md](./business-directory-r2-portal-cancel-runbook.md) | 解約 E2E |
| [production-stripe-e2e-readiness.md](./business-directory-production-stripe-e2e-readiness.md) | ブロッカー · Go/No-Go |
| [commercial-launch-checklist.md](./business-directory-commercial-launch-checklist.md) | Launch 前一覧 |
| [production-step2-edge.md](./business-directory-production-step2-edge.md) | Price ID · secrets 証跡 |

---

## 9. 実行記録（2026-07-01 · R2 運用確認）

| コマンド | 結果 |
| --- | --- |
| `test-business-directory-phase6-stripe.mjs` | **52/52 PASS** |
| `test-business-directory-production-step2-edge.mjs --remote` | **15/15 PASS** |
| `test-business-directory-production-step4-production.mjs --smoke --base-url http://127.0.0.1:8788` | **48/48 PASS · Go** |
| `test-business-directory-phase2a-production-smoke.mjs`（`--skip-stripe` なし） | **20/1/2 · FAIL**（4242 未実施 · 実行フェーズ再確認） |
| R2 rich browser flow（2026-07-01 実行フェーズ） | **PASS** — 4242 · sync · public planGate rich · Portal API |

**成功条件（Minimum Go）:** Step 4 **48/48** で **達成**。

**Phase 2a FAIL 原因:** API smoke は Checkout URL 取得後 Playwright 4242 を実行しない。正本 E2E は **Phase B' Step 4** を使用。

### Phase B' — Step 4 smoke（推奨 · 2026-07-01 PASS）

```bash
npm run dev
node scripts/test-business-directory-production-step4-production.mjs --smoke --base-url http://127.0.0.1:8788
```

---
