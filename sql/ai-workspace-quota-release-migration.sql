-- Gemini OCR quota reservation — idempotent reserve / commit / release
-- Migration proposal only — DO NOT apply to production without review.
--
-- F5.1 正本（F5 の release-only 草案を統合・置換）
--
-- Deploy order:
--   1. Apply this migration (backward-compatible: new table + new RPCs;
--      existing check_ai_workspace_quota / consume_ai_workspace_quota は残置)
--   2. Verify RPCs on Staging
--   3. Deploy Cloudflare Function (uses reserve / commit / release-by-id)
--   4. Optional later: drop unused 3-arg release_ai_workspace_quota if ever applied
--
-- Expiry:
--   expires_at を保持する。今回は自動回収ジョブを実装しない。
--   Function 強制終了で reserved のまま残った行は over-count になる。
--   将来の回収は WHERE state = 'reserved' AND expires_at < now() の
--   条件付き UPDATE → released + counter−1 のみ（committed は触らない）。

create table if not exists public.ai_workspace_quota_reservations (
  reservation_id uuid primary key,
  user_id text not null,
  date_jst text not null,
  feature text not null,
  surface text not null default '',
  state text not null
    check (state in ('reserved', 'committed', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

create index if not exists ai_workspace_quota_reservations_user_date_feature_idx
  on public.ai_workspace_quota_reservations (user_id, date_jst, feature);

create index if not exists ai_workspace_quota_reservations_state_expires_idx
  on public.ai_workspace_quota_reservations (state, expires_at)
  where state = 'reserved';

comment on table public.ai_workspace_quota_reservations is
  'OCR quota reservation identity · reserved|committed|released · release/commit は reservation_id 単位で冪等';

-- ---------------------------------------------------------------------------
-- reserve: conditional counter++ + insert reservation row (one transaction)
-- ---------------------------------------------------------------------------
create or replace function public.reserve_ai_workspace_quota(
  p_user_id text,
  p_date_jst text,
  p_feature text,
  p_surface text,
  p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row ai_workspace_usage_daily%rowtype;
  v_used integer;
  v_reservation_id uuid;
  v_surface text;
begin
  if coalesce(trim(p_user_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user_id');
  end if;

  if coalesce(trim(p_date_jst), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_date');
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

  v_surface := coalesce(trim(p_surface), '');

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

  v_reservation_id := gen_random_uuid();

  insert into ai_workspace_quota_reservations (
    reservation_id, user_id, date_jst, feature, surface, state, expires_at
  ) values (
    v_reservation_id, p_user_id, p_date_jst, p_feature, v_surface, 'reserved',
    now() + interval '30 minutes'
  );

  return jsonb_build_object(
    'ok', true,
    'reservation_id', v_reservation_id,
    'feature', p_feature,
    'used', v_used,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_used),
    'state', 'reserved'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- commit: reserved → committed (idempotent · never released → committed)
-- ---------------------------------------------------------------------------
create or replace function public.commit_ai_workspace_quota_reservation(
  p_reservation_id uuid,
  p_user_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res ai_workspace_quota_reservations%rowtype;
begin
  if p_reservation_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_reservation_id');
  end if;

  if coalesce(trim(p_user_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user_id');
  end if;

  update ai_workspace_quota_reservations
     set state = 'committed',
         updated_at = now()
   where reservation_id = p_reservation_id
     and user_id = p_user_id
     and state = 'reserved'
   returning * into v_res;

  if v_res.reservation_id is not null then
    return jsonb_build_object(
      'ok', true,
      'state', 'committed',
      'reservation_id', v_res.reservation_id
    );
  end if;

  select * into v_res
  from ai_workspace_quota_reservations
  where reservation_id = p_reservation_id
    and user_id = p_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_res.state = 'committed' then
    return jsonb_build_object(
      'ok', true,
      'state', 'committed',
      'already_committed', true,
      'reservation_id', v_res.reservation_id
    );
  end if;

  -- released / other — commit 禁止（追加減算もなし）
  return jsonb_build_object(
    'ok', false,
    'error', 'invalid_state',
    'state', v_res.state,
    'reservation_id', v_res.reservation_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- release: reserved → released + counter−1 (idempotent · max one decrement)
-- ---------------------------------------------------------------------------
create or replace function public.release_ai_workspace_quota_reservation(
  p_reservation_id uuid,
  p_user_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res ai_workspace_quota_reservations%rowtype;
  v_used integer;
begin
  if p_reservation_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_reservation_id');
  end if;

  if coalesce(trim(p_user_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user_id');
  end if;

  -- 条件付き状態遷移が権威。WHERE state = 'reserved' でのみ減算する。
  update ai_workspace_quota_reservations
     set state = 'released',
         updated_at = now()
   where reservation_id = p_reservation_id
     and user_id = p_user_id
     and state = 'reserved'
   returning * into v_res;

  if v_res.reservation_id is not null then
    if v_res.feature = 'vision_turn' then
      update ai_workspace_usage_daily
         set vision_used = greatest(0, vision_used - 1),
             updated_at = now()
       where user_id = v_res.user_id
         and date_jst = v_res.date_jst
         and vision_used > 0
       returning vision_used into v_used;
    else
      update ai_workspace_usage_daily
         set text_used = greatest(0, text_used - 1),
             updated_at = now()
       where user_id = v_res.user_id
         and date_jst = v_res.date_jst
         and text_used > 0
       returning text_used into v_used;
    end if;

    return jsonb_build_object(
      'ok', true,
      'state', 'released',
      'used', coalesce(v_used, 0),
      'reservation_id', v_res.reservation_id
    );
  end if;

  select * into v_res
  from ai_workspace_quota_reservations
  where reservation_id = p_reservation_id
    and user_id = p_user_id;

  if not found then
    -- unknown / 他人の ID — カウンタ非変更
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_res.state = 'released' then
    return jsonb_build_object(
      'ok', true,
      'state', 'released',
      'already_released', true,
      'reservation_id', v_res.reservation_id
    );
  end if;

  -- committed — release 禁止（追加減算なし）
  return jsonb_build_object(
    'ok', false,
    'error', 'invalid_state',
    'state', v_res.state,
    'reservation_id', v_res.reservation_id
  );
end;
$$;

grant execute on function public.reserve_ai_workspace_quota(text, text, text, text, integer) to service_role;
grant execute on function public.commit_ai_workspace_quota_reservation(uuid, text) to service_role;
grant execute on function public.release_ai_workspace_quota_reservation(uuid, text) to service_role;

comment on function public.reserve_ai_workspace_quota(text, text, text, text, integer) is
  'OCR quota atomic reserve · counter++ + reservation row · gen_random_uuid';
comment on function public.commit_ai_workspace_quota_reservation(uuid, text) is
  'OCR quota commit · reserved→committed · idempotent already_committed';
comment on function public.release_ai_workspace_quota_reservation(uuid, text) is
  'OCR quota release · reserved→released + counter−1 · idempotent already_released';

-- F5 草案の 3-arg release は未適用想定。もし Staging に残っていても、
-- Function は release_ai_workspace_quota_reservation のみを呼ぶ。
-- 旧 RPC の DROP は後続 migration で行う（本ファイルでは DROP しない）。
