# TLV 収益分配 — 金融計算整合性ルール

**優先度:** 最高（1円単位の整合性）

## 支払い確定値（最重要）

**実支払い・表示・CSV・月次レポートの唯一の確定値は `creators[].payout_amount_yen` です。**

| ルール | 内容 |
|--------|------|
| SSOT | `monthly-payout-decision.json` |
| 確定フィールド | `decision.creators[].payout_amount_yen` |
| 互換フィールド | `payout_amount` は同一値の複製可（支払い参照には使わない） |
| 再計算禁止 | Dashboard / 管理画面 / CSV / レポートで `gross_revenue × applied_rate` を支払額にしない |
| 丸め禁止 | 表示側で `payout_amount_yen` を丸め直さない |
| 参考表示 | `gross_revenue × applied_rate` は説明・参考表示まで |

`audit.payment_finalization` および各 Creator の `audit` に以下を記録する:

- `payout_amount_source: "monthly-payout-decision.json"`
- `payout_amount_yen_is_final: true`
- `no_display_recalculation: true`

## payout_pool の算出順（固定）

**総売上から直接 Creator 還元を計算しない。** 必ず会社側を先控除する。

```
total_revenue
- payment_fee
- platform_cost（CDN / storage / live を含む）
- reserve_amount
- minimum_company_profit
- operational_margin
= payout_pool
```

`cdn_storage_live_cost` は入力で分離可能。`platform_cost_total = platform_cost + cdn_storage_live_cost` として先控除に含める。

Creator payout は **payout_pool の範囲内のみ**。不足時は変動層（Starter / Creator / Pro / 保証対象外 Top）のみ調整。Top / Elite 保証対象者の保証率は維持。

## 検証（validations — monthly-payout-decision.json）

| 項目 | 意味 |
|------|------|
| `payout_amount_yen_present` | 全 Creator に `payout_amount_yen` が存在 |
| `payout_amount_yen_integer` | 全 `payout_amount_yen` が非負整数 |
| `payout_amount_yen_matches_total` | `payout_amount_yen` 合計 = `summary.total_payout` |
| `dashboard_must_use_payout_amount_yen` | Dashboard は確定値のみ（再計算契約） |
| `csv_must_use_payout_amount_yen` | CSV は確定値のみ |
| `report_must_use_payout_amount_yen` | 月次レポートは確定値のみ |
| `no_gross_times_rate_for_payment` | 支払額に `gross × rate` を使用しない |
| `yen_integer_only` | 互換 `payout_amount` も整数かつ `payout_amount_yen` と一致 |
| `sum_matches_allocated` | Creator 合計 = `summary.total_payout` |
| `audit_present` | audit ブロック完備 |
| `identity_holds` | 収支恒等式が 0 円差分 |
| `variable_pool_exact` | 変動層合計が残余プール以内（スケール時は一致） |

### 会社控除・プール検証（既存）

| 項目 | 意味 |
|------|------|
| `company_costs_deducted_first` | 固定順序で会社控除後に payout_pool を算出 |
| `operational_margin_preserved` | `final_company_profit` が最低利益＋運営マージン以上 |
| `payout_pool_after_company_margin` | audit と payout_pool が一致 |
| `no_creator_payout_from_gross_revenue` | 支払いは payout_pool 内のみ（総売上直還元なし） |

## 正本（Canonical Source）

すべての支払関連表示・出力の**唯一の確定値**は次のファイルです。

`reports/tlv-business-simulator/output/monthly-payout-decision.json`

## 消費者ルール（必須）

以下は **monthly-payout-decision.json の確定値のみを参照** し、**各画面・各出力で再計算しない** こと。

| 消費者 | 参照フィールド例 |
|--------|----------------|
| UI（管理画面） | `summary.*`, `creators[].payout_amount_yen` |
| Creator Dashboard | `creators[].payout_amount_yen`, `creators[].creator_explanation`, `creators[].applied_rate`（表示用） |
| 支払 CSV | `creators[].creator_id`, `creators[].payout_amount_yen` |
| 月次レポート | `summary`, `audit`, `validations` |

**禁止:** `gross_revenue × rate%` を UI 側で再計算して表示・送金する。

## コンシューマー出力（表示・CSV・Dashboard・レポート）

```bash
node scripts/generate-payout-outputs.mjs
```

| 出力 | 用途 |
|------|------|
| `output/admin-payout-display.json` | 管理画面 |
| `output/creator-dashboard-payout.json` | Creator Dashboard |
| `output/stripe-connect-payouts.csv` | 支払 CSV |
| `output/monthly-operator-report.md` | 月次レポート |
| `output/payout-consumer-validations.json` | コンシューマー整合検証 |

### コンシューマー検証（`payout-consumer-validations.json`）

| 項目 | 意味 |
|------|------|
| `payout_display_uses_decision_amount` | 表示が `payout_amount_yen` と一致 |
| `dashboard_must_use_payout_amount_yen` | Dashboard が確定値のみ |
| `csv_must_use_payout_amount_yen` | CSV が確定値のみ |
| `report_must_use_payout_amount_yen` | レポートが確定値のみ |
| `no_gross_times_rate_for_payment` | `gross × rate` 未使用 |
| `yen_integrity_preserved` | 1円単位整合 |

## 通貨・端数

- 通貨: **JPY（整数円のみ）**
- 行ごとの初期計算: 四捨五入（half up）
- 変動層プール配分: **最大剰余法**で残余プール（整数円）に厳密一致
- 小数点・端数・残余は `audit` ブロックに必ず記録

## audit ブロック（monthly-payout-decision.json）

| セクション | 内容 |
|-----------|------|
| `audit.guaranteed_layer` | 保証層の exact / rounded / delta |
| `audit.variable_layer` | スケール係数・配分前後合計・最大剰余調整 |
| `audit.company_profit_audit` | 会社利益の算式と確定値 |
| `audit.payment_finalization` | 支払確定値ポリシー（`payout_amount_yen` のみ） |
| `audit.balance_check` | 収支恒等式 `identity_holds` |
| `creators[].audit` | Creator ごとの支払確定 audit |

## 検証（validations — 重複整理）

会社控除・プール検証は上記「会社控除・プール検証」セクションを参照。支払確定値検証は「validations — monthly-payout-decision.json」セクションを参照。

## コード参照

```javascript
import { loadMonthlyPayoutDecision } from "../scripts/generate-monthly-payout-decision.mjs";
import { FINANCIAL_INTEGRITY_POLICY } from "../scripts/tlv-payout-financial.mjs";
import { getConfirmedPayoutYen, formatPayoutYenDisplay } from "../scripts/tlv-payout-consumers.mjs";

const decision = loadMonthlyPayoutDecision();
// 表示・CSV は decision.creators[].payout_amount_yen のみ
const yen = getConfirmedPayoutYen(decision.creators[0]);
const display = formatPayoutYenDisplay(yen); // 表示のみ
```

## 再生成パイプライン

```bash
node scripts/generate-monthly-payout-decision.mjs
node scripts/generate-condition-lines.mjs
node scripts/generate-creator-rank-explanation.mjs
node scripts/generate-payout-outputs.mjs
```

`validations.all_pass: true` かつ `audit.balance_check.identity_holds: true` を確認してから UI / CSV / レポートに反映する。
