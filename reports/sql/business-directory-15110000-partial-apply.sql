-- =============================================================================
-- Business Directory — 20260715110000 PARTIAL APPLY（view 除外 · Runbook 付録正本）
-- =============================================================================
--
-- ソース migration:
--   supabase/migrations/20260715110000_business_directory_content_update.sql
--
-- 用途:
--   Phase 2a（20260717120000）が **既に適用済** で 15110000 が **未適用** の環境
--   典型: Production ref ddojquacsyqesrjhcvmn（migration 順序ドリフト）
--
-- Runbook 参照:
--   reports/business-directory-production-controlled-apply-runbook.md
--   reports/business-directory-dependent-migrations-production-readiness.md
--   reports/business-directory-dependency-migration-audit.md
--
-- 適用ルール（監査正本）:
--   | Migration   | Phase 2a 済み環境     | Greenfield（2a 未適用）   |
--   |-------------|----------------------|--------------------------|
--   | 15110000    | **partial のみ（本ファイル）** | migration ファイル full 可 |
--   | 15110000    | **full apply 禁止**（view regress） | —                        |
--   | 16100000    | **full apply 可**     | full apply 可            |
--
-- DO NOT RUN automatically. DBA/Ops · maintenance window · 人手承認のみ。
-- Agents / CI は本ファイルを実行しない。
--
-- partial apply 後の手順:
--   1. § VERIFY — SELECT のみ（Phase 2a view 6 列必須）
--   2. supabase/migrations/20260716100000_…sql を **full apply**
--   3. supabase migration repair --status applied 20260715110000（DBA 判断）
--   4. Production smoke（runbook §6）
--
-- =============================================================================
-- § INCLUDED — 15110000 から抽出（table / column / index / RLS / grant / comment）
-- =============================================================================
--   [A] business_directory_pending_updates テーブル + PK/FK 制約
--   [B] COMMENT ON TABLE
--   [C] idx_business_directory_pending_updates_updated インデックス
--   [D] business_directory_review_requests.published_snapshot_json 列
--   [E] COMMENT ON COLUMN
--   [F] RLS ENABLE（pending_updates）
--   [G] REVOKE anon/authenticated + GRANT service_role
--
-- 元 migration に **存在しない** ため本 snippet にも含めない:
--   - triggers
--   - functions / RPCs
--   - named RLS policies（pending_updates は RLS ON + revoke/grant のみ · 設計意図）
--
-- =============================================================================
-- § SKIPPED — view block（Phase 2a 済み環境では **必ず除外**）
-- =============================================================================
--   [SKIP-1] CREATE OR REPLACE VIEW business_directory_listings_public（15110000 行 22–43）
--   [SKIP-2] COMMENT ON VIEW（15110000 行 45–46）
--
-- 除外理由:
--   15110000 の view は Phase 2a 以前の定義。CREATE OR REPLACE すると以下が **消失**:
--     short_description, full_description, seo_title, meta_description,
--     faq_items, recommended_uses
--   Phase 2a view（17120000）は content_update 可視性ルールを **既に含む**:
--     WHERE l.status = 'published'
--        OR (l.status = 'review_requested' AND l.published_at IS NOT NULL)
--   → view 変更なしで content_update は成立する。
--
-- ---------------------------------------------------------------------------
-- [SKIP-1] 以下は **実行禁止**（監査用 · 元 migration 行 22–43 の写し）
-- ---------------------------------------------------------------------------
-- create or replace view public.business_directory_listings_public as
-- select
--   l.id, l.listing_type, l.plan_code, l.category_id, l.display_name, l.slug,
--   l.service_areas, l.hp_mode, l.website_url, l.published_at,
--   p.company_name, p.short_description, p.full_description, p.prefecture, p.city
-- from public.business_directory_listings l
-- join public.business_directory_profiles p on p.listing_id = l.id
-- where l.status = 'published'
--    or (l.status = 'review_requested' and l.published_at is not null);
--
-- ---------------------------------------------------------------------------
-- [SKIP-2] 以下は **実行禁止**（元 migration 行 45–46）
-- ---------------------------------------------------------------------------
-- comment on view public.business_directory_listings_public is
--   'Business Directory: anon-safe published listing metadata (incl. content_update review)';
--
-- =============================================================================
-- § APPLY — 実行可能 DDL（Dashboard SQL Editor または db query -f · 上記 APPLY ブロックのみ）
-- =============================================================================


-- [A] Table + constraints
create table if not exists public.business_directory_pending_updates (
  listing_id uuid primary key references public.business_directory_listings (id) on delete cascade,
  content_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- [B] Table comment
comment on table public.business_directory_pending_updates is
  'Owner draft for published listings (content_update). Applied on ops approve; discarded on reject.';

-- [C] Index
create index if not exists idx_business_directory_pending_updates_updated
  on public.business_directory_pending_updates (updated_at desc);

-- [D] Column
alter table public.business_directory_review_requests
  add column if not exists published_snapshot_json jsonb not null default '{}'::jsonb;

-- [E] Column comment
comment on column public.business_directory_review_requests.published_snapshot_json is
  'Live public snapshot at content_update submit (audit / ops compare).';

-- [F] RLS
alter table public.business_directory_pending_updates enable row level security;

-- [G] Grants（named policy なし · Edge は service_role）
revoke all on table public.business_directory_pending_updates from anon, authenticated;
grant all on table public.business_directory_pending_updates to service_role;


-- =============================================================================
-- § VERIFY — Post-apply（SELECT ONLY · partial apply 直後 · 16100000 前に必須）
-- =============================================================================
-- いずれか FAIL → 16100000 に進まない · rollback 判断（§ ROLLBACK）
--
-- V1 pending_updates テーブル存在
-- select exists (
--   select 1 from information_schema.tables
--   where table_schema = 'public' and table_name = 'business_directory_pending_updates'
-- ) as pending_updates_exists;
-- Expected: true
--
-- V2 pending_updates 列
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'business_directory_pending_updates'
-- order by ordinal_position;
-- Expected: listing_id · content_json · updated_at
--
-- V3 published_snapshot_json 列
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'business_directory_review_requests'
--   and column_name = 'published_snapshot_json';
-- Expected: 1 row · jsonb · NOT NULL · default '{}'
--
-- V4 インデックス
-- select indexname from pg_indexes
-- where schemaname = 'public' and tablename = 'business_directory_pending_updates'
--   and indexname = 'idx_business_directory_pending_updates_updated';
-- Expected: 1 row
--
-- V5 RLS 有効
-- select c.relrowsecurity as rls_enabled from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'business_directory_pending_updates';
-- Expected: true
--
-- V6 named policy なし（0 行 · 設計通り）
-- select polname from pg_policy pol
-- join pg_class c on c.oid = pol.polrelid
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'business_directory_pending_updates';
-- Expected: 0 rows
--
-- V7 Phase 2a public view 列維持（CRITICAL — 6 行必須）
-- select column_name
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'business_directory_listings_public'
--   and column_name in (
--     'short_description', 'full_description',
--     'seo_title', 'meta_description', 'faq_items', 'recommended_uses'
--   )
-- order by column_name;
-- Expected: 6 rows
-- FAIL（6 未満）→ 15110000 full 誤 apply 疑い · § EMERGENCY
--
-- V8 content_update 可視性ルール（view 定義内）
-- select
--   pg_get_viewdef('public.business_directory_listings_public'::regclass, true) like '%review_requested%'
--   and pg_get_viewdef('public.business_directory_listings_public'::regclass, true) like '%published_at%';
-- Expected: true
--
-- V9（任意）17120000 migration 履歴
-- select version from supabase_migrations.schema_migrations where version = '20260717120000';
-- Expected: 1 row


-- =============================================================================
-- § ROLLBACK — 判断メモ + 例示 SQL（コメントアウトのみ · 実行禁止）
-- =============================================================================
--
-- 検討タイミング:
--   - VERIFY V7 が 6 未満（view regress）
--   - content_update smoke 多数 FAIL（原因が pending DDL の場合）
--
-- partial rollback で失うデータ:
--   - business_directory_pending_updates 全行（進行中 content_update）
--   - published_snapshot_json 列データ（列 drop 時）
--   - Phase 2a view / profiles: **本 partial では変更しない**
--
-- Step R1 — pending_updates 削除
-- -- EXAMPLE ONLY — DO NOT EXECUTE WITHOUT DBA APPROVAL
-- -- drop table if exists public.business_directory_pending_updates;
--
-- Step R2 — published_snapshot_json 列削除
-- -- EXAMPLE ONLY — DO NOT EXECUTE WITHOUT DBA APPROVAL
-- -- alter table public.business_directory_review_requests
-- --   drop column if exists published_snapshot_json;
--
-- Step R3 — migration history（任意）
-- -- npx supabase migration repair --status reverted 20260715110000
--
-- Phase 2a view は rollback 対象外（SSOT = 17120000）
--
-- ---------------------------------------------------------------------------
-- § EMERGENCY — 15110000 full 誤 apply（view regress）時のみ
-- ---------------------------------------------------------------------------
-- 症状: VERIFY V7 が 6 未満
-- 回復: supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql
--       行 21–52（DROP VIEW + CREATE VIEW + GRANT）を再実行
-- pending_updates / published_snapshot_json は維持可 · VERIFY V7 再実行


-- =============================================================================
-- § NEXT — 16100000（full apply 可 · 本ファイルの対象外）
-- =============================================================================
-- ファイル: supabase/migrations/20260716100000_business_directory_ai_draft_usage.sql
-- 方式: 全文 apply（view 変更なし · partial 不要）
-- 詳細: reports/business-directory-production-controlled-apply-runbook.md §5.4


-- =============================================================================
-- END — reports/sql/business-directory-15110000-partial-apply.sql
-- =============================================================================
