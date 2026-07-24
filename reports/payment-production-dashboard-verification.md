# Payment Engine — Production Dashboard Verification

**Date:** 2026-06-28  
**Phase:** Production Final Release — Dashboard Verification（**確認のみ · 変更禁止**）  
**Project:** `ddojquacsyqesrjhcvmn`（`tasful-ai`）  
**Production 変更:** **なし**（deploy · migration · config push · Secret · Stripe · DB · webhook 編集 — すべて未実行）

---

## Executive summary

| Phase | 手段 | 判定 |
| --- | --- | --- |
| **A — Backup** | Supabase Management API（CLI `backups list`）+ project metadata | **NOT READY** |
| **B — Stripe** | Stripe Dashboard / CLI | **NOT READY** — **未アクセス** |

**Dashboard ブラウザ目視:** 本セッションでは **未実施**（エージェント環境から Supabase / Stripe Dashboard UI にログイン不可）。以下は **CLI/API  read-only 記録** + **人間 Dashboard 確認チェックリスト**。

---

## Phase A — Backup（Supabase）

### A.1 確認手段

| 手段 | 日時（UTC） | 結果 |
| --- | --- | --- |
| Supabase Dashboard → Database → Backups | — | **未アクセス** |
| `npx supabase backups list --project-ref ddojquacsyqesrjhcvmn -o json` | 2026-06-28 Dashboard Verification | 下表 |
| `npx supabase projects list -o json` | 2026-06-28 Dashboard Verification | region · status |

### A.2 記録（Management API · read-only）

| # | 確認項目 | 記録値 | Dashboard 目視 |
| ---: | --- | --- | --- |
| 1 | **Backups 有効状態** | **WAL-G 有効** (`walg_enabled: true`) | ☐ 要確認 |
| 2 | **最新 Backup（Snapshot）日時** | **`backups: []`** — API 上 **個別 snapshot 行なし** · **`physical_backup_data: {}` 空** | ☐ 要確認（Dashboard で最新日時） |
| 3 | **PITR** | **`pitr_enabled: false`** | ☐ 要確認 |
| 4 | **Backup Retention** | **API 未返却** — Dashboard Plans/Backups 画面で確認必要 | ☐ 要確認 |
| 5 | **Project Region** | **`ap-northeast-1`**（Northeast Asia · Tokyo） | ✅ CLI 一致 |

**Project 状態:** `ACTIVE_HEALTHY` · Postgres `17.6.1.121` · created `2026-05-14T14:19:50Z`

### A.3 CLI raw（参考）

```json
{
  "backups": [],
  "physical_backup_data": {},
  "pitr_enabled": false,
  "region": "ap-northeast-1",
  "walg_enabled": true
}
```

### A.4 Backup 判定

| 判定 | **NOT READY** |
| --- | --- |
| **理由** | ① **PITR 無効**（Runbook §4.1 未充足） · ② **最新 snapshot 日時が API/レポートに未記録**（`backups` 空） · ③ **Retention 未確認** · ④ Dashboard 目視未完了 |

**Release 前に人間が Dashboard で記録すべき項目:**

1. Database → Backups → 最新 backup **日時（UTC/JST）**
2. PITR トグル状態（CLI と一致するか）
3. Retention 日数 / プラン表示
4. 必要なら **手動 snapshot** 取得日時（変更は Go 承認後でも可 · **本 verification では取得していない**）

---

## Phase B — Stripe Webhook

### B.1 確認手段

| 手段 | 結果 |
| --- | --- |
| Stripe Dashboard → Developers → Webhooks | **未アクセス** |
| Stripe CLI `webhook_endpoints list` | **不可** — `STRIPE_API_KEY` 未設定 · `stripe login` 未実施 |
| Edge Secrets（RV2 記録 · 名前のみ） | `STRIPE_SECRET_KEY` ✅ · `STRIPE_WEBHOOK_SECRET` ✅ · `STRIPE_WEBHOOK_SECRET_TLV` ❌ |

### B.2 期待 TLV Endpoint

| 項目 | 期待値 | 記録 |
| --- | --- | --- |
| **URL** | `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/tlv-payment-webhook` | **未確認** |
| **Endpoint ID** | `we_…` | **未記録** |
| **有効状態** | enabled | **未確認** |
| **Signing Secret** | endpoint ペアの `whsec_…` | **Edge に `STRIPE_WEBHOOK_SECRET` 存在（値は記録しない）** · **`STRIPE_WEBHOOK_SECRET_TLV` なし** · **TLV endpoint との対応は未確認** |

**既知（Platform · TLV 以外）:** Test endpoint `we_1TR70n5tJSRSYcyiMrAzpuGF` → `…/functions/v1/stripe-webhook`（GenAI/Featured 等 · [stripe-webhook-audit.md](./stripe-webhook-audit.md)）

### B.3 確認対象イベント（Runbook P0 · 7 events）

| Event | TLV 必須 | Dashboard 登録 | 追加予定（+4） |
| --- | --- | --- | --- |
| `payment_intent.succeeded` | ✅ | **未確認** | — |
| `payment_intent.payment_failed` | ✅ | **未確認** | — |
| `payment_intent.canceled` | ✅（Runbook 7 件目） | **未確認** | — |
| `charge.refunded` | ✅ | **未確認** | **+4** |
| `refund.updated` | ✅ | **未確認** | **+4** |
| `charge.dispute.created` | ✅ | **未確認** | **+4** |
| `charge.dispute.closed` | ✅ | **未確認** | **+4** |

**現状イベント数:** **未確認**（Dashboard 未アクセス）  
**その他イベント:** **未列挙** — Dashboard で endpoint 選択 → Events タブを目視

### B.4 差分（期待 vs 現状 · 未確認前提）

| 区分 | 内容 |
| --- | --- |
| **Endpoint 存在** | TLV URL の endpoint **有無不明** — 無ければ **新規作成が Release day 作業** |
| **+4 events** | `charge.refunded` · `refund.updated` · `charge.dispute.created` · `charge.dispute.closed` — **登録状況未確認** |
| **PI 3 events** | `payment_intent.*` — **未確認** |
| **Secret 整合** | Edge `STRIPE_WEBHOOK_SECRET` は存在 · **どの endpoint の whsec か未確認** |

### B.5 Stripe 判定

| 判定 | **NOT READY** |
| --- | --- |
| **理由** | Endpoint URL · 有効状態 · イベント一覧 · イベント数 · +4 差分 — **すべて Dashboard 未確認** |

**Release 前に人間が Dashboard で記録すべき項目:**

1. TLV endpoint URL が期待 URL と **完全一致**か
2. Status: Enabled / Disabled
3. Events 一覧（全件コピー）· **件数**
4. Signing secret が Edge secret と **ペア**か（値は vault のみ · 本レポートに書かない）
5. 不足 event リスト

---

## 差分判定サマリ

| 区分 | 判定 | 理由 |
| --- | --- | --- |
| **Backup** | **NOT READY** | PITR false · snapshot 日時未記録 · retention 未確認 · Dashboard 目視未完 |
| **Stripe** | **NOT READY** | TLV endpoint / events / secret 整合 — すべて未確認 |

---

## Production Go Blocker 残数

| # | Blocker | Dashboard Verification 後 |
| ---: | --- | --- |
| 1 | Backup / snapshot 記録 · PITR | **継続** — NOT READY |
| 2 | Stripe 7 events + TLV endpoint | **継続** — NOT READY |
| 3 | `tlv-payment-webhook` deploy（chargeback） | 変更なし · PRE-FLIGHT |
| 4 | PS-02〜05 · PS-M01〜05 | 変更なし |
| 5 | Go Approval | 変更なし |

**PRE-FLIGHT Checklist:** **0 / 6 READY**（Backup · Stripe とも本 verification で **NOT READY 確定**）

**Production 変更:** 本 verification では **0 件**

---

## 人間 Dashboard 確認 — 記録テンプレート（Go 前に貼付）

### Supabase（コピー用）

```text
確認者:
確認日時 (UTC/JST):
Backups enabled (Dashboard):
Latest snapshot datetime:
PITR enabled (Dashboard):
Retention:
Region: ap-northeast-1 (expected)
```

### Stripe（コピー用）

```text
確認者:
確認日時 (UTC/JST):
Endpoint URL:
Endpoint ID (we_...):
Status (enabled/disabled):
Event count:
Events list:
  -
Signing secret configured (yes/no — value NOT in report):
STRIPE_WEBHOOK_SECRET_TLV needed (yes/no):
Missing events for Go:
  -
```

---

## 参照

- [payment-production-final-preflight.md](./payment-production-final-preflight.md)
- [tlv-payment-production-readiness.md](./tlv-payment-production-readiness.md)

---

*Dashboard Verification 2026-06-28 · read-only CLI/API · no production changes*
