# TASFUL AI Workspace

**最終更新:** 2026-06-26（Site Assistant Phase 1 · cross-matching 流用）  
**ステータス:** 機能完成 · **本番接続タスク残**  
**直近コミット:** `5ed9672`

---

## 概要

TASFUL AI は **総合 AI Workspace**（`ai-workspace.html`）。Platform · TLV · 一般利用が **同一入口** を共有する（`source=` クエリで文脈切替）。

| 項目 | 内容 |
| --- | --- |
| **Production Ready** | **NO**（本番 preflight）— 機能実装は完了 |
| **本番 AI API** | **OpenAI**（AI 秘書 DeepSeek · Builder OpenAI と分担 — [DECISIONS.md](../DECISIONS.md) AD-010） |
| **Gateway** | `TasuAiModelGateway` · 契約変更はフェーズ外方針（未コミット diff あり → [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) KI-001） |

---

## 実装済み（`5ed9672`）

| 機能 | モジュール |
| --- | --- |
| チャット · モード | `ai-workspace-chat.js`, `tasful-general-ai-shell.js` |
| 画像/生成 UI | `ai-generate-ui.js` |
| **AI 履歴** | `ai-history-store.js`, `ai-workspace-history-bridge.js`, `ai-workspace-categories.js` |
| **動画生成** | `ai-video-generate.js` |
| **音楽生成** | `ai-music-generate.js` |
| **資料生成** | `ai-document-generate.js` |
| メディア設定 | `ai-media-gen-config.js`（secret なし · mock デフォルト） |
| 音声 | `tasful-ai-voice-core.js`, `ai-workspace-voice.js` |
| 添付 | `ai-workspace-attachments.js` |
| TLV 文脈 | `ai-workspace-tlv-source.js` |
| 規約 | `common-ai-disclaimer.*`, `ai-terms.html` |

**ストレージ:** 履歴は `localStorage`（`tasu_ai_history_v1` · 最大 500 件）。`exportAll`/`importAll` で将来 Supabase 同期可能。

---

## 他 AI との関係

| 相手 | 関係 |
| --- | --- |
| **Builder AI** | **統合しない** — 別 surface · 別 UI · 現場診断は Builder 専用 |
| **AI 秘書** | 独立 — admin ops 専用 · **DeepSeek API**（AD-010 · 秘書専用 Adapter） |
| **Site Assistant** | 全ページ右下 **「TASFUL サイトAI」** — **cross-matching / FAQ を流用**（`TasuAiConsultBridge` · Gateway 非接続）— [tasful-site-assistant-backlog.md](../tasful-site-assistant-backlog.md) Phase 1 ✅ |
| **Platform** | `source=platform` で入口接続のみ |
| **TLV** | `source=tlv` · 8 テンプレ — [TLV_AI.md](./TLV_AI.md) |

---

## テスト

| スクリプト | 結果（`5ed9672` 時） |
| --- | --- |
| `scripts/test-tasful-ai-final-phase.mjs` | 31/31 PASS |
| `scripts/test-ai-terms-disclaimer.mjs` | 32/32 PASS（規約 footers 含む） |

---

## 残タスク（本番接続）

参照: `reports/tasful-ai-final-phase.md` §9, `reports/tasful-ai-production-preflight.md`

| 優先 | 内容 |
| --- | --- |
| P0 | Edge デプロイ · Gemini/Serper credits · CF Access E2E |
| P0/P1 | 課金 enforcement（Gateway + Edge quota） |
| P1 | 動画/音楽 API `enabled: true` + Edge |
| P2 | 履歴 Supabase 同期 · PDF/PPT エクスポート · サイドバー履歴統合 |
| Backlog | **操作アシスタント** — Gemini · 現在ページ理解 · 画面操作案内 · 製品横断ナビ — [tasful-ai-ui-operation-assist-backlog.md](../tasful-ai-ui-operation-assist-backlog.md) |

---

## 将来 Backlog — 操作アシスタント（未着手）

| 項目 | 内容 |
| --- | --- |
| **名称** | TASFUL AI 操作アシスタント |
| **AI** | **Gemini**（ページ文脈 + 操作案内） |
| **スコープ** | 掲載 · 応募 · Builder / Platform / TLV 利用 · TASFUL 全体ナビ |
| **非スコープ** | Builder AI 案件文案 · AI 秘書 OPS · Site Assistant 埋め込み UI（Workspace モード切替は出さない） |
| **参照** | [tasful-ai-ui-operation-assist-backlog.md](../tasful-ai-ui-operation-assist-backlog.md) |

---

## 触らない（凍結・別領域）

- Builder AI core / actions
- AI 秘書 Action Registry
- Platform 専用 AI エンジン新設

**レポート:** `reports/tasful-ai-final-phase.md`, `reports/tasful-ai-production-preflight.md`
