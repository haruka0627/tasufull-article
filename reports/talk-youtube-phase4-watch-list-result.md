# TASFUL LIVE → YouTube型 P1 — Phase 4 一覧/再生 UI 実装結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日 | 2026-06-23 |
| 環境 | staging `ddojquacsyqesrjhcvmn` · dev `:8788` |
| 前提 | Phase 1〜3 GO |

---

## 最終判定

| 判定 | **GO** |
|------|--------|
| 意味 | 長尺動画の **一覧表示 → 専用再生ページ → signed URL 再生 → view 加算 → いいね** が通過。既存ショート/LIVE 回帰 PASS。**Phase 5 チャンネル動画グリッド / マイ動画管理に進行可能。** |

---

## 作成 / 変更ファイル

| ファイル | 種別 |
|----------|------|
| [`live/videos.html`](../live/videos.html) | 新規 · 一覧ページ |
| [`live/watch-video.html`](../live/watch-video.html) | 新規 · 再生ページ |
| [`live/live-videos.js`](../live/live-videos.js) | 新規 · 一覧/検索 |
| [`live/live-watch-video.js`](../live/live-watch-video.js) | 新規 · 再生/view/いいね |
| [`live/live-config.js`](../live/live-config.js) | 変更 · Edge view 呼び出し等 |
| [`live/live.css`](../live/live.css) | 変更 · カード/再生レイアウト |
| [`live/index.html`](../live/index.html) | 変更 · 動画導線 |
| [`live/shorts.html`](../live/shorts.html) | 変更 · 長尺一覧リンク |
| [`breadcrumb-config.js`](../breadcrumb-config.js) | 変更 · パンくず |
| [`deploy/cloudflare/dist/live/`](../deploy/cloudflare/dist/live/) | 同期 |
| [`scripts/verify-live-youtube-p4-watch-list.mjs`](../scripts/verify-live-youtube-p4-watch-list.mjs) | 新規 |
| `package.json` | `verify:live-youtube-p4` |

**変更なし:** `live-short-upload.js` · `live-shorts.js` · Edge Functions

---

## 一覧ページ仕様（videos.html）

| 項目 | 内容 |
|------|------|
| URL | `live/videos.html` |
| 取得 | `live_videos` · `status=published` · `visibility=public` · `published_at desc` |
| 検索 | タイトル/説明 `ilike`（Enter または検索ボタン） |
| カード | サムネ（public `live-thumbnails` URL or プレースホルダ）· タイトル · 投稿者 · 再生数 · いいね数 · 投稿日 |
| signed URL | **一覧では発行しない** |
| 遷移 | カードクリック → `watch-video.html?id=` |
| 導線 | 投稿 · ショート一覧 · LIVE トップ |

---

## 再生ページ仕様（watch-video.html）

| 項目 | 内容 |
|------|------|
| URL | `live/watch-video.html?id=<uuid>` |
| 認証 | ログイン必須（未ログインは案内表示） |
| 再生 | `live-video-signed-url` → `<video src>` |
| poster | `thumbnail_signed_url` または public サムネ URL |
| メタ | タイトル · 投稿者 · 再生数 · 投稿日 · 説明 |
| いいね | `live_video_likes` insert/delete + `live_refresh_video_like_count` RPC |
| エラー | 401 ログイン / 403 権限 / 404 不在 |

---

## signed URL 利用方法

```text
POST /functions/v1/live-video-signed-url
Authorization: Bearer <user JWT>
{ "video_id": "uuid" }

→ video_signed_url, thumbnail_signed_url?, expires_in: 300, video: { ... }
```

- **anon key 不可**（Phase 2 設計どおり）
- private / unlisted / draft 等は Edge が判定

---

## view 加算方法

```text
POST /functions/v1/live-video-view
Authorization: Bearer <user JWT>
{ "video_id": "uuid" }

→ { ok: true, views_count: N }
```

- 再生ページ mount 時に 1 回呼び出し
- P1: 同一ユーザ dedupe なし

---

## いいね実装

| 操作 | 実装 |
|------|------|
| 状態取得 | `live_video_likes` SELECT（`talk_user_id`） |
| いいね | INSERT `(video_id, talk_user_id)` |
| 解除 | DELETE |
| カウント | `live_refresh_video_like_count(p_video_id)` RPC |

RLS: 公開動画のみ他者いいね可（Phase 1 migration）

---

## 導線

| From | To |
|------|-----|
| `index.html` | `videos.html` · `video-upload.html` |
| `shorts.html` | `videos.html`（ヘッダリンク） |
| `videos.html` | `watch-video.html` · `video-upload.html` · `shorts.html` |
| `watch-video.html` | `videos.html` · `profile.html` |
| `video-upload.html`（Phase 3） | `watch-video.html?id=` |

---

## 検証結果

`npm run verify:live-youtube-p4` — **PASS 34 / FAIL 0**

| # | 項目 | 結果 |
|---|------|------|
| 1 | published public 一覧表示 | ✅ |
| 2 | 検索（alpha） | ✅ |
| 3 | カード → watch URL | ✅ 静的 + UI |
| 4 | signed URL 再生 | ✅ API + UI `<video>` |
| 5 | views_count +1 | ✅ |
| 6 | いいね/解除 | ✅ |
| 7 | private 他者 403 | ✅ |
| 8 | 401 anon | ✅ |
| 9 | short-upload / shorts 無破壊 | ✅ |
| 10 | verify:live-youtube-p2 | ✅ |
| 11 | verify:live-youtube-p3 | ✅ |
| 12 | verify:live-p4 | ✅ |

---

## 回帰確認

| 対象 | 結果 |
|------|------|
| ショート投稿/一覧 JS | ✅ 未変更 |
| LIVE P0 schema | ✅（p2/p4 経由） |
| 長尺 Edge | ✅ p2 |
| dist 同期 | ✅ |

---

## 未解決事項

| # | 項目 | Phase 5 影響 |
|---|------|-------------|
| 1 | **チャンネル投稿グリッド未実装** | `live-profile.js` 拡張予定 |
| 2 | **マイ動画管理（下書き等）なし** | Phase 5 |
| 3 | **一覧サムネ** private 動画サムネは非表示（public bucket のみ） | 低 |
| 4 | **view dedupe なし** | 低 |
| 5 | **ページネーションなし** | limit 24 固定 |
| 6 | **関連動画・コメントなし** | 将来 |

---

## Phase 5 に進めるか

| 判定 | **GO** |
|------|--------|
| 次ステップ | 1. `live-profile.js` にチャンネル動画グリッド 2. `my-videos.html` または studio 相当で自分の動画管理 3. `live-notify` に `video_published`（任意） |

**コアフロー「投稿 → 一覧 → 再生」は完了。**

---

*Phase 4 一覧/再生 UI 完了。*
