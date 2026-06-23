-- TASFUL LIVE / Short & Live — P0 schema (DRAFT · NOT APPLIED)
-- Ref: reports/tasful-live-p0-design.md v1.1
-- Ref: reports/tasful-live-p0-migration-review.md (条件付き Go)
--
-- Prerequisite:
--   - sql/talk-rls-production.sql (talk_current_user_id / talk_is_admin)
--   - supabase/migrations/20260622120000_talk_room_contact_bridge.sql
--
-- Platform constants (app / Edge · not DB-enforced except CHECK):
--   LIVE_SHORT_DAILY_UPLOAD_LIMIT     = 10
--   LIVE_SHORT_ACTIVE_TOTAL_LIMIT     = 50
--   LIVE_SIGNED_URL_TTL_SECONDS       = 300
--   LIVE_STREAM_PROVIDER default      = stub
--
-- TALK: no ALTER on transaction_rooms / talk_notifications
-- MATCH / Marketplace / Builder: no changes
--
-- Apply: staging only after review · run POST checks in reports/tasful-live-p0-schema-draft-result.md

-- ---------------------------------------------------------------------------
-- Trigger helper (no table references · required before table triggers)
-- ---------------------------------------------------------------------------

create or replace function public.live_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.live_set_updated_at() is
  'TASFUL LIVE: touch updated_at on row update';

-- ---------------------------------------------------------------------------
-- T-01 live_creator_profiles
-- ---------------------------------------------------------------------------

create table if not exists public.live_creator_profiles (
  user_id text primary key,
  bio text,
  banner_storage_path text,
  avatar_storage_path text,
  creator_status text not null default 'draft',
  live_permission_status text not null default 'none',
  live_monthly_minutes_limit integer,
  creator_tier text,
  fee_rate numeric(5, 4),
  payout_policy jsonb not null default '{}'::jsonb,
  live_notify_default boolean not null default true,
  tip_message_enabled boolean not null default true,
  short_daily_count integer not null default 0,
  short_daily_reset_on date,
  short_active_count integer not null default 0,
  follower_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_creator_profiles_bio_len_chk
    check (bio is null or char_length(bio) <= 500),
  constraint live_creator_profiles_creator_status_chk
    check (creator_status in ('draft', 'active', 'restricted', 'suspended')),
  constraint live_creator_profiles_live_permission_status_chk
    check (live_permission_status in ('none', 'identity_verified', 'ops_approved', 'suspended')),
  constraint live_creator_profiles_fee_rate_chk
    check (fee_rate is null or (fee_rate >= 0 and fee_rate <= 1)),
  constraint live_creator_profiles_short_daily_count_chk
    check (short_daily_count >= 0),
  constraint live_creator_profiles_short_active_count_chk
    check (short_active_count >= 0 and short_active_count <= 50),
  constraint live_creator_profiles_follower_count_chk
    check (follower_count >= 0)
);

comment on table public.live_creator_profiles is
  'TASFUL LIVE creator profile · permission gate · counters (daily 10 / active 50 enforced in Edge)';
comment on column public.live_creator_profiles.live_permission_status is
  'P0 broadcast gate: identity_verified | ops_approved required to publish';
comment on column public.live_creator_profiles.short_active_count is
  'Published + hidden shorts count · max 50 per creator (LIVE_SHORT_ACTIVE_TOTAL_LIMIT)';
comment on column public.live_creator_profiles.short_daily_count is
  'Uploads today · max 10 per day (LIVE_SHORT_DAILY_UPLOAD_LIMIT) · reset via short_daily_reset_on';

-- ---------------------------------------------------------------------------
-- T-02 live_shorts
-- ---------------------------------------------------------------------------

create table if not exists public.live_shorts (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null,
  title text not null,
  description text,
  tags text[] not null default '{}'::text[],
  storage_path text not null,
  thumb_storage_path text,
  duration_sec integer not null,
  width integer,
  height integer,
  status text not null default 'draft',
  view_count integer not null default 0,
  like_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_shorts_title_len_chk
    check (char_length(title) >= 1 and char_length(title) <= 120),
  constraint live_shorts_description_len_chk
    check (description is null or char_length(description) <= 2000),
  constraint live_shorts_tags_cardinality_chk
    check (cardinality(tags) <= 5),
  constraint live_shorts_duration_sec_chk
    check (duration_sec between 1 and 60),
  constraint live_shorts_status_chk
    check (status in ('draft', 'published', 'hidden', 'removed')),
  constraint live_shorts_view_count_chk
    check (view_count >= 0),
  constraint live_shorts_like_count_chk
    check (like_count >= 0)
);

comment on table public.live_shorts is
  'TASFUL LIVE short videos · MP4 9:16 max 60s · bucket short-videos';
comment on column public.live_shorts.status is
  'short_status: draft | published | hidden | removed';
comment on column public.live_shorts.storage_path is
  'Object path in short-videos bucket · signed URL TTL 300s via Edge';

create index if not exists live_shorts_published_feed_idx
  on public.live_shorts (published_at desc)
  where status = 'published';

create index if not exists live_shorts_creator_published_idx
  on public.live_shorts (creator_id, published_at desc);

create index if not exists live_shorts_creator_status_idx
  on public.live_shorts (creator_id, status);

-- ---------------------------------------------------------------------------
-- T-03 live_short_likes
-- ---------------------------------------------------------------------------

create table if not exists public.live_short_likes (
  short_id uuid not null references public.live_shorts (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (short_id, user_id)
);

comment on table public.live_short_likes is
  'TASFUL LIVE short likes · one row per user per short';

create index if not exists live_short_likes_user_created_idx
  on public.live_short_likes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- T-04 live_broadcasts
-- ---------------------------------------------------------------------------

create table if not exists public.live_broadcasts (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null,
  title text not null,
  thumb_storage_path text,
  status text not null default 'scheduled',
  stream_provider text not null default 'stub',
  stream_live_input_id text,
  playback_url text,
  archive_storage_path text,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  peak_viewers integer not null default 0,
  tip_total_yen_stub integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_broadcasts_title_len_chk
    check (char_length(title) >= 1 and char_length(title) <= 120),
  constraint live_broadcasts_status_chk
    check (status in ('scheduled', 'preparing', 'live', 'ended', 'failed', 'removed')),
  constraint live_broadcasts_stream_provider_chk
    check (stream_provider in ('stub', 'cloudflare_stream')),
  constraint live_broadcasts_peak_viewers_chk
    check (peak_viewers >= 0),
  constraint live_broadcasts_tip_total_yen_stub_chk
    check (tip_total_yen_stub >= 0)
);

comment on table public.live_broadcasts is
  'TASFUL LIVE broadcast sessions · RTMP→HLS via Cloudflare Stream (stub default)';
comment on column public.live_broadcasts.status is
  'stream_status: scheduled | preparing | live | ended | failed | removed';
comment on column public.live_broadcasts.stream_provider is
  'LIVE_STREAM_PROVIDER: stub (P0 default) | cloudflare_stream';
comment on column public.live_broadcasts.archive_storage_path is
  'Reserved for live-archives bucket · P1';

create index if not exists live_broadcasts_status_live_idx
  on public.live_broadcasts (started_at desc)
  where status = 'live';

create index if not exists live_broadcasts_creator_started_idx
  on public.live_broadcasts (creator_id, started_at desc);

-- ---------------------------------------------------------------------------
-- T-05 live_broadcast_messages
-- ---------------------------------------------------------------------------

create table if not exists public.live_broadcast_messages (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.live_broadcasts (id) on delete cascade,
  sender_id text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint live_broadcast_messages_message_len_chk
    check (char_length(message) >= 1 and char_length(message) <= 200)
);

comment on table public.live_broadcast_messages is
  'TASFUL LIVE in-broadcast chat · not TALK threads · Realtime optional';

create index if not exists live_broadcast_messages_broadcast_created_idx
  on public.live_broadcast_messages (broadcast_id, created_at asc);

-- ---------------------------------------------------------------------------
-- T-06 live_creator_follows
-- ---------------------------------------------------------------------------

create table if not exists public.live_creator_follows (
  follower_id text not null,
  creator_id text not null,
  notify_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_id),
  constraint live_creator_follows_no_self_chk
    check (follower_id <> creator_id)
);

comment on table public.live_creator_follows is
  'TASFUL LIVE user→creator follows · separate from talk_follow_subscriptions';

create index if not exists live_creator_follows_creator_created_idx
  on public.live_creator_follows (creator_id, created_at desc);

create index if not exists live_creator_follows_follower_created_idx
  on public.live_creator_follows (follower_id, created_at desc);

-- ---------------------------------------------------------------------------
-- T-07 live_tips
-- ---------------------------------------------------------------------------

create table if not exists public.live_tips (
  id uuid primary key default gen_random_uuid(),
  tipper_id text not null,
  creator_id text not null,
  target_type text not null,
  target_id uuid not null,
  amount_yen integer not null,
  message text,
  payment_status text not null default 'stub',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint live_tips_target_type_chk
    check (target_type in ('short', 'broadcast')),
  constraint live_tips_amount_yen_chk
    check (amount_yen > 0),
  constraint live_tips_message_len_chk
    check (message is null or char_length(message) <= 100),
  constraint live_tips_payment_status_chk
    check (payment_status in ('stub', 'pending', 'succeeded', 'failed')),
  constraint live_tips_no_self_tip_chk
    check (tipper_id <> creator_id),
  constraint live_tips_idempotency_key_uq unique (idempotency_key)
);

comment on table public.live_tips is
  'TASFUL LIVE tips · P0 stub only · client UPDATE forbidden';
comment on column public.live_tips.payment_status is
  'tip_payment_status: stub | pending | succeeded | failed';

create index if not exists live_tips_tipper_created_idx
  on public.live_tips (tipper_id, created_at desc);

create index if not exists live_tips_creator_created_idx
  on public.live_tips (creator_id, created_at desc);

create index if not exists live_tips_target_idx
  on public.live_tips (target_type, target_id);

-- ---------------------------------------------------------------------------
-- T-08 live_moderation_logs
-- ---------------------------------------------------------------------------

create table if not exists public.live_moderation_logs (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  content_id text not null,
  user_id text,
  message_text text,
  reasons jsonb not null default '[]'::jsonb,
  level text not null,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint live_moderation_logs_content_type_chk
    check (content_type in ('live_short', 'live_broadcast_chat', 'live_profile'))
);

comment on table public.live_moderation_logs is
  'TASFUL LIVE moderation audit · ops/admin only';

create index if not exists live_moderation_logs_created_at_idx
  on public.live_moderation_logs (created_at desc);

create index if not exists live_moderation_logs_user_created_idx
  on public.live_moderation_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- T-09 live_notify_dedupe
-- ---------------------------------------------------------------------------

create table if not exists public.live_notify_dedupe (
  event_key text primary key,
  created_at timestamptz not null default now()
);

comment on table public.live_notify_dedupe is
  'Fanout dedupe for talk_notifications type=live · service_role / admin only';

-- ---------------------------------------------------------------------------
-- Grants (RLS enforced)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.live_creator_profiles to authenticated;
grant select, insert, update, delete on public.live_shorts to authenticated;
grant select, insert, delete on public.live_short_likes to authenticated;
grant select, insert, update on public.live_broadcasts to authenticated;
grant select, insert, delete on public.live_broadcast_messages to authenticated;
grant select, insert, delete on public.live_creator_follows to authenticated;
grant select, insert on public.live_tips to authenticated;
grant select, insert, update, delete on public.live_moderation_logs to authenticated;

revoke all on public.live_creator_profiles from anon;
revoke all on public.live_shorts from anon;
revoke all on public.live_short_likes from anon;
revoke all on public.live_broadcasts from anon;
revoke all on public.live_broadcast_messages from anon;
revoke all on public.live_creator_follows from anon;
revoke all on public.live_tips from anon;
revoke all on public.live_moderation_logs from anon;
revoke all on public.live_notify_dedupe from anon;
grant select, insert, delete on public.live_notify_dedupe to authenticated;
grant select, insert, delete on public.live_notify_dedupe to service_role;

-- ---------------------------------------------------------------------------
-- RLS enable
-- ---------------------------------------------------------------------------

alter table public.live_creator_profiles enable row level security;
alter table public.live_shorts enable row level security;
alter table public.live_short_likes enable row level security;
alter table public.live_broadcasts enable row level security;
alter table public.live_broadcast_messages enable row level security;
alter table public.live_creator_follows enable row level security;
alter table public.live_tips enable row level security;
alter table public.live_moderation_logs enable row level security;
alter table public.live_notify_dedupe enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions (after tables · referenced by RLS / triggers / storage)
-- ---------------------------------------------------------------------------

create or replace function public.live_is_public_creator(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.live_creator_profiles p
    where p.user_id = btrim(p_user_id)
      and p.creator_status = 'active'
      and p.live_permission_status <> 'suspended'
  );
$$;

comment on function public.live_is_public_creator(text) is
  'True when creator profile is publicly visible (active, not suspended)';

create or replace function public.live_has_broadcast_permission(p_user_id text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.live_creator_profiles p
    where p.user_id = coalesce(
      nullif(btrim(p_user_id), ''),
      public.talk_current_user_id()
    )
      and p.creator_status = 'active'
      and p.live_permission_status in ('identity_verified', 'ops_approved')
  );
$$;

comment on function public.live_has_broadcast_permission(text) is
  'P0 gate: identity_verified or ops_approved + active creator';

create or replace function public.live_broadcast_is_publicly_viewable(p_broadcast_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.live_broadcasts b
    inner join public.live_creator_profiles p on p.user_id = b.creator_id
    where b.id = p_broadcast_id
      and b.status in ('live', 'ended')
      and p.creator_status = 'active'
      and p.live_permission_status <> 'suspended'
  );
$$;

comment on function public.live_broadcast_is_publicly_viewable(uuid) is
  'Public read gate for live_broadcasts and live_broadcast_messages';

create or replace function public.live_storage_owner_matches(name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(btrim(split_part(coalesce(name, ''), '/', 1)), ''),
    ''
  ) = coalesce(public.talk_current_user_id(), '');
$$;

comment on function public.live_storage_owner_matches(text) is
  'Storage path first segment must equal talk_current_user_id()';

create or replace function public.live_creator_profiles_guard_owner_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.talk_is_admin() then
    return new;
  end if;

  if new.live_permission_status is distinct from old.live_permission_status
     or new.creator_status is distinct from old.creator_status
     or new.creator_tier is distinct from old.creator_tier
     or new.fee_rate is distinct from old.fee_rate
     or new.payout_policy is distinct from old.payout_policy
     or new.live_monthly_minutes_limit is distinct from old.live_monthly_minutes_limit
     or new.short_daily_count is distinct from old.short_daily_count
     or new.short_daily_reset_on is distinct from old.short_daily_reset_on
     or new.short_active_count is distinct from old.short_active_count
     or new.follower_count is distinct from old.follower_count
  then
    raise exception 'live_creator_profiles: forbidden column update for non-admin';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers (after helper functions)
-- ---------------------------------------------------------------------------

drop trigger if exists live_creator_profiles_set_updated_at on public.live_creator_profiles;
create trigger live_creator_profiles_set_updated_at
  before update on public.live_creator_profiles
  for each row execute function public.live_set_updated_at();

drop trigger if exists live_creator_profiles_guard_owner_update on public.live_creator_profiles;
create trigger live_creator_profiles_guard_owner_update
  before update on public.live_creator_profiles
  for each row execute function public.live_creator_profiles_guard_owner_update();

drop trigger if exists live_shorts_set_updated_at on public.live_shorts;
create trigger live_shorts_set_updated_at
  before update on public.live_shorts
  for each row execute function public.live_set_updated_at();

drop trigger if exists live_broadcasts_set_updated_at on public.live_broadcasts;
create trigger live_broadcasts_set_updated_at
  before update on public.live_broadcasts
  for each row execute function public.live_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: live_creator_profiles
-- ---------------------------------------------------------------------------

drop policy if exists live_creator_profiles_select_public on public.live_creator_profiles;
create policy live_creator_profiles_select_public
  on public.live_creator_profiles for select to authenticated
  using (public.live_is_public_creator(user_id));

drop policy if exists live_creator_profiles_select_own on public.live_creator_profiles;
create policy live_creator_profiles_select_own
  on public.live_creator_profiles for select to authenticated
  using (user_id = public.talk_current_user_id());

drop policy if exists live_creator_profiles_insert_own on public.live_creator_profiles;
create policy live_creator_profiles_insert_own
  on public.live_creator_profiles for insert to authenticated
  with check (user_id = public.talk_current_user_id());

drop policy if exists live_creator_profiles_update_own on public.live_creator_profiles;
create policy live_creator_profiles_update_own
  on public.live_creator_profiles for update to authenticated
  using (user_id = public.talk_current_user_id())
  with check (user_id = public.talk_current_user_id());

drop policy if exists live_creator_profiles_admin_all on public.live_creator_profiles;
create policy live_creator_profiles_admin_all
  on public.live_creator_profiles for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_shorts
-- ---------------------------------------------------------------------------

drop policy if exists live_shorts_select_published on public.live_shorts;
create policy live_shorts_select_published
  on public.live_shorts for select to authenticated
  using (
    status = 'published'
    and public.live_is_public_creator(creator_id)
  );

drop policy if exists live_shorts_select_own on public.live_shorts;
create policy live_shorts_select_own
  on public.live_shorts for select to authenticated
  using (creator_id = public.talk_current_user_id());

drop policy if exists live_shorts_insert_own on public.live_shorts;
create policy live_shorts_insert_own
  on public.live_shorts for insert to authenticated
  with check (
    creator_id = public.talk_current_user_id()
    and public.live_has_broadcast_permission(creator_id)
  );

drop policy if exists live_shorts_update_own on public.live_shorts;
create policy live_shorts_update_own
  on public.live_shorts for update to authenticated
  using (creator_id = public.talk_current_user_id())
  with check (creator_id = public.talk_current_user_id());

drop policy if exists live_shorts_delete_own on public.live_shorts;
create policy live_shorts_delete_own
  on public.live_shorts for delete to authenticated
  using (creator_id = public.talk_current_user_id());

drop policy if exists live_shorts_admin_all on public.live_shorts;
create policy live_shorts_admin_all
  on public.live_shorts for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_short_likes
-- ---------------------------------------------------------------------------

drop policy if exists live_short_likes_select_published on public.live_short_likes;
create policy live_short_likes_select_published
  on public.live_short_likes for select to authenticated
  using (
    exists (
      select 1
      from public.live_shorts s
      where s.id = short_id
        and s.status = 'published'
        and public.live_is_public_creator(s.creator_id)
    )
  );

drop policy if exists live_short_likes_select_own on public.live_short_likes;
create policy live_short_likes_select_own
  on public.live_short_likes for select to authenticated
  using (user_id = public.talk_current_user_id());

drop policy if exists live_short_likes_insert_own on public.live_short_likes;
create policy live_short_likes_insert_own
  on public.live_short_likes for insert to authenticated
  with check (
    user_id = public.talk_current_user_id()
    and exists (
      select 1
      from public.live_shorts s
      where s.id = short_id
        and s.status = 'published'
    )
  );

drop policy if exists live_short_likes_delete_own on public.live_short_likes;
create policy live_short_likes_delete_own
  on public.live_short_likes for delete to authenticated
  using (user_id = public.talk_current_user_id());

drop policy if exists live_short_likes_admin_all on public.live_short_likes;
create policy live_short_likes_admin_all
  on public.live_short_likes for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_broadcasts
-- ---------------------------------------------------------------------------

drop policy if exists live_broadcasts_select_public on public.live_broadcasts;
create policy live_broadcasts_select_public
  on public.live_broadcasts for select to authenticated
  using (
    status in ('live', 'ended')
    and public.live_is_public_creator(creator_id)
  );

drop policy if exists live_broadcasts_select_own on public.live_broadcasts;
create policy live_broadcasts_select_own
  on public.live_broadcasts for select to authenticated
  using (creator_id = public.talk_current_user_id());

drop policy if exists live_broadcasts_insert_own on public.live_broadcasts;
create policy live_broadcasts_insert_own
  on public.live_broadcasts for insert to authenticated
  with check (
    creator_id = public.talk_current_user_id()
    and public.live_has_broadcast_permission(creator_id)
  );

drop policy if exists live_broadcasts_update_own on public.live_broadcasts;
create policy live_broadcasts_update_own
  on public.live_broadcasts for update to authenticated
  using (creator_id = public.talk_current_user_id())
  with check (creator_id = public.talk_current_user_id());

drop policy if exists live_broadcasts_admin_all on public.live_broadcasts;
create policy live_broadcasts_admin_all
  on public.live_broadcasts for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_broadcast_messages
-- ---------------------------------------------------------------------------

drop policy if exists live_broadcast_messages_select_public on public.live_broadcast_messages;
create policy live_broadcast_messages_select_public
  on public.live_broadcast_messages for select to authenticated
  using (public.live_broadcast_is_publicly_viewable(broadcast_id));

drop policy if exists live_broadcast_messages_insert_auth on public.live_broadcast_messages;
create policy live_broadcast_messages_insert_auth
  on public.live_broadcast_messages for insert to authenticated
  with check (
    sender_id = public.talk_current_user_id()
    and exists (
      select 1
      from public.live_broadcasts b
      where b.id = broadcast_id
        and b.status = 'live'
    )
  );

drop policy if exists live_broadcast_messages_delete_own on public.live_broadcast_messages;
create policy live_broadcast_messages_delete_own
  on public.live_broadcast_messages for delete to authenticated
  using (sender_id = public.talk_current_user_id());

drop policy if exists live_broadcast_messages_admin_all on public.live_broadcast_messages;
create policy live_broadcast_messages_admin_all
  on public.live_broadcast_messages for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_creator_follows
-- ---------------------------------------------------------------------------

drop policy if exists live_creator_follows_select_own on public.live_creator_follows;
create policy live_creator_follows_select_own
  on public.live_creator_follows for select to authenticated
  using (follower_id = public.talk_current_user_id());

drop policy if exists live_creator_follows_insert_own on public.live_creator_follows;
create policy live_creator_follows_insert_own
  on public.live_creator_follows for insert to authenticated
  with check (
    follower_id = public.talk_current_user_id()
    and follower_id <> creator_id
    and public.live_is_public_creator(creator_id)
  );

drop policy if exists live_creator_follows_delete_own on public.live_creator_follows;
create policy live_creator_follows_delete_own
  on public.live_creator_follows for delete to authenticated
  using (follower_id = public.talk_current_user_id());

drop policy if exists live_creator_follows_admin_all on public.live_creator_follows;
create policy live_creator_follows_admin_all
  on public.live_creator_follows for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_tips (no client UPDATE)
-- ---------------------------------------------------------------------------

drop policy if exists live_tips_select_sender on public.live_tips;
create policy live_tips_select_sender
  on public.live_tips for select to authenticated
  using (tipper_id = public.talk_current_user_id());

drop policy if exists live_tips_select_creator on public.live_tips;
create policy live_tips_select_creator
  on public.live_tips for select to authenticated
  using (creator_id = public.talk_current_user_id());

drop policy if exists live_tips_insert_auth on public.live_tips;
create policy live_tips_insert_auth
  on public.live_tips for insert to authenticated
  with check (
    tipper_id = public.talk_current_user_id()
    and payment_status in ('stub', 'pending')
  );

drop policy if exists live_tips_admin_all on public.live_tips;
create policy live_tips_admin_all
  on public.live_tips for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_moderation_logs (ops/admin only)
-- ---------------------------------------------------------------------------

drop policy if exists live_moderation_logs_admin_all on public.live_moderation_logs;
create policy live_moderation_logs_admin_all
  on public.live_moderation_logs for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_notify_dedupe (service_role + admin)
-- ---------------------------------------------------------------------------

drop policy if exists live_notify_dedupe_admin_all on public.live_notify_dedupe;
create policy live_notify_dedupe_admin_all
  on public.live_notify_dedupe for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- Storage buckets (P0)
-- Path convention: {talk_user_id}/{asset_id}.{ext}
-- Signed URL TTL: 300 seconds (Edge · not enforced in SQL)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'short-videos',
  'short-videos',
  false,
  83886080,
  array['video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'short-video-thumbnails',
  'short-video-thumbnails',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'live-avatars',
  'live-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'live-thumbnails',
  'live-thumbnails',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- P0: live-archives bucket NOT created (P1 VOD)
-- insert into storage.buckets (id, name, public) values ('live-archives', 'live-archives', false);

-- ---------------------------------------------------------------------------
-- Storage policies: short-videos (private · owner scoped)
-- ---------------------------------------------------------------------------

drop policy if exists live_storage_short_videos_select_own on storage.objects;
create policy live_storage_short_videos_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'short-videos'
    and public.live_storage_owner_matches(name)
  );

drop policy if exists live_storage_short_videos_insert_own on storage.objects;
create policy live_storage_short_videos_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'short-videos'
    and public.live_storage_owner_matches(name)
    and public.live_has_broadcast_permission()
  );

drop policy if exists live_storage_short_videos_update_own on storage.objects;
create policy live_storage_short_videos_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'short-videos'
    and public.live_storage_owner_matches(name)
  )
  with check (
    bucket_id = 'short-videos'
    and public.live_storage_owner_matches(name)
  );

drop policy if exists live_storage_short_videos_delete_own on storage.objects;
create policy live_storage_short_videos_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'short-videos'
    and public.live_storage_owner_matches(name)
  );

-- ---------------------------------------------------------------------------
-- Storage policies: short-video-thumbnails (private · owner scoped)
-- ---------------------------------------------------------------------------

drop policy if exists live_storage_short_thumbs_select_own on storage.objects;
create policy live_storage_short_thumbs_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'short-video-thumbnails'
    and public.live_storage_owner_matches(name)
  );

drop policy if exists live_storage_short_thumbs_insert_own on storage.objects;
create policy live_storage_short_thumbs_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'short-video-thumbnails'
    and public.live_storage_owner_matches(name)
    and public.live_has_broadcast_permission()
  );

drop policy if exists live_storage_short_thumbs_update_own on storage.objects;
create policy live_storage_short_thumbs_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'short-video-thumbnails'
    and public.live_storage_owner_matches(name)
  )
  with check (
    bucket_id = 'short-video-thumbnails'
    and public.live_storage_owner_matches(name)
  );

drop policy if exists live_storage_short_thumbs_delete_own on storage.objects;
create policy live_storage_short_thumbs_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'short-video-thumbnails'
    and public.live_storage_owner_matches(name)
  );

-- ---------------------------------------------------------------------------
-- Storage policies: live-avatars (public read · owner write)
-- ---------------------------------------------------------------------------

drop policy if exists live_storage_live_avatars_select_public on storage.objects;
create policy live_storage_live_avatars_select_public
  on storage.objects for select
  using (bucket_id = 'live-avatars');

drop policy if exists live_storage_live_avatars_insert_own on storage.objects;
create policy live_storage_live_avatars_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'live-avatars'
    and public.live_storage_owner_matches(name)
  );

drop policy if exists live_storage_live_avatars_update_own on storage.objects;
create policy live_storage_live_avatars_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'live-avatars'
    and public.live_storage_owner_matches(name)
  )
  with check (
    bucket_id = 'live-avatars'
    and public.live_storage_owner_matches(name)
  );

drop policy if exists live_storage_live_avatars_delete_own on storage.objects;
create policy live_storage_live_avatars_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'live-avatars'
    and public.live_storage_owner_matches(name)
  );

-- ---------------------------------------------------------------------------
-- Storage policies: live-thumbnails (public read · owner write)
-- ---------------------------------------------------------------------------

drop policy if exists live_storage_live_thumbnails_select_public on storage.objects;
create policy live_storage_live_thumbnails_select_public
  on storage.objects for select
  using (bucket_id = 'live-thumbnails');

drop policy if exists live_storage_live_thumbnails_insert_own on storage.objects;
create policy live_storage_live_thumbnails_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'live-thumbnails'
    and public.live_storage_owner_matches(name)
  );

drop policy if exists live_storage_live_thumbnails_update_own on storage.objects;
create policy live_storage_live_thumbnails_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'live-thumbnails'
    and public.live_storage_owner_matches(name)
  )
  with check (
    bucket_id = 'live-thumbnails'
    and public.live_storage_owner_matches(name)
  );

drop policy if exists live_storage_live_thumbnails_delete_own on storage.objects;
create policy live_storage_live_thumbnails_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'live-thumbnails'
    and public.live_storage_owner_matches(name)
  );

-- ---------------------------------------------------------------------------
-- Storage admin override (all LIVE buckets)
-- ---------------------------------------------------------------------------

drop policy if exists live_storage_admin_all on storage.objects;
create policy live_storage_admin_all
  on storage.objects for all to authenticated
  using (
    public.talk_is_admin()
    and bucket_id in (
      'short-videos',
      'short-video-thumbnails',
      'live-avatars',
      'live-thumbnails'
    )
  )
  with check (
    public.talk_is_admin()
    and bucket_id in (
      'short-videos',
      'short-video-thumbnails',
      'live-avatars',
      'live-thumbnails'
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime (manual · uncomment after apply on staging)
-- ---------------------------------------------------------------------------
-- alter publication supabase_realtime add table public.live_broadcast_messages;
