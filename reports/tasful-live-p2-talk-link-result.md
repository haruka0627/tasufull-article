# TASFUL LIVE Phase 2 — TALK 相談導線 / follower_count 再取得 実装結果

| 項目 | 内容 |
|------|------|
| 実行日 | **2026-06-23** |
| スコープ | TALK 相談実接続 · `service_type=live` · follower_count 再取得 · 通知検討 |
| 対象外 | Edge 新規 · migration · ショート / 配信 / 投げ銭 |

---

## 判定

| 判定 | **Phase 2 完了 — smoke / 回帰 PASS** |
|------|--------------------------------------|
| 意味 | `TALKで相談` が `ensure-talk-room` 経由で接続。フォロー後に `follower_count` を DB 再読込。フォロー通知 DB fanout は Phase 3 へ |

---

## 1. 実装ファイル一覧

| ファイル | 変更 |
|----------|------|
| [`live/live-talk-bridge.js`](../live/live-talk-bridge.js) | **新規** — `ensureTalkRoom` ラッパー（`service_type=live`） |
| [`live/live-notify.js`](../live/live-notify.js) | **新規** — フォロー通知フック（Phase 3 委譲） |
| [`live/live-profile.js`](../live/live-profile.js) | TALK ボタン実接続 · `refreshFollowerCountDisplay` |
| [`live/live-follow.js`](../live/live-follow.js) | フォロー後カウント再取得 · notify 呼び出し |
| [`live/live-config.js`](../live/live-config.js) | `u_creator` 表示名 |
| [`live/profile.html`](../live/profile.html) | `chat-supabase.js` · `talk-room-ensure.js` 読込 |
| [`scripts/verify-live-p2-talk-link.mjs`](../scripts/verify-live-p2-talk-link.mjs) | **新規** Phase 2 smoke |
| [`package.json`](../package.json) | `verify:live-p2` |

**変更なし（遵守）:** `talk-room-ensure.js` · Edge · migration · MATCH / Builder / Marketplace

---

## 2. TALK ルーム生成

### 呼び出し経路

`live/profile.html` → `TasuLiveTalkBridge.ensureLiveCreatorTalkRoom()` → `TasuTalkRoomEnsure.ensureTalkRoom()`

### ペイロード

| フィールド | 値 |
|------------|-----|
| `listing_type` | `live_creator` |
| `listing_id` | `creator_user_id` |
| `service_type` | `live` |
| `service_ref_id` | `creator_user_id` |
| `buyer_id` | 閲覧者（`talk_current_user_id`） |
| `seller_id` | クリエイター |
| `participants` | `[viewer, creator]` |
| `source` | `tasful_live` |
| `from` | `live_profile` |

### 遷移先

- `talkDev=1` / stub モード: `chat-detail.html?room=00000000-0000-4000-8000-000000000099`（既存 stub）
- 本番: Edge `ensure-talk-room` → 失敗時 `TasuChatSupabase.createListingTalkRoom` fallback → `../chat-detail.html?room=...`

### 表示条件

- **他人の公開プロフィール**にのみ「TALKで相談」表示
- 自分のプロフィールには非表示

---

## 3. follower_count

| 項目 | Phase 2 実装 |
|------|----------------|
| 自動集計 trigger / RPC | **なし**（migration 追加なし） |
| フォロー / 解除後 | `live_creator_profiles` を **再 SELECT** し `[data-live-follower-count]` を更新 |
| DB 値が増減しない場合 | 表示は変わらない（**自動集計は Phase 3 以降**） |

---

## 4. 通知

| 項目 | 判定 |
|------|------|
| `talk_notifications.type=live` | DB 変更不要（P0 検証済み） |
| フォロー時 creator 向け通知 | **Phase 3 に送る** |
| 理由 | `talk_notifications_insert_own` RLS — フォロワーは creator の `user_id` 行を insert 不可。`live_notify_dedupe` は admin/service_role のみ |
| Phase 2 コード | `TasuLiveNotify.notifyCreatorOnFollow()` は `skipped: phase3_edge_fanout` を返すのみ |

---

## 5. 検証結果

### `npm run verify:live-p2`

| PASS | FAIL | SKIP |
|------|------|------|
| 36 | 0 | 6 |

- 静的: `service_type=live` · `listing_type=live_creator` · `ensureTalkRoom` 使用確認
- 390 / 768 / 1280: console error 0
- `u_creator` / `u_store` の TALK CTA SKIP = ステージングにプロフィール未作成（想定内）

### 回帰

| コマンド | 結果 |
|----------|------|
| `npm run verify:live-p1` | **PASS** 31 |
| `npm run verify:live-p0-schema` | **PASS** 68 |
| `verify-talk-chat-unify-p1.mjs` | **PASS** 22/22 |
| `smoke-match-talk-room.mjs` | **PASS** 16 |

---

## 6. 手動確認

```text
http://127.0.0.1:8788/live/profile.html?userId=u_store&talkDev=1
```

1. 公開プロフィール（`creator_status=active`）が存在すること
2. 「TALKで相談」クリック → stub ルームへ遷移
3. フォロー操作後、フォロワー数表示が DB 再読込されること

---

## 7. 次ステップ（Phase 3 候補）

1. `follower_count` 自動集計（trigger または Edge）
2. フォロー通知 fanout（Edge + `live_notify_dedupe`）
3. `talk-category-normalize.js` に `live` 型追加（通知 UI 分類）
4. ショート投稿 UI

---

## 参照

- [tasful-live-p1-profile-follow-result.md](tasful-live-p1-profile-follow-result.md)
- [tasful-live-p0-schema-apply-result.md](tasful-live-p0-schema-apply-result.md)
