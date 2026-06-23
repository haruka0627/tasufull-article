-- TASFUL LIVE → YouTube型 P1 — long-form videos schema
-- Ref: reports/talk-youtube-conversion-p1-plan.md
-- Ref: reports/talk-youtube-phase0-5-env-check.md
--
-- Prerequisite:
--   - sql/talk-rls-production.sql (talk_current_user_id / talk_is_admin)
--   - supabase/migrations/20260628100000_live_p0_schema.sql (applied on staging)
--
-- Apply: staging only · individual SQL (NOT supabase db push)
--   npx supabase db query --linked -f supabase/migrations/20260701100000_live_videos_p1.sql
--
-- NOTE: talk_user_id columns use text (e.g. 'u_me') to match existing live_* tables.
-- MATCH / Marketplace / Builder / existing live_*: no ALTER

-- ---------------------------------------------------------------------------
-- T-10 live_videos
-- ---------------------------------------------------------------------------

create table if not exists public.live_videos (
  id uuid primary key default gen_random_uuid(),
  talk_user_id text not null,
  creator_profile_id text,
  title text not null,
  description text,
  video_path text not null,
  thumbnail_path text,
  duration_sec integer,
  file_size_bytes bigint,
  mime_type text,
  status text not null default 'draft',
  visibility text not null default 'public',
  views_count bigint not null default 0,
  likes_count bigint not null default 0,
  reports_count bigint not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_videos_creator_profile_fk
    foreign key (creator_profile_id) references public.live_creator_profiles (user_id)
    on delete set null,
  constraint live_videos_title_len_chk
    check (char_length(title) >= 1 and char_length(title) <= 120),
  constraint live_videos_description_len_chk
    check (description is null or char_length(description) <= 5000),
  constraint live_videos_video_path_nonempty_chk
    check (char_length(btrim(video_path)) > 0),
  constraint live_videos_status_chk
    check (status in ('draft', 'processing', 'published', 'hidden', 'removed')),
  constraint live_videos_visibility_chk
    check (visibility in ('public', 'unlisted', 'private')),
  constraint live_videos_duration_sec_chk
    check (duration_sec is null or duration_sec > 60),
  constraint live_videos_views_count_chk
    check (views_count >= 0),
  constraint live_videos_likes_count_chk
    check (likes_count >= 0),
  constraint live_videos_reports_count_chk
    check (reports_count >= 0),
  constraint live_videos_file_size_bytes_chk
    check (file_size_bytes is null or file_size_bytes >= 0)
);

comment on table public.live_videos is
  'TASFUL LIVE long-form videos · bucket live-videos · duration > 60s when set';
comment on column public.live_videos.talk_user_id is
  'Owner talk_user_id (text · same as live_shorts.creator_id)';
comment on column public.live_videos.creator_profile_id is
  'Optional FK to live_creator_profiles.user_id';
comment on column public.live_videos.video_path is
  'Object path in live-videos bucket · {talk_user_id}/{video_id}.mp4';
comment on column public.live_videos.thumbnail_path is
  'Thumbnail path · live-thumbnails or live-videos bucket';
comment on column public.live_videos.duration_sec is
  'Long-form only: null allowed for draft · must be > 60 when set (not shorts)';

create index if not exists live_videos_feed_idx
  on public.live_videos (status, visibility, published_at desc);

create index if not exists live_videos_talk_user_created_idx
  on public.live_videos (talk_user_id, created_at desc);

create index if not exists live_videos_creator_profile_created_idx
  on public.live_videos (creator_profile_id, created_at desc)
  where creator_profile_id is not null;

create index if not exists live_videos_public_feed_idx
  on public.live_videos (published_at desc)
  where status = 'published' and visibility = 'public';

-- ---------------------------------------------------------------------------
-- T-11 live_video_likes
-- ---------------------------------------------------------------------------

create table if not exists public.live_video_likes (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.live_videos (id) on delete cascade,
  talk_user_id text not null,
  created_at timestamptz not null default now(),
  constraint live_video_likes_video_user_uniq unique (video_id, talk_user_id)
);

comment on table public.live_video_likes is
  'TASFUL LIVE long-form video likes · one row per user per video';

create index if not exists live_video_likes_video_id_idx
  on public.live_video_likes (video_id);

create index if not exists live_video_likes_user_created_idx
  on public.live_video_likes (talk_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- T-12 live_video_reports
-- ---------------------------------------------------------------------------

create table if not exists public.live_video_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.live_videos (id) on delete cascade,
  reporter_talk_user_id text not null,
  reason text not null,
  detail text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  constraint live_video_reports_reason_chk
    check (reason in ('spam', 'abuse', 'copyright', 'illegal', 'other')),
  constraint live_video_reports_status_chk
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint live_video_reports_detail_len_chk
    check (detail is null or char_length(detail) <= 2000)
);

comment on table public.live_video_reports is
  'TASFUL LIVE long-form video reports · admin review';

create index if not exists live_video_reports_status_created_idx
  on public.live_video_reports (status, created_at desc);

create index if not exists live_video_reports_video_id_idx
  on public.live_video_reports (video_id);

-- ---------------------------------------------------------------------------
-- T-13 live_video_ads (P1 minimal manual slots)
-- ---------------------------------------------------------------------------

create table if not exists public.live_video_ads (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.live_videos (id) on delete cascade,
  ad_type text not null default 'manual',
  position_sec integer,
  label text,
  target_url text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint live_video_ads_ad_type_chk
    check (ad_type in ('manual', 'pre_roll', 'mid_roll', 'overlay')),
  constraint live_video_ads_position_sec_chk
    check (position_sec is null or position_sec >= 0),
  constraint live_video_ads_label_len_chk
    check (label is null or char_length(label) <= 120)
);

comment on table public.live_video_ads is
  'P1 minimal per-video ad slots · manual registration only · no bidding';

create index if not exists live_video_ads_video_active_idx
  on public.live_video_ads (video_id, is_active);

-- ---------------------------------------------------------------------------
-- Grants (RLS enforced)
-- ---------------------------------------------------------------------------

grant select on public.live_videos to anon, authenticated;
grant insert, update, delete on public.live_videos to authenticated;

grant select, insert, delete on public.live_video_likes to authenticated;

grant select, insert on public.live_video_reports to authenticated;
grant update on public.live_video_reports to authenticated;

grant select, insert, update, delete on public.live_video_ads to authenticated;

revoke all on public.live_video_likes from anon;
revoke all on public.live_video_reports from anon;
revoke all on public.live_video_ads from anon;
revoke insert, update, delete on public.live_videos from anon;

grant select, insert, update, delete on public.live_videos to service_role;
grant select, insert, update, delete on public.live_video_likes to service_role;
grant select, insert, update, delete on public.live_video_reports to service_role;
grant select, insert, update, delete on public.live_video_ads to service_role;

-- ---------------------------------------------------------------------------
-- RLS enable
-- ---------------------------------------------------------------------------

alter table public.live_videos enable row level security;
alter table public.live_video_likes enable row level security;
alter table public.live_video_reports enable row level security;
alter table public.live_video_ads enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions (view gates · count refresh)
-- ---------------------------------------------------------------------------

create or replace function public.live_video_is_publicly_viewable(p_video_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.live_videos v
    where v.id = p_video_id
      and v.status = 'published'
      and v.visibility in ('public', 'unlisted')
      and public.live_is_public_creator(v.talk_user_id)
  );
$$;

comment on function public.live_video_is_publicly_viewable(uuid) is
  'True when long-form video is published and viewable via direct URL (public or unlisted)';

create or replace function public.live_videos_guard_owner_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('live.internal_count_refresh', true), '') = '1' then
    return new;
  end if;

  if public.talk_is_admin() then
    return new;
  end if;

  if new.views_count is distinct from old.views_count
     or new.likes_count is distinct from old.likes_count
     or new.reports_count is distinct from old.reports_count
  then
    raise exception 'live_videos: forbidden counter update for non-admin';
  end if;

  return new;
end;
$$;

create or replace function public.live_refresh_video_like_count(p_video_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  perform public.live_internal_set_count_refresh();
  select count(*)::bigint into v_count
  from public.live_video_likes
  where video_id = p_video_id;

  update public.live_videos
  set likes_count = v_count
  where id = p_video_id;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.live_refresh_video_reports_count(p_video_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  perform public.live_internal_set_count_refresh();
  select count(*)::bigint into v_count
  from public.live_video_reports
  where video_id = p_video_id;

  update public.live_videos
  set reports_count = v_count
  where id = p_video_id;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.live_increment_video_views(p_video_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  perform public.live_internal_set_count_refresh();
  update public.live_videos
  set views_count = views_count + 1
  where id = p_video_id
  returning views_count into v_count;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.live_video_likes_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.live_refresh_video_like_count(coalesce(new.video_id, old.video_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.live_video_reports_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.live_refresh_video_reports_count(coalesce(new.video_id, old.video_id));
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists live_videos_set_updated_at on public.live_videos;
create trigger live_videos_set_updated_at
  before update on public.live_videos
  for each row execute function public.live_set_updated_at();

drop trigger if exists live_videos_guard_owner_update on public.live_videos;
create trigger live_videos_guard_owner_update
  before update on public.live_videos
  for each row execute function public.live_videos_guard_owner_update();

drop trigger if exists live_video_likes_refresh_count on public.live_video_likes;
create trigger live_video_likes_refresh_count
  after insert or delete on public.live_video_likes
  for each row execute function public.live_video_likes_count_trigger();

drop trigger if exists live_video_reports_refresh_count on public.live_video_reports;
create trigger live_video_reports_refresh_count
  after insert or delete on public.live_video_reports
  for each row execute function public.live_video_reports_count_trigger();

-- ---------------------------------------------------------------------------
-- RLS: live_videos
-- ---------------------------------------------------------------------------

drop policy if exists live_videos_select_public on public.live_videos;
create policy live_videos_select_public
  on public.live_videos for select to anon, authenticated
  using (
    status = 'published'
    and visibility in ('public', 'unlisted')
    and public.live_is_public_creator(talk_user_id)
  );

drop policy if exists live_videos_select_own on public.live_videos;
create policy live_videos_select_own
  on public.live_videos for select to authenticated
  using (talk_user_id = public.talk_current_user_id());

drop policy if exists live_videos_insert_own on public.live_videos;
create policy live_videos_insert_own
  on public.live_videos for insert to authenticated
  with check (
    talk_user_id = public.talk_current_user_id()
    and public.live_has_broadcast_permission(talk_user_id)
  );

drop policy if exists live_videos_update_own on public.live_videos;
create policy live_videos_update_own
  on public.live_videos for update to authenticated
  using (talk_user_id = public.talk_current_user_id())
  with check (talk_user_id = public.talk_current_user_id());

drop policy if exists live_videos_delete_own on public.live_videos;
create policy live_videos_delete_own
  on public.live_videos for delete to authenticated
  using (talk_user_id = public.talk_current_user_id());

drop policy if exists live_videos_admin_all on public.live_videos;
create policy live_videos_admin_all
  on public.live_videos for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_video_likes
-- ---------------------------------------------------------------------------

drop policy if exists live_video_likes_select_viewable on public.live_video_likes;
create policy live_video_likes_select_viewable
  on public.live_video_likes for select to authenticated
  using (
    talk_user_id = public.talk_current_user_id()
    or public.live_video_is_publicly_viewable(video_id)
    or exists (
      select 1
      from public.live_videos v
      where v.id = video_id
        and v.talk_user_id = public.talk_current_user_id()
    )
  );

drop policy if exists live_video_likes_insert_own on public.live_video_likes;
create policy live_video_likes_insert_own
  on public.live_video_likes for insert to authenticated
  with check (
    talk_user_id = public.talk_current_user_id()
    and public.live_video_is_publicly_viewable(video_id)
  );

drop policy if exists live_video_likes_delete_own on public.live_video_likes;
create policy live_video_likes_delete_own
  on public.live_video_likes for delete to authenticated
  using (talk_user_id = public.talk_current_user_id());

drop policy if exists live_video_likes_admin_all on public.live_video_likes;
create policy live_video_likes_admin_all
  on public.live_video_likes for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_video_reports
-- ---------------------------------------------------------------------------

drop policy if exists live_video_reports_insert_own on public.live_video_reports;
create policy live_video_reports_insert_own
  on public.live_video_reports for insert to authenticated
  with check (
    reporter_talk_user_id = public.talk_current_user_id()
    and public.live_video_is_publicly_viewable(video_id)
  );

drop policy if exists live_video_reports_select_own on public.live_video_reports;
create policy live_video_reports_select_own
  on public.live_video_reports for select to authenticated
  using (reporter_talk_user_id = public.talk_current_user_id());

drop policy if exists live_video_reports_admin_all on public.live_video_reports;
create policy live_video_reports_admin_all
  on public.live_video_reports for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- RLS: live_video_ads
-- ---------------------------------------------------------------------------

drop policy if exists live_video_ads_select_active on public.live_video_ads;
create policy live_video_ads_select_active
  on public.live_video_ads for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.live_videos v
      where v.id = video_id
        and v.status = 'published'
        and v.visibility in ('public', 'unlisted')
        and public.live_is_public_creator(v.talk_user_id)
    )
  );

drop policy if exists live_video_ads_select_own on public.live_video_ads;
create policy live_video_ads_select_own
  on public.live_video_ads for select to authenticated
  using (
    exists (
      select 1
      from public.live_videos v
      where v.id = video_id
        and v.talk_user_id = public.talk_current_user_id()
    )
  );

drop policy if exists live_video_ads_insert_own on public.live_video_ads;
create policy live_video_ads_insert_own
  on public.live_video_ads for insert to authenticated
  with check (
    exists (
      select 1
      from public.live_videos v
      where v.id = video_id
        and v.talk_user_id = public.talk_current_user_id()
    )
  );

drop policy if exists live_video_ads_update_own on public.live_video_ads;
create policy live_video_ads_update_own
  on public.live_video_ads for update to authenticated
  using (
    exists (
      select 1
      from public.live_videos v
      where v.id = video_id
        and v.talk_user_id = public.talk_current_user_id()
    )
  )
  with check (
    exists (
      select 1
      from public.live_videos v
      where v.id = video_id
        and v.talk_user_id = public.talk_current_user_id()
    )
  );

drop policy if exists live_video_ads_delete_own on public.live_video_ads;
create policy live_video_ads_delete_own
  on public.live_video_ads for delete to authenticated
  using (
    exists (
      select 1
      from public.live_videos v
      where v.id = video_id
        and v.talk_user_id = public.talk_current_user_id()
    )
  );

drop policy if exists live_video_ads_admin_all on public.live_video_ads;
create policy live_video_ads_admin_all
  on public.live_video_ads for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

grant select on public.live_video_ads to anon;

-- ---------------------------------------------------------------------------
-- RPC grants
-- ---------------------------------------------------------------------------

grant execute on function public.live_refresh_video_like_count(uuid) to authenticated, service_role;
grant execute on function public.live_refresh_video_reports_count(uuid) to authenticated, service_role;
grant execute on function public.live_increment_video_views(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket: live-videos (private · signed URL via Edge Phase 2)
-- Path: {talk_user_id}/{video_id}.mp4
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'live-videos',
  'live-videos',
  false,
  2147483648,
  array['video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Storage policies: live-videos (private · owner scoped)
-- ---------------------------------------------------------------------------

drop policy if exists live_storage_live_videos_select_own on storage.objects;
create policy live_storage_live_videos_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'live-videos'
    and public.live_storage_owner_matches(name)
  );

drop policy if exists live_storage_live_videos_insert_own on storage.objects;
create policy live_storage_live_videos_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'live-videos'
    and public.live_storage_owner_matches(name)
    and public.live_has_broadcast_permission()
  );

drop policy if exists live_storage_live_videos_update_own on storage.objects;
create policy live_storage_live_videos_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'live-videos'
    and public.live_storage_owner_matches(name)
  )
  with check (
    bucket_id = 'live-videos'
    and public.live_storage_owner_matches(name)
  );

drop policy if exists live_storage_live_videos_delete_own on storage.objects;
create policy live_storage_live_videos_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'live-videos'
    and public.live_storage_owner_matches(name)
  );
