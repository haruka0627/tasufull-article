-- TASFUL Phase 2 — Staging 開発用 RLS（read-only PoC: anon SELECT のみ）
-- 本番適用禁止。staging 検証後は ops-rls-production へ差し替え。

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
begin
  foreach t in array tables
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_select_staging_read" on public.%I', t, t);
    execute format('drop policy if exists "%s_insert_staging_read" on public.%I', t, t);
    execute format('drop policy if exists "%s_update_staging_read" on public.%I', t, t);
    execute format('drop policy if exists "%s_delete_staging_read" on public.%I', t, t);

    execute format(
      'create policy "%s_select_staging_read" on public.%I for select to anon, authenticated using (true)',
      t, t
    );
  end loop;
end $$;
