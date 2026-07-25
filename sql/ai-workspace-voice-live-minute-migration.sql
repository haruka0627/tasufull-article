-- Phase 3 Gemini Live: add voice_used to ai_workspace_usage_daily
-- Migration proposal only — DO NOT apply to production without review.

alter table public.ai_workspace_usage_daily
  add column if not exists voice_used_minutes integer not null default 0 check (voice_used_minutes >= 0);

comment on column public.ai_workspace_usage_daily.voice_used_minutes is
  'Gemini Live 音声会話 日次使用分数（1分単位）';

-- Atomic voice minute increment (upsert-safe, atomic UPDATE with limit check)
create or replace function public.consume_voice_live_minutes(
  p_user_id text,
  p_date_jst text,
  p_minutes integer,
  p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row ai_workspace_usage_daily%rowtype;
begin
  if coalesce(trim(p_user_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user_id');
  end if;

  if p_limit <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'feature', 'voice_live_minute',
      'used', 0,
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  -- upsert row
  insert into ai_workspace_usage_daily (user_id, date_jst, text_used, vision_used, voice_used_minutes)
  values (p_user_id, p_date_jst, 0, 0, 0)
  on conflict (user_id, date_jst) do nothing;

  -- atomic increment with limit check
  update ai_workspace_usage_daily
     set voice_used_minutes = voice_used_minutes + p_minutes,
         updated_at = now()
   where user_id = p_user_id
     and date_jst = p_date_jst
     and voice_used_minutes + p_minutes <= p_limit
   returning * into v_row;

  if v_row.user_id is null then
    -- over limit — read current value and return error
    select voice_used_minutes into v_row.voice_used_minutes
    from ai_workspace_usage_daily
    where user_id = p_user_id and date_jst = p_date_jst;

    return jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'feature', 'voice_live_minute',
      'used', coalesce(v_row.voice_used_minutes, p_limit),
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'feature', 'voice_live_minute',
    'used', coalesce(v_row.voice_used_minutes, 0),
    'limit', p_limit,
    'remaining', greatest(0, p_limit - coalesce(v_row.voice_used_minutes, 0))
  );
end;
$$;

grant execute on function public.consume_voice_live_minutes(text, text, integer, integer) to service_role;
