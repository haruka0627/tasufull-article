# TASFUL LIVE P0 Phase 7 — 通知・集計 実装結果

**日付:** 2026-06-23  
**ステータス:** PASS  
**対象:** LIVE通知 / follower_count / like_count / tip_total_yen_stub / live_notify_dedupe / smoke

---

## 概要

Phase 7 では、クライアントから他ユーザーへ `talk_notifications` を直接 insert できない制約のまま、**Edge Function `live-notify`** 経由で LIVE 通知 fanout を実装した。集計は **DB トリガー + SECURITY DEFINER RPC** で正確性を優先（リアルタイム性は P0 では不要）。

---

## 実装ファイル一覧

| 種別 | パス |
|------|------|
| Edge Function | `supabase/functions/live-notify/index.ts` |
| Migration | `supabase/migrations/20260629100000_live_p0_counts.sql` |
| フロント | `live/live-notify.js` |
| フロント | `live/live-config.js`（`LIVE_NOTIFY_FUNCTION`, `getAccessTokenForEdge` export） |
| フロント | `live/live-follow.js`（既存 notify 呼び出し → Edge 接続） |
| フロント | `live/live-shorts.js`（like/unlike 後 `refreshLikeCount`） |
| フロント | `live/live-tips.js`（tip insert 後 `notifyTipCreated`） |
| フロント | `live/live-broadcasts.js`（配信開始後 `notifyBroadcastStarted`、tip_total 表示） |
| フロント | `live/live-profile.js`（受け取った応援合計表示） |
| HTML | `live/gifts.html`, `live/studio.html`, `live/shorts.html`（`live-notify.js` 読込） |
| 検証 | `scripts/verify-live-p7-notify-counts.mjs` |
| npm | `package.json` → `verify:live-p7` |
| dist 同期 | `deploy/cloudflare/dist/live/*` ほか |

---

## Migration 適用結果

**ファイル:** `20260629100000_live_p0_counts.sql`

**適用方法:** staging (`ddojquacsyqesrjhcvmn`) へ `supabase db query --linked` で SQL 実行（`db push` は未適用の旧 MATCH migration キューで停止するため、本 migration のみ個別適用）。

**内容:**

1. `live_creator_profiles_guard_owner_update` — `live.internal_count_refresh` セッション時は `follower_count` 更新を許可
2. RPC:
   - `live_refresh_creator_follower_count(text)`
   - `live_refresh_short_like_count(uuid)`
   - `live_refresh_broadcast_tip_total_stub(uuid)`
3. トリガー:
   - `live_creator_follows` INSERT/DELETE → `follower_count`
   - `live_short_likes` INSERT/DELETE → `like_count`
   - `live_tips` INSERT（broadcast 対象）→ `live_broadcasts.tip_total_yen_stub`

**プロフィール側 tip 合計:** 新規カラムは追加せず、`live_tips` を `creator_id` で SUM してプロフィールに表示（軽量方針）。

---

## Edge Function `live-notify`

**デプロイ:** `ddojquacsyqesrjhcvmn` · `--no-verify-jwt`

**API:** `POST /functions/v1/live-notify`

```json
{ "event": "follow_created|tip_created|broadcast_started|like_changed", "payload": { ... } }
```

| event | recipient | title 例 | 集計 |
|-------|-----------|----------|------|
| `follow_created` | creator | 新しいフォロワー | `follower_count` RPC |
| `tip_created` | creator | 応援ギフトが届きました | `tip_total_yen_stub` RPC |
| `broadcast_started` | followers（notify ON） | ライブ配信が始まりました | — |
| `like_changed` | — | — | `like_count` RPC |

**payload（`talk_notifications.body` 2行目 JSON）:**

- `service_type`: `"live"`
- `service_ref_id`: creator_id / broadcast_id / tip target 等
- `event`, `actor_id` ほか

**重複防止:** `live_notify_dedupe.event_key`

- follow: `follow_created:{creator}:{follower}`
- tip: `tip_created:{tip_id}`
- broadcast 全体: `broadcast_started:{broadcast_id}`
- broadcast 個別: `broadcast_started:{broadcast_id}:{follower_id}`

**fanout 上限（P0）:** `BROADCAST_FANOUT_MAX = 50`（超過分は P1 でページング / バッチ検討）

**talkDev=1:** Edge スキップ。like_count は RPC フォールバック可。通知は Edge 未呼び出し（P0 想定）。

---

## 検証結果

### `npm run verify:live-p7`

| 区分 | PASS | FAIL | SKIP |
|------|------|------|------|
| 全体 | 42 | 0 | 2 |

主な確認項目:

- follow insert → `follower_count` 0→1（トリガー）
- like insert → `like_count` = 1（トリガー）
- tip insert → `tip_total_yen_stub` = 300（トリガー）
- Edge `follow_created` / `tip_created` / `broadcast_started`
- `talk_notifications.type=live` + `live_notify_dedupe` 使用
- UI smoke 390 / 768 / 1280 · console error 0

### 回帰

| コマンド | 結果 |
|----------|------|
| `verify:live-p6` | PASS 49/0/0 |
| `verify:live-p5` | PASS 59/0/0 |
| `verify:live-p4` | PASS 30/0/1 |
| `verify:live-p3` | PASS 36/0/0 |
| `verify:live-p2` | PASS 35/0/7（`P2-notify-deferred` SKIP — Phase 7 で Edge 実装済みのため） |
| `verify:live-p1` | PASS 31/0/3 |
| `verify:live-p0-schema` | PASS 68/0/38 |
| `verify-talk-chat-unify-p1` | PASS 22/22 |
| `smoke-match-talk-room` | PASS 16 checks |

---

## 禁止事項の遵守

- Stripe Checkout / Cloudflare Stream 本接続: 未実装
- `talk_notifications` スキーマ変更: なし（`type=live` insert のみ）
- MATCH / Marketplace / Builder 変更: なし

---

## P1 送り（明示）

- `broadcast_started` fanout の 50 件超・再配信・失敗リトライ
- `platform-notify-action-labels.js` への LIVE CTA ラベル統一
- プロフィール `tip_total_yen_stub` カラム化（必要なら）
- `verify:live-p2` の `P2-notify-deferred` チェックを Phase 7 向けに更新

---

## 結論

**Phase 7 PASS** — LIVE 通知（follow / tip / broadcast 開始）、集計（follower / like / broadcast tip stub）、dedupe、`talk_notifications type=live` 連携、および全回帰 smoke を完了。
