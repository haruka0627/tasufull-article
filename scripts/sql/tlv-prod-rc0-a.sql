SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'tlv') AS tlv_schema_exists;
