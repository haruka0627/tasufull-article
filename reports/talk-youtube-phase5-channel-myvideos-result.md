# TASFUL LIVE YouTube P1 — Phase 5 チャンネル動画グリッド / マイ動画管理

**実施日:** 2026-06-23  
**ステージング:** `ddojquacsyqesrjhcvmn`  
**検証:** `npm run verify:live-youtube-p5` → **PASS** (40/40)

---

## 作成 / 変更ファイル

| ファイル | 種別 |
|---------|------|
| `live/profile.html` | 拡張（`live-videos.js` 読込） |
| `live/live-profile.js` | 拡張（チャンネル動画グリッド、`mountProfileVideosSection`） |
| `live/my-videos.html` | **新規** |
| `live/live-my-videos.js` | **新規** |
| `live/live-videos.js` | 拡張（`fetchCreatorChannelVideos`, グリッド描画） |
| `live/live-config.js` | 拡張（status/visibility ラベル、`myVideosUrl`） |
| `live/live.css` | 最小限スタイル追加 |
| `live/index.html` | マイ動画カード導線 |
| `live/videos.html` | マイ動画リンク |
| `live/live-video-upload.js` | 投稿成功時「マイ動画へ」 |
| `breadcrumb-config.js` | `my-videos` / 動画系パンくず |
| `scripts/verify-live-youtube-p5-channel-myvideos.mjs` | **新規** |
| `package.json` | `verify:live-youtube-p5` |
| `deploy/cloudflare/dist/live/*` | 上記同期 |
| `deploy/cloudflare/dist/breadcrumb-config.js` | 同期 |

---

## チャンネル動画グリッド仕様

**対象:** `profile.html?userId=<talk_user_id>`

| 閲覧者 | クエリ条件 | 表示 |
|--------|-----------|------|
| 他人 | `status=published` AND `visibility=public` | 公開動画のみ |
| 本人 | `status != removed` | 全状態（バッジ付き） |

**カード項目:** サムネイル、タイトル、再生数、投稿日、（本人のみ）status / visibility バッジ  
**遷移:** `watch-video.html?id=<video_id>`  
**セクション:** プロフィールカード下に「動画」セクション（ショートグリッドは未実装のため分離のみ。他人向けに「ショートを見る」リンク）

プロフィール未作成のチャンネルでも、公開動画があればグリッドを表示（Phase 5 追加）。

---

## マイ動画管理仕様

**対象:** `my-videos.html`（ログイン必須）

**一覧:** サムネイル、タイトル、status、visibility、再生数、いいね数、投稿日

**操作（RLS `live_videos_update_own` 経由、service_role 不使用）:**

| 操作 | 実装 |
|------|------|
| 公開に戻す | `status=published`（`published_at` 更新） |
| 非表示 | `status=hidden` |
| 削除相当 | `status=removed`（物理削除なし） |
| 公開範囲 | `visibility` を public / unlisted / private に変更 |
| 確認 | `watch-video.html` リンク |

`live-video-admin` Edge は使用しない（管理者専用のまま）。

---

## status / visibility の扱い

| status | 他人プロフィール | 公開一覧 `videos.html` | 本人マイ動画 |
|--------|-----------------|----------------------|-------------|
| `published` + `public` | ○ | ○ | ○ |
| `published` + `private/unlisted` | × | ×（public のみ） | ○ |
| `hidden` | × | × | ○ |
| `draft` / `processing` | × | × | ○ |
| `removed` | × | × | ○（削除済み表示） |

ラベル: `live-config.js` の `labelVideoStatus` / `labelVideoVisibility`

---

## 導線

| 起点 | 追加リンク |
|------|-----------|
| `index.html` | マイ動画カード |
| `videos.html` | マイ動画 |
| `video-upload.html` 成功 | マイ動画へ |
| `profile.html`（本人） | マイ動画で管理 |
| `my-videos.html` | 投稿 / プロフィール |

既存 short / LIVE / TALK 導線は変更なし。

---

## 検証結果

`npm run verify:live-youtube-p5` 項目:

| # | 項目 | 結果 |
|---|------|------|
| 1 | 他人 profile は published+public のみ | PASS |
| 2 | 自分 profile は hidden 含む | PASS |
| 3 | profile カード → watch-video | PASS |
| 4 | my-videos 一覧表示 | PASS |
| 5 | hidden にできる | PASS |
| 6 | hidden は公開一覧から消える | PASS |
| 7 | published に戻せる | PASS |
| 8 | removed で一覧から消える | PASS |
| 9 | 他人の動画は更新不可 | PASS |
| 10 | short 既存 UI  intact | PASS |
| 11–14 | p2 / p3 / p4 / live-p4 回帰 | PASS |

---

## 回帰確認

- `verify:live-youtube-p2 --skip-deploy` PASS
- `verify:live-youtube-p3` PASS
- `verify:live-youtube-p4` PASS
- `verify:live-p4 --skip-deploy` PASS

---

## 未解決事項

1. **ショート投稿グリッド:** プロフィール上のショート一覧は未実装（「ショートを見る」リンクのみ）。Phase 6 以降でタブ分離可。
2. **removed 動画の復元 UI:** P1 では削除後の「復元」ボタンなし（DB 上は `status` 変更で可能）。
3. **draft 投稿フロー:** 現状アップロードは即 `published`。下書き投稿 UI は Phase 6+。
4. **Storage 物理削除:** `removed` 後もオブジェクトは残存（P1 仕様どおり）。
5. **live-notify `video_published`:** 未接続（Phase 2 レポート TODO のまま）。

---

## Phase 6 判定

**GO: Phase 6 最小管理 / 通報 / 広告枠整理に進行可能**

理由:
- 投稿者本人のチャンネル表示・マイ動画管理が RLS 経由で動作
- 公開一覧との整合（hidden / removed の非表示）確認済み
- 既存 short / LIVE 回帰 PASS
- 管理者 Edge（`live-video-admin`）と投稿者 UI の責務分離済み

Phase 6 で優先: `live_video_reports` 通報 UI、`live_video_ads` 枠整理、`live-video-admin` と運営ダッシュボード連携。
