\set ON_ERROR_STOP on

-- Disposable transaction: prove OPTION_A copies the persisted progressive
-- snapshot amount and cannot recalculate from marginal/effective rates.
begin;

insert into tlv.creators (id, user_id, display_name)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '44444444-4444-4444-8444-444444444444',
  'Progressive OPTION_A Synthetic Creator'
);

select step5_test.insert_settlement(
  'd1000000-0000-4000-8000-000000000001',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '2026-09', 1, 100000000
);

select step5_test.assert_true((
  select revenue_share_model = 'TLV_PROGRESSIVE_V1'
    and eligible_net_basis_jpy = 100000000
    and jsonb_array_length(revenue_share_brackets) = 4
    and applied_marginal_bracket = 'JPY_ABOVE_30M'
    and creator_marginal_share_rate_pct = 99
    and creator_effective_share_rate_pct = 96.800000
    and creator_payable_current_period_jpy = 96800000
    and tasful_retained_revenue_jpy = 3200000
    and creator_payable_current_period_jpy + tasful_retained_revenue_jpy = eligible_net_basis_jpy
  from tlv.monthly_settlements
  where id = 'd1000000-0000-4000-8000-000000000001'
), 'progressive snapshot 100m mismatch');

select tlv.transition_monthly_settlement(
  'd1000000-0000-4000-8000-000000000001', 1, 'REVIEWABLE',
  'progressive-option-a-review', 'gate02-local', '2026-10-02 00:00:00+00',
  '{"progressive_snapshot_reviewed":true}', '{}'
);
select tlv.transition_monthly_settlement(
  'd1000000-0000-4000-8000-000000000001', 1, 'FINALIZED',
  'progressive-option-a-final', 'gate02-local', '2026-10-02 00:01:00+00',
  '{"progressive_snapshot_finalized":true}',
  '{"finalized_snapshot_hash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}'
);

set role service_role;
select tlv.create_canonical_settlement_payout(
  'd1000000-0000-4000-8000-000000000001',
  'gate02-progressive-option-a-100m',
  '2026-10-02 00:02:00+00'
);
reset role;

select step5_test.assert_true((
  select creator_payout_jpy = 96800000
    and total_payout_jpy = 96800000
    and base_rate is null and effective_rate is null and override_tier is null
    and settlement_id = 'd1000000-0000-4000-8000-000000000001'
  from tlv.payout_log
  where settlement_id = 'd1000000-0000-4000-8000-000000000001'
), 'OPTION_A did not copy persisted progressive payout amount');

select step5_test.expect_error(
  $q$update tlv.monthly_settlements set revenue_share_brackets='[]'::jsonb where id='d1000000-0000-4000-8000-000000000001'$q$,
  'same_status_snapshot_update_forbidden'
);
select step5_test.expect_error(
  $q$update tlv.payout_log set creator_payout_jpy=99000000 where settlement_id='d1000000-0000-4000-8000-000000000001'$q$,
  'canonical_payout_financial_identity_immutable'
);

select 'TLV_PROGRESSIVE_OPTION_A_PAYOUT_VALIDATION: PASS' as result;
rollback;
