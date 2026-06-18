-- 安否 ID 正式紐付け（P9-3）
-- 前提: sql/anpi-user-context.sql / sql/anpi-notification-logs.sql 適用済み
-- SQL Editor で実行してください。

-- ---------------------------------------------------------------------------
-- anpi_user_contexts
-- ---------------------------------------------------------------------------
alter table public.anpi_user_contexts
  add column if not exists member_id text,
  add column if not exists anpi_user_id text,
  add column if not exists relationship text,
  add column if not exists account_scope text default 'self';

comment on column public.anpi_user_contexts.member_id is 'TASFUL ログイン会員 ID（RLS 基準の想定キー）';
comment on column public.anpi_user_contexts.anpi_user_id is '安否対象の利用者 ID（既存 user_id の正式名称）';
comment on column public.anpi_user_contexts.relationship is '契約者から見た利用者との関係: self|parent|child|spouse|relative|other';
comment on column public.anpi_user_contexts.account_scope is 'アカウント範囲: self|family|managed';

update public.anpi_user_contexts
set
  anpi_user_id = coalesce(nullif(trim(anpi_user_id), ''), nullif(trim(user_id), '')),
  member_id = coalesce(
    nullif(trim(member_id), ''),
    nullif(trim(contract_holder_id), ''),
    nullif(trim(user_id), '')
  ),
  relationship = coalesce(
    nullif(trim(relationship), ''),
    nullif(trim(metadata->>'relationship'), ''),
    'self'
  ),
  account_scope = coalesce(
    nullif(trim(account_scope), ''),
    case
      when coalesce(nullif(trim(contract_holder_id), ''), '') = coalesce(nullif(trim(user_id), ''), '')
        then 'self'
      else 'family'
    end
  )
where true;

create index if not exists anpi_user_contexts_member_id_idx
  on public.anpi_user_contexts (member_id)
  where member_id is not null and member_id <> '';

create index if not exists anpi_user_contexts_anpi_user_id_idx
  on public.anpi_user_contexts (anpi_user_id)
  where anpi_user_id is not null and anpi_user_id <> '';

create index if not exists anpi_user_contexts_member_anpi_user_idx
  on public.anpi_user_contexts (member_id, anpi_user_id)
  where member_id is not null and anpi_user_id is not null;

create index if not exists anpi_user_contexts_holder_anpi_user_idx
  on public.anpi_user_contexts (contract_holder_id, anpi_user_id)
  where contract_holder_id is not null and anpi_user_id is not null;

-- ---------------------------------------------------------------------------
-- anpi_notification_logs
-- ---------------------------------------------------------------------------
alter table public.anpi_notification_logs
  add column if not exists member_id text,
  add column if not exists anpi_user_id text;

comment on column public.anpi_notification_logs.member_id is 'TASFUL ログイン会員 ID（通知を閲覧する契約者の会員 ID）';
comment on column public.anpi_notification_logs.anpi_user_id is '安否対象の利用者 ID（既存 user_id と同義）';

update public.anpi_notification_logs
set
  anpi_user_id = coalesce(nullif(trim(anpi_user_id), ''), nullif(trim(user_id), '')),
  member_id = coalesce(
    nullif(trim(member_id), ''),
    nullif(trim(contract_holder_id), '')
  )
where true;

create index if not exists anpi_notification_logs_member_id_idx
  on public.anpi_notification_logs (member_id)
  where member_id is not null and member_id <> '';

create index if not exists anpi_notification_logs_anpi_user_id_idx
  on public.anpi_notification_logs (anpi_user_id)
  where anpi_user_id is not null and anpi_user_id <> '';

create index if not exists anpi_notification_logs_member_anpi_user_idx
  on public.anpi_notification_logs (member_id, anpi_user_id)
  where member_id is not null and anpi_user_id is not null;

-- ---------------------------------------------------------------------------
-- RLS: 本番ポリシーは sql/anpi-rls-production.sql を実行
-- ローカル開発は anpi_*_dev ポリシー（全許可）を維持
-- ---------------------------------------------------------------------------
