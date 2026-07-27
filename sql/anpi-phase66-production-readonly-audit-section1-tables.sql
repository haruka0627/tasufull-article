-- =============================================================================
-- ANPI Phase 66-A — Section 1 ONLY (tables presence)
-- =============================================================================
-- TARGET: ddojquacsyqesrjhcvmn (Production) · read-only SELECT
-- FORBIDDEN: DML / DDL / MCP apply · Staging ahlxuyvhzqdqaojiywmu
-- USAGE: Run this file alone in SQL Editor (one result set).
-- =============================================================================

select
  c.relname as table_name,
  n.nspname as schema_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'anpi%'
order by 1;
