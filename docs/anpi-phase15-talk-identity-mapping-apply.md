# ANPI Phase 15 — Human-reviewed Identity Mapping Package

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.

**Staging ref (only):** `ahlxuyvhzqdqaojiywmu`  
**Production deny:** `ddojquacsyqesrjhcvmn`

## Canonical chain

```text
auth.users.id (uuid)
  → anpi_user_contexts.auth_user_id
  → anpi_user_contexts.talk_user_id   (= JWT app_metadata.talk_user_id)
  → talk_notifications.user_id

Phase 10 writer mirrors:
  anpi_user_id  = auth_user_id::text   (lookup)
  member_id     = talk_user_id         (return)
```

## Candidate review (staging · redacted)

| Metric | Value |
| --- | --- |
| total auth.users | 7 |
| candidate_map (APPROVE) | **4** |
| no_claim_uid_ok | 3 |
| claim format | alpha-prefix (0 UUID) |
| mismatch without mapping | 4 |
| parity if mapped | 4/4 |

Redacted candidates: see `reports/_anpi-phase15-identity/candidates-result.json.txt`  
(sha16 hashes only · no raw UUID / talk_user_id).

## Package files

| File | Role |
| --- | --- |
| `sql/anpi-phase15-talk-identity-mapping-foundation.sql` | Schema + resolver + RLS |
| `sql/anpi-phase15-talk-identity-mapping-seed.sql` | Seed from app_metadata claims |
| `sql/anpi-phase15-talk-identity-mapping-rollback.sql` | SECTION A: unseed + drop resolver |

## Applied (this Phase)

1. Schema apply — PASS (table 18 cols · RLS · resolve fn · 0 insert policies)
2. Seed apply — PASS (4 approved_phase15 rows)
3. Dry-run parity — **7/7 writer == reader claim · 0 remaining mismatches · inbox 0**

## Still NO-GO

- Real INSERT / notification row creation
- Realtime publication / Push
- Production
- ANPI real mode
