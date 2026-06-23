-- MATCH admin MVP: age_verified, admin audit log types, profile admin RPCs

alter table public.match_profiles
  add column if not exists age_verified boolean not null default false;

comment on column public.match_profiles.age_verified is
  'Age verification approved by admin (match_verifications type=age).';

-- Admin audit log extensions
alter table public.match_moderation_logs
  drop constraint if exists match_moderation_logs_content_type_check;

alter table public.match_moderation_logs
  add constraint match_moderation_logs_content_type_check check (
    content_type in (
      'profile_bio',
      'profile_photo',
      'chat_message',
      'admin_report',
      'admin_verification',
      'admin_profile'
    )
  );

alter table public.match_moderation_logs
  drop constraint if exists match_moderation_logs_engine_check;

alter table public.match_moderation_logs
  add constraint match_moderation_logs_engine_check check (
    engine in ('rules', 'ai', 'admin')
  );

-- Identity verification status (admin approve/reject)
create or replace function public.match_edge_admin_set_verification_status(
  p_user_id text,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    return null;
  end if;
  if p_status not in ('none', 'pending', 'verified', 'rejected', 'phone_verified') then
    raise exception 'invalid verification_status: %', p_status;
  end if;

  update public.match_profiles
  set
    verification_status = p_status,
    updated_at = timezone('utc', now())
  where user_id = trim(p_user_id)
    and archived_at is null
  returning verification_status into v_status;

  return v_status;
end;
$$;

revoke all on function public.match_edge_admin_set_verification_status(text, text) from public;
grant execute on function public.match_edge_admin_set_verification_status(text, text) to service_role;

create or replace function public.match_edge_admin_set_age_verified(
  p_user_id text,
  p_verified boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flag boolean;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    return null;
  end if;

  update public.match_profiles
  set
    age_verified = coalesce(p_verified, false),
    updated_at = timezone('utc', now())
  where user_id = trim(p_user_id)
    and archived_at is null
  returning age_verified into v_flag;

  return v_flag;
end;
$$;

revoke all on function public.match_edge_admin_set_age_verified(text, boolean) from public;
grant execute on function public.match_edge_admin_set_age_verified(text, boolean) to service_role;

create or replace function public.match_edge_admin_set_profile_status(
  p_profile_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if p_profile_id is null then
    return null;
  end if;
  if p_status not in ('draft', 'active', 'hidden', 'suspended') then
    raise exception 'invalid profile_status: %', p_status;
  end if;

  update public.match_profiles
  set
    profile_status = p_status,
    updated_at = timezone('utc', now())
  where id = p_profile_id
    and archived_at is null
  returning profile_status into v_status;

  return v_status;
end;
$$;

revoke all on function public.match_edge_admin_set_profile_status(uuid, text) from public;
grant execute on function public.match_edge_admin_set_profile_status(uuid, text) to service_role;

-- Public view: expose age_verified (drop + recreate — column order change)
drop view if exists public.match_profiles_public;

create view public.match_profiles_public
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
  p.purpose,
  p.weekend_style,
  p.relationship_view,
  p.verification_status,
  p.age_verified,
  ph.storage_path as main_photo_url,
  coalesce(
    (
      select array_agg(ht.label_ja order by pht.display_order)
      from public.match_profile_hobby_tags pht
      inner join public.match_hobby_tags ht on ht.id = pht.hobby_tag_id
      where pht.profile_id = p.id and ht.is_active = true
    ),
    '{}'::text[]
  ) as hobby_tags,
  case
    when coalesce(us.show_activity_status, true) = false then null
    else public.match_activity_label(p.last_active_at)
  end as activity_label,
  p.created_at
from public.match_profiles p
left join public.match_profile_photos ph
  on ph.id = p.main_photo_id
  and ph.photo_status = 'active'
  and ph.archived_at is null
  and ph.moderation_status = 'approved'
left join public.match_user_settings us
  on us.user_id = p.user_id
where p.profile_status = 'active'
  and p.archived_at is null
  and not public.match_has_active_match_ban(p.user_id)
  and public.match_current_user_id() is not null
  and p.user_id <> public.match_current_user_id()
  and not public.match_users_are_blocked(
    public.match_current_user_id(),
    p.user_id
  );

revoke all on public.match_profiles_public from public;
grant select on public.match_profiles_public to authenticated;
