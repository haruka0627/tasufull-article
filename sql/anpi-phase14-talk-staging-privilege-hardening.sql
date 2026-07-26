-- =============================================================================
-- ANPI Phase 14 — TALK Staging Privilege Hardening (additive REVOKE only)
-- Target: staging project ref ahlxuyvhzqdqaojiywmu ONLY
-- =============================================================================
-- Provenance (proven by catalog audit, reports/_anpi-phase14-hardening/):
--   pg_default_acl: ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--   grants arwdDxtm (ALL) to anon/authenticated/service_role on every new table.
--   Phase 12 CREATE TABLE therefore left authenticated with residual
--   INSERT / DELETE / TRUNCATE / REFERENCES / TRIGGER (grantor=postgres).
--   Phase 12 SQL revoked anon/public but did not revoke from authenticated.
--
-- This package removes only the residual authenticated privileges.
-- Intended end state:
--   authenticated : SELECT, UPDATE  (RLS-gated by *_phase12 policies)
--   anon          : none
--   service_role  : ALL (unchanged — internal writer)
--   postgres      : owner (unchanged)
--
-- Safety:
--   - REVOKE / no data DML / no DDL / no DROP / no TRUNCATE execution
--   - No policy changes (Phase 12 policies untouched)
--   - No Realtime publication change, no triggers, no ANPI real mode
--   - Idempotent: re-running is a no-op
-- =============================================================================

-- 1) Remove residual authenticated privileges (keep SELECT, UPDATE)
revoke insert, delete, truncate, references, trigger
  on table public.talk_notifications
  from authenticated;

-- 2) Defensive: anon / public must have no table privileges (already none on staging)
revoke all on table public.talk_notifications from anon;
revoke all on table public.talk_notifications from public;

-- 3) Re-assert intended read/update path (no-op if already granted)
grant select, update on table public.talk_notifications to authenticated;

-- 4) service_role stays full (no-op re-assert; internal writer per Phase 10/12)
grant all on table public.talk_notifications to service_role;

-- =============================================================================
-- Post-apply sanity select (read-only assertions for human review)
-- Expected: authenticated_privs = 'SELECT,UPDATE' · anon_privs empty ·
--           service_role INSERT true · policies unchanged (2)
-- =============================================================================
select
  (select string_agg(privilege_type, ',' order by privilege_type)
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'talk_notifications'
       and grantee = 'authenticated') as authenticated_privs,
  (select coalesce(string_agg(privilege_type, ',' order by privilege_type), '')
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'talk_notifications'
       and grantee = 'anon') as anon_privs,
  has_table_privilege('authenticated', 'public.talk_notifications', 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', 'public.talk_notifications', 'DELETE') as authenticated_delete,
  has_table_privilege('authenticated', 'public.talk_notifications', 'TRUNCATE') as authenticated_truncate,
  has_table_privilege('authenticated', 'public.talk_notifications', 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', 'public.talk_notifications', 'UPDATE') as authenticated_update,
  has_table_privilege('service_role', 'public.talk_notifications', 'INSERT') as service_role_insert,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'talk_notifications') as policy_count,
  (select count(*) from pg_publication_tables
     where schemaname = 'public' and tablename = 'talk_notifications') as realtime_membership;
