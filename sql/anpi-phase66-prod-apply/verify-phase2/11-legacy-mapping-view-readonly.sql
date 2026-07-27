-- SELECT only · after Phase 2 APPLY · documentation view (single result)

select
  to_regclass('public.anpi_legacy_check_status_mapping') is not null as view_exists,
  (
    select c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'anpi_legacy_check_status_mapping'
  ) as relkind;

-- Pass: view_exists=true · relkind='v'
