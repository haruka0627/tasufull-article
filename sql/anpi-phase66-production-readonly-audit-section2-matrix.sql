-- =============================================================================
-- ANPI Phase 66-A — Section 2 ONLY (expected-object boolean matrix)
-- =============================================================================
-- TARGET: ddojquacsyqesrjhcvmn (Production) · read-only SELECT
-- FORBIDDEN: DML / DDL / MCP apply · Staging ahlxuyvhzqdqaojiywmu
-- USAGE: Run this file alone in SQL Editor (one result set).
-- NOTE: Uses to_regclass / to_regprocedure only — safe when objects are missing.
-- =============================================================================

select
  to_regclass('public.anpi_scheduler_jobs') is not null as has_scheduler_jobs,
  to_regclass('public.anpi_scheduler_runs') is not null as has_scheduler_runs,
  to_regclass('public.anpi_phase62_claim_allowlist_gate') is not null as has_p62_gate,
  to_regclass('public.anpi_prod_claim_allowlist_gate') is not null as has_prod_gate,
  to_regprocedure('public.anpi_phase6_claim_jobs(text,integer,timestamptz,interval)') is not null as has_legacy_claim,
  to_regprocedure('public.anpi_phase62_claim_jobs_allowlisted(text,integer,timestamptz,interval)') is not null as has_p62_claim,
  to_regprocedure('public.anpi_prod_claim_jobs_allowlisted(text,integer,timestamptz,interval)') is not null as has_prod_claim,
  to_regprocedure('public.anpi_prod_claim_allowlist_emergency_disable()') is not null as has_prod_emergency,
  to_regprocedure('public.anpi_resolve_talk_user_id(uuid)') is not null
    or to_regprocedure('public.anpi_resolve_talk_user_id(text)') is not null as has_talk_resolve;
