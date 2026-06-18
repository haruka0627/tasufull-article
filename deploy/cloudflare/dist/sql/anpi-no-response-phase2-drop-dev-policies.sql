-- 安否未応答 Phase2 — dev ポリシー削除（本番投入前必須）
--
-- *_dev は using (true) のため *_prod と OR 結合され本番 RLS が無効になります。
-- 前提: sql/anpi-no-response-phase2-rls.sql（prod ポリシー）適用済み
--
-- 確認: 末尾 SELECT が 0 行であること

drop policy if exists "anpi_check_sessions_select_dev" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_insert_dev" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_update_dev" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_delete_dev" on public.anpi_check_sessions;

drop policy if exists "anpi_no_response_audit_log_select_dev" on public.anpi_no_response_audit_log;
drop policy if exists "anpi_no_response_audit_log_insert_dev" on public.anpi_no_response_audit_log;

-- 残存 dev ポリシー（0 行が期待）
select
  tablename,
  policyname,
  'DEV_POLICY_STILL_PRESENT' as warning
from pg_policies
where schemaname = 'public'
  and tablename in ('anpi_check_sessions', 'anpi_no_response_audit_log')
  and policyname like '%_dev'
order by tablename, policyname;
