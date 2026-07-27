-- READ-ONLY verify after Phase 2 apply
select to_regclass('public.anpi_settings') is not null as has_settings;
select to_regclass('public.anpi_check_instances') is not null as has_check_instances;
select to_regclass('public.anpi_contacts') is not null as has_contacts;
select to_regclass('public.anpi_contact_invitations') is not null as has_invitations;
select to_regclass('public.anpi_notification_deliveries') is not null as has_deliveries;
select to_regclass('public.anpi_audit_logs') is not null as has_audit_logs;

select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in (
    'anpi_settings','anpi_check_instances','anpi_contacts',
    'anpi_contact_invitations','anpi_notification_deliveries','anpi_audit_logs'
  )
order by 1;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'anpi_settings','anpi_check_instances','anpi_contacts',
    'anpi_contact_invitations','anpi_notification_deliveries','anpi_audit_logs'
  )
  and grantee in ('anon','authenticated','service_role')
order by 1,2,3;

select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       p.proconfig as config -- includes search_path when set
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'anpi_confirm_check','anpi_create_daily_check','anpi_respond_contact_invitation',
    'anpi_revoke_contact','anpi_contact_check_summary','anpi_contact_invitation_summaries'
  )
order by 1,2;

-- legacy must still exist
select to_regclass('public.anpi_user_contexts') is not null as legacy_user_contexts;
select to_regclass('public.anpi_check_sessions') is not null as legacy_check_sessions;
