-- =============================================================================
-- ANPI Phase 66 — Production APPLY PACKAGE (HUMAN APPROVAL REQUIRED)
-- =============================================================================
-- TARGET PROJECT REF ONLY: ddojquacsyqesrjhcvmn
-- FORBIDDEN without explicit human approval: paste/run on any project
-- FORBIDDEN always: Staging ahlxuyvhzqdqaojiywmu · MCP apply · Worker/Cron/Canary
-- PHASE: 2
-- SOURCE CANONICAL: supabase/migrations/20260727020000_anpi_phase2_data_foundation.sql
-- STATUS: RUNBOOK ARTIFACT · NOT EXECUTED by agent
-- BEFORE RUN: preflight + collision checks + human GO for THIS step only
-- AFTER RUN: verify-after-phase2.sql · STOP · wait for next human GO
-- OUT OF SCOPE: Phase 65 draft · Worker · Cron · Canary
-- =============================================================================

-- ANPI Phase 2 — button-based safety check data foundation
-- Canonical design: docs/ANPI_PRD.md
-- Local implementation only. Do not apply to Production without review.
--
-- This migration deliberately does not alter the frozen legacy tables:
--   anpi_user_contexts, anpi_check_sessions, anpi_notification_logs,
--   anpi_no_response_audit_log.
-- Their identifiers and status vocabulary are incompatible with the
-- auth.users UUID boundary used by the canonical button-check design.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase2_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.anpi_phase2_valid_weekdays(p_weekdays smallint[])
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select cardinality(p_weekdays) between 1 and 7
    and p_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    and cardinality(p_weekdays) = (
      select count(distinct value)
      from unnest(p_weekdays) as value
    );
$$;

create or replace function public.anpi_phase2_transition_allowed(
  p_old_status text,
  p_new_status text
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  -- reminder_count = 0 may skip reminded and go notified -> overdue.
  select p_old_status = p_new_status
    or (p_old_status = 'scheduled' and p_new_status in ('notified', 'confirmed', 'paused', 'cancelled'))
    or (p_old_status = 'notified' and p_new_status in ('reminded', 'overdue', 'confirmed', 'cancelled'))
    or (p_old_status = 'reminded' and p_new_status in ('overdue', 'confirmed', 'cancelled'))
    or (p_old_status = 'overdue' and p_new_status in ('contact_notified', 'confirmed', 'cancelled'))
    or (p_old_status = 'contact_notified' and p_new_status in ('confirmed_late', 'cancelled'))
    or (p_old_status = 'paused' and p_new_status in ('scheduled', 'cancelled'));
$$;

revoke all on function public.anpi_phase2_set_updated_at() from public;
revoke all on function public.anpi_phase2_valid_weekdays(smallint[]) from public;
revoke all on function public.anpi_phase2_transition_allowed(text, text) from public;
grant execute on function public.anpi_phase2_valid_weekdays(smallint[])
  to authenticated, service_role;
grant execute on function public.anpi_phase2_transition_allowed(text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Append-only audit
-- ---------------------------------------------------------------------------

create table public.anpi_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  subject_user_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  old_values_safe jsonb not null default '{}'::jsonb,
  new_values_safe jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now(),
  constraint anpi_audit_logs_entity_type_check check (
    entity_type in ('setting', 'check', 'contact', 'invitation', 'delivery', 'ops')
  ),
  constraint anpi_audit_logs_event_type_check check (
    event_type in (
      'setting_created',
      'setting_updated',
      'setting_paused',
      'setting_resumed',
      'check_created',
      'check_status_changed',
      'check_confirmed',
      'check_confirmed_late',
      'contact_invited',
      'contact_accepted',
      'contact_declined',
      'contact_revoked',
      'delivery_queued',
      'delivery_failed',
      'admin_accessed'
    )
  ),
  constraint anpi_audit_logs_safe_objects_check check (
    jsonb_typeof(old_values_safe) = 'object'
    and jsonb_typeof(new_values_safe) = 'object'
  ),
  constraint anpi_audit_logs_forbidden_keys_check check (
    lower(old_values_safe::text || new_values_safe::text)
      !~ '"[^"]*(token|secret|password|email|phone|display_name)[^"]*"[[:space:]]*:'
  ),
  constraint anpi_audit_logs_request_id_length_check check (
    request_id is null or char_length(request_id) between 8 and 128
  )
);

comment on table public.anpi_audit_logs is
  'ANPI Phase 2 append-only audit. Safe identifiers/status only; no tokens or plaintext contact PII.';

create index anpi_audit_logs_subject_created_idx
  on public.anpi_audit_logs (subject_user_id, created_at desc);
create index anpi_audit_logs_entity_idx
  on public.anpi_audit_logs (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

create table public.anpi_settings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  subject_user_id uuid not null references auth.users (id) on delete restrict,
  enabled boolean not null default true,
  timezone text not null default 'Asia/Tokyo',
  schedule_type text not null default 'daily',
  weekdays smallint[] not null default array[1, 2, 3, 4, 5, 6, 7]::smallint[],
  initial_notification_time time not null default time '08:00',
  reminder_policy jsonb not null default '{"interval_minutes":[120,240]}'::jsonb,
  reminder_count smallint not null default 2,
  contact_notify_after interval not null default interval '2 hours',
  paused_at timestamptz,
  paused_until timestamptz,
  pause_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint anpi_settings_timezone_check check (timezone = 'Asia/Tokyo'),
  constraint anpi_settings_schedule_type_check check (schedule_type in ('daily', 'weekdays')),
  constraint anpi_settings_weekdays_check check (public.anpi_phase2_valid_weekdays(weekdays)),
  constraint anpi_settings_reminder_count_check check (reminder_count between 0 and 2),
  constraint anpi_settings_reminder_policy_check check (jsonb_typeof(reminder_policy) = 'object'),
  constraint anpi_settings_contact_notify_after_check check (
    contact_notify_after between interval '30 minutes' and interval '24 hours'
  ),
  constraint anpi_settings_pause_window_check check (
    paused_until is null or paused_at is null or paused_until > paused_at
  ),
  constraint anpi_settings_pause_reason_length_check check (
    pause_reason is null or char_length(pause_reason) <= 200
  )
);

comment on table public.anpi_settings is
  'Canonical ANPI button-check schedule settings. Legacy anpi_user_contexts remains unchanged.';
comment on column public.anpi_settings.timezone is
  'Phase 2 supports Asia/Tokyo only; expand through reviewed migration.';

create unique index anpi_settings_one_current_per_subject_idx
  on public.anpi_settings (subject_user_id)
  where deleted_at is null;
create index anpi_settings_owner_idx
  on public.anpi_settings (owner_user_id)
  where deleted_at is null;
create index anpi_settings_due_idx
  on public.anpi_settings (enabled, initial_notification_time)
  where deleted_at is null and enabled;

create trigger anpi_settings_set_updated_at
  before update on public.anpi_settings
  for each row execute function public.anpi_phase2_set_updated_at();

-- ---------------------------------------------------------------------------
-- Daily check instances
-- ---------------------------------------------------------------------------

create table public.anpi_check_instances (
  id uuid primary key default gen_random_uuid(),
  setting_id uuid not null references public.anpi_settings (id) on delete restrict,
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  subject_user_id uuid not null references auth.users (id) on delete restrict,
  local_check_date date not null,
  timezone text not null default 'Asia/Tokyo',
  scheduled_at timestamptz not null,
  first_notified_at timestamptz,
  last_reminded_at timestamptz,
  overdue_at timestamptz,
  contact_notified_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  status text not null default 'scheduled',
  confirmation_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anpi_check_instances_timezone_check check (timezone = 'Asia/Tokyo'),
  constraint anpi_check_instances_local_date_check check (
    local_check_date = (scheduled_at at time zone 'Asia/Tokyo')::date
  ),
  constraint anpi_check_instances_status_check check (
    status in (
      'scheduled',
      'notified',
      'reminded',
      'overdue',
      'contact_notified',
      'confirmed',
      'confirmed_late',
      'paused',
      'cancelled'
    )
  ),
  constraint anpi_check_instances_confirmation_source_check check (
    confirmation_source is null
    or confirmation_source in ('anpi_ui', 'talk', 'admin_recovery', 'migration')
  ),
  constraint anpi_check_instances_confirmed_fields_check check (
    (status not in ('confirmed', 'confirmed_late') or confirmed_at is not null)
    and (confirmed_at is null or confirmation_source is not null)
  ),
  constraint anpi_check_instances_cancelled_fields_check check (
    status <> 'cancelled' or cancelled_at is not null
  ),
  constraint anpi_check_instances_late_fields_check check (
    status <> 'confirmed_late' or contact_notified_at is not null
  ),
  constraint anpi_check_instances_progress_timestamp_check check (
    (status not in ('notified', 'reminded', 'overdue', 'contact_notified') or first_notified_at is not null)
    and (status <> 'reminded' or last_reminded_at is not null)
    and (status not in ('overdue', 'contact_notified') or overdue_at is not null)
    and (status <> 'contact_notified' or contact_notified_at is not null)
  ),
  constraint anpi_check_instances_subject_date_key unique (subject_user_id, local_check_date)
);

comment on table public.anpi_check_instances is
  'Canonical daily check instance. Separate from frozen legacy anpi_check_sessions.';
comment on column public.anpi_check_instances.local_check_date is
  'Asia/Tokyo local date used for scheduler idempotency.';
comment on column public.anpi_check_instances.status is
  'delivery_failed is intentionally excluded; delivery failures live in anpi_notification_deliveries.';

create index anpi_check_instances_setting_date_idx
  on public.anpi_check_instances (setting_id, local_check_date desc);
create index anpi_check_instances_subject_date_idx
  on public.anpi_check_instances (subject_user_id, local_check_date desc);
create index anpi_check_instances_pending_idx
  on public.anpi_check_instances (status, scheduled_at)
  where status in ('scheduled', 'notified', 'reminded', 'overdue');

create trigger anpi_check_instances_set_updated_at
  before update on public.anpi_check_instances
  for each row execute function public.anpi_phase2_set_updated_at();

create or replace function public.anpi_phase2_guard_check_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not public.anpi_phase2_transition_allowed(old.status, new.status) then
    raise exception using
      errcode = '22000',
      message = 'anpi_invalid_status_transition';
  end if;

  if old.confirmed_at is not null and new.confirmed_at is distinct from old.confirmed_at then
    raise exception using
      errcode = '22000',
      message = 'anpi_confirmed_at_immutable';
  end if;

  if old.confirmed_at is not null
     and new.confirmation_source is distinct from old.confirmation_source then
    raise exception using
      errcode = '22000',
      message = 'anpi_confirmation_source_immutable';
  end if;

  return new;
end;
$$;

revoke all on function public.anpi_phase2_guard_check_transition() from public;

create trigger anpi_check_instances_guard_transition
  before update of status, confirmed_at, confirmation_source on public.anpi_check_instances
  for each row execute function public.anpi_phase2_guard_check_transition();

-- ---------------------------------------------------------------------------
-- Emergency contacts and consent invitations
-- ---------------------------------------------------------------------------

create table public.anpi_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  subject_user_id uuid not null references auth.users (id) on delete restrict,
  contact_user_id uuid references auth.users (id) on delete set null,
  display_name_enc text,
  relationship text not null default 'other',
  priority smallint not null default 1,
  status text not null default 'pending',
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anpi_contacts_relationship_check check (
    relationship in ('parent', 'child', 'spouse', 'relative', 'friend', 'caregiver', 'other')
  ),
  constraint anpi_contacts_priority_check check (priority between 1 and 10),
  constraint anpi_contacts_status_check check (
    status in ('pending', 'active', 'declined', 'revoked', 'expired')
  ),
  constraint anpi_contacts_active_consent_check check (
    status <> 'active'
    or (
      contact_user_id is not null
      and accepted_at is not null
      and revoked_at is null
      and deleted_at is null
    )
  ),
  constraint anpi_contacts_declined_check check (
    status <> 'declined' or declined_at is not null
  ),
  constraint anpi_contacts_revoked_check check (
    status <> 'revoked' or revoked_at is not null
  )
);

comment on table public.anpi_contacts is
  'Emergency contact relationship. Notification eligibility requires active accepted consent.';
comment on column public.anpi_contacts.display_name_enc is
  'Optional application-encrypted display label; plaintext names/emails/phones are not stored.';

create unique index anpi_contacts_unique_current_relation_idx
  on public.anpi_contacts (subject_user_id, contact_user_id)
  where contact_user_id is not null and deleted_at is null and status in ('pending', 'active');
create index anpi_contacts_owner_idx
  on public.anpi_contacts (owner_user_id, priority)
  where deleted_at is null;
create index anpi_contacts_contact_user_idx
  on public.anpi_contacts (contact_user_id)
  where contact_user_id is not null and deleted_at is null;

create trigger anpi_contacts_set_updated_at
  before update on public.anpi_contacts
  for each row execute function public.anpi_phase2_set_updated_at();

create table public.anpi_contact_invitations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.anpi_contacts (id) on delete restrict,
  inviter_user_id uuid not null references auth.users (id) on delete restrict,
  invitee_user_id uuid not null references auth.users (id) on delete restrict,
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anpi_contact_invitations_token_hash_check check (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint anpi_contact_invitations_expiry_check check (expires_at > created_at),
  constraint anpi_contact_invitations_single_result_check check (
    num_nonnulls(accepted_at, declined_at, revoked_at) <= 1
  ),
  constraint anpi_contact_invitations_token_hash_key unique (token_hash)
);

comment on table public.anpi_contact_invitations is
  'Single-use emergency contact invitation. Only a SHA-256 hex token hash is stored.';

create unique index anpi_contact_invitations_one_open_per_contact_idx
  on public.anpi_contact_invitations (contact_id)
  where accepted_at is null and declined_at is null and revoked_at is null;
create index anpi_contact_invitations_invitee_idx
  on public.anpi_contact_invitations (invitee_user_id, expires_at desc);

create trigger anpi_contact_invitations_set_updated_at
  before update on public.anpi_contact_invitations
  for each row execute function public.anpi_phase2_set_updated_at();

-- ---------------------------------------------------------------------------
-- Notification delivery records (no sending in Phase 2)
-- ---------------------------------------------------------------------------

create table public.anpi_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.anpi_check_instances (id) on delete restrict,
  recipient_user_id uuid not null references auth.users (id) on delete restrict,
  contact_id uuid references public.anpi_contacts (id) on delete restrict,
  channel text not null,
  kind text not null,
  status text not null default 'queued',
  provider text,
  provider_message_id text,
  attempt_count smallint not null default 0,
  next_retry_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_detail_safe text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anpi_notification_deliveries_channel_check check (
    channel in ('talk', 'line', 'push', 'email', 'sms')
  ),
  constraint anpi_notification_deliveries_kind_check check (
    kind in ('initial', 'reminder', 'contact_unconfirmed', 'late_confirmation', 'system_notice')
  ),
  constraint anpi_notification_deliveries_status_check check (
    status in ('queued', 'sent', 'delivered', 'failed', 'skipped', 'cancelled')
  ),
  constraint anpi_notification_deliveries_attempt_count_check check (
    attempt_count between 0 and 10
  ),
  constraint anpi_notification_deliveries_failure_fields_check check (
    status <> 'failed' or failed_at is not null
  ),
  constraint anpi_notification_deliveries_safe_detail_length_check check (
    failure_detail_safe is null or char_length(failure_detail_safe) <= 500
  ),
  constraint anpi_notification_deliveries_contact_kind_check check (
    (kind in ('contact_unconfirmed', 'late_confirmation')) = (contact_id is not null)
  ),
  constraint anpi_notification_deliveries_idempotency_key unique (
    check_id,
    recipient_user_id,
    channel,
    kind
  )
);

comment on table public.anpi_notification_deliveries is
  'Delivery queue/history only. failed is not an ANPI check status and never confirms a check.';

create index anpi_notification_deliveries_retry_idx
  on public.anpi_notification_deliveries (status, next_retry_at)
  where status in ('queued', 'failed');
create index anpi_notification_deliveries_recipient_idx
  on public.anpi_notification_deliveries (recipient_user_id, created_at desc);

create trigger anpi_notification_deliveries_set_updated_at
  before update on public.anpi_notification_deliveries
  for each row execute function public.anpi_phase2_set_updated_at();

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

  if new.contact_id is not null and not exists (
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

create trigger anpi_notification_deliveries_guard_contact
  before insert or update of check_id, contact_id, recipient_user_id, kind
  on public.anpi_notification_deliveries
  for each row execute function public.anpi_phase2_guard_contact_delivery();

-- ---------------------------------------------------------------------------
-- Identity/idempotency columns are immutable after creation, including for
-- service workflows. Lifecycle changes must use status/timestamp columns.
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase2_guard_immutable_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'anpi_settings' then
    if new.owner_user_id is distinct from old.owner_user_id
       or new.subject_user_id is distinct from old.subject_user_id then
      raise exception using errcode = '22000', message = 'anpi_setting_identity_immutable';
    end if;
  elsif tg_table_name = 'anpi_check_instances' then
    if new.setting_id is distinct from old.setting_id
       or new.owner_user_id is distinct from old.owner_user_id
       or new.subject_user_id is distinct from old.subject_user_id
       or new.local_check_date is distinct from old.local_check_date
       or new.timezone is distinct from old.timezone
       or new.scheduled_at is distinct from old.scheduled_at then
      raise exception using errcode = '22000', message = 'anpi_check_identity_immutable';
    end if;
  elsif tg_table_name = 'anpi_contacts' then
    if new.owner_user_id is distinct from old.owner_user_id
       or new.subject_user_id is distinct from old.subject_user_id
       or (
         old.contact_user_id is not null
         and new.contact_user_id is distinct from old.contact_user_id
       ) then
      raise exception using errcode = '22000', message = 'anpi_contact_identity_immutable';
    end if;
  elsif tg_table_name = 'anpi_contact_invitations' then
    if new.contact_id is distinct from old.contact_id
       or new.inviter_user_id is distinct from old.inviter_user_id
       or new.invitee_user_id is distinct from old.invitee_user_id
       or new.token_hash is distinct from old.token_hash
       or new.expires_at is distinct from old.expires_at then
      raise exception using errcode = '22000', message = 'anpi_invitation_identity_immutable';
    end if;
  elsif tg_table_name = 'anpi_notification_deliveries' then
    if new.check_id is distinct from old.check_id
       or new.recipient_user_id is distinct from old.recipient_user_id
       or new.contact_id is distinct from old.contact_id
       or new.channel is distinct from old.channel
       or new.kind is distinct from old.kind then
      raise exception using errcode = '22000', message = 'anpi_delivery_identity_immutable';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.anpi_phase2_guard_immutable_identity() from public;

create trigger anpi_settings_guard_identity
  before update on public.anpi_settings
  for each row execute function public.anpi_phase2_guard_immutable_identity();
create trigger anpi_check_instances_guard_identity
  before update on public.anpi_check_instances
  for each row execute function public.anpi_phase2_guard_immutable_identity();
create trigger anpi_contacts_guard_identity
  before update on public.anpi_contacts
  for each row execute function public.anpi_phase2_guard_immutable_identity();
create trigger anpi_contact_invitations_guard_identity
  before update on public.anpi_contact_invitations
  for each row execute function public.anpi_phase2_guard_immutable_identity();
create trigger anpi_notification_deliveries_guard_identity
  before update on public.anpi_notification_deliveries
  for each row execute function public.anpi_phase2_guard_immutable_identity();

-- ---------------------------------------------------------------------------
-- Safe audit trigger: identifiers/status only; never copies arbitrary rows.
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase2_write_safe_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_subject uuid;
  v_entity_type text;
  v_entity_id uuid;
  v_event text;
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'anpi_settings' then
    v_subject := new.subject_user_id;
    v_entity_type := 'setting';
    v_entity_id := new.id;
    if tg_op = 'INSERT' then
      v_event := 'setting_created';
    elsif old.paused_at is null and new.paused_at is not null then
      v_event := 'setting_paused';
    elsif old.paused_at is not null and new.paused_at is null then
      v_event := 'setting_resumed';
    else
      v_event := 'setting_updated';
    end if;
    if tg_op = 'UPDATE' then
      v_old := jsonb_build_object('enabled', old.enabled, 'paused', old.paused_at is not null);
    end if;
    v_new := jsonb_build_object('enabled', new.enabled, 'paused', new.paused_at is not null);
  elsif tg_table_name = 'anpi_check_instances' then
    v_subject := new.subject_user_id;
    v_entity_type := 'check';
    v_entity_id := new.id;
    if tg_op = 'INSERT' then
      v_event := 'check_created';
    elsif new.status = 'confirmed_late' then
      v_event := 'check_confirmed_late';
    elsif new.status = 'confirmed' then
      v_event := 'check_confirmed';
    else
      v_event := 'check_status_changed';
    end if;
    if tg_op = 'UPDATE' then
      v_old := jsonb_build_object('status', old.status);
    end if;
    v_new := jsonb_build_object('status', new.status, 'local_check_date', new.local_check_date);
  elsif tg_table_name = 'anpi_contacts' then
    v_subject := new.subject_user_id;
    v_entity_type := 'contact';
    v_entity_id := new.id;
    if tg_op = 'INSERT' then
      v_event := 'contact_invited';
    elsif new.status = 'active' then
      v_event := 'contact_accepted';
    elsif new.status = 'declined' then
      v_event := 'contact_declined';
    elsif new.status = 'revoked' then
      v_event := 'contact_revoked';
    else
      return new;
    end if;
    if tg_op = 'UPDATE' then
      v_old := jsonb_build_object('status', old.status);
    end if;
    v_new := jsonb_build_object('status', new.status, 'priority', new.priority);
  elsif tg_table_name = 'anpi_notification_deliveries' then
    select c.subject_user_id into v_subject
    from public.anpi_check_instances c
    where c.id = new.check_id;
    v_entity_type := 'delivery';
    v_entity_id := new.id;
    if new.status = 'failed' then
      v_event := 'delivery_failed';
    elsif tg_op = 'INSERT' then
      v_event := 'delivery_queued';
    else
      return new;
    end if;
    if tg_op = 'UPDATE' then
      v_old := jsonb_build_object('status', old.status);
    end if;
    v_new := jsonb_build_object(
      'status', new.status,
      'channel', new.channel,
      'kind', new.kind,
      'failure_code', new.failure_code
    );
  else
    return new;
  end if;

  insert into public.anpi_audit_logs (
    actor_user_id,
    subject_user_id,
    entity_type,
    entity_id,
    event_type,
    old_values_safe,
    new_values_safe
  ) values (
    v_actor,
    v_subject,
    v_entity_type,
    v_entity_id,
    v_event,
    v_old,
    v_new
  );

  return new;
end;
$$;

revoke all on function public.anpi_phase2_write_safe_audit() from public;

create trigger anpi_settings_safe_audit
  after insert or update on public.anpi_settings
  for each row execute function public.anpi_phase2_write_safe_audit();
create trigger anpi_check_instances_safe_audit
  after insert or update of status on public.anpi_check_instances
  for each row execute function public.anpi_phase2_write_safe_audit();
create trigger anpi_contacts_safe_audit
  after insert or update of status on public.anpi_contacts
  for each row execute function public.anpi_phase2_write_safe_audit();
create trigger anpi_notification_deliveries_safe_audit
  after insert or update of status on public.anpi_notification_deliveries
  for each row execute function public.anpi_phase2_write_safe_audit();

-- ---------------------------------------------------------------------------
-- Confirm and scheduler idempotency functions
-- ---------------------------------------------------------------------------

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

  return query
    select v_check.id, v_check.status, v_check.confirmed_at,
           v_check.local_check_date, false;
end;
$$;

comment on function public.anpi_confirm_check(uuid, text) is
  'Idempotent本人 confirm. Uses auth.uid(); contact_notified becomes confirmed_late.';

revoke all on function public.anpi_confirm_check(uuid, text) from public, anon;
grant execute on function public.anpi_confirm_check(uuid, text) to authenticated;

create or replace function public.anpi_create_daily_check(
  p_setting_id uuid,
  p_local_check_date date,
  p_scheduled_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_setting public.anpi_settings%rowtype;
  v_id uuid;
begin
  if p_local_check_date is null or p_scheduled_at is null then
    raise exception using errcode = '22023', message = 'anpi_invalid_schedule_input';
  end if;

  -- Pause must be explicitly cleared. expired paused_until alone is not enough.
  select * into v_setting
  from public.anpi_settings s
  where s.id = p_setting_id
    and s.enabled
    and s.deleted_at is null
    and s.paused_at is null;

  if not found then
    raise exception using errcode = '22000', message = 'anpi_setting_not_schedulable';
  end if;
  if p_local_check_date <> (p_scheduled_at at time zone v_setting.timezone)::date then
    raise exception using errcode = '22023', message = 'anpi_schedule_date_mismatch';
  end if;

  insert into public.anpi_check_instances (
    setting_id,
    owner_user_id,
    subject_user_id,
    local_check_date,
    timezone,
    scheduled_at
  ) values (
    v_setting.id,
    v_setting.owner_user_id,
    v_setting.subject_user_id,
    p_local_check_date,
    v_setting.timezone,
    p_scheduled_at
  )
  on conflict (subject_user_id, local_check_date)
  do nothing
  returning id into v_id;

  if v_id is null then
    select c.id into v_id
    from public.anpi_check_instances c
    where c.subject_user_id = v_setting.subject_user_id
      and c.local_check_date = p_local_check_date;
  end if;

  return v_id;
end;
$$;

comment on function public.anpi_create_daily_check(uuid, date, timestamptz) is
  'Service-only scheduler foundation. Duplicate cron returns the existing daily check id.';

revoke all on function public.anpi_create_daily_check(uuid, date, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_create_daily_check(uuid, date, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Invitation response and contact revocation
-- ---------------------------------------------------------------------------

create or replace function public.anpi_respond_contact_invitation(
  p_invitation_id uuid,
  p_token_hash text,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invitation public.anpi_contact_invitations%rowtype;
  v_status text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'anpi_auth_required';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'anpi_invalid_invitation_token_hash';
  end if;
  if p_accept is null then
    raise exception using errcode = '22023', message = 'anpi_invalid_invitation_response';
  end if;

  select * into v_invitation
  from public.anpi_contact_invitations i
  where i.id = p_invitation_id
  for update;

  if not found
     or v_invitation.invitee_user_id <> auth.uid()
     or v_invitation.token_hash <> p_token_hash then
    raise exception using errcode = '42501', message = 'anpi_invitation_not_accessible';
  end if;
  if v_invitation.expires_at <= now() then
    raise exception using errcode = '22000', message = 'anpi_invitation_expired';
  end if;
  if num_nonnulls(
    v_invitation.accepted_at,
    v_invitation.declined_at,
    v_invitation.revoked_at
  ) > 0 then
    raise exception using errcode = '22000', message = 'anpi_invitation_already_used';
  end if;

  if p_accept then
    update public.anpi_contact_invitations
    set accepted_at = now()
    where id = v_invitation.id;

    update public.anpi_contacts
    set status = 'active',
        contact_user_id = auth.uid(),
        accepted_at = now(),
        declined_at = null,
        revoked_at = null
    where id = v_invitation.contact_id
      and status = 'pending'
      and deleted_at is null;

    if not found then
      raise exception using errcode = '22000', message = 'anpi_contact_not_pending';
    end if;
    v_status := 'active';
  else
    update public.anpi_contact_invitations
    set declined_at = now()
    where id = v_invitation.id;

    update public.anpi_contacts
    set status = 'declined',
        declined_at = now()
    where id = v_invitation.contact_id
      and status = 'pending';
    v_status := 'declined';
  end if;

  return v_status;
end;
$$;

comment on function public.anpi_respond_contact_invitation(uuid, text, boolean) is
  'Invitee-only single-use accept/decline. Caller supplies SHA-256 hash; raw token is never stored.';

revoke all on function public.anpi_respond_contact_invitation(uuid, text, boolean)
  from public, anon;
grant execute on function public.anpi_respond_contact_invitation(uuid, text, boolean)
  to authenticated;

create or replace function public.anpi_revoke_contact(p_contact_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'anpi_auth_required';
  end if;

  update public.anpi_contacts
  set status = 'revoked',
      revoked_at = now()
  where id = p_contact_id
    and deleted_at is null
    and status in ('pending', 'active')
    and (
      owner_user_id = auth.uid()
      or contact_user_id = auth.uid()
    );
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception using errcode = '42501', message = 'anpi_contact_not_revokeable';
  end if;

  update public.anpi_contact_invitations
  set revoked_at = now()
  where contact_id = p_contact_id
    and accepted_at is null
    and declined_at is null
    and revoked_at is null;

  return true;
end;
$$;

revoke all on function public.anpi_revoke_contact(uuid) from public, anon;
grant execute on function public.anpi_revoke_contact(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Minimal emergency-contact read RPC (no full settings/history exposure)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_contact_check_summary(p_check_id uuid)
returns table (
  check_id uuid,
  local_check_date date,
  status text,
  confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select c.id, c.local_check_date, c.status, c.confirmed_at
  from public.anpi_check_instances c
  where c.id = p_check_id
    and c.status in ('contact_notified', 'confirmed_late')
    and exists (
      select 1
      from public.anpi_contacts ec
      where ec.subject_user_id = c.subject_user_id
        and ec.contact_user_id = auth.uid()
        and ec.status = 'active'
        and ec.accepted_at is not null
        and ec.revoked_at is null
        and ec.deleted_at is null
    );
$$;

revoke all on function public.anpi_contact_check_summary(uuid) from public, anon;
grant execute on function public.anpi_contact_check_summary(uuid) to authenticated;

create or replace function public.anpi_contact_invitation_summaries()
returns table (
  invitation_id uuid,
  contact_id uuid,
  inviter_user_id uuid,
  invitee_user_id uuid,
  expires_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    i.id,
    i.contact_id,
    i.inviter_user_id,
    i.invitee_user_id,
    i.expires_at,
    i.accepted_at,
    i.declined_at,
    i.revoked_at
  from public.anpi_contact_invitations i
  where auth.uid() is not null
    and auth.uid() in (i.inviter_user_id, i.invitee_user_id);
$$;

comment on function public.anpi_contact_invitation_summaries() is
  'Participant invitation summary. Deliberately excludes token_hash.';

revoke all on function public.anpi_contact_invitation_summaries() from public, anon;
grant execute on function public.anpi_contact_invitation_summaries() to authenticated;

-- ---------------------------------------------------------------------------
-- Legacy mapping reference only (no legacy data UPDATE)
-- ---------------------------------------------------------------------------

create view public.anpi_legacy_check_status_mapping
with (security_invoker = true)
as
select *
from (
  values
    ('pending', 'scheduled', 'safe_mapping'),
    ('sent_to_user', 'notified', 'requires_timestamp_review'),
    ('answered', 'confirmed', 'requires_responded_at'),
    ('no_response', 'overdue', 'manual_review_no_auto_update'),
    ('family_notified', 'contact_notified', 'requires_delivery_evidence'),
    ('handled', 'cancelled', 'manual_review'),
    ('escalated', 'contact_notified', 'manual_review_no_auto_update'),
    ('expired', 'cancelled', 'manual_review')
) as mapping(legacy_status, canonical_status, treatment);

comment on view public.anpi_legacy_check_status_mapping is
  'Documentation-only mapping. This migration does not rewrite frozen legacy rows.';

revoke all on public.anpi_legacy_check_status_mapping from public, anon, authenticated;
grant select on public.anpi_legacy_check_status_mapping to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security
-- FORCE RLS is intentionally not enabled: narrowly granted SECURITY DEFINER
-- functions need owner bypass. Direct client writes remain denied by policies.
-- ---------------------------------------------------------------------------

alter table public.anpi_settings enable row level security;
alter table public.anpi_check_instances enable row level security;
alter table public.anpi_contacts enable row level security;
alter table public.anpi_contact_invitations enable row level security;
alter table public.anpi_notification_deliveries enable row level security;
alter table public.anpi_audit_logs enable row level security;

create policy anpi_settings_select_participant
  on public.anpi_settings
  for select
  to authenticated
  using (
    deleted_at is null
    and auth.uid() in (owner_user_id, subject_user_id)
  );

create policy anpi_settings_insert_self
  on public.anpi_settings
  for insert
  to authenticated
  with check (
    auth.uid() = owner_user_id
    and auth.uid() = subject_user_id
    and deleted_at is null
  );

create policy anpi_settings_update_owner_self
  on public.anpi_settings
  for update
  to authenticated
  using (
    auth.uid() = owner_user_id
    and auth.uid() = subject_user_id
    and deleted_at is null
  )
  with check (
    auth.uid() = owner_user_id
    and auth.uid() = subject_user_id
  );

create policy anpi_check_instances_select_participant
  on public.anpi_check_instances
  for select
  to authenticated
  using (auth.uid() in (owner_user_id, subject_user_id));

create policy anpi_contacts_select_participant
  on public.anpi_contacts
  for select
  to authenticated
  using (
    deleted_at is null
    and auth.uid() in (owner_user_id, subject_user_id, contact_user_id)
  );

create policy anpi_contacts_insert_self_pending
  on public.anpi_contacts
  for insert
  to authenticated
  with check (
    auth.uid() = owner_user_id
    and auth.uid() = subject_user_id
    and status = 'pending'
    and accepted_at is null
    and revoked_at is null
    and deleted_at is null
  );

create policy anpi_contact_invitations_insert_owner
  on public.anpi_contact_invitations
  for insert
  to authenticated
  with check (
    auth.uid() = inviter_user_id
    and accepted_at is null
    and declined_at is null
    and revoked_at is null
    and exists (
      select 1
      from public.anpi_contacts c
      where c.id = contact_id
        and c.owner_user_id = auth.uid()
        and c.subject_user_id = auth.uid()
        and c.contact_user_id = invitee_user_id
        and c.status = 'pending'
        and c.deleted_at is null
    )
  );

create policy anpi_notification_deliveries_select_recipient
  on public.anpi_notification_deliveries
  for select
  to authenticated
  using (recipient_user_id = auth.uid());

-- No authenticated INSERT/UPDATE/DELETE policies exist for check instances,
-- deliveries, or audit logs. No authenticated SELECT policy exists for audit.

revoke all on table public.anpi_settings from public, anon, authenticated;
revoke all on table public.anpi_check_instances from public, anon, authenticated;
revoke all on table public.anpi_contacts from public, anon, authenticated;
revoke all on table public.anpi_contact_invitations from public, anon, authenticated;
revoke all on table public.anpi_notification_deliveries from public, anon, authenticated;
revoke all on table public.anpi_audit_logs from public, anon, authenticated;

grant select, insert, update on table public.anpi_settings to authenticated;
grant select on table public.anpi_check_instances to authenticated;
grant select, insert on table public.anpi_contacts to authenticated;
-- Invitation rows require a client-supplied UUID; INSERT RETURNING is intentionally
-- unavailable so token_hash is never returned through table SELECT.
grant insert on table public.anpi_contact_invitations to authenticated;
grant select on table public.anpi_notification_deliveries to authenticated;

grant select, insert, update on table public.anpi_settings to service_role;
grant select, insert, update on table public.anpi_check_instances to service_role;
grant select, insert, update on table public.anpi_contacts to service_role;
grant select, insert, update on table public.anpi_contact_invitations to service_role;
grant select, insert, update on table public.anpi_notification_deliveries to service_role;
grant select, insert on table public.anpi_audit_logs to service_role;

comment on table public.anpi_settings is
  'ANPI Phase 2 settings; RLS enabled; managed owner/subject relationships require reviewed service workflow.';
comment on table public.anpi_check_instances is
  'ANPI Phase 2 daily checks; clients cannot directly insert or mutate status.';
comment on table public.anpi_audit_logs is
  'ANPI Phase 2 append-only audit; no general client SELECT policy.';
