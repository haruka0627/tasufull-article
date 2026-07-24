# TASFUL AI / AI Workspace / AI Core — 現状棚卸し

**調査日:** 2026-06-28（Priority 1 実装後更新）  
**正本レポート:** [tasful-ai-p1-implementation.md](./tasful-ai-p1-implementation.md)

---

## エグゼクティブサマリー

| 領域 | 総合判定 | 一言 |
| --- | --- | --- |
| **TASFUL AI Workspace** | **Production Go + P1 拡張** | チャット · 検索 · quota · 動画/音楽 Edge 接続済 |
| **Gateway** | **接続済** | AD-005 凍結 · 契約変更なし |
| **Media（動画/音楽）** | **Edge 接続済** | `gemini_brief` · quota · kill switch |
| **Voice Core** | **Phase 5-D + P2 opt-in** | JWT 認可（OFF デフォルト）· 二重 Rate Limit |
| **Monitoring** | **統合済** | `verify-tasful-ai-monitoring.mjs` |
| **Membership** | **Future** | REL-F-04 · 実装禁止 |

---

## 2026-06-28 Priority 1 完了項目

| 項目 | 状態 |
| --- | --- |
| Production Go（CF Access · quota · Brave） | ✅ 2026-06-28 |
| 動画/音楽 API Edge | ✅ `ai-workspace-*-generate` |
| Monitoring 横断 smoke | ✅ Runbook 整備 |
| Voice Hardening P2 | ✅ JWT opt-in · user rate limit |
| Membership 実装 | ❌ 禁止（ADR/原価待ち） |

---

## 残タスク（P1 以降 · Future 除く）

| 優先 | 内容 |
| --- | --- |
| Ops | prod alias redeploy · CF Access 週次 smoke |
| Ops | `VOICE_REALTIME_REQUIRE_JWT=1` 本番有効化判断 |
| P2 | 履歴 Supabase 同期 |
| P2 | 操作アシスタント backlog |
| Future | 専用動画/音楽 Provider（Veo/Suno 等） |
| Future | Redis 横断 Rate Limit |

---

## 参照（旧棚卸し 2026-06-26）

詳細機能マトリクス · 未接続 UI 一覧は [git 履歴](./tasful-ai-current-status.md) または旧版 commit を参照。  
Gateway 非変更方針のため、旧「添付未接続」等の項目は **本更新では再監査していない**。

---

*Priority 1 実装後の差分サマリ — フル再棚卸しは次フェーズ*
