# Platform Request P5-7b — Builder Candidate E2E

**Date:** 2026-07-05
**Staging ref:** `ahlxuyvhzqdqaojiywmu`（のみ）
**判定:** **Go**

---

## 使用ユーザー

| 役割 | email | uid |
| --- | --- | --- |
| 依頼者 (owner) | talk-rls-a@tasful-dev.test | 41084f45-85b0-47e5-a46f-25b327988748 |
| Builder Candidate | e2e-test@example.com | bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40 |
| 第三者 (unrelated) | talk-rls-b@tasful-dev.test | 95e8e2b9-8a32-4c01-a0c8-3bf020d5d47c |

**Builder partner:** `demo-partner-e2e-p05` · id `a1000000-0000-4000-8000-000000000004` · owner_auth_uid → candidate

## Request

| 項目 | 値 |
| --- | --- |
| id | c09fc427-56a3-4b93-8ff1-54a18f7d0479 |
| owner_id | 41084f45-85b0-47e5-a46f-25b327988748 |
| status | open |
| title | P5-7b Builder E2E 1783234849826 |

## Match

| 項目 | 値 |
| --- | --- |
| sync 経路 | edge:/api/platform-request-match-sync |
| match id | 925a68ce-1656-437d-8767-0ad266b79a8f |
| candidate_type | builder_partner |
| candidate_id | a1000000-0000-4000-8000-000000000004 |
| candidate_user_id | bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40 |
| match_score | 91 |
| duplicate prevented | PASS |

## RLS

| 主体 | 期待 | 結果 |
| --- | --- | --- |
| owner | 自依頼 matches 閲覧可 | PASS |
| candidate | 自分宛 matches 閲覧可 | PASS |
| unrelated | 0 件 | PASS (0 rows) |
| anon | 0 件 | PASS (0 rows) |

## UI（8788）

| 画面 | 確認 | 結果 |
| --- | --- | --- |
| owner 依頼投稿 | request 作成 | PASS |
| candidate 一覧 | あなた宛のマッチ | PASS (24 items) |
| owner 詳細 | Supabase matches 優先 | PASS (1 cards · DB priority) |

## HTTP / Console

| 項目 | 値 |
| --- | --- |
| HTTP Status | 200 / 200 |
| Console Error | **0** |

## 回帰

| スクリプト | 結果 |
| --- | --- |
| P5-6 platform_requests CRUD | PASS |
| P5-7 matches CRUD | PASS |

## Go / No-Go

**Go** — Builder Candidate E2E（Staging）

P5-8（通知）は本判定では未着手。
