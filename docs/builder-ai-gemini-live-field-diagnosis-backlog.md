# Builder AI — Gemini Live 現場診断モード Backlog

**最終更新:** 2026-06-26  
**状態:** 📋 未着手（**今回は実装しない**）  
**優先度:** 将来実装 · **利益が安定してから** · P0/P1 外 · Builder AI 基本機能完成後

---

## 目的

Builder AI にリアルタイムのカメラ・画面共有を追加し、**現場で AI と相談**できるようにする。

---

## スコープ境界

| 観点 | 方針 |
| --- | --- |
| **対象** | **Builder AI のみ**（`builder/builder-ai.html` · `surface: builder_ai`） |
| **非対象** | AI 秘書 · Platform · TLV · TASFUL AI Workspace — **実装しない**（[DECISIONS.md](./DECISIONS.md) AD-002 / AD-003 / AD-004 と整合） |
| **Gateway** | 既存 `TasuAiModelGateway` 契約を安易に拡張しない。Live 専用アダプタは Builder AI 内に閉じる想定 |
| **Production Ready** | Builder v1.0 は凍結中。本機能は **P2-C 完了 · 利益安定 · 基本機能完成後** のマイナー計画 |

---

## 想定機能

- カメラ映像のリアルタイム解析
- 画面共有での相談
- 現場診断補助
- 劣化箇所の指摘
- 見積補助
- 施工方法の提案
- 必要資材の提案
- チェックリスト生成
- 写真付き現場レポート生成
- 概算見積補助

---

## 注意事項（必須）

- AI は **補助ツール** とする。
- **最終判断**は現地確認 · 有資格者 · 専門業者が行う。
- **AI の診断結果のみで施工判断をしない。**
- 出力は既存 Builder AI と同様 **下書き** — 契約 / 請求 / 採用 / 完了承認に使わない（[BUILDER_AI.md](./AI/BUILDER_AI.md)）

---

## 実装タイミング

1. Builder AI の **基本機能完成**（P2-C 含む運用基盤）
2. **利益が安定**した時点で着手判断
3. Gemini Live API · 帯域 · 課金モデルの事前調査後に設計フェーズへ

---

## 関連

- [BUILDER_AI.md](./AI/BUILDER_AI.md) — Builder AI 正本
- [TODO.md](./TODO.md) — Backlog 節
- [ROADMAP.md](./ROADMAP.md) — Builder AI ロードマップ
- [DECISIONS.md](./DECISIONS.md) — AD-002（Builder AI と TASFUL AI 非統合）
