# TLV Event System — 実装仕様 v1

**最終更新:** 2026-06-28  
**種別:** 実装可能仕様  
**AD:** [DECISIONS.md](./DECISIONS.md) **AD-014**  
**関連:** [CREATOR_PROGRAM.md](./CREATOR_PROGRAM.md) · [PRICING.md](./PRICING.md) · [FINANCIAL_MODEL.md](./FINANCIAL_MODEL.md)

**設計原則:** 非 P2W · ユニークユーザー重視 · 継続率最大化 · Profit First（イベント単体 PL ≥ 0）

---

## 1. 年間カレンダー（JST）

| 月 | イベント ID | 名称 | 期間 |
| --- | --- | --- | --- |
| 1 | `EVT_NEWYEAR` | 新年サバイバル | 1/1–1/7 |
| 2 | `EVT_VALentine` | 推し活バレンタイン | 2/10–2/16 |
| 3 | `EVT_ROOKIE` | ルーキー＆メンター | 3/1–3/31 |
| 4 | `EVT_SPRING` | 春の陣取りウォーズ | 4/1–4/14 |
| 5 | `EVT_GW` | GW サバイバルフェス | 4/29–5/5 |
| 6 | `EVT_MIDSUMMER` | 夏前推し活ビンゴ | 6/15–6/30 |
| 7 | `EVT_SUMMER` | 夏の陣取りウォーズ | 7/15–7/31 |
| 8 | `EVT_OBON` | お盆ライブ祭 | 8/10–8/16 |
| 9 | `EVT_AUTUMN` | 秋のサバイバルフェス | 9/20–10/5 |
| 10 | `EVT_HALLOWEEN` | 推し活ビンゴ Halloween | 10/20–10/31 |
| 11 | `EVT_ROOKIE2` | ルーキー第2弾 | 11/1–11/30 |
| 12 | `EVT_YEAREND` | 年末グランドフェス | 12/20–12/31 |

**同時開催上限:** 2 イベント（メイン 1 + 常設ミニ 1）

---

## 2. イベント共通データモデル

```typescript
interface TlvEvent {
  id: string;
  name: string;
  start_at: string;       // ISO8601 JST
  end_at: string;
  type: 'territory' | 'seasonal' | 'oshi' | 'rookie' | 'festival' | 'bingo';
  budget_jpy_cap: number;   // Platform イベント費上限
  revenue_target_net: number;
  non_p2w: true;
  kpi: EventKpi;
}
```

---

## 3. 陣取りサバイバルウォーズ（`EVT_TERRITORY`）

### 3.1 目的

- ライブ延長 · ギフト収益向上
- **ユニーク視聴者** のルーム横断参加

### 3.2 参加条件

| 主体 | 条件 |
| --- | --- |
| Creator | `CreatorScore >= 300` · 当月ライブ ≥ 2 回 |
| Viewer | アカウント 7 日以上 · BOT スコア < 0.3 |

### 3.3 ルール

```text
1 視聴者 = 1 日 1 陣営投票（cheer 100 coin 以上で 1 票）
1 Creator ルーム = 1 マス
陣営スコア = uniq_voters * 10 + extension_blocks * 50 + gift_net / 100
```

**非 P2W  cap:**

- 1 user あたり **1 日 500 コイン** までイベントスコア換算
- 超過分はスコア **50% 減衰**

### 3.4 収益性

| 項目 | 値 |
| --- | --- |
| 想定 Net 増分 | +15% vs 非イベント週 |
| Platform イベント費 | ¥200,000/回（デジタル報酬のみ） |
| 損益分岐 | Net 増分 ≥ ¥200,000 |

### 3.5 KPI

| KPI | 目標 |
| --- | --- |
| 参加 Creator 数 | ≥ 500 |
| ユニーク参加 Viewer | ≥ 50,000 |
| 延長購入率 | +5pt |
| 7 日リテンション | +3pt |

---

## 4. 季節イベント（`EVT_SEASONAL`）

### 4.1 目的

- 新規 Viewer 獲得 · ショート → ライブ導線

### 4.2 参加条件

全 Creator · Viewer（BOT 除外のみ）

### 4.3 限定報酬（デジタル · 非売買）

| 報酬 | 取得条件 | P2W |
| --- | --- | --- |
| 季節バッジ | ライブ視聴 60 分 | なし |
| 限定スタンプ | ギフト 100 coin 1 回 | なし |
| プロフィール枠 | 7 日間ログイン 5 日 | なし |

**課金必須報酬: 禁止**

### 4.4 収益性

- ギフト売上 +10% 想定 · イベント費 ≤ ¥100,000

### 4.5 KPI

| KPI | 目標 |
| --- | --- |
| MAU 増 | +8% |
| ショート → ライブ CTR | ≥ 12% |

---

## 5. 推し活ビンゴ（`EVT_OSHI_BINGO`）

### 5.1 目的

- **1 Creator ファン** の継続視聴 · 複数視聴者（石油王排除）

### 5.2 ビンゴカード（5×5）

```text
マス例: 「30分視聴」「コメント1回」「100coinギフト」「3日連続視聴」「シェア1回」
FREE マス: 中央（配信視聴1回）
```

### 5.3 非 P2W

- 課金マスは最大 **5/24 マス**
- 1 ライン完成報酬 = デジタル称号（還元率・ランク **無影響**）
- ビンゴ完成 **1 user / イベント 1 回**

### 5.4 収益性

- ギフト +8% · 延長 +5% · 費用 ¥50,000

### 5.5 KPI

| KPI | 目標 |
| --- | --- |
| 1 Creator あたり参加 UU | ≥ 30 |
| 28 日リテンション | +5pt |

---

## 6. ルーキー＆メンター（`EVT_ROOKIE`）

### 6.1 目的

- 初心者 Creator 成長 · 石油王依存排除

### 6.2 参加条件

| ロール | 条件 |
| --- | --- |
| ルーキー | チャンネル作成 ≤ 90 日 |
| メンター | `Rank >= Platinum` · `CreatorScore >= 750` · opt-in |

### 6.3 ルール

```text
ルーキー: Growth Score +20 ボーナス（イベント期間）
メンター: ルーキー 3 チャンネル支援 · 各 1 ライブ同席
報酬: ルーキー — 初延長 100 coin 割引（Platform 負担）
      メンター — デジタルメンターバッジ + Pool weight ×1.1（当月のみ）
```

**還元率・Rank 直接付与: 禁止**

### 6.4 KPI

| KPI | 目標 |
| --- | --- |
| 90 日継続率（ルーキー） | ≥ 40% |
| 初 Gold 到達 | 30 日以内 15% |

---

## 7. サバイバルフェス（`EVT_FESTIVAL`）

### 7.1 目的

- 大型収益 · ブランド · 延長文化定着

### 7.2 形式

- 48 時間連続 · **30 分サバイバル** 公式推奨
- トーナメント形式（Bracket 64 Creator）

### 7.3 参加条件

- Creator: `Score >= 500` · Trust ≥ 140
- エントリー **無料** · 優勝デジタルトロフィーのみ

### 7.4 収益性

| 項目 | 値 |
| --- | --- |
| 想定 Net | ¥5,000,000 / フェス |
| イベント費 cap | ¥500,000 |
| 最低 Profit Rate | 15% |

### 7.5 KPI

| KPI | 目標 |
| --- | --- |
| ピーク CCU | ≥ 5,000 |
| 延長 coin 消費 | ≥ 50,000 coins |
| 新規登録 | +20,000 |

---

## 8. デジタル報酬設計

| 種別 | 売買 | 還元影響 | 有効期限 |
| --- | --- | --- | --- |
| バッジ | 不可 | なし | 永久 |
| 称号 | 不可 | なし | 永久 |
| スタンプ | Marketplace 可 | なし | — |
| プロフィール枠 | 不可 | なし | 90 日 |
| エフェクト | Marketplace 可 | なし | — |

**イベント報酬の Creator Score 加点: 最大 +5 点/イベント（TS 系のみ · 金銭換算不可）**

---

## 9. イベント KPI 集計

```sql
-- 日次イベント KPI
INSERT INTO event_kpi_daily (event_id, date_jst, uniq_viewers, uniq_payers,
  net_revenue, extension_coins, gift_coins, platform_profit)
SELECT ...
```

**アラート:**

- `platform_profit < 0` かつ イベント 3 日目 → 報酬 cap 50% 削減
- `uniq_payers / uniq_viewers < 0.02` → 非 P2W ミッション追加

---

## 10. 非 P2W 実装チェックリスト

| ID | 検証 |
| --- | --- |
| NP2W-01 | 単一 user の event_score 日次 cap あり |
| NP2W-02 | 課金なしで取得可能報酬 ≥ 50% |
| NP2W-03 | イベント報酬が Rank/還元率を直接変更しない |
| NP2W-04 | 1 日課金上限（100,000 coin/user）と独立して event cap |
| NP2W-05 | ユニーク voter 重み > 単発高額 gift 重み |

---

## 11. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-06-28 | v1 — 年間 12 イベント · 非 P2W · KPI |
