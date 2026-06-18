-- 生成AI 利用回数（将来 Supabase DB 管理用の土台）
-- 現状は localStorage（tasu_genai_usage / tasu_genai_plan）で管理。

create table if not exists public.gen_ai_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  usage_date date not null default (timezone('Asia/Tokyo', now()))::date,
  text_chat_used integer not null default 0 check (text_chat_used >= 0),
  voice_chat_used integer not null default 0 check (voice_chat_used >= 0),
  image_character_used integer not null default 0 check (image_character_used >= 0),
  plan_code text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

create index if not exists gen_ai_usage_daily_user_date_idx
  on public.gen_ai_usage_daily (user_id, usage_date desc);

comment on table public.gen_ai_usage_daily is 'TASFUL 生成AI 日次利用回数（将来移行用）';
