-- Partner P1 pre-apply backup inventory (read-only)
select now() as captured_at;

select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.match_pairs) as match_pairs,
  (select count(*) from public.transaction_rooms) as transaction_rooms,
  (select count(*) from public.listings) as listings,
  (select count(*) from public.business_listings) as business_listings;

select id, name, public, created_at
from storage.buckets
order by name;

select to_regclass('public.partner_profiles') as partner_profiles_before;
