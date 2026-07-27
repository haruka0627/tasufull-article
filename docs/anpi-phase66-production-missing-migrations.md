# ANPI Phase 66 — Production missing migrations (apply candidates · NOT APPLIED)

**Date:** 2026-07-27  
**Project ref:** `ddojquacsyqesrjhcvmn`  
**Production changes:** **false**  
**Migrations applied this phase:** **false**

## Audit evidence (human · SELECT only)

### Section 1 — present tables (4)

| table_name |
|------------|
| `anpi_check_sessions` |
| `anpi_no_response_audit_log` |
| `anpi_notification_logs` |
| `anpi_user_contexts` |

These are **legacy v1** surfaces. Phase 2+ deliberately does **not** alter them.

### Section 2 — object matrix (all false)

| Flag | Value |
|------|-------|
| `has_scheduler_jobs` | false |
| `has_scheduler_runs` | false |
| `has_p62_gate` | false |
| `has_prod_gate` | false |
| `has_legacy_claim` | false |
| `has_p62_claim` | false |
| `has_prod_claim` | false |
| `has_prod_emergency` | false |
| `has_talk_resolve` | false |

### Section 9 (prior)

`anpi_scheduler_jobs.relation_exists = false`

## Interpretation (locked)

Production has **only** legacy ANPI v1 tables.  
**Entire** button-check scheduler stack (Phase 2–10) is **absent**.  
Phase 62 / Phase 65 Prod allowlist objects are also absent (expected until after 2–10).

---

## Required migrations — dependency order (CANDIDATES ONLY)

Canonical path: `supabase/migrations/`  
**Do not apply** until explicit human approval + controlled Production runbook.

| Step | File | Why required (evidence) | Depends on |
|------|------|-------------------------|------------|
| **1** | `20260727020000_anpi_phase2_data_foundation.sql` | Section 1 lacks `anpi_settings`, `anpi_check_instances`, `anpi_contacts`, `anpi_contact_invitations`, `anpi_notification_deliveries`, `anpi_audit_logs` — Phase 2 creates them. Foundation for all later phases. | Prod has `auth.users` + UUID helpers (Supabase default). Must **not** modify legacy 4 tables. |
| **2** | `20260727030000_anpi_phase3_core_checkin.sql` | Check-in / settings RPCs required by product path; header depends on Phase 2. | Step 1 |
| **3** | `20260727040000_anpi_phase4_scheduler.sql` | Section 2 `has_scheduler_jobs/runs=false` · Section 9 missing jobs table. Creates `anpi_scheduler_jobs` / `anpi_scheduler_runs`. | Steps 1–2 |
| **4** | `20260727050000_anpi_phase5_emergency_contacts.sql` | Contact verification/consent + scheduler eligibility; rewrites Phase 4 contact enqueue / tick. | Steps 1–3 |
| **5** | `20260727060000_anpi_phase6_delivery_worker.sql` | Section 2 `has_legacy_claim=false`. Adds lease cols, `anpi_phase6_claim_jobs`, delivery stub, **pgcrypto**. Required before any claim path / Phase 65 `RETURNS SETOF anpi_scheduler_jobs`. | Steps 1–4 |
| **6** | `20260727080000_anpi_phase8_talk_adapter.sql` | Local TALK adapter tables/RPCs; wires Phase 6 process path. Needed for notification adapter stack used by Cron/canary later. | Steps 1–5 (no Phase 7 migration exists) |
| **7** | `20260727090000_anpi_phase9_talk_real_adapter.sql` | Adapter modes / shadow; depends on Phase 8. | Steps 1–6 |
| **8** | `20260727100000_anpi_phase10_talk_write_path.sql` | Section 2 `has_talk_resolve=false`. Adds `anpi_resolve_talk_user_id` + write-path links. Soft-uses existing `anpi_user_contexts` (present on Prod). | Steps 1–7 |

### After steps 1–8 only (still later · not this list’s execute window)

| Step | File | Why | Depends on |
|------|------|-----|------------|
| **9** | `sql/anpi-phase65-production-claim-allowlist-draft.sql` | Section 2 `has_prod_gate/claim/emergency=false`. Parallel Prod allowlist claim. | Steps 1–8 live + re-audit PASS + **separate** human approval |

---

## Explicitly NOT in Production apply list

| Item | Reason |
|------|--------|
| Phase 62 (`anpi_phase62_*`) | Staging twin; Prod uses `anpi_prod_*` (Phase 65 draft) |
| Phase 7 | No migration file |
| Phase 12–18 staging talk packages | Staging-only; not required to create Phase 2–10 objects |
| Phase 65 draft | Blocked until steps 1–8 + re-audit |
| Legacy v1 rewrite / drop | Forbidden; Phase 2 leaves them untouched |
| Worker / Cron / Canary / Secrets | Out of scope until DB prereqs complete |

---

## Post-apply verification (when humans authorize apply later)

1. Re-run Section 1 → expect Phase 2+ table names present (legacy 4 remain).  
2. Re-run Section 2 → `has_scheduler_jobs/runs`, `has_legacy_claim`, `has_talk_resolve` = true; p62/prod flags still false until Phase 65.  
3. Re-run Section 9 → `relation_exists=true`.  
4. Only then consider Phase 65 draft approval.

---

## Status

```text
ANPI_P66_MISSING_MIGRATIONS: IDENTIFIED
ANPI_P66_APPLY: NOT_EXECUTED
ANPI_PRODUCTION_CANARY: NO-GO
NEXT: human approval of controlled Phase 2→10 Production apply runbook
```
