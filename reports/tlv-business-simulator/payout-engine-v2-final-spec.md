# TLV AI 収益分配エンジン Ver2 — Production Baseline（正式版）

**仕様バージョン:** 2.0-final | **エンジン:** 2.0 | **ステータス:** production_baseline | **生成日:** 2026-06-25

> TLV AI 収益分配エンジン Ver2 の唯一の基準仕様（Production Baseline）。上書き禁止。変更は Ver3 として新規作成すること。

---

## 0. ガバナンス（Single Source of Truth）

**Ver2 は Production Baseline として固定済み。上書き禁止。**

### SSOT
- `reports/tlv-business-simulator/payout-engine-v2-production-baseline.json`
- `reports/tlv-business-simulator/payout-engine-v2-final-spec.md`
- `reports/tlv-business-simulator/output/payout-engine-v2-final-spec.json`
- `reports/tlv-business-simulator/tlv-business-simulator.xlsx — シート PayoutEngineV2Spec`

**変更ポリシー:** Ver2 は永久保存。仕様変更は Ver3 として新規作成。Ver2 の上書きは禁止。

**以降の作業:** 実装・接続・UI・運用 のみ

**コードルール:** 保証率・ランク・判定順・残余プールをコード側で別定義しない。本ファイルを参照すること。ハードコード禁止。

---

## 1. 基本思想

**目的:** 会社を維持できる利益を確保したうえで、成果を出したクリエイターへ最大限還元すること

**目的ではないこと:** 会社利益の最大化

- 固定還元率なし
- 全員同一還元率なし
- 成果・貢献度・月次収支に応じた段階制
- 会社維持に必要な利益を先に確保
- 残りを可能な限りクリエイターへ還元

---

## 2. ランク体系

| ランク | 還元率 | 層 | 保証 |
|--------|--------|-----|------|
| Starter | 28% | variable | — |
| Creator | 38% | variable | — |
| Pro | 48% | variable | — |
| Top Creator | 70% | guaranteed | YES |
| Elite Creator | 80% | guaranteed | YES |

---

## 3. 2層配分構造

### 保証層
- 対象: Top Creator、Elite Creator
- Top Creator: 70% / Elite Creator: 80%
- 条件達成者のみ。先に控除。還元率は引き下げない。

### 変動層
- 対象: Starter、Creator、Pro
- Starter 28% / Creator 38% / Pro 48%
- 残余プールから配分。月次収支により adjusted_rate が変動し得る。

### フロー
1. payout_pool 算出（会社費用・積立・最低利益を先に確保）
1. 保証層（Top/Elite）支払いを先に控除
1. 残余プールを変動層（Starter/Creator/Pro）へ配分

---

## 4. 保証ルール

- 条件達成月は Top Creator 70% / Elite Creator 80% を下げない
- AI 都合で 70% → 66% などへ引き下げしない
- 収支が厳しい月は条件ラインまたは max_slots を調整し、該当者を絞る
- 残余プール不足時は一般ランクのみ adjusted_rate を下げる

---

## 5. AI の役割

- **調整するもの:** 条件ライン（月次）
- **調整しないもの:** 達成済み Top/Elite の還元率

- 条件ライン算出
- 利益シミュレーション
- 安全判定

**禁止:**
- 還元率を気分で決めない
- 還元率を AI が恣意的に決定する

**考慮する入力:** 会社経費、Cloudflare、Stripe、AI利用料、税金積立、開発積立、予備費、最低利益

---

## 6. 出力一覧

| ファイル | 説明 |
|---------|------|
| `reports/tlv-business-simulator/output/monthly-payout-decision.json` | 月次配分判断の正本 |
| `reports/tlv-business-simulator/output/condition-lines.json` | AI 条件ライン |
| `reports/tlv-business-simulator/output/rank-progress.json` | 次ランクギャップ |
| `reports/tlv-business-simulator/output/residual-pool-allocation.json` | 保証後残余プール配分 |
| `reports/tlv-business-simulator/output/creator-rank-explanation.json` | Creator 向けランク説明 |
| `reports/tlv-business-simulator/output/high-payout-thresholds.json` | 高還元条件逆算 |
| `reports/tlv-business-simulator/output/stripe-connect-payouts.csv` | 送金候補 CSV（実送金なし） |
| `reports/tlv-business-simulator/payout-engine-v2-final-spec.md` | 本仕様書（Markdown） |

---

## 7. 検証条件

- Top/Elite 保証維持（高収益シナリオ）
- 一般ランクのみ変動（variable layer）
- monthly-payout-decision.json と各レポートの金額整合
- node scripts/generate-tlv-business-simulator.mjs で Excel / Markdown / JSON 再生成

### 直近検証結果

```json
{
  "guarantee_rule": {
    "ok": true,
    "guaranteed_count": 1
  },
  "residual_pool": {
    "ok": true,
    "high_guaranteed": 1,
    "normal_variable_only": 6
  },
  "creator_rank_explanation": {
    "ok": true,
    "creator_count": 6,
    "high_special": 1
  },
  "baseline_safety_status": "RED",
  "reference_month": "2026-05",
  "all_pass": true
}
```

---

## 8. 公開用表現

- 成果に応じた段階制の収益還元
- Top Creator は最大70%
- Elite Creator は最大80%も可能
- 条件達成者のみ適用
- 月次収支・運営コスト・適用条件に基づき算出。毎月固定の還元率はない。

---

## 9. 実装フェーズ

**ステータス:** active

- **1. monthly-payout-decision.json の実データ生成** — 本番収支・Creator 実績から月次 JSON を生成
- **2. AI 月次判定** — 条件ライン算出・利益シミュレーション・安全判定
- **3. Creator 向け還元説明生成** — creator-rank-explanation.json / MD の実データ連携
- **4. 管理画面への表示** — 運営者向け月次レポート・安全判定・残余プール
- **5. Creator Dashboard への表示** — ランク・還元率・次ランクギャップの表示
- **6. 公開説明ページ** — public_marketing_copy に基づく対外向け説明
- **7. 月次レポート出力** — monthly-operator-report・Excel・CSV の運用連携

**完了条件:**
- Ver2 Final Spec と実装結果が一致
- 再生成・検証・UI・API・JSON がすべて一致
- コードに保証率・ランクのハードコードがない

詳細: `reports/tlv-business-simulator/payout-engine-v2-implementation-phase.md`

---

## 実装

- 基準 JSON: `reports/tlv-business-simulator/payout-engine-v2-production-baseline.json`
- エンジン: `scripts/tlv-payout-engine.mjs`
- 生成: `scripts/generate-tlv-business-simulator.mjs`

```bash
node scripts/generate-tlv-business-simulator.mjs
```

*Ver2 Production Baseline — frozen. Spec changes require Ver3. Regenerate to refresh verification snapshot only.*