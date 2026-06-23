# TASFUL MATCH — Unmatch Live Integration Report

**Date:** 2026-06-22  
**Ref:** `ddojquacsyqesrjhcvmn`  
**Verdict:** **PASS** (16/16)

## Schema note

`unmatched_by` / `unmatched_at` カラムは未追加。MVP では `match_pairs.status = unmatched` と `updated_at` で十分と判断（migration なし）。

## Re-match policy

- 解除後の同一ペア再マッチは **不可**（安全側）
- 既存 `match_swipes` 行が残るため swipe は 409、`match_pairs` が `unmatched` のままのため mutual like でも新規 active pair は作られない
- 将来再マッチを許可する場合は swipes アーカイブ + pair 行の扱いを別途設計

## TALK room policy

- `transaction_rooms` 行は **削除しない**
- `status = cancelled` に更新（block 実装と同じ `cancelLinkedTalkRooms` を共有）

## Idempotency

- `status = unmatched` 済み → **200**（`already_unmatched: true`）
- `status = blocked` → **409**（ブロック解除は別フロー）

## Commands

```bash
node scripts/verify-match-unmatch-live.mjs
npx supabase functions deploy match-unmatch-pair --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

## Summary

Unmatch live passed on linked ref test users.

| Section | Step | Result | Detail |
|---------|------|--------|--------|
| Deploy | skipped | PASS | --skip-deploy |
| Auth | T1/T2/T3 login | PASS | ok |
| Prep | mutual pair | PASS | be0e9325 |
| Prep | talk room | PASS | 619bf86c |
| Security | anon 401 | PASS | 401 |
| Security | third-party 403 | PASS | 403 |
| Unmatch | T1 unmatch | PASS | unmatched |
| Unmatch | match_pairs.status | PASS | unmatched |
| Unmatch | T1 list excludes T2 | PASS | ok |
| Unmatch | T2 list excludes T1 | PASS | ok |
| Unmatch | ensure-talk-room 409 | PASS | 409 |
| Unmatch | room not deleted | PASS | status=cancelled |
| Unmatch | duplicate idempotent | PASS | already_unmatched |
| Rematch | swipe after unmatch | PASS | 409 |
| Unmatch | blocked pair 409 | PASS | 409 |
| UI | skipped | PASS | --skip-ui |
