# ANPI Phase 66 — Phase 2–10 Production Apply Runbook

**Status:** RUNBOOK ONLY · **NOT EXECUTED**  
**Target ref:** `ddojquacsyqesrjhcvmn`  
**Forbidden always in this document’s agent session:** apply · Worker · Cron · Canary · Phase 65 draft  
**Each apply step requires a fresh explicit human GO** before paste/run.

```text
ANPI_P66_PHASE2_10_RUNBOOK: READY
ANPI_P66_PHASE2_10_APPLY: NOT_EXECUTED
ANPI_PRODUCTION_CHANGE: NONE
```

---

## 結論

Production には button-check 系 Phase **2→3→4→5→6→8→9→10** が欠落している（監査 Section 1/2/9）。  
本 runbook は **1 migration ずつ**人間承認のうえで適用するための手順書である。  
**Phase 65 / Worker / Cron / Canary は対象外。**  
エージェントは本 runbook 作成のみ行い、Production では何も実行していない。

---

## 対象 migration 一覧（依存順）

| Step | Phase | Canonical source | Runbook APPLY package (full SQL) |
|------|-------|------------------|----------------------------------|
| 1 | 2 | `supabase/migrations/20260727020000_anpi_phase2_data_foundation.sql` | `sql/anpi-phase66-prod-apply/01-phase2-APPLY-20260727020000_anpi_phase2_data_foundation.sql` |
| 2 | 3 | `…/20260727030000_anpi_phase3_core_checkin.sql` | `…/02-phase3-APPLY-20260727030000_anpi_phase3_core_checkin.sql` |
| 3 | 4 | `…/20260727040000_anpi_phase4_scheduler.sql` | `…/03-phase4-APPLY-20260727040000_anpi_phase4_scheduler.sql` |
| 4 | 5 | `…/20260727050000_anpi_phase5_emergency_contacts.sql` | `…/04-phase5-APPLY-20260727050000_anpi_phase5_emergency_contacts.sql` |
| 5 | 6 | `…/20260727060000_anpi_phase6_delivery_worker.sql` | `…/05-phase6-APPLY-20260727060000_anpi_phase6_delivery_worker.sql` |
| 6 | 8 | `…/20260727080000_anpi_phase8_talk_adapter.sql` | `…/06-phase8-APPLY-20260727080000_anpi_phase8_talk_adapter.sql` |
| 7 | 9 | `…/20260727090000_anpi_phase9_talk_real_adapter.sql` | `…/07-phase9-APPLY-20260727090000_anpi_phase9_talk_real_adapter.sql` |
| 8 | 10 | `…/20260727100000_anpi_phase10_talk_write_path.sql` | `…/08-phase10-APPLY-20260727100000_anpi_phase10_talk_write_path.sql` |

Phase 7: migration なし（スキップ）。

**Out of scope packages:** Phase 65 draft · Phase 62 · Worker · Cron · Canary.

---

## 依存関係

```text
Phase2 → Phase3 → Phase4 → Phase5 → Phase6 → Phase8 → Phase9 → Phase10
                                              ↑
                                         (no Phase 7 file)
```

| Phase | Depends on | Creates / unlocks (summary) |
|-------|------------|------------------------------|
| 2 | Prod defaults (`auth.users`, UUID) | settings / checks / contacts / deliveries / audit · RLS |
| 3 | 2 | check-in RPCs |
| 4 | 2–3 | **`anpi_scheduler_jobs` / `runs`** |
| 5 | 2–4 | contacts verification/consent · **DROP+recreate** some Phase4 fns |
| 6 | 2–5 | lease · **`anpi_phase6_claim_jobs`** · **`pgcrypto`** |
| 8 | 2–6 | talk local adapter |
| 9 | 2–8 | talk modes / shadow |
| 10 | 2–9 | **`anpi_resolve_talk_user_id`** · write-path links |

---

## 事前監査（全ステップ共通 · apply 前）

1. Dashboard: Reference ID = **`ddojquacsyqesrjhcvmn`**（Staging なら即停止）  
2. Run **one file at a time** (Editor shows last Result only):  
   - `sql/anpi-phase66-prod-apply/preflight/01-ref-confirm-readonly.sql`  
   - `…/preflight/02-phase2-collision-readonly.sql`  
   - `…/preflight/03-gen-random-uuid-readonly.sql`  
   - `…/preflight/04-extensions-readonly.sql`  
   - `…/preflight/05-anpi-inventory-readonly.sql`  
   - `sql/anpi-phase66-prod-apply/00-legacy-guard-readonly.sql`  
3. Index pointer (not a substitute): `00-preflight-readonly.sql`  
4. Confirm collision: Phase 2 names **`already_exists=false`** before Step 1  
5. Confirm `gen_random_uuid_callable=true`  
6. **Backup gate PASS** — see [`anpi-phase66-production-backup-gate.md`](./anpi-phase66-production-backup-gate.md)  
   (daily/physical ≥1 **or** PITR window **or** attested off-site logical dump + restore smoke test).  
   `walg_enabled=true` alone with `backups: []` is **FAIL**. PITR is **optional**.  
7. **Human GO for Step N only** (not blanket approval for all 8)

### Expected preflight (current Prod audit)

| Check | Expected |
|-------|----------|
| Legacy 4 tables | present |
| Phase 2–10 tables | absent |
| `has_scheduler_*` / claim / talk_resolve | false |
| Phase 65 / 62 gates | absent |

---

## Transaction 可否と rollback 方針

| Topic | Policy |
|-------|--------|
| Single-file transaction | Supabase SQL Editor typically **autocommits per statement**. These migrations are **multi-statement** (DDL + many `CREATE OR REPLACE`). **Do not assume one atomic TX** for the whole file. |
| Partial failure | If a mid-file error occurs: **STOP**. Do not continue to next Phase. Capture error. Prefer **PITR / snapshot restore** over hand-rolled DROP. |
| Rollback scripts | **No automated down migrations** for Phase 2–10 in-repo. Recovery = restore to pre-step backup, or controlled DROP of **new** objects only after human review (never DROP legacy v1). |
| Irreversible highlights | Phase 5: `DROP FUNCTION public.anpi_phase4_enqueue_contact_candidates(...)` then recreate. Phase 6: extension create. `CREATE OR REPLACE` functions overwrite bodies. |
| Safe stop | After each Phase verify PASS → may stop indefinitely until next human GO. |

---

## 危険箇所 · 不可逆 · 想定停止条件

| Risk | Where | Action if hit |
|------|-------|---------------|
| Wrong project ref | any | **STOP immediately** |
| Legacy table missing / column regression | any | **STOP** · investigate before next step |
| Name collision (`already_exists=true`) before Step 1 | preflight | **STOP** · do not re-apply blindly |
| Apply error mid-file | any Phase | **STOP** · no next Phase · restore from backup gate artifact (daily/PITR/logical) |
| Unexpected data in new tables | after apply | Investigate · do not enable Cron |
| Desire to “fix forward” by editing live | — | **Forbidden** · fix in repo, new reviewed package |
| Phase 65 / Worker / Cron / Canary creep | — | **Out of scope** · refuse |

---

## migration 別実行手順

共通ループ（**毎回**）:

```text
0. Human GO recorded for THIS Phase only
1. Confirm ref ddojquacsyqesrjhcvmn
2. 00-legacy-guard-readonly.sql
3. Paste/run ONLY the matching *-APPLY-*.sql package (full file)
4. On error → STOP (see rollback)
5. Run verify-after-phaseN.sql (and legacy guard again)
6. Record PASS/FAIL · STOP (do not auto-continue)
7. Next Phase only after new human GO
```

### Step 1 — Phase 2

| Item | Value |
|------|--------|
| **Human GO required** | YES — before paste |
| Pre-checks | preflight PASS · collisions all false · legacy 4 OK |
| Apply SQL (full) | [`01-phase2-APPLY-20260727020000_anpi_phase2_data_foundation.sql`](../sql/anpi-phase66-prod-apply/01-phase2-APPLY-20260727020000_anpi_phase2_data_foundation.sql) |
| Post verify | Split files under [`verify-phase2/`](../sql/anpi-phase66-prod-apply/verify-phase2/) (01–12 · one Result each); index [`verify-after-phase2.sql`](../sql/anpi-phase66-prod-apply/verify-after-phase2.sql) |
| Pass criteria | `anpi_settings` / checks / contacts / invitations / deliveries / audit_logs exist · RLS on · grants match design · legacy intact |
| Danger | Large DDL surface · SECURITY DEFINER RPCs · must not touch legacy tables (by design) |

### Step 2 — Phase 3

| Item | Value |
|------|--------|
| **Human GO required** | YES |
| Pre-checks | Phase 2 verify PASS · legacy OK |
| Apply SQL | [`02-phase3-APPLY-…core_checkin.sql`](../sql/anpi-phase66-prod-apply/02-phase3-APPLY-20260727030000_anpi_phase3_core_checkin.sql) |
| Post verify | [`verify-after-phase3.sql`](../sql/anpi-phase66-prod-apply/verify-after-phase3.sql) |
| Pass criteria | get/upsert/ensure/today/history RPCs present · security_definer + search_path set |
| Danger | Replaces/adds RPCs only; still STOP on error |

### Step 3 — Phase 4

| Item | Value |
|------|--------|
| **Human GO required** | YES |
| Pre-checks | Phase 3 PASS |
| Apply SQL | [`03-phase4-APPLY-…scheduler.sql`](../sql/anpi-phase66-prod-apply/03-phase4-APPLY-20260727040000_anpi_phase4_scheduler.sql) |
| Post verify | [`verify-after-phase4.sql`](../sql/anpi-phase66-prod-apply/verify-after-phase4.sql) |
| Pass criteria | `anpi_scheduler_jobs` + `anpi_scheduler_runs` exist · typically service_role-oriented grants |
| Danger | Alters Phase 2 tables (timezone checks) · **do not register Cron** |

### Step 4 — Phase 5

| Item | Value |
|------|--------|
| **Human GO required** | YES |
| Pre-checks | Phase 4 PASS |
| Apply SQL | [`04-phase5-APPLY-…emergency_contacts.sql`](../sql/anpi-phase66-prod-apply/04-phase5-APPLY-20260727050000_anpi_phase5_emergency_contacts.sql) |
| Post verify | [`verify-after-phase5.sql`](../sql/anpi-phase66-prod-apply/verify-after-phase5.sql) |
| Pass criteria | contacts Phase5 columns · enqueue/tick still resolvable after rewrite |
| Danger | **`DROP FUNCTION` enqueue_contact_candidates** then recreate · **irreversible without restore if mid-fail** |

### Step 5 — Phase 6

| Item | Value |
|------|--------|
| **Human GO required** | YES |
| Pre-checks | Phase 5 PASS · note extension state |
| Apply SQL | [`05-phase6-APPLY-…delivery_worker.sql`](../sql/anpi-phase66-prod-apply/05-phase6-APPLY-20260727060000_anpi_phase6_delivery_worker.sql) |
| Post verify | [`verify-after-phase6.sql`](../sql/anpi-phase66-prod-apply/verify-after-phase6.sql) |
| Pass criteria | `pgcrypto` present · `lease_expires_at` · `anpi_phase6_claim_jobs` · stub receipts |
| Danger | Extension create · lease/claim RPCs · **still no Cron / no real notify** |

### Step 6 — Phase 8

| Item | Value |
|------|--------|
| **Human GO required** | YES |
| Pre-checks | Phase 6 PASS |
| Apply SQL | [`06-phase8-APPLY-…talk_adapter.sql`](../sql/anpi-phase66-prod-apply/06-phase8-APPLY-20260727080000_anpi_phase8_talk_adapter.sql) |
| Post verify | [`verify-after-phase8.sql`](../sql/anpi-phase66-prod-apply/verify-after-phase8.sql) |
| Pass criteria | talk templates/actions/receipts · claim still present |
| Danger | Replaces Phase 6 process path to call adapter |

### Step 7 — Phase 9

| Item | Value |
|------|--------|
| **Human GO required** | YES |
| Pre-checks | Phase 8 PASS |
| Apply SQL | [`07-phase9-APPLY-…talk_real_adapter.sql`](../sql/anpi-phase66-prod-apply/07-phase9-APPLY-20260727090000_anpi_phase9_talk_real_adapter.sql) |
| Post verify | [`verify-after-phase9.sql`](../sql/anpi-phase66-prod-apply/verify-after-phase9.sql) |
| Pass criteria | adapter_config + shadow tables |
| Danger | Mode machinery present but real send remains design-disabled |

### Step 8 — Phase 10

| Item | Value |
|------|--------|
| **Human GO required** | YES |
| Pre-checks | Phase 9 PASS |
| Apply SQL | [`08-phase10-APPLY-…talk_write_path.sql`](../sql/anpi-phase66-prod-apply/08-phase10-APPLY-20260727100000_anpi_phase10_talk_write_path.sql) |
| Post verify | [`verify-after-phase10.sql`](../sql/anpi-phase66-prod-apply/verify-after-phase10.sql) |
| Pass criteria | `anpi_resolve_talk_user_id` · notification links · matrix: scheduler/claim/talk_resolve **true**; p62/prod **false** |
| Danger | Soft-deps `talk_notifications` / `anpi_user_contexts` · do not enable write modes or Cron here |

---

## migration 別検証 SQL（索引）

| After | File |
|-------|------|
| Always | `00-legacy-guard-readonly.sql` · preflight splits under `preflight/` |
| Phase 2 | `verify-phase2/01`…`12` (index: `verify-after-phase2.sql`) |
| Phase 3 | `verify-after-phase3.sql` |
| Phase 4 | `verify-after-phase4.sql` |
| Phase 5 | `verify-after-phase5.sql` |
| Phase 6 | `verify-after-phase6.sql` |
| Phase 8 | `verify-after-phase8.sql` |
| Phase 9 | `verify-after-phase9.sql` |
| Phase 10 | `verify-after-phase10.sql` |

RLS / grants / SECURITY DEFINER / `search_path`（`proconfig`）are included in the per-phase verifies.

---

## Rollback / recovery

1. **Preferred:** Supabase PITR / snapshot to timestamp before the failed step.  
2. **Do not** DROP legacy v1 tables.  
3. **Do not** invent ad-hoc DROP of mixed Phase objects without a reviewed reverse plan.  
4. If only Phase N partially applied: restore, fix package in git, re-approve, re-run from clean state.  
5. Phase 5 mid-DROP failure is especially restore-oriented.

---

## 停止条件（runbook execution）

Stop and escalate if:

- Wrong ref / Staging  
- Legacy guard fails  
- Collision before Step 1  
- Any apply SQL error  
- Verify PASS criteria unmet  
- Human GO missing for the next step  
- Request to proceed into Phase 65 / Worker / Cron / Canary under this runbook  

---

## 最終再監査（Phase 10 完了後のみ）

Run (SELECT only):

1. `sql/anpi-phase66-production-readonly-audit-section1-tables.sql`  
2. `sql/anpi-phase66-production-readonly-audit-section2-matrix.sql`  
3. Full or Section 9 path in `sql/anpi-phase66-production-readonly-audit.sql` (Section 9 dynamic block)

### Expected after successful 2–10

| Check | Expected |
|-------|----------|
| Section 1 | legacy 4 **plus** Phase 2–10 anpi_* tables |
| Section 2 | `has_scheduler_jobs/runs=true`, `has_legacy_claim=true`, `has_talk_resolve=true` |
| Section 2 | `has_p62_*=false`, `has_prod_*=false` |
| Section 9 | `relation_exists=true` |

**Still forbidden after this:** Phase 65 apply · Worker deploy · Cron enable · Canary — require **separate** approvals.

---

## Production 変更が未実施であること

```text
Production migration apply: NOT EXECUTED by this work
Worker / Cron / Canary / Phase 65: NOT EXECUTED
Artifacts created: docs + sql/anpi-phase66-prod-apply/* only
```

Related: [`anpi-phase66-production-missing-migrations.md`](./anpi-phase66-production-missing-migrations.md) · PR #24.
