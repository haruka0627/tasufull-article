-- ANPI Phase 4 — Scheduler & overdue / notification-candidate foundation
-- Canonical design: docs/ANPI_PRD.md §15 Phase 4
-- Local implementation only. Do not apply to Staging/Production without review.
-- Do not register production/staging cron from this migration.
--
-- Depends on:
--   20260727020000_anpi_phase2_data_foundation.sql
--   20260727030000_anpi_phase3_core_checkin.sql
-- Scope:
--   due check ensure · notified advancement · overdue mark · candidate outbox claim
-- Out of scope:
--   external send (TALK/LINE/push/email/SMS) · UI · Phase 5 contact consent UX

-- ---------------------------------------------------------------------------
-- Timezone allowlist expansion (algorithm already uses settings.timezone)
-- ---------------------------------------------------------------------------

alter table public.anpi_settings
  drop constraint if exists anpi_settings_timezone_check;

alter table public.anpi_settings
  add constraint anpi_settings_timezone_check check (
    timezone in (
      'Asia/Tokyo',
      'UTC',
      'Asia/Seoul',
      'America/Los_Angeles',
      'Europe/London'
    )
  );

alter table public.anpi_check_instances
  drop constraint if exists anpi_check_instances_timezone_check;

alter table public.anpi_check_instances
  add constraint anpi_check_instances_timezone_check check (
    timezone in (
      'Asia/Tokyo',
      'UTC',
      'Asia/Seoul',
      'America/Los_Angeles',
      'Europe/London'
    )
  );

alter table public.anpi_check_instances
  drop constraint if exists anpi_check_instances_local_date_check;

alter table public.anpi_check_instances
  add constraint anpi_check_instances_local_date_check check (
    local_check_date = (scheduled_at at time zone timezone)::date
  );

comment on column public.anpi_settings.timezone is
  'Phase 4 allowlist. Scheduler computes local date/time via this zone.';

-- ---------------------------------------------------------------------------
-- Scheduler run log
-- ---------------------------------------------------------------------------

create table public.anpi_scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  as_of timestamptz not null,
  worker_id text,
  due_created integer not null default 0,
  due_existing integer not null default 0,
  notified_advanced integer not null default 0,
  overdue_marked integer not null default 0,
  candidates_enqueued integer not null default 0,
  candidates_claimed integer not null default 0,
  error_safe text,
  created_at timestamptz not null default now(),
  constraint anpi_scheduler_runs_worker_id_length_check check (
    worker_id is null or char_length(worker_id) between 1 and 64
  ),
  constraint anpi_scheduler_runs_error_safe_length_check check (
    error_safe is null or char_length(error_safe) <= 500
  ),
  constraint anpi_scheduler_runs_counts_nonneg_check check (
    due_created >= 0
    and due_existing >= 0
    and notified_advanced >= 0
    and overdue_marked >= 0
    and candidates_enqueued >= 0
    and candidates_claimed >= 0
  )
);

comment on table public.anpi_scheduler_runs is
  'ANPI Phase 4 scheduler tick log. Safe counters only; no PII or secrets.';

create index anpi_scheduler_runs_started_idx
  on public.anpi_scheduler_runs (started_at desc);

alter table public.anpi_scheduler_runs enable row level security;

revoke all on table public.anpi_scheduler_runs from public, anon, authenticated;
grant select, insert, update on table public.anpi_scheduler_runs to service_role;

-- ---------------------------------------------------------------------------
-- Notification candidate outbox (no external send in Phase 4)
-- ---------------------------------------------------------------------------

create table public.anpi_scheduler_jobs (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.anpi_check_instances (id) on delete restrict,
  subject_user_id uuid not null references auth.users (id) on delete restrict,
  recipient_user_id uuid not null references auth.users (id) on delete restrict,
  contact_id uuid references public.anpi_contacts (id) on delete restrict,
  channel text not null default 'talk',
  kind text not null,
  status text not null default 'pending',
  attempt_count smallint not null default 0,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by text,
  completed_at timestamptz,
  last_error_safe text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anpi_scheduler_jobs_channel_check check (
    channel in ('talk', 'line', 'push', 'email', 'sms')
  ),
  constraint anpi_scheduler_jobs_kind_check check (
    kind in ('initial', 'reminder', 'contact_unconfirmed', 'late_confirmation', 'system_notice')
  ),
  constraint anpi_scheduler_jobs_status_check check (
    status in ('pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped')
  ),
  constraint anpi_scheduler_jobs_attempt_count_check check (
    attempt_count between 0 and 10
  ),
  constraint anpi_scheduler_jobs_contact_kind_check check (
    (kind in ('contact_unconfirmed', 'late_confirmation')) = (contact_id is not null)
  ),
  constraint anpi_scheduler_jobs_claimed_fields_check check (
    status <> 'processing'
    or (claimed_at is not null and claimed_by is not null)
  ),
  constraint anpi_scheduler_jobs_error_safe_length_check check (
    last_error_safe is null or char_length(last_error_safe) <= 500
  ),
  constraint anpi_scheduler_jobs_claimed_by_length_check check (
    claimed_by is null or char_length(claimed_by) between 1 and 64
  ),
  constraint anpi_scheduler_jobs_idempotency_key unique (
    check_id,
    recipient_user_id,
    channel,
    kind
  )
);

comment on table public.anpi_scheduler_jobs is
  'Phase 4 notification candidates / outbox. External providers are not invoked here.';

create index anpi_scheduler_jobs_claim_idx
  on public.anpi_scheduler_jobs (status, available_at)
  where status in ('pending', 'failed');
create index anpi_scheduler_jobs_check_idx
  on public.anpi_scheduler_jobs (check_id, created_at desc);

create trigger anpi_scheduler_jobs_set_updated_at
  before update on public.anpi_scheduler_jobs
  for each row execute function public.anpi_phase2_set_updated_at();

alter table public.anpi_scheduler_jobs enable row level security;

revoke all on table public.anpi_scheduler_jobs from public, anon, authenticated;
grant select, insert, update on table public.anpi_scheduler_jobs to service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase4_local_now(
  p_timezone text,
  p_now timestamptz
)
returns timestamp without time zone
language sql
stable
strict
set search_path = pg_catalog
as $$
  select p_now at time zone p_timezone;
$$;

create or replace function public.anpi_phase4_local_date(
  p_timezone text,
  p_now timestamptz
)
returns date
language sql
stable
strict
set search_path = pg_catalog
as $$
  select (p_now at time zone p_timezone)::date;
$$;

create or replace function public.anpi_phase4_scheduled_at(
  p_timezone text,
  p_local_date date,
  p_local_time time
)
returns timestamptz
language sql
stable
strict
set search_path = pg_catalog
as $$
  select (p_local_date + p_local_time) at time zone p_timezone;
$$;

revoke all on function public.anpi_phase4_local_now(text, timestamptz) from public, anon, authenticated;
revoke all on function public.anpi_phase4_local_date(text, timestamptz) from public, anon, authenticated;
revoke all on function public.anpi_phase4_scheduled_at(text, date, time) from public, anon, authenticated;
grant execute on function public.anpi_phase4_local_now(text, timestamptz) to service_role;
grant execute on function public.anpi_phase4_local_date(text, timestamptz) to service_role;
grant execute on function public.anpi_phase4_scheduled_at(text, date, time) to service_role;

-- Catch-up window after scheduled_at for late cron ticks (same local day practical bound).
create or replace function public.anpi_phase4_within_due_window(
  p_now timestamptz,
  p_scheduled_at timestamptz
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select p_now >= p_scheduled_at
    and p_now < p_scheduled_at + interval '18 hours';
$$;

revoke all on function public.anpi_phase4_within_due_window(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_within_due_window(timestamptz, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Ensure due daily checks (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase4_ensure_due_checks(
  p_now timestamptz default clock_timestamp()
)
returns table (
  setting_id uuid,
  check_id uuid,
  subject_user_id uuid,
  local_check_date date,
  created boolean,
  skipped_reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r record;
  v_local_date date;
  v_dow smallint;
  v_scheduled_at timestamptz;
  v_check_id uuid;
  v_existed boolean;
begin
  for r in
    select s.*
    from public.anpi_settings s
    where s.deleted_at is null
      and s.enabled
      and s.paused_at is null
    order by s.created_at
  loop
    v_local_date := public.anpi_phase4_local_date(r.timezone, p_now);
    v_dow := extract(isodow from v_local_date)::smallint;
    if r.schedule_type = 'weekdays' and not (v_dow = any (r.weekdays)) then
      setting_id := r.id;
      check_id := null;
      subject_user_id := r.subject_user_id;
      local_check_date := v_local_date;
      created := false;
      skipped_reason := 'anpi_not_scheduled_weekday';
      return next;
      continue;
    end if;

    v_scheduled_at := public.anpi_phase4_scheduled_at(
      r.timezone,
      v_local_date,
      r.initial_notification_time
    );

    if p_now < v_scheduled_at then
      setting_id := r.id;
      check_id := null;
      subject_user_id := r.subject_user_id;
      local_check_date := v_local_date;
      created := false;
      skipped_reason := 'anpi_before_scheduled_time';
      return next;
      continue;
    end if;

    if not public.anpi_phase4_within_due_window(p_now, v_scheduled_at) then
      setting_id := r.id;
      check_id := null;
      subject_user_id := r.subject_user_id;
      local_check_date := v_local_date;
      created := false;
      skipped_reason := 'anpi_outside_due_window';
      return next;
      continue;
    end if;

    select exists (
      select 1
      from public.anpi_check_instances c
      where c.subject_user_id = r.subject_user_id
        and c.local_check_date = v_local_date
    ) into v_existed;

    v_check_id := public.anpi_create_daily_check(r.id, v_local_date, v_scheduled_at);

    setting_id := r.id;
    check_id := v_check_id;
    subject_user_id := r.subject_user_id;
    local_check_date := v_local_date;
    created := not v_existed;
    skipped_reason := null;
    return next;
  end loop;
end;
$$;

comment on function public.anpi_phase4_ensure_due_checks(timestamptz) is
  'Service-only: create due daily checks using settings timezone. Idempotent via unique subject/date.';

revoke all on function public.anpi_phase4_ensure_due_checks(timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_ensure_due_checks(timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Advance scheduled → notified and enqueue initial candidates
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase4_advance_notified_and_queue_initial(
  p_now timestamptz default clock_timestamp()
)
returns table (
  check_id uuid,
  job_id uuid,
  advanced boolean,
  enqueued boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r record;
  v_job_id uuid;
  v_advanced boolean;
  v_enqueued boolean;
begin
  for r in
    select c.*
    from public.anpi_check_instances c
    where c.status = 'scheduled'
      and c.scheduled_at <= p_now
      and c.confirmed_at is null
    order by c.scheduled_at
    for update of c skip locked
  loop
    v_advanced := false;
    v_enqueued := false;
    v_job_id := null;

    update public.anpi_check_instances c
    set status = 'notified',
        first_notified_at = coalesce(c.first_notified_at, p_now)
    where c.id = r.id
      and c.status = 'scheduled'
    returning c.id into check_id;

    if check_id is not null then
      v_advanced := true;
    else
      check_id := r.id;
    end if;

    insert into public.anpi_scheduler_jobs (
      check_id,
      subject_user_id,
      recipient_user_id,
      channel,
      kind,
      status,
      available_at
    ) values (
      r.id,
      r.subject_user_id,
      r.subject_user_id,
      'talk',
      'initial',
      'pending',
      p_now
    )
    on conflict on constraint anpi_scheduler_jobs_idempotency_key
    do nothing
    returning id into v_job_id;

    if v_job_id is null then
      select j.id into v_job_id
      from public.anpi_scheduler_jobs j
      where j.check_id = r.id
        and j.recipient_user_id = r.subject_user_id
        and j.channel = 'talk'
        and j.kind = 'initial';
      v_enqueued := false;
    else
      v_enqueued := true;
    end if;

    job_id := v_job_id;
    advanced := v_advanced;
    enqueued := v_enqueued;
    return next;
  end loop;
end;
$$;

comment on function public.anpi_phase4_advance_notified_and_queue_initial(timestamptz) is
  'Service-only: scheduled→notified and idempotent initial notification candidate enqueue.';

revoke all on function public.anpi_phase4_advance_notified_and_queue_initial(timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_advance_notified_and_queue_initial(timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Mark overdue (confirmed excluded)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase4_mark_overdue_checks(
  p_now timestamptz default clock_timestamp()
)
returns table (
  check_id uuid,
  previous_status text,
  marked boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r record;
  v_deadline timestamptz;
begin
  for r in
    select
      c.*,
      s.contact_notify_after
    from public.anpi_check_instances c
    join public.anpi_settings s on s.id = c.setting_id
    where c.status in ('notified', 'reminded')
      and c.confirmed_at is null
    order by c.scheduled_at
    for update of c skip locked
  loop
    v_deadline := r.scheduled_at + r.contact_notify_after;
    check_id := r.id;
    previous_status := r.status;

    if p_now < v_deadline then
      marked := false;
      return next;
      continue;
    end if;

    update public.anpi_check_instances c
    set status = 'overdue',
        overdue_at = coalesce(c.overdue_at, p_now),
        first_notified_at = coalesce(c.first_notified_at, c.scheduled_at)
    where c.id = r.id
      and c.status in ('notified', 'reminded')
      and c.confirmed_at is null;

    marked := found;
    return next;
  end loop;
end;
$$;

comment on function public.anpi_phase4_mark_overdue_checks(timestamptz) is
  'Service-only: notified/reminded → overdue after scheduled_at + contact_notify_after. Confirmed excluded.';

revoke all on function public.anpi_phase4_mark_overdue_checks(timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_mark_overdue_checks(timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Enqueue contact_unconfirmed candidates for overdue checks
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase4_enqueue_contact_candidates(
  p_now timestamptz default clock_timestamp()
)
returns table (
  check_id uuid,
  contact_id uuid,
  job_id uuid,
  enqueued boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r record;
  v_job_id uuid;
begin
  for r in
    select
      c.id as check_id,
      c.subject_user_id,
      ec.id as contact_id,
      ec.contact_user_id as recipient_user_id
    from public.anpi_check_instances c
    join public.anpi_contacts ec
      on ec.subject_user_id = c.subject_user_id
     and ec.status = 'active'
     and ec.accepted_at is not null
     and ec.revoked_at is null
     and ec.deleted_at is null
     and ec.contact_user_id is not null
    where c.status = 'overdue'
      and c.confirmed_at is null
    order by c.scheduled_at, ec.priority, ec.created_at
  loop
    insert into public.anpi_scheduler_jobs (
      check_id,
      subject_user_id,
      recipient_user_id,
      contact_id,
      channel,
      kind,
      status,
      available_at
    ) values (
      r.check_id,
      r.subject_user_id,
      r.recipient_user_id,
      r.contact_id,
      'talk',
      'contact_unconfirmed',
      'pending',
      p_now
    )
    on conflict on constraint anpi_scheduler_jobs_idempotency_key
    do nothing
    returning id into v_job_id;

    check_id := r.check_id;
    contact_id := r.contact_id;
    if v_job_id is null then
      select j.id into v_job_id
      from public.anpi_scheduler_jobs j
      where j.check_id = r.check_id
        and j.recipient_user_id = r.recipient_user_id
        and j.channel = 'talk'
        and j.kind = 'contact_unconfirmed';
      job_id := v_job_id;
      enqueued := false;
    else
      job_id := v_job_id;
      enqueued := true;
    end if;
    return next;
  end loop;
end;
$$;

comment on function public.anpi_phase4_enqueue_contact_candidates(timestamptz) is
  'Service-only: idempotent contact_unconfirmed candidates for overdue checks. No send.';

revoke all on function public.anpi_phase4_enqueue_contact_candidates(timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_enqueue_contact_candidates(timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Claim / complete / fail candidates
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase4_claim_notification_candidates(
  p_worker_id text,
  p_limit integer default 50,
  p_now timestamptz default clock_timestamp()
)
returns setof public.anpi_scheduler_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if p_worker_id is null or char_length(p_worker_id) < 1 or char_length(p_worker_id) > 64 then
    raise exception using errcode = '22023', message = 'anpi_invalid_worker_id';
  end if;

  return query
  with picked as (
    select j.id
    from public.anpi_scheduler_jobs j
    where j.status = 'pending'
      and j.available_at <= p_now
    order by j.available_at, j.created_at
    for update skip locked
    limit v_limit
  )
  update public.anpi_scheduler_jobs j
  set status = 'processing',
      claimed_at = p_now,
      claimed_by = p_worker_id,
      attempt_count = j.attempt_count + 1
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

comment on function public.anpi_phase4_claim_notification_candidates(text, integer, timestamptz) is
  'Service-only: claim pending candidates with SKIP LOCKED. External send not performed.';

revoke all on function public.anpi_phase4_claim_notification_candidates(text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_claim_notification_candidates(text, integer, timestamptz)
  to service_role;

create or replace function public.anpi_phase4_complete_notification_candidate(
  p_job_id uuid,
  p_worker_id text,
  p_status text default 'sent',
  p_now timestamptz default clock_timestamp()
)
returns public.anpi_scheduler_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.anpi_scheduler_jobs%rowtype;
begin
  if p_status is null or p_status not in ('sent', 'skipped', 'cancelled') then
    raise exception using errcode = '22023', message = 'anpi_invalid_completion_status';
  end if;

  update public.anpi_scheduler_jobs j
  set status = p_status,
      completed_at = p_now,
      last_error_safe = null
  where j.id = p_job_id
    and j.status = 'processing'
    and j.claimed_by = p_worker_id
  returning * into v_row;

  if not found then
    raise exception using errcode = '22000', message = 'anpi_job_not_claimable';
  end if;
  return v_row;
end;
$$;

revoke all on function public.anpi_phase4_complete_notification_candidate(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_complete_notification_candidate(uuid, text, text, timestamptz)
  to service_role;

create or replace function public.anpi_phase4_fail_notification_candidate(
  p_job_id uuid,
  p_worker_id text,
  p_error_safe text default null,
  p_now timestamptz default clock_timestamp(),
  p_retry_after interval default interval '5 minutes'
)
returns public.anpi_scheduler_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.anpi_scheduler_jobs%rowtype;
  v_retry boolean;
begin
  if p_error_safe is not null and char_length(p_error_safe) > 500 then
    raise exception using errcode = '22023', message = 'anpi_invalid_error_safe';
  end if;

  select * into v_row
  from public.anpi_scheduler_jobs j
  where j.id = p_job_id
  for update;

  if not found
     or v_row.status <> 'processing'
     or v_row.claimed_by is distinct from p_worker_id then
    raise exception using errcode = '22000', message = 'anpi_job_not_claimable';
  end if;

  v_retry := v_row.attempt_count < 5;

  update public.anpi_scheduler_jobs j
  set status = case when v_retry then 'pending' else 'failed' end,
      available_at = case
        when v_retry then p_now + coalesce(p_retry_after, interval '5 minutes')
        else j.available_at
      end,
      claimed_at = null,
      claimed_by = null,
      completed_at = case when v_retry then null else p_now end,
      last_error_safe = p_error_safe
  where j.id = p_job_id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.anpi_phase4_fail_notification_candidate(uuid, text, text, timestamptz, interval) is
  'Service-only: release claimed job to pending with backoff, or mark failed after attempts.';

revoke all on function public.anpi_phase4_fail_notification_candidate(uuid, text, text, timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_fail_notification_candidate(uuid, text, text, timestamptz, interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- Tick orchestrator (advisory lock)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase4_scheduler_tick(
  p_now timestamptz default clock_timestamp(),
  p_worker_id text default 'anpi-phase4-tick',
  p_claim_limit integer default 0
)
returns public.anpi_scheduler_runs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.anpi_scheduler_runs%rowtype;
  v_lock_key bigint := hashtextextended('anpi_phase4_scheduler_tick', 0);
  v_due_created integer := 0;
  v_due_existing integer := 0;
  v_notified integer := 0;
  v_overdue integer := 0;
  v_enqueued integer := 0;
  v_claimed integer := 0;
begin
  if not pg_try_advisory_xact_lock(v_lock_key) then
    insert into public.anpi_scheduler_runs (
      as_of, worker_id, finished_at, error_safe
    ) values (
      p_now, p_worker_id, clock_timestamp(), 'anpi_scheduler_lock_busy'
    )
    returning * into v_run;
    return v_run;
  end if;

  insert into public.anpi_scheduler_runs (as_of, worker_id)
  values (p_now, p_worker_id)
  returning * into v_run;

  select
    coalesce(sum(case when d.created then 1 else 0 end), 0)::integer,
    coalesce(sum(case when d.created = false and d.skipped_reason is null then 1 else 0 end), 0)::integer
  into v_due_created, v_due_existing
  from public.anpi_phase4_ensure_due_checks(p_now) d;

  select coalesce(sum(case when a.advanced then 1 else 0 end), 0)::integer
  into v_notified
  from public.anpi_phase4_advance_notified_and_queue_initial(p_now) a;

  select coalesce(sum(case when o.marked then 1 else 0 end), 0)::integer
  into v_overdue
  from public.anpi_phase4_mark_overdue_checks(p_now) o;

  select coalesce(sum(case when e.enqueued then 1 else 0 end), 0)::integer
  into v_enqueued
  from public.anpi_phase4_enqueue_contact_candidates(p_now) e;

  if coalesce(p_claim_limit, 0) > 0 then
    select coalesce(count(*), 0)::integer
    into v_claimed
    from public.anpi_phase4_claim_notification_candidates(
      p_worker_id,
      p_claim_limit,
      p_now
    );
  end if;

  update public.anpi_scheduler_runs r
  set finished_at = clock_timestamp(),
      due_created = v_due_created,
      due_existing = v_due_existing,
      notified_advanced = v_notified,
      overdue_marked = v_overdue,
      candidates_enqueued = v_enqueued,
      candidates_claimed = v_claimed
  where r.id = v_run.id
  returning * into v_run;

  return v_run;
end;
$$;

comment on function public.anpi_phase4_scheduler_tick(timestamptz, text, integer) is
  'Service-only scheduler tick under transaction advisory lock. No external notification send. No cron registration.';

revoke all on function public.anpi_phase4_scheduler_tick(timestamptz, text, integer)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_scheduler_tick(timestamptz, text, integer)
  to service_role;

-- Cron registration is intentionally NOT created here.
-- Staging/Production must register via reviewed runbook only, e.g.:
--   select cron.schedule('anpi-phase4-tick', '*/1 * * * *',
--     $$select public.anpi_phase4_scheduler_tick();$$);
-- Local verification invokes anpi_phase4_scheduler_tick() manually.
