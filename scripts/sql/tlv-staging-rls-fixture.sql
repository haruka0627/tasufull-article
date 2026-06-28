INSERT INTO tlv.viewer_wallets (
  id, user_id, coin_balance, locked_coin_balance,
  lifetime_purchased_coins, lifetime_spent_coins, status
)
VALUES (
  'a0000000-0000-4000-8000-000000000102',
  'a0000000-0000-4000-8000-000000000101',
  500, 0, 500, 0, 'active'
)
ON CONFLICT (user_id) DO UPDATE SET
  coin_balance = GREATEST(tlv.viewer_wallets.coin_balance, 500),
  status = 'active';

INSERT INTO tlv.creators (id, user_id, display_name, channel_slug)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'tlv-staging-tip-creator',
  'Staging Tip Creator',
  'tlv-staging-tip-ch'
)
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id;
