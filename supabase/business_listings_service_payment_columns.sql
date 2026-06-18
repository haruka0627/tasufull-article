-- 業務サービス: 掲載者の支払い方法（当事者間決済。TASFULは手数料のみ別途）
alter table public.business_listings
  add column if not exists payment_method_type text,
  add column if not exists payment_url text,
  add column if not exists bank_name text,
  add column if not exists bank_branch text,
  add column if not exists bank_account_type text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_holder text,
  add column if not exists payment_note text,
  add column if not exists bank_transfer_info text,
  add column if not exists platform_fee_rate numeric(5, 4) default 0.0500;

comment on column public.business_listings.payment_method_type is 'external_url | bank_transfer | paypay | mixed | other';
comment on column public.business_listings.payment_note is 'PayPay・店頭支払いなどの補足';
comment on column public.business_listings.platform_fee_rate is '成約手数料率（業務サービス既定 5%）';
