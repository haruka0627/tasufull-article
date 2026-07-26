-- =============================================================================
-- ANPI Phase 17 — First staging insert readiness foundation
-- Target: staging ahlxuyvhzqdqaojiywmu ONLY
-- STAGING TEST ONLY
-- DO NOT APPLY TO PRODUCTION
-- =============================================================================
-- Provides:
--   1) Feature gate table (default enabled=false)
--   2) Target bind by auth_user_id sha256 prefix (no raw UUID in repo)
--   3) Safe writer RPC (service_role only · dry_run default true · max 1)
--   4) Emergency disable RPC
--   5) Polling reader dry-run helper (counts only)
--
-- Does NOT insert notifications when dry_run=true or enabled=false.
-- Does NOT enable Realtime / Push / production paths.
-- Phase 10 job writer is NOT_PRESENT on staging → READY_WITH_SAFE_WRAPPER.
-- =============================================================================

create table if not exists public.anpi_phase17_insert_gate (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  target_auth_user_id uuid,
  target_talk_user_id text,
  target_auth_sha8 text,
  max_inserts integer not null default 1 check (max_inserts = 1),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  idempotency_key text not null default 'anpi-phase17-first-insert-v1',
  last_notification_id text,
  updated_at timestamptz not null default now(),
  notes text not null default 'Phase17 staging-only first insert gate'
);

comment on table public.anpi_phase17_insert_gate is
  'ANPI Phase 17: staging-only feature gate for a single controlled test INSERT. Default OFF.';

alter table public.anpi_phase17_insert_gate enable row level security;

drop policy if exists "anpi_phase17_insert_gate_deny_all" on public.anpi_phase17_insert_gate;
-- No authenticated/anon policies ⇒ deny. service_role bypasses RLS.

revoke all on table public.anpi_phase17_insert_gate from public, anon, authenticated;
grant all on table public.anpi_phase17_insert_gate to service_role;

insert into public.anpi_phase17_insert_gate (id, enabled)
values (1, false)
on conflict (id) do nothing;

-- Bind target mapping by sha8 prefix (repo-safe). pick_rank=3 / auth sha8=0411f04d
update public.anpi_phase17_insert_gate g
set
  target_auth_user_id = c.auth_user_id,
  target_talk_user_id = c.talk_user_id,
  target_auth_sha8 = left(encode(extensions.digest(c.auth_user_id::text, 'sha256'), 'hex'), 8),
  updated_at = now()
from public.anpi_user_contexts c
where g.id = 1
  and c.mapping_status = 'approved_phase15'
  and left(encode(extensions.digest(c.auth_user_id::text, 'sha256'), 'hex'), 8) = '0411f04d';

-- ---------------------------------------------------------------------------
-- Emergency disable
-- ---------------------------------------------------------------------------
create or replace function public.anpi_phase17_emergency_disable()
returns table (
  enabled boolean,
  executed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.anpi_phase17_insert_gate
  set enabled = false, updated_at = now()
  where id = 1;

  enabled := false;
  executed_at := clock_timestamp();
  return next;
end;
$$;

revoke all on function public.anpi_phase17_emergency_disable() from public, anon, authenticated;
grant execute on function public.anpi_phase17_emergency_disable() to service_role;

-- ---------------------------------------------------------------------------
-- Enable (explicit · staging ops only · still requires dry_run=false later)
-- ---------------------------------------------------------------------------
create or replace function public.anpi_phase17_enable_flag()
returns table (
  enabled boolean,
  target_bound boolean,
  executed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_bound boolean;
begin
  select (target_auth_user_id is not null and nullif(trim(target_talk_user_id), '') is not null)
    into v_bound
  from public.anpi_phase17_insert_gate where id = 1;

  if coalesce(v_bound, false) is not true then
    raise exception using errcode = '22023', message = 'anpi_phase17_target_unbound';
  end if;

  update public.anpi_phase17_insert_gate
  set enabled = true, updated_at = now()
  where id = 1;

  enabled := true;
  target_bound := true;
  executed_at := clock_timestamp();
  return next;
end;
$$;

revoke all on function public.anpi_phase17_enable_flag() from public, anon, authenticated;
grant execute on function public.anpi_phase17_enable_flag() to service_role;

-- ---------------------------------------------------------------------------
-- Safe writer (default dry_run=true · max 1 · service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.anpi_phase17_insert_first_test_notification(
  p_dry_run boolean default true,
  p_force_idempotency_key text default null
)
returns table (
  inserted_count integer,
  already_seen boolean,
  dry_run boolean,
  enabled boolean,
  notification_id text,
  talk_user_id_sha16 text,
  reason_code text,
  executed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gate public.anpi_phase17_insert_gate%rowtype;
  v_key text;
  v_id text;
  v_resolved text;
  v_title text := 'ANPI Phase17 staging test';
  v_body text := 'Non-sensitive readiness probe. Safe to delete.';
begin
  select * into v_gate from public.anpi_phase17_insert_gate where id = 1 for update;
  if not found then
    raise exception using errcode = '22023', message = 'anpi_phase17_gate_missing';
  end if;

  v_key := coalesce(nullif(trim(p_force_idempotency_key), ''), v_gate.idempotency_key);
  if char_length(v_key) < 8 or char_length(v_key) > 200 then
    raise exception using errcode = '22023', message = 'anpi_phase17_invalid_idempotency_key';
  end if;
  if v_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'anpi_phase17_invalid_idempotency_key_charset';
  end if;

  -- Fixed non-sensitive payload size guard (title+body)
  if char_length(v_title) + char_length(v_body) > 500 then
    raise exception using errcode = '22023', message = 'anpi_phase17_payload_too_large';
  end if;

  if v_gate.target_auth_user_id is null or nullif(trim(v_gate.target_talk_user_id), '') is null then
    inserted_count := 0; already_seen := false; dry_run := coalesce(p_dry_run, true);
    enabled := v_gate.enabled; notification_id := null; talk_user_id_sha16 := null;
    reason_code := 'anpi_phase17_target_unbound'; executed_at := clock_timestamp();
    return next; return;
  end if;

  v_resolved := public.anpi_resolve_talk_user_id(v_gate.target_auth_user_id);
  if v_resolved is distinct from v_gate.target_talk_user_id then
    inserted_count := 0; already_seen := false; dry_run := coalesce(p_dry_run, true);
    enabled := v_gate.enabled; notification_id := null;
    talk_user_id_sha16 := left(encode(extensions.digest(v_resolved, 'sha256'), 'hex'), 16);
    reason_code := 'anpi_phase17_identity_mismatch'; executed_at := clock_timestamp();
    return next; return;
  end if;

  v_id := 'anpi-p17-' || encode(extensions.digest(v_key, 'sha256'), 'hex');

  if exists (select 1 from public.talk_notifications t where t.id = v_id) then
    inserted_count := 0; already_seen := true; dry_run := coalesce(p_dry_run, true);
    enabled := v_gate.enabled; notification_id := v_id;
    talk_user_id_sha16 := left(encode(extensions.digest(v_gate.target_talk_user_id, 'sha256'), 'hex'), 16);
    reason_code := 'anpi_phase17_already_seen'; executed_at := clock_timestamp();
    return next; return;
  end if;

  if coalesce(v_gate.enabled, false) is not true then
    inserted_count := 0; already_seen := false; dry_run := coalesce(p_dry_run, true);
    enabled := false; notification_id := v_id;
    talk_user_id_sha16 := left(encode(extensions.digest(v_gate.target_talk_user_id, 'sha256'), 'hex'), 16);
    reason_code := 'anpi_phase17_flag_off'; executed_at := clock_timestamp();
    return next; return;
  end if;

  if v_gate.inserted_count >= v_gate.max_inserts then
    inserted_count := 0; already_seen := false; dry_run := coalesce(p_dry_run, true);
    enabled := v_gate.enabled; notification_id := v_id;
    talk_user_id_sha16 := left(encode(extensions.digest(v_gate.target_talk_user_id, 'sha256'), 'hex'), 16);
    reason_code := 'anpi_phase17_max_inserts_reached'; executed_at := clock_timestamp();
    return next; return;
  end if;

  if coalesce(p_dry_run, true) then
    inserted_count := 0; already_seen := false; dry_run := true;
    enabled := true; notification_id := v_id;
    talk_user_id_sha16 := left(encode(extensions.digest(v_gate.target_talk_user_id, 'sha256'), 'hex'), 16);
    reason_code := 'anpi_phase17_dry_run_would_insert'; executed_at := clock_timestamp();
    return next; return;
  end if;

  -- LIVE INSERT path (Phase 18 only). Phase 17 must not call with dry_run=false on staging.
  declare
    v_rows integer := 0;
  begin
    insert into public.talk_notifications (
      id, user_id, type, title, body, target_url, source, priority, created_at, updated_at
    ) values (
      v_id,
      v_gate.target_talk_user_id,
      'anpi',
      v_title,
      v_body,
      '#',
      'anpi_phase17_test',
      'normal',
      now(),
      now()
    )
    on conflict (id) do nothing;

    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      update public.anpi_phase17_insert_gate g
      set inserted_count = g.inserted_count + 1,
          last_notification_id = v_id,
          updated_at = now()
      where g.id = 1;
      inserted_count := 1;
      already_seen := false;
    else
      inserted_count := 0;
      already_seen := true;
    end if;
  end;

  dry_run := false;
  enabled := true;
  notification_id := v_id;
  talk_user_id_sha16 := left(encode(extensions.digest(v_gate.target_talk_user_id, 'sha256'), 'hex'), 16);
  reason_code := case when inserted_count = 1 then 'anpi_phase17_inserted' else 'anpi_phase17_already_seen' end;
  executed_at := clock_timestamp();
  return next;
end;
$$;

comment on function public.anpi_phase17_insert_first_test_notification(boolean, text) is
  'Phase 17 staging-only first insert writer. Default dry_run=true. service_role only. Uses gate target talk_user_id + resolver parity. Max 1.';

revoke all on function public.anpi_phase17_insert_first_test_notification(boolean, text)
  from public, anon, authenticated;
grant execute on function public.anpi_phase17_insert_first_test_notification(boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Polling reader dry-run (counts only · no row bodies)
-- ---------------------------------------------------------------------------
create or replace function public.anpi_phase17_polling_reader_dry_run()
returns table (
  target_talk_user_sha16 text,
  inbox_for_target integer,
  inbox_total integer,
  writer_reader_parity boolean,
  anon_select boolean,
  auth_insert boolean,
  realtime_registered boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_talk text;
  v_auth uuid;
begin
  select target_talk_user_id, target_auth_user_id into v_talk, v_auth
  from public.anpi_phase17_insert_gate where id = 1;

  target_talk_user_sha16 := case when v_talk is null then null
    else left(encode(extensions.digest(v_talk, 'sha256'), 'hex'), 16) end;
  inbox_for_target := coalesce((select count(*)::int from public.talk_notifications where user_id = v_talk), 0);
  inbox_total := (select count(*)::int from public.talk_notifications);
  writer_reader_parity := (
    v_auth is not null and v_talk is not null
    and public.anpi_resolve_talk_user_id(v_auth) = v_talk
  );
  anon_select := has_table_privilege('anon', 'public.talk_notifications', 'SELECT');
  auth_insert := has_table_privilege('authenticated', 'public.talk_notifications', 'INSERT');
  realtime_registered := exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'talk_notifications'
  );
  return next;
end;
$$;

revoke all on function public.anpi_phase17_polling_reader_dry_run() from public, anon, authenticated;
grant execute on function public.anpi_phase17_polling_reader_dry_run() to service_role;

-- Sanity
select
  (select enabled from public.anpi_phase17_insert_gate where id = 1) as flag_enabled,
  (select target_auth_sha8 from public.anpi_phase17_insert_gate where id = 1) as target_sha8,
  (select target_auth_user_id is not null from public.anpi_phase17_insert_gate where id = 1) as target_bound,
  to_regprocedure('public.anpi_phase17_insert_first_test_notification(boolean,text)') is not null as writer_exists,
  to_regprocedure('public.anpi_phase17_emergency_disable()') is not null as emergency_exists;
