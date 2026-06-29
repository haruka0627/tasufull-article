# TASFUL AI Priority 1 — 実装レポート

**日付:** 2026-06-28  
**スコープ:** Step 0–4（Membership Step 5 = 実装禁止 · スキップ）  
**TLV:** Pause 維持 · 未着手

---

## Executive summary

| Step | 結果 | Go/No-Go |
| --- | --- | --- |
| Step 0 Baseline | **PASS** | Go |
| Step 1 Media API | **PASS** | Go |
| Step 2 Monitoring | **PASS**（quota 順序修正後） | Go |
| Step 3 Voice P2 | **PASS**（mock smoke 32/32 · JWT opt-in） | Go |
| Step 4 Docs | **PASS** | Go |
| Step 5 Membership | **SKIP**（REL-F-04） | N/A |

**AD-005 / Gateway 契約:** 変更なし  
**UI 全面改修:** なし

---

## Step 0 — Baseline

| テスト | 結果 |
| --- | --- |
| `test-tasful-ai-final-phase.mjs` | **31/31 PASS** |
| `verify-tasful-ai-production-environment.mjs` | **7/7 PASS** |
| prod alias Access | **SKIP**（CF_ACCESS 未設定 · 既知） |

**Go**

---

## Step 1 — 動画・音楽 API 本番接続

### 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `ai-media-gen-config.js` | `enabled: true` · Edge endpoint |
| `ai-video-generate.js` | Edge POST · quota 402 · timeout |
| `ai-music-generate.js` | 同上 |
| `ai-workspace-categories.js` | `allowMock` = config.mock |
| `supabase/functions/_shared/ai-workspace-media-generate.ts` | **新規** · Gemini brief · quota |
| `supabase/functions/ai-workspace-video-generate/` | **新規** |
| `supabase/functions/ai-workspace-music-generate/` | **新規** |
| `supabase/config.toml` | verify_jwt false |
| `scripts/test-tasful-ai-media-generate-edge.mjs` | **新規** |
| `scripts/test-tasful-ai-final-phase.mjs` | テスト sandbox config |

### 実装内容

- Edge kill switch: `AI_MEDIA_GEN_EDGE_ENABLED=1`（**設定済**）
- Provider: **Gemini**（`gemini_brief` モード · 制作プラン Markdown）
- Quota: `text_turn` 消費（既存 RPC · migration なし）
- エラー: 400 empty · 402 quota · 503 disabled · 504 timeout

### Deploy

- `ai-workspace-video-generate` · `ai-workspace-music-generate` → **deployed**
- Secret `AI_MEDIA_GEN_EDGE_ENABLED=1` → **set**

### テスト

| スクリプト | 結果 |
| --- | --- |
| `test-tasful-ai-media-generate-edge.mjs` | **6/6 PASS** |
| `test-tasful-ai-final-phase.mjs` | **31/31 PASS** |

**Go**

---

## Step 2 — Monitoring 統合

### 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `scripts/verify-tasful-ai-monitoring.mjs` | **新規** · 横断 smoke |
| `reports/tasful-ai-monitoring-runbook.md` | **新規** · 定期 Runbook |

### 監視対象

Final Phase · prod Edge · Quota · Media · Voice · Brave · Access（任意）

**Go**

---

## Step 3 — Voice Hardening Phase 2

### 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `supabase/functions/_shared/voice-realtime-jwt.ts` | **新規** · JWT opt-in |
| `supabase/functions/_shared/voice-realtime-edge-guard.ts` | IP + user 二重 Rate Limit |
| `supabase/functions/openai-realtime-session/index.ts` | JWT + user bucket |

### 実装内容

- `VOICE_REALTIME_REQUIRE_JWT=1` で Bearer JWT 必須（**デフォルト OFF · 後方互換**）
- Rate limit: IP 10/min + authenticated user 20/min（isolate 内）
- Gateway / client UI 契約: **変更なし**

### Deploy

- `openai-realtime-session` → **deployed**

### テスト

| スクリプト | 結果 |
| --- | --- |
| `test-voice-core-phase5c-edge-smoke.mjs` | **32/32 PASS** |

**Go**（Redis 横断 limit は Runbook Future · isolate 制約は既知）

---

## Step 4 — ドキュメント同期

`docs/PROJECT_STATUS.md` · `docs/TODO.md` · `docs/ROADMAP.md` · `docs/KNOWN_ISSUES.md` · `reports/tasful-ai-current-status.md` 更新済

---

## Step 5 — Membership

**実装禁止** — REL-F-04 · ADR · 原価 · 料金決定待ち

---

## 影響範囲

| 領域 | 影響 |
| --- | --- |
| TASFUL AI Workspace | 動画/音楽カテゴリ → Edge 接続 |
| Gateway | **なし** |
| TLV | **なし** |
| Quota | Media 生成 = text_turn 1 消費/回 |
| Voice | JWT opt-in 追加（OFF デフォルト） |

---

## 残 Ops（任意）

- [ ] `npm run dev` 再起動（build:pages が dev 停止）
- [ ] prod alias redeploy（dist 同期後）
- [ ] CF Access 週次 smoke
- [ ] 専用動画/音楽 Provider（Veo/Suno 等）— Future · secret 追加時に Edge 拡張

---

*Priority 1 実装完了 — Membership 除く Go*
