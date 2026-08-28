# ADR-040 — TASFUL Product / Option / Benefit Policy（SSOT）

| 項目 | 内容 |
| --- | --- |
| **ID** | **AD-040** |
| **ファイル** | `docs/adr/ADR-040-tasful-product-option-benefit-policy.md` |
| **日付** | 2026-08-12 |
| **状態** | **Accepted（製品思想・Option・Benefit・TLV Core の正本固定）** · **Pricing/Stripe/Benefit 実装・最低利益ライン数値ロックは後継** |
| **対象** | TASFUL 全体の料金思想 · API/SDK 選定姿勢 · Option 設計 · AI 社員 · Creator/Customer Benefit · TLV LIVE Core 構成 |
| **非対象** | 実装 · Production · DB schema · Stripe · Option Store · Benefit 付与実装 · 不明 API 価格の推測 · 15% 還元の最低利益ライン確定 |
| **関連** | **AD-036**（選定調査の二層 · 天井を下げない）· **AD-037/038**（Beauty/VTuber 選定履歴 · **製品パッケージングは本 ADR が上位**）· **AD-039**（LiveKit Core）· AD-014/019/021/024 · ADR-018 |

---

## 0. 最重要原則

TASFUL は「安い技術だけを使うサービス」ではない。

```text
COMMON BASE
+ STATE-OF-THE-ART PAID OPTIONS
+ PROFIT-BASED BENEFITS
```

| 禁止 | 内容 |
| --- | --- |
| 天井下げ | 安くするために機能品質の上限を下げること |
| 自作優先の誤謬 | 「自作できる」だけで優秀な外部 API/SDK を却下すること |
| TLV 品質 Tier LIVE | Free/Basic/Standard/Premium LIVE Core を作ること |

**API/SDK/Model 判断軸（必須）:**

1. Product Quality  
2. User Value  
3. Production Readiness  
4. Integration Feasibility  
5. Device / Browser Compatibility  
6. Commercial Terms  
7. Actual Cost  
8. Selling Price / Margin  
9. Vendor Risk  

---

## 1. 「無料」の定義

無料は「低品質版だから」ではない。

### A. LOW / ZERO MARGINAL COST

自社 DB · 既存ロジック · 画面 · ルール · 検索等で成立し、外部 API 原価がほぼ発生しない機能。  
可能な範囲まで無料提供してよい。

### B. PROFIT-BASED BENEFIT

本来有料でも、そのユーザーが TASFUL に十分な Actual Profit を生む場合、利益還元として無料利用権等を付与しうる。

---

## 2. AI / Short Tool 等（プラン制が成立する領域）

```text
Affordable Practical Base (COMMON BASE / PLAN)
+ State-of-the-Art Paid Option
```

| 禁止 | 「安いプランしかないため最高品質を使えない」状態 |
| --- | --- |

入口は安く・原価効率よく。天井は Option で開ける（AD-036 と整合しつつ、本 ADR が製品思想の上位正本）。

---

## 3. TLV — プラン型 LIVE Core を持たない（最重要）

TLV LIVE は次を **禁止** する:

- Free LIVE / Basic LIVE / Standard LIVE / Premium LIVE  
- 「無料ユーザー用の低品質 LIVE」  
- 「Basic 用の低品質 VTuber」等の二重品質 Core  

TLV 構成:

```text
ONE COMMON LIVE CORE
+ PAID OPTIONS
+ CREATOR BENEFITS
```

通常 LIVE の土台・配信品質は **全ユーザー共通**（Interactive Media Core 選定は AD-039）。

---

## 4. TLV PAID OPTIONS

通常 LIVE Core に必要なユーザーだけ Option を追加する。

**例（非限定）:** VTuber · Live2D/VRM Avatar · Beauty · SNOW-like Makeup · AR · Advanced Background · AI Voice / VC · Noise · Subtitle · Translation · AI LIVE Assistant · Moderator · AI Camera · Auto Highlight/Clip · LIVE Commerce AI · 今後の最新 LIVE Technology。

| 原則 | 内容 |
| --- | --- |
| 二重製品の禁止 | 「VTuber Basic / VTuber Premium」のような **同一 Option の無料低品質版＋有料高品質版** を正式製品として育てない |
| 品質 | Option として売る以上、価格の安さだけで技術品質を妥協しない |
| 選定 | その時点で実用可能な最高水準の API/SDK を積極候補にする |

正式表記の推奨:

```text
TLV LIVE + <Option Name> Option
```

（コード/PoC 上の `* Basic` ラベルは §5）

---

## 5. CURRENT VTUBER / BEAUTY「Basic」PoC の扱い

| 資産 | 扱い |
| --- | --- |
| MediaPipe + Three.js + three-vrm 等の VTuber「Basic」実装 | **削除禁止** |
| WebGL Beauty「Basic」実装 | **削除禁止** |

**分類（正式）:**

- PoC  
- technical reference  
- fallback candidate  
- comparison baseline  

**自動前提にしないこと:** 「無料ユーザー向け正式 VTuber Basic 製品」として育てること。

正式 TLV VTuber Option / Beauty Option は、2026 時点の商用 API/SDK を改めて選定する（自作継続 vs 外部は品質・Mobile・Safari·Tracking·商用条件·原価で比較）。

---

## 6. TLV ECONOMICS（出来高）

### 6.1 TLV Creator Revenue Share（2026-08-28 Human Decision）

TLV は通常の商品販売と分離し、1 Creator・1 JST月の **Eligible Net** に次のBracketを累進適用する。一括Tier方式ではない。

| 月間 Eligible Net の部分 | Creator限界率 | TASFUL限界率 |
| --- | ---: | ---: |
| **0円〜5,000,000円部分** | **80%** | **20%** |
| **5,000,000円超〜10,000,000円部分** | **90%** | **10%** |
| **10,000,000円超〜30,000,000円部分** | **95%** | **5%** |
| **30,000,000円超部分** | **99%** | **1%** |

- Eligible Net は既存方針どおり、決済手数料・Refund・Chargeback等の対象控除後を基準とする。
- 端数は既存の `MONTHLY_FINAL_FLOOR_ONCE` に従い、行・イベント・Bracketごとに丸めない。
- 30,000,000円では TASFUL 2,500,000円 / Creator 27,500,000円。
- 100,000,000円では TASFUL 3,200,000円 / Creator 96,800,000円（実効Creator率96.8%）。
- Rank、Score、`base_rate`、`override_tier` は分配計算に使用しない。
- 外向け「Creator還元 最大99%」は限界率の訴求候補であり、公開時は「月間Eligible Netに対する累進方式」を同時に明示する。

> 本節がTLV分配の正本。旧AD-040/AD-019/AD-021の80/90/95%一括Tierおよび条件達成型記述は履歴としてSUPERSEDED。

### 6.2 Actual TLV Profit

```text
Revenue
- Creator Distribution
- Streaming/API Cost
- Infrastructure Cost
- Payment Cost
- Option Cost
- Other Variable Cost
= Actual TLV Profit
```

通常 LIVE の配信原価は「個人固定の無料○時間プラン」として扱わない。

### 6.3 TOTAL PLATFORM FREE STREAMING COST CAP

AI 社員は利用者数 · Active Broadcasters · 総配信時間 · Viewer Minutes · Unit Cost · API Cost · Revenue · Actual Profit · Growth · Forecast 等から、

**「現在 TASFUL 側でどこまで通常 LIVE 配信原価を吸収可能か」**

を計算・提案してよい。これは個人固定無料時間プランではない。

```text
AI PROPOSE → HUMAN APPROVE → APPLY
```

料金/枠/制度の自動適用は禁止。

---

## 7. CREATOR / CUSTOMER BENEFIT

| 項目 | 決定 |
| --- | --- |
| 内部還元基準 | **15%**（Benefit 設計の内部基準） |
| 付与 | **無条件全員還元は禁止** · 一定以上の Actual Profit 貢献者のみ |
| 現金/無期限 Coin の大量付与 | **基本形にしない**（巨大残高化を避ける） |
| UX | 利益水準で選択可能な **有料 Option をカード提示**し、本人が選ぶ |

拡張イメージ（自動「全 Option 無料プラン」ではない）:

```text
1 Option → 2 → 3 → Multiple → （貢献大なら）Eligible Options を自己負担なしで選択可能な状態
```

**未解決（後継 ADR）:** 「一定以上」の最低 Actual Profit ライン · 15% の厳密な計算母数 · 税/決済手数料の扱い。本 ADR では数値を勝手にロックしない。

---

## 8. TALK 連携（方向）

```text
Profit Calculation
→ Eligibility
→ Available Benefits
→ TALK Benefit Card
→ User Select → [無料で使う]
→ Entitlement Grant → 30 days
→ Expire / Re-evaluate
```

使わない Option の勝手付与は禁止。

---

## 9. AI EMPLOYEE / AI SECRETARY（方向）

売上レポート係に留まらない。Revenue/Cost/Margin · API 原価変化 · Usage · Forecast · Creator 貢献 · Benefit 適格 · 無料開放提案 · Option 原価最適化 · Vendor 置換提案等を **提案** する。

**重要変更は必ず Human Approval**（AD-006 · AI Execution Gate と整合）。

---

## 10. AI / API RADAR（標準フロー）

```text
DISCOVER → VERIFY OFFICIAL SOURCE → QUALITY REVIEW → COST REVIEW
→ COMMERCIAL REVIEW → PoC → HUMAN REVIEW → OPTION CANDIDATE → PRODUCTIZE
```

目的: その時点で実用可能な最先端を TASFUL へ継続追加する。

---

## 11. AD-036 / AD-037 / AD-038 との関係

| ADR | 関係 |
| --- | --- |
| **AD-036** | 「天井を下げない · Premium を価格だけで落とさない · Benefit」は **維持**。調査時の Basic/Premium **候補列挙**は AI/Short 等で有効。**TLV Option の正式二重 SKU（Basic製品+Premium製品）は本 ADR が禁止**し、AD-036 の製品パッケージ解釈を更新する |
| **AD-037 / AD-038** | SDK 選定・PoC 履歴として残す。**正式製品名として「Beauty/VTuber Basic・Premium」を育てる前提は本 ADR で撤回**（PoC 名は残存可 · 削除禁止） |

---

## 12. 実装・禁止事項（本 ADR スコープ）

- Production / DB schema / Stripe / Pricing 実装 / Benefit 実装 / Option Store 実装 — **禁止（本 ADR）**  
- VTuber / Beauty PoC 削除 — **禁止**  
- LiveKit Formal baseline 変更 — **禁止**  
- 15% 最低利益ラインの勝手確定 · 不明 API 価格の推測 · TLV Free/Basic/Premium Plan 新設 — **禁止**  

---

## 13. 後継タスク（実装しない · 文書のみ推奨）

1. AD-019 / AD-021 / `PRICING.md` / `CREATOR_PROGRAM.md` と投げ銭ティア分配の文書統合  
2. Creator Benefit 15% の計算母数 · 最低利益ライン ADR  
3. 正式 VTuber Option / Beauty Option の 2026 商用 SDK 再選定（PoC は baseline）  
4. TALK Benefit Card 設計  
5. AI 社員の FREE STREAMING COST CAP 提案 UI（Human Approval 必須）  
