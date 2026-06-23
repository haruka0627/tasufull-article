# TASFUL LIVE P0 — 検証スクリプト作成結果

| 項目 | 内容 |
|------|------|
| 作成日 | **2026-06-23** |
| スクリプト | [`scripts/verify-live-p0-schema.mjs`](../scripts/verify-live-p0-schema.mjs) |
| 対象 migration | [`supabase/migrations/20260628100000_live_p0_schema.sql`](../supabase/migrations/20260628100000_live_p0_schema.sql) |
| npm script | `verify:live-p0-schema` |
| DB 適用 | **未実施**（本レポート作成時点） |

---

## 判定

| 判定 | **検証スクリプト作成完了 — ステージング適用へ進め可** |
|------|--------------------------------------------------------|
| 意味 | migration 草案は静的検証 PASS。DB 適用前でも `--static-only` で migration 内容を検証できる。適用後は同一スクリプト（フルモード）で POST 検証する |
| 条件 | ① TALK RLS 前提（`talk_current_user_id` / `talk_is_admin`）② TALK P1 bridge 列 ③ 適用後 TALK/MATCH 回帰は別コマンド |

---

## 1. 作成した検証項目

### A. Static migration file（`--static-only` でも実行）

| ID | 内容 |
|----|------|
| `STATIC-table-*` | `live_*` 9 テーブルの `create table` 存在 |
| `STATIC-rls-enabled-*` | 各テーブルの `enable row level security` |
| `STATIC-CHK-*` | 主要 CHECK（permission / creator / short / stream / tip / `short_active_count <= 50`） |
| `STATIC-signed-url-ttl` | migration コメントに TTL **300** |
| `STATIC-stream-provider-default` | `stream_provider` デフォルト `stub` |
| `STATIC-bucket-*` | Storage bucket 4 種の定義 |
| `STATIC-live-archives-deferred` | `live-archives` 未作成コメント |
| `STATIC-no-transaction_rooms-alter` | `transaction_rooms` ALTER なし |
| `STATIC-no-talk_notifications-alter` | `talk_notifications` ALTER なし |
| `STATIC-no-alter-*` | `match_profiles` / `listings` / `builder_projects` ALTER なし |
| `STATIC-policy-count` | RLS policy **52** 件（テーブル 34 + storage 18） |
| `STATIC-stream-env-doc-*` | Stream 関連 env 名（migration コメント内 · optional SKIP 可） |

### B–D. Remote DB（migration 適用後 · service role 必須）

| セクション | 内容 |
|------------|------|
| **B** | `live_*` 9 テーブル REST 到達性 |
| **C** | 主要カラム（profiles / shorts / tips / broadcasts） |
| **D** | CHECK 制約 + `live_creator_profiles_short_active_count_chk`（≤ 50） |

### E–G. RLS / Storage

| セクション | 内容 |
|------------|------|
| **E** | `pg_tables.rowsecurity` による RLS enabled（未公開時 SKIP） |
| **F** | `pg_policies` による policy 数（テーブル合計 ≥ 34 · storage ≥ 18）· anon `live_shorts` 読取不可 |
| **G** | Storage bucket 4 つの存在と public/private · `live-archives` 不在 |

### H. TALK / MATCH / Builder 非影響

| ID | 内容 |
|----|------|
| `DB-talk-transaction_rooms-col-*` | P1 bridge 列（`contact_id` 等）維持 |
| `DB-talk-transaction_rooms-no-live-columns` | LIVE 用列追加なし |
| `DB-talk-talk_notifications-reachable` | テーブル到達性 |
| `DB-untouched-*` | `match_profiles` / `listings` / `builder_projects` |
| `DB-talk_notifications-type-live-insert` | `type=live` 通知 INSERT 可能（ALTER 不要） |

### I. RLS 挙動（JWT · talk テストユーザー）

| ID | 内容 |
|----|------|
| `DB-rls-live_tips-user-update-blocked` | 一般ユーザー UPDATE 不可 |
| `DB-rls-live_moderation_logs-user-read` | 一般ユーザー SELECT 不可 |
| `DB-rls-live_moderation_logs-user-insert` | 一般ユーザー INSERT 不可 |
| `DB-rls-live_moderation_logs-admin-read` | admin JWT SELECT（`talk_is_admin` 前提 · 失敗時 SKIP） |

### J–K. 定数 / 任意 env

| ID | 内容 |
|----|------|
| `CONST-signed-url-ttl` | **300** 秒 |
| `CONST-short-daily-limit` | **10** |
| `CONST-short-active-limit` | **50** |
| `ENV-CLOUDFLARE_STREAM_*` / `LIVE_STREAM_PROVIDER` | 設定時 PASS · 未設定 SKIP |

---

## 2. 必要な環境変数

| 変数 | モード | 必須 |
|------|--------|------|
| （なし） | `--static-only` | 不要 |
| `SUPABASE_URL` | フル | 必須 |
| `SUPABASE_ANON_KEY` | フル | 必須 |
| `SUPABASE_SERVICE_ROLE_KEY` | フル（DB 検証） | 必須 |
| `LIVE_RLS_USER_A_JWT` | フル（RLS 挙動） | 任意（未設定時 talk テストユーザー自動発行） |
| `LIVE_RLS_USER_B_JWT` | フル | 任意 |
| `CLOUDFLARE_STREAM_ACCOUNT_ID` 等 | 任意チェック | 任意 |
| `LIVE_STREAM_PROVIDER` | 任意チェック | 任意 |

未設定の `SUPABASE_*` は [`chat-supabase-config.js`](../chat-supabase-config.js) から URL / anon を補完（service role は `.env` のみ）。

---

## 3. SKIP 条件

| 条件 | 挙動 |
|------|------|
| `--static-only` | DB セクション全体 SKIP（exit 0 · FAIL のみ exit 1） |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` 不足 | `DB-all` SKIP |
| `SUPABASE_SERVICE_ROLE_KEY` 不足 | `DB-all` SKIP（静的 + 定数 + Stream env のみ） |
| `live_*` テーブル未到達 | `DB-schema-rest` SKIP（migration 未適用） |
| `information_schema` / `pg_tables` / `pg_policies` REST 非公開 | 該当項目 SKIP |
| JWT セットアップ失敗 | `DB-rls-behavior` SKIP |
| admin JWT で moderation 読取不可 | `DB-rls-live_moderation_logs-admin-read` SKIP |
| `builder_projects` 等がプロジェクトにない | `DB-untouched-*` SKIP |
| Stream env 未設定 | `ENV-*` SKIP（P0 stub で問題なし） |
| `STATIC-stream-env-doc-*` | migration コメントに env 名が無い場合 SKIP |

**SKIP は exit code 1 にしない。FAIL が 1 件でもあれば exit 1。**

---

## 4. 想定実行コマンド

```bash
# migration 適用前（ローカル / CI · DB 不要）
npm run verify:live-p0-schema -- --static-only
# または
node scripts/verify-live-p0-schema.mjs --static-only

# migration 適用後（ステージング linked DB）
# .env に SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY を設定
npm run verify:live-p0-schema
```

### TALK / MATCH 回帰（別コマンド · 本スクリプトでは実行しない）

```bash
node scripts/verify-talk-chat-unify-p1.mjs
node scripts/smoke-match-talk-room.mjs
node scripts/verify-talk-rls-staging.mjs
```

---

## 5. migration 適用前 / 適用後の使い方

### 適用前（現状）

1. `npm run verify:live-p0-schema -- --static-only` で migration SQL の整合性を確認
2. 全項目 **PASS**（Stream env は SKIP 可）ならステージング適用の GO 判断材料になる
3. DB フル検証は **SKIP されるのが正常**（テーブル未作成のため）

### 適用後（ステージング）

1. migration を linked DB に適用（本タスク外）:

   ```bash
   npx supabase db query --linked -f supabase/migrations/20260628100000_live_p0_schema.sql
   ```

2. `npm run verify:live-p0-schema`（フルモード）で POST 検証
3. TALK / MATCH 回帰スクリプトを別途実行
4. 全 PASS 後、Edge / UI 実装フェーズへ

---

## 6. 次ステップ

| # | 作業 | 担当フェーズ |
|---|------|--------------|
| 1 | ステージングへ `20260628100000_live_p0_schema.sql` 適用 | DB |
| 2 | `npm run verify:live-p0-schema` フル実行 | 検証 |
| 3 | `verify-talk-chat-unify-p1` / `smoke-match-talk-room` 回帰 | TALK/MATCH |
| 4 | Edge: signed URL TTL 300 · short publish | Edge |
| 5 | フロント: `live/` · `talk-category-normalize.js` に `live` | UI |

---

## 7. 静的実行結果（作成時）

`node scripts/verify-live-p0-schema.mjs --static-only` をローカルで実行し、migration ファイルに対する静的検証が **PASS** であることを確認済み（DB 未接続 · Stream env は SKIP）。

| Summary | 値 |
|---------|-----|
| PASS | 43（静的 + 定数） |
| FAIL | 0 |
| SKIP | 7（Stream env 関連 · 想定内） |
| exit code | 0 |

---

## 参照

- [tasful-live-p0-design.md](tasful-live-p0-design.md)
- [tasful-live-p0-migration-review.md](tasful-live-p0-migration-review.md)
- [tasful-live-p0-schema-draft-result.md](tasful-live-p0-schema-draft-result.md)
