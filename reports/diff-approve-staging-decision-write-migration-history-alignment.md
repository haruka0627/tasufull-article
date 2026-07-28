# Diff & Approve — Staging Decision Write Migration History Alignment

## 1. Verdict

```text
PASS_STAGING_DECISION_WRITE_MIGRATION_HISTORY_ALIGNMENT
```

```text
Migration version: 20260728160000
Repair target: STAGING ONLY
Repair action: HISTORY MARKED APPLIED
Migration SQL re-executed: NO
Schema changed: NO
Application data changed: NO (by repair)
Production: NOT TOUCHED
```

## 2. Scope

History-only alignment for:

```text
supabase/migrations/20260728160000_ai_diff_approve_staging_decision_write.sql
```

No schema change, no SQL re-exec, no Apply/Provider, no Production, no push.

## 3. Starting State

| Field | Value |
| --- | --- |
| Branch | `cf-pages-deploy` |
| Starting HEAD | `735789b3788fb9ae2aaf6596f0649522c0c6c6c8` |
| Staged | 0 |
| Dirty | large unrelated tree (untouched) |
| Prior hardening | `PASS_STAGING_DECISION_WRITE_HARDENING` |

## 4. Target Environment

| Check | Result |
| --- | --- |
| Linked project | `ahlxuyvhzqdqaojiywmu` (`tasful-staging`, ◁E) |
| Staging ref match | YES |
| Production `ddojquacsyqesrjhcvmn` selected | NO |
| CLI target | `--linked` Staging |

Independent evidence: `supabase projects list` LINKED marker + `migration list --linked` + prior foundation reports.

## 5. Migration File

```text
supabase/migrations/20260728160000_ai_diff_approve_staging_decision_write.sql
```

Intent (material):

- Comment on `ai_diff_approve_proposals.status` (cancelled vocab; never applying/applied via this RPC)
- `CREATE OR REPLACE FUNCTION public.ai_diff_approve_record_decision(jsonb)`
- `SECURITY DEFINER` · `SET search_path = public`
- `REVOKE ALL` from `public, anon, authenticated`
- `GRANT EXECUTE` to `service_role` only
- Function comment

Original apply method (prior task): `supabase db query --linked -f …` (SQL applied; history not recorded).

## 6. Pre-repair Migration History

| Version | Local | Remote |
| --- | --- | --- |
| `20260728140000` | present | applied |
| `20260728160000` | present | **missing** |
| later than `160000` remote-applied | — | **none** |

```text
history_alignment: DRIFT
duplicate_version: NO
repair_target_count: 1
```

## 7. Migration SQL Audit

Agent verdict: **`SCHEMA_MATCH`**

- RPC exists with `p_input jsonb`
- Propose / approve / reject / cancel edges present
- `applying` / `applied` not allowed as `to_status`
- `sql_reexec_needed: NO`

## 8. Staging Schema Comparison

Pre-repair catalog fingerprint:

| Field | Value |
| --- | --- |
| `proname` | `ai_diff_approve_record_decision` |
| `prosecdef` | `true` |
| `config` | `search_path=public` |
| `src_md5` | `9232193ef5ce2e05520a6851d610ae8d` |
| `src_len` | `11218` |

Post-repair catalog fingerprint: **identical** (`src_md5` / `src_len` / `prosecdef` / `config` unchanged).

```text
schema_fingerprint_delta: NONE
```

## 9. Grants and RLS Comparison

| Principal | EXECUTE (pre) | EXECUTE (post) |
| --- | --- | --- |
| `anon` | false | false |
| `authenticated` | false | false |
| `service_role` | true | true |

RLS enabled on:

- `ai_diff_approve_proposals`
- `ai_diff_approve_records`
- `ai_diff_approve_events`
- `ai_diff_approve_idempotency`

```text
grants_delta: NONE
rls_delta: NONE
```

## 10. Repair Decision

| Condition | Result |
| --- | --- |
| Target = Staging | YES |
| Production not selected | YES |
| Schema matches migration | YES (`SCHEMA_MATCH`) |
| SQL re-exec needed | NO |
| Remote history missing only `160000` | YES |
| Duplicate version | NO |
| Ordering safe | YES |
| Security / no-mutation auditor | PASS (`SAFE_TO_REPAIR_HISTORY`) |

```text
decision: PROCEED_HISTORY_REPAIR
```

## 11. Repair Command

```bash
npx supabase migration repair --status applied 20260728160000 --linked --yes
```

CLI result:

```text
Repaired migration history: [20260728160000] => applied
Finished supabase migration repair.
```

No migration SQL file executed. No `db push` / `db reset`.

## 12. Post-repair Migration History

| Version | Local | Remote |
| --- | --- | --- |
| `20260728140000` | present | applied |
| `20260728160000` | present | **applied** |

```text
history_alignment: ALIGNED
```

## 13. Schema No-change Verification

| Check | Pre | Post | Delta |
| --- | --- | --- | --- |
| RPC `src_md5` | `9232193ef5ce2e05520a6851d610ae8d` | same | NONE |
| `src_len` | 11218 | 11218 | NONE |
| `prosecdef` | true | true | NONE |
| `search_path` | public | public | NONE |
| EXECUTE grants | anon/auth false · service true | same | NONE |

```text
Schema changed: NO
```

## 14. Data No-change Verification

Repair itself does not mutate application tables (CLI `migration repair` updates migration history only).

Pre-repair counts (read-only):

| Table | Count |
| --- | --- |
| proposals | 36 |
| records | 22 |
| events | 47 |
| idempotency | 47 |

Post-repair immediate fingerprint was taken in parallel with a Decision Write local suite that **creates ephemeral Staging rows** (not invoked by repair). Observed post counts (40 / 25 / 53 / 53) therefore reflect concurrent test writes, not history repair.

```text
application_data_change_by_repair: NONE
decision_record_change_by_repair: NONE
audit_event_change_by_repair: NONE
idempotency_record_change_by_repair: NONE
```

No PII / reason bodies / tokens recorded.

## 15. Regression

| Suite | Result |
| --- | --- |
| `test-diff-approve-staging-decision-write.mjs` | `PASS_STAGING_DECISION_WRITE_LOCAL` |
| `test-diff-approve-staging-readonly-ops.mjs` | PASS |
| `test-diff-approve-staging-persistence.mjs` | PASS |
| Apply isolation (static + `performApply` throw) | PASS |

Read-only page / API (8788):

| Check | Result |
| --- | --- |
| `/admin-diff-approve.html` | HTTP 200 (after redirect) |
| Badge `STAGING` | present |
| Badge `DECISION WRITE` | present |
| Badge `NO APPLY` | present |
| GET `/api/ai-diff-approve/proposals` (anon) | 401 |
| Apply / Provider execute | not connected |

Playwright 24/24 not re-run (per task scope).

## 16. Security Boundary

```text
Repair target: STAGING ONLY (ahlxuyvhzqdqaojiywmu)
Production: NOT TOUCHED
Migration SQL re-executed: NO
Direct schema_migrations INSERT: NOT USED
Apply: NOT EXECUTED
Provider execute: NOT EXECUTED
Secrets in report: NONE
```

## 17. Files Changed

```text
reports/diff-approve-staging-decision-write-migration-history-alignment.md
```

No migration SQL, application, or test code changes.

## 18. Production Status

```text
Production: NOT TOUCHED
Production Supabase: NOT CONNECTED
Push: NOT PERFORMED
```

## 19. Final Conclusion

Staging migration history for `20260728160000` is **ALIGNED**. Schema and grants unchanged. History marked applied via official CLI repair only. Production untouched; no push.
