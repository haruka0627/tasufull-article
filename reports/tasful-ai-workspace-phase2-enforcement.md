# TASFUL AI Workspace — 課金 Enforcement Phase 2 実装報告

**実施日:** 2026-06-28  
**状態:** Phase 2 実装完了（**Edge デプロイ + DB migration は運用待ち**）  
**参照:** `reports/tasful-ai-workspace-enforcement-design.md` · Phase 1 `2a43fe5` · AD-005

---

## 概要

Workspace の日次 quota を **DB 正本 + Edge enforcement** に拡張。Gateway 契約・UI・Vision/Attach/Voice は未変更。

| 層 | 役割 |
| --- | --- |
| **DB** | `ai_workspace_usage_daily` + RPC `check_*` / `consume_*` |
| **Edge `ai-workspace-quota`** | status / check / consume API |
| **Edge chat** | `surface=ai-workspace` 時に check → 402 / 成功後 consume |
| **Client `ai-workspace-usage.js`** | サーバー同期 · fetch hook で `surface`/`user_id` 注入（Gateway 非変更） |
| **Client `ai-workspace-chat.js`** | `canUseAsync` 事前チェック |

---

## 変更ファイル一覧

| ファイル | 種別 |
| --- | --- |
| `sql/ai-workspace-usage-daily.sql` | **新規** — テーブル + RPC |
| `supabase/functions/_shared/ai-workspace-quota.ts` | **新規** — 共有 quota ロジック |
| `supabase/functions/ai-workspace-quota/index.ts` | **新規** — quota Edge API |
| `supabase/functions/gemini-chat/index.ts` | quota middleware |
| `supabase/functions/openai-chat/index.ts` | quota middleware |
| `supabase/functions/claude-chat/index.ts` | quota middleware |
| `ai-workspace-usage.js` | Phase 2 サーバー正本 + fetch hook |
| `ai-workspace-chat.js` | `canUseAsync`  await |
| `deploy/cloudflare/dist/ai-workspace-usage.js` | dist 同期 |
| `deploy/cloudflare/dist/ai-workspace-chat.js` | dist 同期 |
| `scripts/test-ai-workspace-quota-unit.mjs` | **新規** |
| `scripts/test-ai-workspace-quota-edge.mjs` | **新規** |
| `scripts/test-ai-workspace-quota-production-compat.mjs` | **新規** |
| `scripts/test-ai-workspace-usage-enforcement-browser.mjs` | Phase 2 テストモード flag |

**触っていない（禁止遵守）:** `ai-model-gateway.js` · UI/CSS/HTML · Builder / Platform / 秘書 / BD · Attach/Vision 本体

---

## 実装詳細

### ① Edge quota 判定

`enforceWorkspaceQuotaEntry()` — `body.surface === "ai-workspace"` のみ。`check_ai_workspace_quota` RPC。

### ② DB usage 管理

`ai_workspace_usage_daily(user_id, date_jst, text_used, vision_used)` — JST 日次。

### ③ プラン取得

`getGenAiPlanForUser()` → `gen_ai_subscriptions` / `limitsFromPlanCode()`（free 5 · basic_300 30 · pro_980 100）。

### ④ Workspace 呼び出し enforcement

- Client: `canUseAsync` → `ai-workspace-quota` `action: check`
- Chat Edge: entry check + success consume
- Fetch hook: Gateway 経由 POST に `surface` + `user_id` 付与（**Gateway ファイル未変更**）

### ⑤ bypass 防止

`surface=ai-workspace` なしの chat 呼び出しは quota スキップ（Builder/gen-ai 既存経路）。Workspace 経路は hook で必ず `surface` 付与。

### ⑥ quota 更新

Edge 成功後 `consume_ai_workspace_quota` RPC。Client `consume()` は Phase 2 時 **サーバー status 再同期**（二重 increment 回避）。

### ⑦ エラーコード統一

HTTP **402** · `{ error: "quota_exceeded", feature: "text_turn", reply: "", ... }`

---

## テスト結果（2026-06-28 · 8788）

| スクリプト | 結果 |
| --- | --- |
| `test-ai-workspace-quota-unit.mjs` | **8/8 PASS** |
| `test-ai-workspace-usage-enforcement-browser.mjs` | **15/15 PASS** |
| `test-tasful-ai-final-phase.mjs` | **31/31 PASS** |
| `test-ai-workspace-quota-edge.mjs` | **FAIL** — `ai-workspace-quota` HTTP **404**（live 未デプロイ） |
| `test-ai-workspace-quota-production-compat.mjs` | **2/3 PASS** — quota Edge 404 · chat 200（旧 middleware） |

**HTTP 8788:** browser 15/15 · Console Error 0（hook テストモード）

### プラン別（browser · Phase 1 モード + ローカル limit 検証）

| プラン | limit | 検証 |
| --- | --- | --- |
| 無料 | 5 | depleted block PASS |
| Standard (`basic_300`) | 30 | 29/30 allow · 30/30 block PASS |
| Pro (`pro_980`) | 100 | 99/100 allow PASS |

Edge live プラン別は **デプロイ後** `test-ai-workspace-quota-edge.mjs` で再実行。

---

## 運用デプロイ手順（未実施 · 必須）

1. **SQL 適用**

```bash
# Supabase SQL Editor または CLI
# sql/ai-workspace-usage-daily.sql
```

2. **Edge デプロイ**

```bash
npx supabase functions deploy ai-workspace-quota gemini-chat openai-chat claude-chat \
  --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

3. **再検証**

```bash
node scripts/test-ai-workspace-quota-edge.mjs
node scripts/test-ai-workspace-quota-production-compat.mjs
```

4. **Pages** — `npm run build:pages`（dev 停止後）→ Production deploy

---

## 残る Production Ready ブロッカー

| ブロッカー | 状態 |
| --- | --- |
| Phase 2 SQL + Edge **live 反映** | ❌ 未デプロイ |
| Serper credits | ❌ 運用 |
| CF Access Service Token E2E | ❌ 運用 |
| Stripe 本番 E2E（課金 Ready） | ❌ |
| Pages 本番に Phase 2 client 反映 | ⏳ build/deploy 待ち |

---

## 現在完成率（TASFUL AI Workspace 課金）

| フェーズ | 完成度 |
| --- | --- |
| Phase 1 クライアント enforcement | **100%**（deploy 済） |
| Phase 2 コード実装 | **100%** |
| Phase 2 live 運用反映 | **0%**（SQL + Edge deploy 待ち） |
| Production 課金 Ready 総合 | **~70%**（サーバー正本コード完成 · live 未反映） |

---

*Gateway 契約変更なし · UI 変更なし · AD-005 遵守。*
