-- TASFUL 問い合わせ・Connectトラブル（Supabase 用・未実行メモ）
-- 実行前に RLS・運営ロールを別途設計すること

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  related_project_id text,
  related_order_id text,
  related_stripe_account_id text,
  source text not null default 'web_form',
  title text not null,
  body text not null,
  category text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open',
  ai_summary text,
  ai_suggested_reply text,
  ai_recommended_action text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.support_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  event_type text not null,
  payload_summary text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.connect_issues (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  stripe_account_id text,
  stripe_event_type text,
  issue_type text not null,
  severity text not null,
  status text not null default 'open',
  detected_reason text,
  recommended_action text,
  admin_required boolean not null default true,
  raw_event_ref text,
  ticket_id uuid references public.support_tickets(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_severity_idx on public.support_tickets (severity);
create index if not exists connect_issues_status_idx on public.connect_issues (status);

-- RLS は運営 service_role / 認証済み admin のみ（別ファイルで定義）
