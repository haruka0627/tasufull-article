-- MATCH linked ref E2E — schema / migration readonly gates
-- Ref: ddojquacsyqesrjhcvmn

select
  (select count(*)::int
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'transaction_rooms'
     and column_name = 'match_pair_id') as transaction_rooms_match_pair_id_col,

  (select count(*)::int
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'match_pairs'
     and column_name = 'talk_room_id') as match_pairs_talk_room_id_col,

  (select count(*)::int
   from pg_indexes
   where schemaname = 'public'
     and indexname = 'transaction_rooms_match_pair_id_uidx') as transaction_rooms_match_pair_id_uidx,

  (select count(*)::int
   from pg_indexes
   where schemaname = 'public'
     and indexname = 'transaction_rooms_listing_match_idx') as transaction_rooms_listing_match_idx;
