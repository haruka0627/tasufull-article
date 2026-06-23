-- TASFUL Auth Hook L2 allowlist seed
-- Target ref: ddojquacsyqesrjhcvmn
--
-- IMPORTANT:
--   Auth user CREATE is performed via Admin API (service_role), NOT raw SQL INSERT.
--   Supabase Auth manages password hashing and identity rows internally.
--
-- Execute seed:
--   node scripts/seed-auth-hook-l2-allowlist.mjs
--
-- Dry-run (no writes):
--   node scripts/seed-auth-hook-l2-allowlist.mjs --dry-run
--
-- Password: set AUTH_HOOK_L2_ALLOWLIST_PASSWORD in .env (never commit · not in reports)
--
-- Created emails (L2 only):
--   t1@tasful.invalid  — T1 normal_user
--   t2@tasful.invalid  — T2 match_verified_user
--   t3@tasful.invalid  — T3 banned_match_user
--   t4@tasful.invalid  — T4 tasu_admin (admin claims in L3 backfill)
--   t5@tasful.invalid  — T5 missing_talk_user_id (no talk_user_id in L3 for T5)
--
-- app_metadata at create (minimal):
--   { "provider": "email", "providers": ["email"] }
-- user_metadata at create (minimal):
--   { "email_verified": true }
--
-- NOT set at L2: talk_user_id, member_id, is_ops, role (except via L3 backfill)
--
-- Verify after seed:
--   npx supabase db query --linked --yes -f sql/auth-hook-l2-verify-readonly.sql
--
-- Rollback (L2 only — delete allowlist users via Admin API; do NOT touch L1 baseline 7):
--   DELETE /auth/v1/admin/users/{uuid}  for each t1–t5 uuid

-- Pre-seed check (READ)
select count(*) as total_before
from auth.users;

select email
from auth.users
where email ilike '%@tasful.invalid'
order by email;
