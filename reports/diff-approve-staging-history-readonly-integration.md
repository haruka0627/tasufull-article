# Diff & Approve — Staging Migration History + Read-Only Operations Integration

**Date:** 2026-07-28  
**Branch:** `cf-pages-deploy`  
**Start HEAD:** `d7bd590177d24e32af7f4fe96e05c22eb1b69ff3`  
**Verdict:** `PASS_STAGING_HISTORY_AND_READ_OPS`

## 1. Verdict

Migration history repaired to classification **A**. Read-only Operations repository, API, and Staging UI are implemented and tested. Real Apply / Production / Provider remain stopped.

## 2. Starting state

| Item | Value |
| --- | --- |
| branch | `cf-pages-deploy` |
| HEAD | `d7bd590177d24e32af7f4fe96e05c22eb1b69ff3` (match) |
| dirty | 1084 (tracked 582 / untracked 502 / staged 0) — untouched |
| linked | `ahlxuyvhzqdqaojiywmu` (Staging) |
| Production | `ddojquacsyqesrjhcvmn` — unused |

## 3. Execution strategy

Primary-led after Agent A (history) + explore (ops conventions). Repair via official CLI only. New Staging page (not frozen dashboard merge).

## 4. Multi-agent usage

| Agent | Role |
| --- | --- |
| A (shell) | Migration history drift audit → **B** |
| Explore | Ops API/UI conventions |
| Primary | Repair + read path + UI + tests + commits |

## 5. Migration history audit

| Check | Result |
| --- | --- |
| Local file | `20260728140000_ai_diff_approve_staging_persistence.sql` present |
| Remote `schema_migrations` (before) | **missing** `20260728140000` |
| Remote schema objects | 4 tables + write_step + triggers + RLS present |
| **Classification (before)** | **B** (schemaあり + historyなし) |

## 6. Schema drift audit

Pre-repair fingerprint: tables=4, rls=4, fn=4, probe_prop=0, `ai_diff_prop_applied_false` present. No material drift vs local SQL for Diff & Approve objects.

## 7. Repair decision

Repair **allowed**: schema matches migration intent; do **not** re-run SQL. Use `supabase migration repair … --status applied --linked`.

## 8. Repair execution

```text
npx supabase migration repair 20260728140000 --status applied --linked
→ Repaired migration history: [20260728140000] => applied
```

Linked ref confirmed `ahlxuyvhzqdqaojiywmu` before command. No Production target. No manual `schema_migrations` INSERT.

## 9. Repair verification

| Check | Result |
| --- | --- |
| `migration list` | Local `20260728140000` = Remote `20260728140000` |
| `schema_migrations` row | present |
| tables/rls counts | unchanged (4/4) |
| Classification (after) | **A** |
| Production ops | none |

## 10. Read-only architecture

```text
Staging DB (service_role Edge)
  → ai-diff-approve-persistence-repository (read gate)
  → ai-diff-approve-ops-read (A8 projection + redaction)
  → /api/ai-diff-approve/* (GET-only · ops JWT)
  → admin-diff-approve.html (READ ONLY UI)
```

Browser never receives service_role.

## 11. Authorization

- Reuse `requireGateOpsUser` (`is_ops` / `tasu_admin`)
- Unauthenticated → 401
- Non-ops authenticated → 403 `ops_required`
- Production env / Production Supabase URL → 403
- Page guard: `auth-ops-guard.js` → `admin-diff-approve`

## 12. Repository changes

`ai-diff-approve-persistence-repository.mjs`:

- `DIFF_APPROVE_READ_ENABLED`
- `assertReadAllowed`
- read methods use read gate; writes keep persistence gate

## 13. API / Function

| Method | Path |
| --- | --- |
| GET | `/api/ai-diff-approve/proposals` |
| GET | `/api/ai-diff-approve/summary` |
| GET | `/api/ai-diff-approve/:id` |
| GET | `/api/ai-diff-approve/:id?view=timeline` |

POST/PUT/PATCH/DELETE → 405. `Cache-Control: no-store`. `request_id` on responses.

## 14. Operations read model

DB records → A8 `projectReadModel` / `queryReadModels` / `groupByStatus` → display fields (`timeline_integrity`, `age_seconds`, …) without overriding canonical status.

## 15. Dashboard / UI

New page (frozen dashboard not rewritten):

- `admin-diff-approve.html` / `.css` / `-client.js`
- List · detail · timeline · security invariants · filters · pagination
- Badges: STAGING · READ ONLY · NO APPLY
- No Approve/Reject/Apply/Execute/Retry/Rollback buttons

## 16. Payload security

Recursive redaction of secret-like keys; depth/key/string limits; `textContent` rendering; prototype keys skipped.

## 17. Feature flags

| Flag | Required for read |
| --- | --- |
| `DIFF_APPROVE_READ_ENABLED=true` | yes |
| `DIFF_APPROVE_PERSISTENCE_ENABLED` | write path |
| `DIFF_APPROVE_APPLY_ENABLED` | must be false / unset |
| `AI_EXEC_GATE_ENVIRONMENT=staging` (or Staging Supabase URL) | yes |

No new secrets embedded. Uses existing `SUPABASE_SERVICE_ROLE_KEY` + anon auth URL on Edge only.

## 18. Staging deploy

| Item | Status |
| --- | --- |
| Functions + UI in repo | ready |
| Git push | **not performed** (forbidden) |
| Cloudflare remote Pages deploy | **not performed** (requires push/separate approval) |
| Local verification path | `npm run build:pages` + `npm run dev` (8788) + flags |

Remote Staging Pages traffic will pick up after an approved deploy/push.

## 19. Staging verification

| Area | Result |
| --- | --- |
| Migration history A | PASS |
| Static/API/UI unit tests | PASS (`test-diff-approve-staging-readonly-ops.mjs`) |
| Persistence suite | PASS |
| Method deny POST/PATCH/DELETE | PASS |
| Production reject | PASS |
| Integrity fail-closed | PASS |

Live operator HTTP against remote Pages deferred until Staging Pages deploy approval (flags + session).

## 20. Cleanup

No new probe rows created in this batch. Prior probe namespace remains 0.

## 21. Security

Apply/provider/write UI absent. Service role Edge-only. Deny-all RLS unchanged.

## 22. Tests

`node scripts/test-diff-approve-staging-readonly-ops.mjs` → PASS  
`node scripts/test-diff-approve-staging-persistence.mjs` → PASS

## 23. Regression

Safe-batch A1–A11 PASS · C10 PASS

## 24. Scope audit

In: history repair, read repo, GET API, Staging UI, tests, evidence.  
Out: Apply, Provider, Production, write UI, Cron, push/deploy.

## 25. Known risks

1. Remote Pages not yet serving new routes until approved deploy  
2. Read requires ops JWT + Staging flags in Wrangler/Pages env  
3. Other Local-only migrations still exist historically (out of scope)

## 26. Critical boundary

Next needs explicit approval: Staging Pages deploy/push, write UI, Apply enablement, Production.

## 27. Commits

See final report (selective commits · no push).

## 28. Next recommended action

1. Set Staging Pages env: `DIFF_APPROVE_READ_ENABLED=true`, apply=false, Staging Supabase URL  
2. Approve git push / Staging Pages deploy  
3. Operator E2E on Staging host  
4. Do **not** enable Apply
