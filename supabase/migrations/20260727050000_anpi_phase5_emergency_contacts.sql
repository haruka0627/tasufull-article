-- ANPI Phase 5 — Emergency Contact Flow (verification · consent · priority · scheduler eligibility)
-- Canonical design: docs/ANPI_PRD.md §15 Phase 5
-- Local implementation only. Do not apply to Staging/Production without review.
--
-- Depends on:
--   20260727020000_anpi_phase2_data_foundation.sql
--   20260727030000_anpi_phase3_core_checkin.sql
--   20260727040000_anpi_phase4_scheduler.sql
-- Scope:
--   contact verification/consent state · pause · limits · owner RPCs ·
--   revoke-time pending-job cancellation · tightened scheduler candidate eligibility
-- Out of scope:
--   external send (TALK/LINE/push/email/SMS) · raw external destinations
--   (phone/email) are NOT stored — in-app contact_user_id reference only.
--   External destination storage is deferred until an approved encryption
--   scheme exists (see reports/anpi-phase5-emergency-contacts.md).

-- ---------------------------------------------------------------------------
-- Contact model extension (additive columns; Phase 2 table not redefined)
-- ---------------------------------------------------------------------------

alter table public.anpi_contacts
  add column channel text not null default 'talk',
  add column verification_status text not null default 'unverified',
  add column verified_at timestamptz,
  add column consent_status text not null default 'pending',
  add column consented_at timestamptz,
  add column paused_at timestamptz;

comment on column public.anpi_contacts.channel is
  'Notification channel. Phase 5 allows in-app talk only; external channels require an approved encrypted destination scheme first.';
comment on column public.anpi_contacts.verification_status is
  'Destination verification. talk channel is verified by the contact user accepting the invitation with their own account.';
comment on column public.anpi_contacts.consent_status is
  'Contact-person consent. Only accepted contacts may become notification candidates.';
comment on column public.anpi_contacts.paused_at is
  'Owner-side temporary exclusion from notification candidates. Does not revoke consent.';

-- Backfill existing rows from Phase 2 lifecycle timestamps before constraints.
update public.anpi_contacts
set consent_status = case
      when revoked_at is not null then 'revoked'
      when declined_at is not null then 'declined'
      when accepted_at is not null then 'accepted'
      else 'pending'
    end,
    consented_at = coalesce(consented_at, accepted_at),
    verification_status = case
      when accepted_at is not null then 'verified'
      else verification_status
    end,
    verified_at = case
      when accepted_at is not null then coalesce(verified_at, accepted_at)
      else verified_at
    end;

alter table public.anpi_contacts
  add constraint anpi_contacts_channel_check check (
    channel in ('talk')
  ),
  add constraint anpi_contacts_verification_status_check check (
    verification_status in ('unverified', 'pending', 'verified', 'failed', 'revoked')
  ),
  add constraint anpi_contacts_verified_at_check check (
    verification_status <> 'verified' or verified_at is not null
  ),
  add constraint anpi_contacts_consent_status_check check (
    consent_status in ('pending', 'accepted', 'declined', 'revoked')
  ),
  add constraint anpi_contacts_consented_at_check check (
    consent_status <> 'accepted' or consented_at is not null
  );

-- Duplicate destination guard per channel (existing subject/contact unique
-- index remains the stricter cross-channel guard while channel = talk only).
create unique index anpi_contacts_unique_channel_relation_idx
  on public.anpi_contacts (subject_user_id, contact_user_id, channel)
  where contact_user_id is not null
    and deleted_at is null
    and status in ('pending', 'active');

-- ---------------------------------------------------------------------------
-- Consent / verification sync with Phase 2 invitation lifecycle
-- (invitation accept via anpi_respond_contact_invitation keeps working and
--  automatically yields consent=accepted + verification=verified for talk)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase5_sync_contact_states()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_accept boolean;
begin
  v_accept := new.accepted_at is not null
    and (tg_op = 'INSERT' or old.accepted_at is null);

  if v_accept then
    if new.consent_status = 'pending' then
      new.consent_status := 'accepted';
      new.consented_at := coalesce(new.consented_at, new.accepted_at);
    end if;
    -- In-app talk destination is the contact user's own authenticated account;
    -- invitation acceptance verifies it. External channels never auto-verify.
    if new.channel = 'talk'
       and new.verification_status in ('unverified', 'pending') then
      new.verification_status := 'verified';
      new.verified_at := coalesce(new.verified_at, new.accepted_at);
    end if;
  end if;

  if new.declined_at is not null
     and (tg_op = 'INSERT' or old.declined_at is null)
     and new.consent_status = 'pending' then
    new.consent_status := 'declined';
  end if;

  if new.revoked_at is not null
     and (tg_op = 'INSERT' or old.revoked_at is null) then
    new.consent_status := 'revoked';
  end if;

  return new;
end;
$$;

revoke all on function public.anpi_phase5_sync_contact_states() from public;

create trigger anpi_contacts_phase5_sync_states
  before insert or update on public.anpi_contacts
  for each row execute function public.anpi_phase5_sync_contact_states();

-- ---------------------------------------------------------------------------
-- Registration limit (no unlimited fan-out)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase5_guard_contact_limit()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if (
    select count(*)
    from public.anpi_contacts c
    where c.subject_user_id = new.subject_user_id
      and c.deleted_at is null
      and c.status in ('pending', 'active')
  ) >= 10 then
    raise exception using errcode = '22000', message = 'anpi_contact_limit_reached';
  end if;
  return new;
end;
$$;

revoke all on function public.anpi_phase5_guard_contact_limit() from public;

create trigger anpi_contacts_phase5_guard_limit
  before insert on public.anpi_contacts
  for each row execute function public.anpi_phase5_guard_contact_limit();

-- ---------------------------------------------------------------------------
-- Revoke / delete cancels this contact's pending candidates only.
-- processing / sent / failed rows remain as history.
-- Works for both anpi_revoke_contact (Phase 2) and service-side revokes.
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase5_cancel_jobs_on_contact_revoke()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (new.revoked_at is not null and old.revoked_at is null)
     or (new.deleted_at is not null and old.deleted_at is null) then
    update public.anpi_scheduler_jobs j
    set status = 'cancelled',
        completed_at = now(),
        last_error_safe = 'anpi_contact_revoked'
    where j.contact_id = new.id
      and j.status = 'pending';
  end if;
  return new;
end;
$$;

revoke all on function public.anpi_phase5_cancel_jobs_on_contact_revoke() from public;

create trigger anpi_contacts_phase5_cancel_jobs
  after update on public.anpi_contacts
  for each row execute function public.anpi_phase5_cancel_jobs_on_contact_revoke();

-- ---------------------------------------------------------------------------
-- Owner-facing RPCs (authenticated · auth.uid() bound)
-- Revoke remains public.anpi_revoke_contact (Phase 2, owner or contact).
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase5_list_my_emergency_contacts()
returns table (
  contact_id uuid,
  contact_user_id uuid,
  relationship text,
  channel text,
  priority smallint,
  status text,
  verification_status text,
  consent_status text,
  paused_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select
    c.id,
    c.contact_user_id,
    c.relationship,
    c.channel,
    c.priority,
    c.status,
    c.verification_status,
    c.consent_status,
    c.paused_at,
    c.revoked_at,
    c.created_at
  from public.anpi_contacts c
  where c.owner_user_id = auth.uid()
    and c.deleted_at is null
  order by c.priority, c.created_at;
$$;

comment on function public.anpi_phase5_list_my_emergency_contacts() is
  'Owner-only contact list. Exposes in-app references and states only; no raw destinations exist.';

revoke all on function public.anpi_phase5_list_my_emergency_contacts() from public, anon;
grant execute on function public.anpi_phase5_list_my_emergency_contacts() to authenticated;

create or replace function public.anpi_phase5_upsert_emergency_contact(
  p_contact_id uuid default null,
  p_contact_user_id uuid default null,
  p_relationship text default 'other',
  p_priority integer default 1,
  p_channel text default 'talk'
)
returns table (
  contact_id uuid,
  contact_user_id uuid,
  relationship text,
  channel text,
  priority smallint,
  status text,
  verification_status text,
  consent_status text,
  paused_at timestamptz,
  created boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.anpi_contacts%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'anpi_auth_required';
  end if;
  if p_relationship is null
     or p_relationship not in ('parent', 'child', 'spouse', 'relative', 'friend', 'caregiver', 'other') then
    raise exception using errcode = '22023', message = 'anpi_invalid_relationship';
  end if;
  if p_priority is null or p_priority < 1 or p_priority > 10 then
    raise exception using errcode = '22023', message = 'anpi_invalid_priority';
  end if;
  if p_channel is null or p_channel <> 'talk' then
    -- External channels are rejected until encrypted destination storage exists.
    raise exception using errcode = '22023', message = 'anpi_channel_not_supported';
  end if;

  if p_contact_id is null then
    if p_contact_user_id is null then
      raise exception using errcode = '22023', message = 'anpi_contact_user_required';
    end if;
    if p_contact_user_id = v_uid then
      raise exception using errcode = '22023', message = 'anpi_contact_self_forbidden';
    end if;

    begin
      insert into public.anpi_contacts (
        owner_user_id, subject_user_id, contact_user_id,
        relationship, priority, channel, status
      ) values (
        v_uid, v_uid, p_contact_user_id,
        p_relationship, p_priority::smallint, p_channel, 'pending'
      )
      returning * into v_row;
    exception when unique_violation then
      raise exception using errcode = '23505', message = 'anpi_contact_duplicate';
    end;

    contact_id := v_row.id;
    contact_user_id := v_row.contact_user_id;
    relationship := v_row.relationship;
    channel := v_row.channel;
    priority := v_row.priority;
    status := v_row.status;
    verification_status := v_row.verification_status;
    consent_status := v_row.consent_status;
    paused_at := v_row.paused_at;
    created := true;
    return next;
    return;
  end if;

  select * into v_row
  from public.anpi_contacts c
  where c.id = p_contact_id
    and c.owner_user_id = v_uid
    and c.deleted_at is null
    and c.status in ('pending', 'active')
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'anpi_contact_not_accessible';
  end if;
  if p_contact_user_id is not null
     and p_contact_user_id is distinct from v_row.contact_user_id then
    -- Destination is immutable (anpi_contact_identity_immutable).
    -- Changing the person requires revoke + a new invited contact,
    -- which restarts verification and consent from zero.
    raise exception using errcode = '22000', message = 'anpi_contact_destination_immutable';
  end if;

  update public.anpi_contacts c
  set relationship = p_relationship,
      priority = p_priority::smallint,
      -- Safe side: any channel change re-requires verification and cancels
      -- pending candidates for the old channel. (talk-only today, kept for
      -- the future external-channel path.)
      verification_status = case
        when p_channel is distinct from c.channel then 'pending'
        else c.verification_status
      end,
      verified_at = case
        when p_channel is distinct from c.channel then null
        else c.verified_at
      end,
      channel = p_channel
  where c.id = v_row.id
  returning * into v_row;

  if v_row.verification_status = 'pending' then
    update public.anpi_scheduler_jobs j
    set status = 'cancelled',
        completed_at = now(),
        last_error_safe = 'anpi_contact_channel_changed'
    where j.contact_id = v_row.id
      and j.status = 'pending';
  end if;

  contact_id := v_row.id;
  contact_user_id := v_row.contact_user_id;
  relationship := v_row.relationship;
  channel := v_row.channel;
  priority := v_row.priority;
  status := v_row.status;
  verification_status := v_row.verification_status;
  consent_status := v_row.consent_status;
  paused_at := v_row.paused_at;
  created := false;
  return next;
end;
$$;

comment on function public.anpi_phase5_upsert_emergency_contact(uuid, uuid, text, integer, text) is
  'Owner-only create/update. New contacts start pending; consent/verification only via invitation acceptance or service verification.';

revoke all on function public.anpi_phase5_upsert_emergency_contact(uuid, uuid, text, integer, text)
  from public, anon;
grant execute on function public.anpi_phase5_upsert_emergency_contact(uuid, uuid, text, integer, text)
  to authenticated;

create or replace function public.anpi_phase5_reorder_emergency_contacts(
  p_contact_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_owned integer;
  i integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'anpi_auth_required';
  end if;
  if p_contact_ids is null
     or cardinality(p_contact_ids) < 1
     or cardinality(p_contact_ids) > 10 then
    raise exception using errcode = '22023', message = 'anpi_invalid_reorder_list';
  end if;
  if (select count(distinct x) from unnest(p_contact_ids) x)
     <> cardinality(p_contact_ids) then
    raise exception using errcode = '22023', message = 'anpi_invalid_reorder_list';
  end if;

  select count(*) into v_owned
  from public.anpi_contacts c
  where c.id = any (p_contact_ids)
    and c.owner_user_id = v_uid
    and c.deleted_at is null
    and c.status in ('pending', 'active');
  if v_owned <> cardinality(p_contact_ids) then
    raise exception using errcode = '42501', message = 'anpi_contact_not_accessible';
  end if;

  v_count := 0;
  for i in 1..cardinality(p_contact_ids) loop
    update public.anpi_contacts c
    set priority = i::smallint
    where c.id = p_contact_ids[i]
      and c.owner_user_id = v_uid;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.anpi_phase5_reorder_emergency_contacts(uuid[]) is
  'Owner-only priority reorder; array position becomes priority (1 = first notified). Ties resolved by created_at.';

revoke all on function public.anpi_phase5_reorder_emergency_contacts(uuid[]) from public, anon;
grant execute on function public.anpi_phase5_reorder_emergency_contacts(uuid[]) to authenticated;

create or replace function public.anpi_phase5_set_contact_paused(
  p_contact_id uuid,
  p_paused boolean
)
returns table (
  contact_id uuid,
  paused_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'anpi_auth_required';
  end if;
  if p_paused is null then
    raise exception using errcode = '22023', message = 'anpi_invalid_pause_state';
  end if;

  return query
  update public.anpi_contacts c
  set paused_at = case when p_paused then coalesce(c.paused_at, now()) else null end
  where c.id = p_contact_id
    and c.owner_user_id = v_uid
    and c.deleted_at is null
    and c.status in ('pending', 'active')
  returning c.id, c.paused_at;

  if not found then
    raise exception using errcode = '42501', message = 'anpi_contact_not_accessible';
  end if;
end;
$$;

revoke all on function public.anpi_phase5_set_contact_paused(uuid, boolean) from public, anon;
grant execute on function public.anpi_phase5_set_contact_paused(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Internal service RPCs (service_role only — never user-facing)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase5_mark_contact_verified(
  p_contact_id uuid,
  p_status text default 'verified'
)
returns table (
  contact_id uuid,
  verification_status text,
  verified_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_status is null
     or p_status not in ('unverified', 'pending', 'verified', 'failed', 'revoked') then
    raise exception using errcode = '22023', message = 'anpi_invalid_verification_status';
  end if;

  return query
  update public.anpi_contacts c
  set verification_status = p_status,
      verified_at = case when p_status = 'verified' then coalesce(c.verified_at, now()) else c.verified_at end
  where c.id = p_contact_id
    and c.deleted_at is null
  returning c.id, c.verification_status, c.verified_at;

  if not found then
    raise exception using errcode = '22000', message = 'anpi_contact_not_found';
  end if;
end;
$$;

comment on function public.anpi_phase5_mark_contact_verified(uuid, text) is
  'Service-only verification state transition for future external verification flows.';

revoke all on function public.anpi_phase5_mark_contact_verified(uuid, text)
  from public, anon, authenticated;
grant execute on function public.anpi_phase5_mark_contact_verified(uuid, text)
  to service_role;

create or replace function public.anpi_phase5_set_contact_consent(
  p_contact_id uuid,
  p_status text
)
returns table (
  contact_id uuid,
  consent_status text,
  consented_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_status is null
     or p_status not in ('pending', 'accepted', 'declined', 'revoked') then
    raise exception using errcode = '22023', message = 'anpi_invalid_consent_status';
  end if;

  return query
  update public.anpi_contacts c
  set consent_status = p_status,
      consented_at = case when p_status = 'accepted' then coalesce(c.consented_at, now()) else c.consented_at end
  where c.id = p_contact_id
    and c.deleted_at is null
  returning c.id, c.consent_status, c.consented_at;

  if not found then
    raise exception using errcode = '22000', message = 'anpi_contact_not_found';
  end if;
end;
$$;

comment on function public.anpi_phase5_set_contact_consent(uuid, text) is
  'Service-only consent state transition for future contact-side consent surfaces. Normal path stays anpi_respond_contact_invitation.';

revoke all on function public.anpi_phase5_set_contact_consent(uuid, text)
  from public, anon, authenticated;
grant execute on function public.anpi_phase5_set_contact_consent(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Scheduler run log: overdue checks that currently have zero eligible contacts
-- ---------------------------------------------------------------------------

alter table public.anpi_scheduler_runs
  add column overdue_without_contacts integer not null default 0,
  add constraint anpi_scheduler_runs_no_contact_nonneg_check check (
    overdue_without_contacts >= 0
  );

comment on column public.anpi_scheduler_runs.overdue_without_contacts is
  'Overdue checks with no eligible (active+verified+accepted+unpaused) contact this tick. Counter only; no retry storm.';

-- ---------------------------------------------------------------------------
-- Tightened candidate eligibility (replaces Phase 4 function; the Phase 4
-- migration file itself is not edited). Return type gains skipped_reason,
-- so the old signature is dropped and recreated.
-- ---------------------------------------------------------------------------

drop function public.anpi_phase4_enqueue_contact_candidates(timestamptz);

create function public.anpi_phase4_enqueue_contact_candidates(
  p_now timestamptz default clock_timestamp()
)
returns table (
  check_id uuid,
  contact_id uuid,
  job_id uuid,
  enqueued boolean,
  skipped_reason text
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
      ec.contact_user_id as recipient_user_id,
      ec.channel as channel
    from public.anpi_check_instances c
    left join public.anpi_contacts ec
      on ec.subject_user_id = c.subject_user_id
     and ec.status = 'active'
     and ec.accepted_at is not null
     and ec.revoked_at is null
     and ec.deleted_at is null
     and ec.contact_user_id is not null
     and ec.paused_at is null
     and ec.verification_status = 'verified'
     and ec.consent_status = 'accepted'
    where c.status = 'overdue'
      and c.confirmed_at is null
    order by c.scheduled_at, ec.priority nulls last, ec.created_at
  loop
    check_id := r.check_id;
    contact_id := r.contact_id;

    if r.contact_id is null then
      -- Overdue but nobody eligible: tick keeps succeeding, check stays
      -- 'overdue', run log counts it. No job row → no retry storm.
      job_id := null;
      enqueued := false;
      skipped_reason := 'anpi_no_eligible_contacts';
      return next;
      continue;
    end if;

    v_job_id := null;
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
      r.channel,
      'contact_unconfirmed',
      'pending',
      p_now
    )
    on conflict on constraint anpi_scheduler_jobs_idempotency_key
    do nothing
    returning id into v_job_id;

    if v_job_id is null then
      select j.id into v_job_id
      from public.anpi_scheduler_jobs j
      where j.check_id = r.check_id
        and j.recipient_user_id = r.recipient_user_id
        and j.channel = r.channel
        and j.kind = 'contact_unconfirmed';
      job_id := v_job_id;
      enqueued := false;
      skipped_reason := 'anpi_job_exists';
    else
      job_id := v_job_id;
      enqueued := true;
      skipped_reason := null;
    end if;
    return next;
  end loop;
end;
$$;

comment on function public.anpi_phase4_enqueue_contact_candidates(timestamptz) is
  'Service-only: idempotent contact_unconfirmed candidates. Phase 5 eligibility: active + accepted invitation + verified + consent accepted + not paused/revoked. No send.';

revoke all on function public.anpi_phase4_enqueue_contact_candidates(timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_enqueue_contact_candidates(timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Tick: record overdue_without_contacts (same signature/return type)
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
  v_no_contact integer := 0;
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

  select
    coalesce(sum(case when e.enqueued then 1 else 0 end), 0)::integer,
    coalesce(count(distinct e.check_id) filter (where e.contact_id is null), 0)::integer
  into v_enqueued, v_no_contact
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
      overdue_without_contacts = v_no_contact,
      candidates_claimed = v_claimed
  where r.id = v_run.id
  returning * into v_run;

  return v_run;
end;
$$;

comment on function public.anpi_phase4_scheduler_tick(timestamptz, text, integer) is
  'Service-only scheduler tick under transaction advisory lock. Phase 5: also records overdue checks without eligible contacts. No external send. No cron registration.';

revoke all on function public.anpi_phase4_scheduler_tick(timestamptz, text, integer)
  from public, anon, authenticated;
grant execute on function public.anpi_phase4_scheduler_tick(timestamptz, text, integer)
  to service_role;

-- Cron registration is intentionally NOT created here (see Phase 4 migration note).
-- No external notification provider is invoked anywhere in this migration.
