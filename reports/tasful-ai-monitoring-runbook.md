# TASFUL AI — Monitoring Runbook（定期 smoke）

**日付:** 2026-06-28  
**正本スクリプト:** `scripts/verify-tasful-ai-monitoring.mjs`

---

## 目的

TASFUL AI 本番横断の健全性を **1 コマンド** で確認する。

| 監視対象 | スイート |
| --- | --- |
| Workspace 単体（8788 相当） | `test-tasful-ai-final-phase.mjs` |
| Edge · Gateway · AI Provider | `verify-tasful-ai-production-environment.mjs` |
| Media API（動画/音楽） | `test-tasful-ai-media-generate-edge.mjs` |
| Quota / Usage | `test-ai-workspace-quota-edge.mjs` |
| Voice Realtime | `test-voice-core-phase5c-edge-smoke.mjs` |
| Web Search（Brave） | `test-web-search-provider-edge.mjs` |
| prod alias（任意） | `verify-tasful-ai-access-workspace.mjs` |

---

## 定期実行（推奨）

### 日次（CI / 手動）

```bash
# ローカル · Edge live プローブ
node scripts/verify-tasful-ai-monitoring.mjs
```

**証跡:** `reports/tasful-ai-monitoring-last.json`

### 本番 alias（週次 · Service Token 必須）

```bash
PAGES_BASE_URL=https://tasufull-article.pages.dev node --env-file=.env scripts/verify-tasful-ai-monitoring.mjs
node --env-file=.env scripts/verify-tasful-ai-access-workspace.mjs
```

---

## Media API 運用 Secret

| Secret | 値 | 用途 |
| --- | --- | --- |
| `AI_MEDIA_GEN_EDGE_ENABLED` | `1` | 動画/音楽 Edge kill switch |
| `GEMINI_API_KEY` | （既存） | 制作プラン生成（`gemini_brief` モード） |
| `AI_MEDIA_GEMINI_MODEL` | 任意 | デフォルト `gemini-2.5-flash` |

**Deploy（FinOps 承認後）:**

```bash
npx supabase functions deploy ai-workspace-video-generate ai-workspace-music-generate --project-ref ddojquacsyqesrjhcvmn
npx supabase secrets set AI_MEDIA_GEN_EDGE_ENABLED=1 --project-ref ddojquacsyqesrjhcvmn
```

---

## Voice Hardening Phase 2 Secret（opt-in）

| Secret | デフォルト | 用途 |
| --- | --- | --- |
| `VOICE_REALTIME_REQUIRE_JWT` | 未設定（OFF） | `1` で Bearer JWT 必須 |
| `VOICE_REALTIME_EDGE_ENABLED` | `1` 推奨 | Kill switch |

---

## Go / No-Go

| 結果 | 条件 |
| --- | --- |
| **Go** | monitoring 全必須スイート PASS · `go: true` in JSON |
| **No-Go** | いずれか FAIL · KI 更新 · ロールバック Runbook 参照 |

---

## 禁止

- Gateway 契約変更（AD-005）
- TLV 再開（運用ゲート待ち）
- Membership 実装（REL-F-04）
