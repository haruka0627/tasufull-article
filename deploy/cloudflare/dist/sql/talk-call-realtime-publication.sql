-- TALK WebRTC — Realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.talk_call_sessions;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.talk_call_signals;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
