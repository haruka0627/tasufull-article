-- =============================================================================
-- ANPI Phase 66-E — Canary allowlist registration TEMPLATE (NOT APPLIED)
-- =============================================================================
-- TARGET: ddojquacsyqesrjhcvmn ONLY
-- PREREQ: Phase 65 prod allowlist migration already applied · gate exists
-- RULE: Exactly ONE auth sha8 · never staging test sha8 0411f04d · never expand
-- STATUS: TEMPLATE — replace PLACEHOLDER_CANARY_SHA8 after human selection
-- =============================================================================

-- STOP unless human provided sha8:
--   PLACEHOLDER_CANARY_SHA8 must be exactly 8 lowercase hex chars.

begin;

update public.anpi_prod_claim_allowlist_gate
set
  allowed_auth_sha8 = array['PLACEHOLDER_CANARY_SHA8']::text[],
  enabled = false, -- keep OFF until pause → deploy → health → then enable RPC
  notes = 'Phase66 canary · single identity · enabled remains false until cutover step',
  updated_at = clock_timestamp()
where id = 1
  and 'PLACEHOLDER_CANARY_SHA8' ~ '^[a-f0-9]{8}$'
  and 'PLACEHOLDER_CANARY_SHA8' <> '0411f04d';

-- Sanity
select id, enabled, allowed_auth_sha8, notes
from public.anpi_prod_claim_allowlist_gate
where id = 1;

-- Do NOT call anpi_prod_claim_allowlist_enable() until Phase 66-F order complete.
commit;
