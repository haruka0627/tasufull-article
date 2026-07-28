# Diff & Approve — Staging Read-Only Operator E2E

**Date:** 2026-07-28  
**Start HEAD:** `e76a3cea00a38e222346c0b81c6779e060b93406`  
**Verdict:** `PASS_STAGING_READONLY_OPERATOR_E2E`

## Starting State

| Item | Value |
| --- | --- |
| branch | `cf-pages-deploy` |
| HEAD | `e76a3cea00a38e222346c0b81c6779e060b93406` (match) |
| dirty | large unrelated tree (untouched) |
| linked Staging | `ahlxuyvhzqdqaojiywmu` |
| upstream | `origin/cf-pages-deploy` ahead 199 / behind 9 |
| Production risk | **Push to `cf-pages-deploy` = Production Pages** → avoided |

## Deploy

| Item | Value |
| --- | --- |
| Method | Cloudflare Pages **Direct Upload Preview** |
| Project | `tasufull-article` |
| Branch | `diff-approve-staging-readonly` (≠ production_branch) |
| Deployment | `https://341246f1.tasufull-article.pages.dev` |
| Alias | `https://diff-approve-staging-readonl.tasufull-article.pages.dev` |
| Script | `scripts/deploy-diff-approve-staging-preview.mjs` |
| Production deploy | **not performed** |
| `cf-pages-deploy` git push | **not performed** (would be Production) |

## Environment

- Build/API data: Staging Supabase `ahlxuyvhzqdqaojiywmu` only
- `.env` Production URL intentionally ignored for this deploy
- Preview env flags upserted (then rate-limit; flags retained from first successful patch)

## Feature Flags

| Flag | Preview value |
| --- | --- |
| `DIFF_APPROVE_READ_ENABLED` | `true` |
| `DIFF_APPROVE_APPLY_ENABLED` | `false` |
| `DIFF_APPROVE_PERSISTENCE_ENABLED` | `true` |
| `AI_EXEC_GATE_ENVIRONMENT` | `staging` |

## Authentication

Ephemeral Staging users created via Admin API for E2E, then deleted:

- ops: `app_metadata.is_ops=true` / `role=tasu_admin`
- member: non-ops

## Authorization

| Actor | Result |
| --- | --- |
| Unauthenticated GET | **401** `auth_required` |
| Member JWT GET | **403** `ops_required` |
| Operator JWT GET | **200** |
| Production host | non-JSON / not usable as Diff Approve read API |

## API

| Check | Result |
| --- | --- |
| GET list/summary | PASS (~47–120ms typical) |
| POST/PUT/PATCH/DELETE | **405** |
| OPTIONS | **204** |
| HEAD | handled (405) |
| invalid filter/sort/limit | **400** |
| unknown proposal | **404** |
| `Cache-Control: no-store` | PASS |
| no secret literals | PASS |

## UI

| Check | Result |
| --- | --- |
| Desktop 1280 | PASS |
| Mobile 390 | PASS |
| STAGING / READ ONLY / NO APPLY | PASS |
| Browser operator summary fetch | PASS |
| Empty list state | PASS (`データがありません。`) |
| Filter / sort / refresh / pagination chrome | PASS |
| No Approve/Apply buttons | PASS |
| XSS filter remains text | PASS |

## Timeline

`GET /api/ai-diff-approve/:id?view=timeline` responds (404 for unknown id) — PASS fail-closed.

## Performance

| Endpoint | Observed |
| --- | --- |
| list | ~100ms (≪ 500ms) |
| summary | ~50ms |
| timeline | ~177ms |

## Security

- service_role not in browser
- Apply disabled
- Production branch not deployed
- Write methods denied
- Payload redaction covered by prior unit suite + XSS filter text path

## Regression

- `test-diff-approve-staging-readonly-ops.mjs` PASS
- safe-batch A1–A11 PASS
- C10 PASS

## Known Risks

1. Cloudflare Preview alias truncates branch name (`…readonl`)
2. Pages API rate limits / token mishandling if `CLOUDFLARE_API_TOKEN` pre-set wrongly in shell
3. Local `cf-pages-deploy` remains diverged from origin (ahead/behind) — do not force-reconcile without explicit approval
4. Client list requires valid Staging session; E2E injects ops JWT / getSession override

## Scope

**In:** Preview deploy, flags, operator read E2E, evidence, selective commits, preview-branch push  
**Out:** Apply, Provider, Production, Cron/Worker/Queue, Billing, Migration DDL

## Commits

See final report after selective commits + preview-branch push.

## Final Verdict

Staging Read-only Operator E2E **PASS**. Apply / Provider / Production untouched.
