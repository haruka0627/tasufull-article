# TASFUL LIVE Phase 5 — ライブ視聴 / 配信準備 / スタジオ / コメント 実装結果

| 項目 | 内容 |
|------|------|
| 実行日 | **2026-06-23** |
| スコープ | ライブ視聴 UI · 配信作成 · スタジオ stub · コメント最小実装 |
| 対象外 | Cloudflare Stream 本接続 · 投げ銭 · migration |

---

## 判定

| 判定 | **Phase 5 完了 — smoke / 回帰 PASS** |
|------|--------------------------------------|
| 意味 | `live_broadcasts` / `live_broadcast_messages` 接続 · stub 配信 · 390/768/1280 console error 0 |

---

## 1. 実装ファイル一覧

| ファイル | 変更 |
|----------|------|
| [`live/watch.html`](../live/watch.html) | **新規** — ライブ視聴 |
| [`live/create.html`](../live/create.html) | **新規** — 配信作成 |
| [`live/studio.html`](../live/studio.html) | **新規** — 配信スタジオ |
| [`live/live-broadcasts.js`](../live/live-broadcasts.js) | **新規** — 一覧 / 視聴 / スタジオ |
| [`live/live-create.js`](../live/live-create.js) | **新規** — 配信 insert |
| [`live/live-comments.js`](../live/live-comments.js) | **新規** — コメント表示 / 投稿 |
| [`live/live-config.js`](../live/live-config.js) | broadcasts / messages テーブル · stub 定数 |
| [`live/live.css`](../live/live.css) | ライブ / スタジオ / コメント UI |
| [`live/index.html`](../live/index.html) | ライブ中セクション · カード有効化 |
| [`breadcrumb-config.js`](../breadcrumb-config.js) | watch / create / studio |
| [`scripts/verify-live-p5-broadcasts.mjs`](../scripts/verify-live-p5-broadcasts.mjs) | **新規** |
| [`package.json`](../package.json) | `verify:live-p5` |

---

## 2. ライブ一覧 / 視聴

### データ

- テーブル: `live_broadcasts`
- 一覧: `status in (live, scheduled, ended)` — RLS により他人の scheduled は非表示
- 視聴: `watch.html?broadcast_id=<uuid>`
- stub: `broadcast_id=stub&talkDev=1` で DB なしプレビュー

### プレイヤー

| stream_provider | P0 表示 |
|-----------------|---------|
| `stub` | 16:9 プレースホルダ（「スタブ配信プレビュー」） |
| `cloudflare_stream` | `playback_url` があれば video、なければプレースホルダ |

**Cloudflare Stream API 本接続なし** — `LIVE_STREAM_PROVIDER_DEFAULT = stub`

### 導線

- 配信者プロフィール → `profile.html?userId=...`
- TALK 相談 → プロフィールページ（Phase 2 導線）

---

## 3. 配信作成（create.html）

| 項目 | 実装 |
|------|------|
| 入力 | title · description（UI のみ）· visibility（UI のみ）· scheduled_at · status |
| 権限 | `live_permission_status` が identity_verified / ops_approved + creator_status=active |
| 拒否時 | 「本人確認または運営許可が必要」 |
| insert | `stream_provider: stub` · status: scheduled / preparing |

---

## 4. スタジオ（studio.html）

| 操作 | P0 動作 |
|------|---------|
| 一覧 | 自分の全 status 表示 |
| 配信開始 | `status → live` · `started_at` 設定 |
| 終了 | `status → ended` · `ended_at` 設定 |
| 実映像 | **未接続** |

---

## 5. コメント

| 項目 | 実装 |
|------|------|
| テーブル | `live_broadcast_messages` |
| 表示 | `watch.html` 下部 |
| 投稿 | ログイン必須 · **status=live のみ** |
| scheduled / ended | 閲覧のみ（投稿フォーム非表示） |
| 削除 | 自分のコメントのみ（owner delete） |
| stub 配信 | コメント投稿無効 |

### 集計（Phase 4 からの継続）

- `like_count` / `follower_count` 自動集計: **変更なし** · Phase 5 以降で RPC/trigger 検討

---

## 6. 検証結果

### `npm run verify:live-p5`

| PASS | FAIL | SKIP |
|------|------|------|
| 59 | 0 | 0 |

- 静的: `live_broadcasts` / `live_broadcast_messages` · `stream_provider=stub` · Stream API 未使用
- URL: index / create / studio / watch?broadcast_id=stub&talkDev=1
- 390 / 768 / 1280: console error **0**

### 回帰

| コマンド | 結果 |
|----------|------|
| `npm run verify:live-p4` | **PASS** |
| `npm run verify:live-p3` | **PASS** 36/0/0 |
| `npm run verify:live-p2` | **PASS** 36/0/6 |
| `npm run verify:live-p1` | **PASS** 31/0/3 |
| `npm run verify:live-p0-schema` | **PASS** 68/0/38 |
| `verify-talk-chat-unify-p1` | **PASS** 22/22 |
| `smoke-match-talk-room` | **PASS** 16 |

---

## 7. 手動確認

```text
http://127.0.0.1:8788/live/index.html?talkDev=1
http://127.0.0.1:8788/live/create.html?talkDev=1
http://127.0.0.1:8788/live/studio.html?talkDev=1
http://127.0.0.1:8788/live/watch.html?broadcast_id=stub&talkDev=1
```

---

## 8. Phase 6 以降への引き継ぎ

| 項目 | 内容 |
|------|------|
| Cloudflare Stream Live | RTMP / HLS 本接続 |
| description / visibility | DB カラム追加（migration） |
| 投げ銭 | `live_tips` |
| like / follower 集計 | trigger / RPC |
| Realtime コメント | `live_broadcast_messages` subscription |

---

## 9. 総括

Phase 5 で TASFUL LIVE の **ライブ視聴・配信準備・スタジオ stub・コメント** が P0 スキーマ上で動作する最小実装が完了した。映像配信本体は意図的に未接続とし、`stream_provider=stub` を既定としている。
