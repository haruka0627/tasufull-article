-- TASFUL Supabase Phase 2 — 運営系 Staging スキーマ（PoC: text id = localStorage 互換）
-- 適用: scripts/apply-staging-phase2-supabase.mjs
-- 注意: 本番前に UUID 版へ移行する場合は legacy_id カラム方式に差し替え

-- ---------------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id text primary key,
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
  id text primary key,
  ticket_id text not null references public.support_tickets(id) on delete cascade,
  event_type text not null,
  payload_summary text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.connect_issues (
  id text primary key,
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
  ticket_id text references public.support_tickets(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.support_admin_notifications (
  id text primary key,
  ticket_id text,
  category text,
  severity text,
  title text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_updated_idx on public.support_tickets (updated_at desc);

-- ---------------------------------------------------------------------------
-- AI 運営
-- ---------------------------------------------------------------------------
create table if not exists public.ai_ops_cases (
  id text primary key,
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
  id text primary key,
  case_id text not null references public.ai_ops_cases(id) on delete cascade,
  event_type text not null,
  payload_summary text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_ops_admin_notifications (
  id text primary key,
  case_id text,
  ops_category text,
  ai_risk text,
  title text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ai_ops_cases_status_idx on public.ai_ops_cases (status);
create index if not exists ai_ops_cases_updated_idx on public.ai_ops_cases (updated_at desc);

-- ---------------------------------------------------------------------------
-- Builder パートナー評価
-- ---------------------------------------------------------------------------
create table if not exists public.builder_partner_evaluations (
  id text primary key,
  partner_id text not null,
  partner_name text not null,
  project_id text,
  project_title text,
  deadline_delta smallint not null default 0,
  complaint_delta smallint not null default 0,
  note text,
  created_by text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists public.builder_partner_status_events (
  id text primary key,
  partner_id text not null,
  partner_name text not null,
  partner_status text not null,
  action text not null,
  reason text,
  created_by text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists public.builder_partner_visibility (
  partner_id text primary key,
  partner_status text not null,
  updated_at timestamptz not null default now()
);

create index if not exists builder_partner_eval_partner_idx
  on public.builder_partner_evaluations (partner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- TALK 運営ルーム（読取 PoC）
-- ---------------------------------------------------------------------------
create table if not exists public.talk_ops_messages (
  id text primary key,
  room_id text not null default 'talk-ops-operations-room',
  sender_id text not null,
  sender_name text,
  kind text not null default 'text',
  text text,
  ops_card jsonb,
  ops_summary text,
  created_at timestamptz not null default now()
);

create index if not exists talk_ops_messages_room_created_idx
  on public.talk_ops_messages (room_id, created_at desc);
