-- L11: MATCH RLS D2 (linked ref ddojquacsyqesrjhcvmn)
-- Prerequisite: 20260621160000_create_match_schema.sql
-- Enables RLS on 8 MATCH tables · JWT talk_user_id via match_current_user_id()
-- service_role bypasses RLS (Edge Functions · minimal admin path)

-- ---------------------------------------------------------------------------
-- Auth helpers (D2: talk_user_id text, not auth.uid())
-- ---------------------------------------------------------------------------

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
  'MATCH RLS: TASFUL member text id from JWT talk_user_id / member_id. NULL when unauthenticated or claim missing.';

create or replace function public.match_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    lower(
      coalesce(
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() ->> 'role',
        ''
      )
    ) in ('tasu_admin', 'match_admin')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'is_ops', auth.jwt() ->> 'is_ops', 'false')
      in ('true', 't', '1');
$$;

comment on function public.match_is_admin() is
  'MATCH RLS: admin from JWT role (tasu_admin/match_admin) or is_ops=true.';

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
-- Client guard triggers
-- ---------------------------------------------------------------------------

create or replace function public.match_profiles_guard_verification_status()
returns trigger
language plpgsql
as $$
begin
  if new.verification_status is distinct from old.verification_status
     and coalesce(current_setting('request.jwt.claim.role', true), '') is distinct from 'service_role'
     and not public.match_is_admin() then
    raise exception 'verification_status is read-only for clients';
  end if;
  return new;
end;
$$;

drop trigger if exists match_profiles_guard_verification_status on public.match_profiles;
create trigger match_profiles_guard_verification_status
  before update on public.match_profiles
  for each row execute function public.match_profiles_guard_verification_status();

-- ---------------------------------------------------------------------------
-- RLS enable (8 tables)
-- ---------------------------------------------------------------------------

alter table public.match_profiles enable row level security;
alter table public.match_profile_photos enable row level security;
alter table public.match_swipes enable row level security;
alter table public.match_pairs enable row level security;
alter table public.match_blocks enable row level security;
alter table public.match_reports enable row level security;
alter table public.match_verifications enable row level security;
alter table public.match_moderation_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on public.match_profiles from anon;
revoke all on public.match_profile_photos from anon;
revoke all on public.match_swipes from anon;
revoke all on public.match_pairs from anon;
revoke all on public.match_blocks from anon;
revoke all on public.match_reports from anon;
revoke all on public.match_verifications from anon;
revoke all on public.match_moderation_logs from anon;

grant select, insert, update on public.match_profiles to authenticated;
grant select, insert, update on public.match_profile_photos to authenticated;
grant select, insert on public.match_swipes to authenticated;
grant select on public.match_pairs to authenticated;
grant select, insert, update on public.match_blocks to authenticated;
grant select, insert on public.match_reports to authenticated;
grant select, insert on public.match_verifications to authenticated;
grant select on public.match_moderation_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Policies: match_profiles
-- ---------------------------------------------------------------------------

drop policy if exists match_profiles_select_own on public.match_profiles;
create policy match_profiles_select_own
  on public.match_profiles for select to authenticated
  using (user_id = public.match_current_user_id());

drop policy if exists match_profiles_insert_own on public.match_profiles;
create policy match_profiles_insert_own
  on public.match_profiles for insert to authenticated
  with check (
    user_id = public.match_current_user_id()
    and profile_status in ('draft', 'active', 'hidden')
  );

drop policy if exists match_profiles_update_own on public.match_profiles;
create policy match_profiles_update_own
  on public.match_profiles for update to authenticated
  using (user_id = public.match_current_user_id())
  with check (
    user_id = public.match_current_user_id()
    and profile_status in ('draft', 'active', 'hidden')
  );

-- ---------------------------------------------------------------------------
-- Policies: match_profile_photos
-- ---------------------------------------------------------------------------

drop policy if exists match_profile_photos_select_own on public.match_profile_photos;
create policy match_profile_photos_select_own
  on public.match_profile_photos for select to authenticated
  using (
    exists (
      select 1 from public.match_profiles mp
      where mp.id = profile_id
        and mp.user_id = public.match_current_user_id()
    )
  );

drop policy if exists match_profile_photos_insert_own on public.match_profile_photos;
create policy match_profile_photos_insert_own
  on public.match_profile_photos for insert to authenticated
  with check (
    exists (
      select 1 from public.match_profiles mp
      where mp.id = profile_id
        and mp.user_id = public.match_current_user_id()
    )
  );

drop policy if exists match_profile_photos_update_own on public.match_profile_photos;
create policy match_profile_photos_update_own
  on public.match_profile_photos for update to authenticated
  using (
    exists (
      select 1 from public.match_profiles mp
      where mp.id = profile_id
        and mp.user_id = public.match_current_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.match_profiles mp
      where mp.id = profile_id
        and mp.user_id = public.match_current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Policies: match_swipes
-- ---------------------------------------------------------------------------

drop policy if exists match_swipes_select_own on public.match_swipes;
create policy match_swipes_select_own
  on public.match_swipes for select to authenticated
  using (swiper_user_id = public.match_current_user_id());

drop policy if exists match_swipes_insert_own on public.match_swipes;
create policy match_swipes_insert_own
  on public.match_swipes for insert to authenticated
  with check (
    swiper_user_id = public.match_current_user_id()
    and swiper_user_id <> target_user_id
    and action in ('like', 'skip')
  );

-- ---------------------------------------------------------------------------
-- Policies: match_pairs
-- ---------------------------------------------------------------------------

drop policy if exists match_pairs_select_participant on public.match_pairs;
create policy match_pairs_select_participant
  on public.match_pairs for select to authenticated
  using (public.match_current_user_id() in (user_low_id, user_high_id));

-- ---------------------------------------------------------------------------
-- Policies: match_blocks
-- ---------------------------------------------------------------------------

drop policy if exists match_blocks_select_blocker on public.match_blocks;
create policy match_blocks_select_blocker
  on public.match_blocks for select to authenticated
  using (blocker_user_id = public.match_current_user_id());

drop policy if exists match_blocks_insert_blocker on public.match_blocks;
create policy match_blocks_insert_blocker
  on public.match_blocks for insert to authenticated
  with check (
    blocker_user_id = public.match_current_user_id()
    and blocker_user_id <> blocked_user_id
    and block_status = 'active'
  );

drop policy if exists match_blocks_update_unblock on public.match_blocks;
create policy match_blocks_update_unblock
  on public.match_blocks for update to authenticated
  using (blocker_user_id = public.match_current_user_id())
  with check (
    blocker_user_id = public.match_current_user_id()
    and block_status in ('active', 'archived')
  );

-- ---------------------------------------------------------------------------
-- Policies: match_reports
-- ---------------------------------------------------------------------------

drop policy if exists match_reports_select_reporter on public.match_reports;
create policy match_reports_select_reporter
  on public.match_reports for select to authenticated
  using (reporter_user_id = public.match_current_user_id());

drop policy if exists match_reports_insert_reporter on public.match_reports;
create policy match_reports_insert_reporter
  on public.match_reports for insert to authenticated
  with check (
    reporter_user_id = public.match_current_user_id()
    and reporter_user_id <> reported_user_id
    and status = 'open'
  );

drop policy if exists match_reports_select_admin on public.match_reports;
create policy match_reports_select_admin
  on public.match_reports for select to authenticated
  using (public.match_is_admin());

-- ---------------------------------------------------------------------------
-- Policies: match_verifications
-- ---------------------------------------------------------------------------

drop policy if exists match_verifications_select_own on public.match_verifications;
create policy match_verifications_select_own
  on public.match_verifications for select to authenticated
  using (user_id = public.match_current_user_id());

drop policy if exists match_verifications_insert_own on public.match_verifications;
create policy match_verifications_insert_own
  on public.match_verifications for insert to authenticated
  with check (
    user_id = public.match_current_user_id()
    and status in ('pending', 'phone_verified', 'submitted')
  );

drop policy if exists match_verifications_select_admin on public.match_verifications;
create policy match_verifications_select_admin
  on public.match_verifications for select to authenticated
  using (public.match_is_admin());

-- ---------------------------------------------------------------------------
-- Policies: match_moderation_logs
-- ---------------------------------------------------------------------------

drop policy if exists match_moderation_logs_select_own on public.match_moderation_logs;
create policy match_moderation_logs_select_own
  on public.match_moderation_logs for select to authenticated
  using (
    user_id is not null
    and user_id = public.match_current_user_id()
  );

drop policy if exists match_moderation_logs_select_admin on public.match_moderation_logs;
create policy match_moderation_logs_select_admin
  on public.match_moderation_logs for select to authenticated
  using (public.match_is_admin());

-- Writes: service_role / Edge only (no authenticated INSERT/UPDATE policies)
