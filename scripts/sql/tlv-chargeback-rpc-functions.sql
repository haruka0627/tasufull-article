-- ---------------------------------------------------------------------------
-- Internal: reverse tip revenue for coins clawed from spent lot portion
-- ---------------------------------------------------------------------------
create or replace function tlv.reverse_tip_revenue_for_lot(
  p_lot_id uuid,
  p_payment_id uuid,
  p_coins_to_reverse integer,
  p_notes text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = tlv, public
as $$
declare
  v_remaining integer := p_coins_to_reverse;
  v_alloc record;
  v_take integer;
  v_net_rev bigint;
  v_ledger_month char(7);
  v_rev_id uuid;
  v_creator_ids uuid[] := array[]::uuid[];
begin
  if p_coins_to_reverse <= 0 then
    return jsonb_build_object('ok', true, 'reversed_coins', 0, 'creator_ids', v_creator_ids);
  end if;

  for v_alloc in
    select
      a.tip_id,
      a.coins_allocated,
      a.net_allocated_jpy,
      t.creator_id,
      t.stream_id,
      t.fraud_excluded,
      t.tip_kind
    from tlv.tip_coin_lot_allocations a
    join tlv.tips t on t.id = a.tip_id
    where a.coin_lot_id = p_lot_id
      and t.fraud_excluded = false
    order by a.created_at asc
  loop
    exit when v_remaining <= 0;

    v_take := least(v_alloc.coins_allocated, v_remaining);
    v_net_rev := -floor(
      v_alloc.net_allocated_jpy::numeric * v_take::numeric / v_alloc.coins_allocated::numeric
    )::bigint;

    if v_net_rev <> 0 then
      v_ledger_month := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM');

      insert into tlv.revenue_ledger (
        stream_id, creator_id, payment_id, tip_id, event_kind, ledger_month,
        gross_amount_jpy, fee_amount_jpy, net_amount_jpy,
        infra_cost_jpy, creator_payout_jpy, platform_revenue_jpy,
        self_gift_excluded, notes
      ) values (
        v_alloc.stream_id, v_alloc.creator_id, p_payment_id, v_alloc.tip_id,
        'adjustment', v_ledger_month,
        v_net_rev, 0, v_net_rev,
        0, 0, v_net_rev,
        false, p_notes
      ) returning id into v_rev_id;

      if not v_alloc.creator_id = any(v_creator_ids) then
        v_creator_ids := array_append(v_creator_ids, v_alloc.creator_id);
      end if;
    end if;

    v_remaining := v_remaining - v_take;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'reversed_coins', p_coins_to_reverse - v_remaining,
    'creator_ids', v_creator_ids
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: coin clawback core (refund + dispute lost)
-- ---------------------------------------------------------------------------
create or replace function tlv.apply_coin_clawback_for_payment(
  p_payment_id uuid,
  p_provider_event_id uuid,
  p_jpy_gross_delta bigint,
  p_jpy_net_delta bigint,
  p_reversal_kind tlv.payment_reversal_kind,
  p_is_refund boolean,
  p_notes text,
  p_stripe_dispute_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = tlv, public
as $$
declare
  v_payment record;
  v_wallet record;
  v_lot record;
  v_coins_target integer;
  v_from_lot integer;
  v_from_spent integer;
  v_actual_claw integer;
  v_shortfall integer;
  v_balance integer;
  v_new_refund bigint;
  v_new_chargeback bigint;
  v_new_net bigint;
  v_rev_result jsonb;
  v_creator_id uuid;
  v_creator_ids uuid[];
  v_ts_before smallint;
  v_ts_after smallint;
  v_reversal_id uuid;
  v_manual_finops boolean := false;
begin
  if p_jpy_gross_delta < 0 or p_jpy_net_delta < 0 then
    raise exception 'invalid_refund_delta';
  end if;

  select * into v_payment
  from tlv.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment_not_found';
  end if;

  if v_payment.status not in ('succeeded', 'refunded', 'disputed') then
    raise exception 'payment_not_reversible';
  end if;

  if v_payment.payer_user_uuid is null then
    raise exception 'payment_missing_payer_uuid';
  end if;

  insert into tlv.viewer_wallets (user_id)
  values (v_payment.payer_user_uuid)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from tlv.viewer_wallets
  where user_id = v_payment.payer_user_uuid
  for update;

  select * into v_lot
  from tlv.coin_lots
  where payment_id = p_payment_id
  for update;

  if not found then
    raise exception 'coin_lot_not_found';
  end if;

  if v_payment.gross_amount_jpy <= 0 then
    raise exception 'invalid_payment_gross';
  end if;

  v_coins_target := floor(
    v_payment.coins_granted::numeric * p_jpy_gross_delta::numeric / v_payment.gross_amount_jpy::numeric
  )::integer;

  if p_is_refund then
    v_new_refund := v_payment.refund_amount_jpy + p_jpy_net_delta;
    v_new_chargeback := v_payment.chargeback_amount_jpy;
  else
    v_new_refund := v_payment.refund_amount_jpy;
    v_new_chargeback := v_payment.chargeback_amount_jpy + p_jpy_net_delta;
  end if;

  v_new_net := v_payment.gross_amount_jpy - v_payment.fee_amount_jpy
    - v_new_refund - v_new_chargeback;

  v_from_lot := least(coalesce(v_lot.coins_remaining, 0), v_coins_target);
  v_from_spent := greatest(0, v_coins_target - v_from_lot);

  if v_from_lot > 0 then
    update tlv.coin_lots
    set coins_remaining = coins_remaining - v_from_lot
    where id = v_lot.id;
  end if;

  if v_from_spent > 0 then
    v_rev_result := tlv.reverse_tip_revenue_for_lot(
      v_lot.id, p_payment_id, v_from_spent, p_notes, p_metadata
    );
    v_creator_ids := coalesce(
      array(select jsonb_array_elements_text(v_rev_result->'creator_ids')::uuid),
      array[]::uuid[]
    );
  else
    v_creator_ids := array[]::uuid[];
  end if;

  v_actual_claw := least(v_coins_target, v_wallet.coin_balance);
  v_shortfall := v_coins_target - v_actual_claw;
  v_balance := v_wallet.coin_balance - v_actual_claw;

  update tlv.viewer_wallets
  set
    coin_balance = v_balance,
    locked_coin_balance = greatest(0, locked_coin_balance - least(v_wallet.locked_coin_balance, v_actual_claw)),
    status = case when v_shortfall > 0 then 'frozen'::tlv.wallet_status else status end
  where id = v_wallet.id;

  if v_actual_claw > 0 then
    insert into tlv.wallet_ledger (
      wallet_id, user_id, entry_type, coins_delta, balance_after,
      payment_id, provider_event_id, reason_code, metadata
    ) values (
      v_wallet.id, v_wallet.user_id, 'chargeback_debit', -v_actual_claw, v_balance,
      p_payment_id, p_provider_event_id,
      case when p_is_refund then 'REFUND_CLAWBACK' else 'CHARGEBACK_CLAWBACK' end,
      jsonb_build_object(
        'coin_lot_id', v_lot.id,
        'coins_target', v_coins_target,
        'coins_shortfall', v_shortfall
      ) || coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  update tlv.payments
  set
    refund_amount_jpy = v_new_refund,
    chargeback_amount_jpy = v_new_chargeback,
    net_amount_jpy = v_new_net,
    status = case
      when p_is_refund and v_new_refund >= (v_payment.gross_amount_jpy - v_payment.fee_amount_jpy)
        then 'refunded'::tlv.payment_status
      when not p_is_refund then 'disputed'::tlv.payment_status
      else status
    end,
    stripe_charge_id = coalesce(stripe_charge_id, p_metadata->>'stripe_charge_id')
  where id = p_payment_id;

  foreach v_creator_id in array v_creator_ids
  loop
    select ts_live into v_ts_before from tlv.creators where id = v_creator_id for update;
    v_ts_after := greatest(0, v_ts_before - 20);

    update tlv.creators
    set
      ts_live = v_ts_after,
      total_live = fs_live + es_live + gs_daily + v_ts_after,
      payout_hold = true,
      payout_hold_reason = coalesce(payout_hold_reason, 'chargeback'),
      payout_hold_until = greatest(coalesce(payout_hold_until, now()), now() + interval '30 days')
    where id = v_creator_id;

    insert into tlv.creator_score_events (
      creator_id, axis, delta, score_before, score_after,
      reason_code, source_table, source_id, payload_json
    ) values (
      v_creator_id, 'TS', -20, v_ts_before, v_ts_after,
      'CHARGEBACK_RECEIVED', 'payments', p_payment_id,
      jsonb_build_object('jpy_gross_delta', p_jpy_gross_delta, 'jpy_net_delta', p_jpy_net_delta, 'reversal_kind', p_reversal_kind::text)
    );

    update tlv.payout_log pl
    set
      status = case when pl.status = 'paid' then pl.status else 'hold'::tlv.payout_status end,
      hold_reason = coalesce(pl.hold_reason, 'chargeback'),
      hold_until = greatest(coalesce(pl.hold_until, now()), now() + interval '30 days')
    where pl.creator_id = v_creator_id
      and pl.status in ('pending', 'approved', 'paid');

    if exists (
      select 1 from tlv.payout_log pl2
      where pl2.creator_id = v_creator_id and pl2.status = 'paid'
    ) then
      v_manual_finops := true;
    end if;
  end loop;

  insert into tlv.payment_reversals (
    payment_id, provider_event_id, reversal_kind, status,
    amount_jpy, coins, coins_shortfall, reason, stripe_dispute_id, metadata
  ) values (
    p_payment_id, p_provider_event_id, p_reversal_kind, 'applied',
    p_jpy_gross_delta, v_actual_claw, v_shortfall,
    case when p_is_refund then 'stripe_refund' else 'stripe_dispute_lost' end,
    p_stripe_dispute_id,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('coins_target', v_coins_target, 'manual_finops', v_manual_finops)
  ) returning id into v_reversal_id;

  return jsonb_build_object(
    'ok', true,
    'payment_id', p_payment_id,
    'reversal_id', v_reversal_id,
    'coins_clawed', v_actual_claw,
    'coins_shortfall', v_shortfall,
    'wallet_frozen', v_shortfall > 0,
    'manual_finops', v_manual_finops,
    'creator_ids', v_creator_ids
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- tlv.handle_payment_refund  Echarge.refunded / refund.updated
-- ---------------------------------------------------------------------------
create or replace function tlv.handle_payment_refund(
  p_provider tlv.payment_provider,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_stripe_payment_intent text,
  p_stripe_charge_id text,
  p_refund_jpy_cumulative bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = tlv, public
as $$
declare
  v_event_id uuid;
  v_event_status tlv.provider_event_status;
  v_payment_id uuid;
  v_payment record;
  v_delta_net bigint;
  v_delta_gross bigint;
  v_refund_net_cap bigint;
  v_prev_stripe_gross bigint;
  v_stripe_net_cumulative bigint;
  v_existing_reversal uuid;
  v_result jsonb;
begin
  select id, status into v_event_id, v_event_status
  from tlv.payment_provider_events
  where provider = p_provider and provider_event_id = p_provider_event_id
  for update;

  if found and v_event_status = 'processed' then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if not found then
    insert into tlv.payment_provider_events (
      provider, provider_event_id, event_type, status, payload_hash
    ) values (
      p_provider, p_provider_event_id, p_event_type, 'processing', p_payload_hash
    ) returning id into v_event_id;
  else
    update tlv.payment_provider_events
    set status = 'processing', event_type = p_event_type, payload_hash = p_payload_hash
    where id = v_event_id;
  end if;

  select id into v_payment_id
  from tlv.payments
  where stripe_payment_intent = p_stripe_payment_intent
     or (p_stripe_charge_id is not null and stripe_charge_id = p_stripe_charge_id)
  limit 1;

  if v_payment_id is null then
    update tlv.payment_provider_events
    set status = 'failed', error_message = 'payment_not_found', processed_at = now()
    where id = v_event_id;
    raise exception 'payment_not_found';
  end if;

  select * into v_payment from tlv.payments where id = v_payment_id;

  v_refund_net_cap := v_payment.gross_amount_jpy - v_payment.fee_amount_jpy;

  v_stripe_net_cumulative := floor(
    p_refund_jpy_cumulative::numeric * v_refund_net_cap::numeric
      / nullif(v_payment.gross_amount_jpy, 0)::numeric
  )::bigint;

  v_delta_net := v_stripe_net_cumulative - v_payment.refund_amount_jpy;

  v_prev_stripe_gross := case
    when v_payment.refund_amount_jpy = 0 then 0
    else floor(
      v_payment.refund_amount_jpy::numeric * v_payment.gross_amount_jpy::numeric
        / nullif(v_refund_net_cap, 0)::numeric
    )::bigint
  end;

  v_delta_gross := p_refund_jpy_cumulative - v_prev_stripe_gross;

  if v_delta_net <= 0 and v_delta_gross <= 0 then
    update tlv.payment_provider_events
    set status = 'processed', processed_at = now(), payment_id = v_payment_id
    where id = v_event_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', v_payment_id);
  end if;

  select id into v_existing_reversal
  from tlv.payment_reversals
  where provider_event_id = v_event_id;

  if found then
    update tlv.payment_provider_events
    set status = 'processed', processed_at = now(), payment_id = v_payment_id
    where id = v_event_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', v_payment_id);
  end if;

  v_result := tlv.apply_coin_clawback_for_payment(
    v_payment_id,
    v_event_id,
    v_delta_gross,
    v_delta_net,
    'refund',
    true,
    'refund:' || p_provider_event_id,
    null,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('stripe_charge_id', p_stripe_charge_id)
  );

  update tlv.payment_provider_events
  set status = 'processed', processed_at = now(), payment_id = v_payment_id
  where id = v_event_id;

  return v_result || jsonb_build_object('duplicate', false, 'jpy_gross_delta', v_delta_gross, 'jpy_net_delta', v_delta_net);
end;
$$;

-- ---------------------------------------------------------------------------
-- tlv.handle_payment_dispute  Edispute.created / dispute.closed
-- ---------------------------------------------------------------------------
create or replace function tlv.handle_payment_dispute(
  p_provider tlv.payment_provider,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_stripe_payment_intent text,
  p_stripe_charge_id text,
  p_stripe_dispute_id text,
  p_dispute_phase text,
  p_dispute_amount_jpy bigint default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = tlv, public
as $$
declare
  v_event_id uuid;
  v_event_status tlv.provider_event_status;
  v_payment_id uuid;
  v_payment record;
  v_wallet record;
  v_lot record;
  v_lock_coins integer;
  v_balance integer;
  v_creator_id uuid;
  v_existing uuid;
  v_result jsonb;
  v_reversal_kind tlv.payment_reversal_kind;
begin
  select id, status into v_event_id, v_event_status
  from tlv.payment_provider_events
  where provider = p_provider and provider_event_id = p_provider_event_id
  for update;

  if found and v_event_status = 'processed' then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if not found then
    insert into tlv.payment_provider_events (
      provider, provider_event_id, event_type, status, payload_hash
    ) values (
      p_provider, p_provider_event_id, p_event_type, 'processing', p_payload_hash
    ) returning id into v_event_id;
  else
    update tlv.payment_provider_events
    set status = 'processing', event_type = p_event_type, payload_hash = p_payload_hash
    where id = v_event_id;
  end if;

  select id into v_payment_id
  from tlv.payments
  where stripe_payment_intent = p_stripe_payment_intent
     or (p_stripe_charge_id is not null and stripe_charge_id = p_stripe_charge_id)
  limit 1;

  if v_payment_id is null then
    update tlv.payment_provider_events
    set status = 'failed', error_message = 'payment_not_found', processed_at = now()
    where id = v_event_id;
    raise exception 'payment_not_found';
  end if;

  select * into v_payment from tlv.payments where id = v_payment_id for update;

  if p_dispute_phase = 'open' then
    v_reversal_kind := 'dispute_open';

    select id into v_existing
    from tlv.payment_reversals
    where payment_id = v_payment_id
      and reversal_kind = 'dispute_open'
      and stripe_dispute_id = p_stripe_dispute_id;

    if found then
      update tlv.payment_provider_events
      set status = 'processed', processed_at = now(), payment_id = v_payment_id
      where id = v_event_id;
      return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', v_payment_id);
    end if;

    select * into v_lot from tlv.coin_lots where payment_id = v_payment_id for update;

    insert into tlv.viewer_wallets (user_id)
    values (v_payment.payer_user_uuid)
    on conflict (user_id) do nothing;

    select * into v_wallet
    from tlv.viewer_wallets
    where user_id = v_payment.payer_user_uuid
    for update;

    v_lock_coins := coalesce(v_lot.coins_remaining, v_payment.coins_granted);
    v_lock_coins := least(v_lock_coins, v_wallet.coin_balance - v_wallet.locked_coin_balance);
    v_lock_coins := greatest(0, v_lock_coins);

    if v_lock_coins > 0 then
      update tlv.viewer_wallets
      set locked_coin_balance = locked_coin_balance + v_lock_coins
      where id = v_wallet.id;

      insert into tlv.wallet_ledger (
        wallet_id, user_id, entry_type, coins_delta, balance_after,
        payment_id, provider_event_id, reason_code, metadata
      ) values (
        v_wallet.id, v_wallet.user_id, 'lock', 0, v_wallet.coin_balance,
        v_payment_id, v_event_id, 'DISPUTE_OPEN',
        jsonb_build_object('locked_coins', v_lock_coins, 'dispute_id', p_stripe_dispute_id)
      );
    end if;

    for v_creator_id in
      select distinct t.creator_id
      from tlv.tip_coin_lot_allocations a
      join tlv.coin_lots cl on cl.id = a.coin_lot_id
      join tlv.tips t on t.id = a.tip_id
      where cl.payment_id = v_payment_id
        and t.fraud_excluded = false
    loop
      update tlv.creators
      set
        payout_hold = true,
        payout_hold_reason = coalesce(payout_hold_reason, 'dispute'),
        payout_hold_until = greatest(coalesce(payout_hold_until, now()), now() + interval '30 days')
      where id = v_creator_id;

      update tlv.payout_log pl
      set status = 'hold', hold_reason = 'dispute',
          hold_until = greatest(coalesce(pl.hold_until, now()), now() + interval '30 days')
      where pl.creator_id = v_creator_id
        and pl.status in ('pending', 'approved');
    end loop;

    update tlv.payments
    set status = 'disputed', stripe_charge_id = coalesce(stripe_charge_id, p_stripe_charge_id)
    where id = v_payment_id;

    insert into tlv.payment_reversals (
      payment_id, provider_event_id, reversal_kind, status,
      amount_jpy, coins, reason, stripe_dispute_id, metadata
    ) values (
      v_payment_id, v_event_id, 'dispute_open', 'applied',
      coalesce(p_dispute_amount_jpy, 0), v_lock_coins,
      'stripe_dispute_open', p_stripe_dispute_id, coalesce(p_metadata, '{}'::jsonb)
    );

  elsif p_dispute_phase = 'won' then
    v_reversal_kind := 'dispute_won';

    select id into v_existing
    from tlv.payment_reversals
    where payment_id = v_payment_id
      and reversal_kind = 'dispute_won'
      and stripe_dispute_id = p_stripe_dispute_id;

    if found then
      update tlv.payment_provider_events
      set status = 'processed', processed_at = now(), payment_id = v_payment_id
      where id = v_event_id;
      return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', v_payment_id);
    end if;

    select * into v_wallet
    from tlv.viewer_wallets
    where user_id = v_payment.payer_user_uuid
    for update;

    if found then
      select coalesce(coins, 0) into v_lock_coins
      from tlv.payment_reversals
      where payment_id = v_payment_id
        and reversal_kind = 'dispute_open'
        and stripe_dispute_id = p_stripe_dispute_id
      order by created_at desc
      limit 1;

      if coalesce(v_lock_coins, 0) > 0 then
        update tlv.viewer_wallets
        set locked_coin_balance = greatest(0, locked_coin_balance - v_lock_coins)
        where id = v_wallet.id;

        insert into tlv.wallet_ledger (
          wallet_id, user_id, entry_type, coins_delta, balance_after,
          payment_id, provider_event_id, reason_code, metadata
        ) values (
          v_wallet.id, v_wallet.user_id, 'unlock', 0, v_wallet.coin_balance,
          v_payment_id, v_event_id, 'DISPUTE_WON',
          jsonb_build_object('unlocked_coins', v_lock_coins, 'dispute_id', p_stripe_dispute_id)
        );
      end if;
    end if;

    if v_payment.chargeback_amount_jpy = 0 and v_payment.refund_amount_jpy = 0 then
      update tlv.payments set status = 'succeeded' where id = v_payment_id;
    end if;

    insert into tlv.payment_reversals (
      payment_id, provider_event_id, reversal_kind, status,
      amount_jpy, coins, reason, stripe_dispute_id, metadata
    ) values (
      v_payment_id, v_event_id, 'dispute_won', 'applied',
      0, 0, 'stripe_dispute_won', p_stripe_dispute_id, coalesce(p_metadata, '{}'::jsonb)
    );

    v_result := jsonb_build_object('ok', true, 'phase', 'won', 'payment_id', v_payment_id);

  elsif p_dispute_phase = 'lost' then
    select id into v_existing
    from tlv.payment_reversals
    where payment_id = v_payment_id
      and reversal_kind = 'dispute_lost'
      and stripe_dispute_id = p_stripe_dispute_id;

    if found then
      update tlv.payment_provider_events
      set status = 'processed', processed_at = now(), payment_id = v_payment_id
      where id = v_event_id;
      return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', v_payment_id);
    end if;

    v_result := tlv.apply_coin_clawback_for_payment(
      v_payment_id,
      v_event_id,
      greatest(p_dispute_amount_jpy, 0),
      least(
        greatest(p_dispute_amount_jpy, 0),
        v_payment.gross_amount_jpy - v_payment.fee_amount_jpy - v_payment.refund_amount_jpy
      ),
      'dispute_lost',
      false,
      'chargeback:' || coalesce(p_stripe_dispute_id, p_provider_event_id),
      p_stripe_dispute_id,
      coalesce(p_metadata, '{}'::jsonb)
    );

  else
    update tlv.payment_provider_events
    set status = 'ignored', error_message = 'unsupported_dispute_phase', processed_at = now()
    where id = v_event_id;
    return jsonb_build_object('ok', true, 'ignored', true, 'phase', p_dispute_phase);
  end if;

  update tlv.payment_provider_events
  set status = 'processed', processed_at = now(), payment_id = v_payment_id
  where id = v_event_id;

  return coalesce(v_result, jsonb_build_object('ok', true, 'payment_id', v_payment_id))
    || jsonb_build_object('duplicate', false, 'phase', p_dispute_phase);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS  Epayment_reversals (admin only · TODO-07 pattern)
-- ---------------------------------------------------------------------------
alter table tlv.payment_reversals enable row level security;
alter table tlv.payment_reversals force row level security;

drop policy if exists pr_admin_select on tlv.payment_reversals;

create policy pr_admin_select on tlv.payment_reversals
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

-- ---------------------------------------------------------------------------
-- Privileges  Eservice_role only for new RPCs
-- ---------------------------------------------------------------------------
revoke execute on function tlv.reverse_tip_revenue_for_lot(uuid, uuid, integer, text, jsonb)
  from public, anon, authenticated;
revoke execute on function tlv.apply_coin_clawback_for_payment(
  uuid, uuid, bigint, bigint, tlv.payment_reversal_kind, boolean, text, text, jsonb
) from public, anon, authenticated;

grant execute on function tlv.handle_payment_refund(
  tlv.payment_provider, text, text, text, text, text, bigint, jsonb
) to service_role;

grant execute on function tlv.handle_payment_dispute(
  tlv.payment_provider, text, text, text, text, text, text, text, bigint, jsonb
) to service_role;

grant execute on function tlv.reverse_tip_revenue_for_lot(uuid, uuid, integer, text, jsonb)
  to service_role;

grant execute on function tlv.apply_coin_clawback_for_payment(
  uuid, uuid, bigint, bigint, tlv.payment_reversal_kind, boolean, text, text, jsonb
) to service_role;
