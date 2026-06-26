# Builder AI

**最終更新:** 2026-06-26（Vision Phase 2 · 現場AI 接続）  
**ステータス:** **実装済み**（P1 + P2-A/B + tools + **Vision UI/接続**）· P2-C 残  
**直近コミット:** `46677eb`（Vision Phase 2 **未コミット**）

---

## 概要

Builder AI は **建設・リフォーム現場業務 AI**（チャット AI ではなく **現場業務を効率化するプラットフォーム**）。TASFUL AI Workspace とは **統合しない**（[DECISIONS.md](../DECISIONS.md) AD-002）。

| 項目 | 内容 |
| --- | --- |
| **Builder 製品** | Production Ready v1.0 · RELEASE FROZEN |
| **Builder AI 画面** | `builder/builder-ai.html` + `builder/builder-ai-*.js` |
| **surface** | `builder_ai`（Gateway 経由） |
| **Vision** | **Gemini Vision** — 既存 `gemini-chat` Edge（Gateway `attachments`） |

### 育成方向（3 柱）

| 柱 | 内容 |
| --- | --- |
| **現場 AI** | Vision ✅ · Live 📋 · Voice 📋 |
| **計算 AI** | 面積 · 外壁 · 屋根 · 塗料 · 材料 · 人工 · 原価 · 利益 · 見積 等（既存 Builder 計算ツール連携） |
| **業務 AI** | 顧客 · 現場 · 写真 · メモ · 見積 · 請求 · 領収 · 売上 · 経費 · 会計補助（将来） |

**設計原則:** AI が直接計算するのではなく、**必要な Builder 内部ツールを判断して実行**する（既存 `builder-ai-calculators` 等）。

---

## 実装済み

### Core（`5ed9672` 〜）

| 領域 | 内容 |
| --- | --- |
| **Core / Engine** | `builder-ai-core.js`, `builder-ai-engine.js`, `builder-ai-adapter.js` |
| **Actions** | 24 actions（見積 · 工程 · 検索 assist · 計算 · 税務 assist · 実務 assist · 候補推薦 等） |
| **Legacy UI** | `builder-ai-page.js` — 業務下書き · Gateway · `<details>` 内 |
| **Draft** | localStorage + Supabase best-effort |
| **Tools HTML** | `builder/tool-ai-*.html`（4 ページ） |

### 現場 UI + Vision（2026-06-26）

| Phase | commit | 内容 |
| --- | --- | --- |
| **UI Phase 1** | `5d28acc` | 現場診断 UI シェル · 写真 · クイック相談 · Live/Voice stub |
| **Vision Phase 2** | **未コミット** | Gemini Vision 接続 · `builder-ai-vision.js` · `runFieldVision` |

| モジュール | 役割 |
| --- | --- |
| `builder-ai-ui.js` | 現場チャット UI · Vision 送信 |
| `builder-ai-ui.css` | 現場 UI スタイル |
| `builder-ai-vision.js` | 画像 base64 · 4MB · prompt · `runFieldDiagnosis` |
| `builder-ai-core.js` | `runFieldVision` → Gateway `attachments` |

**経路:** Builder → Gateway → `gemini-chat` → Gemini Vision（**新規 CF Function なし**）

**回答:** 見える範囲 · 想定状態 · 補修/交換可能性 · 確認ポイント · 材料候補 · 概算レンジ · 注意事項 + 必須免責

---

## Free / Pro 方針（設計維持）

|  tier | 想定 |
| --- | --- |
| **Free** | Site AI · Builder 基本 AI · 簡易写真診断 · 一部計算 · カレンダー · 簡易収支 |
| **Pro** | Gemini Vision 本格 · Live · Voice · 全計算 · 顧客/現場管理 · AI 履歴 · 見積 · 会計補助 |

Builder AI は **「AI を売る」** のではなく **現場業務効率化プラットフォーム** として設計を維持する。

---

## 非担当

- TASFUL AI Workspace · Site Assistant · AI 秘書 · DeepSeek · Platform · TLV 専用 AI

---

## テスト

| スクリプト | 結果 |
| --- | --- |
| `scripts/test-builder-ai-vision-phase2.mjs` | **8/8 PASS** |
| `scripts/test-builder-ai-ui-phase1.mjs` | **14/14 PASS** |
| `scripts/test-builder-ai-p1-review.mjs` | **135/135 PASS** |
| `scripts/test-builder-ai-tools-adaptation.mjs` | **85/85 PASS** |

**報告:** `reports/builder-ai-vision-phase2.md`

---

## 残タスク — P2-C（draft / RLS）

参照: `reports/builder-ai-p2-b.md` §9

1. staging DB に drafts SQL 適用
2. `custom_access_token_hook` — `builder_*` claims
3. draft store Supabase 正本化
4. RLS JWT 検証
5. Live Edge E2E（staging）
6. 本番 dev query role 廃止

---

## 将来 Backlog

| 項目 | 状態 | 参照 |
| --- | --- | --- |
| **Gemini Live**（リアルタイムカメラ · 音声） | 📋 未着手 | [builder-ai-gemini-live-field-diagnosis-backlog.md](../builder-ai-gemini-live-field-diagnosis-backlog.md) |
| **Voice 相談** | 📋 UI stub のみ | 同上 |
| **会計補助**（白/青 · インボイス · 確定申告） | 📋 将来 | 本 doc §育成方向 |

---

## 重要ルール

- すべての出力は **下書き** — 契約/請求/採用/完了承認に使わない
- Gateway 本体契約は安易に変更しない（`attachments` 既存流用）
- Vision / Live アダプタは **Builder AI 内に閉じる**（AD-002）
- AI は補助。**画像だけでは確定判断できない** — 現地確認 · 専門業者優先

**レポート:** `reports/builder-ai-vision-phase2.md`, `reports/builder-ai-architecture.md`, `reports/builder-ai-p1-review.md`
