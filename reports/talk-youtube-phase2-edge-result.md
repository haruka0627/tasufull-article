# TASFUL LIVE → YouTube型 P1 — Phase 2 Edge 実装結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日 | 2026-06-23 |
| 環境 | staging `ddojquacsyqesrjhcvmn` |
| 前提 | Phase 1 migration GO — [`talk-youtube-phase1-migration-result.md`](talk-youtube-phase1-migration-result.md) |

---

## 最終判定

| 判定 | **GO** |
|------|--------|
| 意味 | 長尺動画用 Edge 3 本を staging にデプロイ済み。認証（`auth.getUser()` · anon key 拒否）· 署名 URL · view カウント · admin 操作 · 既存ショート/LIVE 回帰がすべて PASS。**Phase 3 投稿 UI/JS に進行可能。** |

---

## 作成した Edge Functions

| Function | パス | デプロイ |
|----------|------|----------|
| `live-video-signed-url` | `supabase/functions/live-video-signed-url/index.ts` | ✅ ACTIVE |
| `live-video-view` | `supabase/functions/live-video-view/index.ts` | ✅ ACTIVE |
| `live-video-admin` | `supabase/functions/live-video-admin/index.ts` | ✅ ACTIVE |

**共有モジュール:** `supabase/functions/_shared/live-video-auth.ts`

**検証スクリプト:** `scripts/verify-live-youtube-p2-edge.mjs` · `npm run verify:live-youtube-p2`

**変更なし（遵守）:** `live-short-signed-url` · `live-notify`

---

## API 仕様

### 共通

| 項目 | 値 |
|------|-----|
| Method | `POST`（admin list 含む） |
| CORS | `_shared/cors.ts`（既存 LIVE Edge と同一） |
| Deploy | `--no-verify-jwt`（関数内で JWT 検証） |
| 必須 env | `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` |

### live-video-signed-url

**Request**

```json
{ "video_id": "uuid" }
```

**Response 200**

```json
{
  "ok": true,
  "video_id": "uuid",
  "video_signed_url": "https://...",
  "thumbnail_signed_url": "https://...|null",
  "expires_in": 300,
  "expires_at": "...",
  "video": {
    "id": "uuid",
    "talk_user_id": "u_store",
    "title": "...",
    "description": null,
    "duration_sec": 120,
    "status": "published",
    "visibility": "public",
    "views_count": 0,
    "likes_count": 0,
    "published_at": "..."
  }
}
```

**エラー**

| status | 条件 |
|--------|------|
| 401 | Authorization なし / anon key / 無効 JWT |
| 403 | 権限なし（private 他者・draft 等） |
| 404 | 動画なし / hidden・removed を非オーナーが参照 |
| 400 | `video_id` 不正 |
| 500 | Storage 署名失敗等 |

### live-video-view

**Request**

```json
{ "video_id": "uuid" }
```

**Response 200**

```json
{ "ok": true, "video_id": "uuid", "views_count": 42 }
```

**エラー**

| status | 条件 |
|--------|------|
| 401 | 未ログイン |
| 403 | `status !== published` |
| 404 | 動画なし |

RPC: `live_increment_video_views(p_video_id)`（service_role 経由）

### live-video-admin

**Request（action 別）**

```json
{ "action": "list", "status": "published", "visibility": "public", "q": "keyword", "limit": 50, "offset": 0 }
{ "action": "hide", "video_id": "uuid" }
{ "action": "restore", "video_id": "uuid" }
{ "action": "remove", "video_id": "uuid" }
```

**Response 200（list）**

```json
{ "ok": true, "action": "list", "items": [...], "count": 10, "limit": 50, "offset": 0 }
```

**Response 200（hide/restore/remove）**

```json
{ "ok": true, "action": "hide", "video": { "id": "...", "status": "hidden", ... } }
```

---

## 認証 / 認可設計

### ユーザ JWT（signed-url · view）

| ステップ | 実装 |
|----------|------|
| Bearer 必須 | なし → 401 |
| anon / service_role key 拒否 | `SUPABASE_ANON_KEY` / `SERVICE_ROLE_KEY` と一致 → **401** |
| ユーザー検証 | `createClient(url, anonKey, { global: { Authorization } }).auth.getUser()` |
| talk_user_id | `app_metadata.talk_user_id` 優先（既存 LIVE / TALK 同型） |
| admin 判定 | `app_metadata.role === tasu_admin` 等 |

### 動画アクセス制御（signed-url · view）

| 条件 | 閲覧可 |
|------|--------|
| owner | 全 status |
| admin | 全 status |
| `published` + `public` | ログインユーザー + `live_is_public_creator(talk_user_id)` |
| `published` + `unlisted` | 同上（一覧はアプリ側で除外） |
| `published` + `private` | owner / admin のみ |
| `draft` / `processing` / `hidden` / `removed` | owner / admin のみ |
| `hidden` / `removed` を非オーナー | **404**（存在隠蔽） |

**short との差異:** `live-short-signed-url` は Bearer あれば anon key でも通過していたが、**長尺 Edge は `auth.getUser()` で実ユーザ JWT のみ許可**。

### admin（live-video-admin）

| 条件 | 結果 |
|------|------|
| 非 admin JWT | 403 |
| admin JWT（`u_admin` / `tasu_admin`） | list / hide / restore / remove 可 |
| DB 操作 | service_role（RLS バイパス） |

---

## デプロイ結果

```bash
npx supabase functions deploy live-video-signed-url --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
npx supabase functions deploy live-video-view       --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
npx supabase functions deploy live-video-admin      --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

| Function | 結果 |
|----------|------|
| `live-video-signed-url` | ✅ デプロイ成功 |
| `live-video-view` | ✅ |
| `live-video-admin` | ✅ |

---

## smoke 結果

`npm run verify:live-youtube-p2 -- --skip-deploy` — **PASS 18 / FAIL 0 / SKIP 1**

### live-video-signed-url

| テスト | 結果 |
|--------|------|
| 未ログイン | ✅ 401 |
| anon key のみ | ✅ 401 |
| published public + login | ✅ 200 · `expires_in=300` |
| private + owner | ✅ 200 |
| private + other user | ✅ 403 |
| removed + other user | ✅ 404 |

### live-video-view

| テスト | 結果 |
|--------|------|
| published → views_count +1 | ✅ |
| draft | ✅ 403 |

### live-video-admin

| テスト | 結果 |
|--------|------|
| non-admin list | ✅ 403 |
| admin list | ✅ 200 |
| admin hide / restore / remove | ✅ 200 |

---

## 回帰確認結果

| 対象 | 結果 |
|------|------|
| `npm run verify:live-p0-schema` | ✅ PASS |
| `npm run verify:live-p4 --skip-deploy` | ✅ PASS |
| `live-notify`（follow_created） | ✅ 200 |
| `live-short-signed-url` | ✅（p4 経由） |

**既存 short / LIVE / TALK へのコード変更なし。**

---

## 未解決事項

| # | 項目 | 内容 | Phase 3 影響 |
|---|------|------|-------------|
| 1 | **監査ログ** | `live_moderation_logs.content_type` CHECK が `live_short` 等のみ。**`live_video` は migration 拡張が必要**（admin hide/remove は TODO コメント） | 低（管理 UI 後回し可） |
| 2 | **view 多重カウント** | 同一ユーザ・短時間 dedupe なし（P1 簡易） | 低 |
| 3 | **Storage 実ファイル** | 署名 URL はオブジェクト存在が必要（verify は dummy upload） | Phase 3 upload JS で解決 |
| 4 | **thumbnail bucket** | `live-thumbnails` → `live-videos` の順で署名試行。専用 bucket 未作成 | 低 |
| 5 | **short signed-url anon** | 既存 `live-short-signed-url` の anon key 通過は未変更（回帰回避） | なし |

---

## Phase 3 に進めるか

| 判定 | **GO** |
|------|--------|
| 次ステップ | 1. `live-config.js` 拡張（Edge 名・定数） 2. `live-video-upload.js`（投稿→Storage→`live_videos` INSERT） 3. 骨格 HTML は最小（`video-upload.html` 等） |

**Phase 3 着手時の利用 API:**

- `POST /functions/v1/live-video-signed-url` — 再生 URL
- `POST /functions/v1/live-video-view` — 再生時カウント
- `POST /functions/v1/live-video-admin` — 管理（後回し可）

---

*Phase 2 Edge 完了 — UI 作り込みは Phase 3 以降。*
