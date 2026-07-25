-- SAFE-06 — TASFUL AI Usage Log (`ai_usage_events`)
-- Staging / versioned migrations only · Production apply は別ゲート（本 migration を Production に自動適用しない）
-- Write: service_role のみ（Edge / CF 経由）· browser / anon / authenticated 直接 INSERT 禁止

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  user_id uuid null references auth.users (id) on delete set null,
  anonymous_id text null,
  feature text not null,
  provider text not null,
  model text null,
  status text not null,
  input_units numeric null,
  output_units numeric null,
  total_units numeric null,
  estimated_cost numeric null,
  currency text null default 'JPY',
  error_code text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_usage_events_request_id_key unique (request_id),
  constraint ai_usage_events_feature_check check (
    feature in (
      'text_turn',
      'vision_turn',
      'ocr_turn',
      'chat',
      'voice_live',
      'media_video',
      'media_music'
    )
  ),
  constraint ai_usage_events_provider_check check (
    provider in (
      'gemini',
      'openai',
      'claude',
      'brave',
      'serper',
      'deepseek',
      'unknown'
    )
  ),
  constraint ai_usage_events_status_check check (
    status in ('success', 'error', 'denied')
  ),
  constraint ai_usage_events_input_units_nonneg check (
    input_units is null or input_units >= 0
  ),
  constraint ai_usage_events_output_units_nonneg check (
    output_units is null or output_units >= 0
  ),
  constraint ai_usage_events_total_units_nonneg check (
    total_units is null or total_units >= 0
  ),
  constraint ai_usage_events_estimated_cost_nonneg check (
    estimated_cost is null or estimated_cost >= 0
  ),
  constraint ai_usage_events_request_id_len check (
    char_length(request_id) between 8 and 128
  ),
  constraint ai_usage_events_anonymous_id_len check (
    anonymous_id is null or char_length(anonymous_id) <= 128
  ),
  constraint ai_usage_events_model_len check (
    model is null or char_length(model) <= 128
  ),
  constraint ai_usage_events_error_code_len check (
    error_code is null or char_length(error_code) <= 128
  ),
  constraint ai_usage_events_currency_len check (
    currency is null or char_length(currency) <= 8
  ),
  constraint ai_usage_events_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

comment on table public.ai_usage_events is
  'SAFE-06 AI usage events · service_role ingest only · no prompt/PII in metadata · Cost Ledger (SAFE-07) reads units later';

comment on column public.ai_usage_events.request_id is
  'Idempotency key · unique · one row per AI request outcome';

comment on column public.ai_usage_events.estimated_cost is
  'Optional estimate · SAFE-06 may leave null · authoritative cost is SAFE-07 Cost Ledger';

create index if not exists idx_ai_usage_events_created_at
  on public.ai_usage_events (created_at desc);

create index if not exists idx_ai_usage_events_user_created
  on public.ai_usage_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_ai_usage_events_feature_created
  on public.ai_usage_events (feature, created_at desc);

create index if not exists idx_ai_usage_events_status_created
  on public.ai_usage_events (status, created_at desc);

create index if not exists idx_ai_usage_events_provider_created
  on public.ai_usage_events (provider, created_at desc);

alter table public.ai_usage_events enable row level security;

drop policy if exists ai_usage_events_deny_all on public.ai_usage_events;
create policy ai_usage_events_deny_all
  on public.ai_usage_events
  for all
  using (false)
  with check (false);

revoke all on table public.ai_usage_events from public, anon, authenticated;
grant select, insert on table public.ai_usage_events to service_role;

-- Validated ingest (service_role only) · ON CONFLICT request_id → duplicate ok
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
    'gemini', 'openai', 'claude', 'brave', 'serper', 'deepseek', 'unknown'
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

  -- Forbidden content keys (defense in depth · Edge also strips)
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
