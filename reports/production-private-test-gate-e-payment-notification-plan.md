# Gate-E — 決済・Webhook・通知・本番運用確認 手順書

| 項目 | 内容 |
|------|------|
| 作成日 | **2026-06-23** |
| 種別 | 非公開本番（Cloudflare Access 配下）の **金銭処理・通知** 安全確認 |
| 前提 Gate | B **GO** · C **GO with note** · Supabase **GO** · D **GO** |
| 許可ユーザー | **`rubi.hiro0613@gmail.com` のみ** |
| 一般公開 | **しない** |

---

## 1. 目的

非公開本番環境（`tasufull-article.pages.dev` / Access OTP 後）において、以下の **重大事故** を公開前に潰す。

| リスク | 確認観点 |
|--------|----------|
| 誤課金 / 二重課金 | Checkout · Webhook · DB 冪等 |
| Webhook 改ざん | 署名検証 |
| 支払い未反映 | confirm フォールバック + webhook |
| 誤通知 / 外部送信 | 通知対象 · dedupe · 許可ユーザーのみ Access |
| Connect 事故 | クライアント sim のみ · 本番外部送信なし |
| URL 漏洩 | 本番 URL が UI 導線にない |

---

## 2. 前提

| 項目 | 内容 |
|------|------|
| Cloudflare Access | **維持** · 設定変更しない |
| UI | **変更禁止** |
| DB 構造 | **変更禁止** |
| Stripe Live 切替 | 本手順では **既存 Secrets のモードを確認** のみ。Live 実決済は **最小金額・手動** |
| 修正許可 | Gate-E 確認に **必要な最小**（例: CORS · smoke スクリプト）のみ |
| storage-state | `reports/gate-d-auth-storage.json`（Git 管理外） |

---

## 3. 対象機能

### 3.1 Stripe

| 機能 | Edge Function | 備考 |
|------|---------------|------|
| GenAI Checkout | `stripe-create-genai-checkout` | Basic / Pro / 2D Live / 3D ticket |
| Featured Checkout | `stripe-create-checkout` | `price_data` 動的 |
| Shop Checkout | `stripe-create-shop-checkout` | Connect destination |
| Service fee | `stripe-create-service-fee` | confirm / webhook **なし** |
| Confirm フォールバック | `stripe-confirm-*` | webhook 遅延時 |
| **Webhook（唯一）** | `stripe-webhook` | GenAI + Featured |
| カタログ / Webhook 登録 | `stripe-setup-genai-catalog` | **Test のみ** |
| E2E 決済（Test） | `stripe-e2e-pay-genai-checkout` | `tok_visa` · **sk_test_ のみ** |

### 3.2 Connect

| 層 | 実装 | 備考 |
|----|------|------|
| サーバー Webhook | **なし** | `stripe-webhook` は Connect 非対応 |
| クライアント ingest | `stripe-connect-ingest.js` | `simulation` / `production` モード |
| 運営 UI | `stripe-connect-trouble-ui.js` · `admin-ai-ops-watch.js` | localStorage 監査 |

### 3.3 通知

| 種別 | 経路 |
|------|------|
| TALK 通知 | `live-notify` → `talk_notifications` · `TasuTalkNotifications` |
| 運営通知 | `support-admin-notify.js` · `stripe-connect-ingest` |
| AI 秘書 | `admin-operations-dashboard` · `talk-home-data` category `ai_secretary` |
| メール | ANPI 設定フラグのみ · **決済レシート SMTP 未実装** |
| 支払い後 | confirm / webhook 後の entitlements · platform fee notify |

### 3.4 監査ログ

| 種別 | 保存先 |
|------|--------|
| Connect ingest | `tasu_stripe_event_ingest_logs_v1`（localStorage） |
| AI ops | `tasu_ai_action_audit_log_v1`（localStorage） |
| ANPI | `anpi_no_response_audit_log`（DB） |
| Stripe Webhook | **DB テーブルなし** — Stripe Dashboard + Edge logs |

---

## 4. 確認項目

### 4.1 Stripe 環境

- [ ] `STRIPE_SECRET_KEY` が **Test / Live** どちらか（`sk_test_` / `sk_live_`）
- [ ] `STRIPE_WEBHOOK_SECRET` が同一モードの `whsec_`
- [ ] Webhook URL: `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook`
- [ ] 登録イベント: `checkout.session.completed` · `customer.subscription.updated` · `customer.subscription.deleted`
- [ ] Price secrets 4 件設定済み
- [ ] 本番 URL が **公開 HTML/JS 導線にない**

### 4.2 Checkout smoke

- [ ] Session 作成（GenAI Basic · 3D ticket · Featured）
- [ ] Checkout URL が Stripe Hosted へ遷移可能
- [ ] `success_url` / `cancel_url` が `SITE_URL` / `origin` ベース
- [ ] Test: `stripe-e2e-pay-genai-checkout` で最小決済シミュレーション
- [ ] Console 重大 error なし（Access 内ブラウザ · 任意）

### 4.3 Webhook smoke

- [ ] 署名なし → **400** `Missing stripe-signature`
- [ ] 不正署名 → **400** `Invalid signature`
- [ ] `checkout.session.completed` → DB 反映（Test 実決済 or Dashboard 再送）
- [ ] 二重イベント → `alreadyGranted` / session_id 冪等
- [ ] エラー時 Edge log（運営メールは未配線 — **HOLD 許容**）

### 4.4 通知 smoke

- [ ] `live-notify` dedupe（`live_notify_dedupe`）
- [ ] TALK `talk_notifications` 作成
- [ ] 運営 `support-admin-notify` ローカルキュー
- [ ] AI 秘書ハブ到達
- [ ] **外部ユーザーへ送信しない**（Access 1 名 · テスト user_id のみ API 使用）
- [ ] メール SMTP — **未実装は HOLD（致命ではない）**

### 4.5 Connect（利用時のみ）

- [ ] Connect account 状態 — クライアント sim / Dashboard 手動
- [ ] `account.updated` — `stripe-connect-event-map.js` マッピング確認
- [ ] 本番で不要な外部送信なし

---

## 5. PASS / HOLD / FAIL 基準

| 判定 | 条件 |
|------|------|
| **PASS** | 確認項目を満たし、金銭・通知の重大リスクなし |
| **HOLD** | 非致命ギャップ（メール未配線 · Featured テスト listing 不存在 · Live 未手動確認 · Shop confirm 未デプロイ疑い） |
| **FAIL** | 二重反映 · 署名検証バイパス · 誤通知大量送信 · Live/Test Secrets 混在 · 本番 URL 公開導線露出 |

### Gate-E 総合

| 総合 | 条件 |
|------|------|
| **GO** | FAIL 0 · 金銭処理・Webhook・DB 反映に致命問題なし |
| **HOLD** | HOLD のみ（手動 Live 確認待ち等） |
| **FAIL** | 上記 FAIL 条件のいずれか |

---

## 6. テスト金額

| プラン | 金額 | 用途 |
|--------|------|------|
| GenAI Basic | ¥300/月 | Checkout 作成 smoke |
| 3D ticket | ¥500 一回 | Test E2E 決済（`tok_visa`） |
| Featured 7日 | ¥980 | Session 作成 smoke |
| **Live 手動時** | **最小プラン（¥300 等）· 1 回のみ** | 運営者 OTP ブラウザ |

**禁止:** Live で高額一括 · 複数回の実課金ループ · 許可外メールへの通知テスト

---

## 7. ロールバック方法

| 事象 | 対応 |
|------|------|
| 誤った Live 課金 | Stripe Dashboard で返金 · DB entitlements 手動補正（service_role） |
| Webhook 暴走 | Stripe Dashboard で endpoint 無効化 |
| Secrets 混在 | `supabase secrets set` で Test に戻す · **同一モードの whsec と sk_ をセット** |
| 二重 entitlements | `gen_ai_entitlements` / `featured_stripe_session_id` で session 単位確認 |
| 誤通知 | `talk_notifications` 該当行削除 · localStorage マスター通知クリア |

---

## 8. 注意点

1. **`payment_intent.succeeded` は server webhook 未処理** — `checkout.session.completed` が主経路
2. **Shop / Service fee** は webhook 未配線 — confirm フォールバックまたは未実装箇所あり
3. **Connect** はブラウザ sim — 本番 Connect webhook は **スコープ外**
4. **メール通知** は将来フック — Gate-E では **HOLD 記載で GO 可**
5. **Live 切替（P0-W2）** は Gate-E 後の別チェックリスト（`stripe-live-go-live-checklist.md`）
6. 自動検証: `npm run verify:gate-e`

---

## 9. 実行コマンド

```bash
# 自動（API · Webhook 衛生 · Test E2E · 静的通知）
npm run verify:gate-e

# Test 決済シミュレーションをスキップ
node scripts/verify-gate-e-stripe-notify.mjs --skip-e2e-pay

# GenAI API smoke（既存）
node scripts/test-genai-stripe.mjs

# LIVE 通知（staging API）
npm run verify:live-p7 -- --skip-deploy

# Access 内ブラウザ（任意）
npm run smoke:gate-d -- --storage-state reports/gate-d-auth-storage.json
```

---

**署名:** Gate-E 手順書 — 2026-06-23
