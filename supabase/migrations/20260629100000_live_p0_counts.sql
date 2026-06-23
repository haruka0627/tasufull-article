-- TASFUL LIVE P0 Phase 7 — follower_count / like_count / tip_total_yen_stub 集計
-- Ref: reports/tasful-live-p0-design.md §8

-- Allow security-definer refresh to update follower_count (guard bypass)
create or replace function public.live_creator_profiles_guard_owner_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('live.internal_count_refresh', true), '') = '1' then
    return new;
  end if;

  if public.talk_is_admin() then
    return new;
  end if;

  if new.live_permission_status is distinct from old.live_permission_status
     or new.creator_status is distinct from old.creator_status
     or new.creator_tier is distinct from old.creator_tier
     or new.fee_rate is distinct from old.fee_rate
     or new.payout_policy is distinct from old.payout_policy
     or new.live_monthly_minutes_limit is distinct from old.live_monthly_minutes_limit
     or new.short_daily_count is distinct from old.short_daily_count
     or new.short_daily_reset_on is distinct from old.short_daily_reset_on
     or new.short_active_count is distinct from old.short_active_count
     or new.follower_count is distinct from old.follower_count
  then
    raise exception 'live_creator_profiles: forbidden column update for non-admin';
  end if;

  return new;
end;
$$;

create or replace function public.live_internal_set_count_refresh()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('live.internal_count_refresh', '1', true);
end;
$$;

create or replace function public.live_refresh_creator_follower_count(p_creator_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform public.live_internal_set_count_refresh();
  select count(*)::integer into v_count
  from public.live_creator_follows
  where creator_id = p_creator_id;

  update public.live_creator_profiles
  set follower_count = v_count
  where user_id = p_creator_id;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.live_refresh_short_like_count(p_short_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.live_short_likes
  where short_id = p_short_id;

  update public.live_shorts
  set like_count = v_count
  where id = p_short_id;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.live_refresh_broadcast_tip_total_stub(p_broadcast_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  select coalesce(sum(amount_yen), 0)::integer into v_total
  from public.live_tips
  where target_type = 'broadcast'
    and target_id = p_broadcast_id
    and payment_status in ('stub', 'succeeded');

  update public.live_broadcasts
  set tip_total_yen_stub = v_total
  where id = p_broadcast_id;

  return coalesce(v_total, 0);
end;
$$;

create or replace function public.live_creator_follows_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.live_refresh_creator_follower_count(coalesce(new.creator_id, old.creator_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.live_short_likes_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.live_refresh_short_like_count(coalesce(new.short_id, old.short_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.live_tips_broadcast_total_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.target_type, '') = 'broadcast' and new.target_id is not null then
    perform public.live_refresh_broadcast_tip_total_stub(new.target_id);
  end if;
  return new;
end;
$$;

drop trigger if exists live_creator_follows_refresh_count on public.live_creator_follows;
create trigger live_creator_follows_refresh_count
  after insert or delete on public.live_creator_follows
  for each row execute function public.live_creator_follows_count_trigger();

drop trigger if exists live_short_likes_refresh_count on public.live_short_likes;
create trigger live_short_likes_refresh_count
  after insert or delete on public.live_short_likes
  for each row execute function public.live_short_likes_count_trigger();

drop trigger if exists live_tips_refresh_broadcast_total on public.live_tips;
create trigger live_tips_refresh_broadcast_total
  after insert on public.live_tips
  for each row execute function public.live_tips_broadcast_total_trigger();

grant execute on function public.live_refresh_creator_follower_count(text) to authenticated, service_role;
grant execute on function public.live_refresh_short_like_count(uuid) to authenticated, service_role;
grant execute on function public.live_refresh_broadcast_tip_total_stub(uuid) to authenticated, service_role;
