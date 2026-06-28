SELECT step, ok FROM (
  SELECT 'step0_tlv_schema' AS step,
         EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'tlv') AS ok
  UNION ALL
  SELECT 'step1_handle_payment_webhook_success',
         EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'tlv' AND p.proname = 'handle_payment_webhook_success')
  UNION ALL
  SELECT 'step2_payer_user_uuid_column',
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'tlv' AND table_name = 'payments' AND column_name = 'payer_user_uuid')
  UNION ALL
  SELECT 'step3_create_tip_transaction',
         EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'tlv' AND p.proname = 'create_tip_transaction')
  UNION ALL
  SELECT 'step4_rls_vw_owner_select',
         EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'tlv' AND tablename = 'viewer_wallets' AND policyname = 'vw_owner_select')
  UNION ALL
  SELECT 'step5_payment_reversals_table',
         EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'tlv' AND table_name = 'payment_reversals')
  UNION ALL
  SELECT 'step5_handle_payment_refund',
         EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'tlv' AND p.proname = 'handle_payment_refund')
) t
ORDER BY step;
