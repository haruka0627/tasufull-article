# TALK Voice Phase 2 — Self-hosted WebRTC + coturn Staging Foundation

**Date:** 2026-07-26  
**Start HEAD:** `cbbad84726eb708912c70598dad70d57e1ab9b12`  
**Verdict:** **BLOCKED** — code/config foundation is implemented, but real Staging
coturn UDP/TCP/TLS 443 and the Staging DB migration were not safely available.

## Architecture

Current signaling remains Supabase Postgres + Realtime. SDP/ICE are rows in
`talk_call_signals`; audio is never relayed by Supabase. The browser prefers
P2P and requests short-lived TURN REST credentials only when the non-Production
feature flag is enabled.

```text
Supabase JWT
  -> Pages Function /api/talk-voice-turn-credentials
  -> talk_call_sessions participant
  -> transaction_rooms buyer/seller participant
  -> HMAC-SHA1 TURN REST credential (20 minutes, max 30 minutes)
  -> STUN / TURN UDP / TURN TCP / TURN TLS 443
  -> RTCPeerConnection (iceTransportPolicy=all; relay only in internal test)
```

Production builds force the three Phase 2 client flags to `false`. No Provider
switch, Production deploy, Production DB access, Stripe operation, or push was
performed.

## Phase 1 migration audit

Target was confirmed by `supabase projects list` as `tasful-staging`,
project ref `ahlxuyvhzqdqaojiywmu`, Tokyo. Production ref
`ddojquacsyqesrjhcvmn` was not accessed.

`sql/talk-voice-phase1-session-usage.sql` is additive. The only `NOT NULL`
addition is `provider`, with a compatible default of `webrtc`; existing rows
are backfilled by PostgreSQL. Other columns are nullable. It adds no index,
unique constraint, RLS policy, service-role dependency, or destructive DDL.
Column rollback is possible but would discard newly recorded usage values.

The migration was **not applied**. `supabase db push --dry-run` showed an older
unrelated migration (`20260705120000_builder_general_jobs_p3_withdraw_staging.sql`)
must be inserted with `--include-all`. Applying unrelated pending migrations
would violate this phase's allowlist. No DB password or dedicated single-file
remote execution path was available.

Existing `talk_call_sessions` RLS allows participants to update all columns,
which is insufficient for authoritative duration. The separate, unapplied
`sql/talk-voice-phase2-security-telemetry.sql` adds server triggers for immutable
participants, server timestamps/duration, double-call locking, signal
type/size/target/status/rate checks, expiry, and PII-minimized telemetry.

## Security and credential issuance

- Shared JWT helper is reused; decode-only auth is not used.
- Missing/invalid JWT stops before DB access.
- Supabase Auth failure returns 503.
- Identity uses verified `talk_user_id` metadata, falling back to JWT subject.
- Session and canonical `transaction_rooms` participation are both required.
- Inactive/ended sessions are rejected.
- Credentials are bound to expiry, session UUID, and TALK user ID.
- TTL defaults to 1,200 seconds and is capped at 1,800 seconds.
- Six credentials per user/session/minute are allowed per isolate. A durable
  distributed limiter remains required before controlled release.
- The shared secret, SDP, full ICE candidate, and IP addresses are not logged or
  returned. The short-lived TURN credential is returned as required by WebRTC.
- Static browser TURN credentials are disabled outside internal diagnostics.

## coturn

Examples:

- `config/coturn/tasful-talk-turnserver.example.conf`
- `config/coturn/docker-compose.staging.example.yml`
- `config/coturn/README.md`

The example enables 3478 UDP/TCP, 5349 TLS, TLS fallback 443, a bounded relay
range, REST shared-secret auth, fingerprint, stale nonce, quotas, TLS 1.0/1.1
disablement, and private/loopback/link-local/multicast peer denial. It contains
no real hostname, secret, certificate, or private key.

No coturn binary, Docker engine, WSL distribution, TURN hostname, shared secret,
or certificate was available on this workstation. Therefore anonymous/open
relay tests and real UDP/TCP/TLS allocations are **not validated**.

`npm run build:pages` was not run because this repository has a large,
pre-existing mixed source/dist working tree and the build copies every source
area into `deploy/cloudflare/dist`. Running it would overwrite unrelated dirty
dist paths, contrary to this phase's allowlist. A clean worktree is required for
the canonical source+dist build verification.

The existing 8788 server returned the TALK page successfully at 768px with no
horizontal overflow, but it served the pre-Phase-2 dist mirror:
`TasuTalkVoiceTelemetry=false` and `TasuTalkCallTurnClient=false`. Therefore
8788 verification of the new modules is BLOCKED until a clean canonical build.

## Route, quality, reconnect, and cost telemetry

`getStats()` normalization records only route class, candidate types, protocol,
relay protocol, network type, RTT, available bitrate, packet loss, jitter,
audio bytes, codec, and connect time. Candidate IP addresses are excluded.
Routes are `p2p_host`, `p2p_srflx`, `turn_udp`, `turn_tcp`, `turn_tls`, or
`unknown`.

A two-independent-BrowserContext fixture established a host/host UDP P2P
connection, observed one remote audio track in each direction, obtained the
selected candidate pair, and completed ICE restart. This proves the browser
network fixture, not the full authenticated Supabase product flow.

Cost aggregation accepts configuration rather than hard-coded prices:

```text
variable cost = measured TURN bytes / 1,000,000,000 * turn_egress_cost_per_gb
fixed cost = turn_server_monthly_cost + signaling_monthly_cost + monitoring_monthly_cost
```

No real TURN bytes or approved price inputs exist, so estimates for 1,000 /
10,000 / 100,000 / 1,000,000 call-hours are **N/A**, not zero.

## Test evidence

- TURN credential security: PASS
- Coturn config static security: PASS
- Route/stats/cost unit: PASS
- Strict two-context P2P host/UDP, bidirectional audio, selected pair: PASS
- ICE restart: PASS
- TALK Voice Core: 32/32 PASS
- WebRTC adapter: 8/8 PASS
- TALK turn-config: PASS
- Desktop/mobile browser smoke: PASS, no severe console errors
- Phase 3-A auth guards: 34/34 PASS
- ZEGO adapter: 77/77 PASS
- TASFUL AI: 31/31 PASS
- Platform Finish: 38/38 PASS
- Platform Next: 37/37 PASS

## Required completion status (1–99)

1. Verdict: BLOCKED
2. Git start HEAD: `cbbad847...`
3. Git end HEAD: see final handoff
4. Migration target: confirmed Staging `ahlxuyvhzqdqaojiywmu`
5. Migration result: not applied; unrelated migration ordering blocker
6. RLS: static audit complete; Phase 2 policy not applied
7. Signaling SSOT: Supabase Postgres + Realtime
8. Signaling transport: HTTPS PostgREST writes + Realtime change feed
9. JWT: PASS for TURN endpoint
10. Thread participant: PASS for TURN endpoint
11. Signal participant: existing RLS; strengthened SQL unapplied
12. Signal rate limit: SQL draft 180/min; unapplied
13. coturn version: unavailable
14. Deployment: example only
15. STUN UDP: config PASS; external allocation not run
16. TURN UDP: BLOCKED
17. TURN TCP: BLOCKED
18. TURN TLS: BLOCKED
19. TURN TLS 443: BLOCKED
20. Relay ports: example 49160–49260
21. Open relay: config denial only; runtime BLOCKED
22. Private relay: config denial only; runtime BLOCKED
23. Credential: TURN REST HMAC-SHA1
24. TTL: 1,200 sec default; 1,800 sec cap
25. Session binding: PASS
26. Credential rate limit: PASS per isolate; distributed follow-up
27. Secret exposure: none found
28. ICE config: STUN/P2P then UDP/TCP/TLS
29. Feature flags: Production forced false
30. P2P E2E: browser network fixture PASS; full product strict flow pending
31. TURN UDP E2E: BLOCKED
32. TURN TCP E2E: BLOCKED
33. TURN TLS E2E: BLOCKED
34. Browser contexts: two independent contexts PASS
35. Bidirectional audio tracks: PASS
36. Selected candidate pair: PASS
37. Route: `p2p_host`
38. Connect time: supported; fixture not retained as benchmark
39. RTT: supported
40. Jitter: supported
41. Packet loss: supported
42. Reconnect: state path present; network-switch test pending
43. ICE restart: PASS fixture
44. Network failure: not run
45. TURN failure: client fallback/error mapping implemented; runtime not run
46. Cleanup: fixture PCs/contexts closed; browser smoke PASS
47. Duration: server-trigger design; migration unapplied
48. Heartbeat: Phase 1 regression PASS
49. Session end: Phase 1 regression PASS
50. Stats persistence: schema/client path implemented; DB unapplied
51. P2P time: schema aggregation supported; no Staging sample
52. TURN time: no sample
53. TURN bytes: no sample
54. P2P success rate: fixture 1/1; not production-representative
55. TURN rate: N/A
56. Estimated 1,000 hours: N/A
57. Estimated 10,000 hours: N/A
58. Estimated 100,000 hours: N/A
59. Estimated 1,000,000 hours: N/A
60. Estimate assumptions: require measured bitrate/TURN rate and approved costs
61. Desktop: PASS smoke
62. Mobile: PASS Chrome emulation
63. Chrome: PASS
64. Edge: Chromium compatibility only
65. WebKit: not run; Safari/iOS unverified
66. Microphone denied: adapter regression PASS
67. Double call: DB trigger draft; unapplied
68. Multiple tabs: not run
69. Console errors: none severe in TALK smoke
70. TALK Phase 1: PASS
71. turn-config: PASS
72. ZEGO: 77/77 PASS
73. Phase 3-A: 34/34 PASS
74. AI Workspace: 31/31 PASS
75. Platform: 38/38 + 37/37 PASS
76. SQL: Phase 2 separate file added
77. Migration: not applied
78. Config examples: added
79. Secrets: none committed
80. Certificate: example path only; real certificate unavailable
81. Production contact: none
82. Production DB: none
83. Stripe: none
84. Deploy: not performed
85. Push: not performed
86. Commits: see final handoff
87. Stage: selective only
88. Modified files: scoped TALK/Pages build auth/config files only
89. New files: TURN API/client, telemetry, tests, SQL, coturn examples
90. Report: this file
91. SPOF: one TURN node, Supabase Realtime, per-isolate limiter
92. Redundancy: Tokyo primary + Osaka secondary design
93. Rollback: disable flags; revert unapplied SQL/code; P2P remains
94. Production switch: requires all BLOCKED items and security review
95. Remaining blockers: Staging SQL, real coturn, TLS 443, full product E2E
96. REL-P0: unchanged
97. Git status: see final handoff
98. Git diff stat: see final handoff
99. Next phase: provision controlled Staging TURN/DB and rerun strict matrix

## Production switch conditions

Apply both migrations through an allowlisted Staging path; verify RLS and
trigger behavior with two real users; deploy a pinned coturn version and valid
certificate; pass anonymous/private/open-relay probes; pass UDP/TCP/TLS 443
forced relay with selected relay pairs; validate distributed rate limiting,
network switching, Safari/iOS, monitoring, and rollback. Production remains OFF.
