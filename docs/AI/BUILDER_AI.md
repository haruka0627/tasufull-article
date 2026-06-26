# Builder AI

**最終更新:** 2026-06-26  
**ステータス:** **実装済み**（P1 + P2-A/B + tools）· P2-C 残  
**直近コミット:** `5ed9672`

---

## 概要

Builder AI は **建設・リフォーム案件コンテキスト専用 AI**。TASFUL AI Workspace とは **統合しない**（[DECISIONS.md](../DECISIONS.md) AD-002）。

| 項目 | 内容 |
| --- | --- |
| **Builder 製品** | Production Ready v1.0 · RELEASE FROZEN |
| **Builder AI** | `builder/builder-ai.html` + `builder/builder-ai-*.js` |
| **surface** | `builder_ai`（Gateway 経由） |
| **本番 AI API** | **OpenAI**（TASFUL AI · AI 秘書とは別プロバイダ） |

---

## 実装済み（`5ed9672`）

| 領域 | 内容 |
| --- | --- |
| **Core / Engine** | `builder-ai-core.js`, `builder-ai-engine.js`, `builder-ai-adapter.js` |
| **Actions** | 24 actions（見積 · 工程 · 検索 assist · 計算 · 税務 assist · 実務 assist · 候補推薦 等） |
| **UI** | `builder-ai-page.js`, `builder-ai.html`, role 別 disclaimer · テンプレ chips |
| **Draft** | localStorage + Supabase best-effort（`builder-ai-draft-store.js`, `builder-ai-draft-supabase.js`） |
| **JWT** | `builder-ai-jwt-resolver.js`（dev fallback あり） |
| **SQL（staging）** | `sql/builder-ai-drafts-staging.sql` — **本番未適用** |
| **Tools HTML** | `builder/tool-ai-*.html`（4 ページ） |
| **規約** | `builder-ai-guidelines.html`, `builder-ai-disclaimer.js` |

---

## 非担当（TASFUL AI 側）

- 一般消費者相談 · Platform 掲載探索 · TLV 動画企画 · Talk OPS · 運営 triage

---

## テスト

| スクリプト | 結果（`5ed9672` 時） |
| --- | --- |
| `scripts/test-builder-ai-tools-adaptation.mjs` | 85/85 PASS |
| `scripts/test-builder-ai-p1-review.mjs` | 135/135 PASS |
| `scripts/test-builder-ai-p1.mjs` 等 | コミット済み（回帰セット） |

**Isolation:** Gateway / TASFUL AI / AI 秘書 / TLV 入口 — untouched 確認済み

---

## 残タスク — P2-C

参照: `reports/builder-ai-p2-b.md` §9

1. staging DB に drafts SQL 適用
2. `custom_access_token_hook` — `builder_*` claims
3. draft store Supabase 正本化
4. RLS JWT 検証
5. Live Edge E2E（staging）
6. 本番 dev query role 廃止

---

## 重要ルール

- すべての出力は **下書き** — 契約/請求/採用/完了承認に使わない
- 本番 DB / RLS **P2-C まで触らない**
- Gateway 本体契約は AI フェーズで変更しない方針（未コミット gateway diff は別件）

---

## 将来 Backlog（未着手 · 利益安定後）

| 項目 | 参照 |
| --- | --- |
| **Gemini Live 現場診断モード** — カメラ · 画面共有 · 現場診断補助 · 見積 / 資材 / 施工提案 · チェックリスト · 写真付き現場レポート | [builder-ai-gemini-live-field-diagnosis-backlog.md](../builder-ai-gemini-live-field-diagnosis-backlog.md) |

- **Builder AI のみ**（AD-002）。AI 秘書 · Platform · TLV · TASFUL AI Workspace には展開しない
- AI は補助。最終判断は現地確認 · 有資格者 · 専門業者。診断結果のみで施工判断しない
- P2-C · 基本機能完成 · **利益安定** 後に着手判断

**レポート:** `reports/builder-ai-architecture.md`, `reports/builder-ai-p1-review.md`, `reports/builder-ai-p2-b.md`, `reports/builder-ai-tools-adaptation.md`
