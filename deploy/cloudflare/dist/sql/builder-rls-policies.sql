-- Builder Supabase RLS policies (DESIGN ONLY)
-- This file is a *proposal* to be reviewed before execution.
--
-- IMPORTANT:
-- - Do NOT run blindly. Verify JWT claims wiring and auth model first.
-- - RLS policies depend on "actor_id/actor_type/partner_id/owner_id" claims.
-- - In Supabase, JWT claims are typically available via:
--     current_setting('request.jwt.claims', true)::jsonb
--   or auth.jwt() depending on environment. This file uses current_setting.
--
-- Claims (assumed for now):
-- - actor_id:   string (uuid or legacy id)
-- - actor_type: 'owner' | 'partner' | 'admin'
-- - partner_id: uuid (when actor_type='partner')
-- - owner_id:   string (when actor_type='owner')  -- matches builder_projects.owner_id (text)
--
-- selected_partner_ids is NOT used as source of truth in Supabase.
-- Hiring state is defined by builder_project_applications.status = 'selected'.
--
-- ---------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER) ---------------------------------
-- ---------------------------------------------------------------------

create or replace function public.builder_jwt_claim(claim text)
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim;
$$;

create or replace function public.builder_current_actor_id()
returns text
language sql
stable
as $$
  select coalesce(public.builder_jwt_claim('actor_id'), '');
$$;

create or replace function public.builder_current_actor_type()
returns text
language sql
stable
as $$
  select coalesce(public.builder_jwt_claim('actor_type'), '');
$$;

create or replace function public.builder_current_partner_id()
returns uuid
language sql
stable
as $$
  select nullif(public.builder_jwt_claim('partner_id'), '')::uuid;
$$;

create or replace function public.builder_current_owner_id()
returns text
language sql
stable
as $$
  select coalesce(public.builder_jwt_claim('owner_id'), '');
$$;

create or replace function public.builder_is_admin()
returns boolean
language sql
stable
as $$
  select public.builder_current_actor_type() = 'admin';
$$;

create or replace function public.builder_is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.builder_is_admin()
    or (
      public.builder_current_actor_type() = 'owner'
      and exists (
        select 1
        from public.builder_projects p
        where p.id = p_project_id
          and p.owner_id = public.builder_current_owner_id()
      )
    );
$$;

create or replace function public.builder_has_applied_to_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.builder_is_admin()
    or (
      public.builder_current_actor_type() = 'partner'
      and exists (
        select 1
        from public.builder_project_applications a
        where a.project_id = p_project_id
          and a.partner_id = public.builder_current_partner_id()
      )
    );
$$;

create or replace function public.builder_is_selected_partner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.builder_is_admin()
    or (
      public.builder_current_actor_type() = 'partner'
      and exists (
        select 1
        from public.builder_project_applications a
        where a.project_id = p_project_id
          and a.partner_id = public.builder_current_partner_id()
          and a.status = 'selected'
      )
    );
$$;

create or replace function public.builder_can_read_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.builder_is_admin()
    or public.builder_is_project_owner(p_project_id)
    or public.builder_has_applied_to_project(p_project_id)
    or exists (
      select 1
      from public.builder_projects p
      where p.id = p_project_id
        and (
          p.visibility = 'public'
          or (public.builder_current_actor_type() = 'partner' and p.visibility = 'partner_only')
        )
    );
$$;

-- ---------------------------------------------------------------------
-- Enable RLS (design) -------------------------------------------------
-- ---------------------------------------------------------------------

alter table public.builder_partners enable row level security;
alter table public.builder_projects enable row level security;
alter table public.builder_project_applications enable row level security;
alter table public.builder_threads enable row level security;
alter table public.builder_messages enable row level security;
alter table public.builder_thread_events enable row level security;
alter table public.builder_thread_photos enable row level security;
alter table public.builder_completion_reports enable row level security;
alter table public.builder_invoice_meta enable row level security;
alter table public.builder_pdf_outputs enable row level security;
alter table public.builder_notifications enable row level security;

-- ---------------------------------------------------------------------
-- Policies ------------------------------------------------------------
-- ---------------------------------------------------------------------

-- builder_partners
-- - admin: full
-- - partner: can read own partner row (by claim partner_id)
create policy builder_partners_select
on public.builder_partners
for select
using (
  public.builder_is_admin()
  or (public.builder_current_actor_type() = 'partner' and id = public.builder_current_partner_id())
);

-- builder_projects
-- - admin: full
-- - owner: CRUD own projects (delete disabled here)
-- - partner: can read public/partner_only OR projects applied to
create policy builder_projects_select
on public.builder_projects
for select
using (public.builder_can_read_project(id));

create policy builder_projects_insert
on public.builder_projects
for insert
with check (
  public.builder_is_admin()
  or (public.builder_current_actor_type() = 'owner' and owner_id = public.builder_current_owner_id())
);

create policy builder_projects_update
on public.builder_projects
for update
using (public.builder_is_admin() or owner_id = public.builder_current_owner_id())
with check (public.builder_is_admin() or owner_id = public.builder_current_owner_id());

-- Optional: disable delete for owner for now (admin only)
create policy builder_projects_delete_admin_only
on public.builder_projects
for delete
using (public.builder_is_admin());

-- builder_project_applications
-- - admin: full
-- - partner: insert/select own
-- - owner: can select project-scoped; can update status for hiring
create policy builder_applications_select
on public.builder_project_applications
for select
using (
  public.builder_is_admin()
  or (public.builder_current_actor_type() = 'partner' and partner_id = public.builder_current_partner_id())
  or public.builder_is_project_owner(project_id)
);

create policy builder_applications_insert_partner
on public.builder_project_applications
for insert
with check (
  public.builder_is_admin()
  or (
    public.builder_current_actor_type() = 'partner'
    and partner_id = public.builder_current_partner_id()
    and status = 'applied'
  )
);

create policy builder_applications_update_owner_hiring
on public.builder_project_applications
for update
using (
  public.builder_is_admin()
  or public.builder_is_project_owner(project_id)
)
with check (
  public.builder_is_admin()
  or public.builder_is_project_owner(project_id)
);

-- builder_threads (read project-scoped; create by owner/admin)
create policy builder_threads_select
on public.builder_threads
for select
using (public.builder_can_read_project(project_id));

create policy builder_threads_insert
on public.builder_threads
for insert
with check (public.builder_is_admin() or public.builder_is_project_owner(project_id));

-- builder_messages
-- - read: project-scoped
-- - insert: if admin OR owner of project OR partner has applied
create policy builder_messages_select
on public.builder_messages
for select
using (public.builder_can_read_project(project_id));

create policy builder_messages_insert
on public.builder_messages
for insert
with check (
  public.builder_is_admin()
  or public.builder_is_project_owner(project_id)
  or public.builder_has_applied_to_project(project_id)
);

-- builder_thread_events
-- - read: project-scoped
-- - insert control by event type (see comments)
create policy builder_events_select
on public.builder_thread_events
for select
using (public.builder_can_read_project(project_id));

-- Minimal insert policy: allow based on type
create policy builder_events_insert
on public.builder_thread_events
for insert
with check (
  public.builder_is_admin()
  or (
    type in ('applied')
    and public.builder_current_actor_type() = 'partner'
    and public.builder_has_applied_to_project(project_id) -- after application insert, allowed
  )
  or (
    type in ('selected','rejected','invoice_updated','invoice_finalized','invoice_finalized_locked','invoiced')
    and public.builder_is_project_owner(project_id)
  )
  or (
    type in ('check_in','check_out','completed','completion_updated','photo')
    and public.builder_is_selected_partner(project_id)
  )
  or (
    type in ('message','pdf')
    and (
      public.builder_is_project_owner(project_id)
      or public.builder_has_applied_to_project(project_id)
    )
  )
);

-- builder_thread_photos
create policy builder_photos_select
on public.builder_thread_photos
for select
using (public.builder_can_read_project(project_id));

create policy builder_photos_insert
on public.builder_thread_photos
for insert
with check (public.builder_is_admin() or public.builder_is_selected_partner(project_id));

-- builder_completion_reports
create policy builder_reports_select
on public.builder_completion_reports
for select
using (public.builder_can_read_project(project_id));

create policy builder_reports_insert_update
on public.builder_completion_reports
for all
using (public.builder_is_admin() or public.builder_is_selected_partner(project_id))
with check (public.builder_is_admin() or public.builder_is_selected_partner(project_id));

-- builder_invoice_meta (owner/admin only write; partner read-only)
create policy builder_invoice_meta_select
on public.builder_invoice_meta
for select
using (public.builder_can_read_project(project_id));

create policy builder_invoice_meta_write
on public.builder_invoice_meta
for insert
with check (public.builder_is_admin() or public.builder_is_project_owner(project_id));

create policy builder_invoice_meta_update
on public.builder_invoice_meta
for update
using (public.builder_is_admin() or public.builder_is_project_owner(project_id))
with check (public.builder_is_admin() or public.builder_is_project_owner(project_id));

-- builder_pdf_outputs (owner/admin create; partner read-only)
create policy builder_pdf_outputs_select
on public.builder_pdf_outputs
for select
using (public.builder_can_read_project(project_id));

create policy builder_pdf_outputs_insert
on public.builder_pdf_outputs
for insert
with check (public.builder_is_admin() or public.builder_is_project_owner(project_id));

-- builder_notifications (read project-scoped; write server-side/admin)
create policy builder_notifications_select
on public.builder_notifications
for select
using (
  public.builder_is_admin()
  or (project_id is not null and public.builder_can_read_project(project_id))
);

create policy builder_notifications_insert_admin
on public.builder_notifications
for insert
with check (public.builder_is_admin());

-- NOTE:
-- The above policies are intentionally simplified. Before execution:
-- - confirm claim names and types
-- - confirm whether partner_id maps to builder_partners.id
-- - confirm owner_id mapping
-- - consider separate membership tables (users↔partners/owners)
-- - consider moving notifications insert to service role only

