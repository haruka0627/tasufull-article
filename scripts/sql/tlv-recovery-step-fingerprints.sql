-- Step fingerprint inventory (read-only)
SELECT 'step0_tlv_schema' AS step,
       EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'tlv') AS ok;

SELECT 'step1_handle_payment_webhook_success' AS marker,
       EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'tlv' AND p.proname = 'handle_payment_webhook_success'
       ) AS ok;

SELECT 'step2_payer_user_uuid_column' AS marker,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'tlv' AND table_name = 'payments' AND column_name = 'payer_user_uuid'
       ) AS ok;

SELECT 'step3_create_tip_transaction' AS marker,
       EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'tlv' AND p.proname = 'create_tip_transaction'
       ) AS ok;

SELECT 'step4_rls_vw_owner_select' AS marker,
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'tlv' AND tablename = 'viewer_wallets' AND policyname = 'vw_owner_select'
       ) AS ok;

SELECT 'step5_payment_reversals' AS marker,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'tlv' AND table_name = 'payment_reversals'
       ) AS ok;

SELECT 'step5_handle_payment_refund' AS marker,
       EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'tlv' AND p.proname = 'handle_payment_refund'
       ) AS ok;
