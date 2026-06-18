-- transaction_rooms.status カラム追加（active / completed / cancelled）
-- 既存DB向けマイグレーション。新規は transaction_chat.sql も更新済み。

alter table public.transaction_rooms
  add column if not exists status text not null default 'active';

create index if not exists transaction_rooms_status_idx
  on public.transaction_rooms (status);
