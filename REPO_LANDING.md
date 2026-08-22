# HG-01 Phase0 landing / restore status

Updated: 2026-08-23 05:06 JST

## FINAL_TIP restore

| path | restored | sha256 prefix | notes |
|------|----------|---------------|-------|
| chat-supabase.js | NO (PLACEHOLDER_LOADING_FROM_TIP) | expected a214623399819cb7 | tip body MCP push pending; valid zlib staged |
| chat-service.js | NO (stale) | expected 22b4bd619e76c9ed | tip bytes local; zlib parts on remote OK |
| `_hg01_restore/chat-supabase.js.zlib.b64` | YES | decompress -> a214623399819cb7 | size 15276 restored |

## Human / CloudAgent apply (from zlib)

Decode `_hg01_restore/chat-supabase.js.zlib.b64` with zlib+base64 into `chat-supabase.js`.
For `chat-service.js`, concat `_hg01_restore/chat-service.js.zlib.b64.part1` + `.part2` then zlib+base64 decode.
Or push local commit f851e1f from /tmp/tasufull-article (already has both tips).

## Phase gates

- Phase A OMIT: done
- Phase B: STOP — Staging SQL Editor still required (do not apply from agent)

PR: https://github.com/haruka0627/tasufull-article/pull/25
