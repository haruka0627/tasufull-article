-- =============================================================================
-- ANPI Phase 62 — Rollback draft for claim allowlist SQL
-- STATUS: NOT APPLIED with forward draft · use only after forward was applied
-- STAGING ONLY
-- =============================================================================

-- 1) Immediate disable (preferred emergency stop — keeps objects)
-- select * from public.anpi_phase62_claim_allowlist_emergency_disable();

-- 2) Full drop (after confirming Cron still uses anpi_phase6_claim_jobs only)
drop function if exists public.anpi_phase62_claim_jobs_allowlisted(text, integer, timestamptz, interval);
drop function if exists public.anpi_phase62_stable_idempotency_key(text, uuid, uuid, timestamptz);
drop function if exists public.anpi_phase62_claim_allowlist_enable();
drop function if exists public.anpi_phase62_claim_allowlist_emergency_disable();
drop trigger if exists trg_anpi_phase62_claim_allowlist_gate_biu on public.anpi_phase62_claim_allowlist_gate;
drop function if exists public.anpi_phase62_claim_allowlist_gate_biu();
drop function if exists public.anpi_phase62_validate_sha8_array(text[]);
drop table if exists public.anpi_phase62_claim_allowlist_gate;

-- NOTE: Does not modify anpi_phase6_claim_jobs / Phase 8 attempt keys / talk_notifications.
