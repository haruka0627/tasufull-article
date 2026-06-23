-- L10: MATCH schema CREATE (linked ref ddojquacsyqesrjhcvmn)
-- RLS NOT enabled in this migration (deferred to L11)
-- Naming: match_profile_photos = "match_photos" · match_pairs = "match_matches"
-- Ref: supabase/migrations/20260621120000_match_schema_draft.sql (core subset)

create or replace function public.match_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- match_profiles
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

drop trigger if exists match_profiles_set_updated_at on public.match_profiles;
create trigger match_profiles_set_updated_at
  before update on public.match_profiles
  for each row execute function public.match_set_updated_at();

comment on table public.match_profiles is 'MATCH profiles (L10). user_id = talk_user_id text.';

-- match_profile_photos (logical: match_photos)
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

drop trigger if exists match_profile_photos_set_updated_at on public.match_profile_photos;
create trigger match_profile_photos_set_updated_at
  before update on public.match_profile_photos
  for each row execute function public.match_set_updated_at();

alter table public.match_profiles
  drop constraint if exists match_profiles_main_photo_id_fkey;

alter table public.match_profiles
  add constraint match_profiles_main_photo_id_fkey
  foreign key (main_photo_id) references public.match_profile_photos (id) on delete set null;

comment on table public.match_profile_photos is 'MATCH photos (L10). Alias: match_photos.';

-- match_swipes
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

comment on table public.match_swipes is 'MATCH swipe events (L10).';

-- match_pairs (logical: match_matches)
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

drop trigger if exists match_pairs_set_updated_at on public.match_pairs;
create trigger match_pairs_set_updated_at
  before update on public.match_pairs
  for each row execute function public.match_set_updated_at();

comment on table public.match_pairs is 'MATCH mutual pairs (L10). Alias: match_matches.';

-- match_blocks
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

drop trigger if exists match_blocks_set_updated_at on public.match_blocks;
create trigger match_blocks_set_updated_at
  before update on public.match_blocks
  for each row execute function public.match_set_updated_at();

comment on table public.match_blocks is 'MATCH user blocks (L10).';

-- match_reports
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

drop trigger if exists match_reports_set_updated_at on public.match_reports;
create trigger match_reports_set_updated_at
  before update on public.match_reports
  for each row execute function public.match_set_updated_at();

comment on table public.match_reports is 'MATCH user reports (L10).';

-- match_verifications
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

drop trigger if exists match_verifications_set_updated_at on public.match_verifications;
create trigger match_verifications_set_updated_at
  before update on public.match_verifications
  for each row execute function public.match_set_updated_at();

comment on table public.match_verifications is 'MATCH identity verifications (L10).';

-- match_moderation_logs
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

comment on table public.match_moderation_logs is 'MATCH moderation audit logs (L10).';

-- Explicit: RLS remains OFF until L11
-- alter table public.match_profiles enable row level security;
