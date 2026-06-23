select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transaction_rooms'
  and column_name in ('contact_id', 'source', 'service_type', 'service_ref_id')
order by column_name;
