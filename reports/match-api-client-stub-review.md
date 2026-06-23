# TASFUL MATCH API Client Stub — Review

**Date:** 2026-06-21  
**Design basis:** `reports/match-edge-functions-design.md`, `reports/match-edge-function-stubs-review.md`  
**Scope:** Client stub only — no fetch, no Supabase, no auth, no UI wiring beyond `match-review.html` load check

---

## 1. 追加ファイル

| Path | Role |
|------|------|
| `match/match-api.js` | `window.TasfulMatchAPI` クライアントスタブ |
| `scripts/test-match-api-client-stub.mjs` | API スタブ smoke test（開発用） |

**更新（最小限）**

| Path | Change |
|------|--------|
| `match/match-review.html` | `match-api.js` 読み込み + 開発確認表示のみ |

**同期**

| Path |
|------|
| `deploy/cloudflare/dist/match/match-api.js` |
| `deploy/cloudflare/dist/match/match-review.html` |

他の MATCH ページ・`match-mock.js`・Edge Functions・DB は未変更。

---

## 2. 公開グローバル

```js
window.TasfulMatchAPI
```

| Property | Value |
|----------|-------|
| `mode` | `"client_stub"` |
| `recordSwipe` | async function |
| `ensureTalkRoom` | async function |
| `submitReport` | async function |
| `blockUser` | async function |
| `submitVerification` | async function |
| `adminReview` | async function |
| `moderationLog` | async function |

---

## 3. メソッド一覧

### `recordSwipe({ target_user_id, action })`

| action | 結果 |
|--------|------|
| `like` / `skip` | `{ ok: true, mode: "client_stub", swipe_recorded: true, matched: false, pair_id: null }` |
| `super_like` | `{ ok: false, mode: "client_stub", code: "phase_not_enabled", message: "スーパーいいねは現在準備中です。" }` |

### `ensureTalkRoom({ pair_id })`

```json
{
  "ok": true,
  "mode": "client_stub",
  "room_id": "stub-room-id",
  "redirect_url": "../chat-detail.html?room=stub-room-id"
}
```

### `submitReport({ reported_user_id, reason, detail? })`

```json
{
  "ok": true,
  "mode": "client_stub",
  "report_id": "stub-report-id",
  "status": "submitted"
}
```

### `blockUser({ blocked_user_id, reason? })`

```json
{
  "ok": true,
  "mode": "client_stub",
  "blocked": true,
  "pair_status": "blocked",
  "room_status": "cancelled"
}
```

### `submitVerification({ verification_type, metadata? })`

```json
{
  "ok": true,
  "mode": "client_stub",
  "verification_id": "stub-verification-id",
  "status": "pending"
}
```

`metadata` は入力を受け付けるがレスポンスには含めない。

### `adminReview({ target_type, target_id, action, note? })`

```json
{
  "ok": true,
  "mode": "client_stub",
  "reviewed": true
}
```

### `moderationLog({ source, target_user_id, severity, reason })`

```json
{
  "ok": true,
  "mode": "client_stub",
  "log_id": "stub-log-id",
  "queued": true
}
```

失敗時は全メソッド共通:

```json
{ "ok": false, "mode": "client_stub", "code": "validation_error", "message": "..." }
```

（`super_like` のみ `code: "phase_not_enabled"`）

---

## 4. validation 仕様

| チェック | 挙動 |
|----------|------|
| payload が object でない | `validation_error` |
| 必須フィールド欠落 / 空文字 | `validation_error` |
| 文字列以外 | `validation_error` |
| 最大長超過 | `validation_error` |
| enum 不正 | `validation_error` |

### 主な max length（Edge Function スタブと整合）

| Field | Max |
|-------|-----|
| `target_user_id`, `reported_user_id`, `blocked_user_id` | 128 |
| `reason` (moderationLog) | 500 |
| `reason` (blockUser, optional) | 500 |
| `detail` (submitReport, optional) | 2000 |
| `note` (adminReview, optional) | 2000 |
| `pair_id`, `target_id` | uuid-like（`stub-` プレフィックスも許可） |

### enum 一覧

| Field | Allowed |
|-------|---------|
| `recordSwipe.action` | `like`, `skip`, `super_like` |
| `submitReport.reason` | `inappropriate_message`, `impersonation`, `harassment`, `other` |
| `submitVerification.verification_type` | `phone`, `identity_document` |
| `adminReview.target_type` | `verification`, `report`, `sanction` |
| `adminReview.action` | `approve`, `reject`, `ban`, `dismiss` |
| `moderationLog.source` | `profile`, `photo`, `message`, `report`, `system` |
| `moderationLog.severity` | `low`, `medium`, `high`, `critical` |

---

## 5. fetch 未使用確認

`match/match-api.js` を検索:

- `fetch(` 呼び出し — **なし**（コメントのみ）
- `XMLHttpRequest` — **なし**

Playwright テストで `window.fetch` をラップし、API 呼び出し中に fetch が実行されないことを確認済み。

---

## 6. Supabase 未接続確認

`match/match-api.js` を検索:

- `supabase` — **なし**（コメントのみ）
- `createClient` — **なし**
- Authorization header 処理 — **なし**

---

## 7. match-review.html 読み込み確認

`match-review.html` のみ `match-api.js` を読み込み。ヒーロー直下に開発確認ブロックを表示:

- `Match API client: client_stub`
- `window.TasfulMatchAPI available`

UI 挙動は引き続き `match-mock.js` 主体（他ページは `match-mock.js` のみ、変更なし）。

---

## 8. テスト結果

### API client stub (`scripts/test-match-api-client-stub.mjs`)

```text
Result: 11 passed, 0 failed
```

確認項目:

- `window.TasfulMatchAPI` 存在
- UI 表示テキスト
- 全メソッドが Promise を返す
- `like` 成功 / `super_like` → `phase_not_enabled`
- 必須欠落・enum 不正 → `validation_error`
- fetch 未実行

### 既存 UI mock (`scripts/test-match-mock-ui.mjs`)

```text
Result: 99 passed, 0 failed
```

11 ページ × 3 ビューポート — 回帰なし。

---

## 9. 次ステップ

1. **UI wiring stub** — スワイプ / 通報 / ブロック / 本人確認ページから `TasfulMatchAPI` を段階的に呼ぶ（toast / 画面遷移は mock 維持）
2. **fetch モード追加** — `mode: "edge"` 切替で `supabase/functions/v1/match-*` を呼ぶ（ローカル `functions serve` 連携）
3. **認証レイヤ** — Bearer token 注入（Supabase Auth 接続後）
4. **本実装** — Edge Function 本番化 + migration / RLS 適用後に client を `edge` デフォルトへ

---

## 判定

**READY_FOR_MATCH_UI_WIRING_STUB**

クライアント API スタブ・validation・`match-review.html` 読み込み確認・既存 UI テスト回帰を満たした。次は各 UI 画面を `TasfulMatchAPI` 経由の stub wiring に段階接続できる。
