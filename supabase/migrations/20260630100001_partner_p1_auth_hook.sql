-- Partner P1: pass partner_role from auth.users into JWT app_metadata claims
-- Enables Builder ops/reviewer/admin without X-Partner-Role dev header

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
  v_partner_role text;
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
    nullif(trim(u.raw_app_meta_data->>'partner_role'), '')
  into v_talk_user_id, v_member_id, v_role, v_is_ops, v_platform_role, v_partner_role
  from auth.users u
  where u.id = v_user_id;

  if v_talk_user_id is null then
    return event;
  end if;

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

  if v_partner_role is not null then
    app_meta := app_meta || jsonb_build_object('partner_role', v_partner_role);
  end if;

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb, true);
  end if;

  claims := jsonb_set(claims, '{app_metadata}', app_meta, true);
  event := jsonb_set(event, '{claims}', claims, true);
  return event;
end;
$$;
