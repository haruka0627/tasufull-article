# TASFUL MATCH — Verification Live Integration Report

**Date:** 2026-06-22  
**Ref:** `ddojquacsyqesrjhcvmn`  
**Verdict:** **PASS** (25/25)

## Design decisions

| Topic | Decision |
|-------|----------|
| eKYC | **未連携**（provider=manual, metadata.mvp=true） |
| 書類画像 | **保存しない**（storage path 未送信） |
| API type `identity` | DB `identity_document` にマップ |
| API type `age` | DB `age` 行（migration 追加） |
| age_verified | **専用カラムなし**。年齢は `match_verifications(type=age)` で管理。承認後に profile 反映は管理 API TODO |
| profile 反映 | identity 申請時のみ `verification_status=pending` |
| 重複申請 | 同一 type の open 行を **update**（冪等） |
| 一覧取得 | 同一 Edge `intent=list`（追加 Function なし） |

## Admin TODO

- `match-admin-review` live 化（verification approve/reject）
- pending 一覧 UI（`match_verifications.status in (pending, under_review)`）
- 承認時 `match_profiles.verification_status = verified`（identity）/ age 承認フラグ
- eKYC ベンダー連携時は `provider=ekyc_vendor` + storage path のみ

## Re-match / safety regression

本スクリプトは verification 専用。コアE2E/safety/unmatch は別 verify スクリプトで維持。

## Commands

```bash
node scripts/verify-match-verification-live.mjs
npx supabase db query --linked --yes -f supabase/migrations/20260625100000_match_verification_age_type.sql
npx supabase db query --linked --yes -f supabase/migrations/20260625110000_match_verification_profile_sync.sql
npx supabase functions deploy match-submit-verification --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

## Summary

Verification MVP live passed on linked ref.

| Section | Step | Result | Detail |
|---------|------|--------|--------|
| Migration | verification migrations | PASS | applied |
| Deploy | match-submit-verification | PASS | deployed |
| Auth | T1/T2 login | PASS | ok |
| Security | anon 401 | PASS | 401 |
| Validation | invalid type | PASS | 422 |
| Submit | T1 identity pending | PASS | fbd02e76 |
| Profile | verification_status pending | PASS | ok |
| Submit | identity duplicate update | PASS | same id |
| Submit | T1 age pending | PASS | 473bae1b |
| DB | verification rows | PASS | age,identity_document |
| Security | no document storage path | PASS | ok |
| List | T1 items | PASS | 2 |
| List | T2 isolated | PASS | 0 items |
| Security | T2 own application | PASS | dc312e71 |
| UI | 390×844 wiring | PASS | loaded |
| UI | 390×844 console | PASS | 0 errors |
| UI | 390×667 wiring | PASS | loaded |
| UI | 390×667 console | PASS | 0 errors |
| UI | 393×852 wiring | PASS | loaded |
| UI | 393×852 console | PASS | 0 errors |
| UI | 768×1024 wiring | PASS | loaded |
| UI | 768×1024 console | PASS | 0 errors |
| UI | 1280×900 wiring | PASS | loaded |
| UI | 1280×900 console | PASS | 0 errors |
| Smoke | client_stub default | PASS | client_stub |
