# TLV AI 収益分配エンジン Ver2 — 実装フェーズ

**ステータス:** **Ver2 Demo Payment Flow Complete（固定）**  
**基準仕様:** [payout-engine-v2-final-spec.md](payout-engine-v2-final-spec.md) / [payout-engine-v2-production-baseline.json](payout-engine-v2-production-baseline.json)  
**本番移行 TODO:** [TODO_FOR_PRODUCTION.md](TODO_FOR_PRODUCTION.md)（実装せず記録のみ）

**完成ドキュメント:** [README.md](README.md) · [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) · [DATA_FLOW.md](DATA_FLOW.md) · [VALIDATIONS.md](VALIDATIONS.md) · [REGRESSION_SUITE.md](REGRESSION_SUITE.md) · [CHANGELOG.md](CHANGELOG.md)

---

## 方針

Ver2 Final Spec は **変更しない**。Ver2 は **デモ支払いフローまで完成** として固定し、以降の本番送金・ETL・DB は **本番移行タスク** として分離する。

仕様を変更する場合は **Ver3** として新規作成し、Ver2 は履歴として永久保存する（上書き禁止）。

### 完成スコープ（Ver2 デモ完成版）

| # | 領域 | 状態 |
|---|------|------|
| ① | monthly-payout-decision.json | **完了** |
| ② | condition-lines.json | **完了** |
| ③ | creator-rank-explanation.json | **完了** |
| ④ | Creator Dashboard | **完了** |
| ⑤ | Admin Payouts | **完了** |
| ⑥ | 公開説明ページ | **完了** |
| ⑦ | 月次レポート | **完了**（サンプル月） |
| ⑧ | デモ支払いフロー | **完了**（Stripe API 非使用） |

**SSOT:** `monthly-payout-decision.json` → `creators[].payout_amount_yen`  
**非スコープ:** 本番 Stripe 送金・Webhook・返金・再送・append-only 監査・複数承認

---

## 実装フェーズ ① — monthly-payout-decision.json 実データ生成

**ステータス:** 実装済み（本番想定入力 → JSON 生成）

### 生成コマンド

```bash
node scripts/generate-monthly-payout-decision.mjs
```

月次ファイルを指定する場合:

```bash
node scripts/generate-monthly-payout-decision.mjs reports/tlv-business-simulator/input/monthly-revenue-2026-06.json
```

### 入力ファイル

| ファイル | 説明 |
|---------|------|
| `input/monthly-revenue-sample.json` | デフォルトの本番想定サンプル |
| `input/monthly-revenue-YYYY-MM.json` | 月次ごとの入力（任意で追加） |

入力項目: `month`, `total_revenue`, `platform_cost`, `cdn_storage_live_cost`（任意）, `payment_fee`, `reserve_amount`, `minimum_company_profit`, `operational_margin`, `creators[]`（…）

**payout_pool 算出順（固定）:** `total_revenue - payment_fee - platform_cost - reserve_amount - minimum_company_profit - operational_margin`（CDN/storage/live は `cdn_storage_live_cost` として `platform_cost` に合算）

### 出力ファイル

`output/monthly-payout-decision.json`

### 検証条件（`validations`）

| 項目 | 内容 |
|------|------|
| `guarantee_preserved` | Top/Elite 保証対象者の `applied_rate` が保証率未満でない |
| `payout_within_pool` | `payout_amount` 合計が `payout_pool` を超えない |
| `company_profit_preserved` | `final_company_profit` が `minimum_company_profit` 以上 |
| `creator_explanations_present` | 全 Creator に `creator_explanation` がある |
| `yen_integer_only` | 全 `payout_amount` が整数円 |
| `sum_matches_allocated` | Creator 合計 = `summary.total_payout` |
| `audit_present` | `audit` ブロックが存在 |
| `identity_holds` | 収支恒等式が成立 |
| `company_costs_deducted_first` | 会社経費・予備費・最低利益・運営マージンを先控除 |
| `operational_margin_preserved` | 運営マージン込みの会社側確保 |
| `payout_pool_after_company_margin` | payout_pool が会社控除後に算出 |
| `no_creator_payout_from_gross_revenue` | 総売上から直接還元していない |
| `all_pass` | 上記すべて true |

### 金融整合性

- [payout-financial-integrity.md](payout-financial-integrity.md)
- UI / Creator Dashboard / 支払 CSV / 月次レポートは **monthly-payout-decision.json の確定値のみ**（再計算禁止）
- 端数・残余は `audit` に出力

### 実装

- スクリプト: `scripts/generate-monthly-payout-decision.mjs`
- エンジン: `scripts/tlv-payout-engine.mjs`（`allocatePayouts`, `loadProductionBaseline`, `getRankRates`, `getGuaranteedRates`）

---

## 実装フェーズ ② — condition-lines.json（AI 月次判定）

**ステータス:** 実装済み（月次還元判断 → 翌月条件ライン生成）

### 生成コマンド

```bash
node scripts/generate-condition-lines.mjs
```

入力を明示する場合:

```bash
node scripts/generate-condition-lines.mjs reports/tlv-business-simulator/output/monthly-payout-decision.json
```

### 入力ファイル

| ファイル | 説明 |
|---------|------|
| `output/monthly-payout-decision.json` | フェーズ①の月次還元判断（デフォルト入力） |

### 出力ファイル

`output/condition-lines.json`

### 出力内容

- `safety_status` — `GREEN` / `CAUTION` / `RED`
- `next_month_condition_lines` — Starter / Creator / Pro / Top / Elite の翌月判定基準
- `ai_judgement` — 総合判定・リスク・推奨アクション
- `creator_guidance` — ランク別の次月向け説明

### 検証条件（`validations`）

| 項目 | 内容 |
|------|------|
| `source_loaded` | `monthly-payout-decision.json` を読み込めた |
| `baseline_loaded` | Production Baseline を読み込めた |
| `condition_lines_present` | 全ランクの条件ラインが存在する |
| `ai_does_not_change_rates` | 還元率は Baseline 参照のみ（AI は条件ラインのみ調整） |
| `all_pass` | 上記すべて true |

### 実装

- スクリプト: `scripts/generate-condition-lines.mjs`
- エンジン: `scripts/tlv-payout-engine.mjs`（`loadProductionBaseline`, `getRankRates`, `getGuaranteedRates`）

---

## 実装フェーズ ③ — creator-rank-explanation.json（Creator Dashboard 説明）

**ステータス:** 実装済み（月次確定値 + 翌月条件 → Creator 向け説明）

### 生成コマンド

```bash
node scripts/generate-creator-rank-explanation.mjs
```

前提（順に実行）:

```bash
node scripts/generate-monthly-payout-decision.mjs
node scripts/generate-condition-lines.mjs
node scripts/generate-creator-rank-explanation.mjs
```

### 入力ファイル

| ファイル | 説明 |
|---------|------|
| `output/monthly-payout-decision.json` | 支払額・適用率の**確定値**（再計算禁止） |
| `output/condition-lines.json` | 次月条件説明のみ |
| `payout-engine-v2-production-baseline.json` | ランク・保証率参照 |

### 出力ファイル

`output/creator-rank-explanation.json`

### 出力内容（Creator ごと）

- `rank_explanation` / `payout_explanation` / `adjustment_explanation`
- `next_month_guidance`（condition-lines 参照）
- `payment_notice`
- `audit` — `source_payout_amount` = `calculated_payout_amount`（再計算なし）

### 検証条件（`validations`）

| 項目 | 内容 |
|------|------|
| `monthly_source_loaded` | monthly-payout-decision を読み込めた |
| `condition_lines_loaded` | condition-lines を読み込めた |
| `baseline_loaded` | Production Baseline を読み込めた |
| `all_creators_have_explanations` | 全 Creator に 5 種の説明文がある |
| `payout_amounts_match_monthly_decision` | 支払額が 1 円単位で一致 |
| `no_dashboard_recalculation_required` | Dashboard 再計算不要構造 |
| `all_pass` | 上記すべて true |

### 実装

- スクリプト: `scripts/generate-creator-rank-explanation.mjs`
- エンジン: `scripts/tlv-payout-engine.mjs` + `scripts/tlv-payout-financial.mjs`

---

## 表示・CSV・Dashboard・レポート — 金融整合コンシューマー

**ステータス:** 実装済み（`payout_amount_yen` 確定値のみ・再計算禁止）

### 生成コマンド

```bash
node scripts/generate-payout-outputs.mjs
```

### 入力

| ファイル | 用途 |
|---------|------|
| `output/monthly-payout-decision.json` | 支払確定値 |
| `output/creator-rank-explanation.json` | Dashboard 説明文 |

### 出力

| ファイル | 用途 |
|---------|------|
| `output/admin-payout-display.json` | 管理画面 |
| `output/creator-dashboard-payout.json` | Creator Dashboard |
| `output/stripe-connect-payouts.csv` | 支払 CSV |
| `output/monthly-operator-report.md` | 月次レポート |
| `output/payout-consumer-validations.json` | 検証 |

### 検証（`validations`）

| 項目 | 内容 |
|------|------|
| `payout_display_uses_decision_amount` | 表示 = `payout_amount_yen` |
| `csv_uses_decision_amount` | CSV = 確定値 |
| `dashboard_does_not_recalculate` | Dashboard 再計算なし |
| `report_does_not_recalculate` | レポート再計算なし |
| `no_gross_times_rate_recalculation` | `gross × rate` 禁止 |
| `yen_integrity_preserved` | 1円整合 |
| `all_pass` | すべて true |

### 実装

- `scripts/tlv-payout-consumers.mjs`
- `scripts/generate-payout-outputs.mjs`

---

## 実装フェーズ ④ — Creator Dashboard（payout_amount_yen 表示）

**ステータス:** 実装済み（`creator-rank-explanation.json` 確定値のみ・再計算禁止）

| 種別 | パス |
|------|------|
| 入力 | `live/data/creator-rank-explanation.json`, `live/data/monthly-payout-decision.json` |
| UI | `live/creator-dashboard.html`, `live/tlv-creator-payout-display.js` |

```bash
node scripts/validate-creator-dashboard-payout-phase4.mjs
```

---

## 実装フェーズ ⑤ — 管理画面 TLV 月次還元一覧

**ステータス:** 実装済み（全 Creator 一覧・CSV・`payout_amount_yen` 確定値のみ）

| 種別 | パス |
|------|------|
| 入力 | `live/data/monthly-payout-decision.json`, `live/data/creator-rank-explanation.json` |
| UI | `live/admin-payouts.html`, `live/live-admin-payouts.js` |
| 検証 | `scripts/validate-admin-payouts-phase5.mjs` |

```bash
node scripts/generate-monthly-payout-decision.mjs
node scripts/generate-condition-lines.mjs
node scripts/generate-creator-rank-explanation.mjs
node scripts/validate-admin-payouts-phase5.mjs
```

### 検証（`validations`）

| 項目 | 内容 |
|------|------|
| `admin_display_matches_decision_json` | 表示 = JSON `payout_amount_yen` |
| `payout_amount_yen_sum_matches_total_payout` | 合計 = `summary.total_payout` |
| `csv_uses_payout_amount_yen` | CSV = 確定値 |
| `no_payout_recalculation_in_admin_module` | `gross × rate` 禁止 |
| `all_pass` | すべて true |

### 実装

- `scripts/tlv-admin-payout-display.mjs`
- `live/live-admin-payouts.js`

---

## 実装フェーズ ⑥ — 公開説明ページ（payout-policy.html）

**ステータス:** 実装済み（Creator 向け静的説明・還元計算なし）

| 種別 | パス |
|------|------|
| ページ | `live/payout-policy.html` |
| スタイル | `live/live.css`（`.tlv-payout-policy`） |
| 検証 | `scripts/validate-payout-policy-phase6.mjs` |

```bash
node scripts/validate-payout-policy-phase6.mjs
```

### 検証（`validations`）

| 項目 | 内容 |
|------|------|
| `payout_amount_yen_documented_as_final` | 支払確定値として明記 |
| `gross_times_rate_not_payment_explanation` | 支払額の説明にしない |
| `deduction_order_correct` | Production Baseline 控除順序 |
| `ai_does_not_change_rates_documented` | AI は説明・判定のみ |
| `no_payout_calculation_js` | JS 還元計算なし |
| `responsive_768` / `responsive_390` | レスポンシブ CSS |

---

## 実装フェーズ ⑦ — 月次レポート（運営・監査）

**ステータス:** 実装済み（確定 JSON 集約・再計算禁止）

| 種別 | パス |
|------|------|
| 入力 | `live/data/monthly-payout-decision.json`, `creator-rank-explanation.json`, `condition-lines.json` |
| 出力 | `output/monthly-report.json`, `.md`, `.csv` |
| 検証 | `scripts/validate-monthly-report-phase7.mjs` |

```bash
node scripts/generate-monthly-report.mjs
node scripts/validate-monthly-report-phase7.mjs
```

---

## デモ支払いフロー — Stripe テスト送金直前まで

**ステータス:** 実装済み（**Stripe API 非使用・本番送金なし**）

| 種別 | パス |
|------|------|
| Connect 口座（デモ） | `live/data/tlv-stripe-connect-accounts.json` |
| 支払履歴（デモ） | `output/payment-history.json` → `live/data/payment-history.json` |
| Stripe CSV | `output/stripe-connect-payouts.csv`（`stripe_connect_account_id` 付き） |
| ロジック | `scripts/tlv-demo-payment-flow.mjs` |
| 検証 | `scripts/validate-demo-payment-flow.mjs` |

```bash
node scripts/generate-payout-outputs.mjs
node scripts/validate-demo-payment-flow.mjs
```

### 支払状態（4種・表示のみ）

`unpaid` / `processing` / `completed` / `failed`  
初期生成時はすべて `unpaid`（テスト送金直前）。

### 検証（`validations`）

| 項目 | 内容 |
|------|------|
| `csv_has_stripe_connect_account_id` | CSV に Connect ID あり |
| `payment_history_generated` | payment-history.json 生成 |
| `csv_payout_amount_yen_matches_decision` | SSOT 一致 |
| `no_payout_recalculation_in_demo_module` | 再計算コードなし |
| `demo_mode_no_stripe_api` | `stripe_api_used: false` |
| `all_pass` | すべて true |

### UI 表示

- Admin: `live/live-admin-payouts.js` — Connect Account・支払状態列
- Creator Dashboard: `live/tlv-creator-payout-display.js` — 支払状態・Connect 表示

---

## 実装対象（全体）

| # | 対象 | 説明 | 主な成果物 | 状態 |
|---|------|------|-----------|------|
| ① | 実データ生成 | 本番想定入力から月次判断を生成 | `output/monthly-payout-decision.json` | **完了** |
| ② | AI 月次判定 | 条件ライン・安全判定 | `output/condition-lines.json` | **完了** |
| ③ | Creator 向け還元説明 | ランク・還元率・保証説明 | `output/creator-rank-explanation.json` | **完了** |
| ④ | Creator Dashboard | `payout_amount_yen` 確定値表示 | `live/tlv-creator-payout-display.js` | **完了** |
| ⑤ | 管理画面 | 全 Creator 月次還元一覧・CSV | `live/admin-payouts.html` | **完了** |
| ⑥ | 公開説明ページ | Creator 向け還元ポリシー | `live/payout-policy.html` | **完了** |
| ⑦ | 月次レポート | 運営・監査レポート JSON/MD/CSV | `output/monthly-report.*` | **完了** |
| ⑧ | デモ支払いフロー | Connect ID・payment-history・CSV | `payment-history.json` 等 | **完了** |

**本番移行（未着手）:** [TODO_FOR_PRODUCTION.md](TODO_FOR_PRODUCTION.md)

---

## 品質ルール

1. **Single Source of Truth** — `payout-engine-v2-production-baseline.json` を参照する
2. **ハードコード禁止** — 保証率・ランク・判定順・残余プールをコード側で別定義しない
3. **金融正本** — UI / Dashboard / CSV / 月次レポートは `monthly-payout-decision.json` の確定値のみ（[payout-financial-integrity.md](payout-financial-integrity.md)）
4. **一致要件** — Ver2 Final Spec の内容と実装結果（JSON / API / UI 表示）が一致すること
5. **再生成** — `node scripts/generate-tlv-business-simulator.mjs` で検証可能であること

---

## コード参照

```javascript
import {
  loadProductionBaseline,
  getRankRates,
  getGuaranteedRates,
  runPayoutDecision,
} from "../scripts/tlv-payout-engine.mjs";

const baseline = loadProductionBaseline();
// baseline.rank_system, baseline.two_layer_allocation, baseline.public_marketing_copy
```

---

## 完了条件（Ver2 Demo Payment Flow Complete）

- [x] ① monthly-payout-decision.json の実データ生成（サンプル入力）
- [x] ② condition-lines.json の AI 月次判定
- [x] ③ creator-rank-explanation.json の Creator 向け説明
- [x] ④ Creator Dashboard（payout_amount_yen 表示）
- [x] ⑤ 管理画面 TLV 月次還元一覧
- [x] ⑥ 公開説明ページ payout-policy.html
- [x] ⑦ 月次レポート（JSON / MD / CSV）
- [x] ⑧ デモ支払いフロー（Connect ID・payment-history・CSV・支払状態表示）
- [x] 全フェーズ検証 `validations.all_pass: true`（サンプル月 2026-05）
- [x] `identity_holds: true`・consumer validations PASS
- [x] 還元ロジックは `payout-engine-v2-production-baseline.json` 参照（ランク・保証率ハードコードなし）

### 正式 Regression Suite

変更時・リリース前は **[REGRESSION_SUITE.md](REGRESSION_SUITE.md)** の全コマンドを実行し、PASS 条件を満たすこと。

*Ver2 は Production Baseline + Demo Payment Flow Complete として固定済み。本番送金以降は [TODO_FOR_PRODUCTION.md](TODO_FOR_PRODUCTION.md) を参照。*
