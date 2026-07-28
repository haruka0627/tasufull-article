Base: https://341246f1.tasufull-article.pages.dev
Staging ref: ahlxuyvhzqdqaojiywmu

0) Warm API
  ✓ API warm status 401

1) Provision Staging users
  ✓ ops + member users created and logged in

2) Authorization matrix
  ✓ unauthenticated → 401 (22ms)
  ✓ member → 403 (58ms)
  ✓ operator list → 200 (118ms)
  ✓ operator summary → 200 (105ms)

3) Method allowlist
  ✓ POST → 405 (19ms)
  ✓ PUT → 405 (20ms)
  ✓ PATCH → 405 (18ms)
  ✓ DELETE → 405 (17ms)
  ✓ OPTIONS → 204
  ✓ HEAD handled (405)

4) Query validation
  ✓ invalid filter → 400
  ✓ invalid sort → 400
  ✓ oversized limit → 400
  ✓ unknown proposal → 404

5) Cache / secrets
  ✓ Cache-Control: no-store
  ✓ response has no secret literals

6) Production isolation smoke
  ✓ Production host blocked/absent (200 non-json)

7) Playwright UI (desktop + mobile)
  ✓ desktop page HTTP 200
  ✓ desktop badges present
  ✓ desktop browser operator API summary 200
  ✓ desktop UI interactive (データがありません。)
  ✓ desktop no Approve/Apply buttons
  ✓ desktop filter keeps raw text (no HTML exec)
  ✓ desktop pagination controls present
  ✓ mobile page HTTP 200
  ✓ mobile badges present
  ✓ mobile browser operator API summary 200
  ✓ mobile UI interactive (データがありません。)
  ✓ mobile no Approve/Apply buttons
  ✓ mobile filter keeps raw text (no HTML exec)
  ✓ mobile pagination controls present

8) Timeline endpoint
  ✓ timeline path responds (404, 182ms)

9) Cleanup users
  ✓ ephemeral users deleted

RESULT pass=35 fail=0
PASS operator read-only E2E
