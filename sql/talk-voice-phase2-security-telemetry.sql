-- TASFUL TALK Voice Phase 2 — signaling hardening and connection telemetry
-- Staging/local only. Production apply is explicitly forbidden in Phase 2.
-- Prerequisite: talk-call-schema.sql, talk-call-rls-production.sql,
--               talk-voice-phase1-session-usage.sql.

begin;

create or replace function public.talk_current_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- Keep precedence aligned with Pages JWT helper (app_metadata only, then sub).
  select nullif(trim(coalesce(
    auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
    auth.jwt() -> 'app_metadata' ->> 'member_id',
    auth.jwt() ->> 'sub',
    auth.uid()::text
  )), '');
$$;

alter table public.talk_call_sessions
  add column if not exists connection_route text,
  add column if not exists relay_protocol text,
  add column if not exists connect_time_ms integer,
  add column if not exists reconnect_count integer not null default 0,
  add column if not exists packet_loss_summary real,
  add column if not exists jitter_summary real,
  add column if not exists audio_bytes_sent bigint,
  add column if not exists audio_bytes_received bigint;

alter table public.talk_call_sessions
  drop constraint if exists talk_call_sessions_connection_route_check,
  add constraint talk_call_sessions_connection_route_check
    check (connection_route is null or connection_route in (
      'p2p_host', 'p2p_srflx', 'turn_udp', 'turn_tcp', 'turn_tls', 'unknown'
    )),
  drop constraint if exists talk_call_sessions_relay_protocol_check,
  add constraint talk_call_sessions_relay_protocol_check
    check (relay_protocol is null or relay_protocol in ('udp', 'tcp', 'tls', 'unknown')),
  drop constraint if exists talk_call_sessions_telemetry_nonnegative_check,
  add constraint talk_call_sessions_telemetry_nonnegative_check check (
    coalesce(connect_time_ms, 0) >= 0
    and reconnect_count >= 0
    and coalesce(packet_loss_summary, 0) >= 0
    and coalesce(jitter_summary, 0) >= 0
    and coalesce(audio_bytes_sent, 0) >= 0
    and coalesce(audio_bytes_received, 0) >= 0
  );

alter table public.talk_call_signals
  add column if not exists target_user_id text,
  add column if not exists sequence integer,
  add column if not exists generation integer not null default 0,
  add column if not exists expires_at timestamptz not null default (now() + interval '10 minutes');

alter table public.talk_call_signals
  drop constraint if exists talk_call_signals_type_check,
  add constraint talk_call_signals_type_check
    check (signal_type in ('offer', 'answer', 'candidate', 'hangup', 'ice_restart')),
  drop constraint if exists talk_call_signals_sequence_check,
  add constraint talk_call_signals_sequence_check
    check (sequence is null or sequence between 0 and 1000000),
  drop constraint if exists talk_call_signals_generation_check,
  add constraint talk_call_signals_generation_check
    check (generation between 0 and 1000),
  drop constraint if exists talk_call_signals_payload_size_check,
  add constraint talk_call_signals_payload_size_check
    check (octet_length(payload::text) <= 65536);

create index if not exists talk_call_signals_session_created_idx
  on public.talk_call_signals (session_id, created_at);
create index if not exists talk_call_signals_expiry_idx
  on public.talk_call_signals (expires_at);
create index if not exists talk_call_sessions_route_created_idx
  on public.talk_call_sessions (connection_route, created_at desc);

create or replace function public.talk_voice_guard_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.transaction_rooms%rowtype;
  v_terminal boolean;
begin
  if tg_op = 'INSERT' then
    if new.caller_id is null or new.callee_id is null or new.caller_id = new.callee_id then
      raise exception 'invalid call participants' using errcode = '23514';
    end if;
    select * into v_room from public.transaction_rooms where id::text = new.room_id limit 1;
    if not found
       or new.caller_id not in (v_room.buyer_id, v_room.seller_id)
       or new.callee_id not in (v_room.buyer_id, v_room.seller_id) then
      raise exception 'thread participant mismatch' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(least(new.caller_id, new.callee_id), 0));
    perform pg_advisory_xact_lock(hashtextextended(greatest(new.caller_id, new.callee_id), 0));
    if exists (
      select 1 from public.talk_call_sessions s
      where s.status in ('ringing', 'active')
        and (s.status = 'active' or s.expires_at > now())
        and (
          s.caller_id in (new.caller_id, new.callee_id)
          or s.callee_id in (new.caller_id, new.callee_id)
        )
    ) then
      raise exception 'participant already has active call' using errcode = '23505';
    end if;
    new.status := 'ringing';
    new.started_at := null;
    new.ended_at := null;
    new.duration_seconds := null;
    new.billable_seconds := null;
    new.last_heartbeat_at := null;
    return new;
  end if;

  if new.room_id <> old.room_id
     or new.caller_id <> old.caller_id
     or new.callee_id <> old.callee_id
     or new.provider <> old.provider
     or new.session_limit_seconds is distinct from old.session_limit_seconds then
    raise exception 'immutable call session identity' using errcode = '42501';
  end if;

  if old.status in ('ended', 'missed', 'rejected', 'busy') and new.status <> old.status then
    raise exception 'terminal call session' using errcode = '23514';
  end if;
  if new.status = 'active' and old.status = 'ringing' then
    new.started_at := now();
    new.last_heartbeat_at := now();
  else
    new.started_at := old.started_at;
  end if;

  v_terminal := new.status in ('ended', 'missed', 'rejected', 'busy');
  if v_terminal and old.status not in ('ended', 'missed', 'rejected', 'busy') then
    new.ended_at := now();
    new.duration_seconds := greatest(
      0,
      floor(extract(epoch from (new.ended_at - coalesce(old.started_at, old.created_at))))::integer
    );
    new.billable_seconds := new.duration_seconds;
  else
    new.ended_at := old.ended_at;
    new.duration_seconds := old.duration_seconds;
    new.billable_seconds := old.billable_seconds;
  end if;
  return new;
end;
$$;

drop trigger if exists talk_voice_guard_session_trigger on public.talk_call_sessions;
create trigger talk_voice_guard_session_trigger
before insert or update on public.talk_call_sessions
for each row execute function public.talk_voice_guard_session();

create or replace function public.talk_voice_guard_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.talk_call_sessions%rowtype;
  v_sender_count integer;
begin
  select * into v_session
  from public.talk_call_sessions
  where id = new.session_id
  for share;
  if not found then
    raise exception 'call session not found' using errcode = '23503';
  end if;
  if new.sender_id not in (v_session.caller_id, v_session.callee_id) then
    raise exception 'signal sender is not participant' using errcode = '42501';
  end if;
  if new.target_user_id is null then
    new.target_user_id := case
      when new.sender_id = v_session.caller_id then v_session.callee_id
      else v_session.caller_id
    end;
  end if;
  if new.target_user_id not in (v_session.caller_id, v_session.callee_id)
     or new.target_user_id = new.sender_id then
    raise exception 'invalid signal target' using errcode = '42501';
  end if;
  if v_session.status not in ('ringing', 'active') then
    raise exception 'inactive call session' using errcode = '23514';
  end if;
  select count(*) into v_sender_count
  from public.talk_call_signals s
  where s.sender_id = new.sender_id and s.created_at > now() - interval '1 minute';
  if v_sender_count >= 180 then
    raise exception 'signal rate limited' using errcode = '54000';
  end if;
  new.expires_at := least(
    coalesce(new.expires_at, now() + interval '10 minutes'),
    now() + interval '10 minutes'
  );
  return new;
end;
$$;

drop trigger if exists talk_voice_guard_signal_trigger on public.talk_call_signals;
create trigger talk_voice_guard_signal_trigger
before insert on public.talk_call_signals
for each row execute function public.talk_voice_guard_signal();

drop policy if exists "talk_call_signals_select_participant" on public.talk_call_signals;
create policy "talk_call_signals_select_participant"
  on public.talk_call_signals for select to authenticated
  using (
    expires_at > now()
    and (
      public.talk_is_admin()
      or target_user_id = public.talk_current_user_id()
      or sender_id = public.talk_current_user_id()
    )
  );

drop policy if exists "talk_call_signals_insert_participant" on public.talk_call_signals;
create policy "talk_call_signals_insert_participant"
  on public.talk_call_signals for insert to authenticated
  with check (
    sender_id = public.talk_current_user_id()
    and exists (
      select 1 from public.talk_call_sessions s
      where s.id = session_id
        and s.status in ('ringing', 'active')
        and public.talk_current_user_id() in (s.caller_id, s.callee_id)
        and target_user_id in (s.caller_id, s.callee_id)
        and target_user_id <> public.talk_current_user_id()
    )
  );

comment on column public.talk_call_sessions.connection_route is
  'PII-minimized selected candidate route; IP addresses are not stored.';
comment on column public.talk_call_sessions.audio_bytes_sent is
  'Browser WebRTC audio bytes sent snapshot; client-observed telemetry, not billing authority.';
comment on column public.talk_call_signals.expires_at is
  'Signal retention boundary. Operations must purge expired rows.';

revoke all on function public.talk_current_user_id() from public;
revoke all on function public.talk_voice_guard_session() from public;
revoke all on function public.talk_voice_guard_signal() from public;
grant execute on function public.talk_current_user_id() to authenticated;

commit;

-- Rollback (manual, reviewed): drop triggers/functions, restore Phase 1 RLS policies,
-- drop the Phase 2 indexes/constraints/columns. Existing session identity data is retained.
