# Builder Calendar P3.5 — Supabase 実データ read 検証準備（スキーマ計画）

> 本ファイルは設計計画。
> **本番/Staging DB への DDL 適用は禁止。**
> `builder/builder-supabase-schema-notes.md` · `sql/builder-schema.sql` を正本とし、
> Calendar read に最低限必要な表のみ抽出する。

---

## 1. 調査結果サマリー

### 調査した schema / migration / docs

| ファイル | 内容 |
|----------|------|
| `sql/builder-schema.sql` | Builder 全体の DDL（11テーブル）— 設計のみ、未実行 |
| `sql/builder-rls-policies.sql` | RLS ポリシー案 — 未実行 |
| `sql/builder-storage-policies.sql` | Storage ポリシー案 — 未実行 |
| `builder/builder-supabase-schema-notes.md` | スキーマ設計ノート（列定義・リレーション・enum） |
| `builder/builder-supabase-execution-checklist.md` | 実行前チェックリスト |
| `builder/builder-project-calendar-supabase.js` | Calendar 用 Supabase read adapter（既存 mapper） |
| `builder/builder-project-store.js` | Calendar 用 Store（localStorage + Demo fallback） |
| `scripts/test-builder-calendar-p3-supabase.mjs` | P3 テスト（mapper unit + Playwright） |
| `builder/builder-project-hub.js` | Project Hub |
| `supabase/migrations/` | 全 migration（Builder 用マイグレーションは未存在） |

### Builder 用の Supabase migration は未存在

`supabase/migrations/` ディレクトリには Builder 関連の migration は**ひとつもない**。
既存 DDL は `sql/builder-schema.sql` に設計として存在するのみで、**Supabase に適用された実績はない**。

---

## 2. Calendar read に必要なテーブル

現在の mapper (`builder-project-calendar-supabase.js`) は `TABLE_CANDIDATES = ["builder_projects", "builder_project_hub"]` を順に試行する。

### 推奨テーブル名: `builder_projects`

`sql/builder-schema.sql` に DDL が存在し、schema notes で最も完成度が高い。

| テーブル | 推奨 | 理由 |
|----------|------|------|
| `builder_projects` | **◎ 採用** | DDL 完成度高、mapper が想定済み |
| `builder_project_hub` | ✗ 未定義 | schema notes / sql DDL に存在しない。Mapper は candidate に含むが fallback 扱い |

### 決定: `builder_projects` をカレンダー read の唯一のテーブルとする

---

## 3. 必要カラム（Calendar read 最低限）

### mapper が参照するカラム一覧

| mapper プロパティ | 読み取り元カラム（優先順） | DDL に存在？ | 備考 |
|---|---|---|---|
| `id` | `id`, `project_id` | 設計: `id uuid PK` | DDL に `project_key text` あり |
| `name` | `title`, `name`, `project_name` | DDL: `title text not null` | ↑ |
| `customerName` | `customer_name`, `company_name`, `client_name` | **不在** | DDL に顧客名列なし |
| `assignedVendor` | `assigned_vendor`, `vendor_name`, `company_name` | **不在** | DDL に業者列なし |
| `status` | `status`, `project_status` | DDL: `status text null` | ✓ |
| `scheduleStartDate` | `schedule_start`, `start_date` | **不在** | DDL に日程列なし |
| `scheduleEndDate` | `schedule_end`, `end_date` | **不在** | DDL に日程列なし |
| `workStartTime` | `work_start_time`, `start_time` | **不在** | DDL に時間列なし |
| `workEndTime` | `work_end_time`, `end_time` | **不在** | DDL に時間列なし |
| `siteAddress` | `address`, `site_address`, `location` | **不在** | DDL に住所列なし |
| `managerName` | `contact_name`, `manager_name` | **不在** | DDL に担当者列なし |
| `managerPhone` | `contact_phone`, `manager_phone`, `phone` | **不在** | DDL に電話番号なし |
| `talkRoomId` | `talk_room_id`, `talk_thread_id`, `thread_id` | **不在** | DDL に talk 関連列なし |
| `talkThreadId` | 同上 | **不在** | DDL に talk 関連列なし |
| `memo` | `memo`, `note`, `notes` | **不在** | DDL にメモ列なし |
| `attachments` | `attachments`, `documents` | **不在** | jsonb 列追加必要 |
| `sitePhotos` | `site_photos`, `photos` | **不在** | jsonb 列追加必要 |
| `completionReport` | `completion_report`, `completion` | **不在** | jsonb 列追加必要 |
| `schedulePhase` | `schedule_phase`, `phase` | **不在** | 工程列なし |
| `category` | `category`, `category_id` | **不在** | カテゴリ列なし |
| `createdAt` | `created_at` | DDL: `created_at timestamptz` | ✓ |
| `updatedAt` | `updated_at` | DDL: `updated_at timestamptz` | ✓ |

### 結論

**既存 DDL (`sql/builder-schema.sql`) の `builder_projects` は Calendar read に必要なカラムを大幅に欠いている。**

これは `sql/builder-schema.sql` が Builder Board / 案件管理全体を対象として設計されたため、
Calendar 画面向けの現場情報・日程・添付・写真系カラムが含まれていない。

---

## 4. 候補: Calendar read 拡張 DDL

以下の2案を比較する。

### 案A: `builder_projects` にカラム追加（推奨）

既存 DDL に Calendar 用カラムを追加する。
これにより `TABLE_CANDIDATES[0]` で完結する。

```sql
-- === Calendar read 用カラム追加（builder_projects）===
-- DDL: ALTER TABLE public.builder_projects ADD COLUMN ... 

-- 顧客情報
customer_name     text null;          -- 顧客名
customer_contact  text null;          -- 顧客連絡先

-- 現場情報
site_address      text null;          -- 現場住所
site_photos       jsonb null;         -- 現場写真メタ配列 [{id, label, url, at}]

-- 作業情報
work_start_time   text null;          -- 作業開始時間 "09:00"
work_end_time     text null;          -- 作業終了時間 "17:00"

-- 工程情報
schedule_phase    text null;          -- 工程フェーズ
schedule_start    date null;          -- 工事開始日
schedule_end      date null;          -- 工事終了日

-- 担当者情報
manager_name      text null;          -- 担当者名
manager_phone     text null;          -- 担当者電話番号

-- Talk連携
talk_room_id      text null;          -- Talk Room ID
talk_thread_id    text null;          -- Talk Thread ID

-- 完了報告（jsonb）
completion_report jsonb null;         -- 完了報告オブジェクト

-- 添付ファイル（jsonb）
attachments       jsonb null;         -- 添付ファイル配列 [{id, type, title, filename}]

-- その他
memo              text null;          -- メモ
category          text null;          -- カテゴリ
assigned_vendor   text null;          -- アサイン業者

-- Calendar read 用インデックス
create index if not exists builder_projects_schedule_start_idx
  on public.builder_projects (schedule_start);
create index if not exists builder_projects_status_idx
  on public.builder_projects (status);
create index if not exists builder_projects_schedule_phase_idx
  on public.builder_projects (schedule_phase);
```

### 案B: `builder_calendar_projects` 独立テーブル（非推奨）

新しいテーブルを作る。既存 DDL に影響しないが、保守が二重化する。

```sql
create table if not exists public.builder_calendar_projects (
  id uuid primary key default gen_random_uuid(),
  project_key text unique,

  -- 案件基本
  project_id uuid null,       -- builder_projects.id への参照（将来的に紐付け）
  title text not null,
  status text null,
  category text null,

  -- 顧客
  customer_name text null,
  customer_contact text null,

  -- 現場
  site_address text null,
  site_photos jsonb null,

  -- 日程
  schedule_start date null,
  schedule_end date null,
  schedule_phase text null,
  work_start_time text null,
  work_end_time text null,

  -- 担当者
  manager_name text null,
  manager_phone text null,

  -- Talk
  talk_room_id text null,
  talk_thread_id text null,

  -- 完了報告
  completion_report jsonb null,

  -- 添付
  attachments jsonb null,
  memo text null,
  assigned_vendor text null,

  -- 監査
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**判定: 案A（builder_projects 拡張）を推奨。**

理由:
- builder_projects が既存 DDL で定義済み
- 本番 DB に適用する前に 1テーブルの migration で済む
- 将来 builder_projects と統合する際に余計な移行が不要
- `TABLE_CANDIDATES` が `builder_projects` 1つで完結

---

## 5. 既存 schema との差分

| 観点 | 既存 DDL (`sql/builder-schema.sql`) | Calendar 追加案 |
|------|--------------------------------------|-----------------|
| テーブル | `builder_projects` | `builder_projects` に拡張 |
| 顧客情報 | なし | `customer_name`, `customer_contact` |
| 現場住所 | なし | `site_address` |
| 現場写真 | `builder_thread_photos`（別テーブル） | `site_photos jsonb`（簡易表示用） |
| 添付 | なし | `attachments jsonb`（簡易表示用） |
| 日程 | なし | `schedule_start date`, `schedule_end date` |
| 作業時間 | なし | `work_start_time text`, `work_end_time text` |
| 工程 | なし | `schedule_phase text` |
| 担当者 | なし | `manager_name`, `manager_phone` |
| Talk連携 | `main_thread_id uuid`（FK） | `talk_room_id text`, `talk_thread_id text` |
| 完了報告 | `builder_completion_reports`（別テーブル） | `completion_report jsonb`（簡易表示用） |
| メモ | なし | `memo text` |
| カテゴリ | なし | `category text` |
| 業者 | `selected_partner_ids uuid[]` | `assigned_vendor text` |

---

## 6. 将来 write に必要な DDL

Calendar から write（完了報告保存など）が必要な場合：

```sql
-- 完了報告の保存先
alter table public.builder_projects add column if not exists
  completion_report jsonb null;

-- 添付ファイルの保存先（本番は builder_thread_photos を正とする）
alter table public.builder_projects add column if not exists
  attachments jsonb null;

-- 現場写真の保存先（本番は builder_thread_photos を正とする）
alter table public.builder_projects add column if not exists
  site_photos jsonb null;
```

**注意:** `jsonb` 列への write はアトミックに行えるため、
完了報告 draft の保存は `UPDATE builder_projects SET completion_report = '...' WHERE id = ...` で可能。
ただし本番では `builder_completion_reports` テーブルへの正規化を推奨。

---

## 7. RLS 方針

`sql/builder-rls-policies.sql` に詳細なポリシーが設計済み。
Calendar read 用に最低限必要なポリシー：

```sql
-- builder_projects の SELECT は全認証ユーザーに許可（Calendar は owner/partner/admin すべてが使う）
-- 詳細な制御は builder_can_read_project() 関数を使用
create policy builder_projects_select_calendar
  on public.builder_projects
  for select
  using (public.builder_can_read_project(id));
```

**注意:** `public.builder_can_read_project()` は helper function で、
admin は全件、owner は自分のプロジェクト、partner は応募したプロジェクトを閲覧可。
Calendar が RLS で弾かれると空になるため、**適切な seed ユーザー認証が必須**。

---

## 8. localStorage fallback との関係

### 現状の fallback chain

```
Supabase fetch 試行
  ├─ 成功 + データあり → "supabase" mode
  ├─ 成功 + データなし → "demo_fallback" mode（localStorage Demo）
  └─ 失敗 → "demo_fallback" mode（localStorage Demo）
```

### P3.5 での変更点

P3.5 は「Supabase 実データ read 検証準備」であり、**実際の Supabase 接続は必要ない**。
以下の状態で mapper の動作確認ができる：

1. **Supabase 未接続（現状）** → `demo_fallback` で動作（既存動作）
2. **Supabase 接続 + テーブル作成済み** → `supabase` mode で動作（P3.5 seed データ）
3. **Supabase 接続 + テーブル未作成** → `demo_fallback`（既存動作）

### Attention

- localStorage Demo のデータ構造は `normalizeProject()` で整形済み
- Supabase mapper の出力も `normalizeProject()` を通るため、**両者の出力形式は一致**
- 切り替えは Store の `hydrateFromSupabase()` だけで完結

---

## 9. 危険点

| # | 危険点 | 対策 |
|---|--------|------|
| 1 | **Production DB への DDL push** | sql/builder-schema.sql は未実行。DB 操作はすべて禁止 |
| 2 | **mapper のカラム名ゆれ吸収が過剰** | `pickStr()` で多数の別名を許容 → 誤マッチングリスク。テストで検証 |
| 3 | **`jsonb` 列がないテーブルから read するとエラー** | Supabase は undefined_column エラーを返す → mapper は nullable を前提に `??` でガード |
| 4 | **RLS が有効な環境で空になる** | テーブルが存在しても RLS で 0 行 → demo_fallback。認証設定が必要 |
| 5 | **既存 migration との競合** | `supabase/migrations/` に Builder 用 migration がないため競合は当面ない |
| 6 | **Calendar 以外からの影響** | `builder_projects` は Builder Board など他機能からも使われる設計。変更時は全体影響を確認 |
| 7 | **Supabase MCP の制約** | 本リポジトリでは Supabase MCP は Staging read_only 限定。Migration は MCP 禁止 |

---

## 10. 次に実際 DB で検証する場合の手順

> **本番 DB には絶対に適用しないこと。**

1. **Staging DB を確認**
   - Supabase Dashboard → Staging (`ahlxuyvhzqdqaojiywmu`)
   - `builder_projects` テーブルが存在するか確認

2. **テーブルがなければ作成（手動 SQL）**
   - Supabase Dashboard の SQL Editor で以下を実行 (DDL案A)
   - `sql/builder-schema.sql` の `builder_projects` DDL + 本レポートの拡張カラム

3. **Seed データ投入（手動 SQL）**
   - `supabase/builder-calendar-p3.5-demo-seed.sql`（同梱の seed SQL ファイル）
   - Supabase SQL Editor で実行

4. **動作確認**
   - `npm run dev` 起動
   - `http://127.0.0.1:8788/builder/project-calendar.html` を開く
   - Store が `supabase` mode になることを確認
   - 案件が表示されることを確認

5. **回帰テスト実行**
   ```bash
   node scripts/test-builder-calendar-p3-supabase.mjs
   node scripts/test-builder-calendar-p2-talk.mjs
   node scripts/test-builder-calendar-p1-detail.mjs
   node scripts/test-builder-calendar-phase2.mjs
   node scripts/test-builder-calendar-phase3.mjs
   ```

---

## 11. 参考: mapper のカラム対応表（決定版）

| Supabase カラム | Type | mapper 読み取り | 必須 |
|----------------|------|----------------|------|
| `id` | uuid PK | `pickStr(r.id, r.project_id, r.projectId)` | Yes |
| `project_key` | text | (未使用) | No |
| `title` | text | `pickStr(r.title, r.name, r.project_name, r.projectName)` | Yes |
| `customer_name` | text | `pickStr(r.customer_name, r.customerName, r.company_name, r.companyName, r.client_name)` | No |
| `assigned_vendor` | text | `pickStr(r.assigned_vendor, r.assignedVendor, r.vendor_name, r.company_name)` | No |
| `status` | text | `pickStr(r.status, r.project_status)` | No |
| `schedule_start` | date | `pickDateOnly(r.schedule_start, r.schedule_start_date, r.scheduleStartDate, r.start_date, r.startDate)` | No |
| `schedule_end` | date | `pickDateOnly(r.schedule_end, r.schedule_end_date, r.scheduleEndDate, r.end_date, r.endDate)` | No |
| `work_start_time` | text | `pickStr(r.work_start_time, r.workStartTime, r.start_time)` | No |
| `work_end_time` | text | `pickStr(r.work_end_time, r.workEndTime, r.end_time)` | No |
| `site_address` | text | `pickStr(r.address, r.site_address, r.siteAddress, r.location)` | No |
| `manager_name` | text | `pickStr(r.contact_name, r.contactName, r.manager_name, r.managerName, ...)` | No |
| `manager_phone` | text | `pickStr(r.contact_phone, r.contactPhone, r.manager_phone, r.managerPhone, ...)` | No |
| `memo` | text | `pickStr(r.memo, r.note, r.notes)` | No |
| `talk_room_id` | text | `pickStr(r.talk_room_id, r.talkRoomId, r.talk_thread_id, r.talkThreadId, ...)` | No |
| `talk_thread_id` | text | 同上 | No |
| `schedule_phase` | text | `pickStr(r.schedule_phase, r.schedulePhase, r.phase)` | No |
| `category` | text | `pickStr(r.category, r.category_id)` | No |
| `attachments` | jsonb | `asArray(r.attachments ?? r.documents)` | No |
| `site_photos` | jsonb | `asArray(r.site_photos ?? r.sitePhotos ?? r.photos)` | No |
| `completion_report` | jsonb | `asObject(r.completion_report ?? r.completionReport ?? r.completion)` | No |
| `created_at` | timestamptz | `pickStr(r.created_at, r.createdAt)` | No |
| `updated_at` | timestamptz | `pickStr(r.updated_at, r.updatedAt)` | No |

---

## 12. 結論

- **推奨テーブル:** `builder_projects`（既存 DDL を拡張）
- **既存 DDL の不足:** Calendar 用カラム（日程・現場情報・Talk連携・jsonb添付）が全くない
- **DDL 適用:** 本レポートの案Aを migration として作成 → Staging に手動適用
- **Seed:** 同梱の seed SQL を使用
- **Mapper:** 現状の mapper は想定カラムを正しく定義済み。`pickStr()` と `asArray()/asObject()` で jsonb を吸収可能
- **LocalStorage との関係:** `normalizeProject()` が両者を統一。切り替えは Store の hydrate のみ