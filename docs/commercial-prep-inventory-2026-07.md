# 商用前整理 — Future / TODO 棚卸し（2026-07-05）

**目的:** 10月 Production 前の整理用サマリー  
**正本:** [docs/TODO.md](./TODO.md) · [docs/PROJECT_STATUS.md](./PROJECT_STATUS.md)  
**分類:** ✅ 完了 · 📋 未着手 · ⏸ 保留  
**注:** 本ファイルは **2026-07-05 棚卸し時点**のスナップショット。その後の HEAD 進捗（例: BD Launch 準備コミット）は [PROJECT_STATUS.md](./PROJECT_STATUS.md) / [commercial-launch-checklist](../reports/business-directory-commercial-launch-checklist.md) を正とする。**Launch を完了扱いにしない。**

---

## Builder

| 区分 | 項目 | 状態 | 備考 |
| --- | --- | --- | --- |
| ✅ | v1.0 本体 · Talk Review 全フロー | 完了 | Production Ready · FROZEN |
| ✅ | Calendar Hub Primary（完了） | 完了 | MVP は fallback のみ |
| ✅ | 条件検索 P0/P1 | 完了 | P2 LLM = Future |
| ⏸ | 一般案件 Production 適用 | 保留 | **10月リリース予定** · SQL/deploy 凍結 |
| ⏸ | Production Migration · partner RPC | 保留 | Hub Primary 外 · 10月ウィンドウ |
| 📋 | 条件検索 P2/P3（LLM・AI要約） | 未着手 | REL-F-07 · Gateway 接続 |
| 📋 | Builder Monetization / Credits | 未着手 | 設計 Draft · REL-F-05 |
| 📋 | Builder AI P2-C 本番 DB | 未着手 | staging のみ · REL-P1-03 |

---

## Business Directory

| 区分 | 項目 | 状態 | 備考 |
| --- | --- | --- | --- |
| ✅ | MVP-1 UI · Phase 1–7 実装 | 完了 | 8788 検証済み |
| ✅ | DB Production controlled apply | 完了 | 2026-07-01 · ref `ddojquacsyqesrjhcvmn` |
| ⏸ | Commercial Launch | 保留 | **Conditional No-Go** · Stripe Live · 法務未了 |
| 📋 | Stripe Live E2E · 本番サブスク | 未着手 | 商用開始ゲート |
| 📋 | Order/Reservation（将来構想） | 未着手 | 掲載無料・成果報酬モデル |
| 📋 | BD 専用利用規約・特商法 | 未着手 | L14 未確認 |

---

## Talk

| 区分 | 項目 | 状態 | 備考 |
| --- | --- | --- | --- |
| ✅ | TASFUL Talk 本体 | 完了 | Production Ready · FROZEN |
| ✅ | Platform 求人 → 550円 → Talk | 完了 | 2026-07-03 Review PASS |
| ✅ | Builder 全 Talk フロー Review | 完了 | partner / worker / vendor |
| ✅ | Connect · WebRTC · 通知基盤 | 完了 | RELEASE FROZEN |
| ⏸ | 未読 badge（デモ seed） | 保留 | 機能影響なし |
| 📋 | Platform Request P6 本番接続 | 未着手 | Staging Go · Production 保留 |

---

## TLV

| 区分 | 項目 | 状態 | 備考 |
| --- | --- | --- | --- |
| ✅ | v1.0 UI · T1/T2/T4 導線整理 | 完了 | FEATURE FROZEN |
| ✅ | Payment Engine Step 0–5（Staging/prod DDL） | 完了 | Edge v4 · clawback 設計 |
| ✅ | Platform Live Phase 5 統合 | 完了 | P5-1〜P5-9 |
| ⏸ | Live UI ↔ Payment 本番接続 | 保留 | Production No-Go · [監査](../reports/tlv-payment-live-ui-connection-audit.md) |
| ⏸ | 実 RTC / ZEGO 本番 PoC | 保留 | Flag OFF · Conditional Go |
| 📋 | Clawback 法務条文（TODO-LEGAL-CB-01） | 未着手 | MVP 前 |
| 📋 | FinOps payout 後 manual recovery | 未着手 | REL-P0-02 |
| 📋 | Live Platform Vision 制度実装 | 未着手 | REL-F-01 · 設計のみ |

---

## Platform

| 区分 | 項目 | 状態 | 備考 |
| --- | --- | --- | --- |
| ✅ | 本体 · →Talk Review PASS | 完了 | Production Ready · FROZEN |
| ✅ | 550円 Talk 開始（求人ほか） | 完了 | Staging Test |
| ✅ | 利用規約・FAQ 商用前整理 | 完了 | 2026-07-05 本整理 |
| ✅ | オプション UI（準備中表示） | 完了 | `platform-options.html` · 決済なし |
| ⏸ | Boost / スポンサー等オプション決済 | 保留 | 近日対応 · catalog 準備済み |
| ⏸ | featured バッジ · favorites DB 同期 | 保留 | REL-P1-02 |
| 📋 | Google OAuth 実機 E2E | 未着手 | Dashboard 設定後 |
| 📋 | Platform Request Production 接続 | 未着手 | P5 Staging Go |

---

## 横断（今回触らない）

| 項目 | 分類 |
| --- | --- |
| TASFUL AI Router / 本体新機能 | 📋 Future（明示禁止） |
| Production Supabase MCP / SQL 手動適用 | ⏸ 10月まで保留 |
| Cloudflare Production deploy | ⏸ 10月まで保留 |
| Stripe Live | ⏸ 商用ゲートまで保留 |

---

*次回更新: 10月 Production 直前チェックリスト実施時*
