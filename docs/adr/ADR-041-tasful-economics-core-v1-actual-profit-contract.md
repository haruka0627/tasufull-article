# ADR-041 — TASFUL Economics Core V1 Actual Profit / Contribution Contract

| 項目 | 内容 |
| --- | --- |
| **ID** | **AD-041** |
| **ファイル** | `docs/adr/ADR-041-tasful-economics-core-v1-actual-profit-contract.md` |
| **日付** | 2026-08-12 |
| **状態** | **Accepted（Economics Core V1 Contract）** · Runtime Production / Stripe / schema migration は別承認 |
| **親** | **AD-040**（製品思想）· **AD-042**（Lowest Sustainable Pricing） |
| **関連** | AD-030/031/033/034 · FINANCIAL_MODEL · SAFE-06/07 · FIN-CONF-A |
| **実装** | Deterministic pure module（`scripts/lib/economics/`）· **DB schema 追加なし** · AI 秘書接続なし · Benefit / 料金自動化なし |

> **最終レビュー（2026-08-12）:** AD-040 / AD-042 と矛盾なし。Shop Connect は AD-042 で独立レーン確定済み。不足原価 ¥0 禁止 · Contribution ≠ 会計純利益 · Secretary = interpret/recommend のみ — 本 ADR で固定。

---

## 1. Financial Truth ownership

```text
Existing ledgers / verified Cost Contract
  → Deterministic Economics Core
  → structured ECONOMICS_SUMMARY
  → AI 運営秘書 / Command Center (interpret · recommend)
  → Human Approval
  → Apply
```

| Actor | CALCULATE FINANCIAL TRUTH | INTERPRET | RECOMMEND |
| --- | --- | --- | --- |
| Economics Core | YES | NO | NO |
| AI 運営秘書 | **NO** | YES | YES |
| LLM | **NO** | on structured input only | YES |

---

## 2. Naming

| Term | Use |
| --- | --- |
| **Actual Profit** (AD-040) | Product / policy language — retained |
| **CONTRIBUTION_PROFIT** | Economics Core internal machine field |
| **Accounting Net Income** | Out of V1 scope (shared fixed / corp costs excluded) |

Never present CONTRIBUTION_PROFIT as audited corporate net profit.

---

## 3. Contribution formula (V1)

```text
GROSS_REVENUE
− REFUNDS
− CHARGEBACKS (attributable)
− CREATOR_DISTRIBUTION
− PAYMENT_PROCESSING_COST
− EXTERNAL_API_VARIABLE_COST
− STREAMING_VARIABLE_COST
− MEDIA_PROCESSING_VARIABLE_COST
− STORAGE_VARIABLE_COST
− BANDWIDTH_VARIABLE_COST
− BENEFIT_ACTUAL_COST
− OTHER_ATTRIBUTABLE_VARIABLE_COST
= CONTRIBUTION_PROFIT
```

**Missing attributable cost ⇒ must not treat as ¥0.**  
Emit `PROFIT_STATUS`: `COMPLETE_ACTUAL` | `PARTIAL_ACTUAL` | `ESTIMATED` | `FORECAST` | `UNAVAILABLE`.

---

## 4. Cost class taxonomy

| Class | In CONTRIBUTION_PROFIT V1 |
| --- | --- |
| DIRECT_VARIABLE | YES when attributable |
| ALLOCATABLE_VARIABLE | Only with Human-approved allocation (future) |
| SHARED_FIXED | NO |
| NON_PRODUCT_COST | NO |

---

## 5. Actuality taxonomy

`ACTUAL` · `VENDOR_REPORTED` · `CALCULATED` · `ESTIMATED` · `FORECAST`

Never mix unlabeled.

---

## 6. TLV progressive revenue share (SSOT = AD-040)

Apply each row only to that portion of one creator's monthly Eligible Net; never apply the highest reached rate to the full amount.

| Monthly Eligible Net portion | Creator marginal rate | TASFUL marginal rate |
| --- | ---: | ---: |
| JPY 0–5,000,000 | 80% | 20% |
| over JPY 5,000,000–10,000,000 | 90% | 10% |
| over JPY 10,000,000–30,000,000 | 95% | 5% |
| over JPY 30,000,000 | 99% | 1% |

Rank / Score ≠ tip %.  
`scripts/tlv-payout-financial.mjs` company-first pool ≠ tip SSOT.

---

## 7. Fee lanes (label, do not collapse)

| Lane | Formal |
| --- | --- |
| A General | 5% · min ¥550 · AD-030 |
| B Platform Connect catalog | 5% · min ¥550 · provisional |
| C Shop Connect | **AD-042:** `SHOP_CONNECT` · **10%** · **min NONE** |
| D Business | 10% · min ¥550 · AD-030/033 |
| Builder | AD-034 / AD-042 · rates **UNLOCKED** · scenario only in V1 |

---

## 8. Daily Radar / Secretary

Radar = EXTERNAL INTELLIGENCE → Human verify → Cost Contract → Economics recalculate → Secretary recommend → Human Approval.  
**No auto Production price write.**  
Secretary FROZEN — V1 defines read-only payload shapes only.

---

## 9. Still UNLOCKED (do not invent)

- Benefit 15% threshold / tax / payment-fee incidence detail  
- Builder locked rates / Campaign min / progressive tier boundaries  
- Live FX feed / Economics Core DB schema  

---

## 10. Acceptance criteria (met)

1. FIN-CONF-A / tip SSOT documented · Shop = independent (AD-042)  
2. Missing cost ≠ 0 mandatory  
3. Secretary interpret-only  
4. AD-040 / AD-042 unchanged by this Acceptance  

---

## 改訂履歴

| 版 | 日付 | 内容 |
| --- | --- | --- |
| Draft | 2026-08-12 | Proposed Contract |
| **v1 Accepted** | 2026-08-12 | Human-task Acceptance · Phase 1–4 pure module implementation authorized |
