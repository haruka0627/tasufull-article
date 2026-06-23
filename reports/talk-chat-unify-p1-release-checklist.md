# TASFUL TALK 統合 P1 — 本番反映チェックリスト

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-22** |
| 対象 | TALK_CHAT_UNIFY **P0 + P1** 本番反映 |
| 判定（本書作成時） | **TALK_CHAT_UNIFY_P1_RELEASE_READY** |
| コード変更 | なし（運用手順のみ） |

---

## 0. エグゼクティブサマリ

本番反映は **3 層** をこの順で適用する。

```text
① Supabase migration（DB 列追加）
② Edge Function deploy（ensure-talk-room）
③ Cloudflare Pages（npm run build:pages → deploy）
```

**現状ギャップ（2026-06-22 時点）:**

| 層 | ソース | 本番 dist / Supabase |
|----|--------|----------------------|
| P0/P1 静的 JS/HTML | リポジトリルート | `deploy/cloudflare/dist` **未同期**（`talk-room-ensure.js` 等なし） |
| migration | `20260622120000_talk_room_contact_bridge.sql` | **未適用**（要 `supabase db push`） |
| Edge | `ensure-talk-room` | **未デプロイ** |

ソース実装・ローカル検証は完了（`TALK_CHAT_UNIFY_P1_READY`）。本チェックリストは **反映作業の実行手順** である。

---

## 1. 反映対象ファイル一覧

### 1.1 P1 新規（本番必須）

| パス | 役割 |
|------|------|
| `supabase/functions/ensure-talk-room/index.ts` | Edge ハンドラ |
| `supabase/functions/_shared/talk-room-ensure.ts` | 冪等 room 作成 |
| `supabase/functions/_shared/talk-room-auth.ts` | JWT / stub 認証 |
| `supabase/migrations/20260622120000_talk_room_contact_bridge.sql` | DB 列 |
| `talk-room-ensure.js` | クライアント ensure helper |

### 1.2 P1 更新（dist に含まれること）

`chat-supabase.js` · `chat-thread-store.js` · `chat-service.js` · `platform-chat-fee.js` · `platform-chat-connect-entry-flow.js` · `platform-chat-fee-pay.js` · `platform-chat-fee-pay.html` · `listing-contact-requests-store.js` · `talk-home-data.js` · `business-service-flow.js` · `chat-detail.html`

### 1.3 P0 更新（dist に含まれること）

`talk-chat-entry-url.js` · `chat-list-redirect.js` · `chat-list.html` · `talk-home.html` · `talk-home.js` · `chat-detail.html` · `chat-detail.js` · `dashboard.*` · 各 settings/anpi/demo HTML · `platform-notify-action-labels.js` · `talk-notify-actions.js` · `breadcrumb-config.js` · `ai-*.js` 等

詳細: `reports/talk-chat-unify-p0-result.md` · `reports/talk-chat-unify-p1-result.md`

### 1.4 触らないもの

- `match-ensure-talk-room/**` — デプロイ対象外・挙動変更禁止
- `chat-detail.js` 業務 UI 本体
- `deploy/cloudflare/dist/**` への手動編集（必ず `build:pages` 経由）

---

## 2. ① Supabase migration — 適用前チェック

**対象:** `supabase/migrations/20260622120000_talk_room_contact_bridge.sql`

**前提:** リンク済みプロジェクト `ddojquacsyqesrjhcvmn`（`chat-supabase-config.js` の URL と一致すること）

### 2.1 事前確認 SQL（読取のみ · SQL Editor 可）

```sql
-- A) transaction_rooms 存在
select count(*) as room_count from public.transaction_rooms;

-- B) 列の有無（未適用なら 0 件）
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transaction_rooms'
  and column_name in ('contact_id', 'source', 'service_type', 'service_ref_id');

-- C) 既存インデックス
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'transaction_rooms'
  and indexname in (
    'transaction_rooms_contact_id_uidx',
    'transaction_rooms_service_ref_idx'
  );

-- D) contact_id 重複（unique 索引作成前に必須 — 1 件でもあれば要データ修正）
-- 列未存在時はスキップ。列追加後・索引前に再実行。
select contact_id, count(*) as cnt
from public.transaction_rooms
where contact_id is not null and contact_id <> ''
group by contact_id
having count(*) > 1;
```

### 2.2 チェックリスト

| # | 項目 | OK |
|---|------|-----|
| M-01 | `transaction_rooms` テーブルが存在する | ☐ |
| M-02 | 本番バックアップ / PITR が有効（Dashboard → Database → Backups） | ☐ |
| M-03 | `contact_id` 重複が **0 件**（D クエリ） | ☐ |
| M-04 | メンテナンスウィンドウを関係者に通知済み | ☐ |
| M-05 | `supabase link` が本番 ref を指している | ☐ |
| M-06 | ステージングで同一 migration を試験済み（推奨） | ☐ |

### 2.3 適用コマンド

```powershell
cd c:\Users\rubih\tasufull-article
npx supabase db push --linked
# または単体:
# npx supabase migration up --linked
```

### 2.4 適用後確認

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transaction_rooms'
  and column_name in ('contact_id', 'source', 'service_type', 'service_ref_id')
order by column_name;
-- 期待: 4 行

select indexname from pg_indexes
where indexname in ('transaction_rooms_contact_id_uidx', 'transaction_rooms_service_ref_idx');
-- 期待: 2 行
```

| # | 項目 | OK |
|---|------|-----|
| M-07 | 4 列が追加されている | ☐ |
| M-08 | 2 索引が作成されている | ☐ |
| M-09 | 既存 `transaction_rooms` 行の `contact_id` は NULL のまま（破壊なし） | ☐ |

---

## 3. ② Edge Function — デプロイ前チェック

**対象:** `ensure-talk-room`（**`match-ensure-talk-room` は再デプロイしない**）

### 3.1 Secrets / 環境

| # | 項目 | 確認方法 | OK |
|---|------|----------|-----|
| E-01 | `SUPABASE_URL` が Edge に設定済み | Dashboard → Edge Functions → Secrets | ☐ |
| E-02 | `SUPABASE_SERVICE_ROLE_KEY` が設定済み | 同上（**クライアントに露出しない**） | ☐ |
| E-03 | `SUPABASE_ANON_KEY` が設定済み | 同上 | ☐ |
| E-04 | Custom Access Token Hook で `talk_user_id` が JWT に入る | `docs/supabase-migration-plan.md` / Auth Hook | ☐ |
| E-05 | RLS: `transaction_rooms` INSERT は Edge（service_role）経由 | `scripts/verify-talk-rls-staging.mjs` 事前実行推奨 | ☐ |

### 3.2 ローカル smoke（任意 · デプロイ前）

```powershell
# Deno ローカルルータ（match-local-edge-smoke-server に ensure-talk-room 登録済み）
deno run -A scripts/match-local-edge-smoke-server.ts
# 別ターミナル:
curl -X POST http://127.0.0.1:54321/functions/v1/ensure-talk-room `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer stub-talk-token" `
  -d '{"listing_type":"skill","listing_id":"test","title":"test","buyer_id":"u_me","seller_id":"u_store"}'
# 期待: 200, mode=stub, room_id あり
```

### 3.3 デプロイコマンド

```powershell
cd c:\Users\rubih\tasufull-article
npx supabase functions deploy ensure-talk-room --project-ref ddojquacsyqesrjhcvmn
```

> **Note:** `supabase/config.toml` に `[functions.ensure-talk-room]` 未定義の場合、CLI デフォルト（`verify_jwt`）が適用される。本 Function はハンドラ内で Bearer を検証する。CORS 問題時は他 Function と同様 `verify_jwt = false` を `config.toml` に追加して `config push` を検討（**コード変更は別 PR**）。

### 3.4 デプロイ後確認

```powershell
$base = "https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1"
$anon = "<anon-public-key>"
curl -X POST "$base/ensure-talk-room" `
  -H "Authorization: Bearer $anon" `
  -H "apikey: $anon" `
  -H "Content-Type: application/json" `
  -d '{"listing_type":"skill","listing_id":"release-smoke-001","title":"smoke","buyer_id":"u_me","seller_id":"u_store","contact_id":"release-smoke-contact-001"}'
```

| # | 項目 | 期待 | OK |
|---|------|------|-----|
| E-06 | HTTP 200 · `ok: true` | live mode | ☐ |
| E-07 | 2 回目同一 `contact_id` → `reused: true` | 冪等 | ☐ |
| E-08 | `match-ensure-talk-room` が従来どおり動作 | `node scripts/smoke-match-talk-room.mjs --live --functions-base $base` | ☐ |

---

## 4. ③ Cloudflare Pages — build & dist 同期

### 4.1 ビルド前

| # | 項目 | OK |
|---|------|-----|
| P-01 | `TASFUL_SUPABASE_URL` / `TASFUL_SUPABASE_ANON_KEY` を本番値に設定 | ☐ |
| P-02 | `CLOUDFLARE_API_TOKEN`（`deploy:pages` 時のみ） | ☐ |
| P-03 | ソースが P0/P1 完了コミットを指している | ☐ |

### 4.2 ビルド

```powershell
cd c:\Users\rubih\tasufull-article
$env:TASFUL_SUPABASE_URL="https://ddojquacsyqesrjhcvmn.supabase.co"
$env:TASFUL_SUPABASE_ANON_KEY="<anon-public-key>"
npm run build:pages
npm run verify:pages-stage
```

`stage-cloudflare-pages.mjs` はリポジトリルートを `deploy/cloudflare/dist/` に再生成する（`deploy/` 自身は除外 · `chat-supabase-config.js` は env から生成）。

### 4.3 dist 同期確認（P0/P1 必須ファイル）

ビルド後、以下が **存在すること** を確認する。

```powershell
$dist = "deploy/cloudflare/dist"
@(
  "talk-room-ensure.js",
  "talk-chat-entry-url.js",
  "chat-list-redirect.js",
  "chat-thread-store.js",
  "chat-supabase.js",
  "platform-chat-fee.js",
  "platform-chat-fee-pay.html",
  "talk-home.html",
  "chat-list.html",
  "chat-detail.html",
  "chat-supabase-config.js"
) | ForEach-Object {
  if (Test-Path "$dist/$_") { "OK  $_" } else { "MISSING  $_" }
}
```

| # | 項目 | OK |
|---|------|-----|
| P-04 | 上記 11 ファイルすべて存在 | ☐ |
| P-05 | `chat-supabase-config.js` に `currentUserId` / `me` / `u_me` **なし**（`verify:pages-stage`） | ☐ |
| P-06 | `platform-chat-fee-pay.html` が `talk-room-ensure.js` を読み込む | ☐ |
| P-07 | `chat-detail.html` が `talk-room-ensure.js` を読み込む | ☐ |
| P-08 | dist 内 `dashboard.html` のチャットリンクが `talk-home.html?tab=chat` | ☐ |
| P-09 | dist 内に旧 `chat-list.html` 直リンクが主要ナビに残っていない（サンプル grep） | ☐ |

**補助 grep:**

```powershell
Select-String -Path "deploy/cloudflare/dist/dashboard.html" -Pattern "talk-home.html\?tab=chat"
Select-String -Path "deploy/cloudflare/dist/chat-list.html" -Pattern "talk-chat-entry-url"
```

### 4.4 デプロイ

```powershell
# 方法 A: スクリプト
$env:CLOUDFLARE_API_TOKEN="<token>"
npm run deploy:pages

# 方法 B: wrangler 直接
npx wrangler pages deploy deploy/cloudflare/dist --project-name=tasufull-article
```

| # | 項目 | OK |
|---|------|-----|
| P-10 | Pages デプロイ成功（deployment URL 取得） | ☐ |
| P-11 | 本番 URL が最新 deployment を指す | ☐ |

---

## 5. Smoke 手順 — local / pages.dev

### 5.1 ローカル（8788 · dist 配信）

```powershell
npm run dev
# → http://127.0.0.1:8788/
```

| 順 | コマンド / 操作 | 期待 |
|----|----------------|------|
| 1 | `node scripts/verify-talk-chat-unify-p0.mjs`（`BASE_URL=http://127.0.0.1:8788`） | 10/10 PASS |
| 2 | `node scripts/verify-talk-chat-unify-p1.mjs`（同上） | 22/22 PASS |
| 3 | `npm run smoke:pages` | PASS |
| 4 | `node scripts/smoke-match-talk-room.mjs --base http://127.0.0.1:8788` | PASS |
| 5 | 手動: `/chat-list.html` → TALK リダイレクト | `talk-home.html?tab=chat` |
| 6 | 手動: `/platform-chat-fee-pay.html?talkDev=1` console | error 0 |

```powershell
$env:BASE_URL="http://127.0.0.1:8788"
node scripts/verify-talk-chat-unify-p0.mjs
node scripts/verify-talk-chat-unify-p1.mjs
npm run smoke:pages
```

### 5.2 pages.dev / 本番 URL

```powershell
$base = "https://tasufull-article.pages.dev"   # または本番カスタムドメイン
$env:BASE_URL = $base
node scripts/verify-talk-chat-unify-p0.mjs
node scripts/verify-talk-chat-unify-p1.mjs
node scripts/smoke-cloudflare-pages.mjs --base $base
```

| # | 手動確認 | 期待 | OK |
|---|----------|------|-----|
| S-01 | `/chat-list.html` | TALK へリダイレクト | ☐ |
| S-02 | ダッシュボード「チャット」 | `talk-home.html?tab=chat` | ☐ |
| S-03 | `chat-detail`「← 一覧」 | TALK 戻り | ☐ |
| S-04 | TALK 通知 CTA（応募/購入/TALK） | 案件 or TALK へ遷移 | ☐ |
| S-05 | MATCH 「メッセージする」 | 従来どおり | ☐ |
| S-06 | 390 / 768 / 1280 console error 0 | P0-T10 / P1-T10 相当 | ☐ |

### 5.3 本番 E2E（認証済み · 低トラフィック時）

| # | フロー | 確認 |
|---|--------|------|
| S-07 | skill 手数料支払い → チャット開始 | `transaction_rooms` に UUID 行 · `listing_type=skill` |
| S-08 | 同一 contact で再 ensure | 同一 `room_id` |
| S-09 | TALK 一覧に新規ルーム表示 | reload 後に出現 |

---

## 6. 推奨反映順序（タイムライン）

```text
T-0  関係者通知 · バックアップ確認
T-1  migration 適用（§2）
T-2  ensure-talk-room デプロイ（§3）
T-3  npm run build:pages + verify:pages-stage（§4）
T-4  ローカル 8788 smoke（§5.1）
T-5  npm run deploy:pages（§4.4）
T-6  pages.dev smoke（§5.2）
T-7  本番 E2E スポット確認（§5.3）
T-8  完了報告 · 監視 30分
```

**ロールバック判断:** S-01〜S-06 のいずれかが FAIL、または ensure API が 5xx 連続 → §7 へ。

---

## 7. 失敗時ロールバック手順

### 7.1 原則

| 層 | 即時影響 | ロールバック優先度 |
|----|----------|-------------------|
| Pages（静的） | ナビ・リダイレクト | **最優先**（ユーザー-facing） |
| Edge | 新規 room 作成 | 次点（LS/client fallback あり） |
| DB migration | 列追加のみ（非破壊） | **通常ロールバック不要** |

P1 クライアントは Edge 失敗時 **`createListingTalkRoom` → LS fallback** があるため、Edge 単体障害でも完全停止にはなりにくい。

### 7.2 Pages ロールバック

```powershell
# Cloudflare Dashboard → Workers & Pages → tasufull-article → Deployments
# → 直前の成功 deployment → "Rollback to this deployment"

# または前 dist を再アップロード:
git checkout <previous-commit> -- deploy/cloudflare/dist   # 非推奨: build:pages で再生成が正道
npm run build:pages   # 前コミットのソースで
npx wrangler pages deploy deploy/cloudflare/dist --project-name=tasufull-article
```

| # | 確認 | OK |
|---|------|-----|
| R-P01 | `/chat-list.html` が意図どおり動作（旧挙動に戻る場合あり） | ☐ |
| R-P02 | `smoke:pages` PASS | ☐ |

### 7.3 Edge ロールバック

```powershell
# オプション A: 関数削除（クライアントは fallback へ）
npx supabase functions delete ensure-talk-room --project-ref ddojquacsyqesrjhcvmn

# オプション B: 前バージョンを git から再デプロイ
git checkout <previous-commit> -- supabase/functions/ensure-talk-room
npx supabase functions deploy ensure-talk-room --project-ref ddojquacsyqesrjhcvmn
```

**`match-ensure-talk-room` は触らない。**

| # | 確認 | OK |
|---|------|-----|
| R-E01 | `smoke-match-talk-room.mjs` PASS | ☐ |
| R-E02 | 新規購入フローが LS fallback で継続（劣化許容） | ☐ |

### 7.4 DB migration ロールバック（**緊急時のみ**）

migration は **additive only**（列・索引追加）。既存行は変更しない。通常はロールバック不要。

```sql
-- ⚠ 本番で contact_id に値が入った後は実行禁止（データ損失）
drop index if exists public.transaction_rooms_service_ref_idx;
drop index if exists public.transaction_rooms_contact_id_uidx;

alter table public.transaction_rooms
  drop column if exists service_ref_id,
  drop column if exists service_type,
  drop column if exists source,
  drop column if exists contact_id;
```

| # | 条件 | 操作 |
|---|------|------|
| R-M01 | migration 適用失敗（途中で止まった） | `supabase migration repair` / 手動 SQL 修正 |
| R-M02 | unique 索引作成失敗（重複データ） | 重複 `contact_id` を手動解消後に索引再作成 |
| R-M03 | 本番稼働後 · 列にデータあり | **列削除しない** — Edge/Pages のみロールバック |

---

## 8. 完了判定

以下 **すべて** を満たしたとき、本番反映完了とする。

| # | 条件 | OK |
|---|------|-----|
| F-01 | migration M-07〜M-09 PASS | ☐ |
| F-02 | Edge E-06〜E-08 PASS | ☐ |
| F-03 | Pages P-04〜P-11 PASS | ☐ |
| F-04 | Local smoke §5.1 全 PASS | ☐ |
| F-05 | pages.dev smoke §5.2 全 PASS | ☐ |
| F-06 | MATCH 回帰 PASS | ☐ |
| F-07 | console error 0（主要 3 画面 × 3 解像度） | ☐ |

```text
TALK_CHAT_UNIFY_P1_RELEASE_READY
```

> **本書作成時点:** ソース・検証スクリプトは READY。§2〜§5 の **実行チェックボックスは未記入** — 本番作業完了後に F-01〜F-07 を記入すること。

---

## 9. 参照

| ドキュメント | 用途 |
|-------------|------|
| `reports/talk-chat-unify-p0-result.md` | P0 変更・検証 |
| `reports/talk-chat-unify-p1-result.md` | P1 変更・検証 |
| `reports/talk-chat-unify-p0-p1-plan.md` | 全体計画 |
| `docs/local-dev.md` | 8788 ローカル手順 |
| `scripts/deploy-cloudflare-pages.mjs` | Pages デプロイ |
| `scripts/verify-talk-rls-staging.mjs` | RLS 事前検証 |
| `scripts/smoke-match-talk-room.mjs` | MATCH 回帰 |
