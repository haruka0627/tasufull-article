# TASFUL AI — 操作アシスタント Backlog

**最終更新:** 2026-06-26  
**状態:** 📋 未着手（**今回は実装しない**）  
**優先度:** P0/P1 外 · TASFUL AI 本番接続（P0）完了後に着手判断

---

## 名称

**TASFUL AI 操作アシスタント**

---

## 目的

ユーザーが **「この画面で何をすればいいか」「次に何をするか」** を迷わず実行できるよう、**現在のページ文脈** を理解した実用アシストを TASFUL AI 側に提供する。

---

## スコープ

| 機能 | 内容 |
| --- | --- |
| **現在ページ理解** | URL · ルート · 画面種別 · `source=` 文脈の把握 |
| **画面操作案内** | 「こういう風に操作する」手順の提示 |
| **次アクション案内** | 「次に何をすればいいか」の提案 |
| **掲載方法** | Platform 出品 · 掲載フローの案内 |
| **応募方法** | 求人 · 案件応募の案内 |
| **Builder 利用方法** | Builder 製品の入口 · 基本操作（案件 AI は Builder AI 側） |
| **Platform 利用方法** | 検索 · 注文 · お気に入り等 |
| **TLV 利用方法** | 動画 · ライブ配信 · Workspace 入口 |
| **TASFUL 全体ナビゲーション** | 製品横断の導線整理 |

**AI プロバイダ:** **Gemini**（ページ文脈 + 操作案内。既存 Edge / attachments 契約の範囲で設計）

---

## スコープ境界（混同禁止）

| 製品 / 機能 | 関係 |
| --- | --- |
| **Builder AI** | **別製品** — 案件コンテキスト · 現場診断 · 見積文案は Builder AI 専用（AD-002） |
| **AI 秘書** | **別製品** — 運営 OPS · 要約 · triage は DeepSeek 秘書専用（AD-010） |
| **Site Assistant** | **別製品** — 右下ランチャー · 問い合わせ / 通報 / FAQ ハブ。本格操作 AI は TASFUL AI 側 |
| **TASFUL AI Workspace** | **実装場所** — 操作アシスタントは Workspace / `source=platform|tlv` 共通支援として提供 |

Site Assistant の `navigation_help`（ルールベースリンク誘導）と **役割を分離** する。操作アシスタントは **Gemini による文脈付き案内** を担う。

---

## 技術方針（実装前）

| 観点 | 方針 |
| --- | --- |
| **入口** | TASFUL AI Workspace · 必要に応じて全ページから `source=` 付きで起動 |
| **文脈** | ページメタ（URL · タイトル · 製品識別 · 主要 UI ラベル）をプロンプトに注入 |
| **Gateway** | `TasuAiModelGateway` 契約を安易に変更しない（AD-005）。Gemini 操作支援は既存 Edge 経路または専用モジュール内に閉じる |
| **近縁コード** | `tasful-guide` モード（`ai-modes.js`）· `mockTasfulGuide`（`ai-workspace-chat.js`）— 将来 Gateway 置換の候補 |

---

## 実装タイミング

1. TASFUL AI **本番接続 P0** 完了（Serper · CF Access E2E · 課金 enforcement）
2. Site Assistant 初版（導線ハブ）との **役割分担** 確定後
3. 操作アシスタント MVP 設計 → 実装

---

## 関連

- [AI/TASFUL_AI.md](./AI/TASFUL_AI.md) — TASFUL AI 正本
- [tasful-site-assistant-backlog.md](./tasful-site-assistant-backlog.md) — Site Assistant（導線ハブ · 混同禁止）
- [TODO.md](./TODO.md) — Backlog 節 · 実装順
- [ROADMAP.md](./ROADMAP.md) — TASFUL AI ロードマップ
- [DECISIONS.md](./DECISIONS.md) — AD-001 / AD-002 / AD-005
