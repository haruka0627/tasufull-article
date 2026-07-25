SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'tlv'
  AND proname IN (
    'handle_payment_webhook_success',
    'create_tip_transaction',
    'handle_payment_refund',
    'handle_payment_dispute'
  )
ORDER BY proname;
