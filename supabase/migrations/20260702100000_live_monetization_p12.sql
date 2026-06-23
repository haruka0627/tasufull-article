-- TASFUL LIVE → YouTube型 P1 Phase 12 — monetization / ad RPM / audit logs
-- Ref: TLV Phase 12 — DB + Edge Function monetization
--
-- Prerequisite:
--   - sql/talk-rls-production.sql (talk_current_user_id / talk_is_admin)
--   - supabase/migrations/20260628100000_live_p0_schema.sql
--
-- Apply: staging only · individual SQL (NOT supabase db push)
--   npx supabase db query --linked -f supabase/migrations/20260702100000_live_monetization_p12.sql
--
-- NOTE: user_id / actor_id / reviewed_by use text talk_user_id (e.g. 'u_store'),
--       matching live_creator_profiles.user_id and live_videos.talk_user_id.

-- ---------------------------------------------------------------------------
-- T-11 live_creator_monetization
-- ---------------------------------------------------------------------------

create table if not exists public.live_creator_monetization (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  status text not null default 'not_applied',
  note text,
  applied_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_creator_monetization_user_fk
    foreign key (user_id) references public.live_creator_profiles (user_id)
    on delete cascade,
  constraint live_creator_monetization_status_chk
    check (status in ('not_applied', 'pending', 'approved', 'rejected', 'suspended'))
);

comment on table public.live_creator_monetization is
  'Creator monetization application / review status (TLV Phase 12)';
comment on column public.live_creator_monetization.user_id is
  'talk_user_id · FK to live_creator_profiles.user_id';

create index if not exists live_creator_monetization_status_idx
  on public.live_creator_monetization (status, applied_at desc nulls last);

-- ---------------------------------------------------------------------------
-- T-12 live_ad_rpm_settings
-- ---------------------------------------------------------------------------

create table if not exists public.live_ad_rpm_settings (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global',
  target_id uuid,
  rpm_yen numeric not null default 100,
  active boolean not null default true,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_ad_rpm_settings_scope_chk
    check (scope in ('global', 'ad', 'video')),
  constraint live_ad_rpm_settings_rpm_yen_chk
    check (rpm_yen >= 0)
);

comment on table public.live_ad_rpm_settings is
  'Ad RPM settings · global default or per-ad override (TLV Phase 12)';

create unique index if not exists live_ad_rpm_settings_global_active_uidx
  on public.live_ad_rpm_settings (scope)
  where scope = 'global' and active = true;

create unique index if not exists live_ad_rpm_settings_ad_target_uidx
  on public.live_ad_rpm_settings (scope, target_id)
  where scope = 'ad' and target_id is not null;

-- ---------------------------------------------------------------------------
-- T-13 live_monetization_audit_logs
-- ---------------------------------------------------------------------------

create table if not exists public.live_monetization_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text,
  target_user_id text,
  action text not null,
  before_status text,
  after_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint live_monetization_audit_logs_action_chk
    check (action in ('apply', 'approve', 'reject', 'suspend', 'resume', 'save_note', 'update_rpm', 'create_rpm'))
);

comment on table public.live_monetization_audit_logs is
  'Monetization / RPM audit trail · inserts via Edge Function or SECURITY DEFINER trigger';

create index if not exists live_monetization_audit_logs_target_idx
  on public.live_monetization_audit_logs (target_user_id, created_at desc);

create index if not exists live_monetization_audit_logs_action_idx
  on public.live_monetization_audit_logs (action, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists live_creator_monetization_set_updated_at on public.live_creator_monetization;
create trigger live_creator_monetization_set_updated_at
  before update on public.live_creator_monetization
  for each row execute function public.live_set_updated_at();

drop trigger if exists live_ad_rpm_settings_set_updated_at on public.live_ad_rpm_settings;
create trigger live_ad_rpm_settings_set_updated_at
  before update on public.live_ad_rpm_settings
  for each row execute function public.live_set_updated_at();

-- ---------------------------------------------------------------------------
-- Owner apply guard + apply audit (creator dashboard)
-- ---------------------------------------------------------------------------

create or replace function public.live_creator_monetization_guard_owner_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.talk_is_admin() then
    return new;
  end if;

  if new.user_id is distinct from public.talk_current_user_id() then
    raise exception 'live_creator_monetization: forbidden user_id';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'live_creator_monetization: creators may only apply with status pending';
    end if;
    if new.applied_at is null then
      new.applied_at := now();
    end if;
    return new;
  end if;

  if new.status <> 'pending' then
    raise exception 'live_creator_monetization: creators may only set status to pending';
  end if;

  if old.status not in ('not_applied', 'rejected') then
    raise exception 'live_creator_monetization: duplicate application not allowed (status=%)', old.status;
  end if;

  if new.applied_at is null then
    new.applied_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.live_monetization_audit_on_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.live_monetization_audit_logs (
      actor_id,
      target_user_id,
      action,
      before_status,
      after_status,
      note,
      metadata
    ) values (
      coalesce(public.talk_current_user_id(), new.user_id),
      new.user_id,
      'apply',
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      new.note,
      jsonb_build_object('source_page', 'creator_dashboard', 'intent', 'apply')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists live_creator_monetization_guard_owner_update on public.live_creator_monetization;
create trigger live_creator_monetization_guard_owner_update
  before insert or update on public.live_creator_monetization
  for each row execute function public.live_creator_monetization_guard_owner_update();

drop trigger if exists live_monetization_audit_on_apply on public.live_creator_monetization;
create trigger live_monetization_audit_on_apply
  after insert or update on public.live_creator_monetization
  for each row execute function public.live_monetization_audit_on_apply();

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------

grant select, insert, update on public.live_creator_monetization to authenticated;
grant select on public.live_ad_rpm_settings to authenticated;
grant select on public.live_monetization_audit_logs to authenticated;

revoke all on public.live_creator_monetization from anon;
revoke all on public.live_ad_rpm_settings from anon;
revoke all on public.live_monetization_audit_logs from anon;

revoke insert, update, delete on public.live_monetization_audit_logs from authenticated;

alter table public.live_creator_monetization enable row level security;
alter table public.live_ad_rpm_settings enable row level security;
alter table public.live_monetization_audit_logs enable row level security;

-- live_creator_monetization: owner read
drop policy if exists live_creator_monetization_select_owner on public.live_creator_monetization;
create policy live_creator_monetization_select_owner
  on public.live_creator_monetization
  for select to authenticated
  using (user_id = public.talk_current_user_id());

-- live_creator_monetization: owner apply (insert pending)
drop policy if exists live_creator_monetization_insert_owner on public.live_creator_monetization;
create policy live_creator_monetization_insert_owner
  on public.live_creator_monetization
  for insert to authenticated
  with check (
    user_id = public.talk_current_user_id()
    and status = 'pending'
  );

-- live_creator_monetization: owner re-apply (not_applied|rejected → pending)
drop policy if exists live_creator_monetization_update_owner on public.live_creator_monetization;
create policy live_creator_monetization_update_owner
  on public.live_creator_monetization
  for update to authenticated
  using (user_id = public.talk_current_user_id())
  with check (
    user_id = public.talk_current_user_id()
    and status = 'pending'
  );

-- live_creator_monetization: admin full
drop policy if exists live_creator_monetization_admin_all on public.live_creator_monetization;
create policy live_creator_monetization_admin_all
  on public.live_creator_monetization
  for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- live_ad_rpm_settings: read active for all authenticated
drop policy if exists live_ad_rpm_settings_select_active on public.live_ad_rpm_settings;
create policy live_ad_rpm_settings_select_active
  on public.live_ad_rpm_settings
  for select to authenticated
  using (active = true or public.talk_is_admin());

-- live_ad_rpm_settings: admin write
drop policy if exists live_ad_rpm_settings_admin_write on public.live_ad_rpm_settings;
create policy live_ad_rpm_settings_admin_write
  on public.live_ad_rpm_settings
  for all to authenticated
  using (public.talk_is_admin())
  with check (public.talk_is_admin());

-- live_monetization_audit_logs: admin read only
drop policy if exists live_monetization_audit_logs_admin_select on public.live_monetization_audit_logs;
create policy live_monetization_audit_logs_admin_select
  on public.live_monetization_audit_logs
  for select to authenticated
  using (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- Seed global RPM default (100 yen / 1000 impressions)
-- ---------------------------------------------------------------------------

insert into public.live_ad_rpm_settings (scope, target_id, rpm_yen, active)
select 'global', null, 100, true
where not exists (
  select 1 from public.live_ad_rpm_settings
  where scope = 'global' and active = true
);
