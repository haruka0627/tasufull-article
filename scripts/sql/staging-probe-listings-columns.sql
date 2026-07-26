-- Staging probe (read-only)
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'listings'
  and column_name in (
    'id', 'user_id', 'owner_id', 'listing_type', 'title', 'status',
    'form_data', 'payload', 'description'
  )
order by 1;
