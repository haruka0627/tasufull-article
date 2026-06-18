-- TASFUL TALK — 開発用 RLS ポリシー削除（本番 RLS 適用後に必須）
-- *_dev は using (true) のため production ポリシーと OR 結合され分離が無効になります。

do $$
declare
  t text;
begin
  foreach t in array array[
    'talk_ai_drafts',
    'talk_broadcast_drafts',
    'talk_notifications'
  ]
  loop
    execute format('drop policy if exists "%s_select_dev" on public.%I', t, t);
    execute format('drop policy if exists "%s_insert_dev" on public.%I', t, t);
    execute format('drop policy if exists "%s_update_dev" on public.%I', t, t);
    execute format('drop policy if exists "%s_delete_dev" on public.%I', t, t);
  end loop;
end $$;

drop policy if exists "talk_follow_subscriptions_select_dev" on public.talk_follow_subscriptions;
drop policy if exists "talk_follow_subscriptions_insert_dev" on public.talk_follow_subscriptions;
drop policy if exists "talk_follow_subscriptions_update_dev" on public.talk_follow_subscriptions;
drop policy if exists "talk_follow_subscriptions_delete_dev" on public.talk_follow_subscriptions;

select
  tablename,
  policyname,
  'DEV_POLICY_STILL_PRESENT' as warning
from pg_policies
where schemaname = 'public'
  and tablename like 'talk_%'
  and policyname like '%_dev'
order by tablename, policyname;
