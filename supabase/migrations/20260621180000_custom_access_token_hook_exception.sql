-- L12: custom_access_token_hook U-7 P2 EXCEPTION (linked ref ddojquacsyqesrjhcvmn)
-- Prerequisite: L11 RLS D2 applied · Hook ON (config.toml unchanged)
-- Missing talk_user_id AND member_id: RAISE EXCEPTION (login/refresh rejected)
-- Either talk_user_id or member_id present: merge claims (member_id coalesces to talk_user_id)

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  app_meta jsonb;
  v_user_id uuid;
  v_talk_user_id text;
  v_member_id text;
  v_role text;
  v_is_ops boolean;
  v_platform_role text;
  v_provider text;
  v_providers jsonb;
begin
  v_user_id := nullif(trim(coalesce(event->>'user_id', '')), '')::uuid;
  if v_user_id is null then
    return event;
  end if;

  claims := coalesce(event->'claims', '{}'::jsonb);
  app_meta := coalesce(claims->'app_metadata', '{}'::jsonb);

  select
    nullif(trim(u.raw_app_meta_data->>'talk_user_id'), ''),
    nullif(trim(u.raw_app_meta_data->>'member_id'), ''),
    nullif(trim(u.raw_app_meta_data->>'role'), ''),
    coalesce((u.raw_app_meta_data->>'is_ops')::boolean, false),
    nullif(trim(u.raw_app_meta_data->>'platform_role'), ''),
    nullif(trim(u.raw_app_meta_data->>'provider'), ''),
    coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb)
  into v_talk_user_id, v_member_id, v_role, v_is_ops, v_platform_role, v_provider, v_providers
  from auth.users u
  where u.id = v_user_id;

  if v_talk_user_id is null and v_member_id is null then
    raise exception 'custom_access_token_hook: talk_user_id and member_id required for user %', v_user_id
      using errcode = 'P0001';
  end if;

  v_talk_user_id := coalesce(v_talk_user_id, v_member_id);
  v_member_id := coalesce(v_member_id, v_talk_user_id);
  v_role := coalesce(v_role, 'authenticated');
  v_platform_role := coalesce(v_platform_role, 'member');

  app_meta := app_meta
    || jsonb_build_object(
         'talk_user_id', v_talk_user_id,
         'member_id', v_member_id,
         'role', v_role,
         'platform_role', v_platform_role,
         'is_ops', v_is_ops
       );

  if v_provider is not null then
    app_meta := app_meta || jsonb_build_object('provider', v_provider);
  end if;

  if v_providers is not null and jsonb_typeof(v_providers) = 'array' then
    app_meta := app_meta || jsonb_build_object('providers', v_providers);
  end if;

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb, true);
  end if;

  claims := jsonb_set(claims, '{app_metadata}', app_meta, true);
  event := jsonb_set(event, '{claims}', claims, true);
  return event;
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Supabase Custom Access Token Hook (L12 U-7 P2 EXCEPTION). Merges talk_user_id/member_id into JWT claims when either exists; rejects token issue when both missing.';

alter function public.custom_access_token_hook(jsonb) owner to postgres;

grant usage on schema public to supabase_auth_admin;

grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

revoke all on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;

grant select on table auth.users to supabase_auth_admin;
