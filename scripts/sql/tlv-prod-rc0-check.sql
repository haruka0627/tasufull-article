-- Phase 0 RC check — tlv schema / RPC / RLS / chargeback state
SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'tlv') AS tlv_schema_exists;

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

SELECT count(*) AS rls_policy_count FROM pg_policies WHERE schemaname = 'tlv';

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'tlv'
  AND c.relname IN ('viewer_wallets', 'payment_reversals', 'payments')
ORDER BY c.relname;

SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;
