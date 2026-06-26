# TASFUL ロードマップ

**最終更新:** 2026-06-26

---

## 凡例

| 記号 | 意味 |
| --- | --- |
| ✅ | 完了（根拠: コミット / レポート / テスト） |
| 🔄 | 実装済み · 本番接続 or 運用タスク残 |
| 📋 | 未着手 or 設計のみ |
| 🔒 | Production Ready · 凍結（Critical/Security のみ変更可） |

---

## 製品基盤

| フェーズ | 状態 | 根拠 |
| --- | --- | --- |
| Builder v1.0 | ✅ 🔒 | `reports/builder-release-status.md` |
| Platform NB-1M | ✅ 🔒（製品） | スモーク PASS · `reports/platform-nb1m-frontend-prod-deploy-ready.md` |
| TLV v1.0 | ✅ 🔒 | `reports/tlv-release-status.md` |
| AI 運営秘書 v1.1 | ✅ 🔒 | `reports/ai-ops-secretary-release-status.md` |
| TALK / Connect / 安否 | ✅ 🔒 | 各 release-status レポート |

---

## AI ロードマップ

### Builder AI

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| 設計 | ✅ | `reports/builder-ai-architecture.md` |
| P1（actions · UI · 隔離） | ✅ | `5ed9672` |
| P2-A / P2-B（tools · JWT · draft staging SQL） | ✅ | `5ed9672` · `reports/builder-ai-p2-b.md` |
| **P2-C**（DB 適用 · hook · Supabase 正本化 · Live E2E） | 📋 | `reports/builder-ai-p2-b.md` §9 |

### Platform（製品機能）

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| **Coupon System**（店舗発行 · 購入者適用 · 運営監視） | 📋 Backlog | [platform-coupon-system-backlog.md](./platform-coupon-system-backlog.md) · 共通基盤化前提 · **UI Critical 優先度外** |

### Platform AI（入口のみ）

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| Next Phase（search hub · badges · OAuth コード） | ✅ | `5ed9672` |
| Finish Phase（listing 配線 · favorites UI · compare） | ✅ | `5ed9672` |
| Featured / favorites DB / OAuth E2E | 📋 | `reports/platform-finish-phase.md` §9 |

### TASFUL AI Workspace

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| チャット · 検索 · 画像 UI | ✅（既存 + 更新） | コミット前から存在 |
| Final（履歴 · 動画 · 音楽 · 資料 · 音声 · 規約） | ✅ | `5ed9672` · `reports/tasful-ai-final-phase.md` |
| **本番接続**（Edge · billing · Access E2E） | 🔄 | `reports/tasful-ai-production-preflight.md` |

### TLV AI

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| TLV 専用 AI エンジン | ❌ 作らない | [DECISIONS.md](./DECISIONS.md) |
| Workspace 入口（`source=tlv`） | ✅ | `5ed9672` · `reports/tlv-tasful-ai-entry.md` |

### AI 秘書

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| v1.1 リリース | ✅ 🔒 | `reports/ai-ops-secretary-release-status.md` |
| 未コミット phase ファイル | 📋 要整理 | working tree に `admin-ai-secretary-phase*.js` 等 |
| **Trend Scout**（トレンド収集 · 経営参謀提案） | 📋 Backlog | [ai-secretary-trend-scout-backlog.md](./ai-secretary-trend-scout-backlog.md) · v1.2 以降想定 · **UI Critical 優先度外** |

---

## 横断

| 項目 | 状態 |
| --- | --- |
| AI 規約 / 免責（共通） | ✅ `5ed9672` |
| **Site Assistant / Feedback Launcher**（横断 · 簡易ヘルプ / フィードバック） | 📋 Backlog — [tasful-site-assistant-backlog.md](./tasful-site-assistant-backlog.md) · Platform パイロット想定 · **UI Critical 優先度外** |
| Gateway 契約変更 | **意図なし** · working tree に `ai-model-gateway.js` 差分あり → [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) |
| working tree 440 件整理 | 📋 [TODO.md](./TODO.md) |
| `docs/` 正本 | 📋 本更新 · **未コミット** |

---

## 将来（v1.1 以降 · 凍結解除後）

- Builder AI Supabase 本番 RLS（P2-C 完了後）
- TASFUL AI 履歴 Supabase 同期
- Platform お気に入りサーバー正本
- **Platform Coupon System**（店舗・出品者発行 · 横断クーポン基盤）— [platform-coupon-system-backlog.md](./platform-coupon-system-backlog.md)
- **AI Secretary Trend Scout**（トレンド · 市場 · 補助金 · 法改正 · SNS/検索傾向 → TASFUL 提案）— [ai-secretary-trend-scout-backlog.md](./ai-secretary-trend-scout-backlog.md)
- **TASFUL Site Assistant / Feedback Launcher**（右下ランチャー · 必須7入口 · 通報 · TASFUL AI 導線 · OPS 集約）— [tasful-site-assistant-backlog.md](./tasful-site-assistant-backlog.md)
- 動画/音楽 API 本番パイプライン
- PDF/PPT エクスポート（TASFUL AI 資料生成）

**注:** TLV / Builder v1.0 / AI 秘書 v1.1 は FEATURE FROZEN。機能追加はマイナーバージョン計画後のみ。
