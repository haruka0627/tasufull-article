# TASFUL AI Workspace — 課金 Enforcement Phase 1 実装報告

**実施日:** 2026-06-26  
**状態:** Phase 1 完了（クライアント enforcement）  
**参照:** `reports/tasful-ai-workspace-enforcement-design.md` · `docs/TODO.md` §P0-2 · `docs/AI/TASFUL_AI.md` · AD-005

---

## 概要

TASFUL AI Workspace に **日次 quota の check / consume** をクライアント側のみで追加した。Gateway / Edge / `gen-ai-workspace.js` は未変更。

| 項目 | 内容 |
| --- | --- |
| usage key | `tasu_ai_workspace_usage` |
| plan source | `tasu_genai_plan` + `stripe-get-genai-plan`（`syncPlanFromServer`） |
| feature key | `text_turn` |
| 無料 | 5 回/日（`stripe-genai-config.js` FREE_PLAN 準拠） |
| basic_300 | 30 回/日 |
| pro_980 | 100 回/日 |
| 課金条件 | `usedRemote === true` かつ成功応答（gen-ai `usedGemini` 相当） |

---

## 実装内容

### 新規 `ai-workspace-usage.js`

- `TasuAiWorkspaceUsage` API: `canUse` / `consume` / `shouldChargeTurn` / `updateUsageUi` / `showUsageBlocked` / `syncPlanFromServer`
- JST 日次リセット · TLV 時は `min(daily, tasu_ai_tlv_free_remaining)`
- 枯渇 UI: `[data-ai-workspace-usage-limit]` + CTA → `gen-ai-workspace.html`
- TLV 枯渇時は既存 `[data-tlv-free-quota]` のみ（workspace limit バナーと競合しない）

### `ai-workspace-chat.js`

- 送信前（テキスト検証後 · `aiChatSending` 前）: `canUse("text_turn")` → block + `showUsageBlocked`
- `withModelFromTurn`: Gateway turn から `_usageCharge` / `_usageFeature` を payload に付与
- 送信成功後: `reply._usageCharge === true` のときのみ `consume()`
- **修正:** cross-matching + Web 経路で `wrapAssistantPayload` の二重ラップにより `_usageCharge` が落ちる問題を解消（`web` をそのまま `applySearchSourceLabel` に渡す）

### `ai-search-target.js`

- `preserveModelMeta`: `_usageCharge` / `_usageFeature` をラベル付与後も保持

### `ai-workspace.html` / `ai-workspace.css`

- usage ステータス・枯渇バナー DOM
- script: `stripe-genai-config.js` → `ai-workspace-usage.js`（chat より前）

### `ai-workspace-tlv-source.js`

- `decrementFreeRemaining` · `refreshFreeQuotaUi` を export（`consume` から連動）

---

## 変更ファイル一覧

| ファイル | 種別 |
| --- | --- |
| `ai-workspace-usage.js` | **新規** |
| `scripts/test-ai-workspace-usage-enforcement-browser.mjs` | **新規** |
| `ai-workspace-chat.js` | 変更 |
| `ai-workspace.html` | 変更 |
| `ai-workspace.css` | 変更 |
| `ai-workspace-tlv-source.js` | 変更 |
| `ai-search-target.js` | 変更（usage メタ保持） |

**触っていない（ルール順守）:** `ai-model-gateway.js` · Edge functions · `gen-ai-workspace.js` · AI秘書 / Builder / Site Assistant · `deploy/cloudflare/dist` 直接編集

---

## テスト結果

### ビルド

```text
npm run build:pages → OK
```

### Phase 1 専用

```text
node scripts/test-ai-workspace-usage-enforcement-browser.mjs → 15/15 PASS
```

| ケース | 結果 |
| --- | --- |
| shouldChargeTurn remote / mock | PASS |
| canUse block + banner + CTA | PASS |
| consume on usedRemote | PASS |
| mock/fallback no consume | PASS |
| basic_300 / pro_980 limits | PASS |
| TLV remaining check / decrement | PASS |
| usage status UI | PASS |
| regression chat path (web target) | PASS |

### 回帰

```text
node scripts/test-tasful-ai-final-smoke-browser.mjs → 53/53 PASS
```

---

## 既知の制限（Phase 2 へ）

| 項目 | 内容 |
| --- | --- |
| bypass | localStorage のみ — DevTools / 別端末で回避可能 |
| Edge / DB | API 直叩きに quota なし |
| anonymous | 端末単位 limit |
| both ハイブリッド | `mergeInternalAndWeb` 経路の `_usageCharge` 伝播は web 単体より弱い（要 Phase 2 または follow-up） |
| voice / image | Phase 1 は `text_turn` のみ |
| 本番課金 Ready | Phase 2（Edge + DB 正本）+ Stripe E2E 後 |

---

## commit 可否判断

| 観点 | 判定 |
| --- | --- |
| スコープ | ✅ 指定範囲内（クライアント only） |
| AD-005 | ✅ Gateway 未変更 |
| テスト | ✅ 15/15 + smoke 53/53 |
| dist | `build:pages` 済み — **dist は選別ステージング**（AD-007） |
| 本番課金 | ❌ Phase 1 のみでは Production 課金 Ready ではない |

**推奨:** ソース 7 ファイル + 本レポート + テストスクリプトを **1 commit** で可。`deploy/cloudflare/dist` は意図的に含めないか、通常の pages デプロイフローに従う。ユーザー指示どおり **commit / deploy は未実施**。

---

## Phase 2 タスク（残）

1. `supabase/functions/_shared/ai-workspace-quota.ts` + Edge middleware（gemini/openai/claude-chat）
2. DB `ai_workspace_usage_daily` migration
3. `ai-workspace-usage.js` — サーバー正本 fetch · localStorage キャッシュ
4. `verify-ai-workspace-quota-edge.mjs` · 402 E2E
5. 同一 user_id マルチ端末共有カウント
