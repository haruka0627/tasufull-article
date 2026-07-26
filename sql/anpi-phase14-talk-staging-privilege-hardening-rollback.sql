-- =============================================================================
-- ANPI Phase 14 — Privilege Hardening ROLLBACK (staging ahlxuyvhzqdqaojiywmu only)
-- =============================================================================
-- Restores the pre-Phase-14 state exactly as observed in the provenance audit:
--   authenticated had arwdDxtm (ALL) from default privileges (grantor postgres).
--   anon / public had no table privileges (Phase 12 revoked them) — unchanged here.
--
-- Use only if the hardening breaks a legitimate staging flow (none expected:
-- RLS already had no INSERT/DELETE policies, so clients could not use those
-- privileges through PostgREST anyway).
-- =============================================================================

grant insert, delete, truncate, references, trigger
  on table public.talk_notifications
  to authenticated;

-- Sanity
select
  (select string_agg(privilege_type, ',' order by privilege_type)
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'talk_notifications'
       and grantee = 'authenticated') as authenticated_privs;
