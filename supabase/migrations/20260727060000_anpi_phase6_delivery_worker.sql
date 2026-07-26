-- ANPI Phase 6 — Delivery Worker Foundation (local TALK stub)
-- Canonical design: docs/ANPI_PRD.md §15 Phase 6 / reports/anpi-phase6-delivery-worker.md
-- Local implementation only. Do not apply to Staging/Production without review.
--
-- Depends on:
--   20260727020000_anpi_phase2_data_foundation.sql
--   20260727030000_anpi_phase3_core_checkin.sql
--   20260727040000_anpi_phase4_scheduler.sql
--   20260727050000_anpi_phase5_emergency_contacts.sql
-- Scope:
--   claim/lease · delivery attempt ledger · TALK local stub · retry/terminal
--   · confirm/revoke race · stale recovery · Node one-shot worker contract
-- Out of scope:
--   real TALK / LINE / SMS / email / push · FROZEN UI · production cron

-- ---------------------------------------------------------------------------
-- Job lease column (stale processing recovery)
-- ---------------------------------------------------------------------------

alter table public.anpi_scheduler_jobs
  add column if not exists lease_expires_at timestamptz;

comment on column public.anpi_scheduler_jobs.lease_expires_at is
  'Phase 6 claim lease. Stale recovery may release processing rows past this instant.';

create index if not exists anpi_scheduler_jobs_lease_idx
  on public.anpi_scheduler_jobs (status, lease_expires_at)
  where status = 'processing';

-- ---------------------------------------------------------------------------
-- Extend Phase 2 delivery ledger for attempt-per-row audit
-- (Phase 2 migration file is not edited)
-- ---------------------------------------------------------------------------

alter table public.anpi_notification_deliveries
  add column if not exists scheduler_job_id uuid
    references public.anpi_scheduler_jobs (id) on delete restrict,
  add column if not exists attempt_number smallint,
  add column if not exists idempotency_key text,
  add column if not exists claimed_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists retryable boolean;

-- Backfill attempt_number for any pre-Phase-6 rows.
update public.anpi_notification_deliveries
set attempt_number = greatest(coalesce(attempt_count, 1), 1)
where attempt_number is null;

alter table public.anpi_notification_deliveries
  alter column attempt_number set default 1,
  alter column attempt_number set not null;

-- Allow processing status for in-flight attempts.
alter table public.anpi_notification_deliveries
  drop constraint if exists anpi_notification_deliveries_status_check;

alter table public.anpi_notification_deliveries
  add constraint anpi_notification_deliveries_status_check check (
    status in ('queued', 'processing', 'sent', 'delivered', 'failed', 'skipped', 'cancelled')
  );

alter table public.anpi_notification_deliveries
  drop constraint if exists anpi_notification_deliveries_attempt_number_check;

alter table public.anpi_notification_deliveries
  add constraint anpi_notification_deliveries_attempt_number_check check (
    attempt_number between 1 and 10
  );

alter table public.anpi_notification_deliveries
  drop constraint if exists anpi_notification_deliveries_idempotency_key_format_check;

alter table public.anpi_notification_deliveries
  add constraint anpi_notification_deliveries_idempotency_key_format_check check (
    idempotency_key is null
    or (
      char_length(idempotency_key) between 8 and 200
      and idempotency_key !~ '[[:space:]]'
    )
  );

-- Phase 2 unique becomes a partial unique for legacy rows without a job link.
-- Phase 6 attempt rows use (scheduler_job_id, attempt_number) instead.
alter table public.anpi_notification_deliveries
  drop constraint if exists anpi_notification_deliveries_idempotency_key;

create unique index if not exists anpi_notification_deliveries_legacy_logical_uidx
  on public.anpi_notification_deliveries (check_id, recipient_user_id, channel, kind)
  where scheduler_job_id is null;

create unique index if not exists anpi_notification_deliveries_job_attempt_uidx
  on public.anpi_notification_deliveries (scheduler_job_id, attempt_number)
  where scheduler_job_id is not null;

create unique index if not exists anpi_notification_deliveries_idempotency_uidx
  on public.anpi_notification_deliveries (idempotency_key)
  where idempotency_key is not null;

create index if not exists anpi_notification_deliveries_job_idx
  on public.anpi_notification_deliveries (scheduler_job_id, created_at desc)
  where scheduler_job_id is not null;

comment on column public.anpi_notification_deliveries.scheduler_job_id is
  'Phase 6 outbox job this attempt belongs to. Null = legacy Phase 2 logical row.';
comment on column public.anpi_notification_deliveries.attempt_number is
  '1-based delivery attempt for a scheduler job. Unique with scheduler_job_id.';
comment on column public.anpi_notification_deliveries.idempotency_key is
  'Stable key anpi:{job_id}:{attempt}. Used by TALK stub and future providers. No PII.';

-- ---------------------------------------------------------------------------
-- Contact delivery guard: allow skipped/cancelled audit rows after revoke
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase2_guard_contact_delivery()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_subject uuid;
begin
  select c.subject_user_id into v_subject
  from public.anpi_check_instances c
  where c.id = new.check_id;

  if v_subject is null then
    raise exception using
      errcode = '22000',
      message = 'anpi_delivery_check_missing';
  end if;

  if new.kind in ('initial', 'reminder', 'system_notice')
     and new.recipient_user_id is distinct from v_subject then
    raise exception using
      errcode = '42501',
      message = 'anpi_delivery_recipient_not_subject';
  end if;

  -- Phase 6: skipped/cancelled attempts may retain historical contact_id for audit
  -- even after revoke. Live send paths must still pass eligibility.
  if new.contact_id is not null
     and new.status not in ('skipped', 'cancelled')
     and not exists (
    select 1
    from public.anpi_contacts c
    where c.id = new.contact_id
      and c.subject_user_id = v_subject
      and c.contact_user_id = new.recipient_user_id
      and c.status = 'active'
      and c.accepted_at is not null
      and c.revoked_at is null
      and c.deleted_at is null
  ) then
    raise exception using
      errcode = '42501',
      message = 'anpi_contact_not_notification_eligible';
  end if;
  return new;
end;
$$;

revoke all on function public.anpi_phase2_guard_contact_delivery() from public;

-- digest() for stub message ids (local only; already available on Supabase).
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Local TALK stub receipts (idempotent provider simulation)
-- ---------------------------------------------------------------------------

create table if not exists public.anpi_delivery_stub_receipts (
  idempotency_key text primary key,
  result text not null,
  provider_message_id text not null,
  stub_mode text not null,
  created_at timestamptz not null default now(),
  constraint anpi_delivery_stub_receipts_result_check check (
    result in ('success', 'retryable_failure', 'terminal_failure', 'timeout')
  ),
  constraint anpi_delivery_stub_receipts_mode_check check (
    stub_mode in ('success', 'retryable_failure', 'terminal_failure', 'timeout')
  ),
  constraint anpi_delivery_stub_receipts_key_check check (
    char_length(idempotency_key) between 8 and 200
    and idempotency_key !~ '[[:space:]]'
  ),
  constraint anpi_delivery_stub_receipts_msgid_check check (
    char_length(provider_message_id) between 8 and 120
  )
);

comment on table public.anpi_delivery_stub_receipts is
  'Local TALK stub idempotency ledger. Same key always returns the first result. No PII.';

alter table public.anpi_delivery_stub_receipts enable row level security;
revoke all on table public.anpi_delivery_stub_receipts from public, anon, authenticated;
grant select, insert on table public.anpi_delivery_stub_receipts to service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase6_idempotency_key(
  p_job_id uuid,
  p_attempt integer
)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select 'anpi:' || p_job_id::text || ':' || p_attempt::text;
$$;

revoke all on function public.anpi_phase6_idempotency_key(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_idempotency_key(uuid, integer)
  to service_role;

create or replace function public.anpi_phase6_job_deliverable(
  p_job public.anpi_scheduler_jobs
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_check public.anpi_check_instances%rowtype;
  v_contact public.anpi_contacts%rowtype;
begin
  if p_job.status in ('sent', 'failed', 'cancelled', 'skipped') then
    return 'anpi_job_terminal';
  end if;
  if p_job.status not in ('pending', 'processing') then
    return 'anpi_job_not_deliverable';
  end if;
  if p_job.channel is distinct from 'talk' then
    return 'anpi_channel_not_supported';
  end if;

  select * into v_check
  from public.anpi_check_instances c
  where c.id = p_job.check_id;

  if not found then
    return 'anpi_check_missing';
  end if;

  -- Confirmed checks: never send third-party (or leftover self) notifications.
  if v_check.confirmed_at is not null
     or v_check.status in ('confirmed', 'confirmed_late') then
    return 'anpi_check_confirmed';
  end if;

  if p_job.kind in ('initial', 'reminder', 'system_notice') then
    if p_job.recipient_user_id is distinct from v_check.subject_user_id then
      return 'anpi_delivery_recipient_not_subject';
    end if;
    if p_job.contact_id is not null then
      return 'anpi_self_job_has_contact';
    end if;
    return null;
  end if;

  -- Third-party kinds require an eligible Phase 5 contact.
  if p_job.contact_id is null then
    return 'anpi_contact_required';
  end if;

  select * into v_contact
  from public.anpi_contacts c
  where c.id = p_job.contact_id;

  if not found then
    return 'anpi_contact_missing';
  end if;
  if v_contact.deleted_at is not null or v_contact.revoked_at is not null
     or v_contact.status = 'revoked' then
    return 'anpi_contact_revoked';
  end if;
  if v_contact.paused_at is not null then
    return 'anpi_contact_paused';
  end if;
  if v_contact.status is distinct from 'active'
     or v_contact.accepted_at is null then
    return 'anpi_contact_not_active';
  end if;
  if v_contact.verification_status is distinct from 'verified' then
    return 'anpi_contact_not_verified';
  end if;
  if v_contact.consent_status is distinct from 'accepted' then
    return 'anpi_contact_consent_not_accepted';
  end if;
  if v_contact.contact_user_id is distinct from p_job.recipient_user_id then
    return 'anpi_contact_recipient_mismatch';
  end if;
  if v_contact.subject_user_id is distinct from p_job.subject_user_id then
    return 'anpi_contact_subject_mismatch';
  end if;
  if v_contact.channel is distinct from 'talk' then
    return 'anpi_contact_channel_not_talk';
  end if;

  return null;
end;
$$;

comment on function public.anpi_phase6_job_deliverable(public.anpi_scheduler_jobs) is
  'Service-only pre-send eligibility. Null = deliverable; otherwise a safe skip/cancel code.';

revoke all on function public.anpi_phase6_job_deliverable(public.anpi_scheduler_jobs)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_job_deliverable(public.anpi_scheduler_jobs)
  to service_role;

-- ---------------------------------------------------------------------------
-- Cancel pending jobs for a confirmed check (confirm race)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase6_cancel_jobs_for_check(
  p_check_id uuid,
  p_reason text default 'anpi_check_confirmed',
  p_now timestamptz default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rows integer := 0;
begin
  if p_reason is null or char_length(p_reason) < 1 or char_length(p_reason) > 80 then
    raise exception using errcode = '22023', message = 'anpi_invalid_cancel_reason';
  end if;

  update public.anpi_scheduler_jobs j
  set status = 'cancelled',
      completed_at = coalesce(j.completed_at, p_now),
      claimed_at = null,
      claimed_by = null,
      lease_expires_at = null,
      last_error_safe = p_reason
  where j.check_id = p_check_id
    and j.status = 'pending';

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.anpi_phase6_cancel_jobs_for_check(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_cancel_jobs_for_check(uuid, text, timestamptz)
  to service_role;

-- Recreate confirm to cancel pending outbox jobs after successful confirm.
-- Phase 2 migration file is not edited; grants/signature stay compatible.
create or replace function public.anpi_confirm_check(
  p_check_id uuid,
  p_source text
)
returns table (
  check_id uuid,
  status text,
  confirmed_at timestamptz,
  local_check_date date,
  duplicate boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_check public.anpi_check_instances%rowtype;
  v_new_status text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'anpi_auth_required';
  end if;
  if p_source is null or p_source not in ('anpi_ui', 'talk') then
    raise exception using errcode = '22023', message = 'anpi_invalid_confirmation_source';
  end if;

  select * into v_check
  from public.anpi_check_instances c
  where c.id = p_check_id
  for update;

  if not found or v_check.subject_user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'anpi_check_not_accessible';
  end if;

  if v_check.local_check_date <> (now() at time zone 'Asia/Tokyo')::date then
    raise exception using errcode = '22000', message = 'anpi_check_not_today';
  end if;

  if v_check.status in ('confirmed', 'confirmed_late') then
    perform public.anpi_phase6_cancel_jobs_for_check(v_check.id, 'anpi_check_confirmed');
    return query
      select v_check.id, v_check.status, v_check.confirmed_at,
             v_check.local_check_date, true;
    return;
  end if;

  if v_check.status in ('paused', 'cancelled') then
    raise exception using errcode = '22000', message = 'anpi_check_not_confirmable';
  end if;

  v_new_status := case
    when v_check.status = 'contact_notified' then 'confirmed_late'
    else 'confirmed'
  end;

  update public.anpi_check_instances
  set status = v_new_status,
      confirmed_at = now(),
      confirmation_source = p_source
  where id = v_check.id
  returning * into v_check;

  perform public.anpi_phase6_cancel_jobs_for_check(v_check.id, 'anpi_check_confirmed');

  return query
    select v_check.id, v_check.status, v_check.confirmed_at,
           v_check.local_check_date, false;
end;
$$;

comment on function public.anpi_confirm_check(uuid, text) is
  'Idempotent本人 confirm. Phase 6: also cancels pending scheduler jobs for the check.';

revoke all on function public.anpi_confirm_check(uuid, text) from public, anon;
grant execute on function public.anpi_confirm_check(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Claim with lease (does not claim cancelled/sent; SKIP LOCKED)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase6_claim_jobs(
  p_worker_id text,
  p_limit integer default 20,
  p_now timestamptz default clock_timestamp(),
  p_lease interval default interval '2 minutes'
)
returns setof public.anpi_scheduler_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_lease interval := coalesce(p_lease, interval '2 minutes');
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
      and j.channel = 'talk'
    order by j.available_at, j.created_at
    for update skip locked
    limit v_limit
  )
  update public.anpi_scheduler_jobs j
  set status = 'processing',
      claimed_at = p_now,
      claimed_by = p_worker_id,
      lease_expires_at = p_now + v_lease,
      attempt_count = j.attempt_count + 1
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

comment on function public.anpi_phase6_claim_jobs(text, integer, timestamptz, interval) is
  'Service-only: claim pending talk jobs with SKIP LOCKED + lease. No external send.';

revoke all on function public.anpi_phase6_claim_jobs(text, integer, timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_claim_jobs(text, integer, timestamptz, interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- TALK local stub
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase6_talk_stub_send(
  p_idempotency_key text,
  p_stub_mode text default 'success',
  p_now timestamptz default clock_timestamp()
)
returns table (
  result text,
  provider_message_id text,
  already_seen boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.anpi_delivery_stub_receipts%rowtype;
  v_msg text;
begin
  if p_idempotency_key is null
     or char_length(p_idempotency_key) < 8
     or char_length(p_idempotency_key) > 200 then
    raise exception using errcode = '22023', message = 'anpi_invalid_idempotency_key';
  end if;
  if p_stub_mode is null
     or p_stub_mode not in ('success', 'retryable_failure', 'terminal_failure', 'timeout') then
    raise exception using errcode = '22023', message = 'anpi_invalid_stub_mode';
  end if;

  select * into v_existing
  from public.anpi_delivery_stub_receipts r
  where r.idempotency_key = p_idempotency_key;

  if found then
    result := v_existing.result;
    provider_message_id := v_existing.provider_message_id;
    already_seen := true;
    return next;
    return;
  end if;

  v_msg := 'local-stub:' || encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex');

  insert into public.anpi_delivery_stub_receipts (
    idempotency_key, result, provider_message_id, stub_mode, created_at
  ) values (
    p_idempotency_key, p_stub_mode, left(v_msg, 80), p_stub_mode, p_now
  )
  on conflict (idempotency_key) do nothing;

  select * into v_existing
  from public.anpi_delivery_stub_receipts r
  where r.idempotency_key = p_idempotency_key;

  result := v_existing.result;
  provider_message_id := v_existing.provider_message_id;
  already_seen := false;
  return next;
end;
$$;

comment on function public.anpi_phase6_talk_stub_send(text, text, timestamptz) is
  'Local TALK stub only. Deterministic result per idempotency_key. No network I/O.';

revoke all on function public.anpi_phase6_talk_stub_send(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_talk_stub_send(text, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Process one claimed job end-to-end (SQL path used by tests + Node worker)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase6_process_claimed_job(
  p_job_id uuid,
  p_worker_id text,
  p_stub_mode text default 'success',
  p_now timestamptz default clock_timestamp(),
  p_retry_after interval default interval '5 minutes'
)
returns table (
  job_id uuid,
  job_status text,
  delivery_id uuid,
  delivery_status text,
  attempt_number integer,
  outcome text,
  skip_reason text,
  provider_message_id text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.anpi_scheduler_jobs%rowtype;
  v_reason text;
  v_attempt integer;
  v_key text;
  v_delivery public.anpi_notification_deliveries%rowtype;
  v_stub record;
  v_retry boolean;
  v_backoff interval;
begin
  if p_worker_id is null or char_length(p_worker_id) < 1 or char_length(p_worker_id) > 64 then
    raise exception using errcode = '22023', message = 'anpi_invalid_worker_id';
  end if;

  select * into v_job
  from public.anpi_scheduler_jobs j
  where j.id = p_job_id
  for update;

  if not found then
    raise exception using errcode = '22000', message = 'anpi_job_not_found';
  end if;

  -- Already terminal: idempotent no-op.
  if v_job.status in ('sent', 'failed', 'cancelled', 'skipped') then
    job_id := v_job.id;
    job_status := v_job.status;
    delivery_id := null;
    delivery_status := null;
    attempt_number := v_job.attempt_count;
    outcome := 'already_terminal';
    skip_reason := null;
    provider_message_id := null;
    return next;
    return;
  end if;

  if v_job.status <> 'processing'
     or v_job.claimed_by is distinct from p_worker_id then
    raise exception using errcode = '22000', message = 'anpi_job_not_claimable';
  end if;

  v_reason := public.anpi_phase6_job_deliverable(v_job);
  if v_reason is not null then
    update public.anpi_scheduler_jobs j
    set status = 'cancelled',
        completed_at = p_now,
        claimed_at = null,
        claimed_by = null,
        lease_expires_at = null,
        last_error_safe = v_reason
    where j.id = v_job.id
    returning * into v_job;

    -- Audit skip row (contact kinds allowed for cancelled/skipped by guard).
    v_attempt := greatest(v_job.attempt_count, 1);
    v_key := public.anpi_phase6_idempotency_key(v_job.id, v_attempt);
    begin
      insert into public.anpi_notification_deliveries (
        scheduler_job_id, check_id, recipient_user_id, contact_id,
        channel, kind, status, provider, attempt_count, attempt_number,
        idempotency_key, claimed_at, started_at, cancelled_at,
        failure_code, retryable
      ) values (
        v_job.id, v_job.check_id, v_job.recipient_user_id, v_job.contact_id,
        v_job.channel, v_job.kind, 'cancelled', 'talk_local_stub',
        v_attempt, v_attempt, v_key, v_job.claimed_at, p_now, p_now,
        v_reason, false
      )
      returning * into v_delivery;
    exception when unique_violation then
      select * into v_delivery
      from public.anpi_notification_deliveries d
      where d.scheduler_job_id = v_job.id
        and d.attempt_number = v_attempt;
    end;

    job_id := v_job.id;
    job_status := v_job.status;
    delivery_id := v_delivery.id;
    delivery_status := coalesce(v_delivery.status, 'cancelled');
    attempt_number := v_attempt;
    outcome := 'cancelled';
    skip_reason := v_reason;
    provider_message_id := null;
    return next;
    return;
  end if;

  v_attempt := greatest(v_job.attempt_count, 1);
  v_key := public.anpi_phase6_idempotency_key(v_job.id, v_attempt);

  -- Resume incomplete attempt if provider already succeeded (crash after stub).
  select * into v_delivery
  from public.anpi_notification_deliveries d
  where d.scheduler_job_id = v_job.id
    and d.attempt_number = v_attempt
  for update;

  if not found then
    begin
      insert into public.anpi_notification_deliveries (
        scheduler_job_id, check_id, recipient_user_id, contact_id,
        channel, kind, status, provider, attempt_count, attempt_number,
        idempotency_key, claimed_at, started_at, retryable
      ) values (
        v_job.id, v_job.check_id, v_job.recipient_user_id, v_job.contact_id,
        v_job.channel, v_job.kind, 'processing', 'talk_local_stub',
        v_attempt, v_attempt, v_key, coalesce(v_job.claimed_at, p_now), p_now, null
      )
      returning * into v_delivery;
    exception when unique_violation then
      select * into v_delivery
      from public.anpi_notification_deliveries d
      where d.scheduler_job_id = v_job.id
        and d.attempt_number = v_attempt
      for update;
    end;

    if v_delivery.id is null then
      raise exception using errcode = '22000', message = 'anpi_delivery_attempt_missing';
    end if;
  end if;

  if v_delivery.status = 'delivered' then
    update public.anpi_scheduler_jobs j
    set status = 'sent',
        completed_at = coalesce(j.completed_at, p_now),
        lease_expires_at = null,
        last_error_safe = null
    where j.id = v_job.id
    returning * into v_job;

    job_id := v_job.id;
    job_status := v_job.status;
    delivery_id := v_delivery.id;
    delivery_status := v_delivery.status;
    attempt_number := v_attempt;
    outcome := 'delivered';
    skip_reason := null;
    provider_message_id := v_delivery.provider_message_id;
    return next;
    return;
  end if;

  select * into v_stub
  from public.anpi_phase6_talk_stub_send(v_key, p_stub_mode, p_now);

  if v_stub.result = 'success' then
    update public.anpi_notification_deliveries d
    set status = 'delivered',
        provider_message_id = v_stub.provider_message_id,
        delivered_at = coalesce(d.delivered_at, p_now),
        sent_at = coalesce(d.sent_at, p_now),
        failed_at = null,
        failure_code = null,
        failure_detail_safe = null,
        retryable = false
    where d.id = v_delivery.id
    returning * into v_delivery;

    update public.anpi_scheduler_jobs j
    set status = 'sent',
        completed_at = p_now,
        lease_expires_at = null,
        last_error_safe = null
    where j.id = v_job.id
    returning * into v_job;

    job_id := v_job.id;
    job_status := v_job.status;
    delivery_id := v_delivery.id;
    delivery_status := v_delivery.status;
    attempt_number := v_attempt;
    outcome := 'delivered';
    skip_reason := null;
    provider_message_id := v_delivery.provider_message_id;
    return next;
    return;
  end if;

  -- Failure paths (retryable / terminal / timeout→retryable).
  v_retry := (v_stub.result in ('retryable_failure', 'timeout'))
    and v_attempt < 5;
  v_backoff := case
    when v_attempt <= 1 then coalesce(p_retry_after, interval '5 minutes')
    when v_attempt = 2 then interval '10 minutes'
    when v_attempt = 3 then interval '20 minutes'
    else interval '40 minutes'
  end;

  update public.anpi_notification_deliveries d
  set status = 'failed',
      failed_at = p_now,
      failure_code = v_stub.result,
      failure_detail_safe = left('stub:' || v_stub.result, 500),
      retryable = v_retry,
      next_retry_at = case when v_retry then p_now + v_backoff else null end,
      provider_message_id = coalesce(d.provider_message_id, v_stub.provider_message_id)
  where d.id = v_delivery.id
  returning * into v_delivery;

  if v_retry then
    update public.anpi_scheduler_jobs j
    set status = 'pending',
        available_at = p_now + v_backoff,
        claimed_at = null,
        claimed_by = null,
        lease_expires_at = null,
        completed_at = null,
        last_error_safe = left(v_stub.result, 500)
    where j.id = v_job.id
    returning * into v_job;
    outcome := 'retry_scheduled';
  else
    update public.anpi_scheduler_jobs j
    set status = 'failed',
        completed_at = p_now,
        claimed_at = null,
        claimed_by = null,
        lease_expires_at = null,
        last_error_safe = left(v_stub.result, 500)
    where j.id = v_job.id
    returning * into v_job;
    outcome := 'terminal_failed';
  end if;

  job_id := v_job.id;
  job_status := v_job.status;
  delivery_id := v_delivery.id;
  delivery_status := v_delivery.status;
  attempt_number := v_attempt;
  skip_reason := null;
  provider_message_id := v_delivery.provider_message_id;
  return next;
end;
$$;

comment on function public.anpi_phase6_process_claimed_job(uuid, text, text, timestamptz, interval) is
  'Service-only: eligibility recheck · delivery attempt · local TALK stub · job result. No real provider.';

revoke all on function public.anpi_phase6_process_claimed_job(uuid, text, text, timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_process_claimed_job(uuid, text, text, timestamptz, interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- One-shot batch runner (claim + process)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase6_run_delivery_batch(
  p_worker_id text,
  p_limit integer default 20,
  p_stub_mode text default 'success',
  p_now timestamptz default clock_timestamp(),
  p_lease interval default interval '2 minutes'
)
returns table (
  job_id uuid,
  job_status text,
  delivery_id uuid,
  delivery_status text,
  attempt_number integer,
  outcome text,
  skip_reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r public.anpi_scheduler_jobs%rowtype;
  v_out record;
begin
  for r in
    select *
    from public.anpi_phase6_claim_jobs(p_worker_id, p_limit, p_now, p_lease)
  loop
    select * into v_out
    from public.anpi_phase6_process_claimed_job(
      r.id, p_worker_id, p_stub_mode, p_now
    );
    job_id := v_out.job_id;
    job_status := v_out.job_status;
    delivery_id := v_out.delivery_id;
    delivery_status := v_out.delivery_status;
    attempt_number := v_out.attempt_number;
    outcome := v_out.outcome;
    skip_reason := v_out.skip_reason;
    return next;
  end loop;
end;
$$;

revoke all on function public.anpi_phase6_run_delivery_batch(text, integer, text, timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_run_delivery_batch(text, integer, text, timestamptz, interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- Stale processing recovery
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase6_recover_stale_jobs(
  p_now timestamptz default clock_timestamp(),
  p_max_attempts integer default 5
)
returns table (
  job_id uuid,
  previous_status text,
  new_status text,
  action text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r record;
  v_max integer := greatest(1, least(coalesce(p_max_attempts, 5), 10));
begin
  for r in
    select j.*
    from public.anpi_scheduler_jobs j
    where j.status = 'processing'
      and j.lease_expires_at is not null
      and j.lease_expires_at < p_now
    order by j.lease_expires_at
    for update skip locked
  loop
    job_id := r.id;
    previous_status := r.status;

    -- If a delivery attempt already delivered, seal the job as sent (idempotent).
    if exists (
      select 1
      from public.anpi_notification_deliveries d
      where d.scheduler_job_id = r.id
        and d.status = 'delivered'
    ) then
      update public.anpi_scheduler_jobs j
      set status = 'sent',
          completed_at = coalesce(j.completed_at, p_now),
          claimed_at = null,
          claimed_by = null,
          lease_expires_at = null,
          last_error_safe = null
      where j.id = r.id;
      new_status := 'sent';
      action := 'sealed_delivered';
      return next;
      continue;
    end if;

    -- Mark in-flight processing delivery attempts failed (retryable if job retries).
    update public.anpi_notification_deliveries d
    set status = 'failed',
        failed_at = coalesce(d.failed_at, p_now),
        failure_code = 'anpi_lease_expired',
        failure_detail_safe = 'anpi_lease_expired',
        retryable = (r.attempt_count < v_max)
    where d.scheduler_job_id = r.id
      and d.status = 'processing';

    if r.attempt_count < v_max then
      update public.anpi_scheduler_jobs j
      set status = 'pending',
          available_at = p_now,
          claimed_at = null,
          claimed_by = null,
          lease_expires_at = null,
          completed_at = null,
          last_error_safe = 'anpi_lease_expired'
      where j.id = r.id;
      new_status := 'pending';
      action := 'released_for_retry';
    else
      update public.anpi_scheduler_jobs j
      set status = 'failed',
          completed_at = p_now,
          claimed_at = null,
          claimed_by = null,
          lease_expires_at = null,
          last_error_safe = 'anpi_lease_expired'
      where j.id = r.id;
      new_status := 'failed';
      action := 'terminal_after_lease';
    end if;
    return next;
  end loop;
end;
$$;

comment on function public.anpi_phase6_recover_stale_jobs(timestamptz, integer) is
  'Service-only: release or fail processing jobs past lease_expires_at. Idempotent. Never undoes delivered.';

revoke all on function public.anpi_phase6_recover_stale_jobs(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_recover_stale_jobs(timestamptz, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- Safe payload builder (no PII / no HTML / template keys only)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase6_build_talk_payload(
  p_job_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.anpi_scheduler_jobs%rowtype;
  v_attempt integer;
  v_key text;
  v_title_key text;
  v_body_key text;
begin
  select * into v_job
  from public.anpi_scheduler_jobs j
  where j.id = p_job_id;

  if not found then
    raise exception using errcode = '22000', message = 'anpi_job_not_found';
  end if;

  v_attempt := greatest(v_job.attempt_count, 1);
  v_key := public.anpi_phase6_idempotency_key(v_job.id, v_attempt);

  v_title_key := case v_job.kind
    when 'initial' then 'anpi.talk.initial.title'
    when 'reminder' then 'anpi.talk.reminder.title'
    when 'contact_unconfirmed' then 'anpi.talk.contact_unconfirmed.title'
    when 'late_confirmation' then 'anpi.talk.late_confirmation.title'
    else 'anpi.talk.system_notice.title'
  end;
  v_body_key := case v_job.kind
    when 'initial' then 'anpi.talk.initial.body'
    when 'reminder' then 'anpi.talk.reminder.body'
    when 'contact_unconfirmed' then 'anpi.talk.contact_unconfirmed.body'
    when 'late_confirmation' then 'anpi.talk.late_confirmation.body'
    else 'anpi.talk.system_notice.body'
  end;

  return jsonb_build_object(
    'event_type', 'anpi.notification',
    'check_id', v_job.check_id,
    'recipient_user_id', v_job.recipient_user_id,
    'notification_kind', v_job.kind,
    'channel', v_job.channel,
    'title_key', v_title_key,
    'body_key', v_body_key,
    'action_ids', jsonb_build_array('anpi.confirm', 'anpi.open_dashboard'),
    'created_at', to_jsonb(v_job.created_at),
    'idempotency_key', v_key,
    'scheduler_job_id', v_job.id,
    'attempt_number', v_attempt
  );
end;
$$;

comment on function public.anpi_phase6_build_talk_payload(uuid) is
  'Service-only logical TALK payload: template keys + ids only. No HTML, phones, emails, or secrets.';

revoke all on function public.anpi_phase6_build_talk_payload(uuid)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_build_talk_payload(uuid)
  to service_role;

-- No production cron / provider registration in this migration.
-- Node one-shot worker: scripts/run-anpi-phase6-delivery-worker.mjs
