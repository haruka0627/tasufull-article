# TASFUL AI Core — Phase 1 完了レポート（SAFE-05 Usage Guard）

**日付:** 2026-07-05  
**スコープ:** Chat 3 Edge + Gemini OCR · Staging のみ  
**計画正本:** [docs/tasful-ai-core-august-2026-plan.md](../docs/tasful-ai-core-august-2026-plan.md)

---

## 概要

既存 `ai-workspace-quota.ts` をラップする **統一 Usage Guard** を追加し、Chat Edge と CF OCR に接続しました。Gateway 契約（AD-005）は変更していません。

```
AI Gateway（既存）
    ↓
SAFE-05 Usage Guard（新規）
    ↓
Chat Edge / gemini-ocr
```

---

## 変更ファイル

| 種別 | パス |
| --- | --- |
| 計画正本 | `docs/tasful-ai-core-august-2026-plan.md` |
| Guard（Supabase） | `supabase/functions/_shared/ai-usage-guard.ts` |
| Guard（CF） | `deploy/cloudflare/functions/_shared/ai-usage-guard.mjs` |
| Chat Edge | `supabase/functions/gemini-chat/index.ts` |
| Chat Edge | `supabase/functions/openai-chat/index.ts` |
| Chat Edge | `supabase/functions/claude-chat/index.ts` |
| OCR Edge | `deploy/cloudflare/functions/api/gemini-ocr.js` |
| OCR クライアント | `chat-ocr.js` |
| テスト | `scripts/test-tasful-ai-safe-ops-guard-phase1.mjs` |

---

## DB

**変更なし**（Phase 1）

- 既存 `ai_workspace_usage_daily` + RPC `check_ai_workspace_quota` / `consume_ai_workspace_quota` を再利用
- `ocr_turn` は quota 上 **`vision_turn` バケット**を共有（マッピングのみ）

---

## Edge

| Edge | 変更 |
| --- | --- |
| `gemini-chat` | `enforceGuardChatEntry` / `finalizeGuardChatConsume` |
| `openai-chat` | 同上 |
| `claude-chat` | 同上 |
| `/api/gemini-ocr` | `enforceCfOcrGuard` → Gemini 実行 → `finalizeCfOcrConsume` |

**CF Guard ルール**

- `surface=ai-workspace` のみ強制
- `user_id` 必須（欠落時 401）
- Staging ref のみ（Production ref は 503）
- `SUPABASE_SERVICE_ROLE_KEY` 未設定時は dev フォールバック（guard スキップ · 警告ログ）

---

## UI

**変更なし**（既存 Workspace / Talk 画面）

- `chat-ocr.js` が `user_id` + `surface` + `feature=ocr_turn` を POST
- `ai-workspace.html` では pathname から `surface=ai-workspace` を自動付与

---

## テスト

```bash
node scripts/test-tasful-ai-safe-ops-guard-phase1.mjs
node scripts/test-tasful-ai-final-phase.mjs
```

| テスト | 結果 |
| --- | --- |
| `test-tasful-ai-safe-ops-guard-phase1.mjs` | **24/24 PASS** |
| `test-tasful-ai-final-phase.mjs` | **29/31 PASS**（`html: categories nav` / `html: history category` は既知 · 本変更無関係） |

**隔離テスト:** gateway / builder / secretary / tlv / platform — すべて PASS

---

## 回帰

- Chat Edge の quota 挙動は既存 RPC と同一（guard は薄いラッパー）
- OCR: `surface` 未指定（Talk / Platform 等）は **Phase 1 では guard スキップ**（後方互換）

---

## 残課題（Phase 2 以降）

| ID | 内容 |
| --- | --- |
| SAFE-06 | `ai_usage_events` + ingest Edge |
| Phase 3 | Auto Router → Gateway 配線 |
| Phase 7 | Talk / Platform / Builder OCR を guard 経由へ |
| Phase 7 | 秘書 · Vision · TTS 等の未 Guard Edge |
| — | `ocr_turn` 専用バケット（必要なら migration） |
| — | Production デプロイは 8月計画外 |

---

## 8788 検証

| URL | HTTP | Console | Viewport |
| --- | --- | --- | --- |
| `/ai-workspace.html` | **200** | 未実施（UI 変更なし） | 未実施（UI 変更なし） |

---

*次フェーズ: SAFE-06 Usage Log（`ai_usage_events`）*
