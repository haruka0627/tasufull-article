# TASFUL Site Assistant — Phase 1 実装報告

**実施日:** 2026-06-26  
**状態:** **Phase 1 実装完了** · **commit 予定** · **未デプロイ**  
**正本:** [docs/tasful-site-assistant-backlog.md](../docs/tasful-site-assistant-backlog.md) · [docs/AI/TASFUL_AI.md](../docs/AI/TASFUL_AI.md)  
**制約:** 新規 AI / API / Gateway なし · AD-003 系 · AD-005 非変更

---

## 概要

全ページ右下に **「TASFUL サイトAI」** ウィジェットを追加。回答は既存 TASFUL AI の **cross-matching / FAQ**（`TasuAiConsultBridge.tryCrossSearch` 等）に委譲。独自 stub / 独自 site mode は使わない。

---

## 完了（Phase 1）

| 項目 | 状態 |
| --- | --- |
| FAB + チャットパネル UI | **完了** |
| `tasful-site-assistant.{css,js,adapter.js}` | **完了** |
| `build:pages` HTML 注入（232 / skip 16） | **完了** |
| Lazy load 4 deps | **完了** |
| Gateway / DeepSeek / 秘書 非接続 | **確認済** |
| `npm run build:pages` | **PASS** |
| `test-tasful-site-assistant-browser.mjs` | **18/18 PASS** |

---

## 未完了（運用）

| 項目 | 状態 |
| --- | --- |
| git commit | **予定** |
| Production deploy | **未** |
| Production smoke | **未** |

---

## 新規ファイル

- `tasful-site-assistant.css`
- `tasful-site-assistant.js`
- `tasful-site-assistant-adapter.js`
- `scripts/test-tasful-site-assistant-browser.mjs`

## 変更

- `deploy/cloudflare/stage-cloudflare-pages.mjs` — `applySiteAssistantToDist()`
- `deploy/cloudflare/dist/**` — build 同期分（232 HTML + 3 アセット）

## 非変更

- `ai-modes.js` — 独自 site mode なし（HEAD と同一）
- `ai-model-gateway.js` — 非変更

---

## Context ポリシー

送信メタのみ: `page_url` · `page_title` · `page_heading` · `page_type`

禁止: 個人情報 · localStorage ユーザーデータ · 管理者 / 秘書 / Ops / Stripe 内部

---

## 検証コマンド

```bash
npm run build:pages
node scripts/test-tasful-site-assistant-browser.mjs
```
