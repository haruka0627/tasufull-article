# TASFUL LIVE → YouTube型 P1 — Phase 1 migration 適用結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日 | 2026-06-23 |
| 環境 | staging `ddojquacsyqesrjhcvmn` |
| 前提 | Phase 0 / 0.5 CONDITIONAL GO |
| 適用方法 | **個別 SQL**（`db push` 未使用） |

---

## 最終判定

| 判定 | **GO** |
|------|--------|
| 意味 | Phase 1 migration は staging へ正常適用。4 テーブル · `live-videos` bucket · RLS · RPC が揃い、anon 公開 SELECT / 権限ユーザー INSERT / 長尺 duration 制約 / 既存ショート回帰が確認済み。**Phase 2 Edge（`live-video-signed-url` 等）に進行可能。** |

---

## 作成した migration

| ファイル | 内容 |
|----------|------|
| [`supabase/migrations/20260701100000_live_videos_p1.sql`](../supabase/migrations/20260701100000_live_videos_p1.sql) | YouTube 型長尺動画の DB / Storage / RLS / RPC |

**タイムスタンプ:** `20260701100000`（直近 `20260630100001_partner_p1_auth_hook` の次）

---

## 作成テーブル一覧

### live_videos

| カラム | 型 | 備考 |
|--------|-----|------|
| `id` | uuid PK | `gen_random_uuid()` |
| `talk_user_id` | **text** not null | 既存 `live_shorts.creator_id` と同型 |
| `creator_profile_id` | text nullable | FK → `live_creator_profiles(user_id)` |
| `title` | text not null | 1〜120 文字 |
| `description` | text nullable | ≤5000 文字 |
| `video_path` | text not null | 非空 · bucket `live-videos` |
| `thumbnail_path` | text nullable | |
| `duration_sec` | integer nullable | **NULL または > 60**（ショートと分離） |
| `file_size_bytes` | bigint nullable | |
| `mime_type` | text nullable | |
| `status` | text default `draft` | `draft` / `processing` / `published` / `hidden` / `removed` |
| `visibility` | text default `public` | `public` / `unlisted` / `private` |
| `views_count` | bigint default 0 | owner 直接更新禁止（guard trigger） |
| `likes_count` | bigint default 0 | trigger で同期 |
| `reports_count` | bigint default 0 | trigger で同期 |
| `published_at` | timestamptz nullable | |
| `created_at` / `updated_at` | timestamptz | `live_set_updated_at` trigger |

### live_video_likes

| カラム | 型 | 備考 |
|--------|-----|------|
| `id` | uuid PK | |
| `video_id` | uuid FK | `on delete cascade` |
| `talk_user_id` | text not null | |
| `created_at` | timestamptz | |
| **unique** | `(video_id, talk_user_id)` | |

### live_video_reports

| カラム | 型 | 備考 |
|--------|-----|------|
| `id` | uuid PK | |
| `video_id` | uuid FK | |
| `reporter_talk_user_id` | text not null | |
| `reason` | text | `spam` / `abuse` / `copyright` / `illegal` / `other` |
| `detail` | text nullable | |
| `status` | text default `open` | `open` / `reviewing` / `resolved` / `dismissed` |
| `reviewed_at` | timestamptz nullable | |
| `reviewed_by` | **text** nullable | 管理者 `talk_user_id`（既存 admin 判定に合わせ text） |

### live_video_ads（P1 最小）

| カラム | 型 | 備考 |
|--------|-----|------|
| `id` | uuid PK | |
| `video_id` | uuid FK | 動画単位の手動枠 |
| `ad_type` | text default `manual` | `manual` / `pre_roll` / `mid_roll` / `overlay` |
| `position_sec` | integer nullable | ≥ 0 |
| `label` / `target_url` | text nullable | |
| `is_active` | boolean default **false** | 本格配信なし |

---

## 作成 bucket

| bucket | public | file_size_limit | MIME | パス規約 |
|--------|--------|-----------------|------|----------|
| **`live-videos`** | **false** | 2 GB (2147483648) | `video/mp4` | `{talk_user_id}/{video_id}.mp4` |

Storage RLS: `live_storage_live_videos_*`（`live_storage_owner_matches` + `live_has_broadcast_permission` · P0 `short-videos` と同型）

**サムネイル:** 専用 bucket は未作成。`thumbnail_path` は既存 `live-thumbnails`（public）または `live-videos` 内パスを Phase 2 JS で指定予定。

---

## RLS 方針

既存 LIVE P0 パターン（`talk_current_user_id()` · `talk_is_admin()` · `live_has_broadcast_permission()` · `live_is_public_creator()`）に準拠。

### live_videos（5 + admin）

| Policy | 対象 | 条件 |
|--------|------|------|
| `live_videos_select_public` | **anon, authenticated** | `published` + `visibility IN (public, unlisted)` + 公開クリエイター |
| `live_videos_select_own` | authenticated | `talk_user_id = talk_current_user_id()`（private / draft 含む） |
| `live_videos_insert_own` | authenticated | 本人 + `live_has_broadcast_permission()` |
| `live_videos_update_own` / `delete_own` | authenticated | 本人のみ |
| `live_videos_admin_all` | authenticated | `talk_is_admin()` |

**設計メモ:**

- `published + public` は **anon SELECT 可**（P1 要件 · ショートより緩い）
- `unlisted` も direct URL 用に SELECT 可（一覧フィルタはアプリ側）
- `private` / `draft` / `processing` / `hidden` / `removed` は本人 or admin のみ

### live_video_likes

- SELECT: 自分のいいね / 視聴可能動画のいいね / 自分の動画のいいね
- INSERT/DELETE: 本人 · 公開動画のみ
- admin: ALL

### live_video_reports

- INSERT: 本人が reporter · 視聴可能動画のみ
- SELECT: 本人の通報のみ
- UPDATE: admin のみ

### live_video_ads

- SELECT: `is_active=true` の公開動画枠（anon 可）/ 動画オーナー / admin
- INSERT/UPDATE/DELETE: 動画オーナー or admin

### auth.uid() と talk_user_id

**既存と同様、`auth.uid()` は使用せず `talk_current_user_id()` を使用。** JWT の `app_metadata.talk_user_id`（例: `u_me`, `u_store`）が識別子。ユーザー仕様の `uuid` 型は **既存 LIVE 整合のため `text` に変更**（下記「未解決事項」参照）。

---

## RPC / trigger（最小）

| オブジェクト | 役割 |
|--------------|------|
| `live_video_is_publicly_viewable(uuid)` | RLS 用 · published + public/unlisted |
| `live_refresh_video_like_count(uuid)` | `likes_count` 同期 |
| `live_refresh_video_reports_count(uuid)` | `reports_count` 同期 |
| `live_increment_video_views(uuid)` | **service_role のみ**（Phase 2 Edge 用） |
| `live_videos_guard_owner_update` | owner によるカウンター列更新禁止 |
| `live_video_likes_count_trigger` | like insert/delete |
| `live_video_reports_count_trigger` | report insert/delete |
| `live_videos_set_updated_at` | `updated_at` 自動更新 |

---

## 適用方法

```bash
# 禁止
npx supabase db push

# 実施（staging）
npx supabase db query --linked -f supabase/migrations/20260701100000_live_videos_p1.sql
```

---

## 適用結果

| 項目 | 結果 |
|------|------|
| SQL 実行 | **成功**（exit 0 · 2026-06-23） |
| エラー | なし |
| `schema_migrations` 自動記録 | **なし**（P0/P7 と同様 · 個別適用） |

---

## 検証結果

### 1. スキーマ存在

| 確認 | 結果 |
|------|------|
| `live_videos` | ✅ 作成 · RLS enabled |
| `live_video_likes` | ✅ |
| `live_video_reports` | ✅ |
| `live_video_ads` | ✅ |
| `live-videos` bucket | ✅ private · 2GB · mp4 |
| `live_videos_duration_sec_chk` | ✅ `duration_sec IS NULL OR duration_sec > 60` |

### 2. RLS 挙動（REST 実測）

| テスト | 期待 | 結果 |
|--------|------|------|
| service_role で published 動画 seed | 201 | ✅ |
| **anon** SELECT published+public | 200 · 行取得 | ✅ 1 row |
| `u_store` INSERT draft（権限あり） | 201 | ✅ |
| `u_me` INSERT draft（権限なし） | 403 RLS | ✅ |
| `duration_sec=30` INSERT | 400 CHECK 違反 | ✅ |
| `u_me` LIKE published 動画 | 201 | ✅ |
| 検証データ cleanup | — | ✅ 実施 |

### 3. 既存 LIVE 回帰

| スクリプト | 結果 |
|------------|------|
| `npm run verify:live-p0-schema` | **PASS** 68/0/38 |
| `npm run verify:live-p4 --skip-deploy` | **PASS** 30/0/1 |
| `live_shorts` 到達性 | ✅ 200 |
| `live_shorts` duration 1–60 制約 | ✅ 変更なし（別テーブル） |

### 4. 未実施（Phase 2 以降）

| 項目 | 理由 |
|------|------|
| Storage 実ファイル upload | Edge + フロント未実装 |
| `live_increment_video_views` 本番利用 | Edge `live-video-view` 待ち |
| `live-video-thumbnails` bucket | P1 migration スコープ外 |

---

## 既存ドメインへの影響

| ドメイン | 影響 |
|----------|------|
| 既存 `live_*` 9 テーブル | **ALTER なし** |
| `short-videos` / ショート Edge | 回帰 PASS |
| TALK `talk_notifications` | 変更なし |
| MATCH | migration キュー未変更 · `db push` 未実行 |
| 協力パートナー P1 | 変更なし |
| IWASHO | 変更なし |

---

## 未解決事項

| # | 項目 | 内容 | Phase 2 への影響 |
|---|------|------|------------------|
| 1 | **ID 型の差異** | ユーザー案は `talk_user_id uuid` だが、既存 LIVE は `text`（`u_me` 等）。本 migration は **text で統一**。将来 UUID 化する場合は別 migration が必要 | 低（JS は既に text 前提） |
| 2 | **`creator_profile_id`** | `live_creator_profiles.user_id`（text）への FK。UUID プロファイル ID ではない | 低 |
| 3 | **`schema_migrations` 未記録** | 個別適用のため履歴表に未登録。本番前に repair 方針要検討 | 運用 |
| 4 | **private 動画の anon** | anon は public/unlisted のみ SELECT。private は設計どおり | なし |
| 5 | **`live-video-thumbnails` bucket** | 未作成。サムネは `live-thumbnails` 流用 or Phase 2 で追加検討 | 中 |
| 6 | **`processing` status** | DB 制約のみ · ワーカー未実装 | Phase 3+ |
| 7 | **広告** | `live_video_ads` は枠のみ · 入札/収益分配なし | Phase 6 |

---

## Phase 2 Edge に進めるか

| 判定 | **GO** |
|------|--------|
| 次ステップ | 1. `live-video-signed-url` Edge 新規デプロイ 2. `live_increment_video_views` 呼び出し 3. `live-notify` に `video_published` 追加（任意 · Phase 4） |

**Phase 2 着手時の前提（揃っているもの）:**

- `live_videos` / likes / reports / ads テーブル
- `live-videos` private bucket + Storage RLS
- `live_video_is_publicly_viewable()` · `live_increment_video_views()`
- テストユーザー `u_store`（投稿権限あり）

---

*Phase 1 migration 完了 — フロント / Edge は Phase 2 以降。*
