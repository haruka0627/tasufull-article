-- TLV cross-table public SELECT alignment (anon + authenticated)
--
-- live_videos (P1) already: grant select to anon + live_videos_select_public.
-- P0 tables revoked all from anon; only authenticated policies existed.
-- Browsers without Supabase auth session use anon JWT → "permission denied for table …"
-- before RLS is evaluated.
--
-- Scope: SELECT grants + public read policies only. Admin / owner / write policies unchanged.

-- ---------------------------------------------------------------------------
-- Table grants (anon SELECT only)
-- ---------------------------------------------------------------------------

grant select on public.live_shorts to anon;
grant select on public.live_creator_profiles to anon;
grant select on public.live_broadcasts to anon;
grant select on public.live_broadcast_messages to anon;

-- ---------------------------------------------------------------------------
-- live_shorts — published public feed
-- ---------------------------------------------------------------------------

drop policy if exists live_shorts_select_published on public.live_shorts;
drop policy if exists live_shorts_select_public on public.live_shorts;

create policy live_shorts_select_public
  on public.live_shorts for select to anon, authenticated
  using (
    status = 'published'
    and public.live_is_public_creator(creator_id)
  );

-- live_shorts_select_own / insert / update / delete / admin_all unchanged

-- ---------------------------------------------------------------------------
-- live_creator_profiles — public creator cards (hub / shorts / watch)
-- ---------------------------------------------------------------------------

drop policy if exists live_creator_profiles_select_public on public.live_creator_profiles;

create policy live_creator_profiles_select_public
  on public.live_creator_profiles for select to anon, authenticated
  using (public.live_is_public_creator(user_id));

-- live_creator_profiles_select_own / insert / update / admin_all unchanged

-- ---------------------------------------------------------------------------
-- live_broadcasts — public hub / watch (scheduled + live + ended)
-- ---------------------------------------------------------------------------

drop policy if exists live_broadcasts_select_public on public.live_broadcasts;

create policy live_broadcasts_select_public
  on public.live_broadcasts for select to anon, authenticated
  using (
    status in ('scheduled', 'live', 'ended')
    and public.live_is_public_creator(creator_id)
  );

-- live_broadcasts_select_own / insert / update / admin_all unchanged

-- ---------------------------------------------------------------------------
-- live_broadcast_messages — public watch comments (read-only for anon)
-- ---------------------------------------------------------------------------

drop policy if exists live_broadcast_messages_select_public on public.live_broadcast_messages;

create policy live_broadcast_messages_select_public
  on public.live_broadcast_messages for select to anon, authenticated
  using (public.live_broadcast_is_publicly_viewable(broadcast_id));

-- live_broadcast_messages_insert_auth / delete_own / admin_all unchanged
