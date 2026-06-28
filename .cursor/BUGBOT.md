# TASFUL — Bugbot / PR Review Rules

**Purpose:** Mirror critical project rules for PR-time review (Bugbot, `/review`, pre-push review).  
**Authority:** `.cursor/rules/` and `docs/DECISIONS.md` remain canonical — this file does not replace them.

---

## Review scope

- Review **source changes** in the PR diff.
- Treat `deploy/cloudflare/dist/` as **build output** (AD-009): flag unexpected hand-edits; prefer reviewing source + intentional dist mirror per commit scope.
- Do **not** treat generated temp (`.wrangler/`, `.dev.vars`, probe JSON with secrets) as primary review targets.

---

## Blocking — always flag

| Rule | Source | Check |
| --- | --- | --- |
| **`git add -A` / bulk staging** | AD-007, `git.mdc` | Staged files must match stated scope; no unrelated Builder/TLV/AI/probe mix |
| **Secret exposure** | AD-010, user policy | No `.env`, API keys, tokens, `ZEGO_SERVER_SECRET`, `DEEPSEEK_API_KEY`, probe auth cookies in diff or comments |
| **Production / deploy config** | AD-008 | No production Cloudflare/Supabase secret or prod-only routing changes unless explicitly scoped |
| **Gateway contract change** | AD-005, KI-001 | `ai-model-gateway.js` changes need explicit justification |
| **AI surface merge** | AD-002 | Builder AI must not merge into TASFUL AI Workspace |
| **Platform/TLV dedicated AI** | AD-003, AD-004 | No new Platform-only or TLV-only LLM engines |
| **Dangerous deletion** | `qa.mdc`, `pre-review` | RLS policies, disclaimers, auth guards, frozen UI without Critical/Security reason |
| **Frozen product scope creep** | AD-008 | Builder v1.0 · Platform · TLV v1.0 · AI 秘書 — feature/UI changes outside Critical/Security/spec-follow |

---

## High — domain boundaries

Review changes against the **intended product area**:

| Area | Path hints | Must not cross into |
| --- | --- | --- |
| **Builder** | `builder/**`, Builder AI | TASFUL AI engine merge, TLV-only live stack |
| **Platform** | `platform/**`, listings | Platform-only AI engine (AD-003) |
| **TLV Live** | `live/**`, `db/tlv_*` | TLV-only AI engine (AD-004); respect FEATURE FROZEN |
| **TASFUL AI** | `ai-workspace*`, Gateway | Builder AI merge, Secretary DeepSeek route in Gateway |
| **AI 秘書** | `admin-ai-*`, secretary | RELEASE FROZEN except Critical/Security |
| **Platform Live / ZEGO** | `platform-live/**`, ZEGO functions | TLV PoC rewrite, production deploy |

Use `.cursor/agents/*-agent.md` for ownership when scope is ambiguous.

---

## Verification — local QA (8788)

From `_global.mdc` and `qa.mdc`:

- **`file://` / VSCode Preview / local HTML direct open — invalid for QA claims**
- Valid verification: **`http://127.0.0.1:8788` only**
- Before accepting “PASS” UI claims: dev listening on 8788, target URL HTTP 200, wrangler Ready
- Completion reports must include: **HTTP Status · Console Error · Viewport 1280 / 768 / 390**
- Use `scripts/lib/dev-server-url.mjs` for test URLs

---

## UI changes — screenshot comparison required

From `qa.mdc` and `docs/screenshots-qa-rules.md`:

- Layout/visual changes require **screenshot comparison**
- Compare **current** vs **target/reference** (not single screenshot alone)
- Platform/TLV frozen UI — changes need Critical/Security/spec-follow justification
- Register/compare via Screenshots QA Center conventions where applicable

---

## Playwright / E2E

- Prefer **state-based waits** (`waitForFunction`, `waitForSelector`, network/response conditions)
- Avoid **fixed `sleep`** except documented flake mitigation with comment
- Do not treat regex matches on **in-progress** status text as PASS (e.g. `host publish 中…` vs `host publish · provider=live`)
- Fake-media / headless results ≠ manual browser PASS — state explicitly in report

---

## Git & commit hygiene

From `git.mdc`:

- **Selective staging only:** `git add <path>` per file
- Verify `git diff --cached --name-status` before merge
- Source change → expect `npm run build:pages` and relevant `scripts/test-*.mjs` / verify scripts
- Do not commit secrets, gate auth storage, or full dist tree unless commit scope explicitly includes dist mirror

---

## Documentation

From `docs.mdc`:

- **`docs/DECISIONS.md` overrides** other docs when in conflict
- Do not mark “complete” without evidence (commit hash, test output, report)
- Status truth: `docs/PROJECT_STATUS.md`, `docs/TODO.md` — not chat logs alone
- Doc updates belong in selective commits, not drive-by with unrelated code

---

## Output expectations (align with `/review`)

Classify findings as **Blocking / High / Medium / Low**.

- **Go:** no Blocking or High
- **No-Go:** any Blocking or High

Do **not** auto-fix, stage, or commit during review.

---

## References

- `docs/DECISIONS.md` (AD-001–AD-010+)
- `.cursor/rules/_global.mdc`, `qa.mdc`, `git.mdc`, `docs.mdc`, `pkg-*.mdc`
- `.cursor/commands/review.md`, `.cursor/hooks/pre-review.md`
