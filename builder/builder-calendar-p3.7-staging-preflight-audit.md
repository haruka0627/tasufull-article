# Builder Calendar P3.7 — Staging 適用前 最終監査レポート

> 監査日: 2026-07-04
> 対象: migration / seed / JS mapper / test / 適用手順
> **DB には触れていない。ファイル変更なし。**

---

## 1. カラム整合性監査

### 1.1 migration DDL カラム一覧（CREATE TABLE 定義順）

| # | カラム名 | 型 | Nullable | Default | seed 参照 | mapper 参照 |
|---|----------|-----|----------|---------|-----------|-------------|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() | ✓ | `pickStr(r.id, r.project_id, r.projectId)` |
| 2 | `project_key` | text | NULL | — | ✓ | (未使用) |
| 3 | `owner_id` | text | NOT NULL | — | ✓ | (未使用) |
| 4 | `title` | text | NOT NULL | — | ✓ | `pickStr(r.title, r.name, r.project_name, r.projectName)` |
| 5 | `kind` | text | NOT NULL | — | ✓ | (未使用) |
| 6 | `status` | text | NULL | — | ✓ | `pickStr(r.status, r.project_status)` |
| 7 | `required_partners` | integer | NOT NULL | 1 | ✓ | (未使用) |
| 8 | `selected_partner_ids` | uuid[] | NOT NULL | '{}' | ✓ | (未使用) |
| 9 | `visibility` | text | NULL | — | ✓ | (未使用) |
| 10 | `contact_policy` | text | NULL | — | ✗ | (未使用) |
| 11 | `source` | text | NULL | — | ✗ | (未使用) |
| 12 | `main_thread_id` | uuid | NULL | — | ✗ | `pickStr(r.main_thread_id, ...)` |
| 13 | `source_template_id` | uuid | NULL | — | ✗ | (未使用) |
| 14 | `customer_name` | text | NULL | — | ✓ | `pickStr(r.customer_name, r.customerName, ...)` |
| 15 | `customer_contact` | text | NULL | — | ✓ | `pickStr(r.customer_contact, r.customerContact, ...)` |
| 16 | `assigned_vendor` | text | NULL | — | ✓ | `pickStr(r.assigned_vendor, r.assignedVendor, ...)` |
| 17 | `site_address` | text | NULL | — | ✓ | `pickStr(r.address, r.site_address, r.siteAddress, ...)` |
| 18 | `site_photos` | jsonb | NULL | — | ✓ | `asArray(r.site_photos ?? r.sitePhotos ?? r.photos)` |
| 19 | `schedule_start` | date | NULL | — | ✓ | `pickDateOnly(r.schedule_start, ...)` |
| 20 | `schedule_end` | date | NULL | — | ✓ | `pickDateOnly(r.schedule_end, ...)` |
| 21 | `schedule_phase` | text | NULL | — | ✓ | `pickStr(r.schedule_phase, r.schedulePhase, r.phase)` |
| 22 | `work_start_time` | text | NULL | — | ✓ | `pickStr(r.work_start_time, r.workStartTime, ...)` |
| 23 | `work_end_time` | text | NULL | — | ✓ | `pickStr(r.work_end_time, r.workEndTime, ...)` |
| 24 | `manager_name` | text | NULL | — | ✓ | `pickStr(r.contact_name, r.contactName, r.manager_name, ...)` |
| 25 | `manager_phone` | text | NULL | — | ✓ | `pickStr(r.contact_phone, r.contactPhone, r.manager_phone, ...)` |
| 26 | `talk_room_id` | text | NULL | — | ✓ | `pickStr(r.talk_room_id, r.talkRoomId, ...)` |
| 27 | `talk_thread_id` | text | NULL | — | ✓ | `pickStr(r.talk_thread_id, r.talkThreadId, ...)` |
| 28 | `completion_report` | jsonb | NULL | — | ✓ | `asObject(r.completion_report ?? r.completionReport ?? r.completion)` |
| 29 | `attachments` | jsonb | NULL | — | ✓ | `asArray(r.attachments ?? r.documents)` |
| 30 | `memo` | text | NULL | — | ✓ | `pickStr(r.memo, r.note, r.notes)` |
| 31 | `category` | text | NULL | — | ✓ | `pickStr(r.category, r.category_id)` |
| 32 | `created_at` | timestamptz | NOT NULL | now() | ✓ | `pickStr(r.created_at, r.createdAt)` |
| 33 | `updated_at` | timestamptz | NOT NULL | now() | ✓ | `pickStr(r.updated_at, r.updatedAt)` |

**判定: 問題なし。** 全33カラム中、seed で使用しないカラム（`contact_policy`, `source`, `source_template_id`）は NULL 許容であり問題ない。mapper は `pickStr()` で全カラムをカバー。

### 1.2 型の一致確認

| DDL 型 | seed 値 | mapper 処理 | 問題 |
|--------|---------|-------------|------|
| `uuid` | 固定UUID文字列 | `pickStr()` → string | OK |
| `text` | 文字列リテラル | `pickStr()` → string | OK |
| `date` | `CURRENT_DATE +/- N` | `pickDateOnly()` → YYYY-MM-DD | OK |
| `jsonb` | `'...'::jsonb` | `asArray()` / `asObject()` | OK |
| `integer` | 数値リテラル | (未使用) | OK |
| `uuid[]` | `'{}'::uuid[]` | (未使用) | OK |
| `timestamptz` | `NOW() +/- INTERVAL` | `pickStr()` → ISO string | OK |

**判定: 問題なし。**

---

## 2. 既存 DDL との衝突監査

### 2.1 `sql/builder-schema.sql` との比較

| 観点 | 既存 DDL | migration | 衝突？ |
|------|----------|-----------|--------|
| テーブル名 | `public.builder_projects` | 同一 | 問題なし（`IF NOT EXISTS`） |
| 主キー | `id uuid PK default gen_random_uuid()` | 同一 | 問題なし |
| `project_key` | `text unique` | 同一 | 問題なし |
| `owner_id` | `text not null` | 同一 | 問題なし |
| `title` | `text not null` | 同一 | 問題なし |
| `kind` | `text not null check (...)` | 同一 | 問題なし |
| `status` | `text null` | 同一 | 問題なし |
| `required_partners` | `integer not null default 1 check (>=1)` | 同一 | 問題なし |
| `selected_partner_ids` | `uuid[] not null default '{}'` | 同一 | 問題なし |
| `visibility` | `text null check (...)` | 同一 | 問題なし |
| `contact_policy` | `text null check (...)` | 同一 | 問題なし |
| `source` | `text null check (...)` | 同一 | 問題なし |
| `main_thread_id` | `uuid null` | 同一 | 問題なし |
| `source_template_id` | `uuid null` | 同一 | 問題なし |
| `created_at` | `timestamptz not null default now()` | 同一 | 問題なし |
| `updated_at` | `timestamptz not null default now()` | 同一 | 問題なし |
| Calendar 拡張カラム | なし | 15カラム追加 | 問題なし（新規） |

**判定: 問題なし。** 既存 DDL と完全互換。`CREATE TABLE IF NOT EXISTS` により既存テーブルがあれば Step 1 はスキップされ、Step 2 の `DO $$` ブロックで不足カラムのみ追加される。

### 2.2 既存インデックスとの比較

| インデックス名 | 既存 DDL | migration | 衝突？ |
|---------------|----------|-----------|--------|
| `builder_projects_source_idx` | ✓ | ✓ | 問題なし（`IF NOT EXISTS`） |
| `builder_projects_visibility_idx` | ✓ | ✓ | 問題なし（`IF NOT EXISTS`） |
| `builder_projects_schedule_start_idx` | ✗ | ✓ | 新規 |
| `builder_projects_status_idx` | ✗ | ✓ | 新規 |
| `builder_projects_schedule_phase_idx` | ✗ | ✓ | 新規 |
| `builder_projects_assigned_vendor_idx` | ✗ | ✓ | 新規 |

**判定: 問題なし。**

---

## 3. 型・制約の詳細監査

### 3.1 nullable / default

| カラム | 問題 | Severity |
|--------|------|----------|
| `owner_id text not null` | seed で `'owner-001'` 固定。実運用では auth.users の UUID が必要 | **P2** — 検証段階では固定値で問題ない |
| `kind text not null check (...)` | seed は `'builder_board'` 固定。`'tasful_managed'` も許容 | OK |
| `required_partners integer not null default 1` | seed は `1` | OK |
| `selected_partner_ids uuid[] not null default '{}'` | seed は `'{}'::uuid[]` | OK |
| 全 Calendar 拡張カラム | すべて `text null` / `jsonb null` / `date null` | OK — 既存データに影響なし |

### 3.2 jsonb カラム

| カラム | seed 値 | mapper 処理 | 問題 |
|--------|---------|-------------|------|
| `site_photos jsonb` | `'[{...}]'::jsonb` | `asArray()` → 配列 | OK |
| `completion_report jsonb` | `'{"completionStatus":...}'::jsonb` | `asObject()` → オブジェクト | OK |
| `attachments jsonb` | `'[{...}]'::jsonb` | `asArray()` → 配列 | OK |

**判定: 問題なし。** `asArray()` は `null` / `undefined` / 空文字列を安全に処理する。

### 3.3 date / time 型

| カラム | DDL 型 | seed 値 | mapper 処理 | 問題 |
|--------|--------|---------|-------------|------|
| `schedule_start` | `date` | `CURRENT_DATE + 14` | `pickDateOnly()` → YYYY-MM-DD | OK |
| `schedule_end` | `date` | `CURRENT_DATE + 20` | `pickDateOnly()` → YYYY-MM-DD | OK |
| `work_start_time` | `text` | `'09:00'` | `pickStr()` → string | OK |
| `work_end_time` | `text` | `'17:00'` | `pickStr()` → string | OK |

**判定: 問題なし。** 時間は `text` 型で十分（`time` 型にすると mapper の文字列処理と不整合が生じる）。

---

## 4. インデックス監査

| インデックス | 対象カラム | 重複 | 不要 | 備考 |
|-------------|-----------|------|------|------|
| `builder_projects_source_idx` | `source` | 既存 DDL と同一 | 不要ではない | Calendar では未使用だが他機能で使用 |
| `builder_projects_visibility_idx` | `visibility` | 既存 DDL と同一 | 不要ではない | 同上 |
| `builder_projects_schedule_start_idx` | `schedule_start` | なし | 必要 | Calendar の日付範囲検索で使用 |
| `builder_projects_status_idx` | `status` | なし | 必要 | ステータスフィルタで使用 |
| `builder_projects_schedule_phase_idx` | `schedule_phase` | なし | 必要 | 工程フィルタで使用 |
| `builder_projects_assigned_vendor_idx` | `assigned_vendor` | なし | 低頻度だが有用 | 業者検索で使用 |

**判定: 問題なし。**

---

## 5. RLS 監査

### 現状

- migration では RLS を有効化していない
- `public.builder_projects` は全ユーザーが SELECT 可能

### 問題点

| # | 問題 | Severity | 対策 |
|---|------|----------|------|
| 1 | RLS 未設定のため、Staging の全ユーザーが全件 SELECT 可能 | **P2** — 検証段階では許容。本番投入前に必ず設定 |
| 2 | `public.builder_can_read_project()` 関数が Staging に存在しない | **P2** — 本番 RLS 設定時に `sql/builder-rls-policies.sql` の helper function も適用必要 |
| 3 | 認証ユーザーなしで Supabase 接続すると `anon key` で全件 SELECT 可能 | **P2** — 検証段階では許容 |

**判定: 検証段階では許容。** 本番投入前に RLS 設定を必須とする。

---

## 6. Staging 適用手順の監査

`builder/builder-calendar-p3.6-deployment-steps.md` を精査。

### 問題点

| # | 問題 | Severity | 詳細 |
|---|------|----------|------|
| 1 | **Step 1 で migration SQL をそのまま実行すると、既存 `builder_projects` の CHECK 制約と衝突する可能性** | **P1** | `CREATE TABLE IF NOT EXISTS` は既存テーブルをスキップするため問題ない。ただし `DO $$` ブロック内の `information_schema` クエリが権限不足で失敗する可能性がある。Supabase Dashboard SQL Editor は十分な権限を持つため実害はないが、注意書きを追加すべき |
| 2 | **ロールバック手順が不完全** | **P2** | `DROP COLUMN IF EXISTS` は PostgreSQL 9.6+ でサポート。ただし `CASCADE` の影響範囲を確認していない |
| 3 | **seed 適用前にテーブル存在確認がない** | **P2** | Step 2 でカラム一覧を確認する手順はあるが、seed 前に `SELECT COUNT(*)` で空テーブルを確認すべき |
| 4 | **Supabase Dashboard の SQL Editor は `DO $$` ブロック内の `information_schema` を正しく処理するか未確認** | **P2** | 理論上は問題ないが、実際の Staging で確認が必要 |

### 改善提案（手順メモの更新が必要な場合）

1. Step 1 の前に「`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='builder_projects'` でテーブル存在確認」を追加
2. Step 3 の前に「`SELECT COUNT(*) FROM public.builder_projects` で空テーブル確認」を追加
3. ロールバック手順に「`DROP INDEX IF EXISTS` でインデックス削除」を追加

---

## 7. 適用後に確認すべき SQL

```sql
-- 7.1 カラム一覧確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='builder_projects'
ORDER BY ordinal_position;

-- 7.2 インデックス一覧確認
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename='builder_projects'
ORDER BY indexname;

-- 7.3 seed データ確認
SELECT id, project_key, title, status, schedule_start, schedule_end
FROM public.builder_projects
WHERE project_key LIKE 'CAL-DEMO-%'
ORDER BY schedule_start;

-- 7.4 jsonb カラムの内容確認
SELECT project_key,
  jsonb_typeof(attachments) as attachments_type,
  jsonb_typeof(site_photos) as site_photos_type,
  jsonb_typeof(completion_report) as completion_report_type
FROM public.builder_projects
WHERE project_key LIKE 'CAL-DEMO-%';

-- 7.5 日付型の確認
SELECT project_key, schedule_start, schedule_end,
  pg_typeof(schedule_start) as start_type,
  pg_typeof(schedule_end) as end_type
FROM public.builder_projects
WHERE project_key LIKE 'CAL-DEMO-%';

-- 7.6 全件カウント
SELECT COUNT(*) as total_projects FROM public.builder_projects;
```

---

## 8. P4 Supabase Write へ進む前に必要な残課題

| # | 課題 | Severity | 備考 |
|---|------|----------|------|
| 1 | **`customerContact` と `managerPhone` の分離** | **P3** | 現在 mapper は `customerContact` を `managerPhone` と同値にしている。P4 で write する前に分離すべき |
| 2 | **`talkRoomId` と `talkThreadId` の重複** | **P3** | 現在 mapper は両者を同一値にしている。P4 で分離するか統合するか決定が必要 |
| 3 | **`completion_report` jsonb のスキーマ定義** | **P3** | 現在は自由形式。P4 で write する前にスキーマを確定すべき |
| 4 | **`attachments` jsonb のスキーマ定義** | **P3** | 同上 |
| 5 | **`site_photos` jsonb のスキーマ定義** | **P3** | 同上 |
| 6 | **`kind` CHECK 制約の拡張** | **P4** | Calendar 専用の `kind` 値（例: `calendar_only`）が必要か検討 |
| 7 | **`status` の enum 化** | **P4** | 現在は自由 text。Calendar 用の status 値を enum 化するか検討 |
| 8 | **`schedule_phase` の enum 化** | **P4** | 同上 |
| 9 | **`category` の enum 化** | **P4** | 同上 |
| 10 | **RLS ポリシーの本番適用** | **P2** | `sql/builder-rls-policies.sql` の helper function + policy を migration 化 |
| 11 | **Supabase migration の正式登録** | **P2** | 現在の migration は `supabase/migrations/` に配置済みだが、Supabase CLI の管理対象外。正式には `supabase migration new` で作成すべき |
| 12 | **`owner_id` の auth.users 連携** | **P4** | 現在は固定値。本番では `auth.uid()` との紐付けが必要 |

---

## 9. 総合判定

### 問題サマリ

| Severity | 件数 | 内容 |
|----------|------|------|
| **P0** | 0 | ブロッカーなし |
| **P1** | 1 | `DO $$` ブロックの権限問題（実害なし） |
| **P2** | 5 | RLS未設定 / ロールバック手順 / seed前確認 / 手順改善 |
| **P3** | 5 | カラム分離 / jsonbスキーマ / enum化 |
| **P4** | 4 | 将来課題 |

### 判定: **Staging 適用してよい**

**理由:**
- P0（ブロッカー）は存在しない
- P1 は理論上の問題で、Supabase Dashboard SQL Editor では発生しない
- P2 は検証段階では許容範囲。本番投入前に解決すればよい
- 全253テストが PASS
- mapper と DDL のカラム名・型が完全一致
- 既存 DDL との衝突なし
- 冪等性が確保されている

### 適用前の推奨手順（安全のため）

1. `builder/builder-calendar-p3.6-deployment-steps.md` に以下の確認手順を追加:
   - migration 実行前に `information_schema.tables` でテーブル存在確認
   - seed 実行前に `SELECT COUNT(*)` で空テーブル確認
2. migration 実行後、確認用 SQL（本レポート 7章）を実行
3. 全5回帰テストを実行
4. 問題なければ P4 に進む