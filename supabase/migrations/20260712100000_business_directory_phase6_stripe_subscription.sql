-- Business Directory Phase 6 — Stripe subscription columns (listings root)
-- Ref: docs/business-directory-subscription-model.md · AD-013

alter table public.business_directory_listings
  add column if not exists stripe_price_id text,
  add column if not exists subscription_status text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists plan_changed_at timestamptz;

comment on column public.business_directory_listings.stripe_price_id is
  'Stripe Price ID for active Business Directory subscription';
comment on column public.business_directory_listings.subscription_status is
  'Stripe subscription.status mirror (active, trialing, past_due, canceled, ...)';
comment on column public.business_directory_listings.current_period_end is
  'Stripe subscription current_period_end';
comment on column public.business_directory_listings.cancel_at_period_end is
  'Stripe cancel_at_period_end';
comment on column public.business_directory_listings.plan_changed_at is
  'Last plan_code change timestamp (Stripe sync or downgrade)';

alter table public.business_directory_listings
  drop constraint if exists business_directory_listings_subscription_status_chk;

alter table public.business_directory_listings
  add constraint business_directory_listings_subscription_status_chk
  check (
    subscription_status is null
    or subscription_status in (
      'active',
      'trialing',
      'past_due',
      'unpaid',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'paused'
    )
  );

create index if not exists idx_business_directory_listings_stripe_sub
  on public.business_directory_listings (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_business_directory_listings_subscription_status
  on public.business_directory_listings (subscription_status)
  where subscription_status is not null;
