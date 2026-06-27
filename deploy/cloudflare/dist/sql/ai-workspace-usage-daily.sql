-- TASFUL AI Workspace — 日次 usage 正本（Phase 2 · Edge enforcement）
create table if not exists public.ai_workspace_usage_daily (
  user_id text not null,
  date_jst text not null,
  text_used integer not null default 0 check (text_used >= 0),
  vision_used integer not null default 0 check (vision_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date_jst)
);

create index if not exists ai_workspace_usage_daily_date_idx
  on public.ai_workspace_usage_daily (date_jst);

comment on table public.ai_workspace_usage_daily is
  'TASFUL AI Workspace 日次 turn 消費（Edge service_role のみ · gen_ai_subscriptions と連動）';

alter table public.ai_workspace_usage_daily enable row level security;

drop policy if exists ai_workspace_usage_daily_deny_all on public.ai_workspace_usage_daily;
create policy ai_workspace_usage_daily_deny_all
  on public.ai_workspace_usage_daily
  for all
  using (false)
  with check (false);

-- 残数チェック（increment なし）
create or replace function public.check_ai_workspace_quota(
  p_user_id text,
  p_date_jst text,
  p_feature text,
  p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text_used integer := 0;
  v_vision_used integer := 0;
  v_used integer := 0;
begin
  if coalesce(trim(p_user_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user_id');
  end if;

  if p_limit <= 0 then
    return jsonb_build_object(
      'ok', true,
      'allowed', false,
      'error', 'quota_exceeded',
      'feature', p_feature,
      'used', 0,
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  select text_used, vision_used
    into v_text_used, v_vision_used
  from ai_workspace_usage_daily
  where user_id = p_user_id and date_jst = p_date_jst;

  if not found then
    v_text_used := 0;
    v_vision_used := 0;
  end if;

  if p_feature = 'vision_turn' then
    v_used := v_vision_used;
  else
    v_used := v_text_used;
  end if;

  if v_used >= p_limit then
    return jsonb_build_object(
      'ok', true,
      'allowed', false,
      'error', 'quota_exceeded',
      'feature', p_feature,
      'used', v_used,
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'allowed', true,
    'feature', p_feature,
    'used', v_used,
    'limit', p_limit,
    'remaining', p_limit - v_used
  );
end;
$$;

-- 原子的 consume（上限内のみ increment）
create or replace function public.consume_ai_workspace_quota(
  p_user_id text,
  p_date_jst text,
  p_feature text,
  p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row ai_workspace_usage_daily%rowtype;
  v_used integer;
begin
  if coalesce(trim(p_user_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user_id');
  end if;

  if p_limit <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'feature', p_feature,
      'used', 0,
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  insert into ai_workspace_usage_daily (user_id, date_jst, text_used, vision_used)
  values (p_user_id, p_date_jst, 0, 0)
  on conflict (user_id, date_jst) do nothing;

  if p_feature = 'vision_turn' then
    update ai_workspace_usage_daily
       set vision_used = vision_used + 1,
           updated_at = now()
     where user_id = p_user_id
       and date_jst = p_date_jst
       and vision_used < p_limit
     returning * into v_row;
    v_used := coalesce(v_row.vision_used, 0);
  else
    update ai_workspace_usage_daily
       set text_used = text_used + 1,
           updated_at = now()
     where user_id = p_user_id
       and date_jst = p_date_jst
       and text_used < p_limit
     returning * into v_row;
    v_used := coalesce(v_row.text_used, 0);
  end if;

  if v_row.user_id is null then
    select text_used, vision_used into v_row.text_used, v_row.vision_used
    from ai_workspace_usage_daily
    where user_id = p_user_id and date_jst = p_date_jst;

    v_used := case when p_feature = 'vision_turn' then coalesce(v_row.vision_used, p_limit)
                   else coalesce(v_row.text_used, p_limit) end;

    return jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'feature', p_feature,
      'used', v_used,
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'feature', p_feature,
    'used', v_used,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_used)
  );
end;
$$;

grant execute on function public.check_ai_workspace_quota(text, text, text, integer) to service_role;
grant execute on function public.consume_ai_workspace_quota(text, text, text, integer) to service_role;
