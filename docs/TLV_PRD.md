# TLV Product Requirements Document（完全設計書）

**版:** 1.2.1 POLICY-SUPPLEMENT  
**最終更新:** 2026-06-28  
**種別:** 実装可能 PRD · **Score OS 数式確定**（Platform Vision · AD-014）  
**正本関係:** **Creator Score 数式の唯一正本は本書 §5**。還元 · Rank は §6。[CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) は本書 §5 と同期。**DB 正本:** [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) · [`db/tlv_schema.sql`](../db/tlv_schema.sql) · **処理仕様:** [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md)  
**TLV v1.0:** FEATURE FROZEN（[AI/TLV_AI.md](./AI/TLV_AI.md)）。本 PRD は v2 以降の開発正本。

**固定前提（変更禁止）**

| 項目 | 値 |
| --- | --- |
| 主戦場 CCU | **100〜1,000**（中規模） |
| 延長単価 | **500 コイン = 30 分** |
| Creator 還元（高水準） | **90〜95%**（Net ベース · Override Layer · 条件達成型） |
| Web 決済比率最適化 | **75〜85%**（推奨レンジ · 強制ではない） |
| 配信基盤 | **LL-HLS + CDN** |
| インフラ原価 | **CCU スケール連動変動費** |
| Score | **行動制御 OS** として機能 |

**設計確定事項（v1.1 · 矛盾解決）**

| # | 確定ルール |
| --- | --- |
| ① | 還元は **Base Layer（Rank）** + **Override Layer（Tier 90/95）** の二層構造 |
| ② | Web 比率 WR は **75〜85% 推奨** · **90/95% Tier 発動条件のみ** · プラットフォーム強制なし |
| ③ | Legend **定員 100** · 超過時 **PPR 順選抜** · 待機リスト · **動的入替** |
| ④ | Rank / 還元判定 = **月次 · 30 日移動平均** · 前週比 = Dashboard プレビューのみ |
| ⑤ | Score = **FS400 + ES300 + GS200 + TS100 = 1000** · 経済 OS 中枢 · §5 確定 |
| ⑥ | CCU 100/1,000/10,000 · LL-HLS+CDN · **非アクティブ軽量化必須** · 動的ビットレート |
| ⑦ | 自己投げ · **共謀（Collusion）** は **PPC 除外** · BOT = **実効 CCU** · **30 日 Payout Hold 必須** · クロスチェック |
| ⑧ | A=盾/固定費吸収 · B=主戦場/収益最大化 · C=ブランド/広告塔/上限形成 |
| ⑨ | **ゲーム性（UX）× 経済性（PL）× OS 性（行動制御）** 三層統合 |

**統一解決（旧資料との関係）**

| 旧資料 | 本 PRD の扱い |
| --- | --- |
| `reports/tlv-business-simulator` Ver2（Starter 28%〜Elite 80%） | **参考シミュレータのみ**。還元正本は本 PRD + CREATOR_PROGRAM v1 |
| MONETIZATION.md「数値未確定」 | 本 PRD の **確定数値** で上書き |
| Legend 選抜 | Score のみ → **PPR 順 + 動的入替** に確定 |

---

## 1. Overview

### 1.1 TLV の定義

**TLV（TASFUL Live Video）** は、**30 分サバイバル配信**をコアとするライブ動画プラットフォーム。

- 配信は **30 分無料** → **条件達成時のみ 30 分延長**（最大繰り返し · infra cap 付き）
- 収益は **コイン（ギフト · 延長）** · **サブスク** · **広告** の三本柱
- Creator 評価は **Creator Score（0〜1000）** · **Creator Rank（Bronze〜Legend）** で自動制御
- 還元は **二層構造（Base Rank + Override Tier）** · **Net 基準 · Profit First**

### 1.2 プロダクト思想（三層統合モデル）

本 PRD は以下 **3 層を一貫して統合** する設計正本とする。

| 層 | 名称 | 役割 | 具体 |
| --- | --- | --- | --- |
| **L1** | **ゲーム性（UX）** | 視聴者参加 · 感情 · 継続視聴 | 30 分制限 · 延長ゲージ · ロスタイム · ランキング · イベント |
| **L2** | **経済性（PL）** | 持続可能な収益分配 | Gross→Net→Infra→Creator→Platform · 500coin/30min · CCU 連動コスト |
| **L3** | **OS 性（行動制御）** | Creator / Viewer 行動の数値誘導 | Score 1000 · Rank · 還元二層 · 露出 · 不正減点 |

**ミッション:** 「頑張ったクリエイターが一番報われるサービス」— **利益が先 · 条件達成型**（AD-014）

### 1.3 市場ポジション

| 軸 | TLV | 既存大手 |
| --- | --- | --- |
| 配信時間 | **30+30 サバイバル**（赤字延長不可） | 無制限〜長時間が主流 |
| 還元 | **Base 50〜88% + Override 90/95%**（条件付き） | 固定 50% 前後が多い |
| 主戦場 | **CCU 100〜1,000** 中規模コミュニティ | 超大型配信偏重 |
| 決済 | **Web 75〜85% 推奨**（経済インセンティブ · 強制なし） | App 内課金依存 |
| AI | **専用エンジンなし**（TASFUL AI 入口のみ · AD-004） | 各社独自 AI |

---

## 2. System Architecture

### 2.1 ユーザー構造

```text
                    ┌─────────────────────────────────┐
                    │         Platform (Ops)          │
                    │  FinOps · T&S · Event · Admin   │
                    └───────────────┬─────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
   │   Viewer    │          │   Creator   │          │  Advertiser │
   │ 視聴・課金   │◄────────►│ 配信・収益   │          │  （将来）    │
   └─────────────┘          └─────────────┘          └─────────────┘
```

| 主体 | 責務 | 主要エンティティ |
| --- | --- | --- |
| **Viewer** | 視聴 · ギフト · 延長コイン · サブスク | `users` · `wallet` · `viewer_level` |
| **Creator** | 配信 · コンテンツ · チャンネル運営 | `creators` · `channels` · `live_sessions` |
| **Platform** | PL 管理 · 不正 · 制度 · infra | `ledger` · `platform_pl_monthly` · `admin_audit_log` |

### 2.2 データフロー（課金 → 分配 → スコア → ランク → 還元）

```text
[Viewer 課金]
    │ Gross（Web ¥550 / App ¥786 @ 500coin）
    ▼
[PaymentFee 控除] ──► Net Revenue（ledger.net_amount_jpy）
    │                      ※自己投げ確定分は PPC 対象外（§7.1）
    ├──► Infra 按分（CCU × PerViewer30 · 実効 CCU 補正）
    │
    ├──► [Base Layer] Creator Payout（Net × base_rate · Rank テーブル）
    │
    ├──► [Override Layer] Tier 90/95 上書き（当月条件 ALL PASS のみ）
    │
    └──► Platform Profit（PPR 計算）
              │
              ▼
    [日次 03:00 JST] creator-score-daily（FS+ES+TS+GS）
              │
              ▼
    [月次] Rank / 還元判定（30 日移動平均 · §5.8）
              │ Legend: PPR 順 · 定員 100 · 動的入替
              ▼
    [月次 1 日 06:00] creator-payout-monthly
              │ effective_rate 確定 · Pool · 30 日 hold 判定
              ▼
    [D+7 振込] Stripe Connect（KYC PASS · hold 解除済）
```

**イベント種別（ledger）:** `gift` · `extension` · `membership` · `ppv` · `ad_share`

**タイムゾーン:** 全集計 `Asia/Tokyo` · 暦月サイクル

---

## 3. Revenue Model (PL)

### 3.1 Gross → Net → Creator → Platform

```text
Gross        = ユーザー税込支払総額
Net          = Gross - PaymentFee - Refund - Chargeback
Net_creator  = Σ Net(event) WHERE event.creator_id = C AND NOT self_gift_confirmed
Infra_C      = SessionFixed + (effective_ccu × PerViewer30)
Payout_C     = floor(Net_creator × effective_rate)
PlatformProfit_C = Net_creator - Infra_C - Payout_C - Support_C

PPR_month = PlatformProfit_C / max(Net_creator, 1)   // 純利益貢献度
```

**Platform 全体:**

```text
PlatformProfitTotal = Σ PlatformProfit_C + SubPlatformRevenue - Overhead
```

| ルール ID | 内容 |
| --- | --- |
| PF-01 | 還元計算入力は **Net Revenue のみ** |
| PF-02 | Override 90/95% は **PPR ≥ 閾値** 必須 · **常時適用禁止** |
| PF-03 | 無料 30 分 infra は Creator 按分 **¥0** · Platform cap **¥150/セッション** |
| PF-04 | 延長は **500 coin 未満** なら不可 |
| PF-05 | 月次全体赤字 → Creator Pool = 0 · Override 95% 新規付与停止 |
| PF-06 | `platform_retained < 0` → **effective_rate 自動ダウン**（Override も対象） |

### 3.2 還元二層構造（Base Layer / Override Layer）— 確定

還元率は **必ず二層に分離** して実装する。混在定義 · 単一テーブル上書きは **禁止**。

#### 3.2.1 Base Layer（Rank 還元）

| 属性 | 定義 |
| --- | --- |
| **適用範囲** | **全 Creator**（Rank 所持者） |
| **性質** | デフォルト給与テーブル · **常時適用** |
| **根拠** | CreatorScore + Rank ティア（§6.1） |
| **レンジ** | **50%〜88%**（Net ベース） |

```text
base_rate = RANK_BASE_RATE[rank_tier]   // §6.1 表
```

**実装:** `creators.base_payout_rate` · Override 未達時は **base_rate のみ** が effective_rate

#### 3.2.2 Override Layer（Tier 還元）

| 属性 | 定義 |
| --- | --- |
| **適用範囲** | **条件達成 Creator のみ**（当月 ALL PASS） |
| **性質** | **例外的ボーナス還元** · 常時適用 **禁止** |
| **動作** | Base Layer を **上書き**（`max(base, override)`） |
| **上限** | **95% 厳守** · Profit First 赤字時は Override 無効化 |

```text
override_rate = 0
if PAYOUT_TIER_95_ALL_PASS: override_rate = 0.95
elif PAYOUT_TIER_90_ALL_PASS: override_rate = 0.90

effective_rate = min(0.95, max(base_rate, override_rate))
// 赤字ガード後に再計算（PF-06）
```

**禁止事項:**

- 全 Creator への 90/95% 一律適用
- Override を Rank テーブルに統合すること
- Override 条件未達でも effective_rate を引き上げる UI 表示

#### 3.2.3 二層合成フロー（実装疑似コード）

```typescript
function computeEffectiveRate(creator: Creator, month: Month): RateResult {
  const base = RANK_BASE_RATE[creator.rank_tier];           // Layer 1
  let override = 0;
  if (checkTier95All(creator, month)) override = 0.95;       // Layer 2
  else if (checkTier90All(creator, month)) override = 0.90;

  let effective = Math.min(0.95, Math.max(base, override));
  effective = applyProfitFirstGuard(effective, creator, month);  // PF-06
  return { base, override, effective, tier_90: override >= 0.90, tier_95: override >= 0.95 };
}
```

### 3.3 決済手数料構造（Web / App）

| channel | fee_rate | 500 coin Gross | 500 coin Net |
| --- | --- | --- | --- |
| `web_stripe` | **3.6%** | **¥550** | **¥530.20** |
| `ios_iap` | **30%** | **¥786** | **¥550.20** |
| `android_iap` | **30%** | **¥786** | **¥550.20** |

**App 価格係数:** ×1.4286（Net parity）

### 3.4 Web 決済比率（WR）— 確定扱い

**WR 定義:**

```text
WR_month = web_net_jpy / max(total_net_jpy, 1)
WR_90d   = rolling 90 日 Net ベース（Score FS_WR 用）
```

| 区分 | 扱い | 用途 |
| --- | --- | --- |
| **75〜85%** | **最適運用レンジ（推奨値）** | Dashboard 表示 · Creator インセンティブ UI |
| **WR 条件** | **維持条件 · 強制ルールではない** | 90/95% Override 発動条件 **のみ** |
| **プラットフォーム** | **経済インセンティブ制御** | Web 購入ボーナス · Deep Link · 比較表示 |
| **禁止** | App 視聴ブロック · 還元率の WR 未達ペナルティ | — |

**Override Layer でのみ WR をゲートに使用:**

| Tier | WR 条件 | 性質 |
| --- | --- | --- |
| 90% Override | `WR_month ≥ 0.60` | Tier 発動条件 |
| 95% Override | `WR_month ≥ 0.75` | Tier 発動条件 |

**推奨レンジ 75〜85%:** FS_WR スコア加点 · Creator Dashboard の「最適ゾーン」表示 · **Rank / Base 還元には WR 未達ペナルティなし**

**UI 施策（インセンティブ · 非強制）:** App 購入画面「Web なら約 30% お得」· Deep Link · 初回 Web +50 coin

**FinOps 監視（参考 KPI · 強制アクションなし）:** WR < 55% WARN ログ · < 45% FinOps レビュー推奨

### 3.5 インフラコスト構造（CCU 別）

**単価 v1（`infra_unit_costs` · 月次 FinOps 更新）:**

| 記号 | 単価 | 単位 |
| --- | --- | --- |
| `C_CDN` | ¥12.00 | / GB egress |
| `C_ENC` | ¥0.40 | / 視聴者·30分 |
| `C_API` | ¥2.00 | / ライブセッション |
| `C_AI` | ¥0.10 | / アクティブユーザー·日 |

```text
PerViewer30 ≈ ¥2.00
SessionFixed ≈ ¥2.00
effective_ccu = Σ max(0, 1 - bot_score_i)   // §7.2
```

**30 分配信 PL（CCU = 実効 CCU）:**

| フェーズ | 式 | CCU=100 | CCU=1,000 | CCU=10,000 |
| --- | --- | --- | --- | --- |
| 無料 30 分 | `min(SessionFixed + CCU×2, 150)` | **¥150** | **¥150** | **¥150** |
| 延長 30 分 | `CCU × 2.00` | **¥200** | **¥2,000** | **¥20,000** |

**60 分セッション損益例（延長購入率 30% · ギフト Net = CCU×¥15 · base_rate 70% · Web 70%）:**

| CCU | TotalNet | Creator70% | PlatformProfit |
| --- | --- | --- | --- |
| **100** | ¥2,036 | ¥1,425 | **+¥411** |
| **1,000** | ¥15,536 | ¥10,875 | **+¥2,661** |
| **10,000** | ¥150,536 | ¥105,375 | **+¥25,161** |

### 3.6 利益率モデル（A / B / C エコシステム）

| ゾーン | CCU 帯 | Base 還元中央 | Override 到達 | PPR 目標 |
| --- | --- | --- | --- | --- |
| **A** | 10〜99 | 50〜60% | 稀 | 20%+ |
| **B** | **100〜1,000** | **70〜85%** | 90% 狙い | **15%**（FM_15） |
| **C** | 1,001〜10,000 | 85〜88% | 95% 条件付 | 10〜20% |

---

## 4. 30-Min Survival System

### 4.1 タイムライン

```text
T+0:00     配信開始（30 分無料 · 720p ラジオモード既定）
T+25:00    延長 UI 表示 ·「あと 500 コインで +30 分」
T+29:00    ロスタイム警告（残り 60 秒カウントダウン）
T+30:00    判定
           ├─ 延長条件未達 → Grace 60s → 終了演出 → Raid オプション
           └─ 延長条件達成 → 第 2 フェーズ 30 分開始
T+60:00    以降 30 分単位（session max 240 分 · infra cap）
```

### 4.2 延長ゲージ設計

```text
effective_ccu = Σ max(0, 1 - bot_score_i)
gauge_pct = min(100,
  (effective_ccu * 2) +
  (avg_watch_minutes * 1.5) +
  (cheer_count * 0.5) +
  (paid_coins_in_room / 5)
)
```

**延長解放（OR）:** `(gauge >= 100 AND paid >= 500)` **OR** `(paid >= 500 AND effective_ccu >= 5)`

**Rank ゲート:** Score MA30 < **500**（Bronze 帯）→ 延長月 **4 回 cap**

### 4.3 500 コイン基準 · 複数人課金 · ストック

| 項目 | 値 |
| --- | --- |
| 延長単位 | **30 分** |
| 必要コイン | **500/ブロック**（ルーム合算 · 複数 Viewer 可） |
| 無料コイン | **使用不可** |
| 未達 | Grace **60 秒** → 強制終了 |

```text
extension_stock = paid_extension_coins - floor(paid_extension_coins/500)*500
next_block_cost = max(0, 500 - extension_stock)
```

**オーバーゲージ:** gauge 100% + 応援継続 → +5〜15 分（1 配信 max +15 分 · infra cap ¥50）

### 4.4 ロスタイム UX（終了演出）

| フェーズ | タイミング | UI |
| --- | --- | --- |
| Warning | T+29:00 | amber バー「残り 60 秒」 |
| Rostime | T+29:30〜30:00 | カウントダウン · ゲージ pulse |
| Grace | T+30:00〜30:60 | 500coin CTA |
| Ending | 終了確定 | Top3 · 延長回数 · Raid · ハイライト teaser |

---

## 5. Creator Score — 行動制御 OS（1000pt · 数式確定）

**定義:** Score は単なる指標ではなく、**収益 · 行動 · 健全性 · 成長を統合制御する経済 OS の中枢ロジック**。

### 5.1 4 軸構造（1000 点固定 · 変更禁止）

```text
CreatorScore = clamp(FS + ES + GS + TS, 0, 1000)
TOTAL        = FS + ES + GS + TS = 1000   // 各軸キャップ必須 · 正規化済
```

| 軸 | 記号 | 正式名称 | 満点 | 重み |
| --- | --- | --- | --- | --- |
| 財務 | **FS** | Financial Score | **400** | 40% |
| エンゲージ | **ES** | Engagement Score | **300** | 30% |
| 成長 | **GS** | Growth Score | **200** | 20% |
| 健全性 | **TS** | Trust / Safety Score | **100** | 10% |

**実装制約:** 1000 点スケール固定 · 各サブスコア正規化 + キャップ · **月次スナップショット保存** · **イベント履歴トレース必須**（§5.10）

---

### 5.2 FS — Financial Score（0〜400）

**目的:** プラットフォーム収益への **直接貢献度**（PPC · Web 比率）

**入力（rolling 30 日 · 自己投げ確定 Net 除外）:**

```text
PPC_30d = Σ (Gross - payment_fee - infra_allocated)
          WHERE creator_id = C AND NOT self_gift_confirmed

WR_30d  = web_tip_origin_net / max(total_tip_origin_net, 1)
```

**WR 入力正本:** tip 消費時に FIFO で消費した `coin_lots` の origin（`tip_coin_lot_allocations` / `tips.web_origin_net_jpy`）。購入時の `payments.is_web_payment` ではない。詳細: [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) §2.6 · [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) §5.2。

#### 5.2.1 PPC（純利益貢献）— 250 点

```text
FS_PPC = min(250, floor(PPC_30d × 250 / 100000))
```

| PPC_30d | FS_PPC |
| --- | --- |
| ¥0 | 0 |
| ¥50,000 | 125 |
| **¥100,000** | **250（満点 · キャップ）** |
| ¥200,000+ | **250（上限固定）** |

#### 5.2.2 Web 決済比率 — 150 点

```text
function fsWebRatio(WR: number): number {
  if (WR >= 0.85) return 150;
  if (WR >= 0.75) return floor(75 + (WR - 0.75) / 0.10 * 75);  // 75〜150 線形
  return floor(WR / 0.75 * 75);                                   // <0.75 減点帯 0〜75
}
FS_WR = fsWebRatio(WR_30d)
FS    = FS_PPC + FS_WR   // max 400
```

| WR_30d | FS_WR |
| --- | --- |
| 0.85+ | **150** |
| 0.80 | 113 |
| 0.75 | 75 |
| 0.60 | 60 |
| 0.50 | 50 |

**更新タイミング:** **リアルタイム**（課金 · 還元 · infra 按分イベント毎に再計算）

---

### 5.3 ES — Engagement Score（0〜300）

**目的:** 配信の **熱量 · コミュニティ密度**（ライブセッション rolling 30 日加重平均）

**入力（実効 CCU ベース · BOT 除外）:**

```text
watch_time_avg_min = Σ watch_seconds / max(effective_viewers, 1) / 60
chat_active_rate   = active_chat_users / max(effective_ccu, 1)
ext_contrib_rate   = users_contributed_to_extension / max(effective_ccu, 1)
```

#### 5.3.1 平均視聴維持時間 — 100 点

```text
ES_WATCH = min(100, floor(watch_time_avg_min / 25 * 100))
// watch_time_avg_min >= 25 → 100点
```

#### 5.3.2 チャットアクティブ率 — 100 点

```text
ES_CHAT = min(100, floor(chat_active_rate / 0.30 * 100))
// chat_active_rate >= 30% → 100点
```

#### 5.3.3 延長参加率（協調課金率）— 100 点

```text
ES_EXT = min(100, floor(ext_contrib_rate / 0.10 * 100))
// ext_contrib_rate >= 10% → 100点（500coin 延長に1回以上課金した UU / CCU）
ES     = ES_WATCH + ES_CHAT + ES_EXT   // max 300
```

**更新タイミング:** **リアルタイム**（視聴 · チャット · 延長コインイベント毎）

---

### 5.4 GS — Growth Score（0〜200）

**目的:** **成長速度 · 拡張性**（前月比 · 新規視聴者比率）

**入力（暦月 · 前月確定値）:**

```text
rev_ratio      = current_month_net / max(last_month_net, 1)
new_user_ratio = new_unique_viewers_month / max(total_unique_viewers_month, 1)
```

#### 5.4.1 前月比成長率（最重要）— 120 点

```text
// rev_ratio 2.0 = +100% 成長 → 120点満点
GS_REV = rev_ratio >= 1
  ? min(120, floor((rev_ratio - 1) * 120))
  : max(0, floor(rev_ratio * 60))          // 縮小時は減衰（最低0）
```

| rev_ratio | 成長率 | GS_REV |
| --- | --- | --- |
| 2.0 | +100% | **120** |
| 1.5 | +50% | 60 |
| 1.0 | 0% | 0 |
| 0.5 | −50% | 30 |

#### 5.4.2 新規視聴者比率 — 80 点

```text
GS_NEW = min(80, floor(new_user_ratio / 0.30 * 80))
// new_user_ratio >= 30% → 80点満点
GS     = GS_REV + GS_NEW   // max 200
```

**更新タイミング:** **日次**（03:00 JST · 当月暦月データで再計算）

**Dashboard WoW プレビュー:** 前週比表示可 · **GS 公式値・Rank 判定には不使用**

---

### 5.5 TS — Trust / Safety Score（0〜100）

**目的:** **健全性 · 不正耐性**

```text
TS_BASE = 100    // 新規 Creator 初期値
TS      = clamp(TS_BASE + Σ event_delta, 0, 100)
// event_delta = penalties（負）+ approved recoveries（正）— §5.5.3
```

#### 5.5.1 減点ルール（イベント駆動）

| イベント | 減点 | 備考 |
| --- | --- | --- |
| 軽微違反（Ops 判定） | **−10〜−30** | `trust_events.severity=minor` |
| 有効通報 1 件 | **−20** | 90 日 rolling |
| チャージバック 1 件 | **−20** | + 30 日 Payout Hold |
| **DMCA / 著作権 strike 確定** | **−100** | **即時 TS=0 級 · Rank Bronze 強制** |
| **不正確定（自己投げ銭 / BOT 操作）** | **−100** | **即時 TS=0 · PPC 除外 · 還元停止** |

**更新タイミング:** **イベント駆動**（即時）+ **日次監査**（03:30 JST · 異常パターン再評価）

#### 5.5.2 TS による OS ゲート

| TS | 制御 |
| --- | --- |
| ≥ 90 | 95% Override 候補可 |
| ≥ 80 | 90% Override 候補可 |
| < 80 | **Override Layer 無効** |
| < 50 | **還元停止** + 手動レビュー |
| = 0 | 露出ゼロ · 延長 cap · Ops 強制レビュー |

#### 5.5.3 TS 回復ルート（v1 · 2026-06-28 追記）

**原則:** TS 回復は **イベント駆動 + Ops 監査必須**。**時間経過のみの自動満点回復は禁止**（§10.2 整合）。`creator_score_events` に **正の delta** と `reason_code` を記録。

**回復イベント（approved recoveries）**

| reason_code | 条件 | 加点 | 頻度上限 |
| --- | --- | --- | --- |
| `TS_FALSE_POSITIVE_REVERSAL` | Ops が誤判定解除を確定 · 監査ログ必須 | **誤適用 penalty を全額復元**（当該 event の \|delta\| まで） | ケース 1 回 |
| `TS_CLEAN_PERIOD_RECOVERY` | **連続 30 日** T&S 新規 penalty なし · 未解決 dispute / collusion / self_gift 疑義なし | **+5** | **90 日あたり最大 +15**（30 日ごと 1 回 · 日次 03:30 JST バッチ） |
| `TS_KYC_COMPLETED` | マネロン段階 1 解除 · **追加 KYC PASS** · DMCA / 自己投げ / 共謀 **確定なし** | **+10**（1 回限り） | Creator 生涯 1 回 |
| `TS_OPS_REVIEW_PASS` | Ops レビュー PASS（§5.5.3 復帰条件 ALL） | **+10〜+15**（severity に応じ Ops 裁量） | **90 日あたり 1 回** |

**回復上限（Creator 単位 · 暦月）**

| ルール | 値 |
| --- | --- |
| **通常回復合計上限** | **+30 / 暦月**（`TS_FALSE_POSITIVE_REVERSAL` は **上限外**） |
| **単月 TS 上限** | **100**（clamp 維持） |
| **Override 再開** | TS ≥ **80** 必須（§5.5.2 · §5.8 不変） |

**復帰条件（還元 · 露出 · Override）**

| 状態 | 還元再開 | TS 回復 | 備考 |
| --- | --- | --- | --- |
| **TS < 50** | `TS_OPS_REVIEW_PASS` + KYC 有効 + 未解決 CB/dispute なし | 上表の回復イベント可 | 還元停止解除 ≠ TS 満点。`payout_hold` は PASS まで維持可 |
| **TS = 0** | Ops PASS + **連続 90 日** 新規 major penalty なし | 初回復帰 **TS ≤ 40** キャップ · 以降は通常回復ルール | 露出は TS ≥ 50 まで **制限維持** |
| **TS ≥ 50** | 通常 D+7 還元フロー（§7.4 hold 解除条件） | 通常回復ルール | — |

**回復不可 · 上限付き回復（major sanctions）**

| 確定事由 | TS 回復 | 還元 | 上限 |
| --- | --- | --- | --- |
| **DMCA / 著作権 strike 確定** | **原則不可** · Ops 例外は **TS ≤ 40** まで | 90 日還元停止 | 1 年に 1 回まで Ops 例外可 |
| **マネロン CONFIRMED** | **不可** | **永久停止** | — |
| **自己投げ確定** | 確定後 **90 日間回復不可** · 以降 clean period + Ops PASS のみ | 30 日〜還元停止（§7.1） | 回復後も **TS ≤ 60** キャップ · **180 日** |
| **共謀確定（severe / repeat）** | 確定後 **180 日間回復不可** | **90〜180 日**還元停止（§7.5） | 回復後 **TS ≤ 50** キャップ · **365 日** |
| **チャージバック** | `TS_CLEAN_PERIOD` のみ（CB 自体の TS−20 は自動復元しない） | hold 30d（§7.4） | — |

**Ops レビュー PASS 必須チェック（TS < 50 / TS = 0 復帰）**

- [ ] 疑義 case の **confirmed / cleared** 判定済み
- [ ] 追加 KYC 有効（該当時）
- [ ] 未解決 `dispute` · `payment_reversals` · `suspicious_collusion_flag` なし
- [ ] `admin_audit_log` に operator_id · case_id · 復元 delta 記録

**実装:** Score ワーカー / 日次バッチ · Ops UI `/admin/tlv/trust` — [ADMIN_SYSTEM.md](./ADMIN_SYSTEM.md) §6.5

---

### 5.6 Score 更新タイミング（確定）

| 軸 | 更新頻度 | トリガ | 用途 |
| --- | --- | --- | --- |
| **FS** | **リアルタイム** | 課金 · fee · infra · 還元イベント | Dashboard · 当日 Score |
| **ES** | **リアルタイム** | 視聴 · チャット · 延長コイン | Dashboard · ゲージ難易度 |
| **GS** | **日次** | 03:00 JST バッチ | Score 合成 · Rank 入力 |
| **TS** | **イベント + 日次監査** | T&S イベント · 03:30 JST | Override ゲート · 不正 |

```text
CreatorScore_live = FS + ES + GS_last_daily + TS   // UI 表示用（秒級）
CreatorScore_day  = FS_eod + ES_eod + GS + TS      // 日次確定
Score_MA30        = avg(CreatorScore_day, 30d)      // Rank / 還元公式
```

---

### 5.7 Rank 変換ロジック（Score → Rank）

**公式判定:** `Score_MA30` · 毎月 1 日 00:00 JST 確定（Legend は PPR 定員制 §6.4）

| Rank | Score レンジ | base_rate |
| --- | --- | --- |
| **Bronze** | **0 – 499** | 50% |
| **Silver** | **500 – 649** | 60% |
| **Gold** | **650 – 749** | 70% |
| **Platinum** | **750 – 849** | 80% |
| **Diamond** | **850 – 929** | 85% |
| **Legend** | **930 – 1000** | 88% |

```typescript
function tierFromScore(score: number): RankTier {
  if (score >= 930) return 'Legend';   // §6.4 定員・PPR 選抜を別途適用
  if (score >= 850) return 'Diamond';
  if (score >= 750) return 'Platinum';
  if (score >= 650) return 'Gold';
  if (score >= 500) return 'Silver';
  return 'Bronze';
}
```

---

### 5.8 Override Tier 発動条件（Score 連動）

**対象:** **Diamond 以上**（Score MA30 ≥ 850）のみ 90% 候補 · **Legend のみ** 95% 候補

**90% Override（`PAYOUT_TIER_90`）— ALL PASS:**

| # | 条件 |
| --- | --- |
| T90-1 | `rank_tier` ≥ **Diamond** |
| T90-2 | `Score_MA30` ≥ **900** |
| T90-3 | `WR_month` ≥ **0.70** |
| T90-4 | `TS` ≥ **80** |
| T90-5 | 自己投げ / BOT 疑義 **0 件**（当月） |

**95% Override（`PAYOUT_TIER_95`）— Legend のみ · ALL PASS:**

| # | 条件 |
| --- | --- |
| T95-1 | `rank_tier` = **Legend**（定員内） |
| T95-2 | `Score_MA30` ≥ **950** |
| T95-3 | `WR_month` ≥ **0.85** |
| T95-4 | `TS` ≥ **90** |
| T95-5 | 月間 **PPC** ≥ **¥500,000**（自己投げ除外） |

**未達:** Override = 0 · Base Layer のみ（ペナルティなし）

---

### 5.9 Score の役割 — OS 出力（5 系統）

Score は以下 **すべて** の基準となる。実装は **単一 Score サービス** から配信すること。

| # | 制御対象 | 入力 | 出力 |
| --- | --- | --- | --- |
| 1 | **Rank 決定** | Score_MA30 | Bronze〜Legend（§5.7 · §6.4） |
| 2 | **還元率制御** | Rank + Override 条件 | base_rate · effective_rate |
| 3 | **露出アルゴリズム** | Score · ES · ゾーン | feed · 検索 · 推荐 · イベント枠 |
| 4 | **不正検知補助** | TS · FS_PPC 異常 | T&S queue 優先度 · hold フラグ |
| 5 | **ゲーム難易度調整** | Score · ES | 延長ゲージ係数 · オーバーゲージ cap |

**露出（#3）:**

```text
feed_weight     = base × (0.4 + Score_MA30/2500) × zone_mult     // A=0.8 B=1.0 C=1.2
search_rank_boost = clamp((Score_MA30 - 500) / 500, 0, 0.35)
event_eligible  = Score_MA30 >= 500 AND TS >= 80
raid_priority   = ES_EXT × Score_MA30 / 1000
```

**ゲーム難易度（#5）:**

```text
gauge_difficulty = clamp(1.2 - (Score_MA30 - 500) / 1000, 0.8, 1.2)
// Score 低 → gauge 充填しやすい（新人救済）
// Score 高 → gauge 厳しめ（高 CCU インフラ保護）
adjusted_gauge = gauge_pct / gauge_difficulty
```

**不正補助（#4）:**

```text
fraud_priority = (100 - TS) * 10 + (FS_PPC spike ? 50 : 0)
if TS <= 0 OR fraud_priority >= 800 → auto payout_hold
```

---

### 5.10 実装スキーマ · 履歴トレース

**完全 DDL · インデックス · FK · ENUM:** [`db/tlv_schema.sql`](../db/tlv_schema.sql) · 設計書 [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md)

**責務分離:**

| 正本 | テーブル |
| --- | --- |
| 金額 | `tlv.payments` · `tlv.revenue_ledger` |
| Rank / 還元 | `tlv.creator_score_monthly` |
| UX / ゲージログ | `tlv.stream_events`（金額なし） |

**月次スナップショット（必須 · Rank/還元正本）:**

```sql
CREATE TABLE tlv.creator_score_monthly (
  creator_id    uuid NOT NULL,
  month_id      char(7) NOT NULL,
  fs            smallint NOT NULL CHECK (fs BETWEEN 0 AND 400),
  es            smallint NOT NULL CHECK (es BETWEEN 0 AND 300),
  gs            smallint NOT NULL CHECK (gs BETWEEN 0 AND 200),
  ts            smallint NOT NULL CHECK (ts BETWEEN 0 AND 100),
  total         smallint NOT NULL CHECK (total BETWEEN 0 AND 1000),
  score_ma30    numeric(6,2) NOT NULL,
  rank_tier     tlv.rank_tier NOT NULL,
  override_tier tlv.override_tier NOT NULL DEFAULT 'none',
  base_rate     numeric(5,4) NOT NULL,
  effective_rate numeric(5,4) NOT NULL,
  ppr_30d       numeric(8,4),
  ppc_month_jpy bigint NOT NULL DEFAULT 0,
  wr_30d        numeric(6,4) NOT NULL DEFAULT 0,
  wr_month      numeric(6,4) NOT NULL DEFAULT 0,
  tier_90_pass  boolean NOT NULL DEFAULT false,
  tier_95_pass  boolean NOT NULL DEFAULT false,
  inputs_json   jsonb NOT NULL,
  locked_at     timestamptz,
  PRIMARY KEY (creator_id, month_id)
);
```

**日次 + イベント履歴（必須）:**

```sql
CREATE TABLE creator_score_daily (
  creator_id uuid NOT NULL,
  score_date date NOT NULL,
  fs es gs ts total smallint NOT NULL,
  PRIMARY KEY (creator_id, score_date)
);

CREATE TABLE creator_score_events (
  id           bigserial PRIMARY KEY,
  creator_id   uuid NOT NULL,
  axis         char(2) NOT NULL,           -- FS | ES | GS | TS
  delta        smallint NOT NULL,
  reason_code  text NOT NULL,              -- e.g. SELF_GIFT_CONFIRMED
  source_id    uuid,
  created_at   timestamptz DEFAULT now()
);
```

**API（Score サービス）:**

```text
GET  /api/tlv/creator/me/score          → { fs, es, gs, ts, total, score_ma30, rank }
POST /internal/score/recalc             → { creator_id, axes: ['FS'|'ES'|'GS'|'TS'] }
GET  /api/tlv/creator/me/score/history  → monthly + event trace（本人のみ）
```

---

## 6. Creator Rank System

### 6.1 Base Layer — Rank テーブル（§5.7 同期）

| Rank | Score MA30 | **base_rate（Net）** | ゾーン |
| --- | --- | --- | --- |
| **Bronze** | 0 – 499 | **50%** | A |
| **Silver** | 500 – 649 | **60%** | A |
| **Gold** | 650 – 749 | **70%** | B |
| **Platinum** | 750 – 849 | **80%** | B |
| **Diamond** | 850 – 929 | **85%** | B〜C |
| **Legend** | 930 – 1000 | **88%** | C |

**還元レンジ:** Base **50〜88%** + Override **90/95%**（§5.8 条件付き）

### 6.2 Override Layer — Tier 条件（§5.8 同期）

**90% Override — Diamond 以上 · ALL PASS:**

| # | 条件 | 閾値 |
| --- | --- | --- |
| T90-1 | rank_tier | ≥ **Diamond** |
| T90-2 | Score_MA30 | ≥ **900** |
| T90-3 | WR_month | ≥ **0.70** |
| T90-4 | TS | ≥ **80** |
| T90-5 | 自己投げ / BOT 疑義 | 0 件 |

**95% Override — Legend のみ · ALL PASS:**

| # | 条件 | 閾値 |
| --- | --- | --- |
| T95-1 | rank_tier | **Legend**（定員内） |
| T95-2 | Score_MA30 | ≥ **950** |
| T95-3 | WR_month | ≥ **0.85** |
| T95-4 | TS | ≥ **90** |
| T95-5 | 月間 PPC | ≥ **¥500,000** |

**未達:** Override = 0 · base_rate のみ

### 6.3 昇格 · 維持 · 降格（月次 · Score_MA30）

```text
maintain_floor = RANK_SCORE_FLOOR[current_tier] - 40
// 例: Gold(650) → maintain_floor 610 · 7日連続 MA30 < 610 → 1段降格
Score_MA30 < maintain_floor が 7 日連続 → 1 ティア降格（最低 Bronze）
```

| Rank | RANK_SCORE_FLOOR |
| --- | --- |
| Bronze | 0 |
| Silver | 500 |
| Gold | 650 |
| Platinum | 750 |
| Diamond | 850 |
| Legend | 930 |

### 6.4 Legend — 定員 100 · PPR 選抜 · 動的入替

| ルール | 内容 |
| --- | --- |
| **スコア資格** | Score MA30 ≥ **930**（Legend レンジ） |
| **定員** | **最大 100 名** |
| **選抜** | 資格者のうち **PPR_month 降順** 上位 100 |
| **待機リスト** | 101 位以降 · PPR 降順 · `legend_waitlist_position` |
| **動的入替** | 毎月 1 日 · waitlist 最上位 PPR > 在籍最下位 PPR → **入替** |
| **95% Override** | Legend 在籍 **かつ** Score MA30 ≥ **950** · TS ≥ 90 · PPC ≥ ¥500k |

```typescript
function evaluateLegend(creators: Creator[]): void {
  const eligible = creators.filter(c =>
    c.score_ma30 >= 930 && c.ts >= 80 && !c.payout_hold
  );
  const ranked = eligible.sort((a, b) => b.ppr_month - a.ppr_month);
  const legends = new Set(ranked.slice(0, 100).map(c => c.id));
  for (const c of creators) {
    if (legends.has(c.id)) c.rank_tier = 'Legend';
    else c.rank_tier = tierFromScore(c.score_ma30);
    c.legend_waitlist_position = ranked.findIndex(x => x.id === c.id) + 1 || null;
  }
}
```

### 6.5 還元額計算（二層合成 · 確定）

```text
base_rate      = RANK_BASE_RATE[rank_tier]                    // Layer 1
override_rate  = tier95 ? 0.95 : tier90 ? 0.90 : 0           // Layer 2
effective_rate = min(0.95, max(base_rate, override_rate))
creator_payout = floor(net_attributed_clean × effective_rate) // self_gift 除外 Net

if platform_retained < 0:
  effective_rate = profit_first_clamp(...)   // Override も無効化し得る
```

---

## 7. Anti-Fraud System

### 7.1 自己投げ銭 — PPC 除外（確定）

| 段階 | 処理 |
| --- | --- |
| 検知 | SG-01〜04（§7.3 クロスチェック連動） |
| 疑義 | `ledger.self_gift_flag = true` · payout 保留 |
| **確定** | **PPC · FS · Override 判定から当該 Net 完全除外** |
| 制裁 | **TS −100** · Bronze 強制 · 還元停止 30 日 |

```text
net_attributed_clean = net_attributed - Σ net(self_gift_confirmed)
PPR_month = platform_profit_clean / max(net_attributed_clean, 1)
```

### 7.2 BOT — 実効 CCU モデル（確定）

```text
bot_score = clamp(Σ signal_weight, 0, 1)
effective_ccu = Σ max(0, 1 - bot_score_i)

用途: 延長ゲージ · Infra 按分 · ES_UU · 露出 UNIQ_VIEW
bot_score >= 0.7 → 視聴除外 · ES 除外 · 24h BAN
```

### 7.3 クロスチェック（デバイス · 名義 · 行動ログ）

| データ源 | チェック | 用途 |
| --- | --- | --- |
| `device_id` | 同一端末 · 複数 account · Creator 端末 | SG-02 · 初回 coin 拒否 |
| `kyc_id` / カード名義 | payer ↔ creator 一致 | SG-01 |
| `ip_hash` / geo | 異常集中 · 50 session/日 | BOT 0.4 weight |
| `behavior_log` | 0 秒視聴 cheer のみ · 還元直前 gift 集中 | SG-04 · BOT 0.5 |
| `payment_channel` | Web/App 混在パターン異常 | Ops レビュー |

**実装:** `trust_signals` テーブル · イベント毎 `cross_check_score` · Ops queue 連動

### 7.4 30 日 Payout Hold（必須）

| ホールド種別 | 期間 | トリガ |
| --- | --- | --- |
| **新規 Creator 初回出金** | **30 日** | チャンネル作成 |
| **チャージバック** | **30 日** | 最終 CB イベント |
| **自己投げ疑義〜確定** | **30 日** | SG フラグ |
| **共謀疑義〜確定** | **30〜180 日** | `suspicious_collusion_flag` · §7.5 |
| **Clawback shortfall / frozen** | **解消まで** | `payment_reversals.coins_shortfall` · wallet frozen |
| **通常還元** | D+7 | hold 解除条件 ALL PASS |

**必須:** 上記 Hold なしでの初回高額出金は **禁止**（FinOps CRIT）

### 7.5 共謀（Collusion）— 自己投げとは別軸（v1 · 2026-06-28 追記）

**定義:** **複数 account / Creator 間**で gift · tip を循環させ **還元 · Score · Override を不当に得る**行為。自己投げ（payer = creator 同一主体）は §7.1。**v1 はルールベース検知**（グラフ ML は Future · `TODO.md` TODO-COLLUSION-GRAPH）。

**自己投げとの境界**

| 軸 | 自己投げ（§7.1） | 共謀（§7.5） |
| --- | --- | --- |
| 主体 | payer ↔ creator **同一 KYC / device** | **異なる account 間**の相互 · 循環 · 洗浄 |
| フラグ | `self_gift_flag` | `suspicious_collusion_flag` |
| 典型 | SG-01〜04 | CL-01〜05 |

**v1 検知ルール（CL-01〜05 · Ops triage 連動）**

| ID | パターン | 条件（目安） | 初動 |
| --- | --- | --- | --- |
| **CL-01** | **相互投げ** | 7 日以内 A→B と B→A 各 ≥ ¥10,000 Net | `suspicious_collusion_flag` · Ops queue |
| **CL-02** | **グループ循環** | 14 日以内 3+ Creator リング状 tip ≥ ¥5,000/辺 | 同上 + `payout_hold` 推奨 |
| **CL-03** | **三角投げ** | A→B · B→C · C→A 14 日以内成立 | 同上 |
| **CL-04** | **閉じたギフトネットワーク** | 30 日 · ≥3 account · グループ内 gift ≥ **80%** | 同上 + TS 調査優先 |
| **CL-05** | **資金洗浄（多 account）** | 同一 device / 決済 trace で ≥3 payer → 1 Creator 集中 | マネロン段階 1 連動 · hold |

**段階処理**

| 段階 | フラグ | payout | PPC / Override | TS |
| --- | --- | --- | --- | --- |
| **疑義（suspicious）** | `suspicious_collusion_flag=true` | **hold 推奨** | 当該 tip **計上保留** | — |
| **確定（confirmed）** | `collusion_confirmed` | **hold 30〜90 日** | **PPC · FS · Override から当該 Net 完全除外**（§7.1 同様） | **−50〜−100**（severity） |
| **repeat / severe** | `collusion_repeat` | **還元停止 90〜180 日** | 永久除外対象 Net 累積 | **TS −100** · Override **無効 180 日** |

```text
net_attributed_clean = net_attributed
  - Σ net(self_gift_confirmed)
  - Σ net(collusion_confirmed)
```

**Ops 導線:** `/admin/tlv/trust` → collusion queue · `cross_check_score` 連動 · `admin_audit_log` 必須 — [ADMIN_SYSTEM.md](./ADMIN_SYSTEM.md) §6.6

### 7.6 Clawback · Chargeback 運用（Creator 相殺 · v1 · 2026-06-28 追記）

**技術正本:** [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) §6.5 · [reports/tlv-payment-chargeback-clawback-design.md](../reports/tlv-payment-chargeback-clawback-design.md)

| シナリオ | 相殺経路 | Wallet | payout_hold |
| --- | --- | --- | --- |
| **CB / refund · payout 前** | 自動 RPC · `revenue_ledger` adjustment · 未出金 Creator 残高から相殺 | claw 可能分 debit · **balance ≥ 0** | dispute 即時 + lost 後 30d |
| **CB · tip 使用済** | tip 溯源 adjustment · Creator 還元分逆仕訳 | 同上 | 同上 |
| **将来売上相殺（v1）** | **次回以降 payout バッチから控除**（`payout_log` 調整 · FinOps 承認）— **ネガティブ残高テーブル禁止** | **マイナス禁止** | hold 維持 until 回収完了 |
| **payout 済み** | **FinOps manual** Stripe Connect 逆送金 · `manual_finops` | — | case 解消まで hold 可 |

**回収不能時:** `creators.payout_hold=true` 継続 · `account_review` フラグ · Ops アカウント審査 · 必要時還元永久停止（§7.1 / §7.5 整合）。**利用規約 · 運用ポリシー文案** — `TODO.md` **TODO-LEGAL-CB-01**

---

## 8. Infrastructure Model

**前提:** LL-HLS + CDN · CCU スケール連動変動費 · **本セクションは必須仕様**（省略不可）

### 8.1 CCU 別コスト（100 / 1,000 / 10,000）

| CCU | InfraFree | InfraExt | 60分合計 |
| --- | --- | --- | --- |
| **100** | ¥150 | ¥200 | **¥350** |
| **1,000** | ¥150 | ¥2,000 | **¥2,150** |
| **10,000** | ¥150 | ¥20,000 | **¥20,150** |

**技術:** RTMP → **LL-HLS** · **Cloudflare CDN** · Workers Realtime（DO）

### 8.2 CDN キャッシュ戦略

| レイヤ | 戦略 |
| --- | --- |
| LL-HLS ライブ | 2s セグメント · edge cache · origin shield |
| VOD / ショート | R2 + CDN · TTL 24h+ |

### 8.3 非アクティブ軽量化（必須）

| 条件 | 動作 | 必須 |
| --- | --- | --- |
| 視聴者 BG 60s | 480p · 音声のみ | **✅** |
| CCU 50% idle | 640→400 kbps | **✅** |
| 配信者 AFK 15min | 自動終了 | **✅** |
| CCU=0 が 10min | セッション pause | **✅** |

### 8.4 動的ビットレート制御（必須）

| CCU | 解像度 | ビットレート |
| --- | --- | --- |
| 0〜999 | 720p | 640 kbps |
| 1,000〜7,999 | 720p | 800 kbps |
| 8,000+ | 480p 降格 | 500 kbps cap |

---

## 9. Ecosystem Design

### 9.1 A / B / C モデル（役割確定）

```text
┌──────────────────────────────────────────────────────────────┐
│  C: 大規模（1,001〜10,000 CCU）                               │
│  ブランド · 広告塔 · 上限形成                                  │
│  Legend（PPR 競争 100 名）· Diamond · Override 95% 候補       │
├──────────────────────────────────────────────────────────────┤
│  B: 中規模（100〜1,000 CCU）— ★主戦場★                       │
│  収益最大化ゾーン · FM_15 · 延長エコノミーの中心               │
│  Gold / Platinum · Base 70〜85% · Override 90% 主戦場          │
├──────────────────────────────────────────────────────────────┤
│  A: 小規模（10〜99 CCU）                                      │
│  ロングテール · 盾 · 固定費吸収                                │
│  Bronze / Silver · Base 50〜60% · 無料 infra cap ¥150         │
└──────────────────────────────────────────────────────────────┘
```

| ゾーン | 役割 | Creator 比 | Net 寄与 | Platform 施策 |
| --- | --- | --- | --- | --- |
| **A** | **盾 · 固定費吸収** · ロングテール育成 | ~70% | ~15% | ルーキーイベント · 延長 cap · 低 infra |
| **B** | **主戦場 · 収益最大化** | ~25% | **~65%** | Override 誘導 · ゲージ UX · Web インセンティブ |
| **C** | **ブランド · 広告塔 · 上限形成** | ~5% | ~20% | Legend PPR · イベント · Raid ハブ · infra ガード |

### 9.2 Creator Pool（月次再投資）

```text
pool_fund = floor(Σ platform_profit × 0.10)   // 赤字月 = 0
weight_i  = CreatorScore × net_attributed_clean
bonus_i   = floor(pool_fund × weight_i / Σ weight)
```

対象: Score MA30 ≥ 500 · TS ≥ 120 · hold なし

---

## 10. System Philosophy

### 10.1 三層統合 — 一貫性チェック

| 層 | 問い | PRD アンカー |
| --- | --- | --- |
| **ゲーム性** | 視聴者は楽しめるか | §4 サバイバル · ゲージ · ロスタイム · Raid |
| **経済性** | 赤字にならないか | §3 PL · 二層還元 · CCU コスト · Profit First |
| **OS 性** | 行動は数値で制御されるか | §5 Score · §6 Rank · 露出 · §7 不正 |

```text
         ┌──────────────┐
         │  L1 ゲーム性   │  UX · 参加 · 感情
         └──────┬───────┘
                │ 500coin = 延長 1 単位
    ┌───────────┼───────────┐
    ▼           ▼           ▼
 L2 経済性   L3 OS 性    持続性
  PL 二層    Score OS    AD-014
 Net/CCU    Rank/露出   条件先設計
```

### 10.2 設計原則（最終固定）

| # | 原則 |
| --- | --- |
| 1 | 還元 = **Base（Rank）+ Override（Tier）** 二層 · 混在禁止 |
| 2 | Override 90/95% = **例外ボーナス** · 常時適用禁止 |
| 3 | WR 75〜85% = **推奨** · Override 条件のみ · **強制ペナルティなし** |
| 4 | Legend = **100 名 · PPR 選抜 · 動的入替 · 待機リスト** |
| 5 | Rank/還元 = **月次 Score_MA30** · FS/ES **リアルタイム** · GS **日次** |
| 6 | Score = **FS400/ES300/GS200/TS100** · **5 系統 OS**（§5.9） |
| 7 | 自己投げ = **PPC 除外** · BOT = **実効 CCU** · **30 日 Hold 必須** |
| 8 | A/B/C = **盾 / 主戦場 / 上限形成** |
| 9 | infra 軽量化 · 動的 bitrate = **必須仕様** |

### 10.3 実装フェーズ

| Phase | スコープ |
| --- | --- |
| **P0** | ledger · 二層還元計算 · coin · 延長 500 |
| **P1** | Score 日次 · MA30 · Rank · payout preview API |
| **P2** | 月次 payout · Override tier · Legend PPR · Pool |
| **P3** | T&S · PPC 除外 · 実効 CCU · 30 日 hold |
| **P4** | 露出 weight · ゲージ UX · イベント |

### 10.4 関連正本

| ドキュメント | 内容 |
| --- | --- |
| [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) | **Payment/PL Engine** · フロー · API · テスト |
| [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) | **DB 設計 v1.2.3** · ER · 責務分離 |
| [`db/tlv_schema.sql`](../db/tlv_schema.sql) | **DDL 正本** · 14 テーブル |
| [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) | Score · Rank · Pool · API |
| [FINANCIAL_MODEL.md](./FINANCIAL_MODEL.md) | PL · infra · CCU |
| [PRICING.md](./PRICING.md) | コイン · 延長 · Web 誘導 |
| [ADMIN_SYSTEM.md](./ADMIN_SYSTEM.md) | T&S · Ops |
| [DECISIONS.md](./DECISIONS.md) | AD-014 |

---

## 11. Membership Subscription（追加設計 · 未実装）

**正本詳細:** [reports/tlv-membership-design.md](../reports/tlv-membership-design.md) · [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) §14 · [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) §11

**ステータス:** 導入方針 **採用** · 実装 **未着手** · Payment Engine Phase 2 · Creator Score · 90/95% 還元 **変更なし**

### 11.1 TLV 収益源（会計分離）

| 収益源 | 性質 | Payment レーン | 状態 |
| --- | --- | --- | --- |
| **Coin Purchase** | フロー · 前払い coin | `payments` · `viewer_wallets` · webhook | Phase 2 実装済 |
| **Tip** | フロー · 配信中消費 | `tips` · `tlv.create_tip` · gauge | Phase 2 実装済 |
| **Membership Subscription** | **ストック · 月次** | `user_subscriptions` · `subscription_invoices` | **追加設計のみ** |
| 広告 | 将来 | — | 未設計 |

**分離原則:**

1. UX 上は「推し支援」として Tip と **連動表示** 可
2. **会計 · DB · Ledger 上は Tip と完全分離**
3. サブスクは **Wallet coin を消費しない** — 法定通貨の直接決済
4. Stripe Billing / Apple IAP / Google Play Billing を将来想定 · **初期 MVP = Web Stripe Billing 優先**

### 11.2 メンバーシップの位置づけ

| 役割 | 説明 |
| --- | --- |
| ストック収益 | 投げ銭の **代替ではない** · 月次 MRR |
| 固定ファン化 | Creator コミュニティの継続関係 |
| Creator 収益安定 | 配信外の基礎収入 |
| Platform 予測性 | 月次売上 · FinOps · Profit First 補強（§3.1 `SubPlatformRevenue`） |

**30 分サバイバルの主軸は Tip / Gauge / Extension のまま** — メンバーシップは L1 ゲームループを **上書きしない**。

### 11.3 初期 MVP 特典（非 P2W）

**含める:**

- メンバーバッジ · 限定スタンプ · 限定チャット · 限定称号
- 限定プロフィール装飾 · 限定コミュニティ投稿閲覧

**含めない（初期）:**

- ゲージ直接回復 · 自動延長 · サブスク人数バフ
- 30 分サバイバル無効化 · サブスクだけで「勝てる」仕様

**将来検討:** イベント限定支援 · 週 1 支援 · メンバー限定ギフト · 毎月 coin grant（grant は `wallet_ledger` 必須）

### 11.4 Score / Legend との関係（制度不変）

- サブスク収益は Score に **反映可能** だが Tip と **同じ重みにしない**
- **Subscription Profit Contribution（SPC）** を新指標候補 — Tip PPC 100% · SPC 30〜50% 候補（[CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) §2.7）
- **サブスクだけで Legend / 95% を狙える設計にしない** — T95-5 等既存条件維持
- PPC / WR / TS / 定員 100 / PPR 順の構造 **変更禁止**

### 11.5 Platform 固定 Tier（価格）

クリエイター自由価格は **採用しない**。Platform 固定 Tier から選択:

| 候補 | JPY/月 |
| --- | --- |
| tier_300 | ¥300 |
| tier_500 | ¥500 |
| tier_1000 | ¥1,000 |
| tier_3000 | ¥3,000 |

Creator は名称 · 説明 · 特典（`benefits`）のみ編集 · 価格は固定（TODO-MEM-08）。

---

## 変更履歴

| 日付 | 版 | 内容 |
| --- | --- | --- |
| 2026-06-28 | **1.2.1 POLICY-SUPPLEMENT** | §5.5.3 TS 回復 · §7.5 Collusion · §7.6 Clawback 運用（Design Audit 追補 · Score/Rank/Override 不変） |
| 2026-06-28 | **1.2 SCORE-OS-FINAL + MEM** | §11 Membership Subscription 追加設計（未実装 · Coin/Tip/Score 制度不変） |
| 2026-06-28 | **1.2.3** | `viewer_wallets` / `wallet_ledger` 正式 DDL — coin 残高正本 · INSERT-only 監査 |
| 2026-06-28 | **1.2.2** | [TLV_PAYMENT_ENGINE.md](./TLV_PAYMENT_ENGINE.md) — Payment/PL 処理仕様 |
| 2026-06-28 | **1.2.1** | DB スキーマ v1.2 — [TLV_DB_SCHEMA.md](./TLV_DB_SCHEMA.md) · [db/tlv_schema.sql](../db/tlv_schema.sql) |
| 2026-06-28 | **1.2 SCORE-OS-FINAL** | Score 4 軸確定 FS400/ES300/GS200/TS100 · 数式 · Rank · Tier |
| 2026-06-28 | 1.1 FINAL | 還元二層 · WR · Legend PPR · MA30 |
| 2026-06-28 | 1.0 | 初版 — 統合 PRD |
