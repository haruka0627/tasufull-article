-- 生成AI マイキャラ画像用 Storage バケット（任意）
-- Dashboard → Storage で作成するか、この SQL を実行してください。

insert into storage.buckets (id, name, public)
values ('gen-ai-characters', 'gen-ai-characters', true)
on conflict (id) do nothing;

-- anon からのアップロード（公開読み取り）
create policy if not exists "gen_ai_characters_public_read"
on storage.objects for select
using (bucket_id = 'gen-ai-characters');

create policy if not exists "gen_ai_characters_anon_insert"
on storage.objects for insert
with check (bucket_id = 'gen-ai-characters');
