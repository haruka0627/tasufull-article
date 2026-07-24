# Platform Request P5-10 — Stripe Test / Contact Reveal

**Date:** 2026-07-05
**Staging ref:** `ahlxuyvhzqdqaojiywmu`（のみ）
**判定:** **Go**

---

## 概要

| コンポーネント | 責務 |
| --- | --- |
| `platform-request-payment-bridge.js` | Checkout 開始 · 確認 · 連絡先開示 |
| `/api/platform-request-create-checkout` | JWT · Match · `platform_request_payments` · Stripe/simulate |
| `/api/platform-request-confirm-checkout` | 決済確定 · match `talk_started` |
| `/api/platform-request-contact-reveal` | 支払い後の連絡先開示 |

**SKU:** `platform_request_match_contact` · **¥550** · Staging Test / simulate

---

## 検証結果

| 項目 | 結果 |
| --- | --- |
| Checkout 作成 | PASS |
| 決済確定（simulate） | PASS |
| 重複防止 | PASS |
| owner 連絡先開示 | PASS |
| candidate 連絡先開示 | PASS |
| 漏洩チェック | PASS |
| HTTP create-checkout | 200 |
| HTTP confirm-checkout | 200 |
| Console Error | **0** |

### IDs

| 項目 | 値 |
| --- | --- |
| request_id | 86a6c04c-bf58-4324-9cce-1253b1d0e92a |
| match_id | 599e5015-7fa8-4e2a-93ae-bac42a802b2c |
| session_id | prq_sim_ced224b393764f4eb103ac9c1257c619 |

### RLS / 権限

| 主体 | 結果 |
| --- | --- |
| unrelated reveal | PASS (403) |
| anon reveal | PASS (401) |

### 回帰

| スクリプト | 結果 |
| --- | --- |
| P5-6 | PASS |
| P5-7 | PASS |
| P5-7b | PASS |
| P5-7c | PASS |
| P5-8 | PASS |
| P5-9 | PASS |

---

## 変更ファイル（P5-10）

| ファイル | 変更 |
| --- | --- |
| `platform-request-payment-bridge.js` | **新規** |
| `deploy/cloudflare/functions/api/platform-request-create-checkout.js` | **新規** |
| `deploy/cloudflare/functions/api/platform-request-confirm-checkout.js` | **新規** |
| `deploy/cloudflare/functions/api/platform-request-contact-reveal.js` | **新規** |
| `deploy/cloudflare/functions/_shared/platform-request-payments.mjs` | **新規** |
| `deploy/cloudflare/functions/_shared/stripe-api.mjs` | **新規** |
| `platform-request.js` | 決済モーダル · 開示 UI |
| `platform-request-detail.html` | 連絡先開示セクション |
| `platform-request.css` | 開示スタイル |
| `scripts/test-platform-request-p5-10-stripe-contact-reveal.mjs` | **新規** |

---

## Go / No-Go

| 環境 | 判定 |
| --- | --- |
| **Staging P5-10** | **Go** |
| **Production** | **No-Go** 継続 |
