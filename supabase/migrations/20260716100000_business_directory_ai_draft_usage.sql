-- Business Directory — AI listing draft daily quota (Phase 1b)
-- Profile columns unchanged · service_role + Edge only

create table if not exists public.business_directory_ai_draft_usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  date_jst text not null,
  used_count integer not null default 0 check (used_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, date_jst)
);

create index if not exists idx_bd_ai_draft_usage_daily_date
  on public.business_directory_ai_draft_usage_daily (date_jst);

comment on table public.business_directory_ai_draft_usage_daily is
  'Business Directory AI draft generation daily quota · Edge service_role only';

alter table public.business_directory_ai_draft_usage_daily enable row level security;

drop policy if exists bd_ai_draft_usage_daily_deny_all
  on public.business_directory_ai_draft_usage_daily;
create policy bd_ai_draft_usage_daily_deny_all
  on public.business_directory_ai_draft_usage_daily
  for all
  using (false)
  with check (false);

-- Atomic consume (increment only when below limit)
create or replace function public.consume_business_directory_ai_draft_quota(
  p_user_id uuid,
  p_date_jst text,
  p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.business_directory_ai_draft_usage_daily%rowtype;
  v_used integer;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_user_id');
  end if;

  if coalesce(trim(p_date_jst), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_date_jst');
  end if;

  if p_limit <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'used', 0,
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  insert into business_directory_ai_draft_usage_daily (user_id, date_jst, used_count)
  values (p_user_id, p_date_jst, 0)
  on conflict (user_id, date_jst) do nothing;

  update business_directory_ai_draft_usage_daily
     set used_count = used_count + 1,
         updated_at = now()
   where user_id = p_user_id
     and date_jst = p_date_jst
     and used_count < p_limit
   returning * into v_row;

  if v_row.user_id is null then
    select used_count into v_used
    from business_directory_ai_draft_usage_daily
    where user_id = p_user_id and date_jst = p_date_jst;

    v_used := coalesce(v_used, p_limit);

    return jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'used', v_used,
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'used', v_row.used_count,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_row.used_count)
  );
end;
$$;

-- Default PUBLIC EXECUTE must be removed; Edge calls this via service_role only.
revoke all on function public.consume_business_directory_ai_draft_quota(uuid, text, integer)
  from public, anon, authenticated;

grant execute on function public.consume_business_directory_ai_draft_quota(uuid, text, integer)
  to service_role;
