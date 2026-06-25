# AI 収益分配エンジン Ver2

**実装:** `scripts/tlv-payout-engine.mjs`（`ENGINE_VERSION = 2.0`）

**重要:** 本番送金機能ではありません。Stripe API は呼び出しません。

---

## 設計思想

> 会社利益の最大化ではなく、**会社を維持できる利益を確保したうえで、成果を出したクリエイターへ最大限還元すること**

- 全クリエイター同一還元率は **禁止**
- 毎月固定 ○% は **禁止**
- AI が毎月変更するのは **還元率ではなく「条件ライン」**
- Top Creator（70%）/ Elite Creator（80%）は条件達成者のみ、**達成後は還元率を保証**

---

## 1. 処理フロー

```
月次収支入力
    ↓
会社経費を先に計算（Cloudflare / Stripe / AI / 固定費 / 積立 / 最低利益）
    ↓
payout_pool 算出
    ↓
AI: 条件ライン調整（収支に応じて Top/Elite の閾値・人数上限）
    ↓
クリエイター個別にランク判定 → 個別還元率
    ↓
特別ランクは保証還元 / 一般ランクはプール内で配分
    ↓
JSON / CSV / Markdown / Excel 出力
```

---

## 2. 会社側の安全判定

```
gross_revenue         = total_ad_revenue
total_cost            = cloudflare + ai + stripe + fixed_operation
required_company_keep = minimum_company_profit + tax + development + emergency
payout_pool           = max(0, gross - total_cost - required_company_keep)
profit_after_payout   = profit_before_payout - total_payout
```

| safety_status | 意味 |
|---------------|------|
| SAFE | 余裕あり |
| CAUTION | 黒字だが余裕少 |
| DANGER | 最低利益未達リスク |
| RED | 赤字 |

---

## 3. 出力

| ファイル | 内容 |
|---------|------|
| `output/monthly-payout-decision.json` | 月次判断（Ver2 スキーマ） |
| `output/condition-lines.json` | AI 条件ライン |
| `output/rank-progress.json` | 次ランクまでのギャップ |
| `output/stripe-connect-payouts.csv` | 送金候補 |
| `output/monthly-operator-report.md` | 運営レポート |

再生成:

```bash
node scripts/generate-tlv-business-simulator.mjs
```

---

## 4. レポート項目

- 各ランク条件（`condition-lines.json`）
- 70% / 80% 到達条件（`high-payout-threshold-analysis.md`）
- あといくらで次ランクか（`rank-progress.json`）
- 会社利益維持時の最大還元率（`max_platform_payout_rate`）
- Top Creator / Elite 人数シミュレーション（`headcount_simulation`）

関連: [creator-rank-policy-v2.md](creator-rank-policy-v2.md)
