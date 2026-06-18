# P0-W4: Stripe READY 化チェック

**作成日:** 2026-06-18  
**種別:** 監査 + 最小ドキュメント更新（**Stripe Live 切替・本番決済・Dashboard 変更なし**）  
**前提:** [`stripe-prelive-final-check.md`](stripe-prelive-final-check.md)（P0-W3 · WARNING）  
**更新:** [`stripe-live-values-template.md`](stripe-live-values-template.md) §0 · §2.7 · 一括コマンド  
**Supabase プロジェクト:** `ddojquacsyqesrjhcvmn`

---

## 実施サマリ

| 項目 | P0-W3 | P0-W4 |
|------|-------|-------|
| 本番 URL | 未確定 | **`https://tasful.jp` に確定** |
| `SITE_URL` Secret | 未設定 | **値確定 · 投入手順整理**（Secret 本体は未投入） |
| Test バックアップ | 構造のみ | **§0 完成 + vault チェックリスト追加** |
| ロールバック | PASS | **再確認 PASS** |

**Stripe 承認前の禁止事項（継続）:** Live Secret · Live Product/Price · Live Webhook · 本番 Live 決済

---

## 実施項目① 本番 URL 確定

### 本番 URL 決定案

| 項目 | 決定値 |
|------|--------|
| **正式本番 URL（canonical）** | **`https://tasful.jp`** |
| **www** | **使用しない**（将来 `www.tasful.jp` → apex 301 推奨） |
| **末尾スラッシュ** | なし |
| **採用理由** | タスク例の第一候補 · ブランド apex · `SITE_URL` / Checkout URL の単一 origin |

**不採用 / 参考:**

| URL | 扱い |
|-----|------|
| `https://www.tasful.jp` | リダイレクト用サブドメイン候補（canonical にはしない） |
| `https://tasful.app` | `talk-friend-hub-store.js` のコード内フォールバックのみ · **決済 SITE_URL には使わない** |

**DNS / ホスト（2026-06-18 確認）:** `tasful.jp` · `www.tasful.jp` · `tasful.app` は **当環境 DNS 未登録**（`Non-existent domain`）。**静的ホスト稼働は Live smoke の別ゲート** — URL **方針**としては確定済み。

### Featured Checkout 戻り先（`SITE_URL=https://tasful.jp` 時）

`stripe-create-checkout` · `listing-featured.js`（**`origin` 未送信** → **`SITE_URL` 必須**）

| 種別 | URL パターン |
|------|-------------|
| **success_url** | `https://tasful.jp/detail-{product\|skill\|job\|worker}.html?id={listing_uuid}&featured_checkout=success&session_id={CHECKOUT_SESSION_ID}` |
| **cancel_url** | `https://tasful.jp/detail-{type}.html?id={listing_uuid}&featured_checkout=cancelled` |

例（skill · UUID `abc...`）:

```text
success: https://tasful.jp/detail-skill.html?id=abc...&featured_checkout=success&session_id=cs_test_...
cancel:  https://tasful.jp/detail-skill.html?id=abc...&featured_checkout=cancelled
```

### GenAI Checkout 戻り先（参考）

`gen-ai-workspace.js` は `origin: location.origin` を送信するため、本番ブラウザからは `https://tasful.jp` が自動選択。**`SITE_URL` は Featured / Portal / referer 欠落時の保険。**

| 種別 | URL パターン |
|------|-------------|
| **success_url** | `https://tasful.jp/gen-ai-workspace.html?genai_checkout=success&session_id={CHECKOUT_SESSION_ID}&genai_plan={planId}` |
| **cancel_url** | `https://tasful.jp/gen-ai-workspace.html?genai_checkout=cancelled` |
| **Portal return_url** | `https://tasful.jp/gen-ai-workspace.html` |

### 利用箇所一覧（決定 URL の影響範囲）

| 利用者 | 本番 URL の使われ方 |
|--------|---------------------|
| Supabase Secret `SITE_URL` | Edge `resolveSiteOrigin` 第 2 優先 |
| Featured Checkout | **唯一の origin 源**（body `origin` なし） |
| GenAI Checkout | body `origin` 優先 · `SITE_URL` は fallback |
| Customer Portal | `SITE_URL` / referer |
| Shop / 手数料 Checkout | 同上（Live スコープ外） |
| 静的 HTML 配信 | `tasful.jp` で `gen-ai-workspace.html` · `detail-*.html` を HTTPS 配信する必要あり |

### 判定: **PASS**

本番 canonical を **`https://tasful.jp`** に確定。DNS 未稼働は **ホストデプロイゲート**として切り分け済み。

---

## 実施項目② SITE_URL

### 現在状態（2026-06-18 · `supabase secrets list`）

| Secret | 状態 |
|--------|------|
| `SITE_URL` | **未設定**（一覧に存在しない） |
| `STRIPE_SECRET_KEY` 他 Test Stripe | 設定済み（digest あり · Test 想定） |

### SITE_URL 使用箇所一覧

| # | ファイル | 用途 | success / cancel / return |
|---|----------|------|---------------------------|
| 1 | `supabase/functions/stripe-create-genai-checkout/index.ts` | GenAI Checkout | `success_url` · `cancel_url` |
| 2 | `supabase/functions/stripe-create-checkout/index.ts` | Featured Checkout | `success_url` · `cancel_url` |
| 3 | `supabase/functions/stripe-create-genai-portal/index.ts` | Customer Portal | `return_url` |
| 4 | `supabase/functions/stripe-create-shop-checkout/index.ts` | Marketplace | `success_url` · `cancel_url` |
| 5 | `supabase/functions/stripe-create-service-fee/index.ts` | 手数料 | `success_url` · `cancel_url` |

**解決順（共通 `resolveSiteOrigin`）:**

1. POST body `origin`（Featured は **常にスキップ**）
2. **`SITE_URL` Secret**
3. `Referer` / `Origin` ヘッダ
4. fallback `http://localhost:5173`

**フロント（Stripe 関連 · body `origin`）:**

| ファイル | 送信 |
|----------|------|
| `gen-ai-workspace.js` | `origin: location.origin` |
| `shop-checkout.js` | `window.location.origin` |
| `service-fee-pay.js` | `window.location.origin` |
| `platform-chat-fee-pay.js` | `window.location.origin` |
| `listing-featured.js` | **送信なし** |

**redirect 処理（Stripe 外 · 参考）:** `tasu_talk_return_url`（TALK 戻り · 決済無関係）

### 投入値（確定）

```bash
supabase link --project-ref ddojquacsyqesrjhcvmn

supabase secrets set SITE_URL=https://tasful.jp
```

| 項目 | 値 |
|------|-----|
| **Secret 名** | `SITE_URL` |
| **投入値** | `https://tasful.jp` |
| **禁止** | 末尾 `/` · `www` 付き（canonical と不一致にしない） |

### 投入タイミング（P0-W4 方針）

| タイミング | 推奨 | 理由 |
|------------|------|------|
| **静的ホスト `tasful.jp` 稼働後 · Live 切替前** | ✅ 推奨 | Featured Test も本番 origin に戻れる |
| **Live Secrets 一括更新と同時** | ✅ 可 | go-live-checklist 手順 12 と整合 |
| **ホスト未稼働のまま先行投入** | ⚠️ 非推奨 | Checkout 成功後に **到達不能 URL** へリダイレクト |
| **localhost 開発中に先行投入** | ⚠️ 注意 | `SITE_URL` は referer **より優先** — Featured ローカルテストが `tasful.jp` 戻りになる |

**P0-W4 実施:** Secret **は未投入**（Live 切替禁止 · DNS 未稼働のため）。値とコマンドのみ確定。

### 判定: **PASS**（値・手順 READY · Secret 本体はホスト稼働後に投入）

---

## 実施項目③ Test Secret バックアップ完成

**対象:** [`stripe-live-values-template.md`](stripe-live-values-template.md) §0（P0-W4 更新済み）

### 記入対象一覧

| # | 項目 | 保管 | P0-W4 状態 |
|---|------|------|------------|
| 1 | Test `STRIPE_SECRET_KEY` | vault のみ | ☐ vault 転記待ち |
| 2 | Test `STRIPE_WEBHOOK_SECRET` | vault のみ | ☐ vault 転記待ち |
| 3 | Test Endpoint ID | Git OK（公開 ID） | ☑ `we_1TR70n5tJSRSYcyiMrAzpuGF` |
| 4 | Test Price BASIC_300 | vault のみ | ☐ vault 転記待ち |
| 5 | Test Price PRO_980 | vault のみ | ☐ vault 転記待ち |
| 6 | Test Price 2D_LIVE_300 | vault のみ | ☐ vault 転記待ち |
| 7 | Test Price 3D_GENERATE_500 | vault のみ | ☐ vault 転記待ち |
| 8 | 切替前 `SITE_URL` | Git OK | ☑ **未設定** |
| 9 | 本番 `SITE_URL` 方針 | Git OK | ☑ `https://tasful.jp` |

**Supabase 実在確認（2026-06-18）:** `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_GENAI_PRICE_*` ×4 は **digest あり**（Test 稼働中）。値の復元は vault / Dashboard が必要。

### 未記入箇所一覧（vault · Ops 作業）

| 項目 | 取得元 |
|------|--------|
| `sk_test_...` | Stripe Dashboard → **Test mode** → Developers → API keys |
| `whsec_...`（Test） | Test Webhook `we_1TR70n5tJSRSYcyiMrAzpuGF` → Signing secret（再表示不可なら Roll） |
| `price_...` ×4 | Dashboard Test Products **または** 各 Secret の現行値を vault に控え |

### Dashboard 取得が必要な項目

1. Test **Secret key**（`sk_test_`）
2. Test Webhook **Signing secret**（`whsec_` · endpoint `we_1TR70n5tJSRSYcyiMrAzpuGF` とペア）
3. Test **Price ID** ×4（metadata `genai_plan` で照合）

**不要（Live 切替スコープ外）:** Featured Price Secret · `STRIPE_PUBLISHABLE_KEY` · `GENAI_SETUP_TOKEN`

### 判定: **PASS**（テンプレート / チェックリスト完成 · **vault 実値 6 件は Ops 記入待ち**）

### 不足一覧

| # | 不足 | ブロッカー | 対応 |
|---|------|-----------|------|
| 1 | vault への `sk_test_` / `whsec_` / `price_` ×4 転記 | Live 切替前 | Ops · §0 vault チェックリスト |
| 2 | — | — | Git に実値を入れない（テンプレート警告遵守） |

---

## 実施項目④ ロールバック再確認

**前提:** Live 投入失敗時 · **Test Secret のみ**復元（Live Secret 投入禁止期間中は該当せず）

### 手順一覧（この 4 点 + 検証で復旧）

| 順 | 項目 | 操作 | 必須 |
|----|------|------|------|
| **1** | **Test Secret 復元** | `STRIPE_SECRET_KEY=sk_test_...` + `STRIPE_GENAI_PRICE_*` ×4 → §0 vault から | ✅ |
| **2** | **Webhook Secret 復元** | `STRIPE_WEBHOOK_SECRET=whsec_...`（Test endpoint とペア）· **手順 1 と同時** | ✅ |
| **3** | **SITE_URL 復元** | **変更不要** — `https://tasful.jp` のまま。Test Checkout も本番 origin 戻り可 | ✅（操作なし） |
| **4** | **再デプロイ** | **通常不要** — Secrets 反映 数秒〜1 分。障害時のみ `supabase functions deploy stripe-webhook` 任意 | — |
| **0** | Live Webhook 停止 | Dashboard → Live endpoint → **Disable**（Live 切替後のみ） | Live 時必須 |
| **5** | 検証 | `node scripts/test-genai-stripe.mjs` PASS · Checkout **TEST** 表示 | ✅ |

**一括復元コマンド（vault から · Live 障害時）:**

```bash
supabase link --project-ref ddojquacsyqesrjhcvmn

supabase secrets set \
  STRIPE_SECRET_KEY=【§0 vault sk_test】 \
  STRIPE_WEBHOOK_SECRET=【§0 vault whsec】 \
  STRIPE_GENAI_PRICE_BASIC_300=【§0 vault price】 \
  STRIPE_GENAI_PRICE_PRO_980=【§0 vault price】 \
  STRIPE_GENAI_PRICE_2D_LIVE_300=【§0 vault price】 \
  STRIPE_GENAI_PRICE_3D_GENERATE_500=【§0 vault price】
```

**触らない:** `SITE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `GEMINI_API_KEY` 他

### 想定復旧時間

| シナリオ | 時間 |
|----------|------|
| §0 vault 記入済み · Disable + Secrets 復元 + smoke | **3〜5 分** |
| vault 未記入 | **不可** — 先に §0 完成 |

### 判定: **PASS**

手順 1〜3 + 検証のみで Test モード復帰可能。**再デプロイは必須ではない。**

---

# READY 判定

## **READY**

P0-W3 の WARNING 要因（URL 未確定 · バックアップ未完成 · 手順未整理）を **ドキュメント / 方針レベルで解消**。Stripe Live 切替そのものは **承認後ゲート**のまま。

### READY になった条件（本チェックで達成）

| # | 条件 | 状態 |
|---|------|------|
| 1 | 本番 canonical URL 確定 | ✅ `https://tasful.jp` |
| 2 | `SITE_URL` 投入値・コマンド・タイミング明文化 | ✅ |
| 3 | §0 バックアップ構造 + vault チェックリスト | ✅ |
| 4 | Test Endpoint ID · 切替前 SITE_URL 状態を Git 記録 | ✅ |
| 5 | ロールバック手順再確認 | ✅ |

### READY 後も残る実行ゲート（Stripe 承認前 / ホスト）

| # | ゲート | 担当 | Stripe 承認前に可能？ |
|---|--------|------|----------------------|
| G1 | vault へ Test 実値 6 件転記 | Ops | ✅ **推奨** |
| G2 | `tasful.jp` 静的ホスト + HTTPS | Infra | ✅ |
| G3 | `supabase secrets set SITE_URL=https://tasful.jp` | Ops | ✅（**G2 後**） |
| G4 | Live Product / Price / Webhook / Live Secrets | Ops | ❌ **承認後まで禁止** |
| G5 | Live ¥300 smoke | QA | ❌ 承認後 |

### Stripe 承認後の最初の 3 手（参考）

1. Live Product/Price 4 件 + Live Webhook 作成（§4 · §5 テンプレート）
2. Live Secrets 一括更新（`sk_live_` + Live `whsec_` + Live Price ×4 + `SITE_URL`）
3. GenAI ¥300 smoke（§6 SQL · Webhook 200）

---

## 変更一覧（P0-W4）

| ファイル | 変更 |
|----------|------|
| `reports/stripe-ready-check.md` | **新規**（本書） |
| `reports/stripe-live-values-template.md` | §0 バックアップ拡充 · 本番 URL 確定 · §2.7 · 一括コマンド |

**未実施（意図）:** Supabase `SITE_URL` 投入 · Stripe Dashboard 操作 · vault 実値 Git 記載 · 本番決済

---

**監査 + 最小修正完了:** Stripe Live 切替前の **READY** 状態。承認後まで Live Secret / Product / Price / Webhook は触らないこと。
