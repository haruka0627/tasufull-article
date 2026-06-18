select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'chats'
order by ordinal_position;

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'ai_messages'
order by ordinal_position;
