# ANPI Phase 61 — Staging Scoped Job Writer

**Date:** 2026-07-27  
**Environment:** staging `ahlxuyvhzqdqaojiywmu` only  
**Cron provider:** still `talk_local*` (not cut over)

## Job-writer composition

```text
Manual / probe invocation (NOT Cloudflare Cron)
  → assert staging ref (URL + env)
  → assert ANPI_P61_SCOPED_WRITER_ENABLED=true
  → allowlist subject_user_id (auth sha8 ∈ {0411f04d})
  → build anpi.talk.contract.v1 with STABLE idempotency key
  → resolve talk user (anpi_resolve_talk_user_id)
  → INSERT public.talk_notifications
       type=anpi · target_url='#' · source=anpi_phase61_test
  → optional sidecar anpi_talk_notification_links
```

Module: `scripts/lib/anpi-phase61-scoped-job-writer.mjs`

## Claim allowlist

| Stage | Mechanism |
|-------|-----------|
| Writer直前 (Phase 61) | JS `isAllowlistedAuthUserId` · non-match → `anpi_p61_identity_not_allowlisted` (no INSERT) |
| DB claim (`anpi_phase6_claim_jobs`) | **Not modified** — Cron still stub-only |

## Stable idempotency key

```text
anpi:p61:v1:{kind}:{check_id}:{subject_auth_sha8}:{due_date_utc}
```

- **No** attempt / claim / lease / worker id  
- Same UTC date bucket → same key across retry/reclaim  
- Different `kind` → different key (no false aggregation)

Notification id: `anpi-p61-` + sha256(key)

## Enable / rollback

```bash
# enable (process env only — never commit secrets)
set ANPI_P61_SCOPED_WRITER_ENABLED=true

# disable / rollback
set ANPI_P61_SCOPED_WRITER_ENABLED=false
# or unset — live write throws anpi_p61_flag_off
```

Cron remains `talk_local*` regardless.

## Commands

```bash
npm run test:anpi-scoped-writer
# PowerShell:
$env:ANPI_P61_SCOPED_WRITER_ENABLED='true'; npm run verify:anpi-scoped-writer
```

(Verify script sets the flag in-process for the live path; flag-off is tested separately.)

## Phase 62 gate

Cron soak is **NO-GO** until DB claim allowlist + Cron wiring exist (requires approved staging SQL — see report).
