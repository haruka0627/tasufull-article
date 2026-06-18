-- 求人: work_style / employment_type の英語コード値を日本語ラベルへ更新
-- Supabase SQL Editor で実行してください（job のみ対象）

update public.listings
set work_style = 'リモートOK'
where listing_type = 'job'
  and lower(trim(work_style)) in ('yes', 'remote', 'remote_ok', 'リモートok');

update public.listings
set work_style = 'ハイブリッド'
where listing_type = 'job'
  and lower(trim(work_style)) in ('hybrid');

update public.listings
set work_style = '出社'
where listing_type = 'job'
  and lower(trim(work_style)) in ('no', 'onsite', 'office', '出社必須');

update public.listings
set employment_type = '業務委託'
where listing_type = 'job'
  and lower(trim(employment_type)) = 'contract';

update public.listings
set employment_type = '正社員'
where listing_type = 'job'
  and lower(trim(employment_type)) = 'fulltime';

update public.listings
set employment_type = 'アルバイト・パート'
where listing_type = 'job'
  and lower(trim(employment_type)) = 'parttime';

update public.listings
set employment_type = 'フリーランス'
where listing_type = 'job'
  and lower(trim(employment_type)) = 'freelance';
