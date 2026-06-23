# TASFUL MATCH — Safety Live Integration Report

**Date:** 2026-06-22  
**Ref:** `ddojquacsyqesrjhcvmn`  
**Verdict:** **PASS** (24/24)

## Policies

### 通報のみでは自動ブロックしない
Phase 1: `match-submit-report` は `match_reports` へ保存のみ。ブロックは UI の別導線（スワイプモーダル / `match-block.html`）から `match-block-user` を呼ぶ。

### 既存 TALK ルーム（ブロック時）
- `match_pairs.status = blocked` + `blocked_by_user_id` を設定
- 紐づく `transaction_rooms` は `status = cancelled`（ルーム行は削除しない・履歴保持）
- 新規 `match-ensure-talk-room` は 409（blocked）
- 既存ルーム URL 直アクセスの挙動は TALK 側管轄（本フェーズでは変更なし）

### Admin / moderation TODO
- 管理画面での通報キュー審査（`match_reports.status` → reviewing/resolved）
- `match-admin-review` との連携
- ブロック解除 API（`match-unblock-user`）

## Commands

```bash
node scripts/verify-match-safety-live.mjs
npx supabase functions deploy match-block-user match-submit-report match-list-pairs match-record-swipe match-ensure-talk-room match-search-profiles --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

## Summary

Block/report live Edge + exclusion paths passed on linked ref.

| Section | Step | Result | Detail |
|---------|------|--------|--------|
| Deploy | skipped | PASS | --skip-deploy |
| Auth | T1/T2/T3 login | PASS | ok |
| Prep | profiles + cleanup | PASS | ok |
| Security | anon block 401 | PASS | 401 |
| Security | anon report 401 | PASS | 401 |
| Block | self block 422 | PASS | validation_error |
| Report | self report 422 | PASS | validation_error |
| Report | reason validation | PASS | 422 |
| Block | T1 blocks T2 | PASS | block_id=b179a43a |
| Block | match_blocks row | PASS | 1 |
| Block | duplicate idempotent | PASS | 200 |
| Block | T1 feed excludes T2 | PASS | absent |
| Block | T2 feed excludes T1 | PASS | absent |
| Prep | mutual pair | PASS | 48222a3d |
| Block | T1 list excludes T2 | PASS | ok |
| Block | T2 list excludes T1 | PASS | ok |
| Block | ensure-talk-room 409 | PASS | 409 |
| Block | swipe blocked 409 | PASS | 409 |
| Report | T1 reports T2 | PASS | 3e6926bd |
| Report | match_reports row | PASS | open |
| Report | report alone does not block | PASS | T2 still in feed |
| Security | third-party talk 403 | PASS | 403 |
| Security | third-party block pair 403 | PASS | 403 |
| UI | skipped | PASS | --skip-ui |
