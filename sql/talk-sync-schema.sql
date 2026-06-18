-- TASFUL TALK — AI下書き / 配信下書き / 通知（Supabase 同期）
-- SQL Editor で実行後、Realtime を有効化:
--   Database → Publications → supabase_realtime → 各テーブルを追加

-- ---------------------------------------------------------------------------
-- AI 下書き
-- ---------------------------------------------------------------------------
create table if not exists public.talk_ai_drafts (
  id text primary key,
  user_id text not null,
  mode text not null default 'qa',
  input text not null default '',
  output text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists talk_ai_drafts_user_updated_idx
  on public.talk_ai_drafts (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 配信下書き
-- ---------------------------------------------------------------------------
create table if not exists public.talk_broadcast_drafts (
  id text primary key,
  user_id text not null,
  source_draft_id text not null default '',
  kind text not null default 'notice',
  title text not null default '',
  body text not null default '',
  target_segment text not null default 'all',
  target_count integer not null default 0,
  status text not null default 'draft',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists talk_broadcast_drafts_user_updated_idx
  on public.talk_broadcast_drafts (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 通知
-- ---------------------------------------------------------------------------
create table if not exists public.talk_notifications (
  id text primary key,
  user_id text not null,
  type text not null default 'system',
  title text not null default '',
  body text not null default '',
  target_url text not null default '#',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  source text not null default 'tasful',
  priority text not null default 'normal',
  updated_at timestamptz not null default now()
);

create index if not exists talk_notifications_user_created_idx
  on public.talk_notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS（開発用: 本番では user_id / JWT に基づく厳密ポリシーへ差し替え）
-- ---------------------------------------------------------------------------
alter table public.talk_ai_drafts enable row level security;
alter table public.talk_broadcast_drafts enable row level security;
alter table public.talk_notifications enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'talk_ai_drafts',
    'talk_broadcast_drafts',
    'talk_notifications'
  ]
  loop
    execute format('drop policy if exists "%s_select_dev" on public.%I', t, t);
    execute format('drop policy if exists "%s_insert_dev" on public.%I', t, t);
    execute format('drop policy if exists "%s_update_dev" on public.%I', t, t);
    execute format('drop policy if exists "%s_delete_dev" on public.%I', t, t);

    execute format(
      'create policy "%s_select_dev" on public.%I for select to anon, authenticated using (true)',
      t, t
    );
    execute format(
      'create policy "%s_insert_dev" on public.%I for insert to anon, authenticated with check (true)',
      t, t
    );
    execute format(
      'create policy "%s_update_dev" on public.%I for update to anon, authenticated using (true) with check (true)',
      t, t
    );
    execute format(
      'create policy "%s_delete_dev" on public.%I for delete to anon, authenticated using (true)',
      t, t
    );
  end loop;
end $$;

-- Realtime（既に publication がある場合のみ）
-- alter publication supabase_realtime add table public.talk_ai_drafts;
-- alter publication supabase_realtime add table public.talk_broadcast_drafts;
-- alter publication supabase_realtime add table public.talk_notifications;
