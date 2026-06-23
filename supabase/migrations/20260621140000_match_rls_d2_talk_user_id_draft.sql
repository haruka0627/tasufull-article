-- TASFUL MATCH — RLS D2 correction draft (talk_user_id JWT claim)
-- Prerequisite: supabase/migrations/20260621120000_match_schema_draft.sql
--              supabase/migrations/20260621130000_match_rls_draft.sql
-- Ref: reports/match-auth-boundary-design.md
--      reports/match-rls-d2-talk-user-id-draft-review.md
--
-- PURPOSE (D2 fix):
--   Original match_current_user_id() returned auth.uid()::text (Supabase UUID).
--   MATCH user_id is text in the TALK / TasuAuthCurrentUser.talkUserId space (e.g. u_me).
--   This correction draft replaces match_current_user_id() to read JWT talk_user_id.
--
-- DO NOT APPLY until all gates in section "APPLY GATES" are verified.
--   - No ALTER TABLE ... ENABLE ROW LEVEL SECURITY in this file
--   - No CREATE POLICY execution (policies remain commented reference only)
--   - Does not modify existing TASFUL Auth (auth-current-user.js, hooks, etc.)
--
-- APPLY ORDER (staging, after gates pass):
--   1) 20260621120000_match_schema_draft.sql
--   2) 20260621130000_match_rls_draft.sql
--   3) this file (replaces match_current_user_id; updates view comment only)
--
-- AUTH (corrected):
--   MATCH user_id = talk_user_id (text). Never compare user_id to auth.uid()::text alone.
--   All RLS / view logic must use public.match_current_user_id().
-- SERVICE_ROLE: Supabase service_role bypasses RLS (Edge Functions).
--
-- JWT CLAIM REQUIREMENT (Edge Function / client token provider — future work):
--   Supabase access tokens must expose talk_user_id so Postgres RLS can resolve the
--   same ID as TasuAuthCurrentUser.talkUserId and TALK buyer_id / seller_id.
--   Typical placement today: JWT app_metadata.talk_user_id (see auth-current-user.js).
--   Optional: Custom Access Token Hook may also mirror talk_user_id at JWT root.
--   This migration does NOT implement the hook — design is a separate step.
--
-- ---------------------------------------------------------------------------
-- APPLY GATES — this migration is NOT APPLICABLE until ALL are confirmed:
-- ---------------------------------------------------------------------------
-- [ ] Supabase JWT includes talk_user_id (app_metadata and/or root claim)
-- [ ] JWT talk_user_id equals TasuAuthCurrentUser.talkUserId for the same session
-- [ ] JWT talk_user_id equals TALK transaction_rooms.buyer_id / seller_id values
-- [ ] JWT talk_user_id equals match_profiles.user_id for seeded / migrated rows
-- [ ] RLS integration tests pass:
--       - owner SELECT on match_profiles (own row)
--       - cross-user SELECT denied on base match_profiles
--       - match_profiles_public returns others, excludes self / blocks / bans
--
-- ---------------------------------------------------------------------------
-- match_current_user_id() — D2 correction
-- ---------------------------------------------------------------------------
--
-- Claim resolution (adopted):
--   auth.jwt() is the Supabase-documented helper for RLS policies and SQL functions.
--   It returns the decoded JWT payload as jsonb inside Postgres.
--
-- NOT adopted for primary path:
--   current_setting('request.jwt.claims', true)::jsonb ->> 'talk_user_id'
--   Reason: PostgREST-specific, less explicit in Supabase RLS docs, and auth.jwt()
--   is the maintained API for the same payload in Supabase Postgres.
--
-- Resolution order (aligned with auth-current-user.js readAppMetadata):
--   1) app_metadata.talk_user_id  — primary (existing TASFUL convention)
--   2) root talk_user_id          — if Custom Access Token Hook promotes to top level
--   3) app_metadata.member_id     — legacy / secondary member id
--
-- Fallback NOT used in production:
--   auth.uid()::text — Supabase UUID; does NOT match MATCH / TALK text user_id.
--   auth.jwt() ->> 'sub' — UUID string; same mismatch unless sub were remapped (not TASFUL).
--   See commented discussion block below.

create or replace function public.match_current_user_id()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select nullif(
    trim(
      coalesce(
        auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
        auth.jwt() ->> 'talk_user_id',
        auth.jwt() -> 'app_metadata' ->> 'member_id'
      )
    ),
    ''
  );
$$;

comment on function public.match_current_user_id() is
  'Returns TASFUL member text id from JWT (talk_user_id / member_id). NULL when unauthenticated or claim missing. Do not use auth.uid()::text for MATCH user_id.';

-- ---------------------------------------------------------------------------
-- Fallback discussion (NOT enabled — apply gates must pass without these)
-- ---------------------------------------------------------------------------
-- Staging-only fallback to auth.uid()::text would mask missing talk_user_id claims
-- and break parity with TALK / TasuAuthCurrentUser. Do not enable for production.
--
-- If a future decision requires dev-only bypass:
--   coalesce(
--     <talk_user_id chain above>,
--     case when current_setting('app.settings.match_allow_uid_fallback', true) = 'true'
--          then nullif(auth.uid()::text, '') end
--   )
-- Requires explicit ops flag + separate migration; not part of this draft.

-- ---------------------------------------------------------------------------
-- Helper functions — impact summary (no body changes required)
-- ---------------------------------------------------------------------------
-- match_has_active_match_ban(p_user_id text)
--   Parameterized; callers pass match_current_user_id() or profile user_id.
--   No auth.uid() reference. Unaffected by D2 fix except via callers.
--
-- match_users_are_blocked(p_user_a text, p_user_b text)
--   Parameterized; match_profiles_public passes match_current_user_id() as p_user_a.
--   No auth.uid() reference. Unaffected by D2 fix except via callers.

-- ---------------------------------------------------------------------------
-- Public profile view — comment correction (view body unchanged)
-- ---------------------------------------------------------------------------
-- match_profiles_public already calls match_current_user_id() for:
--   - authenticated viewer gate (line: match_current_user_id() is not null)
--   - exclude self (p.user_id <> match_current_user_id())
--   - block filter (match_users_are_blocked(match_current_user_id(), p.user_id))
-- Replacing match_current_user_id() above fixes runtime behavior when applied.
-- No CREATE OR REPLACE VIEW required unless column logic changes.

comment on view public.match_profiles_public is
  'Discoverable MATCH profiles for swipe/list. Excludes PII, sanctions, blocks. Authenticated only. Viewer id from match_current_user_id() (JWT talk_user_id, not auth.uid()).';

-- ---------------------------------------------------------------------------
-- RLS policy draft — auth.uid()::text residual check (20260621130000)
-- ---------------------------------------------------------------------------
-- Scanned: all commented CREATE POLICY blocks in 20260621130000_match_rls_draft.sql
-- already use public.match_current_user_id() for user_id comparisons.
-- No policy uses auth.uid()::text = user_id directly.
-- Residual auth.uid() mentions in prior file: header comment, function body, view note
-- only — superseded by this correction draft.
--
-- Policy draft principle (unchanged identifiers; corrected auth source):
--   using (user_id = public.match_current_user_id())
--   with check (user_id = public.match_current_user_id())
--   using (swiper_user_id = public.match_current_user_id())
--   using (public.match_current_user_id() in (user_low_id, user_high_id))
--   using (blocker_user_id = public.match_current_user_id())
--   using (reporter_user_id = public.match_current_user_id())
--
-- When enabling RLS (later migration, after gates):
--   Uncomment policies from 20260621130000_match_rls_draft.sql as-is;
--   they inherit corrected match_current_user_id() after this file runs.
--   Do NOT reintroduce auth.uid()::text in new policies.

-- ---------------------------------------------------------------------------
-- RLS enable (commented — still not applicable in this draft)
-- ---------------------------------------------------------------------------
-- alter table public.match_profiles enable row level security;
-- (see 20260621130000_match_rls_draft.sql for full list and policy comments)

-- ---------------------------------------------------------------------------
-- Reference: corrected policy excerpts (comment-only; not executed)
-- ---------------------------------------------------------------------------
--
-- create policy match_profiles_select_own
--   on public.match_profiles for select to authenticated
--   using (user_id = public.match_current_user_id());
--
-- create policy match_swipes_select_own
--   on public.match_swipes for select to authenticated
--   using (swiper_user_id = public.match_current_user_id());
--
-- create policy match_pairs_select_participant
--   on public.match_pairs for select to authenticated
--   using (public.match_current_user_id() in (user_low_id, user_high_id));
