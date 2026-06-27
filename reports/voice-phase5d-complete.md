# Voice Phase 5-D — 完了報告

**Status:** ✅ 正式完了（2026-06-27）  
**Branch:** `cf-pages-deploy`  
**HEAD（5-D-3 dist sync）:** `4f1f926`

---

## 実装概要

Voice Core Phase 5 は OpenAI Realtime の **実接続基盤（5-A〜5-C）** と **3 Surface への Live opt-in 統合（5-D）**、および **Edge Hardening Phase 1** で構成される。

| Sub-phase | 内容 | 状態 | 代表 commit |
| --- | --- | --- | --- |
| 5-A | policy / config / wire client 境界 | ✅ | （Phase 5 基盤） |
| 5-B | WebSocket transport | ✅ | `6924aa1` |
| 5-C | Edge ephemeral token + smoke | ✅ | `0cedb27` · `4775d24` |
| **5-D-1** | TASFUL AI Live opt-in | ✅ | `1c8fe87` |
| **5-D-2** | Builder AI Live opt-in | ✅ | `2a57283` |
| **5-D-3** | AI秘書 Live opt-in | ✅ | `e43c9c0` |
| **Hardening 1** | Kill Switch + Rate Limit | ✅ | `d1f6ced` |

**共通パターン:** 両方の feature flag が ON のときのみ live。デフォルト mock。live 失敗時は mock fallback。

```
Controller → ensureLiveInjectors()
  → TasuVoiceRealtimeSessionClient.refresh({ surface })
  → Supabase Edge (openai-realtime-session)
  → ephemeral token → injectors → live WebSocket (GA transport)
```

---

## GA Realtime 対応

| 項目 | 変更 |
| --- | --- |
| **Edge API** | beta Sessions API → GA **`client_secrets`** エンドポイント（`0cedb27`） |
| **Transport** | WebSocket から `openai-beta.realtime-v1` subprotocol を除去（`6924aa1`） |
| **Ephemeral token** | URL に model 省略 · 空 `session.update` スキップ |
| **Default model** | `gpt-realtime-2`（`74e8048`）— controller 再 fetch パス対応 |

---

## Edge `client_secrets`

- **Function:** Supabase Edge `openai-realtime-session`
- **Shared:** `supabase/functions/_shared/openai-realtime-session.ts`
- **出力:** 短命 ephemeral token（長期 API key は Edge のみ）
- **Guard:** `voice-realtime-edge-guard.ts`（Hardening Phase 1）

---

## Default model `gpt-realtime-2`

- `voice-realtime-config.js` デフォルトを `gpt-realtime-2` に統一
- `ensureLiveInjectors()` が model なしで再 fetch しても live セッション成立

---

## Hardening Phase 1

| 項目 | 内容 |
| --- | --- |
| **Kill Switch** | Supabase secret `VOICE_REALTIME_EDGE_ENABLED=1` 必須。未設定時 Edge は 503 |
| **Rate Limit Phase 1** | in-memory · **10 req/min/IP**（Edge isolate 単位 · best-effort） |
| **実装** | `supabase/functions/_shared/voice-realtime-edge-guard.ts`（`d1f6ced`） |

---

## TASFUL AI（5-D-1 · `1c8fe87`）

| 項目 | 内容 |
| --- | --- |
| **surface** | `tasful_ai` |
| **ページ** | `ai-workspace.html` |
| **Controller** | `tasful-ai-voice-controller.js` · `tasful-ai-voice-integration.js` |
| **Flags** | `__TASU_VOICE_CORE_OPENAI_LIVE__` + `__TASU_VOICE_LIVE_TASFUL_AI__` |

---

## Builder AI（5-D-2 · `2a57283`）

| 項目 | 内容 |
| --- | --- |
| **surface** | `builder_ai` |
| **ページ** | `builder/builder-ai.html` |
| **Controller** | `builder/builder-voice-controller.js` · `builder/builder-ai-voice-integration.js` |
| **Flags** | `__TASU_VOICE_CORE_OPENAI_LIVE__` + `__TASU_VOICE_LIVE_BUILDER_AI__` |
| **Dist sync** | `418d731` |

Phase 4-A の mock Voice adapter は維持。Live は opt-in のみ。

---

## AI秘書（5-D-3 · `e43c9c0`）

| 項目 | 内容 |
| --- | --- |
| **surface** | `ops_secretary` |
| **ページ** | `admin-operations-dashboard.html` |
| **Controller** | `admin-ai-secretary-voice-controller.js` · `admin-ai-secretary-voice-integration.js` |
| **Flags** | `__TASU_VOICE_CORE_OPENAI_LIVE__` + `__TASU_VOICE_LIVE_OPS_SECRETARY__` |
| **Dist sync** | `4f1f926` |

DeepSeek テキストチャット（AD-010）とは独立。Voice は OpenAI Realtime opt-in。

---

## Smoke / 統合テスト結果

| スクリプト | 結果 |
| --- | --- |
| `scripts/test-voice-core-phase5c-edge-smoke.mjs` | **32/32 PASS** |
| `scripts/test-tasful-ai-voice-integration-phase1.mjs` | **39/39 PASS** |
| `scripts/test-builder-ai-voice-integration-phase1.mjs` | **35/35 PASS** |
| `scripts/test-secretary-voice-integration-phase1.mjs` | **25/25 PASS** |
| `scripts/test-secretary-ai-voice-integration-phase1.mjs` | **35/35 PASS** |

**手動（8788 · flags ON）:** 3 Surface とも `session_active_live` / LIVE_ACTIVE 到達を確認。

---

## 既知事項

| 項目 | 内容 |
| --- | --- |
| **Rate Limit** | in-memory · Edge isolate 単位の best-effort。本番 429 の再現は rapid curl では困難な場合あり |
| **JWT 認可** | 未実装 — Hardening Phase 2 に延期 |
| **`test-voice-core-phase5.mjs`** | Phase 6-G 等の無関係 FAIL が残る可能性（5-D 回帰ではない） |
| **Integration「edge unavailable stays mock」** | Edge 稼働時は live 到達を許容するよう更新済み |
| **デフォルト運用** | 全 Surface flags OFF → 本番影響なし（mock のみ） |

---

## ドキュメント正本

| ファイル | 更新内容 |
| --- | --- |
| `docs/TODO.md` | 5-D-1/2/3 + Hardening Phase 1 完了 |
| `docs/ROADMAP.md` | Voice Core セクション追加 |
| `docs/AI/README.md` | Voice 対応 Surface 一覧 |
| `docs/AI/BUILDER_AI.md` | Realtime Live opt-in 追記 |
| `docs/AI/SECRETARY_AI.md` | Realtime Live opt-in 追記 |

---

## 次フェーズ候補

| 候補 | 概要 |
| --- | --- |
| **Hardening Phase 2** | JWT 認可 · 本番向けガード強化 |
| **Redis 等による分散 Rate Limit** | isolate 横断の正確なレート制限 |
| **JWT 認可** | Edge / client 双方の surface 検証 |
| **Builder Voice UX 改善** | Live 状態表示 · エラー UX · Pro gate 連携 |
| **AI秘書 Voice UX 改善** | ops dashboard 向け Live UI  polish |
| **TLV Voice 検討** | AD-004 準拠 · Workspace 入口との関係整理 |

---

## Commit 一覧（Phase 5-D 関連）

| Commit | Message |
| --- | --- |
| `4775d24` | test(voice-core): add realtime session edge smoke |
| `1c8fe87` | feat(tasful-ai): add workspace voice live opt-in behind flags |
| `0cedb27` | fix(voice-core): use OpenAI client_secrets endpoint for realtime session |
| `6924aa1` | fix(voice-core): connect realtime websocket with GA protocol |
| `74e8048` | fix(voice-core): default realtime sessions to gpt-realtime-2 |
| `d1f6ced` | feat(voice-core): add realtime edge kill switch and rate limit |
| `2a57283` | feat(builder-ai): add realtime voice live opt-in |
| `418d731` | chore(builder-ai): sync realtime voice live opt-in to dist |
| `e43c9c0` | feat(secretary): add realtime voice live opt-in |
| `4f1f926` | chore(secretary): sync realtime voice live opt-in to dist |
