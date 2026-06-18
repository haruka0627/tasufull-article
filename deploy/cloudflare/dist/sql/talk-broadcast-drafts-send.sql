-- 配信下書き — 本番送信用カラム追加
-- talk-sync-schema.sql 適用後に実行

alter table public.talk_broadcast_drafts
  add column if not exists sent_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists target_url text not null default 'talk-home.html?tab=notify',
  add column if not exists send_history jsonb not null default '[]'::jsonb;

comment on column public.talk_broadcast_drafts.send_history is '配信履歴 [{ id, sentAt, recipientCount, deliveredCount, ... }]';
