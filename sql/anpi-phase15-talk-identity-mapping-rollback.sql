-- =============================================================================
-- ANPI Phase 15 — Rollback (staging ahlxuyvhzqdqaojiywmu only)
-- =============================================================================
-- SECTION A (default): remove Phase 15 seed rows + policies + resolver function.
--   Table retained (empty of phase15 seeds).
-- SECTION B (commented): DROP TABLE — human only after empty confirmation.
-- =============================================================================

-- SECTION A
delete from public.anpi_user_contexts
  where mapping_status = 'approved_phase15';

drop policy if exists "anpi_user_contexts_select_phase15" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_select_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_insert_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_update_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_delete_dev" on public.anpi_user_contexts;

drop function if exists public.anpi_resolve_talk_user_id(uuid);

-- SECTION B (OPTIONAL — uncomment only after confirming staging-only + empty/disposable)
-- drop index if exists public.anpi_user_contexts_talk_user_id_idx;
-- drop index if exists public.anpi_user_contexts_member_id_idx;
-- drop index if exists public.anpi_user_contexts_anpi_user_id_idx;
-- drop index if exists public.anpi_user_contexts_updated_at_desc_idx;
-- drop table if exists public.anpi_user_contexts;

select
  to_regclass('public.anpi_user_contexts') is not null as table_exists,
  to_regprocedure('public.anpi_resolve_talk_user_id(uuid)') is not null as resolve_fn_exists,
  (select count(*) from public.anpi_user_contexts) as remaining_rows;
