-- Patch: drop old apply_coin_clawback signature before re-create
drop function if exists tlv.apply_coin_clawback_for_payment(
  uuid, uuid, bigint, tlv.payment_reversal_kind, boolean, text, text, jsonb
);
