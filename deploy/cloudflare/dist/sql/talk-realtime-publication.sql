-- TASFUL TALK — Realtime publication（ステージング / 本番）
-- supabase_realtime に talk_* テーブルを追加（既存ならスキップ）

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.talk_ai_drafts;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.talk_broadcast_drafts;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.talk_notifications;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.talk_follow_subscriptions;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
