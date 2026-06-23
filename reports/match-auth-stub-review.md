# TASFUL MATCH Auth Stub — Review

**Date:** 2026-06-21  
**Basis:** `reports/match-auth-boundary-design.md`  
**Scope:** Auth stub only — no Supabase Auth connect, no DB, no RLS/SQL, no fetch, no existing Auth changes

---

## 1. 追加ファイル

| Path | Role |
|------|------|
| `match/match-auth.js` | `window.TasfulMatchAuth` 境界スタブ |
| `scripts/test-match-auth-stub.mjs` | Auth スタブ smoke test |

---

## 2. 変更ファイル

| Path | Change |
|------|--------|
| `match/match-api.js` | `configure({ getAuthHeaders })`、`getAuthHeadersProvider`、レスポンスに `auth_mode` / `match_user_id` |
| `match/match-data-stub.js` | `getCurrentUser()` / `getPairs()` / `getCurrentVerification()` が `TasfulMatchAuth` を優先（fallback 維持） |
| `match/match-review.html` | Auth 境界表示、script 順序 |
| 接続 6 ページ HTML | `match-auth.js` を先頭に追加 |
| `deploy/cloudflare/dist/match/*` | 上記同期 |

**未変更:** `auth-current-user.js`、`chat-supabase-config.js`、Edge Functions、RLS migration、UI 挙動本体

---

## 3. TasfulMatchAuth の状態・メソッド

### デフォルト状態

```json
{
  "mode": "auth_stub",
  "isAuthenticated": true,
  "authUserId": "stub-auth-user-id",
  "talkUserId": "stub-user-current",
  "matchUserId": "stub-user-current",
  "displayName": "あなた",
  "profileStatus": "active",
  "verificationStatus": "unverified",
  "sanctionStatus": "none"
}
```

### メソッド

| メソッド | 役割 |
|----------|------|
| `getState()` | 上記状態のコピー |
| `getMatchUserId()` / `getTalkUserId()` | MATCH / TALK 共通 text ID |
| `isLoggedIn()` | 認証済み判定 |
| `hasProfile()` | `profileStatus` が `active` または `draft` |
| `isBanned()` | `sanctionStatus` が `banned` / `restricted` |
| `isVerified()` | `verificationStatus === "verified"` |
| `canUseSwipe()` | ログイン + プロフィール + 非 BAN |
| `canUseTalk()` | Phase1: 同上（本人確認不要） |
| `canSubmitVerification()` | ログイン + プロフィール + 非 BAN |
| `getAuthHeaders()` | stub Bearer + `x-match-user-id` |
| `requireLogin()` / `requireProfile()` / `requireNotBanned()` / `requireVerifiedFor()` | `{ ok, code?, message? }` |
| `configure(nextState)` | 状態上書き（テスト・開発用） |

---

## 4. talkUserId / matchUserId 方針

| 項目 | 方針 |
|------|------|
| 正（将来） | `TasuAuthCurrentUser.getCurrentUser().talkUserId` |
| 現スタブ | `stub-user-current`（両 ID 同一） |
| 読み取り | `TasuAuthCurrentUser` が存在すれば **読み取りのみ**（既存ロジックは変更しない） |
| `match-data-stub` | `resolveMatchUserId()` で `TasfulMatchAuth.getMatchUserId()` を優先、無ければ `stub-user-current` |
| `auth.uid()::text` | **使用しない**（RLS 適用前に D2 修正が必要） |

---

## 5. match-api.js token provider 方針

```javascript
TasfulMatchAPI.configure({
  getAuthHeaders: () => window.TasfulMatchAuth.getAuthHeaders(),
});
```

- `match-api.js` 読み込み時に `TasfulMatchAuth` があれば **自動 configure**
- `getAuthHeadersProvider()` で provider 参照（fetch は未実装）
- 各レスポンスに `auth_mode: "auth_stub"`、`match_user_id: "stub-user-current"` を付与
- `mode: "client_stub"` は維持

---

## 6. RLS 適用前に必要な D2 修正メモ

**今回は SQL 変更なし。** RLS 適用前に以下が必須:

```sql
-- 現状草案（未適用）:
-- match_current_user_id() = auth.uid()::text  -- NG for TALK text IDs

-- 推奨（適用時）:
-- JWT claim talk_user_id を返す関数に差し替え
-- 例: (auth.jwt() ->> 'talk_user_id') または custom access token hook
```

Edge 本実装も `talk_user_id` claim を userId 正とする（`auth.uid()::text` 単独禁止）。

---

## 7. fetch 未使用確認

| ファイル | `fetch(` |
|----------|----------|
| `match/match-auth.js` | なし |
| `match/match-api.js` | なし |
| Playwright 全テスト | 未呼び出し |

---

## 8. Supabase 未接続確認

| 項目 | 結果 |
|------|------|
| `createClient` | なし |
| Supabase session 書き込み | なし |
| 既存 `TasuAuthCurrentUser` 改修 | なし |
| 本番 JWT 検証 | なし（stub Bearer のみ） |

---

## 9. テスト結果

| Script | Result |
|--------|--------|
| `test-match-auth-stub.mjs` | **16 passed**, 0 failed |
| `test-match-data-stub.mjs` | 16 passed, 0 failed |
| `test-match-ui-wiring-stub.mjs` | 54 passed, 0 failed |
| `test-match-mock-ui.mjs` | 99 passed, 0 failed |
| `test-match-api-client-stub.mjs` | 11 passed, 0 failed |

### Script 読み込み順（接続ページ）

```
match-auth.js → match-data-stub.js → match-data-render.js → match-api.js → match-mock.js → match-wiring.js
```

---

## 10. 次ステップ

1. **RLS D2 修正草案** — `match_current_user_id()` を JWT `talk_user_id` 版に更新する migration 草案
2. **Edge `requireUser` 本実装** — JWT 検証 + `talk_user_id` 抽出
3. **`match-api` edge モード** — `fetch` + `getAuthHeaders` 使用（staging のみ）
4. **wiring に UX guard 接続** — `canUseSwipe()` / `requireNotBanned()` をボタン押下前に（任意・段階的）
5. **本番 host** — `auth_stub` 無効化、`TasuAuthCurrentUser` 委譲のみ

---

## 判定

### **READY_FOR_MATCH_RLS_D2_FIX_DRAFT**

Auth 境界スタブ・API token provider・data stub 接続・全回帰テストを満たした。次は RLS 適用前の `match_current_user_id()` D2 修正草案に進める。
