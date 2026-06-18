-- =============================================================================
-- STEP 10-EXEC — ロールバック SQL（緊急時のみ）
-- 適用前に pg_policies スナップショットを reports/auth-step10-prod-policies-snapshot.json に保存すること
-- =============================================================================

-- =============================================================================
-- §A AUTH-H-1 review_scores パッチのロールバック
--    適用: auth-step10-review-scores-patch.sql の直後に問題が出た場合
-- =============================================================================

drop trigger if exists review_scores_apply_review_row_trg on public.reviews;
drop function if exists public.review_scores_apply_review_row();

drop policy if exists "review_scores_select_own" on public.review_scores;

-- STEP 8B 適用直後の状態に戻す（authenticated 全行 READ — セキュリティ後退）
drop policy if exists "review_scores_select_authenticated" on public.review_scores;
create policy "review_scores_select_authenticated"
  on public.review_scores for select to authenticated
  using (user_id is not null or user_id is null);

drop view if exists public.public_review_scores cascade;

-- Allow all が必要な場合のみ（STEP 8 以前 · 最終手段）
-- drop policy if exists "Allow all review_scores" on public.review_scores;
-- create policy "Allow all review_scores"
--   on public.review_scores for all using (true) with check (true);

-- =============================================================================
-- §B legacy RLS（STEP 8B）のロールバック — 取引チャット全面不通時のみ
--    適用: auth-step8-legacy-chat-rls-proposal.sql の直後に問題が出た場合
--    警告: anon 全公開に戻る · 本番では一時措置のみ
-- =============================================================================

-- 8B 新規ポリシー DROP（代表）
drop policy if exists "transaction_rooms_select_participant" on public.transaction_rooms;
drop policy if exists "transaction_rooms_insert_participant" on public.transaction_rooms;
drop policy if exists "transaction_rooms_update_participant" on public.transaction_rooms;
drop policy if exists "transaction_messages_select_participant" on public.transaction_messages;
drop policy if exists "transaction_messages_insert_sender" on public.transaction_messages;
drop policy if exists "transaction_reads_select_own" on public.transaction_reads;
drop policy if exists "transaction_reads_upsert_own" on public.transaction_reads;
drop policy if exists "transaction_reads_update_own" on public.transaction_reads;
drop policy if exists "reviews_select_participant" on public.reviews;
drop policy if exists "reviews_insert_reviewer" on public.reviews;
drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_update_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;

drop function if exists public.transaction_room_participant(uuid);

-- 旧 Allow all 復元（STEP 8 以前）
create policy "Allow all transaction_rooms"
  on public.transaction_rooms for all using (true) with check (true);
create policy "Allow all transaction_messages"
  on public.transaction_messages for all using (true) with check (true);
create policy "Allow all transaction_reads"
  on public.transaction_reads for all using (true) with check (true);
create policy "Allow all chats"
  on public.chats for all using (true) with check (true);
create policy "Allow all ai_messages"
  on public.ai_messages for all using (true) with check (true);
create policy "Allow all reviews"
  on public.reviews for all using (true) with check (true);
create policy "Allow all review_scores"
  on public.review_scores for all using (true) with check (true);
create policy "Allow all blocked_users"
  on public.blocked_users for all using (true) with check (true);
create policy "Allow all usage"
  on public.monthly_usage for all using (true) with check (true);

-- favorites 旧 public ポリシー（存在していた場合）
drop policy if exists "favorites_select" on public.favorites;
drop policy if exists "favorites_insert" on public.favorites;
drop policy if exists "favorites_update" on public.favorites;
drop policy if exists "favorites_delete" on public.favorites;

create policy "favorites_select" on public.favorites for select using (true);
create policy "favorites_insert" on public.favorites for insert with check (true);
create policy "favorites_update" on public.favorites for update using (true);
create policy "favorites_delete" on public.favorites for delete using (true);

-- =============================================================================
-- 事後: inventory 再取得 · 障害記録 · 再適用は auth-step10-exec-prep.md の手順に従う
-- =============================================================================
