-- EXEC ONLY: § APPLY blocks [A]-[G] from business-directory-15110000-partial-apply.sql
-- Production controlled apply · view block NOT included

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

alter table public.business_directory_pending_updates enable row level security;

revoke all on table public.business_directory_pending_updates from anon, authenticated;
grant all on table public.business_directory_pending_updates to service_role;
