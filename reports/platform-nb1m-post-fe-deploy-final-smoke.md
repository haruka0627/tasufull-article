# Platform NB-1M — POST-FE DEPLOY FINAL SMOKE

| 項目 | 内容 |
|------|------|
| **実施日** | 2026-06-25T21:02:11.830Z |
| **Production commit** | `83d3111` |
| **Base URL** | https://tasufull-article.pages.dev |
| **種別** | read-only · 本番DB write 禁止 |
| **CF Access storage** | true expired=false |
| **Ops admin login** | t***@tasful-dev.test session=true |

## 最終判定

| 項目 | 判定 |
|------|------|
| **Ready for Operation** | **YES** |
| **No-Go** | **NO — NB-1M FE deploy verified** |

## OPS / Inbox / Deep Link（運営 JWT）

| ID | Verdict | Note |
|----|---------|------|
| ops-admin-login | PASS | admin JWT session + isOpsUser |
| ops-admin-shell | PASS | inbox=true gate=true pending=0 |
| ops-action-url | PASS | admin-operations-dashboard.html?target_type=listings&target_id=final-smoke-reado |
| ops-deep-link-target-id | PASS | target_id=final-smoke-readonly panel=true detail=審査待ちの対象が見つかりません（処理済みまたはローカルのみの可 |
| ops-pending-review-count | PASS | pendingReviewCount=0 |

## TLV LIVE Access

| 分類 | expected_private_test_gate_banner |
| Product 不具合 | NO (infra banner / smoke heuristic) |

## /market/ 直アクセス

| 優先度 | P2 — legacy path · not primary nav |
| 本番主導線 | Platform TOP `/` · `/index.html` → index-top · listings via index.html/shop-store |

## Pre-smoke script 差分（main 未反映）

main(83d3111) vs local: routing-top selectors + ops 403 expected PASS. Recommend separate commit `chore(smoke): align prod pre-smoke with 83d3111 routing`.

## 残 Blocker

- （なし — operation ready）

## P1 / P2

- **P1:** 運営 JWT 付き OPS Inbox 実表示（本 smoke で検証）
- **P2:** `/market/` legacy 直アクセス MIME（主導線外 · routing-only fix 候補）
- **P2:** pre-smoke TLV false BLOCKED 修正（smoke script only）

---

*Approve / Reject / Completed 操作は実施していません。*
