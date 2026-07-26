# ANPI Phase 13 — Staging TALK Schema Manual Apply + Phase 11 Re-Audit

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.


Date: 2026-07-27  
Final verdict: **Manual Apply PASS · Phase 11 Re-Audit PASS · Staging Real INSERT NO-GO**

## Scope

Phase 12 レビュー済みパッケージを staging（`ahlxuyvhzqdqaojiywmu`）へ人手適用し、Phase 11 再監査のみ実施した。

実施:

1. Preflight（linked ref · table missing）
2. `BEGIN` → Phase 12 sync SQL → postcheck → `COMMIT`
3. Phase 11 read-only re-audit
4. Static (Phase 11 / 12)

未実施（禁止）:

- Real INSERT / notification INSERT
- Realtime enable / Push enable
- Production 接続・変更
- Phase 12 SQL 修正
- commit / push / deploy

## Manual Apply

| Step | Result |
| --- | --- |
| Linked ref | `ahlxuyvhzqdqaojiywmu` (`tasful-staging`) |
| Production deny | `ddojquacsyqesrjhcvmn` not contacted |
| Wrapper | `reports/_anpi-phase13-apply/apply-tx.sql` = `BEGIN;` + unchanged Phase 12 sync + `COMMIT;` |
| Phase 12 file | `sql/anpi-phase12-talk-staging-schema-sync.sql` **unchanged** |
| Apply exit | **0** |
| Rollback | **not used** (apply succeeded) |

### Preflight

```text
table_exists=false
column_count=0
policy_count=0
realtime_membership=0
```

### Postcheck (apply footer + detail)

```text
table_exists=true
column_count=11
index_count=2
rls_enabled=true
leftover_dev_policies=0
insert_policies=0
realtime_membership=0
user_triggers=0
helpers: talk_current_user_id=true, talk_is_admin=true
```

## Phase 11 Re-Audit

```text
node scripts/audit-anpi-phase11-talk-staging-parity.mjs
→ P0=0 P1=2 P2=2
→ GATE staging_real_insert=NO-GO
→ AUDIT_EXIT=0
```

Note: first re-audit attempt failed on histogram `GROUP BY 1,2` because the audit runner injects `__audit_ro` as select column 1.  
**Fix (audit runner only, not Phase 12 SQL):** explicit `GROUP BY` expressions in `scripts/audit-anpi-phase11-talk-staging-parity.mjs`.  
Static assertion updated to accept table present/absent while keeping Real INSERT **NO-GO**.

## Gate matrix (Step 3)

| Item | Verdict |
| --- | --- |
| Schema Exists | **PASS** |
| PK | **PASS** (`talk_notifications_pkey` on `id` text) |
| Constraints | **PASS** (PK + NOT NULL checks) |
| Indexes | **PASS** (pkey + `talk_notifications_user_created_idx`) |
| RLS | **PASS** (enabled; select+update phase12; insert/delete policies=0; risky=0) |
| Grants | **PARTIAL** — see Remaining Blockers (default priv residue) |
| Client Compatibility | **PASS** / **PARTIAL** (columns + `read_at` + `target_url='#'`; Realtime client expects publication later) |
| Identity Mapping | **PARTIAL** (`talk_current_user_id` exists; `anpi_user_contexts` absent; 0 rows so format unconfirmed) |
| Realtime Review | **PASS** (not in publication; package did not enable) |
| Push Review | **CLEAR** (user triggers=0) |
| Retention | **PARTIAL** (no purge RPC / cron) |
| Phase11 Audit | **PASS** (P0=0) |
| Staging Real INSERT Readiness | **NO-GO** |
| Production Real INSERT | **NO-GO** |
| Realtime Enablement | **NO-GO** |
| Push Enablement | **NO-GO** |

## Completion checklist

1. **Manual Apply** — PASS (tx commit)
2. **Preflight** — PASS (table missing → apply)
3. **Postcheck** — PASS (11 cols · RLS · 0 insert policies · 0 realtime)
4. **Rollback有無** — **なし**（成功のため未実行）
5. **Table Exists** — true
6. **Columns** — 11 (id, user_id, type, title, body, target_url, created_at, read_at, source, priority, updated_at)
7. **Defaults** — type=`system`, title/body=`''`, target_url=`#`, source=`tasful`, priority=`normal`, created_at/updated_at=`now()`, read_at=null
8. **PK** — `id` text
9. **Constraints** — PK + NOT NULL
10. **Indexes** — pkey + user_created
11. **Grants** — service_role ALL; authenticated has SELECT/UPDATE **and residual INSERT/DELETE/TRUNCATE/…** (see blockers); anon absent in grant list
12. **RLS** — enabled; policies select_phase12 + update_phase12 only
13. **Client Compatibility** — PASS on schema contract (`read_at`, `#`); Realtime path still off
14. **Identity Mapping** — PARTIAL
15. **Realtime Review** — PASS (still not member)
16. **Push Review** — CLEAR
17. **Retention** — PARTIAL
18. **Phase11 Re-Audit** — PASS (P0=0, Real INSERT NO-GO)
19. **Static** — Phase11 9/9 PASS · Phase12 9/9 PASS
20. **Regression** — Phase 2–10 migration hashes unchanged (static); full ANPI SQL suite not re-run (out of this phase scope)
21. **Git Status** — Phase 12/13 artifacts untracked/modified locally; no commit
22. **commit/push/deploy** — **not performed**
23. **Staging Real INSERT Readiness** — **NO-GO**
24. **Production Real INSERT** — **NO-GO**
25. **Realtime Enablement** — **NO-GO**
26. **Push Enablement** — **NO-GO**
27. **Remaining Blockers** — see below
28. **Final Verdict** — Apply + Re-Audit **PASS**; enablement gates remain **NO-GO**

## Remaining Blockers

1. **Identity mapping PARTIAL** — `anpi_user_contexts` absent; empty table ⇒ UUID vs member_id format unconfirmed
2. **Authenticated table privileges broader than Phase 12 intent** — Supabase default privileges left `authenticated` with INSERT/DELETE/TRUNCATE/…; RLS still blocks INSERT/DELETE (no policies), but TRUNCATE is not RLS-gated. Phase 12 SQL was not modified this phase (`SQL修正禁止`). Follow-up: explicit `REVOKE ALL … FROM authenticated` then `GRANT SELECT, UPDATE` only (separate reviewed package)
3. **Realtime publication** — still not joined (intentional)
4. **Retention / purge** — no cleanup RPC / cron
5. **ANPI real mode / Real INSERT** — still forbidden until identity CONFIRMED + enablement checklist

## Artifacts

- `reports/_anpi-phase13-apply/preflight.sql`
- `reports/_anpi-phase13-apply/apply-tx.sql` (wrapper only)
- `reports/_anpi-phase13-apply/apply-output.json.txt`
- `reports/_anpi-phase13-apply/postcheck-detail.sql`
- `reports/_anpi-phase13-apply/phase11-reaudit.txt`
- `reports/_anpi-phase11-audit/staging-parity-summary.json` (post-apply)
- `reports/anpi-phase11-talk-staging-parity-audit.md` (regenerated by audit runner)
- `reports/anpi-phase13-talk-staging-manual-apply.md` (this file)

## Safety

- Production: not contacted
- Real INSERT / notification INSERT: not executed
- Realtime / Push: not enabled
- Phase 12 sync/rollback SQL: not edited
- commit / push / deploy: not performed
