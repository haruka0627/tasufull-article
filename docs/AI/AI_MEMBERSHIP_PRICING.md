# AI Membership Pricing（Draft）

**Status:** Draft（**原価・運用検証前の仮決定**）  
**最終更新:** 2026-06-28  
**スコープ:** TASFUL AI Workspace — サブスクリプション料金 · エントリーキャンペーン · フェアユース  
**分離:** TLV Membership / Coin レーンとは **別システム**（[TLV_PAYMENT_ENGINE.md](../TLV_PAYMENT_ENGINE.md) §14）

**関連:** [TASFUL_AI.md](./TASFUL_AI.md) · [TODO.md](../TODO.md) § AI Membership Pricing  
**実装参照（現行 · 名称未統一）:** `stripe-genai-config.js` · `ai-plan-models.js`

**表示ルール:** 料金 UI には **「Draft Pricing」** と明記（最終決定前）。

---

## P0 — Pricing Structure

### Free — ¥0

- 体験用

### Lite — ¥300 / month

- **Gemini 特化**（現行 `ai-plan-models.js` · tier `light` / `basic_300`）
- 日常用途（雑談 · 調べ物 · 要約）
- 軽量 · 高速 · 高回数設計

### Pro — ¥980 / month

- **収益コアプラン**
- **マルチ AI ルーティング**
- 現行実装で Pro 相当（`standard` / `pro_980`）が解放するモデル:
  - **Gemini** · **ChatGPT** · **Claude**（`ai-plan-models.js` · `WORKSPACE_MODEL_IDS`）
- Grok 等の追加ルートは **premium / Max 設計**側（`comingSoon` · P1 で Fair Use と合わせて確定）

### Max — ¥2,980 / month

- フル機能 · フェアユース拡張
- ヘビーユーザー向け上位プラン
- 現行コードに **¥2,980 SKU 未実装**（`stripe-genai-config.js` は basic_300 · pro_980 のみ）— Draft 価格として保留

---

## P0 — Entry Campaign Plan

### ¥150 プラン（期間限定 or 制限付き）

- 新規獲得用キャンペーン価格
- **常設しない**方針
- 条件付き運用（以下いずれか）:
  - **Option A:** 初回 30 日限定
  - **Option B:** 先着 ○○ 人まで
  - **Option C:** 月間枠制限

**役割:**

- 低価格で導入障壁を下げる
- ユーザー習慣化のトリガー
- **¥300（Lite）プランへの自然移行**を促進

**位置づけ:** ¥150 は **収益商品ではなくマーケティング装置**

---

## P0 — Pricing Philosophy

- **Unlimited は採用しない**（フェアユース）
- **Cursor 型**の利用体験をベースに設計
- 価格ではなく **「平均原価ベース」** で設計
- ¥150 は収益商品ではなく **マーケティング装置**

---

## P1 — Next Step

- [ ] API 原価モデル作成
- [ ] プラン別平均利用量定義
- [ ] フェアユース閾値設計
- [ ] Lite → Pro 移行率設計
- [ ] 原価シミュレーション完了後に価格を再評価
  - API 原価 · インフラ原価 · Stripe 手数料
  - 粗利率（Lite / Pro: **70%** · Max: **65〜70%**）
  - 市場比較（日本 · USD）
- [ ] AI Membership Fair Use Policy を設計
  - 通常利用では制限を感じにくい設計
  - 高負荷利用時のみ制御
  - プラン別利用上限 · 優先度を定義

---

## P2 — 国際価格

- [ ] USD 基準価格を設計
- [ ] 地域別価格（Purchasing Power）を検討

---

## 未決定事項

| 項目 | 状態 |
| --- | --- |
| 最終価格 | 原価 · 運用検証待ち |
| ¥150 キャンペーン条件（A/B/C） | 未選択 |
| Max SKU / Stripe 連携 | 未実装 |
| Fair Use 上限数値 | P1 |
| USD / 地域別価格 | P2 |

---

*Draft · Stripe SKU · quota 数値 · Fair Use 閾値は P1 完了後に実装*
