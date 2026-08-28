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
    p_id, p_creator_id, p_period, 'step5-progressive-calc-v2', 'tlv_financial_policy.progressive.2026-08-28.v1',
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
    'initial-' || p_id::text, '2026-08-27 00:00:00+00', 'step5-system',
    '{"fixture":"synthetic"}'::jsonb,
    '2026-08-27 00:00:00+00', '2026-08-27 00:00:00+00'
  );
  return p_id;
end
$$;

-- -------------------------------------------------------------------------
-- Schema, constraint, index, privilege, and function boundary inspection.
-- -------------------------------------------------------------------------
select step5_test.assert_true(to_regclass('tlv.monthly_settlements') is not null, 'monthly_settlements missing');
select step5_test.assert_true(to_regclass('tlv.settlement_ledger_links') is not null, 'settlement_ledger_links missing');
select step5_test.assert_true(to_regclass('tlv.settlement_state_events') is not null, 'settlement_state_events missing');
select step5_test.assert_true(to_regclass('tlv.settlement_hold_events') is not null, 'settlement_hold_events missing');
select step5_test.assert_true(to_regclass('tlv.monthly_settlements_one_locked_period_idx') is not null, 'locked-period index missing');
select step5_test.assert_true(to_regclass('tlv.monthly_settlements_carry_source_uniq') is not null, 'carry-source uniqueness missing');
select step5_test.assert_true(to_regclass('tlv.revenue_ledger_adjustment_provider_event_uniq') is not null, 'adjustment idempotency index missing');
select step5_test.assert_true(to_regclass('tlv.payout_log_correlation_uniq') is not null, 'payout correlation uniqueness missing');
select step5_test.assert_true(to_regclass('tlv.payout_log_provider_transfer_uniq') is not null, 'provider transfer uniqueness missing');
select step5_test.assert_true(to_regclass('tlv.payout_log_provider_payout_uniq') is not null, 'provider payout uniqueness missing');
select step5_test.assert_true((select relrowsecurity and relforcerowsecurity from pg_class where oid='tlv.monthly_settlements'::regclass), 'settlement RLS/FORCE missing');
select step5_test.assert_true((select relrowsecurity and relforcerowsecurity from pg_class where oid='tlv.payout_log'::regclass), 'payout RLS/FORCE missing');
select step5_test.assert_true(not has_function_privilege('authenticated', 'tlv.transition_monthly_settlement(uuid,integer,tlv.settlement_status,text,text,timestamptz,jsonb,jsonb)', 'EXECUTE'), 'authenticated transition RPC execute');
select step5_test.assert_true(has_function_privilege('service_role', 'tlv.transition_monthly_settlement(uuid,integer,tlv.settlement_status,text,text,timestamptz,jsonb,jsonb)', 'EXECUTE'), 'service transition RPC missing');
select step5_test.assert_true((select prosecdef from pg_proc where oid='tlv.transition_monthly_settlement(uuid,integer,tlv.settlement_status,text,text,timestamptz,jsonb,jsonb)'::regprocedure), 'transition RPC not security definer');
select step5_test.assert_true((select proconfig @> array['search_path=pg_catalog, tlv'] from pg_proc where oid='tlv.transition_monthly_settlement(uuid,integer,tlv.settlement_status,text,text,timestamptz,jsonb,jsonb)'::regprocedure), 'transition RPC search_path not fixed');
select step5_test.assert_true(not (select rolbypassrls from pg_roles where rolname='authenticated'), 'authenticated bypassrls');
select step5_test.assert_true((select rolbypassrls from pg_roles where rolname='service_role'), 'isolated service role boundary inaccurate');

-- Synthetic actors only.
insert into tlv.creators (id, user_id, display_name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Synthetic Creator A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Synthetic Creator B');

-- Minimum payout and finalized carry source.
select step5_test.insert_settlement('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-01', 1, 1000);
select step5_test.assert_true((select not minimum_payout_met and payout_amount_jpy=0 and carry_forward_out_jpy=800 from tlv.monthly_settlements where id='a1000000-0000-4000-8000-000000000001'), 'minimum payout/carry output');

set role service_role;
select tlv.transition_monthly_settlement('a1000000-0000-4000-8000-000000000001',1,'REVIEWABLE','s1-review','service-step5','2026-08-27 01:00:00+00','{"review":"ok"}', '{}');
select tlv.transition_monthly_settlement('a1000000-0000-4000-8000-000000000001',1,'FINALIZED','s1-final','service-step5','2026-08-27 02:00:00+00','{"final":"ok"}', '{"finalized_snapshot_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}');
reset role;

select step5_test.insert_settlement('a2000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-02', 1, 5000, 800, 'a1000000-0000-4000-8000-000000000001');
select step5_test.assert_true((select minimum_payout_met and payout_amount_jpy=4800 and carry_forward_out_jpy=0 from tlv.monthly_settlements where id='a2000000-0000-4000-8000-000000000002'), 'carry-forward consumption');
select step5_test.expect_error($q$select step5_test.insert_settlement('a2999999-0000-4000-8000-000000000099','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-03',1,5000,800,'a1000000-0000-4000-8000-000000000001')$q$, 'duplicate key');

-- Independent DB oracle: all required progressive boundaries with fixed expected outputs.
select step5_test.insert_settlement('b0000000-0000-4000-8000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-01', 1, 0);
select step5_test.insert_settlement('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-02', 1, 1);
select step5_test.insert_settlement('b2000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-03', 1, 4999999);
select step5_test.insert_settlement('b3000000-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-04', 1, 5000000);
select step5_test.insert_settlement('b4000000-0000-4000-8000-000000000004', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-05', 1, 5000001);
select step5_test.insert_settlement('b5000000-0000-4000-8000-000000000005', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-06', 1, 9999999);
select step5_test.insert_settlement('b6000000-0000-4000-8000-000000000006', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-07', 1, 10000000);
select step5_test.insert_settlement('b7000000-0000-4000-8000-000000000007', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-08', 1, 10000001);
select step5_test.insert_settlement('b8000000-0000-4000-8000-000000000008', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-09', 1, 29999999);
select step5_test.insert_settlement('b9000000-0000-4000-8000-000000000009', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-10', 1, 30000000);
select step5_test.insert_settlement('ba000000-0000-4000-8000-000000000010', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-11', 1, 30000001);
select step5_test.insert_settlement('bb000000-0000-4000-8000-000000000011', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2025-12', 1, 100000000);
select step5_test.assert_true((select creator_payable_current_period_jpy=0 and tasful_retained_revenue_jpy=0 from tlv.monthly_settlements where id='b0000000-0000-4000-8000-000000000000'), 'oracle 0');
select step5_test.assert_true((select creator_payable_current_period_jpy=0 and tasful_retained_revenue_jpy=1 from tlv.monthly_settlements where id='b1000000-0000-4000-8000-000000000001'), 'oracle 1');
select step5_test.assert_true((select creator_payable_current_period_jpy=3999999 and tasful_retained_revenue_jpy=1000000 from tlv.monthly_settlements where id='b2000000-0000-4000-8000-000000000002'), 'oracle 4,999,999');
select step5_test.assert_true((select creator_payable_current_period_jpy=4000000 and tasful_retained_revenue_jpy=1000000 from tlv.monthly_settlements where id='b3000000-0000-4000-8000-000000000003'), 'oracle 5,000,000');
select step5_test.assert_true((select creator_payable_current_period_jpy=4000000 and tasful_retained_revenue_jpy=1000001 from tlv.monthly_settlements where id='b4000000-0000-4000-8000-000000000004'), 'oracle 5,000,001');
select step5_test.assert_true((select creator_payable_current_period_jpy=8499999 and tasful_retained_revenue_jpy=1500000 from tlv.monthly_settlements where id='b5000000-0000-4000-8000-000000000005'), 'oracle 9,999,999');
select step5_test.assert_true((select creator_payable_current_period_jpy=8500000 and tasful_retained_revenue_jpy=1500000 from tlv.monthly_settlements where id='b6000000-0000-4000-8000-000000000006'), 'oracle 10,000,000');
select step5_test.assert_true((select creator_payable_current_period_jpy=8500000 and tasful_retained_revenue_jpy=1500001 from tlv.monthly_settlements where id='b7000000-0000-4000-8000-000000000007'), 'oracle 10,000,001');
select step5_test.assert_true((select creator_payable_current_period_jpy=27499999 and tasful_retained_revenue_jpy=2500000 from tlv.monthly_settlements where id='b8000000-0000-4000-8000-000000000008'), 'oracle 29,999,999');
select step5_test.assert_true((select creator_payable_current_period_jpy=27500000 and tasful_retained_revenue_jpy=2500000 from tlv.monthly_settlements where id='b9000000-0000-4000-8000-000000000009'), 'oracle 30,000,000');
select step5_test.assert_true((select creator_payable_current_period_jpy=27500000 and tasful_retained_revenue_jpy=2500001 from tlv.monthly_settlements where id='ba000000-0000-4000-8000-000000000010'), 'oracle 30,000,001');
select step5_test.assert_true((select creator_payable_current_period_jpy=96800000 and tasful_retained_revenue_jpy=3200000 from tlv.monthly_settlements where id='bb000000-0000-4000-8000-000000000011'), 'oracle 100,000,000');
select step5_test.expect_error($q$select step5_test.insert_settlement('bc000000-0000-4000-8000-000000000012','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-12',1,-1)$q$, 'monthly_eligible_net_must_be_nonnegative');

-- Cross-user RLS and privilege escalation resistance.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{}}',false);
set role authenticated;
select step5_test.assert_true((select count(*)=2 from tlv.monthly_settlements where creator_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'creator A own settlement visibility');
select step5_test.assert_true((select count(*)=0 from tlv.monthly_settlements where creator_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'creator A can see creator B');
select step5_test.assert_true((select count(*)=0 from tlv.settlement_state_events), 'creator can see ops state evidence');
select step5_test.expect_error($q$insert into tlv.monthly_settlements (id) values ('e0000000-0000-4000-8000-000000000001')$q$, 'permission denied');
select step5_test.expect_error($q$update tlv.monthly_settlements set payout_amount_jpy=999 where id='a2000000-0000-4000-8000-000000000002'$q$, 'permission denied');
select step5_test.expect_error($q$delete from tlv.monthly_settlements where id='a2000000-0000-4000-8000-000000000002'$q$, 'permission denied');
select step5_test.expect_error($q$select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'REVIEWABLE','attacker','attacker',now(),'{"x":1}','{}')$q$, 'permission denied');
reset role;
select step5_test.assert_true(not pg_has_role('authenticated','service_role','MEMBER'), 'authenticated is a member of service_role');

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","app_metadata":{}}',false);
set role authenticated;
select step5_test.assert_true((select count(*)=0 from tlv.monthly_settlements), 'buyer can read creator financial data');
select step5_test.assert_true((select count(*)=0 from tlv.payout_log), 'buyer can read payout data');
reset role;
set role anon;
select step5_test.expect_error($q$select * from tlv.monthly_settlements$q$, 'permission denied');
reset role;

-- State machine, immutable finalized snapshot, tax fail-closed, unknown and PAID evidence.
set role service_role;
select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'REVIEWABLE','s2-review','service-step5','2026-08-27 03:00:00+00','{"review":"ok"}', '{}');
select step5_test.expect_error($q$select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'PAID','s2-invalid-paid','service-step5','2026-08-27 03:30:00+00','{"external_payout_confirmed":true}','{"provider_payout_id":"invalid"}')$q$, 'invalid_settlement_transition');
select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'FINALIZED','s2-final','service-step5','2026-08-27 04:00:00+00','{"final":"ok"}', '{"finalized_snapshot_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}');
select step5_test.expect_error($q$update tlv.monthly_settlements set gross_jpy=gross_jpy+1 where id='a2000000-0000-4000-8000-000000000002'$q$, 'same_status_snapshot_update_forbidden');
select step5_test.expect_error($q$delete from tlv.monthly_settlements where id='a2000000-0000-4000-8000-000000000002'$q$, 'finalized_settlement_delete_forbidden');
select step5_test.expect_error($q$select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'TRANSFER_PENDING','s2-prod-tax','service-step5','2026-08-27 05:00:00+00','{"transfer":"attempt"}', '{"transfer_instruction":{"settlement_id":"a2000000-0000-4000-8000-000000000002","creator_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","amount_jpy":4800,"currency":"JPY","policy_version":"tlv_financial_policy.progressive.2026-08-28.v1","provider_account_binding":"acct_synthetic","idempotency_key":"transfer-s2","environment":"production","provider_execution_performed":false}}')$q$, 'tax_policy_not_configured');
select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'TRANSFER_PENDING','s2-pending','service-step5','2026-08-27 05:01:00+00','{"transfer":"fixture"}', '{"transfer_instruction":{"settlement_id":"a2000000-0000-4000-8000-000000000002","creator_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","amount_jpy":4800,"currency":"JPY","policy_version":"tlv_financial_policy.progressive.2026-08-28.v1","provider_account_binding":"acct_synthetic","idempotency_key":"transfer-s2","environment":"test","provider_execution_performed":false}}');
select step5_test.assert_true(((tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'TRANSFER_PENDING','s2-pending','service-step5','2026-08-27 05:01:00+00','{"transfer":"fixture"}', '{}'))->>'idempotent')::boolean, 'transition idempotency');
select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'TRANSFER_UNKNOWN','s2-unknown','service-step5','2026-08-27 05:02:00+00','{"timeout":"synthetic"}', '{"provider_correlation_id":"corr-s2"}');
select step5_test.expect_error($q$select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'TRANSFER_PENDING','s2-auto-retry','service-step5','2026-08-27 05:03:00+00','{"retry":true}', '{}')$q$, 'invalid_settlement_transition');
select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'TRANSFERRED','s2-transferred','service-step5','2026-08-27 05:04:00+00','{"provider":"confirmed"}', '{"provider_transfer_id":"tr_synthetic_s2"}');
select step5_test.expect_error($q$select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'PAID','s2-paid-no-evidence','service-step5','2026-08-27 05:05:00+00','{"external_payout_confirmed":false}', '{"provider_payout_id":"po_synthetic_s2"}')$q$, 'provider_payout_evidence_required');
select tlv.transition_monthly_settlement('a2000000-0000-4000-8000-000000000002',1,'PAID','s2-paid','service-step5','2026-08-27 05:06:00+00','{"external_payout_confirmed":true,"fixture":true}', '{"provider_payout_id":"po_synthetic_s2"}');
reset role;
select step5_test.assert_true((select status='PAID' and provider_transfer_id='tr_synthetic_s2' and provider_payout_id='po_synthetic_s2' from tlv.monthly_settlements where id='a2000000-0000-4000-8000-000000000002'), 'PAID evidence semantics');

-- Hold must block transfer until an explicitly approved release event.
select step5_test.insert_settlement('a3000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-03', 1, 2000);
set role service_role;
select tlv.transition_monthly_settlement('a3000000-0000-4000-8000-000000000003',1,'REVIEWABLE','s3-review','service-step5','2026-08-27 06:00:00+00','{"review":"ok"}', '{}');
select tlv.transition_monthly_settlement('a3000000-0000-4000-8000-000000000003',1,'FINALIZED','s3-final','service-step5','2026-08-27 06:01:00+00','{"final":"ok"}', '{"finalized_snapshot_hash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}');
insert into tlv.settlement_hold_events(settlement_id,action,reason_code,evidence,actor_id,idempotency_key,occurred_at)
values('a3000000-0000-4000-8000-000000000003','PLACED','SYNTHETIC_REVIEW','{"fixture":true}','service-step5','hold-s3','2026-08-27 06:02:00+00');
select step5_test.expect_error($q$select tlv.transition_monthly_settlement('a3000000-0000-4000-8000-000000000003',1,'TRANSFER_PENDING','s3-pending-blocked','service-step5','2026-08-27 06:03:00+00','{"transfer":"fixture"}', '{"transfer_instruction":{"settlement_id":"a3000000-0000-4000-8000-000000000003","creator_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","amount_jpy":1600,"currency":"JPY","policy_version":"tlv_financial_policy.progressive.2026-08-28.v1","provider_account_binding":"acct_synthetic","idempotency_key":"transfer-s3","environment":"test","provider_execution_performed":false}}')$q$, 'active_operational_hold_blocks_transfer');
select step5_test.expect_error($q$insert into tlv.settlement_hold_events(settlement_id,action,reason_code,evidence,actor_id,idempotency_key,occurred_at) values('a3000000-0000-4000-8000-000000000003','RELEASED','SYNTHETIC_REVIEW','{"fixture":true}','service-step5','release-s3-bad','2026-08-27 06:04:00+00')$q$, 'settlement_hold_events_evidence_chk');
insert into tlv.settlement_hold_events(settlement_id,action,reason_code,evidence,actor_id,approved_by,idempotency_key,occurred_at)
values('a3000000-0000-4000-8000-000000000003','RELEASED','SYNTHETIC_REVIEW','{"fixture":true}','service-step5','human-synthetic-approver','release-s3','2026-08-27 06:05:00+00');
select tlv.transition_monthly_settlement('a3000000-0000-4000-8000-000000000003',1,'TRANSFER_PENDING','s3-pending','service-step5','2026-08-27 06:06:00+00','{"transfer":"fixture"}', '{"transfer_instruction":{"settlement_id":"a3000000-0000-4000-8000-000000000003","creator_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","amount_jpy":1600,"currency":"JPY","policy_version":"tlv_financial_policy.progressive.2026-08-28.v1","provider_account_binding":"acct_synthetic","idempotency_key":"transfer-s3","environment":"test","provider_execution_performed":false}}');
select step5_test.expect_error($q$update tlv.settlement_hold_events set reason_code='tamper' where idempotency_key='hold-s3'$q$, 'append_only_financial_object_mutation_forbidden');
reset role;

-- Late adjustment and refund/chargeback provider correlation, including duplicates.
insert into tlv.payment_provider_events(id,provider,provider_event_id,event_type,status,payload_hash,received_at)
values
 ('d1000000-0000-4000-8000-000000000001','stripe','evt_refund_synthetic','charge.refunded','processed',repeat('a',64),'2026-03-10 00:00:00+00'),
 ('d2000000-0000-4000-8000-000000000002','stripe','evt_chargeback_synthetic','charge.dispute.created','processed',repeat('b',64),'2026-03-11 00:00:00+00');
insert into tlv.revenue_ledger(id,creator_id,event_kind,ledger_month,gross_amount_jpy,fee_amount_jpy,net_amount_jpy,infra_cost_jpy,creator_payout_jpy,platform_revenue_jpy,notes,occurred_at,payment_provider_event_id,adjustment_kind,adjustment_of_settlement_id)
values('e1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','adjustment','2026-04',-100,0,-100,0,0,-100,'refund:synthetic late event','2026-03-10 00:00:00+00','d1000000-0000-4000-8000-000000000001','REFUND','a1000000-0000-4000-8000-000000000001');
insert into tlv.revenue_ledger(id,creator_id,event_kind,ledger_month,gross_amount_jpy,fee_amount_jpy,net_amount_jpy,infra_cost_jpy,creator_payout_jpy,platform_revenue_jpy,notes,occurred_at,payment_provider_event_id,adjustment_kind,adjustment_of_settlement_id)
values('e2000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','adjustment','2026-04',-200,0,-200,0,0,-200,'chargeback:synthetic late event','2026-03-11 00:00:00+00','d2000000-0000-4000-8000-000000000002','CHARGEBACK','a1000000-0000-4000-8000-000000000001');
select step5_test.assert_true((select ledger_month='2026-04' and adjustment_kind='REFUND' and adjustment_of_settlement_id='a1000000-0000-4000-8000-000000000001' from tlv.revenue_ledger where id='e1000000-0000-4000-8000-000000000001'), 'late refund recognition/correlation');
select step5_test.expect_error($q$insert into tlv.revenue_ledger(id,creator_id,event_kind,ledger_month,gross_amount_jpy,fee_amount_jpy,net_amount_jpy,infra_cost_jpy,creator_payout_jpy,platform_revenue_jpy,occurred_at,adjustment_kind) values('e3000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','adjustment','2026-04',-1,0,-1,0,0,-1,'2026-04-01','REFUND')$q$, 'revenue_ledger_adjustment_kind_chk');
select step5_test.expect_error($q$insert into tlv.revenue_ledger(id,creator_id,event_kind,ledger_month,gross_amount_jpy,fee_amount_jpy,net_amount_jpy,infra_cost_jpy,creator_payout_jpy,platform_revenue_jpy,occurred_at,payment_provider_event_id,adjustment_kind,adjustment_of_settlement_id) values('e4000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','adjustment','2026-04',-100,0,-100,0,0,-100,'2026-03-10','d1000000-0000-4000-8000-000000000001','REFUND','a1000000-0000-4000-8000-000000000001')$q$, 'duplicate key');
select step5_test.expect_error($q$update tlv.revenue_ledger set notes='tamper' where id='e1000000-0000-4000-8000-000000000001'$q$, 'append_only_financial_object_mutation_forbidden');

insert into tlv.settlement_ledger_links(settlement_id,revenue_ledger_id,correlation,economic_period,recognition_period,adjustment_of_settlement_id)
values('a3000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000001','{"provider_event_id":"evt_refund_synthetic","fixture":true}','2026-03','2026-04','a1000000-0000-4000-8000-000000000001');
select step5_test.expect_error($q$insert into tlv.settlement_ledger_links(settlement_id,revenue_ledger_id,correlation,economic_period,recognition_period) values('a3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000002','{}','2026-03','2026-04')$q$, 'settlement_links_correlation_chk');
select step5_test.expect_error($q$update tlv.settlement_ledger_links set correlation='{"tamper":true}' where settlement_id='a3000000-0000-4000-8000-000000000003'$q$, 'append_only_financial_object_mutation_forbidden');

-- Payout correlation uniqueness and legacy-rate separation.
insert into tlv.creator_score_monthly(
  creator_id,month_id,fs,es,gs,ts,total,score_ma30,rank_tier,base_rate,effective_rate
) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-02',0,0,0,100,100,100,'bronze',0.5,0.5),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-03',0,0,0,100,100,100,'bronze',0.5,0.5),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-08',0,0,0,100,100,100,'bronze',0.5,0.5),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-04',0,0,0,100,100,100,'bronze',0.5,0.5),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-05',0,0,0,100,100,100,'bronze',0.5,0.5),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-06',0,0,0,100,100,100,'bronze',0.5,0.5),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-07',0,0,0,100,100,100,'bronze',0.5,0.5);
insert into tlv.payout_log(id,creator_id,month_id,base_rate,override_tier,effective_rate,creator_payout_jpy,total_payout_jpy,status,settlement_id,correlation_id,transfer_idempotency_key,provider_transfer_id,provider_payout_id,transfer_evidence)
values('f1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-02',null,null,null,4800,4800,'paid','a2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','payout-key-s2','tr_synthetic_s2','po_synthetic_s2','{"fixture":true}');
select step5_test.expect_error($q$insert into tlv.payout_log(id,creator_id,month_id,base_rate,override_tier,effective_rate,status,correlation_id) values('f2000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-04',0.5,'none',0.5,'pending','c1000000-0000-4000-8000-000000000001')$q$, 'duplicate key');
select step5_test.expect_error($q$insert into tlv.payout_log(id,creator_id,month_id,base_rate,override_tier,effective_rate,status,transfer_idempotency_key) values('f3000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-05',0.5,'none',0.5,'pending','payout-key-s2')$q$, 'duplicate key');
select step5_test.expect_error($q$insert into tlv.payout_log(id,creator_id,month_id,base_rate,override_tier,effective_rate,status,provider_transfer_id) values('f4000000-0000-4000-8000-000000000004','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-06',0.5,'none',0.5,'pending','tr_synthetic_s2')$q$, 'duplicate key');
select step5_test.expect_error($q$insert into tlv.payout_log(id,creator_id,month_id,base_rate,override_tier,effective_rate,status,provider_payout_id) values('f5000000-0000-4000-8000-000000000005','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-07',0.5,'none',0.5,'pending','po_synthetic_s2')$q$, 'duplicate key');
select step5_test.expect_error($q$insert into tlv.payout_log(id,creator_id,month_id,base_rate,override_tier,effective_rate,status,settlement_id) values('f6000000-0000-4000-8000-000000000006','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-08',0.5,'none',0.5,'pending','a3000000-0000-4000-8000-000000000003')$q$, 'payout_log_settlement_no_legacy_rate_chk');

-- Explicit duplicate settlement/version and state-event audit cardinality.
select step5_test.expect_error($q$select step5_test.insert_settlement('a2000000-9999-4000-8000-000000000099','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-02',1,5000)$q$, 'duplicate key');
select step5_test.assert_true((select count(*)=7 from tlv.settlement_state_events where settlement_id='a2000000-0000-4000-8000-000000000002'), 'state transition audit/idempotency cardinality');
select step5_test.assert_true((select tax_policy_status='NOT_CONFIGURED' from tlv.monthly_settlements where id='a2000000-0000-4000-8000-000000000002'), 'tax status changed');

select 'STEP5_DB_VERIFY_PASS' as result;
