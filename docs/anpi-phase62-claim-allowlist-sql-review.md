# ANPI Phase 62 — Claim Allowlist SQL Review (no apply)

**Date:** 2026-07-27  
**Scope:** Review claim-allowlist SQL for staging Phase 62 prerequisites  
**SQL apply:** **NOT PERFORMED**  
**Production:** untouched

---

## Verdict

```text
PHASE61_STUB_PROPOSAL (sql/anpi-phase61-claim-allowlist-proposal.sql): NOT APPLY-READY (incomplete sketch)
PHASE62_COMPLETE_DRAFT (sql/anpi-phase62-claim-allowlist-draft.sql): REVIEW OK · AWAITING STAGING APPLY APPROVAL
APPLY_NOW: NO
STATUS: STOPPED — waiting for human-approved staging SQL apply
```

Phase 61 で適用を止めた判断は正しい。現行 `anpi-phase61-claim-allowlist-proposal.sql` はコメント例のみで、そのまま適用すべき内容ではない。

---

## 1. 現行 Phase 61 stub の問題

| Issue | Detail |
|-------|--------|
| 実行可能 DDL なし | `select ... status` のみ · gate/claim 未定義 |
| 影響不明 | `anpi_phase6_claim_jobs` を置き換えるのか並列なのか未決 |
| Rollback なし | drop 手順未記載 |
| 安定 key 未実装 | コメントのみ |

→ **この stub を staging に適用してはいけない。**

---

## 2. 推奨設計（Complete draft）

File: [`sql/anpi-phase62-claim-allowlist-draft.sql`](../sql/anpi-phase62-claim-allowlist-draft.sql)  
Rollback: [`sql/anpi-phase62-claim-allowlist-rollback.sql`](../sql/anpi-phase62-claim-allowlist-rollback.sql)

### 構成

| Object | Role |
|--------|------|
| `anpi_phase62_claim_allowlist_gate` | `enabled` default **false** · `allowed_auth_sha8[]` default `{0411f04d}` |
| `anpi_phase62_claim_allowlist_enable` / `emergency_disable` | Explicit ON / fail-closed OFF |
| `anpi_phase62_stable_idempotency_key` | Phase 61 と同型 · **attempt 非依存** |
| `anpi_phase62_claim_jobs_allowlisted` | **並列** claim · gate OFF なら 0 行 |

### なぜ `anpi_phase6_claim_jobs` を書き換えないか

| Risk if replaced in-place | Mitigation |
|---------------------------|------------|
| Staging Cron（`talk_local*`）が突然テスト identity 以外を claim できなくなる / 逆に scoped 経路と結合し事故る | 既存 claim を維持 |
| Phase 47/48 soak 回帰 | 並列 RPC のみ追加 |
| Rollback 困難 | 既存関数を触らない |

Scoped Cron soak（将来）は **明示的に** `anpi_phase62_claim_jobs_allowlisted` を呼ぶ配線が必要（別作業 · 本 SQL 適用だけでは Cron は変わらない）。

---

## 3. 安全性レビュー

| Check | Result |
|-------|--------|
| Default fail-closed | PASS — `enabled=false` · scoped claim returns 0 rows |
| service_role only | PASS — revoke anon/authenticated on table + RPCs |
| RLS on gate | PASS — no anon/auth policies |
| Allowlist format | PASS — `^[a-f0-9]{8}$` · max 32 entries |
| Raw UUID in repo defaults | PASS — sha8 only (`0411f04d`) |
| Production apply | FORBIDDEN — ops plan staging-only |
| Inbox write in this SQL | NONE — claim/gate/key only · no `talk_notifications` INSERT |
| Cron auto-cutover | NONE — Worker still uses Phase 6 claim + `talk_local*` |
| Attempt key regression | PASS — Phase 6/8 keys untouched |

### Residual risks (accept / mitigate at apply time)

1. **Digest cost on claim filter** — sha256 per candidate row; soak limit ≤20 mitigates.  
2. **subject_user_id null jobs** — excluded by digest/strictness; preflight should count nulls.  
3. **Gate left enabled accidentally** — emergency_disable + verify `enabled=false` in postcheck.  
4. **Future Cron wiring mistake** — require separate Phase 62b code review; SQL alone must not enable real write.

---

## 4. 既存互換性

| Surface | Impact |
|---------|--------|
| `anpi_phase6_claim_jobs` | **Unchanged** |
| Phase 47/48/56 Cron | **Unchanged** (still stub) |
| Phase 8/10 attempt idempotency | **Unchanged** |
| Phase 17/59/61 writers | **Unchanged** |
| `talk_notifications` / RLS | **Unchanged** |
| New objects only | Additive |

---

## 5. Rollback 手順

**Immediate (preferred):**

```sql
select * from public.anpi_phase62_claim_allowlist_emergency_disable();
```

**Full uninstall** (only if forward was applied): run  
[`sql/anpi-phase62-claim-allowlist-rollback.sql`](../sql/anpi-phase62-claim-allowlist-rollback.sql)

Confirm after rollback:

- `to_regclass('public.anpi_phase62_claim_allowlist_gate')` is null (full drop), **or** `enabled=false` (disable-only)
- `anpi_phase6_claim_jobs` still present
- Cron lease rows still `talk_local*` / no new inbox markers from Cron

---

## 6. 影響範囲

| Area | In scope of this SQL | Out of scope |
|------|----------------------|--------------|
| Staging DB objects | Gate · enable/disable · stable key · parallel claim | — |
| Staging Cron Worker | — | Provider flip · process wiring |
| Production DB/Worker/Secrets | — | **Forbidden** |
| User-facing inbox | — | No INSERT in this SQL |
| JS Phase 61 writer | — | Continues manual path |

---

## 7. 適用計画（人間実行 · まだ実行しない）

### Preconditions

1. Linked / targeted project ref = `ahlxuyvhzqdqaojiywmu` only  
2. Production ref `ddojquacsyqesrjhcvmn` denied  
3. Human written approval for staging DDL  
4. Forward + rollback files reviewed in this doc  
5. Backup / snapshot policy per staging ops (if required by team)

### Apply steps (when approved)

```text
1. Confirm project ref
2. Apply sql/anpi-phase62-claim-allowlist-draft.sql via approved staging SQL channel
   (db query --linked / Dashboard SQL — NOT Production, NOT MCP DDL)
3. Sanity select: gate_enabled=false · scoped_claim_exists=true · legacy_claim_untouched=true
4. Negative: call anpi_phase62_claim_jobs_allowlisted → 0 rows while disabled
5. Do NOT enable gate yet unless a follow-up soak plan is approved
6. Do NOT flip ANPI_NOTIFICATION_PROVIDER
7. Record evidence in reports/ (follow-up phase)
```

### Explicit non-goals of apply

- No Cron soak  
- No Phase 10 real_mode enable  
- No Production objects  

---

## 8. Go / No-Go for apply

| Decision | Status |
|----------|--------|
| Apply Phase 61 stub as-is | **NO-GO** |
| Apply Phase 62 complete draft after human approval | **GO (staging only)** |
| Proceed to Cron soak immediately after apply | **NO-GO** (wiring + enable gate + soak plan still required) |
| This session apply | **STOPPED — waiting** |

---

## 9. Next human action

1. Review/approve [`sql/anpi-phase62-claim-allowlist-draft.sql`](../sql/anpi-phase62-claim-allowlist-draft.sql)  
2. Approve staging apply channel + operator  
3. After apply: keep `enabled=false` until Phase 62 soak plan is separately approved  

**Agent status:** stopped pending staging SQL apply approval. No DDL executed in this phase.
