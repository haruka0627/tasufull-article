\set ON_ERROR_STOP on

do $$
declare
  v_payout_rls boolean;
  v_payout_force boolean;
  v_registry_rls boolean;
  v_registry_force boolean;
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'tlv.payout_log'::regclass
      and conname = 'payout_log_score_monthly_fk'
  ) then
    raise exception 'gate02_legacy_score_fk_remains';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'tlv' and table_name = 'payout_log'
      and column_name = 'settlement_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'tlv' and table_name = 'payout_log'
      and column_name = 'payout_creation_key'
  ) then
    raise exception 'gate02_option_a_columns_missing';
  end if;

  if (select count(*) from tlv.payout_log) <> 0 then
    raise exception 'gate02_unexpected_payout_rows';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'tlv' and p.proname = 'create_canonical_settlement_payout'
  ) or not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'tlv' and p.proname = 'transition_canonical_settlement_payout'
  ) then
    raise exception 'gate02_option_a_service_boundary_missing';
  end if;

  select relrowsecurity, relforcerowsecurity
    into v_payout_rls, v_payout_force
  from pg_class where oid = 'tlv.payout_log'::regclass;
  select relrowsecurity, relforcerowsecurity
    into v_registry_rls, v_registry_force
  from pg_class where oid = 'tlv.revenue_disposition_events'::regclass;
  if not (v_payout_rls and v_payout_force and v_registry_rls and v_registry_force) then
    raise exception 'gate02_force_rls_missing';
  end if;

  if (select count(*) from tlv.revenue_ledger where tip_id is not null) <> 7
     or (select count(*) from tlv.revenue_disposition_events) <> 7
     or (select count(*) from tlv.revenue_ledger where adjustment_kind = 'SYNTHETIC_QA_NEUTRALIZATION') <> 7
     or (select sum(platform_revenue_jpy) from tlv.revenue_ledger) <> 0
     or (select sum(creator_payout_jpy) from tlv.revenue_ledger) <> 0 then
    raise exception 'gate02_exact_seven_poststate_mismatch';
  end if;

  if (select count(*) from tlv.revenue_disposition_events
      where tax_policy_status = 'NOT_CONFIGURED' and not real_money_moved) <> 7 then
    raise exception 'gate02_fail_closed_disposition_mismatch';
  end if;

  if (select count(*) from tlv.payments) <> 0
     or (select count(*) from tlv.payment_provider_events) <> 0
     or (select count(*) from tlv.wallet_ledger) <> 0
     or (select count(*) from tlv.coin_lots) <> 0
     or (select count(*) from tlv.tip_coin_lot_allocations) <> 0 then
    raise exception 'gate02_real_money_side_effect';
  end if;
end $$;

select
  'TLV_STEP5L_PROD_GATE_02_FULL_CHAIN_VALIDATION: PASS' as result,
  (select count(*) from tlv.revenue_ledger where tip_id is not null) as source_rows,
  (select count(*) from tlv.revenue_disposition_events) as disposition_rows,
  (select count(*) from tlv.revenue_ledger where adjustment_kind = 'SYNTHETIC_QA_NEUTRALIZATION') as correction_rows,
  (select sum(platform_revenue_jpy) from tlv.revenue_ledger) as net_tasful_jpy,
  (select count(*) from tlv.payout_log) as payout_rows;
