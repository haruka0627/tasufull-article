\set ON_ERROR_STOP on

-- Negative-control database only: OPTION_A must refuse to cut over when any
-- pre-existing payout row appears after the read-only preflight.
insert into tlv.creator_score_monthly (
  creator_id, month_id, fs, es, gs, ts, total, score_ma30,
  rank_tier, base_rate, override_tier, effective_rate, locked_at
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-08',
  100, 100, 100, 100, 400, 400,
  'silver', 0.50, 'none', 0.50,
  '2026-08-28 00:00:00+00'
);

insert into tlv.payout_log (
  creator_id, month_id, net_attributed_clean_jpy, infra_allocated_jpy,
  base_rate, override_tier, effective_rate,
  creator_payout_jpy, pool_bonus_jpy, total_payout_jpy, status,
  created_at, updated_at
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-08', 1000, 100,
  0.50, 'none', 0.50,
  500, 0, 500, 'pending',
  '2026-08-28 00:00:00+00', '2026-08-28 00:00:00+00'
);

select 'STEP5D_NONZERO_GUARD_FIXTURE_READY' as result;
