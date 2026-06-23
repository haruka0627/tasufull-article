# TASFUL MATCH — Feed Live Integration Report

**Date:** 2026-06-22  
**Ref:** `ddojquacsyqesrjhcvmn`  
**Verdict:** **PASS** (41/41)

## Photo URL policy

バケット `match-profile-photos` は **private**。Edge `match-search-profiles` は **期限付き signed URL（1h）** のみ返却。public URL は使わない。

## Filter TODOs (swipe UI)

- オンライン中のみ（`online_only`）— swipe 画面にトグルなし・Edge 未対応
- 相性スコア順 — swipe は recommended/newest/online のみ（online は created_at 代理）
- 趣味タグ複数 AND — API は OR マッチ（いずれか一致）

## Commands

```bash
node scripts/verify-match-feed-live.mjs
npx supabase functions deploy match-search-profiles --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

## Summary

Feed live Edge + UI smoke passed on linked ref test users.

| Section | Step | Result | Detail |
|---------|------|--------|--------|
| Deploy | skipped | PASS | --skip-deploy |
| Auth | T1/T2/T3 login | PASS | ok |
| Prep | profiles + cleanup t1↔t2 | PASS | ok |
| Security | anon 401 | PASS | 401 |
| Security | stub token empty feed | PASS | items=0 |
| Feed | T1 200 ok | PASS | total=2 |
| Feed | exclude self | PASS | t1 absent |
| Feed | T1 sees T2 | PASS | present |
| Feed | T2 feed | PASS | items=2 |
| Feed | T3 feed | PASS | items=2 |
| Feed | zero results ok | PASS | age filter 99 |
| Feed | hobby_tags field | PASS | 0 |
| Feed | photo URL shape | PASS | none |
| Feed | activity_label | PASS | しばらく未活動 |
| Feed | exclude swiped | PASS | t2 absent |
| Feed | pair setup | PASS | 2a829ff3 |
| Feed | exclude paired | PASS | t2 absent |
| Feed | exclude blocked | PASS | t2 absent |
| UI | 390×844 edge_stub | PASS | edge_stub |
| UI | 390×844 MatchFeedWiring | PASS | loaded |
| UI | 390×844 console | PASS | 0 errors |
| UI | 390×844 feed state | PASS | card |
| UI | 390×667 edge_stub | PASS | edge_stub |
| UI | 390×667 MatchFeedWiring | PASS | loaded |
| UI | 390×667 console | PASS | 0 errors |
| UI | 390×667 feed state | PASS | card |
| UI | 393×852 edge_stub | PASS | edge_stub |
| UI | 393×852 MatchFeedWiring | PASS | loaded |
| UI | 393×852 console | PASS | 0 errors |
| UI | 393×852 feed state | PASS | card |
| UI | 768×1024 edge_stub | PASS | edge_stub |
| UI | 768×1024 MatchFeedWiring | PASS | loaded |
| UI | 768×1024 console | PASS | 0 errors |
| UI | 768×1024 feed state | PASS | card |
| UI | 1280×900 edge_stub | PASS | edge_stub |
| UI | 1280×900 MatchFeedWiring | PASS | loaded |
| UI | 1280×900 console | PASS | 0 errors |
| UI | 1280×900 feed state | PASS | card |
| Smoke | client_stub default | PASS | client_stub |
| Smoke | stub swipe profiles | PASS | 3 |
| Smoke | client_stub console | PASS | 0 errors |
