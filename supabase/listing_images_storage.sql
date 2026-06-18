-- 掲載画像用 Storage バケット（開発用: 公開読み取り + anon アップロード）
-- Supabase Dashboard → SQL Editor で実行

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "listing_images_select_public" on storage.objects;
drop policy if exists "listing_images_insert_anon" on storage.objects;
drop policy if exists "listing_images_update_anon" on storage.objects;

create policy "listing_images_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'listing-images');

create policy "listing_images_insert_anon"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'listing-images');

create policy "listing_images_update_anon"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'listing-images')
  with check (bucket_id = 'listing-images');
