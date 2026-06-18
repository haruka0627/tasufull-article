-- AI運営センター（Supabase 移行用・未実行）

create table if not exists public.ai_ops_cases (
  id uuid primary key default gen_random_uuid(),
  support_ticket_id text,
  source text not null default 'manual',
  title text not null,
  body text not null,
  support_category text,
  severity text,
  status text not null default 'needs_review',
  ops_category text,
  ai_summary text,
  ai_category text,
  ai_risk text,
  ai_recommended_action text,
  ai_reply_draft text,
  ai_provider text default 'template',
  related_project_id text,
  related_order_id text,
  user_id text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.ai_ops_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.ai_ops_cases(id) on delete cascade,
  event_type text not null,
  payload_summary text,
  payload jsonb,
  created_at timestamptz not null default now()
);
