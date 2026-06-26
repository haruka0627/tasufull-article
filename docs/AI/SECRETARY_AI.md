# AI 運営秘書（Secretary AI）

**最終更新:** 2026-06-26  
**ステータス:** **Production Ready** · RELEASE FROZEN  
**確定日:** 2026-06-17

---

## 概要

AI 運営秘書は **TASFUL 運営 OPS 専用**（`admin-operations-dashboard` 系）。Builder AI · TASFUL AI Workspace · Platform 入口とは **独立**。

| 項目 | 内容 |
| --- | --- |
| **リリース** | RELEASE OK · **RELEASE FROZEN** |
| **P0 / P1** | なし（2026-06-17 時点） |
| **本番 AI API** | **DeepSeek API**（確定 · [DECISIONS.md](../DECISIONS.md) AD-010） |
| **本番接続レビュー** | PASS（要修正 0） |

---

## 本番 AI API — DeepSeek（確定）

| 項目 | 内容 |
| --- | --- |
| **プロバイダ** | **DeepSeek API** |
| **理由** | 運営データ要約 · 優先順位付け · DB 検索結果の整理 · 問い合わせ / 通知 / チケット内容の自然文要約 · **API コスト削減** |
| **非採用（現時点）** | Groq · Cerebras · Claude — **不要** |
| **TASFUL AI Gateway との関係** | AI 秘書は **独立 surface**。本番は DeepSeek 直結（または秘書専用アダプタ）。TASFUL AI の OpenAI / Gemini ルートと混在しない |

### 基本データフロー（本番想定）

```
DB / Supabase
  ↓ 必要データ取得（プログラム）
DeepSeek API
  ↓ 要約 · 優先順位付け · 自然文生成
管理者画面（admin-operations-dashboard 系）へ表示
```

### AI を使わない処理（必須）

以下は **通常のプログラム処理** とし、LLM を呼ばない。

- 画面遷移
- 件数表示
- DB 検索
- フィルター処理

AI は **取得済みデータの要約・優先付け・自然文化** に限定する。

---

## TASFUL 全体の AI プロバイダ分担（参照）

| 製品 / 領域 | 本番 AI API | 備考 |
| --- | --- | --- |
| **AI 秘書** | **DeepSeek** | 本ドキュメント |
| **TASFUL AI** | **OpenAI** | [TASFUL_AI.md](./TASFUL_AI.md) |
| **Builder AI** | **OpenAI** | [BUILDER_AI.md](./BUILDER_AI.md) |
| **Builder AI 将来** | Gemini Live（現場診断） | [builder-ai-gemini-live-field-diagnosis-backlog.md](../builder-ai-gemini-live-field-diagnosis-backlog.md) · 利益安定後 |
| Groq / Cerebras / Claude | — | 現時点では採用しない |

---

## スコープ

| 担当 | 非担当 |
| --- | --- |
| Inbox · Connect triage · OPS 支援 | Builder 案件文案 |
| 運営ダッシュボード AI | Platform 掲載マッチング |
| Action Registry / postUserCommand | TASFUL AI 一般チャット |

---

## AI コミット `5ed9672` との関係

| 項目 | 内容 |
| --- | --- |
| **含む** | なし — secretary ファイルは意図的に除外 |
| **working tree** | `admin-ai-secretary-phase*.js` 等が **未コミット** で存在（[KNOWN_ISSUES.md](../KNOWN_ISSUES.md) KI-008） |
| **未確認** | phase ファイルが v1.1 凍結と矛盾するか — diff 監査待ち |

---

## テスト（参考）

| スクリプト | 備考 |
| --- | --- |
| `scripts/test-admin-ai-secretary-text-chat-browser.mjs` | pre-commit 時 PASS（6 checks）— `5ed9672` 外 |

---

## 変更ルール（凍結）

- **許可:** Critical Bug · Security · Supabase 仕様追従
- **禁止:** 新機能 · UI 変更（v1.1 計画まで）

---

## 将来 Backlog（未着手 · v1.2 以降想定）

| 項目 | 参照 |
| --- | --- |
| **Trend Scout** — トレンド・市場・競合・補助金・法改正・SNS/検索傾向の収集と TASFUL 向け「検討してみては？」提案 | [ai-secretary-trend-scout-backlog.md](../ai-secretary-trend-scout-backlog.md) |
| **Site Assistant 受信** — 問い合わせ · **通報** · 不具合 · 要望の OPS 集約（`inquiry` / `report` / `bug_report` / `feature_request` / `navigation_help`） | [tasful-site-assistant-backlog.md](../tasful-site-assistant-backlog.md) |

- 経営参謀 · マーケ支援 · 新機能/事業アイデア提案 · TASFUL 成長支援
- 表示候補: Morning Summary · Daily Inbox · Command Center · OPS WATCH · 月次レポート
- 出典必須 · 「複数ソースから増加傾向」表現 · 採用/保留/却下の判断フロー
- **P0/P1 外** · Platform Critical 優先順位は変更しない

---

## 関連

- [TASFUL_AI.md](./TASFUL_AI.md) — 一般 Workspace（別製品）
- [BUILDER_AI.md](./BUILDER_AI.md) — Builder 専用（別 surface）

**レポート:** `reports/ai-ops-secretary-release-status.md`, `reports/ai-secretary-text-chat-first.md`（未コミット）
