-- Phase 6 — allow provider=openrouter on ai_usage_events + ingest RPC
-- Staging apply only when project is active · Production apply 禁止（本コミットはファイル追加のみ）
-- Cost Ledger price rates already allow openrouter (SAFE-07) · official rates are NOT seeded

alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_provider_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_provider_check check (
    provider in (
      'gemini',
      'openai',
      'claude',
      'brave',
      'serper',
      'deepseek',
      'openrouter',
      'unknown'
    )
  );

create or replace function public.ingest_ai_usage_event(
  p_request_id text,
  p_user_id uuid,
  p_anonymous_id text,
  p_feature text,
  p_provider text,
  p_model text,
  p_status text,
  p_input_units numeric,
  p_output_units numeric,
  p_total_units numeric,
  p_estimated_cost numeric,
  p_currency text,
  p_error_code text,
  p_metadata jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id text;
  v_feature text;
  v_provider text;
  v_status text;
  v_model text;
  v_anonymous_id text;
  v_error_code text;
  v_currency text;
  v_metadata jsonb;
  v_meta_bytes integer;
  v_row_count integer := 0;
begin
  v_request_id := nullif(trim(coalesce(p_request_id, '')), '');
  if v_request_id is null
     or char_length(v_request_id) < 8
     or char_length(v_request_id) > 128 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request_id');
  end if;

  v_feature := lower(nullif(trim(coalesce(p_feature, '')), ''));
  if v_feature is null or v_feature not in (
    'text_turn', 'vision_turn', 'ocr_turn', 'chat',
    'voice_live', 'media_video', 'media_music'
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_feature');
  end if;

  v_provider := lower(nullif(trim(coalesce(p_provider, '')), ''));
  if v_provider is null or v_provider not in (
    'gemini', 'openai', 'claude', 'brave', 'serper', 'deepseek', 'openrouter', 'unknown'
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_provider');
  end if;

  v_status := lower(nullif(trim(coalesce(p_status, '')), ''));
  if v_status is null or v_status not in ('success', 'error', 'denied') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  if p_input_units is not null and p_input_units < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_input_units');
  end if;
  if p_output_units is not null and p_output_units < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_output_units');
  end if;
  if p_total_units is not null and p_total_units < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_total_units');
  end if;
  if p_estimated_cost is not null and p_estimated_cost < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_estimated_cost');
  end if;

  v_model := nullif(trim(coalesce(p_model, '')), '');
  if v_model is not null and char_length(v_model) > 128 then
    return jsonb_build_object('ok', false, 'error', 'invalid_model');
  end if;

  v_anonymous_id := nullif(trim(coalesce(p_anonymous_id, '')), '');
  if v_anonymous_id is not null and char_length(v_anonymous_id) > 128 then
    return jsonb_build_object('ok', false, 'error', 'invalid_anonymous_id');
  end if;

  v_error_code := nullif(trim(coalesce(p_error_code, '')), '');
  if v_error_code is not null and char_length(v_error_code) > 128 then
    return jsonb_build_object('ok', false, 'error', 'invalid_error_code');
  end if;

  v_currency := upper(nullif(trim(coalesce(p_currency, 'JPY')), ''));
  if v_currency is null then
    v_currency := 'JPY';
  end if;
  if char_length(v_currency) > 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_currency');
  end if;

  if p_metadata is null then
    v_metadata := '{}'::jsonb;
  elsif jsonb_typeof(p_metadata) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_metadata');
  else
    v_metadata := p_metadata;
  end if;

  v_meta_bytes := octet_length(v_metadata::text);
  if v_meta_bytes > 2048 then
    return jsonb_build_object('ok', false, 'error', 'metadata_too_large');
  end if;

  if v_metadata ?| array[
    'message', 'prompt', 'reply', 'text', 'content', 'body', 'history',
    'attachments', 'image', 'base64', 'ocr_text', 'system_prompt',
    'search_context', 'parts', 'candidates'
  ] then
    return jsonb_build_object('ok', false, 'error', 'metadata_forbidden_keys');
  end if;

  insert into public.ai_usage_events (
    request_id,
    user_id,
    anonymous_id,
    feature,
    provider,
    model,
    status,
    input_units,
    output_units,
    total_units,
    estimated_cost,
    currency,
    error_code,
    metadata
  ) values (
    v_request_id,
    p_user_id,
    v_anonymous_id,
    v_feature,
    v_provider,
    v_model,
    v_status,
    p_input_units,
    p_output_units,
    p_total_units,
    p_estimated_cost,
    v_currency,
    v_error_code,
    v_metadata
  )
  on conflict (request_id) do nothing;

  get diagnostics v_row_count = row_count;
  if v_row_count > 0 then
    return jsonb_build_object('ok', true, 'duplicate', false);
  end if;

  return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;

revoke all on function public.ingest_ai_usage_event(
  text, uuid, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.ingest_ai_usage_event(
  text, uuid, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text, text, jsonb
) to service_role;
