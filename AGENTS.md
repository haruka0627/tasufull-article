# Project Overview

TASFUL is a multi-application web platform built primarily with HTML, CSS, JavaScript, Cloudflare, and Supabase.

This repository is one component of the overall TASFUL ecosystem.

This document is an AI Agent Operational Guide to help AI agents understand how to safely contribute to the repository.

# Before Making Changes (Checklist)

1. Check current project status in `docs/PROJECT_STATUS.md`.
2. Review the task in `docs/TODO.md`.
3. Check `docs/DECISIONS.md` for architectural constraints.
4. Read the relevant source files before starting implementation.
5. Search the codebase for similar implementations to reuse components or patterns.

# Source of Truth

Do not guess project status or technical decisions. Read the existing documentation before making changes:

- `README.md`: Basic setup and quickstart.
- `docs/PROJECT_STATUS.md`: Current project status, recent commits, and completion state.
- `docs/TODO.md`: Next tasks and roadmap.
- `docs/DECISIONS.md`: Architectural and technical decisions.
- Other relevant documents under `docs/`.

# Repository Structure

High-level overview of key directories:

- `docs/`: Project documentation.
- `supabase/`: Database migrations, seed data, and Edge Functions.
- `scripts/`: Testing and utility scripts.
- `deploy/`: Deployment configurations and manifests.

*Note: General frontend files are located at the root or within specific module directories. Do not generate a complete repository map.*

# Development Principles

- **Minimal changes**: Only modify what is strictly necessary to accomplish the task.
- **Preserve existing architecture**: Do not introduce new frameworks or patterns unless explicitly instructed.
- **Backward compatibility**: Ensure changes do not break existing features.
- **Avoid unnecessary refactoring**: Do not rewrite working code.
- **Reuse existing components**: Leverage existing UI components and utility functions.
- **Documentation first**: Update relevant documentation when adding or changing features.
- **Verify before changing**: Read and understand the code before modifying it.

# Agent Boundaries

- Only operate within the specific domain assigned to your task.
- Do not attempt to re-engineer core systems (e.g., Auth, Payments) unless explicitly directed.
- Escalate ambiguities to the human developer rather than making assumptions.
- Do not mix frontend UI design updates with backend logic rewrites.

# Change Scope

- Do not implement unauthorized side-features.
- Avoid bundling unrelated changes or formatting fixes into a single PR.
- Stop and confirm if a seemingly small task requires extensive restructuring.
- Keep modifications strictly limited to the files necessary to satisfy the requirements.

# Completion Report

- Confirm that the initial requirements were fully met.
- List the files that were modified.
- Outline the specific tests and verifications performed.
- Clearly state any remaining issues, unhandled edge cases, or assumptions made during development.

# UI Rules

- **Reference-first implementation**: Prioritize copying existing patterns and components over writing from scratch.
- **Match approved screenshots**: Ensure visual implementation closely matches any provided design references before making customizations.
- **Responsive-first**: Design UI for Desktop (1280px), Tablet (768px), and Mobile (390px) views by default.
- **Preserve existing design language**: Stick to established color palettes, spacing, and typography.
- **Avoid unnecessary CSS rewrites**: Do not rewrite large chunks of CSS or restructure classes unless specifically required. Maintain consistency with existing CSS and layout structures.

# Coding Standards

- **Naming**: Follow existing naming conventions in the codebase.
- **Folder structure**: Respect the current file organization.
- **Component reuse**: Prefer using existing implementations over creating new ones.
- **Avoid duplication**: Keep code DRY but not at the cost of readability or stability.

# Testing

Ensure your changes do not cause regressions.
- **Build verification**: Always ensure the build passes (`npm run build:pages`) when appropriate.
- **Viewport coverage**: Verify UI changes on Desktop (1280px), Tablet (768px), and Mobile (390px).
- **Console errors = 0**: Ensure the browser console is free of errors or warnings after changes.
- **Run relevant regression tests**: Example commands include `node scripts/test-*.mjs`.
- Do not require every test on every small change, but ensure critical paths remain functional.

# Git Workflow

- Base all development on the `cf-pages-deploy` branch.
- Jules temporary branches are expected.
- Prefer descriptive branch names:
  - `feat/*`
  - `fix/*`
  - `docs/*`
  - `chore/*`
- **Small focused commits**: Keep commits atomic and related to a single logical change.
- **Avoid unrelated changes**: Do not bundle whitespace formatting or unrelated refactoring with feature work.
- **Keep PRs easy to review**: Ensure PRs are descriptive. Pull Requests should include:
  - Summary
  - Files changed
  - Tests executed
  - Risks
  - UI screenshots (when applicable)

# Security

- **Never** commit secrets, tokens, or credentials.
- Respect Supabase RLS (Row Level Security) and database access boundaries.
- **Never** expose `service_role` keys.
- Preserve authentication, authorization, payment, and webhook security logic.
- Follow least-privilege principles.

# AI Agent Responsibilities

**Cursor**
- UI, HTML, CSS, JavaScript event binding
- Responsive design and Layout across breakpoints
- Visual fixes, animations, and CSS architecture
- Implementing provided designs faithfully

**Jules**
- Backend, API, Data fetching logic
- Cloudflare Pages/Workers integration and edge logic
- Supabase queries, edge functions, and RLS policies
- Stripe integration and payment logic
- Creating regression tests and maintaining documentation
- Codebase refactoring (only when explicitly requested)

**ChatGPT**
- Architecture review and technical sounding board
- Task decomposition and planning
- Design review and logic validation
- Prompt creation for other agents
- Technical decision support and debugging strategies

**Claude Code / Gemini CLI / Future AI Agents**
- Follow the same development rules described in this document.
- Operate within the domain assigned by the human developer, respecting boundaries between frontend UI and backend logic.

# General AI Rules

- **Read documentation first**: Check `docs/` before writing code.
- **Inspect existing implementation**: Understand how similar features work before implementing a new one.
- **Make the smallest possible change**: Favor surgical edits over sweeping rewrites.
- **Preserve backward compatibility**: Ensure older modules remain functional.
- **Never rewrite unrelated code**: Do not "clean up" files or functions unless authorized.
- **Verify before claiming completion**: Do not describe unimplemented features as implemented.
- **Clearly report assumptions**: If documentation and implementation differ, or if requirements are ambiguous, report the difference or ask for clarification instead of guessing.
- Never invent missing functionality.
