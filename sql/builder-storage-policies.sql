-- Builder Storage policies (IMPLEMENTATION-READY DRAFT)
-- IMPORTANT: This file is prepared to be *close to executable*, but you MUST NOT run it yet.
-- Before execution, confirm:
-- - JWT claims wiring used by RLS helper functions (see sql/builder-rls-policies.sql)
-- - RLS functions exist (builder_can_read_project / builder_is_project_owner / builder_is_selected_partner)
-- - path format is strictly enforced in your app and migration script
-- - you want these policies (review carefully)
--
-- Buckets (private):
--   - builder-photos
--   - builder-pdfs
--
-- Path rules:
--   photos: {project_id}/{thread_id}/{photo_id}/{file_name}
--   pdf:    {project_id}/{thread_id}/{pdf_id}/{kind}.pdf
--
-- Notes:
-- - Do NOT make buckets public.
-- - Prefer signed_url via Edge Function after DB authorization check.
-- - These Storage policies implement the same project-scope checks as DB RLS by parsing
--   project_id from object.name (first path segment).
-- - If you later enforce "signed_url only", you can tighten SELECT here further.

-- ------------------------------------------------------------
-- Bucket creation (draft)
-- ------------------------------------------------------------
-- create bucket rows (private)
-- insert into storage.buckets (id, name, public)
-- values ('builder-photos', 'builder-photos', false)
-- on conflict (id) do nothing;
--
-- insert into storage.buckets (id, name, public)
-- values ('builder-pdfs', 'builder-pdfs', false)
-- on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Storage policy strategy (draft)
-- ------------------------------------------------------------
-- This file assumes "Option B" (direct client access) but still recommends signed_url.
-- Policies use helper functions from sql/builder-rls-policies.sql:
--   - builder_can_read_project(uuid)
--   - builder_is_project_owner(uuid)
--   - builder_is_selected_partner(uuid)
--   - builder_is_admin()

-- Access boundaries:
-- - admin: all paths read/write
-- - owner: own-project paths read/write
-- - selected partner: upload/read PHOTOS for selected projects
-- - partner: read-only for applied projects
-- - pdf upload: owner/admin only
-- - pdf read: any user who can read project

-- Pseudocode helpers:
-- - Extract project_id from object.name:
--     split_part(name, '/', 1)::uuid  -- assumes first segment is project_id
-- - Validate by calling DB helper:
--     public.builder_can_read_project(project_id)
-- etc.

-- ------------------------------------------------------------
-- Policies on storage.objects (DRAFT)
-- ------------------------------------------------------------
-- Storage tables:
--   storage.objects(bucket_id text, name text, owner uuid, ...)
--
-- IMPORTANT:
-- - Using split_part(name,'/',1)::uuid will throw if not uuid.
--   Ensure your app/migration always writes uuid-based paths.
-- - If you need to support legacy IDs, store under a uuid-mapped project_id in path.

-- READ (photos + pdf): users who can read project
create policy "builder_storage_read_project_scoped"
on storage.objects
for select
using (
  public.builder_is_admin()
  or (
    bucket_id in ('builder-photos', 'builder-pdfs')
    and public.builder_can_read_project(split_part(name, '/', 1)::uuid)
  )
);

-- UPLOAD photos: selected partner OR project owner OR admin
create policy "builder_storage_upload_photos_selected_or_owner"
on storage.objects
for insert
with check (
  public.builder_is_admin()
  or (
    bucket_id = 'builder-photos'
    and (
      public.builder_is_project_owner(split_part(name, '/', 1)::uuid)
      or public.builder_is_selected_partner(split_part(name, '/', 1)::uuid)
    )
  )
);

-- UPLOAD pdf: project owner OR admin (partners cannot upload)
create policy "builder_storage_upload_pdfs_owner_only"
on storage.objects
for insert
with check (
  public.builder_is_admin()
  or (
    bucket_id = 'builder-pdfs'
    and public.builder_is_project_owner(split_part(name, '/', 1)::uuid)
  )
);

-- UPDATE/DELETE: project owner OR admin
-- (tighten if needed: only allow same uploader, etc.)
create policy "builder_storage_update_project_owner"
on storage.objects
for update
using (
  public.builder_is_admin()
  or (
    bucket_id in ('builder-photos', 'builder-pdfs')
    and public.builder_is_project_owner(split_part(name, '/', 1)::uuid)
  )
)
with check (
  public.builder_is_admin()
  or (
    bucket_id in ('builder-photos', 'builder-pdfs')
    and public.builder_is_project_owner(split_part(name, '/', 1)::uuid)
  )
);

create policy "builder_storage_delete_project_owner"
on storage.objects
for delete
using (
  public.builder_is_admin()
  or (
    bucket_id in ('builder-photos', 'builder-pdfs')
    and public.builder_is_project_owner(split_part(name, '/', 1)::uuid)
  )
);

-- ------------------------------------------------------------
-- Signed URL flow (recommended)
-- ------------------------------------------------------------
-- 1) client requests Edge Function: bucket + path + expiresIn
-- 2) Edge Function:
--    - verifies JWT (user context)
--    - extracts project_id from path
--    - checks DB authorization (builder_can_read_project / owner / selected partner)
--    - if OK, calls Storage.createSignedUrl(bucket, path, expiresIn)
-- 3) client uses signed_url to download

-- ------------------------------------------------------------
-- Migration note (MVP)
-- ------------------------------------------------------------
-- MVP export may contain data URLs for photos/pdf.
-- Migration should upload binaries to Storage and store:
-- - storage_bucket
-- - storage_path
-- - (optionally) public_url or signed_url (usually derived at runtime)

