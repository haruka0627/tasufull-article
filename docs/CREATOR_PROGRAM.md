# TLV Creator Program — 実装仕様 v1

**最終更新:** 2026-06-28（v1.2 · Score OS — [TLV_PRD.md](./TLV_PRD.md) §5 同期 · Membership 追加設計 §2.7）  
**種別:** 実装可能仕様（Platform Vision v2+ · TLV v1.0 FROZEN 対象外）  
**AD:** [DECISIONS.md](./DECISIONS.md) **AD-014**  
**関連:** [PRICING.md](./PRICING.md) · [FINANCIAL_MODEL.md](./FINANCIAL_MODEL.md) · [ADMIN_SYSTEM.md](./ADMIN_SYSTEM.md) · [EVENT_SYSTEM.md](./EVENT_SYSTEM.md) · [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) · [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md)

**通貨単位:** JPY（円）· 内部コイン（1 コイン = Web 基準 ¥1 相当 · [PRICING.md](./PRICING.md) §1）

---

## 1. 用語 · データ境界

| 用語 | 定義 | DB フィールド（案） |
| --- | --- | --- |
| **Gross Revenue** | 決済前ユーザー支払総額 | `ledger.gross_amount_jpy` |
| **Net Revenue** | 決済手数料控除後 · 還元計算基準 | `ledger.net_amount_jpy` |
| **Creator-attributed Net** | 当該 Creator チャンネルに帰属する Net Revenue 合計 | `creator_ledger.net_attributed_jpy` |
| **Platform Profit (Creator)** | Creator 帰属 Net − infra 按分 − Creator 還元 | `creator_pl.platform_profit_jpy` |
| **Creator Score** | 0〜1000 整数 · 日次再計算 | `creators.score_total` |
| **Creator Rank** | Bronze / Silver / Gold / Platinum / Diamond / Legend | `creators.rank_tier` |
| **Creator Pool** | 月次利益から按分するボーナスプール | `creator_pool.month_id` |

**計算タイムゾーン:** `Asia/Tokyo` · **集計サイクル:** 暦月（`YYYY-MM-01 00:00:00 JST` 〜 月末 23:59:59 JST）

---

## 2. Creator Score（1000 点満点）

**正本:** 数式 · 更新タイミング · OS 出力の **唯一正本は [TLV_PRD.md](./TLV_PRD.md) §5**。本節は実装向け要約。

### 2.1 構成（固定 · v1.2）

```text
CreatorScore = clamp(FS + ES + GS + TS, 0, 1000)
```

| サブスコア | 記号 | 満点 |
| --- | --- | --- |
| Financial Score | `FS` | **400** |
| Engagement Score | `ES` | **300** |
| Growth Score | `GS` | **200** |
| Trust / Safety Score | `TS` | **100** |

### 2.2 FS（0〜400）— PPC 250 + WR 150

```text
PPC_30d = Σ (Gross - fee - infra) WHERE NOT self_gift_confirmed
FS_PPC  = min(250, floor(PPC_30d × 250 / 100000))
FS_WR   = fsWebRatio(WR_30d)    // ≥0.85→150 · 0.75-0.85 線形 · <0.75 減点
FS      = FS_PPC + FS_WR
```

**更新:** リアルタイム

### 2.3 ES（0〜300）— 視聴100 + チャット100 + 延長参加100

```text
ES_WATCH = min(100, floor(watch_time_avg_min / 25 * 100))
ES_CHAT  = min(100, floor(chat_active_rate / 0.30 * 100))
ES_EXT   = min(100, floor(ext_contrib_rate / 0.10 * 100))
ES       = ES_WATCH + ES_CHAT + ES_EXT
```

**更新:** リアルタイム · 実効 CCU ベース · BOT 除外

### 2.4 GS（0〜200）— 成長120 + 新規80

```text
GS_REV = rev_ratio>=1 ? min(120, floor((rev_ratio-1)*120)) : max(0, floor(rev_ratio*60))
GS_NEW = min(80, floor(new_user_ratio / 0.30 * 80))
GS     = GS_REV + GS_NEW
```

**更新:** 日次 03:00 JST

### 2.5 TS（0〜100）— 初期100 · イベント減点

| イベント | 減点 |
| --- | --- |
| 軽微違反 | −10〜−30 |
| 通報 | −20 |
| DMCA 確定 | **−100** |
| 自己投げ / BOT 確定 | **−100** |

**更新:** イベント駆動 + 日次監査 03:30 JST

### 2.6 Rank / 還元判定

```text
Score_MA30 = avg(daily_total, 30d)
Rank       = tierFromScore(Score_MA30)   // TLV_PRD §5.7
```

**DB:** `creator_score_daily` · `creator_score_monthly` · `creator_score_events`（[TLV_PRD.md](./TLV_PRD.md) §5.10）

### 2.7 Subscription Profit Contribution（SPC · 追加設計 · 未実装）

**正本:** [reports/tlv-membership-design.md](../reports/tlv-membership-design.md) · [TLV_PRD.md](./TLV_PRD.md) §11

**重要:** 既存 FS/ES/GS/TS 数式 · Rank 閾値 · Override 90/95% 条件は **変更しない**。

月額メンバーシップ収益は Score に **反映可能** だが、Tip 由来 PPC と **同じ重みにしない**。

| 指標 | ソース | FS 反映（候補） |
| --- | --- | --- |
| **PPC**（既存） | Tip · `revenue_ledger` gift/extension | **100%** |
| **SPC**（新候補） | Subscription · `subscription_revenue` | **30〜50%**（TODO-MEM-01 · PL 検証後確定） |

```text
// 概念式（係数未確定 · 実装しない）
SPC_30d = Σ creator_payable_jpy FROM subscription_invoices WHERE paid
FS_SPC  = min(cap, floor(SPC_30d × coefficient × FS_weight))
FS      = FS_PPC + FS_WR + FS_SPC   // FS_SPC 追加は将来 · 現行式は不変
```

**Legend / 95% ガード:**

- サブスクだけで Legend 条件（Score ≥ 950 · T95-5 PPC ≥ ¥500k）を **突破できない** 設計
- T95-5 等の **Tip PPC 要件は維持**（TODO-MEM-02 · PL 検証）
- PPC / WR / TS / 定員 100 / PPR 順の構造 **変更禁止**

---

## 3. Creator Rank（Bronze 〜 Legend）

**正本:** [TLV_PRD.md](./TLV_PRD.md) §5.7 · §6

### 3.1 ティア閾値（Score_MA30 ベース · 月次確定）

| Rank | Score レンジ | 還元ベース率（Net） |
| --- | --- | --- |
| Bronze | 0 – 499 | 50% |
| Silver | 500 – 649 | 60% |
| Gold | 650 – 749 | 70% |
| Platinum | 750 – 849 | 80% |
| Diamond | 850 – 929 | 85% |
| Legend | 930 – 1000 | 88% |

**Legend:** 定員 **100** · Score ≥ 930 かつ **PPR 降順** 選抜 · 待機リスト · 動的入替（TLV_PRD §6.4）

**維持:** `maintain_floor = RANK_SCORE_FLOOR[tier] - 40` · 7 日連続未満 → 1 段降格

**即時降格（Score 無関係）:**

| 条件 | 結果 |
| --- | --- |
| DMCA strike 確定 | → Bronze + base 30% cap 90 日 · TS=0 |
| 自己投げ銭確定 | → Bronze + 還元停止 30 日 · TS−100 |
| マネロン CONFIRMED | → 還元停止 + 永久 Bronze cap |
| `TS < 50` | → 還元停止至レビュー PASS |

---

## 4. 還元率 — Override Layer（90% / 95%）

**還元計算基準は常に Net Revenue（Gross 禁止 · AD-014）**

### 4.1 Base Layer

```text
base_payout_rate = RANK_BASE_RATE[rank_tier]
```

### 4.2 90% Override（Diamond 以上 · ALL PASS）

| # | 条件 | 閾値 |
| --- | --- | --- |
| T90-1 | rank_tier | ≥ Diamond |
| T90-2 | Score_MA30 | ≥ 900 |
| T90-3 | WR_month | ≥ 0.70 |
| T90-4 | TS | ≥ 80 |
| T90-5 | 自己投げ / BOT 疑義 | 0 件 |

### 4.3 95% Override（Legend のみ · ALL PASS）

| # | 条件 | 閾値 |
| --- | --- | --- |
| T95-1 | rank_tier | Legend（定員内） |
| T95-2 | Score_MA30 | ≥ 950 |
| T95-3 | WR_month | ≥ 0.85 |
| T95-4 | TS | ≥ 90 |
| T95-5 | 月間 PPC | ≥ ¥500,000 |

**上限:** `effective_rate = min(0.95, max(base, override))`

### 4.4 還元額計算

```text
creator_payout_jpy = floor(net_attributed_clean * effective_rate)
platform_retained  = net_attributed_clean - creator_payout_jpy - infra_allocated_jpy
```

**赤字ガード:** PF-06（[TLV_PRD.md](./TLV_PRD.md) §3.1）

---

## 5. Creator Pool

### 5.1 プール原資

**月次（翌月 5 営業日確定）:**

```text
pool_fund_jpy = floor( sum(platform_profit_jpy for all creators) * 0.10 )
pool_fund_jpy = max(pool_fund_jpy, 0)   // プラットフォーム月次赤字なら pool_fund = 0
```

**Profit First:** 当月プラットフォーム全体 `total_platform_profit < 0` → **Pool 分配スキップ**

### 5.2 分配 weight

対象 Creator（当月）:

- `CreatorScore` ≥ 500（Score MA30）
- `TS` ≥ 80
- 還元停止フラグなし

```text
weight_i = creator_score_i * net_attributed_jpy_i
share_i  = weight_i / sum(weight_all)
bonus_i  = floor(pool_fund_jpy * share_i)
```

**1 Creator 上限:** `bonus_i <= min(¥500,000, pool_fund_jpy * 0.15)`

---

## 6. Profit First との関係

```text
[収益イベント] → Gross → Net（手数料控除）
    → infra 按分 → Creator 還元（effective_rate · Pool 別）
    → Platform Profit
```

| ルール ID | 内容 |
| --- | --- |
| PF-01 | 還元計算入力は **Net Revenue のみ** |
| PF-02 | 90/95% は **Platform Profit Rate 条件** 必須 — 赤字 Creator には適用不可 |
| PF-03 | ライブ 30 分無料 infra は Creator 按分 **¥0**（Platform 負担 cap · [FINANCIAL_MODEL.md](./FINANCIAL_MODEL.md) §4） |
| PF-04 | 延長 30 分は **500 コイン以上** のルーム収益が infra 按分を上回るまで延長不可 |
| PF-05 | 月次全体赤字 → Creator Pool = 0 · 95% 新規付与停止 |
| PF-06 | `effective_rate` 再計算で `platform_retained < 0` なら **自動 rate ダウン**（§4.4） |

---

## 7. API · バッチ（実装インターフェース）

### 7.1 日次ジョブ `creator-score-daily`

```
Input:  creator_id, date_jst
Output: { fs, es, ts, gs, total, rank_tier, effective_rate_preview }
Idempotent: yes (upsert creator_daily_scores)
```

### 7.2 月次ジョブ `creator-payout-monthly`

```
Input:  month_yyyy_mm
Output: { payout_jpy, pool_bonus_jpy, effective_rate, tier_90, tier_95 }
Trigger: 毎月 1 日 06:00 JST（前月確定）
```

### 7.3 Creator 公開 API（読取）

| エンドポイント | 返却 |
| --- | --- |
| `GET /api/tlv/creator/me/score` | `{ rank, score_total, subscores: {fs,es,ts,gs}, next_rank_at }` |
| `GET /api/tlv/creator/me/payout-preview` | `{ base_rate, tier_90_eligible, tier_95_eligible, missing_conditions[] }` |

**非公開:** 生 `PPR_month` · 他 Creator 比較 · Pool 総額

---

## 8. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-06-28 | 初版 — 概念設計 |
| 2026-06-28 | **v1.2 + MEM** | §2.7 SPC 追加設計 — Subscription Score 反映方針（係数未確定 · 制度不変） |
| 2026-06-28 | **v1.2** — Score OS 確定（TLV_PRD §5 同期）· FS400/ES300/GS200/TS100 · Rank レンジ · Override 条件 |
| 2026-06-28 | v1 実装仕様 — Score 1000 · Rank 6 段 · 90/95% · Pool · Profit First |
