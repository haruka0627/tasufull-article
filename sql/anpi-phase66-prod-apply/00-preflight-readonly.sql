-- =============================================================================
-- ANPI Phase 66 — Production APPLY preflight (READ-ONLY · SELECT only)
-- =============================================================================
-- TARGET: ddojquacsyqesrjhcvmn ONLY
-- Run BEFORE any Phase 2–10 apply package. Human must confirm ref in Dashboard.
-- =============================================================================

-- A) Project identity (manual): Settings → General → Reference ID == ddojquacsyqesrjhcvmn

-- B) Legacy v1 must remain present and untouched baseline
select c.relname as legacy_table, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'anpi_check_sessions',
    'anpi_no_response_audit_log',
    'anpi_notification_logs',
    'anpi_user_contexts'
  )
order by 1;

-- C) Name collision — these Phase 2–10 objects must be ABSENT before step 1
select x.object_name, to_regclass('public.' || x.object_name) is not null as already_exists
from (
  values
    ('anpi_settings'),
    ('anpi_check_instances'),
    ('anpi_contacts'),
    ('anpi_contact_invitations'),
    ('anpi_notification_deliveries'),
    ('anpi_audit_logs'),
    ('anpi_scheduler_jobs'),
    ('anpi_scheduler_runs'),
    ('anpi_delivery_stub_receipts'),
    ('anpi_talk_templates'),
    ('anpi_talk_actions'),
    ('anpi_talk_adapter_receipts'),
    ('anpi_talk_adapter_config'),
    ('anpi_talk_shadow_notifications'),
    ('anpi_talk_notification_links'),
    ('anpi_prod_claim_allowlist_gate'),
    ('anpi_phase62_claim_allowlist_gate')
) as x(object_name)
order by 1;

-- D) Extensions
select extname, extversion, n.nspname as schema_name
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where extname in ('pgcrypto', 'uuid-ossp')
order by 1;

-- E) Current anpi* table inventory (expect only legacy 4)
select c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'anpi%'
order by 1;
