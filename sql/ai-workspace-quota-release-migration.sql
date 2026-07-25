-- Gemini OCR atomic quota: reservation release (rollback) RPC
-- Migration proposal only — DO NOT apply to production without review.
--
-- 背景:
--   OCR は quota を「upstream 実行前に atomic 予約 → 成功時に確定 / 失敗時に解放」する。
--   予約は既存 consume_ai_workspace_quota（条件付き UPDATE）をそのまま予約 primitive として利用し、
--   本 migration は解放（デクリメント）側のみを追加する。
--
-- Atomicity:
--   単一 UPDATE 文の述語（vision_used > 0 / text_used > 0）で行ロックと条件判定を同時に行う。
--   SELECT → 判定 → UPDATE の read-modify-write は行わない。
--   greatest(0, ...) により並列 release でもカウンタが負にならない。

create or replace function public.release_ai_workspace_quota(
  p_user_id text,
  p_date_jst text,
  p_feature text
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

  if coalesce(trim(p_date_jst), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_date');
  end if;

  if p_feature = 'vision_turn' then
    update ai_workspace_usage_daily
       set vision_used = greatest(0, vision_used - 1),
           updated_at = now()
     where user_id = p_user_id
       and date_jst = p_date_jst
       and vision_used > 0
     returning * into v_row;
    v_used := coalesce(v_row.vision_used, 0);
  else
    update ai_workspace_usage_daily
       set text_used = greatest(0, text_used - 1),
           updated_at = now()
     where user_id = p_user_id
       and date_jst = p_date_jst
       and text_used > 0
     returning * into v_row;
    v_used := coalesce(v_row.text_used, 0);
  end if;

  -- 対象行なし / すでに 0 は「解放するものが無い」= 冪等成功扱いにはせず明示区別する。
  if v_row.user_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'nothing_to_release',
      'feature', p_feature
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'feature', p_feature,
    'used', v_used
  );
end;
$$;

grant execute on function public.release_ai_workspace_quota(text, text, text) to service_role;

comment on function public.release_ai_workspace_quota(text, text, text) is
  'OCR quota 予約の解放（upstream 失敗時の rollback）· 単一条件付き UPDATE で atomic';
