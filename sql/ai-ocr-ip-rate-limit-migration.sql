-- Gemini OCR IP rate limit — atomic bucket consume
-- Migration proposal only — DO NOT apply to production without review.
--
-- Deploy order:
--   1. Apply this migration (new table + RPC · independent of quota reservation)
--   2. Set OCR_IP_RATE_HMAC_SECRET on Cloudflare Pages (and local .dev.vars)
--   3. Deploy Function that calls consume_ocr_ip_rate_limit
--
-- Privacy:
--   bucket_key は raw IP ではなく Edge 側 HMAC 結果のみ。
--   expires_at を保持。今回 cleanup job は未実装。
--   将来: DELETE WHERE expires_at < now() で安全に削除可能。
--
-- Atomicity:
--   INSERT ... ON CONFLICT DO UPDATE ... WHERE count < p_limit RETURNING
--   単一ステートメントで increment と上限判定を不可分に行う。

create table if not exists public.ai_ocr_ip_rate_buckets (
  bucket_key text primary key,
  window_kind text not null check (window_kind in ('burst', 'sustained')),
  hit_count integer not null default 0 check (hit_count >= 0),
  window_start timestamptz not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists ai_ocr_ip_rate_buckets_expires_idx
  on public.ai_ocr_ip_rate_buckets (expires_at);

comment on table public.ai_ocr_ip_rate_buckets is
  'OCR IP rate limit buckets · key = HMAC(ip,window) · raw IP は保存しない';

create or replace function public.consume_ocr_ip_rate_limit(
  p_bucket_key text,
  p_window_kind text,
  p_limit integer,
  p_window_start timestamptz,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row ai_ocr_ip_rate_buckets%rowtype;
  v_count integer;
begin
  if coalesce(trim(p_bucket_key), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_bucket_key');
  end if;

  if p_window_kind not in ('burst', 'sustained') then
    return jsonb_build_object('ok', false, 'error', 'invalid_window_kind');
  end if;

  if p_limit is null or p_limit <= 0 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited', 'limit', coalesce(p_limit, 0), 'count', 0, 'remaining', 0);
  end if;

  if p_window_start is null or p_expires_at is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_window');
  end if;

  insert into ai_ocr_ip_rate_buckets as b (
    bucket_key, window_kind, hit_count, window_start, expires_at, updated_at
  ) values (
    p_bucket_key, p_window_kind, 1, p_window_start, p_expires_at, now()
  )
  on conflict (bucket_key) do update
    set hit_count = b.hit_count + 1,
        updated_at = now(),
        expires_at = excluded.expires_at
  where b.hit_count < p_limit
  returning * into v_row;

  if v_row.bucket_key is not null then
    return jsonb_build_object(
      'ok', true,
      'window_kind', v_row.window_kind,
      'count', v_row.hit_count,
      'limit', p_limit,
      'remaining', greatest(0, p_limit - v_row.hit_count)
    );
  end if;

  select hit_count into v_count
  from ai_ocr_ip_rate_buckets
  where bucket_key = p_bucket_key;

  return jsonb_build_object(
    'ok', false,
    'error', 'rate_limited',
    'window_kind', p_window_kind,
    'count', coalesce(v_count, p_limit),
    'limit', p_limit,
    'remaining', 0
  );
end;
$$;

grant execute on function public.consume_ocr_ip_rate_limit(text, text, integer, timestamptz, timestamptz) to service_role;

comment on function public.consume_ocr_ip_rate_limit(text, text, integer, timestamptz, timestamptz) is
  'OCR IP rate limit atomic consume · conditional increment where hit_count < limit';
