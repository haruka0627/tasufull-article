# TASFUL AI Workspace — Phase 2 Production Rollout

**実施日:** 2026-06-28  
**Git HEAD（deploy source）:** `e9c3dd0` — `feat(tasful-ai): add workspace quota enforcement phase2`  
**Production URL:** https://tasufull-article.pages.dev  
**Deploy hash（Access なし検証用）:** https://5437d70e.tasufull-article.pages.dev

---

## 1. サマリー

| 段階 | 結果 |
| --- | --- |
| ① SQL 本番適用 | ✅ **PASS** |
| ② Edge Deploy | ✅ **PASS** |
| ③ Pages Production Deploy | ✅ **PASS**（main · `e9c3dd0`） |
| ④ Live Edge Quota | ✅ **11/11 PASS**（Free / Standard / Pro） |
| ⑤ Regression（Gateway / Attach / TLV） | ✅ PASS |
| **Phase 2 Rollout Go/No-Go** | **Go** |
| **TASFUL AI Production Ready 総合** | **No-Go**（運用ブロッカー残） |

---

## 2. ① SQL — 本番 Supabase

**適用:**

```bash
npx supabase db query --linked --yes -f sql/ai-workspace-usage-daily.sql
```

**検証（`sql/ai-workspace-usage-daily-verify.sql`）:**

| オブジェクト | 結果 |
| --- | --- |
| Table `ai_workspace_usage_daily` | ✅ 存在 |
| Index `ai_workspace_usage_daily_date_idx` | ✅ 存在 |
| Function `check_ai_workspace_quota` | ✅ 存在 |
| Function `consume_ai_workspace_quota` | ✅ 存在 |
| RLS enabled | ✅ `true` |
| Policy deny-all | ✅ 適用 |

```json
{ "tbl": "ai_workspace_usage_daily", "check_fn": true, "consume_fn": true, "idx": true }
```

---

## 3. ② Edge Deploy

**コマンド:**

```bash
npx supabase functions deploy ai-workspace-quota gemini-chat openai-chat claude-chat \
  --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

**結果:** ✅ 4 関数すべて ACTIVE（2026-06-27 16:36:02 UTC）

| Function | Version | 備考 |
| --- | --- | --- |
| `ai-workspace-quota` | **1** | 新規 |
| `gemini-chat` | **28** | quota middleware 同梱 |
| `openai-chat` | **17** | 同上 |
| `claude-chat` | **16** | 同上 |

**Secrets:** 既存 GEMINI / OPENAI / ANTHROPIC / SUPABASE_SERVICE_ROLE 等は deploy ログ上変更なし（新規 secret 追加なし）。

---

## 4. ③ Pages Production Deploy

| 項目 | 値 |
| --- | --- |
| 方法 | `wrangler pages deploy deploy/cloudflare/dist --branch main` |
| Deployment ID | `5437d70e-6d0b-46df-8d1d-402633777c8d` |
| Environment | **Production** / **main** |
| Source commit | `e9c3dd0` |

**build:pages:** EPERM（dist ロック）のため **部分同期** — `ai-workspace-usage.js` · `ai-workspace-chat.js` · `ai-model-gateway.js` を dist へ手動コピー後 deploy。

**Production alias 確認:**

| URL | `ai-workspace-usage.js` Phase 2 |
| --- | --- |
| `https://5437d70e.tasufull-article.pages.dev` | ✅ `canUseAsync` 含有 |
| `https://tasufull-article.pages.dev` | Access ゲート HTML（認証後は同一 deploy） |

---

## 5. ④ Live Test（本番 Edge + Deploy hash Pages）

### Quota Edge — `test-ai-workspace-quota-edge.mjs`

**11/11 PASS** · 出力: `reports/tasful-ai-workspace-quota-edge-last.json`

| プラン | dailyLimit | 検証 |
| --- | --- | --- |
| **Free** | 5 | consume 5/5 · check block · consume 402 · chat 402 |
| **Standard** (`basic_300`) | 30 | status PASS（`stripe-e2e-simulate-genai-subscription`） |
| **Pro** (`pro_980`) | 100 | status PASS |

| 項目 | 結果 |
| --- | --- |
| `quota_exceeded` 統一 | ✅ |
| non-workspace chat スキップ | ✅ HTTP 200 |

### Text / Vision — `verify-tasful-ai-production-environment.mjs`

| プローブ | 結果 |
| --- | --- |
| OpenAI / Claude / Gemini text | ✅ 3/3 |
| OpenAI Vision | ✅ |
| Gemini Vision | ✅ |
| Claude Vision | ⚠️ HTTP 200 · モデル応答が vision 未認識（quota 無関係 · 既知揺れ） |
| Serper | ❌ credits 枯渇（既知） |

### Pages browser（deploy hash · Access なし）

`PAGES_BASE_URL=https://5437d70e.tasufull-article.pages.dev`

| スクリプト | 結果 |
| --- | --- |
| `test-ai-workspace-usage-enforcement-browser.mjs` | **15/15 PASS** |
| `test-tasful-ai-attach-vision-browser.mjs`（8788） | **8/8 PASS** |

---

## 6. ⑤ Regression

| 領域 | スクリプト | 結果 |
| --- | --- | --- |
| Gateway 契約 | `test-tasful-ai-final-phase.mjs` | **31/31 PASS** |
| Attach / Vision | `test-tasful-ai-attach-vision-browser.mjs` | **8/8 PASS** |
| TLV 入口 | `test-tlv-tasful-ai-entry.mjs` | **16/16 PASS** |
| Quota compat | `test-ai-workspace-quota-production-compat.mjs` | **3/3 PASS** |
| Business Directory / Builder / Platform / 秘書 / Voice / Live 全量 E2E | — | **未実施**（Edge quota 変更は Workspace スコープ · 他領域コード未変更） |

**影響評価:** chat Edge は `surface=ai-workspace` 時のみ quota 適用。Builder / gen-ai / 秘書の non-workspace 経路は **quota スキップ確認済**。

---

## 7. 残る Production Ready ブロッカー

| # | 項目 | 状態 |
| --- | --- | --- |
| 1 | Serper credits | ❌ 運用 |
| 2 | CF Access 下 E2E 自動化（Service Token） | ❌ 運用 |
| 3 | Stripe 本番 E2E | ❌ |
| 4 | `npm run build:pages` EPERM → 次回 full dist 同期推奨 | ⚠️ |

---

## 8. Go / No-Go 判定

| 判定軸 | 結果 |
| --- | --- |
| **Phase 2 Production Rollout** | **Go** — SQL + Edge + Pages main 反映 · live quota 11/11 |
| **TASFUL AI Production Ready（総合）** | **No-Go** — Serper · Access E2E · Stripe 残 |

---

## 9. 再検証コマンド

```bash
node scripts/test-ai-workspace-quota-edge.mjs
node scripts/verify-tasful-ai-production-environment.mjs
PAGES_BASE_URL=https://5437d70e.tasufull-article.pages.dev \
  node scripts/test-ai-workspace-usage-enforcement-browser.mjs
```

---

*Gateway 契約変更なし · AD-005 遵守。*
