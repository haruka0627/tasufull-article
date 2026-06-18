-- TASFUL TALK — フォロー・お気に入り（更新通知用）
-- talk-follow-store.js と talk-supabase-sync.js 連携

create table if not exists public.talk_follow_subscriptions (
  id text primary key,
  user_id text not null,
  target_id text not null,
  target_type text not null default 'job',
  title text not null default '',
  target_url text not null default '#',
  notify_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists talk_follow_subscriptions_user_updated_idx
  on public.talk_follow_subscriptions (user_id, updated_at desc);

create index if not exists talk_follow_subscriptions_target_idx
  on public.talk_follow_subscriptions (target_id, target_type);

alter table public.talk_follow_subscriptions enable row level security;

do $$
begin
  execute 'drop policy if exists "talk_follow_subscriptions_select_dev" on public.talk_follow_subscriptions';
  execute 'drop policy if exists "talk_follow_subscriptions_insert_dev" on public.talk_follow_subscriptions';
  execute 'drop policy if exists "talk_follow_subscriptions_update_dev" on public.talk_follow_subscriptions';
  execute 'drop policy if exists "talk_follow_subscriptions_delete_dev" on public.talk_follow_subscriptions';

  execute 'create policy "talk_follow_subscriptions_select_dev" on public.talk_follow_subscriptions for select using (true)';
  execute 'create policy "talk_follow_subscriptions_insert_dev" on public.talk_follow_subscriptions for insert with check (true)';
  execute 'create policy "talk_follow_subscriptions_update_dev" on public.talk_follow_subscriptions for update using (true)';
  execute 'create policy "talk_follow_subscriptions_delete_dev" on public.talk_follow_subscriptions for delete using (true)';
end $$;
