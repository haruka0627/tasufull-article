# TASFUL MATCH — β0 Allowlist Gate

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | 2026-06-22 |
| ref | `ddojquacsyqesrjhcvmn` |
| migration | `20260627100000_match_beta_allowlist.sql` |
| 検証 | `node scripts/verify-match-beta-allowlist.mjs` |
| 結果 | **12/12 PASS** |
| 判定 | **MATCH_BETA0_GATE_READY** |

## 実装

- テーブル `match_beta_allowlist` + RPC `match_is_beta_allowed()`
- Edge `requireMatchBetaAllowed()` in `_shared/match-beta.ts`
- 403: `{ ok: false, code: "match_beta_not_allowed", error: "match_beta_not_allowed" }`
- フロント `match-beta-gate.js` 専用パネル
- 無効化: Edge env `MATCH_BETA_GATE_DISABLED=1` · stub token スキップ

## ゲート適用 Function

- `match-search-profiles`
- `match-upsert-profile`
- `match-record-swipe`
- `match-list-pairs`
- `match-ensure-talk-room`
- `match-block-user`
- `match-submit-report`
- `match-unmatch-pair`
- `match-submit-verification`
- `match-upload-photo`
- `match-get-profile-completeness`

**対象外:** `match-admin-review`（admin guard のみ）

## 検証ステップ

| Section | Step | Result | Detail |
|---------|------|--------|--------|
| Migration | skipped | PASS | --skip-migration |
| Deploy | skipped | PASS | --skip-deploy |
| Auth | no token → 401 | PASS | 401 |
| Auth | T1 login | PASS | t1@tasful.invalid |
| Auth | T3 login | PASS | t3@tasful.invalid |
| Gate | T3 not on allowlist → 403 | PASS | match_beta_not_allowed |
| Gate | T3 invited → 200 | PASS | status=200 |
| Gate | T3 active → 200 | PASS | status=200 |
| Gate | T3 revoked → 403 | PASS | match_beta_not_allowed |
| Gate | T1 active seed → 200 | PASS | status=200 |
| Admin | admin guard intact | PASS | 403 forbidden (non-admin path ok) |
| Frontend | match-beta-gate.js | PASS | message present |
