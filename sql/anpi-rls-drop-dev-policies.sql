-- 安否 開発用 RLS ポリシー削除（ステージング / 本番 RLS 検証前に必須）
--
-- *_dev は using (true) のため、*_prod と OR 結合され本番 RLS が無効になります。
-- P9-5 実 DB 検証（verify-anpi-rls-real-db.mjs）の前に SQL Editor で実行してください。
--
-- 確認: sql/anpi-rls-staging-verify.sql セクション 3 が 0 行であること

drop policy if exists "anpi_user_contexts_select_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_insert_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_update_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_delete_dev" on public.anpi_user_contexts;

drop policy if exists "anpi_notification_logs_select_dev" on public.anpi_notification_logs;
drop policy if exists "anpi_notification_logs_insert_dev" on public.anpi_notification_logs;
drop policy if exists "anpi_notification_logs_update_dev" on public.anpi_notification_logs;
drop policy if exists "anpi_notification_logs_delete_dev" on public.anpi_notification_logs;

-- 残存 dev ポリシー（0 行が期待）
select
  tablename,
  policyname,
  'DEV_POLICY_STILL_PRESENT' as warning
from pg_policies
where schemaname = 'public'
  and tablename in ('anpi_user_contexts', 'anpi_notification_logs')
  and policyname like '%_dev'
order by tablename, policyname;
