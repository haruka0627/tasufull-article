# ANPI Phase 14 — TALK Staging Privilege Hardening + Identity and Retention Closure

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.


Date: 2026-07-27  
Final verdict: **Privilege Hardening APPLIED (PASS) · Identity Mapping MISMATCH CONFIRMED (blocker) · Retention DECIDED · Regression 21/21 PASS · Real INSERT NO-GO**

## Scope

実施:

1. 14-A: privilege provenance audit（catalog 証明）
2. 14-B: additive hardening SQL + rollback + static + local disposable 検証
3. staging 適用（tx）+ postcheck
4. 14-C: identity mapping の staging 実データ検証（read-only aggregates）
5. 14-D: retention 方針 + cleanup 境界確定
6. Phase 2–13 full regression
7. Real INSERT enablement 前の最終基盤監査（Phase 11 audit 再実行）

未実施（禁止）:

- Real INSERT / notification row 作成
- Realtime publication 変更 / Push trigger
- production 接続・変更 / deploy / commit / push
- TRUNCATE / DELETE / DROP の実行 / schema 再設計 / client 変更

## 14-A: Privilege provenance audit（証明済み）

Artifact: `reports/_anpi-phase14-hardening/provenance-result.json.txt`

**結論: residual は explicit GRANT ではなく Supabase default privileges 由来。**

| Evidence | Value |
| --- | --- |
| `pg_default_acl` (role=postgres, schema=public, objtype=r) | `{postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm}` |
| `relacl`（hardening 前） | `{postgres=arwdDxtm/postgres, authenticated=arwdDxtm/postgres, service_role=arwdDxtm/postgres}` |
| table owner | `postgres` |
| grantor（全行） | `postgres` |
| is_grantable | authenticated/service_role = NO · postgres(owner) = YES |
| anon | **権限なし**（Phase 12 の `revoke all from anon/public` が有効） |
| role inheritance | `authenticator` NOINHERIT → anon/authenticated/service_role · `postgres` は各ロールのメンバー |
| schema `public` ACL | USAGE のみ（anon/authenticated/service_role） |

**因果:** `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL`（Supabase 標準）により、Phase 12 の `CREATE TABLE` 時点で authenticated へ `arwdDxtm`（ALL）が付与。Phase 12 SQL は anon/public のみ REVOKE し authenticated の residual を除去しなかった。Phase 12 の `GRANT SELECT, UPDATE` は既存 ALL への no-op。**Phase 12 SQL 由来の新規付与ではなく、既存環境（default ACL）由来。**

## 14-B: Hardening package

Files:

- `sql/anpi-phase14-talk-staging-privilege-hardening.sql` — REVOKE `INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER` from authenticated + defensive anon/public revoke + no-op re-assert grants + sanity SELECT
- `sql/anpi-phase14-talk-staging-privilege-hardening-rollback.sql` — 観測済み pre-state（authenticated ALL）のみ復元
- `scripts/test-anpi-phase14-talk-staging-privilege-hardening.mjs` — static **8/8 PASS**
- `scripts/verify-anpi-phase14-talk-staging-privilege-hardening-local.mjs` — local **PASS**

Static 証明: REVOKE / narrow GRANT / sanity SELECT のみ。DDL・data DML・publication・trigger・policy 変更なし。authenticated/anon/public への write 付与なし。

Local disposable 検証（`supabase_db_tasufull-article` のみ）: staging pre-state を再現 → hardening → `SELECT,UPDATE` のみ · idempotent · policies/RLS/realtime 不変 · rollback 復元 → 再 hardening。

## Staging apply + postcheck

`BEGIN` → hardening → sanity → `COMMIT`（`reports/_anpi-phase14-hardening/apply-tx.sql`, exit=0）

| Postcheck | Result |
| --- | --- |
| authenticated_privs | **`SELECT,UPDATE`** |
| authenticated INSERT / DELETE / TRUNCATE | **false / false / false** |
| anon_privs | （なし） |
| service_role INSERT | true |
| policy_count | 2（phase12 select/update 不変） |
| realtime_membership | 0（不変） |

Rollback: **未使用**（成功）。

## 14-C: Identity mapping verification（staging 実データ · read-only counts のみ）

Artifacts: `reports/_anpi-phase14-hardening/identity-result.json.txt` · `identity-match-result.json.txt`

| Aggregate | Count |
| --- | --- |
| auth.users total | 7 |
| `app_metadata.talk_user_id` あり | 4 |
| `app_metadata.member_id` あり | 4 |
| talk_user_id = auth uid | **0** |
| talk_user_id ≠ auth uid | **4** |
| member_id ≠ auth uid | **4** |
| talk_user_id UUID 形式 | 0 |
| talk_user_id alpha-prefix（member 形式） | **4** |
| claim なし（helper は `sub`=uid へ fallback） | 3 |
| `anpi_user_contexts` | **absent** |

**結論: MISMATCH CONFIRMED（Real INSERT blocker）。**

- Reader 側 `talk_current_user_id()` は claim 保有 4 名に対し **alpha-prefix の talk_user_id** を返す。
- Writer 側（Phase 10）は `anpi_user_contexts` 不在のため **auth uid text（UUID）** へ fallback。
- この状態で Real INSERT すると、claim 保有ユーザーには **通知が見えない／誤 namespace 配送** となることが実データで確定。

**対応方針（本 Phase では実装しない）:** Phase 11 レポートの規定どおり、勝手な fallback 変更は禁止。解消は次のいずれかを ADR 化して別 Phase で実施する。

1. Phase 10 の `anpi_user_contexts` mapping を staging に整備し、writer が talk_user_id namespace へ解決できるようにする（推奨・Phase 10 設計と整合）
2. writer が JWT 由来 mapping を server-side で解決する RPC 拡張（ADR 必須）

## 14-D: Retention policy + cleanup boundary（確定）

| Layer | Policy（確定） | SSOT |
| --- | --- | --- |
| Canonical inbox `talk_notifications` 未読 | **無期限保持**（purge 対象外） | 本レポート |
| Canonical inbox 既読（`read_at` not null） | **90日超で purge 可**。実行は service_role の reviewed batch package のみ（未実装・将来 Phase） | 本レポート |
| Sidecar `anpi_talk_notification_links` | **30日** — `anpi_phase10_purge_links(p_retain default '30 days')` · service_role EXECUTE のみ | Phase 10 migration |
| Client cache | 最大 **500行**（`MAX_NOTIFICATIONS`） | `talk-notifications-store.js` |

Cleanup 境界:

- 削除経路は **service_role のみ**（authenticated は DELETE 権限も DELETE policy も持たない — Phase 12+14 で二重に遮断）
- **pg_cron 不使用**（staging に extension なし・自動 purge は Real INSERT 有効化後の enablement checklist で判断）
- client からのサーバー行削除は行わない（`clientCanDeleteOwn` コードパスは RLS+privilege で拒否される — 意図的）
- 本 Phase では DELETE を一切実行していない（inbox は 0 行のまま）

## Full regression（Phase 2–13 + 14）

**21/21 exit=0** — Phase 2 (50), 3 core (19), 3 staging gate (25), 3 browser E2E (9), 4 (30), 5 (31), 5 browser E2E (12), 6 (18), 6 integration (13), 7 static (14), 7 integration (22), 8 (15), 8 integration (17), 9 (16), 9 integration (19), 10 (19), 10 integration (20), 10.5 (11), 11 (9), 12 (9), 14 (8)。

Log: `reports/_anpi-phase14-hardening/`（regression 出力はターミナルログ参照）· migration hash 不変。

## Final foundation audit（Phase 11 audit 再実行 · hardening 後）

```text
P0=0 P1=2 P2=2
GATE staging_real_insert=NO-GO
AUDIT_EXIT=0
```

- P1: Realtime publication 未加入（意図的）· `anpi_user_contexts` 不在（→ 14-C で MISMATCH 確定の根因）
- P2: inbox purge RPC 未実装（→ 14-D で方針確定・実装は将来 package）· RLS not FORCED（owner/service_role 運用上想定内）

## Gates

| Gate | Verdict |
| --- | --- |
| Privilege provenance | **PROVEN**（default ACL 由来） |
| Privilege hardening (staging) | **APPLIED / PASS**（authenticated=SELECT,UPDATE） |
| anon / public write | **NONE** |
| service_role write path | **PASS**（不変） |
| Policies / RLS / Realtime unchanged | **PASS** |
| Identity mapping | **MISMATCH CONFIRMED — blocker**（PARTIAL から更新） |
| Retention policy | **DECIDED**（実装は将来 reviewed package） |
| Full regression | **PASS 21/21** |
| Final foundation audit | **PASS**（P0=0） |
| Staging Real INSERT readiness | **NO-GO**（identity blocker） |
| Production Real INSERT | **NO-GO** |
| Realtime enablement | **NO-GO / 未変更** |
| Push enablement | **NO-GO / 未変更** |

## Remaining blockers（Real INSERT 前）

1. **Identity mismatch（P0 相当・確定）** — `anpi_user_contexts` 整備 or writer mapping ADR（別 Phase・要 human 承認）
2. Retention purge package 実装（90日既読 purge・service_role batch・reviewed apply）
3. Realtime publication 加入可否の製品判断
4. Enablement checklist（owner/security 承認・Phase 11 checklist）

## Files added

- `sql/anpi-phase14-talk-staging-privilege-hardening.sql`
- `sql/anpi-phase14-talk-staging-privilege-hardening-rollback.sql`
- `scripts/test-anpi-phase14-talk-staging-privilege-hardening.mjs`
- `scripts/verify-anpi-phase14-talk-staging-privilege-hardening-local.mjs`
- `reports/anpi-phase14-talk-staging-privilege-hardening.md`
- `reports/_anpi-phase14-hardening/`（provenance / apply / identity / final audit artifacts）

## Git / safety

- commit / push / deploy: **not performed**
- production: **not contacted**（`ddojquacsyqesrjhcvmn` deny 維持）
- Real INSERT / notification row: **not executed**（inbox 0 行のまま）
- Realtime / Push / ANPI real mode: **not enabled**
- FROZEN UI / client / schema: **unchanged**
