# TASFUL AI — Gateway / Attachments HEAD ↔ Production Sync

**実施日:** 2026-06-28  
**目的:** TASFUL AI P0-2 前置 — KI-001 / KI-006 の Gateway + `ai-attachments.ts` 差分整理と、repo HEAD と本番 Edge の整合確認（**仕様変更なし · AD-005 遵守**）  
**Git HEAD（調査開始時）:** `01a98c0` — `chore(business-directory): record production deployment`

---

## 1. サマリー

| 項目 | 判定 |
| --- | --- |
| KI-001（`ai-model-gateway.js` 未コミット） | **解消済み** — `35d72b2` + dist `0f6328d` |
| KI-006（`ai-attachments.ts` untracked） | **解消済み** — `35d72b2` |
| working tree 差分（Gateway / Attach スコープ） | **0 件** |
| source ↔ dist 一致 | **一致**（`ai-model-gateway.js`） |
| 本番 Edge text / Vision | **6/6 PASS**（2026-06-28 再プローブ） |
| 本番 Edge 再デプロイ | **不要**（2026-06-25 デプロイ済 · live 一致） |
| ローカル Attach/Vision E2E（8788） | **8/8 PASS** |
| Gateway 契約回帰 | **31/31 PASS** |
| **Phase 2 enforcement 前置 Go/No-Go** | **Go**（Gateway/Attach/Vision ブロッカーなし） |

---

## 2. コミット履歴（Gateway / Attach スコープ）

| Commit | 内容 | ファイル |
| --- | --- | --- |
| `35d72b2` | `feat(tasful-ai): add attachment and vision support for production edge chat` | `ai-model-gateway.js` · `supabase/functions/_shared/ai-attachments.ts` · `gemini-chat` / `openai-chat` / `claude-chat` · verify/attach smoke scripts · `package.json` |
| `0f6328d` | `build(gateway): sync Pages dist for attachment-aware ai-model-gateway` | `deploy/cloudflare/dist/ai-model-gateway.js`（+73 / -6） |

**注:** KI-001 / KI-006 は 2026-06-26 時点の working tree 記載。本調査時点では **両コミットとも `cf-pages-deploy` 祖先に含まれる**。

---

## 3. working tree 確認（2026-06-28）

### 3.1 対象ファイル — 差分 **0**

```text
ai-model-gateway.js
deploy/cloudflare/dist/ai-model-gateway.js
supabase/functions/_shared/ai-attachments.ts
supabase/functions/gemini-chat/index.ts
supabase/functions/openai-chat/index.ts
supabase/functions/claude-chat/index.ts
ai-workspace-attachments.js
ai-workspace-chat.js
scripts/verify-tasful-ai-production-environment.mjs
scripts/test-tasful-ai-attach-vision-browser.mjs
```

`git diff HEAD -- <上記>` → **空**

### 3.2 source ↔ dist

PowerShell `Compare-Object` — root `ai-model-gateway.js` と `deploy/cloudflare/dist/ai-model-gateway.js` → **バイト一致**

### 3.3 今回 stage 対象外（unrelated · 混在防止）

| カテゴリ | 代表 | 理由 |
| --- | --- | --- |
| Business Directory | `01a98c0` 以降 BD レポート等 | スコープ外 |
| Builder / Platform / TLV / AI秘書 | dist HTML · phase JS · sim | 凍結 / 別トラック |
| Voice / supabase-ops / platform-ops | `??` dist 群 | Gateway 単独と混在禁止 |
| Gemini / Serper 診断 | `reports/gemini-*` | 運用調査 · Attach 無関係 |
| `package.json` wrangler date | KI-007 | AI Gateway 無関係 |
| 本 `docs/` 正本セット | KI-009 | 別コミット |

---

## 4. Gateway / Attach 変更要点（`35d72b2` · 契約拡張のみ · AD-005）

**新規（クライアント）**

- `normalizeAttachments()` / `buildAttachmentTextBlock()` / `mergeMessageWithAttachments()`
- `mockReply(..., attachments)` — 添付ファイル名・PDF/画像注記
- `callModel()` → Edge へ `attachments` 転送（gemini / openai / anthropic 分岐 **不変**）
- `completeTurn()` — 添付時 `skipSearch`、返却 `attachments_count` / `searchFailed` / `searchMessage`（後方互換）

**新規（Edge · `ai-attachments.ts`）**

- `normalizeAttachments()` · `buildGeminiUserParts()` · `buildOpenAiUserContent()` · `buildClaudeUserContent()`
- 各 chat handler が `attachments[]` を Vision payload に変換

**変更していないもの:** provider routing · `postEdge` 契約 · secret 参照 · UI · Builder / Platform / 秘書 surface

---

## 5. 本番 Edge 整合

### 5.1 デプロイ状態（参照: `reports/tasful-ai-production-environment-fix.md`）

| Function | Live Version | Vision (`ai-attachments.ts`) |
| --- | --- | --- |
| `gemini-chat` | 23（2026-06-25 UTC） | ✅ |
| `openai-chat` | 12 | ✅ |
| `claude-chat` | 11 | ✅ |

**Edge 再デプロイ要否:** **不要** — live プローブが repo 期待どおりの Vision 応答を返す。

### 5.2 live smoke（`node scripts/verify-tasful-ai-production-environment.mjs`）

**実施:** 2026-06-28 · 出力: `reports/tasful-ai-production-environment-probes.json`

| プローブ | HTTP | 結果 | 備考 |
| --- | --- | --- | --- |
| OpenAI text | 200 | ✅ PASS | |
| Claude text | 200 | ✅ PASS | |
| Gemini text | 200 | ✅ PASS | billing 復旧確認 |
| OpenAI Vision | 200 | ✅ PASS | `Red.` |
| Claude Vision | 200 | ✅ PASS | `Circle` |
| Gemini Vision | 200 | ✅ PASS | `Red` |
| Serper search | 502 | ❌ FAIL | credits 枯渇 — **Attach/Gateway スコープ外** |

**text / vision / attach 経路: 6/6 PASS**

### 5.3 ローカル Attach E2E（8788）

```powershell
$env:BUILDER_BASE_URL="http://127.0.0.1:8788"
node scripts/test-tasful-ai-attach-vision-browser.mjs
```

| 結果 | 8/8 PASS |
| --- | --- |
| 確認項目 | テキストのみ · 画像プレビュー · Gateway 渡し · txt/json · 非対応エラー · エラー後入力 · Voice 非破壊 |

### 5.4 Gateway 契約回帰

`node scripts/test-tasful-ai-final-phase.mjs` → **31/31 PASS**

---

## 6. docs 整合

| 正本 | 本調査との関係 |
| --- | --- |
| `docs/KNOWN_ISSUES.md` KI-001 / KI-006 | **解消** — 本レポート + KNOWN_ISSUES 更新 |
| `docs/DECISIONS.md` UD-001 | **解消** — `35d72b2` でマージ済み |
| `docs/TODO.md` P0-1 §gateway / ai-attachments | **完了** — チェック更新 |
| `docs/TODO.md` P0-2 Edge deploy 行 | **完了** — live Vision PASS |
| `reports/gateway-diff-triage-after-secretary.md` | dist 遅れは `0f6328d` で解消 |
| `reports/tasful-ai-p0-2-production-connection-triage.md` | Edge+Vision ✅ と一致 |

---

## 7. 選別コミット（本タスク）

**working tree に Gateway / Attach コード差分なし** → コード再コミットは不要。

本タスクのコミット内容:

| ファイル | 理由 |
| --- | --- |
| `reports/tasful-ai-gateway-attachments-head-sync.md` | 本レポート（成果物） |
| `reports/tasful-ai-production-environment-probes.json` | live smoke 証跡（2026-06-28） |
| `docs/KNOWN_ISSUES.md` | KI-001 / KI-006 解消 |

**コミットメッセージ:**

```text
chore(tasful-ai): sync gateway attachments production state
```

---

## 8. Phase 2 enforcement — Go / No-Go

| ゲート | 判定 |
| --- | --- |
| Gateway source HEAD 確定 | ✅ Go |
| Pages dist 同期 | ✅ Go |
| Edge `ai-attachments.ts` live | ✅ Go |
| live text / vision / attach | ✅ Go |
| Serper credits | ❌ 運用ブロッカー（Phase 2 実装とは独立） |
| CF Access Service Token | ⚠️ P0-2 運用残（Phase 2 コード着手の前置ではない） |

**総合:** Workspace 課金 enforcement **Phase 2（Edge + DB quota）実装着手 → Go**

Gateway / Attach / Vision の repo ↔ 本番整合は取れている。Phase 2 は `reports/tasful-ai-workspace-enforcement-design.md` に従い Edge quota + DB を実装可能。

---

*調査 · live smoke · 8788 E2E 実施。Gateway 契約 · UI · 他領域コード変更なし。*
