-- TASFUL LIVE → YouTube型 P1 Phase 13 — security / abuse prevention
--
-- Apply: staging only · individual SQL (NOT supabase db push)
--   npx supabase db query --linked -f supabase/migrations/20260703100000_live_security_p13.sql

-- ---------------------------------------------------------------------------
-- T-14 live_video_view_events
-- ---------------------------------------------------------------------------

create table if not exists public.live_video_view_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.live_videos (id) on delete cascade,
  user_id text,
  device_key text,
  watched_seconds integer not null default 0,
  watched_ratio numeric,
  counted boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  constraint live_video_view_events_watched_seconds_chk
    check (watched_seconds >= 0),
  constraint live_video_view_events_watched_ratio_chk
    check (watched_ratio is null or (watched_ratio >= 0 and watched_ratio <= 1))
);

comment on table public.live_video_view_events is
  'Qualified view attempts · dedup via Edge (TLV Phase 13)';
comment on column public.live_video_view_events.device_key is
  'SHA-256 hashed anonymous device id · no PII';

create index if not exists live_video_view_events_video_created_idx
  on public.live_video_view_events (video_id, created_at desc);

create index if not exists live_video_view_events_user_video_idx
  on public.live_video_view_events (user_id, video_id, created_at desc)
  where user_id is not null;

create index if not exists live_video_view_events_device_video_idx
  on public.live_video_view_events (device_key, video_id, created_at desc)
  where device_key is not null;

-- ---------------------------------------------------------------------------
-- T-15 live_ad_impression_events
-- ---------------------------------------------------------------------------

create table if not exists public.live_ad_impression_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.live_videos (id) on delete cascade,
  ad_id uuid references public.live_video_ads (id) on delete set null,
  user_id text,
  device_key text,
  counted boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.live_ad_impression_events is
  'Ad impression events · dedup via Edge (TLV Phase 13)';

create index if not exists live_ad_impression_events_dedup_idx
  on public.live_ad_impression_events (video_id, ad_id, user_id, device_key, created_at desc);

-- ---------------------------------------------------------------------------
-- T-16 live_risk_flags
-- ---------------------------------------------------------------------------

create table if not exists public.live_risk_flags (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  severity text not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_risk_flags_target_type_chk
    check (target_type in ('user', 'video', 'ad', 'report')),
  constraint live_risk_flags_severity_chk
    check (severity in ('low', 'medium', 'high')),
  constraint live_risk_flags_status_chk
    check (status in ('open', 'watching', 'resolved'))
);

comment on table public.live_risk_flags is
  'Abuse / fraud risk flags for admin review (TLV Phase 13)';

create index if not exists live_risk_flags_status_created_idx
  on public.live_risk_flags (status, created_at desc);

create index if not exists live_risk_flags_target_idx
  on public.live_risk_flags (target_type, target_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Report duplicate prevention (DB-level)
-- ---------------------------------------------------------------------------

create unique index if not exists live_video_reports_video_reporter_uidx
  on public.live_video_reports (video_id, reporter_talk_user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

drop trigger if exists live_risk_flags_set_updated_at on public.live_risk_flags;
create trigger live_risk_flags_set_updated_at
  before update on public.live_risk_flags
  for each row execute function public.live_set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------

grant select on public.live_video_view_events to authenticated;
grant select on public.live_ad_impression_events to authenticated;
grant select, update on public.live_risk_flags to authenticated;

revoke insert, update, delete on public.live_video_view_events from authenticated;
revoke insert, update, delete on public.live_ad_impression_events from authenticated;
revoke insert, delete on public.live_risk_flags from authenticated;

alter table public.live_video_view_events enable row level security;
alter table public.live_ad_impression_events enable row level security;
alter table public.live_risk_flags enable row level security;

drop policy if exists live_video_view_events_admin_select on public.live_video_view_events;
create policy live_video_view_events_admin_select
  on public.live_video_view_events for select to authenticated
  using (public.talk_is_admin());

drop policy if exists live_ad_impression_events_admin_select on public.live_ad_impression_events;
create policy live_ad_impression_events_admin_select
  on public.live_ad_impression_events for select to authenticated
  using (public.talk_is_admin());

drop policy if exists live_risk_flags_admin_select on public.live_risk_flags;
create policy live_risk_flags_admin_select
  on public.live_risk_flags for select to authenticated
  using (public.talk_is_admin());

drop policy if exists live_risk_flags_admin_update on public.live_risk_flags;
create policy live_risk_flags_admin_update
  on public.live_risk_flags for update to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());
