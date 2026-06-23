select indexname from pg_indexes
where schemaname = 'public'
  and tablename = 'transaction_rooms'
  and indexname in ('transaction_rooms_contact_id_uidx', 'transaction_rooms_service_ref_idx');
