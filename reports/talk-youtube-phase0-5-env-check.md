# TASFUL LIVE → YouTube型 P1 — Phase 0.5 staging 環境確認

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日 | 2026-06-23 |
| 種別 | **読取専用環境確認**（DB / migration / Edge / HTML / JS 変更なし） |
| 前提 | Phase 0 監査完了 — [`talk-youtube-phase0-live-audit.md`](talk-youtube-phase0-live-audit.md) |
| 設計参照 | [`talk-youtube-conversion-p1-plan.md`](talk-youtube-conversion-p1-plan.md) |

---

## 最終判定

| 判定 | **CONDITIONAL GO** |
|------|---------------------|
| 意味 | staging (`ddojquacsyqesrjhcvmn`) に LIVE P0 基盤（`live_*` 9 テーブル · Storage 4 bucket · Edge 2 本 · RPC）が **実在し smoke PASS**。YouTube P1 の **Phase 1 migration（`live_videos` 等の新規追加）に進める**。ただし **`supabase db push` は禁止** · migration 履歴未整合のまま · 投稿 E2E 用クリエイター準備が未完了。 |

**STOP ではない理由:** `live_shorts` / Edge / bucket が揃い、P0 と同様の **個別 SQL 適用**で Phase 1 を進められる実績がある。

**GO ではない理由:** `schema_migrations` に LIVE 適用記録がなく、`db push` が MATCH 待ちキューで停止する。テストユーザー `u_me` は `live_creator_profiles` 未登録で投稿不可。

---

## 確認対象環境

| 項目 | 値 |
|------|-----|
| Supabase project ref | `ddojquacsyqesrjhcvmn` |
| URL | `https://ddojquacsyqesrjhcvmn.supabase.co` |
| 用途 | staging / 開発兼本番予定 |
| フロント設定 | `chat-supabase-config.js` と一致 |
| 検証コマンド | `npm run verify:live-p0-schema` · `verify:live-p4 --skip-deploy` · `verify:live-p7` |
| DB 直接確認 | `npx supabase db query --linked "…"`（読取のみ） |

---

## 1. `live_*` テーブル一覧

### 1.1 staging 実在テーブル（`pg_tables` 照会 · 2026-06-23）

| テーブル | 存在 | 備考 |
|----------|------|------|
| `live_creator_profiles` | ✅ | チャンネル · 権限ゲート |
| `live_shorts` | ✅ | ショート動画（60s 上限） |
| `live_short_likes` | ✅ | ショートいいね |
| `live_creator_follows` | ✅ | ※設計上 `live_follows` ではなくこちら |
| `live_broadcasts` | ✅ | ライブ配信（P1 非拡張） |
| `live_broadcast_messages` | ✅ | ライブチャット |
| `live_tips` | ✅ | 投げ銭スタブ |
| `live_moderation_logs` | ✅ | モデレーション |
| `live_notify_dedupe` | ✅ | 通知重複防止 |

**合計: 9 テーブル** — `npm run verify:live-p0-schema` の `DB-table-*` 9/9 PASS。

### 1.2 関連（`live_*` 以外 · TALK 連携）

| テーブル | 存在 | 備考 |
|----------|------|------|
| `talk_notifications` | ✅ | LIVE 通知 fanout 先（`type=live`） |
| `live_videos` | ❌ | Phase 1 で新規作成予定 |
| `live_video_likes` | ❌ | Phase 1 で新規作成予定 |

### 1.3 非影響確認（既存ドメイン）

| 対象 | 結果 |
|------|------|
| `match_profiles` | ✅ 到達可能（MATCH 無変更） |
| `listings` | ✅ 到達可能 |
| `talk_notifications` | ✅ 到達可能 |
| `transaction_rooms` | ✅（P0 migration で ALTER なし） |

---

## 2. `live_shorts` 制約確認

### 2.1 DB 実環境（`pg_constraint` 照会）

| 制約名 | 定義 |
|--------|------|
| **`live_shorts_duration_sec_chk`** | **`CHECK (duration_sec >= 1 AND duration_sec <= 60)`** |
| `live_shorts_status_chk` | `draft` / `published` / `hidden` / `removed` |
| `live_shorts_title_len_chk` | 1〜120 文字 |
| `live_shorts_description_len_chk` | NULL または ≤2000 文字 |
| `live_shorts_tags_cardinality_chk` | tags ≤ 5 |
| `live_shorts_view_count_chk` | `view_count >= 0` |
| `live_shorts_like_count_chk` | `like_count >= 0` |

### 2.2 長尺動画への流用可否

| 観点 | 結論 |
|------|------|
| `live_shorts` に 60 秒超を INSERT | **DB 制約で拒否**（`duration_sec` CHECK） |
| クライアント側 | `live-config.js` · `LIVE_SHORT_MAX_DURATION_SEC = 60` · `live-short-upload.js` で事前検証 |
| YouTube 型長尺 | **`live_videos` 新規テーブル必須**（Phase 0 監査と一致） |

### 2.3 現データ

staging の `live_shorts` は検証時点で **0 行**（P4/P7 smoke の seed は実行後 cleanup）。スキーマ・制約のみ確認済み。

---

## 3. Storage bucket 状態

### 3.1 実環境（`storage.buckets`）

| bucket | public | file_size_limit | allowed_mime_types | Phase 1 |
|--------|--------|-----------------|-------------------|---------|
| `short-videos` | **false** | 80 MB | `video/mp4` | 維持（ショート専用） |
| `short-video-thumbnails` | **false** | 2 MB | jpeg/png/webp | 維持 |
| `live-avatars` | **true** | 2 MB | jpeg/png/webp | 維持 |
| `live-thumbnails` | **true** | 2 MB | jpeg/png/webp | 長尺サムネ流用可 |
| `live-archives` | — | — | — | **未作成**（P0 設計どおり延期） |
| `live-videos` | — | — | — | **未作成**（Phase 1 で追加予定） |

`verify:live-p0-schema` — bucket 4/4 PASS · `live-archives` 不在 PASS。

### 3.2 パスルール · 署名 URL

| 項目 | 内容 |
|------|------|
| ショート動画パス | `{talk_user_id}/{short_id}.mp4`（`live-config.js` · `buildShortStoragePath`） |
| 直リンク | **不可**（private bucket） |
| 他者再生 | Edge `live-short-signed-url` 経由 · TTL **300s** |
| 本人アップロード | Storage RLS + `live_has_broadcast_permission()` |

---

## 4. Edge Function 状態

### 4.1 デプロイ一覧（`supabase functions list`）

| Function | STATUS | VERSION | UPDATED (UTC) |
|----------|--------|---------|---------------|
| `live-short-signed-url` | **ACTIVE** | 4 | 2026-06-22 18:18:14 |
| `live-notify` | **ACTIVE** | 5 | 2026-06-22 18:18:54 |

### 4.2 必要環境変数（コード定義）

| Function | 必須 secrets / env |
|----------|-------------------|
| `live-short-signed-url` | `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` |
| `live-notify` | 同上 |

（Supabase プロジェクトに自動注入。追加の外部 API キーは不要。）

### 4.3 JWT / anon 到達性

| Function | Authorization なし | anon key を Bearer | ユーザ JWT（`talk_user_id` 付き） |
|----------|-------------------|-------------------|----------------------------------|
| `live-short-signed-url` | **401** `Authorization header required` | **通過**（400/404 まで到達 · UUID 検証あり） | **通過**（P4 smoke: published → 200 + signedUrl） |
| `live-notify` | **401** `Authorization header required` | **401** `Valid user JWT required` | **通過**（P7 smoke: follow/tip/broadcast 通知） |

**解釈:**

- `live-short-signed-url` は **Bearer ヘッダ必須**だが、anon publishable key でも 401 にはならない（P0 設計: 認証ユーザー向け再生。完全匿名は不可だが anon key 単体は技術的に通る）。
- `live-notify` は **`talk_user_id` を含むユーザ JWT 必須**。anon では不可 ✅

### 4.4 smoke 結果

| スクリプト | 結果 | 要点 |
|------------|------|------|
| `verify:live-p4 --skip-deploy` | **PASS** 30/0/1 | 400/403/404/200 · TTL 300s · UI shorts 3 viewport |
| `verify:live-p7` | **PASS** 43/0/1 | follower/like/tip RPC · `talk_notifications` INSERT · dedupe |

---

## 5. テストユーザー / 権限状態

### 5.1 JWT · `talk_user_id`

| ユーザー | email | `talk_user_id`（JWT） | `live_creator_profiles` |
|----------|-------|----------------------|-------------------------|
| `u_me` | `talk-rls-a@tasful-dev.test` | ✅ `u_me` | ❌ **行なし** |
| `u_admin` | `talk-rls-admin@tasful-dev.test` | ✅ `u_admin` | ❌ **行なし** |
| `u_store` | `talk-rls-b@tasful-dev.test` | ✅ `u_store` | ✅ `creator_status=active` · `live_permission_status=identity_verified` |

### 5.2 投稿可否（RLS · 変更なし確認）

`live_shorts_insert_own` の `WITH CHECK`:

```text
creator_id = talk_current_user_id()
AND live_has_broadcast_permission(creator_id)
```

`live_has_broadcast_permission` は **`live_creator_profiles` で `creator_status='active'` かつ `live_permission_status IN ('identity_verified','ops_approved')`** を要求。

| ユーザー | ショート投稿 | チャンネル公開表示 |
|----------|-------------|-------------------|
| `u_me` | ❌ プロフィール未作成 | ❌ |
| `u_store` | ✅ 条件充足 | ✅（`live_is_public_creator`） |
| `u_admin` | △ プロフィール未作成（admin policy で別途可） | — |

**Phase 1 E2E 推奨:** 投稿・一覧・再生の通し検証は **`u_store` を主テストユーザー**とするか、Phase 1 着手前に `u_me` へ `live_creator_profiles` を手動 seed（**migration 外のデータ準備**）。

### 5.3 ログイン

`ensureTalkJwt` による password ログインは **全テストユーザーで成功**（`verify:live-p0-schema` · `DB-jwt-setup` PASS）。

---

## 6. migration 履歴のズレ

### 6.1 ファイル表記 vs 実 DB

| migration ファイル | ファイル先頭表記 | `schema_migrations` 記録 | 実オブジェクト |
|-------------------|-----------------|-------------------------|---------------|
| `20260628100000_live_p0_schema.sql` | `DRAFT · NOT APPLIED` | ❌ なし | ✅ **適用済み**（9 テーブル存在） |
| `20260629100000_live_p0_counts.sql` | （DRAFT 表記なし） | ❌ なし | ✅ **適用済み**（`live_refresh_*` RPC 存在） |
| `20260630100000_partner_p1_schema.sql` | — | ✅ `partner_p1_schema` | ✅ |
| `20260630100001_partner_p1_auth_hook.sql` | — | ✅ `partner_p1_auth_hook` | ✅ |

**`schema_migrations` に記録されているのは partner P1 の 2 件のみ。**

### 6.2 `supabase migration list --linked`

| 区分 | 件数 | 内容 |
|------|------|------|
| Local のみ（Remote 空欄） | **19** | MATCH draft 7 + MATCH 本番 9 + TALK bridge 1 + **LIVE P0 2** |
| Local = Remote | **2** | partner P1 |

### 6.3 MATCH migration キュー停止の影響

`npx supabase db push --linked --dry-run` 結果:

- **DRY RUN でも停止** — Remote より前のタイムスタンプの local migration が 19 件検出される。
- 先頭は `20260621120000_match_schema_draft.sql` から `20260629100000_live_p0_counts.sql` まで。
- **`--include-all` なしでは push 不可**（MATCH + LIVE が一括適用候補に含まれる）。

**影響範囲:**

| 操作 | 可否 | リスク |
|------|------|--------|
| `supabase db push`（現状） | **❌ 実行禁止** | MATCH draft が未適用扱いで先に流れる危険 |
| `supabase db query --linked -f <単一ファイル>` | ✅ P0/P7/partner で実績あり | 履歴表に残らない（手動記録必要） |
| Phase 1 新 migration ファイル追加 | ✅ 可能 | **push ではなく個別適用**を継続 |

---

## 7. `db push` 可否

| 質問 | 回答 |
|------|------|
| 今すぐ `db push` してよいか | **❌ いいえ（STOP）** |
| Phase 1 migration を進めてよいか | **✅ はい（個別 SQL 適用）** |
| 履歴整合は必須か | Phase 1 **着手前**に方針決定推奨。未整合のままでも P0 と同手法で進行可能（CONDITIONAL） |

**推奨適用手順（P0 踏襲 · 本番影響なし）:**

1. Phase 1 用 **新タイムスタンプ** migration ファイルのみ作成（別タスク）
2. staging で `npx supabase db query --linked -f supabase/migrations/<new>.sql`
3. `npm run verify:live-p0-schema` + Phase 1 用 verify を追加実行
4. `schema_migrations` への `repair` / 手動 INSERT は **別途ランブック**（MATCH 保留中は一括 repair も慎重に）

---

## 8. Phase 1 migration の前提整理

Phase 1 で **新規作成が必要**（現 staging には存在しない）:

### 8.1 テーブル

| オブジェクト | 現状 | Phase 1 要件（設計書） |
|--------------|------|------------------------|
| `live_videos` | ❌ | 長尺動画本体 · `duration_sec` **制限なし（または >60）** · `visibility` enum |
| `live_video_likes` | ❌ | `live_short_likes` 同型 |
| `live_video_ads` / `live_ad_impressions` | ❌ | P1 最小広告（任意 · Phase 6 でも可） |

### 8.2 Storage

| bucket | 現状 | Phase 1 |
|--------|------|---------|
| `live-videos` | ❌ | **private** · MP4 · 上限 2GB（暫定） · `{talk_user_id}/{video_id}.mp4` |
| `live-video-thumbnails` | ❌ | private · 5MB（推奨） |

### 8.3 RLS · RPC · indexes

| 種別 | 現状（流用） | Phase 1 追加 |
|------|-------------|-------------|
| 権限ゲート | `live_has_broadcast_permission()` · `talk_current_user_id()` | 同パターンで `live_videos` に適用 |
| いいね集計 RPC | `live_refresh_short_like_count` | `live_refresh_video_like_count`（新規） |
| インデックス | `live_shorts_published_feed_idx` 等 | `(status, published_at desc)` · `(creator_id, published_at desc)` |
| status | ショート: 4 値 | 長尺: `draft/published/hidden/removed` + `visibility`（`public/unlisted/private`） |

### 8.4 Edge（Phase 1 DB 後 · Phase 2 実装予定）

| Function | 現状 |
|----------|------|
| `live-video-signed-url` | ❌ 未デプロイ |
| `live-video-view` | ❌ |
| `live-notify` 拡張（`video_published`） | 未実装（既存 4 event のみ） |

### 8.5 既存資産の流用（変更不要）

- `live_creator_profiles` · `live_creator_follows` · `talk_notifications` · `live_notify_dedupe`
- `live-short-signed-url` · `short-videos` bucket（ショート共存）
- `live/` フロントの投稿・一覧パターン（`live-short-upload.js` · `live-shorts.js`）

---

## 9. Phase 1 に進める条件（チェックリスト）

| # | 条件 | 状態 |
|---|------|------|
| C1 | staging に `live_shorts` 等 P0 テーブル存在 | ✅ |
| C2 | `duration_sec` 1–60 CHECK が実 DB に存在 | ✅ |
| C3 | `short-videos` private + 署名 URL 前提 | ✅ |
| C4 | `live-short-signed-url` デプロイ済み · smoke PASS | ✅ |
| C5 | `live-notify` デプロイ済み · `talk_notifications` 連携 PASS | ✅ |
| C6 | `talk_user_id` JWT 発行可能 | ✅ |
| C7 | 投稿可能クリエイターが少なくとも 1 ユーザー | ✅（`u_store`） |
| C8 | `db push` 禁止 · 個別適用方針の合意 | ⚠️ 要文書化（本レポートで記載） |
| C9 | `live_videos` / `live-videos` が **未存在**（衝突なし） | ✅ |
| C10 | MATCH / partner / TALK への migration ALTER なし | ✅（Phase 1 設計どおり） |

---

## 10. Phase 1 に進む前に必ず直す項目

| 優先度 | 項目 | 内容 | ブロック Phase 1? |
|--------|------|------|-------------------|
| **P0** | migration 適用手法の固定 | **`db push` 禁止** · 新ファイルのみ `db query -f` | 運用上必須 |
| **P0** | migration ファイルヘッダ更新 | `20260628100000` の `DRAFT · NOT APPLIED` を staging 適用済みに合わせて修正（**ドキュメントのみ · 次 PR で可**） | いいえ |
| **P1** | E2E テストユーザー | `u_me` に `live_creator_profiles` seed、または `u_store` を標準テストに指定 | いいえ（開発効率） |
| **P1** | `schema_migrations` 整合 | MATCH 保留解除後に `migration repair` 検討。Phase 1 単独ファイルは repair 不要でも可 | いいえ（本番前推奨） |
| **P2** | `live-short-signed-url` と anon key | anon Bearer で Edge 到達可能 — Phase 1 `live-video-signed-url` 設計時に同方針か再確認 | いいえ（設計確認） |

**本フェーズでは一切実施していないこと（遵守確認）:** DB 変更 · migration 追加 · Edge 追加/変更 · HTML/JS 変更 · IWASHO / 協力パートナー / MATCH コード変更。

---

## 11. 検証ログ参照

| 実行 | 結果 |
|------|------|
| `npm run verify:live-p0-schema` | PASS 68 / FAIL 0 / SKIP 38 |
| `npm run verify:live-p4 --skip-deploy` | PASS 30 / FAIL 0 |
| `npm run verify:live-p7` | PASS 43 / FAIL 0 |
| `supabase db query`（制約 · buckets · policies） | 上記セクションに反映 |

---

## 12. 次のアクション（Phase 1 · 別タスク）

1. **新 migration ファイル** `live_videos` + `live_video_likes` + `live-videos` bucket + RLS + RPC + indexes（**新規ファイルのみ · 既存 `live_*` ALTER 禁止**）
2. staging へ **`db query -f` 個別適用**（`db push` は使わない）
3. Phase 1 verify スクリプト追加 · `u_store` で投稿→保存 smoke
4. Phase 2: `live-video-signed-url` Edge 新規デプロイ

---

*Phase 0.5 完了 — 実装は Phase 1 承認後に着手。*
