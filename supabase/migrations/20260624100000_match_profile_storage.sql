-- MATCH profile photos — Supabase Storage bucket (linked ref)
-- Path convention: {talk_user_id}/{uuid}.{ext}
-- Ref: reports/match-profile-live-integration-report.md

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'match-profile-photos',
  'match-profile-photos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Hobby tags used by profile-create UI (master only · no free-form)
insert into public.match_hobby_tags (slug, label_ja, display_order)
values
  ('cafe', 'カフェ', 5),
  ('reading', '読書', 60)
on conflict (slug) do update set
  label_ja = excluded.label_ja,
  display_order = excluded.display_order,
  is_active = true;
