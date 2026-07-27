# ANPI Phase 58 — Production Notification Provider Readiness

**Date:** 2026-07-27  
**Scope:** Audit + lock ANPI Production notification provider design against existing TALK stack  
**Production deploy / DB / Secrets / Cron / real user notify:** **NOT PERFORMED**

---

## Verdict

```text
ANPI_NOTIFICATION_PROVIDER_DESIGN: READY
ANPI_STAGING_REAL_INBOX_SEND: NOT READY (intentionally hard-disabled)
ANPI_PRODUCTION_REAL_INBOX_SEND: NOT READY (NO-GO · human enablement required)
NEW_ARCHITECTURE_OR_PAID_PROVIDER: NOT REQUIRED
```

Interpretation: the **provider path is Production-Ready as a design** (reuse TALK `talk_notifications` + `official_anpi`).  
**Enabling user-facing writes** is intentionally off and remains a separate human gate.

---

## Adopted notification path

```text
Phase 6 claim/process
  → Phase 8/10 contract (anpi.talk.contract.v1)
  → Phase 10 writer → public.talk_notifications
       type=anpi · target_url='#' · official_anpi client card
```

Periodic staging executor (Phase 56/57) continues on **`talk_local*`** stubs until real mode is explicitly enabled.

---

## Audit summary

| Area | Finding |
|------|---------|
| `talk_local*` | Staging/local stub + receipt ledger only · no inbox write |
| Reusable path | Existing `talk_notifications` + Phase 10 SQL writer + TALK UI |
| `official_anpi` | Existing official room / notify card (`talk-official-notify-card.js`) |
| Kinds | `initial` · `reminder` · `contact_unconfirmed` · `late_confirmation` cataloged |
| Idempotency | Idempotency key → stable id + sidecar links + ON CONFLICT |
| Retry / failure | Scheduler job status + adapter receipts / cancel reasons |
| RLS / service_role | Health + writers granted to service_role; anon/auth execute revoked |
| External SMS/phone/email | Not required · forbidden as core path |
| New chat | Not required |

---

## Security boundary (confirmed on staging)

| Check | Result |
|-------|--------|
| Project ref | `ahlxuyvhzqdqaojiywmu` only |
| `anpi_phase10_talk_write_health` | `ok` · `real_mode_enabled=false` · send flags false |
| `p_mode=real` | Blocked (`22023` / `anpi_talk_real_write_disabled`) |
| `target_url_policy` | `fixed_hash_no_url` |
| Probe script Production refuse | Implemented |

Evidence: [`reports/anpi-phase58-staging-probe.json`](./anpi-phase58-staging-probe.json)

---

## Changes in this phase

| Path | Role |
|------|------|
| `scripts/lib/anpi-talk-contract.mjs` | Contract / templates / actions |
| `scripts/lib/anpi-talk-adapter.mjs` | Local stub adapter |
| `scripts/lib/anpi-talk-real-adapter.mjs` | Shadow / dry adapter surface |
| `scripts/lib/anpi-talk-write-path.mjs` | Phase 10 JS write-path (local-only construct) |
| `scripts/lib/anpi-phase58-talk-provider-readiness.mjs` | Readiness evaluate + staging probe |
| `scripts/test-anpi-phase58-talk-provider-readiness.mjs` | Unit tests |
| `scripts/verify-anpi-phase58-talk-provider-staging.mjs` | Staging verify |
| `docs/anpi-talk-notification-provider.md` | Design / ops SSOT |
| `package.json` | `test:anpi-talk-provider` · `verify:anpi-talk-provider` |

---

## Test results

```text
npm run test:anpi-talk-provider     → all PASS (A–F)
npm run verify:anpi-talk-provider   → PASS (design foundation · real send flags false)
```

---

## Production operations still required (human)

1. Apply / confirm Production ANPI+TALK migrations & RLS (separate checklist).
2. Explicit real-writer enablement design review (replace hard-disable with staged flag).
3. Controlled staging real insert proof (mapped test user) before Production.
4. Production Cloudflare Worker + secrets + cron (Phase 57 NO-GO).
5. Cutover periodic provider from `talk_local*` only after intentional health flags.

---

## ANPI remaining tasks (high level)

1. **Provider enablement gate** — staging controlled real insert → Production flag (this phase designs path only).
2. **Production scheduler** — separate Worker / secrets / cron (Phase 57).
3. **Identity coverage** — ensure Production users map via `anpi_resolve_talk_user_id`.
4. **Periodic cutover** — allow `talk_write` in runtime validation only after enablement.
5. **Product QA** — inbox / `official_anpi` card UX with real `type=anpi` rows (post-enable).
6. Keep Push/Realtime off core path unless separately approved (polling-first).

---

## Stop condition check

New architecture or paid provider: **not required**. Work completed to design + staging foundation verification without Production mutation.
