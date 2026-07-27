# ANPI Phase 62 — Claim Allowlist SQL Review Report

**Date:** 2026-07-27  
**SQL applied:** **NO**  
**Production touched:** **NO**

## Summary

Phase 61 stub proposal is **not apply-ready**. A complete staging draft was written for review only.  
**Session stop state:** awaiting human approval to apply staging SQL.

Canonical review: [`docs/anpi-phase62-claim-allowlist-sql-review.md`](../docs/anpi-phase62-claim-allowlist-sql-review.md)

| Artifact | Role |
|----------|------|
| `sql/anpi-phase61-claim-allowlist-proposal.sql` | Incomplete stub · do not apply |
| `sql/anpi-phase62-claim-allowlist-draft.sql` | Complete draft · review OK · not applied |
| `sql/anpi-phase62-claim-allowlist-rollback.sql` | Rollback draft |

## Review OK highlights

- Parallel claim RPC (legacy `anpi_phase6_claim_jobs` untouched)
- Gate default OFF
- service_role + RLS deny for clients
- Stable key without attempt
- No inbox write / no Cron cutover in SQL

## Blockers before Cron soak (post-apply)

1. Human enable gate only under soak plan  
2. Worker/runtime wiring to scoped claim + writer  
3. Keep provider `talk_local*` until explicit soak approval  
