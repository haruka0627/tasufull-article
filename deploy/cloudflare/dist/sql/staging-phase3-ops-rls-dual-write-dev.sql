-- TASFUL Phase 3 — Staging dual-write PoC（INSERT のみ・本番適用禁止）
-- read PoC: staging-phase2-ops-rls-dev.sql（SELECT）
-- 適用: node scripts/apply-staging-phase3-dual-write-supabase.mjs

do $$
declare
  t text;
  tables text[] := array[
    'support_tickets',
    'support_events',
    'connect_issues',
    'ai_ops_cases',
    'ai_ops_events',
    'builder_partner_evaluations',
    'builder_partner_status_events'
  ];
begin
  foreach t in array tables
  loop
    execute format('drop policy if exists "%s_insert_staging_dual_write" on public.%I', t, t);
    execute format(
      'create policy "%s_insert_staging_dual_write" on public.%I for insert to anon, authenticated with check (true)',
      t, t
    );
  end loop;
end $$;
