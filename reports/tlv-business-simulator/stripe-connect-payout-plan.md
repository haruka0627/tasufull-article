# Stripe Connect 送金プラン（シミュレーション）

**本ドキュメントは送金候補データの設計書です。実送金は行いません。Stripe API は呼び出しません。**

---

## 1. 位置づけ

| 項目 | 内容 |
|------|------|
| 目的 | 月次還元額を Stripe Connect 形式の CSV に整形 |
| スコープ | レポート生成・CSV/JSON 出力まで |
| 非スコープ | Stripe API 呼び出し、本番送金、Webhook |

TLV v1.0 は Feature Freeze のため、本体 UI・`live/` 配下には手を入れません。

---

## 2. 出力 CSV

**パス:** `output/stripe-connect-payouts.csv`

| 列 | 説明 |
|----|------|
| `creator_id` | TLV 内部 ID |
| `creator_name` | 表示名 |
| `stripe_connect_account_id` | Connect アカウント ID（サンプル） |
| `payout_amount_jpy` | 送金候補額（円） |
| `currency` | `jpy` 固定 |
| `description` | 送金説明（例: `TLV 2026-05 creator revenue share`） |
| `internal_note` | Tier・内部レンジ（運営のみ） |

`payout_amount_jpy` が 0 の行は CSV に含めません。

---

## 3. 送金前フロー（将来）

```
月次収支入力
    ↓
payout-decision-engine（本ツール）
    ↓
monthly-operator-report.md レビュー
    ↓
safety_status 確認（RED/DANGER は保留）
    ↓
stripe-connect-payouts.csv 手動確認
    ↓
（別システム）Stripe Connect Transfer / Payout
```

現時点では CSV 出力まで。Transfer API 連携は別フェーズ。

---

## 4. 安全ルール

- Stripe API を叩かない
- 本番送金しない
- `safety_status` が `RED` / `DANGER` の月は送金候補を承認しない
- 70% レンジ適用者は運営承認必須
- CSV は「候補」であり、会計・法務確認後にのみ実送金

---

## 5. サンプル行

```csv
creator_id,creator_name,stripe_connect_account_id,payout_amount_jpy,currency,description,internal_note
cr_001,ひろチャンネル,acct_sample_hiro_001,129500,jpy,TLV 2026-05 creator revenue share,Top Contributor / internal rate 70%
```

実際の値は `node scripts/generate-tlv-business-simulator.mjs` 実行後の CSV を参照。

---

## 6. 関連

- [payout-decision-engine.md](payout-decision-engine.md)
- [monthly-operator-report-sample.md](monthly-operator-report-sample.md)
- Excel: `StripeConnectExport` シート
