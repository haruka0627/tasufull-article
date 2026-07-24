-- Business Directory Phase 2a — page content columns (fixed sections · no blocks_json)
-- full_description exists from Phase 1; add SEO, FAQ, recommended uses.

alter table public.business_directory_profiles
  add column if not exists seo_title text,
  add column if not exists meta_description text,
  add column if not exists faq_items jsonb not null default '[]'::jsonb,
  add column if not exists recommended_uses text[] not null default '{}'::text[];

comment on column public.business_directory_profiles.seo_title is
  'SEO page title (max 60 chars enforced in app). All plans.';
comment on column public.business_directory_profiles.meta_description is
  'SEO meta description (max 160 chars enforced in app). All plans.';
comment on column public.business_directory_profiles.faq_items is
  'FAQ array [{q,a}] max 5. Saved all plans; public display Standard+ (app layer).';
comment on column public.business_directory_profiles.recommended_uses is
  'Recommended audience lines max 5. Saved all plans; public display Standard+ (app layer).';

-- Public list view: expose SEO for Phase 2b head tags (structure only; render in 2b)
-- DROP required: PostgreSQL CREATE OR REPLACE cannot insert columns before trailing view columns (42P16).
drop view if exists public.business_directory_listings_public;

create view public.business_directory_listings_public as
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
  p.seo_title,
  p.meta_description,
  p.faq_items,
  p.recommended_uses,
  p.prefecture,
  p.city
from public.business_directory_listings l
join public.business_directory_profiles p on p.listing_id = l.id
where l.status = 'published'
   or (l.status = 'review_requested' and l.published_at is not null);

comment on view public.business_directory_listings_public is
  'Business Directory: anon-safe published listing metadata (incl. content_update review)';

grant select on public.business_directory_listings_public to anon, authenticated;
