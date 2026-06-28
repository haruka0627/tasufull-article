-- TLV Payment Engine Phase 2 — atomic RPC (requires db/tlv_schema.sql applied)
-- Ref: docs/TLV_PAYMENT_ENGINE.md v1.1

create or replace function tlv.handle_payment_webhook_success(
  p_provider tlv.payment_provider,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_payer_user_id text,
  p_wallet_user_id uuid,
  p_creator_id uuid,
  p_channel tlv.payment_channel,
  p_gross bigint,
  p_fee bigint,
  p_net bigint,
  p_fee_rate numeric,
  p_coins integer,
  p_is_web boolean,
  p_stripe_payment_intent text,
  p_external_ref text,
  p_metadata jsonb default '{}'::jsonb,
  p_payer_user_uuid uuid default null
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
  v_wallet_id uuid;
  v_lot_id uuid;
  v_balance integer;
  v_payer_uuid uuid;
begin
  v_payer_uuid := coalesce(p_payer_user_uuid, p_wallet_user_id);

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
  for update;

  if found then
    if (select status from tlv.payments where id = v_payment_id) = 'succeeded' then
      update tlv.payment_provider_events
      set status = 'processed', processed_at = now(), payment_id = v_payment_id
      where id = v_event_id;
      return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', v_payment_id);
    end if;
    update tlv.payments set
      status = 'succeeded',
      paid_at = now(),
      gross_amount_jpy = p_gross,
      fee_amount_jpy = p_fee,
      net_amount_jpy = p_net,
      fee_rate_applied = p_fee_rate,
      coins_granted = p_coins,
      is_web_payment = p_is_web,
      payer_user_uuid = v_payer_uuid,
      metadata_json = p_metadata
    where id = v_payment_id;
  else
    insert into tlv.payments (
      payer_user_id, payer_user_uuid, creator_id, payment_kind, channel, status,
      gross_amount_jpy, fee_amount_jpy, net_amount_jpy, fee_rate_applied,
      coins_granted, is_web_payment, external_ref, stripe_payment_intent,
      metadata_json, paid_at
    ) values (
      p_payer_user_id, v_payer_uuid, p_creator_id, 'coin_purchase', p_channel, 'succeeded',
      p_gross, p_fee, p_net, p_fee_rate,
      p_coins, p_is_web, p_external_ref, p_stripe_payment_intent,
      p_metadata, now()
    ) returning id into v_payment_id;
  end if;

  insert into tlv.viewer_wallets (user_id)
  values (p_wallet_user_id)
  on conflict (user_id) do nothing;

  select id, coin_balance into v_wallet_id, v_balance
  from tlv.viewer_wallets
  where user_id = p_wallet_user_id
  for update;

  if (select status from tlv.viewer_wallets where id = v_wallet_id) != 'active' then
    raise exception 'wallet_not_active';
  end if;

  v_balance := v_balance + p_coins;

  update tlv.viewer_wallets set
    coin_balance = v_balance,
    lifetime_purchased_coins = lifetime_purchased_coins + p_coins
  where id = v_wallet_id;

  insert into tlv.coin_lots (
    wallet_id, user_id, payment_id, lot_source, is_web_payment,
    gross_amount_jpy, fee_amount_jpy, net_amount_jpy,
    coins_original, coins_remaining, extension_allowed, expires_at
  ) values (
    v_wallet_id, v_payer_uuid, v_payment_id,
    case p_channel
      when 'web_stripe' then 'web_stripe'::tlv.coin_lot_source
      when 'ios_iap' then 'ios_iap'::tlv.coin_lot_source
      else 'android_iap'::tlv.coin_lot_source
    end,
    p_is_web,
    p_gross, p_fee, p_net,
    p_coins, p_coins, true,
    now() + interval '180 days'
  ) returning id into v_lot_id;

  insert into tlv.wallet_ledger (
    wallet_id, user_id, entry_type, coins_delta, balance_after,
    payment_id, provider_event_id, reason_code, metadata
  ) values (
    v_wallet_id, v_payer_uuid, 'purchase_credit', p_coins, v_balance,
    v_payment_id, v_event_id, 'COIN_PURCHASE',
    jsonb_build_object('coin_lot_id', v_lot_id)
  );

  update tlv.payment_provider_events
  set status = 'processed', processed_at = now(), payment_id = v_payment_id
  where id = v_event_id;

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'payer_user_uuid', v_payer_uuid,
    'wallet_id', v_wallet_id,
    'coin_lot_id', v_lot_id,
    'coin_balance', v_balance
  );
end;
$$;

create or replace function tlv.record_payment_provider_event_terminal(
  p_provider tlv.payment_provider,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_status tlv.provider_event_status,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = tlv, public
as $$
declare
  v_id uuid;
  v_existing tlv.provider_event_status;
begin
  select id, status into v_id, v_existing
  from tlv.payment_provider_events
  where provider = p_provider and provider_event_id = p_provider_event_id
  for update;

  if found and v_existing = 'processed' then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if not found then
    insert into tlv.payment_provider_events (
      provider, provider_event_id, event_type, status, payload_hash,
      error_message, processed_at
    ) values (
      p_provider, p_provider_event_id, p_event_type, p_status, p_payload_hash,
      p_error_message, now()
    );
  else
    update tlv.payment_provider_events set
      status = p_status,
      event_type = p_event_type,
      payload_hash = p_payload_hash,
      error_message = p_error_message,
      processed_at = now()
    where id = v_id;
  end if;

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

grant execute on function tlv.handle_payment_webhook_success(
  tlv.payment_provider, text, text, text, text, uuid, uuid,
  tlv.payment_channel, bigint, bigint, bigint, numeric, integer, boolean,
  text, text, jsonb, uuid
) to service_role;

grant execute on function tlv.record_payment_provider_event_terminal(
  tlv.payment_provider, text, text, text, tlv.provider_event_status, text
) to service_role;
