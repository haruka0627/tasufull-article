-- P0 dev RLS DROP 事後確認（読取のみ）

-- 1) P0 対象 *_dev 残存
select 'dev_remaining' as check_type, tablename, policyname
from pg_policies
where schemaname = 'public'
  and policyname like '%_dev'
  and tablename in (
    'talk_notifications', 'talk_ai_drafts', 'talk_broadcast_drafts', 'talk_follow_subscriptions',
    'anpi_user_contexts', 'anpi_notification_logs',
    'anpi_check_sessions', 'anpi_no_response_audit_log',
    'listings', 'business_listings', 'profiles', 'members',
    'talk_call_push_events', 'talk_push_subscriptions'
  )
order by tablename, policyname;

-- 2) ops staging PoC 残存
select 'staging_remaining' as check_type, tablename, policyname
from pg_policies
where schemaname = 'public'
  and (
    policyname like '%staging_read%'
    or policyname like '%staging_dual_write%'
  )
order by tablename, policyname;

-- 3) Marketplace P3: *_select_public 復活チェック（0 行 = OK）
select 'select_public_revived' as check_type, tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('listings', 'business_listings', 'profiles', 'members')
  and policyname like '%select_public%'
order by tablename;

-- 4) 本番 policy 存在確認（サンプル）
select 'prod_sample' as check_type, tablename, policyname
from pg_policies
where schemaname = 'public'
  and (
    policyname like '%_prod'
    or policyname like '%_own'
    or policyname like '%_owner'
    or policyname like '%_callee'
    or policyname like '%_participant'
    or policyname like '%_ops'
  )
  and tablename in (
    'talk_notifications', 'anpi_check_sessions', 'listings',
    'talk_call_push_events', 'connect_issues'
  )
order by tablename, policyname;

-- 5) 集計
select 'counts' as check_type,
  (select count(*) from pg_policies where schemaname='public' and policyname like '%_dev') as all_dev_count,
  (select count(*) from pg_policies where schemaname='public' and (policyname like '%staging_read%' or policyname like '%staging_dual_write%')) as staging_count,
  (select count(*) from pg_policies where schemaname='public' and tablename in ('listings','business_listings','profiles','members') and policyname like '%select_public%') as select_public_count;
