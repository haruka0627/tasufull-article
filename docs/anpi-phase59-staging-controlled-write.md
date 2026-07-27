# ANPI Phase 59 — Staging Controlled Real Inbox Write

**Date:** 2026-07-27  
**Environment:** staging `ahlxuyvhzqdqaojiywmu` only  
**Production:** untouched (`ddojquacsyqesrjhcvmn`)

## Controlled enablement method

Reuse the **existing Phase 17 staging gate + writer** (no new provider / architecture):

| Piece | Role |
|-------|------|
| `anpi_phase17_insert_gate` | Feature flag default OFF · max 1 · bound test identity (`auth sha8=0411f04d`) |
| `anpi_phase17_enable_flag` / `emergency_disable` | Explicit ON / fail-closed OFF |
| `anpi_phase17_insert_first_test_notification` | Dry-run default · live INSERT when enabled |
| `anpi_phase17_cleanup_first_test_notification` | Marker-scoped delete (`id` + `source=anpi_phase17_test` + `type=anpi`) |
| Phase 59 probe | Project-ref allowlist (URL **and** env) · fixed idempotency key · JWT RLS checks |

**Not switched:**

- Phase 10 job writer remains `anpi_talk_real_write_disabled`
- Cloudflare Cron / Phase 48 periodic path remains `talk_local*`

## Fixed contract for this run

```text
idempotency_key: anpi-phase59-controlled-write-v1
type:            anpi
target_url:      #
source:          anpi_phase17_test
target:          talk sha16 88d3dbfacf62520b (auth sha8 0411f04d)
```

## Commands

```bash
npm run test:anpi-controlled-write
npm run verify:anpi-controlled-write
```

## Immediate disable / rollback

```text
select * from public.anpi_phase17_emergency_disable();
select * from public.anpi_phase17_cleanup_first_test_notification(false);
-- probe must return anpi_phase17_flag_off
select * from public.anpi_phase17_insert_first_test_notification(true);
```

Probe auto-disables + cleans on failure.

## Verdict expectation

```text
ANPI_STAGING_CONTROLLED_REAL_INBOX_WRITE: PASS
ANPI_PRODUCTION_REAL_INBOX_SEND: NOT READY
ANPI_PERIODIC_CRON_REAL_WRITE: NOT SWITCHED
```
