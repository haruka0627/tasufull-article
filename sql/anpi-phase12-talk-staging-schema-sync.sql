-- =============================================================================
-- ANPI Phase 12 — TALK Staging Schema Sync (human-reviewed apply package)
-- Target: staging project ref ahlxuyvhzqdqaojiywmu ONLY
-- =============================================================================
-- Purpose:
--   Create missing public.talk_notifications (+ index + production-hardening RLS)
--   so Phase 11 P0 (table missing) can be cleared after human review.
--
-- Canonical sources (priority):
--   1) sql/talk-sync-schema.sql          — table + index DDL
--   2) sql/talk-rls-production.sql       — helper + SELECT/UPDATE patterns
--   3) sql/talk-rls-drop-dev-policies.sql — must not leave *_dev policies
--   4) live-notify / Phase 10 assumptions — service_role write path
--
-- INTENTIONAL HARDENING vs production SSOT (documented):
--   - NO authenticated INSERT policies (production has insert_own + admin fanout)
--   - NO authenticated DELETE policy (production has delete_own)
--   - service_role remains the only internal create path (RLS bypass)
--   - NO Realtime publication changes (Phase 12 absolute: Realtime enable禁止)
--   - NO Push / webhook / trigger creation
--   - Does NOT create talk_ai_drafts / talk_broadcast_drafts / follow tables
--
-- Safety:
--   - Additive only: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
--   - DROP POLICY IF EXISTS only (never DROP TABLE / TRUNCATE / DELETE / UPDATE)
--   - No ALTER COLUMN destructive changes
--   - No production connection
--   - DO NOT auto-apply; human must review then run against staging only
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Preconditions: helpers must exist (Phase 11 confirmed on staging).
--    Recreate idempotently from SSOT (sql/talk-rls-production.sql / migration mirror).
-- ---------------------------------------------------------------------------
create or replace function public.talk_current_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(
    trim(
      coalesce(
        auth.jwt() ->> 'talk_user_id',
        auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
        auth.jwt() -> 'user_metadata' ->> 'talk_user_id',
        auth.jwt() ->> 'member_id',
        auth.jwt() -> 'app_metadata' ->> 'member_id',
        auth.jwt() ->> 'sub',
        auth.uid()::text
      )
    ),
    ''
  );
$$;

create or replace function public.talk_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'role', '') in ('tasu_admin', 'service_role', 'supabase_admin')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('tasu_admin', 'admin')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('tasu_admin', 'admin')
    or coalesce(auth.jwt() ->> 'tasu_admin', '') = 'true'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'tasu_admin', '') = 'true';
$$;

revoke all on function public.talk_current_user_id() from public;
revoke all on function public.talk_is_admin() from public;
-- Leave role EXECUTE grants unchanged if already present on staging (Phase 11).
-- Policies below require authenticated EXECUTE on these helpers.
grant execute on function public.talk_current_user_id() to authenticated, service_role;
grant execute on function public.talk_is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1) Table DDL — canonical: sql/talk-sync-schema.sql (notifications only)
-- ---------------------------------------------------------------------------
create table if not exists public.talk_notifications (
  id text primary key,
  user_id text not null,
  type text not null default 'system',
  title text not null default '',
  body text not null default '',
  target_url text not null default '#',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  source text not null default 'tasful',
  priority text not null default 'normal',
  updated_at timestamptz not null default now()
);

comment on table public.talk_notifications is
  'TALK canonical inbox. ANPI Phase 12 staging sync. service_role creates rows; authenticated read/update own only.';

-- ---------------------------------------------------------------------------
-- 2) Index — inbox pull by user_id + created_at desc
-- ---------------------------------------------------------------------------
create index if not exists talk_notifications_user_created_idx
  on public.talk_notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3) RLS enable + remove any leftover *_dev open policies
-- ---------------------------------------------------------------------------
alter table public.talk_notifications enable row level security;

drop policy if exists "talk_notifications_select_dev" on public.talk_notifications;
drop policy if exists "talk_notifications_insert_dev" on public.talk_notifications;
drop policy if exists "talk_notifications_update_dev" on public.talk_notifications;
drop policy if exists "talk_notifications_delete_dev" on public.talk_notifications;

-- Also drop production-named policies before recreate (idempotent re-apply).
drop policy if exists "talk_notifications_select_own" on public.talk_notifications;
drop policy if exists "talk_notifications_insert_own" on public.talk_notifications;
drop policy if exists "talk_notifications_update_own" on public.talk_notifications;
drop policy if exists "talk_notifications_delete_own" on public.talk_notifications;
drop policy if exists "talk_notifications_insert_admin_fanout" on public.talk_notifications;
drop policy if exists "talk_notifications_select_phase12" on public.talk_notifications;
drop policy if exists "talk_notifications_update_phase12" on public.talk_notifications;

-- ---------------------------------------------------------------------------
-- 4) Production-hardening policies (Phase 12 absolute)
--    SELECT: own or admin (matches production)
--    UPDATE: own or admin (client read_at / reconcile; matches production update_own)
--    INSERT: none for authenticated (HARDENING — production has insert_own + fanout)
--    DELETE: none for authenticated (HARDENING — production has delete_own)
--    anon: no policies => deny
--    service_role: bypasses RLS => internal writer OK
-- ---------------------------------------------------------------------------
create policy "talk_notifications_select_phase12"
  on public.talk_notifications
  for select
  to authenticated
  using (public.talk_is_admin() or user_id = public.talk_current_user_id());

create policy "talk_notifications_update_phase12"
  on public.talk_notifications
  for update
  to authenticated
  using (public.talk_is_admin() or user_id = public.talk_current_user_id())
  with check (public.talk_is_admin() or user_id = public.talk_current_user_id());

-- Explicitly DO NOT create:
--   talk_notifications_insert_own
--   talk_notifications_insert_admin_fanout
--   talk_notifications_delete_own
--   any anon policy
--   any using(true) / *_dev policy

-- ---------------------------------------------------------------------------
-- 5) Table grants — least privilege
-- ---------------------------------------------------------------------------
revoke all on table public.talk_notifications from public;
revoke all on table public.talk_notifications from anon;
grant select, update on table public.talk_notifications to authenticated;
grant all on table public.talk_notifications to service_role;

-- ---------------------------------------------------------------------------
-- 6) Explicit non-goals (must remain comments — do not uncomment in Phase 12)
-- ---------------------------------------------------------------------------
-- NO: alter publication supabase_realtime add table public.talk_notifications;
-- NO: create trigger ... on public.talk_notifications ...
-- NO: enable ANPI real mode / feature flags
-- NO: create anpi_talk_notification_links (Phase 10 migration — separate)
-- NO: DROP TABLE / TRUNCATE / DELETE / UPDATE data

-- ---------------------------------------------------------------------------
-- 7) Post-apply sanity selects (read-only assertions for human review)
-- ---------------------------------------------------------------------------
select
  to_regclass('public.talk_notifications') is not null as table_exists,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'talk_notifications') as column_count,
  (select count(*) from pg_indexes
     where schemaname = 'public' and tablename = 'talk_notifications') as index_count,
  (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'talk_notifications') as rls_enabled,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'talk_notifications'
       and policyname like '%_dev') as leftover_dev_policies,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'talk_notifications'
       and cmd = 'INSERT') as insert_policies,
  (select count(*) from pg_publication_tables
     where schemaname = 'public' and tablename = 'talk_notifications') as realtime_membership;
