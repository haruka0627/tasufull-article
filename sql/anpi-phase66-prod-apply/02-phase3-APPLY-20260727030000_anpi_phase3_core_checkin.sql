-- =============================================================================
-- ANPI Phase 66 — Production APPLY PACKAGE (HUMAN APPROVAL REQUIRED)
-- =============================================================================
-- TARGET PROJECT REF ONLY: ddojquacsyqesrjhcvmn
-- FORBIDDEN without explicit human approval: paste/run on any project
-- FORBIDDEN always: Staging ahlxuyvhzqdqaojiywmu · MCP apply · Worker/Cron/Canary
-- PHASE: 3
-- SOURCE CANONICAL: supabase/migrations/20260727030000_anpi_phase3_core_checkin.sql
-- STATUS: RUNBOOK ARTIFACT · NOT EXECUTED by agent
-- BEFORE RUN: preflight + collision checks + human GO for THIS step only
-- AFTER RUN: verify-after-phase3.sql · STOP · wait for next human GO
-- OUT OF SCOPE: Phase 65 draft · Worker · Cron · Canary
-- =============================================================================

-- ANPI Phase 3 — Core Check-In RPCs
-- Canonical design: docs/ANPI_PRD.md §15 Phase 3
-- Local implementation only. Do not apply to Production/Staging without review.
--
-- Depends on: 20260727020000_anpi_phase2_data_foundation.sql
-- Scope: settings upsert · pause/resume · today ensure/read · history
-- Out of scope: scheduler cron · emergency contact notify · TALK wiring · FROZEN v1 rewrite

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase3_require_auth()
returns uuid
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'anpi_auth_required';
  end if;
  return v_uid;
end;
$$;

revoke all on function public.anpi_phase3_require_auth() from public, anon;
grant execute on function public.anpi_phase3_require_auth() to authenticated, service_role;

create or replace function public.anpi_phase3_tokyo_today()
returns date
language sql
stable
set search_path = pg_catalog
as $$
  select (now() at time zone 'Asia/Tokyo')::date;
$$;

revoke all on function public.anpi_phase3_tokyo_today() from public;
grant execute on function public.anpi_phase3_tokyo_today() to authenticated, service_role;

create or replace function public.anpi_phase3_tokyo_weekday(p_day date)
returns smallint
language sql
immutable
strict
set search_path = pg_catalog
as $$
  -- ISO: 1=Mon … 7=Sun (matches anpi_settings.weekdays)
  select extract(isodow from p_day)::smallint;
$$;

revoke all on function public.anpi_phase3_tokyo_weekday(date) from public;
grant execute on function public.anpi_phase3_tokyo_weekday(date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Settings: get / upsert / pause / resume
-- ---------------------------------------------------------------------------

create or replace function public.anpi_get_my_settings()
returns public.anpi_settings
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := public.anpi_phase3_require_auth();
  v_row public.anpi_settings%rowtype;
begin
  select * into v_row
  from public.anpi_settings s
  where s.subject_user_id = v_uid
    and s.owner_user_id = v_uid
    and s.deleted_at is null
  order by s.created_at desc
  limit 1;

  return v_row;
end;
$$;

comment on function public.anpi_get_my_settings() is
  'Phase 3: return the caller current ANPI settings row (owner=subject=auth.uid()).';

revoke all on function public.anpi_get_my_settings() from public, anon;
grant execute on function public.anpi_get_my_settings() to authenticated;

create or replace function public.anpi_upsert_my_settings(
  p_enabled boolean default true,
  p_schedule_type text default 'daily',
  p_weekdays smallint[] default array[1, 2, 3, 4, 5, 6, 7]::smallint[],
  p_initial_notification_time time default time '08:00',
  p_reminder_count smallint default 2,
  p_reminder_policy jsonb default '{"interval_minutes":[120,240]}'::jsonb,
  p_contact_notify_after interval default interval '2 hours'
)
returns public.anpi_settings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := public.anpi_phase3_require_auth();
  v_row public.anpi_settings%rowtype;
begin
  if p_schedule_type is null or p_schedule_type not in ('daily', 'weekdays') then
    raise exception using errcode = '22023', message = 'anpi_invalid_schedule_type';
  end if;
  if p_weekdays is null or not public.anpi_phase2_valid_weekdays(p_weekdays) then
    raise exception using errcode = '22023', message = 'anpi_invalid_weekdays';
  end if;
  if p_reminder_count is null or p_reminder_count < 0 or p_reminder_count > 2 then
    raise exception using errcode = '22023', message = 'anpi_invalid_reminder_count';
  end if;
  if p_reminder_policy is null or jsonb_typeof(p_reminder_policy) <> 'object' then
    raise exception using errcode = '22023', message = 'anpi_invalid_reminder_policy';
  end if;
  if p_contact_notify_after is null
     or p_contact_notify_after < interval '30 minutes'
     or p_contact_notify_after > interval '24 hours' then
    raise exception using errcode = '22023', message = 'anpi_invalid_contact_notify_after';
  end if;
  if p_initial_notification_time is null then
    raise exception using errcode = '22023', message = 'anpi_invalid_notification_time';
  end if;

  select * into v_row
  from public.anpi_settings s
  where s.subject_user_id = v_uid
    and s.owner_user_id = v_uid
    and s.deleted_at is null
  for update;

  if found then
    update public.anpi_settings
    set enabled = coalesce(p_enabled, enabled),
        schedule_type = p_schedule_type,
        weekdays = p_weekdays,
        initial_notification_time = p_initial_notification_time,
        reminder_count = p_reminder_count,
        reminder_policy = p_reminder_policy,
        contact_notify_after = p_contact_notify_after
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.anpi_settings (
      owner_user_id,
      subject_user_id,
      enabled,
      schedule_type,
      weekdays,
      initial_notification_time,
      reminder_count,
      reminder_policy,
      contact_notify_after
    ) values (
      v_uid,
      v_uid,
      coalesce(p_enabled, true),
      p_schedule_type,
      p_weekdays,
      p_initial_notification_time,
      p_reminder_count,
      p_reminder_policy,
      p_contact_notify_after
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

comment on function public.anpi_upsert_my_settings(boolean, text, smallint[], time, smallint, jsonb, interval) is
  'Phase 3: create or update self-owned settings. Timezone remains Asia/Tokyo.';

revoke all on function public.anpi_upsert_my_settings(boolean, text, smallint[], time, smallint, jsonb, interval)
  from public, anon;
grant execute on function public.anpi_upsert_my_settings(boolean, text, smallint[], time, smallint, jsonb, interval)
  to authenticated;

create or replace function public.anpi_pause_my_settings(
  p_paused_until timestamptz default null,
  p_pause_reason text default null
)
returns public.anpi_settings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := public.anpi_phase3_require_auth();
  v_row public.anpi_settings%rowtype;
begin
  if p_pause_reason is not null and char_length(p_pause_reason) > 200 then
    raise exception using errcode = '22023', message = 'anpi_invalid_pause_reason';
  end if;
  if p_paused_until is not null and p_paused_until <= now() then
    raise exception using errcode = '22023', message = 'anpi_invalid_paused_until';
  end if;

  update public.anpi_settings
  set paused_at = now(),
      paused_until = p_paused_until,
      pause_reason = p_pause_reason
  where subject_user_id = v_uid
    and owner_user_id = v_uid
    and deleted_at is null
  returning * into v_row;

  if not found then
    raise exception using errcode = '22000', message = 'anpi_setting_not_found';
  end if;

  return v_row;
end;
$$;

comment on function public.anpi_pause_my_settings(timestamptz, text) is
  'Phase 3: pause self settings. Pause must be explicitly cleared via resume.';

revoke all on function public.anpi_pause_my_settings(timestamptz, text) from public, anon;
grant execute on function public.anpi_pause_my_settings(timestamptz, text) to authenticated;

create or replace function public.anpi_resume_my_settings()
returns public.anpi_settings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := public.anpi_phase3_require_auth();
  v_row public.anpi_settings%rowtype;
begin
  update public.anpi_settings
  set paused_at = null,
      paused_until = null,
      pause_reason = null
  where subject_user_id = v_uid
    and owner_user_id = v_uid
    and deleted_at is null
  returning * into v_row;

  if not found then
    raise exception using errcode = '22000', message = 'anpi_setting_not_found';
  end if;

  return v_row;
end;
$$;

comment on function public.anpi_resume_my_settings() is
  'Phase 3: clear pause on self settings. Expired paused_until alone is not enough.';

revoke all on function public.anpi_resume_my_settings() from public, anon;
grant execute on function public.anpi_resume_my_settings() to authenticated;

-- ---------------------------------------------------------------------------
-- Today check: read + ensure (no cron; client/open-app path for Phase 3)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_get_my_today_check()
returns public.anpi_check_instances
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := public.anpi_phase3_require_auth();
  v_row public.anpi_check_instances%rowtype;
begin
  select * into v_row
  from public.anpi_check_instances c
  where c.subject_user_id = v_uid
    and c.local_check_date = public.anpi_phase3_tokyo_today();

  return v_row;
end;
$$;

comment on function public.anpi_get_my_today_check() is
  'Phase 3: read today Asia/Tokyo check for auth.uid() without creating one.';

revoke all on function public.anpi_get_my_today_check() from public, anon;
grant execute on function public.anpi_get_my_today_check() to authenticated;

create or replace function public.anpi_ensure_my_today_check()
returns table (
  check_id uuid,
  status text,
  local_check_date date,
  scheduled_at timestamptz,
  confirmed_at timestamptz,
  created boolean,
  skipped_reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := public.anpi_phase3_require_auth();
  v_setting public.anpi_settings%rowtype;
  v_today date := public.anpi_phase3_tokyo_today();
  v_dow smallint;
  v_existing public.anpi_check_instances%rowtype;
  v_scheduled_at timestamptz;
  v_id uuid;
begin
  v_dow := public.anpi_phase3_tokyo_weekday(v_today);

  select * into v_setting
  from public.anpi_settings s
  where s.subject_user_id = v_uid
    and s.owner_user_id = v_uid
    and s.deleted_at is null;

  if not found then
    return query
      select null::uuid, null::text, v_today, null::timestamptz, null::timestamptz,
             false, 'anpi_setting_missing'::text;
    return;
  end if;

  if not v_setting.enabled then
    return query
      select null::uuid, null::text, v_today, null::timestamptz, null::timestamptz,
             false, 'anpi_setting_disabled'::text;
    return;
  end if;

  if v_setting.paused_at is not null then
    return query
      select null::uuid, null::text, v_today, null::timestamptz, null::timestamptz,
             false, 'anpi_setting_paused'::text;
    return;
  end if;

  if v_setting.schedule_type = 'weekdays'
     and not (v_dow = any (v_setting.weekdays)) then
    return query
      select null::uuid, null::text, v_today, null::timestamptz, null::timestamptz,
             false, 'anpi_not_scheduled_weekday'::text;
    return;
  end if;

  select * into v_existing
  from public.anpi_check_instances c
  where c.subject_user_id = v_uid
    and c.local_check_date = v_today;

  if found then
    return query
      select v_existing.id, v_existing.status, v_existing.local_check_date,
             v_existing.scheduled_at, v_existing.confirmed_at, false, null::text;
    return;
  end if;

  v_scheduled_at :=
    ((v_today + v_setting.initial_notification_time) at time zone v_setting.timezone);

  insert into public.anpi_check_instances (
    setting_id,
    owner_user_id,
    subject_user_id,
    local_check_date,
    timezone,
    scheduled_at,
    status
  ) values (
    v_setting.id,
    v_setting.owner_user_id,
    v_setting.subject_user_id,
    v_today,
    v_setting.timezone,
    v_scheduled_at,
    'scheduled'
  )
  on conflict on constraint anpi_check_instances_subject_date_key
  do nothing
  returning id into v_id;

  if v_id is not null then
    return query
      select c.id, c.status, c.local_check_date, c.scheduled_at, c.confirmed_at,
             true, null::text
      from public.anpi_check_instances c
      where c.id = v_id;
    return;
  end if;

  return query
    select c.id, c.status, c.local_check_date, c.scheduled_at, c.confirmed_at,
           false, null::text
    from public.anpi_check_instances c
    where c.subject_user_id = v_uid
      and c.local_check_date = v_today;
end;
$$;

comment on function public.anpi_ensure_my_today_check() is
  'Phase 3: idempotent today check for auth.uid(). Not a substitute for Phase 4 cron.';

revoke all on function public.anpi_ensure_my_today_check() from public, anon;
grant execute on function public.anpi_ensure_my_today_check() to authenticated;

-- ---------------------------------------------------------------------------
-- History
-- ---------------------------------------------------------------------------

create or replace function public.anpi_list_my_check_history(p_limit integer default 30)
returns table (
  check_id uuid,
  local_check_date date,
  status text,
  scheduled_at timestamptz,
  confirmed_at timestamptz,
  confirmation_source text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := public.anpi_phase3_require_auth();
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 90));
begin
  return query
  select
    c.id,
    c.local_check_date,
    c.status,
    c.scheduled_at,
    c.confirmed_at,
    c.confirmation_source
  from public.anpi_check_instances c
  where c.subject_user_id = v_uid
  order by c.local_check_date desc
  limit v_limit;
end;
$$;

comment on function public.anpi_list_my_check_history(integer) is
  'Phase 3: recent check history for auth.uid() (max 90).';

revoke all on function public.anpi_list_my_check_history(integer) from public, anon;
grant execute on function public.anpi_list_my_check_history(integer) to authenticated;
