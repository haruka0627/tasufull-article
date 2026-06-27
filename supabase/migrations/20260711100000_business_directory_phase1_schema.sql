-- Business Directory Phase 1 — schema (10 tables)
-- Ref: docs/business-directory-data-model-design.md
-- AD-013 · Self-Service · UI Flow design
-- Marketplace listngs / Platform deals: no changes

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.business_directory_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.business_directory_set_updated_at() is
  'Business Directory: touch updated_at on row update';

create or replace function public.business_directory_is_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'role', '') in (
      'ops_admin', 'tasu_admin', 'tasu_ops_admin', 'admin'
    )
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in (
      'ops_admin', 'tasu_admin', 'tasu_ops_admin', 'admin'
    )
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in (
      'ops_admin', 'tasu_admin', 'tasu_ops_admin', 'admin'
    )
    or coalesce(auth.jwt() ->> 'ops_admin', '') = 'true';
$$;

comment on function public.business_directory_is_ops_admin() is
  'RLS: Business Directory ops/admin (JWT role claims)';

-- ---------------------------------------------------------------------------
-- plan_features (master · seeded in 20260711100001)
-- ---------------------------------------------------------------------------

create table if not exists public.business_directory_plan_features (
  plan_code text primary key,
  display_name text not null,
  max_photos integer not null default 1,
  max_tlv_videos integer not null default 0,
  max_social_links integer not null default 0,
  allow_business_hours boolean not null default false,
  allow_sns boolean not null default false,
  allow_tlv boolean not null default false,
  allow_contact_form boolean not null default false,
  allow_analytics boolean not null default false,
  allow_ai_recommend boolean not null default false,
  search_boost_weight integer not null default 0,
  allow_multi_listing boolean not null default false,
  allow_connect_checkout boolean not null default false,
  stripe_price_id text,
  updated_at timestamptz not null default now(),
  constraint business_directory_plan_features_plan_code_chk
    check (plan_code in ('free', 'standard', 'pro', 'premium')),
  constraint business_directory_plan_features_max_photos_chk
    check (max_photos >= 0),
  constraint business_directory_plan_features_max_tlv_videos_chk
    check (max_tlv_videos >= 0),
  constraint business_directory_plan_features_max_social_links_chk
    check (max_social_links >= 0),
  constraint business_directory_plan_features_search_boost_weight_chk
    check (search_boost_weight >= 0)
);

comment on table public.business_directory_plan_features is
  'Business Directory subscription plan feature flags (AD-013)';

drop trigger if exists trg_business_directory_plan_features_updated_at
  on public.business_directory_plan_features;
create trigger trg_business_directory_plan_features_updated_at
  before update on public.business_directory_plan_features
  for each row execute function public.business_directory_set_updated_at();

-- ---------------------------------------------------------------------------
-- categories (master · seeded in 20260711100001)
-- ---------------------------------------------------------------------------

create table if not exists public.business_directory_categories (
  id uuid primary key default gen_random_uuid(),
  listing_type text not null,
  parent_id uuid references public.business_directory_categories (id) on delete set null,
  code text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint business_directory_categories_listing_type_chk
    check (listing_type in ('shop_retail', 'business_service')),
  constraint business_directory_categories_code_key unique (code)
);

comment on table public.business_directory_categories is
  'Business Directory category tree (shop / business_service)';

create index if not exists idx_business_directory_categories_listing_type
  on public.business_directory_categories (listing_type, sort_order);

-- ---------------------------------------------------------------------------
-- listings (lifecycle root)
-- ---------------------------------------------------------------------------

create table if not exists public.business_directory_listings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  listing_type text not null,
  status text not null default 'draft',
  plan_code text not null default 'free'
    references public.business_directory_plan_features (plan_code),
  category_id uuid not null references public.business_directory_categories (id),
  display_name text not null,
  slug text not null,
  service_areas text[] not null default '{}'::text[],
  hp_mode text not null default 'full_page',
  website_url text,
  search_text tsvector,
  plan_assigned_at timestamptz,
  published_at timestamptz,
  suspended_at timestamptz,
  archived_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_directory_listings_listing_type_chk
    check (listing_type in ('shop_retail', 'business_service')),
  constraint business_directory_listings_status_chk
    check (status in (
      'draft',
      'review_requested',
      'published',
      'rejected',
      'suspended',
      'unpublished',
      'archived'
    )),
  constraint business_directory_listings_hp_mode_chk
    check (hp_mode in ('external_redirect', 'full_page')),
  constraint business_directory_listings_display_name_len_chk
    check (char_length(display_name) >= 1 and char_length(display_name) <= 200),
  constraint business_directory_listings_slug_len_chk
    check (char_length(slug) >= 1 and char_length(slug) <= 120),
  constraint business_directory_listings_owner_slug_key unique (owner_user_id, slug)
);

comment on table public.business_directory_listings is
  'Business Directory listing lifecycle root · separate from public.listings (Marketplace)';

create index if not exists idx_business_directory_listings_status_type
  on public.business_directory_listings (status, listing_type);

create index if not exists idx_business_directory_listings_owner
  on public.business_directory_listings (owner_user_id);

create index if not exists idx_business_directory_listings_category
  on public.business_directory_listings (category_id);

create index if not exists idx_business_directory_listings_published
  on public.business_directory_listings (published_at desc)
  where status = 'published';

create index if not exists idx_business_directory_listings_service_areas
  on public.business_directory_listings using gin (service_areas);

drop trigger if exists trg_business_directory_listings_updated_at
  on public.business_directory_listings;
create trigger trg_business_directory_listings_updated_at
  before update on public.business_directory_listings
  for each row execute function public.business_directory_set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles (1:1)
-- ---------------------------------------------------------------------------

create table if not exists public.business_directory_profiles (
  listing_id uuid primary key references public.business_directory_listings (id) on delete cascade,
  company_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  postal_code text,
  prefecture text not null,
  city text not null,
  address_line1 text not null,
  address_line2 text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  short_description text not null,
  full_description text,
  shop_sales_genre text,
  shop_main_products text,
  service_summary text,
  price_range_text text,
  achievements_text text,
  licenses_text text,
  staff_intro_text text,
  contact_mode text,
  contact_target_url text,
  terms_accepted_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint business_directory_profiles_short_description_len_chk
    check (char_length(short_description) >= 1 and char_length(short_description) <= 500),
  constraint business_directory_profiles_contact_mode_chk
    check (contact_mode is null or contact_mode in ('external_url', 'form', 'talk'))
);

comment on table public.business_directory_profiles is
  'Business Directory listing profile (1:1) · metadata only';

drop trigger if exists trg_business_directory_profiles_updated_at
  on public.business_directory_profiles;
create trigger trg_business_directory_profiles_updated_at
  before update on public.business_directory_profiles
  for each row execute function public.business_directory_set_updated_at();

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------

create table if not exists public.business_directory_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.business_directory_listings (id) on delete cascade,
  kind text not null default 'gallery',
  storage_bucket text not null default 'business-directory',
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint business_directory_photos_kind_chk
    check (kind in ('logo', 'cover', 'gallery', 'product', 'work_sample', 'staff'))
);

create index if not exists idx_business_directory_photos_listing
  on public.business_directory_photos (listing_id, sort_order);

-- ---------------------------------------------------------------------------
-- business_hours
-- ---------------------------------------------------------------------------

create table if not exists public.business_directory_business_hours (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.business_directory_listings (id) on delete cascade,
  day_of_week smallint,
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  note text,
  sort_order integer not null default 0,
  constraint business_directory_business_hours_day_chk
    check (day_of_week is null or day_of_week between 0 and 6)
);

create index if not exists idx_business_directory_business_hours_listing
  on public.business_directory_business_hours (listing_id, sort_order);

-- ---------------------------------------------------------------------------
-- social_links
-- ---------------------------------------------------------------------------

create table if not exists public.business_directory_social_links (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.business_directory_listings (id) on delete cascade,
  platform text not null,
  url text not null,
  sort_order integer not null default 0,
  constraint business_directory_social_links_platform_chk
    check (platform in ('instagram', 'x', 'facebook', 'line', 'youtube', 'other'))
);

create index if not exists idx_business_directory_social_links_listing
  on public.business_directory_social_links (listing_id, sort_order);

-- ---------------------------------------------------------------------------
-- tlv_videos (embed reference only · no TLV schema change)
-- ---------------------------------------------------------------------------

create table if not exists public.business_directory_tlv_videos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.business_directory_listings (id) on delete cascade,
  tlv_video_id uuid not null,
  embed_url text,
  title text,
  purpose text not null default 'store_intro',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint business_directory_tlv_videos_purpose_chk
    check (purpose in ('store_intro', 'work_sample', 'product_intro'))
);

create index if not exists idx_business_directory_tlv_videos_listing
  on public.business_directory_tlv_videos (listing_id, sort_order);

-- ---------------------------------------------------------------------------
-- review_requests (ops queue)
-- ---------------------------------------------------------------------------

create table if not exists public.business_directory_review_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.business_directory_listings (id) on delete cascade,
  request_type text not null,
  status text not null default 'open',
  submitted_by uuid not null references auth.users (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  reject_reason_code text,
  reject_reason_note text,
  snapshot_json jsonb not null default '{}'::jsonb,
  constraint business_directory_review_requests_type_chk
    check (request_type in ('initial_publish', 'content_update', 'plan_upgrade')),
  constraint business_directory_review_requests_status_chk
    check (status in ('open', 'approved', 'rejected'))
);

create index if not exists idx_business_directory_review_requests_open
  on public.business_directory_review_requests (status, submitted_at)
  where status = 'open';

create index if not exists idx_business_directory_review_requests_listing
  on public.business_directory_review_requests (listing_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- audit_logs (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.business_directory_audit_logs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.business_directory_listings (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_role text not null,
  action text not null,
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint business_directory_audit_logs_actor_role_chk
    check (actor_role in ('owner', 'ops', 'system')),
  constraint business_directory_audit_logs_from_status_chk
    check (from_status is null or from_status in (
      'draft', 'review_requested', 'published', 'rejected',
      'suspended', 'unpublished', 'archived'
    )),
  constraint business_directory_audit_logs_to_status_chk
    check (to_status is null or to_status in (
      'draft', 'review_requested', 'published', 'rejected',
      'suspended', 'unpublished', 'archived'
    ))
);

create index if not exists idx_business_directory_audit_logs_listing
  on public.business_directory_audit_logs (listing_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Public safe view (published listings metadata)
-- ---------------------------------------------------------------------------

create or replace view public.business_directory_listings_public as
select
  l.id,
  l.listing_type,
  l.plan_code,
  l.category_id,
  l.display_name,
  l.slug,
  l.service_areas,
  l.hp_mode,
  l.website_url,
  l.published_at,
  p.company_name,
  p.short_description,
  p.full_description,
  p.prefecture,
  p.city
from public.business_directory_listings l
join public.business_directory_profiles p on p.listing_id = l.id
where l.status = 'published';

comment on view public.business_directory_listings_public is
  'Business Directory: anon-safe published listing metadata';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.business_directory_plan_features enable row level security;
alter table public.business_directory_categories enable row level security;
alter table public.business_directory_listings enable row level security;
alter table public.business_directory_profiles enable row level security;
alter table public.business_directory_photos enable row level security;
alter table public.business_directory_business_hours enable row level security;
alter table public.business_directory_social_links enable row level security;
alter table public.business_directory_tlv_videos enable row level security;
alter table public.business_directory_review_requests enable row level security;
alter table public.business_directory_audit_logs enable row level security;

-- Masters: read-only for all authenticated + anon
drop policy if exists business_directory_plan_features_select_all
  on public.business_directory_plan_features;
create policy business_directory_plan_features_select_all
  on public.business_directory_plan_features
  for select
  to anon, authenticated
  using (true);

drop policy if exists business_directory_categories_select_active
  on public.business_directory_categories;
create policy business_directory_categories_select_active
  on public.business_directory_categories
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists business_directory_categories_ops_all
  on public.business_directory_categories;
create policy business_directory_categories_ops_all
  on public.business_directory_categories
  for all
  to authenticated
  using (public.business_directory_is_ops_admin())
  with check (public.business_directory_is_ops_admin());

-- listings
drop policy if exists business_directory_listings_select_published
  on public.business_directory_listings;
create policy business_directory_listings_select_published
  on public.business_directory_listings
  for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists business_directory_listings_owner_all
  on public.business_directory_listings;
create policy business_directory_listings_owner_all
  on public.business_directory_listings
  for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists business_directory_listings_ops_all
  on public.business_directory_listings;
create policy business_directory_listings_ops_all
  on public.business_directory_listings
  for all
  to authenticated
  using (public.business_directory_is_ops_admin())
  with check (public.business_directory_is_ops_admin());

-- profiles (via listing ownership or published)
drop policy if exists business_directory_profiles_select_published
  on public.business_directory_profiles;
create policy business_directory_profiles_select_published
  on public.business_directory_profiles
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.business_directory_listings l
      where l.id = listing_id and l.status = 'published'
    )
  );

drop policy if exists business_directory_profiles_owner_all
  on public.business_directory_profiles;
create policy business_directory_profiles_owner_all
  on public.business_directory_profiles
  for all
  to authenticated
  using (
    exists (
      select 1 from public.business_directory_listings l
      where l.id = listing_id and l.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.business_directory_listings l
      where l.id = listing_id and l.owner_user_id = auth.uid()
    )
  );

drop policy if exists business_directory_profiles_ops_all
  on public.business_directory_profiles;
create policy business_directory_profiles_ops_all
  on public.business_directory_profiles
  for all
  to authenticated
  using (public.business_directory_is_ops_admin())
  with check (public.business_directory_is_ops_admin());

-- Child tables: same pattern (listing published OR owner OR ops)
-- photos
drop policy if exists business_directory_photos_select_published on public.business_directory_photos;
create policy business_directory_photos_select_published
  on public.business_directory_photos for select to anon, authenticated
  using (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.status = 'published'));

drop policy if exists business_directory_photos_owner_all on public.business_directory_photos;
create policy business_directory_photos_owner_all
  on public.business_directory_photos for all to authenticated
  using (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.owner_user_id = auth.uid()))
  with check (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.owner_user_id = auth.uid()));

drop policy if exists business_directory_photos_ops_all on public.business_directory_photos;
create policy business_directory_photos_ops_all
  on public.business_directory_photos for all to authenticated
  using (public.business_directory_is_ops_admin())
  with check (public.business_directory_is_ops_admin());

-- business_hours
drop policy if exists business_directory_business_hours_select_published on public.business_directory_business_hours;
create policy business_directory_business_hours_select_published
  on public.business_directory_business_hours for select to anon, authenticated
  using (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.status = 'published'));

drop policy if exists business_directory_business_hours_owner_all on public.business_directory_business_hours;
create policy business_directory_business_hours_owner_all
  on public.business_directory_business_hours for all to authenticated
  using (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.owner_user_id = auth.uid()))
  with check (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.owner_user_id = auth.uid()));

drop policy if exists business_directory_business_hours_ops_all on public.business_directory_business_hours;
create policy business_directory_business_hours_ops_all
  on public.business_directory_business_hours for all to authenticated
  using (public.business_directory_is_ops_admin())
  with check (public.business_directory_is_ops_admin());

-- social_links
drop policy if exists business_directory_social_links_select_published on public.business_directory_social_links;
create policy business_directory_social_links_select_published
  on public.business_directory_social_links for select to anon, authenticated
  using (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.status = 'published'));

drop policy if exists business_directory_social_links_owner_all on public.business_directory_social_links;
create policy business_directory_social_links_owner_all
  on public.business_directory_social_links for all to authenticated
  using (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.owner_user_id = auth.uid()))
  with check (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.owner_user_id = auth.uid()));

drop policy if exists business_directory_social_links_ops_all on public.business_directory_social_links;
create policy business_directory_social_links_ops_all
  on public.business_directory_social_links for all to authenticated
  using (public.business_directory_is_ops_admin())
  with check (public.business_directory_is_ops_admin());

-- tlv_videos
drop policy if exists business_directory_tlv_videos_select_published on public.business_directory_tlv_videos;
create policy business_directory_tlv_videos_select_published
  on public.business_directory_tlv_videos for select to anon, authenticated
  using (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.status = 'published'));

drop policy if exists business_directory_tlv_videos_owner_all on public.business_directory_tlv_videos;
create policy business_directory_tlv_videos_owner_all
  on public.business_directory_tlv_videos for all to authenticated
  using (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.owner_user_id = auth.uid()))
  with check (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.owner_user_id = auth.uid()));

drop policy if exists business_directory_tlv_videos_ops_all on public.business_directory_tlv_videos;
create policy business_directory_tlv_videos_ops_all
  on public.business_directory_tlv_videos for all to authenticated
  using (public.business_directory_is_ops_admin())
  with check (public.business_directory_is_ops_admin());

-- review_requests
drop policy if exists business_directory_review_requests_owner_select on public.business_directory_review_requests;
create policy business_directory_review_requests_owner_select
  on public.business_directory_review_requests for select to authenticated
  using (submitted_by = auth.uid());

drop policy if exists business_directory_review_requests_owner_insert on public.business_directory_review_requests;
create policy business_directory_review_requests_owner_insert
  on public.business_directory_review_requests for insert to authenticated
  with check (submitted_by = auth.uid());

drop policy if exists business_directory_review_requests_ops_all on public.business_directory_review_requests;
create policy business_directory_review_requests_ops_all
  on public.business_directory_review_requests for all to authenticated
  using (public.business_directory_is_ops_admin())
  with check (public.business_directory_is_ops_admin());

-- audit_logs: insert owner/ops · select owner own listing / ops all · no update/delete
drop policy if exists business_directory_audit_logs_owner_insert on public.business_directory_audit_logs;
create policy business_directory_audit_logs_owner_insert
  on public.business_directory_audit_logs for insert to authenticated
  with check (
    actor_role = 'owner'
    and exists (
      select 1 from public.business_directory_listings l
      where l.id = listing_id and l.owner_user_id = auth.uid()
    )
  );

drop policy if exists business_directory_audit_logs_owner_select on public.business_directory_audit_logs;
create policy business_directory_audit_logs_owner_select
  on public.business_directory_audit_logs for select to authenticated
  using (exists (
    select 1 from public.business_directory_listings l
    where l.id = listing_id and l.owner_user_id = auth.uid()));

drop policy if exists business_directory_audit_logs_ops_all on public.business_directory_audit_logs;
create policy business_directory_audit_logs_ops_all
  on public.business_directory_audit_logs for all to authenticated
  using (public.business_directory_is_ops_admin())
  with check (public.business_directory_is_ops_admin());

grant select on public.business_directory_listings_public to anon, authenticated;
