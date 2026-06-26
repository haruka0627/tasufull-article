-- Builder AI drafts — STAGING ONLY
-- =============================================================================
-- DO NOT EXECUTE ON PRODUCTION
-- Apply only to staging Supabase after review (P2-C or dedicated staging window).
-- =============================================================================
--
-- Purpose:
--   Persist Builder AI outputs as non-binding drafts (【下書き・確認用】 prefix required).
--   NOT for contracts, invoices, hiring, or completion approval.
--
-- JWT claims (app_metadata via custom_access_token_hook — extend in P2-C):
--   builder_actor_type : admin | owner | partner  (guest has no draft access)
--   builder_actor_id   : canonical actor id
--   builder_owner_id   : owner scope (matches builder_projects.owner_id text)
--   builder_partner_id : partner uuid or partner_key
--   is_ops / builder_is_admin : admin read-all
--
-- Related design: reports/builder-ai-jwt-rls-design.sql, sql/builder-rls-policies.sql

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.builder_ai_drafts (
  id            uuid primary key default gen_random_uuid(),

  project_id    text,
  thread_id     text,

  actor_type    text not null
    check (actor_type in ('admin', 'owner', 'partner')),
  actor_id      text not null,
  owner_id      text,
  partner_id    text,

  action        text not null,
  content       text not null,

  visibility    text not null default 'scoped'
    check (visibility in ('scoped', 'private', 'admin_only')),
  hidden        boolean not null default false,
  archived      boolean not null default false,
  is_draft      boolean not null default true,

  metadata      jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint builder_ai_drafts_content_draft check (
    content like '【下書き・確認用】%'
  ),
  constraint builder_ai_drafts_always_draft check (is_draft = true),
  constraint builder_ai_drafts_no_guest check (actor_type <> 'guest')
);

comment on table public.builder_ai_drafts is
  'Builder AI draft outputs only. Not legal/final documents. Staging table.';

create index if not exists idx_builder_ai_drafts_actor
  on public.builder_ai_drafts (actor_type, actor_id, created_at desc);

create index if not exists idx_builder_ai_drafts_project_active
  on public.builder_ai_drafts (project_id, created_at desc)
  where project_id is not null and hidden = false and archived = false;

create index if not exists idx_builder_ai_drafts_owner
  on public.builder_ai_drafts (owner_id, created_at desc)
  where owner_id is not null and archived = false;

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.builder_ai_drafts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_builder_ai_drafts_updated_at on public.builder_ai_drafts;
create trigger trg_builder_ai_drafts_updated_at
  before update on public.builder_ai_drafts
  for each row execute function public.builder_ai_drafts_set_updated_at();

-- Prevent content tampering after insert (draft integrity)
create or replace function public.builder_ai_drafts_immutable_content()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.content is distinct from old.content then
    raise exception 'builder_ai_drafts.content is immutable';
  end if;
  if tg_op = 'UPDATE' and new.is_draft is distinct from old.is_draft and new.is_draft = false then
    raise exception 'builder_ai_drafts cannot be promoted to non-draft';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_builder_ai_drafts_immutable on public.builder_ai_drafts;
create trigger trg_builder_ai_drafts_immutable
  before update on public.builder_ai_drafts
  for each row execute function public.builder_ai_drafts_immutable_content();

-- ---------------------------------------------------------------------------
-- 3. JWT helper functions (reuse builder-rls-policies pattern)
-- ---------------------------------------------------------------------------

create or replace function public.builder_ai_jwt_claim(claim text)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim,
    nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> claim,
    ''
  );
$$;

create or replace function public.builder_ai_current_actor_type()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(public.builder_ai_jwt_claim('builder_actor_type'), ''),
    nullif(public.builder_ai_jwt_claim('actor_type'), ''),
    ''
  );
$$;

create or replace function public.builder_ai_current_actor_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(public.builder_ai_jwt_claim('builder_actor_id'), ''),
    nullif(public.builder_ai_jwt_claim('actor_id'), ''),
    nullif(public.builder_ai_jwt_claim('sub'), ''),
    ''
  );
$$;

create or replace function public.builder_ai_current_owner_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(public.builder_ai_jwt_claim('builder_owner_id'), ''),
    nullif(public.builder_ai_jwt_claim('owner_id'), ''),
    ''
  );
$$;

create or replace function public.builder_ai_current_partner_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(public.builder_ai_jwt_claim('builder_partner_id'), ''),
    nullif(public.builder_ai_jwt_claim('partner_id'), ''),
    ''
  );
$$;

create or replace function public.builder_ai_is_admin()
returns boolean
language sql
stable
as $$
  select
    public.builder_ai_current_actor_type() = 'admin'
    or coalesce(public.builder_ai_jwt_claim('is_ops'), '') in ('true', 't', '1')
    or coalesce(public.builder_ai_jwt_claim('builder_is_admin'), '') in ('true', 't', '1');
$$;

-- project_id is project_key (text) in MVP / staging
create or replace function public.builder_ai_can_access_project(p_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_project_id is null
    or p_project_id = ''
    or public.builder_ai_is_admin()
    or (
      public.builder_ai_current_actor_type() = 'owner'
      and exists (
        select 1 from public.builder_projects bp
        where bp.project_key = p_project_id
          and bp.owner_id = public.builder_ai_current_owner_id()
      )
    )
    or (
      public.builder_ai_current_actor_type() = 'partner'
      and exists (
        select 1
        from public.builder_projects bp
        join public.builder_project_applications bpa on bpa.project_id = bp.id
        join public.builder_partners p on p.id = bpa.partner_id
        where bp.project_key = p_project_id
          and (
            p.partner_key = public.builder_ai_current_partner_id()
            or p.id::text = public.builder_ai_current_partner_id()
          )
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS (staging verification)
-- ---------------------------------------------------------------------------

alter table public.builder_ai_drafts enable row level security;

-- Guest: no policies → no access (FAQ-only AI, no draft persistence)

-- Admin: read all non-archived (include hidden for audit)
create policy builder_ai_drafts_admin_select on public.builder_ai_drafts
  for select using (
    public.builder_ai_is_admin()
  );

create policy builder_ai_drafts_admin_insert on public.builder_ai_drafts
  for insert with check (
    public.builder_ai_is_admin()
    and actor_type = 'admin'
    and actor_id = public.builder_ai_current_actor_id()
    and is_draft = true
    and content like '【下書き・確認用】%'
  );

create policy builder_ai_drafts_admin_update on public.builder_ai_drafts
  for update using (public.builder_ai_is_admin())
  with check (hidden in (true, false) and archived in (true, false));

-- Owner: own actor + project scope
create policy builder_ai_drafts_owner_select on public.builder_ai_drafts
  for select using (
    public.builder_ai_current_actor_type() = 'owner'
    and actor_type = 'owner'
    and actor_id = public.builder_ai_current_actor_id()
    and archived = false
    and public.builder_ai_can_access_project(project_id)
  );

create policy builder_ai_drafts_owner_insert on public.builder_ai_drafts
  for insert with check (
    public.builder_ai_current_actor_type() = 'owner'
    and actor_type = 'owner'
    and actor_id = public.builder_ai_current_actor_id()
    and (owner_id is null or owner_id = public.builder_ai_current_owner_id())
    and public.builder_ai_can_access_project(project_id)
    and is_draft = true
    and content like '【下書き・確認用】%'
  );

create policy builder_ai_drafts_owner_update on public.builder_ai_drafts
  for update using (
    public.builder_ai_current_actor_type() = 'owner'
    and actor_type = 'owner'
    and actor_id = public.builder_ai_current_actor_id()
    and public.builder_ai_can_access_project(project_id)
  )
  with check (hidden in (true, false));

-- Partner: participating project drafts only
create policy builder_ai_drafts_partner_select on public.builder_ai_drafts
  for select using (
    public.builder_ai_current_actor_type() = 'partner'
    and actor_type = 'partner'
    and actor_id = public.builder_ai_current_actor_id()
    and archived = false
    and public.builder_ai_can_access_project(project_id)
  );

create policy builder_ai_drafts_partner_insert on public.builder_ai_drafts
  for insert with check (
    public.builder_ai_current_actor_type() = 'partner'
    and actor_type = 'partner'
    and actor_id = public.builder_ai_current_actor_id()
    and public.builder_ai_can_access_project(project_id)
    and is_draft = true
    and content like '【下書き・確認用】%'
  );

create policy builder_ai_drafts_partner_update on public.builder_ai_drafts
  for update using (
    public.builder_ai_current_actor_type() = 'partner'
    and actor_type = 'partner'
    and actor_id = public.builder_ai_current_actor_id()
    and public.builder_ai_can_access_project(project_id)
  )
  with check (hidden in (true, false));

-- ---------------------------------------------------------------------------
-- 5. Staging verification queries (read-only smoke — run manually on staging)
-- ---------------------------------------------------------------------------
-- select count(*) from public.builder_ai_drafts;
-- set role authenticated; -- with JWT test harness
-- insert into public.builder_ai_drafts (...) values (...);
