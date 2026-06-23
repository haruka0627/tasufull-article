-- TASFUL MATCH — schema draft (DDL only; do not apply without review)
-- Ref: reports/match-db-api-design-review.md
-- Decisions: D1 user_id text | D5 match room expires_at nullable (optional ALTER below)
--
-- RLS TODO: Enable RLS + policies in a follow-up migration after auth/JWT mapping is confirmed.
--   - match_profiles: owner full access; public read via security definer view only
--   - match_swipes / match_pairs: Edge Function (service_role) writes; participants read pairs
--   - match_blocks / match_reports: blocker/reporter scoped
--   - match_verifications / match_sanctions: owner read limited; admin via service_role
--   - match_moderation_logs: insert via Edge; select admin / own warnings only
--
-- alter table public.<table> enable row level security;

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.match_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. match_hobby_tags (master)
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

create trigger match_hobby_tags_set_updated_at
  before update on public.match_hobby_tags
  for each row execute function public.match_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. match_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.match_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  nickname text not null,
  gender text not null,
  birth_date date not null,
  prefecture text not null,
  city text,
  bio text,
  verification_status text not null default 'none',
  profile_status text not null default 'draft',
  main_photo_id uuid,
  last_active_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_profiles_user_id_key unique (user_id),
  constraint match_profiles_gender_check check (
    gender in ('male', 'female', 'other', 'private')
  ),
  constraint match_profiles_verification_status_check check (
    verification_status in ('none', 'phone_verified', 'pending', 'verified', 'rejected')
  ),
  constraint match_profiles_profile_status_check check (
    profile_status in ('draft', 'active', 'hidden', 'suspended')
  ),
  constraint match_profiles_nickname_length_check check (
    char_length(nickname) between 1 and 20
  ),
  constraint match_profiles_bio_length_check check (
    bio is null or char_length(bio) <= 500
  )
);

create index if not exists match_profiles_profile_verification_status_idx
  on public.match_profiles (profile_status, verification_status);

create index if not exists match_profiles_last_active_at_idx
  on public.match_profiles (last_active_at desc nulls last);

create index if not exists match_profiles_archived_at_idx
  on public.match_profiles (archived_at)
  where archived_at is null;

create trigger match_profiles_set_updated_at
  before update on public.match_profiles
  for each row execute function public.match_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. match_profile_photos
-- ---------------------------------------------------------------------------
create table if not exists public.match_profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.match_profiles (id) on delete cascade,
  storage_path text not null,
  display_order smallint not null default 0,
  moderation_status text not null default 'pending',
  moderation_reasons text[] not null default '{}'::text[],
  photo_status text not null default 'active',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_profile_photos_moderation_status_check check (
    moderation_status in ('pending', 'approved', 'rejected')
  ),
  constraint match_profile_photos_photo_status_check check (
    photo_status in ('active', 'archived')
  ),
  constraint match_profile_photos_display_order_check check (
    display_order between 0 and 9
  )
);

create index if not exists match_profile_photos_profile_order_idx
  on public.match_profile_photos (profile_id, display_order);

create unique index if not exists match_profile_photos_profile_display_order_active_uidx
  on public.match_profile_photos (profile_id, display_order)
  where photo_status = 'active' and archived_at is null;

create trigger match_profile_photos_set_updated_at
  before update on public.match_profile_photos
  for each row execute function public.match_set_updated_at();

alter table public.match_profiles
  add constraint match_profiles_main_photo_id_fkey
  foreign key (main_photo_id) references public.match_profile_photos (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. match_profile_hobby_tags (join)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5. match_swipes
-- ---------------------------------------------------------------------------
create table if not exists public.match_swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_user_id text not null,
  target_user_id text not null,
  action text not null,
  created_at timestamptz not null default now(),
  constraint match_swipes_swiper_target_key unique (swiper_user_id, target_user_id),
  constraint match_swipes_action_check check (action in ('like', 'skip')),
  constraint match_swipes_not_self_check check (swiper_user_id <> target_user_id)
);

create index if not exists match_swipes_swiper_created_at_idx
  on public.match_swipes (swiper_user_id, created_at desc);

create index if not exists match_swipes_target_action_idx
  on public.match_swipes (target_user_id, action);

-- ---------------------------------------------------------------------------
-- 6. match_pairs
-- ---------------------------------------------------------------------------
create table if not exists public.match_pairs (
  id uuid primary key default gen_random_uuid(),
  user_low_id text not null,
  user_high_id text not null,
  matched_at timestamptz not null default now(),
  talk_room_id uuid,
  status text not null default 'active',
  blocked_by_user_id text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_pairs_users_key unique (user_low_id, user_high_id),
  constraint match_pairs_user_order_check check (user_low_id < user_high_id),
  constraint match_pairs_status_check check (
    status in ('active', 'blocked', 'unmatched')
  ),
  constraint match_pairs_blocked_by_consistency_check check (
    (status = 'blocked' and blocked_by_user_id is not null)
    or (status <> 'blocked')
  )
);

create index if not exists match_pairs_user_low_idx
  on public.match_pairs (user_low_id, status, matched_at desc);

create index if not exists match_pairs_user_high_idx
  on public.match_pairs (user_high_id, status, matched_at desc);

create index if not exists match_pairs_talk_room_id_idx
  on public.match_pairs (talk_room_id)
  where talk_room_id is not null;

create index if not exists match_pairs_active_idx
  on public.match_pairs (status, matched_at desc)
  where archived_at is null;

create trigger match_pairs_set_updated_at
  before update on public.match_pairs
  for each row execute function public.match_set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. match_blocks
-- ---------------------------------------------------------------------------
create table if not exists public.match_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id text not null,
  blocked_user_id text not null,
  source text,
  match_pair_id uuid references public.match_pairs (id) on delete set null,
  block_status text not null default 'active',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_blocks_blocker_blocked_key unique (blocker_user_id, blocked_user_id),
  constraint match_blocks_not_self_check check (blocker_user_id <> blocked_user_id),
  constraint match_blocks_source_check check (
    source is null or source in ('swipe', 'profile', 'chat', 'report')
  ),
  constraint match_blocks_block_status_check check (
    block_status in ('active', 'archived')
  )
);

create index if not exists match_blocks_blocker_active_idx
  on public.match_blocks (blocker_user_id, created_at desc)
  where block_status = 'active' and archived_at is null;

create index if not exists match_blocks_blocked_active_idx
  on public.match_blocks (blocked_user_id)
  where block_status = 'active' and archived_at is null;

create trigger match_blocks_set_updated_at
  before update on public.match_blocks
  for each row execute function public.match_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. match_reports
-- ---------------------------------------------------------------------------
create table if not exists public.match_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id text not null,
  reported_user_id text not null,
  reason text not null,
  detail text,
  context_type text not null,
  context_id text,
  status text not null default 'open',
  moderation_log_ids uuid[] not null default '{}'::uuid[],
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_reports_not_self_check check (reporter_user_id <> reported_user_id),
  constraint match_reports_reason_check check (
    reason in ('inappropriate_message', 'impersonation', 'harassment', 'other')
  ),
  constraint match_reports_context_type_check check (
    context_type in ('profile', 'swipe', 'chat')
  ),
  constraint match_reports_status_check check (
    status in ('open', 'reviewing', 'resolved', 'dismissed')
  )
);

create index if not exists match_reports_reporter_created_at_idx
  on public.match_reports (reporter_user_id, created_at desc);

create index if not exists match_reports_reported_status_idx
  on public.match_reports (reported_user_id, status, created_at desc);

create index if not exists match_reports_status_created_at_idx
  on public.match_reports (status, created_at desc)
  where archived_at is null;

create trigger match_reports_set_updated_at
  before update on public.match_reports
  for each row execute function public.match_set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. match_verifications
-- ---------------------------------------------------------------------------
create table if not exists public.match_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  verification_type text not null,
  status text not null default 'pending',
  phone_hash text,
  phone_verified_at timestamptz,
  id_document_type text,
  id_document_storage_path text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  reject_reason text,
  provider text not null default 'manual',
  metadata_json jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_verifications_type_check check (
    verification_type in ('phone', 'identity_document', 'composite')
  ),
  constraint match_verifications_status_check check (
    status in (
      'pending',
      'phone_verified',
      'submitted',
      'under_review',
      'approved',
      'rejected'
    )
  ),
  constraint match_verifications_provider_check check (
    provider in ('manual', 'ekyc_vendor')
  ),
  constraint match_verifications_id_document_type_check check (
    id_document_type is null
    or id_document_type in (
      'drivers_license',
      'mynumber',
      'passport',
      'residence_card'
    )
  )
);

create index if not exists match_verifications_user_created_at_idx
  on public.match_verifications (user_id, created_at desc);

create index if not exists match_verifications_status_submitted_idx
  on public.match_verifications (status, submitted_at desc nulls last)
  where archived_at is null;

create trigger match_verifications_set_updated_at
  before update on public.match_verifications
  for each row execute function public.match_set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. match_sanctions (MATCH-scoped BAN)
-- ---------------------------------------------------------------------------
create table if not exists public.match_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  sanction_type text not null,
  scope text not null default 'match',
  reason_code text,
  reason_detail text,
  related_report_ids uuid[] not null default '{}'::uuid[],
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  created_by text not null default 'system',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_sanctions_type_check check (
    sanction_type in ('warning', 'feature_restrict', 'temporary_ban', 'permanent_ban')
  ),
  constraint match_sanctions_scope_check check (scope = 'match'),
  constraint match_sanctions_ends_after_starts_check check (
    ends_at is null or ends_at > starts_at
  )
);

create index if not exists match_sanctions_user_active_idx
  on public.match_sanctions (user_id, starts_at desc)
  where revoked_at is null and archived_at is null;

create index if not exists match_sanctions_active_window_idx
  on public.match_sanctions (starts_at, ends_at)
  where revoked_at is null and archived_at is null;

create trigger match_sanctions_set_updated_at
  before update on public.match_sanctions
  for each row execute function public.match_set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. match_moderation_logs
-- ---------------------------------------------------------------------------
create table if not exists public.match_moderation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  content_type text not null,
  content_ref text,
  input_text text,
  level text not null,
  reasons text[] not null default '{}'::text[],
  allowed boolean not null,
  engine text not null default 'rules',
  source_app text not null default 'match',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint match_moderation_logs_content_type_check check (
    content_type in ('profile_bio', 'profile_photo', 'chat_message')
  ),
  constraint match_moderation_logs_level_check check (
    level in ('ok', 'warning', 'blocked')
  ),
  constraint match_moderation_logs_engine_check check (
    engine in ('rules', 'ai')
  )
);

create index if not exists match_moderation_logs_user_created_at_idx
  on public.match_moderation_logs (user_id, created_at desc);

create index if not exists match_moderation_logs_level_created_at_idx
  on public.match_moderation_logs (level, created_at desc)
  where level in ('warning', 'blocked');

create index if not exists match_moderation_logs_content_ref_idx
  on public.match_moderation_logs (content_type, content_ref);

-- ---------------------------------------------------------------------------
-- 12. match_daily_limits
-- ---------------------------------------------------------------------------
create table if not exists public.match_daily_limits (
  user_id text not null,
  limit_date date not null,
  likes_used integer not null default 0,
  likes_quota integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, limit_date),
  constraint match_daily_limits_likes_used_check check (likes_used >= 0),
  constraint match_daily_limits_likes_quota_check check (likes_quota >= 0)
);

create trigger match_daily_limits_set_updated_at
  before update on public.match_daily_limits
  for each row execute function public.match_set_updated_at();

-- ---------------------------------------------------------------------------
-- Optional seed (dev / staging only — keep commented for draft migration)
-- ---------------------------------------------------------------------------
-- insert into public.match_hobby_tags (slug, label_ja, display_order) values
--   ('cafe', 'カフェ', 1),
--   ('travel', '旅行', 2),
--   ('movie', '映画', 3)
-- on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Optional future: TALK bridge (transaction_rooms) — DO NOT apply with initial draft
-- ---------------------------------------------------------------------------
-- D5: match rooms may use nullable expires_at (no expiry at launch).
-- alter table public.transaction_rooms
--   alter column expires_at drop not null;
--
-- alter table public.transaction_rooms
--   add column if not exists match_pair_id uuid;
--
-- alter table public.transaction_rooms
--   add constraint transaction_rooms_match_pair_id_fkey
--   foreign key (match_pair_id) references public.match_pairs (id) on delete set null;
--
-- create index if not exists transaction_rooms_match_pair_id_idx
--   on public.transaction_rooms (match_pair_id)
--   where match_pair_id is not null;
--
-- create index if not exists transaction_rooms_listing_type_idx
--   on public.transaction_rooms (listing_type);
--
-- alter table public.match_pairs
--   add constraint match_pairs_talk_room_id_fkey
--   foreign key (talk_room_id) references public.transaction_rooms (id) on delete set null;
--
-- Application convention for match rooms:
--   listing_type = 'match'
--   match_pair_id = match_pairs.id
--   buyer_id = user_low_id, seller_id = user_high_id
--   expires_at = null (inactive room cleanup may use this column later)

-- ---------------------------------------------------------------------------
-- Optional future: moderation_logs cross-app tagging (TALK existing table)
-- ---------------------------------------------------------------------------
-- alter table public.moderation_logs
--   add column if not exists source_app text not null default 'talk';
-- alter table public.moderation_logs
--   add column if not exists match_pair_id uuid;
