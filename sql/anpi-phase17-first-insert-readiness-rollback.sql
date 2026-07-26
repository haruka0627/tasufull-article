-- =============================================================================
-- ANPI Phase 17 — Rollback (staging only)
-- STAGING TEST ONLY
-- DO NOT APPLY TO PRODUCTION
-- Removes Phase17 gate functions/table. Does NOT delete talk_notifications
-- unless leftover test row exists — cleanup first via cleanup(false) if needed.
-- Does NOT touch anpi_user_contexts.
-- =============================================================================

drop function if exists public.anpi_phase17_cleanup_first_test_notification(boolean);
drop function if exists public.anpi_phase17_insert_first_test_notification(boolean, text);
drop function if exists public.anpi_phase17_polling_reader_dry_run();
drop function if exists public.anpi_phase17_enable_flag();
drop function if exists public.anpi_phase17_emergency_disable();

drop table if exists public.anpi_phase17_insert_gate;

select
  to_regclass('public.anpi_phase17_insert_gate') is not null as gate_exists,
  to_regprocedure('public.anpi_phase17_insert_first_test_notification(boolean,text)') is not null as writer_exists,
  (select count(*) from public.anpi_user_contexts where mapping_status = 'approved_phase15') as phase15_maps,
  (select count(*) from public.talk_notifications) as inbox_rows;
