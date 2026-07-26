-- =============================================================================
-- ANPI Phase 16 — Scheduler runbook (DISABLED · do not enable in this Phase)
-- Target notes: staging ahlxuyvhzqdqaojiywmu · production FORBIDDEN
-- =============================================================================
-- Decision (Phase 16):
--   - staging has pg_cron = false (catalog audit)
--   - Prefer MANUAL dry-run / reviewed service_role invoke until Real INSERT
--     enablement checklist is GO
--   - Future: Edge Function scheduled invocation OR pg_cron IF extension enabled
--   - Frequency candidate: 1x/day, batch 500–1000, low-traffic window (unset)
--
-- PROHIBITED this Phase:
--   - enabling cron jobs
--   - running purge with p_dry_run=false on staging if eligible>0 without review
--   - production apply
-- =============================================================================

-- Manual dry-run (safe):
--   select * from public.anpi_phase16_purge_expired_talk_notifications(500, true);

-- Manual live batch (ONLY after enablement GO + eligible review):
--   select * from public.anpi_phase16_purge_expired_talk_notifications(500, false);

-- Example DISABLED pg_cron registration (DO NOT RUN until approved):
-- select cron.schedule(
--   'anpi-phase16-talk-notifications-purge',
--   '0 17 * * *',  -- placeholder UTC; unset until ops picks a window
--   $$select public.anpi_phase16_purge_expired_talk_notifications(500, false);$$
-- );
-- To unschedule (if ever enabled):
-- select cron.unschedule('anpi-phase16-talk-notifications-purge');

select
  exists(select 1 from pg_extension where extname = 'pg_cron') as pg_cron_present,
  to_regprocedure('public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)')
    is not null as purge_fn_exists;
