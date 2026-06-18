-- 安否未応答フロー Phase2 — チェックセッション + 監査ログ
-- SQL Editor または scripts/apply-anpi-no-response-phase2-supabase.mjs で適用

create table if not exists public.anpi_check_sessions (
  id uuid primary key default gen_random_uuid(),
  target_user_id text not null,
  contract_holder_id text not null,
  emergency_contact_user_id text,
  status text not null default 'pending',
  target_user_name text not null default '',
  relation text not null default '',
  check_sent_at timestamptz,
  response_deadline_at timestamptz,
  responded_at timestamptz,
  no_response_at timestamptz,
  family_notified_at timestamptz,
  handled_at timestamptz,
  handled_by text,
  action_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anpi_check_sessions_status_check check (
    status in (
      'pending',
      'sent_to_user',
      'answered',
      'no_response',
      'family_notified',
      'handled',
      'escalated',
      'expired'
    )
  ),
  constraint anpi_check_sessions_action_type_check check (
    action_type is null
    or action_type in ('confirmed', 'talk_call', 'ops_consult')
  )
);

comment on table public.anpi_check_sessions is '安否チェック 1 回 = 1 行（未応答状態機械）';
comment on column public.anpi_check_sessions.id is 'anpi_check_id';
comment on column public.anpi_check_sessions.target_user_id is '利用者 talk_user_id';
comment on column public.anpi_check_sessions.contract_holder_id is '契約者 / 主通知先 talk_user_id';

create index if not exists anpi_check_sessions_target_status_idx
  on public.anpi_check_sessions (target_user_id, status);

create index if not exists anpi_check_sessions_holder_status_idx
  on public.anpi_check_sessions (contract_holder_id, status);

create index if not exists anpi_check_sessions_deadline_idx
  on public.anpi_check_sessions (response_deadline_at)
  where status = 'sent_to_user';

create unique index if not exists anpi_check_sessions_one_active_per_target_idx
  on public.anpi_check_sessions (target_user_id)
  where status in ('pending', 'sent_to_user', 'no_response', 'family_notified');

create table if not exists public.anpi_no_response_audit_log (
  id uuid primary key default gen_random_uuid(),
  anpi_check_id uuid not null references public.anpi_check_sessions (id) on delete cascade,
  actor_user_id text not null default '',
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint anpi_no_response_audit_log_action_type_check check (
    action_type in (
      'confirmed',
      'talk_call_initiated',
      'ops_consult',
      'status_change',
      'family_notified'
    )
  )
);

comment on table public.anpi_no_response_audit_log is '安否未応答 CTA / 状態遷移の監査ログ（追記のみ）';

create index if not exists anpi_no_response_audit_log_check_idx
  on public.anpi_no_response_audit_log (anpi_check_id, created_at desc);

create index if not exists anpi_no_response_audit_log_actor_idx
  on public.anpi_no_response_audit_log (actor_user_id, created_at desc);

create or replace function public.anpi_check_sessions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists anpi_check_sessions_set_updated_at on public.anpi_check_sessions;
create trigger anpi_check_sessions_set_updated_at
  before update on public.anpi_check_sessions
  for each row
  execute function public.anpi_check_sessions_set_updated_at();

alter table public.anpi_check_sessions enable row level security;
alter table public.anpi_no_response_audit_log enable row level security;
