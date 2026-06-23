-- TASFUL MATCH — RLS / policies / public view draft (do not apply without review)
-- Prerequisite: supabase/migrations/20260621120000_match_schema_draft.sql
-- Ref: reports/match-schema-draft-review.md
--
-- APPLY ORDER (staging):
--   1) 20260621120000_match_schema_draft.sql
--   2) this file
--
-- AUTH: user_id is text. Compare with auth.uid()::text everywhere.
-- SERVICE_ROLE: Supabase service_role bypasses RLS (Edge Functions).
--
-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.match_current_user_id()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select nullif(auth.uid()::text, '');
$$;

comment on function public.match_current_user_id() is
  'Returns authenticated member id as text (auth.uid() cast). NULL when unauthenticated.';

-- Active MATCH-scoped sanctions that hide profile from discovery
create or replace function public.match_has_active_match_ban(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_sanctions s
    where s.user_id = p_user_id
      and s.scope = 'match'
      and s.revoked_at is null
      and s.archived_at is null
      and s.starts_at <= now()
      and (s.ends_at is null or s.ends_at > now())
      and s.sanction_type in ('feature_restrict', 'temporary_ban', 'permanent_ban')
  );
$$;

comment on function public.match_has_active_match_ban(text) is
  'True when user has an active MATCH ban/restriction. Used by match_profiles_public.';

-- Bidirectional active block between two users
create or replace function public.match_users_are_blocked(p_user_a text, p_user_b text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_blocks b
    where b.block_status = 'active'
      and b.archived_at is null
      and (
        (b.blocker_user_id = p_user_a and b.blocked_user_id = p_user_b)
        or (b.blocker_user_id = p_user_b and b.blocked_user_id = p_user_a)
      )
  );
$$;

comment on function public.match_users_are_blocked(text, text) is
  'True when either user has an active block against the other.';

-- ---------------------------------------------------------------------------
-- Public profile view (swipe / discovery)
-- ---------------------------------------------------------------------------
-- Notes:
--   - Runs as view owner (security_invoker = false) to read base tables while
--     base-table RLS denies cross-user SELECT on match_profiles.
--   - is_visible: no column yet — profile_status = ''active'' is the proxy.
--   - main_photo_url: storage_path; signed URL generation is app/Edge layer.
--   - age: computed from birth_date; birth_date itself is NOT exposed.
--   - Requires authenticated viewer for block filtering (auth.uid()::text).

create or replace view public.match_profiles_public
with (security_invoker = false)
as
select
  p.id as profile_id,
  p.user_id,
  p.nickname as display_name,
  extract(year from age(current_date, p.birth_date))::integer as age,
  p.prefecture,
  p.city,
  p.bio,
  p.verification_status,
  ph.storage_path as main_photo_url,
  coalesce(
    (
      select array_agg(ht.label_ja order by pht.display_order)
      from public.match_profile_hobby_tags pht
      inner join public.match_hobby_tags ht on ht.id = pht.hobby_tag_id
      where pht.profile_id = p.id
        and ht.is_active = true
    ),
    '{}'::text[]
  ) as hobby_tags,
  p.last_active_at,
  p.created_at
from public.match_profiles p
left join public.match_profile_photos ph
  on ph.id = p.main_photo_id
  and ph.photo_status = 'active'
  and ph.archived_at is null
  and ph.moderation_status = 'approved'
where p.profile_status = 'active'
  and p.archived_at is null
  -- is_visible proxy (future: and p.is_visible = true)
  and not public.match_has_active_match_ban(p.user_id)
  and public.match_current_user_id() is not null
  and p.user_id <> public.match_current_user_id()
  and not public.match_users_are_blocked(public.match_current_user_id(), p.user_id);

comment on view public.match_profiles_public is
  'Discoverable MATCH profiles for swipe/list. Excludes PII, sanctions, blocks. Authenticated only.';

-- Optional: allow own public row for preview (usually use match_profiles instead)
-- create or replace view public.match_profiles_public_including_self ...

-- ---------------------------------------------------------------------------
-- Grants (apply with policies — commented for draft)
-- ---------------------------------------------------------------------------
-- grant select on public.match_profiles_public to authenticated;
-- grant select on public.match_hobby_tags to authenticated, anon;
-- revoke all on public.match_profiles from anon;
-- revoke all on public.match_sanctions from authenticated, anon;
-- revoke all on public.match_moderation_logs from authenticated, anon;

-- ---------------------------------------------------------------------------
-- RLS enable (commented — enabling without policies locks out clients)
-- ---------------------------------------------------------------------------
-- alter table public.match_profiles enable row level security;
-- alter table public.match_profile_photos enable row level security;
-- alter table public.match_profile_hobby_tags enable row level security;
-- alter table public.match_swipes enable row level security;
-- alter table public.match_pairs enable row level security;
-- alter table public.match_blocks enable row level security;
-- alter table public.match_reports enable row level security;
-- alter table public.match_verifications enable row level security;
-- alter table public.match_sanctions enable row level security;
-- alter table public.match_moderation_logs enable row level security;
-- alter table public.match_daily_limits enable row level security;
-- alter table public.match_hobby_tags enable row level security;

-- ---------------------------------------------------------------------------
-- match_hobby_tags — public read-only master
-- ---------------------------------------------------------------------------
-- create policy match_hobby_tags_select_all
--   on public.match_hobby_tags
--   for select
--   to authenticated, anon
--   using (is_active = true);
--
-- -- Writes: service_role / admin only (no client policy)

-- ---------------------------------------------------------------------------
-- match_profiles
-- ---------------------------------------------------------------------------
-- Owner: SELECT / INSERT / UPDATE. No DELETE. No cross-user SELECT on base table.
--
-- create policy match_profiles_select_own
--   on public.match_profiles
--   for select
--   to authenticated
--   using (user_id = public.match_current_user_id());
--
-- create policy match_profiles_insert_own
--   on public.match_profiles
--   for insert
--   to authenticated
--   with check (
--     user_id = public.match_current_user_id()
--     and profile_status in ('draft', 'active', 'hidden')
--   );
--
-- create policy match_profiles_update_own
--   on public.match_profiles
--   for update
--   to authenticated
--   using (user_id = public.match_current_user_id())
--   with check (
--     user_id = public.match_current_user_id()
--     and profile_status in ('draft', 'active', 'hidden')
--     -- DANGER: prevent client from self-approving verification
--     and verification_status = (select mp.verification_status from public.match_profiles mp where mp.id = match_profiles.id)
--   );
--
-- -- Safer alternative for verification_status: column-level update only via Edge.
-- -- Use trigger match_profiles_prevent_client_verification_change() in a later migration.

-- ---------------------------------------------------------------------------
-- match_profile_photos
-- ---------------------------------------------------------------------------
-- Owner: SELECT / INSERT / UPDATE (archived_at, display_order). No DELETE.
--
-- create policy match_profile_photos_select_own
--   on public.match_profile_photos
--   for select
--   to authenticated
--   using (
--     exists (
--       select 1 from public.match_profiles mp
--       where mp.id = profile_id
--         and mp.user_id = public.match_current_user_id()
--     )
--   );
--
-- create policy match_profile_photos_insert_own
--   on public.match_profile_photos
--   for insert
--   to authenticated
--   with check (
--     exists (
--       select 1 from public.match_profiles mp
--       where mp.id = profile_id
--         and mp.user_id = public.match_current_user_id()
--     )
--   );
--
-- create policy match_profile_photos_update_own
--   on public.match_profile_photos
--   for update
--   to authenticated
--   using (
--     exists (
--       select 1 from public.match_profiles mp
--       where mp.id = profile_id
--         and mp.user_id = public.match_current_user_id()
--     )
--   )
--   with check (
--     exists (
--       select 1 from public.match_profiles mp
--       where mp.id = profile_id
--         and mp.user_id = public.match_current_user_id()
--     )
--   );

-- ---------------------------------------------------------------------------
-- match_profile_hobby_tags
-- ---------------------------------------------------------------------------
-- Owner: SELECT / INSERT / DELETE (join rows). Prefer DELETE over physical cascade.
--
-- create policy match_profile_hobby_tags_select_own
--   on public.match_profile_hobby_tags
--   for select
--   to authenticated
--   using (
--     exists (
--       select 1 from public.match_profiles mp
--       where mp.id = profile_id
--         and mp.user_id = public.match_current_user_id()
--     )
--   );
--
-- create policy match_profile_hobby_tags_insert_own
--   on public.match_profile_hobby_tags
--   for insert
--   to authenticated
--   with check (
--     exists (
--       select 1 from public.match_profiles mp
--       where mp.id = profile_id
--         and mp.user_id = public.match_current_user_id()
--     )
--   );
--
-- create policy match_profile_hobby_tags_delete_own
--   on public.match_profile_hobby_tags
--   for delete
--   to authenticated
--   using (
--     exists (
--       select 1 from public.match_profiles mp
--       where mp.id = profile_id
--         and mp.user_id = public.match_current_user_id()
--     )
--   );

-- ---------------------------------------------------------------------------
-- match_swipes
-- ---------------------------------------------------------------------------
-- Production recommendation: INSERT via Edge only (see commented client policy).
-- SELECT: swiper sees own rows only (target cannot see incoming likes).
--
-- create policy match_swipes_select_own
--   on public.match_swipes
--   for select
--   to authenticated
--   using (swiper_user_id = public.match_current_user_id());
--
-- -- OPTIONAL client INSERT (dev / MVP). Prefer Edge Function in production.
-- create policy match_swipes_insert_own
--   on public.match_swipes
--   for insert
--   to authenticated
--   with check (
--     swiper_user_id = public.match_current_user_id()
--     and swiper_user_id <> target_user_id
--     and action in ('like', 'skip')
--   );
--
-- -- No UPDATE / DELETE policies (denied by default)

-- ---------------------------------------------------------------------------
-- match_pairs
-- ---------------------------------------------------------------------------
-- Participant SELECT only. All writes via service_role / Edge.
--
-- create policy match_pairs_select_participant
--   on public.match_pairs
--   for select
--   to authenticated
--   using (
--     public.match_current_user_id() in (user_low_id, user_high_id)
--   );
--
-- -- No INSERT / UPDATE / DELETE for authenticated

-- ---------------------------------------------------------------------------
-- match_blocks
-- ---------------------------------------------------------------------------
-- Blocker: SELECT / INSERT. Unblock via UPDATE archived_at + block_status.
-- Blocked user must NOT see the row.
--
-- create policy match_blocks_select_blocker
--   on public.match_blocks
--   for select
--   to authenticated
--   using (blocker_user_id = public.match_current_user_id());
--
-- create policy match_blocks_insert_blocker
--   on public.match_blocks
--   for insert
--   to authenticated
--   with check (
--     blocker_user_id = public.match_current_user_id()
--     and blocker_user_id <> blocked_user_id
--     and block_status = 'active'
--   );
--
-- create policy match_blocks_update_unblock
--   on public.match_blocks
--   for update
--   to authenticated
--   using (blocker_user_id = public.match_current_user_id())
--   with check (
--     blocker_user_id = public.match_current_user_id()
--     and block_status in ('active', 'archived')
--   );
--
-- -- Pair status sync (blocked) should run in Edge after block INSERT.

-- ---------------------------------------------------------------------------
-- match_reports
-- ---------------------------------------------------------------------------
-- Reporter: INSERT / SELECT own. Status changes: service_role only.
--
-- create policy match_reports_select_reporter
--   on public.match_reports
--   for select
--   to authenticated
--   using (reporter_user_id = public.match_current_user_id());
--
-- create policy match_reports_insert_reporter
--   on public.match_reports
--   for insert
--   to authenticated
--   with check (
--     reporter_user_id = public.match_current_user_id()
--     and reporter_user_id <> reported_user_id
--     and status = 'open'
--   );
--
-- -- No UPDATE for authenticated (admin / Edge updates status)

-- ---------------------------------------------------------------------------
-- match_verifications
-- ---------------------------------------------------------------------------
-- Owner: INSERT / SELECT own rows. Sensitive columns remain in row — filter in API.
-- Status / review fields: service_role only.
--
-- create policy match_verifications_select_own
--   on public.match_verifications
--   for select
--   to authenticated
--   using (user_id = public.match_current_user_id());
--
-- create policy match_verifications_insert_own
--   on public.match_verifications
--   for insert
--   to authenticated
--   with check (
--     user_id = public.match_current_user_id()
--     and status in ('pending', 'phone_verified', 'submitted')
--   );
--
-- -- DANGER: add trigger to block client UPDATE of status, reviewed_by, metadata_json.

-- ---------------------------------------------------------------------------
-- match_sanctions
-- ---------------------------------------------------------------------------
-- No client SELECT/INSERT/UPDATE. Ban visibility absorbed by match_profiles_public.
-- service_role bypasses RLS.
--
-- (intentionally no policies for authenticated / anon)

-- ---------------------------------------------------------------------------
-- match_moderation_logs
-- ---------------------------------------------------------------------------
-- No client access. Edge / service_role only.
--
-- (intentionally no policies for authenticated / anon)

-- ---------------------------------------------------------------------------
-- match_daily_limits
-- ---------------------------------------------------------------------------
-- Owner SELECT only. Upsert via Edge (swipe quota).
--
-- create policy match_daily_limits_select_own
--   on public.match_daily_limits
--   for select
--   to authenticated
--   using (user_id = public.match_current_user_id());
--
-- -- No INSERT / UPDATE for authenticated

-- ---------------------------------------------------------------------------
-- Optional triggers (later migration)
-- ---------------------------------------------------------------------------
-- create or replace function public.match_profiles_guard_verification_status()
-- returns trigger language plpgsql as $$
-- begin
--   if new.verification_status is distinct from old.verification_status
--      and current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
--     raise exception 'verification_status is read-only for clients';
--   end if;
--   return new;
-- end;
-- $$;

-- ---------------------------------------------------------------------------
-- View hardening (apply after grants)
-- ---------------------------------------------------------------------------
-- revoke all on public.match_profiles_public from public;
-- grant select on public.match_profiles_public to authenticated;
