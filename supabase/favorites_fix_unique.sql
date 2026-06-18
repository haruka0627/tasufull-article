-- favorites テーブルの unique 制約を修正
-- 「1ユーザー1件しか登録できない」場合は user_id のみ / user_id+target_id の誤った unique がある可能性があります。
-- Supabase SQL Editor で実行してください。

-- 誤った unique 制約を削除（存在しない場合はスキップ）
alter table public.favorites drop constraint if exists favorites_user_id_key;
alter table public.favorites drop constraint if exists favorites_user_id_unique;
alter table public.favorites drop constraint if exists favorites_user_id_target_id_key;
alter table public.favorites drop constraint if exists favorites_user_id_target_id_unique;
alter table public.favorites drop constraint if exists favorites_user_target_id_key;
alter table public.favorites drop constraint if exists favorites_user_target_id_unique;
alter table public.favorites drop constraint if exists favorites_pkey_user;
alter table public.favorites drop constraint if exists favorites_user_key;

-- 正しい複合 unique を再作成
alter table public.favorites drop constraint if exists favorites_user_target_unique;
alter table public.favorites
  add constraint favorites_user_target_unique unique (user_id, target_type, target_id);
