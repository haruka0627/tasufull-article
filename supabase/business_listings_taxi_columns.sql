-- =============================================================================
-- public.business_listings — タクシー・送迎カテゴリ用カラム
-- 既存データを壊さないよう add column if not exists で追加
-- =============================================================================

alter table public.business_listings
  add column if not exists taxi_service_type text,
  add column if not exists taxi_vehicle_type text,
  add column if not exists taxi_area_type text,
  add column if not exists taxi_airport_transfer text,
  add column if not exists taxi_24h_available text,
  add column if not exists taxi_reservation_available text,
  add column if not exists taxi_corporate_contract text,
  add column if not exists taxi_invoice_available text,
  add column if not exists taxi_payment_methods jsonb default '[]'::jsonb,
  add column if not exists taxi_base_fare text,
  add column if not exists taxi_night_fare text,
  add column if not exists taxi_route_price text,
  add column if not exists taxi_capacity text,
  add column if not exists taxi_language_support text,
  add column if not exists taxi_child_seat text,
  add column if not exists taxi_booking_types text[];

comment on column public.business_listings.taxi_service_type is 'タクシー: 対応内容（送迎種別）';
comment on column public.business_listings.taxi_vehicle_type is 'タクシー: 対応車種';
comment on column public.business_listings.taxi_area_type is 'タクシー: 対応エリア';
comment on column public.business_listings.taxi_airport_transfer is 'タクシー: 空港送迎（yes/no/consult）';
comment on column public.business_listings.taxi_24h_available is 'タクシー: 24時間対応';
comment on column public.business_listings.taxi_reservation_available is 'タクシー: 予約対応';
comment on column public.business_listings.taxi_corporate_contract is 'タクシー: 法人契約';
comment on column public.business_listings.taxi_invoice_available is 'タクシー: インボイス対応';
comment on column public.business_listings.taxi_payment_methods is 'タクシー: 支払い方法（jsonb配列）';
comment on column public.business_listings.taxi_base_fare is 'タクシー: 基本料金目安';
comment on column public.business_listings.taxi_night_fare is 'タクシー: 深夜料金目安';
comment on column public.business_listings.taxi_route_price is 'タクシー: ルート別料金';
comment on column public.business_listings.taxi_capacity is 'タクシー: 乗車人数';
comment on column public.business_listings.taxi_language_support is 'タクシー: 対応言語';
comment on column public.business_listings.taxi_child_seat is 'タクシー: チャイルドシート';
comment on column public.business_listings.taxi_booking_types is 'タクシー: 予約タイプ（即時配車・空港送迎など）';

create index if not exists business_listings_taxi_airport_transfer_idx
  on public.business_listings (taxi_airport_transfer)
  where business_category = 'taxi' and taxi_airport_transfer is not null;

create index if not exists business_listings_taxi_reservation_idx
  on public.business_listings (taxi_reservation_available)
  where business_category = 'taxi' and taxi_reservation_available is not null;

create index if not exists business_listings_taxi_corporate_contract_idx
  on public.business_listings (taxi_corporate_contract)
  where business_category = 'taxi' and taxi_corporate_contract is not null;
