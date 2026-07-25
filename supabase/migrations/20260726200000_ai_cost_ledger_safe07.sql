-- SAFE-07 — Minimum Cost Ledger（推定 API 原価）
-- Staging / versioned migrations only · Production 自動適用禁止
-- 正本: docs/tasful-ai-core-august-2026-plan.md · SAFE_OPS SAFE-07
--
-- 設計選択（A）:
--   ai_usage_events.estimated_cost は生イベント正本として触らない（null のまま可）
--   価格表と join して query 時に推定原価を算出 · 再計算・価格改定に耐える
--   Provider 請求額そのものではない（estimated 明示）

-- ---------------------------------------------------------------------------
-- 1. Model price rates（サーバー側のみ · クライアント変更不可）
-- ---------------------------------------------------------------------------

create table if not exists public.ai_model_price_rates (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  unit_type text not null,
  -- 何単位あたりの単価か（例: 1_000_000 chars / tokens、1 request、1 image）
  per_units numeric not null,
  unit_price numeric not null,
  currency text not null default 'USD',
  unit_basis text not null default 'char',
  -- provisional: true = テスト / 未確定単価（本番会計に使わない）
  provisional boolean not null default true,
  effective_from timestamptz not null,
  effective_to timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  constraint ai_model_price_rates_provider_check check (
    provider in (
      'gemini', 'openai', 'claude', 'brave', 'serper', 'deepseek',
      'openrouter', 'unknown'
    )
  ),
  constraint ai_model_price_rates_unit_type_check check (
    unit_type in ('input', 'output', 'image', 'request')
  ),
  constraint ai_model_price_rates_unit_basis_check check (
    unit_basis in ('char', 'token', 'image', 'request')
  ),
  constraint ai_model_price_rates_per_units_pos check (per_units > 0),
  constraint ai_model_price_rates_unit_price_nonneg check (unit_price >= 0),
  constraint ai_model_price_rates_currency_len check (char_length(currency) between 3 and 8),
  constraint ai_model_price_rates_model_len check (char_length(model) between 1 and 128),
  constraint ai_model_price_rates_period_order check (
    effective_to is null or effective_to > effective_from
  ),
  constraint ai_model_price_rates_unique_start unique (provider, model, unit_type, effective_from)
);

comment on table public.ai_model_price_rates is
  'SAFE-07 estimated API cost rates · service_role only · not customer billing · not provider invoice';

comment on column public.ai_model_price_rates.provisional is
  'true = fixture / unverified rate · must not be treated as final accounting';

create index if not exists idx_ai_model_price_rates_lookup
  on public.ai_model_price_rates (provider, model, unit_type, effective_from desc);

create index if not exists idx_ai_model_price_rates_effective
  on public.ai_model_price_rates (effective_from, effective_to);

alter table public.ai_model_price_rates enable row level security;

drop policy if exists ai_model_price_rates_deny_all on public.ai_model_price_rates;
create policy ai_model_price_rates_deny_all
  on public.ai_model_price_rates
  for all
  using (false)
  with check (false);

revoke all on table public.ai_model_price_rates from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_model_price_rates to service_role;

-- Overlapping effective periods for same (provider, model, unit_type) を拒否
create or replace function public.ai_model_price_rates_assert_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict uuid;
begin
  if NEW.unit_price < 0 or NEW.per_units <= 0 then
    raise exception 'invalid_price_rate';
  end if;

  select r.id into v_conflict
  from public.ai_model_price_rates r
  where r.provider = NEW.provider
    and r.model = NEW.model
    and r.unit_type = NEW.unit_type
    and r.id is distinct from NEW.id
    and tstzrange(r.effective_from, coalesce(r.effective_to, 'infinity'::timestamptz), '[)')
        && tstzrange(NEW.effective_from, coalesce(NEW.effective_to, 'infinity'::timestamptz), '[)')
  limit 1;

  if v_conflict is not null then
    raise exception 'overlapping_price_rate'
      using errcode = '23505',
            hint = 'effective period overlaps an existing rate for provider/model/unit_type';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_ai_model_price_rates_no_overlap on public.ai_model_price_rates;
create trigger trg_ai_model_price_rates_no_overlap
  before insert or update on public.ai_model_price_rates
  for each row
  execute function public.ai_model_price_rates_assert_no_overlap();

revoke all on function public.ai_model_price_rates_assert_no_overlap() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Provisional fixture rates（gemini-2.5-flash · char 単位 · 会計確定ではない）
--    SAFE-06 が記録する units は文字数。実トークン単価ではない。
-- ---------------------------------------------------------------------------

insert into public.ai_model_price_rates (
  provider, model, unit_type, per_units, unit_price, currency, unit_basis,
  provisional, effective_from, effective_to, notes
) values
  (
    'gemini', 'gemini-2.5-flash', 'input', 1000000, 0.10, 'USD', 'char',
    true, '2026-01-01 00:00:00+00', null,
    'PROVISIONAL fixture for SAFE-07 tests · not official Gemini pricing'
  ),
  (
    'gemini', 'gemini-2.5-flash', 'output', 1000000, 0.40, 'USD', 'char',
    true, '2026-01-01 00:00:00+00', null,
    'PROVISIONAL fixture for SAFE-07 tests · not official Gemini pricing'
  )
on conflict (provider, model, unit_type, effective_from) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Query-time cost for one event（破壊せず再計算）
-- ---------------------------------------------------------------------------

create or replace function public.ai_estimate_event_cost(
  p_provider text,
  p_model text,
  p_status text,
  p_input_units numeric,
  p_output_units numeric,
  p_created_at timestamptz,
  p_currency text default 'USD'
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_model text := trim(coalesce(p_model, ''));
  v_currency text := upper(trim(coalesce(p_currency, 'USD')));
  v_at timestamptz := coalesce(p_created_at, now());
  v_input_rate public.ai_model_price_rates%rowtype;
  v_output_rate public.ai_model_price_rates%rowtype;
  v_input_cost numeric := null;
  v_output_cost numeric := null;
  v_total numeric := null;
  v_billable boolean := false;
  v_cost_status text := 'not_billable';
begin
  -- denied / error: Provider 呼び出し無しまたは不成立 → 課金対象外（推定原価 null）
  -- success のみ billable
  if v_status <> 'success' then
    return jsonb_build_object(
      'ok', true,
      'billable', false,
      'cost_status', 'not_billable',
      'estimated_cost', null,
      'currency', v_currency,
      'input_cost', null,
      'output_cost', null,
      'provisional', null
    );
  end if;

  v_billable := true;

  if v_model = '' or v_provider = '' then
    return jsonb_build_object(
      'ok', true,
      'billable', true,
      'cost_status', 'unknown_rate',
      'estimated_cost', null,
      'currency', v_currency,
      'input_cost', null,
      'output_cost', null,
      'provisional', null
    );
  end if;

  if (p_input_units is not null and p_input_units < 0)
     or (p_output_units is not null and p_output_units < 0) then
    return jsonb_build_object('ok', false, 'error', 'invalid_units');
  end if;

  select * into v_input_rate
  from public.ai_model_price_rates r
  where r.provider = v_provider
    and r.model = v_model
    and r.unit_type = 'input'
    and r.currency = v_currency
    and r.effective_from <= v_at
    and (r.effective_to is null or r.effective_to > v_at)
  order by r.effective_from desc
  limit 1;

  select * into v_output_rate
  from public.ai_model_price_rates r
  where r.provider = v_provider
    and r.model = v_model
    and r.unit_type = 'output'
    and r.currency = v_currency
    and r.effective_from <= v_at
    and (r.effective_to is null or r.effective_to > v_at)
  order by r.effective_from desc
  limit 1;

  -- 未知 model / 単価未設定 → 0 円確定しない
  if (p_input_units is not null and p_input_units > 0 and v_input_rate.id is null)
     or (p_output_units is not null and p_output_units > 0 and v_output_rate.id is null)
     or (
       coalesce(p_input_units, 0) = 0
       and coalesce(p_output_units, 0) = 0
       and v_input_rate.id is null
       and v_output_rate.id is null
     ) then
    -- units が両方 null/0 でも rate が無ければ unknown（0 円にしない）
    if v_input_rate.id is null and v_output_rate.id is null then
      return jsonb_build_object(
        'ok', true,
        'billable', true,
        'cost_status', 'unknown_rate',
        'estimated_cost', null,
        'currency', v_currency,
        'input_cost', null,
        'output_cost', null,
        'provisional', null
      );
    end if;
    -- 片方だけ rate 欠落で units がある場合も unknown
    if (p_input_units is not null and p_input_units > 0 and v_input_rate.id is null)
       or (p_output_units is not null and p_output_units > 0 and v_output_rate.id is null) then
      return jsonb_build_object(
        'ok', true,
        'billable', true,
        'cost_status', 'unknown_rate',
        'estimated_cost', null,
        'currency', v_currency,
        'input_cost', null,
        'output_cost', null,
        'provisional', null
      );
    end if;
  end if;

  if p_input_units is not null and v_input_rate.id is not null then
    v_input_cost := round((p_input_units / v_input_rate.per_units) * v_input_rate.unit_price, 8);
  else
    v_input_cost := 0;
  end if;

  if p_output_units is not null and v_output_rate.id is not null then
    v_output_cost := round((p_output_units / v_output_rate.per_units) * v_output_rate.unit_price, 8);
  else
    v_output_cost := 0;
  end if;

  v_total := coalesce(v_input_cost, 0) + coalesce(v_output_cost, 0);
  v_cost_status := 'estimated';

  return jsonb_build_object(
    'ok', true,
    'billable', v_billable,
    'cost_status', v_cost_status,
    'estimated_cost', v_total,
    'currency', v_currency,
    'input_cost', v_input_cost,
    'output_cost', v_output_cost,
    'provisional', coalesce(v_input_rate.provisional, true) and coalesce(v_output_rate.provisional, true)
  );
end;
$$;

revoke all on function public.ai_estimate_event_cost(
  text, text, text, numeric, numeric, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.ai_estimate_event_cost(
  text, text, text, numeric, numeric, timestamptz, text
) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Enriched read（view · RLS 下でも直接は使えない想定 · RPC 経由）
-- ---------------------------------------------------------------------------

create or replace view public.ai_usage_cost_enriched
with (security_invoker = true)
as
select
  e.id,
  e.request_id,
  e.user_id,
  e.anonymous_id,
  e.feature,
  e.provider,
  e.model,
  e.status,
  e.input_units,
  e.output_units,
  e.total_units,
  e.created_at,
  (c.cost_json ->> 'cost_status') as cost_status,
  case
    when c.cost_json ->> 'estimated_cost' is null then null
    else (c.cost_json ->> 'estimated_cost')::numeric
  end as estimated_cost_usd,
  (c.cost_json ->> 'billable')::boolean as billable,
  case
    when c.cost_json ->> 'provisional' is null then null
    else (c.cost_json ->> 'provisional')::boolean
  end as rate_provisional
from public.ai_usage_events e
cross join lateral (
  select public.ai_estimate_event_cost(
    e.provider,
    e.model,
    e.status,
    e.input_units,
    e.output_units,
    e.created_at,
    'USD'
  ) as cost_json
) c;

comment on view public.ai_usage_cost_enriched is
  'SAFE-07 query-time estimated cost · does not mutate ai_usage_events · service_role via underlying RLS deny for others';

revoke all on public.ai_usage_cost_enriched from public, anon, authenticated;
grant select on public.ai_usage_cost_enriched to service_role;

-- ---------------------------------------------------------------------------
-- 5. Aggregation RPC（管理用 · service_role のみ）
-- ---------------------------------------------------------------------------

create or replace function public.ai_cost_ledger_aggregate(
  p_from timestamptz,
  p_to timestamptz,
  p_group_by text,
  p_currency text default 'USD',
  p_tz text default 'Asia/Tokyo'
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_group text := lower(trim(coalesce(p_group_by, '')));
  v_currency text := upper(trim(coalesce(p_currency, 'USD')));
  v_from timestamptz := p_from;
  v_to timestamptz := p_to;
  v_rows jsonb := '[]'::jsonb;
begin
  if v_from is null or v_to is null or v_to <= v_from then
    return jsonb_build_object('ok', false, 'error', 'invalid_range');
  end if;

  if v_group not in ('day', 'month', 'provider', 'model', 'feature', 'user') then
    return jsonb_build_object('ok', false, 'error', 'invalid_group_by');
  end if;

  -- 一般ユーザー向け公開 API ではない · security definer だが execute は service_role のみ
  with base as (
    select
      e.*,
      public.ai_estimate_event_cost(
        e.provider, e.model, e.status, e.input_units, e.output_units, e.created_at, v_currency
      ) as cost_json
    from public.ai_usage_events e
    where e.created_at >= v_from
      and e.created_at < v_to
  ),
  scored as (
    select
      b.*,
      (b.cost_json ->> 'billable')::boolean as billable,
      b.cost_json ->> 'cost_status' as cost_status,
      case
        when (b.cost_json ->> 'estimated_cost') is null then null
        else (b.cost_json ->> 'estimated_cost')::numeric
      end as estimated_cost
    from base b
  ),
  grouped as (
    select
      case v_group
        when 'day' then to_char(timezone(p_tz, created_at), 'YYYY-MM-DD')
        when 'month' then to_char(timezone(p_tz, created_at), 'YYYY-MM')
        when 'provider' then provider
        when 'model' then coalesce(model, '')
        when 'feature' then feature
        when 'user' then coalesce(user_id::text, 'anonymous')
      end as bucket,
      count(*)::bigint as event_count,
      count(*) filter (where status = 'success')::bigint as success_count,
      count(*) filter (where status = 'error')::bigint as error_count,
      count(*) filter (where status = 'denied')::bigint as denied_count,
      count(*) filter (where cost_status = 'unknown_rate')::bigint as unknown_rate_count,
      coalesce(sum(estimated_cost) filter (where estimated_cost is not null), 0) as estimated_cost_sum,
      count(*) filter (where estimated_cost is not null)::bigint as costed_event_count
    from scored
    group by 1
    order by 1
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'bucket', bucket,
      'event_count', event_count,
      'success_count', success_count,
      'error_count', error_count,
      'denied_count', denied_count,
      'unknown_rate_count', unknown_rate_count,
      'costed_event_count', costed_event_count,
      'estimated_cost_sum', estimated_cost_sum,
      'currency', v_currency
    )
    order by bucket
  ), '[]'::jsonb)
  into v_rows
  from grouped;

  return jsonb_build_object(
    'ok', true,
    'group_by', v_group,
    'currency', v_currency,
    'from', v_from,
    'to', v_to,
    'tz', p_tz,
    'note', 'estimated_api_cost_not_provider_invoice_not_customer_billing',
    'rows', v_rows
  );
end;
$$;

revoke all on function public.ai_cost_ledger_aggregate(
  timestamptz, timestamptz, text, text, text
) from public, anon, authenticated;

grant execute on function public.ai_cost_ledger_aggregate(
  timestamptz, timestamptz, text, text, text
) to service_role;
