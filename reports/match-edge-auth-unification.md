# TASFUL MATCH — Edge 認証統一

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-22** |
| 判定 | **EDGE_AUTH_UNIFIED** |

---

## 1. 統一方針

| 関数種別 | 認証 |
|----------|------|
| 一般 MATCH API | `await requireUserAsync(req)` |
| β allowlist 対象 | `requireUserAsync` → `await requireMatchBetaAllowed()` |
| 管理 | `await requireAdminAsync(req)`（beta ゲート **なし**） |

---

## 2. requireUserAsync 適用一覧（23 Function）

| Function | User Async | Beta Gate |
|----------|------------|-----------|
| match-upsert-profile | ✓ | ✓ |
| match-upload-photo | ✓ | ✓ |
| match-get-profile-completeness | ✓ | ✓ |
| match-search-profiles | ✓ | ✓ |
| match-record-swipe | ✓ | ✓ |
| match-list-pairs | ✓ | ✓ |
| match-ensure-talk-room | ✓ | ✓ |
| match-block-user | ✓ | ✓ |
| match-submit-report | ✓ | ✓ |
| match-unmatch-pair | ✓ | ✓ |
| match-submit-verification | ✓ | ✓ |
| match-update-activity | ✓ | — |
| match-get-compatibility | ✓ | — |
| match-favorite / unfavorite / list-favorites | ✓ | — |
| match-record-profile-view / list-profile-views | ✓ | — |
| match-save-search / list / delete-saved-search | ✓ | — |
| match-moderation-log | ✓ | — |
| **match-admin-review** | **requireAdminAsync** | — |

---

## 3. 移行前後

| 項目 | β0 | β0.5 |
|------|-----|------|
| 認証 | sync `requireUser()` decode のみ | **async `requireUserAsync()`** |
| JWT 検証 | オプション・フォールバックあり | **VERIFY=1 で必須・フォールバックなし** |
| admin | sync `requireAdmin()` | **`requireAdminAsync()`** |
| x-match-admin fallback | 常時 | **VERIFY=1 時無効** |

---

## 4. 残存 sync API（意図的）

`_shared/match-auth.ts` 内:

- `requireUser()` — `@deprecated` · requireAdmin 同期 shim 用
- `requireAdmin()` — `@deprecated` · 後方互換

**match-* index.ts に sync requireUser 呼び出し: 0 件**

---

## 5. 検証

```bash
node scripts/verify-match-auth-unification.mjs
```

---

## 6. 判定

**EDGE_AUTH_UNIFIED** — 全 match-* handler が async 認証に統一済み。
