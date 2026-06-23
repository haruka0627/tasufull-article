-- P15-L1: MATCH schema extension (linked ref ddojquacsyqesrjhcvmn)
-- Prerequisite: 20260621160000_create_match_schema.sql + 20260621170000_match_rls_d2.sql
-- Ref: reports/tasful-match-p15-l1-migration-draft.md
--
-- Scope:
--   - New: match_hobby_tags, match_profile_hobby_tags, match_favorites,
--          match_profile_views, match_saved_searches, match_user_settings
--   - Alter: match_profiles ADD COLUMN only (last_active_at unchanged from L10)
--   - Functions + match_profiles_public VIEW (activity_label only; no raw timestamp)
--   - NO auth.users / Hook changes · NO changes to existing 8-table RLS policies
--   - NO AI features (TASFUL AI CTA uses UI links; DB is profile/completeness foundation only)
--
-- Apply order: this file BEFORE 20260622191000_match_p15_l1_rls.sql
--
-- ROLLBACK (manual · staging only · PITR disabled):
--   1) Apply 20260622191000 rollback block first (RLS/policies)
--   2) Then run ROLLBACK block at bottom of this file
--   3) Re-run sql/match-p15-l1-pre-gates.sql expectations (p15_table_count=0)

-- ---------------------------------------------------------------------------
-- A. Hobby master (completeness / compatibility / VIEW / saved search filters)
-- ---------------------------------------------------------------------------

create table if not exists public.match_hobby_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label_ja text not null,
  display_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_hobby_tags_slug_key unique (slug)
);

create index if not exists match_hobby_tags_active_order_idx
  on public.match_hobby_tags (is_active, display_order);

drop trigger if exists match_hobby_tags_set_updated_at on public.match_hobby_tags;
create trigger match_hobby_tags_set_updated_at
  before update on public.match_hobby_tags
  for each row execute function public.match_set_updated_at();

create table if not exists public.match_profile_hobby_tags (
  profile_id uuid not null references public.match_profiles (id) on delete cascade,
  hobby_tag_id uuid not null references public.match_hobby_tags (id) on delete restrict,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (profile_id, hobby_tag_id),
  constraint match_profile_hobby_tags_display_order_check check (
    display_order between 0 and 4
  )
);

create index if not exists match_profile_hobby_tags_hobby_tag_id_idx
  on public.match_profile_hobby_tags (hobby_tag_id);

insert into public.match_hobby_tags (slug, label_ja, display_order)
values
  ('travel', '旅行', 10),
  ('cooking', '料理', 20),
  ('sports', 'スポーツ', 30),
  ('music', '音楽', 40),
  ('movies', '映画', 50)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- B. match_profiles extension (last_active_at exists from L10 — do not ADD)
-- ---------------------------------------------------------------------------

alter table public.match_profiles
  add column if not exists purpose text,
  add column if not exists relationship_view text,
  add column if not exists weekend_style text,
  add column if not exists completeness_cached smallint;

alter table public.match_profiles
  drop constraint if exists match_profiles_purpose_check;

alter table public.match_profiles
  add constraint match_profiles_purpose_check check (
    purpose is null or purpose in ('love', 'marriage', 'friend', 'undecided')
  );

alter table public.match_profiles
  drop constraint if exists match_profiles_relationship_view_length_check;

alter table public.match_profiles
  add constraint match_profiles_relationship_view_length_check check (
    relationship_view is null or char_length(relationship_view) <= 500
  );

alter table public.match_profiles
  drop constraint if exists match_profiles_weekend_style_length_check;

alter table public.match_profiles
  add constraint match_profiles_weekend_style_length_check check (
    weekend_style is null or char_length(weekend_style) <= 120
  );

alter table public.match_profiles
  drop constraint if exists match_profiles_completeness_cached_check;

alter table public.match_profiles
  add constraint match_profiles_completeness_cached_check check (
    completeness_cached is null
    or completeness_cached between 0 and 100
  );

create index if not exists match_profiles_purpose_active_idx
  on public.match_profiles (purpose, profile_status)
  where archived_at is null and profile_status = 'active';

-- ---------------------------------------------------------------------------
-- C. P15 core tables
-- ---------------------------------------------------------------------------

create table if not exists public.match_favorites (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  target_user_id text not null,
  source text not null default 'profile',
  note text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint match_favorites_not_self_check check (owner_user_id <> target_user_id),
  constraint match_favorites_source_check check (
    source in ('swipe', 'profile', 'search')
  ),
  constraint match_favorites_note_length_check check (
    note is null or char_length(note) <= 200
  )
);

create unique index if not exists match_favorites_owner_target_active_uidx
  on public.match_favorites (owner_user_id, target_user_id)
  where archived_at is null;

create index if not exists match_favorites_owner_created_idx
  on public.match_favorites (owner_user_id, created_at desc)
  where archived_at is null;

create table if not exists public.match_profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id text not null,
  viewed_user_id text not null,
  source text not null default 'profile_detail',
  viewed_at timestamptz not null default now(),
  dedupe_bucket date not null default (timezone('Asia/Tokyo', now()))::date,
  constraint match_profile_views_not_self_check check (
    viewer_user_id <> viewed_user_id
  ),
  constraint match_profile_views_source_check check (
    source in ('swipe_card', 'profile_detail', 'favorites')
  )
);

create unique index if not exists match_profile_views_dedupe_uidx
  on public.match_profile_views (viewer_user_id, viewed_user_id, dedupe_bucket);

create index if not exists match_profile_views_viewed_at_idx
  on public.match_profile_views (viewed_user_id, viewed_at desc);

create index if not exists match_profile_views_viewer_at_idx
  on public.match_profile_views (viewer_user_id, viewed_at desc);

create table if not exists public.match_saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  filters_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  last_used_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_saved_searches_name_length_check check (
    char_length(name) between 1 and 40
  ),
  constraint match_saved_searches_filters_object_check check (
    jsonb_typeof(filters_json) = 'object'
  )
);

create index if not exists match_saved_searches_user_idx
  on public.match_saved_searches (user_id, updated_at desc)
  where archived_at is null;

create unique index if not exists match_saved_searches_one_default_uidx
  on public.match_saved_searches (user_id)
  where is_default = true and archived_at is null;

drop trigger if exists match_saved_searches_set_updated_at on public.match_saved_searches;
create trigger match_saved_searches_set_updated_at
  before update on public.match_saved_searches
  for each row execute function public.match_set_updated_at();

create table if not exists public.match_user_settings (
  user_id text primary key,
  show_activity_status boolean not null default true,
  show_footprints_to_others boolean not null default true,
  receive_footprint_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists match_user_settings_set_updated_at on public.match_user_settings;
create trigger match_user_settings_set_updated_at
  before update on public.match_user_settings
  for each row execute function public.match_set_updated_at();

comment on table public.match_favorites is
  'P15: pre-match bookmarks (distinct from match_swipes.like).';
comment on table public.match_profile_views is
  'P15: profile footprints · daily dedupe via dedupe_bucket (JST).';
comment on table public.match_saved_searches is
  'P15: saved discovery filters (filters_json).';
comment on table public.match_user_settings is
  'P15: privacy toggles for activity/footprints.';

-- ---------------------------------------------------------------------------
-- D. Helper functions (rule-based · no AI)
-- ---------------------------------------------------------------------------

create or replace function public.match_has_active_match_ban(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- P15-L1 stub: replace when match_sanctions ships.
  select false;
$$;

comment on function public.match_has_active_match_ban(text) is
  'P15-L1 stub returns false until match_sanctions exists.';

create or replace function public.match_activity_label(p_last_active_at timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_last_active_at is null then 'しばらく未活動'
    when p_last_active_at >= now() - interval '24 hours' then '24時間以内に活動'
    when p_last_active_at >= now() - interval '3 days' then '3日以内に活動'
    when p_last_active_at >= now() - interval '7 days' then '1週間以内に活動'
    else 'しばらく未活動'
  end;
$$;

comment on function public.match_activity_label(timestamptz) is
  'P15: fuzzy activity bucket. No online-now label.';

create or replace function public.match_footprint_label(p_viewed_at timestamptz)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_viewed date;
  v_today date;
  v_diff integer;
begin
  if p_viewed_at is null then
    return '不明';
  end if;
  v_viewed := (p_viewed_at at time zone 'Asia/Tokyo')::date;
  v_today := (timezone('Asia/Tokyo', now()))::date;
  v_diff := v_today - v_viewed;
  if v_diff = 0 then
    return '今日';
  elsif v_diff = 1 then
    return '昨日';
  elsif v_diff < 7 then
    return v_diff || '日前';
  else
    return '1週間以上前';
  end if;
end;
$$;

comment on function public.match_footprint_label(timestamptz) is
  'P15: fuzzy footprint time label (JST).';

create or replace function public.match_prefecture_compat_score(p_pref_a text, p_pref_b text)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  a text := nullif(trim(p_pref_a), '');
  b text := nullif(trim(p_pref_b), '');
begin
  if a is null or b is null then
    return 0;
  end if;
  if a = b then
    return 15;
  end if;
  if (a, b) in (
    ('東京都', '神奈川県'), ('神奈川県', '東京都'),
    ('東京都', '埼玉県'), ('埼玉県', '東京都'),
    ('東京都', '千葉県'), ('千葉県', '東京都'),
    ('神奈川県', '埼玉県'), ('埼玉県', '神奈川県'),
    ('神奈川県', '千葉県'), ('千葉県', '神奈川県'),
    ('埼玉県', '千葉県'), ('千葉県', '埼玉県')
  ) then
    return 8;
  end if;
  return 0;
end;
$$;

create or replace function public.match_profile_completeness(p_user_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.match_profiles%rowtype;
  v_photo_ok boolean := false;
  v_hobby_count integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_done integer := 0;
  v_total constant integer := 8;
  v_percent integer;
begin
  select * into v_profile
  from public.match_profiles p
  where p.user_id = p_user_id
    and p.archived_at is null
  limit 1;

  if not found then
    return jsonb_build_object(
      'percent', 0,
      'items', '[]'::jsonb,
      'code', 'profile_not_found'
    );
  end if;

  select exists (
    select 1
    from public.match_profile_photos ph
    where ph.profile_id = v_profile.id
      and ph.photo_status = 'active'
      and ph.archived_at is null
      and ph.moderation_status = 'approved'
  ) into v_photo_ok;

  select count(*)::integer into v_hobby_count
  from public.match_profile_hobby_tags pht
  where pht.profile_id = v_profile.id;

  v_items := v_items || jsonb_build_object('key', 'photo', 'label', '写真', 'done', v_photo_ok, 'weight', 20);
  v_items := v_items || jsonb_build_object('key', 'bio', 'label', '自己紹介', 'done', coalesce(length(trim(v_profile.bio)), 0) > 0, 'weight', 15);
  v_items := v_items || jsonb_build_object('key', 'age', 'label', '年齢', 'done', v_profile.birth_date is not null, 'weight', 10);
  v_items := v_items || jsonb_build_object('key', 'region', 'label', '地域', 'done', coalesce(length(trim(v_profile.prefecture)), 0) > 0, 'weight', 10);
  v_items := v_items || jsonb_build_object('key', 'hobby', 'label', '趣味', 'done', v_hobby_count >= 1, 'weight', 15);
  v_items := v_items || jsonb_build_object('key', 'purpose', 'label', '目的', 'done', v_profile.purpose is not null, 'weight', 10);
  v_items := v_items || jsonb_build_object('key', 'relationship_view', 'label', '恋愛観', 'done', coalesce(length(trim(v_profile.relationship_view)), 0) > 0, 'weight', 10);
  v_items := v_items || jsonb_build_object('key', 'verification', 'label', '本人確認', 'done', v_profile.verification_status in ('verified', 'phone_verified'), 'weight', 10);

  select count(*)::integer into v_done
  from jsonb_array_elements(v_items) elem
  where (elem->>'done')::boolean;

  v_percent := round((v_done::numeric / v_total) * 100)::integer;

  return jsonb_build_object(
    'percent', v_percent,
    'items', v_items,
    'done_count', v_done,
    'total_count', v_total
  );
end;
$$;

comment on function public.match_profile_completeness(text) is
  'P15: rule-based profile completeness for MATCH (not AI). TASFUL AI CTA uses UI layer.';

create or replace function public.match_compatibility_score(
  p_viewer_user_id text,
  p_target_user_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer public.match_profiles%rowtype;
  v_target public.match_profiles%rowtype;
  v_score integer := 0;
  v_hobby_matches integer := 0;
  v_age_diff integer;
  v_common jsonb := '[]'::jsonb;
  v_slug text;
  v_label text;
begin
  if p_viewer_user_id is null or p_target_user_id is null then
    return jsonb_build_object('percent', 0, 'common_points', '[]'::jsonb, 'code', 'invalid_user');
  end if;
  if p_viewer_user_id = p_target_user_id then
    return jsonb_build_object('percent', 0, 'common_points', '[]'::jsonb, 'code', 'self');
  end if;
  if public.match_users_are_blocked(p_viewer_user_id, p_target_user_id) then
    return jsonb_build_object('percent', 0, 'common_points', '[]'::jsonb, 'code', 'blocked');
  end if;

  select * into v_viewer
  from public.match_profiles
  where user_id = p_viewer_user_id and archived_at is null;

  select * into v_target
  from public.match_profiles
  where user_id = p_target_user_id and archived_at is null;

  if v_viewer.id is null or v_target.id is null then
    return jsonb_build_object('percent', 0, 'common_points', '[]'::jsonb, 'code', 'profile_not_found');
  end if;

  select least(count(*)::integer, 3) into v_hobby_matches
  from public.match_profile_hobby_tags vh
  inner join public.match_profile_hobby_tags th
    on th.hobby_tag_id = vh.hobby_tag_id
  where vh.profile_id = v_viewer.id
    and th.profile_id = v_target.id;

  if v_hobby_matches > 0 then
    v_score := v_score + (v_hobby_matches * 12);
    for v_slug, v_label in
      select ht.slug, ht.label_ja
      from public.match_profile_hobby_tags vh
      inner join public.match_profile_hobby_tags th on th.hobby_tag_id = vh.hobby_tag_id
      inner join public.match_hobby_tags ht on ht.id = vh.hobby_tag_id
      where vh.profile_id = v_viewer.id and th.profile_id = v_target.id
      order by ht.display_order
      limit 3
    loop
      v_common := v_common || jsonb_build_object('key', 'hobby:' || v_slug, 'label', '趣味: ' || v_label);
    end loop;
  end if;

  if v_viewer.purpose is not null and v_viewer.purpose = v_target.purpose then
    v_score := v_score + 20;
    v_common := v_common || jsonb_build_object('key', 'purpose', 'label', '目的が同じ');
  end if;

  v_score := v_score + public.match_prefecture_compat_score(v_viewer.prefecture, v_target.prefecture);
  if v_viewer.prefecture is not null and v_viewer.prefecture = v_target.prefecture then
    v_common := v_common || jsonb_build_object('key', 'prefecture', 'label', '同じ都道府県');
  end if;

  if coalesce(trim(v_viewer.weekend_style), '') <> ''
     and trim(v_viewer.weekend_style) = trim(v_target.weekend_style) then
    v_score := v_score + 10;
    v_common := v_common || jsonb_build_object('key', 'weekend', 'label', '休日の過ごし方が同じ');
  end if;

  if coalesce(trim(v_viewer.relationship_view), '') <> ''
     and trim(v_viewer.relationship_view) = trim(v_target.relationship_view) then
    v_score := v_score + 15;
    v_common := v_common || jsonb_build_object('key', 'relationship_view', 'label', '恋愛観が同じ');
  end if;

  v_age_diff := abs(
    extract(year from age(current_date, v_viewer.birth_date))
    - extract(year from age(current_date, v_target.birth_date))
  )::integer;

  if v_age_diff <= 3 then
    v_score := v_score + 10;
  elsif v_age_diff <= 7 then
    v_score := v_score + 5;
  end if;

  return jsonb_build_object(
    'percent', least(99, v_score),
    'score_raw', v_score,
    'common_points', v_common,
    'common_count', jsonb_array_length(v_common)
  );
end;
$$;

comment on function public.match_compatibility_score(text, text) is
  'P15: rule-based compatibility (not AI). Detail analysis via TASFUL AI CTA.';

-- ---------------------------------------------------------------------------
-- E. Public discovery VIEW (L11 D2 · talk_user_id · no raw last_active_at)
-- ---------------------------------------------------------------------------

create or replace view public.match_profiles_public
with (security_invoker = false)
as
select
  p.id as profile_id,
  p.user_id,
  p.nickname as display_name,
  extract(year from age(current_date, p.birth_date))::integer as age,
  p.prefecture,
  p.city,
  p.bio,
  p.purpose,
  p.weekend_style,
  p.relationship_view,
  p.verification_status,
  ph.storage_path as main_photo_url,
  coalesce(
    (
      select array_agg(ht.label_ja order by pht.display_order)
      from public.match_profile_hobby_tags pht
      inner join public.match_hobby_tags ht on ht.id = pht.hobby_tag_id
      where pht.profile_id = p.id and ht.is_active = true
    ),
    '{}'::text[]
  ) as hobby_tags,
  case
    when coalesce(us.show_activity_status, true) = false then null
    else public.match_activity_label(p.last_active_at)
  end as activity_label,
  p.created_at
from public.match_profiles p
left join public.match_profile_photos ph
  on ph.id = p.main_photo_id
  and ph.photo_status = 'active'
  and ph.archived_at is null
  and ph.moderation_status = 'approved'
left join public.match_user_settings us
  on us.user_id = p.user_id
where p.profile_status = 'active'
  and p.archived_at is null
  and not public.match_has_active_match_ban(p.user_id)
  and public.match_current_user_id() is not null
  and p.user_id <> public.match_current_user_id()
  and not public.match_users_are_blocked(
    public.match_current_user_id(),
    p.user_id
  );

comment on view public.match_profiles_public is
  'P15: discoverable profiles. activity_label only (no raw last_active_at). D2 talk_user_id.';

revoke all on public.match_profiles_public from public;
grant select on public.match_profiles_public to authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK (run after 20260622191000 RLS rollback · manual staging only)
-- ---------------------------------------------------------------------------
-- drop view if exists public.match_profiles_public;
-- drop function if exists public.match_compatibility_score(text, text);
-- drop function if exists public.match_profile_completeness(text);
-- drop function if exists public.match_prefecture_compat_score(text, text);
-- drop function if exists public.match_footprint_label(timestamptz);
-- drop function if exists public.match_activity_label(timestamptz);
-- drop function if exists public.match_has_active_match_ban(text);
-- drop table if exists public.match_user_settings;
-- drop table if exists public.match_saved_searches;
-- drop table if exists public.match_profile_views;
-- drop table if exists public.match_favorites;
-- drop table if exists public.match_profile_hobby_tags;
-- drop table if exists public.match_hobby_tags;
-- alter table public.match_profiles
--   drop column if exists completeness_cached,
--   drop column if exists weekend_style,
--   drop column if exists relationship_view,
--   drop column if exists purpose;
-- Verify: core 8 tables · core_policy_count=20 · legacy_user_count=7 · allowlist_backfill_count=5
