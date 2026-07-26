-- =============================================================================
-- ANPI Phase 15 — TALK Identity Namespace Mapping Foundation (schema)
-- Target: staging project ref ahlxuyvhzqdqaojiywmu ONLY
-- =============================================================================
-- Canonical identity chain (Phase 14 confirmed mismatch → this Phase):
--
--   auth.users.id (uuid)
--     → anpi_user_contexts.auth_user_id
--     → anpi_user_contexts.talk_user_id   (= JWT app_metadata.talk_user_id)
--     → talk_notifications.user_id
--
-- Phase 10 writer compatibility (DO NOT break anpi_resolve_talk_user_id):
--   lookup:  where anpi_user_id = auth_uid_text
--   return:  member_id  (= talk_user_id)
--
-- Reader parity:
--   talk_current_user_id() prefers JWT talk_user_id / member_id over sub
--
-- This package:
--   - CREATE TABLE IF NOT EXISTS public.anpi_user_contexts (lean + Phase10 keys)
--   - CREATE/REPLACE public.anpi_resolve_talk_user_id(uuid) (Phase 10 SSOT)
--   - Hardened RLS (no *_dev / no public write / no authenticated write)
--   - Privilege revoke of default-ACL residue (Phase 14 pattern)
--   - Does NOT insert mapping rows (seed is a separate reviewed package)
--   - Does NOT touch talk_notifications rows / Realtime / Push / real mode
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Mapping table
-- ---------------------------------------------------------------------------
create table if not exists public.anpi_user_contexts (
  id uuid primary key default gen_random_uuid(),

  -- Phase 15 canonical columns
  auth_user_id uuid not null,
  talk_user_id text not null,

  -- Phase 10 resolver compatibility (mirrors)
  anpi_user_id text not null,   -- = auth_user_id::text
  member_id text not null,      -- = talk_user_id (TALK inbox recipient)

  -- Lean legacy columns (sql/anpi-user-context.sql shape; LINE OAuth omitted)
  user_id text not null,        -- TASFUL user id in TALK namespace (= talk_user_id)
  contract_holder_id text not null default '',
  contract_holder_name text not null default '',
  user_name text not null default '',
  notification_level text not null default 'call_only',
  notification_method text not null default 'tasful_chat',
  notify_channels jsonb not null default '["tasful_chat"]'::jsonb,
  line_notification_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,

  mapping_source text not null default 'app_metadata.talk_user_id',
  mapping_status text not null default 'candidate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint anpi_user_contexts_auth_user_id_unique unique (auth_user_id),
  constraint anpi_user_contexts_anpi_user_id_unique unique (anpi_user_id),
  constraint anpi_user_contexts_user_id_unique unique (user_id),
  constraint anpi_user_contexts_talk_user_id_nonempty
    check (char_length(trim(talk_user_id)) > 0),
  constraint anpi_user_contexts_member_matches_talk
    check (member_id = talk_user_id),
  constraint anpi_user_contexts_anpi_matches_auth
    check (anpi_user_id = auth_user_id::text)
);

comment on table public.anpi_user_contexts is
  'ANPI↔TALK identity mapping. Phase 15 foundation. Writer uses anpi_user_id→member_id; canonical auth_user_id→talk_user_id.';
comment on column public.anpi_user_contexts.auth_user_id is 'auth.users.id (uuid)';
comment on column public.anpi_user_contexts.talk_user_id is 'TALK inbox recipient (= JWT talk_user_id claim)';
comment on column public.anpi_user_contexts.anpi_user_id is 'Phase 10 lookup key (= auth_user_id::text)';
comment on column public.anpi_user_contexts.member_id is 'Phase 10 return value (= talk_user_id)';

create index if not exists anpi_user_contexts_talk_user_id_idx
  on public.anpi_user_contexts (talk_user_id)
  where talk_user_id is not null and talk_user_id <> '';

create index if not exists anpi_user_contexts_member_id_idx
  on public.anpi_user_contexts (member_id)
  where member_id is not null and member_id <> '';

create index if not exists anpi_user_contexts_anpi_user_id_idx
  on public.anpi_user_contexts (anpi_user_id)
  where anpi_user_id is not null and anpi_user_id <> '';

create index if not exists anpi_user_contexts_updated_at_desc_idx
  on public.anpi_user_contexts (updated_at desc);

-- ---------------------------------------------------------------------------
-- 2) Phase 10 identity resolver (service_role only) — staging foundation
-- ---------------------------------------------------------------------------
create or replace function public.anpi_resolve_talk_user_id(p_auth_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member text;
  v_uid text;
begin
  if p_auth_user_id is null then
    raise exception using errcode = '22023', message = 'anpi_talk_identity_unresolved';
  end if;

  v_uid := p_auth_user_id::text;

  if to_regclass('public.anpi_user_contexts') is not null then
    begin
      execute
        'select nullif(trim(member_id), '''') '
        || 'from public.anpi_user_contexts '
        || 'where anpi_user_id = $1 and coalesce(nullif(trim(member_id), ''''), '''') <> '''' '
        || 'order by updated_at desc nulls last limit 1'
      into v_member
      using v_uid;
    exception when others then
      v_member := null;
    end;
  end if;

  return coalesce(v_member, v_uid);
end;
$$;

comment on function public.anpi_resolve_talk_user_id(uuid) is
  'Service-only ANPI->TALK identity mapping. member_id (if mapped) else auth uid text. Fail-closed on null.';

revoke all on function public.anpi_resolve_talk_user_id(uuid) from public, anon, authenticated;
grant execute on function public.anpi_resolve_talk_user_id(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3) RLS — hardened (no *_dev / no authenticated write)
-- ---------------------------------------------------------------------------
alter table public.anpi_user_contexts enable row level security;

drop policy if exists "anpi_user_contexts_select_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_insert_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_update_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_delete_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_select_phase15" on public.anpi_user_contexts;

-- Own-row read only (identity introspection). Writes: service_role bypass only.
create policy "anpi_user_contexts_select_phase15"
  on public.anpi_user_contexts
  for select
  to authenticated
  using (
    auth_user_id = auth.uid()
    or anpi_user_id = auth.uid()::text
    or (
      to_regprocedure('public.talk_current_user_id()') is not null
      and member_id = public.talk_current_user_id()
    )
  );

-- Explicitly NO insert/update/delete policies for authenticated/anon.

-- ---------------------------------------------------------------------------
-- 4) Grants — least privilege (undo default-ACL residue)
-- ---------------------------------------------------------------------------
revoke all on table public.anpi_user_contexts from public;
revoke all on table public.anpi_user_contexts from anon;
revoke all on table public.anpi_user_contexts from authenticated;
grant select on table public.anpi_user_contexts to authenticated;
grant all on table public.anpi_user_contexts to service_role;

-- ---------------------------------------------------------------------------
-- 5) Post-apply sanity (read-only)
-- ---------------------------------------------------------------------------
select
  to_regclass('public.anpi_user_contexts') is not null as table_exists,
  to_regprocedure('public.anpi_resolve_talk_user_id(uuid)') is not null as resolve_fn_exists,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'anpi_user_contexts') as column_count,
  (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'anpi_user_contexts') as rls_enabled,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'anpi_user_contexts'
       and policyname like '%_dev') as leftover_dev_policies,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'anpi_user_contexts'
       and cmd = 'INSERT') as insert_policies,
  has_table_privilege('authenticated', 'public.anpi_user_contexts', 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', 'public.anpi_user_contexts', 'SELECT') as authenticated_select,
  has_table_privilege('service_role', 'public.anpi_user_contexts', 'INSERT') as service_role_insert,
  (select count(*) from public.anpi_user_contexts) as mapping_row_count;
