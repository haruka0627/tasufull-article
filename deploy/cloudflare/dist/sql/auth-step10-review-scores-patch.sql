-- =============================================================================
-- STEP 10-EXEC — AUTH-H-1 review_scores 修正
-- 目的:
--   - 公開詳細: public_review_scores view 経由（集計のみ）
--   - authenticated 全行 READ 禁止（旧 review_scores_select_authenticated 撤去）
--   - クライアント direct upsert 禁止（reviews INSERT 後 trigger で同期）
-- 前提: talk-rls-production.sql · auth-step8-legacy-chat-rls-proposal.sql 適用済み
-- 適用: 本番 GO 直前（inventory / snapshot / rollback 準備後）
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) 公開 view（集計列のみ · user_id は公開 seller id）
-- ---------------------------------------------------------------------------
drop view if exists public.public_review_scores cascade;

create view public.public_review_scores as
select
  user_id,
  average_rating,
  total_reviews,
  skipped_reviews,
  updated_at
from public.review_scores;

comment on view public.public_review_scores is
  'AUTH-H-1: 公開 UI 向け信頼スコア（集計のみ）。base review_scores 直読は RLS で拒否。';

grant select on public.public_review_scores to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) base table SELECT ポリシー — 本人 / admin のみ（全行 READ 撤去）
-- ---------------------------------------------------------------------------
alter table public.review_scores enable row level security;

drop policy if exists "review_scores_select_public" on public.review_scores;
drop policy if exists "review_scores_select_authenticated" on public.review_scores;
drop policy if exists "review_scores_select_own" on public.review_scores;

create policy "review_scores_select_own"
  on public.review_scores for select to authenticated
  using (
    user_id = public.talk_current_user_id()
    or public.talk_is_admin()
  );

-- anon / authenticated の base 直 SELECT は上記以外拒否。
-- 公開閲覧は public_review_scores を使用（view owner 経由で集計行を公開）。

-- INSERT/UPDATE/DELETE: ポリシーなし → authenticated / anon は拒否（service_role + trigger のみ）

-- ---------------------------------------------------------------------------
-- 3) reviews INSERT 後に review_scores を SECURITY DEFINER で同期
--    （chat-reviews.js computeReviewScoreUpdate と同等ロジック）
-- ---------------------------------------------------------------------------
create or replace function public.review_scores_apply_review_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_total int;
  v_prev_skipped int;
  v_prev_avg numeric;
  v_rated_count int;
  v_new_total int;
  v_new_skipped int;
  v_new_avg numeric;
begin
  select
    coalesce(total_reviews, 0),
    coalesce(skipped_reviews, 0),
    coalesce(average_rating, 0)
  into v_prev_total, v_prev_skipped, v_prev_avg
  from public.review_scores
  where user_id = new.reviewed_user_id;

  if not found then
    v_prev_total := 0;
    v_prev_skipped := 0;
    v_prev_avg := 0;
  end if;

  v_rated_count := greatest(0, v_prev_total - v_prev_skipped);
  v_new_total := v_prev_total + 1;
  v_new_skipped := v_prev_skipped + case when new.is_skipped then 1 else 0 end;
  v_new_avg := v_prev_avg;

  if not new.is_skipped and new.rating is not null and new.rating between 1 and 5 then
    if v_rated_count = 0 then
      v_new_avg := new.rating;
    else
      v_new_avg := (v_prev_avg * v_rated_count + new.rating) / (v_rated_count + 1);
    end if;
    v_new_avg := round(v_new_avg * 100) / 100;
  end if;

  insert into public.review_scores (
    user_id,
    average_rating,
    total_reviews,
    skipped_reviews,
    updated_at
  )
  values (
    new.reviewed_user_id,
    v_new_avg,
    v_new_total,
    v_new_skipped,
    now()
  )
  on conflict (user_id) do update set
    average_rating = excluded.average_rating,
    total_reviews = excluded.total_reviews,
    skipped_reviews = excluded.skipped_reviews,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

comment on function public.review_scores_apply_review_row() is
  'AUTH-H-1: reviews 行 INSERT 後に review_scores を更新（クライアント upsert 不要）';

drop trigger if exists review_scores_apply_review_row_trg on public.reviews;

create trigger review_scores_apply_review_row_trg
  after insert on public.reviews
  for each row
  execute function public.review_scores_apply_review_row();

-- ---------------------------------------------------------------------------
-- 事後確認（読取のみ）
-- ---------------------------------------------------------------------------
-- select policyname, qual from pg_policies where tablename = 'review_scores';
-- select * from public.public_review_scores limit 3;
