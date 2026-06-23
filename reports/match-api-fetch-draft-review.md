# TASFUL MATCH — match-api.js edge fetch 草案レビュー

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | 2026-06-21 |
| 前提 | `reports/match-edge-jwt-stub-review.md` |
| スコープ | `match-api.js` edge_stub fetch 草案。**デフォルト client_stub 維持 · Supabase/DB/UI 本接続なし** |

---

## 1. 変更ファイル

| ファイル | 変更 |
|----------|------|
| `match/match-api.js` | `edge_stub` モード · `callEdgeFunction` 等追加 |
| `match/match-review.html` | API mode / Edge fetch / base URL 表示 |
| `scripts/test-match-api-fetch-draft.mjs` | **新規** テスト |
| `deploy/cloudflare/dist/match/match-api.js` | 同期 |
| `deploy/cloudflare/dist/match/match-review.html` | 同期 |
| `reports/match-api-fetch-draft-review.md` | 本レビュー |

**未変更:** `match-auth.js`, `match-mock.js`, Edge Functions, SQL, Supabase 設定

---

## 2. 追加した configure option

```javascript
TasfulMatchAPI.configure({
  mode: "client_stub" | "edge_stub",  // デフォルト client_stub
  functionsBaseUrl: "",                 // edge_stub 時必須
  getAuthHeaders: async () => ({ Authorization: "Bearer ..." }),
  debugHeaders: false,                  // true のときのみ x-match-user-id
  timeoutMs: 10000,
});
```

| 公開 API 追加 | 役割 |
|---------------|------|
| `getConfig()` | 現在設定の読み取り（テスト / match-review 表示） |
| `mode` (getter) | `configure` 後のモード反映 |

---

## 3. edge_stub の fetch 仕様

| 項目 | 挙動 |
|------|------|
| 実行条件 | `mode === "edge_stub"` のみ `fetch` |
| URL | `{functionsBaseUrl}/{functionName}` |
| Method | POST · JSON body · `credentials: "omit"` |
| Headers | `Authorization`, `Content-Type`, `Accept` |
| 成功 | レスポンス JSON を merge · `mode: "edge_stub"` |
| HTTP non-2xx | `normalizeApiError` → `{ ok:false, code, message, status }` |
| timeout | `{ ok:false, code:"timeout" }` |
| network | `{ ok:false, code:"network_error" }` |
| baseUrl 空 | `{ ok:false, code:"config_error" }` |

### エンドポイント対応

| Client メソッド | Path |
|-----------------|------|
| `recordSwipe` | `/match-record-swipe` |
| `ensureTalkRoom` | `/match-ensure-talk-room` |
| `submitReport` | `/match-submit-report` |
| `blockUser` | `/match-block-user` |
| `submitVerification` | `/match-submit-verification` |
| `adminReview` | `/match-admin-review` |
| `moderationLog` | `/match-moderation-log` |

**client 側 validation**（enum / required）は edge_stub でも fetch **前**に実行。`super_like` の `phase_not_enabled` も client 側で返却（fetch なし）。

---

## 4. client_stub 維持確認

| 項目 | 結果 |
|------|------|
| デフォルト `mode` | `client_stub` |
| 既存 stub 戻り値 | 変更なし（validation · success shape 同一） |
| `test-match-api-client-stub.mjs` | **11 passed**（fetch 未呼び出し含む） |
| `match-mock.js` | 未変更 |

---

## 5. Authorization 方針

| 項目 | 方針 |
|------|------|
| 正 | `getAuthHeaders()` の `Authorization: Bearer` のみ |
| 欠落 | `auth_required`（status 401 相当フィールド付き） |
| provider 未設定 | `auth_required` |
| Edge 側 user_id | JWT claim 由来（client payload の本人 ID は送らない / 信用しない） |

payload には `target_user_id` / `reported_user_id` 等の**相手 ID** のみ。`swiper_user_id` 等は含めない。

---

## 6. x-match-user-id の扱い

| `debugHeaders` | 挙動 |
|----------------|------|
| `false`（デフォルト） | **送信しない** · provider が返す `x-match-user-id` も **転送しない** |
| `true` | `TasfulMatchAuth.getMatchUserId()` を debug header として付与（`stub-user-current`） |

本番方針（`match-edge-jwt-design.md`）: Bearer のみ信頼 · header は debug 限定。

---

## 7. Supabase 未接続確認

| 検索 | 結果 |
|------|------|
| `createClient` in `match-api.js` | **なし** |
| Supabase session 書き込み | **なし** |
| Auth 本番接続 | **なし**（stub token / configure provider のみ） |

---

## 8. fetch がデフォルト無効である確認

| 確認 | 結果 |
|------|------|
| 初期 `mode` | `client_stub` |
| client_stub で API 呼び出し | fetch **0 回**（既存テスト） |
| match-review UI | Edge fetch mode: **available but disabled** |
| UI から edge_stub 切替 | **なし**（表示のみ） |

`edge_stub` は `configure({ mode: "edge_stub", ... })` **明示時のみ** fetch。

---

## 9. テスト結果

```text
node scripts/test-match-api-fetch-draft.mjs
→ 14 passed, 0 failed
```

内訳:

| スイート | 内容 |
|----------|------|
| `test-match-api-client-stub.mjs` | 11 passed（回帰） |
| edge_stub | config_error · auth_required · fetch path · 500 · timeout · debugHeaders |
| static | no createClient · default client_stub |

---

## 10. 次ステップ

| 順 | 作業 |
|----|------|
| 1 | **staging Edge smoke 計画** — functionsBaseUrl · 実 Supabase JWT · CORS |
| 2 | TASFUL Auth 横断 — JWT `app_metadata.talk_user_id` backfill + Hook |
| 3 | staging で `configure({ mode: "edge_stub", functionsBaseUrl })` 手動 smoke |
| 4 | D2 migration + RLS enable |
| 5 | 本番 host — `edge_stub` + 実 Bearer · `debugHeaders: false` |

---

## 判定

### **READY_FOR_MATCH_STAGING_EDGE_SMOKE_PLAN**

**理由**

- `edge_stub` fetch 草案が要件どおり実装済み
- デフォルト `client_stub` · 既存 11 テスト PASS · fetch デフォルト無効
- Authorization / debugHeaders / payload 方針が設計書と一致
- Supabase client なし · UI 本接続なし

**NEEDS_DECISION 条件（該当なし）:** staging `functionsBaseUrl` のホスト名は smoke 計画段階で infra と合意即可。
