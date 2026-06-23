# TASFUL MATCH Core E2E — Live Integration Report

**Date:** 2026-06-22  
**Scope:** Swipe → mutual like → `match_pairs` → list → message → TALK room

## Summary

Core MATCH E2E is wired for **edge/live** mode while **client_stub** remains the default for local UI.

| Step | Edge function | UI wiring |
|------|---------------|-----------|
| Record swipe | `match-record-swipe` | `match-wiring.js` → `TasfulMatchAPI.recordSwipe` |
| Create pair (mutual like) | `_shared/match-core.ts` → service_role INSERT | Returns `matched` + `pair_id` |
| List pairs | `match-list-pairs` | `match-core-wiring.js` → `listPairs` |
| Open TALK | `match-ensure-talk-room` (existing) | `match-talk-bridge.html` CTA |

## Architecture

```
match-swipe.html
  └─ like → match-record-swipe (live)
       └─ mutual like → match_pairs INSERT
            └─ redirect match-talk-bridge.html?pair_id=…

match-list.html
  └─ edge_stub → match-list-pairs
       └─ renderPairListPage → メッセージする → match-ensure-talk-room → chat-detail.html
```

- **No chat in MATCH** — messaging only via TASFUL TALK (`transaction_rooms`).
- **client_stub:** `recordSwipe` / `listPairs` return mock success; stub data from `match-data-stub.js`.
- **edge_stub:** Real JWT + `__MATCH_FUNCTIONS_BASE__` → live Edge handlers.

## Files

| File | Role |
|------|------|
| `supabase/functions/_shared/match-core.ts` | `recordSwipeLive`, `listPairsLive` |
| `supabase/functions/match-record-swipe/index.ts` | Swipe endpoint (stub fallback) |
| `supabase/functions/match-list-pairs/index.ts` | Pair list endpoint |
| `match/match-api.js` | `listPairs`, `recordSwipe` edge paths |
| `match/match-core-wiring.js` | Live list fetch on `match-list.html` |
| `match/match-wiring.js` | Matched → talk-bridge redirect |
| `match/match-data-render.js` | `renderPairListPage` (shared stub/live) |

## Smoke

```bash
node scripts/smoke-match-core-e2e.mjs
node scripts/test-match-local-edge-smoke.mjs   # includes local Deno router
node scripts/smoke-match-core-e2e.mjs --live --functions-base https://<ref>.supabase.co/functions/v1
```

## Deploy checklist

1. Deploy Edge functions: `match-record-swipe`, `match-list-pairs` (plus existing `match-ensure-talk-room`).
2. Ensure env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Frontend: set `__MATCH_FUNCTIONS_BASE__` + real JWT (`edge_stub` mode).
4. Verify T1↔T2 mutual like on linked ref creates `match_pairs` and list shows partner.

## Security notes

- Swipes INSERT via user JWT (RLS on `match_swipes`).
- Pair creation via **service_role** only after mutual like validation.
- Block check via `match_users_are_blocked` RPC before swipe.
- List SELECT via RLS (participant rows only); partner nicknames via service_role read.
