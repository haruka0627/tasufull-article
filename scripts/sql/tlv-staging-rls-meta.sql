SELECT c.relname AS tablename, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'tlv'
  AND c.relkind = 'r'
  AND c.relname IN (
    'payments','payment_provider_events','revenue_ledger','viewer_wallets','wallet_ledger',
    'coin_lots','tip_coin_lot_allocations','tips','stream_events','creator_score_events'
  )
ORDER BY c.relname;
