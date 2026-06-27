# AI 領域ドキュメント

**最終更新:** 2026-06-27（Voice Phase 5-D）

各製品の AI 詳細は個別ファイルが正本。サービス全体の **国内/海外展開方針** は [DECISIONS.md](../DECISIONS.md) **AD-011**（要約: [ROADMAP.md](../ROADMAP.md) §サービス展開方針）。**UI/UX 設計原則** は **AD-012**（要約: [ROADMAP.md](../ROADMAP.md) §UI/UX 設計原則）。

---

## ファイル一覧

| ファイル | 用途 |
| --- | --- |
| [TASFUL_AI.md](./TASFUL_AI.md) | TASFUL AI Workspace（総合 AI） |
| [BUILDER_AI.md](./BUILDER_AI.md) | Builder 専用 AI |
| [PLATFORM_AI.md](./PLATFORM_AI.md) | Platform → TASFUL AI 入口 |
| [SECRETARY_AI.md](./SECRETARY_AI.md) | AI 運営秘書 |
| [TLV_AI.md](./TLV_AI.md) | TLV → TASFUL AI 導線 |
| [AI_TEAM_CONSTITUTION.md](./AI_TEAM_CONSTITUTION.md) | AI チーム憲章 |

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
- [TODO.md](../TODO.md) §方針 — 開発優先順位 · AI プロバイダ分担
