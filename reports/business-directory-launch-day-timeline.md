# Business Directory — Launch Day Timeline

**作成日:** 2026-07-04  
**状態:** 計画（ドキュメントのみ · 実装/commit/deploy 禁止）  
**想定公開日:** [TBD]  
**主要担当:** [TBD: 運営 · Dev · Ops]  
**参照:** [Commercial Launch Checklist](./business-directory-commercial-launch-checklist-update-2026-07-04.md) · [OB4 Smoke Plan](./business-directory-ob4-minimum-p0-plan.md) · [オンコール Runbook](../docs/runbooks/business-directory-oncall.md)

---

## 0. 事前準備

- [ ] 本 Runbook を全担当者が事前に一読
- [ ] Launch Day の全参加者の連絡先を確認（[オンコール Runbook](../docs/runbooks/business-directory-oncall.md) §1–2 参照）
- [ ] オンライン常駐チャンネル（[TBD: チャットツール · チャンネル名]）を開設
- [ ] Cloudflare Zero Trust Dashboard · Stripe Dashboard · Supabase Dashboard にログイン可能な端末を準備
- [ ] 8788 ローカル検証環境を事前に起動確認（`npm run dev` · `netstat -ano | findstr 8788`）
- [ ] OB1 Access / robots 変更内容を事前に文書化しレビュー済
- [ ] ロールバック手順を全担当者が理解（本ドキュメント §6）

---

## 1. 公開前チェック（T-60 〜 T-10）

### T-60: 環境確認（15 分）

| # | チェック項目 | コマンド / 確認方法 | 担当 |
|---|-------------|-------------------|------|
| 1 | `git status` clean | `git status --short`（BD 関連の意図しない差分がないこと） | Dev |
| 2 | Production Branch 確認 | `git branch --show-current` → `cf-pages-deploy` | Dev |
| 3 | 最新 commit 確認 | `git log -1 --oneline`（OB4/OB5 の commit が含まれていること） | Dev |
| 4 | Production DB 接続確認 | `npx supabase link --project-ref ddojquacsyqesrjhcvmn --yes` | Dev |
| 5 | DB テーブル存在確認 | `npx supabase db query --linked -f .tmp-bd-check-tables.sql`（全 13 テーブル） | Dev |
| 6 | Migration history 確認 | `npx supabase migration list --linked`（BD 7 件すべて Remote 表示） | Dev |
| 7 | Edge Functions 確認 | `npx supabase functions list --project-ref ddojquacsyqesrjhcvmn` → `business-directory` + `stripe-webhook` が ACTIVE | Dev |
| 8 | Stripe Dashboard ログイン | Stripe Dashboard → Test mode / Live mode 両方にアクセス可能 | Ops |
| 9 | Stripe Live keys 最終確認 | Stripe Dashboard → Developers → API keys → Live secret key が手元にあること | Ops |
| 10 | Cloudflare Pages 状態確認 | Cloudflare Dashboard → Pages → `tasufull-article` → 最新 deploy が正常 | Dev |
| 11 | Cloudflare Zero Trust ログイン | Zero Trust Dashboard にアクセス可能 · Access ポリシー変更権限確認 | Ops |

### T-45: 変更内容最終確認（15 分）

| # | チェック項目 | 確認方法 | 担当 |
|---|-------------|---------|------|
| 1 | OB1: Access 解除対象パスリスト確認 | BD Public パス（`/business-directory/public/*`）のみ解除することを確認 | Ops |
| 2 | OB1: robots.txt 変更差分確認 | `git diff deploy/cloudflare/robots.txt`（`Disallow: /` → BD Public 許可） | Dev |
| 3 | OB1: `_headers` 変更差分確認 | `git diff deploy/cloudflare/_headers`（`/*` `noindex` → BD Public 除外） | Dev |
| 4 | OB1: build script 変更差分確認 | `git diff deploy/cloudflare/stage-cloudflare-pages.mjs`（meta robots 注入除外ロジック追加） | Dev |
| 5 | OB6: 法務文案 反映確認 | BD 公開ページに規約・特商法・プライバシーがリンクされていること | Ops |
| 6 | OB7: サポート窓口 確認 | Owner 向け問い合わせ先が公開ページに表示されていること | Ops |
| 7 | Stripe Live Price ID 確認 | `BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD` / `PRO` が Live Price ID に差し替え済 | Dev |
| 8 | Stripe Live Webhook endpoint 確認 | Stripe Dashboard → Webhooks → `stripe-webhook` endpoint が Live mode で ACTIVE | Ops |

### T-30: OB4 Smoke 事前実行（10 分）

| # | チェック項目 | コマンド | 期待結果 |
|---|-------------|---------|---------|
| 1 | 8788 統合 smoke | `npm run smoke:business-directory` | 7/8 PASS · 1 SKIP |
| 2 | 8788 browser smoke | `node scripts/capture-business-directory-ob4-smoke.mjs` | 8/8 PASS · Console Error 0 |
| 3 | `npm run build:pages` 予行 | `npm run build:pages`（EPERM 時は dev 停止→build→再開） | exit 0 |

### T-20: 最終 Go 判断（10 分）

| # | チェック項目 | 判断者 |
|---|-------------|--------|
| 1 | §1（T-60/45/30）全チェックが PASS | Dev Lead |
| 2 | OB1–OB8 のうち未解決 blocker がゼロ（OB2 Stripe Live は本日実施予定） | 運営 |
| 3 | 全担当者がオンライン · 連絡手段確保 | 運営 |
| 4 | ロールバック判断基準を全員が理解（§6） | Dev Lead |
| 5 | **Launch Go 宣言**（§7） | 運営 |

### T-10: 最終準備（5 分）

- [ ] 本 Runbook の手順を印刷 or 別画面で常時表示
- [ ] Stripe Dashboard を別タブで開く（Live mode）
- [ ] Cloudflare Zero Trust Dashboard を別タブで開く
- [ ] Supabase Dashboard を別タブで開く
- [ ] ターミナル: `git status` clean · `cf-pages-deploy` branch · Production ref link 済 を再確認
- [ ] ターミナル: `npm run smoke:business-directory` 最終実行 · 7/8 PASS · 1 SKIP
- [ ] 全タブ・ログインが有効な状態で **T=0 を待機**

---

## 2. 公開開始（T=0）

### T+00:00 Stripe Live 切替

```
担当: Ops
時間: 2 分
```

| # | 操作 | 確認 |
|---|------|------|
| 1 | Stripe Dashboard → Developers → API keys → Live secret key をコピー | key が `sk_live_` で始まること |
| 2 | Supabase Dashboard → Project `ddojquacsyqesrjhcvmn` → Settings → Edge Functions → Secrets | `STRIPE_SECRET_KEY` を Live key に差し替え |
| 3 | `STRIPE_WEBHOOK_SIGNING_SECRET` を Live webhook secret に差し替え | Stripe Dashboard → Webhooks → Live endpoint の signing secret |
| 4 | `BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD` を Live Price ID に更新 | `price_live_...` |
| 5 | `BUSINESS_DIRECTORY_STRIPE_PRICE_PRO` を Live Price ID に更新 | `price_live_...` |
| 6 | Edge `stripe-webhook` が Live に切り替わったことを確認 | Dashboard → Edge Functions → Last deploy time |

**判定:** 全 6 項目 OK → T+02:00 に Cloudflare Access 解除へ

### T+02:00 Cloudflare Access 解除（Public のみ）

```
担当: Ops
時間: 3 分
```

| # | 操作 | 確認 |
|---|------|------|
| 1 | Cloudflare Zero Trust → Access → Applications → `tasufull-article.pages.dev` | 現在のポリシーを確認 |
| 2 | **BD Public パスのみ** Access ポリシーから除外: `/business-directory/public/*` | ポリシーに `exclude` ルール追加 |
| 3 | または **サイト全体の Access を解除**（案 B の場合） | Zero Trust 全解除はセキュリティレビュー必須 |
| 4 | 未認証ブラウザ（シークレットウィンドウ）で `https://tasufull-article.pages.dev/business-directory/public/list.html` にアクセス | Cloudflare Access ログイン画面が表示されないことを確認 |
| 5 | BD Admin（`/business-directory/admin/*`）は Access 保護継続 | Admin パスは引き続き Access ログイン必須 |

**判定:** Public list/detail が Access なしで 200 OK → T+05:00 に robots 公開へ

### T+05:00 robots.txt 公開

```
担当: Dev
時間: 2 分
```

| # | 操作 | 確認 |
|---|------|------|
| 1 | `deploy/cloudflare/robots.txt` を編集（BD Public パスを Allow、管理画面は Disallow 継続） | `git diff` で確認 |
| 2 | 変更内容: `Disallow: /` 行を削除または修正 | BD Public パスが Allow になっていること |
| 3 | 例: `Allow: /business-directory/public/` `Disallow: /business-directory/admin/` | |

### T+07:00 _headers 更新

```
担当: Dev
時間: 2 分
```

| # | 操作 | 確認 |
|---|------|------|
| 1 | `deploy/cloudflare/_headers` を編集 | `/*` ブロックの `X-Robots-Tag: noindex` を削除 |
| 2 | または BD Public パスに個別の `X-Robots-Tag: index, follow` ヘッダを追加 | BD Public パスのみインデックス許可 |
| 3 | `_headers` の例: `/business-directory/public/*` → `X-Robots-Tag: index, follow` | |

### T+09:00 meta noindex 解除

```
担当: Dev
時間: 2 分
```

| # | 操作 | 確認 |
|---|------|------|
| 1 | `deploy/cloudflare/stage-cloudflare-pages.mjs` を編集 | `applySearchBlockingToDist()` の注入ロジックを修正 |
| 2 | BD Public パス（`/business-directory/public/*`）には `<meta robots>` を注入しない | `shouldSkipSearchBlocking()` 等の関数追加 |
| 3 | 変更後 `git diff` で差分を確認 | |

### T+11:00 Production Deploy

```
担当: Dev
時間: 5 分
```

| # | 操作 | コマンド / 確認 |
|---|------|----------------|
| 1 | `npm run build:pages` 実行 | exit 0 · dist 生成確認 |
| 2 | `git status --short` で dist 差分を確認 | BD 関連ファイルのみ変更されていること |
| 3 | `git add`（選別）· `git commit` | commit message: `release(business-directory): launch day — Access · robots · indexing` |
| 4 | `git push origin cf-pages-deploy` | push 成功 |
| 5 | Cloudflare Pages → `tasufull-article` → Deployments | 新しい deploy が `Active` になるまで待機（通常 1–3 分） |
| 6 | Production URL にアクセス可能か確認 | `curl -I https://tasufull-article.pages.dev/business-directory/public/list.html` → 200 |

**判定:** deploy 成功 · Production URL 200 · T+16:00 に smoke へ

---

## 3. Deploy 直後（T+16 〜 T+30）

### 3.1 Production URL 確認

| # | チェック | コマンド | 期待結果 |
|---|---------|---------|---------|
| 1 | Public list HTTP 200 | `curl -I https://tasufull-article.pages.dev/business-directory/public/list.html` | 200 |
| 2 | Public detail HTTP 200 | `curl -I https://tasufull-article.pages.dev/business-directory/public/detail.html?slug=tanaka-shop&type=shop_retail` | 200 |
| 3 | Owner dashboard HTTP 200 | `curl -I https://tasufull-article.pages.dev/business-directory/index.html` | 200 |
| 4 | Admin reviews は Access 保護 | シークレットウィンドウでアクセス → Cloudflare Access ログイン画面 | Access ログイン HTML |
| 5 | `robots.txt` 確認 | `curl https://tasufull-article.pages.dev/robots.txt` | BD Public が Disallow されていないこと |
| 6 | `X-Robots-Tag` 確認 | `curl -I https://tasufull-article.pages.dev/business-directory/public/list.html` | `noindex` が含まれていないこと |

### 3.2 OB4 Production Smoke（統合 smoke）

| # | チェック | コマンド | 期待結果 |
|---|---------|---------|---------|
| 1 | 統合 smoke 本番 | `npm run smoke:business-directory:prod`（`SUPABASE_URL` + `SUPABASE_ANON_KEY` 必須） | 8/8 PASS |
| 2 | Edge business-directory health | smoke 内で自動実行 | 200 + listings 配列 |
| 3 | Edge stripe-webhook | smoke 内で自動実行 | source exists |
| 4 | 静的 HTML 4 画面 | smoke 内で自動実行 | 全 dist 存在 |

### 3.3 OB4 Browser Smoke（本番 URL）

| # | チェック | コマンド | 期待結果 |
|---|---------|---------|---------|
| 1 | 本番 browser smoke | `node scripts/capture-business-directory-ob4-smoke.mjs --prod` | 8/8 PASS |
| 2 | Public list HTTP + 表示 | 自動 | 200 · body rendered |
| 3 | Public detail HTTP + 表示 | 自動 | 200 · body rendered |
| 4 | Console Error: public list | 自動 | 0 errors |
| 5 | Console Error: public detail | 自動 | 0 errors |
| 6 | Owner dashboard HTTP | 自動 | 200 |
| 7 | Admin reviews HTTP | 自動 | 200 |
| 8 | Network 4xx/5xx | 手動（または smoke 拡張後自動） | 0 errors |

### 3.4 Stripe Live 確認

| # | チェック | 確認方法 | 期待結果 |
|---|---------|---------|---------|
| 1 | Stripe Dashboard → Webhooks → Live endpoint | イベント一覧 | `checkout.session.completed` 等が Live mode で受信可能 |
| 2 | 小額実課金テスト（テスト用 Owner アカウントで Standard 購読） | ブラウザで Checkout → 4242 ではなく Live カード番号 | checkout 成功 → plan=standard 反映 |
| 3 | Stripe Dashboard → Payments | 決済が 1 件成功 | status: succeeded |
| 4 | Supabase `business_directory_listings` → `subscription_status` | `select subscription_status from business_directory_listings where id='...'` | `active` |
| 5 | 返金テスト | Stripe Dashboard → 該当決済 → Refund | 返金成功 · webhook で status 更新 |

### 3.5 Public 閲覧確認

| # | チェック | 確認方法 | 期待結果 |
|---|---------|---------|---------|
| 1 | シークレットウィンドウで Public list を開く | ブラウザ（未ログイン）でアクセス | 一覧が表示されること |
| 2 | シークレットウィンドウで Public detail を開く | 同上 | 詳細が表示されること |
| 3 | シークレットウィンドウで検索 | 同上 | 検索結果が表示されること |
| 4 | Google 検索でサイトが表示されるか（即時ではない） | `site:tasufull-article.pages.dev` | 後日確認（インデックスには数日かかる） |

### T+30: Deploy 直後 判定

**全チェック PASS で §4 へ。1 件でも FAIL したら §6 ロールバック判断。**

---

## 4. 公開後 30 分（T+30 〜 T+60）

### 4.1 Listing / Detail

| # | チェック | 確認方法 | 期待結果 |
|---|---------|---------|---------|
| 1 | Public list に全 published listing が表示 | ブラウザ | 件数一致 |
| 2 | Public detail で全フィールド表示 | ブラウザ | 店舗名 · 説明 · 写真 · 営業時間 · SNS |
| 3 | プラン別の表示差異（Free vs Standard vs Pro） | ブラウザ | planGate が正しく動作 |
| 4 | rich フィールド（faq_items · recommended_uses）表示 | ブラウザ | Standard/Pro listing で表示 |

### 4.2 Owner ログイン

| # | チェック | 確認方法 | 期待結果 |
|---|---------|---------|---------|
| 1 | Owner アカウントでログイン | ブラウザ（通常ウィンドウ） | ログイン成功 |
| 2 | Owner dashboard 表示 | `/business-directory/index.html` | 自分の Listing 一覧表示 |
| 3 | 新規掲載フォーム | `/business-directory/new.html` | フォーム表示 |
| 4 | 編集フォーム | `/business-directory/edit.html?id=...` | 既存データ表示 |
| 5 | 下書き保存（draft） | new.html → 入力 → 下書き保存 | 保存成功 |
| 6 | 公開申請（Standard 選択時 → Stripe Checkout） | 実課金テスト | Checkout 表示 → Live 決済 |

### 4.3 Admin 確認

| # | チェック | 確認方法 | 期待結果 |
|---|---------|---------|---------|
| 1 | Admin アカウントでログイン（Access 認証 + JWT） | Cloudflare Access → TASFUL ログイン | Admin reviews 表示 |
| 2 | 審査キュー表示 | `/business-directory/admin/reviews.html` | pending 一覧 |
| 3 | 承認操作 | approve → ステータス変更 | published に遷移 |
| 4 | 差戻し操作 | reject → 理由入力 | rejected に遷移 |
| 5 | リスティング詳細 | `/business-directory/admin/listing.html?id=...` | 読み取り専用表示 |

### 4.4 AI Draft

| # | チェック | 確認方法 | 期待結果 |
|---|---------|---------|---------|
| 1 | Owner new 画面で AI Draft 利用 | `/business-directory/new.html` → AI Draft ボタン | 下書き生成 |
| 2 | クォータ消費確認 | `select * from business_directory_ai_draft_usage_daily` | used_count 増加 |

### 4.5 他サービス導線

| # | チェック | 確認方法 | 期待結果 |
|---|---------|---------|---------|
| 1 | マーケット TOP（`index-top.html`）に BD 入口表示 | ブラウザ | BD リンククリック可能 |
| 2 | Talk 導線（問い合わせ → Talk ルーム） | BD detail → 問い合わせボタン | Talk ルーム作成 |
| 3 | 550 円導線（求人案件 経由） | Platform → 求人 → 応募 → fee-pay | Talk 導線が有効（BD 非依存だが副作用チェック） |

### T+60: 公開後 30 分 判定

**全チェック PASS で §5 へ。1 件でも FAIL したら §6 ロールバック判断。**

---

## 5. 公開後 24 時間（T+60 〜 T+24h）

### 監視項目（随時）

| # | 項目 | 手段 | 閾値 | 担当 |
|---|------|------|------|------|
| 1 | OB4 統合 smoke | `npm run smoke:business-directory:prod`（1 時間ごと） | 8/8 PASS 継続 | Dev/Ops |
| 2 | Cloudflare Pages Analytics | Dashboard → `tasufull-article` → Analytics | PV 急減なし | Ops |
| 3 | Stripe Dashboard webhook 失敗 | Dashboard → Webhooks → Events | 失敗 0 件 | Ops |
| 4 | Stripe 決済成功 / 失敗 | Dashboard → Payments | 失敗率 5% 未満 | Ops |
| 5 | Supabase DB 接続 | Dashboard → Database → Health | 正常 | Dev |
| 6 | Supabase Edge Functions status | Dashboard → Edge Functions | All ACTIVE | Dev |
| 7 | Browser Console Error | Playwright MCP または `capture-business-directory-ob4-smoke.mjs --prod` | 0 errors | Dev |
| 8 | Network 4xx/5xx | Cloudflare Analytics | 5xx 0 件 | Ops |
| 9 | 問い合わせ件数 | サポート窓口 | 急増なし | Ops |
| 10 | 審査キュー滞留 | Admin reviews 画面 | pending 20 件未満 | Ops |

### 定期確認（タイムライン）

| 時刻 | 項目 | 担当 |
|------|------|------|
| **T+1h** | 全 smoke 再実行 · Stripe 確認 | Dev |
| **T+2h** | 全 smoke 再実行 | Dev |
| **T+3h** | 全 smoke 再実行 · 問い合わせ確認 | Dev + Ops |
| **T+6h** | 全 smoke 再実行 · Analytics 確認 | Ops |
| **T+12h** | 全 smoke 再実行 · DB 確認 · 審査キュー確認 | Dev + Ops |
| **T+18h** | 全 smoke 再実行 · Stripe 確認 | Dev |
| **T+24h** | **最終判断** — 全 smoke PASS · 全ダッシュボード異常なし → Launch 成功宣言 | 運営 |

---

## 6. ロールバック条件

以下のいずれかに該当した場合、**即時ロールバック** を検討する。

### ロールバックの判断基準

| 深刻度 | 条件 | 対応 |
|--------|------|------|
| **🔴 Critical** | ただちにロールバック | |
| | Public list/detail が HTTP 200 を返さない | |
| | Stripe Live 決済が 100% 失敗（1 件も成功しない） | |
| | Supabase DB ダウン · Edge 全停止 | |
| | 本番 URL で HTTP 500 が継続 | |
| | 課金不整合（checkout 成功なのに subscription_status が active にならない） | |
| **🟡 Warning** | 15 分以内に復旧できなければロールバック | |
| | Console Error が 10 件/分 以上継続 | |
| | Stripe webhook 失敗が 10 件/時 以上継続 | |
| | Public list に listing が 0 件表示（DB には存在するが表示されない） | |
| **🟢 Minor** | ロールバック不要 · 監視継続 | |
| | 表示崩れ（viewport 390/768） | |
| | Console Warning（error ではない） | |
| | 審査キュー滞留 20 件未満 | |
| | 問い合わせ通常範囲内 | |

### ロールバック手順

#### 6.1 Pages ロールバック（最優先）

```
1. Cloudflare Pages → Deployments
2. 直前の known-good deploy を選択 → "Promote to Production"
3. 本番 URL で smoke 再実行
4. 復旧確認
```

#### 6.2 Access 再保護

```
1. Cloudflare Zero Trust → Access → Applications
2. 解除した BD Public パスを再び Access 保護
3. シークレットウィンドウで Access ログイン画面が表示されることを確認
```

#### 6.3 Stripe Test mode 復帰

```
1. Supabase Dashboard → Edge Functions → Secrets
2. STRIPE_SECRET_KEY を Test key に戻す
3. BUSINESS_DIRECTORY_STRIPE_PRICE_* を Test Price ID に戻す
4. 復旧確認（Test mode checkout 4242 で成功）
```

#### 6.4 robots 再ブロック

```
1. robots.txt を Disallow: / に戻す
2. _headers を noindex に戻す
3. build script の meta robots 注入を元に戻す
4. npm run build:pages → deploy
```

### ロールバック後の事後対応

1. インシデント記録（[オンコール Runbook](../docs/runbooks/business-directory-oncall.md) §5）
2. `business_directory_audit_logs` 保全
3. 関係者への報告（Slack / メール）
4. 原因特定 → 修正 → 再 Launch 計画

---

## 7. Go / No-Go 判定

### 7.1 事前 Go 条件（T-20）

| # | 条件 | 判定 |
|---|------|------|
| G1 | git status clean · `cf-pages-deploy` branch | ☐ |
| G2 | Production DB 全テーブル · migration history 整合 | ☐ |
| G3 | Edge Functions ACTIVE | ☐ |
| G4 | OB1 Access / robots 変更内容がレビュー済 | ☐ |
| G5 | OB6 法務文案 公開済 | ☐ |
| G6 | OB7 サポート窓口 開設済 | ☐ |
| G7 | OB4 smoke 事前実行 全 PASS | ☐ |
| G8 | 全担当者オンライン · 連絡手段確保 | ☐ |
| G9 | ロールバック手順を全員が理解 | ☐ |

**全 G1–G9 が ☑ で Launch Go。**

### 7.2 Deploy 直後 Go 条件（T+30）

| # | 条件 | 判定 |
|---|------|------|
| D1 | Production URL 6 項目 全確認 OK（§3.1） | ☐ |
| D2 | OB4 統合 smoke 本番 8/8 PASS | ☐ |
| D3 | OB4 browser smoke 本番 8/8 PASS · Console Error 0 | ☐ |
| D4 | Stripe Live checkout 1 件成功 | ☐ |
| D5 | Public 閲覧確認（未ログインで list/detail 表示） | ☐ |
| D6 | Access 保護範囲が正しい（Public 開放 · Admin 保護） | ☐ |
| D7 | robots.txt / _headers / meta noindex が解除済 | ☐ |

**全 D1–D7 が ☑ で公開継続。1 件でも ☐ なら §6 ロールバック判断。**

### 7.3 公開後 30 分 Go 条件（T+60）

| # | 条件 | 判定 |
|---|------|------|
| P1 | Listing / Detail 全表示（§4.1） | ☐ |
| P2 | Owner ログイン · 新規掲載（§4.2） | ☐ |
| P3 | Admin 審査操作（§4.3） | ☐ |
| P4 | AI Draft 動作（§4.4） | ☐ |
| P5 | 他サービス導線（§4.5） | ☐ |

**全 P1–P5 が ☑ で公開継続。1 件でも ☐ なら §6 ロールバック判断。**

### 7.4 No-Go 条件（即時公開停止）

| # | 条件 |
|---|------|
| N1 | Public list/detail が HTTP 200 を返さない |
| N2 | Stripe Live 決済が 100% 失敗 |
| N3 | Supabase DB ダウン · Edge 全停止 |
| N4 | 本番 URL で HTTP 500 が継続（5 分以上） |
| N5 | 課金不整合が 1 件でも発生 |
| N6 | Console Error が 50 件/分 以上継続（10 分以上） |
| N7 | Cloudflare Pages deploy が 3 回連続で失敗 |

**N1–N7 のいずれかが発生 → 即時ロールバック（§6.1）→ 関係者報告。**

---

## 付録 A: コマンド早見表

```bash
# 事前確認
git status --short
git log -1 --oneline
npx supabase link --project-ref ddojquacsyqesrjhcvmn --yes
npx supabase migration list --linked

# OB4 統合 smoke
npm run smoke:business-directory            # 8788 ローカル
npm run smoke:business-directory:prod       # 本番（env 必須）

# OB4 browser smoke
node scripts/capture-business-directory-ob4-smoke.mjs                  # 8788
node scripts/capture-business-directory-ob4-smoke.mjs --prod            # 本番（env から URL 取得）
node scripts/capture-business-directory-ob4-smoke.mjs --url https://... # 明示的 URL

# build + deploy
npm run build:pages
git push origin cf-pages-deploy

# Production URL 確認
curl -I https://tasufull-article.pages.dev/business-directory/public/list.html
curl -I https://tasufull-article.pages.dev/robots.txt
```

## 付録 B: 緊急連絡先（仮）

参照: [オンコール Runbook](../docs/runbooks/business-directory-oncall.md) §1–2

| 役割 | 連絡先（仮） |
|------|-------------|
| Dev Lead | [TBD] |
| Ops Lead | [TBD] |
| プロダクトオーナー | [TBD] |
| Stripe 緊急 | Stripe Dashboard → Support（24h · 英語） |
| Supabase 緊急 | Supabase Dashboard → Support（Pro Plan） |
| Cloudflare 緊急 | Cloudflare Dashboard → Support |

---

*Business Directory Launch Day Timeline — 2026-07-04 作成。公開日確定後、[TBD] を実日時・実名に差し替え。*