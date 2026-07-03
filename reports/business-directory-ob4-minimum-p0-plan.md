# Business Directory — OB4 P0 最小実装案

**作成日:** 2026-07-04  
**状態:** 計画（実装前 · コード修正/commit/deploy 禁止）  
**前提:** [operational-readiness](./business-directory-operational-readiness.md) · [launch-gate-prep](./business-directory-launch-gate-prep.md) · [OB4 調査レポート](../reports/business-directory-ob4-investigation.md)（別途）  
**対象:** Commercial Launch 前最低限必要な監視・Smoke・Runbook

---

## P0 対象一覧（6 件）

| ID | 項目 | 種別 |
|----|------|------|
| OB4-P0-01 | Edge `business-directory` 死活確認 | 監視 |
| OB4-P0-02 | Edge `stripe-webhook` 死活確認 | 監視 |
| OB4-P0-04 | 統合 Smoke 1 コマンド化 | Smoke |
| OB4-P0-05/09 | 本番 URL Smoke 手順 | Smoke |
| OB4-P0-08 | Playwright MCP による Public list/detail + Console Error 0 確認 | 自動化 |
| OB4-P0-06 | オンコール・問い合わせ先 仮 Runbook | Runbook |

**対象外（P1 へ回す）:** OB4-P0-03（Stripe webhook 失敗アラート）· OB4-P0-07（Stripe Live Runbook）

---

## 1. 作成 / 変更するファイル（全 5 ファイル）

### 1.1 新規作成（3 ファイル）

| # | ファイル | 内容 |
|---|---------|------|
| 1 | `scripts/smoke-business-directory-ob4.mjs` | BD 統合 smoke スクリプト（P0-01/02/04） |
| 2 | `scripts/capture-business-directory-ob4-smoke.mjs` | Playwright MCP 代替 — 本番 URL 用 browser smoke（P0-05/09） |
| 3 | `docs/runbooks/business-directory-oncall.md` | オンコール・問い合わせ先 仮 Runbook（P0-06） |

### 1.2 変更（2 ファイル）

| # | ファイル | 変更内容 |
|---|---------|---------|
| 4 | `package.json` | `smoke:business-directory` と `smoke:business-directory:prod` を追加（2 行） |
| 5 | `docs/TODO.md` | OB4 P0 status 更新 · P1 deferred 明記 |

---

## 2. 追加する npm script（2 行）

`package.json` の `"scripts"` に以下を追加:

```json
"smoke:business-directory": "node scripts/smoke-business-directory-ob4.mjs",
"smoke:business-directory:prod": "node scripts/smoke-business-directory-ob4.mjs --prod"
```

**差分:** `package.json` の `"smoke:match:p15-l5"` 行の直後に 2 行追加（アルファベット順で自然な位置）。

---

## 3. `scripts/smoke-business-directory-ob4.mjs` — 統合 Smoke スクリプト

### 3.1 設計方針

- **既存スクリプトを呼ばない**（依存を避ける）
- **8788 ローカルと本番（`--prod`）両対応**
- **全 PASS で exit 0、1 件でも FAIL で exit 1**
- **CI/手動どちらでも実行可能**
- 実行時間 30 秒以内を目標

### 3.2 確認項目（全 8 項目）

```
No.  項目                         手段                     P0 該当
---  ---------------------------  -----------------------  ---------
 1   Edge business-directory     POST get_public_listings  P0-01
     死活（HTTP 200 + JSON ok）
 2   Edge stripe-webhook         設定ファイル存在確認      P0-02
     デプロイ済み確認            + functions list
 3   静的 list.html HTTP 200     fetch + status 200        P0-04
 4   静的 detail.html HTTP 200   fetch + status 200        P0-04
 5   静的 index.html（Owner）    fetch + status 200        P0-04
     HTTP 200
 6   静的 admin/reviews.html     fetch + status 200        P0-04
     HTTP 200
 7   Supabase BD テーブル        全 BD テーブル名リスト    P0-04
     ソースファイル存在確認      存在確認（static fallback）
 8   BD 主要モジュール           ファイル存在 +            P0-04
     ファイル存在 + 破損確認     size > 0
```

### 3.3 CLI インターフェース

```bash
# ローカル（8788）
node scripts/smoke-business-directory-ob4.mjs

# 本番（TASFUL_SUPABASE_URL + TASFUL_SUPABASE_ANON_KEY 環境変数必須）
node scripts/smoke-business-directory-ob4.mjs --prod

# 出力形式
PASS [1/8] Edge business-directory health (200 · 45ms)
PASS [2/8] Edge stripe-webhook deployed
PASS [3/8] Static /business-directory/public/list.html (200)
...
=== BD OB4 Smoke: 8/8 PASS ===
```

### 3.4 エラー時の出力

```
FAIL [1/8] Edge business-directory health — HTTP 502 · body: {"error":"..."} 
=== BD OB4 Smoke: 7/8 PASS · 1 FAIL ===
```

### 3.5 `--prod` モードの動作

- `SUPABASE_URL` + `SUPABASE_ANON_KEY` 環境変数から Edge Functions URL を構築
- `FUNCTIONS_BASE = {SUPABASE_URL}/functions/v1`
- 静的ファイルは fetch せずに **dist ディレクトリのファイル存在確認** で代替（本番では Cloudflare Pages が配信するため）
- 本番 URL の browser smoke は `scripts/capture-business-directory-ob4-smoke.mjs` が担当

---

## 4. `scripts/capture-business-directory-ob4-smoke.mjs` — 本番 URL Browser Smoke

### 4.1 設計方針

- Playwright（`require('playwright')`）を使用
- **Playwright MCP が使えない環境でも単独実行可能**
- 本番 URL（Cloudflare Pages）に対する browser 確認
- スクリーンショットを `reports/business-directory-ob4-smoke/` に保存

### 4.2 確認項目（全 5 画面 · 6 チェック）

```
No.  画面                                    check
---  --------------------------------------  ------------------------------
 1   /business-directory/public/list.html    主要セレクタ存在 + 一覧表示
 2   /business-directory/public/detail.html  主要セレクタ存在 + 詳細表示
     ?slug=tanaka-shop&type=shop_retail
 3   /business-directory/public/list.html    Console Error 0
 4   /business-directory/public/detail.html  Console Error 0
     ?slug=tanaka-shop&type=shop_retail
 5   /business-directory/index.html          Owner dashboard HTTP 200
 6   /business-directory/admin/reviews.html  Admin reviews HTTP 200
```

### 4.3 スクリーンショット出力

```
reports/business-directory-ob4-smoke/
├── 001-public-list-1280.png
├── 002-public-detail-1280.png
├── 003-public-list-390.png
├── 004-public-detail-390.png
└── report.json（全画面 HTTP status · Console Error 数 · timestamp）
```

### 4.4 CLI

```bash
# 本番 URL を指定（--prod で BUILD_BASE_URL 環境変数から取得）
node scripts/capture-business-directory-ob4-smoke.mjs --prod

# または明示的に URL 指定
node scripts/capture-business-directory-ob4-smoke.mjs --url https://tasufull-article.pages.dev
```

---

## 5. Playwright MCP を使う項目

### 5.1 概要

Playwright MCP（`@playwright/mcp@latest` · headless chromium · **既存接続済**）を使って、AI エージェントから手動実行する smoke。毎日の定期確認または障害時初動確認に使用。

### 5.2 MCP 実行手順（3 ステップ）

**Step 1: Public list 表示確認**
```
1. browser_navigate → { url: "http://127.0.0.1:8788/business-directory/public/list.html" }
2. browser_snapshot → 一覧表示 + 主要セレクタ確認
3. browser_console_messages → { level: "error" } → 0 件確認
```

**Step 2: Public detail 表示確認**
```
1. browser_navigate → { url: "http://127.0.0.1:8788/business-directory/public/detail.html?slug=tanaka-shop&type=shop_retail" }
2. browser_snapshot → 詳細表示 + 主要セレクタ確認
3. browser_console_messages → { level: "error" } → 0 件確認
```

**Step 3: Network 異常確認**
```
1. browser_network_requests → { static: false } → 4xx/5xx がないか確認
```

### 5.3 本番環境用（OB1 Access 方針決定後）

本番 URL が確定したら、`127.0.0.1:8788` を本番 URL に置き換えて同手順を実行。

### 5.4 MCP の制約

- **定期実行不可**（1 セッション単位の対話操作）
- 定期実行が必要な場合は `capture-business-directory-ob4-smoke.mjs` を cron/CI で実行
- MCP は **人間または AI エージェントによる手動確認** 用途

---

## 6. `docs/runbooks/business-directory-oncall.md` — オンコール・問い合わせ先 仮 Runbook

> **注意:** 以下はすべて **仮** の文案。実際の担当者・連絡先は運営が決定し差し替える。

```markdown
# Business Directory — オンコール・問い合わせ先（仮）

**最終更新:** 2026-07-04  
**状態:** 仮（運営承認前 · 実連絡先未設定）

---

## 1. オンコール（障害時）

| 深刻度 | 定義 | 初動連絡先（仮） | 目標応答時間 |
|--------|------|-----------------|-------------|
| **S1** | Edge 全停止 · DB 不可 | [TBD: Dev Lead] + [TBD: Ops Lead] | 15 分以内 |
| **S2** | Webhook 停止 · 課金反映不可 | [TBD: Dev Lead] | 1 時間以内 |
| **S3** | 審査 UI のみ障害 | [TBD: Ops Lead] | 4 時間以内 |
| **S4** | 表示崩れ · 軽微 | [TBD: Ops Lead] | 翌営業日 |

## 2. エスカレーション（仮）

```
S1/S2 発生
  → [TBD: 一次担当者名 · 連絡先]
  → 15 分で応答なし → [TBD: 二次担当者名 · 連絡先]
  → 30 分で復旧目処なし → [TBD: プロダクトオーナー名 · 連絡先]
```

## 3. 定期確認（日次 · 仮）

| 時刻 | 担当（仮） | 項目 |
|------|-----------|------|
| 09:00 | Ops | `npm run smoke:business-directory` 実行 · PASS 確認 |
| 09:00 | Ops | Stripe Dashboard webhook 失敗イベント確認 |
| 09:00 | Ops | Admin reviews 審査キュー確認 |
| 18:00 | Ops | 新規登録 · 課金成立件数確認 |

## 4. 問い合わせ先（仮）

| 種別 | 連絡先（仮） | 備考 |
|------|-------------|------|
| Owner 向けサポート | [TBD: メールアドレス] | OB7 サポート窓口と共通 |
| 運営内部連絡 | [TBD: チャットツール · チャンネル名] | — |
| Stripe 緊急 | Stripe Dashboard → Support | 24h · 英語 |
| Supabase 緊急 | Supabase Dashboard → Support | Pro Plan |

## 5. 障害時初動チェックリスト（仮）

1. `npm run smoke:business-directory` 実行
2. Cloudflare Pages Deployments — 最新 deploy の状態確認
3. Supabase Dashboard — DB status · Edge Functions status
4. Stripe Dashboard — webhook 失敗イベント有無
5. 本番 URL browser smoke（`capture-business-directory-ob4-smoke.mjs --prod`）
6. 原因特定 → S1–S4 分類 → エスカレーション
7. Post-incident: `business_directory_audit_logs` 保全 · smoke 再実行 · 記録
```

---

## 7. P0 だけの最小差分（サマリー）

```
作成:
  scripts/smoke-business-directory-ob4.mjs          ← 統合 smoke（8 項目）
  scripts/capture-business-directory-ob4-smoke.mjs   ← 本番 browser smoke（6 チェック）
  docs/runbooks/business-directory-oncall.md         ← オンコール Runbook（仮）

変更:
  package.json                                       ← +2 行（smoke:business-directory）
  docs/TODO.md                                       ← OB4 P0 status 更新

npm scripts 追加:
  "smoke:business-directory"
  "smoke:business-directory:prod"

外部依存:
  playwright（既存 · devDependencies）
  @playwright/mcp（既存 · MCP 接続済）

触らない:
  Supabase（DB · RLS · migration · Edge 変更なし）
  Stripe（Dashboard · keys · webhook 変更なし）
  既存 BD ソースコード（HTML/CSS/JS 変更なし）
  価格（変更なし）
```

---

## 8. P1 へ回す項目（今回対象外）

| ID | 項目 | 回す理由 |
|----|------|---------|
| OB4-P0-03 | Stripe webhook 失敗アラート（自動通知） | Stripe Dashboard 設定が必要 · 人間作業 |
| OB4-P0-07 | Stripe Live 切替後 Runbook | Live mode 未切替 · OB2 依存 |
| OB4-P1-01 | 審査キュー深度アラート | 閾値決定 · 通知設定が先 |
| OB4-P1-02 | Supabase BD テーブル RLS エラー監視 | Supabase metrics 確認手順の整備が必要 |
| OB4-P1-03 | 課金不整合検知 | 検知ロジックの設計が必要 |
| OB4-P1-04 | `npm run` ショートカット（P0 で実施済のためスキップ） | — |
| OB4-P1-05 | Owner/Admin/Public 3 ロール横断 browser smoke 定期化 | ログイン state の保存・再利用が必要 |
| OB4-P1-06 | アラート閾値正式決定・通知設定 | 運営判断 · ツール選定が必要 |
| OB4-P1-07 | Backup リストアドリル | 運営日程調整が必要 |
| OB4-P1-08 | Playwright MCP viewport smoke（1280/768/390） | P0 で 1280/390 の 2 viewport はカバー · 768 追加は P1 |
| OB4-P1-09 | Network requests 異常検知自動化 | P0 で MCP 手動手順は提供済 · 自動化は P1 |
| OB4-P2-01/02/03 | 全 P2 項目 | 後回し可 |

---

## 9. 実装順序（推奨）

```text
Step 1: smoke-business-directory-ob4.mjs 作成
         └─ 8788 で 8/8 PASS 確認

Step 2: capture-business-directory-ob4-smoke.mjs 作成
         └─ 8788 で browser smoke 6/6 PASS 確認

Step 3: package.json + npm scripts 追加
         └─ npm run smoke:business-directory 動作確認

Step 4: Playwright MCP 手動確認（§5 手順）
         └─ Public list/detail + Console Error 0

Step 5: docs/runbooks/business-directory-oncall.md 作成
         └─ 運営レビュー（連絡先 · 担当者の実名差し替え待ち）

Step 6: docs/TODO.md 更新
         └─ OB4 P0 status → Done / P1 deferred 明記
```

---

## 10. 判定

| 項目 | 判定 |
|------|------|
| **P0 実装可否** | **Go**（コード変更は新規 2 スクリプト + package.json 2 行 + docs 1 ファイルのみ） |
| **既存コード影響** | **0**（BD ソース · Supabase · Stripe 変更なし） |
| **テスト** | smoke スクリプト自体がテストを兼ねる |
| **所要時間（推定）** | スクリプト 2 本作成: 2–3h · docs: 0.5h · 合計 3–4h |

---

*OB4 P0 最小実装案 — 2026-07-04 作成。運営承認後、実装フェーズに移行。*