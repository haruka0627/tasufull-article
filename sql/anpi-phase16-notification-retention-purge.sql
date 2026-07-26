-- =============================================================================
-- ANPI Phase 16 — talk_notifications retention purge (function + index)
-- Target: staging project ref ahlxuyvhzqdqaojiywmu ONLY (apply reviewed)
-- =============================================================================
-- Retention SSOT: reports/anpi-phase14-talk-staging-privilege-hardening.md §14-D
--   READ  (read_at IS NOT NULL): eligible when created_at < now() - 90 days
--   UNREAD (read_at IS NULL): NEVER eligible (indefinite hold)
--
-- Schema has no hold / retry / incident / delivery_status columns.
-- Undetectable states are EXCLUDED by construction (unread never purged;
-- only fully-read rows older than 90d are candidates).
--
-- Safety:
--   - Default p_dry_run = true (counts only; no DELETE)
--   - Batch DELETE with ORDER BY created_at, id LIMIT p_batch_size
--   - Does NOT touch anpi_user_contexts / Phase 15 seeds
--   - Does NOT alter publication / Realtime / Push
--   - EXECUTE: service_role only
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Partial index for purge path (read rows by created_at, id)
-- ---------------------------------------------------------------------------
create index if not exists talk_notifications_purge_read_created_idx
  on public.talk_notifications (created_at asc, id asc)
  where read_at is not null;

comment on index public.talk_notifications_purge_read_created_idx is
  'ANPI Phase 16: supports batch purge of read notifications older than retention.';

-- ---------------------------------------------------------------------------
-- 2) Purge function (idempotent · batch · dry-run default)
-- ---------------------------------------------------------------------------
create or replace function public.anpi_phase16_purge_expired_talk_notifications(
  p_batch_size integer default 500,
  p_dry_run boolean default true,
  p_now timestamptz default clock_timestamp(),
  p_retain_read interval default interval '90 days'
)
returns table (
  deleted_count integer,
  remaining_eligible_count integer,
  dry_run boolean,
  executed_at timestamptz,
  retain_read interval,
  batch_size integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_batch integer;
  v_cutoff timestamptz;
  v_deleted integer := 0;
  v_remaining integer := 0;
begin
  if p_batch_size is null or p_batch_size < 1 then
    raise exception using errcode = '22023', message = 'anpi_phase16_purge_invalid_batch_size';
  end if;
  if p_batch_size > 1000 then
    raise exception using errcode = '22023', message = 'anpi_phase16_purge_batch_size_cap_1000';
  end if;
  if p_retain_read is null or p_retain_read < interval '1 day' then
    raise exception using errcode = '22023', message = 'anpi_phase16_purge_invalid_retain';
  end if;

  v_batch := p_batch_size;
  v_cutoff := coalesce(p_now, clock_timestamp()) - p_retain_read;

  -- Eligible = READ and older than cutoff. UNREAD never eligible.
  select count(*)::integer into v_remaining
  from public.talk_notifications n
  where n.read_at is not null
    and n.created_at < v_cutoff;

  if coalesce(p_dry_run, true) then
    deleted_count := 0;
    remaining_eligible_count := coalesce(v_remaining, 0);
    dry_run := true;
    executed_at := clock_timestamp();
    retain_read := p_retain_read;
    batch_size := v_batch;
    return next;
    return;
  end if;

  -- Deterministic batch delete
  with victims as (
    select n.id
    from public.talk_notifications n
    where n.read_at is not null
      and n.created_at < v_cutoff
    order by n.created_at asc, n.id asc
    limit v_batch
  ),
  deleted as (
    delete from public.talk_notifications t
    using victims v
    where t.id = v.id
    returning t.id
  )
  select count(*)::integer into v_deleted from deleted;

  select count(*)::integer into v_remaining
  from public.talk_notifications n
  where n.read_at is not null
    and n.created_at < v_cutoff;

  deleted_count := coalesce(v_deleted, 0);
  remaining_eligible_count := coalesce(v_remaining, 0);
  dry_run := false;
  executed_at := clock_timestamp();
  retain_read := p_retain_read;
  batch_size := v_batch;
  return next;
end;
$$;

comment on function public.anpi_phase16_purge_expired_talk_notifications(integer, boolean, timestamptz, interval) is
  'ANPI Phase 16: batch purge READ talk_notifications older than retain interval. Default dry_run=true. service_role only. Never deletes unread or anpi_user_contexts.';

revoke all on function public.anpi_phase16_purge_expired_talk_notifications(integer, boolean, timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.anpi_phase16_purge_expired_talk_notifications(integer, boolean, timestamptz, interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) Post-apply sanity (read-only + dry-run invoke)
-- ---------------------------------------------------------------------------
select
  to_regprocedure('public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)')
    is not null as purge_fn_exists,
  (select count(*) from pg_indexes
     where schemaname = 'public' and indexname = 'talk_notifications_purge_read_created_idx') as purge_index_exists,
  has_function_privilege('anon', 'public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)', 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', 'public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)', 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', 'public.anpi_phase16_purge_expired_talk_notifications(integer,boolean,timestamptz,interval)', 'EXECUTE') as service_role_execute,
  (select count(*) from public.anpi_user_contexts where mapping_status = 'approved_phase15') as phase15_mapping_rows,
  (select count(*) from public.talk_notifications) as inbox_rows;

-- Dry-run (no delete)
select * from public.anpi_phase16_purge_expired_talk_notifications(500, true, clock_timestamp(), interval '90 days');
