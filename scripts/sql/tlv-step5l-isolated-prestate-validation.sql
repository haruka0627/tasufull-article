\set ON_ERROR_STOP on
do $$
begin
  if (select count(*) from tlv.revenue_ledger where tip_id is not null) <> 7 then
    raise exception 'prestate_source_count_mismatch';
  end if;
  if (select sum(gross_amount_jpy) from tlv.revenue_ledger where tip_id is not null) <> 145000 then
    raise exception 'prestate_source_total_mismatch';
  end if;
  if to_regclass('tlv.revenue_disposition_events') is not null then
    raise exception 'prestate_unexpected_disposition_registry';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'tlv' and table_name = 'monthly_settlements'
      and column_name = 'revenue_share_brackets'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'tlv' and table_name = 'monthly_settlements'
      and column_name = 'eligible_net_basis_jpy'
  ) then
    raise exception 'prestate_progressive_snapshot_contract_missing';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'tlv' and table_name = 'monthly_settlements'
      and column_name in ('tier_basis_jpy', 'applied_tier', 'creator_share_rate_pct')
  ) then
    raise exception 'prestate_one_shot_tier_contract_remains';
  end if;
  if (select count(*) from tlv.payments) <> 0
     or (select count(*) from tlv.payment_provider_events) <> 0
     or (select count(*) from tlv.wallet_ledger) <> 0
     or (select count(*) from tlv.coin_lots) <> 0
     or (select count(*) from tlv.tip_coin_lot_allocations) <> 0 then
    raise exception 'prestate_unexpected_side_effect';
  end if;
end $$;

select
  count(*) as source_rows,
  sum(gross_amount_jpy) as source_gross_jpy,
  sum(creator_payout_jpy) as creator_payout_jpy,
  md5(string_agg(id::text || ':' || gross_amount_jpy::text || ':' || platform_revenue_jpy::text, ',' order by id)) as source_fingerprint
from tlv.revenue_ledger
where tip_id is not null;
