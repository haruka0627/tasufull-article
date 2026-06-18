-- 既存の reports テーブルに reported_user_id を追加（既に reports.sql 最新版なら不要）
alter table public.reports
  add column if not exists reported_user_id text;

create index if not exists idx_reports_reported_user_id
  on public.reports (reported_user_id);
