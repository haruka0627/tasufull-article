-- Business Directory — content_update (published edit → re-review)
-- Pending owner edits stay off live rows; public keeps published_at + live data during review.

create table if not exists public.business_directory_pending_updates (
  listing_id uuid primary key references public.business_directory_listings (id) on delete cascade,
  content_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.business_directory_pending_updates is
  'Owner draft for published listings (content_update). Applied on ops approve; discarded on reject.';

create index if not exists idx_business_directory_pending_updates_updated
  on public.business_directory_pending_updates (updated_at desc);

alter table public.business_directory_review_requests
  add column if not exists published_snapshot_json jsonb not null default '{}'::jsonb;

comment on column public.business_directory_review_requests.published_snapshot_json is
  'Live public snapshot at content_update submit (audit / ops compare).';

-- Public list: keep previously published listings visible while content_update is in review
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
where l.status = 'published'
   or (l.status = 'review_requested' and l.published_at is not null);

comment on view public.business_directory_listings_public is
  'Business Directory: anon-safe published listing metadata (incl. content_update review)';

alter table public.business_directory_pending_updates enable row level security;

revoke all on table public.business_directory_pending_updates from anon, authenticated;
grant all on table public.business_directory_pending_updates to service_role;
