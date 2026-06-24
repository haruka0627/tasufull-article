-- TASFUL LIVE — 字幕機能 拡張ポイント（スキーマのみ · API/生成は未実装）
-- Prerequisite: 20260701100000_live_videos_p1.sql
--
-- 将来:
--   - Edge: live-video-caption-generate (Whisper 等 · service_role)
--   - Storage bucket: live-video-captions · path {video_id}/{language}.vtt
--   - フロント: live-video-captions.js · CC ボタン表示

-- ---------------------------------------------------------------------------
-- live_videos — 字幕サマリー列（フィード/視聴 UI 用 · 詳細は live_video_captions）
-- ---------------------------------------------------------------------------

alter table public.live_videos
  add column if not exists caption_status text not null default 'none',
  add column if not exists has_caption boolean not null default false,
  add column if not exists caption_language text;

alter table public.live_videos
  drop constraint if exists live_videos_caption_status_chk;

alter table public.live_videos
  add constraint live_videos_caption_status_chk
  check (caption_status in ('none', 'pending', 'processing', 'ready', 'failed'));

alter table public.live_videos
  drop constraint if exists live_videos_caption_language_chk;

alter table public.live_videos
  add constraint live_videos_caption_language_chk
  check (caption_language is null or char_length(btrim(caption_language)) between 2 and 16);

comment on column public.live_videos.caption_status is
  '字幕パイプライン状態 · none=未着手 pending/processing/ready/failed · Edge 同期用';
comment on column public.live_videos.has_caption is
  '視聴可能な字幕があるか（live_video_captions と同期 · 一覧/プレイヤー CC 用）';
comment on column public.live_videos.caption_language is
  'デフォルト字幕の BCP-47 言語コード（例: ja）· ready 時のみ';

create index if not exists live_videos_has_caption_idx
  on public.live_videos (has_caption)
  where has_caption = true;

-- ---------------------------------------------------------------------------
-- live_video_captions — 字幕トラック（1 動画 × 複数言語）
-- ---------------------------------------------------------------------------

create table if not exists public.live_video_captions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.live_videos (id) on delete cascade,
  language text not null default 'ja',
  label text,
  format text not null default 'vtt',
  storage_path text,
  source text not null default 'manual',
  status text not null default 'draft',
  is_default boolean not null default false,
  whisper_job_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_video_captions_language_chk
    check (char_length(btrim(language)) between 2 and 16),
  constraint live_video_captions_format_chk
    check (format in ('vtt', 'srt')),
  constraint live_video_captions_source_chk
    check (source in ('manual', 'whisper', 'import')),
  constraint live_video_captions_status_chk
    check (status in ('draft', 'processing', 'ready', 'failed')),
  constraint live_video_captions_video_lang_format_uniq
    unique (video_id, language, format)
);

comment on table public.live_video_captions is
  '長尺動画字幕トラック · VTT/SRT · Whisper 生成結果の保存先（拡張ポイント）';
comment on column public.live_video_captions.storage_path is
  'live-video-captions バケット内パス · 例: {video_id}/ja.vtt';
comment on column public.live_video_captions.whisper_job_id is
  '非同期字幕生成ジョブ ID（Whisper Edge 等 · 未実装）';

create index if not exists live_video_captions_video_idx
  on public.live_video_captions (video_id, status);

create index if not exists live_video_captions_default_idx
  on public.live_video_captions (video_id)
  where is_default = true and status = 'ready';

-- ---------------------------------------------------------------------------
-- オーナーによる live_videos 字幕サマリー直接更新を禁止（Edge/service_role のみ）
-- ---------------------------------------------------------------------------

create or replace function public.live_internal_set_caption_refresh()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('live.internal_caption_refresh', '1', true);
end;
$$;

create or replace function public.live_videos_guard_owner_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('live.internal_count_refresh', true), '') = '1' then
    return new;
  end if;

  if coalesce(current_setting('live.internal_caption_refresh', true), '') = '1' then
    return new;
  end if;

  if public.talk_is_admin() then
    return new;
  end if;

  if new.views_count is distinct from old.views_count
     or new.likes_count is distinct from old.likes_count
     or new.reports_count is distinct from old.reports_count
  then
    raise exception 'live_videos: forbidden counter update for non-admin';
  end if;

  if new.caption_status is distinct from old.caption_status
     or new.has_caption is distinct from old.has_caption
     or new.caption_language is distinct from old.caption_language
  then
    raise exception 'live_videos: caption summary is system-managed';
  end if;

  return new;
end;
$$;

-- 将来 Edge / バッチから呼び出し · 現時点ではアプリから未使用
create or replace function public.live_sync_video_caption_summary(p_video_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ready_count int;
  v_default_lang text;
  v_any_processing boolean;
  v_any_failed boolean;
begin
  perform public.live_internal_set_caption_refresh();

  select count(*)::int,
         max(c.language) filter (where c.is_default and c.status = 'ready'),
         bool_or(c.status = 'processing'),
         bool_or(c.status = 'failed')
    into v_ready_count, v_default_lang, v_any_processing, v_any_failed
  from public.live_video_captions c
  where c.video_id = p_video_id;

  update public.live_videos v
  set
    has_caption = (v_ready_count > 0),
    caption_language = case when v_ready_count > 0 then coalesce(v_default_lang, v.caption_language) else null end,
    caption_status = case
      when v_ready_count > 0 then 'ready'
      when v_any_processing then 'processing'
      when v_any_failed then 'failed'
      when exists (
        select 1 from public.live_video_captions c2
        where c2.video_id = p_video_id and c2.status = 'draft'
      ) then 'pending'
      else 'none'
    end,
    updated_at = now()
  where v.id = p_video_id;
end;
$$;

comment on function public.live_sync_video_caption_summary(uuid) is
  'live_video_captions から live_videos の caption_* サマリーを同期（Whisper Edge 完了時に呼ぶ想定）';

-- ---------------------------------------------------------------------------
-- RLS · grants（読み取りは公開動画と同条件 · 書き込みはオーナー / service_role）
-- ---------------------------------------------------------------------------

grant select on public.live_video_captions to anon, authenticated;
grant insert, update, delete on public.live_video_captions to authenticated;
grant select, insert, update, delete on public.live_video_captions to service_role;
revoke insert, update, delete on public.live_video_captions from anon;

alter table public.live_video_captions enable row level security;

drop policy if exists live_video_captions_select_public on public.live_video_captions;
create policy live_video_captions_select_public
  on public.live_video_captions
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.live_videos v
      where v.id = live_video_captions.video_id
        and public.live_video_is_publicly_viewable(v.id)
    )
    or exists (
      select 1
      from public.live_videos v
      where v.id = live_video_captions.video_id
        and v.talk_user_id = public.talk_current_user_id()
    )
    or public.talk_is_admin()
  );

drop policy if exists live_video_captions_owner_write on public.live_video_captions;
create policy live_video_captions_owner_write
  on public.live_video_captions
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.live_videos v
      where v.id = live_video_captions.video_id
        and v.talk_user_id = public.talk_current_user_id()
    )
    or public.talk_is_admin()
  )
  with check (
    exists (
      select 1
      from public.live_videos v
      where v.id = live_video_captions.video_id
        and v.talk_user_id = public.talk_current_user_id()
    )
    or public.talk_is_admin()
  );

drop trigger if exists live_video_captions_set_updated_at on public.live_video_captions;
create trigger live_video_captions_set_updated_at
  before update on public.live_video_captions
  for each row execute function public.live_set_updated_at();
