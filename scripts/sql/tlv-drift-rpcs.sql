-- Drift analysis: tlv RPCs
SELECT p.proname AS rpc_name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'tlv'
  AND p.prokind = 'f'
ORDER BY p.proname, args;
