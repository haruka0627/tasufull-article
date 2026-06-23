# TASFUL MATCH — P15-L1 migration ドラフト

| 項目 | 内容 |
|------|------|
| 版 | v1.0（**ドラフト · 未適用**） |
| 作成日 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`**（linked ref · Hook ON · RLS D2） |
| 前提 | P15 計画 [`tasful-match-p15-feature-plan.md`](tasful-match-p15-feature-plan.md) **承認済み** |
| 適用 | **行わない**（本ドキュメント + 将来 migration ファイル化のみ） |
| 本番 URL | **`tasful.jp` 確認は 8 月まで保留** · 検証は prod-parity / linked ref |

---

## 1. スコープ

### 1.1 本 migration に含める

| 区分 | 対象 |
|------|------|
| 新規テーブル | `match_favorites` · `match_profile_views` · `match_saved_searches` · `match_user_settings` |
| 依存テーブル（P15 関数/VIEW 用） | `match_hobby_tags` · `match_profile_hobby_tags` |
| 既存拡張 | `match_profiles` 列追加（`last_active_at` は **既存列を利用** · 新規 ADD なし） |
| 関数 | `match_activity_label` · `match_footprint_label` · `match_profile_completeness` · `match_compatibility_score` · `match_prefecture_compat_score`（内部） |
| VIEW | `match_profiles_public`（L11 D2 · `talk_user_id` 準拠） |
| RLS | 新規 6 オブジェクト（4 表 + hobby 2）— **既存 8 表の 20 policies は不変** |

### 1.2 本 migration に含めない

| 除外 | 理由 |
|------|------|
| Edge Functions 実装 | P15-L3 |
| UI / client API | P15-L4/L5 |
| `match_sanctions` / `match_daily_limits` | 後回し |
| 既存 8 表 RLS 変更 | 回帰リスク · 20 policies 維持 |
| `auth.users` / Hook 変更 | legacy / allowlist 不変方針 |
| `tasful.jp` prod 検証 | 8 月まで保留 |

---

## 2. 既存 8 表への影響範囲

| テーブル | DDL 変更 | RLS 変更 | 読取（関数/VIEW） | 備考 |
|----------|----------|----------|-------------------|------|
| `match_profiles` | **ALTER** 5 列追加 | **なし** | completeness · compatibility · VIEW | `last_active_at` 既存 |
| `match_profile_photos` | なし | なし | completeness（approved 枚数） | |
| `match_profile_hobby_tags` | **新規作成**（join） | **新規 policies** | compatibility · VIEW | draft 昇格 |
| `match_swipes` | なし | なし | なし | お気に入りと独立 |
| `match_pairs` | なし | なし | なし | |
| `match_blocks` | なし | なし | VIEW 除外 · favorites CHECK | `match_users_are_blocked` 再利用 |
| `match_reports` | なし | なし | なし | |
| `match_verifications` | なし | なし | なし | |
| `match_moderation_logs` | なし | なし | なし | |

**不変保証:** legacy 7 `@tasful-dev.test` · allowlist T1–T5 metadata · Hook EXCEPTION · 既存 policy 名/定義は触らない。

---

## 3. 新規テーブル定義

### 3.1 `match_favorites`

| 列 | 型 | 制約 |
|----|-----|------|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_user_id` | text NOT NULL | = JWT `talk_user_id` |
| `target_user_id` | text NOT NULL | ≠ owner · block 対象不可 |
| `source` | text NOT NULL | `swipe` / `profile` / `search` |
| `note` | text | NULL 可 · ≤200 字 |
| `archived_at` | timestamptz | 論理削除 |
| `created_at` | timestamptz NOT NULL | `now()` |

**CHECK:** `owner_user_id <> target_user_id` · `source` enum

### 3.2 `match_profile_views`（足あと）

| 列 | 型 | 制約 |
|----|-----|------|
| `id` | uuid PK | |
| `viewer_user_id` | text NOT NULL | |
| `viewed_user_id` | text NOT NULL | |
| `source` | text NOT NULL | `swipe_card` / `profile_detail` / `favorites` |
| `viewed_at` | timestamptz NOT NULL | `now()` · UPSERT 更新 |
| `dedupe_bucket` | date NOT NULL | JST 日付 · UPSERT キー |

**CHECK:** `viewer_user_id <> viewed_user_id`

### 3.3 `match_saved_searches`

| 列 | 型 | 制約 |
|----|-----|------|
| `id` | uuid PK | |
| `user_id` | text NOT NULL | |
| `name` | text NOT NULL | 1–40 字 |
| `filters_json` | jsonb NOT NULL | `{}` 以上 |
| `is_default` | boolean NOT NULL | default false |
| `last_used_at` | timestamptz | |
| `archived_at` | timestamptz | |
| `created_at` / `updated_at` | timestamptz NOT NULL | trigger |

### 3.4 `match_user_settings`

| 列 | 型 | 制約 |
|----|-----|------|
| `user_id` | text PK | |
| `show_activity_status` | boolean NOT NULL | default **true** |
| `show_footprints_to_others` | boolean NOT NULL | default **true** |
| `receive_footprint_notifications` | boolean NOT NULL | default **true** |
| `created_at` / `updated_at` | timestamptz NOT NULL | |

### 3.5 `match_hobby_tags` / `match_profile_hobby_tags`（依存）

draft `20260621120000` から昇格。相性 · 完成度 · VIEW · 検索 `filters_json` に必要。

---

## 4. 既存 `match_profiles` 拡張案

| 列 | 型 | デフォルト | CHECK |
|----|-----|------------|-------|
| `purpose` | text | NULL | `love` / `marriage` / `friend` / `undecided` |
| `relationship_view` | text | NULL | ≤500 字 |
| `weekend_style` | text | NULL | ≤120 字 |
| `completeness_cached` | smallint | NULL | 0–100 |

**`last_active_at`:** L10 既存列 · index `match_profiles_last_active_at_idx` 既存。**ADD 不要。** Edge `match-bump-activity`（L3）が UPDATE。

---

## 5. Index / UNIQUE 案

| オブジェクト | 定義 |
|--------------|------|
| `match_favorites_owner_target_active_uidx` | UNIQUE `(owner_user_id, target_user_id)` WHERE `archived_at IS NULL` |
| `match_favorites_owner_created_idx` | `(owner_user_id, created_at DESC)` WHERE `archived_at IS NULL` |
| `match_profile_views_viewed_at_idx` | `(viewed_user_id, viewed_at DESC)` |
| `match_profile_views_viewer_at_idx` | `(viewer_user_id, viewed_at DESC)` |
| `match_profile_views_dedupe_uidx` | UNIQUE `(viewer_user_id, viewed_user_id, dedupe_bucket)` |
| `match_saved_searches_user_idx` | `(user_id, updated_at DESC)` WHERE `archived_at IS NULL` |
| `match_saved_searches_one_default_uidx` | UNIQUE `(user_id)` WHERE `is_default = true AND archived_at IS NULL` |
| `match_user_settings` | PK `(user_id)` のみ |

---

## 6. Helper / 計算関数案

| 関数 | 引数 | 戻り | 用途 |
|------|------|------|------|
| `match_activity_label` | `timestamptz` | text | 活動 bucket（オンライン中なし） |
| `match_footprint_label` | `timestamptz` | text | 今日/昨日/N日前 |
| `match_profile_completeness` | `text user_id` | jsonb | `{ percent, items[] }` |
| `match_compatibility_score` | `viewer_id, target_id` | jsonb | `{ percent, common_points[], score_raw }` |
| `match_prefecture_compat_score` | `pref_a, pref_b` | int | 内部 · 15/8/0 |
| `match_has_active_match_ban` | `user_id` | boolean | **L1 stub: 常に false**（`match_sanctions` 未導入） |

**相性ルール（`match_compatibility_score`）:**

| 一致 | 点 |
|------|-----|
| 趣味タグ 1 件 | +12（上限 36） |
| `purpose` 一致 | +20 |
| 同都道府県 | +15 |
| 隣接都道府県 | +8 |
| `weekend_style` 非空一致 | +10 |
| `relationship_view` 非空一致 | +15 |
| 年齢差 ≤3 | +10 · ≤7 | +5 |

`percent = least(99, score_raw)` · `common_points` 最大 5 件（日本語ラベル）

---

## 7. `match_profiles_public` VIEW 案

**方針（L11 D2 修正版）:**

- `match_current_user_id()` = JWT `talk_user_id`（`auth.uid()` **不使用**）
- `security_invoker = false`（VIEW owner が base table 読取）
- **他者に raw `last_active_at` を出さない** → `activity_label` のみ
- `match_user_settings.show_activity_status = false` のユーザーは `activity_label = NULL`
- block 双方向除外 · self 除外 · `profile_status = active'`
- `match_has_active_match_ban` = false stub（将来 sanctions 接続）

**公開列:** `profile_id`, `user_id`, `display_name`, `age`, `prefecture`, `city`, `bio`, `purpose`, `weekend_style`, `relationship_view`, `verification_status`, `main_photo_url`, `hobby_tags[]`, `activity_label`, `created_at`

---

## 8. RLS policy 案（新規のみ）

**パターン:** L11 継承 · `match_current_user_id()` · `anon` revoke · `service_role` bypass

| テーブル | Policies |
|----------|----------|
| `match_favorites` | select/insert/update own（archive = update） |
| `match_profile_views` | select incoming `viewed_user_id = me` · **insert/update なし**（Edge/service_role） |
| `match_saved_searches` | select/insert/update own |
| `match_user_settings` | select/insert/update own |
| `match_hobby_tags` | select active tags · authenticated |
| `match_profile_hobby_tags` | select/insert/delete own profile join |

**VIEW:** `grant select on match_profiles_public to authenticated`

**既存 8 表:** policy 数 **20 のまま**（本 migration では `drop policy` しない）

---

## 9. Migration ファイル構成（将来）

| ファイル | 内容 | 適用順 |
|----------|------|--------|
| `supabase/migrations/20260622190000_match_p15_l1_schema.sql` | 表 · ALTER · 関数 · VIEW · seed hobby | 1 |
| `supabase/migrations/20260622191000_match_p15_l1_rls.sql` | enable RLS · policies · grants | 2 |

L10/L11 と同様 **schema → RLS の 2 段**。本レポート §10 に統合草案 SQL を記載（セクションコメントで分割可能）。

---

## 10. Migration SQL 草案

> **DO NOT APPLY** — linked ref レビュー · legacy/allowlist gate PASS 後のみ。

```sql
-- ============================================================================
-- P15-L1: MATCH schema extension (DRAFT · NOT APPLIED)
-- Ref: ddojquacsyqesrjhcvmn · Prerequisite: L10 + L11 applied
-- Does NOT modify auth.users · Hook · existing 8-table RLS policies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. Hobby master (dependency for completeness / compatibility / VIEW)
-- ---------------------------------------------------------------------------

create table if not exists public.match_hobby_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label_ja text not null,
  display_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_hobby_tags_slug_key unique (slug)
);

create index if not exists match_hobby_tags_active_order_idx
  on public.match_hobby_tags (is_active, display_order);

drop trigger if exists match_hobby_tags_set_updated_at on public.match_hobby_tags;
create trigger match_hobby_tags_set_updated_at
  before update on public.match_hobby_tags
  for each row execute function public.match_set_updated_at();

create table if not exists public.match_profile_hobby_tags (
  profile_id uuid not null references public.match_profiles (id) on delete cascade,
  hobby_tag_id uuid not null references public.match_hobby_tags (id) on delete restrict,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (profile_id, hobby_tag_id),
  constraint match_profile_hobby_tags_display_order_check check (
    display_order between 0 and 4
  )
);

create index if not exists match_profile_hobby_tags_hobby_tag_id_idx
  on public.match_profile_hobby_tags (hobby_tag_id);

-- Optional seed (idempotent) — expand in staging review
insert into public.match_hobby_tags (slug, label_ja, display_order)
values
  ('travel', '旅行', 10),
  ('cooking', '料理', 20),
  ('sports', 'スポーツ', 30),
  ('music', '音楽', 40),
  ('movies', '映画', 50)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- B. match_profiles extension (last_active_at already exists from L10)
-- ---------------------------------------------------------------------------

alter table public.match_profiles
  add column if not exists purpose text,
  add column if not exists relationship_view text,
  add column if not exists weekend_style text,
  add column if not exists completeness_cached smallint;

alter table public.match_profiles
  drop constraint if exists match_profiles_purpose_check;

alter table public.match_profiles
  add constraint match_profiles_purpose_check check (
    purpose is null or purpose in ('love', 'marriage', 'friend', 'undecided')
  );

alter table public.match_profiles
  drop constraint if exists match_profiles_relationship_view_length_check;

alter table public.match_profiles
  add constraint match_profiles_relationship_view_length_check check (
    relationship_view is null or char_length(relationship_view) <= 500
  );

alter table public.match_profiles
  drop constraint if exists match_profiles_weekend_style_length_check;

alter table public.match_profiles
  add constraint match_profiles_weekend_style_length_check check (
    weekend_style is null or char_length(weekend_style) <= 120
  );

alter table public.match_profiles
  drop constraint if exists match_profiles_completeness_cached_check;

alter table public.match_profiles
  add constraint match_profiles_completeness_cached_check check (
    completeness_cached is null
    or completeness_cached between 0 and 100
  );

create index if not exists match_profiles_purpose_active_idx
  on public.match_profiles (purpose, profile_status)
  where archived_at is null and profile_status = 'active';

-- ---------------------------------------------------------------------------
-- C. P15 core tables
-- ---------------------------------------------------------------------------

create table if not exists public.match_favorites (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  target_user_id text not null,
  source text not null default 'profile',
  note text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint match_favorites_not_self_check check (owner_user_id <> target_user_id),
  constraint match_favorites_source_check check (
    source in ('swipe', 'profile', 'search')
  ),
  constraint match_favorites_note_length_check check (
    note is null or char_length(note) <= 200
  )
);

create unique index if not exists match_favorites_owner_target_active_uidx
  on public.match_favorites (owner_user_id, target_user_id)
  where archived_at is null;

create index if not exists match_favorites_owner_created_idx
  on public.match_favorites (owner_user_id, created_at desc)
  where archived_at is null;

create table if not exists public.match_profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id text not null,
  viewed_user_id text not null,
  source text not null default 'profile_detail',
  viewed_at timestamptz not null default now(),
  dedupe_bucket date not null default (timezone('Asia/Tokyo', now()))::date,
  constraint match_profile_views_not_self_check check (
    viewer_user_id <> viewed_user_id
  ),
  constraint match_profile_views_source_check check (
    source in ('swipe_card', 'profile_detail', 'favorites')
  )
);

create unique index if not exists match_profile_views_dedupe_uidx
  on public.match_profile_views (viewer_user_id, viewed_user_id, dedupe_bucket);

create index if not exists match_profile_views_viewed_at_idx
  on public.match_profile_views (viewed_user_id, viewed_at desc);

create index if not exists match_profile_views_viewer_at_idx
  on public.match_profile_views (viewer_user_id, viewed_at desc);

create table if not exists public.match_saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  filters_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  last_used_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_saved_searches_name_length_check check (
    char_length(name) between 1 and 40
  ),
  constraint match_saved_searches_filters_object_check check (
    jsonb_typeof(filters_json) = 'object'
  )
);

create index if not exists match_saved_searches_user_idx
  on public.match_saved_searches (user_id, updated_at desc)
  where archived_at is null;

create unique index if not exists match_saved_searches_one_default_uidx
  on public.match_saved_searches (user_id)
  where is_default = true and archived_at is null;

drop trigger if exists match_saved_searches_set_updated_at on public.match_saved_searches;
create trigger match_saved_searches_set_updated_at
  before update on public.match_saved_searches
  for each row execute function public.match_set_updated_at();

create table if not exists public.match_user_settings (
  user_id text primary key,
  show_activity_status boolean not null default true,
  show_footprints_to_others boolean not null default true,
  receive_footprint_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists match_user_settings_set_updated_at on public.match_user_settings;
create trigger match_user_settings_set_updated_at
  before update on public.match_user_settings
  for each row execute function public.match_set_updated_at();

comment on table public.match_favorites is 'P15: pre-match bookmarks (distinct from match_swipes.like).';
comment on table public.match_profile_views is 'P15: profile footprints · daily dedupe via dedupe_bucket (JST).';
comment on table public.match_saved_searches is 'P15: saved discovery filters (filters_json).';
comment on table public.match_user_settings is 'P15: privacy toggles for activity/footprints.';

-- ---------------------------------------------------------------------------
-- D. Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.match_has_active_match_ban(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- L1 stub: match_sanctions not migrated yet. Replace when sanctions ship.
  select false;
$$;

comment on function public.match_has_active_match_ban(text) is
  'P15-L1 stub returns false until match_sanctions exists.';

create or replace function public.match_activity_label(p_last_active_at timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_last_active_at is null then 'しばらく未活動'
    when p_last_active_at >= now() - interval '24 hours' then '24時間以内に活動'
    when p_last_active_at >= now() - interval '3 days' then '3日以内に活動'
    when p_last_active_at >= now() - interval '7 days' then '1週間以内に活動'
    else 'しばらく未活動'
  end;
$$;

create or replace function public.match_footprint_label(p_viewed_at timestamptz)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_viewed date;
  v_today date;
  v_diff integer;
begin
  if p_viewed_at is null then
    return '不明';
  end if;
  v_viewed := (p_viewed_at at time zone 'Asia/Tokyo')::date;
  v_today := (timezone('Asia/Tokyo', now()))::date;
  v_diff := v_today - v_viewed;
  if v_diff = 0 then
    return '今日';
  elsif v_diff = 1 then
    return '昨日';
  elsif v_diff < 7 then
    return v_diff || '日前';
  else
    return '1週間以上前';
  end if;
end;
$$;

create or replace function public.match_prefecture_compat_score(p_pref_a text, p_pref_b text)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  a text := nullif(trim(p_pref_a), '');
  b text := nullif(trim(p_pref_b), '');
begin
  if a is null or b is null then
    return 0;
  end if;
  if a = b then
    return 15;
  end if;
  -- Kanto adjacency (extend in later migration)
  if (a, b) in (
    ('東京都', '神奈川県'), ('神奈川県', '東京都'),
    ('東京都', '埼玉県'), ('埼玉県', '東京都'),
    ('東京都', '千葉県'), ('千葉県', '東京都'),
    ('神奈川県', '埼玉県'), ('埼玉県', '神奈川県'),
    ('神奈川県', '千葉県'), ('千葉県', '神奈川県'),
    ('埼玉県', '千葉県'), ('千葉県', '埼玉県')
  ) then
    return 8;
  end if;
  return 0;
end;
$$;

create or replace function public.match_profile_completeness(p_user_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.match_profiles%rowtype;
  v_photo_ok boolean := false;
  v_hobby_count integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_done integer := 0;
  v_total constant integer := 8;
  v_percent integer;
begin
  select * into v_profile
  from public.match_profiles p
  where p.user_id = p_user_id
    and p.archived_at is null
  limit 1;

  if not found then
    return jsonb_build_object(
      'percent', 0,
      'items', '[]'::jsonb,
      'code', 'profile_not_found'
    );
  end if;

  select exists (
    select 1
    from public.match_profile_photos ph
    where ph.profile_id = v_profile.id
      and ph.photo_status = 'active'
      and ph.archived_at is null
      and ph.moderation_status = 'approved'
  ) into v_photo_ok;

  select count(*)::integer into v_hobby_count
  from public.match_profile_hobby_tags pht
  where pht.profile_id = v_profile.id;

  v_items := v_items || jsonb_build_object('key', 'photo', 'label', '写真', 'done', v_photo_ok, 'weight', 20);
  v_items := v_items || jsonb_build_object('key', 'bio', 'label', '自己紹介', 'done', coalesce(length(trim(v_profile.bio)), 0) > 0, 'weight', 15);
  v_items := v_items || jsonb_build_object('key', 'age', 'label', '年齢', 'done', v_profile.birth_date is not null, 'weight', 10);
  v_items := v_items || jsonb_build_object('key', 'region', 'label', '地域', 'done', coalesce(length(trim(v_profile.prefecture)), 0) > 0, 'weight', 10);
  v_items := v_items || jsonb_build_object('key', 'hobby', 'label', '趣味', 'done', v_hobby_count >= 1, 'weight', 15);
  v_items := v_items || jsonb_build_object('key', 'purpose', 'label', '目的', 'done', v_profile.purpose is not null, 'weight', 10);
  v_items := v_items || jsonb_build_object('key', 'relationship_view', 'label', '恋愛観', 'done', coalesce(length(trim(v_profile.relationship_view)), 0) > 0, 'weight', 10);
  v_items := v_items || jsonb_build_object('key', 'verification', 'label', '本人確認', 'done', v_profile.verification_status in ('verified', 'phone_verified'), 'weight', 10);

  select count(*)::integer into v_done
  from jsonb_array_elements(v_items) elem
  where (elem->>'done')::boolean;

  v_percent := round((v_done::numeric / v_total) * 100)::integer;

  return jsonb_build_object(
    'percent', v_percent,
    'items', v_items,
    'done_count', v_done,
    'total_count', v_total
  );
end;
$$;

create or replace function public.match_compatibility_score(
  p_viewer_user_id text,
  p_target_user_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer public.match_profiles%rowtype;
  v_target public.match_profiles%rowtype;
  v_score integer := 0;
  v_hobby_matches integer := 0;
  v_age_diff integer;
  v_common jsonb := '[]'::jsonb;
  v_slug text;
  v_label text;
begin
  if p_viewer_user_id is null or p_target_user_id is null then
    return jsonb_build_object('percent', 0, 'common_points', '[]'::jsonb, 'code', 'invalid_user');
  end if;
  if p_viewer_user_id = p_target_user_id then
    return jsonb_build_object('percent', 0, 'common_points', '[]'::jsonb, 'code', 'self');
  end if;
  if public.match_users_are_blocked(p_viewer_user_id, p_target_user_id) then
    return jsonb_build_object('percent', 0, 'common_points', '[]'::jsonb, 'code', 'blocked');
  end if;

  select * into v_viewer from public.match_profiles where user_id = p_viewer_user_id and archived_at is null;
  select * into v_target from public.match_profiles where user_id = p_target_user_id and archived_at is null;

  if v_viewer.id is null or v_target.id is null then
    return jsonb_build_object('percent', 0, 'common_points', '[]'::jsonb, 'code', 'profile_not_found');
  end if;

  select least(count(*)::integer, 3) into v_hobby_matches
  from public.match_profile_hobby_tags vh
  inner join public.match_profile_hobby_tags th
    on th.hobby_tag_id = vh.hobby_tag_id
  where vh.profile_id = v_viewer.id
    and th.profile_id = v_target.id;

  if v_hobby_matches > 0 then
    v_score := v_score + (v_hobby_matches * 12);
    for v_slug, v_label in
      select ht.slug, ht.label_ja
      from public.match_profile_hobby_tags vh
      inner join public.match_profile_hobby_tags th on th.hobby_tag_id = vh.hobby_tag_id
      inner join public.match_hobby_tags ht on ht.id = vh.hobby_tag_id
      where vh.profile_id = v_viewer.id and th.profile_id = v_target.id
      order by ht.display_order
      limit 3
    loop
      v_common := v_common || jsonb_build_object('key', 'hobby:' || v_slug, 'label', '趣味: ' || v_label);
    end loop;
  end if;

  if v_viewer.purpose is not null and v_viewer.purpose = v_target.purpose then
    v_score := v_score + 20;
    v_common := v_common || jsonb_build_object('key', 'purpose', 'label', '目的が同じ');
  end if;

  v_score := v_score + public.match_prefecture_compat_score(v_viewer.prefecture, v_target.prefecture);
  if v_viewer.prefecture is not null and v_viewer.prefecture = v_target.prefecture then
    v_common := v_common || jsonb_build_object('key', 'prefecture', 'label', '同じ都道府県');
  end if;

  if coalesce(trim(v_viewer.weekend_style), '') <> ''
     and trim(v_viewer.weekend_style) = trim(v_target.weekend_style) then
    v_score := v_score + 10;
    v_common := v_common || jsonb_build_object('key', 'weekend', 'label', '休日の過ごし方が同じ');
  end if;

  if coalesce(trim(v_viewer.relationship_view), '') <> ''
     and trim(v_viewer.relationship_view) = trim(v_target.relationship_view) then
    v_score := v_score + 15;
    v_common := v_common || jsonb_build_object('key', 'relationship_view', 'label', '恋愛観が同じ');
  end if;

  v_age_diff := abs(
    extract(year from age(current_date, v_viewer.birth_date))
    - extract(year from age(current_date, v_target.birth_date))
  )::integer;

  if v_age_diff <= 3 then
    v_score := v_score + 10;
  elsif v_age_diff <= 7 then
    v_score := v_score + 5;
  end if;

  return jsonb_build_object(
    'percent', least(99, v_score),
    'score_raw', v_score,
    'common_points', v_common,
    'common_count', jsonb_array_length(v_common)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- E. Public discovery VIEW (L11 D2: talk_user_id via match_current_user_id)
-- ---------------------------------------------------------------------------

create or replace view public.match_profiles_public
with (security_invoker = false)
as
select
  p.id as profile_id,
  p.user_id,
  p.nickname as display_name,
  extract(year from age(current_date, p.birth_date))::integer as age,
  p.prefecture,
  p.city,
  p.bio,
  p.purpose,
  p.weekend_style,
  p.relationship_view,
  p.verification_status,
  ph.storage_path as main_photo_url,
  coalesce(
    (
      select array_agg(ht.label_ja order by pht.display_order)
      from public.match_profile_hobby_tags pht
      inner join public.match_hobby_tags ht on ht.id = pht.hobby_tag_id
      where pht.profile_id = p.id and ht.is_active = true
    ),
    '{}'::text[]
  ) as hobby_tags,
  case
    when coalesce(us.show_activity_status, true) = false then null
    else public.match_activity_label(p.last_active_at)
  end as activity_label,
  p.created_at
from public.match_profiles p
left join public.match_profile_photos ph
  on ph.id = p.main_photo_id
  and ph.photo_status = 'active'
  and ph.archived_at is null
  and ph.moderation_status = 'approved'
left join public.match_user_settings us
  on us.user_id = p.user_id
where p.profile_status = 'active'
  and p.archived_at is null
  and not public.match_has_active_match_ban(p.user_id)
  and public.match_current_user_id() is not null
  and p.user_id <> public.match_current_user_id()
  and not public.match_users_are_blocked(
    public.match_current_user_id(),
    p.user_id
  );

comment on view public.match_profiles_public is
  'P15: discoverable profiles. No raw last_active_at · activity_label only. D2 talk_user_id.';

revoke all on public.match_profiles_public from public;
grant select on public.match_profiles_public to authenticated;

-- ============================================================================
-- END schema file · RLS in 20260622191000_match_p15_l1_rls.sql (draft below)
-- ============================================================================
```

### 10.1 RLS migration 草案（`20260622191000_match_p15_l1_rls.sql`）

```sql
-- ============================================================================
-- P15-L1 RLS (DRAFT · NOT APPLIED)
-- Prerequisite: 20260622190000_match_p15_l1_schema.sql
-- Does NOT alter existing 8-table policies (count must stay 20)
-- ============================================================================

alter table public.match_hobby_tags enable row level security;
alter table public.match_profile_hobby_tags enable row level security;
alter table public.match_favorites enable row level security;
alter table public.match_profile_views enable row level security;
alter table public.match_saved_searches enable row level security;
alter table public.match_user_settings enable row level security;

revoke all on public.match_hobby_tags from anon;
revoke all on public.match_profile_hobby_tags from anon;
revoke all on public.match_favorites from anon;
revoke all on public.match_profile_views from anon;
revoke all on public.match_saved_searches from anon;
revoke all on public.match_user_settings from anon;

-- match_hobby_tags: read active master
drop policy if exists match_hobby_tags_select_active on public.match_hobby_tags;
create policy match_hobby_tags_select_active
  on public.match_hobby_tags for select to authenticated
  using (is_active = true);

-- match_profile_hobby_tags: owner join
drop policy if exists match_profile_hobby_tags_select_own on public.match_profile_hobby_tags;
create policy match_profile_hobby_tags_select_own
  on public.match_profile_hobby_tags for select to authenticated
  using (
    exists (
      select 1 from public.match_profiles mp
      where mp.id = profile_id and mp.user_id = public.match_current_user_id()
    )
  );

drop policy if exists match_profile_hobby_tags_insert_own on public.match_profile_hobby_tags;
create policy match_profile_hobby_tags_insert_own
  on public.match_profile_hobby_tags for insert to authenticated
  with check (
    exists (
      select 1 from public.match_profiles mp
      where mp.id = profile_id and mp.user_id = public.match_current_user_id()
    )
  );

drop policy if exists match_profile_hobby_tags_delete_own on public.match_profile_hobby_tags;
create policy match_profile_hobby_tags_delete_own
  on public.match_profile_hobby_tags for delete to authenticated
  using (
    exists (
      select 1 from public.match_profiles mp
      where mp.id = profile_id and mp.user_id = public.match_current_user_id()
    )
  );

-- match_favorites
drop policy if exists match_favorites_select_own on public.match_favorites;
create policy match_favorites_select_own
  on public.match_favorites for select to authenticated
  using (owner_user_id = public.match_current_user_id());

drop policy if exists match_favorites_insert_own on public.match_favorites;
create policy match_favorites_insert_own
  on public.match_favorites for insert to authenticated
  with check (
    owner_user_id = public.match_current_user_id()
    and owner_user_id <> target_user_id
    and not public.match_users_are_blocked(owner_user_id, target_user_id)
    and archived_at is null
  );

drop policy if exists match_favorites_update_own on public.match_favorites;
create policy match_favorites_update_own
  on public.match_favorites for update to authenticated
  using (owner_user_id = public.match_current_user_id())
  with check (owner_user_id = public.match_current_user_id());

-- match_profile_views: incoming only · writes via Edge/service_role
drop policy if exists match_profile_views_select_incoming on public.match_profile_views;
create policy match_profile_views_select_incoming
  on public.match_profile_views for select to authenticated
  using (
    viewed_user_id = public.match_current_user_id()
    and not public.match_users_are_blocked(viewer_user_id, viewed_user_id)
  );

-- match_saved_searches
drop policy if exists match_saved_searches_select_own on public.match_saved_searches;
create policy match_saved_searches_select_own
  on public.match_saved_searches for select to authenticated
  using (user_id = public.match_current_user_id());

drop policy if exists match_saved_searches_insert_own on public.match_saved_searches;
create policy match_saved_searches_insert_own
  on public.match_saved_searches for insert to authenticated
  with check (user_id = public.match_current_user_id());

drop policy if exists match_saved_searches_update_own on public.match_saved_searches;
create policy match_saved_searches_update_own
  on public.match_saved_searches for update to authenticated
  using (user_id = public.match_current_user_id())
  with check (user_id = public.match_current_user_id());

-- match_user_settings
drop policy if exists match_user_settings_select_own on public.match_user_settings;
create policy match_user_settings_select_own
  on public.match_user_settings for select to authenticated
  using (user_id = public.match_current_user_id());

drop policy if exists match_user_settings_insert_own on public.match_user_settings;
create policy match_user_settings_insert_own
  on public.match_user_settings for insert to authenticated
  with check (user_id = public.match_current_user_id());

drop policy if exists match_user_settings_update_own on public.match_user_settings;
create policy match_user_settings_update_own
  on public.match_user_settings for update to authenticated
  using (user_id = public.match_current_user_id())
  with check (user_id = public.match_current_user_id());
```

**新規 policy 数:** 14（hobby 3 + favorites 3 + views 1 + saved 3 + settings 3 + hobby_tags 1）

**適用後 合計:** 既存 20 + 新規 14 = **34**（core 8 表は 20 のまま）

---

## 11. Rollback SQL

> 適用失敗時 · staging 検証後の巻き戻し用。**本番では PITR 無効のため慎重に。**

```sql
-- Rollback order: RLS policies → VIEW → functions → tables → profile columns → hobby

-- --- RLS file rollback ---
drop policy if exists match_user_settings_update_own on public.match_user_settings;
drop policy if exists match_user_settings_insert_own on public.match_user_settings;
drop policy if exists match_user_settings_select_own on public.match_user_settings;
drop policy if exists match_saved_searches_update_own on public.match_saved_searches;
drop policy if exists match_saved_searches_insert_own on public.match_saved_searches;
drop policy if exists match_saved_searches_select_own on public.match_saved_searches;
drop policy if exists match_profile_views_select_incoming on public.match_profile_views;
drop policy if exists match_favorites_update_own on public.match_favorites;
drop policy if exists match_favorites_insert_own on public.match_favorites;
drop policy if exists match_favorites_select_own on public.match_favorites;
drop policy if exists match_profile_hobby_tags_delete_own on public.match_profile_hobby_tags;
drop policy if exists match_profile_hobby_tags_insert_own on public.match_profile_hobby_tags;
drop policy if exists match_profile_hobby_tags_select_own on public.match_profile_hobby_tags;
drop policy if exists match_hobby_tags_select_active on public.match_hobby_tags;

alter table public.match_user_settings disable row level security;
alter table public.match_saved_searches disable row level security;
alter table public.match_profile_views disable row level security;
alter table public.match_favorites disable row level security;
alter table public.match_profile_hobby_tags disable row level security;
alter table public.match_hobby_tags disable row level security;

-- --- Schema file rollback ---
drop view if exists public.match_profiles_public;

drop function if exists public.match_compatibility_score(text, text);
drop function if exists public.match_profile_completeness(text);
drop function if exists public.match_prefecture_compat_score(text, text);
drop function if exists public.match_footprint_label(timestamptz);
drop function if exists public.match_activity_label(timestamptz);
-- Only drop stub if no other deps; else replace with pre-P15 version from draft
drop function if exists public.match_has_active_match_ban(text);

drop table if exists public.match_user_settings;
drop table if exists public.match_saved_searches;
drop table if exists public.match_profile_views;
drop table if exists public.match_favorites;
drop table if exists public.match_profile_hobby_tags;
drop table if exists public.match_hobby_tags;

alter table public.match_profiles
  drop column if exists completeness_cached,
  drop column if exists weekend_style,
  drop column if exists relationship_view,
  drop column if exists purpose;

-- Verify: core 8 tables · 20 policies · legacy 7 · allowlist 5 unchanged
```

**部分 rollback:** 新表のみ DROP 可能。`match_profiles` 列 DROP は空 DB/staging のみ推奨（既存行がある場合はダウンタイム計画）。

---

## 12. 適用前 gate

**ファイル（計画）:** `sql/match-p15-l1-pre-gates.sql`

```bash
npx supabase db query --linked --yes -f sql/match-post-auth-final-smoke-readonly.sql
npx supabase db query --linked --yes -f sql/match-p15-l1-pre-gates.sql
```

| # | 指標 | 期待 | 失敗時 |
|---|------|------|--------|
| G1 | `legacy_user_count` | **7** | STOP · metadata 調査 |
| G2 | `allowlist_backfill_count` | **5** · talk/member = t1–t5 | STOP |
| G3 | `hook_exception_mode` | **1** | STOP · Hook 回帰 |
| G4 | `core_table_count` | **8** | STOP · L10 未適用 |
| G5 | `rls_enabled_count`（core 8） | **8** | STOP · L11 未適用 |
| G6 | `policy_count`（core 8） | **20** | STOP · L11 改変検知 |
| G7 | P15 新表 count | **0** | STOP · 二重適用 |
| G8 | `match_profiles_public` | **存在しない** | 既存 VIEW 確認 |
| G9 | auth/rest/edge 5xx | **なし** | インフラ確認 |

**Pre-gate SQL 草案:**

```sql
-- match-p15-l1-pre-gates.sql (DRAFT)
select count(*)::int as p15_favorites_exists
from information_schema.tables
where table_schema = 'public' and table_name = 'match_favorites';

select count(*)::int as p15_views_exists
from information_schema.tables
where table_schema = 'public' and table_name = 'match_profile_views';

select count(*)::int as public_view_exists
from information_schema.views
where table_schema = 'public' and table_name = 'match_profiles_public';

-- expect 0, 0, 0 before apply
```

---

## 13. 適用後 smoke

**ファイル（計画）:** `sql/match-p15-l1-verify-gates.sql` · `scripts/verify-match-p15-l1-schema.mjs`

| # | 確認 | 期待 |
|---|------|------|
| S1 | 新表 6 + hobby 2 | 存在 |
| S2 | `match_profiles` 拡張列 | 4 列 |
| S3 | `last_active_at` | 列維持 · index 維持 |
| S4 | 関数 5 + stub ban | `pg_proc` 存在 |
| S5 | `match_profiles_public` | SELECT 可能（T1 JWT） |
| S6 | RLS 新表 6 | enabled |
| S7 | 新 policy 数 | **14** |
| S8 | core 8 policy 数 | **20**（不変） |
| S9 | legacy / allowlist | **7 / 5** 不変 |
| S10 | `match_profile_completeness('t1')` | jsonb · percent 0–100 |
| S11 | `match_compatibility_score('t1','t2')` | jsonb · blocked/self ガード |
| S12 | `match_activity_label(now())` | `24時間以内に活動` |
| S13 | Edge smoke 7 件 | 既存 PASS 維持 |
| S14 | prod-parity | **8 月まで tasful.jp 除外** |

**RLS スポット（T1 JWT · REST）:**

| ケース | 期待 |
|--------|------|
| T1 INSERT own favorite → t2 | 200/201 |
| T1 SELECT T2 incoming footprints | 拒否（views は T2 のみ） |
| T2 SELECT own incoming | 可 |
| T1 INSERT footprint row direct | 拒否（policy なし） |
| anon SELECT `match_profiles_public` | 拒否 |

---

## 14. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| `match_has_active_match_ban` stub | 制裁ユーザーが VIEW に残る | L1 注記 · sanctions 導入時に差替 · 運営 Edge フィルタ |
| VIEW `security_invoker=false` | 権限昇格懸念 | 公開列最小 · raw timestamp 非公開 · grant authenticated のみ |
| hobby seed 不足 | 相性/完成度が常に低い | staging で seed 拡充 · UI マスタ同期手順 |
| 都道府県隣接表が関東のみ | 地方ユーザーで相性偏低 | 関数内コメント · 後続 migration で拡張 |
| `match_profile_completeness` SECURITY DEFINER | 他 user 読取 | Edge のみ expose · REST 直叩き禁止設計 |
| 二重 migration 適用 | 制約エラー | pre-gate G7 · migration 履歴管理 |
| legacy metadata 汚染 | 本番事故 | 適用前後 smoke SQL · auth.users 非触 |
| 既存 20 policies 破壊 | MATCH 全停止 | RLS ファイルで core 8 に touch しない · verify policy_count |
| footprints プライバシー | 苦情 | settings デフォルト ON · 将来 OFF · block 連動 |
| prod 未確認 | 本番差分 | 8 月まで prod-parity · dist sync CI |

---

## 15. 次アクション

| 順 | 作業 | 状態 |
|----|------|------|
| 1 | 本ドラフトレビュー（法務 · プライバシー文言） | **待ち** |
| 2 | `sql/match-p15-l1-pre-gates.sql` / verify-gates 作成 | 未着手 |
| 3 | migration ファイルを `supabase/migrations/` に配置 | **未着手（適用禁止）** |
| 4 | linked ref staging 適用 + smoke | 未着手 |
| 5 | P15-L2 確認（本 L1 に RLS 含むため L2=Edge 前提確認） | 計画書更新予定 |
| 6 | P15-L3 Edge 実装 | 未着手 |

**判定（本フェーズ）:** **P15-L1 migration ドラフト完成 — 適用待ち（レビュー後）**

---

## 16. 参照

| 文档 | 路径 |
|------|------|
| P15 機能計画 | `reports/tasful-match-p15-feature-plan.md` |
| L10 schema | `supabase/migrations/20260621160000_create_match_schema.sql` |
| L11 RLS D2 | `supabase/migrations/20260621170000_match_rls_d2.sql` |
| RLS/view draft | `supabase/migrations/20260621130000_match_rls_draft.sql` |
| Final smoke gates | `sql/match-post-auth-final-smoke-readonly.sql` |
| prod URL review | `reports/tasful-match-ui-prod-url-review.md` |
