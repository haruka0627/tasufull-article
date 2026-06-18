-- Builder パートナー実績評価（Supabase 移行用・未実行）

create table if not exists public.builder_partner_evaluations (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  partner_name text not null,
  partner_status text not null,
  action text not null,
  reason text,
  created_by text not null default 'admin',
  created_at timestamptz not null default now()
);

create index if not exists builder_partner_eval_partner_idx
  on public.builder_partner_evaluations (partner_id, created_at desc);
