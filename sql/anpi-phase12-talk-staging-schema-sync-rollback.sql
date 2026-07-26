-- =============================================================================
-- ANPI Phase 12 — TALK Staging Schema Sync ROLLBACK (human-reviewed)
-- Target: staging project ref ahlxuyvhzqdqaojiywmu ONLY
-- =============================================================================
-- Default rollback (safe):
--   - Removes Phase 12 policies only
--   - Leaves table/index in place (DROP TABLE is out of band)
--
-- Full teardown (OPTIONAL — human must uncomment SECTION B after confirming):
--   - staging only
--   - table has ZERO rows (or rows are disposable fixtures)
--   - no production connection
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECTION A — default rollback (policy removal only)
-- ---------------------------------------------------------------------------
drop policy if exists "talk_notifications_select_phase12" on public.talk_notifications;
drop policy if exists "talk_notifications_update_phase12" on public.talk_notifications;

-- Ensure residual open policies from mistaken apply are also cleared.
drop policy if exists "talk_notifications_select_dev" on public.talk_notifications;
drop policy if exists "talk_notifications_insert_dev" on public.talk_notifications;
drop policy if exists "talk_notifications_update_dev" on public.talk_notifications;
drop policy if exists "talk_notifications_delete_dev" on public.talk_notifications;
drop policy if exists "talk_notifications_insert_own" on public.talk_notifications;
drop policy if exists "talk_notifications_insert_admin_fanout" on public.talk_notifications;
drop policy if exists "talk_notifications_delete_own" on public.talk_notifications;
drop policy if exists "talk_notifications_select_own" on public.talk_notifications;
drop policy if exists "talk_notifications_update_own" on public.talk_notifications;

select
  coalesce(
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'talk_notifications'),
    0
  ) as remaining_policies,
  to_regclass('public.talk_notifications') is not null as table_still_exists;

-- ---------------------------------------------------------------------------
-- SECTION B — OPTIONAL full teardown (DO NOT uncomment casually)
-- Requires: human confirmation · staging-only · empty or disposable rows
-- Absolute Phase 12 apply package forbids DROP TABLE; this section is rollback-only.
-- ---------------------------------------------------------------------------
-- drop index if exists public.talk_notifications_user_created_idx;
-- drop table if exists public.talk_notifications;
