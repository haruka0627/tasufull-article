# TASFUL LIVE Phase 3 — ショートフィード / 投稿 / いいね 実装結果

| 項目 | 内容 |
|------|------|
| 実行日 | **2026-06-23** |
| スコープ | ショートフィード · 投稿 UI · signed URL 再生 · いいね最小実装 · smoke |
| 対象外 | Edge · migration · ライブ配信 · 投げ銭 · トランスコード |

---

## 判定

| 判定 | **Phase 3 完了 — smoke / 回帰 PASS** |
|------|--------------------------------------|
| 意味 | `live_shorts` 公開フィード表示 · `short-videos` へアップロード · `live_short_likes` トグル · 390/768/1280 console error 0 |

---

## 1. 実装ファイル一覧

| ファイル | 変更 |
|----------|------|
| [`live/shorts.html`](../live/shorts.html) | **新規** — ショートフィード画面 |
| [`live/short-upload.html`](../live/short-upload.html) | **新規** — ショート投稿画面 |
| [`live/live-shorts.js`](../live/live-shorts.js) | **新規** — フィード取得 · signed URL · いいね |
| [`live/live-short-upload.js`](../live/live-short-upload.js) | **新規** — MP4 アップロード · `live_shorts` insert |
| [`live/live-config.js`](../live/live-config.js) | `live_shorts` / `live_short_likes` · TTL 300 · `short-videos` ヘルパー |
| [`live/live.css`](../live/live.css) | 9:16 フィード · 投稿フォーム · いいねボタン |
| [`live/index.html`](../live/index.html) | ショート / 投稿カード有効化 |
| [`breadcrumb-config.js`](../breadcrumb-config.js) | shorts / short-upload パンくず |
| [`scripts/verify-live-p3-shorts.mjs`](../scripts/verify-live-p3-shorts.mjs) | **新規** Phase 3 smoke |
| [`package.json`](../package.json) | `verify:live-p3` |
| `deploy/cloudflare/dist/live/*` | dist 同期（手動コピー） |

**変更なし（遵守）:** Edge · migration · TALK / MATCH / Marketplace / Builder

---

## 2. ショートフィード

### データ取得

- テーブル: `live_shorts`
- 条件: `status = 'published'`
- 並び: `published_at DESC`
- クリエイター: `live_creator_profiles` を `creator_id` で JOIN 相当（別 SELECT）しフォロワー数表示

### 動画再生

| 項目 | 実装 |
|------|------|
| バケット | `short-videos`（private） |
| パス | `{talk_user_id}/{short_uuid}.mp4`（`storage_path`） |
| signed URL TTL | **300 秒**（`LIVE_SIGNED_URL_TTL_SECONDS`） |
| レイアウト | `aspect-ratio: 9/16` · `object-fit: contain` |

### 導線

- クリエイター行 → `profile.html?userId=...`
- 「プロフィール / TALK相談」→ 同上（TALK はプロフィールページの Phase 2 導線を利用）

### 制限事項（P0 RLS）

Storage policy `live_storage_short_videos_select_own` により **オブジェクト所有者のみ** signed URL 取得可。

| 視聴者 | 再生 |
|--------|------|
| 自分のショート | signed URL で再生 |
| 他クリエイターのショート | プレースホルダ表示（Edge / Storage RLS 変更は **Phase 4**） |

---

## 3. ショート投稿

| 項目 | 実装 |
|------|------|
| 入力 | title（必須）· description（任意）· MP4 ファイル |
| 形式 | `video/mp4` のみ · クライアント側 `probeVideoFileMeta` で **60 秒以内**チェック |
| Storage | `short-videos` に `upload`（`contentType: video/mp4`） |
| DB | `live_shorts` に insert（`id` = UUID · `storage_path` · `duration_sec` · `width` / `height`） |
| status | `draft` / `published` 選択可 · `published` 時 `published_at` を設定 |
| 日次 10 本 | **注意文のみ**（Edge 強制は Phase 4） |
| active 50 本 | DB CHECK `live_short_active_count` に依存 |
| 投稿権限 | `live_has_broadcast_permission`（本人確認済み / 運営許可済み + `creator_status=active`） |

---

## 4. いいね

| 項目 | Phase 3 実装 |
|------|----------------|
| テーブル | `live_short_likes` |
| 操作 | insert / delete（トグル） |
| 自分の状態 | `fetchUserLikes` で `short_id` Set を構築し UI 反映 |
| 件数表示 | like/unlike 後 **`live_shorts` を再 SELECT** し `like_count` を表示更新 |

### Phase 4 送り

| 項目 | 現状 |
|------|------|
| `like_count` 自動集計 trigger / RPC | **未実装** — DB デフォルト 0 のまま。いいね操作後も `like_count` カラムは増減しない可能性あり |
| 対応予定 | Phase 4 で trigger または Edge 集計を追加 |

---

## 5. 検証結果

### `npm run verify:live-p3`

| PASS | FAIL | SKIP |
|------|------|------|
| 36 | 0 | 0 |

- 静的: TTL 300 · `short-videos` · `live_shorts` / `live_short_likes` · MP4 · 60 秒チェック
- URL: `live/shorts.html?talkDev=1` · `live/short-upload.html?talkDev=1`
- 390 / 768 / 1280: console error **0**

### 回帰

| コマンド | 結果 |
|----------|------|
| `npm run verify:live-p2` | **PASS** 36 / 0 / 6 |
| `npm run verify:live-p1` | **PASS** 31 / 0 / 3 |
| `npm run verify:live-p0-schema` | **PASS** 68 / 0 / 38 |
| `verify-talk-chat-unify-p1.mjs` | **PASS** 22/22 |
| `smoke-match-talk-room.mjs` | **PASS** 16 |

---

## 6. 手動確認

```text
http://127.0.0.1:8788/live/shorts.html?talkDev=1
http://127.0.0.1:8788/live/short-upload.html?talkDev=1
```

1. フィード: 公開ショート一覧 or 空状態
2. 投稿: MP4 選択 → メタ表示（秒数 · 解像度）→ 下書き/公開で保存
3. 自分の公開ショート: フィードで video 再生
4. いいね: ♥ トグル（ログイン必須）· 件数は DB 再読込値
5. プロフィールリンク → TALK 相談（Phase 2 導線）

---

## 7. Phase 4 への引き継ぎ

| 項目 | 内容 |
|------|------|
| 他者ショート signed URL | Storage RLS 緩和 or Edge `get-short-playback-url` |
| `like_count` 自動集計 | trigger / RPC on `live_short_likes` |
| 日次 10 本制限 | Edge または DB 関数で強制 |
| フォロー通知 fanout | `TasuLiveNotify` → Edge |
| サムネイル | `short-video-thumbnails` bucket 連携 |

---

## 8. 総括

Phase 3 により TASFUL LIVE の **ショート表示・投稿・いいね UI** が P0 スキーマ上で動作する最小実装が完了した。private bucket + signed URL（TTL 300）の前提はコード上で満たしているが、**他クリエイター動画の視聴**と **`like_count` 自動集計**は Phase 4 で対応する。
