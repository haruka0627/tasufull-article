-- Phase 2 rollout verification (read-only)
select 'table' as kind, to_regclass('public.ai_workspace_usage_daily')::text as name;
select 'index' as kind, indexname as name
  from pg_indexes
 where schemaname = 'public' and tablename = 'ai_workspace_usage_daily';
select 'function' as kind, proname as name
  from pg_proc
 where proname in ('check_ai_workspace_quota', 'consume_ai_workspace_quota');
select 'rls' as kind, relname as name, relrowsecurity as rls_enabled
  from pg_class
 where relname = 'ai_workspace_usage_daily';
