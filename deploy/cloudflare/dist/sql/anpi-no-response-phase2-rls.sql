-- 安否未応答 Phase2 RLS
-- 前提: sql/anpi-no-response-phase2-schema.sql 適用済み
-- 本番: anpi-rls-production.sql の anpi_current_member_id() / anpi_is_admin() が存在すること

-- ---------------------------------------------------------------------------
-- 開発用（anon / authenticated 全許可 — ステージング・E2E）
-- ---------------------------------------------------------------------------
drop policy if exists "anpi_check_sessions_select_dev" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_insert_dev" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_update_dev" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_delete_dev" on public.anpi_check_sessions;

create policy "anpi_check_sessions_select_dev"
  on public.anpi_check_sessions
  for select
  to anon, authenticated
  using (true);

create policy "anpi_check_sessions_insert_dev"
  on public.anpi_check_sessions
  for insert
  to anon, authenticated
  with check (true);

create policy "anpi_check_sessions_update_dev"
  on public.anpi_check_sessions
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "anpi_check_sessions_delete_dev"
  on public.anpi_check_sessions
  for delete
  to anon, authenticated
  using (true);

drop policy if exists "anpi_no_response_audit_log_select_dev" on public.anpi_no_response_audit_log;
drop policy if exists "anpi_no_response_audit_log_insert_dev" on public.anpi_no_response_audit_log;

create policy "anpi_no_response_audit_log_select_dev"
  on public.anpi_no_response_audit_log
  for select
  to anon, authenticated
  using (true);

create policy "anpi_no_response_audit_log_insert_dev"
  on public.anpi_no_response_audit_log
  for insert
  to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- 本番用（anpi_current_member_id / talk_current_user_id 併用）
-- デプロイ時: 上記 dev ポリシーを DROP してから以下を有効化
-- ---------------------------------------------------------------------------

create or replace function public.anpi_can_read_check_session(
  p_contract_holder_id text,
  p_target_user_id text
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
        nullif(trim(p_contract_holder_id), ''),
        nullif(trim(p_target_user_id), '')
      )
    );
$$;

comment on function public.anpi_can_read_check_session(text, text)
  is 'RLS: 契約者・利用者・管理者がチェックセッションを読める';

drop policy if exists "anpi_check_sessions_select_prod" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_insert_prod" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_update_prod" on public.anpi_check_sessions;

create policy "anpi_check_sessions_select_prod"
  on public.anpi_check_sessions
  for select
  to authenticated
  using (
    public.anpi_can_read_check_session(contract_holder_id, target_user_id)
  );

create policy "anpi_check_sessions_insert_prod"
  on public.anpi_check_sessions
  for insert
  to authenticated
  with check (
    public.anpi_is_admin()
    or contract_holder_id = public.anpi_current_member_id()
  );

create policy "anpi_check_sessions_update_prod"
  on public.anpi_check_sessions
  for update
  to authenticated
  using (
    public.anpi_is_admin()
    or contract_holder_id = public.anpi_current_member_id()
  )
  with check (
    public.anpi_is_admin()
    or contract_holder_id = public.anpi_current_member_id()
  );

drop policy if exists "anpi_no_response_audit_log_select_prod" on public.anpi_no_response_audit_log;
drop policy if exists "anpi_no_response_audit_log_insert_prod" on public.anpi_no_response_audit_log;

create policy "anpi_no_response_audit_log_select_prod"
  on public.anpi_no_response_audit_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.anpi_check_sessions s
      where s.id = anpi_check_id
        and public.anpi_can_read_check_session(s.contract_holder_id, s.target_user_id)
    )
  );

create policy "anpi_no_response_audit_log_insert_prod"
  on public.anpi_no_response_audit_log
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.anpi_check_sessions s
      where s.id = anpi_check_id
        and (
          public.anpi_is_admin()
          or s.contract_holder_id = coalesce(public.talk_current_user_id(), public.anpi_current_member_id())
        )
    )
  );

-- Realtime（任意 — ダッシュボード live 更新用）
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.anpi_check_sessions';
  end if;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
