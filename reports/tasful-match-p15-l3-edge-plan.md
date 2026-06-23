# TASFUL MATCH — P15-L3 Edge 実装計画

| 項目 | 内容 |
|------|------|
| 版 | v1.0（**計画のみ · Edge/UI 未着手**） |
| 作成日 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`**（linked ref · Hook ON · RLS D2） |
| 前提 | P15-L1 **PASS** · 判定 **`READY_FOR_P15_L3_EDGE`** |
| 検証 | **linked ref smoke** · prod-parity UI は P15-L4/L5 · **`tasful.jp` 8 月まで保留** |

---

## 1. 目的とスコープ

P15-L1 で投入した DB / RLS / SQL 関数 / `match_profiles_public` VIEW を、**11 本の user-facing Edge Functions** から安全に利用する。

| 含む | 含まない |
|------|----------|
| 11 本 Edge（下表） | UI / `match-api.js` 配線（P15-L4/L5） |
| `_shared/match-db.ts` 等共有層 | TASFUL AI Edge / プロンプト / 課金 |
| JWT 必須 · RLS 前提 DB アクセス | 既存 7 本の挙動変更（回帰 smoke のみ） |
| smoke スクリプト定義 | `tasful.jp` 本番 URL 確認 |
| `last_active_at` 非公開 · `activity_label` のみ | service_role の乱用 |

**TASFUL AI:** Edge では提供しない。プロフィール改善・相性詳細等の CTA は **client/UI + `ai-workspace-links.js`** のみ（P15-L4）。

---

## 2. API 一覧

| # | Function | メソッド | 認可 | DB 主体 | service_role |
|---|----------|----------|------|---------|--------------|
| 1 | `match-favorite` | POST | JWT | `match_favorites` INSERT | **不使用** |
| 2 | `match-unfavorite` | POST | JWT | `match_favorites` UPDATE archive | **不使用** |
| 3 | `match-list-favorites` | POST | JWT | `match_favorites` SELECT + public join | **不使用** |
| 4 | `match-record-profile-view` | POST | JWT | `match_profile_views` UPSERT | **限定使用** ※1 |
| 5 | `match-list-profile-views` | POST | JWT | `match_profile_views` SELECT incoming | **不使用** |
| 6 | `match-save-search` | POST | JWT | `match_saved_searches` UPSERT | **不使用** |
| 7 | `match-list-saved-searches` | POST | JWT | `match_saved_searches` SELECT | **不使用** |
| 8 | `match-delete-saved-search` | POST | JWT | `match_saved_searches` UPDATE archive | **不使用** |
| 9 | `match-get-compatibility` | POST | JWT | RPC `match_compatibility_score` | **不使用** ※2 |
| 10 | `match-get-profile-completeness` | POST | JWT | RPC `match_profile_completeness` | **不使用** ※2 |
| 11 | `match-update-activity` | POST | JWT | `match_profiles` UPDATE `last_active_at` | **不使用** |

※1 **唯一の service_role 用途:** `match_profile_views` に authenticated INSERT policy がないため、Edge が JWT で `viewer_user_id` を確定したうえで UPSERT のみ service_role 実行。

※2 SECURITY DEFINER 関数を **authenticated に EXECUTE GRANT**（L3-L0 小 migration または L1 追補）。Edge は user JWT 付き `supabase.rpc()` で呼ぶ。

**既存 7 本（変更しない · 回帰対象）:**

`match-record-swipe` · `match-ensure-talk-room` · `match-submit-report` · `match-block-user` · `match-submit-verification` · `match-admin-review` · `match-moderation-log`

---

## 3. Request / Response schema

共通: `Content-Type: application/json` · **POST only**（既存 MATCH Edge 慣習）· `Authorization: Bearer <JWT>` 必須 · `apikey: <anon>` 必須（Supabase Gateway）

### 3.1 成功レスポンス共通フィールド

```json
{
  "ok": true,
  "mode": "live",
  "auth_mode": "jwt",
  "match_user_id": "t1",
  "...": "function-specific"
}
```

### 3.2 失敗レスポンス共通フィールド

```json
{
  "ok": false,
  "code": "validation_error",
  "message": "human-readable"
}
```

---

### 3.3 `match-favorite`

**Request**

```json
{
  "target_user_id": "t2",
  "source": "profile",
  "note": ""
}
```

|  field | 型 | 必須 | 制約 |
|--------|-----|------|------|
| `target_user_id` | string | ○ | ≠ self · block なし · max 128 |
| `source` | string | △ | `swipe` / `profile` / `search` · default `profile` |
| `note` | string | × | max 200 |

**Response 200**

```json
{
  "ok": true,
  "favorite_id": "uuid",
  "created": true,
  "target_user_id": "t2"
}
```

冪等: 既存 active 行があれば `created: false` · 同一 ID 返却。

---

### 3.4 `match-unfavorite`

**Request**

```json
{
  "target_user_id": "t2"
}
```

または `{ "favorite_id": "uuid" }`（いずれか必須 · owner のみ）

**Response 200**

```json
{
  "ok": true,
  "unfavorited": true,
  "target_user_id": "t2"
}
```

---

### 3.5 `match-list-favorites`

**Request**

```json
{
  "limit": 20,
  "cursor": null
}
```

| field | default | max |
|-------|---------|-----|
| `limit` | 20 | 50 |
| `cursor` | null | ISO8601 `created_at` + id |

**Response 200**

```json
{
  "ok": true,
  "items": [
    {
      "favorite_id": "uuid",
      "target_user_id": "t2",
      "source": "profile",
      "created_at": "2026-06-21T10:00:00Z",
      "profile": {
        "profile_id": "uuid",
        "display_name": "ニックネーム",
        "age": 27,
        "prefecture": "東京都",
        "activity_label": "3日以内に活動",
        "main_photo_url": "path/or/url"
      }
    }
  ],
  "next_cursor": null
}
```

`profile` は `match_profiles_public` 相当列のみ。**`last_active_at` なし** · `activity_label` のみ。

---

### 3.6 `match-record-profile-view`

**Request**

```json
{
  "viewed_user_id": "t2",
  "source": "profile_detail"
}
```

| `source` | 値 |
|----------|-----|
| enum | `swipe_card` / `profile_detail` / `favorites` |

**Response 200**

```json
{
  "ok": true,
  "recorded": true,
  "dedupe_bucket": "2026-06-21"
}
```

| ケース | 挙動 |
|--------|------|
| self view | 422 `validation_error` |
| block 双方向 | 422 `blocked` · 記録しない |
| viewer `show_footprints_to_others=false` | 200 `recorded: false`（黙ってスキップ） |
| 同一日 UPSERT | `viewed_at` 更新 · `recorded: true` |

---

### 3.7 `match-list-profile-views`

**Request**

```json
{
  "limit": 20,
  "cursor": null
}
```

**Response 200**

```json
{
  "ok": true,
  "items": [
    {
      "viewer_user_id": "t3",
      "footprint_label": "昨日",
      "source": "profile_detail",
      "profile": {
        "display_name": "…",
        "age": 28,
        "activity_label": "24時間以内に活動"
      }
    }
  ],
  "next_cursor": null
}
```

**返さない:** raw `viewed_at` · raw `last_active_at` · 「オンライン中」

---

### 3.8 `match-save-search`

**Request**

```json
{
  "id": null,
  "name": "関東・20代後半",
  "filters_json": {
    "age_min": 25,
    "age_max": 35,
    "prefectures": ["東京都", "神奈川県"],
    "purpose": ["love", "marriage"],
    "hobby_tag_ids": [],
    "verified_only": true
  },
  "is_default": false
}
```

| field |  note |
|-------|------|
| `id` | 更新時 UUID · 新規は null |
| `name` | 1–40 字 |
| `filters_json` | object · 未知キーは保存可（前方互換） |
| `is_default` | true 時、他 default を false に（Edge 内トランザクション） |

**Response 200**

```json
{
  "ok": true,
  "search_id": "uuid",
  "updated": false
}
```

---

### 3.9 `match-list-saved-searches`

**Request**

```json
{
  "include_archived": false
}
```

**Response 200**

```json
{
  "ok": true,
  "items": [
    {
      "id": "uuid",
      "name": "前回の条件",
      "filters_json": {},
      "is_default": true,
      "last_used_at": null,
      "updated_at": "2026-06-21T10:00:00Z"
    }
  ]
}
```

---

### 3.10 `match-delete-saved-search`

**Request**

```json
{
  "id": "uuid"
}
```

**Response 200**

```json
{
  "ok": true,
  "deleted": true,
  "id": "uuid"
}
```

論理削除: `archived_at = now()` · `is_default = false`

---

### 3.11 `match-get-compatibility`

**Request**

```json
{
  "target_user_id": "t2"
}
```

**Response 200**

```json
{
  "ok": true,
  "percent": 78,
  "score_raw": 78,
  "common_points": [
    { "key": "purpose", "label": "目的が同じ" }
  ],
  "common_count": 1
}
```

RPC `match_compatibility_score(viewer, target)` の結果を整形。**AI 分析なし** · 詳細は UI → TASFUL AI。

| code in RPC | HTTP |
|-------------|------|
| `self` | 422 |
| `blocked` | 422 |
| `profile_not_found` | 404 |

---

### 3.12 `match-get-profile-completeness`

**Request**

```json
{}
```

（body 空 `{}` 可）

**Response 200**

```json
{
  "ok": true,
  "percent": 80,
  "done_count": 6,
  "total_count": 8,
  "items": [
    { "key": "photo", "label": "写真", "done": true, "weight": 20 }
  ]
}
```

**自分のみ** · `match_user_id` = JWT `talk_user_id` · 他 user 指定不可。

改善提案テキストは **返さない**（TASFUL AI CTA 用）。

---

### 3.13 `match-update-activity`

**Request**

```json
{}
```

**Response 200**

```json
{
  "ok": true,
  "activity_label": "24時間以内に活動",
  "bumped": true
}
```

| 項目 | 方針 |
|------|------|
| DB | `UPDATE match_profiles SET last_active_at = now()` WHERE `user_id = me` |
| 返却 | **`activity_label` のみ**（`match_activity_label(now())`） |
| 非返却 | **`last_active_at` raw** |
| debounce | 15 分以内は UPDATE 省略可 · `bumped: false` · label は現状値 |

---

## 4. Auth / JWT 方針

### 4.1 原則

| 項目 | 方針 |
|------|------|
| Gateway | Supabase Functions · **anon key + Bearer JWT** |
| anon 直叩き REST | **禁止**（footprint 書込等は Edge 経由のみ） |
| Identity | **`talk_user_id` text**（L11 D2 · `match_current_user_id()`） |
| 検証 | `requireUser(req)` → 本番で `supabase.auth.getUser(token)` へ昇格 |
| `x-match-user-id` | **非信頼** · ログ/debug のみ |
| Admin | P15 11 本は **一般ユーザー JWT のみ** · `requireAdmin` 不使用 |
| service_role | **`match-record-profile-view` UPSERT のみ** · 専用 helper 内に封じる |

### 4.2 共有層（新規）

**`supabase/functions/_shared/match-db.ts`（計画）**

```typescript
// createUserSupabase(req): anon + Authorization Bearer（RLS as user）
// createServiceSupabase(): service_role — export せず footprint モジュールのみ
// callRpc(userClient, fn, args)
// assertNotBlocked(viewer, target) — match_users_are_blocked via RPC or pre-check
```

**`supabase/functions/_shared/match-auth.ts` 拡張（計画）**

| 変更 | 内容 |
|------|------|
| `verifyUserJwt` | `auth.getUser` + claims から `talk_user_id` |
| `auth_mode` | stub 段階 `"jwt_stub"` → live `"jwt"` |
| 既存 stub | ローカル smoke 互換維持 |

### 4.3 Hook / allowlist 整合

- T1–T5 `@tasful.invalid` · legacy 7 **metadata 不変**
- Edge は JWT claims のみ信頼 · `auth.users` 直接 UPDATE 禁止

---

## 5. RLS 前提

| 操作 | RLS / 経路 |
|------|------------|
| favorites CRUD | authenticated policy · user JWT client |
| saved searches CRUD | authenticated policy · user JWT client |
| settings read（footprint 判定） | user JWT SELECT own `match_user_settings` |
| profile views SELECT incoming | user JWT · `viewed_user_id = me` |
| profile views UPSERT | **service_role** · Edge が JWT で viewer 検証後 |
| activity UPDATE | user JWT UPDATE own `match_profiles` |
| public profile join | SELECT `match_profiles_public` · user JWT |
| compatibility / completeness | RPC EXECUTE as authenticated |

**GRANT 追補（L3-L0 · 適用前）:**

```sql
grant execute on function public.match_compatibility_score(text, text) to authenticated;
grant execute on function public.match_profile_completeness(text) to authenticated;
grant execute on function public.match_activity_label(timestamptz) to authenticated;
grant execute on function public.match_footprint_label(timestamptz) to authenticated;
```

---

## 6. Error code

| code | HTTP | 用途 |
|------|------|------|
| `unauthorized` | 401 | Bearer 欠落 · token 無効 |
| `forbidden` | 403 | `talk_user_id` 欠落 |
| `method_not_allowed` | 405 | POST 以外 |
| `invalid_json` | 400 | body 不正 |
| `validation_error` | 422 | フィールド検証 · self 操作 |
| `blocked` | 422 | block 双方向 |
| `not_found` | 404 | favorite/search/target 不在 |
| `profile_not_found` | 404 | 相性/一覧 join 先なし |
| `conflict` | 409 | default search 競合（稀） |
| `rate_limited` | 429 | レート制限 |
| `feature_disabled` | 503 | kill switch |
| `internal_error` | 500 | 未捕捉 |

既存 7 本と **同一 shape** `{ ok, code, message }` を維持。

---

## 7. Rate limit 案

初期は **Edge 内インメモリ + DB 補助（軽量）**。本番 scale 前は `match_daily_limits` 拡張または Redis 後回し。

| Function |  limit |  window |
|----------|--------|---------|
| `match-favorite` | 100 件 | /日/user |
| `match-unfavorite` | 200 回 | /日/user |
| `match-record-profile-view` | 300 記録 | /日/user（dedupe 後） |
| `match-save-search` | 20 active | 同時 |
| `match-delete-saved-search` | 50 回 | /日/user |
| `match-update-activity` | 1 effective bump | /15分/user |
| list / get | 600 req | /時間/user |

**429 レスポンス:**

```json
{
  "ok": false,
  "code": "rate_limited",
  "message": "しばらく待ってから再度お試しください",
  "retry_after_sec": 900
}
```

---

## 8. Audit log 案

### 8.1 P15-L3 初期（軽量）

| 層 | 内容 |
|----|------|
| Edge stdout | `{ fn, match_user_id, action, target_id, ok, code }` JSON 1 行 |
| DB | **必須ではない** |

### 8.2 オプション（L3.1）

既存 `match_moderation_logs` へ **非 AI** 監査行:

| 列 | 値例 |
|----|------|
| `content_type` | `p15_favorite` / `p15_footprint` / `p15_search` |
| `engine` | `rules` |
| `source_app` | `match_edge` |
| `metadata_json` | `{ "fn": "match-favorite", "target_user_id": "t2" }` |
| INSERT | **service_role** · ユーザー PII 最小 |

通報・制裁とは別キュー · admin UI 不要（初期）。

---

## 9. Smoke test 案

**ファイル（計画）:** `scripts/verify-match-p15-l3-edge-smoke.mjs` · `sql/match-p15-l3-edge-readonly.sql`

### 9.1 Pre-smoke gate

| # | 条件 |
|---|------|
| 1 | P15-L1 post-gates **PASS** |
| 2 | legacy 7 · allowlist 5 · Hook EXCEPTION |
| 3 | core policies **20** · P15 policies **14** |
| 4 | 11 functions **ACTIVE**（deploy 後） |

### 9.2 Per-function（T1 JWT · linked ref）

| # | Case | 期待 |
|---|------|------|
| S1 | no Authorization | 401 |
| S2 | `match-favorite` t2 | 200 · `created` |
| S3 | `match-list-favorites` | 200 · 1 item · `activity_label` あり · raw ts なし |
| S4 | `match-unfavorite` t2 | 200 |
| S5 | `match-record-profile-view` t2（T1→T2） | 200 · T2 incoming list に label |
| S6 | `match-list-profile-views` as T2 | 200 · `footprint_label` · raw `viewed_at` なし |
| S7 | `match-save-search` | 200 · list に反映 |
| S8 | `match-delete-saved-search` | 200 · archived |
| S9 | `match-get-profile-completeness` | 200 · `percent` 0–100 |
| S10 | `match-get-compatibility` t1→t2 | 200 or 404（profile 未作成） |
| S11 | `match-update-activity` | 200 · `activity_label` のみ · **`last_active_at` キーなし** |
| S12 | T1 → T2 footprint direct REST INSERT | **拒否**（RLS） |
| S13 | `match-admin-review` as T1 | **403**（回帰） |
| S14 | 既存 `match-record-swipe` | **200**（回帰） |
| S15 | 既存 report/block/verification | **200**（回帰） |

### 9.3 Post-smoke SQL

- `p15_function_deploy_count = 11`
- response JSON schema spot-check（script）
- `legacy_user_count=7` · `allowlist_backfill_count=5`

---

## 10. 実装順序

| Phase | 内容 | 依存 |
|-------|------|------|
| **L3-L0** | GRANT EXECUTE migration · `_shared/match-db.ts` · JWT live verify 準備 | L1 PASS |
| **L3-1** | Read-only: `match-get-profile-completeness` · `match-get-compatibility` · `match-list-saved-searches` | L3-L0 |
| **L3-2** | Favorites: `match-favorite` · `match-unfavorite` · `match-list-favorites` | L3-L0 |
| **L3-3** | Saved search: `match-save-search` · `match-delete-saved-search` | L3-L0 |
| **L3-4** | Activity: `match-update-activity`（label only） | L3-L0 |
| **L3-5** | Footprints: `_shared/match-footprint.ts` + `match-record-profile-view` + `match-list-profile-views` | L3-L0 · service_role helper |
| **L3-6** | Deploy 11 + `verify-match-p15-l3-edge-smoke.mjs` + 既存 L9 smoke `--skip-db-gates` | L3-1〜5 |
| **L3-7** | レポート `tasful-match-p15-l3-edge-apply-result.md` | smoke PASS |

**並行禁止:** L3-5 完成前に footprint UI 配線しない（Edge のみ先）。

**既存 7 本 DB 化:** P15-L3 とは **別トラック**だが、smoke S14–S15 で **挙動不変**を確認。必要なら L3 完了後に swipe DB 接続を別承認。

---

## 11. Rollback / disable 方針

### 11.1 Edge のみロールバック（DB 触らない）

| 手段 | 操作 |
|------|------|
| Undeploy | `supabase functions delete match-favorite` … 11 本 |
| Kill switch | Edge env `MATCH_P15_EDGE_DISABLED=1` → 503 `feature_disabled` |
| 段階 disable | function 単位 env `MATCH_FOOTPRINT_ENABLED=0` |

**順序:** kill switch → undeploy · **L1 DB/RLS は残す**（UI client_stub 継続可）

### 11.2 部分障害

| 症状 | 対応 |
|------|------|
| footprint のみ不具合 | L3-5 undeploy · 他 10 本は維持可 |
| rate limit 誤設定 | env で上限変更 · redeploy |
| RPC GRANT 漏れ | L3-L0 migration 再適用 |

### 11.3 フル DB ロールバック

P15-L1 rollback（[`tasful-match-p15-l1-migration-draft.md`](tasful-match-p15-l1-migration-draft.md) §11）— **最終手段** · Edge undeploy 後のみ検討。

---

## 12. 既存 API 非破壊

| 項目 | 方針 |
|------|------|
| 7 本の URL / method | 変更なし |
| レスポンス shape | `{ ok, code, message, mode }` 維持 |
| admin 403 | `match-admin-review` 維持 |
| super_like | `phase_not_enabled` 維持 |
| smoke | L9 script + P15-L3 script 両方 PASS |
| `_shared/match-auth.ts` | 後方互換 · stub token 維持 |

---

## 13. 成果物（本フェーズ）

| 文件 | 状態 |
|------|------|
| `reports/tasful-match-p15-l3-edge-plan.md` | **本レポート** |
| `supabase/functions/match-*` ×11 | **未作成** |
| `scripts/verify-match-p15-l3-edge-smoke.mjs` | **未作成**（L3-6） |

**判定（計画承認後）:** **`READY_FOR_P15_L3_EDGE_IMPLEMENT`**

---

## 14. 参照

| 文档 | 路径 |
|------|------|
| P15 機能計画 | `reports/tasful-match-p15-feature-plan.md` |
| L1 適用結果 | `reports/tasful-match-p15-l1-apply-result.md` |
| L1 post-gates | `reports/tasful-match-p15-l1-post-gates-result.md` |
| Edge JWT 設計 | `reports/match-edge-jwt-design.md` |
| 共有 auth | `supabase/functions/_shared/match-auth.ts` |
| L9 smoke | `scripts/verify-auth-hook-l9-remote-edge-smoke.mjs` |
