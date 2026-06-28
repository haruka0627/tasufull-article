-- TLV create_tip_transaction staging integration tests (T-TIP-01..10)
-- Run: npx supabase db query --linked -f scripts/sql/tlv-staging-create-tip-integration.sql

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _tip_test_results (
  test_id text PRIMARY KEY,
  passed boolean NOT NULL,
  detail text
) ON COMMIT DROP;

TRUNCATE _tip_test_results;

-- Fixed fixture IDs
-- creator: a0000000-0000-4000-8000-000000000001
-- wallet:  a0000000-0000-4000-8000-000000000102 / user a0000000-0000-4000-8000-000000000101
-- lot:     a0000000-0000-4000-8000-000000000103

INSERT INTO tlv.creators (id, user_id, display_name, channel_slug)
VALUES ('a0000000-0000-4000-8000-000000000001', 'tlv-staging-tip-creator', 'Staging Tip Creator', 'tlv-staging-tip-ch')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- Cleanup prior staging rows
DELETE FROM tlv.tip_coin_lot_allocations WHERE tip_id IN (
  SELECT id FROM tlv.tips WHERE idempotency_key LIKE 'tlv-staging-tip-%'
);
DELETE FROM tlv.revenue_ledger WHERE tip_id IN (
  SELECT id FROM tlv.tips WHERE idempotency_key LIKE 'tlv-staging-tip-%'
);
DELETE FROM tlv.creator_score_events WHERE source_id IN (
  SELECT id FROM tlv.tips WHERE idempotency_key LIKE 'tlv-staging-tip-%'
);
DELETE FROM tlv.stream_events WHERE stream_id IN (
  SELECT id FROM tlv.streams WHERE title LIKE 'tlv-staging-tip %'
);
DELETE FROM tlv.wallet_ledger WHERE tip_id IN (
  SELECT id FROM tlv.tips WHERE idempotency_key LIKE 'tlv-staging-tip-%'
);
DELETE FROM tlv.tips WHERE idempotency_key LIKE 'tlv-staging-tip-%';
DELETE FROM tlv.gauge_state WHERE stream_id IN (
  SELECT id FROM tlv.streams WHERE title LIKE 'tlv-staging-tip %'
);
DELETE FROM tlv.streams WHERE title LIKE 'tlv-staging-tip %';

CREATE OR REPLACE FUNCTION _tip_test_seed_stream(p_suffix text, p_gauge jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_sid uuid;
  v_hex text;
  v_ccu integer := coalesce((p_gauge->>'effective_ccu')::integer, 0);
  v_paid integer := coalesce((p_gauge->>'paid_extension_coins')::integer, 0);
BEGIN
  v_hex := lpad(p_suffix, 12, '0');
  v_sid := ('b0000000-0000-4000-8000-' || v_hex)::uuid;
  INSERT INTO tlv.streams (id, creator_id, title, status, phase, started_at)
  VALUES (v_sid, 'a0000000-0000-4000-8000-000000000001', 'tlv-staging-tip stream ' || p_suffix, 'live', 'free_30', now());
  INSERT INTO tlv.gauge_state (
    stream_id, gauge_phase, extension_unit_coins, paid_extension_coins,
    extension_stock_coins, completed_extension_blocks, next_block_cost_coins,
    gauge_pct, adjusted_gauge_pct, effective_ccu, unique_viewers, avg_watch_minutes, cheer_count
  ) VALUES (
    v_sid, 'accumulating', 500, v_paid, 0, 0, 500, 0, 0, v_ccu, 0, 0, 0
  );
  RETURN v_sid;
END;
$$;

CREATE OR REPLACE FUNCTION _tip_test_seed_wallet(p_balance integer, p_lot integer)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO tlv.viewer_wallets (
    id, user_id, coin_balance, locked_coin_balance,
    lifetime_purchased_coins, lifetime_spent_coins, status
  ) VALUES (
    'a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000101',
    p_balance, 0, p_lot, 0, 'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    coin_balance = EXCLUDED.coin_balance,
    locked_coin_balance = 0,
    lifetime_purchased_coins = EXCLUDED.lifetime_purchased_coins,
    lifetime_spent_coins = 0,
    status = 'active';
  DELETE FROM tlv.tip_coin_lot_allocations
  WHERE coin_lot_id IN (SELECT id FROM tlv.coin_lots WHERE wallet_id = 'a0000000-0000-4000-8000-000000000102');
  DELETE FROM tlv.coin_lots WHERE wallet_id = 'a0000000-0000-4000-8000-000000000102';
  DELETE FROM tlv.wallet_ledger WHERE wallet_id = 'a0000000-0000-4000-8000-000000000102';
  IF p_lot > 0 THEN
    INSERT INTO tlv.coin_lots (
      id, wallet_id, user_id, lot_source, is_web_payment,
      gross_amount_jpy, fee_amount_jpy, net_amount_jpy,
      coins_original, coins_remaining, extension_allowed
    ) VALUES (
      'a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000102',
      'a0000000-0000-4000-8000-000000000101', 'ops_adjustment', true,
      p_lot * 100, 0, p_lot * 100, p_lot, p_lot, true
    );
  END IF;
END;
$$;

-- T-TIP-01 normal tip
DO $$
DECLARE
  v_sid uuid;
  v_r jsonb;
  v_before integer;
  v_after integer;
  v_lot_before integer;
  v_lot_after integer;
  v_spent integer;
BEGIN
  v_sid := _tip_test_seed_stream('000000000001');
  PERFORM _tip_test_seed_wallet(1000, 1000);
  SELECT coin_balance INTO v_before FROM tlv.viewer_wallets WHERE user_id = 'a0000000-0000-4000-8000-000000000101';
  SELECT coalesce(sum(coins_remaining), 0) INTO v_lot_before FROM tlv.coin_lots WHERE wallet_id = 'a0000000-0000-4000-8000-000000000102';
  v_r := tlv.create_tip_transaction(
    v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid,
    'a0000000-0000-4000-8000-000000000101'::uuid, 'tlv-staging-tip-viewer',
    'gift'::tlv.tip_kind, 100, 'tlv-staging-tip-01', '{}'::jsonb
  );
  SELECT coin_balance, lifetime_spent_coins INTO v_after, v_spent FROM tlv.viewer_wallets WHERE user_id = 'a0000000-0000-4000-8000-000000000101';
  SELECT coalesce(sum(coins_remaining), 0) INTO v_lot_after FROM tlv.coin_lots WHERE wallet_id = 'a0000000-0000-4000-8000-000000000102';
  INSERT INTO _tip_test_results VALUES (
    'T-TIP-01',
    (v_r->>'ok')::boolean = true
      AND v_after = v_before - 100 AND v_spent = 100 AND v_lot_after = v_lot_before - 100
      AND EXISTS (SELECT 1 FROM tlv.tips WHERE idempotency_key = 'tlv-staging-tip-01')
      AND EXISTS (SELECT 1 FROM tlv.wallet_ledger wl JOIN tlv.tips t ON t.id = wl.tip_id WHERE t.idempotency_key = 'tlv-staging-tip-01' AND wl.entry_type = 'tip_debit')
      AND EXISTS (SELECT 1 FROM tlv.revenue_ledger rl JOIN tlv.tips t ON t.id = rl.tip_id WHERE t.idempotency_key = 'tlv-staging-tip-01')
      AND EXISTS (SELECT 1 FROM tlv.creator_score_events ce JOIN tlv.tips t ON t.id = ce.source_id WHERE t.idempotency_key = 'tlv-staging-tip-01'),
    format('bal %s->%s spent=%s', v_before, v_after, v_spent)
  );
END;
$$;

-- T-TIP-02 idempotency
DO $$
DECLARE
  v_sid uuid;
  v_r1 jsonb;
  v_r2 jsonb;
  v_b1 integer;
  v_b2 integer;
  v_n integer;
BEGIN
  v_sid := _tip_test_seed_stream('000000000002');
  PERFORM _tip_test_seed_wallet(1000, 1000);
  v_r1 := tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid, 'tlv-staging-tip-viewer', 'gift'::tlv.tip_kind, 50, 'tlv-staging-tip-02', '{}'::jsonb);
  SELECT coin_balance INTO v_b1 FROM tlv.viewer_wallets WHERE user_id = 'a0000000-0000-4000-8000-000000000101';
  v_r2 := tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid, 'tlv-staging-tip-viewer', 'gift'::tlv.tip_kind, 50, 'tlv-staging-tip-02', '{}'::jsonb);
  SELECT coin_balance INTO v_b2 FROM tlv.viewer_wallets WHERE user_id = 'a0000000-0000-4000-8000-000000000101';
  SELECT count(*) INTO v_n FROM tlv.tips WHERE idempotency_key = 'tlv-staging-tip-02';
  INSERT INTO _tip_test_results VALUES (
    'T-TIP-02',
    (v_r1->>'ok')::boolean AND (v_r2->>'duplicate')::boolean AND v_r1->>'tip_id' = v_r2->>'tip_id' AND v_b1 = v_b2 AND v_n = 1,
    format('tips=%s dup=%s', v_n, v_r2->>'duplicate')
  );
END;
$$;

-- T-TIP-03 three tips from 300 balance (no negative balance / lots)
DO $$
DECLARE
  v_sid uuid;
  v_r jsonb;
  v_bal integer;
  v_lot integer;
  i integer;
BEGIN
  v_sid := _tip_test_seed_stream('000000000003');
  PERFORM _tip_test_seed_wallet(300, 300);
  FOR i IN 1..3 LOOP
    v_r := tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid, 'tlv-staging-tip-viewer', 'gift'::tlv.tip_kind, 100, 'tlv-staging-tip-03-' || i, '{}'::jsonb);
    IF coalesce((v_r->>'ok')::boolean, false) = false THEN
      INSERT INTO _tip_test_results VALUES ('T-TIP-03', false, 'tip ' || i || ' failed');
      RETURN;
    END IF;
  END LOOP;
  SELECT coin_balance INTO v_bal FROM tlv.viewer_wallets WHERE user_id = 'a0000000-0000-4000-8000-000000000101';
  SELECT coalesce(sum(coins_remaining), 0) INTO v_lot FROM tlv.coin_lots WHERE wallet_id = 'a0000000-0000-4000-8000-000000000102';
  INSERT INTO _tip_test_results VALUES ('T-TIP-03', v_bal = 0 AND v_lot = 0 AND v_bal >= 0, format('balance=%s lot=%s', v_bal, v_lot));
END;
$$;

DO $$
DECLARE
  v_sid uuid;
  v_before integer;
  v_after integer;
  v_n integer;
BEGIN
  v_sid := _tip_test_seed_stream('000000000004');
  PERFORM _tip_test_seed_wallet(50, 50);
  SELECT coin_balance INTO v_before FROM tlv.viewer_wallets WHERE user_id = 'a0000000-0000-4000-8000-000000000101';
  BEGIN
    PERFORM tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid, 'tlv-staging-tip-viewer', 'gift'::tlv.tip_kind, 100, 'tlv-staging-tip-04', '{}'::jsonb);
    INSERT INTO _tip_test_results VALUES ('T-TIP-04', false, 'expected exception');
  EXCEPTION WHEN OTHERS THEN
    SELECT coin_balance INTO v_after FROM tlv.viewer_wallets WHERE user_id = 'a0000000-0000-4000-8000-000000000101';
    SELECT count(*) INTO v_n FROM tlv.tips WHERE stream_id = v_sid;
    INSERT INTO _tip_test_results VALUES ('T-TIP-04', v_after = v_before AND v_n = 0, SQLERRM);
  END;
END;
$$;

-- T-TIP-05 insufficient lots
DO $$
DECLARE
  v_sid uuid;
  v_before integer;
  v_after integer;
  v_n integer;
BEGIN
  v_sid := _tip_test_seed_stream('000000000005');
  PERFORM _tip_test_seed_wallet(500, 100);
  UPDATE tlv.viewer_wallets SET coin_balance = 500 WHERE id = 'a0000000-0000-4000-8000-000000000102';
  SELECT coin_balance INTO v_before FROM tlv.viewer_wallets WHERE user_id = 'a0000000-0000-4000-8000-000000000101';
  BEGIN
    PERFORM tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid, 'tlv-staging-tip-viewer', 'gift'::tlv.tip_kind, 200, 'tlv-staging-tip-05', '{}'::jsonb);
    INSERT INTO _tip_test_results VALUES ('T-TIP-05', false, 'expected exception');
  EXCEPTION WHEN OTHERS THEN
    SELECT coin_balance INTO v_after FROM tlv.viewer_wallets WHERE user_id = 'a0000000-0000-4000-8000-000000000101';
    SELECT count(*) INTO v_n FROM tlv.tips WHERE stream_id = v_sid;
    INSERT INTO _tip_test_results VALUES ('T-TIP-05', SQLERRM LIKE '%insufficient_lots%' AND v_after = v_before AND v_n = 0, SQLERRM);
  END;
END;
$$;

-- T-TIP-06 review_required
DO $$
DECLARE
  v_sid uuid;
  v_r jsonb;
  v_rev integer;
  v_wl integer;
BEGIN
  v_sid := _tip_test_seed_stream('000000000006');
  PERFORM _tip_test_seed_wallet(500, 500);
  v_r := tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid, 'tlv-staging-tip-viewer', 'gift'::tlv.tip_kind, 80, 'tlv-staging-tip-06', '{}'::jsonb, null, null, null, null, true, false, false);
  SELECT count(*) INTO v_rev FROM tlv.revenue_ledger rl JOIN tlv.tips t ON t.id = rl.tip_id WHERE t.idempotency_key = 'tlv-staging-tip-06';
  SELECT count(*) INTO v_wl FROM tlv.wallet_ledger wl JOIN tlv.tips t ON t.id = wl.tip_id WHERE t.idempotency_key = 'tlv-staging-tip-06';
  INSERT INTO _tip_test_results VALUES ('T-TIP-06', (v_r->>'ok')::boolean AND (v_r->>'review_required')::boolean AND v_rev = 0 AND v_wl >= 1, v_r::text);
END;
$$;

-- T-TIP-07 fraud excluded
DO $$
DECLARE
  v_sid uuid;
  v_r jsonb;
  v_paid_before integer;
  v_paid_after integer;
  v_unlock integer;
BEGIN
  v_sid := _tip_test_seed_stream('000000000007');
  PERFORM _tip_test_seed_wallet(500, 500);
  SELECT paid_extension_coins INTO v_paid_before FROM tlv.gauge_state WHERE stream_id = v_sid;
  v_r := tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid, 'tlv-staging-tip-viewer', 'extension'::tlv.tip_kind, 100, 'tlv-staging-tip-07', '{}'::jsonb, null, null, null, null, false, true, true);
  SELECT paid_extension_coins INTO v_paid_after FROM tlv.gauge_state WHERE stream_id = v_sid;
  SELECT count(*) INTO v_unlock FROM tlv.stream_events WHERE stream_id = v_sid AND event_kind = 'extension_unlock';
  INSERT INTO _tip_test_results VALUES ('T-TIP-07', (v_r->>'ok')::boolean AND v_paid_after = v_paid_before AND v_unlock = 0, format('gauge=%s', v_paid_after));
END;
$$;

-- T-TIP-08 grant guard
DO $$
DECLARE
  v_sid uuid;
  v_r1 jsonb;
  v_r2 jsonb;
  v_unlock1 integer;
  v_unlock2 integer;
BEGIN
  v_sid := _tip_test_seed_stream('000000000008');
  PERFORM _tip_test_seed_wallet(1500, 1500);
  UPDATE tlv.gauge_state SET gauge_difficulty = 1.2 WHERE stream_id = v_sid;
  v_r1 := tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid, 'tlv-staging-tip-viewer', 'extension'::tlv.tip_kind, 500, 'tlv-staging-tip-08a', '{}'::jsonb);
  SELECT count(*) INTO v_unlock1 FROM tlv.stream_events WHERE stream_id = v_sid AND event_kind = 'extension_unlock';
  UPDATE tlv.gauge_state SET effective_ccu = 5 WHERE stream_id = v_sid;
  v_r2 := tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid, 'tlv-staging-tip-viewer', 'extension'::tlv.tip_kind, 500, 'tlv-staging-tip-08b', '{}'::jsonb);
  SELECT count(*) INTO v_unlock2 FROM tlv.stream_events WHERE stream_id = v_sid AND event_kind = 'extension_unlock';
  INSERT INTO _tip_test_results VALUES ('T-TIP-08', (v_r1->>'ok')::boolean AND coalesce((v_r1->>'extension_unlocked')::boolean, false) = false AND v_unlock1 = 0 AND (v_r2->>'extension_unlocked')::boolean AND v_unlock2 >= 1, format('u1=%s u2=%s', v_unlock1, v_unlock2));
END;
$$;

-- T-TIP-09 payer_user_uuid
DO $$
DECLARE
  v_sid uuid;
  v_r jsonb;
  v_err text;
BEGIN
  v_sid := _tip_test_seed_stream('000000000009');
  PERFORM _tip_test_seed_wallet(200, 200);
  BEGIN
    PERFORM tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000199'::uuid, 'tlv-staging-tip-viewer', 'gift'::tlv.tip_kind, 50, 'tlv-staging-tip-09-wrong', '{}'::jsonb);
    v_err := 'no_exception';
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  v_r := tlv.create_tip_transaction(v_sid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid, 'legacy-text-only-id', 'gift'::tlv.tip_kind, 50, 'tlv-staging-tip-09-ok', '{}'::jsonb);
  INSERT INTO _tip_test_results VALUES (
    'T-TIP-09',
    v_err LIKE '%wallet_not_found%' AND (v_r->>'ok')::boolean
      AND EXISTS (SELECT 1 FROM tlv.tips WHERE idempotency_key = 'tlv-staging-tip-09-ok' AND payer_user_uuid = 'a0000000-0000-4000-8000-000000000101'::uuid AND payer_user_id = 'legacy-text-only-id'),
    v_err
  );
END;
$$;

-- T-TIP-10 W1-GAP-01 webhook uuid
DO $$
DECLARE
  v_r jsonb;
  v_uuid uuid;
  v_err text;
  v_hash text := repeat('a', 64);
BEGIN
  v_r := tlv.handle_payment_webhook_success('stripe', 'tlv-staging-tip-10a', 'payment_intent.succeeded', v_hash, 'tlv-staging-payer', 'a0000000-0000-4000-8000-000000000201'::uuid, null, 'web_stripe', 550, 19, 531, 0.036, 100, true, 'pi_10a', 'pi_10a', '{"payer_user_uuid":"a0000000-0000-4000-8000-000000000201"}'::jsonb, 'a0000000-0000-4000-8000-000000000201'::uuid);
  SELECT p.payer_user_uuid INTO v_uuid FROM tlv.payments p JOIN tlv.payment_provider_events e ON e.payment_id = p.id WHERE e.provider_event_id = 'tlv-staging-tip-10a';
  INSERT INTO _tip_test_results VALUES ('T-TIP-10a', (v_r->>'ok')::boolean AND v_uuid = 'a0000000-0000-4000-8000-000000000201'::uuid, v_uuid::text);

  v_hash := repeat('b', 64);
  v_r := tlv.handle_payment_webhook_success('stripe', 'tlv-staging-tip-10b', 'payment_intent.succeeded', v_hash, 'tlv-staging-fallback', 'a0000000-0000-4000-8000-000000000202'::uuid, null, 'web_stripe', 550, 19, 531, 0.036, 100, true, 'pi_10b', 'pi_10b', '{"wallet_user_id":"a0000000-0000-4000-8000-000000000202"}'::jsonb, 'a0000000-0000-4000-8000-000000000202'::uuid);
  SELECT p.payer_user_uuid INTO v_uuid FROM tlv.payments p JOIN tlv.payment_provider_events e ON e.payment_id = p.id WHERE e.provider_event_id = 'tlv-staging-tip-10b';
  INSERT INTO _tip_test_results VALUES ('T-TIP-10b', (v_r->>'ok')::boolean AND v_uuid = 'a0000000-0000-4000-8000-000000000202'::uuid, v_uuid::text);

  BEGIN
    PERFORM tlv.handle_payment_webhook_success('stripe', 'tlv-staging-tip-10c', 'payment_intent.succeeded', repeat('c', 64), 'missing', null, null, 'web_stripe', 550, 19, 531, 0.036, 100, true, 'pi_10c', 'pi_10c', '{}'::jsonb, null);
    INSERT INTO _tip_test_results VALUES ('T-TIP-10c', false, 'expected error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _tip_test_results VALUES ('T-TIP-10c', true, SQLERRM);
  END;
END;
$$;

-- DB integrity checks
INSERT INTO _tip_test_results
SELECT 'DB-wallet_ledger',
  w.coin_balance = wl.balance_after,
  format('wallet=%s ledger=%s', w.coin_balance, wl.balance_after)
FROM tlv.viewer_wallets w
LEFT JOIN LATERAL (
  SELECT balance_after FROM tlv.wallet_ledger WHERE wallet_id = w.id ORDER BY created_at DESC LIMIT 1
) wl ON true
WHERE w.user_id = 'a0000000-0000-4000-8000-000000000101';

INSERT INTO _tip_test_results
SELECT 'DB-lot_sum',
  w.coin_balance = coalesce(l.lot_sum, 0),
  format('wallet=%s lots=%s', w.coin_balance, coalesce(l.lot_sum, 0))
FROM tlv.viewer_wallets w
LEFT JOIN LATERAL (SELECT sum(coins_remaining) AS lot_sum FROM tlv.coin_lots WHERE wallet_id = w.id) l ON true
WHERE w.user_id = 'a0000000-0000-4000-8000-000000000101';

INSERT INTO _tip_test_results VALUES (
  'DB-tip_alloc',
  NOT EXISTS (
    SELECT 1 FROM tlv.tips t
    JOIN tlv.tip_coin_lot_allocations a ON a.tip_id = t.id
    WHERE t.idempotency_key LIKE 'tlv-staging-tip-%'
    GROUP BY t.id, t.coins_amount
    HAVING sum(a.coins_allocated) <> t.coins_amount
  ),
  'alloc sum = tip coins'
);

INSERT INTO _tip_test_results VALUES (
  'DB-review_revenue',
  NOT EXISTS (
    SELECT 1 FROM tlv.tips t JOIN tlv.revenue_ledger rl ON rl.tip_id = t.id
    WHERE t.idempotency_key LIKE 'tlv-staging-tip-%' AND t.self_gift_flag = true AND t.fraud_excluded = false
  ),
  'no revenue for review tips'
);

INSERT INTO _tip_test_results VALUES (
  'DB-idempotency',
  (SELECT count(*) FROM tlv.tips WHERE idempotency_key LIKE 'tlv-staging-tip-%')
    = (SELECT count(DISTINCT idempotency_key) FROM tlv.tips WHERE idempotency_key LIKE 'tlv-staging-tip-%'),
  'unique idempotency keys'
);

INSERT INTO _tip_test_results VALUES (
  'DB-fraud_gauge',
  NOT EXISTS (
    SELECT 1 FROM tlv.tips t
    JOIN tlv.gauge_state g ON g.stream_id = t.stream_id
    WHERE t.idempotency_key = 'tlv-staging-tip-07' AND g.paid_extension_coins > 0
  ),
  'fraud/bot tip stream gauge unchanged'
);

INSERT INTO _tip_test_results VALUES (
  'DB-stream_events_no_jpy',
  NOT EXISTS (
    SELECT 1 FROM tlv.stream_events se
    WHERE se.stream_id IN (SELECT id FROM tlv.streams WHERE title LIKE 'tlv-staging-tip %')
      AND se.payload_json::text ~* '"amount"|"revenue"|"jpy"|amount_jpy'
  ),
  'no JPY fields in stream_events payloads'
);

INSERT INTO _tip_test_results VALUES (
  'DB-score_insert_only',
  (SELECT count(*) FROM tlv.creator_score_events ce
   JOIN tlv.tips t ON t.id = ce.source_id
   WHERE t.idempotency_key LIKE 'tlv-staging-tip-%') >= 1,
  'creator_score_events inserted for revenue tips'
);

INSERT INTO _tip_test_results VALUES (
  'DB-no_text_wallet_join',
  NOT EXISTS (
    SELECT 1 FROM tlv.viewer_wallets w
    JOIN tlv.tips t ON t.payer_user_id = w.user_id::text
    WHERE t.idempotency_key LIKE 'tlv-staging-tip-%'
  ),
  'no payer_user_id text wallet JOIN'
);

SELECT test_id, passed, detail FROM _tip_test_results ORDER BY test_id;

COMMIT;
