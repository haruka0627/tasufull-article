# TASFUL MATCH — Edge JWT stub レビュー

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | 2026-06-21 |
| 前提 | `reports/match-edge-jwt-design.md` |
| スコープ | `match-auth.ts` JWT stub 強化のみ。**本番 JWT 検証 / Supabase 接続 / DB / SQL / UI 変更なし** |

---

## 1. 修正ファイル

| ファイル | 変更 |
|----------|------|
| `supabase/functions/_shared/match-auth.ts` | JWT stub helper 追加 · `requireUser` / `requireAdmin` 強化 |
| `supabase/functions/match-record-swipe/index.ts` | 本人判定を `user.matchUserId` に変更 |
| `supabase/functions/match-block-user/index.ts` | 同上 |
| `supabase/functions/match-submit-report/index.ts` | 同上 |
| `scripts/test-match-edge-jwt-stub.mjs` | **新規** — テストランチャ |
| `scripts/test-match-edge-jwt-stub-runner.ts` | **新規** — Deno 単体テスト |
| `reports/match-edge-jwt-stub-review.md` | 本レビュー |

**未変更:** 残り 4 Function（`requireUser` / `requireAdmin` 呼び出しのみ · 互換維持）、client JS、SQL、Supabase 設定

---

## 2. 追加した JWT helper

| 関数 | 役割 |
|------|------|
| `decodeJwtPayloadStub(token)` | 署名検証なしで payload 取得。`stub-match-token` → 固定 payload · JWT 3 分割 → base64url decode |
| `extractTalkUserIdFromClaims(claims)` | MATCH user_id 抽出（§3 優先順） |
| `extractAdminRoleFromClaims(claims)` | `tasu_admin` / `match_admin` / `is_ops` 判定 |
| `authResponseFields(user)` | 将来レスポンス用 `{ auth_mode, match_user_id }`（任意利用） |

**TODO コメント（本番置換）**

- `decodeJwtPayloadStub` → `verifyJwt()`（JWKS / `auth.getUser`）
- `requireUser` → `x-match-user-id` 不一致時 **403**
- `requireAdmin` → `x-match-admin` header fallback **削除**

---

## 3. talk_user_id 抽出優先順位

```text
1. claims.app_metadata.talk_user_id
2. claims.talk_user_id（root）
3. claims.app_metadata.member_id
```

`match-edge-jwt-design.md` · D2 migration `20260621140000` と同一。

---

## 4. user_metadata / sub を使わない理由

| 除外 | 理由 |
|------|------|
| `claims.user_metadata.talk_user_id` | ユーザー編集可能 · RLS bypass リスク |
| `claims.sub` | Supabase UUID · TALK/MATCH text ID と不一致 |
| `auth.uid()::text` | 同上（Edge stub でも未使用） |

`sub` のみの JWT は `requireUser` が **403**（`JWT talk_user_id claim required`）。

---

## 5. requireUser / requireAdmin の仕様

### requireUser(req)

| 項目 | 値 |
|------|-----|
| 入力 | `Authorization: Bearer <token>` 必須 |
| 成功戻り値 | `{ ok, authMode: "jwt_stub", tokenMode, talkUserId, matchUserId, userId, claims, debugOnly? }` |
| `stub-match-token` | `tokenMode: "stub"`, `matchUserId: "stub-user-current"` |
| claim 欠落 | 403 |
| 不正 token | 401 |
| `userId` | **後方互換** — `talkUserId` と同値 |

### requireAdmin(req)

| 項目 | 値 |
|------|-----|
| 前提 | `requireUser` 成功 |
| claims 判定 | `extractAdminRoleFromClaims` |
| dev fallback | `x-match-admin: true`（**本番廃止 TODO**） |
| 戻り値追加 | `adminRole`, `adminMode: "claims" \| "header_fallback"` |

---

## 6. x-match-user-id の扱い

| 項目 | stub 挙動 |
|------|-----------|
| 信頼 | **しない** — `talkUserId` の正は JWT claim のみ |
| header あり | `debugOnly.xMatchUserId` を返却 |
| 不一致 | `debugOnly.warnings` に記録（**403 にはしない** · 本番 TODO） |
| client stub | `match-auth.js` は引き続き送信可 · Edge は無視 |

---

## 7. x-match-admin の本番廃止メモ

- 現 stub: JWT admin claim **または** `x-match-admin: true` で `requireAdmin` 通過
- 本番: JWT `is_ops` / `role=tasu_admin` / `match_admin` のみ（`match-edge-jwt-design.md` §10）
- `requireAdmin` 内に `TODO(production): remove x-match-admin header fallback` を明記

---

## 8. DB 未接続確認

| 検索対象 | 結果 |
|----------|------|
| `supabase/functions/match-*` | `createClient` / `.from(` **なし**（従来どおり） |
| `match-auth.ts` | DB 参照 **なし** |

---

## 9. fetch 未使用確認

| ファイル | `fetch(` |
|----------|----------|
| `match-auth.ts` | **なし**（静的 scan 済み） |
| 7 Function | **なし**（従来どおり） |

---

## 10. テスト結果

```text
node scripts/test-match-edge-jwt-stub.mjs
→ 19 passed, 0 failed
```

| カテゴリ | 内容 |
|----------|------|
| JWT stub token | `stub-match-token` → `stub-user-current` |
| claim 抽出 | app_metadata / root / member_id |
| 拒否 | sub のみ · user_metadata |
| admin | tasu_admin / match_admin / is_ops · x-match-admin fallback |
| debug | x-match-user-id 不一致 warning |
| deno check | 8 files PASS |

**既存 client テスト:** 本変更は Edge のみ · `match-auth.js` の `stub-match-token` と整合（`stub-user-current`）。

---

## 11. 次ステップ

| 順 | 作業 |
|----|------|
| 1 | TASFUL Auth 横断 — JWT `app_metadata.talk_user_id` backfill + Hook |
| 2 | **`match-api.js` edge モード fetch 草案** — Bearer のみ · staging URL |
| 3 | Edge 本実装 — `verifyJwt` + service_role DB |
| 4 | D2 migration 適用 + RLS enable |
| 5 | client `getAuthHeaders()` 本番化（`x-match-user-id` 削除） |

---

## 判定

### **READY_FOR_MATCH_API_FETCH_DRAFT**

**理由**

- Edge `requireUser` / `requireAdmin` が JWT claim 前提の形に寄せられた（stub · 署名検証なし）
- `talk_user_id` 優先順位 · sub / user_metadata 排除 · header 非信頼がコードとテストで固定
- 既存 7 Function · deno check · DB/fetch なしを維持
- client 側 `stub-match-token` と Edge stub payload が一致（`stub-user-current`）

**NEEDS_DECISION 条件（該当なし）:** 本番 403 化のタイミング（x-match-user-id）は設計書どおり実装 PR で決定即可。
