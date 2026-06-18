-- Builder MVP → Supabase schema DDL (design only)
-- DO NOT EXECUTE in production without review.
-- RLS is intentionally NOT enabled here (next phase).
-- Storage buckets/policies are also next phase.

-- Recommended extensions (Supabase usually has these available)
-- create extension if not exists pgcrypto; -- for gen_random_uuid()

-- -------------------------------------------------------------------
-- Shared CHECK constraints are implemented inline (no CREATE TYPE).
-- Actor is denormalized for display:
--   actor_id / actor_type / actor_name
-- actor_type supports admin for operational actions.
-- -------------------------------------------------------------------

-- 1) builder_partners -------------------------------------------------
create table if not exists public.builder_partners (
  id uuid primary key default gen_random_uuid(),
  -- legacy/demo id (e.g. "demo-partner-001"), useful for migration mapping
  partner_key text unique,

  display_name text not null,
  partner_type text not null check (partner_type in ('company','individual')),

  trades text[] null,
  areas text[] null,

  headline text null,
  profile text null,

  contact_policy text null check (contact_policy in ('tasful_talk_only','owner_allowed','admin_only')),
  availability text null check (availability in ('available','limited','busy')),
  status text null check (status in ('active','paused')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists builder_partners_display_name_idx on public.builder_partners (display_name);

-- 2) builder_projects -------------------------------------------------
create table if not exists public.builder_projects (
  id uuid primary key default gen_random_uuid(),
  project_key text unique,

  owner_id text not null, -- future: fk to auth.users / builder_owners
  title text not null,

  kind text not null check (kind in ('builder_board','tasful_managed')),
  status text null,

  required_partners integer not null default 1 check (required_partners >= 1),
  -- NOTE (direction):
  --   selected_partner_ids is kept only for MVP/demo compatibility or as a denormalized cache.
  --   Source of truth for hiring state should be builder_project_applications.status='selected'.
  --   In production, consider removing this column entirely.
  selected_partner_ids uuid[] not null default '{}'::uuid[],

  visibility text null check (visibility in ('public','private','partner_only','team_only')),
  contact_policy text null check (contact_policy in ('tasful_talk_only','owner_allowed','admin_only')),
  source text null check (source in ('tasful','company','partner','public_user')),

  main_thread_id uuid null, -- fk added after threads table
  source_template_id uuid null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists builder_projects_source_idx on public.builder_projects (source);
create index if not exists builder_projects_visibility_idx on public.builder_projects (visibility);

-- 3) builder_project_applications ------------------------------------
create table if not exists public.builder_project_applications (
  id uuid primary key default gen_random_uuid(),
  application_key text unique,

  project_id uuid not null references public.builder_projects (id) on delete cascade,
  partner_id uuid not null references public.builder_partners (id) on delete cascade,

  status text not null check (status in ('applied','selected','rejected')),
  applied_at timestamptz not null,
  updated_at timestamptz null,

  created_at timestamptz not null default now()
);

create unique index if not exists builder_project_applications_unique_idx
  on public.builder_project_applications (project_id, partner_id);

-- 4) builder_threads --------------------------------------------------
create table if not exists public.builder_threads (
  id uuid primary key default gen_random_uuid(),
  thread_key text unique,

  project_id uuid not null references public.builder_projects (id) on delete cascade,

  created_at timestamptz not null default now()
);

create index if not exists builder_threads_project_id_idx on public.builder_threads (project_id);

-- FK from projects.main_thread_id -> threads.id (optional)
alter table public.builder_projects
  add constraint builder_projects_main_thread_fk
  foreign key (main_thread_id) references public.builder_threads (id)
  deferrable initially deferred;

-- 5) builder_messages -------------------------------------------------
create table if not exists public.builder_messages (
  id uuid primary key default gen_random_uuid(),
  msg_key text unique,

  thread_id uuid not null references public.builder_threads (id) on delete cascade,
  project_id uuid not null references public.builder_projects (id) on delete cascade,

  actor_id text not null,
  actor_type text not null check (actor_type in ('owner','partner','admin')),
  actor_name text not null,

  body text not null,
  created_at timestamptz not null,

  inserted_at timestamptz not null default now()
);

create index if not exists builder_messages_thread_created_at_idx
  on public.builder_messages (thread_id, created_at);

-- 6) builder_thread_events -------------------------------------------
create table if not exists public.builder_thread_events (
  id uuid primary key default gen_random_uuid(),
  event_key text unique,

  thread_id uuid not null references public.builder_threads (id) on delete cascade,
  project_id uuid not null references public.builder_projects (id) on delete cascade,

  type text not null check (
    type in (
      'created','applied','selected','rejected',
      'message',
      'check_in','check_out',
      'completed','completion_updated',
      'photo','pdf',
      'invoice_updated','invoice_finalized','invoice_finalized_locked',
      'invoiced'
    )
  ),

  actor_id text not null,
  actor_type text not null check (actor_type in ('owner','partner','admin')),
  actor_name text not null,

  body text null,
  created_at timestamptz not null,

  inserted_at timestamptz not null default now()
);

create index if not exists builder_thread_events_thread_created_at_idx
  on public.builder_thread_events (thread_id, created_at);

-- 7) builder_thread_photos -------------------------------------------
create table if not exists public.builder_thread_photos (
  id uuid primary key default gen_random_uuid(),
  photo_key text unique,

  thread_id uuid not null references public.builder_threads (id) on delete cascade,
  project_id uuid not null references public.builder_projects (id) on delete cascade,

  actor_id text not null,
  actor_type text not null check (actor_type in ('owner','partner','admin')),
  actor_name text not null,

  file_name text not null,
  caption text null,
  uploaded_at timestamptz not null,

  -- Storage migration target columns
  storage_bucket text null,
  storage_path text null,
  public_url text null,
  signed_url text null,
  signed_url_expires_at timestamptz null,

  mime_type text null,
  size_bytes bigint null,

  inserted_at timestamptz not null default now()
);

create index if not exists builder_thread_photos_thread_uploaded_at_idx
  on public.builder_thread_photos (thread_id, uploaded_at desc);

-- 8) builder_completion_reports --------------------------------------
create table if not exists public.builder_completion_reports (
  id uuid primary key default gen_random_uuid(),
  report_key text unique,

  thread_id uuid not null references public.builder_threads (id) on delete cascade,
  project_id uuid not null references public.builder_projects (id) on delete cascade,

  actor_id text not null,
  actor_type text not null check (actor_type in ('owner','partner','admin')),
  actor_name text not null,

  work_content text not null,
  note text null,
  extra_charge boolean not null default false,
  extra_charge_note text null,

  created_at timestamptz not null,
  updated_at timestamptz not null,

  inserted_at timestamptz not null default now()
);

create unique index if not exists builder_completion_reports_thread_unique_idx
  on public.builder_completion_reports (thread_id);

-- 9) builder_invoice_meta --------------------------------------------
create table if not exists public.builder_invoice_meta (
  id uuid primary key default gen_random_uuid(),
  invoice_meta_key text unique,

  thread_id uuid not null references public.builder_threads (id) on delete cascade,
  project_id uuid not null references public.builder_projects (id) on delete cascade,

  amount numeric null,
  note text not null default '',

  status text not null default 'draft' check (status in ('draft','updated','finalized')),
  updated_at timestamptz not null,

  finalized_at timestamptz null,
  finalized_by_actor_id text null,
  finalized_by_actor_type text null check (finalized_by_actor_type is null or finalized_by_actor_type in ('owner','partner','admin')),
  finalized_by_actor_name text null,

  inserted_at timestamptz not null default now()
);

create unique index if not exists builder_invoice_meta_thread_unique_idx
  on public.builder_invoice_meta (thread_id);

-- 10) builder_pdf_outputs --------------------------------------------
create table if not exists public.builder_pdf_outputs (
  id uuid primary key default gen_random_uuid(),
  pdf_key text unique,

  thread_id uuid not null references public.builder_threads (id) on delete cascade,
  project_id uuid not null references public.builder_projects (id) on delete cascade,

  kind text not null check (kind in ('completion_report','invoice')),
  label text not null,

  actor_id text not null,
  actor_type text not null check (actor_type in ('owner','partner','admin')),
  actor_name text not null,

  generated_at timestamptz not null,

  -- Storage migration target columns (PDF binary should live in Storage)
  storage_bucket text null,
  storage_path text null,
  public_url text null,
  signed_url text null,
  signed_url_expires_at timestamptz null,

  inserted_at timestamptz not null default now()
);

create index if not exists builder_pdf_outputs_thread_kind_generated_at_idx
  on public.builder_pdf_outputs (thread_id, kind, generated_at desc);

-- 11) builder_notifications ------------------------------------------
create table if not exists public.builder_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_key text unique,

  project_id uuid null references public.builder_projects (id) on delete set null,

  actor_id text not null,
  actor_type text not null check (actor_type in ('owner','partner','admin')),
  actor_name text not null,

  tone text not null check (tone in ('info','success','warning','danger')),
  title text not null,
  body text not null,

  created_at timestamptz not null,

  inserted_at timestamptz not null default now()
);

create index if not exists builder_notifications_project_created_at_idx
  on public.builder_notifications (project_id, created_at desc);

-- -------------------------------------------------------------------
-- RLS (next phase):
--   - enable row level security
--   - policies for owner/partner/admin boundaries (project-scoped)
--     * owner: CRUD own projects
--     * partner: SELECT projects they applied to; INSERT operational rows only when selected
--     * admin: allow all
-- Storage (next phase):
--   - create buckets and policies
--   - write back storage_path/public_url/signed_url
--
-- selected_partner_ids note:
--   - current DDL keeps builder_projects.selected_partner_ids (uuid[])
--   - recommended for production: replace with link table
--       builder_project_selected_partners(id, project_id, partner_id, status, created_at, updated_at)
--     or extend builder_project_applications to be the single source of truth.
-- -------------------------------------------------------------------

