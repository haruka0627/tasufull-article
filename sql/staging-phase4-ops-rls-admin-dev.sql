-- TASFUL Phase 4 — Staging 本番相当 ops RLS 検証
--
-- apply-staging-phase4-ops-rls.mjs が以下を順に実行:
--   1) sql/ops-rls-drop-dev-policies.sql  — Phase 2/3 PoC 全開放ポリシー削除
--   2) sql/ops-rls-production.sql         — 本番相当 admin RLS
--
-- 検証 JWT（.env）:
--   ANPI_RLS_ADMIN_JWT / ANPI_RLS_USER_A_JWT（scripts/issue-anpi-rls-jwt.mjs）
--
--   node scripts/load-dotenv-run.mjs scripts/test-supabase-phase4-rls-admin.mjs

select 'staging-phase4-ops-rls-admin-dev: apply via scripts/apply-staging-phase4-ops-rls.mjs' as note;
