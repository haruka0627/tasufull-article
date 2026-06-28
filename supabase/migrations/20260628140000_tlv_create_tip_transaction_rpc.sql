-- TLV Payment Engine Phase 2 — createTip single-TX RPC (CAND-P2-01)
-- Ref: reports/tlv-payment-create-tip-transaction-rpc.md · docs/TLV_PAYMENT_ENGINE.md v1.5

-- ---------------------------------------------------------------------------
-- tips.idempotency_key — duplicate tip prevention
-- ---------------------------------------------------------------------------

alter table tlv.tips
  add column if not exists idempotency_key text;

comment on column tlv.tips.idempotency_key is
  'Client idempotency key — duplicate RPC returns existing tip without double debit';

create unique index if not exists tips_idempotency_key_uniq
  on tlv.tips (idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- tlv.compute_gauge_pct — mirror of tlv-payment-math.ts
-- ---------------------------------------------------------------------------

create or replace function tlv.compute_gauge_pct(
  p_unique_viewers integer,
  p_avg_watch_minutes numeric,
  p_cheer_count integer,
  p_paid_extension_coins integer
)
returns numeric
language sql
immutable
as $$
  select least(
    100::numeric,
    p_unique_viewers * 2
      + p_avg_watch_minutes * 1.5
      + p_cheer_count * 0.5
      + p_paid_extension_coins / 5.0
  );
$$;

-- Drop legacy name if present (rename from create_tip)
drop function if exists tlv.create_tip(
  uuid, uuid, uuid, text, tlv.tip_kind, integer,
  text, jsonb, uuid, text, text,
  boolean, boolean, boolean
);

-- ---------------------------------------------------------------------------
-- tlv.create_tip_transaction — atomic tip spend (wallet · lots · ledger · gauge)
-- ---------------------------------------------------------------------------

create or replace function tlv.create_tip_transaction(
  p_stream_id uuid,
  p_creator_id uuid,
  p_payer_user_uuid uuid,
  p_payer_user_id text,
  p_tip_kind tlv.tip_kind,
  p_coin_amount integer,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_tip_id uuid default null,
  p_creator_user_id uuid default null,
  p_message text default null,
  p_device_id text default null,
  p_self_gift_flag boolean default false,
  p_fraud_excluded boolean default false,
  p_bot_flag boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = tlv, public
as $$
declare
  v_existing_tip record;
  v_stream record;
  v_wallet record;
  v_gauge record;
  v_creator record;
  v_tip_id uuid;
  v_review_required boolean;
  v_post_ledger boolean;
  v_apply_gauge boolean;
  v_remaining integer;
  v_lot record;
  v_take integer;
  v_net_alloc bigint;
  v_gross_alloc bigint;
  v_web_origin_coins integer := 0;
  v_app_origin_coins integer := 0;
  v_web_origin_net bigint := 0;
  v_app_origin_net bigint := 0;
  v_wr_at_tip numeric;
  v_gross_jpy bigint;
  v_net_jpy bigint;
  v_new_balance integer;
  v_paid integer;
  v_unit integer;
  v_total_blocks integer;
  v_pending_blocks integer;
  v_gauge_pct numeric;
  v_adj_pct numeric;
  v_allow_grant boolean;
  v_blocks_to_grant integer := 0;
  v_segment_end timestamptz;
  v_new_end timestamptz;
  v_block_num integer;
  v_new_contributor boolean;
  v_extension_unlocked boolean := false;
  v_ledger_month char(7);
  v_dup_balance integer;
  v_dup_gauge integer;
  v_gauge_total_after integer := 0;
begin
  if p_payer_user_uuid is null then
    raise exception 'payer_user_uuid_required';
  end if;

  if p_coin_amount is null or p_coin_amount < 1 or p_coin_amount > 10000 then
    raise exception 'invalid_coin_amount';
  end if;

  if p_payer_user_id is null or length(trim(p_payer_user_id)) = 0 then
    raise exception 'payer_user_id_required';
  end if;

  -- 1. Idempotency — return existing without double debit
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select t.id, t.self_gift_flag, t.fraud_excluded
    into v_existing_tip
    from tlv.tips t
    where t.idempotency_key = p_idempotency_key;

    if found then
      select w.coin_balance into v_dup_balance
      from tlv.viewer_wallets w
      where w.user_id = p_payer_user_uuid;

      select coalesce(g.paid_extension_coins, 0) into v_dup_gauge
      from tlv.gauge_state g
      where g.stream_id = p_stream_id;

      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'tip_id', v_existing_tip.id,
        'wallet_balance_after', coalesce(v_dup_balance, 0),
        'gauge_total_after', coalesce(v_dup_gauge, 0),
        'extension_unlocked', false,
        'review_required', v_existing_tip.self_gift_flag and not v_existing_tip.fraud_excluded
      );
    end if;
  end if;

  if p_tip_id is not null then
    select t.id, t.self_gift_flag, t.fraud_excluded
    into v_existing_tip
    from tlv.tips t
    where t.id = p_tip_id;

    if found then
      select w.coin_balance into v_dup_balance
      from tlv.viewer_wallets w
      where w.user_id = p_payer_user_uuid;

      select coalesce(g.paid_extension_coins, 0) into v_dup_gauge
      from tlv.gauge_state g
      where g.stream_id = p_stream_id;

      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'tip_id', v_existing_tip.id,
        'wallet_balance_after', coalesce(v_dup_balance, 0),
        'gauge_total_after', coalesce(v_dup_gauge, 0),
        'extension_unlocked', false,
        'review_required', v_existing_tip.self_gift_flag and not v_existing_tip.fraud_excluded
      );
    end if;
  end if;

  v_review_required := p_self_gift_flag and not p_fraud_excluded;
  v_post_ledger := not p_fraud_excluded and not v_review_required and not p_bot_flag;
  v_apply_gauge := p_tip_kind = 'extension' and not p_fraud_excluded and not v_review_required;
  v_gross_jpy := p_coin_amount * 100;
  v_net_jpy := p_coin_amount * 100;
  v_ledger_month := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_tip_id := coalesce(p_tip_id, gen_random_uuid());

  select s.id, s.creator_id, s.status, s.extension_blocks_completed, s.phase
  into v_stream
  from tlv.streams s
  where s.id = p_stream_id
  for update;

  if not found then
    raise exception 'stream_not_found';
  end if;

  if v_stream.status <> 'live' then
    raise exception 'stream_not_live';
  end if;

  if v_stream.creator_id <> p_creator_id then
    raise exception 'creator_id_mismatch';
  end if;

  if v_apply_gauge then
    select g.*
    into v_gauge
    from tlv.gauge_state g
    where g.stream_id = p_stream_id
    for update;

    if not found then
      raise exception 'gauge_state_missing';
    end if;
  end if;

  select w.*
  into v_wallet
  from tlv.viewer_wallets w
  where w.user_id = p_payer_user_uuid
  for update;

  if not found then
    raise exception 'wallet_not_found';
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'wallet_not_active';
  end if;

  if v_wallet.coin_balance - v_wallet.locked_coin_balance < p_coin_amount then
    raise exception 'insufficient_balance';
  end if;

  v_remaining := p_coin_amount;

  drop table if exists _tip_lot_allocs;
  create temp table _tip_lot_allocs (
    coin_lot_id uuid not null,
    coins_allocated integer not null,
    gross_allocated_jpy bigint not null,
    net_allocated_jpy bigint not null,
    is_web_origin boolean not null,
    lot_source tlv.coin_lot_source not null
  ) on commit drop;

  for v_lot in
    select cl.*
    from tlv.coin_lots cl
    where cl.wallet_id = v_wallet.id
      and cl.coins_remaining > 0
    order by cl.expires_at nulls last, cl.created_at asc
    for update
  loop
    exit when v_remaining <= 0;

    if p_tip_kind = 'extension' and not v_lot.extension_allowed then
      continue;
    end if;

    v_take := least(v_lot.coins_remaining, v_remaining);
    v_net_alloc := floor(v_lot.net_amount_jpy * v_take::numeric / v_lot.coins_original);
    v_gross_alloc := floor(v_lot.gross_amount_jpy * v_take::numeric / v_lot.coins_original);

    insert into _tip_lot_allocs (
      coin_lot_id, coins_allocated, gross_allocated_jpy, net_allocated_jpy,
      is_web_origin, lot_source
    ) values (
      v_lot.id, v_take, v_gross_alloc, v_net_alloc,
      v_lot.is_web_payment, v_lot.lot_source
    );

    update tlv.coin_lots
    set coins_remaining = coins_remaining - v_take
    where id = v_lot.id
      and coins_remaining >= v_take;

    if not found then
      raise exception 'lot_race_conflict';
    end if;

    if v_lot.is_web_payment then
      v_web_origin_coins := v_web_origin_coins + v_take;
      v_web_origin_net := v_web_origin_net + v_net_alloc;
    else
      v_app_origin_coins := v_app_origin_coins + v_take;
      v_app_origin_net := v_app_origin_net + v_net_alloc;
    end if;

    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'insufficient_lots';
  end if;

  if v_web_origin_net + v_app_origin_net > 0 then
    v_wr_at_tip := round(
      (v_web_origin_net::numeric / (v_web_origin_net + v_app_origin_net)::numeric) * 10000
    ) / 10000;
  else
    v_wr_at_tip := null;
  end if;

  insert into tlv.tips (
    id, stream_id, creator_id, payer_user_id, payer_user_uuid,
    tip_kind, coins_amount, gross_amount_jpy, net_amount_jpy,
    message, self_gift_flag, self_gift_confirmed, bot_suspect_flag, fraud_excluded,
    device_id, web_origin_coins, app_origin_coins,
    web_origin_net_jpy, app_origin_net_jpy, wr_at_tip, idempotency_key
  ) values (
    v_tip_id, p_stream_id, p_creator_id, p_payer_user_id, p_payer_user_uuid,
    p_tip_kind, p_coin_amount, v_gross_jpy, v_net_jpy,
    p_message, p_self_gift_flag, false, p_bot_flag, p_fraud_excluded,
    p_device_id, v_web_origin_coins, v_app_origin_coins,
    v_web_origin_net, v_app_origin_net, v_wr_at_tip,
    nullif(trim(p_idempotency_key), '')
  );

  insert into tlv.tip_coin_lot_allocations (
    tip_id, coin_lot_id, coins_allocated, gross_allocated_jpy,
    net_allocated_jpy, is_web_origin, lot_source
  )
  select
    v_tip_id, a.coin_lot_id, a.coins_allocated, a.gross_allocated_jpy,
    a.net_allocated_jpy, a.is_web_origin, a.lot_source
  from _tip_lot_allocs a;

  v_new_balance := v_wallet.coin_balance - p_coin_amount;

  update tlv.viewer_wallets
  set
    coin_balance = v_new_balance,
    lifetime_spent_coins = lifetime_spent_coins + p_coin_amount
  where id = v_wallet.id;

  insert into tlv.wallet_ledger (
    wallet_id, user_id, entry_type, coins_delta, balance_after,
    tip_id, reason_code, metadata
  ) values (
    v_wallet.id, p_payer_user_uuid, 'tip_debit', -p_coin_amount, v_new_balance,
    v_tip_id, 'TIP_SPEND',
    case when v_review_required
      then jsonb_build_object('review_required', true) || coalesce(p_metadata, '{}'::jsonb)
      else coalesce(p_metadata, '{}'::jsonb)
    end
  );

  if v_post_ledger then
    insert into tlv.revenue_ledger (
      stream_id, creator_id, tip_id, event_kind, ledger_month,
      gross_amount_jpy, fee_amount_jpy, net_amount_jpy,
      infra_cost_jpy, creator_payout_jpy, platform_revenue_jpy,
      self_gift_excluded
    ) values (
      p_stream_id, p_creator_id, v_tip_id,
      case when p_tip_kind = 'extension' then 'extension'::tlv.revenue_event_kind
           else 'gift'::tlv.revenue_event_kind end,
      v_ledger_month,
      v_gross_jpy, 0, v_net_jpy,
      0, 0, v_net_jpy,
      false
    );

    select c.fs_live, c.es_live, c.gs_daily, c.ts_live, c.total_live
    into v_creator
    from tlv.creators c
    where c.id = p_creator_id;

    if found then
      insert into tlv.creator_score_events (
        creator_id, axis, delta, score_before, score_after,
        reason_code, source_table, source_id, payload_json
      ) values (
        p_creator_id,
        case when p_tip_kind = 'extension' then 'ES'::tlv.score_axis else 'FS'::tlv.score_axis end,
        0, v_creator.total_live, v_creator.total_live,
        case when p_tip_kind = 'extension' then 'TIP_EXTENSION' else 'TIP_GIFT' end,
        'tips', v_tip_id,
        jsonb_build_object(
          'net_jpy', v_net_jpy,
          'wr_at_tip', v_wr_at_tip,
          'coins', p_coin_amount,
          'creator_user_id', p_creator_user_id
        )
      );
    end if;
  end if;

  if v_apply_gauge then
    v_paid := v_gauge.paid_extension_coins + p_coin_amount;
    v_unit := v_gauge.extension_unit_coins;
    v_total_blocks := v_paid / v_unit;
    v_pending_blocks := v_total_blocks - v_gauge.completed_extension_blocks;

    select not exists (
      select 1
      from tlv.tips t
      where t.stream_id = p_stream_id
        and t.tip_kind = 'extension'
        and t.payer_user_uuid = p_payer_user_uuid
        and t.fraud_excluded = false
        and t.id <> v_tip_id
    ) into v_new_contributor;

    v_gauge_pct := tlv.compute_gauge_pct(
      v_gauge.unique_viewers,
      v_gauge.avg_watch_minutes,
      v_gauge.cheer_count,
      v_paid
    );
    v_adj_pct := v_gauge_pct / coalesce(nullif(v_gauge.gauge_difficulty, 0), 1);

    v_allow_grant := (
      v_adj_pct >= 100 and v_paid >= 500
    ) or (
      v_paid >= 500 and v_gauge.effective_ccu >= 5
    );

    if v_pending_blocks > 0 and v_allow_grant then
      v_blocks_to_grant := v_pending_blocks;
    end if;

    update tlv.gauge_state
    set
      paid_extension_coins = v_paid,
      extension_stock_coins = v_paid - v_total_blocks * v_unit,
      next_block_cost_coins = greatest(0, v_unit - (v_paid - v_total_blocks * v_unit)),
      gauge_pct = v_gauge_pct,
      adjusted_gauge_pct = v_adj_pct,
      extension_contributors = case
        when v_new_contributor then extension_contributors + 1
        else extension_contributors
      end
    where stream_id = p_stream_id;

    if v_blocks_to_grant > 0 then
      v_extension_unlocked := true;
      v_segment_end := coalesce(v_gauge.free_phase_ends_at, now());
      if v_segment_end < now() then
        v_segment_end := now();
      end if;
      v_new_end := v_segment_end + (30 * v_blocks_to_grant * interval '1 minute');

      update tlv.streams
      set
        extension_blocks_completed = extension_blocks_completed + v_blocks_to_grant,
        phase = 'extension_30'
      where id = p_stream_id;

      update tlv.gauge_state
      set
        completed_extension_blocks = completed_extension_blocks + v_blocks_to_grant,
        gauge_phase = 'extended',
        free_phase_ends_at = v_new_end,
        threshold_met_at = now()
      where stream_id = p_stream_id;

      for v_block_num in
        v_gauge.completed_extension_blocks + 1
        .. v_gauge.completed_extension_blocks + v_blocks_to_grant
      loop
        insert into tlv.stream_events (
          stream_id, event_kind, viewer_user_id, tip_id, payload_json
        ) values (
          p_stream_id, 'extension_unlock', p_payer_user_id, v_tip_id,
          jsonb_build_object('block_number', v_block_num, 'tip_id', v_tip_id)
        );
      end loop;
    end if;

    insert into tlv.stream_events (
      stream_id, event_kind, viewer_user_id, tip_id, payload_json
    ) values (
      p_stream_id, 'extension_coin', p_payer_user_id, v_tip_id, '{}'::jsonb
    );
  elsif p_tip_kind = 'cheer' then
    insert into tlv.stream_events (
      stream_id, event_kind, viewer_user_id, tip_id, payload_json
    ) values (
      p_stream_id, 'cheer_display', p_payer_user_id, v_tip_id, '{}'::jsonb
    );
  elsif p_tip_kind = 'gift' then
    insert into tlv.stream_events (
      stream_id, event_kind, viewer_user_id, tip_id, payload_json
    ) values (
      p_stream_id, 'cheer_display', p_payer_user_id, v_tip_id,
      jsonb_build_object('kind', 'gift')
    );
  end if;

  if v_apply_gauge then
    v_gauge_total_after := v_paid;
  else
    select coalesce(g.paid_extension_coins, 0)
    into v_gauge_total_after
    from tlv.gauge_state g
    where g.stream_id = p_stream_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'tip_id', v_tip_id,
    'wallet_balance_after', v_new_balance,
    'gauge_total_after', coalesce(v_gauge_total_after, 0),
    'extension_unlocked', v_extension_unlocked,
    'extension_blocks_granted', v_blocks_to_grant,
    'review_required', v_review_required,
    'wr_at_tip', v_wr_at_tip,
    'fraud_excluded', p_fraud_excluded
  );

exception
  when unique_violation then
    if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
      select t.id, t.self_gift_flag, t.fraud_excluded
      into v_existing_tip
      from tlv.tips t
      where t.idempotency_key = p_idempotency_key;

      if found then
        select w.coin_balance into v_dup_balance
        from tlv.viewer_wallets w
        where w.user_id = p_payer_user_uuid;

        select coalesce(g.paid_extension_coins, 0) into v_dup_gauge
        from tlv.gauge_state g
        where g.stream_id = p_stream_id;

        return jsonb_build_object(
          'ok', true,
          'duplicate', true,
          'tip_id', v_existing_tip.id,
          'wallet_balance_after', coalesce(v_dup_balance, 0),
          'gauge_total_after', coalesce(v_dup_gauge, 0),
          'extension_unlocked', false,
          'review_required', v_existing_tip.self_gift_flag and not v_existing_tip.fraud_excluded
        );
      end if;
    end if;
    raise;
end;
$$;

grant execute on function tlv.create_tip_transaction(
  uuid, uuid, uuid, text, tlv.tip_kind, integer,
  text, jsonb, uuid, uuid, text, text,
  boolean, boolean, boolean
) to service_role;

grant execute on function tlv.compute_gauge_pct(integer, numeric, integer, integer)
  to service_role;
