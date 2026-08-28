\set ON_ERROR_STOP on

create schema if not exists step5_test;

create or replace function step5_test.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_value is not true then
    raise exception 'STEP5_ASSERTION_FAILED:%', p_message;
  end if;
end
$$;

create or replace function step5_test.expect_error(p_sql text, p_pattern text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_pattern) in lower(sqlerrm)) = 0 then
      raise exception 'STEP5_UNEXPECTED_ERROR expected=% actual=%', p_pattern, sqlerrm;
    end if;
    return;
  end;
  raise exception 'STEP5_EXPECTED_ERROR_NOT_RAISED:%', p_pattern;
end
$$;

grant usage on schema step5_test to anon, authenticated, service_role;
grant execute on function step5_test.assert_true(boolean, text) to anon, authenticated, service_role;
grant execute on function step5_test.expect_error(text, text) to anon, authenticated, service_role;

create or replace function step5_test.insert_settlement(
  p_id uuid,
  p_creator_id uuid,
  p_period char(7),
  p_version integer,
  p_net bigint,
  p_carry bigint default 0,
  p_carry_source uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_creator_rate integer;
  v_retained_rate integer;
  v_bracket text;
  v_before numeric(24,2);
  v_creator_effective numeric(9,6);
  v_tasful_effective numeric(9,6);
  v_brackets jsonb;
  v_current bigint;
  v_final bigint;
  v_hash char(64);
begin
  if p_net < 0 then
    raise exception 'monthly_eligible_net_must_be_nonnegative';
  elsif p_net <= 5000000 then
    v_creator_rate := 80; v_retained_rate := 20; v_bracket := 'JPY_0_TO_5M';
  elsif p_net <= 10000000 then
    v_creator_rate := 90; v_retained_rate := 10; v_bracket := 'JPY_5M_TO_10M';
  elsif p_net <= 30000000 then
    v_creator_rate := 95; v_retained_rate := 5; v_bracket := 'JPY_10M_TO_30M';
  else
    v_creator_rate := 99; v_retained_rate := 1; v_bracket := 'JPY_ABOVE_30M';
  end if;
  v_before := (case
    when p_net <= 5000000 then p_net::numeric * 0.80
    when p_net <= 10000000 then 4000000::numeric + (p_net - 5000000)::numeric * 0.90
    when p_net <= 30000000 then 8500000::numeric + (p_net - 10000000)::numeric * 0.95
    else 27500000::numeric + (p_net - 30000000)::numeric * 0.99
  end)::numeric(24,2);
  v_creator_effective := case when p_net = 0 then null else round(v_before / p_net::numeric * 100, 6) end;
  v_tasful_effective := case when p_net = 0 then null else round(100 - v_creator_effective, 6) end;
  v_brackets := '[]'::jsonb
    || case when p_net > 0 then jsonb_build_array(jsonb_build_object('bracket','JPY_0_TO_5M','eligible_net_portion_jpy',least(p_net,5000000),'creator_marginal_rate_pct',80,'tasful_marginal_rate_pct',20)) else '[]'::jsonb end
    || case when p_net > 5000000 then jsonb_build_array(jsonb_build_object('bracket','JPY_5M_TO_10M','eligible_net_portion_jpy',least(p_net,10000000)-5000000,'creator_marginal_rate_pct',90,'tasful_marginal_rate_pct',10)) else '[]'::jsonb end
    || case when p_net > 10000000 then jsonb_build_array(jsonb_build_object('bracket','JPY_10M_TO_30M','eligible_net_portion_jpy',least(p_net,30000000)-10000000,'creator_marginal_rate_pct',95,'tasful_marginal_rate_pct',5)) else '[]'::jsonb end
    || case when p_net > 30000000 then jsonb_build_array(jsonb_build_object('bracket','JPY_ABOVE_30M','eligible_net_portion_jpy',p_net-30000000,'creator_marginal_rate_pct',99,'tasful_marginal_rate_pct',1)) else '[]'::jsonb end;
  v_current := floor(v_before);
  v_final := v_current + p_carry;
  v_hash := (md5(p_id::text) || md5(p_id::text))::char(64);

  insert into tlv.monthly_settlements (
    id, creator_id, settlement_period, calculation_version, policy_version,
    version, status, source_ledger_ids, source_correlations,
    gross_jpy, provider_payment_fee_jpy, refund_jpy, chargeback_jpy,
    creator_attributed_net_jpy, eligible_net_basis_jpy, revenue_share_model,
    applied_marginal_bracket, creator_marginal_share_rate_pct, tasful_marginal_retained_rate_pct,
    creator_effective_share_rate_pct, tasful_effective_share_rate_pct, revenue_share_brackets,
    creator_amount_before_rounding_jpy, rounding_residual_jpy,
    creator_payable_current_period_jpy, carry_forward_in_jpy,
    carry_forward_source_settlement_id, carry_forward_out_jpy,
    final_creator_payable_jpy, payout_amount_jpy, minimum_payout_met,
    tasful_retained_revenue_jpy, financial_snapshot_hash,
    last_transition_key, last_transition_at, last_transition_actor,
    last_transition_evidence, created_at, calculated_at
  ) values (
    p_id, p_creator_id, p_period, 'step5d-progressive-calc-v2', 'tlv_financial_policy.progressive.2026-08-28.v1',
    p_version, 'CALCULATED', '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('fixture', p_id::text)),
    p_net, 0, 0, 0, p_net, p_net, 'TLV_PROGRESSIVE_V1',
    v_bracket, v_creator_rate, v_retained_rate,
    v_creator_effective, v_tasful_effective, v_brackets,
    v_before, v_before - floor(v_before),
    v_current, p_carry, p_carry_source,
    case when v_final < 1000 then v_final else 0 end,
    v_final, case when v_final >= 1000 then v_final else 0 end,
    v_final >= 1000, p_net - v_current, v_hash,
    'initial-' || p_id::text, '2026-08-28 00:00:00+00', 'step5d-system',
    '{"fixture":"synthetic"}'::jsonb,
    '2026-08-28 00:00:00+00', '2026-08-28 00:00:00+00'
  );
  return p_id;
end
$$;

insert into tlv.creators (id, user_id, display_name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Synthetic Creator A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Synthetic Creator B');

select step5_test.assert_true((select count(*)=0 from tlv.payout_log), 'zero-legacy payout baseline lost');
select step5_test.assert_true((select count(*)=0 from tlv.creator_score_monthly), 'Production-shaped score baseline lost');
select 'STEP5D_ZERO_LEGACY_BASELINE_PASS' as result;
