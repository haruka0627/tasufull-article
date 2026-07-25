-- Drift analysis: tlv tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'tlv'
ORDER BY table_name;
