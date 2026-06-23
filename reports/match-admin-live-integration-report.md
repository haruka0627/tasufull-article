# TASFUL MATCH — Admin Live Integration Report

**Date:** 2026-06-22  
**Ref:** `ddojquacsyqesrjhcvmn`  
**Verdict:** **PASS** (31/31)

## Design decisions

| Topic | Decision |
|-------|----------|
| Admin gate | JWT `match_is_admin()`（`tasu_admin` / `match_admin` / `is_ops`） |
| API shape | `intent=list_*` + `action=REPORT_REVIEW\|VERIFICATION_REVIEW\|PROFILE_ACTION` |
| identity approve | `match_verifications.approved` + `match_profiles.verification_status=verified` |
| identity reject | `rejected` + profile `rejected` |
| age approve | `match_profiles.age_verified=true`（migration 追加） |
| suspend | `match_profiles.profile_status=suspended` → feed/swipe/talk 制限 |
| 監査 | `match_moderation_logs` engine=admin |
| client_stub | 維持（edge のみ live） |

## Commands

```bash
node scripts/verify-match-admin-live.mjs
npx supabase db query --linked --yes -f supabase/migrations/20260626100000_match_admin_mvp.sql
npx supabase functions deploy match-admin-review --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

## Summary

Admin MVP live passed on linked ref.

| Section | Step | Result | Detail |
|---------|------|--------|--------|
| Migration | skipped | PASS | --skip-migration |
| Deploy | skipped | PASS | --skip-deploy |
| Auth | T1–T4 login | PASS | ok |
| Security | anon 401 | PASS | 401 |
| Security | T1 403 | PASS | 403 |
| List | open reports | PASS | 2 |
| Report | resolve | PASS | c177d9a8 |
| Report | dismiss | PASS | 2a6bbc0a |
| Verification | identity approve | PASS | verified |
| Verification | identity reject | PASS | rejected |
| Verification | age approve | PASS | age_verified=true |
| Verification | age reject | PASS | age_verified=false |
| Prep | mutual pair T2-T3 | PASS | e4a0c52c |
| Profile | suspend | PASS | suspended |
| Suspend | feed excludes T2 | PASS | absent |
| Suspend | swipe to T2 blocked | PASS | 404 |
| Suspend | T2 swipe blocked | PASS | 403 |
| Suspend | TALK create blocked | PASS | 403 |
| Profile | unsuspend | PASS | active |
| Unsuspend | T2 discoverable | PASS | public view |
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
