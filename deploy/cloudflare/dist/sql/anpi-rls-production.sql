-- 安否 本番 RLS（P9-4）
-- 前提: anpi-user-context.sql / anpi-notification-logs.sql / anpi-identity-linking.sql 適用済み
--
-- 本番デプロイ時:
--   1) 本ファイルを実行
--   2) 末尾の「開発用ポリシー削除」を実行（dev ポリシーがあると全許可のままになる）
--
-- JWT に member_id（または sub）が入っている authenticated セッションを想定。
-- 管理者: app_metadata.role = 'tasu_admin' または JWT role = 'tasu_admin'

-- ---------------------------------------------------------------------------
-- ヘルパー関数
-- ---------------------------------------------------------------------------
create or replace function public.anpi_current_member_id()
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

comment on function public.anpi_current_member_id() is 'RLS 用: 現在ログイン会員 ID（JWT member_id / sub / auth.uid）';

create or replace function public.anpi_is_admin()
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
    or coalesce(auth.jwt() ->> 'tasu_admin', '') = 'true';
$$;

comment on function public.anpi_is_admin() is 'RLS 用: tasu_admin ロール判定';

create or replace function public.anpi_can_read_context_row(
  p_member_id text,
  p_contract_holder_id text,
  p_anpi_user_id text,
  p_user_id text
)
returns boolean
language sql
stable
as $$
  select
    public.anpi_is_admin()
    or (
      public.anpi_current_member_id() is not null
      and public.anpi_current_member_id() in (
        nullif(trim(p_member_id), ''),
        nullif(trim(p_contract_holder_id), ''),
        nullif(trim(p_anpi_user_id), ''),
        nullif(trim(p_user_id), '')
      )
    );
$$;

create or replace function public.anpi_can_write_context_row(
  p_member_id text,
  p_contract_holder_id text
)
returns boolean
language sql
stable
as $$
  select
    public.anpi_is_admin()
    or (
      public.anpi_current_member_id() is not null
      and public.anpi_current_member_id() in (
        nullif(trim(p_member_id), ''),
        nullif(trim(p_contract_holder_id), '')
      )
    );
$$;

create or replace function public.anpi_can_read_log_row(
  p_member_id text,
  p_contract_holder_id text,
  p_anpi_user_id text,
  p_user_id text
)
returns boolean
language sql
stable
as $$
  select public.anpi_can_read_context_row(
    p_member_id,
    p_contract_holder_id,
    p_anpi_user_id,
    p_user_id
  );
$$;

create or replace function public.anpi_can_write_log_row(
  p_member_id text,
  p_contract_holder_id text
)
returns boolean
language sql
stable
as $$
  select public.anpi_can_write_context_row(p_member_id, p_contract_holder_id);
$$;

-- ---------------------------------------------------------------------------
-- anpi_user_contexts — 本番ポリシー
-- ---------------------------------------------------------------------------
drop policy if exists "anpi_user_contexts_select_prod" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_insert_prod" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_update_prod" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_delete_prod" on public.anpi_user_contexts;

create policy "anpi_user_contexts_select_prod"
  on public.anpi_user_contexts
  for select
  to authenticated
  using (
    public.anpi_can_read_context_row(member_id, contract_holder_id, anpi_user_id, user_id)
  );

create policy "anpi_user_contexts_insert_prod"
  on public.anpi_user_contexts
  for insert
  to authenticated
  with check (
    public.anpi_can_write_context_row(member_id, contract_holder_id)
  );

create policy "anpi_user_contexts_update_prod"
  on public.anpi_user_contexts
  for update
  to authenticated
  using (
    public.anpi_can_read_context_row(member_id, contract_holder_id, anpi_user_id, user_id)
  )
  with check (
    public.anpi_can_write_context_row(member_id, contract_holder_id)
  );

create policy "anpi_user_contexts_delete_prod"
  on public.anpi_user_contexts
  for delete
  to authenticated
  using (
    public.anpi_can_write_context_row(member_id, contract_holder_id)
  );

-- anon は本番では拒否（開発用 _dev ポリシー削除後）
-- 必要なら Edge Function / service_role 経由で書き込み

-- ---------------------------------------------------------------------------
-- anpi_notification_logs — 本番ポリシー
-- ---------------------------------------------------------------------------
drop policy if exists "anpi_notification_logs_select_prod" on public.anpi_notification_logs;
drop policy if exists "anpi_notification_logs_insert_prod" on public.anpi_notification_logs;
drop policy if exists "anpi_notification_logs_update_prod" on public.anpi_notification_logs;
drop policy if exists "anpi_notification_logs_delete_prod" on public.anpi_notification_logs;

create policy "anpi_notification_logs_select_prod"
  on public.anpi_notification_logs
  for select
  to authenticated
  using (
    public.anpi_can_read_log_row(member_id, contract_holder_id, anpi_user_id, user_id)
  );

create policy "anpi_notification_logs_insert_prod"
  on public.anpi_notification_logs
  for insert
  to authenticated
  with check (
    public.anpi_can_write_log_row(member_id, contract_holder_id)
  );

create policy "anpi_notification_logs_update_prod"
  on public.anpi_notification_logs
  for update
  to authenticated
  using (
    public.anpi_can_read_log_row(member_id, contract_holder_id, anpi_user_id, user_id)
  )
  with check (
    public.anpi_can_write_log_row(member_id, contract_holder_id)
  );

create policy "anpi_notification_logs_delete_prod"
  on public.anpi_notification_logs
  for delete
  to authenticated
  using (
    public.anpi_can_write_log_row(member_id, contract_holder_id)
  );

-- ---------------------------------------------------------------------------
-- 本番 / ステージング RLS 検証時: sql/anpi-rls-drop-dev-policies.sql を実行
-- （ローカル開発のみ dev ポリシーを残す）
-- ---------------------------------------------------------------------------
