-- Drift analysis: RLS policies (full list)
SELECT schemaname, tablename, policyname, cmd, roles::text AS roles
FROM pg_policies
WHERE schemaname = 'tlv'
ORDER BY tablename, policyname;
