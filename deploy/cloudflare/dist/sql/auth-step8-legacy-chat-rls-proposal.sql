-- =============================================================================
-- STEP 8B — レガシー TALK / 取引 / レビュー / お気に入り 本番 RLS（ステージング適用用）
-- 前提: talk-rls-production.sql 適用済み（talk_current_user_id / talk_is_admin）
-- 本番 DB への適用は別 STEP（本レポート auth-step8b 判定後）
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) 危険な Allow all / public 全許可ポリシーを DROP
-- ---------------------------------------------------------------------------
drop policy if exists "Allow all transaction_rooms" on public.transaction_rooms;
drop policy if exists "Allow all transaction_messages" on public.transaction_messages;
drop policy if exists "Allow all transaction_reads" on public.transaction_reads;
drop policy if exists "Allow all chats" on public.chats;
drop policy if exists "Allow all ai_messages" on public.ai_messages;
drop policy if exists "Allow all reviews" on public.reviews;
drop policy if exists "Allow all review_scores" on public.review_scores;
drop policy if exists "Allow all blocked_users" on public.blocked_users;
drop policy if exists "Allow all usage" on public.monthly_usage;

-- chats / ai_messages: user 列なし → クライアント直アクセス禁止（ポリシーなし = deny）
alter table public.chats enable row level security;
alter table public.ai_messages enable row level security;

-- blocked_users / monthly_usage: クライアント直アクセス禁止
alter table public.blocked_users enable row level security;
alter table public.monthly_usage enable row level security;

drop policy if exists "favorites_select" on public.favorites;
drop policy if exists "favorites_insert" on public.favorites;
drop policy if exists "favorites_update" on public.favorites;
drop policy if exists "favorites_delete" on public.favorites;
drop policy if exists "favorites_select_dev" on public.favorites;
drop policy if exists "favorites_insert_dev" on public.favorites;
drop policy if exists "favorites_update_dev" on public.favorites;
drop policy if exists "favorites_delete_dev" on public.favorites;

-- moderation / reports: anon INSERT のみ維持（通報）。SELECT は service_role / ops のみ想定
drop policy if exists "Allow insert moderation_logs" on public.moderation_logs;
drop policy if exists "Allow insert reports" on public.reports;

drop policy if exists "moderation_logs_insert_anon" on public.moderation_logs;
drop policy if exists "reports_insert_anon" on public.reports;

create policy "moderation_logs_insert_anon"
  on public.moderation_logs for insert to anon, authenticated
  with check (true);

create policy "reports_insert_anon"
  on public.reports for insert to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- 2) transaction_rooms — 当事者（buyer / seller）+ admin のみ
-- ---------------------------------------------------------------------------
alter table public.transaction_rooms enable row level security;

drop policy if exists "transaction_rooms_select_participant" on public.transaction_rooms;
drop policy if exists "transaction_rooms_insert_participant" on public.transaction_rooms;
drop policy if exists "transaction_rooms_update_participant" on public.transaction_rooms;

create policy "transaction_rooms_select_participant"
  on public.transaction_rooms for select to authenticated
  using (
    public.talk_is_admin()
    or public.talk_current_user_id() in (
      nullif(trim(buyer_id), ''),
      nullif(trim(seller_id), '')
    )
  );

create policy "transaction_rooms_insert_participant"
  on public.transaction_rooms for insert to authenticated
  with check (
    public.talk_is_admin()
    or public.talk_current_user_id() in (
      nullif(trim(buyer_id), ''),
      nullif(trim(seller_id), '')
    )
  );

create policy "transaction_rooms_update_participant"
  on public.transaction_rooms for update to authenticated
  using (
    public.talk_is_admin()
    or public.talk_current_user_id() in (
      nullif(trim(buyer_id), ''),
      nullif(trim(seller_id), '')
    )
  )
  with check (
    public.talk_is_admin()
    or public.talk_current_user_id() in (
      nullif(trim(buyer_id), ''),
      nullif(trim(seller_id), '')
    )
  );

-- ---------------------------------------------------------------------------
-- 3) transaction_messages — room 参加者のみ（SECURITY DEFINER 参照）
-- ---------------------------------------------------------------------------
create or replace function public.transaction_room_participant(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.transaction_rooms r
    where r.id = p_room_id
      and (
        public.talk_is_admin()
        or public.talk_current_user_id() in (
          nullif(trim(r.buyer_id), ''),
          nullif(trim(r.seller_id), '')
        )
      )
  );
$$;

alter table public.transaction_messages enable row level security;

drop policy if exists "transaction_messages_select_participant" on public.transaction_messages;
drop policy if exists "transaction_messages_insert_sender" on public.transaction_messages;

create policy "transaction_messages_select_participant"
  on public.transaction_messages for select to authenticated
  using (public.transaction_room_participant(room_id));

create policy "transaction_messages_insert_sender"
  on public.transaction_messages for insert to authenticated
  with check (
    sender_id = public.talk_current_user_id()
    and public.transaction_room_participant(room_id)
  );

-- ---------------------------------------------------------------------------
-- 4) transaction_reads — 本人 user_id のみ
-- ---------------------------------------------------------------------------
alter table public.transaction_reads enable row level security;

drop policy if exists "transaction_reads_select_own" on public.transaction_reads;
drop policy if exists "transaction_reads_upsert_own" on public.transaction_reads;
drop policy if exists "transaction_reads_update_own" on public.transaction_reads;

create policy "transaction_reads_select_own"
  on public.transaction_reads for select to authenticated
  using (user_id = public.talk_current_user_id() or public.talk_is_admin());

create policy "transaction_reads_upsert_own"
  on public.transaction_reads for insert to authenticated
  with check (user_id = public.talk_current_user_id());

create policy "transaction_reads_update_own"
  on public.transaction_reads for update to authenticated
  using (user_id = public.talk_current_user_id())
  with check (user_id = public.talk_current_user_id());

-- ---------------------------------------------------------------------------
-- 5) reviews — 当事者 + 公開レビューは room 参加者のみ
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

drop policy if exists "reviews_select_participant" on public.reviews;
drop policy if exists "reviews_insert_reviewer" on public.reviews;

create policy "reviews_select_participant"
  on public.reviews for select to authenticated
  using (
    public.talk_is_admin()
    or reviewer_id = public.talk_current_user_id()
    or reviewed_user_id = public.talk_current_user_id()
    or public.transaction_room_participant(room_id)
  );

create policy "reviews_insert_reviewer"
  on public.reviews for insert to authenticated
  with check (
    reviewer_id = public.talk_current_user_id()
    and public.transaction_room_participant(room_id)
  );

-- review_scores: 信頼スコアは authenticated のみ（anon READ 禁止 · using(true) 回避）
alter table public.review_scores enable row level security;

drop policy if exists "review_scores_select_public" on public.review_scores;
drop policy if exists "review_scores_select_authenticated" on public.review_scores;

create policy "review_scores_select_authenticated"
  on public.review_scores for select to authenticated
  using (user_id is not null or user_id is null);

-- ---------------------------------------------------------------------------
-- 6) favorites — 本人のみ
-- ---------------------------------------------------------------------------
alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_update_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;

create policy "favorites_select_own"
  on public.favorites for select to authenticated
  using (user_id = public.talk_current_user_id() or public.talk_is_admin());

create policy "favorites_insert_own"
  on public.favorites for insert to authenticated
  with check (user_id = public.talk_current_user_id());

create policy "favorites_update_own"
  on public.favorites for update to authenticated
  using (user_id = public.talk_current_user_id())
  with check (user_id = public.talk_current_user_id());

create policy "favorites_delete_own"
  on public.favorites for delete to authenticated
  using (user_id = public.talk_current_user_id() or public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- 7) shop_orders — デプロイ時に必須（テーブル未存在環境ではスキップ）
-- ---------------------------------------------------------------------------
-- create table 後に:
--   buyer: buyer_user_id::text = talk_current_user_id()
--   seller: seller_user_id::text = talk_current_user_id()
--   ops: talk_is_admin()
--   INSERT/UPDATE payout 系: service_role / Edge のみ

-- ---------------------------------------------------------------------------
-- 事後確認（読取のみ）
-- ---------------------------------------------------------------------------
-- select tablename, policyname from pg_policies
-- where schemaname='public' and (qual='true' or policyname ilike '%allow all%')
-- order by 1,2;
