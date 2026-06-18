# Stripe Live Go-Live 最終チェックリスト

**作成日:** 2026-06-18  
**種別:** 確認・整理のみ（**コード / Secrets / Dashboard 変更なし**）  
**目的:** Stripe Live 承認後 **30 分以内**に本番課金テストへ入れる状態にする  
**スコープ:** GenAI 課金 · Featured 掲載課金 · Checkout · Webhook · Edge Functions · Supabase  
**前提:** P0-W1 Test Webhook PASS（[`stripe-webhook-p0-w1-delivery-check.md`](stripe-webhook-p0-w1-delivery-check.md)）

**関連:** [`stripe-live-production-plan.md`](stripe-live-production-plan.md) · [`stripe-webhook-final-check.md`](stripe-webhook-final-check.md)

---

## 事前状態（本確認時点）

| 項目 | 状態 |
|------|------|
| Supabase プロジェクト | `ddojquacsyqesrjhcvmn` |
| Test Webhook endpoint | 登録済 `we_1TR70n5tJSRSYcyiMrAzpuGF` |
| `stripe-webhook` | ACTIVE v21 |
| GenAI/Featured Edge Functions | デプロイ済（checkout / confirm / webhook / get-plan / portal） |
| Test Secrets | 設定済（digest あり · `sk_test_` 想定） |
| Live 切替 | **未実施**（P0-W2） |
| コード変更要否 | **なし** |

---

## 1. Live切替値一覧

### 1.1 シークレット / 環境変数（Supabase Secrets）

| 名前 | 現在（Test） | 切替後（Live） | 使用箇所 |
|------|-------------|----------------|----------|
| **`STRIPE_SECRET_KEY`** | `sk_test_...` | **`sk_live_...`** | 全 Stripe Edge Function — Checkout 作成 · Session 取得 · Webhook 内 Stripe API · Customer Portal |
| **`STRIPE_WEBHOOK_SECRET`** | Test endpoint の `whsec_...` | **Live endpoint の `whsec_...`（別値）** | `stripe-webhook/index.ts` — `constructEventAsync` 署名検証 |
| **`STRIPE_GENAI_PRICE_BASIC_300`** | Test `price_...` | Live `price_...` | `genai-plans.ts` · `genai-checkout-plans.ts` → `stripe-create-genai-checkout` line_items |
| **`STRIPE_GENAI_PRICE_PRO_980`** | Test `price_...` | Live `price_...` | 同上 |
| **`STRIPE_GENAI_PRICE_2D_LIVE_300`** | Test `price_...` | Live `price_...` | 同上 |
| **`STRIPE_GENAI_PRICE_3D_GENERATE_500`** | Test `price_...` | Live `price_...` | 同上 |
| **`SITE_URL`** | 未設定 or localhost 想定 | **本番フロント URL**（例 `https://www.example.com` · 末尾 `/` なし） | `stripe-create-genai-checkout` · `stripe-create-checkout` · `stripe-create-genai-portal` — success/cancel/return URL |
| **`SUPABASE_SERVICE_ROLE_KEY`** | 設定済 | **変更なし** | `_shared/apply-*.ts` — DB upsert |
| **`SUPABASE_URL`** | 自動注入 | **変更なし** | Edge ランタイム |

**Live 切替時の鉄則:** `STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` は **必ず Live ペアで同時更新**（Test whsec + Live sk は全 Webhook 失敗）。

---

### 1.2 STRIPE_PUBLISHABLE_KEY

| 項目 | 内容 |
|------|------|
| **現在** | **リポジトリ・Supabase Secrets ともに未使用** |
| **切替後** | **設定不要** |
| **理由** | Hosted Checkout 方式 — ブラウザは Stripe ページへリダイレクトのみ。`pk_test_` / `pk_live_` の参照はコードベースに **ゼロ** |
| **クライアントが使う鍵** | Supabase **anon key** のみ（`chat-supabase-config.js` → Edge Function 呼出） |

---

### 1.3 Product ID（参照用 · metadata）

コード内の **論理 ID**（Stripe Dashboard 上の Product metadata `tasful_product_id` に合わせる）。Secrets には入れない。

| 論理 Product ID | プラン | 使用箇所 |
|-----------------|--------|----------|
| `prod_TASFUL_GENAI_BASIC_300` | GenAI Basic ¥300/月 | `genai-plans.ts` · `stripe-genai-config.js` · Checkout `product_data.metadata` |
| `prod_TASFUL_GENAI_PRO_980` | GenAI Pro ¥980/月 | 同上 |
| `prod_TASFUL_GENAI_2D_LIVE_300` | 2D Live ¥300/月 | `genai-checkout-plans.ts` · `stripe-genai-config.js` |
| `prod_TASFUL_GENAI_3D_GENERATE_500` | 3D チケット ¥500 | 同上 |

**Live 作業:** Dashboard で Product 作成時、metadata に `genai_plan` · `order_type` · `tasful_product_id` を設定（[`stripe-live-production-plan.md`](stripe-live-production-plan.md) §Liveカタログ）。

**Featured:** Product 事前作成 **不要** — `stripe-create-checkout` が `price_data` で都度生成（metadata は Session 側）。

---

### 1.4 Price ID（Secrets · 4 件）

| Secret 名 | プラン | 金額 | 使用 Function |
|-----------|--------|------|---------------|
| `STRIPE_GENAI_PRICE_BASIC_300` | Basic | ¥300/月 · subscription | `stripe-create-genai-checkout` |
| `STRIPE_GENAI_PRICE_PRO_980` | Pro | ¥980/月 · subscription | 同上 |
| `STRIPE_GENAI_PRICE_2D_LIVE_300` | 2D Live | ¥300/月 · subscription | 同上 |
| `STRIPE_GENAI_PRICE_3D_GENERATE_500` | 3D | ¥500 · payment | 同上 |

**未設定時:** `price_data` 動的生成にフォールバック（Test/Live 共通）— Live では **固定 Price ID 設定を強く推奨**。

**Featured Price ID:** Secrets **なし** — 金額は `featured-plans.ts` 固定（¥980 / ¥2,980 / ¥4,980）。

---

### 1.5 固定 URL・識別子（切替不要）

| 項目 | 値 |
|------|-----|
| Webhook URL | `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook` |
| Test Webhook ID（参考） | `we_1TR70n5tJSRSYcyiMrAzpuGF` |
| GenAI success URL パターン | `{SITE_URL}/gen-ai-workspace.html?genai_checkout=success&session_id={CHECKOUT_SESSION_ID}&genai_plan=...` |
| Featured success URL パターン | `{SITE_URL}/detail-*.html?id={uuid}&featured_checkout=success&session_id=...` |

---

### 1.6 値の保管場所（Go Live 前に準備）

| 値 | 保管推奨 |
|----|----------|
| Live `sk_live_...` | Ops vault（Supabase Secrets にのみ投入 · リポジトリ禁止） |
| Live `whsec_...` | 同上（endpoint 作成直後のみ表示） |
| Live Price ID ×4 | スプレッドシート or vault |
| Test ペア（ロールバック用） | 同上 |
| 本番 `SITE_URL` | Runbook 先頭に明記 |

---

## 2. Go Liveチェックリスト

**目標:** 承認後 30 分で Step 12（本番課金テスト）開始。  
**事前準備（承認前に完了推奨）** = Step 0〜4。

### 事前準備（Stripe Live 承認前 · コード変更なし）

| # | 項目 | 確認 | 担当 | 目安 |
|---|------|------|------|------|
| 0 | 本番 `SITE_URL` 確定 | URL 決定 · DNS/ホスト稼働 | 運用 | — |
| 1 | Test Secrets バックアップ | `sk_test_` · Test `whsec_` · Test Price ID ×4 を vault 保存 | 運用 | 5分 |
| 2 | Supabase CLI リンク | `supabase link --project-ref ddojquacsyqesrjhcvmn` | 運用 | 2分 |
| 3 | Edge Functions 状態 | `supabase functions list` — webhook / genai / featured が ACTIVE | 運用 | 2分 |
| 4 | Test smoke 最終確認 | `node scripts/test-genai-stripe.mjs` → PASS | 運用 | 3分 |
| 5 | テスト用 `user_id` 決定 | GenAI workspace で使用する本番 user ID | 運用 | — |
| 6 | Featured 用 UUID listing | Supabase `listings` に実 UUID 行が存在 | 運用 | — |

### Go Live 当日（承認後 · 30 分枠）

| # | 項目 | 操作 | 目安 |
|---|------|------|------|
| **7** | **Stripe Live 承認確認** | Dashboard 右上が **Live mode** · 決済受付可 | 1分 |
| **8** | **Live Product 作成 ×4** | Basic / Pro / 2D / 3D — metadata 設定（§1.3） | 8分 |
| **9** | **Live Price 作成 ×4** | 各 Product に JPY Price · 金額一致 · Price ID を vault に控える | 5分 |
| **10** | **Live Webhook 登録** | URL 固定 · イベント 3 種（§3.2） | 3分 |
| **11** | **whsec 取得** | endpoint 作成直後の Signing secret を控える | 1分 |
| **12** | **Supabase Secrets 更新** | Live `sk_live_` + Live `whsec_` + Price ×4 + `SITE_URL` **一括** | 3分 |
| **13** | **デプロイ（任意）** | Secrets 反映は自動 · 任意 `supabase functions deploy stripe-webhook` | 2分 |
| **14** | **署名疎通** | 署名なし POST → `400 Missing stripe-signature` | 1分 |
| **15** | **Checkout 起動 smoke** | `stripe-create-genai-checkout` が Live URL を返す | 2分 |
| **16** | **本番課金テスト ¥300** | 実カード · Basic プラン（§3 詳細） | 5分 |
| **17** | **Featured 課金テスト（任意同日）** | ¥980 · 実 UUID listing | 5分 |
| **18** | **公開 GO 判定** | §3 チェックボックス全 PASS | 2分 |

**合計（7〜18）:** 約 **28〜38 分**（Featured 省略時 ~23 分）

---

## 3. スモークテスト手順

### 3.1 対象: GenAI Basic ¥300/月（最初の実売上）

#### Phase A — Checkout 起動（Secrets 更新直後 · 決済前）

| # | 操作 | 期待結果 | 確認方法 |
|---|------|----------|----------|
| A-1 | 本番 `gen-ai-workspace.html` を開く | ページ表示 · console error 0 | ブラウザ DevTools |
| A-2 | 生成AIスタンダード（¥300/月）を選択 → 購入 | Stripe **Live** Hosted Checkout へリダイレクト | URL が `checkout.stripe.com` · Dashboard が Live mode |
| A-3 | （代替）API smoke | `{ ok: true, url: "https://checkout.stripe.com/...", checkout_mode: "subscription" }` | curl / `test-genai-stripe.mjs` を **本番 origin 付き**で実行 |

**失敗時:** Edge Logs `stripe-create-genai-checkout` · Price ID 不一致 · `STRIPE_SECRET_KEY` 未設定

---

#### Phase B — 決済成功（実カード · ¥300）

| # | 操作 | 期待結果 |
|---|------|----------|
| B-1 | Live Checkout でカード情報入力 → 支払い完了 | Stripe 成功画面 |
| B-2 | success URL へリダイレクト | `gen-ai-workspace.html?genai_checkout=success&session_id=cs_live_...` |

**失敗時:** Stripe Dashboard → Payments で decline 理由確認

---

#### Phase C — Webhook 200（confirm 前に確認 · 重要）

| # | 操作 | 期待結果 | 確認方法 |
|---|------|----------|----------|
| C-1 | 決済完了後 **2〜5 秒待ち** · success ページ到達前でも可 | — | タイマー |
| C-2 | Stripe Dashboard → Webhooks → **Live** endpoint → Deliveries | 最新イベント **200 OK** | Dashboard |
| C-3 | Supabase → Edge Functions → `stripe-webhook` → Logs | `[stripe-webhook] signature verification failed` **なし** | Logs |

**失敗時:** whsec 不一致（400）· DB apply 失敗（500 · Stripe 再送）

---

#### Phase D — DB 反映

| # | 確認 SQL / 操作 | 期待結果 |
|---|-----------------|----------|
| D-1 | `SELECT user_id, plan_code, subscription_status, stripe_subscription_id, updated_at FROM gen_ai_subscriptions WHERE user_id = '<テスト user_id>' ORDER BY updated_at DESC LIMIT 1;` | 行あり · `plan_code` = `basic_300` · `subscription_status` = `active` 等 |
| D-2 | `stripe_subscription_id` が `sub_` で始まる | Live subscription ID |

**失敗時:** metadata `user_id` 不一致 · service_role 未設定 · RLS は service_role 経由のため通常ブロックされない

---

#### Phase E — 権限付与（UI + API）

| # | 操作 | 期待結果 |
|---|------|----------|
| E-1 | success URL 到達後 · ワークスペース UI | プラン表示が Basic · 日次上限 30 等に更新 |
| E-2 | `stripe-get-genai-plan`（同一 user_id） | `plan.plan` = `basic_300` · limits 反映 |
| E-3 | 二重確認 | confirm 後も subscription **1 行**（冪等） |

---

#### Phase F — Featured 反映（第 2 売上 · ¥980 · 任意）

| # | 操作 | 期待結果 |
|---|------|----------|
| F-1 | 本番 UUID `listings` 詳細 → 上位掲載（7日）¥980 → Checkout | Live Checkout |
| F-2 | 決済完了 · Webhook 200 | Deliveries 200 |
| F-3 | `SELECT id, is_featured, featured_plan, featured_until, featured_stripe_session_id FROM listings WHERE id = '<uuid>';` | `is_featured = true` · `featured_plan = featured_7days` · `featured_stripe_session_id = cs_live_...` |
| F-4 | 掲載 UI | 上位表示バッジ等 |

**前提:** listing は **Supabase UUID**（デモ slug ID は Checkout 不可）

---

#### Phase G — 失敗時ログの見方

| 症状 | 確認先 | 典型原因 |
|------|--------|----------|
| Checkout URL 生成不可 | Edge Logs `stripe-create-genai-checkout` | Live key 無効 · Price ID 不存在 |
| Webhook 400 | Edge Logs `signature verification failed` | whsec 不一致 · Test/Live 混在 |
| Webhook 500 `genai apply failed` | Edge Logs + Supabase DB エラー | DB 接続 · 制約違反 |
| Webhook 200 だが DB 空 | metadata `user_id` / `genai_plan` 欠落 | Checkout metadata 確認 |
| UI 未更新 · DB のみ更新 | success URL / confirm | Webhook のみ到達 — confirm で UI 同期 |
| Featured 200 skip | Log `missing metadata` | Session metadata 欠落 |

**監視先まとめ:**

1. Stripe Dashboard → Payments（Live）  
2. Stripe Dashboard → Webhooks → Deliveries  
3. Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs  
4. Supabase SQL Editor → §D-1 / F-3  

---

### 3.2 Webhook 登録イベント（再掲）

| イベント | 用途 |
|----------|------|
| `checkout.session.completed` | GenAI 初回付与 · Featured 付与 |
| `customer.subscription.updated` | サブスク状態同期 |
| `customer.subscription.deleted` | 解約同期 |

---

## 4. ロールバック手順

### 4.1 トリガー（いずれかで実施）

- Live Webhook が連続 5xx
- 決済成功だが DB 未反映が複数件
- 誤った Price / 二重課金の疑い
- 本番サイトで Checkout 障害

### 4.2 戻す対象

| 対象 | Test へ戻す値 |
|------|---------------|
| `STRIPE_SECRET_KEY` | `sk_test_...`（バックアップ） |
| `STRIPE_WEBHOOK_SECRET` | Test endpoint `whsec_...` |
| `STRIPE_GENAI_PRICE_*` ×4 | Test `price_...` ×4 |
| `SITE_URL` | ロールバック時は変更不要（本番 URL のままで可） |
| Stripe Live Webhook endpoint | **Disable** または削除 |
| 本番 Checkout 導線 | 一時非公開（告知 · バナー等 · **運用判断**） |

**戻さないもの:** `SUPABASE_SERVICE_ROLE_KEY` · Edge Function コード · 既に付与済み DB 行（手動判断）

### 4.3 手順（順番固定）

| 分 | 作業 |
|----|------|
| 0〜1 | Stripe Dashboard → Live Webhook endpoint → **Disable** |
| 1〜3 | `supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...` + Test Price ID ×4 |
| 3〜4 | 署名なし POST → 400 確認 |
| 4〜5 | `node scripts/test-genai-stripe.mjs` → PASS |
| 5〜7 | 本番サイトで Checkout が Test mode に戻ったことを確認（Checkout 画面に TEST 表示） |
| 7〜10 | 障害記録 · Live 決済で未反映のユーザーがいれば §4.4 |

### 4.4 Live 決済済み・DB 未反映の救済

| 手段 | 条件 |
|------|------|
| `stripe-confirm-genai-checkout` を **1 回** POST（paid `session_id`） | Webhook 未到達 · session は paid |
| service_role で DB 手動修正 | 上記不可時 |
| Stripe Dashboard で返金 | 誤課金時 |

### 4.5 想定時間

| シナリオ | 時間 |
|----------|------|
| Secrets + Webhook Disable のみ | **5〜7 分** |
| + 運用告知 · Checkout 非公開 | **10〜15 分** |
| + 個別ユーザー DB 救済 | **+15〜30 分/件** |

---

## 5. 最初の1円達成手順（運営向け）

> **読み方:** 上から順に実行。チェックボックスを付けながら進める。  
> **ゴール:** Stripe Live で **¥300**（GenAI Basic）が入金され、ユーザーにプランが付与された状態。

---

### 準備（承認前に済ませる）

- [ ] 本番サイト URL を決めた（= `SITE_URL`）
- [ ] Test 用の API 鍵・whsec・Price ID を安全な場所にコピーした（戻す用）
- [ ] テストするユーザー ID を決めた
- [ ] Featured を試す場合、Supabase 上の掲載 UUID を 1 件用意した

---

### 当日（約 30 分）

**① Stripe（10 分）**

1. Dashboard を **Live** にする
2. 商品を 4 つ作る（Basic / Pro / 2D / 3D）— 金額は ¥300・¥980・¥300・¥500
3. それぞれに Price を作り、**Price ID をメモ**
4. Webhook を追加する  
   - URL: `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook`  
   - イベント: 決済完了 · サブスク更新 · サブスク削除
5. 表示された **whsec** をメモ（再表示不可）

**② Supabase（5 分）**

6. Secrets を **まとめて** Live 値に更新する  
   - `STRIPE_SECRET_KEY` = Live の secret key  
   - `STRIPE_WEBHOOK_SECRET` = 手順 ⑤ の whsec  
   - `STRIPE_GENAI_PRICE_*` = 手順 ③ の Price ID ×4  
   - `SITE_URL` = 本番 URL

**③ 疎通（3 分）**

7. Webhook URL に署名なし POST → **400** なら OK
8. 本番 GenAI  workspace を開き、¥300 プラン → **Stripe 決済画面**が開く

**④ 最初の1円（5 分）**

9. **実カード**で ¥300 を支払う
10. 支払直後、Stripe → Webhooks → 最新が **200**
11. Supabase SQL で `gen_ai_subscriptions` にテストユーザー行がある
12. ワークスペースに Basic プランが表示される

**→ ここまでで「最初の1円」達成**

**⑤ 追加確認（任意 · 5 分）**

13. 掲載 UUID で上位掲載 ¥980 を 1 件購入
14. `listings.is_featured = true` を確認

**⑥ 公開判断**

- [ ] Webhook 200
- [ ] DB 反映 OK
- [ ] UI 反映 OK
- [ ] ロールバック手順を関係者に共有済

→ すべて OK なら **一般ユーザー向け課金を公開**

---

### 困ったとき

| 症状 | 最初に見る場所 |
|------|----------------|
| 決済画面が開かない | Supabase Edge Logs · Price ID |
| 決済したのにプラン付かない | Stripe Webhook Deliveries · Edge Logs |
| すぐ戻したい | Webhook Disable → Test Secrets に戻す（§4 · **5 分**） |

---

## 付録 — 30分タイムライン（当日）

| 経過 | 作業 |
|------|------|
| 0:00 | Live 承認確認 · Product/Price 作成開始 |
| 0:10 | Webhook 登録 · whsec 控え |
| 0:13 | Supabase Secrets 一括更新 |
| 0:16 | 署名疎通 · Checkout 起動確認 |
| 0:18 | **¥300 本番決済** |
| 0:23 | Webhook 200 · DB · UI 確認 |
| 0:28 | GO / NO-GO 判定 |
| 0:30 | 本番課金テスト完了 · 公開 or ロールバック |

---

## 付録 — 検証コマンド（変更なし · 読取のみ）

```bash
# Test mode 最終確認（Go Live 前）
node scripts/test-genai-stripe.mjs

# Webhook 署名ガード（Go Live 後）
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/stripe-webhook
# 期待: 400

# Functions 一覧
supabase functions list
```

---

**判定:** Live 承認前の準備（Step 0〜6）が済んでいれば、承認当日は **Secrets 更新 + ¥300 決済 smoke** のみで最初の実売上まで到達可能。コード変更は不要。
