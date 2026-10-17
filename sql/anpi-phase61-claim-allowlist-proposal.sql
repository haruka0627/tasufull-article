-- =============================================================================
-- ANPI Phase 61/62 PROPOSAL ONLY — Staging claim allowlist + stable key
-- DO NOT APPLY without explicit human approval.
-- STAGING ONLY (ahlxuyvhzqdqaojiywmu). NEVER Production (ddojquacsyqesrjhcvmn).
-- =============================================================================
-- Purpose (Phase 62 prerequisites):
--   1) Restrict anpi_phase6_claim_jobs (or a parallel claim RPC) to allowlisted
--      subject_user_id sha8 values when staging scoped writer is enabled.
--   2) Provide SQL stable idempotency key:
--        anpi:p61:v1:{kind}:{check_id}:{subject_sha8}:{due_date}
--      replacing attempt-scoped anpi_phase6_idempotency_key for scoped path only.
--   3) Keep default Cron on talk_local* until cutover flag is explicitly set.
--
-- This file is intentionally NOT a migration under supabase/migrations/.
-- =============================================================================

-- Example gate (proposal):
-- create table if not exists public.anpi_phase61_scoped_writer_gate (
--   id int primary key default 1 check (id = 1),
--   enabled boolean not null default false,
--   allowed_auth_sha8 text[] not null default array['0411f04d'],
--   updated_at timestamptz not null default now()
-- );

-- Example stable key (proposal):
-- create or replace function public.anpi_phase61_stable_idempotency_key(...)
-- ...

select 'anpi_phase61_claim_allowlist_proposal_not_applied'::text as status;
