# ADR-025 — TLV Reward Formula SSOT v1（還元計算フローの唯一正本）

> **SUPERSEDED FOR FINANCIAL DECISIONS (2026-08-28):** AD-040 `TLV_PROGRESSIVE_V1` is the TLV cash revenue-share SSOT. Maximum-95%, fixed/conditional rate, Rank, Score, and Profit-First payout passages below are historical design only and must not drive settlement or payout amounts.

| 項目 | 内容 |
| --- | --- |
| **ID** | **AD-025** |
| **ファイル** | `docs/adr/ADR-025-tlv-reward-formula-v1.md` |
| **日付** | 2026-08-07 |
| **状態** | **Accepted（計算フロー・SSOT の確定）** · **実装未着手** |
| **対象** | TLV Creator Reward の **計算フロー（SSOT）** · 運営予算の位置づけ · 最大還元の意味 · AI 監査 · 変更権限 |
| **SSOT 宣言** | **本 ADR を TLV Reward Formula の唯一の SSOT とする** |
| **親・関連** | AD-019〜024（思想 ADR · **本 ADR を参照する**）· AD-014 · `docs/FINANCIAL_MODEL.md` · `docs/TLV_PAYMENT_ENGINE.md` · `docs/CREATOR_PROGRAM.md` |
| **実装** | **本 ADR では禁止**（Stripe / DB / schema / migration / UI / API / AI / Production 変更なし） |

---

## 1. ADR本文（決定）

### 1.1 目的と SSOT

ADR-019〜024 で確定した思想を、**実際の計算フローとして一本化する。**

| 項目 | 決定 |
| --- | --- |
| 本 ADR の役割 | **TLV Reward Formula の唯一の SSOT** |
| ADR-019〜024 の扱い | **思想 ADR**。還元計算フロー・運営予算の適用順・最大還元の定義が衝突した場合は **本 ADR（AD-025）を優先** する |
| 本 v1 で確定するもの | **フロー（順序）** · **哲学** · **権限** · **AI 監査方針** |
| 本 v1 で確定しないもの | **数値の計算式本体**（係数 · Score 比率 · ボーナス式等）→ Future Tasks |

> 監査レポート（`reports/tlv-pricing-adr-final-audit.md`）が指摘した「019/021 経済コアの二重記述」を解消するため、**計算フローの正本を本ファイルに集約する。**

### 1.2 決定サマリ

| 柱 | 決定 |
| --- | --- |
| 還元方式 | **固定還元率は採用しない。出来高制 Creator Economy** |
| 目的 | **利益最大化を目的としない** |
| 運営取り分 | **基準 20% = TLV 運営予算**（利益ではない） |
| フロー順 | 投げ銭売上 → 決済手数料 → 運営予算 20% →（予算内で運営費）→ 残額＝運営利益 · Creator Reward は別途出来高算出 |
| 最大還元 | **95%** = 理論上の最大（保証ではない · 全条件達成時のみ到達可能） |
| AI | 毎日監査 · 改善案のみ · 自動変更禁止 · 変更は運営者承認必須 |

### 1.3 Reward Flow（正式 SSOT）

次の順序を **正式な価値フロー** とする。

```text
投げ銭売上
    ↓
決済手数料（Stripe 等）
    ↓
TLV 運営予算（基準 20%）
    ↓
この 20% の中から支払う:
  · API
  · Cloudflare
  · CDN
  · 配信帯域
  · Server
  · Storage
  · その他 TLV 運営費
    ↓
残額 ＝ 運営利益
```

| ステップ | 意味 |
| --- | --- |
| 投げ銭売上 | Creator 向け投げ銭等に起因する売上の起点（Gross の定義詳細は Future / FINANCIAL 整合） |
| 決済手数料 | Stripe 等の決済コストを先に控除する |
| TLV 運営予算（基準 20%） | **利益枠ではない。継続運営のための予算** |
| 運営費の支払い | 上記予算の **中から** インフラ・運営費を支払う |
| 残額＝運営利益 | 予算消化後に残ったものが運営利益 |

**注意（SSOT）:**

- 「運営 20%」は **運営予算の基準** であり、Creator への固定還元の裏返し（常時 80% 還元）を意味しない。  
- Creator Reward は次節のとおり **固定率ではなく出来高制** で算出する。  
- Gross / Net の厳密定義 · 税 · IAP 手数料の扱い · 台帳上の勘定科目は `FINANCIAL_MODEL.md` / `TLV_PAYMENT_ENGINE.md` と整合させ、**係数・式の確定は Future Tasks**（本 v1 はフロー順を固定する）。

### 1.4 Creator Reward（出来高制）

| 項目 | 決定 |
| --- | --- |
| 固定還元率 | **採用しない** |
| 方式 | **出来高制** |
| 算出時に考慮する要素（方針） | **AI 監査** · **Creator 条件** · **Community 品質** · **運営状況** |

固定 80% / 90% / 95% 等の **保証制度は採用しない**（AD-021 と同一方針。衝突時は本 ADR）。

具体的な計算式 · 重み · 閾値は **今回は未決定**（§5 Future Tasks）。

### 1.5 Maximum Reward

| 項目 | 決定 |
| --- | --- |
| 理論上の最大還元率 | **95%** |
| 性質 | **保証値ではない** |
| 到達 | **全条件達成時にのみ到達可能** |

95% はマーケティング上の「常時還元」ではなく、条件をすべて満たしたときの **到達可能な上限** である。

### 1.6 Operator Budget

| 項目 | 決定 |
| --- | --- |
| 基準 | **20%** |
| 性質 | **利益ではない。TLV 運営予算である** |
| 用途 | この予算内で TLV を継続運営する（API · Cloudflare · CDN · 帯域 · Server · Storage · その他） |

予算を無視した高還元の約束、赤字前提の最大還元保証は採用しない。

### 1.7 AI Audit

AI 社員は **毎日** 次を監査する:

- 売上  
- 運営費  
- API  
- Cloudflare  
- CDN  
- 利益  
- Creator Reward  
- 運営予算  

| 項目 | 決定 |
| --- | --- |
| 出力 | **改善案のみ提出** |
| AI による自動変更 | **禁止** |
| 最終決定 | **運営者** |

### 1.8 Decision Authority（変更権限）

| 主体 | 権限 |
| --- | --- |
| AI | **提案のみ** |
| 運営者 | **最終決定** |

次の変更は **必ず運営者承認を必要とする**（AI 単独実行禁止）:

- 計算変更（Reward Formula · 係数 · フローの変更）  
- 還元変更（Creator Reward 率 · 到達帯の適用）  
- 運営予算変更（基準 20% の見直しを含む）  

AD-019〜024 の「改善案のみ · 自動変更禁止 · 運営者最終決定」と同一。本 ADR では **Reward Formula 領域の権限正本** とする。

### 1.9 思想 ADR（019〜024）との関係

| ADR | 役割（本 SSOT 下） |
| --- | --- |
| AD-019 | Pricing 思想 · 単位 · Phase 地図 |
| AD-020 | Coin / Gift / 延長の価格帯 |
| AD-021 | Creator Economy 思想 |
| AD-022 | Settlement / Payout / Fraud / Holding |
| AD-023 | Rank / Score / Penalty 方針 |
| AD-024 | Subscription 方針 |
| **AD-025** | **Reward Formula（計算フロー）の唯一の SSOT** |

還元計算フロー · 運営予算の適用順 · 最大還元の定義 · Formula 変更権限について、019〜024 と記述が重なる場合は **AD-025 を正** とする。  
019〜024 の改訂時は本 ADR を参照し、フロー矛盾を作らないこと（提案。本タスクでは 019〜024 を変更しない）。

### 1.10 本 ADR で明示的に「やらないこと」

- Stripe / DB / schema / migration / UI / API / AI 実装変更  
- Reward 計算式本体（係数 · シミュレーション）の確定・実装  
- Production 変更  
- ADR-019〜024 本文の改訂（本タスク範囲外）  

---

## 2. Reward Formula思想

```text
固定還元率は採用しない。
出来高制 Creator Economy を採用する。
利益最大化を目的としない。

運営 20% は利益ではなく TLV 運営予算。
予算内で継続運営し、残額を運営利益とする。

Creator Reward は AI 監査 · 条件 · Community · 運営状況を考慮して算出する。
95% は理論上の最大であり、保証ではない。
```

| 原則 | 内容 |
| --- | --- |
| 非・固定還元 | 常時 XX% を約束しない |
| 出来高制 | 条件達成・品質・運営状況に応じて算出 |
| 非・利益最大化 | 継続運営と三方良しを優先（AD-021 と整合） |
| 予算先行 | 決済手数料の後に運営予算 20% を確保 |
| 安全と整合 | 高還元訴求より健全な経済圏（AD-022） |
| 人的承認 | Formula / 還元 / 予算の変更は運営者承認必須 |

---

## 3. SSOT理由

1. **二重記述の解消** — AD-019 と AD-021 に同じ経済コアが並立していた（最終監査 FINDING-05）。計算フローの正本を一本化する。  
2. **実装の前提** — 思想だけでは Stripe / 台帳 / UI に落とせない。**順序（Flow）** を先に SSOT 化し、係数は後続で足す。  
3. **誤解の防止** — 「運営 20% ⇒ 常時 Creator 80%」という誤読を、フロー図で明示的に否定する。  
4. **権限の明確化** — AI が式を勝手に変えないこと、変更は運営者承認であることを Formula 領域の正本に書く。  
5. **親子関係** — 019〜024 は思想・周辺仕様、025 は Reward Formula。衝突時の優先順位を文書化する。  
6. **監査対応** — `reports/tlv-pricing-adr-final-audit.md` が推奨した P0「Reward Formula」に相当する。

---

## 4. AI監査思想

| 原則 | 内容 |
| --- | --- |
| 頻度 | **毎日** |
| 対象 | 売上 · 運営費 · API · Cloudflare · CDN · 利益 · Creator Reward · 運営予算 |
| 出力 | **改善案のみ** |
| 禁止 | **自動変更**（計算 · 還元 · 運営予算の自動適用） |
| 承認 | 計算変更 · 還元変更 · 運営予算変更は **運営者承認必須** |
| 最終決定 | **運営者** |

AI は「見える化と提案」まで。  
Reward Formula の執行・変更は行わない。

---

## 5. 将来拡張（Future Tasks）

本 ADR（v1）では **未決定**。後継タスク / 後継 ADR で定める。

| 未決定項目 |
| --- |
| Reward 計算式（係数 · 式本体） |
| Score 比率 |
| 条件比率 |
| Creator Bonus |
| Season Bonus |
| Campaign Bonus |
| Event Bonus |
| AI 重み付け |
| Reward シミュレーション |

式が確定した版は、本ファイルの改訂（v1.1+）または後継 ADR とし、**SSOT の単一性を維持する**（並行する第二の計算正本を作らない）。

---

## 6. Verdict

| 項目 | 結果 |
| --- | --- |
| **Verdict** | **PASS** |
| ADR 作成 | 完了（AD-025 · Reward Formula SSOT） |
| 実装 | **なし** |
| Stripe / DB / schema / UI / API / AI / Production | **未変更** |
| Production 影響 | **なし** |
| 変更ファイル | **`docs/adr/ADR-025-tlv-reward-formula-v1.md` のみ** |
| ADR-019〜024 | **本タスクでは未変更**（思想 ADR として本 ADR を参照する扱いを本文で宣言） |

### 本 ADR で確定したもの（再掲）

| 確定 |
| --- |
| TLV Reward Formula の **唯一の SSOT** は本 ADR |
| Reward Flow 順: 売上 → 決済手数料 → 運営予算 20% → 運営費 → 残額＝運営利益 |
| 20% = 運営予算（利益ではない） |
| Creator Reward = 固定率ではない · 出来高制（AI 監査 · 条件 · Community · 運営状況） |
| 95% = 理論最大 · 保証ではない · 全条件達成時のみ |
| AI = 毎日監査 · 改善案のみ · 自動変更禁止 |
| 計算 · 還元 · 運営予算の変更は運営者承認必須 |
| 計算式本体（係数等）は Future Tasks |

---

## 改訂履歴

| 版 | 日付 | 内容 |
| --- | --- | --- |
| v1 | 2026-08-07 | 初版 Accepted（Flow SSOT · 式本体は持ち越し · 実装禁止 · 019〜024 は思想 ADR として本 ADR 参照） |
