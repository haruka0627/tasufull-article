# TLV AI 収益分配エンジン Ver2

**ステータス:** Ver2 Demo Payment Flow Complete（固定）  
**最終更新:** 2026-06

---

## TLV AI 収益分配エンジンとは

TASFUL LIVE（TLV）の **月次収益を、段階制ランクと条件保証に基づいて Creator へ還元する** ためのオフライン計算・開示システムです。

- **AI の役割:** 還元率の恣意的決定はしない。翌月の条件ライン・安全判定・Creator 向けガイダンスの生成のみ。
- **還元の原則:** 全員同一還元率・毎月固定○%は禁止。会社経費を先に控除し、残り（payout pool）の範囲で分配。
- **Ver2 の位置づけ:** 月次還元の **計算・確定・開示・デモ支払いデータ生成** まで完成。**本番 Stripe 送金は含まない。**

正式仕様は [payout-engine-v2-final-spec.md](payout-engine-v2-final-spec.md)。ランク・保証率のコード参照元は [payout-engine-v2-production-baseline.json](payout-engine-v2-production-baseline.json)（**上書き禁止**）。

---

## 目的

| 目的 | 説明 |
|------|------|
| 月次還元の確定 | 売上・コスト・Creator 実績から `payout_amount_yen` を整数円で確定 |
| 透明な開示 | Creator Dashboard・公開説明ページで還元の仕組みと確定額を表示 |
| 運営・監査 | 管理画面・月次レポート・CSV で運営者が確認可能 |
| デモ支払い準備 | Connect 口座マップ・payment-history・Stripe 送金候補 CSV まで生成 |
| 整合性保証 | 全フェーズの Validation で SSOT・再計算禁止を機械検証 |

---

## 全体構成

```
売上入力 (JSON)
    ↓
AI 収益分配エンジン (tlv-payout-engine.mjs)
    ↓
monthly-payout-decision.json  ←── SSOT（payout_amount_yen）
    ↓
condition-lines.json（翌月条件・安全判定）
    ↓
creator-rank-explanation.json（Creator 向け説明）
    ↓
┌──────────────┬──────────────┬──────────────┐
│ Dashboard    │ Admin        │ 公開説明     │
│ CSV / レポート│ payment-history│            │
└──────────────┴──────────────┴──────────────┘
    ↓
Demo Payment Flow（Stripe テスト送金直前）
    ↓
Stripe API（将来・未実装）
```

詳細図: [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)  
データの流れ: [DATA_FLOW.md](DATA_FLOW.md)

---

## フォルダ構成

```
reports/tlv-business-simulator/
├── README.md                          ← 本書（入口）
├── SYSTEM_ARCHITECTURE.md             ← 全体アーキテクチャ
├── DATA_FLOW.md                       ← JSON の役割・SSOT
├── REGRESSION_SUITE.md                ← **正式 Regression Test Suite**
├── VALIDATIONS.md                     ← 検証一覧
├── TODO_FOR_PRODUCTION.md             ← 本番移行 TODO（未実装）
├── CHANGELOG.md                       ← Ver2 完成までの履歴
├── payout-engine-v2-production-baseline.json  ← ランク・保証率 SSOT
├── payout-engine-v2-final-spec.md     ← 正式仕様（人間可読）
├── payout-financial-integrity.md      ← 金融整合性ルール
├── payout-engine-v2-implementation-phase.md   ← 実装フェーズ記録
├── input/
│   └── monthly-revenue-sample.json    ← 月次売上入力（デモ）
└── output/                            ← 生成物（JSON / CSV / MD）

scripts/
├── tlv-payout-engine.mjs              ← 分配エンジン本体
├── tlv-payout-financial.mjs           ← 1円整合・audit
├── tlv-payout-consumers.mjs           ← 表示・CSV コンシューマー
├── tlv-demo-payment-flow.mjs          ← デモ支払いフロー
├── tlv-admin-payout-display.mjs       ← 管理画面検証用
├── tlv-monthly-report.mjs             ← 月次レポート
├── generate-monthly-payout-decision.mjs   ← フェーズ①
├── generate-condition-lines.mjs           ← フェーズ②
├── generate-creator-rank-explanation.mjs  ← フェーズ③
├── generate-payout-outputs.mjs            ← コンシューマー + デモ支払い
├── generate-monthly-report.mjs            ← フェーズ⑦
├── validate-creator-dashboard-payout-phase4.mjs
├── validate-admin-payouts-phase5.mjs
├── validate-payout-policy-phase6.mjs
├── validate-monthly-report-phase7.mjs
└── validate-demo-payment-flow.mjs

live/
├── data/                              ← サイトが fetch する確定 JSON
│   ├── monthly-payout-decision.json
│   ├── condition-lines.json
│   ├── creator-rank-explanation.json
│   ├── payment-history.json
│   ├── tlv-stripe-connect-accounts.json
│   └── tlv-payout-creator-map.json
├── tlv-creator-payout-display.js      ← Creator Dashboard 表示
├── live-admin-payouts.js              ← 管理画面
├── admin-payouts.html
├── payout-policy.html                 ← 公開説明（静的）
└── live.css
```

---

## Regression Test Suite

**TLV AI 収益分配エンジン Ver2 の正式 Regression Suite**

エンジン・スクリプト・表示層を変更した際は、以下を **すべて** 実行し PASS させること。

```bash
node scripts/generate-monthly-payout-decision.mjs
node scripts/generate-condition-lines.mjs
node scripts/generate-creator-rank-explanation.mjs
node scripts/generate-payout-outputs.mjs
node scripts/generate-monthly-report.mjs
node scripts/validate-creator-dashboard-payout-phase4.mjs
node scripts/validate-admin-payouts-phase5.mjs
node scripts/validate-payout-policy-phase6.mjs
node scripts/validate-monthly-report-phase7.mjs
node scripts/validate-demo-payment-flow.mjs
```

### PASS 条件（要約）

| 条件 | 必須 |
|------|------|
| `validations.all_pass = true` | 全 validate スクリプト |
| `consumer validations.all_pass = true` | Phase 4 / 5 / 7 |
| `identity_holds = true` | decision audit |
| `payout_amount_yen` SSOT 一致 | 全コンシューマー |
| Dashboard / Admin / CSV / Monthly Report / Demo Payment 一致 | 各 Phase 検証 |
| Stripe API 非呼び出し | `payment-history.json` → `stripe_api_used: false` |

**詳細・実行タイミング・出力ファイル:** [REGRESSION_SUITE.md](REGRESSION_SUITE.md)  
**各検証フラグの定義:** [VALIDATIONS.md](VALIDATIONS.md)

---

## 実行手順

### 前提

- Node.js が利用できること
- リポジトリルートで実行すること

### 月次パイプライン（生成のみ）

Regression Suite の生成部分。検証は [Regression Test Suite](#regression-test-suite) を参照。

**順序を守ること。** ②は①、③は①②の出力に依存します。

```bash
# ① 月次還元判断（SSOT 生成）
node scripts/generate-monthly-payout-decision.mjs

# ② 翌月条件ライン・AI 月次判定
node scripts/generate-condition-lines.mjs

# ③ Creator 向け説明
node scripts/generate-creator-rank-explanation.mjs

# コンシューマー出力 + デモ支払い（CSV, payment-history）
node scripts/generate-payout-outputs.mjs

# ⑦ 月次レポート（運営・監査）
node scripts/generate-monthly-report.mjs
```

月次入力を差し替える場合:

```bash
node scripts/generate-monthly-payout-decision.mjs reports/tlv-business-simulator/input/monthly-revenue-YYYY-MM.json
```

### 検証のみ（生成済みの場合）

生成をスキップする場合は validate コマンドのみ実行可。通常は [Regression Test Suite](#regression-test-suite) の全手順を推奨。

### ローカルサイト確認

```bash
npm run build:pages
npm run dev
```

- トップ: `http://127.0.0.1:8788/`
- Creator: `http://127.0.0.1:8788/live/creator-dashboard.html`
- 管理: `http://127.0.0.1:8788/live/admin-payouts.html`
- 公開説明: `http://127.0.0.1:8788/live/payout-policy.html`

---

## 生成物

| ファイル | フェーズ | 用途 |
|---------|---------|------|
| `output/monthly-payout-decision.json` | ① | **支払 SSOT**（`payout_amount_yen`） |
| `output/condition-lines.json` | ② | 翌月条件・安全判定 |
| `output/creator-rank-explanation.json` | ③ | Creator 説明・payment_notice |
| `output/admin-payout-display.json` | コンシューマー | 管理画面用中間 JSON |
| `output/creator-dashboard-payout.json` | コンシューマー | Dashboard 用中間 JSON |
| `output/stripe-connect-payouts.csv` | デモ支払い | Stripe 送金候補（API 非使用） |
| `output/payment-history.json` | デモ支払い | 支払状態（`unpaid` 等） |
| `output/monthly-operator-report.md` | コンシューマー | 運営サマリー MD |
| `output/monthly-report.json` / `.md` / `.csv` | ⑦ | 運営・監査レポート |
| `output/payout-consumer-validations.json` | 検証 | コンシューマー整合結果 |
| `output/*-validations.json` | 検証 | 各フェーズ検証結果 |
| `live/data/*.json` | 同期 | フロントが fetch する正本コピー |

---

## 検証方法

| 検証 | コマンド | 保証内容（要約） |
|------|---------|----------------|
| Phase 4 | `validate-creator-dashboard-payout-phase4.mjs` | Dashboard が SSOT を再計算せず表示 |
| Phase 5 | `validate-admin-payouts-phase5.mjs` | 管理画面・CSV が SSOT と一致 |
| Phase 6 | `validate-payout-policy-phase6.mjs` | 公開ページに還元計算 JS なし |
| Phase 7 | `validate-monthly-report-phase7.mjs` | 月次レポートが SSOT と一致 |
| Demo Payment | `validate-demo-payment-flow.mjs` | CSV・payment-history・Connect ID |
| Decision 内蔵 | `monthly-payout-decision.json` → `validations` | 分配ロジック・`identity_holds` |
| Consumer | `payout-consumer-validations.json` | 全コンシューマーの SSOT 遵守 |

詳細: [VALIDATIONS.md](VALIDATIONS.md)

---

## 重要ルール（保守時）

1. **支払 SSOT:** `monthly-payout-decision.json` → `creators[].payout_amount_yen` のみ。UI / CSV / レポートで再計算禁止。
2. **Baseline 参照:** ランク・保証率は `payout-engine-v2-production-baseline.json` のみ。コードにハードコードしない。
3. **Ver2 固定:** 仕様変更は Ver3 として新規作成。Ver2 は上書きしない。
4. **本番送金:** [TODO_FOR_PRODUCTION.md](TODO_FOR_PRODUCTION.md) を参照。Ver2 スコープ外。

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [REGRESSION_SUITE.md](REGRESSION_SUITE.md) | **正式 Regression Test Suite** |
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | 全体フロー・コンポーネント図 |
| [DATA_FLOW.md](DATA_FLOW.md) | 各 JSON の入出力・更新タイミング |
| [VALIDATIONS.md](VALIDATIONS.md) | 全 Validation の意味 |
| [TODO_FOR_PRODUCTION.md](TODO_FOR_PRODUCTION.md) | 本番移行 TODO |
| [CHANGELOG.md](CHANGELOG.md) | Ver2 完成履歴 |
| [payout-financial-integrity.md](payout-financial-integrity.md) | 1円整合・audit 詳細 |
| [payout-engine-v2-implementation-phase.md](payout-engine-v2-implementation-phase.md) | 実装フェーズ①〜⑧記録 |

### 参考（シミュレーター・経営分析）

運営収支シミュレーター（Excel / コストモデル等）は Ver2 エンジンと並存します。

- [cost-model.md](cost-model.md) · [revenue-model.md](revenue-model.md) · [summary.md](summary.md)
- `node scripts/generate-tlv-business-simulator.mjs` — レガシー一括生成
