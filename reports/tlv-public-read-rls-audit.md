# TLV 公開閲覧 RLS 横断調査

調査日: 2026-06-24

## 現象

| ページ | 症状 |
|--------|------|
| `/live/videos` | 長尺動画のみ表示（ショート棚は空） |
| `/live/shorts` | `permission denied for table live_shorts` |
| `/live/` | `permission denied for table live_broadcasts` |

## 根本原因

**`live_videos` だけ P1 で anon 公開閲覧が設計済み。P0 テーブルは `revoke all from anon` のまま。**

未ログイン（または Supabase セッション未確立）のブラウザは **anon JWT** で接続する。PostgreSQL はテーブル GRANT を先に評価するため、anon に `SELECT` がなければ RLS 以前に `permission denied for table …` になる。

`live_videos` が読める理由:

```sql
-- 20260701100000_live_videos_p1.sql
grant select on public.live_videos to anon, authenticated;

create policy live_videos_select_public
  on public.live_videos for select to anon, authenticated
  using (status = 'published' and visibility in ('public','unlisted')
         and live_is_public_creator(talk_user_id));
```

## 1. 現在の RLS / GRANT 一覧

### live_videos ✅ 公開閲覧 OK

| 項目 | 値 |
|------|-----|
| RLS | 有効 |
| anon GRANT | `SELECT` あり |
| 公開 SELECT | `live_videos_select_public` → `anon, authenticated` |
| 条件 | `status=published`, `visibility in (public,unlisted)`, `live_is_public_creator` |
| 管理者 | `live_videos_admin_all` 維持 |

### live_shorts ❌ anon 不可

| 項目 | 値 |
|------|-----|
| RLS | 有効 |
| anon GRANT | **なし** (`revoke all from anon`) |
| 公開 SELECT | `live_shorts_select_published` → **`authenticated` のみ** |
| 条件 | `status=published`, `live_is_public_creator(creator_id)` |
| 非公開除外 | `draft/hidden/removed` は条件外 |

### live_broadcasts ❌ anon 不可

| 項目 | 値 |
|------|-----|
| RLS | 有効 |
| anon GRANT | **なし** |
| 公開 SELECT | `live_broadcasts_select_public` → **`authenticated` のみ** |
| 条件 | `status in (live, ended)` ※フロントは `scheduled` も取得 |
| 非公開除外 | `preparing/failed/removed` は条件外 |

### live_creator_profiles ❌ anon 不可

| 項目 | 値 |
|------|-----|
| RLS | 有効 |
| anon GRANT | **なし** |
| 公開 SELECT | `live_creator_profiles_select_public` → **`authenticated` のみ** |
| 条件 | `live_is_public_creator(user_id)` |

### live_creator_follows — 意図的に非公開

| 項目 | 値 |
|------|-----|
| anon GRANT | なし |
| SELECT | `live_creator_follows_select_own` → 自分のフォローのみ |
| 用途 | ログイン後のフォロー一覧。公開フィード不要 |

### live_video_likes — 意図的にログイン後

| 項目 | 値 |
|------|-----|
| anon GRANT | なし |
| SELECT | `live_video_likes_select_viewable` → `authenticated` |
| 用途 | いいね状態表示。未ログインは UI 非表示で問題なし |

### live_video_comments — **テーブル不存在**

コメントは `live_broadcast_messages`（ライブ配信コメント）。動画コメントテーブルは未実装。

### live_broadcast_messages（コメント相当）

| 項目 | 値 |
|------|-----|
| anon GRANT | **なし** |
| SELECT | `live_broadcast_messages_select_public` → **`authenticated` のみ** |
| 条件 | `live_broadcast_is_publicly_viewable(broadcast_id)` |

## 2. anon / authenticated まとめ

| テーブル | anon 公開 SELECT | authenticated 公開 SELECT | 備考 |
|----------|------------------|---------------------------|------|
| live_videos | ✅ | ✅ | 現状 OK |
| live_shorts | ❌ | ✅（GRANT あり時） | GRANT 不足が主因 |
| live_broadcasts | ❌ | ✅（GRANT あり時） | 同上 |
| live_creator_profiles | ❌ | ✅（GRANT あり時） | ショート/ハブで必要 |
| live_creator_follows | ❌ | 自分のみ | 変更不要 |
| live_video_likes | ❌ | 条件付き | 変更不要 |
| live_broadcast_messages | ❌ | 条件付き | 視聴ページ用に anon 追加推奨 |

## 3. フロント取得の違い

| ページ | クエリ | エラー時 |
|--------|--------|----------|
| `/live/videos` 動画 | `live_videos` 直接 | 全体エラー |
| `/live/videos` ショート棚 | `live_shorts` | `.catch()` で空（ページは維持） |
| `/live/shorts` | `live_shorts` + `live_creator_profiles` | 全体エラー → **空状態に改善済み** |
| `/live/` | `live_broadcasts` | セクションエラー → **空状態に改善済み** |

## 4. local / preview / production の Policy

マイグレーションはリポジトリに存在するが、**リモート Supabase への適用は別作業**。  
Preview / Production は同じ Supabase プロジェクトを参照するため、マイグレーション適用後は3環境とも同一 Policy になる。

適用前: 3環境とも `permission denied` 再現可能。  
適用後: `supabase db push` または SQL Editor で `20260704100000_live_public_read_select.sql` を実行。

## 5. 不足していた Policy / GRANT

1. `grant select on live_shorts to anon`
2. `grant select on live_creator_profiles to anon`
3. `grant select on live_broadcasts to anon`
4. `grant select on live_broadcast_messages to anon`
5. 各 `*_select_public` を `to anon, authenticated` に拡張
6. `live_broadcasts` 公開条件に `scheduled` を追加（ハブ UI と整合）

## 6. 修正 SQL

ファイル: [`supabase/migrations/20260704100000_live_public_read_select.sql`](../supabase/migrations/20260704100000_live_public_read_select.sql)

```bash
supabase db push
# または Supabase Dashboard → SQL Editor でファイル内容を実行
```

## 7. フロント改善（権限エラー非表示）

- `live-config.js`: `isPublicReadAccessError()` 追加
- `live-shorts.js`, `live-broadcasts.js`: 権限エラー時は空状態、技術メッセージは `console.warn` のみ
