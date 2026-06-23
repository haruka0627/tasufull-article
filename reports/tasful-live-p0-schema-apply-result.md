# TASFUL LIVE P0 — ステージング migration 適用結果

| 項目 | 内容 |
|------|------|
| 実行日 | **2026-06-23** |
| 適用対象 | [`supabase/migrations/20260628100000_live_p0_schema.sql`](../supabase/migrations/20260628100000_live_p0_schema.sql) |
| 適用先 ref | **`ddojquacsyqesrjhcvmn`** |
| 適用先 DB 名 | **`tasful-ai`**（Supabase linked · Northeast Asia Tokyo） |
| Edge / UI | 未作成（本タスク通り） |

---

## 最終判定

| 判定 | **適用成功 — ステージング POST 検証 PASS** |
|------|---------------------------------------------|
| 意味 | migration 順序修正後、linked DB へ **2 回目の適用が成功**。`live_*` 9 テーブル · 6 関数 · bucket 4 · RLS 52 policy が作成済み。TALK / MATCH smoke も **PASS** |

---

## 1. 初回適用失敗（原因）

| 項目 | 内容 |
|------|------|
| エラー | `ERROR 42P01: relation "public.live_creator_profiles" does not exist` |
| 発生箇所 | `live_is_public_creator()` 定義（旧 L46） |
| 根本原因 | SQL 言語関数が `live_creator_profiles` / `live_broadcasts` を参照するのに、**CREATE TABLE より前**に定義されていた |
| DB 状態 | トランザクション全体ロールバック · `live_*` オブジェクト **0 件** |
| TALK / MATCH | 適用前後 smoke **PASS**（影響なし） |

---

## 2. 修正内容

**対象ファイル:** `supabase/migrations/20260628100000_live_p0_schema.sql`（新規 migration は追加せず同一ファイルを修正）

### 変更方針

テーブル構造 · CHECK · RLS 方針 · bucket 方針 · policy 本文は **一切変更なし**。定義順序のみ整理。

### 修正後のセクション順

| # | セクション | 内容 |
|---|----------|------|
| 1 | `live_set_updated_at()` | テーブル非参照の trigger ヘルパーのみ先頭に残す |
| 2 | CREATE TABLE × 9 | CHECK · INDEX · COMMENT（trigger は後ろへ移動） |
| 3 | Grants / Revoke | 変更なし |
| 4 | RLS enable × 9 | 変更なし |
| 5 | Helper functions | `live_is_public_creator` 等（テーブル参照あり）を **テーブル作成後** に移動 |
| 6 | Triggers | `live_creator_profiles` / `live_shorts` / `live_broadcasts` の updated_at · guard |
| 7 | RLS policies × 34 | 変更なし |
| 8 | Storage buckets × 4 | 変更なし |
| 9 | Storage policies × 18 | 変更なし |

### 静的検証（修正後）

```bash
npm run verify:live-p0-schema -- --static-only
```

| PASS | FAIL | SKIP | exit |
|------|------|------|------|
| 43 | 0 | 7 | 0 |

---

## 3. 再適用結果

### コマンド

```bash
npx supabase db query --linked -f supabase/migrations/20260628100000_live_p0_schema.sql
```

| 項目 | 値 |
|------|-----|
| 試行 | **2 回目** |
| exit code | **0** |
| 状態 | **成功** |

---

## 4. `verify:live-p0-schema` 結果（適用後）

```bash
npm run verify:live-p0-schema
```

| 区分 | PASS | FAIL | SKIP |
|------|------|------|------|
| 静的 + 定数 | 43 | 0 | 7 |
| DB 到達性 · bucket · RLS 挙動 | 25 | 0 | 31 |
| **合計** | **68** | **0** | **38** |
| exit code | **0** | | |

### 主要 DB 検証（PASS）

| ID | 結果 |
|----|------|
| `DB-table-live_*` × 9 | 全テーブル到達 |
| `DB-bucket-*` × 4 | public/private 一致 |
| `DB-rls-anon-live_shorts` | anon 読取不可 |
| `DB-rls-live_tips-user-update-blocked` | 一般ユーザー UPDATE 拒否 |
| `DB-rls-live_moderation_logs-user-read/insert` | 一般ユーザー拒否 |
| `DB-rls-live_moderation_logs-admin-read` | admin 読取可 |
| `DB-talk_notifications-type-live-insert` | ALTER 不要で `type=live` INSERT 可 |
| `DB-untouched-match_profiles` / `listings` | 到達性維持 |

### SKIP（既知 · staging REST 制限）

`information_schema` / `pg_tables` / `pg_policies` が REST 経由で非公開のため、カラム · CHECK · RLS enabled · policy 数の REST 検証は SKIP。policy 数は CLI 直接クエリで確認（§7）。

---

## 5. TALK / MATCH 回帰結果（適用後）

| コマンド | 結果 | 詳細 |
|----------|------|------|
| `node scripts/verify-talk-chat-unify-p1.mjs` | **PASS** | 22/22 — `TALK_CHAT_UNIFY_P1_READY` |
| `node scripts/smoke-match-talk-room.mjs` | **PASS** | 16 checks |

初回失敗時と同様、既存 TALK / MATCH フローへの回帰問題は **検出されず**。

---

## 6. 作成された `live_*` テーブル（9）

| テーブル | 状態 |
|----------|------|
| `live_creator_profiles` | **作成済み** |
| `live_shorts` | **作成済み** |
| `live_short_likes` | **作成済み** |
| `live_broadcasts` | **作成済み** |
| `live_broadcast_messages` | **作成済み** |
| `live_creator_follows` | **作成済み** |
| `live_tips` | **作成済み** |
| `live_moderation_logs` | **作成済み** |
| `live_notify_dedupe` | **作成済み** |

### 作成された関数（6）

`live_set_updated_at` · `live_is_public_creator` · `live_has_broadcast_permission` · `live_broadcast_is_publicly_viewable` · `live_storage_owner_matches` · `live_creator_profiles_guard_owner_update`

---

## 7. 作成された Storage bucket（4）

| Bucket | public | 状態 |
|--------|--------|------|
| `short-videos` | **false** | 作成済み |
| `short-video-thumbnails` | **false** | 作成済み |
| `live-avatars` | **true** | 作成済み |
| `live-thumbnails` | **true** | 作成済み |
| `live-archives` | — | **未作成**（P0 意図どおり） |

---

## 8. RLS policy 概要

| 区分 | linked DB 確認 |
|------|----------------|
| `live_creator_profiles` | 5 |
| `live_shorts` | 6 |
| `live_short_likes` | 5 |
| `live_broadcasts` | 5 |
| `live_broadcast_messages` | 4 |
| `live_creator_follows` | 4 |
| `live_tips` | 4 |
| `live_moderation_logs` | 1 |
| `live_notify_dedupe` | 1 |
| **テーブル小計** | **35** |
| `storage.objects` (`live_storage_*`) | 17 |
| **合計** | **52** |

---

## 9. 既存 TALK への影響

| 項目 | 影響 |
|------|------|
| `transaction_rooms` | **ALTER なし** |
| `talk_notifications` | **ALTER なし** · `type=live` INSERT 検証 PASS |
| `talk_current_user_id` / `talk_is_admin` | 引き続き利用（RLS / helper で参照） |
| TALK P1 smoke | **PASS** |

---

## 10. MATCH / Marketplace / Builder への影響

| 領域 | 影響 |
|------|------|
| MATCH talk-room smoke | **PASS** |
| `match_profiles` / `listings` | 到達性維持（verify PASS） |
| `builder_projects` | プロジェクトに未存在（SKIP · 変更なし） |
| Marketplace / Builder テーブル | migration 内 ALTER **なし** |

---

## 11. エラー / 警告

| 種別 | 内容 |
|------|------|
| **初回 ERROR** | `42P01` — 順序バグ（§1 · **修正済み**） |
| **2 回目** | エラーなし |
| WARNING | npm `Unknown env config "devdir"`（実行環境 · 無関係） |
| WARNING | Supabase CLI v2.107.0 利用可能 |

rollback は実施していない（初回は自動ロールバック · 2 回目成功）。

---

## 12. 次ステップ

| # | 作業 |
|---|------|
| 1 | Edge: `live-signed-url`（TTL 300）· `live-publish-short` |
| 2 | UI: `live/` 画面 · `talk-category-normalize.js` に `live` |
| 3 | Realtime: `live_broadcast_messages` publication（migration 末尾コメント参照） |
| 4 | 本番適用はステージング安定確認後 |

---

## 参照

- [tasful-live-p0-schema-draft-result.md](tasful-live-p0-schema-draft-result.md)
- [tasful-live-p0-verify-script-result.md](tasful-live-p0-verify-script-result.md)
