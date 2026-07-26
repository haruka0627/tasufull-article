# ANPI Phase 18 — First Staging Notification INSERT Report

**Historical staging verification** — executed in staging only; test row cleaned up; feature flag returned OFF; no production / Push / Realtime enablement.  
**Verdict:** PASS  
**Started:** 2026-07-27T02:32+09:00 (approx)  
**Ended:** 2026-07-27T02:39+09:00 (approx)  
**Environment:** staging `ahlxuyvhzqdqaojiywmu` (`tasful-staging`)  
**Production:** untouched (`ddojquacsyqesrjhcvmn` denied)  
**Commit / push / deploy:** not performed

---

## 1. Conclusion

```text
Phase 18: PASS
Staging DB notification path: VERIFIED
Polling delivery path: VERIFIED
Realtime: KEEP_DISABLED
Push: NO-GO
Production: NO-GO
```

---

## 2. Git snapshot (start / unchanged HEAD)

| Item | Value |
| --- | --- |
| HEAD | `ebf44989c576b69746b12876402be2b731234a70` |
| Branch | `cf-pages-deploy` |
| Staged | 0 |
| Tracked dirty | large pre-existing working tree (unrelated) |
| Untracked | large pre-existing + Phase 17/18 artifacts |
| Phase 17 artifacts | present (`sql/anpi-phase17-*`, verifier, docs, report) |
| This phase touched | `docs/anpi-phase18-*`, `reports/anpi-phase18-*`, `scripts/*anpi-phase18*`, `reports/_anpi-phase18-insert/` |
| Commit / push / deploy | **not performed** |

---

## 3. Staging provenance

| Check | Result |
| --- | --- |
| Linked project ref | `ahlxuyvhzqdqaojiywmu` |
| Project name | `tasful-staging` |
| Database | `postgres` (linked remote) |
| Staging marker | Phase 15 `mapping_status=approved_phase15` rows = 4 |
| Production deny | linked ≠ `ddojquacsyqesrjhcvmn` |
| Target bind | auth sha8 `0411f04d` · talk sha16 `88d3dbfacf62520b` · `approved_phase15` |

---

## 4. Preflight (18-C)

Phase 17 verifier re-run:

```text
PASS: 27
FAIL: 0
BLOCKED: 0
NOT_TESTED: 0
WRITER: READY_WITH_SAFE_WRAPPER
TARGET: BOUND
FINAL: GO_FOR_PHASE18
```

Extra preflight:

| Check | Value |
| --- | --- |
| Mapping rows | 4 |
| Identity mismatches | 0 |
| Target inbox rows | 0 |
| Test marker rows | 0 |
| Feature flag | OFF |
| Realtime publication membership | false (0) |
| Push path | off (no triggers / no push invocation) |
| Auth INSERT | false |
| Anon SELECT | false |

No STOP conditions. Proceeded.

---

## 5. Feature flag ON (18-E)

| Field | Result |
| --- | --- |
| flag | ON |
| target_auth_sha8 | `0411f04d` |
| target_talk_sha16 | `88d3dbfacf62520b` |
| remaining_allowance | 1 |
| Realtime | still 0 |
| inbox after ON | 0 (no auto-INSERT) |

---

## 6. Dry-run (18-F)

| Field | Result |
| --- | --- |
| reason_code | `anpi_phase17_dry_run_would_insert` |
| inserted_count | 0 |
| already_seen | false |
| dry_run | true |
| enabled | true |
| talk_user_id_sha16 | `88d3dbfacf62520b` |
| inbox after | 0 |
| markers after | 0 |

---

## 7. Real INSERT (18-G / 18-H)

| Field | Result |
| --- | --- |
| reason_code | `anpi_phase17_inserted` |
| inserted_count | 1 |
| already_seen | false |
| notification_id prefix | `anpi-p17-afe615d3308` |
| talk_user_id_sha16 | `88d3dbfacf62520b` |
| inbox after | 1 |
| markers after | 1 |
| other user test rows | 0 |
| maps / mismatches | 4 / 0 |
| type | `anpi` |
| source | `anpi_phase17_test` |
| title | `ANPI Phase17 staging test` |
| body_len | 46 (fixed non-sensitive contract) |
| target_url | `#` |
| read_at | null |
| auth UID stored as user_id | false |
| user matches target talk | true |
| external delivery | false (DB only) |
| Realtime | unchanged / not registered |

---

## 8. Polling (18-I)

`anpi_phase17_polling_reader_dry_run()`:

| Field | Result |
| --- | --- |
| target_talk_user_sha16 | `88d3dbfacf62520b` |
| inbox_for_target | 1 |
| inbox_total | 1 |
| writer_reader_parity | true |
| anon_select | false |
| auth_insert | false |
| realtime_registered | false |

Cross-check counts: target=1 · other-user all=0 · other-user test=0 · anon denied.  
Read marking: not performed. Realtime: not used.

---

## 9. Idempotency (18-J)

Second live call:

| Field | Result |
| --- | --- |
| reason_code | `anpi_phase17_already_seen` |
| inserted_count | 0 |
| already_seen | true |
| inbox after | 1 |
| markers after | 1 |
| gate_inserted_count | 1 |

No second row created.

---

## 10. Cleanup (18-K / 18-L)

Dry-run:

| Field | Result |
| --- | --- |
| matched_count | 1 |
| deleted_count | 0 |
| reason_code | `anpi_phase17_cleanup_dry_run` |

Live:

| Field | Result |
| --- | --- |
| matched_count | 1 |
| deleted_count | 1 |
| blocked | false |
| reason_code | `anpi_phase17_cleanup_deleted` |
| inbox after | 0 |
| markers after | 0 |
| maps / mismatches | 4 / 0 |
| other rows affected | 0 |

Cleanup scoped by id + `source=anpi_phase17_test` + `type=anpi`.

---

## 11. Emergency disable (18-M)

| Field | Result |
| --- | --- |
| enabled | false |
| Realtime | 0 |
| Push | off |
| Safe probe reason | `anpi_phase17_flag_off` |
| Safe probe inserted | 0 |
| inbox after probe | 0 |

**Note:** Phase 17 cleanup decrements `inserted_count`, so `remaining_allowance` returns to 1 after cleanup. Writer remains closed via `enabled=false` (verified by dry-run probe). No live INSERT used to prove OFF.

---

## 12. Final database audit (18-N)

| Check | Result |
| --- | --- |
| Mapping rows | 4 |
| Identity mismatches | 0 |
| Target inbox | 0 |
| Test marker rows | 0 |
| Authenticated INSERT | false |
| Anon SELECT | false |
| Realtime publication | false |
| Push | off |
| Feature flag | OFF |
| Writer gate | closed (`flag_off`) |
| RLS talk_notifications | enabled |
| Resolver present | true |
| Retention fn present | true `(integer,boolean,timestamptz,interval)` |
| Phase 17 writer/cleanup/emergency | present |
| Auth privileges | SELECT+UPDATE only (Phase 14 baseline) |
| Production | untouched |

Post-state verifier:

```bash
node scripts/verify-anpi-phase18-first-insert.mjs
```

---

## 13. Failures

None. No recovery SQL required.

---

## 14. Artifacts

- `reports/anpi-phase18-first-staging-notification-insert.md` (this file)
- `docs/anpi-phase18-first-staging-notification-insert-runbook.md`
- `scripts/verify-anpi-phase18-first-insert.mjs`
- `reports/_anpi-phase18-insert/` (step SQL + masked JSON evidence)

No raw UUID / JWT / service-role key / connection string stored in git docs.
