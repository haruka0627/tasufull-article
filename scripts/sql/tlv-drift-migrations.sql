-- Drift analysis: schema_migrations (TLV-related)
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260628%'
   OR version LIKE '20260629%'
ORDER BY version;
