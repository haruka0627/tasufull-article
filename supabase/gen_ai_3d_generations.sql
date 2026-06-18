-- Tripo 3D 本番生成履歴（チケット消費・冪等完了の記録）
create table if not exists public.gen_ai_3d_generations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  character_id text not null,
  task_id text not null,
  status text not null default 'processing',
  model_url text,
  preview_url text,
  download_url text,
  credits_used integer not null default 0,
  ticket_consumed boolean not null default false,
  error_message text,
  character_name text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint gen_ai_3d_generations_task_id_key unique (task_id),
  constraint gen_ai_3d_generations_status_check check (
    status in ('processing', 'success', 'failed', 'cancelled')
  )
);

create index if not exists gen_ai_3d_generations_user_id_idx
  on public.gen_ai_3d_generations (user_id, created_at desc);

create index if not exists gen_ai_3d_generations_character_id_idx
  on public.gen_ai_3d_generations (character_id);

comment on table public.gen_ai_3d_generations is 'TASFUL 生成AI Tripo 3D本番生成履歴';

alter table public.gen_ai_3d_generations enable row level security;

drop policy if exists "gen_ai_3d_generations_deny_anon" on public.gen_ai_3d_generations;
create policy "gen_ai_3d_generations_deny_anon"
  on public.gen_ai_3d_generations
  for all
  to anon, authenticated
  using (false)
  with check (false);
