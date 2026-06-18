-- =============================================================================
-- 建設・修理向け 実績・事例（work_cases）列
-- Supabase SQL Editor で実行（再実行しても安全）
-- =============================================================================

alter table public.business_listings
  add column if not exists work_cases jsonb not null default '[]'::jsonb;

comment on column public.business_listings.work_cases is '実績・事例（jsonb 配列。title, content/category, region/area, period, cost/price, note/description, image_url）';

-- 既存 repair_cases を work_cases に同期（修理デモ等）
update public.business_listings
set work_cases = repair_cases
where jsonb_array_length(coalesce(work_cases, '[]'::jsonb)) = 0
  and jsonb_array_length(coalesce(repair_cases, '[]'::jsonb)) > 0;
