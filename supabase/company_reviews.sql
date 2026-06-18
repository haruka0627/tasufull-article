-- =============================================================================
-- 会社単位レビュー（company_reviews）+ companies 評価集計
-- Supabase SQL Editor で実行（再実行しても安全）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. companies（未作成時のみ最小構成で作成）
-- -----------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid,
  rating_avg numeric(3, 2) not null default 0,
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 既存 companies に不足カラムのみ追加
alter table public.companies
  add column if not exists rating_avg numeric(3, 2) not null default 0,
  add column if not exists review_count integer not null default 0;

-- business_listings → companies 紐づけ（任意・再実行可）
alter table public.business_listings
  add column if not exists company_id uuid references public.companies (id) on delete set null;

create index if not exists business_listings_company_id_idx
  on public.business_listings (company_id);

-- -----------------------------------------------------------------------------
-- 1. company_reviews
-- -----------------------------------------------------------------------------
create table if not exists public.company_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null,
  reviewer_name text,
  rating integer not null,
  title text,
  comment text,
  service_type text,
  listing_id uuid,
  is_verified boolean not null default false,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_reviews_rating_check check (rating >= 1 and rating <= 5)
);

create index if not exists company_reviews_company_id_idx
  on public.company_reviews (company_id);

create index if not exists company_reviews_user_id_idx
  on public.company_reviews (user_id);

create index if not exists company_reviews_listing_id_idx
  on public.company_reviews (listing_id);

create index if not exists company_reviews_visible_created_idx
  on public.company_reviews (company_id, created_at desc)
  where is_visible = true;

comment on table public.company_reviews is '会社・事業者単位の口コミ（掲載横断）';

-- -----------------------------------------------------------------------------
-- 2. updated_at 自動更新（company_reviews）
-- -----------------------------------------------------------------------------
drop trigger if exists company_reviews_set_updated_at on public.company_reviews;
create trigger company_reviews_set_updated_at
  before update on public.company_reviews
  for each row
  execute function public.set_updated_at();

-- companies.updated_at（関数が無い場合のみ作成）
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. レビュー集計 → companies.rating_avg / review_count
-- -----------------------------------------------------------------------------
create or replace function public.refresh_company_review_stats(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric(3, 2);
  v_count integer;
begin
  if p_company_id is null then
    return;
  end if;

  select
    coalesce(round(avg(cr.rating)::numeric, 2), 0),
    count(*)::integer
  into v_avg, v_count
  from public.company_reviews cr
  where cr.company_id = p_company_id
    and cr.is_visible = true;

  update public.companies c
  set
    rating_avg = coalesce(v_avg, 0),
    review_count = coalesce(v_count, 0),
    updated_at = now()
  where c.id = p_company_id;
end;
$$;

create or replace function public.company_reviews_stats_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_company_review_stats(old.company_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.company_id is distinct from new.company_id then
      perform public.refresh_company_review_stats(old.company_id);
    end if;
    perform public.refresh_company_review_stats(new.company_id);
    return new;
  end if;

  perform public.refresh_company_review_stats(new.company_id);
  return new;
end;
$$;

drop trigger if exists company_reviews_stats_after_insert on public.company_reviews;
create trigger company_reviews_stats_after_insert
  after insert on public.company_reviews
  for each row
  execute function public.company_reviews_stats_trigger_fn();

drop trigger if exists company_reviews_stats_after_update on public.company_reviews;
create trigger company_reviews_stats_after_update
  after update on public.company_reviews
  for each row
  execute function public.company_reviews_stats_trigger_fn();

drop trigger if exists company_reviews_stats_after_delete on public.company_reviews;
create trigger company_reviews_stats_after_delete
  after delete on public.company_reviews
  for each row
  execute function public.company_reviews_stats_trigger_fn();

-- -----------------------------------------------------------------------------
-- 4. RLS（company_reviews）
-- -----------------------------------------------------------------------------
alter table public.company_reviews enable row level security;

drop policy if exists "company_reviews_select_visible" on public.company_reviews;
create policy "company_reviews_select_visible"
  on public.company_reviews
  for select
  to anon, authenticated
  using (is_visible = true);

drop policy if exists "company_reviews_insert_own" on public.company_reviews;
create policy "company_reviews_insert_own"
  on public.company_reviews
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "company_reviews_update_own" on public.company_reviews;
create policy "company_reviews_update_own"
  on public.company_reviews
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "company_reviews_delete_own" on public.company_reviews;
create policy "company_reviews_delete_own"
  on public.company_reviews
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 開発用: 集計・シード確認のため service role / SQL Editor からは RLS をバイパス

-- -----------------------------------------------------------------------------
-- 5. デモ seed（company_id が解決できた場合のみ・失敗しても続行）
-- demo-biz-pr-2: business_listings.form_data->>'demo_id' または会社名で紐づけ
-- -----------------------------------------------------------------------------
do $$
declare
  v_company_id uuid;
  v_listing_id uuid;
  v_demo_user_id uuid := '00000000-0000-4000-b000-000000000001';
begin
  -- 掲載から company を解決（demo_id 優先 → 会社名）
  select bl.company_id, bl.id
  into v_company_id, v_listing_id
  from public.business_listings bl
  where bl.company_id is not null
    and (
      coalesce(bl.form_data->>'demo_id', '') = 'demo-biz-pr-2'
      or bl.company_name = 'TASFUL送迎サービス'
    )
  order by case when coalesce(bl.form_data->>'demo_id', '') = 'demo-biz-pr-2' then 0 else 1 end
  limit 1;

  if v_company_id is null then
    select bl.id into v_listing_id
    from public.business_listings bl
    where coalesce(bl.form_data->>'demo_id', '') = 'demo-biz-pr-2'
       or bl.company_name = 'TASFUL送迎サービス'
    order by case when coalesce(bl.form_data->>'demo_id', '') = 'demo-biz-pr-2' then 0 else 1 end
    limit 1;

    if v_listing_id is not null then
      select c.id into v_company_id
      from public.companies c
      inner join public.business_listings bl on bl.id = v_listing_id and bl.company_name = c.name
      limit 1;

      if v_company_id is null then
        insert into public.companies (name)
        select bl.company_name
        from public.business_listings bl
        where bl.id = v_listing_id
        returning id into v_company_id;
      end if;

      update public.business_listings
      set company_id = v_company_id
      where id = v_listing_id
        and company_id is distinct from v_company_id;
    end if;
  end if;

  if v_company_id is null then
    raise notice 'company_reviews demo seed skipped: company_id not found for demo-biz-pr-2';
    return;
  end if;

  -- ダミーレビュー4件（既に同一会社・同一コメントがあればスキップ）
  if exists (
    select 1
    from public.company_reviews cr
    where cr.company_id = v_company_id
      and cr.comment like '成田空港までの送迎で利用しました%'
    limit 1
  ) then
    raise notice 'company_reviews demo seed skipped: sample reviews already exist';
    perform public.refresh_company_review_stats(v_company_id);
    return;
  end if;

  insert into public.company_reviews (
    company_id,
    user_id,
    reviewer_name,
    rating,
    title,
    comment,
    service_type,
    listing_id,
    is_verified,
    is_visible,
    created_at
  )
  values
    (
      v_company_id,
      v_demo_user_id,
      null,
      5,
      '東京都 / 法人利用',
      '成田空港までの送迎で利用しました。時間通りに到着して、荷物対応も丁寧でした。',
      '空港送迎,法人利用',
      v_listing_id,
      false,
      true,
      '2026-05-12 10:00:00+09'::timestamptz
    ),
    (
      v_company_id,
      v_demo_user_id,
      null,
      5,
      '千葉県 / 個人利用',
      '深夜便でしたがスムーズに対応してもらえました。事前連絡もあり安心できました。',
      '深夜対応,空港送迎',
      v_listing_id,
      false,
      true,
      '2026-05-08 10:00:00+09'::timestamptz
    ),
    (
      v_company_id,
      v_demo_user_id,
      null,
      5,
      '東京都 / 法人契約',
      '法人契約で継続利用しています。請求書対応もできるので助かっています。',
      '法人契約,インボイス対応',
      v_listing_id,
      true,
      true,
      '2026-05-01 10:00:00+09'::timestamptz
    ),
    (
      v_company_id,
      v_demo_user_id,
      null,
      5,
      '埼玉県 / 企業利用',
      '来客送迎で利用しました。車内も清潔で、対応も落ち着いていました。',
      'VIP送迎,予約対応',
      v_listing_id,
      false,
      true,
      '2026-04-28 10:00:00+09'::timestamptz
    );

  perform public.refresh_company_review_stats(v_company_id);
  raise notice 'company_reviews demo seed inserted for company_id=%', v_company_id;
exception
  when others then
    raise notice 'company_reviews demo seed failed (skipped): %', sqlerrm;
end;
$$;

-- 手動で demo-biz-pr-2 を紐づける場合（任意）:
-- update public.business_listings
-- set form_data = coalesce(form_data, '{}'::jsonb) || '{"demo_id":"demo-biz-pr-2"}'::jsonb
-- where company_name = 'TASFUL送迎サービス';
-- その後このファイル末尾の DO ブロック相当の refresh は insert 時トリガーで自動反映されます。
