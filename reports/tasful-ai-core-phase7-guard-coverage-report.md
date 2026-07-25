# TASFUL AI Core — Phase 7 完了レポート（Guard Coverage Expansion）

**日付:** 2026-07-26  
**スコープ:** 既存 AI 実行経路の Guard 統一（新機能・新 Provider・料金変更なし）  
**環境:** コード · mock · unit/static · Playwright 最小 · Staging live **未検証** · Production / deploy / push **なし**

---

## 判定

**CONDITIONAL PASS** — Staging paused により live JWT / DB / Provider 未検証。

---

## 全 AI 経路監査（要約）

| 経路 | 実装 | Guard状態 | 備考 |
| --- | --- | --- | --- |
| gemini/openai/claude-chat (`surface=ai-workspace`) | live | **guarded** | Phase 5 JWT + plan + quota |
| OpenRouter PoC | live (internal) | **internal_only** | Phase 6 · Production 無効 |
| CF `/api/gemini-ocr` | live | **guarded** | Phase 7 で Plan Policy `ocr` 追加 |
| Media video/music Edge | live (kill switch) | **guarded** | Phase 7 JWT（claimed-only 廃止） |
| serper-search | live | **guarded** | Phase 7 JWT + `search` |
| gemini-tts (CF / Edge) | live | **guarded** | Phase 7 JWT + `text_to_speech` |
| gemini-image-character-analyze | live | **guarded** | Phase 7 · `image_analysis`（Pro） |
| Gemini Live / Voice Realtime | live | **partially_guarded** | 専用 Voice guard · SAFE-05 外（後続） |
| AI 運営秘書 DeepSeek | live | **out_of_scope** | AD-010 · Workspace 外 · FROZEN |
| Builder AI chat | live | **out_of_scope** | AD-002 · surface≠workspace |
| Google Cloud Vision OCR | — | **dead_code** | 不在 |
| image generation / STT 新規 | — | **future** | 未実装 |

---

## 既存問題と今回修正

| 問題 | 修正 |
| --- | --- |
| CF OCR に Plan Policy `ocr` なし | `policyFromGenAiPlan` + `plan_feature_denied` |
| Media claimed-only `user_id` | JWT `resolveAuthenticatedWorkspaceUser` |
| TTS / Search 無認証 Provider 呼出し | JWT + feature + quota |
| Character Vision 無認証 | JWT + `image_analysis` |
| Guard catch fail-open | `usage_guard_unavailable` fail-closed |
| feature / quota 分散 | `CANONICAL_FEATURES` + `QUOTA_CATEGORY_MAP` |

---

## Canonical Feature / Quota

**Active features:** `workspace_chat` · `gemini_chat` · `openai_chat` · `claude_chat` · `ocr` · `search` · `text_to_speech` · `image_analysis`  
**Never on production plans:** `openrouter_chat`  
**Future (inactive):** `vision` · `image_generation` · `voice_input` · `speech_to_text` · `site_assistant` · `document_analysis` · `media`

| Feature | Quota category |
| --- | --- |
| chat / search / TTS / media brief | `text_turn` |
| ocr / image_analysis | `vision_turn`（OCR は Phase 1 共有） |

日次 limit 値（5 / 30 / 100）は **変更なし**。

---

## Cloudflare / Supabase 差分

| | Supabase Chat | CF OCR / TTS |
| --- | --- | --- |
| JWT | Edge `resolveAuthenticatedWorkspaceUser` | `/auth/v1/user` |
| Plan Policy | `ai-plan-policy.ts` | `ai-plan-policy.mjs`（同正本コピー） |
| claimed-only | 廃止 | 廃止（server-derived user） |

---

## 残課題（Phase 7 内）

- Voice Live / Realtime を SAFE-05 契約へ寄せる
- 秘書 · Builder は製品境界のため別ゲート
- Staging live 検証
- GenAI character（free/lite）は `image_analysis` 未許可 → Pro のみ（意図的）
- Media Usage Log は任意（今回必須化せず · quota は接続）

---

## 検証

```text
node scripts/test-tasful-ai-guard-coverage-phase7.mjs
node scripts/verify-ai-guard-coverage-phase7.mjs
```

## 次 Phase

**Phase 8: AI Workspace 最終統合・リリース前監査**
