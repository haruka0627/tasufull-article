# TASFUL LIVE P0 — Migration SQL 草案レビュー結果

| 項目 | 内容 |
|------|------|
| 作成日 | **2026-06-23** |
| 草案ファイル | [`supabase/migrations/20260628100000_live_p0_schema.sql`](../supabase/migrations/20260628100000_live_p0_schema.sql) |
| 参照 | [`tasful-live-p0-design.md`](tasful-live-p0-design.md) v1.1 · [`tasful-live-p0-migration-review.md`](tasful-live-p0-migration-review.md) |
| DB 適用 | **未実施**（本レポート作成時点） |
| 静的レビュー | 実施済み（命名衝突 · policy 名 · CHECK 値） |

---

## 判定

| 判定 | **草案レビュー Go（ステージング適用可）** |
|------|------------------------------------------|
| 意味 | 本 SQL を **ステージング linked DB** への初回適用候補としてよい |
| 条件 | ① `talk_current_user_id()` / `talk_is_admin()` 適用済み ② TALK P1 bridge 列あり ③ 適用後 POST 検証（§7） ④ フロント `type=live` は別 PR で同一 train |

---

## 1. 作成したテーブル（9）

| # | テーブル | 主キー | 備考 |
|---|----------|--------|------|
| 1 | `live_creator_profiles` | `user_id` text | 配信資格 · カウンタ · 将来 `fee_rate` 等 |
| 2 | `live_shorts` | `id` uuid | `status` = short_status 4 値 |
| 3 | `live_short_likes` | `(short_id, user_id)` | FK → `live_shorts` CASCADE |
| 4 | `live_broadcasts` | `id` uuid | `status` = stream_status 6 値 |
| 5 | `live_broadcast_messages` | `id` uuid | FK → `live_broadcasts` CASCADE |
| 6 | `live_creator_follows` | `(follower_id, creator_id)` | self-follow CHECK |
| 7 | `live_tips` | `id` uuid | `idempotency_key` UNIQUE |
| 8 | `live_moderation_logs` | `id` uuid | ops/admin only |
| 9 | `live_notify_dedupe` | `event_key` text | service_role + admin |

**補助オブジェクト（6 functions · 4 triggers）:**

| 名前 | 用途 |
|------|------|
| `live_set_updated_at()` | `updated_at` 自動更新 |
| `live_is_public_creator(text)` | 公開プロフィール判定 |
| `live_has_broadcast_permission(text)` | 投稿/配信ゲート |
| `live_broadcast_is_publicly_viewable(uuid)` | 配信・チャット公開 read |
| `live_storage_owner_matches(text)` | Storage パス先頭 = `talk_user_id` |
| `live_creator_profiles_guard_owner_update()` | 非 admin の特権列 UPDATE 禁止 |

**意図的に含めないもの:**

- `users` への FK（`users` は migration 未管理 · 適用失敗回避）
- `reports` 拡張（本草案スコープ外）
- `transaction_rooms` / `talk_notifications` の ALTER

---

## 2. 作成した Storage bucket（4 · P0 有効）

| Bucket | public | 上限 | MIME |
|--------|--------|------|------|
| `short-videos` | **false** | 80MB | video/mp4 |
| `short-video-thumbnails` | **false** | 2MB | image/jpeg,png,webp |
| `live-avatars` | **true** | 2MB | image/jpeg,png,webp |
| `live-thumbnails` | **true** | 2MB | image/jpeg,png,webp |

| Bucket | P0 |
|--------|-----|
| `live-archives` | **未作成**（SQL コメントのみ · P1 VOD） |

`insert into storage.buckets ... on conflict (id) do update` で idempotent。

---

## 3. RLS policy 概要

**合計: 52 policies**（`drop policy if exists` + `create policy` 各 52 · public テーブル 38 + storage 14）

### 3.1 テーブル RLS（38）

| テーブル | SELECT | INSERT | UPDATE | DELETE | admin |
|----------|--------|--------|--------|--------|-------|
| `live_creator_profiles` | public active + own | own | own（trigger で特権列ガード） | — | ALL |
| `live_shorts` | published + own | own + permission | own | own | ALL |
| `live_short_likes` | published + own | own（published のみ） | — | own | ALL |
| `live_broadcasts` | live/ended + own | own + permission | own | — | ALL |
| `live_broadcast_messages` | public broadcast | auth · live 中のみ | — | own | ALL |
| `live_creator_follows` | own | own | — | own | ALL |
| `live_tips` | sender / creator | auth · stub/pending のみ | **なし（client）** | — | ALL |
| `live_moderation_logs` | — | — | — | — | ALL のみ |
| `live_notify_dedupe` | — | — | — | — | admin ALL + service_role grant |

**anon:** 全 `live_*` テーブルで `REVOKE ALL`。

### 3.2 Storage RLS（14）

| bucket | SELECT | INSERT/UPDATE/DELETE |
|--------|--------|----------------------|
| `short-videos` | owner | owner + `live_has_broadcast_permission()` |
| `short-video-thumbnails` | owner | 同上 |
| `live-avatars` | **public** | owner |
| `live-thumbnails` | **public** | owner |
| 全 LIVE bucket | — | `live_storage_admin_all`（`talk_is_admin()`） |

**公開動画再生:** private bucket は **authenticated owner SELECT のみ** → フィード視聴は後続 Edge signed URL（TTL **300s**）必須。

### 3.3 採用 CHECK / enum（確定値）

| 論理名 | 列 | 値 |
|--------|-----|-----|
| `live_permission_status` | `live_creator_profiles.live_permission_status` | none · identity_verified · ops_approved · suspended |
| `creator_status` | `live_creator_profiles.creator_status` | draft · active · restricted · suspended |
| `short_status` | `live_shorts.status` | draft · published · hidden · removed |
| `stream_provider` | `live_broadcasts.stream_provider` | stub · cloudflare_stream（default stub） |
| `stream_status` | `live_broadcasts.status` | scheduled · preparing · live · ended · failed · removed |
| `tip_payment_status` | `live_tips.payment_status` | stub · pending · succeeded · failed |

**DB 固定パラメータ:**

| 定数 | 実装 |
|------|------|
| short active total ≤ 50 | `live_creator_profiles.short_active_count` CHECK ≤ 50 |
| short daily 10 | **Edge のみ**（コメント + カウンタ列 · RLS では未強制） |
| signed URL TTL 300s | migration ヘッダコメント · Edge 実装時 |
| `LIVE_STREAM_PROVIDER` default stub | `live_broadcasts.stream_provider` DEFAULT `'stub'` |

---

## 4. 既存 TALK への影響

| 対象 | 変更 | 影響 |
|------|------|------|
| `transaction_rooms` | **なし** | `service_type=live` は既存 bridge 列に値投入のみ · `ensure-talk-room` 変更不要 |
| `talk_notifications` | **なし** | `type='live'` · `source='tasful_live'` はアプリ層 |
| `talk_follow_subscriptions` | **なし** | `live_creator_follows` と独立 |
| `talk_broadcast_drafts` | **なし** | 名前類似のみ |
| `talk_call_*` | **なし** | WebRTC 1:1 音声 Epic |
| `talk_current_user_id()` | **依存** | 未適用環境では本 migration **適用不可** |

**破壊リスク: 低** — 新規 `live_*` 名前空間のみ · TALK 既存テーブル無変更。

---

## 5. 既存 MATCH / Marketplace / Builder 衝突確認

| 確認項目 | 結果 |
|----------|------|
| `supabase/migrations/*.sql` に `live_*` テーブル先行定義 | **なし** |
| policy 名 `live_*` の既存重複 | **なし**（grep 全庫 · 本ファイルのみ） |
| Storage bucket ID 重複 | **なし** |
| `match_*` / `builder_*` / `listings` ALTER | **なし** |
| `members.followers_count` | **未参照** |
| `genai_2d_live_300` 等製品名 | **無関係** |

---

## 6. 適用前の注意点

| # | 注意 |
|---|------|
| PRE-01 | **`sql/talk-rls-production.sql` 必須** — `talk_current_user_id()` / `talk_is_admin()` が無いと policy 作成後に実行時エラー |
| PRE-02 | **`20260622120000_talk_room_contact_bridge.sql` 適用済み** を確認 |
| PRE-03 | **本番直適用禁止** — ステージング `db push` / `db query -f` で POST 検証後 |
| PRE-04 | **dev `*_dev` policy を同時に作らない**（P0 RLS 教訓） |
| PRE-05 | **日次 10 本上限**は Edge `live-publish-short` 等で実装 · SQL のみでは不足 |
| PRE-06 | **Realtime** は migration 内コメントアウト — 適用後に `live_broadcast_messages` を publication へ手動追加 |
| PRE-07 | **フロント** `talk-category-normalize.js` に `"live"` 未追加のまま通知 fanout するとラベル欠落 |
| PRE-08 | Storage **public** bucket（avatars/thumbnails）は OGP/一覧向け · 動画本体は private のまま |
| PRE-09 | `live_tips` の `succeeded` 遷移は **service_role Edge / stripe-webhook のみ**（RLS で client UPDATE 不可） |
| PRE-10 | 適用後 **TALK / MATCH smoke** を同一パイプラインで実行 |

---

## 7. 適用後検証項目

| # | 検証 | 期待 |
|---|------|------|
| POST-01 | `\dt live_*` | 9 テーブル |
| POST-02 | `INSERT live_creator_profiles`（authenticated · own） | OK |
| POST-03 | `live_permission_status=none` で `INSERT live_shorts` | RLS 拒否 |
| POST-04 | `identity_verified` + `active` で `INSERT live_shorts` | OK |
| POST-05 | `duration_sec=61` | CHECK 拒否 |
| POST-06 | `status=processing` on `live_shorts` | CHECK 拒否（short_status 4 値のみ） |
| POST-07 | anon `SELECT live_shorts` | 0 行 / permission denied |
| POST-08 | `INSERT live_tips` `payment_status=stub` | OK |
| POST-09 | client `UPDATE live_tips SET payment_status=succeeded` | 拒否 |
| POST-10 | owner が `live_permission_status` を自己 UPDATE | trigger 例外 |
| POST-11 | Storage `short-videos` upload（パス `{talk_user_id}/...`） | OK |
| POST-12 | `ensure-talk-room` + `service_type=live` smoke | 既存スクリプト PASS |
| POST-13 | `verify-talk-chat-unify-p1.mjs` / `smoke-match-talk-room.mjs` | 回帰 PASS |

---

## 8. 未確定事項

| # | 項目 | 状態 |
|---|------|------|
| U-01 | 日次 10 本のタイムゾーン | `Asia/Tokyo` 推奨 · Edge 実装時確定 |
| U-02 | `hidden` を active 50 に含める運用 | migration レビューどおり **含める** · Edge で同期 |
| U-03 | `reports.target_content_type` LIVE 拡張 | 本草案 **未含む** · 通報 UI PR で別 migration 可 |
| U-04 | published ショートの Storage cross-user read | **Edge signed URL 必須** · 直接 Storage SELECT は owner のみ |
| U-05 | `creator_status=restricted` の公開 read | 現状 `live_is_public_creator` は `active` のみ — **意図どおり** |
| U-06 | `live-archives` bucket 作成タイミング | P1 VOD |
| U-07 | Cloudflare Stream 本番接続 | `LIVE_STREAM_PROVIDER=cloudflare_stream` · env 4 変数 |

---

## 9. 次に実行すべき検証コマンド案

**DB にはまだ適用しない前提の静的確認:**

```powershell
cd c:\Users\rubih\tasufull-article

# 1) 既存 migration とのファイル名・テーブル名衝突
rg "create table.*live_" supabase/migrations --glob "*.sql"
rg "live_creator_profiles_select_public|live_storage_admin_all" supabase sql --glob "*.sql"

# 2) 草案の policy / CHECK 一覧
rg "^create policy|^  constraint live_" supabase/migrations/20260628100000_live_p0_schema.sql
```

**ステージング適用時（linked · 別セッションで明示承認後）:**

```powershell
# 前提確認
npx supabase db query --linked -f sql/talk-rls-production.sql   # 未適用時のみ

# 適用（例）
npx supabase db push --linked
# または
npx supabase db query --linked -f supabase/migrations/20260628100000_live_p0_schema.sql

# 回帰
$env:BASE_URL="https://tasufull-article.pages.dev"
node scripts/verify-talk-chat-unify-p1.mjs
node scripts/smoke-match-talk-room.mjs --live
```

**POST-01〜13** は `scripts/verify-live-p0-schema.mjs`（未作成 · 次 PR 推奨）で自動化。

---

## 10. 静的レビュー記録

| チェック | 結果 |
|----------|------|
| SQL 構文（目視） | PASS · idempotent `if not exists` / `drop policy if exists` |
| テーブル名衝突 | PASS |
| RLS policy 名衝突 | PASS（52 件すべて `live_*` プレフィックス） |
| CHECK 値とユーザー指定一致 | PASS · `processing` 除外済み |
| TALK テーブル ALTER なし | PASS |
| MATCH/Marketplace/Builder ALTER なし | PASS |
| 草案内 typo 修正 | `live_short_likes_insert_own` の誤 drop 先を修正済み |
| DB 適用 | **未実施** |

---

## 11. 次ステップ（スコープ外）

1. ステージング適用 + POST-01〜13
2. `scripts/verify-live-p0-schema.mjs` 作成
3. Edge `live-signed-url`（TTL 300）· `live-publish-short`（日次 10）
4. フロント `talk-category-normalize.js` に `"live"` 追加
5. Phase 1 実装（`live/` HTML/JS）

---

*本レポートは migration 草案のレビュー結果のみ。DB への適用は行っていない。*
