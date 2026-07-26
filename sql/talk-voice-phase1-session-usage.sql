-- TASFUL TALK Voice Phase 1 — session usage / provider columns (nullable · safe)
-- Production apply: NOT in this phase. Staging / local only after review.
-- Rollback: drop columns below (nullable · no data required).

alter table public.talk_call_sessions
  add column if not exists provider text not null default 'webrtc';

alter table public.talk_call_sessions
  add column if not exists last_heartbeat_at timestamptz;

alter table public.talk_call_sessions
  add column if not exists duration_seconds integer;

alter table public.talk_call_sessions
  add column if not exists billable_seconds integer;

alter table public.talk_call_sessions
  add column if not exists end_reason text;

alter table public.talk_call_sessions
  add column if not exists session_limit_seconds integer;

comment on column public.talk_call_sessions.provider is
  'Voice provider id (webrtc | future adapters). TASFUL-owned.';
comment on column public.talk_call_sessions.last_heartbeat_at is
  'Last client heartbeat while status=active. Server duration remains authoritative.';
comment on column public.talk_call_sessions.duration_seconds is
  'Server-computed connected duration (ended_at - started_at). Client duration ignored.';
comment on column public.talk_call_sessions.billable_seconds is
  'Billable seconds snapshot (usually equals duration_seconds until paid metering).';
comment on column public.talk_call_sessions.end_reason is
  'Terminal reason: hangup | missed | rejected | heartbeat_stale | media_denied | …';
comment on column public.talk_call_sessions.session_limit_seconds is
  'Entitlement snapshot at session create (null = unmetered legacy).';

-- Optional partial unique: one active/ringing session per user is enforced in app
-- via findBusyUser; DB unique across caller/callee OR is non-trivial — document limit.
