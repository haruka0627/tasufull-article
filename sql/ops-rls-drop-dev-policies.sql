-- TASFUL 運営系 — Phase 2/3 Staging PoC ポリシー削除（本番相当 RLS 適用前に必須）
--
-- *_staging_read / *_staging_dual_write は using (true) のため、
-- ops-rls-production の admin ポリシーと OR 結合され本番 RLS が無効になります。
--
-- 適用: node scripts/apply-staging-phase4-ops-rls.mjs（先頭で実行）

do $$
declare
  t text;
  tables text[] := array[
    'support_tickets',
    'support_events',
    'connect_issues',
    'support_admin_notifications',
    'ai_ops_cases',
    'ai_ops_events',
    'ai_ops_admin_notifications',
    'builder_partner_evaluations',
    'builder_partner_status_events',
    'builder_partner_visibility',
    'talk_ops_messages',
    'member_favorites',
    'listings'
  ];
  suf text;
  suffixes text[] := array['select_staging_read', 'insert_staging_read', 'update_staging_read', 'delete_staging_read', 'insert_staging_dual_write'];
begin
  foreach t in array tables
  loop
    foreach suf in array suffixes
    loop
      execute format('drop policy if exists "%s_%s" on public.%I', t, suf, t);
    end loop;
  end loop;
end $$;

-- 残存 PoC ポリシー（0 行が期待）
select tablename, policyname, 'OPS_POC_POLICY_STILL_PRESENT' as warning
from pg_policies
where schemaname = 'public'
  and tablename in (
    'support_tickets', 'support_events', 'connect_issues', 'support_admin_notifications',
    'ai_ops_cases', 'ai_ops_events', 'ai_ops_admin_notifications',
    'builder_partner_evaluations', 'builder_partner_status_events', 'builder_partner_visibility',
    'talk_ops_messages'
  )
  and (
    policyname like '%staging_read%'
    or policyname like '%staging_dual_write%'
  )
order by tablename, policyname;
