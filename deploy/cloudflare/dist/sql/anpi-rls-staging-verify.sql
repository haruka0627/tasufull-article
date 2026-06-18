-- 安否 RLS ステージング確認（P9-5）
-- SQL Editor で実行し、結果セットを確認してください。

-- ============================================================================
-- 1. RLS 有効化
-- ============================================================================
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('anpi_user_contexts', 'anpi_notification_logs')
order by c.relname;

-- ============================================================================
-- 2. ポリシー一覧（dev / prod の混在確認）
-- ============================================================================
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename in ('anpi_user_contexts', 'anpi_notification_logs')
order by tablename, policyname;

-- ============================================================================
-- 3. dev ポリシー残存チェック（0 行が本番想定）
-- ============================================================================
select
  tablename,
  policyname,
  'DEV_POLICY_STILL_PRESENT' as warning
from pg_policies
where schemaname = 'public'
  and tablename in ('anpi_user_contexts', 'anpi_notification_logs')
  and policyname like '%_dev'
order by tablename, policyname;

-- ============================================================================
-- 4. 本番 prod ポリシー存在チェック（各テーブル 4 操作分）
-- ============================================================================
select
  tablename,
  count(*) filter (where policyname like '%_prod') as prod_policy_count,
  count(*) filter (where policyname like '%_dev') as dev_policy_count,
  count(*) as total_policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('anpi_user_contexts', 'anpi_notification_logs')
group by tablename
order by tablename;

-- ============================================================================
-- 5. RLS ヘルパー関数
-- ============================================================================
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'anpi_current_member_id',
    'anpi_is_admin',
    'anpi_can_read_context_row',
    'anpi_can_write_context_row',
    'anpi_can_read_log_row',
    'anpi_can_write_log_row'
  )
order by p.proname;

-- ============================================================================
-- 6. anpi_user_contexts カラム
-- ============================================================================
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'anpi_user_contexts'
order by ordinal_position;

-- ============================================================================
-- 7. anpi_notification_logs カラム
-- ============================================================================
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'anpi_notification_logs'
order by ordinal_position;

-- ============================================================================
-- 8. インデックス
-- ============================================================================
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('anpi_user_contexts', 'anpi_notification_logs')
order by tablename, indexname;

-- ============================================================================
-- 9. ID 紐付けカラムの存在確認（information_schema のみ・常に安全）
-- ============================================================================
with target_tables as (
  select unnest(array['anpi_user_contexts', 'anpi_notification_logs']) as table_name
),
target_columns as (
  select unnest(
    array[
      'member_id',
      'anpi_user_id',
      'contract_holder_id',
      'user_id',
      'relationship',
      'account_scope'
    ]
  ) as column_name
)
select
  t.table_name,
  c.column_name,
  case
    when to_regclass('public.' || quote_ident(t.table_name)) is null then 'TABLE_MISSING'
    when ic.column_name is not null then 'PRESENT'
    else 'MISSING'
  end as column_status,
  ic.data_type,
  ic.is_nullable
from target_tables t
cross join target_columns c
left join information_schema.columns ic
  on ic.table_schema = 'public'
  and ic.table_name = t.table_name
  and ic.column_name = c.column_name
order by t.table_name, c.column_name;

-- ============================================================================
-- 10. ID 紐付けカラムの NULL 件数（カラム存在時のみ集計・存在しない場合は N/A）
--     テーブル/カラムごとに 1 行。Supabase SQL Editor で最後の SELECT を確認。
-- ============================================================================
create temp table if not exists _anpi_staging_id_null_checks (
  table_name text not null,
  column_name text not null,
  column_exists boolean not null,
  total_rows bigint,
  null_or_empty_count bigint,
  check_status text not null,
  primary key (table_name, column_name)
);

truncate _anpi_staging_id_null_checks;

do $$
declare
  v_table text;
  v_column text;
  v_columns text[] := array[
    'member_id',
    'anpi_user_id',
    'contract_holder_id',
    'user_id',
    'relationship',
    'account_scope'
  ];
  v_exists boolean;
  v_total bigint;
  v_nulls bigint;
  v_sql text;
  v_regclass regclass;
begin
  foreach v_table in array ARRAY['anpi_user_contexts', 'anpi_notification_logs']
  loop
    v_regclass := to_regclass(format('public.%I', v_table));

    if v_regclass is null then
      foreach v_column in array v_columns
      loop
        insert into _anpi_staging_id_null_checks (
          table_name, column_name, column_exists, total_rows, null_or_empty_count, check_status
        )
        values (v_table, v_column, false, null, null, 'TABLE_MISSING');
      end loop;
      continue;
    end if;

    v_sql := format('select count(*)::bigint from public.%I', v_table);
    execute v_sql into v_total;

    foreach v_column in array v_columns
    loop
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = v_table
          and column_name = v_column
      )
      into v_exists;

      if not v_exists then
        insert into _anpi_staging_id_null_checks (
          table_name, column_name, column_exists, total_rows, null_or_empty_count, check_status
        )
        values (v_table, v_column, false, v_total, null, 'N/A (column missing)');
        continue;
      end if;

      v_sql := format(
        $sql$
        select sum(
          case
            when %1$I is null or trim(%1$I::text) = '' then 1
            else 0
          end
        )::bigint
        from public.%2$I
        $sql$,
        v_column,
        v_table
      );
      execute v_sql into v_nulls;

      insert into _anpi_staging_id_null_checks (
        table_name, column_name, column_exists, total_rows, null_or_empty_count, check_status
      )
      values (
        v_table,
        v_column,
        true,
        v_total,
        v_nulls,
        case when v_nulls = 0 then 'OK (no null/empty)' else 'REVIEW (has null/empty)' end
      );
    end loop;
  end loop;
end $$;

-- 詳細（テーブル × カラム）
select
  table_name,
  column_name,
  column_exists,
  total_rows,
  null_or_empty_count,
  check_status
from _anpi_staging_id_null_checks
order by table_name, column_name;

-- サマリー（主要 ID 列のみ・存在しない列は N/A）
select
  table_name,
  max(total_rows) as total_rows,
  max(null_or_empty_count) filter (where column_name = 'member_id') as null_member_id,
  max(null_or_empty_count) filter (where column_name = 'anpi_user_id') as null_anpi_user_id,
  max(null_or_empty_count) filter (where column_name = 'contract_holder_id') as null_contract_holder_id,
  max(null_or_empty_count) filter (where column_name = 'user_id') as null_user_id,
  max(
    case
      when column_name = 'member_id' and not column_exists then 'N/A'
      when column_name = 'member_id' then check_status
    end
  ) as member_id_status,
  max(
    case
      when column_name = 'anpi_user_id' and not column_exists then 'N/A'
      when column_name = 'anpi_user_id' then check_status
    end
  ) as anpi_user_id_status
from _anpi_staging_id_null_checks
group by table_name
order by table_name;
