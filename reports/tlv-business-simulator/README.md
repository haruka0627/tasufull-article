# TLV 運営収支シミュレーター / AI 収益分配エンジン Ver2

**ステータス:** **Production Baseline（正式版）** — 仕様固定済み・実装フェーズ移行

**目的:** TLV の月次収支から、**段階制＋条件保証**の個別還元・条件ライン・運営安全性を算出する。

**Ver2 方針:** 全員同一還元率・毎月固定○%は禁止。AI は **条件ライン算出・利益シミュレーション・安全判定** のみ担当。還元率を AI が恣意的に決定しない。

**基準仕様（SSOT）:**

| ファイル | 役割 |
|---------|------|
| [payout-engine-v2-production-baseline.json](payout-engine-v2-production-baseline.json) | **コード参照用・上書き禁止** |
| [payout-engine-v2-final-spec.md](payout-engine-v2-final-spec.md) | 人間可読の正式仕様 |
| `output/payout-engine-v2-final-spec.json` | 仕様 + 直近検証スナップショット |
| Excel `PayoutEngineV2Spec` | 仕様サマリー |

**ガバナンス:** Ver2 は永久保存。仕様変更は **Ver3** として新規作成（Ver2 上書き禁止）。以降は実装・接続・UI・運用のみ。

**実装フェーズ:** [payout-engine-v2-implementation-phase.md](payout-engine-v2-implementation-phase.md)

**重要:** 本ツールは本番送金機能ではありません。Stripe API は呼び出しません。

---

## ファイル構成

| ファイル | 内容 |
|---------|------|
| [README.md](README.md) | 本書（使い方） |
| [cost-model.md](cost-model.md) | Cloudflare 等コストモデル |
| [revenue-model.md](revenue-model.md) | 広告収益モデル |
| [creator-share-simulation.md](creator-share-simulation.md) | 分配率 40–80% シミュレーション |
| [break-even-analysis.md](break-even-analysis.md) | 損益分岐点 |
| [summary.md](summary.md) | 経営判断・推奨還元率 |
| [payout-decision-engine.md](payout-decision-engine.md) | AI 収益分配エンジン Ver2 |
| [creator-rank-policy-v2.md](creator-rank-policy-v2.md) | ランク・条件保証ポリシー |
| [creator-tier-policy.md](creator-tier-policy.md) | Ver1 記録（参照用） |
| [stripe-connect-payout-plan.md](stripe-connect-payout-plan.md) | Stripe Connect 送金候補 CSV 設計 |
| [monthly-operator-report-sample.md](monthly-operator-report-sample.md) | 運営レポート構成サンプル |
| [high-payout-threshold-analysis.md](high-payout-threshold-analysis.md) | 高還元（60〜80%）逆算レポート |
| [payout-engine-v2-final-spec.md](payout-engine-v2-final-spec.md) | **Ver2 Production Baseline（正式仕様）** |
| [payout-engine-v2-production-baseline.json](payout-engine-v2-production-baseline.json) | **SSOT（コード参照・上書き禁止）** |
| [payout-financial-integrity.md](payout-financial-integrity.md) | **金融計算整合性（1円単位・audit）** |
| [payout-engine-v2-implementation-phase.md](payout-engine-v2-implementation-phase.md) | 実装フェーズ計画 |
| [tlv-business-simulator.xlsx](tlv-business-simulator.xlsx) | Excel 版（入力変更可） |
| [output/](output/) | JSON / CSV / Markdown 月次出力 |
| [input/](input/) | 実装フェーズ① 月次収支入力 |

---

## 使い方

### 1. Excel（推奨）

`tlv-business-simulator.xlsx` を開き、**Inputs** シートの黄色相当列（備考「変更可」）を編集する。

再計算が必要な場合:

```bash
node scripts/generate-tlv-business-simulator.mjs
```

（`npm install xlsx --save-dev` が必要な場合あり）

### 2. Markdown レポート

ベースケースの数値・根拠は各 `.md` を参照。Excel と整合する。

---

## シミュレーション対象

| # | 種別 | シート / 章 |
|---|------|------------|
| ① | ショート動画 | `By_Type` / cost-model §3.1 |
| ② | 通常動画 | `By_Type` / cost-model §3.2 |
| ③ | ライブ配信 | `By_Type` / cost-model §3.3 |

---

## 入力項目（変更可）

- 動画本数・平均時間・ファイルサイズ・視聴時間・再生率
- 月間再生数 / ライブ視聴時間・同時視聴数
- 広告 CPM・CTR・広告収益（手入力上書き可）
- Cloudflare: Workers / R2 / KV / D1 / DO / Images
- AI 利用料・Stripe 手数料・固定費
- 広告分配率（Creator_Share シートで 40–80% 自動）

---

## 出力（毎月 P&L）

```
広告収入
動画配信コスト
ライブ配信コスト
ストレージ
API
AI
固定費
Stripe
================
利益（分配前）
```

→ **Monthly_PL** シート / [summary.md](summary.md)

---

## 分配率・将来予測・ライブ規模

| 分析 | シート / ドキュメント |
|------|---------------------|
| 40–80% 還元 | `Creator_Share` / creator-share-simulation.md |
| 損益分岐 | `Break_Even` / break-even-analysis.md |
| 1万–1000万再生/月 | `Scale_Views` / summary.md |
| 同時視聴 10–10000 | `Scale_Live` / break-even-analysis.md |
| 推奨還元率 | `Recommendation` / summary.md |

---

## 料金前提

Cloudflare 公式料金（2026 年時点）を USD 単価で記載。為替は **Inputs** で変更。

| サービス | 参照 |
|---------|------|
| Workers | https://developers.cloudflare.com/workers/platform/pricing/ |
| R2 | https://developers.cloudflare.com/r2/pricing/ |
| KV | https://developers.cloudflare.com/kv/platform/pricing/ |
| D1 / DO | Workers pricing ページ内 |

変動しやすい項目はすべて Inputs で上書き可能。

---

## 運営方針との関係

ひろ氏方針: **利益最大化ではなくクリエイターへ最大還元**

本シミュレーターは以下を一目で示す:

| ゾーン | 意味 |
|--------|------|
| **安全圏** | 黒字維持 + 還元余地あり |
| **推奨** | 還元と黒字のバランス点 |
| **危険圏** | 還元率過多または規模不足で赤字 |

詳細: [summary.md](summary.md)

---

## 実装フェーズ ① — monthly-payout-decision.json

本番想定入力から月次還元判断 JSON を生成します（Production Baseline 参照・ハードコードなし）。

```bash
node scripts/generate-monthly-payout-decision.mjs
```

| 種別 | パス |
|------|------|
| 入力（デフォルト） | `input/monthly-revenue-sample.json` |
| 入力（月次） | `input/monthly-revenue-YYYY-MM.json` |
| 出力 | `output/monthly-payout-decision.json` |
| 基準 | `payout-engine-v2-production-baseline.json` |

検証: 出力 JSON の `validations.all_pass` が `true` であること。詳細は [payout-engine-v2-implementation-phase.md](payout-engine-v2-implementation-phase.md)。

**金融整合性:** [payout-financial-integrity.md](payout-financial-integrity.md) — UI / Dashboard / CSV / 月次レポートは `monthly-payout-decision.json` の確定値のみ参照（再計算禁止）。`audit` ブロックに端数・残余を記録。

---

## 実装フェーズ ② — condition-lines.json（AI 月次判定）

`monthly-payout-decision.json` の結果から、翌月の条件ライン・安全判定・Creator Guidance を生成します。

```bash
node scripts/generate-condition-lines.mjs
```

| 種別 | パス |
|------|------|
| 入力 | `output/monthly-payout-decision.json` |
| 出力 | `output/condition-lines.json` |
| 基準 | `payout-engine-v2-production-baseline.json` |

検証: `validations.all_pass` が `true`・還元率は Baseline 参照のみ（`ai_does_not_change_rates`）。

---

## 実装フェーズ ③ — creator-rank-explanation.json

Creator Dashboard 向け説明。支払額は **monthly-payout-decision.json の確定値のみ**（再計算禁止）。

```bash
node scripts/generate-creator-rank-explanation.mjs
```

| 種別 | パス |
|------|------|
| 入力 | `output/monthly-payout-decision.json`, `output/condition-lines.json` |
| 出力 | `output/creator-rank-explanation.json` |
| 基準 | `payout-engine-v2-production-baseline.json` |

検証: `payout_amounts_match_monthly_decision`・`no_dashboard_recalculation_required`・`all_pass: true`

---

## 実装フェーズ ④ — Creator Dashboard（payout_amount_yen 表示）

Creator Dashboard に `creator-rank-explanation.json` の確定値を表示（再計算禁止）。

| 種別 | パス |
|------|------|
| 入力 | `live/data/creator-rank-explanation.json`, `live/data/monthly-payout-decision.json` |
| UI | `live/creator-dashboard.html`, `live/tlv-creator-payout-display.js` |

```bash
node scripts/validate-creator-dashboard-payout-phase4.mjs
```

---

## 実装フェーズ ⑤ — 管理画面 TLV 月次還元一覧

運営者が全 Creator の月次還元確定値を確認。`payout_amount_yen` のみ表示・CSV出力（再計算禁止）。

| 種別 | パス |
|------|------|
| 入力 | `live/data/monthly-payout-decision.json`, `live/data/creator-rank-explanation.json` |
| UI | `live/admin-payouts.html`, `live/live-admin-payouts.js` |

```bash
node scripts/generate-monthly-payout-decision.mjs
node scripts/generate-condition-lines.mjs
node scripts/generate-creator-rank-explanation.mjs
node scripts/validate-admin-payouts-phase5.mjs
```

検証: 表示・CSV が JSON の `payout_amount_yen` と 1 円単位で一致・`validations.all_pass: true`

---

## 実装フェーズ ⑥ — 公開説明ページ（payout-policy.html）

Creator・ユーザー向けに TLV 月次還元の仕組みを説明（還元計算なし・静的ページ）。

| 種別 | パス |
|------|------|
| ページ | `live/payout-policy.html` |
| 検証 | `scripts/validate-payout-policy-phase6.mjs` |

```bash
node scripts/validate-payout-policy-phase6.mjs
```

URL: `/live/payout-policy.html`

---

## 表示・CSV・Dashboard・レポート（金融整合コンシューマー）

支払額は **`decision.creators[].payout_amount_yen` のみ**。再計算禁止。

```bash
node scripts/generate-payout-outputs.mjs
```

| 出力 | 用途 |
|------|------|
| `output/admin-payout-display.json` | 管理画面 |
| `output/creator-dashboard-payout.json` | Creator Dashboard |
| `output/stripe-connect-payouts.csv` | 支払 CSV |
| `output/payout-consumer-validations.json` | 整合検証 |

詳細: [payout-financial-integrity.md](payout-financial-integrity.md)

---

## 月次還元判断（Ver2 シミュレーター）

```bash
node scripts/generate-tlv-business-simulator.mjs
```

### 出力

| ファイル | 内容 |
|---------|------|
| `output/monthly-payout-decision.json` | 月次判断（Ver2） |
| `output/condition-lines.json` | AI 条件ライン |
| `output/rank-progress.json` | 次ランクまでのギャップ |
| `output/residual-pool-allocation.json` | 保証後残余プール配分 |
| `output/creator-rank-explanation.json` | Creator 向けランク説明 |
| [residual-pool-allocation.md](residual-pool-allocation.md) | 残余プール配分レポート |
| [creator-rank-explanation.md](creator-rank-explanation.md) | Creator 向けランク説明 |
| `output/payout-engine-v2-final-spec.json` | Ver2 最終固定仕様 JSON |
| [payout-engine-v2-final-spec.md](payout-engine-v2-final-spec.md) | Ver2 最終固定仕様 |
| `output/stripe-connect-payouts.csv` | Stripe Connect 送金**候補**（実送金なし） |
| `output/monthly-operator-report.md` | 運営者向けレポート |
| `output/high-payout-thresholds.json` | 高還元逆算 JSON |
| `high-payout-threshold-analysis.md` | インフルエンサー向け逆算レポート |

### Excel 追加シート

| シート | 内容 |
|--------|------|
| `PayoutDecision` | 会社側安全判定・還元プール |
| `CreatorRanks` | クリエイター別ランク・個別還元 |
| `ConditionLines` | AI 条件ライン |
| `RankProgress` | 次ランクギャップ |
| `ResidualPoolAllocation` | 保証後残余プール配分（明細） |
| `ResidualPoolSummary` | 残余プール配分サマリー |
| `CreatorRankExplanation` | Creator 向けランク説明 |
| `PayoutEngineV2Spec` | **Ver2 Production Baseline** |
| `StripeConnectExport` | 送金候補行 |
| `OperatorReport` | 運営サマリー |
| `HighPayoutThresholds` | 60〜80% 必要売上逆算 |

### 外部公開方針

`payout-engine-v2-production-baseline.json` の `public_marketing_copy` を参照（ハードコード禁止）。

- 「**成果に応じた段階制の収益還元**」
- 「**Top Creator は最大70%**」（条件達成者のみ）
- 「**Elite Creator は最大80%も可能**」（条件達成者のみ）
- 会社収支・運営コスト・適用条件に基づき算出
- 毎月固定の還元率はない

### 品質ルール

- 保証率・ランク・判定順・残余プールをコード側で別定義しない
- すべて `payout-engine-v2-production-baseline.json` を参照
- 再生成後、検証 `all_pass: true` であること

詳細: [creator-rank-policy-v2.md](creator-rank-policy-v2.md) / [payout-decision-engine.md](payout-decision-engine.md) / [payout-engine-v2-final-spec.md](payout-engine-v2-final-spec.md)

---

## 再生成

```bash
node scripts/generate-tlv-business-simulator.mjs
```

生成物:

- `reports/tlv-business-simulator/tlv-business-simulator.xlsx`
- `reports/tlv-business-simulator/output/*`
