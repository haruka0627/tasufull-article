# TLV Financial Model — 実装仕様 v1

**最終更新:** 2026-06-28  
**種別:** 実装可能仕様 · PL 正本  
**AD:** [DECISIONS.md](./DECISIONS.md) **AD-014**  
**関連:** [PRICING.md](./PRICING.md) · [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md)

**前提:** 30 分サバイバル · Profit First · Net Revenue 基準 · 通貨 JPY

---

## 1. 収益定義

### 1.1 Gross Revenue

```text
Gross = ユーザーが支払った税込総額（コイン購入 · サブスク · PPV · 広告収入按分）
```

### 1.2 Net Revenue

```text
Net = Gross - PaymentFee - Refund - Chargeback
PaymentFee = Gross * fee_rate(channel)
```

| channel | fee_rate |
| --- | --- |
| `web_stripe` | 0.036 |
| `ios_iap` | 0.30 |
| `android_iap` | 0.30 |
| `adsense` | 0.00（Gross = Net · 広告ネットワーク入金ベース） |

### 1.3 Creator-attributed Net

```text
Net_creator = Σ Net(event) WHERE event.creator_id = C
```

イベント種別: `gift` · `extension` · `membership` · `ppv` · `ad_share`

### 1.4 Platform Profit（Creator 単位 · 月次）

```text
PlatformProfit_C =
  Net_creator
  - InfraAllocated_C
  - CreatorPayout_C
  - SupportAllocated_C
```

```text
PlatformProfitTotal = Σ PlatformProfit_C + SubPlatformRevenue - Overhead
```

`SubPlatformRevenue` = Creator サブスク · Viewer サブスク（Platform 100%）

---

## 2. 決済手数料 — 計算例

**500 コイン購入（延長 1 単位相当）:**

| チャネル | Gross | Fee | Net |
| --- | --- | --- | --- |
| Web | ¥550 | ¥19.80 | **¥530.20** |
| App | ¥786 | ¥235.80 | **¥550.20** |

---

## 3. インフラコスト構造（単価 v1 · 2026-06 試算）

**更新:** FinOps が **毎月 1 日** に `infra_unit_costs` テーブルを Cloudflare/GCP 実績で上書き

| コスト項 | 記号 | 単価 | 単位 |
| --- | --- | --- | --- |
| CDN 配信 | `C_CDN` | ¥12.00 | / GB egress |
| エンコード | `C_ENC` | ¥0.40 | / 視聴者·30分 |
| Storage（30日） | `C_STOR` | ¥0.015 | / GB·月 |
| API（Realtime） | `C_API` | ¥2.00 | / ライブセッション |
| AI（TASFUL 按分） | `C_AI` | ¥0.10 | / アクティブユーザー·日 |
| 決済固定 | `C_PAY_FIX` | ¥0 | Stripe 率のみ |

### 3.1 視聴者あたり 30 分配信コスト

**既定:** 720p ラジオモード · 640 kbps 平均

```text
GB_per_viewer_30min = (640 * 1800 / 8) / (1024^3) = 0.134 GB
CDN_cost = 0.134 * C_CDN = ¥1.61
ENC_cost = C_ENC = ¥0.40
STOR_cost = 0.05 GB archive * C_STOR ≈ ¥0.001（省略可）
PerViewer30 = CDN_cost + ENC_cost ≈ ¥2.01 → 実装丸め **¥2.00**
```

### 3.2 セッション固定コスト

```text
SessionFixed = C_API + (C_AI * peak_dau_factor)
             = 2.00 + 0.10 = ¥2.10 → 丸め **¥2.00**
```

---

## 4. 30 分配信 PL モデル

### 4.1 無料 30 分（Platform 負担 cap）

```text
InfraFree30(CCU) = SessionFixed + (CCU * PerViewer30)
InfraFreeCap = min(InfraFree30(CCU), 150)   // PF-03 · 上限 ¥150/セッション
PlatformCostFree = InfraFreeCap
RevenueFree = 0
ProfitFree = -PlatformCostFree
```

### 4.2 延長 30 分（500 コイン必須）

**前提:** ルーム延長 Net = **¥530**（Web 500coin パック 1 相当 · 保守値）

```text
InfraExt30(CCU) = CCU * PerViewer30   // SessionFixed は無料枠で計上済
RevenueExtNet = 530 * (1 - mix_adjust)
  mix_adjust = 0.15 * app_share   // App 15% mix 想定 → Net 約 ¥505
CreatorPayout = RevenueExtNet * effective_rate   // 例 0.70 = ¥353
PlatformProfitExt = RevenueExtNet - InfraExt30 - CreatorPayout
```

**延長可否（ライブエンジン）:**

```text
allow_extension = (RevenueExtGross >= 500 coins) AND (PlatformProfitExt >= 0 OR gauge_met)
```

---

## 5. 同時接続別損益シミュレーション（60 分 = 無料30 + 延長30）

**共通仮定 v1:**

| 変数 | 値 |
| --- | --- |
| 延長購入率 | ルームの **30%** が 500coin 1 単位購入 |
| ギフト Net（60分） | `CCU * ¥15`（平均） |
| effective_rate | **70%**（Gold 想定） |
| Web mix | **70%** |
| App mix | **30%** |

**Net 延長 1 単位（混合）:**

```text
Net_ext = 0.7 * 530.20 + 0.3 * 550.20 = ¥536.20
```

### 5.1 シミュレーション表

| CCU | InfraFree | InfraExt | 延長Net | ギフトNet | TotalNet | Creator70% | PlatformProfit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **10** | ¥20 | ¥20 | ¥536 | ¥150 | ¥686 | ¥480 | **+¥166** |
| **100** | ¥150* | ¥200 | ¥536 | ¥1,500 | ¥2,036 | ¥1,425 | **+¥411** |
| **1,000** | ¥150* | ¥2,000 | ¥536 | ¥15,000 | ¥15,536 | ¥10,875 | **+¥2,661** |
| **10,000** | ¥150* | ¥20,000 | ¥536 | ¥150,000 | ¥150,536 | ¥105,375 | **+¥25,161** |

\* 無料枠 `InfraFreeCap = ¥150` 適用

**赤字条件（延長のみ · ギフト 0）:**

```text
CCU_ext_break_even ≈ floor(536 * 0.30 / (2.00 * (1 - 0.70))) = 268 CCU
```

→ **268 CCU 超** で延長単体黒字 · ギフトで 10 CCU でも全体黒字（上表）

### 5.2 10,000 CCU ガードレール

| 制御 | 値 |
| --- | --- |
| 最大同時配信（1 セッション） | 10,000 |
| 10k 到達時 | 新規入室待機 · 480p 自動降格 |
| Infra 月次 cap アラート | ¥500,000 / Creator / 月 |

---

## 6. Creator 還元後利益構造（月次 · 1 Creator 例）

**中規模 Creator 想定:**

| 行 | 金額 |
| --- | --- |
| Net Revenue | ¥500,000 |
| − Infra 按分 | ¥45,000 |
| − Creator Payout (75% avg) | ¥375,000 |
| **= Platform Profit** | **¥80,000** |
| Platform Profit Rate | 16% |

**90% 還元適用時（条件満たす場合）:**

| 行 | 金額 |
| --- | --- |
| Net Revenue | ¥500,000 |
| − Infra | ¥45,000 |
| − Creator Payout (90%) | ¥450,000 |
| **= Platform Profit** | **¥5,000** |
| PPR | 1% → **95% は不可**（PPR ≥ 20% 未達） |

→ **高還元は高 Net + 低 infra + Web 比率** が必須（Profit First）

---

## 7. Profit First ロジック（実装）

### 7.1 日次ガード

```typescript
function assertProfitFirst(session: LiveSession): void {
  if (session.platform_profit_projected < 0 && !session.extension_paid) {
    session.force_end_at = session.free_end_at; // 延長なし
  }
  if (session.infra_accumulated > 150 && session.extension_coins < 500) {
    session.force_end_at = now + 60_000; // grace 60s
  }
}
```

### 7.2 月次ガード

| 条件 | アクション |
| --- | --- |
| `PlatformProfitTotal < 0` | Creator Pool = 0 · 新規 95% 付与停止 |
| `PlatformProfitRate < 0.10` | FinOps アラート · 還元率一時 -5% cap |
| `InfraCost / Net > 0.40` | CDN 降格 · 高画質オプション停止 |

### 7.3 利益率ターゲットモデル

| モデル ID | Platform Profit Rate 目標 | 想定還元中央値 |
| --- | --- | --- |
| `FM_10` | 10% | 65% |
| `FM_15` | 15% | 70% |
| `FM_20` | 20% | 75% |
| `FM_25` | 25% | 80% |

**v1 運用目標:** `FM_15`（Platform 15% · Creator 平均 70%）

---

## 8. 三本柱別 PL（月次テンプレート）

| 行 | Live | VOD | Short |
| --- | --- | --- | --- |
| Net Revenue | 延長+ギフト+ライブ広告 | 広告+メンバー+PPV | ショート広告 |
| − CDN | ● | ● | ● |
| − Storage | 低 | 高 | 中 |
| − Encode | 高（Realtime） | 中 | 低 |
| − AI/API | 中 | 低 | 低 |
| − Creator Payout | ● | ● | ● |
| **= Segment Profit** | FinOps 別管理 | 同上 | 同上 |

**集約禁止:** セグメント赤字を他セグメントで補填しない（AD-014 · 別 PL 管理）

---

## 9. DB スキーマ（FinOps 最小）

```sql
-- 月次 PL スナップショット
CREATE TABLE platform_pl_monthly (
  month_id        char(7) PRIMARY KEY,  -- YYYY-MM
  gross_jpy       bigint NOT NULL,
  net_jpy         bigint NOT NULL,
  infra_jpy       bigint NOT NULL,
  creator_payout  bigint NOT NULL,
  platform_profit bigint NOT NULL,
  profit_rate     numeric(5,4) NOT NULL,
  segment_live    bigint NOT NULL,
  segment_vod     bigint NOT NULL,
  segment_short   bigint NOT NULL
);
```

---

## 10. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-06-28 | v1 — Gross/Net · infra 単価 · 同接 PL · Profit First |
