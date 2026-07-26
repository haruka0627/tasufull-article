-- =============================================================================
-- ANPI Phase 16 — Retention purge ROLLBACK (staging ahlxuyvhzqdqaojiywmu only)
-- =============================================================================
-- Removes Phase 16 purge function + purge index.
-- Does NOT restore deleted notification rows (none should have been deleted if
-- only dry-run was used). Does NOT touch anpi_user_contexts / talk_notifications data.
-- =============================================================================

drop function if exists public.anpi_phase16_purge_expired_talk_notifications(integer, boolean, timestamptz, interval);
drop index if exists public.talk_notifications_purge_read_created_idx;

select
  to_regprocedure('public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)')
    is not null as purge_fn_exists,
  (select count(*) from pg_indexes
     where schemaname = 'public' and indexname = 'talk_notifications_purge_read_created_idx') as purge_index_exists,
  (select count(*) from public.anpi_user_contexts where mapping_status = 'approved_phase15') as phase15_mapping_rows,
  (select count(*) from public.talk_notifications) as inbox_rows;
