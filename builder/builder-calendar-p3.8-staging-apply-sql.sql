-- ============================================================
-- Builder Calendar P3.8 — Staging 適用 SQL（全ステップ）
--
-- 対象: Staging Supabase ahlxuyvhzqdqaojiywmu
-- 適用方法: Supabase Dashboard → SQL Editor に貼り付け
--
-- 注意:
--   **本番DBには絶対に適用しないこと**
--   RLS は有効化しない（検証段階）
--   各ステップは SELECT で確認後に次に進む
-- ============================================================

-- ============================================================
-- STEP 1: migration 適用
-- ============================================================
-- 以下を実行

-- ---------- migration start ----------
create table if not exists public.builder_projects (
  id uuid primary key default gen_random_uuid(),
  project_key text unique,
  owner_id text not null,
  title text not null,
  kind text not null check (kind in ('builder_board','tasful_managed')),
  status text null,
  required_partners integer not null default 1 check (required_partners >= 1),
  selected_partner_ids uuid[] not null default '{}'::uuid[],
  visibility text null check (visibility in ('public','private','partner_only','team_only')),
  contact_policy text null check (contact_policy in ('tasful_talk_only','owner_allowed','admin_only')),
  source text null check (source in ('tasful','company','partner','public_user')),
  main_thread_id uuid null,
  source_template_id uuid null,
  customer_name text null,
  customer_contact text null,
  assigned_vendor text null,
  site_address text null,
  site_photos jsonb null,
  schedule_start date null,
  schedule_end date null,
  schedule_phase text null,
  work_start_time text null,
  work_end_time text null,
  manager_name text null,
  manager_phone text null,
  talk_room_id text null,
  talk_thread_id text null,
  completion_report jsonb null,
  attachments jsonb null,
  memo text null,
  category text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='customer_name') then alter table public.builder_projects add column customer_name text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='customer_contact') then alter table public.builder_projects add column customer_contact text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='assigned_vendor') then alter table public.builder_projects add column assigned_vendor text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='site_address') then alter table public.builder_projects add column site_address text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='site_photos') then alter table public.builder_projects add column site_photos jsonb null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='schedule_start') then alter table public.builder_projects add column schedule_start date null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='schedule_end') then alter table public.builder_projects add column schedule_end date null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='schedule_phase') then alter table public.builder_projects add column schedule_phase text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='work_start_time') then alter table public.builder_projects add column work_start_time text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='work_end_time') then alter table public.builder_projects add column work_end_time text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='manager_name') then alter table public.builder_projects add column manager_name text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='manager_phone') then alter table public.builder_projects add column manager_phone text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='talk_room_id') then alter table public.builder_projects add column talk_room_id text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='talk_thread_id') then alter table public.builder_projects add column talk_thread_id text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='completion_report') then alter table public.builder_projects add column completion_report jsonb null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='attachments') then alter table public.builder_projects add column attachments jsonb null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='memo') then alter table public.builder_projects add column memo text null; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='builder_projects' and column_name='category') then alter table public.builder_projects add column category text null; end if;
end $$;

create index if not exists builder_projects_source_idx on public.builder_projects (source);
create index if not exists builder_projects_visibility_idx on public.builder_projects (visibility);
create index if not exists builder_projects_schedule_start_idx on public.builder_projects (schedule_start);
create index if not exists builder_projects_status_idx on public.builder_projects (status);
create index if not exists builder_projects_schedule_phase_idx on public.builder_projects (schedule_phase);
create index if not exists builder_projects_assigned_vendor_idx on public.builder_projects (assigned_vendor);
-- ---------- migration end ----------

-- ============================================================
-- STEP 1 確認: カラム一覧
-- ============================================================
-- 以下を SELECT タブで実行
/*
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='builder_projects'
ORDER BY ordinal_position;
*/

-- ============================================================
-- STEP 1 確認: インデックス一覧
-- ============================================================
/*
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename='builder_projects'
ORDER BY indexname;
*/

-- ============================================================
-- STEP 2: seed データ投入
-- ============================================================
-- 以下を実行（Step 1 成功後に）
-- ---------- seed start ----------
INSERT INTO public.builder_projects (
  id, project_key, owner_id, title, kind, status, required_partners,
  selected_partner_ids, visibility, category, customer_name, customer_contact,
  site_address, assigned_vendor, schedule_start, schedule_end, schedule_phase,
  work_start_time, work_end_time, manager_name, manager_phone,
  talk_room_id, talk_thread_id, memo, completion_report, attachments, site_photos,
  created_at, updated_at
) VALUES
(
  'a0000000-0000-0000-0000-000000000001',
  'CAL-DEMO-001',
  'owner-001',
  '世田谷区 戸建 外壁補修（Supabase）',
  'builder_board',
  'estimating',
  1,
  '{}'::uuid[],
  'public',
  'exterior',
  '田中 様',
  '03-1234-5678',
  '東京都世田谷区 1-2-3',
  '株式会社イワショウリフォーム',
  CURRENT_DATE + 14,
  CURRENT_DATE + 20,
  'estimate',
  '09:00',
  '17:00',
  '鈴木 現場監督',
  '090-1111-2222',
  'builder-cal-CAL-DEMO-001',
  'builder-cal-CAL-DEMO-001',
  '外壁ひび・塗装剥離。現調済み。（Supabase seed）',
  '{"completionStatus": "not_started", "completionMemo": "", "startedAt": "", "completedAt": "", "handoverAt": ""}'::jsonb,
  '[{"id": "a1", "type": "drawing", "title": "外壁展開図", "filename": "elevation-plan.pdf"}, {"id": "a2", "type": "estimate", "title": "見積書", "filename": "estimate-001.pdf"}]'::jsonb,
  '[{"id": "sph1", "label": "施工前写真", "url": "", "at": "2026-07-01"}]'::jsonb,
  NOW() - INTERVAL '14 days',
  NOW() - INTERVAL '2 days'
),
(
  'a0000000-0000-0000-0000-000000000002',
  'CAL-DEMO-002',
  'owner-001',
  '横浜市 マンション 水回りリフォーム（Supabase）',
  'builder_board',
  'in_progress',
  1,
  '{}'::uuid[],
  'public',
  'wet_area',
  '佐藤 様',
  '045-987-6543',
  '神奈川県横浜市中区本町 4-5-6',
  '（未アサイン）',
  CURRENT_DATE + 2,
  CURRENT_DATE + 9,
  'construction',
  '10:00',
  '16:00',
  '佐藤 様',
  '045-987-6543',
  'builder-cal-CAL-DEMO-002',
  'builder-cal-CAL-DEMO-002',
  'キッチン・浴室同時リフォーム。着工済み。',
  '{"completionStatus": "working", "completionMemo": "キッチン解体着手。浴室は来週予定。", "startedAt": "2026-07-02", "completedAt": "", "handoverAt": ""}'::jsonb,
  '[{"id": "b1", "type": "drawing", "title": "水回り平面図", "filename": "wet-area-plan.pdf"}, {"id": "b2", "type": "memo", "title": "打合せメモ", "filename": "meeting-memo.txt"}]'::jsonb,
  '[{"id": "sph2", "label": "キッチン解体前", "url": "", "at": "2026-07-01"}]'::jsonb,
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '1 day'
),
(
  'a0000000-0000-0000-0000-000000000003',
  'CAL-DEMO-003',
  'owner-001',
  '大阪市 店舗 内装工事（Supabase）',
  'builder_board',
  'completed',
  1,
  '{}'::uuid[],
  'public',
  'interior',
  '山本商事',
  '06-1234-5678',
  '大阪府大阪市中央区本町 1-2-3',
  '関西内装工業',
  CURRENT_DATE - 20,
  CURRENT_DATE - 2,
  'completed_work',
  '08:30',
  '17:30',
  '山本 太郎',
  '06-1234-5678',
  'builder-cal-CAL-DEMO-003',
  'builder-cal-CAL-DEMO-003',
  '店舗内装工事完了。施工週次報告あり。',
  '{"completionStatus": "completed", "completionMemo": "内装仕上げ完了。最終検査済み。", "startedAt": "2026-06-14", "completedAt": "2026-07-01", "handoverAt": ""}'::jsonb,
  '[{"id": "c1", "type": "photo", "title": "竣工写真", "filename": "storefront-complete.jpg"}, {"id": "c2", "type": "invoice", "title": "請求書", "filename": "invoice-003.pdf"}]'::jsonb,
  '[{"id": "sph3", "label": "竣工写真（正面）", "url": "", "at": "2026-07-01"}, {"id": "sph4", "label": "竣工写真（内装）", "url": "", "at": "2026-07-01"}]'::jsonb,
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '0 days'
);
-- ---------- seed end ----------

-- ============================================================
-- STEP 2 確認: seed データ確認
-- ============================================================
-- 以下を SELECT タブで実行
/*
SELECT id, project_key, title, status, schedule_start, schedule_end
FROM public.builder_projects
WHERE project_key LIKE 'CAL-DEMO-%'
ORDER BY schedule_start;
*/

-- ============================================================
-- STEP 2 確認: jsonb 型確認
-- ============================================================
/*
SELECT project_key,
  jsonb_typeof(attachments) as attachments_type,
  jsonb_typeof(site_photos) as site_photos_type,
  jsonb_typeof(completion_report) as completion_report_type
FROM public.builder_projects
WHERE project_key LIKE 'CAL-DEMO-%';
*/

-- ============================================================
-- STEP 2 確認: 日付型確認
-- ============================================================
/*
SELECT project_key, schedule_start, schedule_end,
  pg_typeof(schedule_start) as start_type,
  pg_typeof(schedule_end) as end_type
FROM public.builder_projects
WHERE project_key LIKE 'CAL-DEMO-%';
*/

-- ============================================================
-- STEP 2 確認: 全件カウント
-- ============================================================
/*
SELECT COUNT(*) as total_projects FROM public.builder_projects;
*/