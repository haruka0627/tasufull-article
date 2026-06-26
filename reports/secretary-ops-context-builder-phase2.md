# AI 秘書 — OpsContextBuilder Phase 2 実装報告

**実施日:** 2026-06-26  
**状態:** **Phase 2 実装完了** · **未コミット · 未デプロイ**  
**正本:** [docs/AI/SECRETARY_AI.md](../docs/AI/SECRETARY_AI.md) · [docs/TODO.md](../docs/TODO.md) §P0-3  
**設計:** `reports/secretary-ops-context-builder-design.md`  
**前提:** Phase 1 DeepSeek Adapter — `reports/secretary-deepseek-adapter-phase1.md`  
**制約:** AD-010 · AD-005 · Gateway 非変更 · DeepSeek Adapter 契約非変更 · API キー非表示

---

## 概要

既存運営データ（Daily Inbox · Hub · KPI · metrics）を **6 ドメイン** に正規化し、DeepSeek へ渡す **`systemPrompt` 追記ブロック** をクライアント側で構築する Phase 2 最小実装。

```
admin-operations-dashboard refresh
  └─ phase2.render(ctx) → setOpsSnapshot (TTL 60s)
       sendMessage → resolveIntent → TasuSecretaryOpsContextBuilder.build()
       buildSystemPrompt() → BASE + 「運営コンテキスト」
       TasuSecretaryDeepSeekAdapter.completeTurn({ systemPrompt, ... })  ← 契約変更なし
```

**非変更:** `ai-model-gateway.js` · Edge `/api/secretary-deepseek-chat` body スキーマ · Adapter `completeTurn` シグネチャ

---

## 新規ファイル

| ファイル | 役割 |
| --- | --- |
| `admin-ai-secretary-ops-context-sanitize.js` | `TasuSecretaryOpsContextSanitize` — PII マスク |
| `admin-ai-secretary-ops-context.js` | `TasuSecretaryOpsContextBuilder` — build / intent / formatForSystemPrompt |
| `scripts/test-secretary-ops-context-intent.mjs` | intent 解決 7 checks |
| `scripts/test-secretary-ops-context-builder-unit.mjs` | build / sanitize / prompt 17 checks |
| `scripts/test-secretary-ops-context-e2e.mjs` | systemPrompt 注入 E2E（3 intent · file / dev） |

## 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `admin-ai-secretary-phase2.js` | `setOpsSnapshot` · `buildSystemPrompt` · context 注入 |
| `admin-operations-dashboard.html` | sanitize + ops-context スクリプト読込 |
| `talk-ops-room.html` | 同上 |
| `scripts/test-secretary-deepseek-adapter-browser.mjs` | OpsContext ロード / prompt 検証 |
| `scripts/test-admin-ai-secretary-text-chat-browser.mjs` | OpsContextBuilder 待機 |
| `docs/AI/SECRETARY_AI.md` | Phase 2 実装メモ |
| `reports/secretary-ops-context-builder-design.md` | 状態を実装完了に更新 |

---

## 6 ドメイン

| ドメイン | ソース | 備考 |
| --- | --- | --- |
| **support** | inbox (support/ai_ops/anpi/talk) · hub priority/inquiry/report | live |
| **builder** | inbox builder · hub builder | live |
| **platform** | inbox market/content_gate 等 | live |
| **stripe_connect** | inbox connect · hub connect | live |
| **ai_usage** | `TasuAiInteractionLog.readLogs()` 集計 | live |
| **tlv** | — | **stub** · `dataQuality: stub` |

---

## 実装要点

| 項目 | 内容 |
| --- | --- |
| **top-N** | ドメイン別 top-5 · 優先候補 top-5 |
| **summary** | 全体 headline · hub summary · KPI 行 · ドメイン summaryLine |
| **char budget** | ~6000 字 · 超過時 truncate + topItems 段階削減 |
| **PII** | email / phone / URL / UUID / Stripe acct / パートナー名 |
| **intent** | regex — Builderだけ / Platform / Connect / Support / TLV / AI利用 / 昨日から増えた / 本日優先 |
| **inbox diff** | localStorage `tasu_secretary_inbox_ids_v1` · `diffOnly` フィルタ |
| **snapshot** | dashboard `render(ctx)` 経由 · 60s TTL |

---

## BUILDER_BASE_URL / build 結果

| 項目 | 結果 |
| --- | --- |
| **初期 `BUILDER_BASE_URL`** | 空（file:// 検証向け） |
| **`npm run build:pages`** | **FAIL** — `deploy/cloudflare/dist` EPERM（dev/workerd が dist をロック） |
| **回避** | dev 停止 → 部分同期（Phase 2 関連 5 ファイルを dist へ copy）→ `npm run dev` 再起動 |
| **dev 検証** | `BUILDER_BASE_URL=http://127.0.0.1:8788` |

**推奨:** 本番 deploy 前に dev 完全停止後 `npm run build:pages` を再実行し dist 全体同期を確認すること。

---

## 実画面確認（E2E · Playwright）

`scripts/test-secretary-ops-context-e2e.mjs` — Adapter をモックし `systemPrompt` を捕捉。

| パターン | 検証 |
| --- | --- |
| 「今日は何を優先？」 | `運営コンテキスト` + 優先/KPI 系 |
| 「Builderだけ教えて」 | `domains=builder` + `### Builder` |
| 「昨日から増えたもの」 | diffOnly 系文言 |
| 共通 | raw email なし · TLV stub · prompt ≤8000 · console/network 0 |

| 環境 | 結果 |
| --- | --- |
| **file://**（`BUILDER_BASE_URL` unset） | **11/11 PASS** |
| **dev server** `127.0.0.1:8788` | **11/11 PASS** |

---

## テスト結果（2026-06-26 再実行）

| スクリプト | モード | 結果 |
| --- | --- | --- |
| `test-secretary-ops-context-intent.mjs` | node | **7/7 PASS** |
| `test-secretary-ops-context-builder-unit.mjs` | node | **17/17 PASS** |
| `test-secretary-deepseek-adapter-browser.mjs` | file:// | **12/12 PASS** |
| `test-secretary-deepseek-adapter-browser.mjs` | dev:8788 | **12/12 PASS** |
| `test-admin-ai-secretary-text-chat-browser.mjs` | file:// | **8/8 PASS** |
| `test-admin-ai-secretary-text-chat-browser.mjs` | dev:8788 | **8/8 PASS** |
| `test-secretary-ops-context-e2e.mjs` | file + dev | **11/11 PASS** |

**console / network:** secretary / ops-context 関連の blocking error なし（DeepSeek API / supabase / favicon は ignorable 扱い）。

---

## 非変更確認

| 対象 | 確認 |
| --- | --- |
| `ai-model-gateway.js` | 未変更 · secretary 参照なし |
| `admin-ai-secretary-deepseek-adapter.js` | `completeTurn({ systemPrompt, userText, messages, ... })` 契約維持 |
| Edge Function | body スキーマ拡張なし |
| `.env` / `.dev.vars` | 本検証では未操作 |

---

## commit 可否

| 観点 | 判定 |
| --- | --- |
| Phase 2 実装 | **Go（選別ステージング）** |
| Phase 1 + Phase 2 まとめ commit | **条件付き Go** — secretary 関連のみ `git add`（AD-007 · `git add -A` 禁止） |
| Production deploy | **No-Go** — DeepSeek 残高 · HTTP 200 · CF Secret · smoke 未完了（Phase 1 運用残件） |
| 本 report / docs | commit 対象に含めてよい |

**ステージング候補（例）:**  
`admin-ai-secretary-ops-context*.js` · `admin-ai-secretary-phase2.js` · `admin-operations-dashboard.html` · `talk-ops-room.html` · `scripts/test-secretary-ops-context*.mjs` · `scripts/test-secretary-deepseek-adapter-browser.mjs` · `scripts/test-admin-ai-secretary-text-chat-browser.mjs` · `docs/AI/SECRETARY_AI.md` · `reports/secretary-ops-context-builder-phase2.md` · `reports/secretary-ops-context-builder-design.md`

**除外:** `.env` · `deploy/cloudflare/dist/.dev.vars` · dist 生成物（build 成功後のみ deploy パイプライン側）

---

## 残件（Phase 2 外 · 任意）

- inbox diff 専用 fixture テスト（設計 § テスト計画）
- `docs/TODO.md` §P0-3 OpsContextBuilder チェック更新（commit 時）
- dist フル `build:pages` 再実行（EPERM 解消後）
