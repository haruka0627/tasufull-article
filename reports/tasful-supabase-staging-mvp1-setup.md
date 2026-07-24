# TASFUL Supabase Staging MVP-1 — Environment Setup Report

**Date:** 2026-07-01  
**Scope:** Business Directory Staging environment only  
**Production ref:** `ddojquacsyqesrjhcvmn` — **not modified**  
**Staging ref:** `ahlxuyvhzqdqaojiywmu`

**SSOT:** [docs/supabase-environments.md](../docs/supabase-environments.md) · [tasful-supabase-staging-project-manifest.json](./tasful-supabase-staging-project-manifest.json)

---

## Executive summary

| Phase | Status | Result |
| --- | --- | --- |
| 1 — Environment | ✅ Complete | `.env.staging` created; all required `TASFUL_*` / `SUPABASE_*` vars present |
| 2 — Guard verification | ✅ Complete | `BD_PRODUCTION_PROJECT_REF` blocks Production link; Staging ref accepted |
| 3 — Supabase link | ✅ Complete | CLI linked to `ahlxuyvhzqdqaojiywmu` only |
| 4 — Migration | ⚠️ Partial (BD complete) | Full `db push` blocked by TALK prerequisite; BD chain (7 files) applied |
| 5 — Edge Functions | ✅ Complete | `business-directory`, `stripe-webhook` ACTIVE on Staging |
| 6 — Verification | ✅ Complete | Readiness **21/21 PASS** · MVP-1 smoke **19/19 PASS** |

**Production:** No link, migration, deploy, or env changes performed against `ddojquacsyqesrjhcvmn`.

---

## Phase 1 — Environment setup

**Action:** Created `.env.staging` via `node scripts/lib/create-env-staging.mjs` (gitignored; not committed).

**Source:** Staging Dashboard keys from `supabase projects api-keys --project-ref ahlxuyvhzqdqaojiywmu`.

| Variable | Status |
| --- | --- |
| `SUPABASE_PROJECT_REF` | `ahlxuyvhzqdqaojiywmu` |
| `SUPABASE_URL` | `https://ahlxuyvhzqdqaojiywmu.supabase.co` |
| `SUPABASE_ANON_KEY` | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Set (local only) |
| `TASFUL_SUPABASE_URL` | Staging URL |
| `TASFUL_SUPABASE_ANON_KEY` | Set |
| `BD_PRODUCTION_PROJECT_REF` | `ddojquacsyqesrjhcvmn` (guard constant) |
| `AUTH_HOOK_L2_ALLOWLIST_PASSWORD` | Set (copied from local `.env`) |

**Template:** [.env.staging.example](../.env.staging.example)

---

## Phase 2 — Guard verification

**Guard module:** [scripts/lib/supabase-env.mjs](../scripts/lib/supabase-env.mjs)

| Check | Result |
| --- | --- |
| `checkStagingNotProductionLinked()` with Staging linked | `ok: true`, `linked=ahlxuyvhzqdqaojiywmu` |
| `checkStagingNotProductionLinked()` with Production linked (pre-switch) | `ok: false` — blocks Staging remote ops |
| `checkProductionTargetAllowed()` semantics | Blocks Production ops when CLI linked to Staging |
| Guard modified? | **No** — read-only verification |

---

## Phase 3 — Supabase link

| Item | Value |
| --- | --- |
| **Before link** | `supabase/.temp/project-ref` = `ddojquacsyqesrjhcvmn` (Production detected → abort check passed, then switched) |
| **Command** | `npx supabase link --project-ref ahlxuyvhzqdqaojiywmu --yes` |
| **After link** | `ahlxuyvhzqdqaojiywmu` |
| **Production touched?** | No migration / deploy / secret changes on Production |

**Note:** Local CLI remains linked to **Staging**. Re-link to Production only for explicit Production release tasks.

---

## Phase 4 — Migration status

### Full chain (`supabase db push`)

**Failed** at `20260622120000_talk_room_contact_bridge.sql`:

```
relation "transaction_rooms" does not exist
```

TALK/Match prerequisite migrations were not fully applied before this migration. Migrations through `20260621180000` were partially applied during the failed push.

### Business Directory chain (MVP-1 scope) — applied successfully

Applied individually via `supabase db query --linked -f` and recorded with `supabase migration repair`:

| Version | File | Purpose |
| --- | --- | --- |
| `20260711100000` | `business_directory_phase1_schema.sql` | Core schema, RLS, RPC |
| `20260711100001` | `business_directory_phase1_seed.sql` | Categories / plan features |
| `20260712100000` | `business_directory_stripe.sql` | Stripe columns |
| `20260715100000` | `business_directory_storage.sql` | Storage bucket |
| `20260715110000` | `business_directory_content_update.sql` | `pending_updates`, snapshot |
| `20260716100000` | `business_directory_ai_draft_usage.sql` | Quota RPC |
| `20260717120000` | `business_directory_phase2a.sql` | Phase 2a SEO / FAQ columns |

**Remote verification (2026-07-01):**

| Object | Count / status |
| --- | --- |
| BD tables (`business_directory_*`) | 12 tables including `pending_updates`, `ai_draft_usage_daily` |
| RPC functions | `business_directory_is_ops_admin`, `business_directory_set_updated_at`, `consume_business_directory_ai_draft_quota` |
| RLS policies | 28 on `business_directory_*` tables |
| Phase 2a view columns | Verified via readiness script (seo_title, meta_description, faq_items, recommended_uses) |

**Migration list (BD rows):** Local and remote match for all 7 BD versions above.

---

## Phase 5 — Edge deployment

**Secrets set on Staging:**

| Secret | Value |
| --- | --- |
| `SITE_URL` | `http://127.0.0.1:8788` |

**Deployed functions (`npx supabase functions list --project-ref ahlxuyvhzqdqaojiywmu`):**

| Function | Status | Version | Updated (UTC) |
| --- | --- | --- | --- |
| `business-directory` | ACTIVE | 1 | 2026-07-01 00:57:18 |
| `stripe-webhook` | ACTIVE | 1 | 2026-07-01 00:57:18 |

**Not set on Staging (optional / Launch):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GEMINI_API_KEY` — AI draft uses mock fallback when Gemini absent.

---

## Phase 6 — Verification results

### Readiness (remote DB + repo)

```bash
BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote
```

**Result:** **21 passed, 0 failed**

Includes: migration file checks, Edge shared code checks, Staging guard, Phase 2a column/view verification, migration version recorded.

### MVP-1 smoke (Edge + flows)

```bash
node scripts/test-business-directory-staging-mvp1-smoke.mjs --skip-stripe
```

**Result:** **19 passed, 0 failed, 1 note** (Stripe skipped)

| Flow | Result |
| --- | --- |
| Staging link guard | PASS |
| Owner / ops sign-in | PASS |
| Edge health | PASS |
| AI `generate_listing_draft` + quota RPC | PASS |
| `create_draft_listing` | PASS |
| `update_draft_listing` Phase 2 fields | PASS |
| `get_owner_listing_detail` (pending_updates path) | PASS |
| Approve initial publish | PASS |
| Public API Phase 2 fields | PASS |
| Published edit → pending_updates | PASS |
| `content_update` submit | PASS |
| Pending: live unchanged | PASS |
| Approve content_update | PASS |
| Live updated after approve | PASS |

**Smoke script fix applied:** Added `prefecture` + `city` to AI draft payload (required by `validateGenerateListingDraftInput`).

**Script:** [scripts/test-business-directory-staging-mvp1-smoke.mjs](../scripts/test-business-directory-staging-mvp1-smoke.mjs)

### Not run in this task

| Item | Reason |
| --- | --- |
| 8788 browser UI (owner/public preview pages) | Requires `npm run build:pages` with Staging `TASFUL_*` injected |
| Stripe checkout / webhook E2E | `--skip-stripe`; no Staging Stripe secrets configured |
| Full monorepo migration chain | Blocked by TALK dependency (see Phase 4) |

---

## Remaining issues / follow-ups

1. **Partial platform schema on Staging** — Full `db push` stops at TALK bridge migration. BD MVP-1 is complete; Match/TALK/Auth-hook migrations remain for MVP-2/MVP-3 per [tasful-supabase-staging-project-plan.md](./tasful-supabase-staging-project-plan.md).

2. **Stripe on Staging** — Configure Test-mode `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` and re-run smoke without `--skip-stripe`.

3. **8788 browser verification** — Build with Staging keys:
   ```bash
   # load .env.staging vars, then:
   npm run build:pages && npm run dev
   ```
   Verify `business-directory/owner/` and `public/detail.html` at 1280 / 768 / 390.

4. **Auth hook migrations (MVP-3)** — L7 JWT claims may require Auth hook SQL + `AUTH_HOOK_L2_ALLOWLIST_PASSWORD` on Staging Auth.

5. **Production dependent migrations** — Separate approved task. See [business-directory-dependent-migrations-production-readiness.md](./business-directory-dependent-migrations-production-readiness.md) (partial apply of `20260715110000` on Production).

6. **CLI link state** — Repository is linked to Staging. Document in team runbooks before any Production DB operation.

7. **Production smoke script** — `test-business-directory-phase2a-production-smoke.mjs` AI draft call also omits `prefecture`/`city`; align when next running Production smoke.

---

## Commands reference

```bash
# Verify Staging link guard
BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote

# Full BD flow smoke (Staging)
node scripts/test-business-directory-staging-mvp1-smoke.mjs --skip-stripe

# Confirm CLI link
cat supabase/.temp/project-ref   # expect ahlxuyvhzqdqaojiywmu
```

---

## Production safety confirmation

| Operation | Production (`ddojquacsyqesrjhcvmn`) |
| --- | --- |
| `supabase link` | Not linked at end of task |
| `db push` / remote SQL | Not executed |
| Edge deploy | Not executed |
| Secrets / env | Not modified |
| User data | Not read or copied |

---

*Report generated after Staging MVP-1 setup completion. Secrets are in `.env.staging` only — never commit.*
