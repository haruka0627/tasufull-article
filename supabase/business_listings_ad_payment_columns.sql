-- 広告掲載（PR / 上位）の決済URL・振込先メモ
alter table public.business_listings
  add column if not exists pr_payment_url text,
  add column if not exists pr_bank_info text,
  add column if not exists featured_payment_url text,
  add column if not exists featured_bank_info text;
