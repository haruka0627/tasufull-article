-- P15-L1 RLS (linked ref ddojquacsyqesrjhcvmn)
-- Prerequisite: 20260622190000_match_p15_l1_schema.sql
-- Ref: reports/tasful-match-p15-l1-migration-draft.md
--
-- Scope:
--   - Enable RLS + policies on 6 NEW P15 objects only
--   - Adds 14 policies (core 8 tables remain at 20 policies — DO NOT MODIFY)
--   - match_profile_views: SELECT incoming only; INSERT via Edge/service_role
--
-- Apply order: AFTER 20260622190000_match_p15_l1_schema.sql
--
-- ROLLBACK (manual · staging only):
--   Run ROLLBACK block at bottom of this file FIRST, then schema file rollback.

-- ---------------------------------------------------------------------------
-- Enable RLS (new tables only)
-- ---------------------------------------------------------------------------

alter table public.match_hobby_tags enable row level security;
alter table public.match_profile_hobby_tags enable row level security;
alter table public.match_favorites enable row level security;
alter table public.match_profile_views enable row level security;
alter table public.match_saved_searches enable row level security;
alter table public.match_user_settings enable row level security;

revoke all on public.match_hobby_tags from anon;
revoke all on public.match_profile_hobby_tags from anon;
revoke all on public.match_favorites from anon;
revoke all on public.match_profile_views from anon;
revoke all on public.match_saved_searches from anon;
revoke all on public.match_user_settings from anon;

-- ---------------------------------------------------------------------------
-- match_hobby_tags — read active master
-- ---------------------------------------------------------------------------

drop policy if exists match_hobby_tags_select_active on public.match_hobby_tags;
create policy match_hobby_tags_select_active
  on public.match_hobby_tags for select to authenticated
  using (is_active = true);

-- ---------------------------------------------------------------------------
-- match_profile_hobby_tags — owner join
-- ---------------------------------------------------------------------------

drop policy if exists match_profile_hobby_tags_select_own on public.match_profile_hobby_tags;
create policy match_profile_hobby_tags_select_own
  on public.match_profile_hobby_tags for select to authenticated
  using (
    exists (
      select 1 from public.match_profiles mp
      where mp.id = profile_id and mp.user_id = public.match_current_user_id()
    )
  );

drop policy if exists match_profile_hobby_tags_insert_own on public.match_profile_hobby_tags;
create policy match_profile_hobby_tags_insert_own
  on public.match_profile_hobby_tags for insert to authenticated
  with check (
    exists (
      select 1 from public.match_profiles mp
      where mp.id = profile_id and mp.user_id = public.match_current_user_id()
    )
  );

drop policy if exists match_profile_hobby_tags_delete_own on public.match_profile_hobby_tags;
create policy match_profile_hobby_tags_delete_own
  on public.match_profile_hobby_tags for delete to authenticated
  using (
    exists (
      select 1 from public.match_profiles mp
      where mp.id = profile_id and mp.user_id = public.match_current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- match_favorites
-- ---------------------------------------------------------------------------

drop policy if exists match_favorites_select_own on public.match_favorites;
create policy match_favorites_select_own
  on public.match_favorites for select to authenticated
  using (owner_user_id = public.match_current_user_id());

drop policy if exists match_favorites_insert_own on public.match_favorites;
create policy match_favorites_insert_own
  on public.match_favorites for insert to authenticated
  with check (
    owner_user_id = public.match_current_user_id()
    and owner_user_id <> target_user_id
    and not public.match_users_are_blocked(owner_user_id, target_user_id)
    and archived_at is null
  );

drop policy if exists match_favorites_update_own on public.match_favorites;
create policy match_favorites_update_own
  on public.match_favorites for update to authenticated
  using (owner_user_id = public.match_current_user_id())
  with check (owner_user_id = public.match_current_user_id());

-- ---------------------------------------------------------------------------
-- match_profile_views — incoming only · writes via Edge/service_role
-- ---------------------------------------------------------------------------

drop policy if exists match_profile_views_select_incoming on public.match_profile_views;
create policy match_profile_views_select_incoming
  on public.match_profile_views for select to authenticated
  using (
    viewed_user_id = public.match_current_user_id()
    and not public.match_users_are_blocked(viewer_user_id, viewed_user_id)
  );

-- ---------------------------------------------------------------------------
-- match_saved_searches
-- ---------------------------------------------------------------------------

drop policy if exists match_saved_searches_select_own on public.match_saved_searches;
create policy match_saved_searches_select_own
  on public.match_saved_searches for select to authenticated
  using (user_id = public.match_current_user_id());

drop policy if exists match_saved_searches_insert_own on public.match_saved_searches;
create policy match_saved_searches_insert_own
  on public.match_saved_searches for insert to authenticated
  with check (user_id = public.match_current_user_id());

drop policy if exists match_saved_searches_update_own on public.match_saved_searches;
create policy match_saved_searches_update_own
  on public.match_saved_searches for update to authenticated
  using (user_id = public.match_current_user_id())
  with check (user_id = public.match_current_user_id());

-- ---------------------------------------------------------------------------
-- match_user_settings
-- ---------------------------------------------------------------------------

drop policy if exists match_user_settings_select_own on public.match_user_settings;
create policy match_user_settings_select_own
  on public.match_user_settings for select to authenticated
  using (user_id = public.match_current_user_id());

drop policy if exists match_user_settings_insert_own on public.match_user_settings;
create policy match_user_settings_insert_own
  on public.match_user_settings for insert to authenticated
  with check (user_id = public.match_current_user_id());

drop policy if exists match_user_settings_update_own on public.match_user_settings;
create policy match_user_settings_update_own
  on public.match_user_settings for update to authenticated
  using (user_id = public.match_current_user_id())
  with check (user_id = public.match_current_user_id());

-- ---------------------------------------------------------------------------
-- ROLLBACK (run BEFORE schema file rollback · manual staging only)
-- ---------------------------------------------------------------------------
-- drop policy if exists match_user_settings_update_own on public.match_user_settings;
-- drop policy if exists match_user_settings_insert_own on public.match_user_settings;
-- drop policy if exists match_user_settings_select_own on public.match_user_settings;
-- drop policy if exists match_saved_searches_update_own on public.match_saved_searches;
-- drop policy if exists match_saved_searches_insert_own on public.match_saved_searches;
-- drop policy if exists match_saved_searches_select_own on public.match_saved_searches;
-- drop policy if exists match_profile_views_select_incoming on public.match_profile_views;
-- drop policy if exists match_favorites_update_own on public.match_favorites;
-- drop policy if exists match_favorites_insert_own on public.match_favorites;
-- drop policy if exists match_favorites_select_own on public.match_favorites;
-- drop policy if exists match_profile_hobby_tags_delete_own on public.match_profile_hobby_tags;
-- drop policy if exists match_profile_hobby_tags_insert_own on public.match_profile_hobby_tags;
-- drop policy if exists match_profile_hobby_tags_select_own on public.match_profile_hobby_tags;
-- drop policy if exists match_hobby_tags_select_active on public.match_hobby_tags;
-- alter table public.match_user_settings disable row level security;
-- alter table public.match_saved_searches disable row level security;
-- alter table public.match_profile_views disable row level security;
-- alter table public.match_favorites disable row level security;
-- alter table public.match_profile_hobby_tags disable row level security;
-- alter table public.match_hobby_tags disable row level security;
-- Verify: core_policy_count=20 on core 8 tables unchanged
