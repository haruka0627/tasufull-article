-- =============================================================================
-- ANPI Phase 65 — Production claim allowlist ROLLBACK DRAFT (DO NOT APPLY YET)
-- TARGET: ddojquacsyqesrjhcvmn ONLY · confirm project ref before any run
-- Prefer emergency_disable over drop during incidents.
-- =============================================================================

-- 1) Immediate disable (preferred)
-- select * from public.anpi_prod_claim_allowlist_emergency_disable();

-- 2) Full drop (only if objects were applied and must be removed)
drop function if exists public.anpi_prod_claim_jobs_allowlisted(text, integer, timestamptz, interval);
drop function if exists public.anpi_prod_stable_idempotency_key(text, uuid, uuid, timestamptz);
drop function if exists public.anpi_prod_claim_allowlist_enable();
drop function if exists public.anpi_prod_claim_allowlist_emergency_disable();
drop trigger if exists trg_anpi_prod_claim_allowlist_gate_biu on public.anpi_prod_claim_allowlist_gate;
drop function if exists public.anpi_prod_claim_allowlist_gate_biu();
drop function if exists public.anpi_prod_validate_sha8_array(text[]);
drop table if exists public.anpi_prod_claim_allowlist_gate;

-- Does NOT drop or alter anpi_phase6_claim_jobs / Phase 4–10 core objects.
