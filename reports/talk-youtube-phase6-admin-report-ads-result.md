# TASFUL LIVE YouTube P1 — Phase 6 最小管理 / 通報 / 広告枠整理

**実施日:** 2026-06-23  
**ステージング:** `ddojquacsyqesrjhcvmn`  
**検証:** `npm run verify:live-youtube-p6` → **PASS** (41/41)

---

## 作成 / 変更ファイル

| ファイル | 種別 |
|---------|------|
| `live/live-watch-video.js` | 拡張（通報 UI・広告枠表示） |
| `live/live-config.js` | 拡張（reports/ads テーブル、admin Edge、ラベル） |
| `live/admin-videos.html` | **新規** |
| `live/live-admin-videos.js` | **新規** |
| `live/live.css` | 通報・広告・管理画面スタイル |
| `breadcrumb-config.js` | `admin-videos` パンくず |
| `scripts/verify-live-youtube-p6-admin-report-ads.mjs` | **新規** |
| `package.json` | `verify:live-youtube-p6` |
| `deploy/cloudflare/dist/live/*` | 上記同期 |

---

## 通報 UI 仕様

**対象:** `watch-video.html`（`live-watch-video.js`）

| 項目 | 内容 |
|------|------|
| ボタン | 「通報する」→ フォーム展開 |
| 理由 | spam / abuse / copyright / illegal / other |
| 詳細 | 任意テキスト（最大 2000 文字） |
| ログイン | 必須（既存 watch ページと同様） |
| 自分の動画 | RLS `live_video_is_publicly_viewable` 準拠（公開視聴可能な動画のみ通報可） |
| 重複 | クライアント側で同一ユーザー・同一動画の既存通報をチェックしブロック |
| 成功表示 | フォーム非表示 + 「通報済み」表示 |

---

## 通報 DB 保存仕様

**テーブル:** `live_video_reports`

```json
{
  "video_id": "<uuid>",
  "reporter_talk_user_id": "<talk_user_id>",
  "reason": "spam|abuse|copyright|illegal|other",
  "detail": "<optional>"
}
```

- **RLS:** `live_video_reports_insert_own`（`reporter_talk_user_id = talk_current_user_id()` かつ公開視聴可能動画）
- **件数更新:** INSERT トリガー `live_video_reports_refresh_count` → `live_refresh_video_reports_count` 自動実行
- **フロントから RPC 直呼び:** 不要（トリガーで `reports_count` 更新）

---

## admin-videos 仕様

**URL:** `live/admin-videos.html`  
**対象:** 運営管理者（`live-video-admin` Edge が JWT で検証）

| 表示 | タイトル、投稿者、status、visibility、reports_count、views_count、created_at / published_at、広告枠（表示のみ） |
| 操作 | 非表示（hide）/ 復元（restore）/ 削除相当（remove）/ watch-video で確認 |
| フィルタ | status、タイトル検索（Edge `list` の `q`） |

**権限ゲート:** クライアントの `isTalkAdmin()` ではなく **Edge 403** を正とする（JWT ロール解釈差異を回避）。

投稿者本人管理は `my-videos.html`（RLS 直接 UPDATE）と分離。

---

## live-video-admin 利用方法

`live-config.js` → `fetchVideoAdminViaEdge(body)`

| action | body | 効果 |
|--------|------|------|
| `list` | `{ limit, offset, status?, visibility?, q? }` | 動画一覧 |
| `hide` | `{ video_id }` | `status=hidden` |
| `restore` | `{ video_id }` | `status=published`（`published_at` 未設定時は補完） |
| `remove` | `{ video_id }` | `status=removed` |

- POST + Bearer JWT（`tasu_admin` 等）
- 非 admin → **403**
- service_role はフロントに露出しない

---

## 広告枠の扱い

**テーブル:** `live_video_ads`（P1 手動登録のみ）

**再生ページ (`live-watch-video.js`):**
- `fetchActiveVideoAds(videoId)` — `is_active=true` のみ
- RLS `live_video_ads_select_active` により公開視聴可能動画の枠のみ取得
- 配置:
  - `pre_roll` → プレイヤー上
  - `overlay` → プレイヤー内オーバーレイ
  - `manual` / `mid_roll` → プレイヤー下
- クリック計測・収益分配なし。`target_url` があればリンク表示。

**管理画面:**
- 動画ごとに広告枠ラベルを**表示のみ**（編集 UI なし）

未設定時は広告 DOM を出さず、レイアウト崩れなし。

---

## live_moderation_logs 未対応理由

**調査結果（migration 作成なし）:**

`live_moderation_logs.content_type` CHECK 制約:

```sql
check (content_type in ('live_short', 'live_broadcast_chat', 'live_profile'))
```

`live_video` は含まれないため、Phase 2 Edge の TODO どおり管理操作の監査ログは **未記録**。

**対応方針:** Phase 6.5 で CHECK 拡張 migration を別途適用（`db push` 禁止のため `db query -f`）。今回は既存制約を変更せず、Edge コメント TODO を維持。

---

## 検証結果

`npm run verify:live-youtube-p6`:

| # | 項目 | 結果 |
|---|------|------|
| 1 | watch 通報 UI 表示 | PASS |
| 2 | ログインユーザー通報 | PASS |
| 3 | live_video_reports 登録 | PASS |
| 4 | reports_count 更新 | PASS |
| 5 | admin 非 admin → 403 | PASS |
| 6 | admin 一覧 | PASS |
| 7 | admin hide/restore/remove | PASS |
| 8 | hidden が公開一覧から消える | PASS |
| 9 | 広告枠表示 / 未設定時 OK | PASS |
| 10 | watch/list/my-videos/profile 回帰 | PASS |
| 11–15 | p2/p3/p4/p5/live-p4 回帰 | PASS |

---

## 回帰確認

- `verify:live-youtube-p2 --skip-deploy` PASS
- `verify:live-youtube-p3` PASS
- `verify:live-youtube-p4` PASS
- `verify:live-youtube-p5` PASS
- `verify:live-p4 --skip-deploy` PASS

---

## 未解決事項

1. **live_moderation_logs:** `live_video` 監査ログは Phase 6.5 migration 待ち
2. **通報重複:** DB ユニーク制約なし（クライアントのみ防止）。本番前に `(video_id, reporter_talk_user_id)` UNIQUE 検討可
3. **広告編集 UI:** 管理画面は表示のみ。登録は service_role / SQL または将来 Phase
4. **mid_roll 時刻再生:** `position_sec` は表示ラベルのみ（時刻連動再生なし）
5. **通報レビュー UI:** `status=open` の運営レビュー画面は Phase 7 以降

---

## Phase 7 判定

**GO: Phase 7 最終導線 / UI 整理に進行可能**

理由:
- 通報・運営管理・広告枠の P1 最小要件を満たした
- Edge / RLS / トリガーの責務分離が明確
- Phase 1〜5 機能および short / LIVE 回帰 PASS
- 監査ログのみ Phase 6.5 として切り出し可能（ブロッカーではない）

Phase 7 で優先: ナビ導線統合、通報レビュー一覧（読み取り）、エンプティ状態・モバイル微調整。
