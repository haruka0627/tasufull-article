# TASFUL MATCH — JWT 本番化 Readiness

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | 2026-06-22 |
| ref | `ddojquacsyqesrjhcvmn` |
| 検証 | `node scripts/verify-match-jwt-production.mjs` |
| 結果 | **15/15 PASS** |
| 判定 | **JWT_PRODUCTION_READY** |

## 実装サマリ

- `match-auth.js`: Supabase session から `access_token` を取得。本番ホストでは JWT なし時は空ヘッダ（`stub-match-token` は localhost/file のみ）。
- `match-bootstrap.js`: 実 JWT 検出時に `TasfulMatchAPI` を `mode: live` + `ensureFreshAccessToken` で自動構成。
- `match-api.js`: `isLiveMode()` · 401 時 `refreshAccessToken` リトライ。
- Edge `_shared/match-auth.ts`: `requireUserAsync` + `MATCH_VERIFY_JWT=1` で Supabase `/auth/v1/user` 検証（オプション）。

## 検証ステップ

| Section | Step | Result | Detail |
|---------|------|--------|--------|
| Deploy | skipped | PASS | --skip-deploy |
| Auth | T1 login | PASS | t1@tasful.invalid |
| Auth | T2 login | PASS | t2@tasful.invalid |
| JWT | T1 real JWT | PASS | talk_user_id=t1 |
| JWT | T2 real JWT | PASS | talk_user_id=t2 |
| Profile | match-search-profiles | PASS | status=200 |
| Match | cleanup t1↔t2 | PASS | swipes/pair cleared |
| Match | T1 like T2 | PASS | matched=false |
| Match | T2 like T1 (mutual) | PASS | pair_id=91ec5abd… |
| Match | duplicate swipe guard | PASS | 409/conflict |
| Match | match-list-pairs | PASS | count=1 |
| TALK | match-ensure-talk-room | PASS | room_id=6ac214b2-7169-4fc2-8298-2e754465b3af |
| Frontend | stub gated to demo | PASS | localhost/file only |
| Frontend | match-bootstrap live mode | PASS | present |
| Frontend | match-swipe.html deps | PASS | auth chain + bootstrap |

## 残課題

- Edge 全 Function を `requireUserAsync` へ移行（現状は decode-only `requireUser` 維持）
- 本番 deploy で `MATCH_VERIFY_JWT=1` を有効化する運用手順
- ログイン未完了ユーザー向け MATCH ゲート（P3 招待フローと連携）
