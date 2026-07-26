# TASFUL Phase 3 — Release Candidate（RC）総合監査

**Date:** 2026-07-26  
**Git HEAD:** `c6a4f03`  
**Local verify:** `http://127.0.0.1:8788`  
**Verdict:** `RELEASE BLOCKED`

```text
Platform AI Page Generation (sub-scope):
  Phase 1 / 2-A / 2-D / 2-E — READY (WITH FOLLOW-UP)

TASFUL October RC (this audit):
  RELEASE BLOCKED
```

---

## 1. Scope

**In:** Platform · TALK · AI Workspace · Marketplace · Auth · Billing · Notifications · OCR · SEO · common UI/API/Security · Platform AI page generation  

**Out:** Builder AI page gen · Business Directory AI page gen · booking · join · new feature work  

**Method:** docs SSOT + existing audits + static security review + regression commands + 8788 HTTP smoke. Full Lighthouse / SR a11y suite was **not** re-run end-to-end (tooling/time); gaps called out as P2/ops.

---

## 2. Verdict rationale

Completion gate requires **P0=0 · P1=0 · Production Deploy可能 · Rollback · Monitoring · Secrets · Checklist**.

| Gate | Result |
| --- | --- |
| P0 open | **>0** (REL-P0-01 / 02 / 03 / 04 still open in TODO) |
| P1 open | **>0** (API auth gaps · AI Workspace final-phase FAIL) |
| Production Deploy可能 | **No** — prod alias undeployed (REL-P0-04) |
| Rollback documented | Partial (Pages/Functions rollback known; RC checklist incomplete) |
| Monitoring | Partial (AI monitoring runbook exists · KI-014 flake) |
| Secrets confirmed for prod | Partial (REL-P0-03 DeepSeek · Stripe ops) |
| Release Checklist complete | **No** — `docs/RELEASE_CHECKLIST.md` / production checklist still have open boxes |

→ **RELEASE BLOCKED**

Platform AI page generation remains **code-ready** ([Phase 2-E](./platform-ai-page-gen-phase2e-release-verification.md)) but cannot alone clear the October RC gate.

---

## 3. P0 blockers (release-inhibiting)

| ID | Area | Issue | Unblock |
| --- | --- | --- | --- |
| **REL-P0-01** | Repo | Large unclean working tree · `git add -A` risk | Area-scoped commits only · KI-002 |
| **REL-P0-02** | TLV Payment ops | Backup/PITR · Stripe Dashboard events · Live smoke | Ops runbook only (code Go) |
| **REL-P0-03** | AI 秘書 | Prod `DEEPSEEK_API_KEY` · balance · HTTP 200 smoke | Secret + deploy + smoke |
| **REL-P0-04** | Pages | **prod alias 未 deploy** | 8788 smoke → alias → prod smoke |

These are pre-existing Release P0s in `docs/TODO.md`, reconfirmed 2026-07-26.

---

## 4. P1 blockers (release-inhibiting)

| ID | Area | Issue | Evidence | Unblock |
| --- | --- | --- | --- | --- |
| **RC-P1-01** | API auth | `/api/secretary-deepseek-chat` — **no JWT**; anyone can spend DeepSeek | `deploy/cloudflare/functions/api/secretary-deepseek-chat.js` | Require ops auth / JWT + role |
| **RC-P1-02** | API auth | `/api/tlv-zego-token` — **no JWT**; client-chosen `userId`/`roomId`/`role` | `deploy/cloudflare/functions/api/tlv-zego-token.js` | JWT + room membership (or remove from public Pages until Live Go) |
| **RC-P1-03** | API auth | Pages `gemini-live-proxy.js` residual — WS upgrade uses env key **without auth** (dev leftover; Worker is intended prod) | `deploy/cloudflare/functions/api/gemini-live-proxy.js` | Disable/remove from Pages deploy or require auth |
| **RC-P1-04** | AI Workspace | `test-tasful-ai-final-phase.mjs` **29/31** — missing `data-ai-workspace-categories` / history category markers | `ai-workspace.html` · prior `reports/ai-workspace-navigation-audit.md` | Wire category nav or update gate + ship intentional UX |

---

## 5. P2 / P3 (tracked · non-blocking for gate text, but must clear before *public* SEO launch)

| Sev | Item |
| --- | --- |
| P2 | Site-wide `robots.txt` Disallow:/ + `X-Robots-Tag: noindex` (intentional private test) — **flip before public index** |
| P2 | No `sitemap.xml` · no custom `404.html` |
| P2 | CSP path-scoped only (not site-wide) |
| P2 | Non-TLV `stripe-webhook` lacks event-id idempotency table (TLV path is OK) |
| P2 | Upload MIME-only checks (Talk / listing images) |
| P2 | Login `return`/`next` allows any relative same-site path |
| P2 | `platform-page-gen-detail` does not set `<link rel="canonical">` |
| P2 | Platform AI post UI: dual「下書き生成」vs「AIでページを作成」(Phase 2-E F1) |
| P2 | `npm run smoke:pages` FAIL locally: Staging inject `currentUserId` present (config hygiene) |
| P3 | Uneven rate limits across Pages APIs |
| P3 | No Cloudflare Cron (TLV payout / ANPI timeout documented future) |
| P3 | KI-014 Gemini media 503 flake (monitoring noise) |
| P3 | Accessibility: no fresh automated SR pass in this audit |
| P3 | Performance: no fresh Lighthouse run in this audit |

---

## 6. Domain results (this pass)

### 6.1 Production readiness

| Item | Status |
| --- | --- |
| Env separation docs | OK (`ddoj…` / `ahlx…`) |
| Pages stage + `_headers` / `_redirects` / `robots.txt` | OK (private noindex) |
| Supabase client without service_role in browser | OK |
| R2 | Not used (Supabase Storage) |
| Cron | Not shipped |
| Rate limit | OCR/AI usage OK · uneven elsewhere |
| CSP / CORS | Partial CSP · Function CORS |
| Secrets for full RC | **Incomplete** (REL-P0-03 + Stripe ops) |

### 6.2 Security

| Item | Status |
| --- | --- |
| Page-gen XSS escape | OK |
| Talk/chat escapeHtml | OK |
| page-gen / OCR JWT | OK |
| Prototype pollution guards (page-gen) | OK |
| Unauthenticated spend/mint APIs | **P1** (RC-P1-01…03) |
| RLS | Rely on prior `reports/supabase-rls-final-audit.md` — re-verify live before public |

### 6.3 Performance

Not re-measured (Lighthouse / CWV). Cache headers present for static assets. **No P0/P1 from this pass.** Treat full perf gate as pre-public follow-up.

### 6.4 SEO

Private-test posture (**noindex**). Page-gen SEO/JSON-LD engine OK. Public SEO launch needs robots/sitemap/canonical flip — **P2 for public**, not for private RC alias.

### 6.5 Accessibility

Spot only (HTTP 200 pages). No new automated a11y suite. **P3** to schedule keyboard/SR pass on post / talk / ai-workspace / detail.

### 6.6 Platform regression

| Check | Result |
| --- | --- |
| `test-platform-finish-phase.mjs` | **38/38 PASS** |
| `test-platform-next-phase.mjs` | **37/37 PASS** |
| `test-page-gen-engine-phase1.mjs` | **252/252 PASS** |
| `test-platform-page-gen-phase2a.mjs` | **63/63 PASS** |
| Page-gen entitlement/draft smoke | **PASS** (Staging) |
| HTTP `/post` `/detail-product` | **200** |
| Phase 2-E page-gen | READY WITH FOLLOW-UP |

### 6.7 TALK

| Check | Result |
| --- | --- |
| HTTP `/talk-home.html` | **200** |
| Prior Platform→Talk / Builder→Talk Review | PASS (docs SSOT · 2026-07-03) |
| Fresh headed Talk E2E this session | **Not re-run** (prior PASS accepted; Playwright chromium installed for future smoke) |

### 6.8 AI Workspace

| Check | Result |
| --- | --- |
| HTTP `/ai-workspace.html` | **200** |
| `test-tasful-ai-final-phase.mjs` | **29/31 FAIL** (RC-P1-04) |
| Production Ready claim vs categories gap | Documented mismatch — blocks RC |

### 6.9 Marketplace

| Check | Result |
| --- | --- |
| Prior marketplace RLS lock reviews | Cited in security audit |
| Fresh checkout E2E (stop before charge) | **Not re-run this session** |
| Stripe live ops | Tied to REL-P0-02 |

---

## 7. Rollback (RC expectation)

| Layer | Action |
| --- | --- |
| Pages | Previous Cloudflare Pages deployment |
| Functions | Previous Functions/Worker deployment |
| DB | Prefer additive; page-gen needs no column rollback |
| Entitlement | Fail closed (402/503) — never free-open AI page gen |
| Stripe | Disable price / webhook endpoint via Dashboard if needed |

**Status:** Documented for page-gen (2-E) and general Pages/Functions; **full RC rollback drill not executed** this session → checklist incomplete.

---

## 8. Monitoring (RC expectation)

- Entitlement / draft API status codes (page-gen)
- Stripe webhook failures / duplicates
- AI monitoring (`verify-tasful-ai-monitoring.mjs`) — accept KI-014 flake
- OCR 429 / upstream errors
- Talk Realtime errors (ops)

**Status:** Runbooks exist; continuous prod monitoring not verified live this session.

---

## 9. Release checklist status

| Checklist | State |
| --- | --- |
| `docs/RELEASE_CHECKLIST.md` | Open items remain (AI Workspace section still says NO in places; OAuth E2E; etc.) |
| `docs/production-release-checklist.md` | Legacy open boxes (Anpi JWT, Talk broadcast Edge, prod URL E2E) |
| Phase 2-E page-gen deploy order | Documented · **not executed** |

---

## 10. Unblock plan (ordered)

1. **REL-P0-01** — finish area commits; keep dirty tree out of release staging.  
2. **RC-P1-01…03** — auth-gate or remove unauthenticated token/AI proxies from public Pages.  
3. **RC-P1-04** — restore AI Workspace category markers **or** revise final-phase gate + product sign-off.  
4. **REL-P0-03** — DeepSeek prod secret + smoke (after auth fix).  
5. **REL-P0-04** — Production `build:pages` (no Staging inject) → prod alias deploy → smoke.  
6. **REL-P0-02** — only if October scope includes TLV wallet/live; else explicitly defer TLV Live as No-Go in RC notes.  
7. Re-run: Phase1/2A · AI final · Platform finish/next · `smoke:pages` on Production config · page-gen Staging E2E.  
8. Complete Release Checklist checkboxes · optional public SEO flip (separate gate).

---

## 11. Commands run (2026-07-26)

```text
node scripts/test-page-gen-engine-phase1.mjs          → 252/252 PASS
node scripts/test-platform-page-gen-phase2a.mjs       → 63/63 PASS
node scripts/test-platform-finish-phase.mjs           → 38/38 PASS
node scripts/test-platform-next-phase.mjs             → 37/37 PASS
node scripts/test-tasful-ai-final-phase.mjs           → 29/31 FAIL
node scripts/_tmp-phase2d-api-smoke.mjs               → DRAFT_OK
npm run smoke:pages                                   → FAIL (Staging currentUserId)
HTTP: post/talk/ai/detail-product/robots              → 200
```

---

## 12. Final board

```text
Platform AI Page Generation: READY (WITH FOLLOW-UP) — not the RC blocker alone

TASFUL October Release Candidate:
  RELEASE BLOCKED

Blockers:
  1. REL-P0-01 unclean tree
  2. REL-P0-04 prod alias undeployed
  3. REL-P0-03 AI secretary secrets/smoke
  4. REL-P0-02 TLV payment ops (if Live/wallet in October scope)
  5. RC-P1-01 secretary-deepseek unauthenticated
  6. RC-P1-02 tlv-zego-token unauthenticated
  7. RC-P1-03 gemini-live-proxy Pages residual unauthenticated
  8. RC-P1-04 AI Workspace final-phase 29/31 (categories HTML)

解除後再判定:
  Phase 3 RC re-audit (security + regressions + prod smoke) → RELEASE READY
```

*No Production Deploy and no Push in Phase 3.*
