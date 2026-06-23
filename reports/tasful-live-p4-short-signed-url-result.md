# TASFUL LIVE Phase 4 — Edge signed URL / 他クリエイター動画視聴 実装結果

| 項目 | 内容 |
|------|------|
| 実行日 | **2026-06-23** |
| スコープ | `live-short-signed-url` Edge · フロント Edge 優先 · 集計方針整理 |
| 対象外 | migration · like/follower 自動集計 · ライブ配信 · 投げ銭 |

---

## 判定

| 判定 | **Phase 4 完了 — Edge live / smoke / 回帰 PASS** |
|------|--------------------------------------------------|
| 意味 | 公開ショートは service role 経由で signed URL（TTL 300）を発行。他クリエイター動画も Edge 経由で視聴可能 |

---

## 1. 実装ファイル一覧

| ファイル | 変更 |
|----------|------|
| [`supabase/functions/live-short-signed-url/index.ts`](../supabase/functions/live-short-signed-url/index.ts) | **新規** — 公開ショート signed URL 発行 |
| [`live/live-config.js`](../live/live-config.js) | `fetchShortSignedUrlViaEdge()` · `LIVE_SHORT_SIGNED_URL_FUNCTION` |
| [`live/live-shorts.js`](../live/live-shorts.js) | Edge 優先 · 自分の動画のみ direct fallback |
| [`scripts/verify-live-p4-short-signed-url.mjs`](../scripts/verify-live-p4-short-signed-url.mjs) | **新規** Phase 4 smoke + Edge live |
| [`package.json`](../package.json) | `verify:live-p4` |
| `deploy/cloudflare/dist/live/live-config.js` | dist 同期 |
| `deploy/cloudflare/dist/live/live-shorts.js` | dist 同期 |

**変更なし（遵守）:** migration · TALK / MATCH / Marketplace / Builder

---

## 2. Edge Function: `live-short-signed-url`

### リクエスト

```http
POST /functions/v1/live-short-signed-url
Authorization: Bearer <user_jwt>
Content-Type: application/json

{ "short_id": "<uuid>" }
```

### 処理フロー

1. Bearer トークン必須（401）
2. `short_id` 必須・UUID 形式（400）
3. service role で `live_shorts` を SELECT
4. 存在しない → **404**
5. `status !== published`（draft / hidden / removed）→ **403**
6. `storage_path` を `short-videos` bucket で **TTL 300 秒** signed URL 発行
7. `{ ok, short_id, signedUrl, expiresIn: 300, expiresAt }` を返却

### デプロイ

```bash
npx supabase functions deploy live-short-signed-url \
  --project-ref ddojquacsyqesrjhcvmn \
  --no-verify-jwt --use-api --yes
```

Phase 4 検証時にステージングへデプロイ済み。

---

## 3. フロント修正

### `resolveVideoUrl` 優先順位

| 順 | 経路 | 条件 |
|----|------|------|
| 1 | `fetchShortSignedUrlViaEdge(short.id)` | 本番（`talkDev=1` 以外） |
| 2 | `getSignedShortVideoUrl(storage_path)` | Edge 失敗かつ **自分の動画** |
| 3 | プレースホルダ | 上記いずれも失敗 |

`talkDev=1` では Edge をスキップし、従来どおり owner direct fallback のみ（console error 0 を維持）。

---

## 4. 集計方針（今回の整理）

### like_count

| 項目 | Phase 4 |
|------|---------|
| trigger / RPC 自動集計 | **作らない** |
| UI 更新 | like/unlike 後 `live_shorts` 再 SELECT |
| 既知制限 | DB `like_count` カラムは likes 行数と連動しない可能性あり |
| 次フェーズ | **Phase 5 以降** で集計 RPC / trigger 検討 |

### follower_count

| 項目 | Phase 4 |
|------|---------|
| 変更 | **なし**（Phase 2 同様・再 SELECT のみ） |
| 次フェーズ | **Phase 5 以降** で集計 RPC / trigger 検討 |

---

## 5. 検証結果

### `npm run verify:live-p4`

| PASS | FAIL | SKIP |
|------|------|------|
| 30 | 0 | 1（`--skip-deploy` 時） |

**Edge live:**

| ケース | 期待 | 結果 |
|--------|------|------|
| `short_id` 欠落 | 400 | PASS |
| 不正 UUID | 400 | PASS |
| 存在しない ID | 404 | PASS |
| draft / hidden / removed | 403 | PASS |
| published + Storage オブジェクトあり | 200 + signedUrl | PASS |
| `expiresIn` | 300 | PASS |

**Viewport:** `live/shorts.html?talkDev=1` · 390 / 768 / 1280 · console error **0**

### 回帰

| コマンド | 結果 |
|----------|------|
| `npm run verify:live-p3` | **PASS** 36/0/0 |
| `npm run verify:live-p2` | **PASS** 36/0/6 |
| `npm run verify:live-p1` | **PASS** 31/0/3 |
| `npm run verify:live-p0-schema` | **PASS** 68/0/38 |
| `verify-talk-chat-unify-p1` | **PASS** 22/22 |
| `smoke-match-talk-room` | **PASS** 16 |

---

## 6. 手動確認

```text
# 本番 Edge 経由（talkDev なし）
http://127.0.0.1:8788/live/shorts.html

# 開発 stub（Edge スキップ · console 0）
http://127.0.0.1:8788/live/shorts.html?talkDev=1
```

1. 他クリエイターの **published** ショートで video タグに signed URL が入ること
2. Edge 直接 POST で draft ID が 403 になること
3. 自分の動画は Edge 失敗時も direct fallback で再生可能なこと

---

## 7. Phase 5 への引き継ぎ

| 項目 | 内容 |
|------|------|
| `like_count` 自動集計 | trigger / RPC |
| `follower_count` 自動集計 | trigger / RPC |
| フォロー通知 fanout | `TasuLiveNotify` → Edge |
| 日次 10 本制限強制 | Edge |

---

## 8. 総括

Storage RLS によりクライアント direct signed URL では他者動画を再生できなかった問題を、**`live-short-signed-url` Edge（service role · TTL 300）** で解消した。フロントは Edge 優先 + owner fallback。like / follower の DB 自動集計は意図的に見送り、Phase 5 以降で検討する。
