# Business Directory — Dependent Migrations Production Readiness

**Status:** Completed / Historical Archive  
**Archive date of readiness audit:** 2026-07-01  
**Production apply completed:** 2026-07-01  
**Migrations covered (historical):** `20260715110000` (partial) · `20260716100000` (full)  
**Production project ref:** `ddojquacsyqesrjhcvmn` (`tasful-ai`)

> **DO NOT RE-RUN.** This file preserves the **pre-apply readiness audit** that justified the 2026-07-01 Production dependent-migration apply.  
> It is **not** a current Production apply runbook and **not** an executable procedure.  
> Executable CLI / destructive SQL / remote apply steps have been removed from this archive.

**Apply result (authoritative):** [business-directory-production-controlled-apply-result.md](./business-directory-production-controlled-apply-result.md)  
**Current apply runbook (authoritative):** [business-directory-production-controlled-apply-runbook.md](./business-directory-production-controlled-apply-runbook.md)

> **Historical outcome (2026-07-01, fixed):** Production Controlled Apply completed · VERIFY all PASS · S2 **16/0** · S3 **15/0** · **DB Production Ready Go** · Commercial Launch **Conditional** · Rollback **not required**

---

## Why this document is retained

- Records the **pre-apply** analysis for dependent migrations `15110000` and `16100000` on Production after Phase 2a (`17120000`) had already been applied.
- Preserves the Edge / RLS / RPC dependency mapping that explained why those DDL objects were required.
- Documents the **critical view-order drift** finding: a full `15110000` apply would have replaced `business_directory_listings_public` without Phase 2a columns.
- Explains why Production required a **partial** `15110000` path (view block skipped) — still referenced by the tracked partial-apply SQL and controlled-apply runbook.

---

## Current authoritative references

| Role | Path |
| --- | --- |
| Current dependent-migration apply runbook | [business-directory-production-controlled-apply-runbook.md](./business-directory-production-controlled-apply-runbook.md) |
| Current dependent-migration apply result | [business-directory-production-controlled-apply-result.md](./business-directory-production-controlled-apply-result.md) |
| Partial apply SQL (tracked) | [business-directory-15110000-partial-apply.sql](./sql/business-directory-15110000-partial-apply.sql) |
| Environments (human SSOT) | [docs/supabase-environments.md](../docs/supabase-environments.md) |
| Production / Staging refs (machine SSOT) | [reports/tasful-supabase-staging-project-manifest.json](./tasful-supabase-staging-project-manifest.json) |
| Phase 2a apply archive (completed) | [business-directory-phase2a-production-controlled-migration.md](./business-directory-phase2a-production-controlled-migration.md) |
| Future Verification architecture (out of scope here) | [docs/architecture/business-directory-verification-architecture.md](../docs/architecture/business-directory-verification-architecture.md) |

**Project refs (identifiers only — not secrets):**

| Environment | Project ref |
| --- | --- |
| Production | `ddojquacsyqesrjhcvmn` |
| Staging | `ahlxuyvhzqdqaojiywmu` |

Do not confuse Production and Staging. Resolve current refs from the tracked **manifest** and **`docs/supabase-environments.md`** — those two files are the operational SSOT for environment identity.

---

## Historical audit scope (2026-07-01)

**What this audit recorded at the time:**

- Migration file review for `15110000` and `16100000`
- Edge / RLS dependency mapping
- Risk assessment (especially public-view regress)
- Rollback / smoke / Go-No-Go **concepts** (planning only)
- Local static tests (no Production DB connection)

**What this audit did not perform (and this archive must not be used to perform):**

- Production DB changes
- Migration apply
- Remote SQL
- Rollback execution
- Edge deploy

Actual Production apply and verification are recorded in the tracked controlled-apply **runbook** and **result** documents above.

---

## 0. Executive summary (historical)

| Item | Pre-apply audit judgment | Post-apply (2026-07-01, fixed) |
| --- | --- | --- |
| Blocker | Production DB missing `15110000` · `16100000` | Resolved |
| Edge | Phase 2 already deployed | Unchanged |
| Phase 2a | `17120000` already applied | Public view six columns retained |
| Apply posture | Conditional Go (partial `15110000` required) | Completed |
| Production Ready (DB-dependent) | Expected Go after apply | **Go** |
| Commercial Launch | — | **Conditional** (Stripe E2E and related) |

---

## 1. Migrations reviewed (historical analysis)

### 1.1 `20260715110000_business_directory_content_update.sql`

| Object | Operation (as reviewed) | Destructive in file? |
| --- | --- | --- |
| `business_directory_pending_updates` | CREATE TABLE IF NOT EXISTS | No |
| `idx_business_directory_pending_updates_updated` | CREATE INDEX IF NOT EXISTS | No |
| `business_directory_review_requests.published_snapshot_json` | ADD COLUMN IF NOT EXISTS (jsonb default `{}`) | No |
| `business_directory_listings_public` | CREATE OR REPLACE VIEW | **Yes as risk** — would drop Phase 2a columns if applied after `17120000` |
| RLS on `pending_updates` | ENABLE + REVOKE anon/authenticated + GRANT service_role | No |

**Edge dependency (`supabase/functions/_shared/business-directory.ts`) — historical mapping:**

| Function / flow | Dependency |
| --- | --- |
| `loadPendingContent` / `savePendingContent` / `clearPendingContent` | `business_directory_pending_updates` table |
| `updatePublishedPendingListing` | published edit → pending JSON |
| `getOwnerListingDetail` | `loadPendingContent` — missing table caused 500 |
| `submitListingForReview(content_update)` | pending required · `published_snapshot_json` column |
| `approveListing(content_update)` | `applyContentSnapshotToLive` + `clearPendingContent` |
| `rejectListing(content_update)` | `clearPendingContent` · live retained |

**Why it mattered:** `content_update` keeps live rows untouched and stores diffs in pending so the public view continues to show published content during review. Without the table, Owner edit / Ops approve / public consistency could not hold.

### 1.2 `20260716100000_business_directory_ai_draft_usage.sql`

| Object | Operation (as reviewed) | Destructive in file? |
| --- | --- | --- |
| `business_directory_ai_draft_usage_daily` | CREATE TABLE IF NOT EXISTS | No |
| `idx_bd_ai_draft_usage_daily_date` | CREATE INDEX IF NOT EXISTS | No |
| RLS | ENABLE + policy `bd_ai_draft_usage_daily_deny_all` (USING false) | No |
| `consume_business_directory_ai_draft_quota(uuid,text,int)` | CREATE OR REPLACE · SECURITY DEFINER | Function replace only |
| GRANT EXECUTE | service_role only | No |

**Edge dependency (historical flow):**

```text
generate_listing_draft
  → consumeAiDraftQuota()
  → supabase.rpc("consume_business_directory_ai_draft_quota", ...)
  → missing table/RPC: internal_error "Quota check failed" (500)
```

**Quota note (Edge contract at the time):** all plans **10 / day (JST)** via `BD_AI_DRAFT_DAILY_LIMITS`.

**Why it mattered:** AI draft generation increments usage atomically before generation. Without the RPC, Production smoke for `generate_listing_draft` failed consistently before apply.

---

## 2. Historical impact analysis on then-current Production DB

### 2.1 Critical finding — migration order drift (Phase 2a already applied)

**Fact recorded in the audit:** Production already had `20260717120000` (Phase 2a) applied, while `15110000` had **not** been applied.

| View definition source | Phase 2a columns |
| --- | --- |
| `15110000` CREATE OR REPLACE VIEW | Absent (`full_description` only · no seo/faq/uses) |
| `17120000` (then-current Production truth) | Six columns (full + seo + meta + faq + uses + short) |

**Risk recorded:** applying `15110000` **as a full file** would have replaced the public view with a pre–Phase 2a definition and regressed public API / planGate / SEO smoke.

**Historical mitigation that was approved and later executed:** partial apply of `15110000` via the tracked snippet [business-directory-15110000-partial-apply.sql](./sql/business-directory-15110000-partial-apply.sql) — create pending table/index, add `published_snapshot_json`, enable RLS/grants, **skip** the VIEW replace block; then full apply of `16100000`.

```text
Historical partial plan (concept only — DO NOT RUN from this archive):
  ✅ CREATE TABLE pending_updates + index
  ✅ ALTER review_requests ADD published_snapshot_json
  ✅ RLS + GRANT on pending_updates
  ❌ SKIP CREATE OR REPLACE VIEW block
16100000:
  ✅ Full file (no view change)
Post-verify concept:
  ✅ Phase 2a six columns still present on public view
  ✅ pending_updates table present
  ✅ AI quota RPC present after 16100000
```

**Staging note (environment identity only):** On a greenfield Staging DB (`ahlxuyvhzqdqaojiywmu`), timestamp order `15110000 → 16100000 → 17120000` can apply cleanly because the final Phase 2a view definition wins. That does **not** reopen this archive as an apply recipe.

### 2.2 Data impact (as assessed)

| Item | Assessed impact |
| --- | --- |
| Existing listings / profiles | No change (new table · new column defaults only) |
| Existing review_requests rows | `published_snapshot_json = '{}'` would be attached |
| Existing pending data | None (new table) |
| AI quota usage | Starts at zero (new table) |
| Stripe / subscriptions | No impact |

### 2.3 Destructive operations in the migration files (as reviewed)

| Migration | DROP / TRUNCATE / DELETE |
| --- | --- |
| `15110000` | None |
| `16100000` | `DROP POLICY IF EXISTS` only (idempotent policy recreate) |

---

## 3. Historical apply sequence (concept only — DO NOT RUN)

This section records the **planned sequence that was later executed** under the tracked controlled-apply runbook. It is **not** an executable checklist.

| Step | Version | Historical content | DB change |
| --- | --- | --- | --- |
| 0 | — | Confirm Dashboard ref `ddojquacsyqesrjhcvmn` · backup/dump policy | No |
| 1 | `20260715110000` | Partial via tracked snippet (view skipped) | Yes |
| 2 | `20260716100000` | Full file | Yes |
| 3 | — | SELECT verification (runbook / snippet VERIFY) | SELECT only |
| 4 | — | Migration history alignment — **delegated to current runbook**; no repair procedure is retained here | History only |
| 5 | — | Production smoke / Go-No-Go — recorded in apply result | No |

**Edge redeploy (historical conclusion):** not required for these two DB-only migrations (Phase 2 Edge already deployed).

### Repository chronological order (greenfield / Staging MVP reference)

```text
20260711100000 phase1 schema
20260711100001 seed
20260712100000 stripe
20260715100000 storage
20260715110000 content_update      ← this archive #1
20260716100000 ai_draft_usage       ← this archive #2
20260717120000 phase2a              ← already on Production at audit time
```

**History alignment note:** Any migration-history bookkeeping belongs exclusively to the current apply runbook ([business-directory-production-controlled-apply-runbook.md](./business-directory-production-controlled-apply-runbook.md)). This archive does **not** retain history-repair flags, CLI forms, or re-run instructions.

---

## 4. RLS / policies / RPC (historical design notes)

### 4.1 `business_directory_pending_updates`

| Item | Setting (as reviewed) |
| --- | --- |
| RLS | ENABLED |
| anon / authenticated | REVOKE ALL (no direct access) |
| service_role | GRANT ALL |
| Edge | service_role client path only |

**Intent:** pending content only via Owner UI / Ops paths — not public-readable.

### 4.2 `business_directory_ai_draft_usage_daily`

| Item | Setting (as reviewed) |
| --- | --- |
| RLS | ENABLED |
| Policy | `bd_ai_draft_usage_daily_deny_all` — deny all roles |
| Client direct | Not allowed |
| RPC | SECURITY DEFINER · EXECUTE granted to service_role |

**Intent:** prevent quota tampering · Edge-only consume.

### 4.3 RPC `consume_business_directory_ai_draft_quota`

| Item | Content (as reviewed) |
| --- | --- |
| Return shape | `{ ok, used, limit, remaining }` or `{ ok:false, error: quota_exceeded }` |
| Concurrency | atomic update gated by `used_count < p_limit` |
| Edge errors | RPC failure → `internal_error` / quota → `429 quota_exceeded` |

---

## 5. Edge dependency summary (historical)

| Feature | 15110000 | 16100000 | Edge at audit time |
| --- | --- | --- | --- |
| `get_owner_listing_detail` | pending table | — | Deployed |
| `update_draft_listing` (published) | pending | — | Deployed |
| `submit_listing_for_review` content_update | pending + column | — | Deployed |
| `approve_listing` content_update | apply + clear | — | Deployed |
| `generate_listing_draft` | — | RPC + table | Deployed |
| Phase 2 profile upsert | — | — | Deployed (`profileFromDraft` fix already in) |

**Historical conclusion:** Edge was already current on Production; the missing smoke items were expected to pass **after** the two DB applies. Actual post-apply outcomes are in the tracked apply result.

---

## 6. Rollback concept — Historical concept only · DO NOT RUN

> **Historical concept only. DO NOT RUN.** No executable rollback SQL is retained in this archive.  
> Free-plan / no-PITR backup thinking at the time followed the same dump-policy approach described in the Phase 2a archive ([business-directory-phase2a-production-controlled-migration.md](./business-directory-phase2a-production-controlled-migration.md) — see that document’s backup/PITR and dump-policy notes; do not use obsolete numbered section anchors).

### 6.1 `20260716100000` — rollback concept (never executed)

| Item | Historical concept |
| --- | --- |
| Purpose considered | Remove AI draft quota RPC + daily usage table if post-apply smoke forced abort |
| Objects named in planning | RPC `consume_business_directory_ai_draft_quota` · table `business_directory_ai_draft_usage_daily` |
| Data loss if it had been used | Same-day quota counters only |
| Execution | **Forbidden from this archive** · was never required |
| History bookkeeping | Not documented here — see current apply runbook if ever relevant |

### 6.2 `20260715110000` — rollback concept (never executed)

| Item | Historical concept |
| --- | --- |
| Purpose considered | Remove pending-updates storage and the published-snapshot column if content_update path had to be abandoned |
| Objects named in planning | table `business_directory_pending_updates` · column `business_directory_review_requests.published_snapshot_json` |
| View handling | Phase 2a view definition was to be **kept** (no rollback of the skipped view block) |
| Data loss if it had been used | In-flight `content_update` pending payloads |
| Execution | **Forbidden from this archive** · was never required |

### 6.3 Historical decision criteria (planning only)

| Condition considered | Planned response concept |
| --- | --- |
| Many smoke failures immediately after apply | Consider objects in §6.1–6.2 · Ops sign-off |
| Phase 2a public-view columns missing | Restore Phase 2a view definition from `17120000` (concept) |
| Live listing data corruption | Human dump restore consideration |

**Outcome:** Rollback was **not required** after the 2026-07-01 apply ([apply result](./business-directory-production-controlled-apply-result.md)).

---

## 7. Smoke / verification — Historical results only

> Commands below are **historical results**, not instructions to re-run from this archive. Current verification procedures live in the controlled-apply runbook / result and the relevant tracked scripts.

### 7.1 Automated checks (historical)

| # | Check (script name only) | Pre-apply historical result | Post-apply historical result (2026-07-01) |
| --- | --- | --- | --- |
| S1 | `test-business-directory-phase2a-staging-readiness.mjs` (remote mode) | 20/20 PASS (Phase 2a columns) | Maintained; pending/RPC confirmed separately |
| S2 | `test-business-directory-phase2a-production-smoke.mjs` (Stripe skipped) | 14 pass / 6 fail | **16/0** (authoritative outcome in apply result) |
| S3 | `test-business-directory-production-step2-edge.mjs` (remote mode) | Re-run pending at audit time | **15/0** · health + public API 200 |

**S2 failures that the audit expected DB apply to clear (pre-apply observation):**

| Check | Pre-apply cause | Post-apply historical outcome |
| --- | --- | --- |
| `generate_listing_draft` | RPC/table missing | PASS |
| `get_owner_listing_detail` | pending table missing | PASS |
| `published update_draft_listing` | pending table missing | PASS |
| `content_update` approve chain | same | PASS |
| `content_update live` | approve not reached | PASS |

**Non-DB factors noted at the time (later fixed outside this archive):**

| Check | Note |
| --- | --- |
| Free public short visible (browser) | `public/detail.html` lacked `chat-supabase-config.js` — fixed later ([detail fix](./business-directory-public-detail-config-fix.md)) |
| Standard+ rich content under Stripe-skip | plan=free · Stripe skipped — outside DB apply |

### 7.2 Post-apply SELECT verification (historical concept)

Verification intent was recorded against the VERIFY section of [business-directory-15110000-partial-apply.sql](./sql/business-directory-15110000-partial-apply.sql) (nine items including six Phase 2a columns). Executable SELECT text is **not** retained in this archive.

Historical verification themes:

- `business_directory_pending_updates` exists
- `published_snapshot_json` column exists on review requests
- Public view still exposes the six Phase 2a columns
- After `16100000`, AI quota RPC exists

### 7.3 Manual E2E themes (historical checklist concepts)

Recorded as human-verification themes after apply (8788), not as a re-run guide:

1. AI generate → apply → draft save
2. Edit → submit → approve → public detail (Phase 2a columns)
3. Published → edit → pending → content_update → approve → public update
4. Free planGate · Standard+ (Stripe or mock plan separately)

---

## 8. Historical Go / No-Go (pre-apply planning)

### 8.1 Go conditions used in planning

| # | Condition (historical) |
| --- | --- |
| G1 | Dashboard / CLI link ref = `ddojquacsyqesrjhcvmn` |
| G2 | Backup / dump policy confirmed (Free · no PITR) |
| G3 | Ops/DBA understood **partial** `15110000` (view skip) |
| G4 | Post-apply SELECT plan ready to confirm Phase 2a columns retained |
| G5 | Maintenance window · monitoring · rollback concept reviewed |
| G6 | Edge Phase 2 already deployed (redeploy not required) |
| G7 | Product/Ops approval for Production DB change |
| G8 | Staging ref `ahlxuyvhzqdqaojiywmu` rehearsal recommended (NOTE if skipped) |

### 8.2 No-Go conditions used in planning

| # | Condition (historical) |
| --- | --- |
| N1 | Attempting full `15110000` including the view replace |
| N2 | Project ref mismatch |
| N3 | Rollback concept not reviewed |
| N4 | Phase 2a readiness remote verification FAIL |

### 8.3 Judgment record

| Judgment | Reason |
| --- | --- |
| **Conditional Go** (pre-apply) | Additive DDL · Edge aligned · partial apply avoided Phase 2a regress |
| **Production Ready (pre-apply)** | Not Ready — this document was audit-only at that moment |
| **Production Ready (post-apply · 2026-07-01)** | **Go** — [controlled apply result](./business-directory-production-controlled-apply-result.md) |
| **Commercial Launch** | **Conditional** — separate from DB readiness |

---

## 9. Local static tests recorded in this audit (historical)

| Check | Historical result |
| --- | --- |
| `test-business-directory-content-update.mjs` | **15/15 PASS** |
| `test-business-directory-ai-draft-phase1b-edge.mjs` | **27/27 PASS** (Deno unit + Phase 1a regression) |
| Migration file review · Edge dependency grep | Dependencies confirmed |
| Production remote SQL / smoke during *this* audit task | Not run in the audit task itself (apply came later under the controlled-apply runbook) |

These are **historical results**. They are not instructions to re-execute from this archive.

---

## 10. Follow-ups recorded at archive time (status fixed)

| # | Item | Status |
| --- | --- | --- |
| T1 | `15110000` partial-apply SQL snippet | Done — [business-directory-15110000-partial-apply.sql](./sql/business-directory-15110000-partial-apply.sql) |
| T2 | Staging ordered rehearsal `15110000→16100000→2a` | Ops note (outside this archive) |
| T3 | Migration history alignment documentation | Done in current apply runbook — **do not use this archive for repair steps** |
| T4 | Production smoke + Production Ready re-judgment | Done — [apply result](./business-directory-production-controlled-apply-result.md) |
| T5 | `public/detail.html` · `public/list.html` config include | Done — [detail fix](./business-directory-public-detail-config-fix.md) · [list fix](./business-directory-public-list-config-fix.md) |
| T6 | Comment on `15110000` for post–Phase 2a apply | Engineering backlog (optional) |
| T7 | Long-term split of migration into view-less partial vs view update | Backlog |

---

## 11. Related files (reference index)

| File | Role |
| --- | --- |
| `supabase/migrations/20260715110000_business_directory_content_update.sql` | content_update (full · greenfield) |
| `reports/sql/business-directory-15110000-partial-apply.sql` | Partial apply source used on Production |
| `supabase/migrations/20260716100000_business_directory_ai_draft_usage.sql` | AI quota |
| `supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql` | Already applied · view truth at audit time |
| `supabase/functions/_shared/business-directory.ts` | pending / approve |
| `supabase/functions/_shared/business-directory-ai-quota.ts` | quota RPC call site |
| `scripts/test-business-directory-phase2a-production-smoke.mjs` | Post-apply smoke (historical results above) |
| `scripts/test-business-directory-content-update.mjs` | Static consistency |
| `scripts/test-business-directory-ai-draft-phase1b-edge.mjs` | Static consistency |
| `docs/supabase-environments.md` | Human environment SSOT |
| `reports/tasful-supabase-staging-project-manifest.json` | Machine ref SSOT |

---

## 12. Archive status

| Item | Status |
| --- | --- |
| Document role | Completed / Historical Archive — pre-apply readiness audit |
| Production migration execution | Completed 2026-07-01 — [apply result](./business-directory-production-controlled-apply-result.md) |
| Current executable procedure | [apply runbook](./business-directory-production-controlled-apply-runbook.md) only |
| Partial-apply rationale | Retained in §2.1 · linked snippet |
| Go/No-Go outcome | DB **Production Ready Go** · Commercial Launch **Conditional** |
| Re-run from this file | **Forbidden** |

---

*This archive is a historical readiness record only. Do not treat it as an apply, repair, rollback, smoke, or deploy procedure. Agents must not execute migration, remote SQL, or deploy steps from this document.*
