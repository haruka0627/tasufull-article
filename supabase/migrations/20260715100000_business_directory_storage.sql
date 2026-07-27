-- Business Directory listing photos — Supabase Storage bucket
-- Path convention: {listing_id}/{uuid}.{ext}
-- Ref: docs/business-directory-data-model-design.md §3.4

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-directory',
  'business-directory',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
