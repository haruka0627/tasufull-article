# TASFUL MATCH Edge Function Stubs — Review

**Date:** 2026-06-21  
**Design basis:** `reports/match-edge-functions-design.md`  
**Scope:** Stub only — no DB, no Supabase deploy/apply, no auth wiring, no UI changes

---

## 1. 追加ファイル

| Path | Role |
|------|------|
| `supabase/functions/_shared/match-auth.ts` | 共通 CORS / JSON / validation / mock auth |
| `supabase/functions/match-record-swipe/index.ts` | スワイプ記録スタブ |
| `supabase/functions/match-ensure-talk-room/index.ts` | TALK ルーム確保スタブ |
| `supabase/functions/match-submit-report/index.ts` | 通報送信スタブ |
| `supabase/functions/match-block-user/index.ts` | ブロックスタブ |
| `supabase/functions/match-submit-verification/index.ts` | 本人確認申請スタブ |
| `supabase/functions/match-admin-review/index.ts` | 管理者レビュースタブ |
| `supabase/functions/match-moderation-log/index.ts` | モデレーションログスタブ |

既存の `supabase/functions/_shared/cors.ts` を再利用（`handleOptions` / `corsHeadersFor`）。既存 Function（TALK / Builder / Stripe 等）は未変更。

---

## 2. 共通レスポンス形式

### HTTP ステータス

| 状況 | Status |
|------|--------|
| 成功 | 200 |
| 不正 JSON / 空 body | 400 (`code: invalid_json`) |
| 未認証 | 401 (`code: unauthorized`) |
| 権限不足（admin） | 403 (`code: forbidden`) |
| validation / phase 制限 | 422 |
| POST 以外 | 405 (`code: method_not_allowed`) |
| 想定外エラー | 500 (`code: internal_error`) |

### 成功 body

```json
{ "ok": true, "mode": "stub", ... }
```

### 失敗 body

```json
{ "ok": false, "code": "<string>", "message": "<string>" }
```

### 共通処理

- `OPTIONS` → CORS preflight（`handleOptions`）
- `POST` のみ受付
- `parseJsonBody` で object JSON のみ許可
- 全成功レスポンスに `mode: "stub"` を含む

---

## 3. 各 Function の入力 / 出力

### `match-record-swipe`

**入力**

```json
{
  "target_user_id": "text",
  "action": "like" | "skip" | "super_like"
}
```

**成功 (200)**

```json
{
  "ok": true,
  "mode": "stub",
  "swipe_recorded": true,
  "matched": false,
  "pair_id": null
}
```

**特記**

- `super_like` → 422, `code: phase_not_enabled`
- 自分自身 (`stub-user-id` と mock user) → 422 `validation_error`

---

### `match-ensure-talk-room`

**入力**

```json
{ "pair_id": "uuid-like" }
```

`stub-` プレフィックス付き ID も validation 用に許可。

**成功 (200)**

```json
{
  "ok": true,
  "mode": "stub",
  "room_id": "stub-room-id",
  "redirect_url": "../chat-detail.html?room=stub-room-id"
}
```

---

### `match-submit-report`

**入力**

```json
{
  "reported_user_id": "text",
  "reason": "inappropriate_message" | "impersonation" | "harassment" | "other",
  "detail": "text (optional, max 2000)"
}
```

**成功 (200)**

```json
{
  "ok": true,
  "mode": "stub",
  "report_id": "stub-report-id",
  "status": "submitted"
}
```

---

### `match-block-user`

**入力**

```json
{
  "blocked_user_id": "text",
  "reason": "optional text (max 500)"
}
```

**成功 (200)**

```json
{
  "ok": true,
  "mode": "stub",
  "blocked": true,
  "pair_status": "blocked",
  "room_status": "cancelled"
}
```

---

### `match-submit-verification`

**入力**

```json
{
  "verification_type": "phone" | "identity_document",
  "metadata": {}
}
```

**成功 (200)** — `metadata` はレスポンスに含めない

```json
{
  "ok": true,
  "mode": "stub",
  "verification_id": "stub-verification-id",
  "status": "pending"
}
```

---

### `match-admin-review`

**入力**

```json
{
  "target_type": "verification" | "report" | "sanction",
  "target_id": "uuid-like",
  "action": "approve" | "reject" | "ban" | "dismiss",
  "note": "optional text (max 2000)"
}
```

**成功 (200)**

```json
{
  "ok": true,
  "mode": "stub",
  "reviewed": true,
  "target_type": "...",
  "action": "..."
}
```

---

### `match-moderation-log`

**入力**

```json
{
  "source": "profile" | "photo" | "message" | "report" | "system",
  "target_user_id": "text",
  "severity": "low" | "medium" | "high" | "critical",
  "reason": "text"
}
```

**成功 (200)**

```json
{
  "ok": true,
  "mode": "stub",
  "log_id": "stub-log-id",
  "queued": true
}
```

---

## 4. 認証 mock 方針

| Guard | 条件 | mock 戻り値 |
|-------|------|-------------|
| `requireUser` | `Authorization: Bearer <non-empty>` 必須 | `{ userId: "stub-user-id" }` |
| `requireAdmin` | 上記 + `x-match-admin: true` ヘッダ | 同上 |

- JWT デコード・Supabase Auth 接続なし
- Bearer トークン内容は検証しない（存在のみ）
- `match-admin-review` のみ `requireAdmin` 必須
- その他 6 Function は `requireUser` のみ

### `_shared/match-auth.ts` エクスポート

`corsHeaders`, `jsonResponse`, `errorResponse`, `parseJsonBody`, `requireUser`, `requireAdmin`, `getBearerToken`, `validateString`, `validateEnum`, `validateUuidLike`, `validateTextLength`, `MatchFunctionError`, および handler 用 `handleMatchError`, `requirePost`, `handleOptions`

---

## 5. DB 未接続の確認

`supabase/functions/match-*` および `_shared/match-auth.ts` を検索:

- `createClient` — **なし**
- `.from(` — **なし**
- `rest/v1` fetch — **なし**
- Supabase import — **なし**

スタブは固定 mock レスポンスのみ返却。migration / RLS は未適用のまま。

---

## 6. deno check 結果

```text
npx deno check supabase/functions/_shared/match-auth.ts \
  supabase/functions/match-record-swipe/index.ts \
  supabase/functions/match-ensure-talk-room/index.ts \
  supabase/functions/match-submit-report/index.ts \
  supabase/functions/match-block-user/index.ts \
  supabase/functions/match-submit-verification/index.ts \
  supabase/functions/match-admin-review/index.ts \
  supabase/functions/match-moderation-log/index.ts
```

**Result:** PASS (deno 2.8.3 via `npx deno`)

---

## 7. curl 例（ローカル `supabase functions serve` 想定）

ベース URL 例: `http://127.0.0.1:54321/functions/v1`  
ローカル anon key は `supabase status` で確認。

### スワイプ（成功）

```bash
curl -s -X POST "http://127.0.0.1:54321/functions/v1/match-record-swipe" \
  -H "Authorization: Bearer stub-token" \
  -H "Content-Type: application/json" \
  -d '{"target_user_id":"user-abc","action":"like"}'
```

### super_like（Phase1 拒否）

```bash
curl -s -X POST "http://127.0.0.1:54321/functions/v1/match-record-swipe" \
  -H "Authorization: Bearer stub-token" \
  -H "Content-Type: application/json" \
  -d '{"target_user_id":"user-abc","action":"super_like"}'
```

### 未認証（401）

```bash
curl -s -X POST "http://127.0.0.1:54321/functions/v1/match-record-swipe" \
  -H "Content-Type: application/json" \
  -d '{"target_user_id":"user-abc","action":"like"}'
```

### 管理者レビュー（成功）

```bash
curl -s -X POST "http://127.0.0.1:54321/functions/v1/match-admin-review" \
  -H "Authorization: Bearer stub-token" \
  -H "x-match-admin: true" \
  -H "Content-Type: application/json" \
  -d '{"target_type":"report","target_id":"00000000-0000-4000-8000-000000000001","action":"dismiss"}'
```

### 管理者レビュー（403 — admin ヘッダなし）

```bash
curl -s -X POST "http://127.0.0.1:54321/functions/v1/match-admin-review" \
  -H "Authorization: Bearer stub-token" \
  -H "Content-Type: application/json" \
  -d '{"target_type":"report","target_id":"00000000-0000-4000-8000-000000000001","action":"dismiss"}'
```

### OPTIONS（CORS preflight）

```bash
curl -s -X OPTIONS "http://127.0.0.1:54321/functions/v1/match-record-swipe" \
  -H "Origin: http://127.0.0.1:8788" \
  -H "Access-Control-Request-Method: POST"
```

---

## 8. 次ステップ

1. **`match/match-api.js` クライアントスタブ** — 各 Function を呼ぶ thin wrapper（`mode: "stub"` 検知、エラー正規化）
2. **MATCH UI からの呼び出し接続** — mock ページを API クライアント経由に段階移行（本番 DB 前）
3. **本実装フェーズ** — JWT 検証、`match_current_user_id()` 連携、RLS 適用後の service_role 処理
4. **E2E** — `supabase functions serve` + curl / Playwright で validation / auth guard の回帰

---

## 判定

**READY_FOR_MATCH_API_CLIENT_STUB**

payload validation・mock auth guard・固定レスポンス形状が揃い、DB 非接続・既存 Function 非影響・deno check PASS を確認。次はフロント向け `match-api.js` スタブ作成に進める。
