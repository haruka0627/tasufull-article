# AGENTS.md — TASFUL Monorepo

**Repository:** [haruka0627/tasufull-article](https://github.com/haruka0627/tasufull-article)  
**Primary branch:** `cf-pages-deploy`  
**Last updated:** 2026-06-30

This file is the **single source of truth** for AI coding agents working in this repository. When in doubt, prefer `docs/` over chat history or assumptions.

---

## Project Overview

TASFUL is a Japanese-first product platform delivered as a **static-first monorepo**: HTML, CSS, and JavaScript on the front end, with **Supabase** for data/auth, **Cloudflare Pages** for hosting, **Cloudflare Functions** for edge APIs, and **Stripe** for payments where applicable.

The repo hosts multiple products that share infrastructure but maintain **strict boundaries** (especially for AI surfaces, payments, and frozen production areas):

| Product | Status (see `docs/PROJECT_STATUS.md`) | Notes |
| --- | --- | --- |
| **Builder** | Production Ready · FROZEN | Construction / project management · dedicated Builder AI |
| **Platform** | Production Ready · FROZEN | Marketplace · listings · search · no dedicated AI engine |
| **TLV Live** | v1.0 FROZEN · Pause | Live streaming · wallet/tips · payment engine in design/implementation |
| **TASFUL AI Workspace** | Feature-complete · prod wiring remains | General AI workspace · shared Gateway |
| **AI 運営秘書 (Secretary)** | Production Ready · FROZEN | Ops dashboard · DeepSeek (not Gateway) |
| **TALK / Connect / 安否** | Production Ready | Messaging · calls · ANPI |
| **Business Directory** | MVP-1 complete · launch No-Go | Self-service listings · Stripe subscription |
| **Platform Live (ZEGO)** | Phase 1 Go | Adapter layer · feature-flagged |
| **Help / Platform QA** | Active | SSOT articles · shared QA component (AD-015) |
| **TASFUL Materials** | Phase 0 only | Design backlog |

**Canonical status docs:** `docs/README.md` → `docs/DECISIONS.md` → `docs/PROJECT_STATUS.md` → `docs/TODO.md` → `docs/ROADMAP.md`.

> **Note:** `docs/TLV_PRD.md` **does not exist** in this repository. For TLV product/schema/payment specs, use `docs/TLV_DB_SCHEMA.md`, `docs/TLV_PAYMENT_ENGINE.md`, `db/tlv_schema.sql`, `docs/CREATOR_PROGRAM.md`, and `docs/PRICING.md` instead.

---

## Repository Structure

```
tasufull-article/
├── AGENTS.md                 # This file — agent SSOT
├── README.md                 # Quick start · local dev pointer
├── docs/                     # Canonical product & architecture docs
│   ├── README.md             # Docs index
│   ├── DECISIONS.md          # Architecture decisions (AD-001+)
│   ├── PROJECT_STATUS.md     # Current snapshot
│   ├── TODO.md               # Next tasks (priority order)
│   ├── ROADMAP.md            # Mid/long-term phases
│   ├── TLV_DB_SCHEMA.md      # TLV schema · responsibility split
│   ├── TLV_PAYMENT_ENGINE.md # TLV payment/PL flows · Edge specs
│   └── AI/                   # Per-product AI docs
├── deploy/cloudflare/
│   ├── dist/                 # Staged static output (build target)
│   ├── functions/            # Cloudflare Pages Functions (Edge)
│   ├── _redirects            # Path redirects
│   └── stage-cloudflare-pages.mjs
├── supabase/                 # SQL migrations · seeds · RLS setup
├── db/                       # TLV DDL (`tlv_schema.sql`)
├── scripts/                  # Build · verify · test · generators
├── reports/                  # Phase reports · E2E evidence (supporting)
├── .cursor/
│   ├── rules/                # Cursor rules (`_global.mdc`, `pkg-*.mdc`)
│   └── agents/               # Cursor sub-agent prompts (19 agents)
├── builder/                  # Builder app pages
├── live/                     # TLV Live pages · studio · watch
├── platform-live/            # Platform Live adapter / integration
├── business-directory/       # Business Directory MVP UI
├── help/                     # Generated QA detail pages (`/help/<slug>/`)
├── ai-workspace.html         # TASFUL AI Workspace entry
├── ai-model-gateway.js       # AI Gateway contract (AD-005 — do not break casually)
├── platform-qa-*.js          # QA article system · data · CSS
└── *.html, *.js, *.css       # Root-level Platform / shared modules
```

**Build output:** `npm run build:pages` → `deploy/cloudflare/dist` (AD-009). Source changes require rebuild before verification.

**Local verification URL:** `http://127.0.0.1:8788/` only — never `file://`, VS Code Preview, or port 5173 for standard QA (see `docs/local-dev.md`). Do **not** recommend `localhost:5173`, Vite URLs, or `npm run dev:vite`; standard dev is **`npm run dev`** (Wrangler). Talk pages and Playwright must use **`http://127.0.0.1:8788`**.

---

## Main Applications

### Builder (`builder/`)

- Construction / project / partner workflow UI.
- **Builder AI** uses `surface=builder_ai` — **must not merge** with TASFUL AI Workspace (AD-002).
- Production Ready · RELEASE FROZEN unless Critical / Security / spec follow-up.

### Platform (root HTML/JS + marketplace)

- Listings, search, favorites, chat, checkout flows.
- **No Platform-specific LLM loop** — deterministic assist + redirect to TASFUL AI (`source=platform`, AD-003).
- Key pages: `index-top.html`, `shop-*.html`, `post.html`, `dashboard.html`, etc.

### TLV Live (`live/`)

- Viewer / streamer / studio / creator dashboard.
- **No TLV-specific AI engine** — entry via `live/tlv-tasful-ai-entry.js` → Workspace (AD-004).
- v1.0 FROZEN · payment/ops gates remain.
- Schema: `tlv` Postgres schema · see `docs/TLV_DB_SCHEMA.md`.

### TASFUL AI Workspace (`ai-workspace.html`, `ai-workspace-*.js`)

- General AI chat, voice, vision, media, settings.
- Gateway: `ai-model-gateway.js` (contract frozen per AD-005).
- Feature-complete ≠ Production Ready (prod connection tasks remain).
- Site QA: shared article component (AD-015) · `platform-qa-article.js`, `help/`.

### AI 運営秘書 (`admin-operations-dashboard.html`, secretary modules)

- Ops triage · Gmail-oriented workflows.
- **DeepSeek** via dedicated Cloudflare Function — **not** `TasuAiModelGateway` (AD-010).
- Production Ready · FROZEN.

### TALK / Connect

- `talk-home.html`, chat modules, WebRTC / push docs under `docs/talk-*`.

### Business Directory (`business-directory/`)

- Owner / admin / public flows · Stripe subscription (test/prod steps in `docs/ROADMAP.md`).
- Commercial launch **No-Go** — bugfix/docs/regression only unless explicitly approved.

### Help / Platform QA (`help/`, `platform-qa-*.js`)

- ~4,000+ generated articles from SSOT in `scripts/lib/platform-qa-catalog-*.mjs`.
- Regenerate: `node scripts/generate-platform-qa-catalog.mjs` + `node scripts/generate-help-qa-detail-pages.mjs`.
- AI answers render the **same** QA article component as detail pages (AD-015).

---

## Architecture

### High-level

```text
Browser (static HTML/CSS/JS @ Cloudflare Pages)
    │
    ├─► Supabase (Postgres · Auth · RLS · Realtime)
    ├─► Cloudflare Pages Functions (Edge APIs · webhooks · tokens)
    ├─► Stripe (Checkout · Connect · webhooks · Business Directory subs)
    └─► External AI providers (OpenAI · Gemini · DeepSeek) via Gateway or dedicated adapters
```

### AI surface separation (mandatory)

| Surface | Entry | Gateway / Provider |
| --- | --- | --- |
| TASFUL AI | `ai-workspace.html` | `ai-model-gateway.js` · OpenAI/Gemini |
| Builder AI | `builder/builder-ai.html` | `surface=builder_ai` |
| Platform | Platform pages → Workspace | `source=platform` redirect only |
| TLV | `tlv-tasful-ai-entry.js` | `source=tlv` redirect only |
| Secretary | `admin-operations-dashboard.html` | DeepSeek Function · `DEEPSEEK_API_KEY` |

**Never** unify Builder AI into TASFUL AI. **Never** add Platform/TLV-only AI engines.

### Frozen / Production Ready (AD-008)

Changes limited to **Critical · Security · spec follow-up** for:

- Builder v1.0
- Platform
- TLV v1.0
- AI Secretary v1.1

---

## Frontend

- **Stack:** Vanilla HTML, CSS, JavaScript (IIFE modules · no app-wide React/Vue).
- **Patterns:** Page-specific `*.html` + companion `*.js` / `*.css`; shared utilities in root and `shared/`.
- **Responsive:** Verify at **1280 / 768 / 390** px viewports.
- **UI principles (AD-012):** High capability via AI; simplicity via UI. Plain language. Do not complicate existing UI when adding features.
- **QA styling:** `platform-qa.css` · `ai-workspace.css` — match existing design tokens.
- **Assets:** `images/` · rank plates · help icons.

---

## Backend

There is no traditional app server. Backend logic lives in:

1. **Supabase** — schema, RLS, RPC, Edge Functions (some features).
2. **Cloudflare Pages Functions** — `deploy/cloudflare/functions/`.
3. **Client-side modules** — Supabase client calls from browser (`chat-supabase-config.js`).

**TLV payment logic** is specified in `docs/TLV_PAYMENT_ENGINE.md` (Edge Functions, idempotent webhooks, ledger/wallet separation). DDL in `db/tlv_schema.sql`.

---

## Cloudflare

- **Hosting:** Cloudflare Pages · output `deploy/cloudflare/dist`.
- **Dev:** `npm run dev` → Wrangler Pages Dev on **8788**.
- **Functions:** `deploy/cloudflare/functions/api/` (e.g. `tlv-zego-token.js`, `secretary-deepseek-chat.js`).
- **Config:** `_redirects`, `_headers`, `robots.txt` staged by `deploy/cloudflare/stage-cloudflare-pages.mjs`.
- **Secrets:** Set in Cloudflare dashboard / `.dev.vars` locally — never commit secrets.

---

## Supabase

- **Config:** `chat-supabase-config.js` (from `chat-supabase-config.example.js`).
- **Migrations / seeds:** `supabase/` directory.
- **RLS:** Required for user-facing tables; coordinate with `database-agent` patterns.
- **Build-time injection:** `TASFUL_SUPABASE_URL` + `TASFUL_SUPABASE_ANON_KEY` for `npm run build:pages`.
- **Environments:** [docs/supabase-environments.md](docs/supabase-environments.md) — Production `ddojquacsyqesrjhcvmn` · Staging `ahlxuyvhzqdqaojiywmu`.

### Supabase MCP (AI common rules — all agents)

**Cross-tool SSOT** for Cursor and any future AI agent. Operational setup: [.cursor/mcp/README.md](.cursor/mcp/README.md) · [.cursor/mcp/supabase.md](.cursor/mcp/supabase.md).

| Rule | Requirement |
| --- | --- |
| **Staging only** | Use `tasful-supabase-staging` only · project ref **`ahlxuyvhzqdqaojiywmu`** |
| **No Production MCP** | Do **not** register Production ref **`ddojquacsyqesrjhcvmn`** in MCP URLs, server names, or agent config |
| **`read_only=true`** | Keep `read_only=true` on the MCP URL at all times · do not disable |
| **Manual approval** | Every MCP tool call requires **manual approval** (Cursor: Run Mode **Allowlist** · MCP allowlist **empty** · no `Run Everything`) |
| **Allowed use** | **Investigation · verification · review · SELECT draft assistance** only (`list_tables`, `list_migrations`, `get_logs`, `search_docs`, read-only `execute_sql`) |
| **Forbidden via MCP** | Migration apply · DDL (CREATE/ALTER/DROP) · UPDATE/INSERT/DELETE · Edge deploy · any Production DB operation |
| **Production work** | **Manual review and manual execution** only (Dashboard · CLI · approved runbooks) — **never** via Supabase MCP |

**Do not change** `.cursor/mcp.json` MCP registration without an explicit, scoped task (Production MCP remains forbidden).

---

## Stripe

- Used for marketplace checkout, Connect flows, Business Directory subscriptions, and TLV coin purchases (per `docs/TLV_PAYMENT_ENGINE.md`).
- Webhooks must be **idempotent** (see `payment_provider_events` in TLV schema).
- Test vs prod keys via environment / Cloudflare secrets.
- Do not change fee/settlement flows without updating `docs/TLV_PAYMENT_ENGINE.md` and related tests.

---

## AI Services

| Concern | Location / doc |
| --- | --- |
| Gateway contract | `ai-model-gateway.js` · AD-005 |
| Model routing / plans | `ai-plan-models.js`, `ai-model-selector.js` |
| Workspace UI | `ai-workspace*.js`, `ai-workspace.html` |
| Voice / Vision | `ai-workspace-voice.js`, related modules · `docs/AI/README.md` |
| Builder AI | `docs/AI/BUILDER_AI.md` |
| Secretary (DeepSeek) | `docs/AI/SECRETARY_AI.md` · AD-010 |
| QA SSOT | `scripts/lib/platform-qa-catalog-*.mjs` · AD-015 |
| AI team rules | `docs/AI/AI_TEAM_CONSTITUTION.md` · `.cursor/agents/` |

**AI output rule (AD-006):** All surfaces produce **draft / non-final** output for contracts, billing, hiring, refunds, etc.

---

## Development Principles

1. **`docs/` is canonical** — not chat logs, not stale reports.
2. **Minimal diff** — solve the request; no drive-by refactors.
3. **Reuse existing patterns** — naming, module style, test scripts.
4. **Do not mark done without evidence** — HTTP 200 on 8788, tests, or reports.
5. **Respect ADRs** in `docs/DECISIONS.md` (especially AD-002–005, AD-007, AD-008, AD-009, AD-015).
6. **Frozen products** — touch only when task is Critical / Security / explicit spec follow-up.
7. **Future / design-only items** in `docs/TODO.md` §Future — **do not implement** unless explicitly tasked.

### Before starting work

```
docs/README.md → docs/DECISIONS.md → docs/PROJECT_STATUS.md → docs/TODO.md → relevant docs/AI/*.md
```

### Before claiming UI complete

1. `npm run dev` running · port 8788 listening.
2. Target URL returns **HTTP 200**.
3. **No console errors** (or document known issues in `docs/KNOWN_ISSUES.md`).
4. Viewports: **1280 / 768 / 390**.

### After source changes

```bash
npm run build:pages
```

If EPERM: stop dev → build → restart dev.

---

## UI Rules

- Follow **AD-012** (simple, intuitive, plain Japanese).
- Platform / TLV / Builder frozen UIs: **no cosmetic or layout changes** unless explicitly scoped.
- Screenshot comparison for visual changes: `docs/screenshots-qa-rules.md`.
- Help/QA: use shared components (`platform-qa-article.js`); do not create per-article layouts (AD-015).
- Accessibility: meaningful labels, focus order, sufficient touch targets (44px min where established).

---

## Coding Standards

- **JavaScript:** `"use strict"` IIFEs or ES modules in `scripts/`; match surrounding file style.
- **HTML:** Semantic markup · `lang="ja"` · avoid breaking existing script load order.
- **CSS:** Use existing custom properties in domain CSS files; avoid inline styles except dynamic cases.
- **SQL:** Migrations in `supabase/migrations/` with reversible notes; TLV DDL synced with `db/tlv_schema.sql`.
- **Generated files:** `platform-qa-articles.generated.js`, `help/*/index.html` — regenerate via scripts, do not hand-edit at scale.
- **Comments:** Only for non-obvious business logic; keep code self-explanatory.
- **Secrets:** Never commit `.env`, `.dev.vars`, API keys, or production credentials.

---

## Testing Policy

| Layer | How |
| --- | --- |
| **Build** | `npm run build:pages` · `npm run verify:pages-stage` |
| **Smoke** | `npm run smoke:pages` (8788) |
| **Domain tests** | `node scripts/test-*.mjs` · `node scripts/verify-*.mjs` per changed area |
| **AI regression** | e.g. `node scripts/test-tasful-ai-final-phase.mjs` |
| **TLV** | `npm run verify:tlv-finish-main-flow-smoke` |
| **Platform Live** | `npm run test:platform-live-zego-adapter-phase1` etc. |
| **Visual** | Playwright capture scripts under `scripts/capture-*.mjs` |

Report **PASS/FAIL with command output**. Do not assume green CI from a prior session.

Frozen areas: regression must stay **PASS** before merge.

---

## Git Workflow

- **Branch:** `cf-pages-deploy` is the active deployment branch for this repo.
- **Staging:** **Selective staging only** — `git add <explicit paths>` (AD-007).
- **Forbidden:** `git add -A`, `git add .` on large mixed working trees.
- **Pre-commit:** `git diff --cached --name-status` · scope check · `npm run build:pages` when static assets change.
- **Commits:** Only when the user explicitly requests; never amend pushed commits without approval.
- **Dist:** Commit source + mirrored `deploy/cloudflare/dist` files that belong to the change set — not the entire dist tree blindly.

See `.cursor/rules/git.mdc` for staging examples and AI regression commands.

---

## PR Rules

1. **Small, reviewable scope** — one product or one concern per PR when possible.
2. **Description must cite:** what changed, why, AD compliance, test commands run, 8788 verification result.
3. **No unrelated files** — reports scratch, probe JSON, unrelated Builder HTML.
4. **Frozen product changes** require explicit justification (Critical / Security / spec).
5. **Gateway / payment / RLS changes** need security review mindset and doc updates.
6. **Docs changes** that alter status must update `PROJECT_STATUS.md` / `TODO.md` / `CHANGELOG.md` as appropriate (`docs.mdc`).

Use `gh pr create` with Summary + Test plan sections when opening PRs.

---

## Security Guidelines

- **RLS** on all user data tables; test policies, not just schema.
- **Auth:** Supabase JWT; respect row ownership in queries.
- **Edge Functions:** Validate inputs · rate-limit where applicable · no secret leakage in responses.
- **Stripe webhooks:** Verify signatures · idempotent processing.
- **AI:** No auto-commitment on legal/financial actions (AD-006); disclaimer patterns via `common-ai-disclaimer.js`.
- **XSS:** Escape user content in HTML builders (`escapeHtml` patterns in `platform-qa-article.js` etc.).
- **Dependencies:** Do not add heavy packages without justification; prefer zero-build static approach.
- **Production secrets:** Cloudflare / Supabase dashboards only — not git.

---

## Agent Responsibilities

This repository is worked on by **three coordinator roles**. Stay in lane; hand off when crossing layers.

### Cursor — UI · layout · front-end polish

**Owns:**

- HTML / CSS / responsive layout · visual bugs
- Component spacing, typography, breakpoints (390 / 768 / 1280)
- Help/QA presentation within existing `platform-qa-*` components
- Playwright screenshots and 8788 manual verification
- Minimal JS only when required for UI behavior in scope

**Does not own:**

- Supabase migrations · RLS · Stripe webhooks
- Cloudflare Function logic · Gateway contract changes
- Large refactors · cross-product architecture changes

**Also uses:** `.cursor/agents/ux-ui-agent`, `qa-agent`, `platform-agent`, `builder-agent`, `tlv-agent`, `tasful-ai-agent` for scoped sub-tasks.

### Jules — backend · infra · APIs · tests · docs · PRs

**Owns:**

- Cloudflare Pages Functions · Wrangler · deploy scripts
- Supabase schema, migrations, RLS, Edge integration
- Stripe checkout/webhook/subscription flows
- `scripts/test-*.mjs` · `scripts/verify-*.mjs` · CI-related fixes
- Refactoring **within assigned scope**
- Documentation updates in `docs/` and `reports/` when implementation changes
- Selective git staging, commit messages, PR creation **when asked**

**Does not own:**

- Drive-by UI redesigns on frozen products
- Breaking `ai-model-gateway.js` without ADR
- `git add -A` or force-push to main

**Also uses:** `.cursor/agents/database-agent`, `devops-infra-agent`, `api-integration-agent`, `ci-agent`, `release-agent`, `docs-agent`.

### ChatGPT — design review · planning · prompts · architecture

**Owns:**

- Task decomposition and acceptance criteria
- Architecture decision proposals (draft ADRs for `docs/DECISIONS.md`)
- Prompt / routing quality reviews
- Cross-product design review before implementation
- Clarifying frozen vs active scope with references to `docs/TODO.md`

**Does not own:**

- Direct code commits or unreviewed production changes
- Overriding AD-002–005 without explicit human approval

**Also uses:** `.cursor/agents/architecture-agent`, `product-agent`, `prompt-ai-agent`, `review-agent` (readonly).

---

## Cursor Sub-Agents (reference)

For fine-grained tasks inside Cursor, 19 sub-agents are defined in `.cursor/agents/`. Summary:

| Type | Agents |
| --- | --- |
| **Service** | architecture, builder, platform, tlv, secretary, tasful-ai, qa, review, release |
| **Cross-cutting** | docs, security, performance, database, ci, product, prompt-ai, ux-ui, api-integration, devops-infra |

Constitution: `docs/AI/AI_TEAM_CONSTITUTION.md`.

`AGENTS.md` (this file) takes precedence for **cross-tool** agent behavior; `.cursor/agents/*.md` specialize Cursor sub-tasks.

---

## Quick Reference Commands

```bash
npm install
npm run build:pages          # Stage deploy/cloudflare/dist
npm run dev                  # http://127.0.0.1:8788
npm run smoke:pages          # Smoke on 8788

# QA catalog regeneration
node scripts/generate-platform-qa-catalog.mjs
node scripts/generate-help-qa-detail-pages.mjs

# Example regressions (run what matches your change)
node scripts/test-tasful-ai-final-phase.mjs
npm run verify:tlv-finish-main-flow-smoke
npm run test:platform-live-zego-adapter-phase1
```

---

## Document Index (agents must read)

| Priority | File |
| --- | --- |
| 1 | `docs/README.md` |
| 2 | `docs/DECISIONS.md` |
| 3 | `docs/PROJECT_STATUS.md` |
| 4 | `docs/TODO.md` |
| 5 | `docs/ROADMAP.md` |
| 6 | `docs/local-dev.md` |
| 7 | `docs/KNOWN_ISSUES.md` |
| TLV | `docs/TLV_DB_SCHEMA.md`, `docs/TLV_PAYMENT_ENGINE.md`, `db/tlv_schema.sql` |
| AI | `docs/AI/README.md` + product file |
| QA | `docs/AI/TASFUL_AI_QA.md` (AD-015) |

**Not required:** `docs/TLV_PRD.md` (file absent — use TLV docs above).

---

*When this file conflicts with older chat instructions, **this file and `docs/` win**.*
