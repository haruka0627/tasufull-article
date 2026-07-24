# AI 領域ドキュメント

**最終更新:** 2026-06-27（Voice Phase 5-D）

各製品の AI 詳細は個別ファイルが正本。サービス全体の **国内/海外展開方針** は [DECISIONS.md](../DECISIONS.md) **AD-011**（要約: [ROADMAP.md](../ROADMAP.md) §サービス展開方針）。**UI/UX 設計原則** は **AD-012**（要約: [ROADMAP.md](../ROADMAP.md) §UI/UX 設計原則）。

---

## ファイル一覧

| ファイル | 用途 |
| --- | --- |
| [TASFUL_AI.md](./TASFUL_AI.md) | TASFUL AI Workspace（総合 AI） |
| [TASFUL_AI_QA.md](./TASFUL_AI_QA.md) | サイト内 QA — QA 記事コンポーネント SSOT（**AD-015** · 設計のみ） |
| [AI_MEMBERSHIP_PRICING.md](./AI_MEMBERSHIP_PRICING.md) | AI Membership 料金 · Fair Use（**Draft**） |
| [BUILDER_ARCHITECTURE.md](./BUILDER_ARCHITECTURE.md) | Builder 全体構成 · Talk統一 · 課金 · ナビ（**Active**） |
| [BUILDER_AI_CONDITIONAL_SEARCH.md](./BUILDER_AI_CONDITIONAL_SEARCH.md) | Builder 条件検索（P0 ✅ · P1 ✅ · P2 📋） |
| [BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md) | Builder 課金 · Contact Reveal（**Draft + demo UI**） |
| [BUILDER_PROVIDER_LISTING.md](./BUILDER_PROVIDER_LISTING.md) | Builder 掲載 · Sponsored Visibility（**Draft · 設計のみ**） |
| [SPONSOR_ADS.md](../SPONSOR_ADS.md) | **共通スポンサー広告システム**（Platform/Builder/BD · **Future · organic 非干渉**） |
| [BUILDER_CREDITS.md](./BUILDER_CREDITS.md) | Builder Credits 共通ポイント（**Future Draft · 設計のみ**） |
| [BUILDER_AI.md](./BUILDER_AI.md) | Builder 専用 AI |
| [PLATFORM_AI.md](./PLATFORM_AI.md) | Platform → TASFUL AI 入口 |
| [SECRETARY_AI.md](./SECRETARY_AI.md) | AI 運営秘書 |
| [TLV_AI.md](./TLV_AI.md) | TLV → TASFUL AI 導線 |
| [AI_TEAM_CONSTITUTION.md](./AI_TEAM_CONSTITUTION.md) | AI チーム憲章 |
| [TASFUL_AI_SAFE_OPS_FOUNDATION.md](./TASFUL_AI_SAFE_OPS_FOUNDATION.md) | **TASFUL AI 安全運用基盤**（2026-08 予定 · WAF/Turnstile/Usage Guard） |

---

## Voice Core — Realtime Live 対応（Phase 5-D · 2026-06-27）

OpenAI Realtime **Live opt-in**（flags default OFF · mock fallback）。正本: `reports/voice-phase5d-complete.md`

### 対応済み

| Surface | ページ | surface | フラグ（両方必要） |
| --- | --- | --- | --- |
| **TASFUL AI** | `ai-workspace.html` | `tasful_ai` | `__TASU_VOICE_CORE_OPENAI_LIVE__` + `__TASU_VOICE_LIVE_TASFUL_AI__` |
| **Builder AI** | `builder/builder-ai.html` | `builder_ai` | `__TASU_VOICE_CORE_OPENAI_LIVE__` + `__TASU_VOICE_LIVE_BUILDER_AI__` |
| **AI秘書** | `admin-operations-dashboard.html` | `ops_secretary` | `__TASU_VOICE_CORE_OPENAI_LIVE__` + `__TASU_VOICE_LIVE_OPS_SECRETARY__` |

### 未対応

| Surface | 備考 |
| --- | --- |
| **TLV** | Workspace 入口のみ · 専用 Voice なし（AD-004） |
| **Platform** | TASFUL AI 入口のみ · 専用 Voice なし（AD-003） |
| **その他将来 Surface** | 横断 Voice Core 拡張時に個別 opt-in を追加 |

---

## 関連

- [DECISIONS.md](../DECISIONS.md) AD-011 — サービス展開方針（正本）
- [DECISIONS.md](../DECISIONS.md) AD-012 — UI/UX 設計原則（正本）
- [DECISIONS.md](../DECISIONS.md) AD-002〜004 — AI 統合・専用エンジン方針
- [AGENTS.md](../../AGENTS.md) §Supabase MCP — Supabase MCP 共通ルール（Staging 専用 · 全 AI エージェント）
- [TODO.md](../TODO.md) §方針 — 開発優先順位 · AI プロバイダ分担
- [pricing-catalog.md](../pricing-catalog.md) — AI Lite ¥300 / Pro ¥980 等の価格 SSOT（provisional SKU あり）
- **GenAI Stripe E2E Functions**（`stripe-e2e-simulate-genai-*` · `stripe-e2e-pay-genai-checkout`）— **push / deploy 前監査対象** · production 除外候補 · JWT 本人確認・production 拒否は未確認（修正しない限り本番安全と断定しない）
