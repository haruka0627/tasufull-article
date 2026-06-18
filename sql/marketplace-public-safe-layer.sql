-- =============================================================================
-- TASFUL Marketplace P2 — 公開 safe select layer（列マスク）
-- 前提: sql/marketplace-rls-production.sql 適用済み
--
-- 1) 機密 JSON キー除去関数
-- 2) public_* views（security_invoker = true → 下位 RLS 維持）
-- 3) anon 向け base table 危険列 REVOKE（二重防御）
-- =============================================================================

-- ---------------------------------------------------------------------------
-- form_data サニタイズ（ネストキー除去）
-- ---------------------------------------------------------------------------
create or replace function public.marketplace_sanitize_form_data(fd jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(fd, '{}'::jsonb)
    - 'payment_url'
    - 'bank_transfer_info'
    - 'bank_info'
    - 'worker_payment_url'
    - 'worker_bank_info'
    - 'pr_payment_url'
    - 'pr_bank_info'
    - 'featured_payment_url'
    - 'featured_bank_info'
    - 'stripe_account_id'
    - 'stripe_customer_id'
    - 'stripe_session_id'
    - 'checkout_session_id'
    - 'payment_intent_id'
    - 'internal_notes'
    - 'seller_memo'
    - 'moderation_notes'
    - 'rejected_reason'
    - 'admin_flags'
    - 'payment';
$$;

comment on function public.marketplace_sanitize_form_data(jsonb) is
  'Marketplace P2: form_data から決済・内部メモ系キーを除去';

-- ---------------------------------------------------------------------------
-- オプション列（view 作成前に存在保証）
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_until timestamptz,
  add column if not exists featured_plan text,
  add column if not exists featured_priority integer,
  add column if not exists featured_stripe_session_id text;

alter table public.business_listings
  add column if not exists company_id text,
  add column if not exists status_label text,
  add column if not exists service_tags jsonb,
  add column if not exists service_features jsonb,
  add column if not exists repair_services jsonb,
  add column if not exists work_cases jsonb,
  add column if not exists service_menu_items jsonb,
  add column if not exists option_items jsonb,
  add column if not exists price_guides jsonb,
  add column if not exists category_extra jsonb,
  add column if not exists pr_payment_url text,
  add column if not exists pr_bank_info text,
  add column if not exists featured_payment_url text,
  add column if not exists featured_bank_info text,
  add column if not exists budget_amount numeric,
  add column if not exists payment_type text,
  add column if not exists start_date date,
  add column if not exists contract_period text,
  add column if not exists recruit_count integer,
  add column if not exists recruit_status text,
  add column if not exists application_conditions text,
  add column if not exists contact_method text;

-- ---------------------------------------------------------------------------
-- public_marketplace_listings — payment_url 等除外 + 公開行のみ（definer / RLS bypass）
-- ---------------------------------------------------------------------------
drop view if exists public.public_marketplace_listings cascade;

create view public.public_marketplace_listings as
select
  l.id,
  l.user_id,
  l.listing_type,
  l.title,
  l.description,
  l.tags,
  l.publish_status,
  l.publish_at,
  l.price_amount,
  l.onsite_payment,
  l.invoice_support,
  public.marketplace_sanitize_form_data(coalesce(l.form_data, '{}'::jsonb)) as form_data,
  l.created_at,
  l.updated_at,
  l.category,
  l.subcategory,
  l.image_url,
  l.thumbnail_url,
  l.product_description,
  l.condition,
  l.delivery_method,
  l.stock_count,
  l.delivery_days,
  l.spec,
  l.gallery_urls,
  l.images,
  l.available_tags,
  l.options,
  l.is_featured,
  l.featured_until,
  l.featured_plan,
  l.featured_priority
from public.listings l
where public.marketplace_listing_is_public(l.publish_status, l.publish_at);

comment on view public.public_marketplace_listings is
  'Marketplace P2: 公開 UI 向け listings（決済 URL / 振込 / Stripe 系除外 · 公開行のみ）';

-- ---------------------------------------------------------------------------
-- public_business_listings
-- ---------------------------------------------------------------------------
drop view if exists public.public_business_listings cascade;

create view public.public_business_listings as
select
  b.id,
  b.user_id,
  b.company_id,
  b.business_category,
  b.business_subcategory,
  b.company_name,
  b.title,
  b.description,
  b.hp_url,
  b.google_map_url,
  b.phone,
  b.business_hours,
  b.service_area,
  b.achievements,
  b.status,
  b.status_label,
  b.license_info,
  b.pr_plan,
  b.featured_plan,
  b.invoice_support,
  b.rating,
  b.review_count,
  b.reply_rate,
  b.publish_status,
  b.publish_at,
  b.tags,
  public.marketplace_sanitize_form_data(coalesce(b.form_data, '{}'::jsonb)) as form_data,
  b.image_url,
  b.thumbnail_url,
  b.main_image_url,
  b.gallery_urls,
  b.images,
  b.service_tags,
  b.service_features,
  b.repair_services,
  b.work_cases,
  b.service_menu_items,
  b.option_items,
  b.price_guides,
  b.category_extra,
  b.budget_amount,
  b.payment_type,
  b.start_date,
  b.contract_period,
  b.recruit_count,
  b.recruit_status,
  b.application_conditions,
  b.contact_method,
  b.created_at,
  b.updated_at
from public.business_listings b
where public.marketplace_listing_is_public(b.publish_status, b.publish_at);

comment on view public.public_business_listings is
  'Marketplace P2: 公開 UI 向け business_listings（決済 URL / 振込除外 · 公開行のみ）';

-- ---------------------------------------------------------------------------
-- public_marketplace_profiles — last_seen_at 等内部状態除外
-- ---------------------------------------------------------------------------
drop view if exists public.public_marketplace_profiles cascade;

create view public.public_marketplace_profiles as
select
  p.user_id,
  p.display_name,
  p.avatar_url,
  p.availability_status,
  p.work_hours,
  p.updated_at
from public.profiles p
where public.marketplace_profile_is_public(p.user_id);

comment on view public.public_marketplace_profiles is
  'Marketplace P2: 公開出品者プロフィール（last_seen_at 除外 · 公開出品者のみ）';

-- ---------------------------------------------------------------------------
-- public_marketplace_members
-- ---------------------------------------------------------------------------
drop view if exists public.public_marketplace_members cascade;

create view public.public_marketplace_members as
select
  m.user_id,
  m.rank,
  m.badge_image_url,
  m.is_premium,
  m.identity_verified,
  m.deals_count,
  m.followers_count,
  m.updated_at
from public.members m
where public.marketplace_profile_is_public(m.user_id);

comment on view public.public_marketplace_members is
  'Marketplace P2: 公開出品者バッジ情報（公開出品者のみ）';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select on public.public_marketplace_listings to anon, authenticated;
grant select on public.public_business_listings to anon, authenticated;
grant select on public.public_marketplace_profiles to anon, authenticated;
grant select on public.public_marketplace_members to anon, authenticated;

grant execute on function public.marketplace_sanitize_form_data(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- anon は base table 直読不可（safe view のみ）
-- ---------------------------------------------------------------------------
revoke select on table public.listings from anon;
revoke select on table public.business_listings from anon;
revoke select on table public.profiles from anon;
revoke select on table public.members from anon;

-- 列単位 revoke（authenticated 非オーナーの直接 REST 抑止補助）
revoke select (payment_url, bank_transfer_info, featured_stripe_session_id)
  on public.listings
  from anon;

revoke select (
  payment_url,
  bank_transfer_info,
  pr_payment_url,
  pr_bank_info,
  featured_payment_url,
  featured_bank_info
)
  on public.business_listings
  from anon;

revoke select (last_seen_at)
  on public.profiles
  from anon;

-- 確認
select
  c.relname as view_name,
  'PUBLIC_SAFE_VIEW' as kind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname in (
    'public_marketplace_listings',
    'public_business_listings',
    'public_marketplace_profiles',
    'public_marketplace_members'
  )
order by c.relname;
