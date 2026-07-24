# Business Directory — 監視 · Smoke · 障害 Runbook（OB4）

**最終更新:** 2026-07-04  
**種別:** OB4 Monitoring · Docs / Runbook（Cursor 整備完了）  
**状態:** **Runbook Ready · Ops Setting 未**（ツール選定 · アラート有効化 · オンコールは人間）  
**関連:** [operational readiness §7–§10](./business-directory-operational-readiness.md) · [launch gate prep OB4](./business-directory-launch-gate-prep.md) · [commercial checklist PR-8 / HG-4](./business-directory-commercial-launch-checklist.md)

**禁止（本ドキュメント範囲）:** 本番 Cloudflare / Supabase / Stripe の設定変更 · DB/Migration · 本番書き込み smoke の無断実行

---

## 0. ステータス

| 項目 | 状態 |
| --- | --- |
| 監視対象の文書化 | ✅ |
| smoke 対象 URL / API の文書化 | ✅ |
| アラート条件案 | ✅（閾値は人間承認待ち） |
| 障害時 Runbook | ✅（草案 → 運用承認待ち） |
| 定期実行手順 | ✅ |
| 監視ツール有効化 | ❌ 人間 |
| アラート通知テスト | ❌ 人間 |
| オンコール担当割当 | ❌ 人間 |

**OB4 完了条件:** 上表の人間項目が ✅ かつテスト通知成功（launch-gate-prep 準拠）。

---

## 1. 監視対象

| # | コンポーネント | 何を見るか | 正常の目安 | 手段 |
| --- | --- | --- | --- | --- |
| M1 | Edge `business-directory` | `POST get_public_listings` が成功 | HTTP 200 · `listings` 配列 | `smoke-business-directory-ob4.mjs` · Dashboard Logs |
| M2 | Edge `stripe-webhook` | 配信成功 · 5xx なし | Failed deliveries = 0（直近） | Stripe Dashboard · Supabase Logs |
| M3 | Pages 静的（Public） | list / detail HTML | HTTP 200 | smoke · curl · Access 方針後は本番 URL |
| M4 | Pages 静的（Owner） | `index.html` / `new.html` / `edit.html` | HTTP 200 | smoke · 8788 |
| M5 | Pages 静的（Admin） | `admin/reviews.html` / `listing.html` | HTTP 200 | smoke · 8788 |
| M6 | Public 一覧データ | published のみ返る | non-published が混入しない | API smoke（読取） |
| M7 | 審査キュー深度 | `review_requested` 件数 | 通常 < 10 · SLA 内 | Admin UI · `get_review_queue` |
| M8 | Stripe 課金反映（Test） | plan_code / subscription_status | checkout 後 plan 反映 | Dashboard · `sync_subscription_status`（障害時） |
| M9 | Supabase DB | 接続 · RLS / 5xx | エラー急増なし | Supabase metrics / logs |
| M10 | Cloudflare Pages deploy | main 最新デプロイ成功 | Failed deploy なし | Wrangler / Dashboard |

**対象外（別 OB）:** Stripe Live（OB2）· Access 方針（OB1）· 法務（OB6）

---

## 2. Smoke 対象

### 2.1 日次（読取中心 · 本番データを汚さない）

```bash
# リポジトリルートで
node scripts/smoke-business-directory-ob4.mjs
```

| # | チェック | 備考 |
| --- | --- | --- |
| 1 | Edge `get_public_listings` | `SUPABASE_URL` + `SUPABASE_ANON_KEY` があるときのみ実行 |
| 2 | `stripe-webhook` ソース存在 | リポジトリ静的確認 |
| 3–6 | Public list/detail · Owner index · Admin reviews | `deploy/cloudflare/dist` または source |
| 7 | BD migration ファイル存在 | 3 本 |
| 8 | BD 主要 JS/CSS 存在 · size > 0 | repository / owner / public / admin |

**本番 URL 向け（OB1 後 · Access 通過可能なとき）:**

```bash
# Edge は env の SUPABASE_* を使用（Pages URL は別途 curl で確認）
node scripts/smoke-business-directory-ob4.mjs --prod
```

`--prod` は **anon 読取 + 静的ファイル確認**のみ。listing の create/approve は行わない。

### 2.2 ローカル UI 回帰（変更後 · 8788）

```bash
npm run build:pages
npm run dev
# 別ターミナル
node scripts/capture-business-directory-commercial-ui-launch-gate.mjs
# または領域別
node scripts/capture-business-directory-owner-new-ui.mjs
node scripts/capture-business-directory-admin-ui.mjs
node scripts/capture-business-directory-public-ui.mjs
```

| URL（8788） | 用途 |
| --- | --- |
| `/business-directory/index.html?bdMock=1` | Owner ダッシュボード |
| `/business-directory/new.html?bdMock=1` | 新規掲載 |
| `/business-directory/admin/reviews.html?bdAdminMock=1` | 審査キュー |
| `/business-directory/admin/listing.html?id=…&bdAdminMock=1` | 掲載詳細 |
| `/business-directory/public/list.html?bdPublicMock=1` | Public 一覧 |
| `/business-directory/public/detail.html?slug=…&bdPublicMock=1` | Public 詳細 |

### 2.3 週次 · コード整合（書き込みなし）

```bash
node scripts/test-business-directory-phase6-stripe.mjs
node scripts/test-business-directory-phase4-admin-ui.mjs
node scripts/test-business-directory-phase5-public-ui.mjs
```

### 2.4 本番 API 横断（書き込みあり · **人間承認後のみ**）

| スクリプト | 用途 | 注意 |
| --- | --- | --- |
| `test-business-directory-production-safe-smoke.mjs` | create → approve → public → **unpublish cleanup** | 既定は preflight · `--execute` 必須 |
| `test-business-directory-production-step4-production.mjs --smoke` | 広い Production smoke | **cleanup なし · 実行禁止（現行方針）** |

```bash
# 事前チェックのみ（推奨）
node scripts/test-business-directory-production-safe-smoke.mjs

# 人間承認後のみ
node scripts/test-business-directory-production-safe-smoke.mjs --execute
```

**必要 env（値はログに出さない）:** `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `AUTH_HOOK_L2_ALLOWLIST_PASSWORD`

---

## 3. アラート条件案（人間承認待ち）

| ID | 条件 | 深刻度 | 初動 |
| --- | --- | --- | --- |
| A1 | Edge `business-directory` 連続 3 回失敗（5xx / timeout） | **S1** | Edge logs · status.supabase.com · 必要なら rollback 検討 |
| A2 | Stripe webhook **連続 3 回** Failed delivery | **S1** | Stripe Dashboard 再送 · signing secret · Edge logs |
| A3 | `checkout.session.completed` 未処理で plan 未反映（Owner 申告 or 監視） | **S1** | `sync_subscription_status` · audit_logs |
| A4 | Pages BD 静的パス HTTP ≠ 200（本番 URL · OB1 後） | **S2** | Deployments · Access 誤設定確認 |
| A5 | 審査キュー未処理 **> 10 件** | **S3** | Ops 通知 · 審査担当 |
| A6 | 最古 `review_requested` が **24h 超** | **S3** | SLA · エスカレーション（OB3 SLA 確定後に閾値調整） |
| A7 | `invoice.payment_failed` 連続 | **S2** | Owner 連絡 · Portal · Stripe |
| A8 | OB4 日次 smoke FAIL（CI or 手動） | **S2** | ログ保全 · 再現 · 担当割当 |

**SLO 案（承認待ち）:**

| 指標 | 目標 |
| --- | --- |
| Public Edge 可用性 | 月間 99.5%（読取） |
| Webhook 処理遅延 | p95 < 5 分（Test） |
| 審査初動 | 24h 以内（OB3 で確定） |

---

## 4. 障害時 Runbook（要点）

### 4.1 初動フロー

```text
1. 検知（smoke FAIL / アラート / ユーザー申告）
2. 影響切り分け
   - Public 表示のみ → M3/M6
   - Owner 申請のみ → M4 / Edge auth
   - Admin 審査のみ → M5/M7
   - 課金・plan → M2/M8
3. 証拠保全
   - smoke 出力 · report.json
   - Supabase Edge logs（時刻範囲）
   - Stripe webhook events（該当 session id）
4. 一次対応（下記）
5. 30 分で改善なし → エスカレーション（Dev + Ops）
6. 復旧後: smoke 再実行 · audit_logs 確認 · 本 Runbook に記録
```

### 4.2 シナリオ別一次対応

| 症状 | 一次対応 | エスカレーション |
| --- | --- | --- |
| Public 一覧/詳細 5xx | Edge logs · `get_public_listings` 手動 · Supabase status | Edge 再デプロイ（承認後） |
| Public 200 だが空/古い | CDN/キャッシュ · deploy 時刻 · DB status 分布 | Pages Promote 前版 |
| Owner 保存/申請失敗 | ブラウザ console · Edge action 名 · JWT | Auth allowlist · RLS |
| Admin キュー空なのに申請あり | `get_review_queue` · listing status | DB 整合（読取のみ） |
| Webhook 失敗 | Stripe Failed · signing secret · 再送 | secrets ローテ（人間） |
| plan 未反映 | Owner `sync_subscription_status` · audit_logs | Stripe event 手動突合 |
| 審査滞留 | キュー深度 · SLA | Ops リード（OB3） |

### 4.3 Severity（operational readiness §10 と整合）

| Sev | 例 | 連絡 |
| --- | --- | --- |
| **S1** | Edge 全停止 · Webhook 全滅 · 課金反映不可 | 即時 Dev + Ops |
| **S2** | Public 部分障害 · smoke 連続 FAIL | 4h 以内 |
| **S3** | Admin UI のみ · キュー滞留 | 翌営業日 |
| **S4** | 表示崩れ · コピー | 計画対応 |

### 4.4 Rollback 参照

- Pages: [operational readiness §9.1](./business-directory-operational-readiness.md)
- Edge: §9.2
- DB: additive 原則 · DROP 禁止（§9.3）
- Stripe Live: **OB2 前は対象外**（§9.4 / §11.2）

---

## 5. 定期実行手順

| 頻度 | 作業 | 担当案 | 成果物 |
| --- | --- | --- | --- |
| **日次** | `node scripts/smoke-business-directory-ob4.mjs` | Ops / Dev 当番 | コンソール PASS · 失敗時 issue |
| **週次** | Phase 6 + Phase 4/5 静的 · UI capture（8788） | Dev | reports / CI ログ |
| **週次（人間）** | Stripe Dashboard webhook Failed 目視（Test） | Ops | ST-5 チェック |
| **週次（人間）** | Admin キュー深度目視 | Ops | A5/A6 |
| **変更後** | UI launch-gate capture · `build:pages` | Dev | reports/*-ui/ |
| **承認後のみ** | safe-smoke `--execute` | Dev + 承認者 | `reports/business-directory-production-safe-smoke/report.json` |

### 5.1 日次チェックリスト（コピペ用）

- [ ] `smoke-business-directory-ob4.mjs` exit 0
- [ ] FAIL 時: ログ保存 · A8 として起票
- [ ] （任意）Supabase Edge `business-directory` Logs に新規 5xx がないか

### 5.2 CI スケジュール化（人間作業）

GitHub Actions / 外部 cron で日次 smoke を回す場合:

- secrets: `SUPABASE_URL` · `SUPABASE_ANON_KEY` のみ（**service role は日次に不要**）
- `--execute` / step4 production smoke は **CI に載せない**
- FAIL 時: Slack / メール通知（ツール選定は人間）

---

## 6. ログ · ダッシュボード入口（設定変更なし · 確認手順のみ）

| 場所 | 見方 |
| --- | --- |
| Supabase → Edge Functions → `business-directory` → Logs | `error` / `500` |
| Supabase → Edge Functions → `stripe-webhook` → Logs | 同上 |
| Stripe → Developers → Webhooks → endpoint | Failed deliveries |
| Cloudflare Pages → Deployments | main 失敗デプロイ |
| Admin `reviews.html` | キュー深度 |

---

## 7. 残る人間作業（OB4 完了まで）

| # | 作業 | 担当案 |
| --- | --- | --- |
| H1 | 監視ツール選定（Supabase Logs 通知 / Cloudflare / 外部） | インフラ + Ops |
| H2 | アラート閾値の最終決定（§3） | Ops + PO |
| H3 | 通知チャネル（Slack / メール）とテスト通知 | Ops |
| H4 | オンコール当番表 | Ops |
| H5 | 日次 smoke の CI / cron 有効化 | DevOps |
| H6 | OB1 後: 本番 URL 向け smoke を日次に追加 | インフラ |

---

## 8. 参照スクリプト一覧

| スクリプト | 書き込み | 用途 |
| --- | --- | --- |
| `scripts/smoke-business-directory-ob4.mjs` | なし（読取） | 日次死活 |
| `scripts/capture-business-directory-ob4-smoke.mjs` | なし | ブラウザ静的 |
| `scripts/capture-business-directory-*-ui.mjs` | なし（Mock） | UI 回帰 |
| `scripts/test-business-directory-production-safe-smoke.mjs` | **あり**（cleanup 付き） | 承認後のみ |
| `scripts/test-business-directory-production-step4-production.mjs` | **あり**（cleanup なし） | **現行方針では実行禁止** |
| `scripts/test-business-directory-phase6-stripe.mjs` | なし | コード整合 |

---

*OB4 Runbook 整備 2026-07-04 · Cursor。運用設定・通知有効化は人間作業。*
