-- TLV chargeback/refund staging integration (T-CB-01..11)
-- Run: npx supabase db query --linked -f scripts/sql/tlv-staging-chargeback-integration.sql

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _cb_test_results (
  test_id text PRIMARY KEY,
  passed boolean NOT NULL,
  detail text
) ON COMMIT DROP;

TRUNCATE _cb_test_results;

-- Fixture IDs
-- payer:  c0000000-0000-4000-8000-000000000101
-- wallet: c0000000-0000-4000-8000-000000000102
-- creator: c0000000-0000-4000-8000-000000000001

INSERT INTO tlv.creators (id, user_id, display_name, channel_slug)
VALUES ('c0000000-0000-4000-8000-000000000001', 'tlv-staging-cb-creator', 'CB Creator', 'tlv-staging-cb')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- Cleanup prior CB staging rows
DELETE FROM tlv.payment_reversals WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.wallet_ledger WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.revenue_ledger WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.creator_score_events WHERE source_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.tip_coin_lot_allocations WHERE tip_id IN (
  SELECT id FROM tlv.tips WHERE idempotency_key LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.tips WHERE idempotency_key LIKE 'tlv-staging-cb-%';
DELETE FROM tlv.coin_lots WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.payment_provider_events WHERE provider_event_id LIKE 'tlv-staging-cb-%';
DELETE FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%';
DELETE FROM tlv.wallet_ledger WHERE wallet_id = 'c0000000-0000-4000-8000-000000000102';
DELETE FROM tlv.viewer_wallets WHERE id = 'c0000000-0000-4000-8000-000000000102';

CREATE OR REPLACE FUNCTION _cb_seed_payment(
  p_suffix text,
  p_coins integer DEFAULT 500,
  p_gross bigint DEFAULT 550,
  p_fee bigint DEFAULT 20,
  p_net bigint DEFAULT 530
)
RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_pay_id uuid;
  v_lot_id uuid;
  v_event_id uuid;
BEGIN
  v_pay_id := ('d0000000-0000-4000-8000-' || lpad(p_suffix, 12, '0'))::uuid;

  INSERT INTO tlv.viewer_wallets (
    id, user_id, coin_balance, locked_coin_balance,
    lifetime_purchased_coins, lifetime_spent_coins, status
  ) VALUES (
    'c0000000-0000-4000-8000-000000000102',
    'c0000000-0000-4000-8000-000000000101',
    p_coins, 0, p_coins, 0, 'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    coin_balance = p_coins,
    locked_coin_balance = 0,
    lifetime_purchased_coins = p_coins,
    lifetime_spent_coins = 0,
    status = 'active';

  INSERT INTO tlv.payments (
    id, payer_user_id, payer_user_uuid, payment_kind, channel, status,
    gross_amount_jpy, fee_amount_jpy, net_amount_jpy, fee_rate_applied,
    coins_granted, is_web_payment, external_ref, stripe_payment_intent,
    stripe_charge_id, paid_at
  ) VALUES (
    v_pay_id, 'tlv-staging-cb-payer', 'c0000000-0000-4000-8000-000000000101',
    'coin_purchase', 'web_stripe', 'succeeded',
    p_gross, p_fee, p_net, 0.036,
    p_coins, true, 'tlv-staging-cb-' || p_suffix,
    'pi_tlv_staging_cb_' || p_suffix,
    'ch_tlv_staging_cb_' || p_suffix,
    now()
  );

  INSERT INTO tlv.coin_lots (
    wallet_id, user_id, payment_id, lot_source, is_web_payment,
    gross_amount_jpy, fee_amount_jpy, net_amount_jpy,
    coins_original, coins_remaining, extension_allowed, expires_at
  ) VALUES (
    'c0000000-0000-4000-8000-000000000102',
    'c0000000-0000-4000-8000-000000000101',
    v_pay_id, 'web_stripe', true,
    p_gross, p_fee, p_net,
    p_coins, p_coins, true, now() + interval '180 days'
  ) RETURNING id INTO v_lot_id;

  INSERT INTO tlv.wallet_ledger (
    wallet_id, user_id, entry_type, coins_delta, balance_after,
    payment_id, reason_code, metadata
  ) VALUES (
    'c0000000-0000-4000-8000-000000000102',
    'c0000000-0000-4000-8000-000000000101',
    'purchase_credit', p_coins, p_coins,
    v_pay_id, 'COIN_PURCHASE',
    jsonb_build_object('coin_lot_id', v_lot_id)
  );

  RETURN v_pay_id;
END;
$$;

-- T-CB-01 Full refund unused coin
DO $$
DECLARE
  v_pay uuid;
  v_result jsonb;
BEGIN
  v_pay := _cb_seed_payment('000000000001');
  v_result := tlv.handle_payment_refund(
    'stripe', 'tlv-staging-cb-refund-01', 'charge.refunded',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'pi_tlv_staging_cb_000000000001', 'ch_tlv_staging_cb_000000000001',
    550, '{}'::jsonb
  );
  INSERT INTO _cb_test_results VALUES (
    'T-CB-01',
    (v_result->>'ok')::boolean = true
      AND (SELECT coins_remaining FROM tlv.coin_lots WHERE payment_id = v_pay) = 0
      AND (SELECT coin_balance FROM tlv.viewer_wallets WHERE id = 'c0000000-0000-4000-8000-000000000102') = 0
      AND (SELECT refund_amount_jpy FROM tlv.payments WHERE id = v_pay) = 530
      AND (SELECT net_amount_jpy FROM tlv.payments WHERE id = v_pay) = 0,
    v_result::text
  );
END;
$$;

-- Reset wallet for next tests
DELETE FROM tlv.payment_reversals WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.wallet_ledger WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.coin_lots WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.payment_provider_events WHERE provider_event_id LIKE 'tlv-staging-cb-%';
DELETE FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%';

-- T-CB-02 Partial refund 50%
DO $$
DECLARE
  v_pay uuid;
  v_result jsonb;
BEGIN
  v_pay := _cb_seed_payment('000000000002');
  v_result := tlv.handle_payment_refund(
    'stripe', 'tlv-staging-cb-refund-02a', 'charge.refunded',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'pi_tlv_staging_cb_000000000002', 'ch_tlv_staging_cb_000000000002',
    275, '{}'::jsonb
  );
  INSERT INTO _cb_test_results VALUES (
    'T-CB-02',
    (v_result->>'ok')::boolean = true
      AND (SELECT coins_remaining FROM tlv.coin_lots WHERE payment_id = v_pay) = 250
      AND (SELECT coin_balance FROM tlv.viewer_wallets WHERE id = 'c0000000-0000-4000-8000-000000000102') = 250
      AND (SELECT refund_amount_jpy FROM tlv.payments WHERE id = v_pay) BETWEEN 264 AND 265,
    v_result::text
  );
END;
$$;

-- T-CB-09 Idempotency duplicate refund event
DO $$
DECLARE
  v_pay uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_pay FROM tlv.payments WHERE external_ref = 'tlv-staging-cb-000000000002';
  v_result := tlv.handle_payment_refund(
    'stripe', 'tlv-staging-cb-refund-02a', 'charge.refunded',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'pi_tlv_staging_cb_000000000002', 'ch_tlv_staging_cb_000000000002',
    275, '{}'::jsonb
  );
  INSERT INTO _cb_test_results VALUES (
    'T-CB-09',
    (v_result->>'duplicate')::boolean = true
      AND (SELECT count(*) FROM tlv.payment_reversals WHERE payment_id = v_pay) = 1,
    v_result::text
  );
END;
$$;

-- Cleanup for dispute tests
DELETE FROM tlv.payment_reversals WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.wallet_ledger WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.coin_lots WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.payment_provider_events WHERE provider_event_id LIKE 'tlv-staging-cb-%';
DELETE FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%';

-- T-CB-03 Dispute open → lock
DO $$
DECLARE
  v_pay uuid;
  v_result jsonb;
  v_locked integer;
BEGIN
  v_pay := _cb_seed_payment('000000000003');
  v_result := tlv.handle_payment_dispute(
    'stripe', 'tlv-staging-cb-dispute-open-03', 'charge.dispute.created',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    'pi_tlv_staging_cb_000000000003', 'ch_tlv_staging_cb_000000000003',
    'dp_tlv_staging_cb_03', 'open', 550, '{}'::jsonb
  );
  SELECT locked_coin_balance INTO v_locked
  FROM tlv.viewer_wallets WHERE id = 'c0000000-0000-4000-8000-000000000102';
  INSERT INTO _cb_test_results VALUES (
    'T-CB-03',
    (v_result->>'ok')::boolean = true
      AND (SELECT status FROM tlv.payments WHERE id = v_pay) = 'disputed'
      AND v_locked = 500,
    v_result::text || ' locked=' || v_locked
  );
END;
$$;

-- T-CB-03b Dispute won → unlock
DO $$
DECLARE
  v_pay uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_pay FROM tlv.payments WHERE external_ref = 'tlv-staging-cb-000000000003';
  v_result := tlv.handle_payment_dispute(
    'stripe', 'tlv-staging-cb-dispute-won-03', 'charge.dispute.closed',
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    'pi_tlv_staging_cb_000000000003', 'ch_tlv_staging_cb_000000000003',
    'dp_tlv_staging_cb_03', 'won', 0, '{}'::jsonb
  );
  INSERT INTO _cb_test_results VALUES (
    'T-CB-03b',
    (v_result->>'ok')::boolean = true
      AND (SELECT locked_coin_balance FROM tlv.viewer_wallets WHERE id = 'c0000000-0000-4000-8000-000000000102') = 0
      AND (SELECT status FROM tlv.payments WHERE id = v_pay) = 'succeeded',
    v_result::text
  );
END;
$$;

-- Cleanup for dispute lost
DELETE FROM tlv.payment_reversals WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.wallet_ledger WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.coin_lots WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.payment_provider_events WHERE provider_event_id LIKE 'tlv-staging-cb-%';
DELETE FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%';

-- T-CB-03c Dispute lost → clawback
DO $$
DECLARE
  v_pay uuid;
  v_result jsonb;
BEGIN
  v_pay := _cb_seed_payment('000000000004');
  v_result := tlv.handle_payment_dispute(
    'stripe', 'tlv-staging-cb-dispute-lost-04', 'charge.dispute.closed',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'pi_tlv_staging_cb_000000000004', 'ch_tlv_staging_cb_000000000004',
    'dp_tlv_staging_cb_04', 'lost', 550, '{}'::jsonb
  );
  INSERT INTO _cb_test_results VALUES (
    'T-CB-03c',
    (v_result->>'ok')::boolean = true
      AND (SELECT coin_balance FROM tlv.viewer_wallets WHERE id = 'c0000000-0000-4000-8000-000000000102') = 0
      AND (SELECT chargeback_amount_jpy FROM tlv.payments WHERE id = v_pay) = 530
      AND EXISTS (
        SELECT 1 FROM tlv.wallet_ledger
        WHERE payment_id = v_pay AND entry_type = 'chargeback_debit'
      ),
    v_result::text
  );
END;
$$;

-- T-CB-10 Webhook duplicate dispute lost
DO $$
DECLARE
  v_pay uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_pay FROM tlv.payments WHERE external_ref = 'tlv-staging-cb-000000000004';
  v_result := tlv.handle_payment_dispute(
    'stripe', 'tlv-staging-cb-dispute-lost-04', 'charge.dispute.closed',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'pi_tlv_staging_cb_000000000004', 'ch_tlv_staging_cb_000000000004',
    'dp_tlv_staging_cb_04', 'lost', 550, '{}'::jsonb
  );
  INSERT INTO _cb_test_results VALUES (
    'T-CB-10',
    (v_result->>'duplicate')::boolean = true,
    v_result::text
  );
END;
$$;

-- Cleanup for used coin test
DELETE FROM tlv.payment_reversals WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.revenue_ledger WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.wallet_ledger WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.coin_lots WHERE payment_id IN (
  SELECT id FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%'
);
DELETE FROM tlv.payment_provider_events WHERE provider_event_id LIKE 'tlv-staging-cb-%';
DELETE FROM tlv.payments WHERE external_ref LIKE 'tlv-staging-cb-%';

-- T-CB-07 Used coin — tip then partial refund (seed lot with 300 remaining)
DO $$
DECLARE
  v_pay uuid;
  v_result jsonb;
  v_adj_count integer;
BEGIN
  v_pay := _cb_seed_payment('000000000005');
  UPDATE tlv.coin_lots SET coins_remaining = 300 WHERE payment_id = v_pay;
  UPDATE tlv.viewer_wallets SET coin_balance = 300, lifetime_spent_coins = 200
  WHERE id = 'c0000000-0000-4000-8000-000000000102';

  -- Simulate spent 200 coins via allocation + revenue (minimal)
  INSERT INTO tlv.streams (id, creator_id, title, status, phase, started_at)
  VALUES ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'tlv-staging-cb stream', 'ended', 'ended', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO tlv.tips (
    id, stream_id, creator_id, payer_user_id, payer_user_uuid,
    tip_kind, coins_amount, gross_amount_jpy, net_amount_jpy, idempotency_key
  ) VALUES (
    'f0000000-0000-4000-8000-000000000005',
    'e0000000-0000-4000-8000-000000000005',
    'c0000000-0000-4000-8000-000000000001',
    'tlv-staging-cb-payer', 'c0000000-0000-4000-8000-000000000101',
    'gift', 200, 212, 212, 'tlv-staging-cb-tip-05'
  );

  INSERT INTO tlv.tip_coin_lot_allocations (
    tip_id, coin_lot_id, coins_allocated, gross_allocated_jpy, net_allocated_jpy, is_web_origin, lot_source
  )
  SELECT
    'f0000000-0000-4000-8000-000000000005', cl.id, 200, 212, 212, true, 'web_stripe'
  FROM tlv.coin_lots cl WHERE cl.payment_id = v_pay;

  INSERT INTO tlv.revenue_ledger (
    stream_id, creator_id, tip_id, payment_id, event_kind, ledger_month,
    gross_amount_jpy, fee_amount_jpy, net_amount_jpy,
    infra_cost_jpy, creator_payout_jpy, platform_revenue_jpy
  ) VALUES (
    'e0000000-0000-4000-8000-000000000005',
    'c0000000-0000-4000-8000-000000000001',
    'f0000000-0000-4000-8000-000000000005', v_pay,
    'gift', to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM'),
    212, 0, 212, 0, 0, 212
  );

  INSERT INTO tlv.wallet_ledger (
    wallet_id, user_id, entry_type, coins_delta, balance_after,
    tip_id, reason_code
  ) VALUES (
    'c0000000-0000-4000-8000-000000000102',
    'c0000000-0000-4000-8000-000000000101',
    'tip_debit', -200, 300,
    'f0000000-0000-4000-8000-000000000005', 'TIP_SPEND'
  );

  v_result := tlv.handle_payment_refund(
    'stripe', 'tlv-staging-cb-refund-05', 'charge.refunded',
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    'pi_tlv_staging_cb_000000000005', 'ch_tlv_staging_cb_000000000005',
    550, '{}'::jsonb
  );

  SELECT count(*) INTO v_adj_count
  FROM tlv.revenue_ledger
  WHERE payment_id = v_pay AND event_kind = 'adjustment';

  INSERT INTO _cb_test_results VALUES (
    'T-CB-07',
    (v_result->>'ok')::boolean = true
      AND v_adj_count >= 1
      AND (SELECT coin_balance FROM tlv.viewer_wallets WHERE id = 'c0000000-0000-4000-8000-000000000102') = 0,
    v_result::text || ' adj=' || v_adj_count
  );
END;
$$;

-- T-CB-08 Ledger consistency (physical insert order via ctid)
INSERT INTO _cb_test_results
SELECT
  'T-CB-08',
  w.coin_balance = (
    SELECT wl.balance_after FROM tlv.wallet_ledger wl
    WHERE wl.wallet_id = w.id ORDER BY wl.ctid DESC LIMIT 1
  ),
  'balance=' || w.coin_balance
FROM tlv.viewer_wallets w
WHERE w.id = 'c0000000-0000-4000-8000-000000000102';

-- T-CB-06 Unused coin — same as T-CB-01 assertion
INSERT INTO _cb_test_results
SELECT 'T-CB-06', passed, 'alias T-CB-01 unused coin'
FROM _cb_test_results WHERE test_id = 'T-CB-01';

SELECT test_id, passed, detail FROM _cb_test_results ORDER BY test_id;

COMMIT;
