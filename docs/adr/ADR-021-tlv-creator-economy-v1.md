# ADR-021 — TLV Creator Economy v1（還元・運営・AI監査）

> **2026-08-28 SUPERSESSION:** TLV cash revenue share now follows AD-040 `TLV_PROGRESSIVE_V1` on monthly Eligible Net (80/20, 90/10, 95/5, 99/1 marginal brackets). Older one-shot tables, maximum-95% statements, and Rank/Score payout descriptions in this ADR are historical only.

> **AD-040 ALIGNMENT (2026-08-12):** 投げ銭 **分配率** の現行 SSOT は [AD-040](./ADR-040-tasful-product-option-benefit-policy.md)。  
> 「全条件達成で 95%」「条件達成で還元率が上がる」記述は **SUPERSEDED**（履歴残置）。  
> **Rank / Score ≠ 投げ銭分配率。** Creator Benefit（15% 内部基準 · Option 選択）は AD-040。

| 項目 | 内容 |
| --- | --- |
| **ID** | **AD-021** |
| **ファイル** | `docs/adr/ADR-021-tlv-creator-economy-v1.md` |
| **日付** | 2026-08-07 · **整合更新 2026-08-12（AD-040）** |
| **状態** | **Accepted（思想・骨格）** · 投げ銭分配は **AD-040 が上位** · **実装未着手** |
| **対象** | TLV Creator Economy · ビジネスモデル · 運営予算思想 · AI 監査 · Rank/Score（別軸） |
| **親 ADR** | **AD-040**（上位）· **AD-019**（料金思想 · 整合済）· **AD-014** |
| **関連** | AD-020 · `docs/CREATOR_PROGRAM.md` · `docs/PRICING.md` · `docs/FINANCIAL_MODEL.md` |
| **実装** | **本 ADR では禁止** |

---

## 1. ADR本文（決定）

### 1.1 決定サマリ

TASFUL TLV の **Creator Economy（還元・運営思想・AI監査）** を次のとおり正式仕様として固定する。

| 柱 | 決定 |
| --- | --- |
| 目的 | **利益最大化ではない。** Creator · Platform · Viewer の **三方良し** |
| 差別化 | **分配の公正さ · Creator Economy · Options/Benefits · AI 経営**（コイン価格競争ではない） |
| ビジネスモデル | **固定利益モデルは採用しない。出来高制経営モデルを採用する** |
| **投げ銭分配（SSOT）** | AD-040 月間売上ティア（80/20 · 90/10 · 95/5） |
| 運営予算 | 実コスト吸収のための予算思想（利益枠ではない） |
| Rank / Score | **維持** · 露出/特典/健全性の別軸 · **分配率決定条件ではない** |
| Creator Benefit | AD-040（15% = INTERNAL CRITERION · 最低利益ライン未ロック） |
| AI 監査 | **毎日監査 · 改善案のみ。自動変更禁止。最終決定は運営者** |

本 ADR（v1）は思想と骨格の確定までとする。  
Creator ランク · 条件一覧 · 評価スコア詳細は **Future Tasks / 後継**（分配率とは分離）。

### 1.2 Creator Economy

| 項目 | 決定 |
| --- | --- |
| 目的 | TLV は **利益最大化を目的としない** |
| 目指す姿 | **Creator · Platform · Viewer の三方良し** |
| 差別化の軸 | **還元率** · **Creator Economy** · **AI 経営** |

コイン単価・安売り競争では差別化しない（AD-019 / AD-020 と整合）。

### 1.3 Business Model

| 項目 | 決定 |
| --- | --- |
| 固定利益モデル | **採用しない** |
| 採用モデル | **出来高制経営モデル** |

固定の「プラットフォーム利益率保証」や、マーケティング用の固定還元パッケージを先出ししない。  
成果・条件達成・運営予算の健全性に応じて経済を動かす。

### 1.4 Operator Budget（運営予算）

| 項目 | 決定 |
| --- | --- |
| 運営取り分 | **基準 20%** |
| 性質 | **これは利益ではない。運営者（TLV 運営）が受け取る運営予算である。** |

運営予算（基準 20%）から支払う例:

- API  
- Cloudflare  
- CDN  
- 配信帯域  
- Server  
- Storage  
- その他 TLV 運営費  

**残額**を運営利益とする。  
インフラ費用を無視した高還元の約束や、赤字前提の「最大還元保証」は採用しない。

> Gross / Net · 決済手数料控除順 · 税の扱いは AD-014 / `FINANCIAL_MODEL.md` / `TLV_PAYMENT_ENGINE.md` と整合させ、計算式の確定は後継タスクとする。本 v1 は「運営 20% = 運営予算」を固定する。

### 1.5 Creator Reward（投げ銭分配 · AD-040）

| 項目 | 決定 |
| --- | --- |
| **現行 SSOT** | [AD-040](./ADR-040-tasful-product-option-benefit-policy.md) `TLV_PROGRESSIVE_V1` |
| 0〜500万円部分 | Creator **80%** / TASFUL **20%** |
| 500万円超〜1,000万円部分 | Creator **90%** / TASFUL **10%** |
| 1,000万円超〜3,000万円部分 | Creator **95%** / TASFUL **5%** |
| 3,000万円超部分 | Creator **99%** / TASFUL **1%** |
| Rank / Score | **分配率決定条件ではない**（別軸として維持） |

#### ~~履歴: 条件達成型 · 「固定保証禁止」旧文（SUPERSEDED）~~

> 旧 v1 は「固定 80/90/95% 保証は採用しない」「95%=全条件達成時の理論最大」と記述した。  
> **分配率の決定ロジックは AD-040 売上ティアへ移行。** Rank 条件で分配率を階段上昇させるモデルは廃止。

### 1.6 Maximum Creator Marginal Share（AD-040）

| 項目 | 決定 |
| --- | --- |
| 最高 Creator 限界率 | **99%**（月間Eligible Netの **3,000万円超部分**） |
| 性質 | 累進Bracketの限界率。月額全体の実効率または一括適用率ではない |

### 1.7 AI Audit（AI 監査）

AI 社員は **毎日** 次を監査する:

- 売上  
- API  
- Cloudflare  
- CDN  
- Server  
- Storage  
- 利益  
- 運営予算  
- Creator 還元  

| 項目 | 決定 |
| --- | --- |
| AI の役割 | **改善案のみ提出する** |
| AI による自動変更 | **禁止** |
| 最終決定 | **運営者が行う** |

レート変更 · 条件変更 · 還元率の自動適用 · 予算配分の自動実行は、本 ADR の範囲外かつ禁止とする。

### 1.8 本 ADR で明示的に「やらないこと」

- Stripe / DB / schema / migration / UI / API 変更  
- AI 実装・プロンプト・自動実行の変更  
- Creator ランク · 条件一覧 · スコア · 計算ロジックの確定・実装  
- Production 変更  

---

## 2. 採用理由

1. **三方良し** — 短期のプラットフォーム利益最大化より、Creator の公正な還元と Viewer 体験、運営の継続を同時に満たす。  
2. **出来高制** — 固定還元は「約束倒れ」か「インフラ無視」のリスクが高い。条件達成型の方が AD-014 と整合し、健全運営と整合する。  
3. **運営 20% = 予算** — 「利益枠」と誤解させないことで、CDN・帯域・ストレージ等の実コストを前提にした設計ができる。  
4. **95% は上限** — 保証ではなく理論最大とすることで、虚偽の高還元訴求を防ぐ。  
5. **AI は監査と提案のみ** — 経済パラメータの自動変更は事故・不正・説明責任の欠落につながる。人間の最終決定を必須とする。  
6. **差別化の明確化** — コイン価格ではなく、還元・Creator Economy・AI 経営で競合と差をつける（AD-019 / AD-020 と一貫）。

---

## 3. Creator Economy思想

```text
TLV は利益を最大化するサービスではない。

AD-040 投げ銭分配（売上ティア）を適用し、
Actual TLV Profit を把握する。

目指すのは Creator · Platform · Viewer の三方良し。
差別化は 公正な分配 · Creator Economy · Options/Benefits · AI 経営。
```

| 原則 | 内容 |
| --- | --- |
| 非・利益最大化 | 取分の最大化を KPI の第一にしない |
| 投げ銭分配 | AD-040 売上ティア（80/20 · 90/10 · 95/5） |
| Rank / Score | 別軸 · 分配率決定条件ではない |
| 95% の意味 | 月間投げ銭 **≥1000万** 時の Creator 分配（AD-040） |
| Creator Benefit | AD-040 · 15% INTERNAL · Option 選択 · 最低利益ライン未ロック |
| AI | 監査・提案のみ · HUMAN APPROVE |

---

## 4. AI監査思想

| 原則 | 内容 |
| --- | --- |
| 頻度 | **毎日** |
| 対象 | 売上 · API · Cloudflare · CDN · Server · Storage · 利益 · 運営予算 · Creator 還元 |
| 出力 | **改善案のみ** |
| 禁止 | **AI による自動変更**（レート · 条件 · 還元 · 予算配分の自動適用） |
| 決定権 | **最終決定は運営者** |

AI は「経営の見える化と提案」まで。  
「経営の自動執行」は行わない。Emergency Stop / 人的承認の思想（AI Execution Gate）と整合する。

---

## 5. 将来拡張（Future Tasks）

本 ADR では決定しない。後継タスク / Phase 2 ADR へ持ち越す。

| 未決定項目 |
| --- |
| Creator ランク |
| 条件一覧 |
| AI 評価項目 |
| Quality Score |
| Community Score |
| 違反ペナルティ |
| イベント還元 |
| キャンペーン |
| ボーナス条件 |
| 還元計算ロジック |

---

## 6. Verdict

| 項目 | 結果 |
| --- | --- |
| **Verdict** | **PASS** |
| ADR 作成 | 完了（AD-021） |
| 実装 | **なし** |
| Stripe / DB / schema / UI / API / AI 実装 / Production | **未変更** |
| Production 影響 | **なし** |
| 変更ファイル | **`docs/adr/ADR-021-tlv-creator-economy-v1.md` のみ** |

### 本 ADR で確定したもの（再掲 · AD-040 整合後）

| 確定 |
| --- |
| 利益最大化しない · 三方良し |
| 出来高制経営モデル（固定利益モデル不採用） |
| **TLV分配 = AD-040累進Bracket（80/20 · 90/10 · 95/5 · 99/1）** |
| Rank / Score は別軸（分配率決定条件ではない） |
| Creator Benefit = AD-040（15% INTERNAL · 最低利益ライン未ロック） |
| AI は毎日監査 · 改善案のみ · 自動変更禁止 · 最終決定は運営者 |

---

## 改訂履歴

| 版 | 日付 | 内容 |
| --- | --- | --- |
| v1 | 2026-08-07 | 初版 Accepted（Creator Economy 思想・骨格 · 詳細条件・計算は持ち越し · 実装禁止） |
| v1.1 | 2026-08-12 | **AD-040 整合** · 投げ銭分配 SSOT 移行 · Rank≠分配率 · 条件達成型還元は SUPERSEDED |
