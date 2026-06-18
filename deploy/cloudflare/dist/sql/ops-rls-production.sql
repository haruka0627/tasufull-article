-- TASFUL 運営系 — 本番 RLS（Support / AI運営 / Builder評価 / TALK運営秘書）
--
-- 適用順:
--   1) staging-phase2-ops-schema.sql（未適用時）
--   2) ops-rls-drop-dev-policies.sql
--   3) 本ファイル
--
-- JWT: tasu_admin / ops_admin のみ運営テーブル read/write。anon・一般会員は deny。
-- DELETE: authenticated には付与しない（service_role / Edge Function のみ）。

-- ---------------------------------------------------------------------------
-- ヘルパー関数
-- ---------------------------------------------------------------------------
create or replace function public.tasu_current_member_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(
    trim(
      coalesce(
        auth.jwt() ->> 'member_id',
        auth.jwt() -> 'app_metadata' ->> 'member_id',
        auth.jwt() -> 'user_metadata' ->> 'member_id',
        auth.jwt() ->> 'sub',
        auth.uid()::text
      )
    ),
    ''
  );
$$;

comment on function public.tasu_current_member_id() is 'RLS: 現在会員 ID（JWT member_id / sub / auth.uid）';

create or replace function public.tasu_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'role', '') in ('tasu_admin', 'service_role', 'supabase_admin')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('tasu_admin', 'admin')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('tasu_admin', 'admin')
    or coalesce(auth.jwt() ->> 'tasu_admin', '') = 'true'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'tasu_admin', '') = 'true';
$$;

comment on function public.tasu_is_admin() is 'RLS: tasu_admin / admin ロール';

create or replace function public.tasu_is_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.tasu_is_admin()
    or coalesce(auth.jwt() ->> 'role', '') in ('ops_admin', 'tasu_ops_admin')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('ops_admin', 'tasu_ops_admin')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('ops_admin', 'tasu_ops_admin')
    or coalesce(auth.jwt() ->> 'ops_admin', '') = 'true';
$$;

comment on function public.tasu_is_ops_admin() is 'RLS: 運営管理者（tasu_admin + ops_admin）';

create or replace function public.tasu_can_manage_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tasu_is_ops_admin();
$$;

comment on function public.tasu_can_manage_ops() is 'RLS: 運営テーブル read/write 可否';

-- ---------------------------------------------------------------------------
-- updated_at 自動更新
-- ---------------------------------------------------------------------------
create or replace function public.ops_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.ops_set_updated_at();

drop trigger if exists connect_issues_set_updated_at on public.connect_issues;
create trigger connect_issues_set_updated_at
  before update on public.connect_issues
  for each row execute function public.ops_set_updated_at();

drop trigger if exists ai_ops_cases_set_updated_at on public.ai_ops_cases;
create trigger ai_ops_cases_set_updated_at
  before update on public.ai_ops_cases
  for each row execute function public.ops_set_updated_at();

drop trigger if exists builder_partner_visibility_set_updated_at on public.builder_partner_visibility;
create trigger builder_partner_visibility_set_updated_at
  before update on public.builder_partner_visibility
  for each row execute function public.ops_set_updated_at();

-- TALK運営秘書 — update 方針用カラム（Phase 5 JS から利用予定）
alter table public.talk_ops_messages
  add column if not exists read_at timestamptz,
  add column if not exists notification_synced boolean not null default false,
  add column if not exists summary_generated boolean not null default false;

-- ---------------------------------------------------------------------------
-- RLS ポリシー（authenticated + tasu_can_manage_ops のみ）
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  allow_update boolean;
  tables_cfg jsonb := '[
    {"t":"support_tickets","u":true},
    {"t":"support_events","u":false},
    {"t":"connect_issues","u":true},
    {"t":"support_admin_notifications","u":true},
    {"t":"ai_ops_cases","u":true},
    {"t":"ai_ops_events","u":false},
    {"t":"ai_ops_admin_notifications","u":true},
    {"t":"builder_partner_evaluations","u":false},
    {"t":"builder_partner_status_events","u":false},
    {"t":"builder_partner_visibility","u":true},
    {"t":"talk_ops_messages","u":true}
  ]'::jsonb;
  rec jsonb;
begin
  for rec in select * from jsonb_array_elements(tables_cfg)
  loop
    t := rec ->> 't';
    allow_update := coalesce((rec ->> 'u')::boolean, false);

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "ops_%s_select_admin" on public.%I', t, t);
    execute format('drop policy if exists "ops_%s_insert_admin" on public.%I', t, t);
    execute format('drop policy if exists "ops_%s_update_admin" on public.%I', t, t);
    execute format('drop policy if exists "ops_%s_delete_admin" on public.%I', t, t);

    execute format(
      'create policy "ops_%s_select_admin" on public.%I for select to authenticated using (public.tasu_can_manage_ops())',
      t, t
    );
    execute format(
      'create policy "ops_%s_insert_admin" on public.%I for insert to authenticated with check (public.tasu_can_manage_ops())',
      t, t
    );

    if allow_update then
      execute format(
        'create policy "ops_%s_update_admin" on public.%I for update to authenticated using (public.tasu_can_manage_ops()) with check (public.tasu_can_manage_ops())',
        t, t
      );
    end if;
  end loop;
end $$;

-- anon: ポリシーなし → deny
-- delete: ポリシーなし → authenticated は deny（service_role は RLS バイパス）
